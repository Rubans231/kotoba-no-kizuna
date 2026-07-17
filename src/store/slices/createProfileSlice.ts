import { StateCreator } from 'zustand';
import { UserProfile } from '../../core/types/database';

export interface ProfileSlice {
  profile: UserProfile | null;
  setProfile: (profile: UserProfile) => void;
  addXp: (amount: number) => void;
  unlockAbility: (abilityId: string) => void;
}

export const createProfileSlice: StateCreator<ProfileSlice> = (set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
  addXp: (amount) => set((state) => {
    if (!state.profile) return {};
    const newXp = state.profile.experiencePoints + amount;
    const levelUps = Math.floor(newXp / 1000);
    return {
      profile: {
        ...state.profile,
        experiencePoints: newXp % 1000,
        accountLevel: state.profile.accountLevel + levelUps
      }
    };
  }),
  unlockAbility: (abilityId) => set((state) => {
    if (!state.profile || state.profile.unlockedAbilities.includes(abilityId)) return {};
    return {
      profile: {
        ...state.profile,
        unlockedAbilities: [...state.profile.unlockedAbilities, abilityId]
      }
    };
  })
});
