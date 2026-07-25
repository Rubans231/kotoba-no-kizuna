import { COMPANIONS } from '../data/companions';
import { useBoundStore } from '../store/useBoundStore';
import type { CompanionPersona } from '../core/types/companion';
import type { ProceduralCharacterPersona } from '../core/types/proceduralCharacter';

/** Plain (non-hook) lookup - for use outside React components, e.g. in useCompanionChat where state is read via getState(). */
export function resolvePersona(
  characterId: string,
  proceduralCharacters: Record<string, ProceduralCharacterPersona>,
): CompanionPersona | undefined {
  return COMPANIONS[characterId] ?? proceduralCharacters[characterId];
}

/** Hook form for components - subscribes only to the one procedural entry that matters, if any. */
export function usePersona(characterId: string): CompanionPersona | undefined {
  const procedural = useBoundStore((s) => s.proceduralCharacters[characterId]);
  return COMPANIONS[characterId] ?? procedural;
}

export function isProceduralCharacter(
  characterId: string,
  proceduralCharacters: Record<string, ProceduralCharacterPersona>,
): boolean {
  return !COMPANIONS[characterId] && Boolean(proceduralCharacters[characterId]);
}
