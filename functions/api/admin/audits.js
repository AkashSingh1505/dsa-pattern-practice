import { contentDb, subscribersDb } from "../../_lib/d1-bindings.js";
import { json, requireAdmin } from "../../_lib/admin-api.js";

export async function onRequestGet(context) {
    const { request, env } = context;
    const gate = await requireAdmin(request);
    if (gate.response) return gate.response;

    const url = new URL(request.url);
    const type = (url.searchParams.get("type") || "content").toLowerCase();
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10) || 50));

    if (type === "content") {
        const db = contentDb(env);
        if (!db) {
            return json({ error: "Content D1 not bound" }, 503);
        }
        try {
            const rows = await db
                .prepare(
                    `SELECT id, entity_type, entity_key, action, actor_ref, revision, created_at
                     FROM content_audit ORDER BY id DESC LIMIT ?`,
                )
                .bind(limit)
                .all();
            return json({ ok: true, type: "content", rows: d1ResultRows(rows) });
        } catch (e) {
            console.error("content audit", e);
            return json({ error: "server error" }, 500);
        }
    }

    if (type === "security") {
        const db = subscribersDb(env);
        if (!db) {
            return json({ error: "Subscribers D1 not bound" }, 503);
        }
        try {
            const rows = await db
                .prepare(
                    `SELECT id, user_id, action, entity_type, entity_id, created_at
                     FROM security_audit ORDER BY id DESC LIMIT ?`,
                )
                .bind(limit)
                .all();
            return json({ ok: true, type: "security", rows: d1ResultRows(rows) });
        } catch (e) {
            console.error("security audit", e);
            return json({ error: "server error" }, 500);
        }
    }

    return json({ error: "type must be content or security" }, 400);
}

function d1ResultRows(rows) {
    if (rows && Array.isArray(rows.results)) return rows.results;
    return [];
}
