CREATE TABLE IF NOT EXISTS character_art (
    character_id TEXT PRIMARY KEY,
    base_image_path TEXT,
    banner_image_path TEXT,
    splash_image_path TEXT,
    chat_background_image_path TEXT,
    generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
