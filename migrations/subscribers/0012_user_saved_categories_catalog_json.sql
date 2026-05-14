-- Per-user saved category palette (dedupe merges are case-insensitive on the server).
-- Catalog graph categories on the row (`graph_catalog.categories_json`). Legacy **`graph_catalog_category`** is dropped separately — see **`0013_drop_graph_catalog_category.sql`** if that table still exists.
--
-- Run after `0003` (and profile migrations if needed):
--   npx wrangler d1 execute dsa-pattern-practice-subscribers --remote --file=migrations/subscribers/0012_user_saved_categories_catalog_json.sql

ALTER TABLE user_profiles ADD COLUMN saved_graph_categories_json TEXT;

ALTER TABLE graph_catalog ADD COLUMN categories_json TEXT;
