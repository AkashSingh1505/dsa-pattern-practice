-- OBSOLETE (no-op): Catalog categories are stored only in `graph_catalog_category` (see 0008).
-- Older repos added `graph_catalog.categories_json` here; that column is removed by `0011_drop_graph_catalog_categories_json.sql`.
-- New databases: skip this file or run it — it does nothing.
--
-- If you still have `categories_json` on `graph_catalog`, migrate data into `graph_catalog_category` first, then run 0011.

SELECT 1;
