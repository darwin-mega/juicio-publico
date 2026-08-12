import type { Role } from '@/lib/game/state';

export type RankingPeriod = 'historical' | 'monthly';
export type RewardKind = 'badge' | 'frame' | 'title' | 'season_distinction';

export interface RoleVictoryStats {
  killer: number;
  cop: number;
  doctor: number;
  town: number;
}

export interface KillerProgressStats {
  kills: number;
  wins: number;
  killedCops: number;
  killedDoctors: number;
  survivedAsKiller: number;
}

export interface CopProgressStats {
  correctInvestigations: number;
  correctAccusations: number;
  wins: number;
}

export interface DoctorProgressStats {
  correctSaves: number;
  wins: number;
}

export interface TownProgressStats {
  correctKillerVotes: number;
  wins: number;
}

export interface PlayerProgressStats {
  gamesPlayed: number;
  gamesWon: number;
  survivedToEnd: number;
  currentWinStreak: number;
  bestWinStreak: number;
  winsByRole: RoleVictoryStats;
  publicPrestige: number;
  killer: KillerProgressStats;
  cop: CopProgressStats;
  doctor: DoctorProgressStats;
  town: TownProgressStats;
}

export interface UnlockedProgressReward {
  id: string;
  kind: RewardKind;
  title: string;
  unlockedAt: number;
  sourceTitleId?: string;
}

export interface PlayerProgressProfile {
  playerId: string;
  displayName: string;
  stats: PlayerProgressStats;
  monthlyPrestige: Record<string, number>;
  highlightedTitleId: string | null;
  unlockedTitleIds: string[];
  unlockedRewards: UnlockedProgressReward[];
  createdAt: number;
  updatedAt: number;
}

export type ProgressMetricPath =
  | 'gamesPlayed'
  | 'gamesWon'
  | 'survivedToEnd'
  | 'killer.kills'
  | 'cop.correctInvestigations'
  | 'doctor.correctSaves'
  | 'town.correctKillerVotes';

export interface ProgressTitleDefinition {
  id: string;
  group: 'killer' | 'cop' | 'doctor' | 'town' | 'general_games' | 'general_wins' | 'general_survival';
  metric: ProgressMetricPath;
  threshold: number;
  title: string;
}

export interface ProgressEvent {
  type: 'operative_action' | 'vote';
  round: number;
  actorId: string;
  actorRole: Role;
  targetId: string | null;
  targetRole: Role | null;
  actionType?: 'kill' | 'save' | 'inspect' | 'neutral';
  success: boolean;
}

export interface ProgressGamePlayer {
  playerId: string;
  displayName: string;
  role: Role;
  isAliveAtEnd: boolean;
}

export interface ProgressGameResult {
  gameId: string;
  completedAt: number;
  winnerFaction: 'killers' | 'town';
  players: ProgressGamePlayer[];
  events: ProgressEvent[];
}

export interface ProgressAwardBreakdown {
  reason: string;
  points: number;
}

export interface ProgressPlayerDelta {
  playerId: string;
  displayName: string;
  role: Role;
  prestigeDelta: number;
  won: boolean;
  survivedToEnd: boolean;
  breakdown: ProgressAwardBreakdown[];
  statIncrements: Partial<PlayerProgressStats>;
}

export interface RankingEntry {
  playerId: string;
  displayName: string;
  publicPrestige: number;
  monthlyPrestige: number;
  highlightedTitle: string | null;
  gamesPlayed: number;
  gamesWon: number;
  rank: number;
}

export interface PlayerProfileSummary {
  playerId: string;
  displayName: string;
  publicPrestige: number;
  gamesPlayed: number;
  gamesWon: number;
  bestRole: Role | null;
  highlightedTitle: string | null;
  currentWinStreak: number;
  monthlyRank: number | null;
  historicalRank: number | null;
  stats: PlayerProgressStats;
  unlockedTitles: ProgressTitleDefinition[];
  unlockedRewards: UnlockedProgressReward[];
}

