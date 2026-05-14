import { json } from "../../_lib/admin-api.js";
import { requirePracticeUser } from "../../_lib/practice-auth-request.js";
import { graphPayloadStatsFromJson } from "../../_lib/graph-payload-stats.js";
import { listGraphNodeCategories } from "../../_lib/graph-node-category.js";

function creatorLabel(row) {
    const dn = row.creator_display_name && String(row.creator_display_name).trim();
    if (dn) {
        return dn;
    }
    const em = row.creator_email && String(row.creator_email).trim();
    if (em) {
        return em;
    }
    return "Admin";
}

export async function onRequestGet(context) {
    const { request, env } = context;
    const gate = await requirePracticeUser(request, env);
    if (!gate.ok) {
        return gate.response;
    }
    const { db } = gate;
    let nodeCategoryList;
    try {
        nodeCategoryList = await listGraphNodeCategories(db);
    } catch (e) {
        console.error("graph-library public node categories", e);
        nodeCategoryList = [];
    }
    let rows;
    let uniq;
    try {
        rows = await db
            .prepare(
                `SELECT c.id, c.slug, c.title, c.description, c.accent_hue, c.tags_json, c.difficulty,
                        c.payload_json,
                        c.estimated_minutes, c.download_count, c.created_at, c.updated_at,
                        pu.email AS creator_email, up.display_name AS creator_display_name
                 FROM graph_catalog c
                 LEFT JOIN practice_users pu ON pu.id = c.creator_user_id
                 LEFT JOIN user_profiles up ON up.user_id = pu.id
                 WHERE c.visibility = 'public' AND c.deleted_at IS NULL
                 ORDER BY c.updated_at DESC`,
            )
            .all();
        uniq = await db
            .prepare(`SELECT catalog_id, COUNT(*) AS n FROM graph_catalog_downloads GROUP BY catalog_id`)
            .all();
    } catch (e) {
        console.error("graph-library public list", e);
        return json({ error: "server error" }, 500);
    }
    const uniqMap = new Map();
    for (const r of uniq.results || []) {
        uniqMap.set(r.catalog_id, r.n);
    }
    const resultRows = rows.results || [];
    const graphs = resultRows.map((r) => {
        const stats = graphPayloadStatsFromJson(r.payload_json);
        return {
            id: r.id,
            slug: r.slug,
            title: r.title,
            description: r.description || "",
            accentHue: r.accent_hue,
            tags: safeJsonArray(r.tags_json),
            difficulty: r.difficulty || null,
            estimatedMinutes: r.estimated_minutes,
            downloadCount: Number(r.download_count || 0) || 0,
            uniqueDownloaders: Number(uniqMap.get(r.id) || 0) || 0,
            nodeCount: stats.nodeCount,
            branchCount: stats.branchCount,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            creatorLabel: creatorLabel(r),
        };
    });
    return json({ ok: true, nodeCategories: nodeCategoryList, graphs });
}

function safeJsonArray(s) {
    if (!s || typeof s !== "string") {
        return [];
    }
    try {
        const x = JSON.parse(s);
        return Array.isArray(x) ? x : [];
    } catch {
        return [];
    }
}
