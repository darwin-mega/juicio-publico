'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient, hasSupabaseConfig } from '@/lib/supabase/client';
import QRCode from '@/components/QRCode';

type RankingEntry = {
  playerId: string;
  displayName: string;
  publicPrestige: number;
  monthlyPrestige: number;
  highlightedTitle: string | null;
  gamesPlayed: number;
  gamesWon: number;
  rank: number;
};

type ProfileSummary = {
  playerId: string;
  displayName: string;
  publicPrestige: number;
  gamesPlayed: number;
  gamesWon: number;
  highlightedTitle: string | null;
  currentWinStreak: number;
  monthlyRank: number | null;
  historicalRank: number | null;
  unlockedTitles: Array<{ id: string; title: string; threshold: number; group: string }>;
  unlockedRewards: Array<{ id: string; title: string; unlockedAt: number }>;
  stats: {
    survivedToEnd: number;
    bestWinStreak: number;
    killer: { kills: number };
    cop: { correctInvestigations: number; correctAccusations: number };
    doctor: { correctSaves: number };
    town: { correctKillerVotes: number };
  };
};

type ProgressNotification = {
  id: string;
  title: string;
  body: string;
  created_at_ms: number;
};

type SocialProfile = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  friend_code: string;
};

type FriendRequest = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at_ms: number;
  profile: SocialProfile | null;
};

type RoomInvite = {
  id: string;
  room_id: string;
  inviter_id: string;
  invitee_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at_ms: number;
  expires_at_ms: number | null;
  inviter: SocialProfile | null;
};

type Competition = {
  id: string;
  name: string;
  duration_type: 'monthly' | 'bimonthly';
  status: 'upcoming' | 'active' | 'finished';
  ends_at_ms: number;
};

function getDisplayName(user: User) {
  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    'Cliente'
  );
}

function getInitials(user: User | null) {
  if (!user) return 'C';
  const displayName = getDisplayName(user);
  return displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0])
    .join('')
    .toUpperCase();
}

