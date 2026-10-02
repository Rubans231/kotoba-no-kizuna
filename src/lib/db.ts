import Database from '@tauri-apps/plugin-sql';
import type {
  UserProfile,
  CompanionInstance,
  SrsRecord,
  ConversationLog,
  DailyCommission,
  VocabDictionaryEntry,
} from '../core/types/database';
import type { ProceduralCharacterPersona } from '../core/types/proceduralCharacter';
import type { CharacterArt } from '../core/types/characterArt';
import type { LoraPipelineState } from '../core/types/loraPipeline';
import { defaultRelationshipStats } from '../lib/relationship';

// Must match the "sqlite:kotoba.db" identifier registered with the
// migrations in src-tauri/src/main.rs.
const DB_URL = 'sqlite:kotoba.db';

let dbPromise: Promise<Database> | null = null;

function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = Database.load(DB_URL);
  }
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function loadProfile(id: string): Promise<UserProfile | null> {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM user_profile WHERE id = ?', [id]);
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id,
    username: r.username,
    accountLevel: r.account_level,
    experiencePoints: r.experience_points,
    unlockedAbilities: JSON.parse(r.unlocked_abilities || '[]'),
    enabledAbilities: JSON.parse(r.enabled_abilities || '[]'),
    gems: r.gems,
    shards: r.shards,
    pityCounter: r.pity_counter,
    createdAt: r.created_at,
  };
}

export async function saveProfile(p: UserProfile): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO user_profile (id, username, account_level, experience_points, unlocked_abilities, enabled_abilities, gems, shards, pity_counter)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       username = excluded.username,
       account_level = excluded.account_level,
       experience_points = excluded.experience_points,
       unlocked_abilities = excluded.unlocked_abilities,
       enabled_abilities = excluded.enabled_abilities,
       gems = excluded.gems,
       shards = excluded.shards,
       pity_counter = excluded.pity_counter`,
    [
      p.id,
      p.username,
      p.accountLevel,
      p.experiencePoints,
      JSON.stringify(p.unlockedAbilities),
      JSON.stringify(p.enabledAbilities),
      p.gems,
      p.shards,
      p.pityCounter,
    ],
  );
}

// ---------------------------------------------------------------------------
// Companions
// ---------------------------------------------------------------------------

export async function loadCompanions(): Promise<CompanionInstance[]> {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM companions', []);
  return rows.map((r) => {
    let relationshipStats;
    try {
      relationshipStats = r.relationship_stats
        ? JSON.parse(r.relationship_stats)
        : defaultRelationshipStats();
    } catch {
      relationshipStats = defaultRelationshipStats();
    }
    return {
      instanceId: r.instance_id,
      characterId: r.character_id,
      affectionLevel: r.affection_level,
      affectionXp: r.affection_xp,
      relationshipStats,
      currentOutfitId: r.current_outfit_id,
      isFavorite: !!r.is_favorite,
      unlockedVoiceLines: JSON.parse(r.unlocked_voice_lines || '[]'),
      updatedAt: r.updated_at,
    };
  });
}

export async function upsertCompanion(c: CompanionInstance): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO companions (instance_id, character_id, affection_level, affection_xp, relationship_stats, current_outfit_id, is_favorite, unlocked_voice_lines)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(instance_id) DO UPDATE SET
       affection_level = excluded.affection_level,
       affection_xp = excluded.affection_xp,
       relationship_stats = excluded.relationship_stats,
       current_outfit_id = excluded.current_outfit_id,
       is_favorite = excluded.is_favorite,
       unlocked_voice_lines = excluded.unlocked_voice_lines,
       updated_at = CURRENT_TIMESTAMP`,
    [
      c.instanceId,
      c.characterId,
      c.affectionLevel,
      c.affectionXp,
      JSON.stringify(c.relationshipStats),
      c.currentOutfitId,
      c.isFavorite ? 1 : 0,
      JSON.stringify(c.unlockedVoiceLines),
    ],
  );
}

export async function deleteCompanion(instanceId: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM companions WHERE instance_id = ?', [instanceId]);
}

// ---------------------------------------------------------------------------
// SRS registry
// ---------------------------------------------------------------------------

export async function loadSrsRecords(): Promise<SrsRecord[]> {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM srs_registry', []);
  return rows.map((r) => ({
    itemId: r.item_id,
    itemType: r.item_type,
    easeFactor: r.ease_factor,
    intervalDays: r.interval_days,
    repetitions: r.repetitions,
    nextReviewTime: r.next_review_time,
    lastReviewTime: r.last_review_time,
  }));
}

