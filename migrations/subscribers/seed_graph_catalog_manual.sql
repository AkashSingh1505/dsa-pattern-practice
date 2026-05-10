-- Paste into Cloudflare D1 → your subscribers database → Query (SQL editor).
-- Requires table graph_catalog from 0003_graph_library.sql.
-- Prefer Site admin → Library (RSA) for day-to-day publishing; use SQL for bulk seeds or automation.
-- Re-run safe: uses INSERT OR IGNORE on id (change ids/slugs if you need duplicates).

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
    '[{"id":"starter-root","name":"DSA pattern map","tree":[{"name":"Arrays, hashing, strings","problems":[]},{"name":"Two pointers & sliding window","problems":[]},{"name":"Binary search & variants","problems":[]},{"name":"Linked lists & stacks","problems":[]},{"name":"Trees & traversals","problems":[]},{"name":"Heaps & priority queues","problems":[]},{"name":"Graphs (BFS, DFS, topo)","problems":[]},{"name":"Dynamic programming","problems":[]}]}]',
    262,
    '["starter","interview","patterns"]',
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
    '[{"id":"graph-sprint","name":"Graph algorithms","tree":[{"name":"Representations (adj list, matrix)","problems":[]},{"name":"BFS & layers","problems":[]},{"name":"DFS & cycle detection","problems":[]},{"name":"Topo sort (Kahn, DFS)","problems":[]},{"name":"Dijkstra (basics)","problems":[]},{"name":"Union-find","problems":[]}]}]',
    200,
    '["graphs","bfs","dfs"]',
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
