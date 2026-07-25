import { invoke } from '@tauri-apps/api/core';
import type { Rarity } from '../core/types/companion';
import type { ProceduralCharacterPersona } from '../core/types/proceduralCharacter';

function depthHint(rarity: Rarity): string {
  if (rarity >= 5) return "She should feel like a rare, deeply specialized master of her field.";
  if (rarity === 4) return 'She should feel like a skilled, dedicated specialist.';
  return 'She should feel like an approachable, everyday companion with one clear personality hook.';
}

function buildCharacterGenPrompt(rarity: Rarity, existingSpecialties: string[]): string {
  const avoid =
    existingSpecialties.length > 0
      ? ` Avoid specialties too close to ones that already exist: ${existingSpecialties.slice(0, 20).join(', ')}.`
      : '';

  return `You are inventing a brand-new AI companion character for Kotoba no Kizuna, a Japanese-learning companion app. Invent a wholly original character - never reuse or reference an existing anime, game, VTuber, or media character, and never base her on a real person.

She should teach some specific facet of the Japanese language (a grammar point, a vocabulary theme, a dialect, a register, a historical period of the language, a media genre's slang, etc). Be creative and specific rather than generic. ${depthHint(rarity)}${avoid}

Also write visual_design_prompt: a natural-language description of her appearance (hair, eyes, outfit, color palette, expression, pose) suitable as a prompt for an anime-style image generation model. Purely original design - no copyrighted characters, no real people, nothing that could be mistaken for an existing IP.

Fill in a short one-sentence daily routine for each of morning/afternoon/evening/late_night describing what she's doing at that time, in character.

Respond with ONLY the JSON object in the required shape - no commentary, no markdown fences.`;
}

interface RawCharacterConcept {
  display_name: string;
  archetype: string;
  specialty: string;
  personality: string;
  teaching_philosophy: string;
  speech_style: string;
  daily_routine_morning: string;
  daily_routine_afternoon: string;
  daily_routine_evening: string;
  daily_routine_late_night: string;
  visual_design_prompt: string;
}

/**
 * Calls the local model to invent a new character at the given rarity.
 * Rarity is decided by the caller (the roulette/shop roll) and is NOT part
 * of what the model chooses - it only sees it as a flavor hint.
 */
export async function generateProceduralCharacter(
  rarity: Rarity,
  source: 'random_banner' | 'rotating_shop',
  existingSpecialties: string[],
): Promise<ProceduralCharacterPersona> {
  const systemPrompt = buildCharacterGenPrompt(rarity, existingSpecialties);
  const raw = await invoke<string>('generate_character_concept', { systemPrompt });

  const cleaned = raw
    .trim()
    .replace(/^```json/i, '')
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim();
  const parsed: RawCharacterConcept = JSON.parse(cleaned);

  const characterId = `proc_${crypto.randomUUID()}`;

  return {
    characterId,
    displayName: parsed.display_name,
    archetype: parsed.archetype as ProceduralCharacterPersona['archetype'],
    specialty: parsed.specialty,
    rarity,
    personality: parsed.personality,
    teachingPhilosophy: parsed.teaching_philosophy,
    speechStyle: parsed.speech_style,
    dailyRoutine: {
      morning: parsed.daily_routine_morning,
      afternoon: parsed.daily_routine_afternoon,
      evening: parsed.daily_routine_evening,
      lateNight: parsed.daily_routine_late_night,
    },
    visualDesignPrompt: parsed.visual_design_prompt,
    source,
    generatedAt: new Date().toISOString(),
  };
}
