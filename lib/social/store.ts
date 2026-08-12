import 'server-only';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient, hasSupabaseConfig } from '@/lib/supabase/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const registrationWebhookUrl = process.env.GOOGLE_SHEETS_REGISTRATION_WEBHOOK_URL;

let adminClient: SupabaseClient | null = null;

type SocialProfileRow = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  friend_code: string;
};

function getAdminClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Falta configurar Supabase social con SUPABASE_SERVICE_ROLE_KEY.');
  }

  if (!adminClient) {
    adminClient = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

function normalizeUsername(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);
}

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function levenshteinDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
}

function isSubsequence(query: string, value: string) {
  let queryIndex = 0;
  for (const char of value) {
    if (char === query[queryIndex]) queryIndex += 1;
    if (queryIndex === query.length) return true;
  }
  return false;
}

function scoreSearchMatch(query: string, value: string) {
  if (!query || !value) return 0;
  if (value === query) return 1000;
  if (value.startsWith(query)) return 850 - Math.min(value.length - query.length, 120);
  if (value.includes(query)) return 680 - Math.min(value.indexOf(query), 120);
  if (isSubsequence(query, value)) return 420 - Math.min(value.length - query.length, 120);

  const distance = levenshteinDistance(query, value);
  const longest = Math.max(query.length, value.length);
  const similarity = longest === 0 ? 0 : 1 - distance / longest;
  return similarity >= 0.45 ? Math.round(similarity * 360) : 0;
}

function getDisplayName(user: { user_metadata?: Record<string, unknown>; email?: string }) {
  const metadata = user.user_metadata ?? {};
  const value = metadata.username || metadata.full_name || metadata.name || user.email?.split('@')[0];
  return typeof value === 'string' && value.trim() ? value.trim() : 'Jugador';
}

function getAvatarUrl(user: { user_metadata?: Record<string, unknown> }) {
  const metadata = user.user_metadata ?? {};
  const value = metadata.avatar_url || metadata.picture;
  return typeof value === 'string' ? value : null;
}

function getAuthProvider(user: { app_metadata?: Record<string, unknown> }) {
  const value = user.app_metadata?.provider || user.app_metadata?.providers;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(',');
  return 'email';
}

function getFriendCode(userId: string) {
  return userId.replace(/-/g, '').slice(0, 12);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getCurrentUser() {
  if (!hasSupabaseConfig()) throw new Error('Supabase no esta configurado.');
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sesion requerida.');
  return data.user;
}

async function getProfilesByIds(userIds: string[]) {
  const ids = Array.from(new Set(userIds)).filter(Boolean);
  if (!ids.length) return new Map<string, SocialProfileRow>();

  const { data, error } = await getAdminClient()
    .from('social_user_profiles')
    .select('user_id, username, display_name, avatar_url, friend_code')
    .in('user_id', ids);

  if (error) throw error;
  return new Map<string, SocialProfileRow>((data ?? []).map((profile) => [profile.user_id, profile]));
}

async function sendRegistrationToSheet(
  user: {
    id: string;
    email?: string;
    app_metadata?: Record<string, unknown>;
  },
  profile: SocialProfileRow
) {
  if (!registrationWebhookUrl) return;

  try {
    const response = await fetch(registrationWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: profile.user_id,
        email: user.email ?? '',
        display_name: profile.display_name,
        username: profile.username,
        friend_code: profile.friend_code,
        provider: getAuthProvider(user),
      }),
    });

    if (!response.ok) {
      console.warn('[social/sheets] Google Sheets respondio con error', response.status);
    }
  } catch (error) {
    console.warn('[social/sheets] No se pudo enviar el registro a Google Sheets', error);
  }
}

export async function ensureSocialProfile() {
  const user = await getCurrentUser();
  const admin = getAdminClient();
  const displayName = getDisplayName(user);
  const metadataUsername =
    typeof user.user_metadata?.username === 'string' ? user.user_metadata.username : displayName;
  const username = normalizeUsername(metadataUsername) || `jugador_${getFriendCode(user.id)}`;
  const now = Date.now();

  const { data: existing } = await admin
    .from('social_user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const profile = {
    user_id: user.id,
    username: existing?.username ?? username,
    display_name: displayName,
    avatar_url: getAvatarUrl(user),
    friend_code: existing?.friend_code ?? getFriendCode(user.id),
    created_at_ms: existing?.created_at_ms ?? now,
    updated_at_ms: now,
  };

  const { data, error } = await admin
    .from('social_user_profiles')
    .upsert(profile, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) throw error;
  if (!existing) {
    await sendRegistrationToSheet(user, data);
  }
  return data;
}

export async function getSocialSummary() {
  const profile = await ensureSocialProfile();
  const friends = await listFriends();
  const incoming = await listIncomingFriendRequests();
  const outgoing = await listOutgoingFriendRequests();
  const roomInvites = await listRoomInvites();
  return { profile, friends, incoming, outgoing, roomInvites };
}

