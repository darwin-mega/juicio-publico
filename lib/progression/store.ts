import { Redis } from '@upstash/redis';
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
const useRedis = Boolean(redisUrl && redisToken);

let redis: Redis | null = null;

function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: redisUrl!,
      token: redisToken!,
    });
  }
  return redis;
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

async function isGameProcessed(gameId: string) {
  if (useRedis) {
    return (await getRedis().exists(keys.processedGame(gameId))) === 1;
  }
  return memoryProcessedGames.has(gameId);
}

async function markGameProcessed(gameId: string) {
  if (useRedis) {
    await getRedis().set(keys.processedGame(gameId), true, { ex: PROFILE_TTL_SECONDS });
  } else {
    memoryProcessedGames.add(gameId);
  }
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
    highlightedTitleId: profile.highlightedTitleId ?? chooseHighlightedTitle(updatedStats),
    unlockedTitleIds,
    unlockedRewards: [...profile.unlockedRewards, ...newTitleRewards],
    updatedAt: Date.now(),
  } satisfies PlayerProgressProfile;
}

export async function applyGameProgress(result: ProgressGameResult) {
  if (await isGameProcessed(result.gameId)) {
    return { applied: false, deltas: [] };
  }

  const month = getCurrentProgressMonth(new Date(result.completedAt));
  const deltas = calculateProgressDeltas(result);

  for (const delta of deltas) {
    const profile = await getProfile(delta.playerId, delta.displayName);
    await saveProfile(applyDeltaToProfile(profile, delta, month));
  }

  await markGameProcessed(result.gameId);
  return { applied: true, deltas };
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
  const profile = await getProfile(playerId, displayName);
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
  const month = options.month ?? getCurrentProgressMonth();
  const limit = options.limit ?? 50;

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

