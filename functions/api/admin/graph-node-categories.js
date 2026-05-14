import { json } from "../../_lib/admin-api.js";
import { requireGraphCatalogWriter } from "../../_lib/practice-auth-request.js";
import {
    autoColorForSlug,
    listGraphNodeCategories,
    parseAllowedChildSlugsJson,
    slugFromLabel,
    validateAllGraphEdgesNoCycle,
    validateNodeCategoriesAllHaveParent,
    validateNodeCategoriesAllHaveParentExcept,
} from "../../_lib/graph-node-category.js";

function isHex6(s) {
    return typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s.trim());
}

function slugU(s) {
    return String(s || "")
        .toUpperCase()
        .trim();
}

function normSlugList(arr) {
    if (!Array.isArray(arr)) {
        return null;
    }
    return arr.map((x) => slugU(x)).filter(Boolean);
}

/** @param {Awaited<ReturnType<listGraphNodeCategories>>} existingList */
function cloneGraphRows(existingList) {
    return existingList.map((c) => ({
        slug: slugU(c.slug),
        allowedChildSlugs: normSlugList(c.allowedChildSlugs) || [],
    }));
}

/**
 * @param {{ slug: string, allowedChildSlugs: string[] }[]} rows
 * @param {string} targetSlug
 * @param {{ allowedChildSlugs?: string[] | null, allowedParentSlugs?: string[] | null }} edits
 */
function mergeGraphEdits(rows, targetSlug, edits) {
    const tu = slugU(targetSlug);
    const idx = rows.findIndex((r) => r.slug === tu);
    if (idx < 0) {
        return null;
    }
    const out = rows.map((r) => ({ slug: r.slug, allowedChildSlugs: [...r.allowedChildSlugs] }));
    if (edits.allowedChildSlugs != null) {
        out[idx].allowedChildSlugs = normSlugList(edits.allowedChildSlugs) || [];
    }
    if (edits.allowedParentSlugs != null) {
        const parentSet = new Set(normSlugList(edits.allowedParentSlugs) || []);
        parentSet.delete(tu);
        for (let i = 0; i < out.length; i++) {
            if (i === idx) {
                continue;
            }
            const r = out[i];
            let kids = r.allowedChildSlugs.filter((k) => k !== tu);
            if (parentSet.has(r.slug)) {
                kids.push(tu);
            }
            out[i].allowedChildSlugs = [...new Set(kids)];
        }
    }
    return out;
}

/** @param {Awaited<ReturnType<listGraphNodeCategories>>} existingList */
function mergeGraphWithNewRow(existingList, newSlug, childSlugs, parentSlugs) {
    const su = slugU(newSlug);
    const rows = cloneGraphRows(existingList);
    rows.push({ slug: su, allowedChildSlugs: normSlugList(childSlugs) || [] });
    const parentSet = new Set(normSlugList(parentSlugs) || []);
    parentSet.delete(su);
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r.slug === su) {
            continue;
        }
        let kids = [...r.allowedChildSlugs];
        if (parentSet.has(r.slug)) {
            kids.push(su);
            kids = [...new Set(kids)];
        }
        rows[i] = { slug: r.slug, allowedChildSlugs: kids };
    }
    return rows;
}

function assertAllChildSlugsKnown(nextRows) {
    const all = new Set((nextRows || []).map((r) => r.slug));
    for (const r of nextRows || []) {
        for (const ch of r.allowedChildSlugs || []) {
            if (!all.has(ch)) {
                return { ok: false, error: 'allowedChildSlugs references unknown slug: "' + ch + '"' };
            }
        }
    }
    return { ok: true };
}

function sortedJsonForKids(kids) {
    return JSON.stringify([...(kids || [])].map(slugU).sort());
}

const NODE_CATEGORY_DESCRIPTION_MAX_LEN = 2000;

