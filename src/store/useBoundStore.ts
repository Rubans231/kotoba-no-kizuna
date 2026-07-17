import { create } from 'zustand';
import { createProfileSlice, ProfileSlice } from './slices/createProfileSlice';
import { createCompanionSlice, CompanionSlice } from './slices/createCompanionSlice';
import { createSrsSlice, SrsSlice } from './slices/createSrsSlice';

type BoundStoreState = ProfileSlice & CompanionSlice & SrsSlice;

export const useBoundStore = create<BoundStoreState>()((...a) => ({
  ...createProfileSlice(...a),
  ...createCompanionSlice(...a),
  ...createSrsSlice(...a)
}));
