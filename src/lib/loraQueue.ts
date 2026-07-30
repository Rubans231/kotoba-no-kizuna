import { useBoundStore } from '../store/useBoundStore';
import { resolvePersona } from './personaResolver';
import { runLoraPipelineForCharacter } from './loraPipeline';
import { upsertLoraPipelineState } from './db';
import type { LoraPipelineState } from '../core/types/loraPipeline';

let isProcessing = false;

/**
 * Characters currently worth training a LoRA for: whoever the player
 * actually owns right now (curated starter + any gacha/random pulls) and
 * doesn't already have a completed LoRA for. Not every character that
 * could ever exist - just the ones actually reachable right now.
 */
function getCharactersNeedingLora(): string[] {
  const { companions, proceduralCharacters, loraPipelineStates } = useBoundStore.getState();

  const accessibleCharacterIds = new Set<string>();
  for (const instance of Object.values(companions)) {
    accessibleCharacterIds.add(instance.characterId);
  }

  const needsLora: string[] = [];
  for (const characterId of accessibleCharacterIds) {
    const persona = resolvePersona(characterId, proceduralCharacters);
    if (!persona) continue; // shouldn't happen, but don't crash the queue over it
    const existing = loraPipelineStates[characterId];
    if (existing?.stage === 'complete') continue;
    needsLora.push(characterId);
  }
  return needsLora;
}

/**
 * Processes the LoRA training queue sequentially - one character at a
 * time, not in parallel, since they'd otherwise fight over the same GPU.
 * Safe to call repeatedly (e.g. on every app start); it's a no-op if
 * already running, and skips anyone already complete. A failure on one
 * character (e.g. ComfyUI unreachable) is recorded and the queue moves on
 * to the next character rather than getting stuck.
 */
export async function processLoraQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  const setActiveLoraTraining = useBoundStore.getState().setActiveLoraTraining;
  const upsertLoraPipelineStateInStore = useBoundStore.getState().upsertLoraPipelineStateInStore;

  try {
    const queue = getCharactersNeedingLora();
    if (queue.length === 0) {
      useBoundStore.getState().addLog('info', 'LoRA queue: nothing to train, all caught up');
      return;
    }
    useBoundStore.getState().addLog('info', `LoRA queue: ${queue.length} character(s) to process`);

    for (const characterId of queue) {
      const persona = resolvePersona(characterId, useBoundStore.getState().proceduralCharacters);
      if (!persona) continue;

      setActiveLoraTraining(characterId);
      const existingState = useBoundStore.getState().loraPipelineStates[characterId] ?? null;

      const persist = (state: LoraPipelineState) => {
        upsertLoraPipelineStateInStore(state);
        void upsertLoraPipelineState(state);
      };

      try {
        await runLoraPipelineForCharacter(persona, existingState, persist);
      } catch {
        // Already recorded in state via the pipeline's own catch block
        // (stage: 'failed', errorMessage set) - just move on to the next
        // character rather than aborting the whole queue.
      }
    }
  } finally {
    setActiveLoraTraining(null);
    isProcessing = false;
  }
}
