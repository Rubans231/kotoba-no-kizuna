ALTER TABLE user_profile ADD COLUMN shards INTEGER NOT NULL DEFAULT 50;

CREATE TABLE IF NOT EXISTS procedural_characters (
    character_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    archetype TEXT NOT NULL,
    specialty TEXT NOT NULL,
    rarity INTEGER NOT NULL,
    personality TEXT NOT NULL,
    teaching_philosophy TEXT NOT NULL,
    speech_style TEXT NOT NULL,
    daily_routine_morning TEXT NOT NULL,
    daily_routine_afternoon TEXT NOT NULL,
    daily_routine_evening TEXT NOT NULL,
    daily_routine_late_night TEXT NOT NULL,
    visual_design_prompt TEXT NOT NULL,
    source TEXT NOT NULL, -- 'random_banner' | 'rotating_shop'
    generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
