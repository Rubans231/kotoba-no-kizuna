import type { Rarity } from '../core/types/companion';

export interface BannerDefinition {
  bannerId: string;
  title: string;
  costPerPull: number;
  /** Probability of each rarity tier, must sum to 1. */
  rates: Record<Rarity, number>;
  /** Pull count since the last 5-star, at which the next pull is guaranteed 5-star. */
  hardPityAt: number;
}

export const STANDARD_BANNER: BannerDefinition = {
  bannerId: 'standard',
  title: 'Standard Summon',
  costPerPull: 100,
  rates: {
    1: 0,
    2: 0,
    3: 0.7,
    4: 0.25,
    5: 0.05,
  },
  hardPityAt: 10,
};
