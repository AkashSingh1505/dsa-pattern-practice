-- Community catalog + personal graph copies (subscribers D1)
-- Run: wrangler d1 execute … --file=migrations/subscribers/0003_graph_library.sql

CREATE TABLE IF NOT EXISTS graph_catalog (
    id TEXT PRIMARY KEY NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private')),
    creator_user_id INTEGER REFERENCES practice_users (id) ON DELETE SET NULL,
    payload_json TEXT NOT NULL,
    accent_hue INTEGER,
    tags_json TEXT,
    difficulty TEXT,
    estimated_minutes INTEGER,
    download_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_graph_catalog_public_live
ON graph_catalog (updated_at DESC)
WHERE visibility = 'public' AND deleted_at IS NULL;

-- One row per user per catalog item (for unique downloader counts)
CREATE TABLE IF NOT EXISTS graph_catalog_downloads (
    catalog_id TEXT NOT NULL REFERENCES graph_catalog (id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES practice_users (id) ON DELETE CASCADE,
    downloaded_at INTEGER NOT NULL,
    PRIMARY KEY (catalog_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_graph_catalog_downloads_user ON graph_catalog_downloads (user_id);

-- Personal library: created, downloaded copy, or shared copy
CREATE TABLE IF NOT EXISTS user_graphs (
    id TEXT PRIMARY KEY NOT NULL,
    owner_user_id INTEGER NOT NULL REFERENCES practice_users (id) ON DELETE CASCADE,
    source_catalog_id TEXT REFERENCES graph_catalog (id) ON DELETE SET NULL,
    kind TEXT NOT NULL CHECK (kind IN ('created', 'downloaded', 'shared')),
    title TEXT NOT NULL,
    description TEXT,
    payload_json TEXT NOT NULL,
    accent_hue INTEGER,
    shared_from_user_id INTEGER REFERENCES practice_users (id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_user_graphs_owner_live ON user_graphs (owner_user_id, updated_at DESC)
WHERE deleted_at IS NULL;
