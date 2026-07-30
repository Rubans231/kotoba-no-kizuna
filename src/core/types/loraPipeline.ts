export type LoraPipelineStage =
  | 'not_started'
  | 'base_image'
  | 'view_profiles'
  | 'training_set'
  | 'training'
  | 'complete'
  | 'failed';

export interface TrainingSetImage {
  path: string;
  framing: 'close_up' | 'upper_body' | 'full_body';
}

export interface LoraPipelineState {
  characterId: string;
  stage: LoraPipelineStage;
  triggerWord: string;
  baseImagePath: string | null;
  viewProfilePaths: string[];
  trainingSetPaths: TrainingSetImage[];
  loraPath: string | null;
  errorMessage: string | null;
  updatedAt: string;
}

export function newPipelineState(characterId: string, triggerWord: string): LoraPipelineState {
  return {
    characterId,
    stage: 'not_started',
    triggerWord,
    baseImagePath: null,
    viewProfilePaths: [],
    trainingSetPaths: [],
    loraPath: null,
    errorMessage: null,
    updatedAt: new Date().toISOString(),
  };
}
