export type PitStopCheckpointId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type PitStopCheckpointStatus =
  | 'locked'
  | 'open'
  | 'in_progress'
  | 'done'
  | 'pending_review'
  | 'stopped';

export type PitStopPlayerRole = 'A' | 'B';

export type PitStopBlindRole = 'navigator' | 'pilot';

export type PitStopPair = {
  id: string;
  userIdA: number;
  userIdB: number;
  nameA: string;
  nameB: string;
  /** 8 символов без префикса VIBE_ */
  cipher: string;
  /** Ход сборки 0…5 (6 деталей), чей ход: A / B */
  assemblyTurn: PitStopPlayerRole;
  assemblyStep: number;
  /** Двойной лок: кто держит кнопку */
  ignitionHeldBy: number[];
  /** Слепой пилот */
  blindRoleA: PitStopBlindRole;
  blindX: number;
  blindY: number;
  blindStartedAt: string | null;
  /** Пазл 4×4: индексы 0…15, которые «горят» у A / у B */
  puzzleGlowA: number[];
  puzzleGlowB: number[];
  puzzlePressedA: number[];
  puzzlePressedB: number[];
};

export type PitStopPlayerProgress = {
  userId: number;
  name: string;
  pairId: string | null;
  role: PitStopPlayerRole | null;
  isRemote: boolean;
  /** checkpointId → status */
  checkpoints: Partial<Record<PitStopCheckpointId, PitStopCheckpointStatus>>;
  coffeePhotoPath?: string;
  coffeeApproved?: boolean;
  completedAt?: string;
  rewardsGranted?: boolean;
};

export type PitStopStoreState = {
  pairs: PitStopPair[];
  players: PitStopPlayerProgress[];
  easterCode: string;
  finalizedAt: string | null;
};

export type PitStopCheckpointDef = {
  id: PitStopCheckpointId;
  slug: string;
  title: string;
  /** ISO date YYYY-MM-DD в МСК */
  unlockDate: string;
  kind: 'pair' | 'solo' | 'media' | 'finale';
};
