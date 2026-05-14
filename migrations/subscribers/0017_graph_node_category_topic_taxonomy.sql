-- Introduce TOPIC (branch) under a single graph root; ROOT may no longer nest ROOT.
-- Run after 0016 (needs `description` column on `graph_node_category`).
--
--   npx wrangler d1 execute dsa-pattern-practice-subscribers --remote --file=migrations/subscribers/0017_graph_node_category_topic_taxonomy.sql

INSERT OR IGNORE INTO graph_node_category (slug, label, color, allowed_child_slugs_json, sort_order, is_system, created_at, updated_at) VALUES
(
    'TOPIC',
    'Topic',
    '#0e7490',
    '["TOPIC","PATTERN","PROBLEM"]',
    1,
    1,
    CAST(strftime('%s', 'now') AS INTEGER),
    CAST(strftime('%s', 'now') AS INTEGER)
);

UPDATE graph_node_category
SET allowed_child_slugs_json = '["TOPIC","PATTERN","PROBLEM"]',
    updated_at = CAST(strftime('%s', 'now') AS INTEGER)
WHERE slug = 'ROOT';

UPDATE graph_node_category SET sort_order = 2, updated_at = CAST(strftime('%s', 'now') AS INTEGER) WHERE slug = 'PATTERN';

UPDATE graph_node_category SET sort_order = 3, updated_at = CAST(strftime('%s', 'now') AS INTEGER) WHERE slug = 'PROBLEM';

UPDATE graph_node_category SET description = 'Single top-level mind map root. A graph has exactly one; place TOPIC, PATTERN, and PROBLEM beneath it.'
WHERE slug = 'ROOT';

UPDATE graph_node_category SET description = 'Branch or subject node. May contain nested topics, patterns, and problems under the single graph root.'
WHERE slug = 'TOPIC';
