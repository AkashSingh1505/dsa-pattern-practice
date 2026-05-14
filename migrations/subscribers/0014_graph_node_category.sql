-- Global mind-map node types (TOPIC / PATTERN / PROBLEM) + admin-defined types.
-- Child rules: each row lists which category slugs may appear as direct children.
--
--   npx wrangler d1 execute dsa-pattern-practice-subscribers --remote --file=migrations/subscribers/0014_graph_node_category.sql
--
-- Optional cleanup (ignore errors if columns already gone):
--   ALTER TABLE graph_catalog DROP COLUMN categories_json;
--   ALTER TABLE user_graphs DROP COLUMN categories_json;
--   ALTER TABLE user_profiles DROP COLUMN saved_graph_categories_json;

CREATE TABLE IF NOT EXISTS graph_node_category (
    slug TEXT PRIMARY KEY NOT NULL,
    label TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    allowed_child_slugs_json TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_graph_node_category_sort ON graph_node_category (sort_order ASC, slug ASC);

INSERT OR IGNORE INTO graph_node_category (slug, label, color, allowed_child_slugs_json, sort_order, is_system, created_at, updated_at) VALUES
(
    'TOPIC',
    'Topic',
    '#2563eb',
    '["TOPIC","PATTERN","PROBLEM"]',
    0,
    1,
    CAST(strftime('%s', 'now') AS INTEGER),
    CAST(strftime('%s', 'now') AS INTEGER)
),
(
    'PATTERN',
    'Pattern',
    '#059669',
    '["PATTERN","PROBLEM"]',
    1,
    1,
    CAST(strftime('%s', 'now') AS INTEGER),
    CAST(strftime('%s', 'now') AS INTEGER)
),
(
    'PROBLEM',
    'Problem',
    '#c026d3',
    '[]',
    2,
    1,
    CAST(strftime('%s', 'now') AS INTEGER),
    CAST(strftime('%s', 'now') AS INTEGER)
);
