import type { CompanionPersona } from './companion';

export interface ProceduralCharacterPersona extends CompanionPersona {
  source: 'random_banner' | 'rotating_shop';
  generatedAt: string;
}
