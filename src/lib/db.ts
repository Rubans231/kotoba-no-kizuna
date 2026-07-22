import Database from '@tauri-apps/plugin-sql';
import type {
  UserProfile,
  CompanionInstance,
  SrsRecord,
  ConversationLog,
  DailyCommission,
  VocabDictionaryEntry,
} from '../core/types/database';
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
    pityCounter: r.pity_counter,
    createdAt: r.created_at,
  };
}

export async function saveProfile(p: UserProfile): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO user_profile (id, username, account_level, experience_points, unlocked_abilities, enabled_abilities, gems, pity_counter)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       username = excluded.username,
       account_level = excluded.account_level,
       experience_points = excluded.experience_points,
       unlocked_abilities = excluded.unlocked_abilities,
       enabled_abilities = excluded.enabled_abilities,
       gems = excluded.gems,
       pity_counter = excluded.pity_counter`,
    [
      p.id,
      p.username,
      p.accountLevel,
      p.experiencePoints,
      JSON.stringify(p.unlockedAbilities),
      JSON.stringify(p.enabledAbilities),
      p.gems,
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
