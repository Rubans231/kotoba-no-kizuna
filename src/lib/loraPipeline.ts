import { invoke } from '@tauri-apps/api/core';
import { useBoundStore } from '../store/useBoundStore';
import type { CompanionPersona } from '../core/types/companion';
import type { LoraPipelineState, TrainingSetImage } from '../core/types/loraPipeline';
import { newPipelineState } from '../core/types/loraPipeline';

function log(level: 'info' | 'success' | 'error', message: string): void {
  useBoundStore.getState().addLog(level, message);
}

const NEGATIVE_PROMPT = 'lowres, blurry, bad anatomy, extra limbs, watermark, signature, text, jpeg artifacts';

/** Short, unique-ish trigger token - deliberately not just the display name, since training docs specifically recommend an invented token unlikely to already carry associations in the text encoder. */
export function buildTriggerWord(displayName: string, characterId: string): string {
  const namePart = displayName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6) || 'char';
  const idPart = characterId.replace(/[^a-z0-9]/gi, '').slice(-4).toLowerCase();
  return `${namePart}${idPart}`;
}

async function generateOne(kind: string, positivePrompt: string, referenceImagePaths: string[] = []): Promise<string> {
  return invoke<string>('generate_character_image', {
    kind,
    positivePrompt,
    negativePrompt: NEGATIVE_PROMPT,
    referenceImagePaths,
    inputImagePath: null,
    loraName: null,
    loraWeight: null,
  });
}

async function runBaseImageStage(persona: CompanionPersona): Promise<string> {
  log('info', `${persona.displayName}: generating base image...`);
  const prompt = `${persona.visualDesignPrompt}, A-pose, arms slightly raised, standing straight, blank white background, full body, neutral expression, character reference sheet`;
  const path = await generateOne('t2i_base', prompt);
  log('success', `${persona.displayName}: base image ready`);
  return path;
}

async function runViewProfilesStage(persona: CompanionPersona, baseImagePath: string): Promise<string[]> {
  log('info', `${persona.displayName}: generating view profile 1/2 (front)...`);
  const front = await generateOne(
    'single_ipa',
    `${persona.visualDesignPrompt}, front view, standing, full body, simple background`,
    [baseImagePath],
  );
  log('info', `${persona.displayName}: generating view profile 2/2 (back)...`);
  const back = await generateOne(
    'single_ipa',
    `${persona.visualDesignPrompt}, back view, standing, full body, simple background, from behind`,
    [baseImagePath],
  );
  log('success', `${persona.displayName}: view profiles ready`);
  return [front, back];
}

const CLOSE_UP_VARIANTS = [
  'close-up, face focus, looking at viewer, neutral expression',
  'close-up, face focus, smiling, looking at viewer',
  'close-up, face focus, looking away, soft expression',
  'close-up, face focus, three-quarter view, looking at viewer',
];
const UPPER_BODY_VARIANTS = [
  'upper body, standing, looking at viewer, arms at sides',
  'upper body, standing, arms crossed, confident pose',
  'upper body, side view, looking away',
  'upper body, three-quarter view, gentle pose',
];
const FULL_BODY_VARIANTS = [
  'full body, standing, looking at viewer',
  'full body, dynamic pose, action stance',
];

interface TrainingSetPlanItem {
  framing: TrainingSetImage['framing'];
  promptSuffix: string;
}

/** ~40% close-up / ~40% upper-body / ~20% full-body, per documented recommended composition. */
export function buildTrainingSetPlan(targetCount: number): TrainingSetPlanItem[] {
  const closeUpCount = Math.round(targetCount * 0.4);
  const upperBodyCount = Math.round(targetCount * 0.4);
  const fullBodyCount = Math.max(0, targetCount - closeUpCount - upperBodyCount);

  const plan: TrainingSetPlanItem[] = [];
  for (let i = 0; i < closeUpCount; i++) {
    plan.push({ framing: 'close_up', promptSuffix: CLOSE_UP_VARIANTS[i % CLOSE_UP_VARIANTS.length] });
  }
  for (let i = 0; i < upperBodyCount; i++) {
    plan.push({ framing: 'upper_body', promptSuffix: UPPER_BODY_VARIANTS[i % UPPER_BODY_VARIANTS.length] });
  }
  for (let i = 0; i < fullBodyCount; i++) {
    plan.push({ framing: 'full_body', promptSuffix: FULL_BODY_VARIANTS[i % FULL_BODY_VARIANTS.length] });
  }
  return plan;
}

