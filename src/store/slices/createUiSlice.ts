import type { StateCreator } from 'zustand';

export type AppTab = 'chat' | 'review' | 'commissions' | 'gacha' | 'abilities' | 'sandbox';

export interface UiSlice {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  hasUnseenAbilityUnlock: boolean;
  setHasUnseenAbilityUnlock: (value: boolean) => void;
}

export const createUiSlice: StateCreator<UiSlice> = (set) => ({
  activeTab: 'chat',
  setActiveTab: (tab) => set({ activeTab: tab }),
  hasUnseenAbilityUnlock: false,
  setHasUnseenAbilityUnlock: (value) => set({ hasUnseenAbilityUnlock: value }),
});
