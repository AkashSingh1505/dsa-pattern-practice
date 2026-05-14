-- Optional cleanup: legacy normalized catalog categories (replaced by `graph_catalog.categories_json`).
-- Run after **`0012`** and after copying any needed category data into `categories_json` (e.g. Site admin → save each catalog graph).
-- Safe if the table does not exist.
--
--   npx wrangler d1 execute dsa-pattern-practice-subscribers --remote --file=migrations/subscribers/0013_drop_graph_catalog_category.sql

DROP TABLE IF EXISTS graph_catalog_category;
