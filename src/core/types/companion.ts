import type { RelationshipStats } from '../../lib/relationship';
import type { DailyRoutine } from '../../lib/companionStatus';
import { getCurrentActivity } from '../../lib/companionStatus';
import type { AbilityEffect } from '../../data/abilities';

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
  dailyRoutine: DailyRoutine;
}

export interface PromptContext {
  relationshipStats: RelationshipStats;
  knownVocab: string[];
  targetLevel: string;
  /** Effects of currently-toggled-on global ability passives (see data/abilities.ts). Applies regardless of which companion unlocked them. */
  enabledEffects: AbilityEffect[];
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

export interface RelationshipDelta {
  affection: number;
  trust: number;
  respect: number;
  comfort: number;
  friendship: number;
  study_compatibility: number;
  shared_memories: number;
}

export interface CompanionReply {
  speech: string;
  translation: string;
  vocab_introduced: VocabIntroduced[];
  relationship_delta: RelationshipDelta;
}

/**
 * How much teaching detail a companion is asked to fill in per word, based
 * on rarity - this is the "rarity makes you a better teacher, not a
 * stronger unit" idea from the design doc. forceDeep overrides this to
 * max depth regardless of rarity - that's what the "Deep Teaching" global
 * ability (unlocked via Aoi) does once toggled on.
 */
function teachingDepthInstruction(rarity: Rarity, forceDeep: boolean): string {
  if (forceDeep || rarity >= 5) {
    return 'For every word in vocab_introduced, fill in nuance (how it differs from a near-synonym), mnemonic (a genuinely useful memory hook), and 2-4 related_words. Go deep - this is your specialty.';
  }
  if (rarity === 4) {
    return 'For every word in vocab_introduced, fill in nuance with a short, useful contrast or usage note. Leave mnemonic as an empty string and related_words as an empty array unless one comes naturally.';
  }
  return 'Keep vocab_introduced entries brief: word, reading, and meaning only. Leave nuance and mnemonic as empty strings and related_words as an empty array.';
}

/**
 * Extra instructions injected when the player has toggled on global
 * ability passives (see data/abilities.ts). These apply on top of
 * whatever the companion would normally do, regardless of which companion
 * originally unlocked them.
 */
function abilityInstructions(effects: AbilityEffect[]): string[] {
  const lines: string[] = [];
  if (effects.includes('register_radar')) {
    lines.push(
      "Register Radar (unlocked via Rin): in each word's nuance, note its register - casual/slang, neutral, or formal/written - even briefly.",
    );
  }
  if (effects.includes('context_booster')) {
    lines.push(
      "Context Booster (unlocked via Sora): in each word's mnemonic, include a short real-world example sentence using it.",
    );
  }
  if (effects.includes('kanji_breakdown')) {
    lines.push(
      "Detective's Case File (unlocked via Yui): for any word containing kanji, add a brief radical/component breakdown to its mnemonic.",
    );
  }
  return lines;
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

  const stats = ctx.relationshipStats;
  const currentActivity = getCurrentActivity(persona.dailyRoutine);
  const forceDeep = ctx.enabledEffects.includes('deep_teaching');
  const extraAbilityLines = abilityInstructions(ctx.enabledEffects);
  const abilitiesBlock =
    extraAbilityLines.length > 0
      ? `\n\nACTIVE LEARNING TOOLS (unlocked account-wide, apply these regardless of your own specialty):\n${extraAbilityLines.map((l) => `- ${l}`).join('\n')}`
      : '';

  return `You are ${persona.displayName}, an AI companion in the Kotoba no Kizuna Japanese-learning academy.

PERSONALITY: ${persona.personality}
SPECIALTY: ${persona.specialty}
TEACHING PHILOSOPHY: ${persona.teachingPhilosophy}
SPEECH STYLE: ${persona.speechStyle}

RIGHT NOW: ${currentActivity} You don't need to announce this, but let it color the scene naturally if it fits (e.g. what's audible/visible around you), and it's fine to mention it directly if the player asks what you're up to.

RELATIONSHIP (0-100 each): trust ${stats.trust}, respect ${stats.respect}, comfort ${stats.comfort}, friendship ${stats.friendship}, affection ${stats.affection}, study compatibility ${stats.studyCompatibility}, shared memories ${stats.sharedMemories}. Let these subtly shape your tone - low trust/comfort means a bit more reserved and polite even if your personality is normally loud; high numbers mean noticeably warmer and more familiar. Don't state the numbers out loud or explain this system to the player.

LEARNER LEVEL: The player is roughly ${ctx.targetLevel}. ${vocabLine}

TEACHING DEPTH: ${teachingDepthInstruction(persona.rarity, forceDeep)}${abilitiesBlock}

LANGUAGE RULE: "speech" is your in-character line and should be mostly Japanese (a little English mixed in is fine if it suits your personality). Every other text field - "translation", "meaning", "nuance", and "mnemonic" - must be written entirely in English, for a learner who cannot yet read Japanese explanations. Do not write Japanese script anywhere in those fields, not even a single word alongside its English gloss. For example, for the word 猫: meaning should read "cat", never "cat (猫)" or "ねこ - cat".

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
  "relationship_delta": {
    "affection": 0,
    "trust": 0,
    "respect": 0,
    "comfort": 0,
    "friendship": 0,
    "study_compatibility": 0,
    "shared_memories": 0
  }
}

Only include a word in vocab_introduced if it's a new/notable content word (noun, verb, adjective, set phrase) you deliberately taught this turn - not every word in the sentence. It's fine for vocab_introduced to be empty on turns that are just casual chat.

Each relationship_delta field is a small integer, usually 0. Most turns should move at most 1-2 dimensions - don't move all seven every time. Rough guide: affection rises with warm/friendly exchanges in general; trust rises when the player is vulnerable (admits confusion, makes a mistake) and you respond supportively; respect rises when the player demonstrates real understanding of something you taught; comfort rises during casual, low-stakes daily-life chat; friendship rises with sustained ordinary back-and-forth; study_compatibility rises specifically when your teaching approach visibly clicks for them; shared_memories should almost always stay 0 and only tick up by 1 for a turn that's genuinely memorable, not routine.`;
}