export async function upsertSrsRecord(r: SrsRecord): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO srs_registry (item_id, item_type, ease_factor, interval_days, repetitions, next_review_time, last_review_time)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(item_id) DO UPDATE SET
       ease_factor = excluded.ease_factor,
       interval_days = excluded.interval_days,
       repetitions = excluded.repetitions,
       next_review_time = excluded.next_review_time,
       last_review_time = excluded.last_review_time`,
    [r.itemId, r.itemType, r.easeFactor, r.intervalDays, r.repetitions, r.nextReviewTime, r.lastReviewTime],
  );
}

// ---------------------------------------------------------------------------
// Conversation logs
// ---------------------------------------------------------------------------

export async function loadConversation(instanceId: string): Promise<ConversationLog[]> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    'SELECT * FROM conversation_logs WHERE instance_id = ? ORDER BY timestamp ASC',
    [instanceId],
  );
  return rows.map((r) => ({
    messageId: r.message_id,
    instanceId: r.instance_id,
    sender: r.sender,
    rawText: r.raw_text,
    japaneseTokens: r.japanese_tokens ?? undefined,
    timestamp: r.timestamp,
  }));
}

export async function appendConversationLog(log: ConversationLog): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO conversation_logs (message_id, instance_id, sender, raw_text, japanese_tokens)
     VALUES (?, ?, ?, ?, ?)`,
    [log.messageId, log.instanceId, log.sender, log.rawText, log.japaneseTokens ?? null],
  );
}

// ---------------------------------------------------------------------------
// Daily commissions
// ---------------------------------------------------------------------------

export async function loadCommissions(date: string): Promise<DailyCommission[]> {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM daily_commissions WHERE date = ?', [date]);
  return rows.map((r) => ({
    commissionId: r.commission_id,
    date: r.date,
    target: r.target,
    progress: r.progress,
    completed: !!r.completed,
    claimed: !!r.claimed,
    rewardGems: r.reward_gems,
  }));
}

export async function upsertCommission(c: DailyCommission): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO daily_commissions (commission_id, date, target, progress, completed, claimed, reward_gems)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(commission_id, date) DO UPDATE SET
       progress = excluded.progress,
       completed = excluded.completed,
       claimed = excluded.claimed`,
    [
      c.commissionId,
      c.date,
      c.target,
      c.progress,
      c.completed ? 1 : 0,
      c.claimed ? 1 : 0,
      c.rewardGems,
    ],
  );
}

// ---------------------------------------------------------------------------
// Vocab dictionary - lets review cards show full teaching detail (reading,
// meaning, nuance, mnemonic, related words), not just the bare word.
// ---------------------------------------------------------------------------

export async function loadVocabDictionary(): Promise<VocabDictionaryEntry[]> {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM vocab_dictionary', []);
  return rows.map((r) => ({
    word: r.word,
    reading: r.reading,
    meaning: r.meaning,
    nuance: r.nuance,
    mnemonic: r.mnemonic,
    relatedWords: JSON.parse(r.related_words || '[]'),
    taughtByCharacterId: r.taught_by_character_id,
    firstTaughtAt: r.first_taught_at,
  }));
}

/**
 * Inserts a new vocab entry, or - if the word is already known - only fills
 * in fields that were previously blank (e.g. a 3-star companion taught the
 * bare word first, then a 5-star companion later adds nuance/mnemonic for
 * the same word). Never overwrites existing non-empty teaching detail with
 * blanker data from a lower-rarity companion.
 */
export async function upsertVocabDictionaryEntry(entry: VocabDictionaryEntry): Promise<void> {
  const db = await getDb();
  const existingRows = await db.select<any[]>(
    'SELECT * FROM vocab_dictionary WHERE word = ?',
    [entry.word],
  );

  if (existingRows.length === 0) {
    await db.execute(
      `INSERT INTO vocab_dictionary (word, reading, meaning, nuance, mnemonic, related_words, taught_by_character_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.word,
        entry.reading,
        entry.meaning,
        entry.nuance,
        entry.mnemonic,
        JSON.stringify(entry.relatedWords),
        entry.taughtByCharacterId,
      ],
    );
    return;
  }

  const existing = existingRows[0];
  const mergedNuance = existing.nuance ? existing.nuance : entry.nuance;
  const mergedMnemonic = existing.mnemonic ? existing.mnemonic : entry.mnemonic;
  const existingRelated: string[] = JSON.parse(existing.related_words || '[]');
  const mergedRelated = existingRelated.length > 0 ? existingRelated : entry.relatedWords;

  await db.execute(
    `UPDATE vocab_dictionary SET nuance = ?, mnemonic = ?, related_words = ? WHERE word = ?`,
    [mergedNuance, mergedMnemonic, JSON.stringify(mergedRelated), entry.word],
  );
}

// ---------------------------------------------------------------------------
// Procedural characters (Random banner / rotating shop)
// ---------------------------------------------------------------------------

export async function loadProceduralCharacters(): Promise<ProceduralCharacterPersona[]> {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM procedural_characters', []);
  return rows.map((r) => ({
    characterId: r.character_id,
    displayName: r.display_name,
    archetype: r.archetype,
    specialty: r.specialty,
    rarity: r.rarity,
    personality: r.personality,
    teachingPhilosophy: r.teaching_philosophy,
    speechStyle: r.speech_style,
    dailyRoutine: {
      morning: r.daily_routine_morning,
      afternoon: r.daily_routine_afternoon,
      evening: r.daily_routine_evening,
      lateNight: r.daily_routine_late_night,
    },
    visualDesignPrompt: r.visual_design_prompt,
    visualTags: r.visual_tags,
    backgroundStyle: r.background_style,
    backgroundScenePrompt: r.background_scene_prompt,
    source: r.source,
    generatedAt: r.generated_at,
  }));
}

