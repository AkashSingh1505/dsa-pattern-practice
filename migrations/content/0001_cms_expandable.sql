-- =============================================================================
-- D1: dsa-pattern-practice-content (site CMS / published JSON)
-- Run once per database: wrangler d1 execute … --file=…
-- Safe to re-run: uses IF NOT EXISTS / idempotent patterns where possible.
-- =============================================================================

-- Published blobs (projects, skills, home, dsa, …). Extend ALLOWED keys in api/data.js.
CREATE TABLE IF NOT EXISTS cms_content (
    key TEXT PRIMARY KEY NOT NULL,
    payload TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    content_format TEXT NOT NULL DEFAULT 'json',
    published_at INTEGER,
    meta TEXT
);

-- Future: drafts before publish, multi-editor workflows (nullable FKs ok later)
CREATE TABLE IF NOT EXISTS cms_content_drafts (
    key TEXT PRIMARY KEY NOT NULL,
    draft_payload TEXT NOT NULL,
    base_revision INTEGER,
    updated_at INTEGER NOT NULL,
    editor_ref TEXT,
    meta TEXT
);

-- Feature flags / remote config without new deploys (key → JSON value)
CREATE TABLE IF NOT EXISTS app_kv (
    k TEXT PRIMARY KEY NOT NULL,
    v TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    meta TEXT
);

-- Optional audit trail for compliance / rollback (append-only)
CREATE TABLE IF NOT EXISTS content_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL DEFAULT 'cms_content',
    entity_key TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_ref TEXT,
    payload_snapshot TEXT,
    revision INTEGER,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_audit_key ON content_audit (entity_key, created_at DESC);

-- Backfill columns if you started from an older 3-column cms_content:
-- ALTER TABLE cms_content ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
-- ALTER TABLE cms_content ADD COLUMN content_format TEXT NOT NULL DEFAULT 'json';
-- ALTER TABLE cms_content ADD COLUMN published_at INTEGER;
-- ALTER TABLE cms_content ADD COLUMN meta TEXT;
