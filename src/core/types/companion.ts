export type TeachingArchetype =
  | 'professor'
  | 'big_sister'
  | 'detective'
  | 'idol'
  | 'historian';

export interface CompanionPersona {
  characterId: string;
  displayName: string;
  archetype: TeachingArchetype;
  specialty: string;
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
}

export interface CompanionReply {
  speech: string;
  translation: string;
  vocab_introduced: VocabIntroduced[];
  relationship_delta: number;
}

/**
 * Builds the system prompt for a companion turn. This is the core of the
 * "dynamic teaching" idea from the design doc: the same request produces a
 * different lesson depending on the companion's archetype, the player's
 * relationship with them, and the vocabulary the player already knows.
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

RESPONSE FORMAT: Reply with ONLY a single valid JSON object - no markdown code fences, no commentary outside the JSON - matching exactly this shape:
{
  "speech": "your in-character Japanese dialogue (a little English is fine if it fits your personality)",
  "translation": "a natural English translation of the speech",
  "vocab_introduced": [
    { "word": "surface form", "reading": "hiragana reading", "meaning": "short English gloss" }
  ],
  "relationship_delta": 0
}

relationship_delta is an integer from 0 to 10 for how much this exchange deepened the relationship. Only include a word in vocab_introduced if it's a new/notable content word (noun, verb, adjective, set phrase) you deliberately taught this turn - not every word in the sentence. It's fine for vocab_introduced to be empty on turns that are just casual chat.`;
}
