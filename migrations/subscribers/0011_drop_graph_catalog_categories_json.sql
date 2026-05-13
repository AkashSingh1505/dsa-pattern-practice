-- Removes legacy `graph_catalog.categories_json`. Canonical catalog categories live in `graph_catalog_category` only.
-- Run AFTER migrating any remaining JSON into rows (Site admin → Library save, or INSERT into graph_catalog_category).
--   npx wrangler d1 execute dsa-pattern-practice-subscribers --remote --file=migrations/subscribers/0011_drop_graph_catalog_categories_json.sql
--
-- If you see "no such column: categories_json", the column was never added — skip this migration.

ALTER TABLE graph_catalog DROP COLUMN categories_json;
