import { json } from "../../_lib/admin-api.js";
import { newGraphId, requirePracticeUser } from "../../_lib/practice-auth-request.js";
import { ensureUserGraphVisibilityColumn } from "../../_lib/user-graph-visibility.js";
import { normalizeGraphCategoriesBody, parseGraphCategoriesJson } from "../../_lib/graph-catalog-categories.js";
import { listCatalogCategoriesForCatalog, remapGraphCategoryIdsInPayload, validateMindMapGraphInvariant } from "../../_lib/graph-catalog-category-rows.js";
import { ensureUserGraphCategoriesJsonColumn, stringifyUserGraphCategories } from "../../_lib/user-graph-categories-json.js";

export async function onRequestPost(context) {
    const { request, env } = context;
    const gate = await requirePracticeUser(request, env);
    if (!gate.ok) {
        return gate.response;
    }
    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: "invalid JSON" }, 400);
    }
    const catalogId = String(body.catalogId || "").trim();
    if (!catalogId) {
        return json({ error: "catalogId required" }, 400);
    }
    const { db, userId } = gate;
    await ensureUserGraphCategoriesJsonColumn(db);
    const hasVisibility = await ensureUserGraphVisibilityColumn(db);
    let cat;
    try {
        cat = await db
            .prepare(
                `SELECT id, title, description, payload_json, accent_hue, visibility, categories_json FROM graph_catalog
                 WHERE id = ? AND deleted_at IS NULL`,
            )
            .bind(catalogId)
            .first();
    } catch (e) {
        console.error("download fetch catalog", e);
        return json({ error: "server error" }, 500);
    }
    if (!cat || String(cat.visibility || "") !== "public") {
        return json({ error: "not found" }, 404);
    }
    let parsedPayload;
    try {
        parsedPayload = JSON.parse(cat.payload_json);
        if (!Array.isArray(parsedPayload)) {
            return json({ error: "invalid source graph" }, 500);
        }
    } catch {
        return json({ error: "invalid source graph" }, 500);
    }
    const idMap = new Map();
    let catRows = [];
    try {
        catRows = await listCatalogCategoriesForCatalog(db, catalogId);
    } catch {
        catRows = [];
    }
    if (!catRows.length && cat.categories_json) {
        const parsed = parseGraphCategoriesJson(cat.categories_json);
        const n = normalizeGraphCategoriesBody(parsed);
        if (n.ok) {
            catRows = n.categories;
        }
    }
    if (!catRows.length) {
        return json({ error: "source graph has no categories declared", code: "GRAPH_CATEGORIES_REQUIRED" }, 422);
    }
    const invSrc = validateMindMapGraphInvariant(parsedPayload, catRows);
    if (!invSrc.ok) {
        return json({ error: invSrc.error, code: invSrc.code || "GRAPH_INVALID" }, 422);
    }
    for (const c of catRows) {
        idMap.set(c.id, newGraphId());
    }
    remapGraphCategoryIdsInPayload(parsedPayload, idMap);
    const payloadStr = JSON.stringify(parsedPayload);
    const newCatRows = catRows
        .map((c) => {
            const nid = idMap.get(c.id);
            if (!nid) {
                return null;
            }
            return { id: nid, name: c.name, color: c.color || "#6b7280" };
        })
        .filter(Boolean);
    const categoriesJson = stringifyUserGraphCategories(newCatRows);
    const now = Math.floor(Date.now() / 1000);
    const copyId = newGraphId();
    const title = String(cat.title || "Downloaded graph");
    const desc = cat.description ? String(cat.description) : "";
    const accent = cat.accent_hue != null ? cat.accent_hue : null;

    let firstDownloadByThisUser = true;
    try {
        const prev = await db
            .prepare(`SELECT 1 AS x FROM graph_catalog_downloads WHERE catalog_id = ? AND user_id = ?`)
            .bind(catalogId, userId)
            .first();
        firstDownloadByThisUser = !prev;
    } catch {
        /* treat as first */
    }

    try {
        const stmts = [
            hasVisibility
                ? db
                      .prepare(
                          `INSERT INTO user_graphs (id, owner_user_id, source_catalog_id, kind, title, description, payload_json, accent_hue, categories_json, visibility, shared_from_user_id, created_at, updated_at, deleted_at)
                           VALUES (?, ?, ?, 'downloaded', ?, ?, ?, ?, ?, 'private', NULL, ?, ?, NULL)`,
                      )
                      .bind(copyId, userId, catalogId, title, desc, payloadStr, accent, categoriesJson, now, now)
                : db
                      .prepare(
                          `INSERT INTO user_graphs (id, owner_user_id, source_catalog_id, kind, title, description, payload_json, accent_hue, categories_json, shared_from_user_id, created_at, updated_at, deleted_at)
                           VALUES (?, ?, ?, 'downloaded', ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
                      )
                      .bind(copyId, userId, catalogId, title, desc, payloadStr, accent, categoriesJson, now, now),
            db
                .prepare(
                    `INSERT INTO graph_catalog_downloads (catalog_id, user_id, downloaded_at) VALUES (?, ?, ?)
                     ON CONFLICT(catalog_id, user_id) DO UPDATE SET downloaded_at = excluded.downloaded_at`,
                )
                .bind(catalogId, userId, now),
            db.prepare(`UPDATE graph_catalog SET download_count = download_count + 1 WHERE id = ?`).bind(catalogId),
        ];
        await db.batch(stmts);
    } catch (e) {
        console.error("download batch", e);
        return json({ error: "server error" }, 500);
    }

    let uniqueDownloaders = 0;
    try {
        const c = await db
            .prepare(`SELECT COUNT(*) AS n FROM graph_catalog_downloads WHERE catalog_id = ?`)
            .bind(catalogId)
            .first();
        uniqueDownloaders = c && typeof c.n === "number" ? c.n : 0;
    } catch {
        /* ignore */
    }

    return json({
        ok: true,
        copy: {
            id: copyId,
            title,
            description: desc,
            kind: "downloaded",
            sourceCatalogId: catalogId,
            createdAt: now,
            updatedAt: now,
            accentHue: accent,
            visibility: "private",
        },
        stats: {
            firstDownloadByThisUser,
            uniqueDownloaders,
        },
    });
}
