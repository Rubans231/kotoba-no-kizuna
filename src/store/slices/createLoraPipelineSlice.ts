import type { StateCreator } from 'zustand';
import type { LoraPipelineState } from '../../core/types/loraPipeline';

export interface LoraPipelineSlice {
  loraPipelineStates: Record<string, LoraPipelineState>;
  setAllLoraPipelineStates: (list: LoraPipelineState[]) => void;
  upsertLoraPipelineStateInStore: (state: LoraPipelineState) => void;
  /** Which character's LoRA is actively being worked on right now, for a simple status indicator - null when the queue is idle. */
  activeLoraTraining: string | null;
  setActiveLoraTraining: (characterId: string | null) => void;
}

export const createLoraPipelineSlice: StateCreator<LoraPipelineSlice> = (set) => ({
  loraPipelineStates: {},
  setAllLoraPipelineStates: (list) =>
    set({
      loraPipelineStates: list.reduce((acc, curr) => ({ ...acc, [curr.characterId]: curr }), {}),
    }),
  upsertLoraPipelineStateInStore: (state) =>
    set((prev) => ({
      loraPipelineStates: { ...prev.loraPipelineStates, [state.characterId]: state },
    })),
  activeLoraTraining: null,
  setActiveLoraTraining: (characterId) => set({ activeLoraTraining: characterId }),
});
