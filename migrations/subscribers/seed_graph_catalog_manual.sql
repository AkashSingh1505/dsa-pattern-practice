-- Paste into Cloudflare D1 → your subscribers database → Query (SQL editor).
-- Requires table graph_catalog from 0003_graph_library.sql.
-- Run `0007_graph_catalog_categories.sql` first so `categories_json` exists on `graph_catalog`.
-- Prefer Site admin → Library (RSA) for day-to-day publishing; use SQL for bulk seeds or automation.
-- Reserved slug: dsa-site-map — upserted automatically when admin publishes Content → dsa (public catalog mirror).
-- Re-run safe: uses INSERT OR IGNORE on id (change ids/slugs if you need duplicates).
--
-- Mind maps must declare ≥1 category and every root/topic/problem must set graphCategoryId (see API validation).

-- ---------------------------------------------------------------------------
-- 1) Public starter map (creator shows as "Admin" when creator_user_id IS NULL)
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO graph_catalog (
    id,
    slug,
    title,
    description,
    visibility,
    creator_user_id,
    payload_json,
    accent_hue,
    tags_json,
    categories_json,
    difficulty,
    estimated_minutes,
    download_count,
    created_at,
    updated_at,
    deleted_at
) VALUES (
    'a1000000-0000-4000-8000-000000000001',
    'dsa-patterns-starter',
    'DSA patterns starter',
    'Community starter mind map — members can add a copy to their library.',
    'public',
    NULL,
    '[{"id":"starter-root","name":"DSA pattern map","graphCategoryId":"st-cat-1","tree":[{"name":"Arrays, hashing, strings","graphCategoryId":"st-cat-1","problems":[],"children":[]},{"name":"Two pointers & sliding window","graphCategoryId":"st-cat-1","problems":[],"children":[]},{"name":"Binary search & variants","graphCategoryId":"st-cat-1","problems":[],"children":[]},{"name":"Linked lists & stacks","graphCategoryId":"st-cat-1","problems":[],"children":[]},{"name":"Trees & traversals","graphCategoryId":"st-cat-1","problems":[],"children":[]},{"name":"Heaps & priority queues","graphCategoryId":"st-cat-1","problems":[],"children":[]},{"name":"Graphs (BFS, DFS, topo)","graphCategoryId":"st-cat-1","problems":[],"children":[]},{"name":"Dynamic programming","graphCategoryId":"st-cat-1","problems":[],"children":[]}]}]',
    262,
    '["starter","interview","patterns"]',
    '[{"id":"st-cat-1","name":"Topics","color":"#3b82f6"}]',
    'mixed',
    60,
    0,
    CAST(strftime('%s', 'now') AS INTEGER),
    CAST(strftime('%s', 'now') AS INTEGER),
    NULL
);

-- ---------------------------------------------------------------------------
-- 2) Second public example (graphs / trees focus)
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO graph_catalog (
    id,
    slug,
    title,
    description,
    visibility,
    creator_user_id,
    payload_json,
    accent_hue,
    tags_json,
    categories_json,
    difficulty,
    estimated_minutes,
    download_count,
    created_at,
    updated_at,
    deleted_at
) VALUES (
    'a1000000-0000-4000-8000-000000000002',
    'graph-algorithms-sprint',
    'Graph algorithms sprint',
    'Topic-focused map for BFS, DFS, shortest paths, and topo sort.',
    'public',
    NULL,
    '[{"id":"graph-sprint","name":"Graph algorithms","graphCategoryId":"sp-cat-1","tree":[{"name":"Representations (adj list, matrix)","graphCategoryId":"sp-cat-1","problems":[],"children":[]},{"name":"BFS & layers","graphCategoryId":"sp-cat-1","problems":[],"children":[]},{"name":"DFS & cycle detection","graphCategoryId":"sp-cat-1","problems":[],"children":[]},{"name":"Topo sort (Kahn, DFS)","graphCategoryId":"sp-cat-1","problems":[],"children":[]},{"name":"Dijkstra (basics)","graphCategoryId":"sp-cat-1","problems":[],"children":[]},{"name":"Union-find","graphCategoryId":"sp-cat-1","problems":[],"children":[]}]}]',
    200,
    '["graphs","bfs","dfs"]',
    '[{"id":"sp-cat-1","name":"Topics","color":"#059669"}]',
    'intermediate',
    90,
    0,
    CAST(strftime('%s', 'now') AS INTEGER),
    CAST(strftime('%s', 'now') AS INTEGER),
    NULL
);

-- ---------------------------------------------------------------------------
-- Optional: attach creator to an existing practice user (by email).
-- Replace the email, or delete this block and keep creator_user_id NULL above.
-- ---------------------------------------------------------------------------
-- UPDATE graph_catalog
-- SET creator_user_id = (SELECT id FROM practice_users WHERE email = 'you@example.com' LIMIT 1)
-- WHERE id = 'a1000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- Optional: unpublish (soft delete) or change visibility
-- ---------------------------------------------------------------------------
-- UPDATE graph_catalog SET visibility = 'private', updated_at = CAST(strftime('%s', 'now') AS INTEGER) WHERE slug = 'dsa-patterns-starter';
-- UPDATE graph_catalog SET deleted_at = CAST(strftime('%s', 'now') AS INTEGER), updated_at = CAST(strftime('%s', 'now') AS INTEGER) WHERE id = 'a1000000-0000-4000-8000-000000000002';
