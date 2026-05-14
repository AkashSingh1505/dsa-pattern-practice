-- LEGACY: Normalized catalog categories table. **Superseded by `graph_catalog.categories_json`** (see `0012_user_saved_categories_catalog_json.sql`).
-- New installs: skip this file; run **`0012`**. To drop the table after migrating data, run **`0013_drop_graph_catalog_category.sql`**.
-- Run after 0003_graph_library.sql. (0007 is obsolete; legacy JSON column removed by 0011.)
--   npx wrangler d1 execute dsa-pattern-practice-subscribers --remote --file=migrations/subscribers/0008_graph_catalog_category_table.sql

CREATE TABLE IF NOT EXISTS graph_catalog_category (
    id TEXT PRIMARY KEY NOT NULL,
    catalog_id TEXT NOT NULL REFERENCES graph_catalog (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6b7280',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_graph_catalog_category_catalog
ON graph_catalog_category (catalog_id, sort_order);
