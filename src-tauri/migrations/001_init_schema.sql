CREATE TABLE IF NOT EXISTS user_profile (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL,
    account_level INTEGER NOT NULL DEFAULT 1,
    experience_points INTEGER NOT NULL DEFAULT 0,
    unlocked_abilities TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS companions (
    instance_id TEXT PRIMARY KEY NOT NULL,
    character_id TEXT NOT NULL,
    affection_level INTEGER NOT NULL DEFAULT 1,
    affection_xp INTEGER NOT NULL DEFAULT 0,
    current_outfit_id TEXT NOT NULL,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    unlocked_voice_lines TEXT NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversation_logs (
    message_id TEXT PRIMARY KEY NOT NULL,
    instance_id TEXT NOT NULL,
    sender TEXT CHECK(sender IN ('player', 'companion')) NOT NULL,
    raw_text TEXT NOT NULL,
    japanese_tokens TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(instance_id) REFERENCES companions(instance_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS srs_registry (
    item_id TEXT PRIMARY KEY NOT NULL,
    item_type TEXT CHECK(item_type IN ('vocab', 'kanji', 'grammar')) NOT NULL,
    ease_factor REAL NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 0,
    repetitions INTEGER NOT NULL DEFAULT 0,
    next_review_time TIMESTAMP NOT NULL,
    last_review_time TIMESTAMP
);
