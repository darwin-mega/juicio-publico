import 'server-only';
import { Redis } from '@upstash/redis';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  PlayerProfileSummary,
  PlayerProgressProfile,
  ProgressPlayerDelta,
  RankingEntry,
  RankingPeriod,
} from './types';
import { calculateProgressDeltas, createEmptyProgressStats, mergeStats } from './rules';
import { chooseHighlightedTitle, getTitleById, getUnlockedTitles } from './titles';
import type { ProgressGameResult } from './types';
import type { Role } from '@/lib/game/state';

const PREFIX = 'jp:progress';
const PROFILE_TTL_SECONDS = 60 * 60 * 24 * 365;

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const useSupabase = Boolean(supabaseUrl && supabaseServiceKey);
const useRedis = Boolean(redisUrl && redisToken);
const hasIncompleteSupabaseConfig = Boolean(supabaseUrl && !supabaseServiceKey);

let redis: Redis | null = null;
let supabaseAdmin: SupabaseClient | null = null;

function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: redisUrl!,
      token: redisToken!,
    });
  }
  return redis;
}

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createSupabaseClient(supabaseUrl!, supabaseServiceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseAdmin;
}

function assertProgressionStorageConfigured() {
  if (hasIncompleteSupabaseConfig) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY para usar progreso persistente en Supabase.');
  }
}

type ProgressProfileRow = {
  player_id: string;
  display_name: string;
  stats: PlayerProgressProfile['stats'];
  monthly_prestige: PlayerProgressProfile['monthlyPrestige'];
  highlighted_title_id: string | null;
  unlocked_title_ids: string[] | null;
  unlocked_rewards: PlayerProgressProfile['unlockedRewards'];
  created_at_ms: number;
  updated_at_ms: number;
};

function profileFromRow(row: ProgressProfileRow): PlayerProgressProfile {
  return {
    playerId: row.player_id,
    displayName: row.display_name,
    stats: row.stats,
    monthlyPrestige: row.monthly_prestige ?? {},
    highlightedTitleId: row.highlighted_title_id,
    unlockedTitleIds: row.unlocked_title_ids ?? [],
    unlockedRewards: row.unlocked_rewards ?? [],
    createdAt: row.created_at_ms,
    updatedAt: row.updated_at_ms,
  };
}

function profileToRow(profile: PlayerProgressProfile) {
  return {
    player_id: profile.playerId,
    display_name: profile.displayName,
    stats: profile.stats,
    monthly_prestige: profile.monthlyPrestige,
    highlighted_title_id: profile.highlightedTitleId,
    unlocked_title_ids: profile.unlockedTitleIds,
    unlocked_rewards: profile.unlockedRewards,
    created_at_ms: profile.createdAt,
    updated_at_ms: profile.updatedAt,
  };
}

const memoryProfiles = new Map<string, PlayerProgressProfile>();
const memoryProcessedGames = new Set<string>();

