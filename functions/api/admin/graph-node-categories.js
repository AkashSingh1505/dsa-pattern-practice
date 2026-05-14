import { json } from "../../_lib/admin-api.js";
import { requireGraphCatalogWriter } from "../../_lib/practice-auth-request.js";
import {
    autoColorForSlug,
    listGraphNodeCategories,
    parseAllowedChildSlugsJson,
    slugFromLabel,
} from "../../_lib/graph-node-category.js";

function isHex6(s) {
    return typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s.trim());
}

export async function onRequestGet(context) {
    const { request, env } = context;
    const gate = await requireGraphCatalogWriter(request, env);
    if (!gate.ok) return gate.response;
    const list = await listGraphNodeCategories(gate.db);
    return json({ ok: true, categories: list });
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const gate = await requireGraphCatalogWriter(request, env);
    if (!gate.ok) return gate.response;
    const { db } = gate;
    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: "invalid JSON" }, 400);
    }
    const label = String(body.label || "").trim();
    if (!label) return json({ error: "label required" }, 400);
    const slug = slugFromLabel(body.slug || label);
    if (!slug || slug.length < 2) return json({ error: "invalid slug", code: "INVALID_SLUG" }, 400);
    const allowedRaw = Array.isArray(body.allowedChildSlugs) ? body.allowedChildSlugs : [];
    const allowed = allowedRaw.map((x) => String(x || "").trim().toUpperCase()).filter(Boolean);
    const existing = await listGraphNodeCategories(db);
    const existingSlugs = new Set(existing.map((c) => c.slug));
    for (const ch of allowed) {
        if (ch !== slug && !existingSlugs.has(ch)) {
            return json({ error: 'allowedChildSlugs references unknown slug: "' + ch + '"' }, 400);
        }
    }
    let color = body.color != null ? String(body.color).trim() : "";
    if (!isHex6(color)) color = autoColorForSlug(slug);
    const now = Math.floor(Date.now() / 1000);
    const sortOrder =
        typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
            ? Math.floor(body.sortOrder)
            : existing.length;
    try {
        await db
            .prepare(
                `INSERT INTO graph_node_category (slug, label, color, allowed_child_slugs_json, sort_order, is_system, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
            )
            .bind(slug, label, color, JSON.stringify(allowed), sortOrder, now, now)
            .run();
    } catch (e) {
        const msg = String((e && e.message) || e || "");
        if (msg.toLowerCase().includes("unique")) return json({ error: "slug or label already exists" }, 409);
        console.error("graph-node-categories POST", e);
        return json({ error: "server error" }, 500);
    }
    return json({ ok: true, slug });
}

export async function onRequestPatch(context) {
    const { request, env } = context;
    const gate = await requireGraphCatalogWriter(request, env);
    if (!gate.ok) return gate.response;
    const { db } = gate;
    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: "invalid JSON" }, 400);
    }
    const slug = String(body.slug || "").trim().toUpperCase();
    if (!slug) return json({ error: "slug required" }, 400);
    let row;
    try {
        row = await db.prepare(`SELECT slug FROM graph_node_category WHERE slug = ?`).bind(slug).first();
    } catch (e) {
        console.error("graph-node-categories patch lookup", e);
        return json({ error: "server error" }, 500);
    }
    if (!row) return json({ error: "not found" }, 404);
    const now = Math.floor(Date.now() / 1000);
    const updates = [];
    const binds = [];
    if (typeof body.label === "string" && body.label.trim()) {
        updates.push("label = ?");
        binds.push(body.label.trim());
    }
    if (body.color != null && isHex6(String(body.color))) {
        updates.push("color = ?");
        binds.push(String(body.color).trim());
    }
    if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
        updates.push("sort_order = ?");
        binds.push(Math.floor(body.sortOrder));
    }
    if (Array.isArray(body.allowedChildSlugs)) {
        const allowed = body.allowedChildSlugs.map((x) => String(x || "").trim().toUpperCase()).filter(Boolean);
        const existing = await listGraphNodeCategories(db);
        const existingSlugs = new Set(existing.map((c) => c.slug));
        for (const ch of allowed) {
            if (ch !== slug && !existingSlugs.has(ch)) {
                return json({ error: 'allowedChildSlugs references unknown slug: "' + ch + '"' }, 400);
            }
        }
        updates.push("allowed_child_slugs_json = ?");
        binds.push(JSON.stringify(allowed));
    }
    if (!updates.length) return json({ error: "nothing to update" }, 400);
    updates.push("updated_at = ?");
    binds.push(now);
    binds.push(slug);
    try {
        await db.prepare(`UPDATE graph_node_category SET ${updates.join(", ")} WHERE slug = ?`).bind(...binds).run();
    } catch (e) {
        console.error("graph-node-categories PATCH", e);
        return json({ error: "server error" }, 500);
    }
    return json({ ok: true, updatedAt: now });
}

export async function onRequestDelete(context) {
    const { request, env } = context;
    const gate = await requireGraphCatalogWriter(request, env);
    if (!gate.ok) return gate.response;
    const { db } = gate;
    const url = new URL(request.url);
    const slug = String(url.searchParams.get("slug") || "").trim().toUpperCase();
    if (!slug) return json({ error: "slug required" }, 400);
    let row;
    try {
        row = await db.prepare(`SELECT is_system FROM graph_node_category WHERE slug = ?`).bind(slug).first();
    } catch (e) {
        console.error("graph-node-categories delete", e);
        return json({ error: "server error" }, 500);
    }
    if (!row) return json({ error: "not found" }, 404);
    if (Number(row.is_system) === 1) return json({ error: "cannot delete system category" }, 403);
    try {
        const all = await db.prepare(`SELECT slug, allowed_child_slugs_json FROM graph_node_category`).all();
        for (const r of all.results || []) {
            const arr = parseAllowedChildSlugsJson(r.allowed_child_slugs_json);
            if (arr.includes(slug)) {
                return json({ error: "slug still referenced in allowedChildSlugs of " + r.slug, code: "IN_USE" }, 409);
            }
        }
    } catch {
        /* ignore */
    }
    try {
        await db.prepare(`DELETE FROM graph_node_category WHERE slug = ? AND is_system = 0`).bind(slug).run();
    } catch (e) {
        console.error("graph-node-categories DELETE", e);
        return json({ error: "server error" }, 500);
    }
    return json({ ok: true });
}
