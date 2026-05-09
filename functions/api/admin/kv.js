import { contentDb } from "../../_lib/d1-bindings.js";
import { json, requireAdmin } from "../../_lib/admin-api.js";

export async function onRequestGet(context) {
    const { request, env } = context;
    const gate = await requireAdmin(request);
    if (gate.response) return gate.response;

    const db = contentDb(env);
    if (!db) {
        return json({ error: "Content D1 not bound" }, 503);
    }

    const url = new URL(request.url);
    const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get("limit") || "200", 10) || 200));

    try {
        const rows = await db
            .prepare("SELECT k, v, updated_at, meta FROM app_kv ORDER BY k ASC LIMIT ?")
            .bind(limit)
            .all();
        return json({ ok: true, rows: d1ResultRows(rows) });
    } catch (e) {
        console.error("app_kv list", e);
        return json({ error: "server error" }, 500);
    }
}

export async function onRequestPut(context) {
    const { request, env } = context;
    const gate = await requireAdmin(request);
    if (gate.response) return gate.response;

    const db = contentDb(env);
    if (!db) {
        return json({ error: "Content D1 not bound" }, 503);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: "invalid JSON" }, 400);
    }

    const k = String(body.k || "").trim();
    if (!k || k.length > 256) {
        return json({ error: "invalid k" }, 400);
    }
    const v = body.v;
    if (v === undefined || typeof v !== "string") {
        return json({ error: "v must be a string" }, 400);
    }

    const now = Math.floor(Date.now() / 1000);
    const meta = body.meta != null ? String(body.meta) : null;

    try {
        await db
            .prepare(
                `INSERT INTO app_kv (k, v, updated_at, meta) VALUES (?, ?, ?, ?)
                 ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at, meta = excluded.meta`,
            )
            .bind(k, v, now, meta)
            .run();
        return json({ ok: true, k, updated_at: now });
    } catch (e) {
        console.error("app_kv put", e);
        return json({ error: "server error" }, 500);
    }
}

function d1ResultRows(rows) {
    if (rows && Array.isArray(rows.results)) return rows.results;
    return [];
}
