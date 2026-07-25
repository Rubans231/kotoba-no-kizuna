import type { CompanionPersona } from './companion';

export interface ProceduralCharacterPersona extends CompanionPersona {
  /** Natural-language appearance description, written by the local model, for a future image-gen pipeline (not yet wired up). */
  visualDesignPrompt: string;
  source: 'random_banner' | 'rotating_shop';
  generatedAt: string;
}
