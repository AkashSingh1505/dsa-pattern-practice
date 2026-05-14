import { json } from "../../_lib/admin-api.js";
import { requireGraphCatalogWriter } from "../../_lib/practice-auth-request.js";
import { listGraphTypes, normalizeGraphTypeSlug } from "../../_lib/graph-type.js";
import { slugFromLabel } from "../../_lib/graph-node-category.js";

const LABEL_MAX = 80;
const DESC_MAX = 2000;

export async function onRequestGet(context) {
    const { request, env } = context;
    const gate = await requireGraphCatalogWriter(request, env);
    if (!gate.ok) {
        return gate.response;
    }
    let types;
    try {
        types = await listGraphTypes(gate.db);
    } catch (e) {
        console.error("admin graph-types list", e);
        return json({ error: "server error" }, 500);
    }
    return json({ ok: true, types });
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const gate = await requireGraphCatalogWriter(request, env);
    if (!gate.ok) {
        return gate.response;
    }
    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: "invalid JSON" }, 400);
    }
    const label = String(body.label || "").trim().slice(0, LABEL_MAX);
    if (!label) {
        return json({ error: "label required" }, 400);
    }
    const slugIn = String(body.slug || "").trim();
    const slug = slugIn ? normalizeGraphTypeSlug(slugIn) : slugFromLabel(label);
    if (!slug || slug.length < 2) {
        return json({ error: "invalid slug" }, 400);
    }
    const description = body.description != null ? String(body.description).trim().slice(0, DESC_MAX) : "";
    const sortOrder =
        typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder) ? Math.floor(body.sortOrder) : 99;
    const now = Math.floor(Date.now() / 1000);
    const { db } = gate;
    try {
        await db
            .prepare(
                `INSERT INTO graph_type (slug, label, description, sort_order, is_system, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 0, ?, ?)`,
            )
            .bind(slug, label, description || null, sortOrder, now, now)
            .run();
    } catch (e) {
        const msg = e && e.message ? String(e.message) : "";
        if (msg.includes("UNIQUE") || msg.includes("unique")) {
            return json({ error: "slug or label already exists" }, 409);
        }
        console.error("admin graph-types POST", e);
        return json({ error: "server error" }, 500);
    }
    return json({ ok: true, slug });
}

export async function onRequestPatch(context) {
    const { request, env } = context;
    const gate = await requireGraphCatalogWriter(request, env);
    if (!gate.ok) {
        return gate.response;
    }
    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: "invalid JSON" }, 400);
    }
    const slug = normalizeGraphTypeSlug(body.slug);
    if (!slug) {
        return json({ error: "slug required" }, 400);
    }
    const { db } = gate;
    let row;
    try {
        row = await db.prepare("SELECT slug, is_system FROM graph_type WHERE slug = ?").bind(slug).first();
    } catch (e) {
        console.error("admin graph-types patch lookup", e);
        return json({ error: "server error" }, 500);
    }
    if (!row) {
        return json({ error: "not found" }, 404);
    }
    const updates = [];
    const binds = [];
    if (typeof body.label === "string" && body.label.trim()) {
        updates.push("label = ?");
        binds.push(body.label.trim().slice(0, LABEL_MAX));
    }
    if (typeof body.description === "string") {
        updates.push("description = ?");
        binds.push(body.description.trim().slice(0, DESC_MAX));
    }
    if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
        updates.push("sort_order = ?");
        binds.push(Math.floor(body.sortOrder));
    }
    if (!updates.length) {
        return json({ error: "nothing to update" }, 400);
    }
    const now = Math.floor(Date.now() / 1000);
    updates.push("updated_at = ?");
    binds.push(now);
    binds.push(slug);
    try {
        await db.prepare(`UPDATE graph_type SET ${updates.join(", ")} WHERE slug = ?`).bind(...binds).run();
    } catch (e) {
        console.error("admin graph-types PATCH", e);
        return json({ error: "server error" }, 500);
    }
    return json({ ok: true });
}

export async function onRequestDelete(context) {
    const { request, env } = context;
    const gate = await requireGraphCatalogWriter(request, env);
    if (!gate.ok) {
        return gate.response;
    }
    const url = new URL(request.url);
    const slug = normalizeGraphTypeSlug(url.searchParams.get("slug"));
    if (!slug) {
        return json({ error: "slug required" }, 400);
    }
    const { db } = gate;
    let row;
    try {
        row = await db.prepare("SELECT slug, is_system FROM graph_type WHERE slug = ?").bind(slug).first();
    } catch (e) {
        console.error("admin graph-types delete lookup", e);
        return json({ error: "server error" }, 500);
    }
    if (!row) {
        return json({ error: "not found" }, 404);
    }
    if (Number(row.is_system) === 1) {
        return json({ error: "cannot delete system graph type" }, 403);
    }
    let usage;
    try {
        usage = await db
            .prepare(
                `SELECT
                    (SELECT COUNT(*) FROM graph_catalog WHERE graph_type_slug = ? AND deleted_at IS NULL) AS cat_n,
                    (SELECT COUNT(*) FROM user_graphs WHERE graph_type_slug = ? AND deleted_at IS NULL) AS user_n`,
            )
            .bind(slug, slug)
            .first();
    } catch (e) {
        console.error("admin graph-types delete usage", e);
        return json({ error: "server error" }, 500);
    }
    const n = (Number(usage && usage.cat_n) || 0) + (Number(usage && usage.user_n) || 0);
    if (n > 0) {
        return json({ error: "graph type is in use; reassign graphs first", code: "IN_USE" }, 409);
    }
    try {
        await db.prepare("DELETE FROM graph_type WHERE slug = ? AND is_system = 0").bind(slug).run();
    } catch (e) {
        console.error("admin graph-types DELETE", e);
        return json({ error: "server error" }, 500);
    }
    return json({ ok: true });
}
