export type AbilityEffect =
  | 'register_radar' // flags casual/formal register in nuance, for every companion's vocab
  | 'context_booster' // appends a real-world usage example to mnemonic, for every companion's vocab
  | 'deep_teaching' // forces max teaching depth (nuance+mnemonic+related words) regardless of rarity
  | 'kanji_breakdown'; // appends radical/component breakdown to mnemonic for kanji-containing words

export interface AbilityDefinition {
  abilityId: string;
  characterId: string;
  name: string;
  description: string;
  requiredBondLevel: number;
  effect: AbilityEffect;
}

/**
 * One ability per companion. These are global passives: once unlocked (by
 * owning the character and reaching requiredBondLevel), the effect applies
 * account-wide - to every companion's teaching, not just hers - matching
 * the design doc's "your account becomes more capable over time" idea.
 * Unlocking is permanent; the player can still toggle the effect on/off
 * afterward (see ProfileSlice.toggleAbility).
 */
export const ABILITY_DEFINITIONS: AbilityDefinition[] = [
  {
    abilityId: 'rin_register_radar',
    characterId: 'rin_slang',
    name: 'Register Radar',
    description:
      "Rin trained her ear on group chats and streams for so long she can't help pointing out when something sounds casual vs formal. Once unlocked, every companion starts flagging a word's register (casual/neutral/formal) in its nuance.",
    requiredBondLevel: 2,
    effect: 'register_radar',
  },
  {
    abilityId: 'sora_context_booster',
    characterId: 'sora_news',
    name: 'Context Booster',
    description:
      "Sora never explains a word without also performing it in a sentence. Once unlocked, every companion adds a short real-world example sentence to a word's mnemonic.",
    requiredBondLevel: 2,
    effect: 'context_booster',
  },
  {
    abilityId: 'aoi_deep_teaching',
    characterId: 'aoi_grammar',
    name: 'Deep Teaching',
    description:
      "Aoi doesn't believe any word deserves a shallow explanation. Once unlocked, every companion teaches at maximum depth (nuance, mnemonic, and related words) regardless of her own rarity.",
    requiredBondLevel: 3,
    effect: 'deep_teaching',
  },
  {
    abilityId: 'yui_kanji_breakdown',
    characterId: 'yui_kanji',
    name: "Detective's Case File",
    description:
      "Yui can't look at a kanji without cracking it open. Once unlocked, every companion adds a radical/component breakdown to the mnemonic for any word containing kanji.",
    requiredBondLevel: 4,
    effect: 'kanji_breakdown',
  },
];
