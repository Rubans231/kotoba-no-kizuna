ALTER TABLE user_profile ADD COLUMN gems INTEGER NOT NULL DEFAULT 300;
ALTER TABLE user_profile ADD COLUMN pity_counter INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS daily_commissions (
    commission_id TEXT NOT NULL,
    date TEXT NOT NULL,
    target INTEGER NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    claimed INTEGER NOT NULL DEFAULT 0,
    reward_gems INTEGER NOT NULL,
    PRIMARY KEY (commission_id, date)
);