export function getCurrentProgressMonth(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

const keys = {
  profile: (playerId: string) => `${PREFIX}:player:${playerId}`,
  processedGame: (gameId: string) => `${PREFIX}:processed:${gameId}`,
  historicalRanking: `${PREFIX}:ranking:historical`,
  monthlyRanking: (month: string) => `${PREFIX}:ranking:monthly:${month}`,
};

function createProfile(playerId: string, displayName: string): PlayerProgressProfile {
  const now = Date.now();
  return {
    playerId,
    displayName,
    stats: createEmptyProgressStats(),
    monthlyPrestige: {},
    highlightedTitleId: null,
    unlockedTitleIds: [],
    unlockedRewards: [],
    createdAt: now,
    updatedAt: now,
  };
}

async function getProfile(playerId: string, displayName = 'Jugador'): Promise<PlayerProgressProfile> {
  assertProgressionStorageConfigured();

  if (useSupabase) {
    const { data, error } = await getSupabaseAdmin()
      .from('player_progress_profiles')
      .select('*')
      .eq('player_id', playerId)
      .maybeSingle();

    if (error) throw error;
    if (data) return profileFromRow(data as ProgressProfileRow);
  }

  if (useRedis) {
    const stored = await getRedis().get<PlayerProgressProfile>(keys.profile(playerId));
    if (stored) return stored;
  } else {
    const stored = memoryProfiles.get(playerId);
    if (stored) return stored;
  }

  return createProfile(playerId, displayName);
}

async function saveProfile(profile: PlayerProgressProfile) {
  assertProgressionStorageConfigured();

  if (useSupabase) {
    const { error } = await getSupabaseAdmin()
      .from('player_progress_profiles')
      .upsert(profileToRow(profile), { onConflict: 'player_id' });
    if (error) throw error;
    return;
  }

  if (useRedis) {
    const redisClient = getRedis();
    await redisClient.set(keys.profile(profile.playerId), profile, { ex: PROFILE_TTL_SECONDS });
    await redisClient.zadd(keys.historicalRanking, {
      member: profile.playerId,
      score: profile.stats.publicPrestige,
    });
    const month = getCurrentProgressMonth();
    await redisClient.zadd(keys.monthlyRanking(month), {
      member: profile.playerId,
      score: profile.monthlyPrestige[month] ?? 0,
    });
  } else {
    memoryProfiles.set(profile.playerId, profile);
  }
}

async function acquireGameProcessingLock(gameId: string) {
  assertProgressionStorageConfigured();

  if (useSupabase) {
    const { error } = await getSupabaseAdmin()
      .from('progress_processed_games')
      .insert({ game_id: gameId, processed_at_ms: Date.now() });

    if (!error) return true;
    if (error.code === '23505') return false;
    throw error;
  }

  if (useRedis) {
    const created = await getRedis().set(keys.processedGame(gameId), true, {
      nx: true,
      ex: PROFILE_TTL_SECONDS,
    });
    return created === 'OK';
  }

  if (memoryProcessedGames.has(gameId)) return false;
  memoryProcessedGames.add(gameId);
  return true;
}

async function releaseGameProcessingLock(gameId: string) {
  assertProgressionStorageConfigured();

  if (useSupabase) {
    const { error } = await getSupabaseAdmin()
      .from('progress_processed_games')
      .delete()
      .eq('game_id', gameId);
    if (error) throw error;
    return;
  }

  if (useRedis) {
    await getRedis().del(keys.processedGame(gameId));
  } else {
    memoryProcessedGames.delete(gameId);
  }
}

async function createRewardNotifications(profile: PlayerProgressProfile, previousRewardCount: number) {
  const newRewards = profile.unlockedRewards.slice(previousRewardCount);
  if (!useSupabase || newRewards.length === 0) return;

  const { error } = await getSupabaseAdmin()
    .from('progress_notifications')
    .insert(newRewards.map((reward) => ({
      player_id: profile.playerId,
      type: 'reward_unlocked',
      title: 'Nuevo logro desbloqueado',
      body: reward.title,
      reward_id: reward.id,
      created_at_ms: reward.unlockedAt,
    })));

  if (error) throw error;
}

function applyDeltaToProfile(profile: PlayerProgressProfile, delta: ProgressPlayerDelta, month: string) {
  const previousTitleIds = new Set(profile.unlockedTitleIds);
  const updatedStats = mergeStats(profile.stats, delta.statIncrements, delta.won);
  const unlockedTitles = getUnlockedTitles(updatedStats);
  const unlockedTitleIds = unlockedTitles.map((title) => title.id);
  const newTitleRewards = unlockedTitles
    .filter((title) => !previousTitleIds.has(title.id))
    .map((title) => ({
      id: `title_reward_${title.id}`,
      kind: 'title' as const,
      title: title.title,
      sourceTitleId: title.id,
      unlockedAt: Date.now(),
    }));

  return {
    ...profile,
    displayName: delta.displayName || profile.displayName,
    stats: updatedStats,
    monthlyPrestige: {
      ...profile.monthlyPrestige,
      [month]: (profile.monthlyPrestige[month] ?? 0) + delta.prestigeDelta,
    },
    highlightedTitleId: chooseHighlightedTitle(updatedStats),
    unlockedTitleIds,
    unlockedRewards: [...profile.unlockedRewards, ...newTitleRewards],
    updatedAt: Date.now(),
  } satisfies PlayerProgressProfile;
}

export async function applyGameProgress(result: ProgressGameResult) {
  const lockAcquired = await acquireGameProcessingLock(result.gameId);
  if (!lockAcquired) {
    return { applied: false, deltas: [] };
  }

  let savedProfiles = 0;

  try {
    const month = getCurrentProgressMonth(new Date(result.completedAt));
    const deltas = calculateProgressDeltas(result);

    for (const delta of deltas) {
      const profile = await getProfile(delta.playerId, delta.displayName);
      const updatedProfile = applyDeltaToProfile(profile, delta, month);
      await saveProfile(updatedProfile);
      savedProfiles += 1;
      await createRewardNotifications(updatedProfile, profile.unlockedRewards.length);
    }

    return { applied: true, deltas };
  } catch (error) {
    if (savedProfiles === 0) {
      await releaseGameProcessingLock(result.gameId);
    }
    throw error;
  }
}

function getBestRole(profile: PlayerProgressProfile): Role | null {
  const roleScores: Array<{ role: Role; value: number }> = [
    { role: 'killer', value: profile.stats.killer.wins + profile.stats.killer.kills },
    { role: 'cop', value: profile.stats.cop.wins + profile.stats.cop.correctInvestigations + profile.stats.cop.correctAccusations },
    { role: 'doctor', value: profile.stats.doctor.wins + profile.stats.doctor.correctSaves },
    { role: 'town', value: profile.stats.town.wins + profile.stats.town.correctKillerVotes },
  ];

  const best = roleScores.sort((a, b) => b.value - a.value)[0];
  return best.value > 0 ? best.role : null;
}

async function getRank(playerId: string, period: RankingPeriod, month = getCurrentProgressMonth()) {
  const ranking = await getRanking(period, { month, limit: 500 });
  return ranking.find((entry) => entry.playerId === playerId)?.rank ?? null;
}

export async function getPlayerProfileSummary(playerId: string, displayName?: string): Promise<PlayerProfileSummary> {
  let profile = await getProfile(playerId, displayName);
  if (displayName && displayName.trim() && profile.displayName !== displayName.trim()) {
    profile = {
      ...profile,
      displayName: displayName.trim(),
      updatedAt: Date.now(),
    };
    await saveProfile(profile);
  }
  const highlightedTitle = getTitleById(profile.highlightedTitleId);

  return {
    playerId: profile.playerId,
    displayName: profile.displayName,
    publicPrestige: profile.stats.publicPrestige,
    gamesPlayed: profile.stats.gamesPlayed,
    gamesWon: profile.stats.gamesWon,
    bestRole: getBestRole(profile),
    highlightedTitle: highlightedTitle?.title ?? null,
    currentWinStreak: profile.stats.currentWinStreak,
    monthlyRank: await getRank(playerId, 'monthly'),
    historicalRank: await getRank(playerId, 'historical'),
    stats: profile.stats,
    unlockedTitles: getUnlockedTitles(profile.stats),
    unlockedRewards: profile.unlockedRewards,
  };
}

function buildRankingEntriesFromProfiles(profiles: PlayerProgressProfile[], period: RankingPeriod, month: string, limit: number): RankingEntry[] {
  return profiles
    .map((profile) => ({
      profile,
      score: period === 'historical'
        ? profile.stats.publicPrestige
        : profile.monthlyPrestige[month] ?? 0,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ profile }, index) => ({
      playerId: profile.playerId,
      displayName: profile.displayName,
      publicPrestige: profile.stats.publicPrestige,
      monthlyPrestige: profile.monthlyPrestige[month] ?? 0,
      highlightedTitle: getTitleById(profile.highlightedTitleId)?.title ?? null,
      gamesPlayed: profile.stats.gamesPlayed,
      gamesWon: profile.stats.gamesWon,
      rank: index + 1,
    }));
}

export async function getRanking(
  period: RankingPeriod,
  options: { month?: string; limit?: number } = {}
): Promise<RankingEntry[]> {
  assertProgressionStorageConfigured();

  const month = options.month ?? getCurrentProgressMonth();
  const limit = options.limit ?? 50;

  if (useSupabase) {
    const { data, error } = await getSupabaseAdmin()
      .from('player_progress_profiles')
      .select('*')
      .limit(1000);

    if (error) throw error;
    return buildRankingEntriesFromProfiles(
      (data ?? []).map((row) => profileFromRow(row as ProgressProfileRow)),
      period,
      month,
      limit
    );
  }

  if (!useRedis) {
    return buildRankingEntriesFromProfiles(Array.from(memoryProfiles.values()), period, month, limit);
  }

  const rankingKey = period === 'historical'
    ? keys.historicalRanking
    : keys.monthlyRanking(month);
  const ids = await getRedis().zrange<string[]>(rankingKey, 0, limit - 1, { rev: true });
  const profiles = (await Promise.all(ids.map((id) => getProfile(id)))).filter(Boolean);
  return buildRankingEntriesFromProfiles(profiles, period, month, limit);
}
