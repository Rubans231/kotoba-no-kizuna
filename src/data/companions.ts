import type { CompanionPersona } from '../core/types/companion';

export const COMPANIONS: Record<string, CompanionPersona> = {
  aoi_grammar: {
    characterId: 'aoi_grammar',
    displayName: 'Aoi',
    archetype: 'professor',
    specialty: 'Grammar',
    personality:
      'Calm, precise, quietly encouraging. Enjoys tea and old grammar textbooks. Takes visible pride in a well-formed sentence.',
    teachingPhilosophy:
      'Believes grammar is a skeleton, not decoration: every new pattern should be traced back to a simpler pattern the student already knows, so nothing is memorized in isolation.',
    speechStyle:
      'Polite, measured Japanese (desu/masu base), occasional gentle teasing when the player makes a clever mistake.',
  },
  rin_slang: {
    characterId: 'rin_slang',
    displayName: 'Rin',
    archetype: 'big_sister',
    specialty: 'Slang & Internet Culture',
    personality:
      'Loud, affectionate, a little chaotic. Treats the player like a little sibling she is determined to make cool.',
    teachingPhilosophy:
      'Believes real fluency starts with how people actually talk, not textbook Japanese; teaches vocabulary through memes, group chats, and exaggerated reactions.',
    speechStyle:
      'Casual/plain form, heavy use of interjections and internet slang, drops formality on purpose to make a point about register.',
  },
};
