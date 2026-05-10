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
    const { db, userId } = gate;
    let row;
    try {
        row = await db
            .prepare(
                `SELECT id, source_catalog_id, kind, title, description, payload_json, accent_hue, shared_from_user_id, created_at, updated_at
                 FROM user_graphs WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL`,
            )
            .bind(id, userId)
            .first();
    } catch (e) {
        console.error("mine-detail get", e);
        return json({ error: "server error" }, 500);
    }
    if (!row) {
        return json({ error: "not found" }, 404);
    }
    let payload;
    try {
        payload = JSON.parse(row.payload_json);
    } catch {
        return json({ error: "invalid graph data" }, 500);
    }
    if (!Array.isArray(payload)) {
        return json({ error: "invalid graph data" }, 500);
    }
    return json({
        ok: true,
        graph: {
            id: row.id,
            sourceCatalogId: row.source_catalog_id,
            kind: row.kind,
            title: row.title,
            description: row.description || "",
            accentHue: row.accent_hue,
            sharedFromUserId: row.shared_from_user_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            payload,
        },
    });
}

export async function onRequestPut(context) {
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
    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: "invalid JSON" }, 400);
    }
    const { db, userId } = gate;
    let row;
    try {
        row = await db
            .prepare(`SELECT id FROM user_graphs WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL`)
            .bind(id, userId)
            .first();
    } catch (e) {
        console.error("mine-detail put lookup", e);
        return json({ error: "server error" }, 500);
    }
    if (!row) {
        return json({ error: "not found" }, 404);
    }
    const updates = [];
    const binds = [];
    if (typeof body.title === "string") {
        const t = body.title.trim();
        if (!t) {
            return json({ error: "title empty" }, 400);
        }
        updates.push("title = ?");
        binds.push(t);
    }
    if (typeof body.description === "string") {
        updates.push("description = ?");
        binds.push(body.description.trim());
    }
    if (body.payload != null) {
        let text;
        try {
            text = JSON.stringify(body.payload);
            const p = JSON.parse(text);
            if (!Array.isArray(p)) {
                return json({ error: "payload must be array" }, 400);
            }
        } catch {
            return json({ error: "invalid payload" }, 400);
        }
        updates.push("payload_json = ?");
        binds.push(text);
    }
    if (!updates.length) {
        return json({ error: "nothing to update" }, 400);
    }
    const now = Math.floor(Date.now() / 1000);
    updates.push("updated_at = ?");
    binds.push(now);
    binds.push(id, userId);
    try {
        await db
            .prepare(`UPDATE user_graphs SET ${updates.join(", ")} WHERE id = ? AND owner_user_id = ?`)
            .bind(...binds)
            .run();
    } catch (e) {
        console.error("mine-detail put", e);
        return json({ error: "server error" }, 500);
    }
    return json({ ok: true, updatedAt: now });
}

export async function onRequestDelete(context) {
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
    const { db, userId } = gate;
    const now = Math.floor(Date.now() / 1000);
    try {
        const res = await db
            .prepare(`UPDATE user_graphs SET deleted_at = ?, updated_at = ? WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL`)
            .bind(now, now, id, userId)
            .run();
        if (!res.meta || res.meta.changes === 0) {
            return json({ error: "not found" }, 404);
        }
    } catch (e) {
        console.error("mine-detail delete", e);
        return json({ error: "server error" }, 500);
    }
    return json({ ok: true });
}
