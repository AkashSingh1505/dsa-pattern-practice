-- =============================================================================
-- Add practice role `subscriber` (paid practice accounts). Rebuilds practice_users
-- to extend CHECK(role). Paid plans → role subscriber; free-tier staff stay admin.
-- Run on: dsa-pattern-practice-subscribers
-- =============================================================================

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

CREATE TABLE practice_users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'subscriber')),
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team', 'lifetime')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    email_verified_at INTEGER,
    last_login_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    metadata TEXT
);

INSERT INTO practice_users_new (
    id,
    public_id,
    email,
    password_hash,
    salt,
    role,
    plan,
    status,
    email_verified_at,
    last_login_at,
    created_at,
    updated_at,
    metadata
)
SELECT
    id,
    public_id,
    email,
    password_hash,
    salt,
    CASE
        WHEN plan IN ('pro', 'team', 'lifetime') THEN 'subscriber'
        ELSE role
    END AS role,
    plan,
    status,
    email_verified_at,
    last_login_at,
    created_at,
    updated_at,
    metadata
FROM practice_users;

DROP TABLE practice_users;

ALTER TABLE practice_users_new RENAME TO practice_users;

CREATE INDEX IF NOT EXISTS idx_practice_users_status ON practice_users (status);
CREATE INDEX IF NOT EXISTS idx_practice_users_plan ON practice_users (plan);

DELETE FROM sqlite_sequence WHERE name = 'practice_users';
INSERT INTO sqlite_sequence (name, seq)
SELECT 'practice_users', IFNULL(MAX(id), 0) FROM practice_users;

COMMIT;

PRAGMA foreign_keys = ON;
