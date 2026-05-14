import { json } from "../../_lib/admin-api.js";
import { newGraphId, requirePracticeUser } from "../../_lib/practice-auth-request.js";
import { graphPayloadStatsFromJson } from "../../_lib/graph-payload-stats.js";
import { ensureUserGraphVisibilityColumn } from "../../_lib/user-graph-visibility.js";
import { normalizeGraphCategoriesBody } from "../../_lib/graph-catalog-categories.js";
import { validateMindMapGraphInvariant } from "../../_lib/graph-catalog-category-rows.js";
import { ensureUserGraphCategoriesJsonColumn, stringifyUserGraphCategories } from "../../_lib/user-graph-categories-json.js";
import { touchUserSavedCategories } from "../../_lib/user-saved-graph-categories.js";

function defaultPayload(title, firstCategoryId) {
    const safe = String(title || "My graph").slice(0, 80);
    const cid = String(firstCategoryId || "").trim();
    const treeStub = cid
        ? [{ name: "Start here", problems: [], children: [], graphCategoryId: cid }]
        : [{ name: "Start here", problems: [], children: [] }];
    const root = {
        id: "ug-root-" + Math.random().toString(36).slice(2, 9),
        name: safe,
        tree: treeStub,
    };
    if (cid) {
        root.graphCategoryId = cid;
    }
    return JSON.stringify([root]);
}

export async function onRequestGet(context) {
    const { request, env } = context;
    const gate = await requirePracticeUser(request, env);
    if (!gate.ok) {
        return gate.response;
    }
    const { db, userId } = gate;
    const hasVisibility = await ensureUserGraphVisibilityColumn(db);
    let rows;
    try {
        rows = await db
            .prepare(
                `SELECT g.id, g.source_catalog_id, g.kind, g.title, g.description, g.payload_json, g.accent_hue, ${
                    hasVisibility ? "g.visibility" : "'private'"
                } AS visibility, g.shared_from_user_id,
                        g.created_at, g.updated_at,
                        pu.email AS shared_from_email, up.display_name AS shared_from_display,
                        c.download_count AS source_download_count,
                        (
                            SELECT COUNT(*)
                            FROM graph_catalog_downloads gcd
                            WHERE gcd.catalog_id = g.source_catalog_id
                        ) AS source_unique_downloaders
                 FROM user_graphs g
                 LEFT JOIN practice_users pu ON pu.id = g.shared_from_user_id
                 LEFT JOIN user_profiles up ON up.user_id = pu.id
                 LEFT JOIN graph_catalog c ON c.id = g.source_catalog_id
                 WHERE g.owner_user_id = ? AND g.deleted_at IS NULL
                   AND (
                        g.kind <> 'downloaded'
                        OR EXISTS (
                            SELECT 1
                            FROM graph_catalog_downloads gcd_self
                            WHERE gcd_self.catalog_id = g.source_catalog_id
                              AND gcd_self.user_id = g.owner_user_id
                        )
                   )
                 ORDER BY g.updated_at DESC`,
            )
            .bind(userId)
            .all();
    } catch (e) {
        console.error("graph-library mine list", e);
        return json({ error: "server error" }, 500);
    }
    const graphs = (rows.results || []).map((r) => {
        const dn = r.shared_from_display && String(r.shared_from_display).trim();
        const em = r.shared_from_email && String(r.shared_from_email).trim();
        const sharedFromLabel = r.kind === "shared" ? dn || em || "Member" : null;
        const stats = graphPayloadStatsFromJson(r.payload_json);
        return {
            id: r.id,
            sourceCatalogId: r.source_catalog_id,
            kind: r.kind,
            title: r.title,
            description: r.description || "",
            accentHue: r.accent_hue,
            visibility: String(r.visibility || "private"),
            downloadCount: Number(r.source_download_count || 0) || 0,
            uniqueDownloaders: Number(r.source_unique_downloaders || 0) || 0,
            nodeCount: stats.nodeCount,
            branchCount: stats.branchCount,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            sharedFromLabel,
        };
    });
    return json({ ok: true, graphs });
}

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
        body = {};
    }
    const title = String(body.title || "").trim();
    if (!title) {
        return json({ error: "title required" }, 400);
    }
    const description = String(body.description || "").trim();
    const accentHueRaw = body.accentHue;
    let accentHue = null;
    if (accentHueRaw !== "" && accentHueRaw != null) {
        const n = Number(accentHueRaw);
        if (!Number.isFinite(n) || n < 0 || n > 359) {
            return json({ error: "accentHue must be between 0 and 359" }, 400);
        }
        accentHue = Math.round(n);
    }
    const { db, userId } = gate;
    await ensureUserGraphCategoriesJsonColumn(db);
    const hasVisibility = await ensureUserGraphVisibilityColumn(db);
    const now = Math.floor(Date.now() / 1000);
    const id = newGraphId();
    const catNorm = normalizeGraphCategoriesBody(Array.isArray(body.categories) ? body.categories : []);
    if (!catNorm.ok) {
        return json({ error: catNorm.error }, 400);
    }
    if (!catNorm.categories.length) {
        return json({ error: "at least one category { name, color } is required", code: "GRAPH_CATEGORIES_REQUIRED" }, 400);
    }
    const firstCatId = catNorm.categories[0].id;
    const payload = defaultPayload(title, firstCatId);
    const categoriesJson = stringifyUserGraphCategories(catNorm.categories);
    let payloadParsed;
    try {
        payloadParsed = JSON.parse(payload);
    } catch {
        return json({ error: "invalid default payload" }, 500);
    }
    const inv = validateMindMapGraphInvariant(payloadParsed, catNorm.categories);
    if (!inv.ok) {
        return json({ error: inv.error, code: inv.code || "GRAPH_INVALID" }, 400);
    }
    try {
        if (hasVisibility) {
            await db
                .prepare(
                    `INSERT INTO user_graphs (id, owner_user_id, source_catalog_id, kind, title, description, payload_json, accent_hue, categories_json, visibility, shared_from_user_id, created_at, updated_at, deleted_at)
                     VALUES (?, ?, NULL, 'created', ?, ?, ?, ?, ?, 'private', NULL, ?, ?, NULL)`,
                )
                .bind(id, userId, title, description || null, payload, accentHue, categoriesJson, now, now)
                .run();
        } else {
            await db
                .prepare(
                    `INSERT INTO user_graphs (id, owner_user_id, source_catalog_id, kind, title, description, payload_json, accent_hue, categories_json, shared_from_user_id, created_at, updated_at, deleted_at)
                     VALUES (?, ?, NULL, 'created', ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
                )
                .bind(id, userId, title, description || null, payload, accentHue, categoriesJson, now, now)
                .run();
        }
    } catch (e) {
        console.error("graph create", e);
        return json({ error: "server error" }, 500);
    }
    try {
        await touchUserSavedCategories(db, userId, catNorm.categories);
    } catch (e) {
        console.error("graph create palette", e);
    }
    return json({
        ok: true,
        graph: {
            id,
            kind: "created",
            title,
            description,
            accentHue,
            visibility: "private",
            createdAt: now,
            updatedAt: now,
        },
    });
}
