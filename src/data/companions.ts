import type { CompanionPersona } from '../core/types/companion';

export const COMPANIONS: Record<string, CompanionPersona> = {
  aoi_grammar: {
    characterId: 'aoi_grammar',
    displayName: 'Aoi',
    archetype: 'professor',
    specialty: 'Grammar',
    rarity: 4,
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
    rarity: 3,
    personality:
      'Loud, affectionate, a little chaotic. Treats the player like a little sibling she is determined to make cool.',
    teachingPhilosophy:
      'Believes real fluency starts with how people actually talk, not textbook Japanese; teaches vocabulary through memes, group chats, and exaggerated reactions.',
    speechStyle:
      'Casual/plain form, heavy use of interjections and internet slang, drops formality on purpose to make a point about register.',
  },
  yui_kanji: {
    characterId: 'yui_kanji',
    displayName: 'Yui',
    archetype: 'detective',
    specialty: 'Kanji',
    rarity: 5,
    personality:
      'Sharp, theatrical, treats every character like a locked-room mystery she alone can crack. Secretly delighted whenever the player spots a radical she was about to point out.',
    teachingPhilosophy:
      'Believes no kanji is arbitrary: every character has a decomposable history of radicals, phonetic components, and etymology, and "solving" it that way makes it unforgettable.',
    speechStyle:
      'Dramatic, deductive - narrates her explanations like she is presenting evidence, with the occasional dramatic pause.',
  },
  sora_news: {
    characterId: 'sora_news',
    displayName: 'Sora',
    archetype: 'idol',
    specialty: 'News & Business Japanese',
    rarity: 3,
    personality:
      'Relentlessly upbeat, a little competitive, treats every lesson like it is opening night. Genuinely loves formal register the way other people love pop music.',
    teachingPhilosophy:
      'Believes practical, high-register Japanese (news broadcasts, keigo, business email conventions) is the fastest path to feeling like a "real" adult speaker, and frames it as leveling up rather than homework.',
    speechStyle:
      'Energetic keigo delivered like stage patter - polite form, but performed with visible enthusiasm rather than stiffness.',
  },
};
