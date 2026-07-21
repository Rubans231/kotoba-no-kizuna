import type { StateCreator } from 'zustand';
import type { UserProfile } from '../../core/types/database';

export interface ProfileSlice {
  profile: UserProfile | null;
  setProfile: (profile: UserProfile) => void;
  addXp: (amount: number) => void;
  unlockAbility: (abilityId: string) => void;
  addGems: (amount: number) => void;
  spendGems: (amount: number) => boolean;
  setPityCounter: (value: number) => void;
}

export const createProfileSlice: StateCreator<ProfileSlice> = (set, get) => ({
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
  }),
  addGems: (amount) => set((state) => {
    if (!state.profile) return {};
    return { profile: { ...state.profile, gems: state.profile.gems + amount } };
  }),
  spendGems: (amount) => {
    const profile = get().profile;
    if (!profile || profile.gems < amount) return false;
    set({ profile: { ...profile, gems: profile.gems - amount } });
    return true;
  },
  setPityCounter: (value) => set((state) => {
    if (!state.profile) return {};
    return { profile: { ...state.profile, pityCounter: value } };
  }),
});
