import { StateCreator } from 'zustand';
import { CompanionInstance } from '../../core/types/database';

export interface CompanionSlice {
  companions: Record<string, CompanionInstance>;
  activeCompanionId: string | null;
  setCompanions: (list: CompanionInstance[]) => void;
  setActiveCompanion: (instanceId: string | null) => void;
  updateAffection: (instanceId: string, xpGain: number) => void;
}

export const createCompanionSlice: StateCreator<CompanionSlice> = (set) => ({
  companions: {},
  activeCompanionId: null,
  setCompanions: (list) => set({
    companions: list.reduce((acc, curr) => ({ ...acc, [curr.instanceId]: curr }), {})
  }),
  setActiveCompanion: (instanceId) => set({ activeCompanionId: instanceId }),
  updateAffection: (instanceId, xpGain) => set((state) => {
    const target = state.companions[instanceId];
    if (!target) return {};
    const totalXp = target.affectionXp + xpGain;
    const levelThreshold = target.affectionLevel * 200;
    const didLevelUp = totalXp >= levelThreshold;
    
    return {
      companions: {
        ...state.companions,
        [instanceId]: {
          ...target,
          affectionLevel: didLevelUp ? target.affectionLevel + 1 : target.affectionLevel,
          affectionXp: didLevelUp ? totalXp - levelThreshold : totalXp,
          updatedAt: new Date().toISOString()
        }
      }
    };
  })
});
