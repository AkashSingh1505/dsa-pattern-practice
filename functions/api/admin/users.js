import { subscribersDb } from "../../_lib/d1-bindings.js";
import { json, requireAdmin } from "../../_lib/admin-api.js";

export async function onRequestGet(context) {
    const { request, env } = context;
    const gate = await requireAdmin(request);
    if (gate.response) return gate.response;

    const db = subscribersDb(env);
    if (!db) {
        return json({ error: "Subscribers D1 not bound" }, 503);
    }

    const url = new URL(request.url);
    const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") || "80", 10) || 80));
    const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10) || 0);

    try {
        const rows = await db
            .prepare(
                `SELECT id, public_id, email, role, plan, status, last_login_at, created_at, updated_at
                 FROM practice_users
                 ORDER BY id DESC
                 LIMIT ? OFFSET ?`,
            )
            .bind(limit, offset)
            .all();

        let total = 0;
        try {
            const t = await db.prepare("SELECT COUNT(*) AS n FROM practice_users").first();
            total = t && typeof t.n === "number" ? t.n : 0;
        } catch (e) {
            /* ignore */
        }

        return json({
            ok: true,
            total,
            limit,
            offset,
            users: d1ResultRows(rows),
        });
    } catch (e) {
        console.error("admin users list", e);
        return json({ error: "server error" }, 500);
    }
}

function d1ResultRows(rows) {
    if (rows && Array.isArray(rows.results)) return rows.results;
    return [];
}
