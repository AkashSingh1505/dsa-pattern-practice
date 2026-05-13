-- Optional category labels + colors for library catalog graphs (mind-map styling / filters).
-- Run after 0003_graph_library.sql:
--   npx wrangler d1 execute dsa-pattern-practice-subscribers --remote --file=migrations/subscribers/0007_graph_catalog_categories.sql

ALTER TABLE graph_catalog ADD COLUMN categories_json TEXT;
