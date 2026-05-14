-- Promote TOPIC → ROOT (top mind-map type). Safe to re-run if TOPIC is already gone.
--
--   npx wrangler d1 execute dsa-pattern-practice-subscribers --remote --file=migrations/subscribers/0015_graph_node_category_root_slug.sql
--
-- Steps:
--   1) Replace "TOPIC" with "ROOT" inside every allowed_child_slugs_json array.
--   2) Rename the TOPIC row to slug ROOT / label Root.
--   3) Fix user graph payloads that still use nodeCategorySlug TOPIC at the root.

-- 1) Child lists (must run before PK change so we still match slug TOPIC in step not needed for this—this updates JSON text only)
UPDATE graph_node_category
SET allowed_child_slugs_json = REPLACE(allowed_child_slugs_json, '"TOPIC"', '"ROOT"')
WHERE allowed_child_slugs_json LIKE '%TOPIC%';

-- 2) Root row
UPDATE graph_node_category
SET slug = 'ROOT',
    label = 'Root',
    updated_at = CAST(strftime('%s', 'now') AS INTEGER)
WHERE slug = 'TOPIC';

-- 3) Saved mind-map JSON (optional; ignore if table empty)
UPDATE user_graphs
SET payload_json = REPLACE(payload_json, '"nodeCategorySlug":"TOPIC"', '"nodeCategorySlug":"ROOT"'),
    updated_at = CAST(strftime('%s', 'now') AS INTEGER)
WHERE payload_json IS NOT NULL
  AND payload_json LIKE '%"nodeCategorySlug":"TOPIC"%';