function normDescription(body) {
    if (body == null || typeof body.description !== "string") {
        return null;
    }
    return body.description.trim().slice(0, NODE_CATEGORY_DESCRIPTION_MAX_LEN);
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
    const parentsRaw = Array.isArray(body.allowedParentSlugs) ? body.allowedParentSlugs : [];
    const parentsList = parentsRaw.map((x) => String(x || "").trim().toUpperCase()).filter(Boolean);
    const existing = await listGraphNodeCategories(db);
    const existingSlugs = new Set(existing.map((c) => c.slug));
    if (existingSlugs.has(slug)) {
        return json({ error: "slug already exists" }, 409);
    }
    if (parentsList.length === 0) {
        return json({ error: "allowedParentSlugs: pick at least one parent type (ROOT is usually included).", code: "PARENT_REQUIRED" }, 400);
    }
    for (const p of parentsList) {
        if (!existingSlugs.has(p)) {
            return json({ error: 'allowedParentSlugs references unknown slug: "' + p + '"' }, 400);
        }
    }
    for (const ch of allowed) {
        if (ch !== slug && !existingSlugs.has(ch)) {
            return json({ error: 'allowedChildSlugs references unknown slug: "' + ch + '"' }, 400);
        }
    }
    const nextRows = mergeGraphWithNewRow(existing, slug, allowed, parentsList);
    const uk = assertAllChildSlugsKnown(nextRows);
    if (!uk.ok) {
        return json({ error: uk.error }, 400);
    }
    const vCycle = validateAllGraphEdgesNoCycle(nextRows);
    if (!vCycle.ok) {
        return json({ error: vCycle.error, code: vCycle.code }, 400);
    }
    const vPar = validateNodeCategoriesAllHaveParentExcept(nextRows, [slug]);
    if (!vPar.ok) {
        return json({ error: vPar.error, code: vPar.code }, 400);
    }
    let color = body.color != null ? String(body.color).trim() : "";
    if (!isHex6(color)) color = autoColorForSlug(slug);
    const description = normDescription(body) ?? "";
    const now = Math.floor(Date.now() / 1000);
    const sortOrder =
        typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
            ? Math.floor(body.sortOrder)
            : existing.length;
    const beforeKids = new Map(existing.map((c) => [slugU(c.slug), sortedJsonForKids(c.allowedChildSlugs)]));
    try {
        await db
            .prepare(
                `INSERT INTO graph_node_category (slug, label, description, color, allowed_child_slugs_json, sort_order, is_system, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
            )
            .bind(slug, label, description, color, JSON.stringify(allowed), sortOrder, now, now)
            .run();
        for (const r of nextRows) {
            if (r.slug === slug) {
                continue;
            }
            const prev = beforeKids.get(r.slug);
            const next = sortedJsonForKids(r.allowedChildSlugs);
            if (prev === next) {
                continue;
            }
            await db
                .prepare(`UPDATE graph_node_category SET allowed_child_slugs_json = ?, updated_at = ? WHERE slug = ?`)
                .bind(JSON.stringify(r.allowedChildSlugs), now, r.slug)
                .run();
        }
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
    const existingList = await listGraphNodeCategories(db);
    const rec = existingList.find((c) => slugU(c.slug) === slug);
    if (!rec) return json({ error: "not found" }, 404);
    const isSystem = !!rec.isSystem;
    const hasChild = Array.isArray(body.allowedChildSlugs);
    const hasParent = Array.isArray(body.allowedParentSlugs);
    if (isSystem && (hasChild || hasParent)) {
        return json({ error: "cannot change mapping for system category" }, 403);
    }

    const now = Math.floor(Date.now() / 1000);
    let nextRows = null;
    if (!isSystem && (hasChild || hasParent)) {
        const rows = cloneGraphRows(existingList);
        nextRows = mergeGraphEdits(rows, slug, {
            allowedChildSlugs: hasChild ? body.allowedChildSlugs : null,
            allowedParentSlugs: hasParent ? body.allowedParentSlugs : null,
        });
        if (!nextRows) {
            return json({ error: "not found" }, 404);
        }
        if (hasParent) {
            const plist = normSlugList(body.allowedParentSlugs) || [];
            for (const p of plist) {
                if (!nextRows.some((r) => r.slug === p)) {
                    return json({ error: 'allowedParentSlugs references unknown slug: "' + p + '"' }, 400);
                }
            }
        }
        const uk = assertAllChildSlugsKnown(nextRows);
        if (!uk.ok) {
            return json({ error: uk.error }, 400);
        }
        const vCycle = validateAllGraphEdgesNoCycle(nextRows);
        if (!vCycle.ok) {
            return json({ error: vCycle.error, code: vCycle.code }, 400);
        }
        const vPar = validateNodeCategoriesAllHaveParent(nextRows);
        if (!vPar.ok) {
            return json({ error: vPar.error, code: vPar.code }, 400);
        }
    }

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
    const descPatch = normDescription(body);
    if (descPatch !== null) {
        updates.push("description = ?");
        binds.push(descPatch);
    }

    if (nextRows) {
        const beforeKids = new Map(existingList.map((c) => [slugU(c.slug), sortedJsonForKids(c.allowedChildSlugs)]));
        try {
            for (const r of nextRows) {
                const prev = beforeKids.get(r.slug);
                const next = sortedJsonForKids(r.allowedChildSlugs);
                if (prev === next) {
                    continue;
                }
                await db
                    .prepare(`UPDATE graph_node_category SET allowed_child_slugs_json = ?, updated_at = ? WHERE slug = ?`)
                    .bind(JSON.stringify(r.allowedChildSlugs), now, r.slug)
                    .run();
            }
        } catch (e) {
            console.error("graph-node-categories PATCH graph", e);
            return json({ error: "server error" }, 500);
        }
    }

    if (updates.length) {
        updates.push("updated_at = ?");
        binds.push(now);
        binds.push(slug);
        try {
            await db.prepare(`UPDATE graph_node_category SET ${updates.join(", ")} WHERE slug = ?`).bind(...binds).run();
        } catch (e) {
            console.error("graph-node-categories PATCH", e);
            return json({ error: "server error" }, 500);
        }
    } else if (!nextRows) {
        return json({ error: "nothing to update" }, 400);
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
