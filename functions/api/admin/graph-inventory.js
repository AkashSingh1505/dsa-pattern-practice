import { json, requireAdmin } from "../../_lib/admin-api.js";
import { getResolvedCatalogCategories } from "../../_lib/graph-catalog-category-rows.js";

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

/** @param {string|undefined} s @returns {number|null} */
function parseDateParam(s) {
    if (!s || typeof s !== "string") {
        return null;
    }
    const t = s.trim();
    if (!t) {
        return null;
    }
    if (/^\d+$/.test(t)) {
        const n = parseInt(t, 10);
        return Number.isFinite(n) ? n : null;
    }
    const d = Date.parse(t + (t.length <= 10 ? "T00:00:00Z" : ""));
    if (Number.isNaN(d)) {
        return null;
    }
    return Math.floor(d / 1000);
}

/**
 * Unified list for admin: catalog rows + all user personal graphs (read-only in UI for user copies).
 */
export async function onRequestGet(context) {
    const { request, env } = context;
    const gate = await requireAdmin(request);
    if (!gate.ok) {
        return gate.response;
    }

    const { subscribersDb } = await import("../../_lib/d1-bindings.js");
    const db = subscribersDb(context.env);
    if (!db) {
        return json({ error: "Subscribers D1 not bound" }, 503);
    }

    const url = new URL(request.url);
    const id = String(url.searchParams.get("id") || "").trim();
    const recordType = String(url.searchParams.get("recordType") || url.searchParams.get("type") || "").toLowerCase();

    if (id && (recordType === "catalog" || recordType === "c")) {
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
                .bind(id)
                .first();
        } catch (e) {
            console.error("graph-inventory catalog one", e);
            return json({ error: "server error" }, 500);
        }
        if (!row) {
            return json({ error: "not found" }, 404);
        }
        let payload;
        try {
            payload = JSON.parse(row.payload_json);
        } catch {
            return json({ error: "invalid payload" }, 500);
        }
        if (!Array.isArray(payload)) {
            return json({ error: "invalid payload" }, 500);
        }
        const nowSec = Math.floor(Date.now() / 1000);
        let categories;
        try {
            categories = await getResolvedCatalogCategories(db, row.id, row.categories_json, nowSec, { migrateLegacy: true });
        } catch (e) {
            console.error("graph-inventory catalog categories", e);
            return json({ error: "server error" }, 500);
        }
        return json({
            ok: true,
            recordType: "catalog",
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

    if (id && (recordType === "user" || recordType === "user_graph" || recordType === "u")) {
        let row;
        try {
            row = await db
                .prepare(
                    `SELECT g.id, g.owner_user_id, g.source_catalog_id, g.kind, g.title, g.description, g.payload_json, g.accent_hue,
                            g.created_at, g.updated_at, pu.email AS owner_email
                     FROM user_graphs g
                     JOIN practice_users pu ON pu.id = g.owner_user_id
                     WHERE g.id = ? AND g.deleted_at IS NULL`,
                )
                .bind(id)
                .first();
        } catch (e) {
            console.error("graph-inventory user one", e);
            return json({ error: "server error" }, 500);
        }
        if (!row) {
            return json({ error: "not found" }, 404);
        }
        let payload;
        try {
            payload = JSON.parse(row.payload_json);
        } catch {
            return json({ error: "invalid payload" }, 500);
        }
        if (!Array.isArray(payload)) {
            return json({ error: "invalid payload" }, 500);
        }
        return json({
            ok: true,
            recordType: "user_graph",
            graph: {
                id: row.id,
                ownerUserId: row.owner_user_id,
                ownerEmail: row.owner_email || "",
                sourceCatalogId: row.source_catalog_id,
                kind: row.kind,
                title: row.title,
                description: row.description || "",
                accentHue: row.accent_hue,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                payload,
                locked: true,
            },
        });
    }

    const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
    const scope = String(url.searchParams.get("scope") || "all").toLowerCase();
    const visibilityFilter = String(url.searchParams.get("visibility") || "all").toLowerCase();
    const userKind = String(url.searchParams.get("userKind") || "all").toLowerCase();
    const dateField = String(url.searchParams.get("dateField") || "updated").toLowerCase() === "created" ? "created" : "updated";
    const dateFrom = parseDateParam(url.searchParams.get("dateFrom"));
    const dateTo = parseDateParam(url.searchParams.get("dateTo"));
    const sort = String(url.searchParams.get("sort") || "updated_desc").toLowerCase();
    let limit = parseInt(String(url.searchParams.get("limit") || "200"), 10);
    if (!Number.isFinite(limit) || limit < 1) {
        limit = 200;
    }
    limit = Math.min(500, limit);

    const items = [];

    const catCols = `c.id, c.slug, c.title, c.description, c.visibility, c.download_count, c.created_at, c.updated_at, pu.email AS creator_email`;

    function catalogOrderSql() {
        if (sort === "updated_asc") {
            return "c.updated_at ASC";
        }
        if (sort === "title_asc") {
            return "c.title COLLATE NOCASE ASC";
        }
        if (sort === "title_desc") {
            return "c.title COLLATE NOCASE DESC";
        }
        if (sort === "downloads_desc") {
            return "c.download_count DESC, c.updated_at DESC";
        }
        if (sort === "created_desc") {
            return "c.created_at DESC";
        }
        if (sort === "created_asc") {
            return "c.created_at ASC";
        }
        return "c.updated_at DESC";
    }

    function userOrderSql() {
        if (sort === "updated_asc") {
            return "g.updated_at ASC";
        }
        if (sort === "title_asc") {
            return "g.title COLLATE NOCASE ASC";
        }
        if (sort === "title_desc") {
            return "g.title COLLATE NOCASE DESC";
        }
        if (sort === "created_desc") {
            return "g.created_at DESC";
        }
        if (sort === "created_asc") {
            return "g.created_at ASC";
        }
        return "g.updated_at DESC";
    }

    const fetchCap = scope === "all" ? Math.min(500, Math.max(limit, 250)) : limit;

    if (scope === "all" || scope === "catalog") {
        const binds = [];
        let where = "c.deleted_at IS NULL";
        if (visibilityFilter !== "all" && ["public", "unlisted", "private"].includes(visibilityFilter)) {
            where += " AND c.visibility = ?";
            binds.push(visibilityFilter);
        }
        if (q) {
            where += " AND (LOWER(c.title) LIKE ? OR LOWER(c.slug) LIKE ? OR LOWER(COALESCE(c.description,'')) LIKE ?)";
            const like = "%" + q + "%";
            binds.push(like, like, like);
        }
        const col = dateField === "created" ? "c.created_at" : "c.updated_at";
        if (dateFrom != null) {
            where += " AND " + col + " >= ?";
            binds.push(dateFrom);
        }
        if (dateTo != null) {
            where += " AND " + col + " <= ?";
            binds.push(dateTo);
        }
        const orderBy = catalogOrderSql();
        const sql = `SELECT ${catCols} FROM graph_catalog c LEFT JOIN practice_users pu ON pu.id = c.creator_user_id WHERE ${where} ORDER BY ${orderBy} LIMIT ?`;
        binds.push(fetchCap);

        try {
            const rows = await db
                .prepare(sql)
                .bind(...binds)
                .all();
            for (const r of rows.results || []) {
                items.push({
                    recordType: "catalog",
                    id: r.id,
                    slug: r.slug,
                    title: r.title,
                    description: r.description || "",
                    visibility: r.visibility,
                    downloadCount: r.download_count || 0,
                    createdAt: r.created_at,
                    updatedAt: r.updated_at,
                    creatorEmail: r.creator_email || null,
                    locked: false,
                });
            }
        } catch (e) {
            console.error("graph-inventory catalog list", e);
            return json({ error: "server error" }, 500);
        }
    }

    if (scope === "all" || scope === "user") {
        const binds = [];
        let where = "g.deleted_at IS NULL";
        if (userKind !== "all" && ["created", "downloaded", "shared"].includes(userKind)) {
            where += " AND g.kind = ?";
            binds.push(userKind);
        }
        if (q) {
            where += " AND (LOWER(g.title) LIKE ? OR LOWER(COALESCE(pu.email,'')) LIKE ? OR LOWER(COALESCE(g.description,'')) LIKE ?)";
            const like = "%" + q + "%";
            binds.push(like, like, like);
        }
        const col = dateField === "created" ? "g.created_at" : "g.updated_at";
        if (dateFrom != null) {
            where += " AND " + col + " >= ?";
            binds.push(dateFrom);
        }
        if (dateTo != null) {
            where += " AND " + col + " <= ?";
            binds.push(dateTo);
        }
        const orderBy = userOrderSql();
        const sql = `SELECT g.id, g.title, g.description, g.kind, g.source_catalog_id, g.created_at, g.updated_at, pu.email AS owner_email, g.owner_user_id
             FROM user_graphs g
             JOIN practice_users pu ON pu.id = g.owner_user_id
             WHERE ${where}
             ORDER BY ${orderBy}
             LIMIT ?`;
        binds.push(fetchCap);

        try {
            const rows = await db
                .prepare(sql)
                .bind(...binds)
                .all();
            for (const r of rows.results || []) {
                items.push({
                    recordType: "user_graph",
                    id: r.id,
                    title: r.title,
                    description: r.description || "",
                    kind: r.kind,
                    ownerEmail: r.owner_email || "",
                    ownerUserId: r.owner_user_id,
                    sourceCatalogId: r.source_catalog_id,
                    createdAt: r.created_at,
                    updatedAt: r.updated_at,
                    locked: true,
                });
            }
        } catch (e) {
            console.error("graph-inventory user list", e);
            return json({ error: "server error" }, 500);
        }
    }

    function sortMerged() {
        const dir = sort.endsWith("_asc") ? 1 : -1;
        const key =
            sort === "title_asc" || sort === "title_desc"
                ? "title"
                : sort === "created_asc" || sort === "created_desc"
                  ? "createdAt"
                  : sort === "downloads_desc"
                    ? "downloadCount"
                    : "updatedAt";
        items.sort(function (a, b) {
            let va = a[key];
            let vb = b[key];
            if (key === "title") {
                va = String(va || "").toLowerCase();
                vb = String(vb || "").toLowerCase();
                if (va < vb) {
                    return -1 * dir;
                }
                if (va > vb) {
                    return 1 * dir;
                }
                return 0;
            }
            if (key === "downloadCount") {
                va = a.recordType === "catalog" ? Number(a.downloadCount) || 0 : 0;
                vb = b.recordType === "catalog" ? Number(b.downloadCount) || 0 : 0;
            } else {
                va = Number(va) || 0;
                vb = Number(vb) || 0;
            }
            if (va === vb) {
                return 0;
            }
            return va < vb ? -1 * dir : 1 * dir;
        });
    }

    if (scope === "all") {
        sortMerged();
        while (items.length > limit) {
            items.pop();
        }
    }

    return json({ ok: true, items, limit, scope, sort });
}
