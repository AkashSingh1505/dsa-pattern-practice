import { json } from "../../_lib/admin-api.js";
import { requirePracticeUser } from "../../_lib/practice-auth-request.js";
import { ensureUserGraphVisibilityColumn } from "../../_lib/user-graph-visibility.js";
import { listGraphNodeCategories, validateMindMapNodeCategoriesWithDb } from "../../_lib/graph-node-category.js";

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
    const hasVisibility = await ensureUserGraphVisibilityColumn(db);
    let row;
    try {
        row = await db
            .prepare(
                `SELECT id, source_catalog_id, kind, title, description, payload_json, accent_hue, ${
                    hasVisibility ? "visibility" : "'private'"
                } AS visibility, shared_from_user_id, created_at, updated_at
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
    const inv = await validateMindMapNodeCategoriesWithDb(db, payload);
    if (!inv.ok) {
        return json({ error: inv.error, code: inv.code || "GRAPH_INVALID" }, 422);
    }
    const nodeCategories = await listGraphNodeCategories(db);
    return json({
        ok: true,
        graph: {
            id: row.id,
            sourceCatalogId: row.source_catalog_id,
            kind: row.kind,
            title: row.title,
            description: row.description || "",
            accentHue: row.accent_hue,
            visibility: String(row.visibility || "private"),
            sharedFromUserId: row.shared_from_user_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            nodeCategories,
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
    const hasVisibility = await ensureUserGraphVisibilityColumn(db);
    let fullRow;
    try {
        fullRow = await db
            .prepare(`SELECT id, payload_json FROM user_graphs WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL`)
            .bind(id, userId)
            .first();
    } catch (e) {
        console.error("mine-detail put lookup", e);
        return json({ error: "server error" }, 500);
    }
    if (!fullRow) {
        return json({ error: "not found" }, 404);
    }
    const now = Math.floor(Date.now() / 1000);

    if (body.payload != null) {
        if (!Array.isArray(body.payload)) {
            return json({ error: "payload must be array" }, 400);
        }
        const inv = await validateMindMapNodeCategoriesWithDb(db, body.payload);
        if (!inv.ok) {
            return json({ error: inv.error, code: inv.code || "GRAPH_INVALID" }, 400);
        }
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
    if (typeof body.visibility === "string") {
        if (!hasVisibility) {
            return json({ error: "visibility not ready yet" }, 400);
        }
        const vis = body.visibility.trim().toLowerCase();
        if (vis !== "private" && vis !== "public") {
            return json({ error: "visibility must be private or public" }, 400);
        }
        updates.push("visibility = ?");
        binds.push(vis);
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
    await ensureUserGraphVisibilityColumn(db);
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
