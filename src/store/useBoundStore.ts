import { create } from 'zustand';
import { createProfileSlice } from './slices/createProfileSlice';
import type { ProfileSlice } from './slices/createProfileSlice';
import { createCompanionSlice } from './slices/createCompanionSlice';
import type { CompanionSlice } from './slices/createCompanionSlice';
import { createSrsSlice } from './slices/createSrsSlice';
import type { SrsSlice } from './slices/createSrsSlice';
import { createChatSlice } from './slices/createChatSlice';
import type { ChatSlice } from './slices/createChatSlice';
import { createCommissionsSlice } from './slices/createCommissionsSlice';
import type { CommissionsSlice } from './slices/createCommissionsSlice';
import { createUiSlice } from './slices/createUiSlice';
import type { UiSlice } from './slices/createUiSlice';
import { createVocabDictionarySlice } from './slices/createVocabDictionarySlice';
import type { VocabDictionarySlice } from './slices/createVocabDictionarySlice';
import { createProceduralCharacterSlice } from './slices/createProceduralCharacterSlice';
import type { ProceduralCharacterSlice } from './slices/createProceduralCharacterSlice';
import { createCharacterArtSlice } from './slices/createCharacterArtSlice';
import type { CharacterArtSlice } from './slices/createCharacterArtSlice';
import { createLoraPipelineSlice } from './slices/createLoraPipelineSlice';
import type { LoraPipelineSlice } from './slices/createLoraPipelineSlice';
import { createLogSlice } from './slices/createLogSlice';
import type { LogSlice } from './slices/createLogSlice';

type BoundStoreState = ProfileSlice &
  CompanionSlice &
  SrsSlice &
  ChatSlice &
  CommissionsSlice &
  UiSlice &
  VocabDictionarySlice &
  ProceduralCharacterSlice &
  CharacterArtSlice &
  LoraPipelineSlice &
  LogSlice;

export const useBoundStore = create<BoundStoreState>()((...a) => ({
  ...createProfileSlice(...a),
  ...createCompanionSlice(...a),
  ...createSrsSlice(...a),
  ...createChatSlice(...a),
  ...createCommissionsSlice(...a),
  ...createUiSlice(...a),
  ...createVocabDictionarySlice(...a),
  ...createProceduralCharacterSlice(...a),
  ...createCharacterArtSlice(...a),
  ...createLoraPipelineSlice(...a),
  ...createLogSlice(...a),
}));
