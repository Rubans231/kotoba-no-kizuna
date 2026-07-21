import type { StateCreator } from 'zustand';
import type { DailyCommission } from '../../core/types/database';

export interface CommissionsSlice {
  commissions: Record<string, DailyCommission>; // keyed by commissionId, always for "today"
  setCommissions: (list: DailyCommission[]) => void;
  incrementCommission: (commissionId: string, amount: number) => DailyCommission | null;
  claimCommission: (commissionId: string) => void;
}

export const createCommissionsSlice: StateCreator<CommissionsSlice> = (set, get) => ({
  commissions: {},
  setCommissions: (list) =>
    set({
      commissions: list.reduce((acc, curr) => ({ ...acc, [curr.commissionId]: curr }), {}),
    }),
  incrementCommission: (commissionId, amount) => {
    const existing = get().commissions[commissionId];
    if (!existing || existing.completed) return null;

    const newProgress = Math.min(existing.target, existing.progress + amount);
    const updated: DailyCommission = {
      ...existing,
      progress: newProgress,
      completed: newProgress >= existing.target,
    };
    set((state) => ({ commissions: { ...state.commissions, [commissionId]: updated } }));
    return updated;
  },
  claimCommission: (commissionId) =>
    set((state) => {
      const existing = state.commissions[commissionId];
      if (!existing || !existing.completed || existing.claimed) return {};
      return {
        commissions: {
          ...state.commissions,
          [commissionId]: { ...existing, claimed: true },
        },
      };
    }),
});
