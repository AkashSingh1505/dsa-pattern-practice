-- Personal graph categories as JSON on user_graphs (same pattern as graph_catalog.categories_json).
-- Legacy user_graph_category rows are migrated at runtime on first API touch (see user-graph-categories-json.js).
-- Run: npx wrangler d1 execute dsa-pattern-practice-subscribers --remote --file=migrations/subscribers/0010_user_graphs_categories_json.sql

ALTER TABLE user_graphs ADD COLUMN categories_json TEXT;
