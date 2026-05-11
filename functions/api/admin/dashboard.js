import { contentDb, subscribersDb } from "../../_lib/d1-bindings.js";
import { json, requireAdmin } from "../../_lib/admin-api.js";

export async function onRequestGet(context) {
    const { request, env } = context;
    const gate = await requireAdmin(request);
    if (gate.response) return gate.response;

    const cdb = contentDb(env);
    const sdb = subscribersDb(env);
    if (!cdb || !sdb) {
        return json(
            {
                error: "D1 not fully bound (need DB + DB_SUBSCRIBERS)",
            },
            503,
        );
    }

    const now = Math.floor(Date.now() / 1000);
    const out = { ok: true, generated_at: now };

    try {
        const users = await sdb
            .prepare(
                `SELECT
                   COUNT(*) AS total,
                   IFNULL(SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END), 0) AS role_user,
                   IFNULL(SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END), 0) AS role_admin,
                   IFNULL(SUM(CASE WHEN role = 'subscriber' THEN 1 ELSE 0 END), 0) AS role_subscriber,
                   IFNULL(SUM(CASE WHEN plan = 'free' THEN 1 ELSE 0 END), 0) AS plan_free,
                   IFNULL(SUM(CASE WHEN plan = 'pro' THEN 1 ELSE 0 END), 0) AS plan_pro,
                   IFNULL(SUM(CASE WHEN plan = 'team' THEN 1 ELSE 0 END), 0) AS plan_team,
                   IFNULL(SUM(CASE WHEN plan = 'lifetime' THEN 1 ELSE 0 END), 0) AS plan_lifetime,
                   IFNULL(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS status_active
                 FROM practice_users`,
            )
            .first();
        out.users = users || {};
    } catch (e) {
        console.error("dashboard users agg", e);
        out.users = { error: "query failed" };
    }

    try {
        const siteG = await sdb
            .prepare(
                "SELECT id, slug, title, updated_at FROM graph_catalog WHERE slug = 'dsa-site-map' AND deleted_at IS NULL",
            )
            .first();
        out.site_public_graph = siteG
            ? { id: siteG.id, slug: siteG.slug, title: siteG.title, updated_at: siteG.updated_at }
            : null;
    } catch (e) {
        out.site_public_graph = null;
    }

    try {
        const kv = await cdb.prepare("SELECT COUNT(*) AS n FROM app_kv").first();
        out.app_kv_count = kv && typeof kv.n === "number" ? kv.n : 0;
    } catch (e) {
        out.app_kv_count = null;
    }

    try {
        const audit = await cdb
            .prepare(
                `SELECT id, entity_key, action, revision, created_at
                 FROM content_audit ORDER BY id DESC LIMIT 8`,
            )
            .all();
        out.recent_content_audit = d1ResultRows(audit);
    } catch (e) {
        out.recent_content_audit = [];
    }

    try {
        const sec = await sdb
            .prepare(`SELECT id, user_id, action, created_at FROM security_audit ORDER BY id DESC LIMIT 8`)
            .all();
        out.recent_security_audit = d1ResultRows(sec);
    } catch (e) {
        out.recent_security_audit = [];
    }

    try {
        const sc = await sdb.prepare("SELECT COUNT(*) AS n FROM subscriber_contacts").first();
        out.subscriber_contacts_count = sc && typeof sc.n === "number" ? sc.n : 0;
    } catch (e) {
        out.subscriber_contacts_count = null;
    }

    return json(out);
}

function d1ResultRows(rows) {
    if (rows && Array.isArray(rows.results)) return rows.results;
    return [];
}
