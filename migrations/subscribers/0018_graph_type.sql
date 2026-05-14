-- Whole-graph types (DSA vs generic tooling, extensible like node categories).
-- Run after graph library + node categories are in place.
--
--   npx wrangler d1 execute dsa-pattern-practice-subscribers --remote --file=migrations/subscribers/0018_graph_type.sql

CREATE TABLE IF NOT EXISTS graph_type (
    slug TEXT PRIMARY KEY NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_graph_type_sort ON graph_type (sort_order ASC, slug ASC);

INSERT OR IGNORE INTO graph_type (slug, label, description, sort_order, is_system, created_at, updated_at) VALUES
(
    'DSA',
    'DSA',
    'Data structures & algorithms practice graph — enables DSA-specific workspace behavior.',
    0,
    1,
    CAST(strftime('%s', 'now') AS INTEGER),
    CAST(strftime('%s', 'now') AS INTEGER)
),
(
    'GENERIC',
    'Generic',
    'General-purpose mind map — default for new graphs.',
    1,
    1,
    CAST(strftime('%s', 'now') AS INTEGER),
    CAST(strftime('%s', 'now') AS INTEGER)
);

-- Catalog + personal graphs store the chosen type (FK optional in SQLite).
ALTER TABLE graph_catalog ADD COLUMN graph_type_slug TEXT NOT NULL DEFAULT 'GENERIC';
ALTER TABLE user_graphs ADD COLUMN graph_type_slug TEXT NOT NULL DEFAULT 'GENERIC';

CREATE INDEX IF NOT EXISTS idx_graph_catalog_graph_type ON graph_catalog (graph_type_slug)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_graphs_graph_type ON user_graphs (graph_type_slug)
WHERE deleted_at IS NULL;

-- Optional: mark obvious public seeds as DSA (safe if rows exist).
UPDATE graph_catalog SET graph_type_slug = 'DSA' WHERE deleted_at IS NULL AND slug IN ('dsa-patterns-starter', 'graph-algorithms-sprint');
