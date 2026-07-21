export interface RelationshipStats {
  trust: number;
  respect: number;
  comfort: number;
  friendship: number;
  affection: number;
  studyCompatibility: number;
  sharedMemories: number;
}

export const RELATIONSHIP_DIMENSIONS: (keyof RelationshipStats)[] = [
  'trust',
  'respect',
  'comfort',
  'friendship',
  'affection',
  'studyCompatibility',
  'sharedMemories',
];

export function defaultRelationshipStats(): RelationshipStats {
  return {
    trust: 10,
    respect: 10,
    comfort: 10,
    friendship: 10,
    affection: 10,
    studyCompatibility: 10,
    sharedMemories: 0,
  };
}

export function clampStat(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function applyRelationshipDeltas(
  current: RelationshipStats,
  deltas: Partial<Record<keyof RelationshipStats, number>>,
): RelationshipStats {
  const next = { ...current };
  for (const key of RELATIONSHIP_DIMENSIONS) {
    const delta = deltas[key];
    if (typeof delta === 'number' && !Number.isNaN(delta)) {
      next[key] = clampStat(next[key] + delta);
    }
  }
  return next;
}

/** Simple 1-6 display level derived from the average of all dimensions. */
export function overallBondLevel(stats: RelationshipStats): number {
  const avg =
    RELATIONSHIP_DIMENSIONS.reduce((sum, key) => sum + stats[key], 0) /
    RELATIONSHIP_DIMENSIONS.length;
  return Math.floor(avg / 20) + 1;
}