export async function saveProceduralCharacter(p: ProceduralCharacterPersona): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO procedural_characters
       (character_id, display_name, archetype, specialty, rarity, personality, teaching_philosophy, speech_style,
        daily_routine_morning, daily_routine_afternoon, daily_routine_evening, daily_routine_late_night,
        visual_design_prompt, visual_tags, background_style, background_scene_prompt, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.characterId,
      p.displayName,
      p.archetype,
      p.specialty,
      p.rarity,
      p.personality,
      p.teachingPhilosophy,
      p.speechStyle,
      p.dailyRoutine.morning,
      p.dailyRoutine.afternoon,
      p.dailyRoutine.evening,
      p.dailyRoutine.lateNight,
      p.visualDesignPrompt,
      p.visualTags,
      p.backgroundStyle,
      p.backgroundScenePrompt,
      p.source,
    ],
  );
}

export async function deleteProceduralCharacter(characterId: string): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM procedural_characters WHERE character_id = ?', [characterId]);
}

// ---------------------------------------------------------------------------
// Character art (generated images)
// ---------------------------------------------------------------------------

export async function loadCharacterArt(characterId: string): Promise<CharacterArt | null> {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM character_art WHERE character_id = ?', [characterId]);
  if (!rows.length) return null;
  const r = rows[0];
  return {
    characterId: r.character_id,
    baseImagePath: r.base_image_path,
    bannerImagePath: r.banner_image_path,
    splashImagePath: r.splash_image_path,
    chatBackgroundImagePath: r.chat_background_image_path,
    generatedAt: r.generated_at,
  };
}

export async function loadAllCharacterArt(): Promise<CharacterArt[]> {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM character_art', []);
  return rows.map((r) => ({
    characterId: r.character_id,
    baseImagePath: r.base_image_path,
    bannerImagePath: r.banner_image_path,
    splashImagePath: r.splash_image_path,
    chatBackgroundImagePath: r.chat_background_image_path,
    generatedAt: r.generated_at,
  }));
}

export async function upsertCharacterArt(art: CharacterArt): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO character_art (character_id, base_image_path, banner_image_path, splash_image_path, chat_background_image_path)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(character_id) DO UPDATE SET
       base_image_path = excluded.base_image_path,
       banner_image_path = excluded.banner_image_path,
       splash_image_path = excluded.splash_image_path,
       chat_background_image_path = excluded.chat_background_image_path`,
    [
      art.characterId,
      art.baseImagePath,
      art.bannerImagePath,
      art.splashImagePath,
      art.chatBackgroundImagePath,
    ],
  );
}

// ---------------------------------------------------------------------------
// LoRA training pipeline state
// ---------------------------------------------------------------------------

export async function loadLoraPipelineState(characterId: string): Promise<LoraPipelineState | null> {
  const db = await getDb();
  const rows = await db.select<any[]>(
    'SELECT * FROM character_lora_pipeline WHERE character_id = ?',
    [characterId],
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    characterId: r.character_id,
    stage: r.stage,
    triggerWord: r.trigger_word,
    baseImagePath: r.base_image_path,
    viewProfilePaths: JSON.parse(r.view_profile_paths || '[]'),
    trainingSetPaths: JSON.parse(r.training_set_paths || '[]'),
    loraPath: r.lora_path,
    errorMessage: r.error_message,
    updatedAt: r.updated_at,
  };
}

export async function loadAllLoraPipelineStates(): Promise<LoraPipelineState[]> {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM character_lora_pipeline', []);
  return rows.map((r) => ({
    characterId: r.character_id,
    stage: r.stage,
    triggerWord: r.trigger_word,
    baseImagePath: r.base_image_path,
    viewProfilePaths: JSON.parse(r.view_profile_paths || '[]'),
    trainingSetPaths: JSON.parse(r.training_set_paths || '[]'),
    loraPath: r.lora_path,
    errorMessage: r.error_message,
    updatedAt: r.updated_at,
  }));
}

export async function upsertLoraPipelineState(state: LoraPipelineState): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO character_lora_pipeline
       (character_id, stage, trigger_word, base_image_path, view_profile_paths, training_set_paths, lora_path, error_message, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(character_id) DO UPDATE SET
       stage = excluded.stage,
       trigger_word = excluded.trigger_word,
       base_image_path = excluded.base_image_path,
       view_profile_paths = excluded.view_profile_paths,
       training_set_paths = excluded.training_set_paths,
       lora_path = excluded.lora_path,
       error_message = excluded.error_message,
       updated_at = CURRENT_TIMESTAMP`,
    [
      state.characterId,
      state.stage,
      state.triggerWord,
      state.baseImagePath,
      JSON.stringify(state.viewProfilePaths),
      JSON.stringify(state.trainingSetPaths),
      state.loraPath,
      state.errorMessage,
    ],
  );
}
