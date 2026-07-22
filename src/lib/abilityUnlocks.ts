import type { CompanionInstance } from '../core/types/database';
import { ABILITY_DEFINITIONS } from '../data/abilities';
import { overallBondLevel } from './relationship';

/**
 * Returns the abilityIds that are now eligible to unlock (character owned,
 * bond level requirement met) but aren't in alreadyUnlocked yet. Pure and
 * side-effect free - callers decide what to do with the result (persist,
 * notify, etc).
 */
export function checkForNewUnlocks(
  companions: Record<string, CompanionInstance>,
  alreadyUnlocked: string[],
): string[] {
  const unlockedSet = new Set(alreadyUnlocked);
  const ownedByCharacterId = new Map<string, CompanionInstance>();
  for (const instance of Object.values(companions)) {
    ownedByCharacterId.set(instance.characterId, instance);
  }

  const newlyUnlocked: string[] = [];
  for (const def of ABILITY_DEFINITIONS) {
    if (unlockedSet.has(def.abilityId)) continue;
    const owned = ownedByCharacterId.get(def.characterId);
    if (!owned) continue;
    if (overallBondLevel(owned.relationshipStats) >= def.requiredBondLevel) {
      newlyUnlocked.push(def.abilityId);
    }
  }
  return newlyUnlocked;
}
