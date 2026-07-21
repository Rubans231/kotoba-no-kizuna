ALTER TABLE companions ADD COLUMN relationship_stats TEXT NOT NULL DEFAULT '{"trust":10,"respect":10,"comfort":10,"friendship":10,"affection":10,"studyCompatibility":10,"sharedMemories":0}';
