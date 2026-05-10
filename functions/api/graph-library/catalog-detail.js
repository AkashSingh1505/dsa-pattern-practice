import { json } from "../../_lib/admin-api.js";
import { requirePracticeUser } from "../../_lib/practice-auth-request.js";

export async function onRequestGet(context) {
    const { request, env } = context;
    const gate = await requirePracticeUser(request, env);
    if (!gate.ok) {
        return gate.response;
    }
    const url = new URL(request.url);
    const id = String(url.searchParams.get("id") || "").trim();
    if (!id) {
        return json({ error: "id required" }, 400);
    }
    const { db } = gate;
    let row;
    try {
        row = await db
            .prepare(
                `SELECT c.id, c.slug, c.title, c.description, c.visibility, c.payload_json, c.accent_hue, c.tags_json,
                        c.difficulty, c.estimated_minutes, c.download_count, c.created_at, c.updated_at,
                        pu.email AS creator_email, up.display_name AS creator_display_name
                 FROM graph_catalog c
                 LEFT JOIN practice_users pu ON pu.id = c.creator_user_id
                 LEFT JOIN user_profiles up ON up.user_id = pu.id
                 WHERE c.id = ? AND c.deleted_at IS NULL`,
            )
            .bind(id)
            .first();
    } catch (e) {
        console.error("catalog-detail", e);
        return json({ error: "server error" }, 500);
    }
    if (!row) {
        return json({ error: "not found" }, 404);
    }
    const vis = String(row.visibility || "");
    if (vis !== "public" && vis !== "unlisted") {
        return json({ error: "not found" }, 404);
    }
    let payload;
    try {
        payload = JSON.parse(row.payload_json);
    } catch {
        return json({ error: "invalid catalog payload" }, 500);
    }
    const dn = row.creator_display_name && String(row.creator_display_name).trim();
    const em = row.creator_email && String(row.creator_email).trim();
    const creatorLabel = dn || em || "Admin";
    return json({
        ok: true,
        graph: {
            id: row.id,
            slug: row.slug,
            title: row.title,
            description: row.description || "",
            visibility: vis,
            accentHue: row.accent_hue,
            tags: safeJsonArray(row.tags_json),
            difficulty: row.difficulty || null,
            estimatedMinutes: row.estimated_minutes,
            downloadCount: row.download_count || 0,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            creatorLabel,
            payload,
        },
    });
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
