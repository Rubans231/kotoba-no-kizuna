import type { StateCreator } from 'zustand';
import type { VocabDictionaryEntry } from '../../core/types/database';

export interface VocabDictionarySlice {
  vocabDictionary: Record<string, VocabDictionaryEntry>; // keyed by word
  setVocabDictionary: (entries: VocabDictionaryEntry[]) => void;
  upsertVocabEntry: (entry: VocabDictionaryEntry) => void;
}

export const createVocabDictionarySlice: StateCreator<VocabDictionarySlice> = (set, get) => ({
  vocabDictionary: {},
  setVocabDictionary: (entries) =>
    set({
      vocabDictionary: entries.reduce((acc, curr) => ({ ...acc, [curr.word]: curr }), {}),
    }),
  upsertVocabEntry: (entry) => {
    const existing = get().vocabDictionary[entry.word];
    // Mirror the same "don't overwrite good data with blanker data" merge
    // logic as the SQLite side, so in-memory state and disk never disagree.
    const merged: VocabDictionaryEntry = existing
      ? {
          ...existing,
          nuance: existing.nuance || entry.nuance,
          mnemonic: existing.mnemonic || entry.mnemonic,
          relatedWords: existing.relatedWords.length > 0 ? existing.relatedWords : entry.relatedWords,
        }
      : entry;

    set((state) => ({
      vocabDictionary: { ...state.vocabDictionary, [entry.word]: merged },
    }));
  },
});