export async function searchUsers(query: string) {
  const me = await ensureSocialProfile();
  const q = normalizeSearchValue(query);
  if (q.length < 2) return [];

  const { data, error } = await getAdminClient()
    .from('social_user_profiles')
    .select('user_id, username, display_name, avatar_url, friend_code')
    .neq('user_id', me.user_id)
    .limit(500);

  if (error) throw error;
  return (data ?? [])
    .map((profile) => {
      const username = normalizeSearchValue(profile.username ?? '');
      const displayName = normalizeSearchValue(profile.display_name ?? '');
      const friendCode = normalizeSearchValue(profile.friend_code ?? '');
      const score = Math.max(
        scoreSearchMatch(q, username),
        scoreSearchMatch(q, displayName),
        scoreSearchMatch(q, friendCode)
      );
      return { profile, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.profile.username.localeCompare(b.profile.username);
    })
    .slice(0, 10)
    .map(({ profile }) => profile);
}

export async function requestFriend(targetUserId: string) {
  const me = await ensureSocialProfile();
  if (!isUuid(targetUserId)) throw new Error('Usuario invalido.');
  if (me.user_id === targetUserId) throw new Error('No podes agregarte a vos mismo.');

  const now = Date.now();
  const admin = getAdminClient();
  const { data: existingRows, error: existingError } = await admin
    .from('player_friendships')
    .select('id, requester_id, addressee_id, status')
    .or(`and(requester_id.eq.${me.user_id},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${me.user_id})`)
    .order('created_at_ms', { ascending: true })
    .limit(1);

  if (existingError) throw existingError;

  const existing = existingRows?.[0];
  if (existing) {
    if (existing.status === 'accepted') return existing;

    const nextStatus =
      existing.status === 'pending' && existing.addressee_id === me.user_id
        ? 'accepted'
        : 'pending';

    const { data, error } = await admin
      .from('player_friendships')
      .update({ status: nextStatus, updated_at_ms: now })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await admin
    .from('player_friendships')
    .insert({
      requester_id: me.user_id,
      addressee_id: targetUserId,
      status: 'pending',
      created_at_ms: now,
      updated_at_ms: now,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function requestFriendByCode(friendCode: string) {
  const code = friendCode.trim();
  if (!code) throw new Error('Codigo invalido.');

  const { data, error } = await getAdminClient()
    .from('social_user_profiles')
    .select('user_id')
    .eq('friend_code', code)
    .maybeSingle();

  if (error) throw error;
  if (!data?.user_id) throw new Error('No encontramos ese enlace de amigo.');
  return requestFriend(data.user_id);
}

export async function respondFriendship(friendshipId: string, status: 'accepted' | 'blocked') {
  const me = await ensureSocialProfile();
  if (!isUuid(friendshipId)) throw new Error('Solicitud invalida.');

  const { data: friendship, error: friendshipError } = await getAdminClient()
    .from('player_friendships')
    .select('id, requester_id, addressee_id, status')
    .eq('id', friendshipId)
    .maybeSingle();

  if (friendshipError) throw friendshipError;
  if (!friendship) throw new Error('Solicitud no encontrada.');
  if (friendship.requester_id !== me.user_id && friendship.addressee_id !== me.user_id) {
    throw new Error('No podes modificar esta solicitud.');
  }
  if (status === 'accepted' && friendship.addressee_id !== me.user_id) {
    throw new Error('Solo quien recibe la solicitud puede aceptarla.');
  }

  const { error } = await getAdminClient()
    .from('player_friendships')
    .update({ status, updated_at_ms: Date.now() })
    .eq('id', friendshipId);
  if (error) throw error;
}

export async function listIncomingFriendRequests() {
  const me = await ensureSocialProfile();
  const { data, error } = await getAdminClient()
    .from('player_friendships')
    .select('id, requester_id, addressee_id, status, created_at_ms')
    .eq('addressee_id', me.user_id)
    .eq('status', 'pending')
    .order('created_at_ms', { ascending: false });
  if (error) throw error;

  const profiles = await getProfilesByIds((data ?? []).map((request) => request.requester_id));
  return (data ?? []).map((request) => ({
    ...request,
    profile: profiles.get(request.requester_id) ?? null,
  }));
}

export async function listOutgoingFriendRequests() {
  const me = await ensureSocialProfile();
  const { data, error } = await getAdminClient()
    .from('player_friendships')
    .select('id, requester_id, addressee_id, status, created_at_ms')
    .eq('requester_id', me.user_id)
    .eq('status', 'pending')
    .order('created_at_ms', { ascending: false });
  if (error) throw error;

  const profiles = await getProfilesByIds((data ?? []).map((request) => request.addressee_id));
  return (data ?? []).map((request) => ({
    ...request,
    profile: profiles.get(request.addressee_id) ?? null,
  }));
}

export async function listFriends() {
  const me = await ensureSocialProfile();
  const { data, error } = await getAdminClient()
    .from('player_friendships')
    .select('id, requester_id, addressee_id, status')
    .or(`requester_id.eq.${me.user_id},addressee_id.eq.${me.user_id}`)
    .eq('status', 'accepted');
  if (error) throw error;

  const friendIds = (data ?? []).map((row) => row.requester_id === me.user_id ? row.addressee_id : row.requester_id);
  if (!friendIds.length) return [];

  const { data: profiles, error: profilesError } = await getAdminClient()
    .from('social_user_profiles')
    .select('user_id, username, display_name, avatar_url, friend_code')
    .in('user_id', friendIds);
  if (profilesError) throw profilesError;
  return profiles ?? [];
}

export async function createRoomInvites(roomId: string, inviteeIds: string[]) {
  const me = await ensureSocialProfile();
  const uniqueIds = Array.from(new Set(inviteeIds)).filter((id) => id !== me.user_id);
  if (!uniqueIds.length) return [];

  const now = Date.now();
  const { data, error } = await getAdminClient()
    .from('room_direct_invites')
    .upsert(uniqueIds.map((inviteeId) => ({
      room_id: roomId.toUpperCase(),
      inviter_id: me.user_id,
      invitee_id: inviteeId,
      status: 'pending',
      created_at_ms: now,
      updated_at_ms: now,
      expires_at_ms: now + 24 * 60 * 60 * 1000,
    })), { onConflict: 'room_id,invitee_id' })
    .select('*');

  if (error) throw error;
  return data ?? [];
}

export async function listRoomInvites() {
  const me = await ensureSocialProfile();
  const now = Date.now();
  const { data, error } = await getAdminClient()
    .from('room_direct_invites')
    .select('id, room_id, inviter_id, invitee_id, status, created_at_ms, expires_at_ms')
    .eq('invitee_id', me.user_id)
    .eq('status', 'pending')
    .or(`expires_at_ms.is.null,expires_at_ms.gt.${now}`)
    .order('created_at_ms', { ascending: false });

  if (error) throw error;

  const profiles = await getProfilesByIds((data ?? []).map((invite) => invite.inviter_id));
  return (data ?? []).map((invite) => ({
    ...invite,
    inviter: profiles.get(invite.inviter_id) ?? null,
  }));
}

export async function respondRoomInvite(inviteId: string, status: 'accepted' | 'declined') {
  const me = await ensureSocialProfile();
  if (!isUuid(inviteId)) throw new Error('Invitacion invalida.');

  const { data, error } = await getAdminClient()
    .from('room_direct_invites')
    .update({ status, updated_at_ms: Date.now() })
    .eq('id', inviteId)
    .eq('invitee_id', me.user_id)
    .select('id, room_id, status')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Invitacion no encontrada.');
  return data;
}

export async function getFriendsRanking(period: 'historical' | 'monthly') {
  const me = await ensureSocialProfile();
  const friends = await listFriends();
  const ids = [me.user_id, ...friends.map((friend) => friend.user_id)];
  if (!ids.length) return [];

  const { getRanking } = await import('@/lib/progression/store');
  const ranking = await getRanking(period, { limit: 500 });
  return ranking.filter((entry) => ids.includes(entry.playerId));
}

export async function createCompetition(name: string, durationType: 'monthly' | 'bimonthly', inviteeIds: string[]) {
  const me = await ensureSocialProfile();
  const now = Date.now();
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + (durationType === 'bimonthly' ? 2 : 1));

  const { data: competition, error } = await getAdminClient()
    .from('private_competitions')
    .insert({
      name,
      creator_id: me.user_id,
      duration_type: durationType,
      starts_at_ms: now,
      ends_at_ms: end.getTime(),
      status: 'active',
      created_at_ms: now,
      updated_at_ms: now,
    })
    .select('*')
    .single();
  if (error) throw error;

  const memberIds = Array.from(new Set([me.user_id, ...inviteeIds]));
  const { error: membersError } = await getAdminClient()
    .from('private_competition_members')
    .insert(memberIds.map((userId) => ({
      competition_id: competition.id,
      user_id: userId,
      status: userId === me.user_id ? 'active' : 'invited',
      score: 0,
      invited_by: me.user_id,
      created_at_ms: now,
      updated_at_ms: now,
    })));
  if (membersError) throw membersError;

  return competition;
}

export async function listCompetitions() {
  const me = await ensureSocialProfile();
  const { data: memberships, error } = await getAdminClient()
    .from('private_competition_members')
    .select('competition_id, status, score')
    .eq('user_id', me.user_id);
  if (error) throw error;
  const ids = (memberships ?? []).map((row) => row.competition_id);
  if (!ids.length) return [];

  const { data, error: competitionsError } = await getAdminClient()
    .from('private_competitions')
    .select('*')
    .in('id', ids)
    .order('created_at_ms', { ascending: false });
  if (competitionsError) throw competitionsError;
  return data ?? [];
}
