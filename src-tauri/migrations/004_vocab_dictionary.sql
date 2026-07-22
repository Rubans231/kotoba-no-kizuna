CREATE TABLE IF NOT EXISTS vocab_dictionary (
    word TEXT PRIMARY KEY,
    reading TEXT NOT NULL,
    meaning TEXT NOT NULL,
    nuance TEXT NOT NULL DEFAULT '',
    mnemonic TEXT NOT NULL DEFAULT '',
    related_words TEXT NOT NULL DEFAULT '[]',
    taught_by_character_id TEXT NOT NULL,
    first_taught_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
