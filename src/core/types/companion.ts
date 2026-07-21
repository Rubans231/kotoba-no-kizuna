export type TeachingArchetype =
  | 'professor'
  | 'big_sister'
  | 'detective'
  | 'idol'
  | 'historian';

export type Rarity = 1 | 2 | 3 | 4 | 5;

export interface CompanionPersona {
  characterId: string;
  displayName: string;
  archetype: TeachingArchetype;
  specialty: string;
  rarity: Rarity;
  personality: string;
  teachingPhilosophy: string;
  speechStyle: string;
}

export interface PromptContext {
  affectionLevel: number;
  knownVocab: string[];
  targetLevel: string;
}

export interface VocabIntroduced {
  word: string;
  reading: string;
  meaning: string;
  /** Nuance/contrast vs. a similar known word. Empty string if not applicable at this rarity. */
  nuance: string;
  /** A memory hook for the word. Empty string if not applicable at this rarity. */
  mnemonic: string;
  /** Related words (synonyms, same-kanji compounds, etc). Empty array if not applicable at this rarity. */
  related_words: string[];
}

export interface CompanionReply {
  speech: string;
  translation: string;
  vocab_introduced: VocabIntroduced[];
  relationship_delta: number;
}

/**
 * How much teaching detail a companion is asked to fill in per word, based
 * on rarity - this is the "rarity makes you a better teacher, not a
 * stronger unit" idea from the design doc.
 */
function teachingDepthInstruction(rarity: Rarity): string {
  if (rarity >= 5) {
    return 'For every word in vocab_introduced, fill in nuance (how it differs from a near-synonym), mnemonic (a genuinely useful memory hook), and 2-4 related_words. Go deep - this is your specialty.';
  }
  if (rarity === 4) {
    return 'For every word in vocab_introduced, fill in nuance with a short, useful contrast or usage note. Leave mnemonic as an empty string and related_words as an empty array unless one comes naturally.';
  }
  return 'Keep vocab_introduced entries brief: word, reading, and meaning only. Leave nuance and mnemonic as empty strings and related_words as an empty array.';
}

/**
 * Builds the system prompt for a companion turn. This is the core of the
 * "dynamic teaching" idea from the design doc: the same request produces a
 * different lesson depending on the companion's archetype, rarity, the
 * player's relationship with them, and the vocabulary the player already
 * knows.
 */
export function buildSystemPrompt(
  persona: CompanionPersona,
  ctx: PromptContext,
): string {
  const vocabLine =
    ctx.knownVocab.length > 0
      ? `Words they already know: ${ctx.knownVocab.slice(0, 40).join(', ')}. When you introduce a new word that overlaps in meaning with one of these, briefly contrast the nuance like a real teacher would, instead of giving a bare definition.`
      : 'They are just starting out, so keep vocabulary simple and foundational.';

  return `You are ${persona.displayName}, an AI companion in the Kotoba no Kizuna Japanese-learning academy.

PERSONALITY: ${persona.personality}
SPECIALTY: ${persona.specialty}
TEACHING PHILOSOPHY: ${persona.teachingPhilosophy}
SPEECH STYLE: ${persona.speechStyle}

RELATIONSHIP CONTEXT: Your current affection level with the player is ${ctx.affectionLevel}. Let this subtly color your warmth and familiarity without breaking character or explaining it out loud.

LEARNER LEVEL: The player is roughly ${ctx.targetLevel}. ${vocabLine}

TEACHING DEPTH: ${teachingDepthInstruction(persona.rarity)}

RESPONSE FORMAT: Reply with ONLY a single valid JSON object - no markdown code fences, no commentary outside the JSON - matching exactly this shape:
{
  "speech": "your in-character Japanese dialogue (a little English is fine if it fits your personality)",
  "translation": "a natural English translation of the speech",
  "vocab_introduced": [
    {
      "word": "surface form",
      "reading": "hiragana reading",
      "meaning": "short English gloss",
      "nuance": "",
      "mnemonic": "",
      "related_words": []
    }
  ],
  "relationship_delta": 0
}

relationship_delta is an integer from 0 to 10 for how much this exchange deepened the relationship. Only include a word in vocab_introduced if it's a new/notable content word (noun, verb, adjective, set phrase) you deliberately taught this turn - not every word in the sentence. It's fine for vocab_introduced to be empty on turns that are just casual chat.`;
}
