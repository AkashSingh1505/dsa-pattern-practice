-- Fresh seed: ROOT + TOPIC + PATTERN + PROBLEM (run when `graph_node_category` is empty).
-- Requires `description` column — run `0016_graph_node_category_description.sql` first if the table was created from an older `0014`.
--
--   npx wrangler d1 execute dsa-pattern-practice-subscribers --remote --file=migrations/subscribers/seed_graph_node_category_root.sql

INSERT INTO graph_node_category (slug, label, description, color, allowed_child_slugs_json, sort_order, is_system, created_at, updated_at) VALUES
(
    'ROOT',
    'Root',
    'Single top-level mind map root. A graph has exactly one; place TOPIC, PATTERN, and PROBLEM beneath it.',
    '#2563eb',
    '["TOPIC","PATTERN","PROBLEM"]',
    0,
    1,
    CAST(strftime('%s', 'now') AS INTEGER),
    CAST(strftime('%s', 'now') AS INTEGER)
),
(
    'TOPIC',
    'Topic',
    'Branch or subject node. May contain nested topics, patterns, and problems under the single graph root.',
    '#0e7490',
    '["TOPIC","PATTERN","PROBLEM"]',
    1,
    1,
    CAST(strftime('%s', 'now') AS INTEGER),
    CAST(strftime('%s', 'now') AS INTEGER)
),
(
    'PATTERN',
    'Pattern',
    'A DSA pattern or technique grouping (e.g. two pointers, sliding window).',
    '#059669',
    '["PATTERN","PROBLEM"]',
    2,
    1,
    CAST(strftime('%s', 'now') AS INTEGER),
    CAST(strftime('%s', 'now') AS INTEGER)
),
(
    'PROBLEM',
    'Problem',
    'A concrete practice problem or leaf item in the hierarchy.',
    '#c026d3',
    '[]',
    3,
    1,
    CAST(strftime('%s', 'now') AS INTEGER),
    CAST(strftime('%s', 'now') AS INTEGER)
);
