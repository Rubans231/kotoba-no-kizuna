import type { CompanionInstance } from '../core/types/database';
import type { ProceduralCharacterPersona } from '../core/types/proceduralCharacter';

/** The roulette only ever produces these three tiers - never 1 or 2 star. */
export type RandomBannerRarity = 3 | 4 | 5;

export const RANDOM_BANNER_CONFIG = {
  /** "The gun has a 1 in 6 chance to shoot" - this is the chance of getting ANY character per attempt. */
  shootChance: 1 / 6,
  /** Given a hit, the rarity breakdown. Must sum to 1. */
  rarityGivenHit: { 5: 0.07, 4: 0.25, 3: 0.68 } as Record<RandomBannerRarity, number>,
  /** Cost in the cheap currency (shards), per attempt. */
  shardCostPerPull: 15,
  /** Upper limit on how many Random-origin companions a player can own at once. */
  rosterCap: 12,
};

export type RouletteOutcome = { hit: false } | { hit: true; rarity: RandomBannerRarity };

/**
 * One attempt at the Random banner roulette. ~16.7% chance of any
 * character; given a hit, 68%/25%/7% split across 3/4/5 star. Unconditional
 * odds work out to roughly 11.3% three-star, 4.2% four-star, 1.2% five-star,
 * 83.3% nothing per attempt.
 */
export function pullRoulette(): RouletteOutcome {
  const isHit = Math.random() < RANDOM_BANNER_CONFIG.shootChance;
  if (!isHit) return { hit: false };

  const roll = Math.random();
  let cumulative = 0;
  const tiers: RandomBannerRarity[] = [5, 4, 3];
  for (const tier of tiers) {
    cumulative += RANDOM_BANNER_CONFIG.rarityGivenHit[tier] ?? 0;
    if (roll < cumulative) return { hit: true, rarity: tier };
  }
  return { hit: true, rarity: 3 }; // fallback, unreachable if rates sum to 1
}

/**
 * Wager reroll uses the same odds as a normal pull. Kept as its own export
 * so the wager mechanic can be tuned independently later (e.g. slightly
 * better odds as a "house edge" lever) without touching pullRoulette.
 */
export const wagerReroll = pullRoulette;

/** How many Random-origin (procedurally generated) companions the player currently owns. */
export function countRandomCompanions(
  companions: Record<string, CompanionInstance>,
  proceduralCharacters: Record<string, ProceduralCharacterPersona>,
): number {
  return Object.values(companions).filter((c) => proceduralCharacters[c.characterId]).length;
}

export function isRandomRosterFull(
  companions: Record<string, CompanionInstance>,
  proceduralCharacters: Record<string, ProceduralCharacterPersona>,
): boolean {
  return (
    countRandomCompanions(companions, proceduralCharacters) >= RANDOM_BANNER_CONFIG.rosterCap
  );
}
