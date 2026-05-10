import { json } from "../../_lib/admin-api.js";
import { newGraphId, requirePracticeUser } from "../../_lib/practice-auth-request.js";

function defaultPayload(title) {
    const safe = String(title || "My graph").slice(0, 80);
    return JSON.stringify([
        {
            id: "ug-root-" + Math.random().toString(36).slice(2, 9),
            name: safe,
            tree: [{ name: "Start here", problems: [] }],
        },
    ]);
}

export async function onRequestGet(context) {
    const { request, env } = context;
    const gate = await requirePracticeUser(request, env);
    if (!gate.ok) {
        return gate.response;
    }
    const { db, userId } = gate;
    let rows;
    try {
        rows = await db
            .prepare(
                `SELECT g.id, g.source_catalog_id, g.kind, g.title, g.description, g.accent_hue, g.shared_from_user_id,
                        g.created_at, g.updated_at,
                        pu.email AS shared_from_email, up.display_name AS shared_from_display
                 FROM user_graphs g
                 LEFT JOIN practice_users pu ON pu.id = g.shared_from_user_id
                 LEFT JOIN user_profiles up ON up.user_id = pu.id
                 WHERE g.owner_user_id = ? AND g.deleted_at IS NULL
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
        return {
            id: r.id,
            sourceCatalogId: r.source_catalog_id,
            kind: r.kind,
            title: r.title,
            description: r.description || "",
            accentHue: r.accent_hue,
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
    const { db, userId } = gate;
    const now = Math.floor(Date.now() / 1000);
    const id = newGraphId();
    const payload = defaultPayload(title);
    try {
        await db
            .prepare(
                `INSERT INTO user_graphs (id, owner_user_id, source_catalog_id, kind, title, description, payload_json, accent_hue, shared_from_user_id, created_at, updated_at, deleted_at)
                 VALUES (?, ?, NULL, 'created', ?, ?, ?, NULL, NULL, ?, ?, NULL)`,
            )
            .bind(id, userId, title, description || null, payload, now, now)
            .run();
    } catch (e) {
        console.error("graph create", e);
        return json({ error: "server error" }, 500);
    }
    return json({
        ok: true,
        graph: {
            id,
            kind: "created",
            title,
            description,
            createdAt: now,
            updatedAt: now,
        },
    });
}
