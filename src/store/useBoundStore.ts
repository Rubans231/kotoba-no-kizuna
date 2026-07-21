import { create } from 'zustand';
import { createProfileSlice } from './slices/createProfileSlice';
import type { ProfileSlice } from './slices/createProfileSlice';
import { createCompanionSlice } from './slices/createCompanionSlice';
import type { CompanionSlice } from './slices/createCompanionSlice';
import { createSrsSlice } from './slices/createSrsSlice';
import type { SrsSlice } from './slices/createSrsSlice';
import { createChatSlice } from './slices/createChatSlice';
import type { ChatSlice } from './slices/createChatSlice';

type BoundStoreState = ProfileSlice & CompanionSlice & SrsSlice & ChatSlice;

export const useBoundStore = create<BoundStoreState>()((...a) => ({
  ...createProfileSlice(...a),
  ...createCompanionSlice(...a),
  ...createSrsSlice(...a),
  ...createChatSlice(...a),
}));
