import type { StateCreator } from 'zustand';
import type { ProceduralCharacterPersona } from '../../core/types/proceduralCharacter';

export interface ProceduralCharacterSlice {
  proceduralCharacters: Record<string, ProceduralCharacterPersona>;
  setProceduralCharacters: (list: ProceduralCharacterPersona[]) => void;
  addProceduralCharacter: (persona: ProceduralCharacterPersona) => void;
  removeProceduralCharacter: (characterId: string) => void;
}

export const createProceduralCharacterSlice: StateCreator<ProceduralCharacterSlice> = (set) => ({
  proceduralCharacters: {},
  setProceduralCharacters: (list) =>
    set({
      proceduralCharacters: list.reduce((acc, curr) => ({ ...acc, [curr.characterId]: curr }), {}),
    }),
  addProceduralCharacter: (persona) =>
    set((state) => ({
      proceduralCharacters: { ...state.proceduralCharacters, [persona.characterId]: persona },
    })),
  removeProceduralCharacter: (characterId) =>
    set((state) => {
      const { [characterId]: _removed, ...rest } = state.proceduralCharacters;
      return { proceduralCharacters: rest };
    }),
});
