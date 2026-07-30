CREATE TABLE IF NOT EXISTS character_lora_pipeline (
    character_id TEXT PRIMARY KEY,
    stage TEXT NOT NULL DEFAULT 'not_started', -- not_started | base_image | view_profiles | training_set | training | complete | failed
    trigger_word TEXT NOT NULL DEFAULT '',
    base_image_path TEXT,
    view_profile_paths TEXT NOT NULL DEFAULT '[]', -- JSON array of paths
    training_set_paths TEXT NOT NULL DEFAULT '[]', -- JSON array of {"path": "...", "framing": "close_up|upper_body|full_body"}
    lora_path TEXT,
    error_message TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