const TRAINING_SET_SIZE = 24;

async function runTrainingSetStage(
  persona: CompanionPersona,
  viewProfilePaths: string[],
  alreadyDone: TrainingSetImage[],
  onProgress: (done: TrainingSetImage[]) => void,
): Promise<TrainingSetImage[]> {
  const plan = buildTrainingSetPlan(TRAINING_SET_SIZE);
  const results = [...alreadyDone];

  for (let i = alreadyDone.length; i < plan.length; i++) {
    const { framing, promptSuffix } = plan[i];
    log('info', `${persona.displayName}: training image ${i + 1}/${plan.length} (${framing})...`);
    const path = await generateOne('double_ipa', `${persona.visualDesignPrompt}, ${promptSuffix}`, viewProfilePaths);
    results.push({ path, framing });
    onProgress(results);
  }

  log('success', `${persona.displayName}: training set ready (${plan.length} images)`);
  return results;
}

async function runTrainingStage(
  persona: CompanionPersona,
  triggerWord: string,
  trainingSetPaths: TrainingSetImage[],
): Promise<string> {
  const images = trainingSetPaths.map((t): [string, string] => [t.path, t.framing]);

  log('info', `${persona.displayName}: assembling training dataset...`);
  await invoke('assemble_lora_dataset', {
    images,
    triggerWord,
    visualTags: persona.visualTags,
    // Train against the Aesthetic checkpoint, whose training data had quality
    // tags stripped - so omit them here (Base would need true).
    useQualityTags: false,
    characterId: persona.characterId,
  });

  log('info', `${persona.displayName}: training LoRA (this can take a long time)...`);
  const loraPath = await invoke<string>('train_character_lora', {
    characterId: persona.characterId,
    characterName: persona.characterId,
    triggerWord,
  });
  log('success', `${persona.displayName}: LoRA training complete - ${loraPath}`);
  return loraPath;
}

/**
 * Runs whatever stages remain for this character, resuming from
 * existingState rather than starting over - each stage is only run if its
 * output isn't already present. onUpdate is called after every stage
 * transition so the caller can persist progress incrementally - losing
 * hours of work to an app restart partway through would be a bad
 * experience given how long this pipeline can realistically take.
 */
export async function runLoraPipelineForCharacter(
  persona: CompanionPersona,
  existingState: LoraPipelineState | null,
  onUpdate: (state: LoraPipelineState) => void,
): Promise<LoraPipelineState> {
  let state =
    existingState ?? newPipelineState(persona.characterId, buildTriggerWord(persona.displayName, persona.characterId));

  if (state.stage === 'complete') return state;

  log('info', `${persona.displayName}: starting LoRA pipeline (resuming from "${state.stage}")`);

  try {
    if (!state.baseImagePath) {
      const baseImagePath = await runBaseImageStage(persona);
      state = { ...state, stage: 'base_image', baseImagePath, updatedAt: new Date().toISOString() };
      onUpdate(state);
    }

    if (state.viewProfilePaths.length === 0) {
      const viewProfilePaths = await runViewProfilesStage(persona, state.baseImagePath as string);
      state = { ...state, stage: 'view_profiles', viewProfilePaths, updatedAt: new Date().toISOString() };
      onUpdate(state);
    }

    if (state.trainingSetPaths.length < TRAINING_SET_SIZE) {
      const trainingSetPaths = await runTrainingSetStage(
        persona,
        state.viewProfilePaths,
        state.trainingSetPaths,
        (partial) => {
          state = { ...state, stage: 'training_set', trainingSetPaths: partial, updatedAt: new Date().toISOString() };
          onUpdate(state);
        },
      );
      state = { ...state, stage: 'training_set', trainingSetPaths, updatedAt: new Date().toISOString() };
      onUpdate(state);
    }

    if (!state.loraPath) {
      state = { ...state, stage: 'training', updatedAt: new Date().toISOString() };
      onUpdate(state);
      const loraPath = await runTrainingStage(persona, state.triggerWord, state.trainingSetPaths);
      state = { ...state, stage: 'complete', loraPath, errorMessage: null, updatedAt: new Date().toISOString() };
      onUpdate(state);
    }

    return state;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('error', `${persona.displayName}: FAILED - ${message}`);
    state = { ...state, stage: 'failed', errorMessage: message, updatedAt: new Date().toISOString() };
    onUpdate(state);
    throw err;
  }
}
