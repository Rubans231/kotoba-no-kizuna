import type { StateCreator } from 'zustand';
import type { SrsRecord } from '../../core/types/database';
import { calculateSm2 } from '../../features/language-engine/utils/srsAlgorithm';

export interface SrsSlice {
  srsRecords: Record<string, SrsRecord>;
  setSrsRecords: (records: SrsRecord[]) => void;
  upsertRecord: (record: SrsRecord) => void;
  processReview: (itemId: string, grade: number) => void;
}

export const createSrsSlice: StateCreator<SrsSlice> = (set) => ({
  srsRecords: {},
  setSrsRecords: (records) => set({
    srsRecords: records.reduce((acc, curr) => ({ ...acc, [curr.itemId]: curr }), {})
  }),
  upsertRecord: (record) => set((state) => ({
    srsRecords: { ...state.srsRecords, [record.itemId]: record }
  })),
  processReview: (itemId, grade) => set((state) => {
    const record = state.srsRecords[itemId];
    if (!record) return {};

    // Run our mathematical calculation payload
    const updatedMetrics = calculateSm2({
      repetitions: record.repetitions,
      easeFactor: record.easeFactor,
      intervalDays: record.intervalDays,
      grade,
    });

    return {
      srsRecords: {
        ...state.srsRecords,
        [itemId]: {
          ...record,
          ...updatedMetrics,
          lastReviewTime: new Date().toISOString(),
        }
      }
    };
  })
});
