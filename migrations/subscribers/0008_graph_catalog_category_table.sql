-- Normalized catalog graph categories (stable ids for payload.catalogCategoryId on nodes).
-- Run after 0007_graph_catalog_categories.sql (or any graph_catalog with categories_json legacy data).
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
