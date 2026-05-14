-- Human-readable explanation for each mind-map node type (admin UI + API).
-- Run after 0014. Safe on fresh DBs created from 0014 (no `description` column yet).
--
--   npx wrangler d1 execute dsa-pattern-practice-subscribers --remote --file=migrations/subscribers/0016_graph_node_category_description.sql

ALTER TABLE graph_node_category ADD COLUMN description TEXT NOT NULL DEFAULT '';

UPDATE graph_node_category SET description = 'Single top-level mind map root. A graph has exactly one; place TOPIC, PATTERN, and PROBLEM beneath it.'
WHERE slug = 'ROOT';

UPDATE graph_node_category SET description = 'Branch or subject node. May contain nested topics, patterns, and problems under the single graph root.'
WHERE slug = 'TOPIC';

UPDATE graph_node_category SET description = 'A DSA pattern or technique grouping (e.g. two pointers, sliding window).'
WHERE slug = 'PATTERN';

UPDATE graph_node_category SET description = 'A concrete practice problem or leaf item in the hierarchy.'
WHERE slug = 'PROBLEM';
