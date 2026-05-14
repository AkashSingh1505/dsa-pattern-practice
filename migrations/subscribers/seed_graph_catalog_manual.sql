-- Paste into Cloudflare D1 → your subscribers database → Query (SQL editor).
-- Requires `graph_catalog` (0003) and **`graph_catalog.categories_json`** (see `0012_user_saved_categories_catalog_json.sql`).
-- Prefer Site admin → Library (RSA) for day-to-day publishing; use SQL for bulk seeds or automation.
-- Re-run safe: INSERT OR IGNORE on graph_catalog id.
--
-- Mind maps must declare ≥1 category in `categories_json` and every root/topic/problem must set graphCategoryId (see API validation).

-- ---------------------------------------------------------------------------
-- 1) Public starter map
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
    difficulty,
    estimated_minutes,
    download_count,
    categories_json,
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
    'mixed',
    60,
    0,
    '[{"id":"st-cat-1","name":"Topics","color":"#3b82f6"}]',
    CAST(strftime('%s', 'now') AS INTEGER),
    CAST(strftime('%s', 'now') AS INTEGER),
    NULL
);

-- ---------------------------------------------------------------------------
-- 2) Second public example (graphs focus)
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
    difficulty,
    estimated_minutes,
    download_count,
    categories_json,
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
    'intermediate',
    90,
    0,
    '[{"id":"sp-cat-1","name":"Topics","color":"#059669"}]',
    CAST(strftime('%s', 'now') AS INTEGER),
    CAST(strftime('%s', 'now') AS INTEGER),
    NULL
);

-- ---------------------------------------------------------------------------
-- Optional: attach creator — UPDATE graph_catalog SET creator_user_id = ...
-- ---------------------------------------------------------------------------
