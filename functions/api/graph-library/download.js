import { json } from "../../_lib/admin-api.js";
import { newGraphId, requirePracticeUser } from "../../_lib/practice-auth-request.js";

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
    let cat;
    try {
        cat = await db
            .prepare(
                `SELECT id, title, description, payload_json, accent_hue, visibility FROM graph_catalog
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
    let payloadStr = cat.payload_json;
    try {
        const parsed = JSON.parse(payloadStr);
        if (!Array.isArray(parsed)) {
            return json({ error: "invalid source graph" }, 500);
        }
    } catch {
        return json({ error: "invalid source graph" }, 500);
    }
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
        await db.batch([
            db
                .prepare(
                    `INSERT INTO user_graphs (id, owner_user_id, source_catalog_id, kind, title, description, payload_json, accent_hue, shared_from_user_id, created_at, updated_at, deleted_at)
                     VALUES (?, ?, ?, 'downloaded', ?, ?, ?, ?, NULL, ?, ?, NULL)`,
                )
                .bind(copyId, userId, catalogId, title, desc, payloadStr, accent, now, now),
            db
                .prepare(
                    `INSERT INTO graph_catalog_downloads (catalog_id, user_id, downloaded_at) VALUES (?, ?, ?)
                     ON CONFLICT(catalog_id, user_id) DO UPDATE SET downloaded_at = excluded.downloaded_at`,
                )
                .bind(catalogId, userId, now),
            db.prepare(`UPDATE graph_catalog SET download_count = download_count + 1 WHERE id = ?`).bind(catalogId),
        ]);
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
        },
        stats: {
            firstDownloadByThisUser,
            uniqueDownloaders,
        },
    });
}
