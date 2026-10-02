import type { StateCreator } from 'zustand';
import type { CharacterArt } from '../../core/types/characterArt';

export interface CharacterArtSlice {
  characterArt: Record<string, CharacterArt>;
  setAllCharacterArt: (list: CharacterArt[]) => void;
  upsertCharacterArtInStore: (art: CharacterArt) => void;
}

export const createCharacterArtSlice: StateCreator<CharacterArtSlice> = (set) => ({
  characterArt: {},
  setAllCharacterArt: (list) =>
    set({ characterArt: list.reduce((acc, curr) => ({ ...acc, [curr.characterId]: curr }), {}) }),
  upsertCharacterArtInStore: (art) =>
    set((state) => ({ characterArt: { ...state.characterArt, [art.characterId]: art } })),
});
