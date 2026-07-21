import type { CompanionPersona, Rarity } from '../core/types/companion';
import type { BannerDefinition } from '../data/gachaBanner';

export interface PullResult {
  characterId: string;
  rarity: Rarity;
  /** true if this character was already owned - duplicate pulls refund gems instead. */
  isDuplicate: boolean;
}

function rollRarity(banner: BannerDefinition, pityCounter: number): Rarity {
  // Hard pity: force a 5-star if we've gone too long without one.
  if (pityCounter + 1 >= banner.hardPityAt) {
    return 5;
  }

  const roll = Math.random();
  let cumulative = 0;
  const tiers: Rarity[] = [5, 4, 3, 2, 1];
  for (const tier of tiers) {
    cumulative += banner.rates[tier] ?? 0;
    if (roll < cumulative) return tier;
  }
  return 3; // fallback, should be unreachable if rates sum to 1
}

function pickCharacterOfRarity(
  roster: Record<string, CompanionPersona>,
  rarity: Rarity,
): CompanionPersona {
  const candidates = Object.values(roster).filter((c) => c.rarity === rarity);
  if (candidates.length === 0) {
    // No characters defined at this rarity yet - fall back to the whole roster
    // rather than crashing the pull.
    const all = Object.values(roster);
    return all[Math.floor(Math.random() * all.length)];
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Performs one gacha pull. Returns the result plus the updated pity counter
 * to persist. Duplicate detection is the caller's job (it knows what's
 * already owned) - this function just rolls rarity + character.
 */
export function pullOnce(
  banner: BannerDefinition,
  roster: Record<string, CompanionPersona>,
  pityCounter: number,
  ownedCharacterIds: Set<string>,
): { result: PullResult; nextPityCounter: number } {
  const rarity = rollRarity(banner, pityCounter);
  const persona = pickCharacterOfRarity(roster, rarity);
  const nextPityCounter = rarity >= 5 ? 0 : pityCounter + 1;

  return {
    result: {
      characterId: persona.characterId,
      rarity: persona.rarity,
      isDuplicate: ownedCharacterIds.has(persona.characterId),
    },
    nextPityCounter,
  };
}

/** Performs N pulls in sequence, carrying pity and ownership state forward through the batch. */
export function pullMany(
  banner: BannerDefinition,
  roster: Record<string, CompanionPersona>,
  startingPityCounter: number,
  startingOwnedCharacterIds: Set<string>,
  count: number,
): { results: PullResult[]; finalPityCounter: number } {
  let pity = startingPityCounter;
  const owned = new Set(startingOwnedCharacterIds);
  const results: PullResult[] = [];

  for (let i = 0; i < count; i++) {
    const { result, nextPityCounter } = pullOnce(banner, roster, pity, owned);
    results.push(result);
    pity = nextPityCounter;
    owned.add(result.characterId);
  }

  return { results, finalPityCounter: pity };
}

/** Duplicate pulls refund a fraction of the pull cost as gems instead of nothing. */
export const DUPLICATE_REFUND_RATE = 0.2;
