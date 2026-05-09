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
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "100", 10) || 100));

    try {
        const rows = await db
            .prepare(
                `SELECT id, email, user_id, source, consent_marketing, created_at, meta
                 FROM subscriber_contacts ORDER BY id DESC LIMIT ?`,
            )
            .bind(limit)
            .all();
        return json({ ok: true, contacts: d1ResultRows(rows) });
    } catch (e) {
        console.error("admin contacts", e);
        return json({ error: "server error" }, 500);
    }
}

function d1ResultRows(rows) {
    if (rows && Array.isArray(rows.results)) return rows.results;
    return [];
}
