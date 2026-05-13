import { json } from "../../_lib/admin-api.js";
import { verifyPracticeToken } from "../../_lib/practice-jwt.js";
import { newGraphId, requireGraphCatalogWriter } from "../../_lib/practice-auth-request.js";
import { normalizeGraphCategoriesBody } from "../../_lib/graph-catalog-categories.js";
import {
    getResolvedCatalogCategories,
    replaceCatalogCategoriesForCatalog,
    validateMindMapGraphInvariant,
} from "../../_lib/graph-catalog-category-rows.js";

function slugify(s) {
    return String(s || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 64) || "graph";
}

async function uniqueSlug(db, base) {
    let slug = base;
    let n = 0;
    while (n < 50) {
        const row = await db.prepare("SELECT id FROM graph_catalog WHERE slug = ? AND deleted_at IS NULL").bind(slug).first();
        if (!row) {
            return slug;
        }
        n += 1;
        slug = `${base}-${n}`;
    }
    return `${base}-${newGraphId().slice(0, 8)}`;
}

function parseTagsJson(s) {
    if (!s || typeof s !== "string") {
        return [];
    }
    try {
        const x = JSON.parse(s);
        return Array.isArray(x) ? x.map((t) => String(t)) : [];
    } catch {
        return [];
    }
}

