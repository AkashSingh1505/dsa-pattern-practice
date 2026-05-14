-- HISTORICAL: Removed legacy `graph_catalog.categories_json` in favor of **`graph_catalog_category`** rows.
-- Current schema (0012): categories are **`graph_catalog.categories_json`** again; skip this migration on new databases.
-- If your DB still has `categories_json` and you never ran this file, prefer **`0012`** instead.
--   npx wrangler d1 execute dsa-pattern-practice-subscribers --remote --file=migrations/subscribers/0011_drop_graph_catalog_categories_json.sql
--
-- If you see "no such column: categories_json", the column was never added — skip this migration.

ALTER TABLE graph_catalog DROP COLUMN categories_json;