export default function ClientePage() {
  const router = useRouter();
  const supabaseConfigured = hasSupabaseConfig();
  const supabase = useMemo(() => (supabaseConfigured ? createClient() : null), [supabaseConfigured]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [historicalRanking, setHistoricalRanking] = useState<RankingEntry[]>([]);
  const [monthlyRanking, setMonthlyRanking] = useState<RankingEntry[]>([]);
  const [notifications, setNotifications] = useState<ProgressNotification[]>([]);
  const [socialProfile, setSocialProfile] = useState<SocialProfile | null>(null);
  const [friends, setFriends] = useState<SocialProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [roomInvites, setRoomInvites] = useState<RoomInvite[]>([]);
  const [friendRanking, setFriendRanking] = useState<RankingEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SocialProfile[]>([]);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [socialMessage, setSocialMessage] = useState<string | null>(null);
  const [competitionName, setCompetitionName] = useState('');
  const [competitionDuration, setCompetitionDuration] = useState<'monthly' | 'bimonthly'>('monthly');
  const [competitions, setCompetitions] = useState<Competition[]>([]);

  useEffect(() => {
    async function loadUser() {
      if (!supabase) {
        router.replace('/login?error=missing-config');
        return;
      }

      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.replace('/login');
        return;
      }

      setUser(data.user);
      setLoading(false);
    }

    void loadUser();
  }, [router, supabase]);

  useEffect(() => {
    if (!user) return;

    async function loadProgress() {
      const playerId = user!.id;
      const profileParams = new URLSearchParams({
        playerId,
        displayName: getDisplayName(user!),
      });
      const notificationsParams = new URLSearchParams({ playerId });
      const [
        profileRes,
        historicalRankingRes,
        monthlyRankingRes,
        notificationsRes,
        socialRes,
        friendsRankingRes,
        competitionsRes,
      ] = await Promise.all([
        fetch(`/api/progression/profile?${profileParams.toString()}`),
        fetch('/api/progression/ranking?period=historical&limit=10'),
        fetch('/api/progression/ranking?period=monthly&limit=10'),
        fetch(`/api/progression/notifications?${notificationsParams.toString()}`),
        fetch('/api/social/summary'),
        fetch('/api/social/friends-ranking?period=historical'),
        fetch('/api/social/competitions'),
      ]);

      if (profileRes.ok) {
        const data = await profileRes.json();
        setProfile(data.profile);
      }
      if (historicalRankingRes.ok) {
        const data = await historicalRankingRes.json();
        setHistoricalRanking(data.ranking ?? []);
      }
      if (monthlyRankingRes.ok) {
        const data = await monthlyRankingRes.json();
        setMonthlyRanking(data.ranking ?? []);
      }
      if (notificationsRes.ok) {
        const data = await notificationsRes.json();
        setNotifications(data.notifications ?? []);
      }
      if (socialRes.ok) {
        const data = await socialRes.json();
        setSocialProfile(data.profile);
        setFriends(data.friends ?? []);
        setIncomingRequests(data.incoming ?? []);
        setOutgoingRequests(data.outgoing ?? []);
        setRoomInvites(data.roomInvites ?? []);
        setSocialError(null);
      } else {
        setSocialError('La capa social necesita ejecutar supabase/social.sql.');
      }
      if (friendsRankingRes.ok) {
        const data = await friendsRankingRes.json();
        setFriendRanking(data.ranking ?? []);
      }
      if (competitionsRes.ok) {
        const data = await competitionsRes.json();
        setCompetitions(data.competitions ?? []);
      }
    }

    void loadProgress();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const friendCode = new URLSearchParams(window.location.search).get('friend');
    if (!friendCode) return;

    async function addFriendFromLink() {
      const res = await fetch('/api/social/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendCode }),
      });

      if (!res.ok) {
        setSocialError('No se pudo usar ese enlace de amigo.');
        return;
      }

      window.history.replaceState(null, '', window.location.pathname);
      setSocialMessage('Solicitud de amistad enviada.');
      await refreshSocial();
    }

    void addFriendFromLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function refreshSocial() {
    const [socialRes, friendsRankingRes] = await Promise.all([
      fetch('/api/social/summary'),
      fetch('/api/social/friends-ranking?period=historical'),
    ]);

    if (socialRes.ok) {
      const data = await socialRes.json();
      setSocialProfile(data.profile);
      setFriends(data.friends ?? []);
      setIncomingRequests(data.incoming ?? []);
      setOutgoingRequests(data.outgoing ?? []);
      setRoomInvites(data.roomInvites ?? []);
      setSocialError(null);
    }
    if (friendsRankingRes.ok) {
      const data = await friendsRankingRes.json();
      setFriendRanking(data.ranking ?? []);
    }
  }

  async function handleLogout() {
    await supabase?.auth.signOut();
    router.replace('/login');
  }

  async function handleSearchUsers() {
    if (searchQuery.trim().length < 2) return;
    const res = await fetch(`/api/social/search?q=${encodeURIComponent(searchQuery.trim())}`);
    if (!res.ok) {
      setSocialError('No se pudo buscar usuarios.');
      return;
    }
    const data = await res.json();
    setSearchResults(data.users ?? []);
  }

  async function handleAddFriend(targetUserId: string) {
    const res = await fetch('/api/social/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId }),
    });
    if (!res.ok) {
      setSocialError('No se pudo enviar la solicitud.');
      return;
    }
    setSocialMessage('Solicitud enviada.');
    setSearchResults((current) => current.filter((item) => item.user_id !== targetUserId));
    await refreshSocial();
  }

  async function handleRespondFriendship(friendshipId: string, status: 'accepted' | 'blocked') {
    const res = await fetch('/api/social/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendshipId, status }),
    });
    if (!res.ok) {
      setSocialError('No se pudo responder la solicitud.');
      return;
    }
    setSocialMessage(status === 'accepted' ? 'Amistad aceptada.' : 'Solicitud rechazada.');
    await refreshSocial();
  }

  async function handleRespondRoomInvite(invite: RoomInvite, status: 'accepted' | 'declined') {
    const res = await fetch('/api/social/room-invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteId: invite.id, status }),
    });
    if (!res.ok) {
      setSocialError('No se pudo responder la invitacion.');
      return;
    }
    setRoomInvites((current) => current.filter((item) => item.id !== invite.id));
    if (status === 'accepted') {
      router.push(`/join/${invite.room_id}`);
      return;
    }
    setSocialMessage('Invitacion rechazada.');
  }

  async function handleCreateCompetition() {
    if (!competitionName.trim()) return;
    const res = await fetch('/api/social/competitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: competitionName.trim(),
        durationType: competitionDuration,
        inviteeIds: friends.map((friend) => friend.user_id),
      }),
    });
    if (!res.ok) {
      setSocialError('No se pudo crear el campeonato.');
      return;
    }
    const data = await res.json();
    setCompetitions((current) => [data.competition, ...current]);
    setCompetitionName('');
  }

  if (loading) {
    return (
      <main className="page-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p>Cargando cliente...</p>
      </main>
    );
  }

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const provider = user?.app_metadata?.provider || 'email';
  const displayName = user ? getDisplayName(user) : 'Cliente';
  const friendUrl = socialProfile && typeof window !== 'undefined'
    ? `${window.location.origin}/cliente?friend=${socialProfile.friend_code}`
    : '';

  return (
    <main className="page-shell">
      <header className="page-header" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push('/jugar')} style={{ width: 'auto' }}>
          Volver
        </button>
        <span className="phase-badge">Cliente</span>
      </header>

      <section className="page-content" style={{ justifyContent: 'flex-start', gap: 'var(--sp-lg)' }}>
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 'var(--sp-md)',
            padding: 'var(--sp-xl)',
          }}
        >
          <div
            style={{
              width: 128,
              height: 128,
              borderRadius: '50%',
              padding: 4,
              background: 'linear-gradient(135deg, var(--accent), var(--danger))',
              boxShadow: '0 0 38px rgba(108,99,255,0.28)',
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={`Foto de ${displayName}`}
                referrerPolicy="no-referrer"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: '50%',
                  border: '4px solid var(--bg-surface)',
                  display: 'block',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  border: '4px solid var(--bg-surface)',
                  background: 'var(--bg-base)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--text-2xl)',
                  fontWeight: 800,
                }}
              >
                {getInitials(user)}
              </div>
            )}
          </div>

          <div>
            <h1>{displayName}</h1>
            <p>{user?.email}</p>
          </div>

          <div className="card-section" style={{ width: '100%', display: 'grid', gap: 'var(--sp-sm)', textAlign: 'left' }}>
            <div className="flex justify-between">
              <span className="text-muted">Proveedor</span>
              <strong style={{ textTransform: 'capitalize' }}>{provider}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Cuenta creada</span>
              <strong>{user?.created_at ? new Date(user.created_at).toLocaleDateString('es-UY') : '-'}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Ultimo acceso</span>
              <strong>{user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('es-UY') : '-'}</strong>
            </div>
          </div>
        </div>

        <div className="card" style={{ width: '100%', padding: 'var(--sp-lg)', display: 'grid', gap: 'var(--sp-md)' }}>
          <div className="flex justify-between">
            <div>
              <h2>Mi progreso</h2>
              <p className="text-muted">Prestigio, rachas y premios desbloqueados.</p>
            </div>
            <span className="phase-badge">{profile?.publicPrestige ?? 0} pts</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-sm)' }}>
            {[
              ['Partidas', profile?.gamesPlayed ?? 0],
              ['Ganadas', profile?.gamesWon ?? 0],
              ['Racha', profile?.currentWinStreak ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="card-section" style={{ textAlign: 'center' }}>
                <strong style={{ fontSize: 'var(--text-xl)' }}>{value}</strong>
                <span className="text-muted" style={{ fontSize: 'var(--text-xs)' }}>{label}</span>
              </div>
            ))}
          </div>

          <div className="card-section" style={{ display: 'grid', gap: 'var(--sp-sm)' }}>
            <div className="flex justify-between">
              <span className="text-muted">Titulo destacado</span>
              <strong>{profile?.highlightedTitle ?? 'Sin titulo todavia'}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Ranking general</span>
              <strong>{profile?.historicalRank ? `#${profile.historicalRank}` : '-'}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Ranking mensual</span>
              <strong>{profile?.monthlyRank ? `#${profile.monthlyRank}` : '-'}</strong>
            </div>
          </div>
        </div>

        <div className="card" style={{ width: '100%', padding: 'var(--sp-lg)', display: 'grid', gap: 'var(--sp-md)' }}>
          <div className="flex justify-between">
            <div>
              <h2>Amigos</h2>
              <p className="text-muted">Agrega por username, QR o enlace personal.</p>
            </div>
            <span className="phase-badge">{friends.length}</span>
          </div>

          {socialError && (
            <div className="info-box warning">{socialError}</div>
          )}
          {socialMessage && (
            <div className="info-box">{socialMessage}</div>
          )}

          {roomInvites.length > 0 && (
            <div className="card-section" style={{ display: 'grid', gap: 'var(--sp-sm)' }}>
              <div className="flex justify-between">
                <strong>Invitaciones a salas</strong>
                <span className="phase-badge">{roomInvites.length}</span>
              </div>
              {roomInvites.map((invite) => (
                <div key={invite.id} className="card-section" style={{ display: 'grid', gap: 'var(--sp-sm)' }}>
                  <div>
                    <strong>Sala {invite.room_id}</strong>
                    <p className="text-muted" style={{ marginTop: 4 }}>
                      {invite.inviter?.display_name ?? 'Un amigo'} te invito a jugar.
                    </p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-sm)' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => handleRespondRoomInvite(invite, 'accepted')}>
                      Entrar
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleRespondRoomInvite(invite, 'declined')}>
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {socialProfile && (
            <div className="card-section" style={{ display: 'grid', gap: 'var(--sp-sm)', textAlign: 'center' }}>
              <strong>@{socialProfile.username}</strong>
              {friendUrl && <QRCode value={friendUrl} size={150} />}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => friendUrl && navigator.clipboard.writeText(friendUrl)}
              >
                Copiar enlace de amigo
              </button>
            </div>
          )}

          {incomingRequests.length > 0 && (
            <div style={{ display: 'grid', gap: 'var(--sp-sm)' }}>
              <div className="flex justify-between">
                <strong>Solicitudes recibidas</strong>
                <span className="phase-badge">{incomingRequests.length}</span>
              </div>
              {incomingRequests.map((request) => (
                <div key={request.id} className="card-section" style={{ display: 'grid', gap: 'var(--sp-sm)' }}>
                  <div className="flex justify-between">
                    <span>{request.profile?.display_name ?? 'Jugador'}</span>
                    <span className="text-muted">@{request.profile?.username ?? 'usuario'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-sm)' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => handleRespondFriendship(request.id, 'accepted')}>
                      Aceptar
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleRespondFriendship(request.id, 'blocked')}>
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="form-group">
            <span className="form-label">Buscar por username</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--sp-sm)' }}>
              <input
                className="input"
                placeholder="ej: fiscal_ana"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') void handleSearchUsers(); }}
              />
              <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={handleSearchUsers}>
                Buscar
              </button>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div style={{ display: 'grid', gap: 'var(--sp-sm)' }}>
              {searchResults.map((result) => (
                <div key={result.user_id} className="card-section flex justify-between">
                  <span>{result.display_name} <span className="text-muted">@{result.username}</span></span>
                  <button className="btn btn-ghost btn-sm" style={{ width: 'auto' }} onClick={() => handleAddFriend(result.user_id)}>
                    Agregar
                  </button>
                </div>
              ))}
            </div>
          )}

          {outgoingRequests.length > 0 && (
            <div style={{ display: 'grid', gap: 'var(--sp-sm)' }}>
              <strong>Solicitudes enviadas</strong>
              {outgoingRequests.map((request) => (
                <div key={request.id} className="card-section flex justify-between">
                  <span>{request.profile?.display_name ?? 'Jugador'}</span>
                  <span className="text-muted">Pendiente</span>
                </div>
              ))}
            </div>
          )}

          {friends.length ? (
            <div style={{ display: 'grid', gap: 'var(--sp-sm)' }}>
              {friends.map((friend) => (
                <div key={friend.user_id} className="card-section flex justify-between">
                  <span>{friend.display_name}</span>
                  <span className="text-muted">@{friend.username}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">Todavia no agregaste amigos.</p>
          )}
        </div>

        <div className="card" style={{ width: '100%', padding: 'var(--sp-lg)', display: 'grid', gap: 'var(--sp-md)' }}>
          <h2>Ranking de amigos</h2>
          {friendRanking.length ? (
            <div style={{ display: 'grid', gap: 'var(--sp-sm)' }}>
              {friendRanking.map((entry) => (
                <div key={entry.playerId} className="card-section flex justify-between">
                  <span>#{entry.rank} {entry.displayName}</span>
                  <strong>{entry.publicPrestige} pts</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">Aca se compara tu Prestigio Publico contra el de tus amigos.</p>
          )}
        </div>

        <div className="card" style={{ width: '100%', padding: 'var(--sp-lg)', display: 'grid', gap: 'var(--sp-md)' }}>
          <h2>Campeonatos privados</h2>
          <div className="form-group">
            <span className="form-label">Nuevo campeonato</span>
            <input
              className="input"
              placeholder="Ej: Abril en la casa de Nico"
              value={competitionName}
              onChange={(event) => setCompetitionName(event.target.value)}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-sm)' }}>
            <button className={`btn ${competitionDuration === 'monthly' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setCompetitionDuration('monthly')}>
              Mensual
            </button>
            <button className={`btn ${competitionDuration === 'bimonthly' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setCompetitionDuration('bimonthly')}>
              Bimensual
            </button>
          </div>
          <button className="btn btn-primary" disabled={!competitionName.trim()} onClick={handleCreateCompetition}>
            Crear e invitar amigos
          </button>
          {competitions.length ? (
            <div style={{ display: 'grid', gap: 'var(--sp-sm)' }}>
              {competitions.map((competition) => (
                <div key={competition.id} className="card-section">
                  <strong>{competition.name}</strong>
                  <p className="text-muted" style={{ marginTop: 4 }}>
                    {competition.duration_type === 'bimonthly' ? 'Bimensual' : 'Mensual'} · {competition.status}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">Base lista para grupos privados con tabla propia de puntos.</p>
          )}
        </div>

        <div className="card" style={{ width: '100%', padding: 'var(--sp-lg)', display: 'grid', gap: 'var(--sp-md)' }}>
          <h2>Mis logros</h2>
          {profile?.unlockedTitles.length ? (
            <div style={{ display: 'grid', gap: 'var(--sp-sm)' }}>
              {profile.unlockedTitles.slice(0, 8).map((title) => (
                <div key={title.id} className="card-section flex justify-between">
                  <span>{title.title}</span>
                  <span className="text-muted">{title.threshold}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">Todavia no hay logros desbloqueados. La primera victoria ya empieza a mover la aguja.</p>
          )}
        </div>

        <div className="card" style={{ width: '100%', padding: 'var(--sp-lg)', display: 'grid', gap: 'var(--sp-md)' }}>
          <h2>Ranking historico</h2>
          {historicalRanking.length ? (
            <div style={{ display: 'grid', gap: 'var(--sp-sm)' }}>
              {historicalRanking.map((entry) => (
                <div key={entry.playerId} className="card-section flex justify-between">
                  <span>#{entry.rank} {entry.displayName}</span>
                  <strong>{entry.publicPrestige} pts</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">Cuando terminen partidas con progreso, aca aparece el ranking.</p>
          )}
        </div>

        <div className="card" style={{ width: '100%', padding: 'var(--sp-lg)', display: 'grid', gap: 'var(--sp-md)' }}>
          <h2>Ranking mensual</h2>
          {monthlyRanking.length ? (
            <div style={{ display: 'grid', gap: 'var(--sp-sm)' }}>
              {monthlyRanking.map((entry) => (
                <div key={entry.playerId} className="card-section flex justify-between">
                  <span>#{entry.rank} {entry.displayName}</span>
                  <strong>{entry.monthlyPrestige} pts</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">El ranking del mes se activa con las partidas terminadas este mes.</p>
          )}
        </div>

        <div className="card" style={{ width: '100%', padding: 'var(--sp-lg)', display: 'grid', gap: 'var(--sp-md)' }}>
          <h2>Notificaciones</h2>
          {notifications.length ? (
            <div style={{ display: 'grid', gap: 'var(--sp-sm)' }}>
              {notifications.map((item) => (
                <div key={item.id} className="card-section">
                  <strong>{item.title}</strong>
                  <p className="text-muted" style={{ marginTop: 4 }}>{item.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted">Aca van a aparecer premios, logros y avisos importantes.</p>
          )}
        </div>
      </section>

      <footer className="page-footer" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-sm)' }}>
        <button className="btn btn-primary" onClick={() => router.push('/setup')}>
          Nueva partida
        </button>
        <button className="btn btn-ghost" onClick={handleLogout}>
          Cerrar sesion
        </button>
      </footer>
    </main>
  );
}
