import { subscribersDb } from "../_lib/d1-bindings.js";

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private, max-age=0, must-revalidate",
        },
    });
}

export async function onRequestGet(context) {
    const { env } = context;
    const db = subscribersDb(env);
    if (!db) {
        return json({ ok: false, error: "Subscribers D1 not bound" }, 503);
    }

    const now = Math.floor(Date.now() / 1000);
    const stats = {
        total_users: 0,
        active_users: 0,
        subscribers: 0,
        public_graphs: 0,
        graph_downloads: 0,
        subscriber_contacts: 0,
        plan_counts: {
            free: 0,
            pro: 0,
            team: 0,
            lifetime: 0,
        },
    };

    try {
        const users = await db
            .prepare(
                `SELECT
                   COUNT(*) AS total_users,
                   IFNULL(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active_users,
                   IFNULL(SUM(CASE WHEN role = 'subscriber' THEN 1 ELSE 0 END), 0) AS subscribers,
                   IFNULL(SUM(CASE WHEN plan = 'free' THEN 1 ELSE 0 END), 0) AS plan_free,
                   IFNULL(SUM(CASE WHEN plan = 'pro' THEN 1 ELSE 0 END), 0) AS plan_pro,
                   IFNULL(SUM(CASE WHEN plan = 'team' THEN 1 ELSE 0 END), 0) AS plan_team,
                   IFNULL(SUM(CASE WHEN plan = 'lifetime' THEN 1 ELSE 0 END), 0) AS plan_lifetime
                 FROM practice_users`,
            )
            .first();
        if (users) {
            stats.total_users = Number(users.total_users || 0);
            stats.active_users = Number(users.active_users || 0);
            stats.subscribers = Number(users.subscribers || 0);
            stats.plan_counts.free = Number(users.plan_free || 0);
            stats.plan_counts.pro = Number(users.plan_pro || 0);
            stats.plan_counts.team = Number(users.plan_team || 0);
            stats.plan_counts.lifetime = Number(users.plan_lifetime || 0);
        }
    } catch (e) {
        console.error("public-stats users", e);
    }

    try {
        const graphs = await db
            .prepare(
                `SELECT
                   COUNT(*) AS public_graphs,
                   IFNULL(SUM(download_count), 0) AS graph_downloads
                 FROM graph_catalog
                 WHERE visibility = 'public' AND deleted_at IS NULL`,
            )
            .first();
        if (graphs) {
            stats.public_graphs = Number(graphs.public_graphs || 0);
            stats.graph_downloads = Number(graphs.graph_downloads || 0);
        }
    } catch (e) {
        console.error("public-stats graphs", e);
    }

    try {
        const contacts = await db.prepare("SELECT COUNT(*) AS n FROM subscriber_contacts").first();
        if (contacts) {
            stats.subscriber_contacts = Number(contacts.n || 0);
        }
    } catch (e) {
        console.error("public-stats contacts", e);
    }

    return json({
        ok: true,
        generated_at: now,
        stats,
    });
}