export async function onRequestGet(context) {
    const { request, env } = context;
    const gate = await requireGraphCatalogWriter(request, env);
    if (!gate.ok) {
        return gate.response;
    }
    const { db } = gate;
    const url = new URL(request.url);
    const oneId = String(url.searchParams.get("id") || "").trim();

    if (oneId) {
        let row;
        try {
            row = await db
                .prepare(
                    `SELECT c.id, c.slug, c.title, c.description, c.visibility, c.creator_user_id, c.payload_json, c.accent_hue, c.tags_json, c.categories_json, c.difficulty,
                            c.estimated_minutes, c.download_count, c.created_at, c.updated_at,
                            pu.email AS creator_email
                     FROM graph_catalog c
                     LEFT JOIN practice_users pu ON pu.id = c.creator_user_id
                     WHERE c.id = ? AND c.deleted_at IS NULL`,
                )
                .bind(oneId)
                .first();
        } catch (e) {
            console.error("admin graph-catalog get one", e);
            return json({ error: "server error" }, 500);
        }
        if (!row) {
            return json({ error: "not found" }, 404);
        }
        let payload;
        try {
            payload = JSON.parse(row.payload_json);
        } catch {
            return json({ error: "invalid payload in database" }, 500);
        }
        if (!Array.isArray(payload)) {
            return json({ error: "invalid payload in database" }, 500);
        }
        const nowSec = Math.floor(Date.now() / 1000);
        let categories;
        try {
            categories = await getResolvedCatalogCategories(db, row.id, row.categories_json, nowSec, { migrateLegacy: true });
        } catch (e) {
            console.error("admin graph-catalog categories", e);
            return json({ error: "server error" }, 500);
        }
        return json({
            ok: true,
            graph: {
                id: row.id,
                slug: row.slug,
                title: row.title,
                description: row.description || "",
                visibility: row.visibility,
                creatorUserId: row.creator_user_id,
                creatorEmail: row.creator_email || null,
                accentHue: row.accent_hue,
                tags: parseTagsJson(row.tags_json),
                categories,
                difficulty: row.difficulty || null,
                estimatedMinutes: row.estimated_minutes,
                downloadCount: row.download_count || 0,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                payload,
            },
        });
    }

    let rows;
    try {
        rows = await db
            .prepare(
                `SELECT c.id, c.slug, c.title, c.description, c.visibility, c.accent_hue, c.tags_json, c.categories_json, c.difficulty,
                        c.estimated_minutes, c.download_count, c.created_at, c.updated_at, c.deleted_at,
                        pu.email AS creator_email
                 FROM graph_catalog c
                 LEFT JOIN practice_users pu ON pu.id = c.creator_user_id
                 WHERE c.deleted_at IS NULL
                 ORDER BY c.updated_at DESC`,
            )
            .all();
    } catch (e) {
        console.error("admin graph-catalog list", e);
        return json({ error: "server error" }, 500);
    }
    return json({ ok: true, graphs: rows.results || [] });
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
    const title = String(body.title || "").trim();
    if (!title) {
        return json({ error: "title required" }, 400);
    }
    const payload = body.payload;
    if (!Array.isArray(payload)) {
        return json({ error: "payload must be array (mind map roots)" }, 400);
    }
    let payloadJson;
    try {
        payloadJson = JSON.stringify(payload);
    } catch {
        return json({ error: "payload not serializable" }, 400);
    }
    const visibility = ["public", "unlisted", "private"].includes(String(body.visibility))
        ? String(body.visibility)
        : "public";
    const description = String(body.description || "").trim();
    const tags = Array.isArray(body.tags) ? JSON.stringify(body.tags.map((x) => String(x))) : null;
    const difficulty = body.difficulty != null ? String(body.difficulty).slice(0, 32) : null;
    const estimatedMinutes =
        typeof body.estimatedMinutes === "number" && Number.isFinite(body.estimatedMinutes)
            ? Math.max(0, Math.floor(body.estimatedMinutes))
            : null;
    const accentHue =
        typeof body.accentHue === "number" && Number.isFinite(body.accentHue)
            ? Math.floor(body.accentHue) % 360
            : null;
    const catNorm = normalizeGraphCategoriesBody(body.categories == null ? [] : body.categories);
    if (!catNorm.ok) {
        return json({ error: catNorm.error }, 400);
    }
    if (!catNorm.categories.length) {
        return json({ error: "at least one category is required", code: "GRAPH_CATEGORIES_REQUIRED" }, 400);
    }
    const invPost = validateMindMapGraphInvariant(payload, catNorm.categories);
    if (!invPost.ok) {
        return json({ error: invPost.error, code: invPost.code || "GRAPH_INVALID" }, 400);
    }
    const slugIn = String(body.slug || "").trim();
    const base = slugify(slugIn || title);

    const { db } = gate;
    const slug = await uniqueSlug(db, base);
    const id = newGraphId();
    const now = Math.floor(Date.now() / 1000);

    let creatorUserId = null;
    if (gate.via === "practice_admin") {
        const auth = request.headers.get("Authorization") || "";
        const m = auth.match(/^Bearer\s+(.+)$/i);
        if (m && env.USER_JWT_SECRET) {
            const p = await verifyPracticeToken(m[1].trim(), env.USER_JWT_SECRET);
            if (p && p.sub) {
                const u = await db
                    .prepare("SELECT id FROM practice_users WHERE email = ?")
                    .bind(String(p.sub).toLowerCase())
                    .first();
                if (u) {
                    creatorUserId = u.id;
                }
            }
        }
    }

    try {
        await db
            .prepare(
                `INSERT INTO graph_catalog (id, slug, title, description, visibility, creator_user_id, payload_json, accent_hue, tags_json, categories_json, difficulty, estimated_minutes, download_count, created_at, updated_at, deleted_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL)`,
            )
            .bind(
                id,
                slug,
                title,
                description || null,
                visibility,
                creatorUserId,
                payloadJson,
                accentHue,
                tags,
                null,
                difficulty,
                estimatedMinutes,
                now,
                now,
            )
            .run();
    } catch (e) {
        console.error("admin graph-catalog insert", e);
        return json({ error: "server error" }, 500);
    }
    try {
        await replaceCatalogCategoriesForCatalog(db, id, catNorm.categories, now);
    } catch (e) {
        console.error("admin graph-catalog insert categories", e);
        return json({ error: "server error" }, 500);
    }
    return json({ ok: true, id, slug });
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
    const id = String(body.id || "").trim();
    if (!id) {
        return json({ error: "id required" }, 400);
    }
    const { db } = gate;
    const fullRow = await db
        .prepare(`SELECT id, payload_json, categories_json FROM graph_catalog WHERE id = ? AND deleted_at IS NULL`)
        .bind(id)
        .first();
    if (!fullRow) {
        return json({ error: "not found" }, 404);
    }
    const now = Math.floor(Date.now() / 1000);

    let payloadForCatValidation = null;
    if (body.payload != null) {
        if (!Array.isArray(body.payload)) {
            return json({ error: "payload must be array" }, 400);
        }
        payloadForCatValidation = body.payload;
    } else if (body.categories !== undefined) {
        let parsed;
        try {
            parsed = JSON.parse(fullRow.payload_json);
        } catch {
            return json({ error: "invalid stored payload" }, 500);
        }
        if (!Array.isArray(parsed)) {
            return json({ error: "invalid stored payload" }, 500);
        }
        payloadForCatValidation = parsed;
    }

    let didCategoryReplace = false;
    if (body.categories !== undefined) {
        const catNorm = normalizeGraphCategoriesBody(body.categories);
        if (!catNorm.ok) {
            return json({ error: catNorm.error }, 400);
        }
        if (!catNorm.categories.length) {
            return json({ error: "at least one category is required", code: "GRAPH_CATEGORIES_REQUIRED" }, 400);
        }
        if (payloadForCatValidation != null) {
            const invPatchCats = validateMindMapGraphInvariant(payloadForCatValidation, catNorm.categories);
            if (!invPatchCats.ok) {
                return json({ error: invPatchCats.error, code: invPatchCats.code || "GRAPH_INVALID" }, 400);
            }
        }
        try {
            await replaceCatalogCategoriesForCatalog(db, id, catNorm.categories, now);
        } catch (e) {
            console.error("admin graph-catalog patch categories", e);
            return json({ error: "server error" }, 500);
        }
        didCategoryReplace = true;
    }

    if (body.payload != null && body.categories === undefined) {
        let cats;
        try {
            cats = await getResolvedCatalogCategories(db, id, fullRow.categories_json, now, { migrateLegacy: true });
        } catch (e) {
            console.error("admin graph-catalog patch load categories", e);
            return json({ error: "server error" }, 500);
        }
        const invPatchPayload = validateMindMapGraphInvariant(body.payload, cats);
        if (!invPatchPayload.ok) {
            return json({ error: invPatchPayload.error, code: invPatchPayload.code || "GRAPH_INVALID" }, 400);
        }
    }

    const updates = [];
    const binds = [];
    if (typeof body.title === "string" && body.title.trim()) {
        updates.push("title = ?");
        binds.push(body.title.trim());
    }
    if (typeof body.description === "string") {
        updates.push("description = ?");
        binds.push(body.description.trim());
    }
    if (["public", "unlisted", "private"].includes(String(body.visibility))) {
        updates.push("visibility = ?");
        binds.push(String(body.visibility));
    }
    if (body.payload != null) {
        try {
            updates.push("payload_json = ?");
            binds.push(JSON.stringify(body.payload));
        } catch {
            return json({ error: "invalid payload" }, 400);
        }
    }
    if (Array.isArray(body.tags)) {
        updates.push("tags_json = ?");
        binds.push(JSON.stringify(body.tags.map((x) => String(x))));
    }
    if (body.difficulty != null) {
        updates.push("difficulty = ?");
        binds.push(String(body.difficulty).slice(0, 32));
    }
    if (typeof body.estimatedMinutes === "number" && Number.isFinite(body.estimatedMinutes)) {
        updates.push("estimated_minutes = ?");
        binds.push(Math.max(0, Math.floor(body.estimatedMinutes)));
    }
    if (typeof body.accentHue === "number" && Number.isFinite(body.accentHue)) {
        updates.push("accent_hue = ?");
        binds.push(Math.floor(body.accentHue) % 360);
    }
    if (!updates.length && !didCategoryReplace) {
        return json({ error: "nothing to update" }, 400);
    }
    updates.push("updated_at = ?");
    binds.push(now);
    binds.push(id);
    try {
        await db.prepare(`UPDATE graph_catalog SET ${updates.join(", ")} WHERE id = ?`).bind(...binds).run();
    } catch (e) {
        console.error("admin graph-catalog patch", e);
        return json({ error: "server error" }, 500);
    }
    return json({ ok: true, updatedAt: now });
}

export async function onRequestDelete(context) {
    const { request, env } = context;
    const gate = await requireGraphCatalogWriter(request, env);
    if (!gate.ok) {
        return gate.response;
    }
    const url = new URL(request.url);
    const id = String(url.searchParams.get("id") || "").trim();
    if (!id) {
        return json({ error: "id required" }, 400);
    }
    const hard = String(url.searchParams.get("hard") || "") === "1" || String(url.searchParams.get("permanent") || "") === "1";
    const { db } = gate;
    const now = Math.floor(Date.now() / 1000);
    try {
        if (hard) {
            const res = await db.prepare(`DELETE FROM graph_catalog WHERE id = ?`).bind(id).run();
            if (!res.meta || res.meta.changes === 0) {
                return json({ error: "not found" }, 404);
            }
        } else {
            const res = await db
                .prepare(`UPDATE graph_catalog SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`)
                .bind(now, now, id)
                .run();
            if (!res.meta || res.meta.changes === 0) {
                return json({ error: "not found" }, 404);
            }
        }
    } catch (e) {
        console.error("admin graph-catalog delete", e);
        return json({ error: "server error" }, 500);
    }
    return json({ ok: true, hard });
}
