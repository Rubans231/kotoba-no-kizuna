import { create } from 'zustand';
import { createProfileSlice, ProfileSlice } from './slices/createProfileSlice';
import { createCompanionSlice, CompanionSlice } from './slices/createCompanionSlice';

type BoundStoreState = ProfileSlice & CompanionSlice;

export const useBoundStore = create<BoundStoreState>()((...a) => ({
  ...createProfileSlice(...a),
  ...createCompanionSlice(...a)
}));
