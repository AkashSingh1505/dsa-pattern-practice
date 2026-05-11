/**
 * Public practice graph: GET /api/data?k=dsa  — raw JSON array (mind-map roots).
 * Live payload is stored in Subscribers D1: graph_catalog.slug = 'dsa-site-map'.
 *
 * PUT /api/data?k=dsa  — RSA JWT admin only; updates that catalog row's payload_json.
 */

import { subscribersDb } from "../_lib/d1-bindings.js";
import { verifyAdminJwt } from "../_lib/admin-rsa-jwt.js";

const ALLOWED = new Set(["dsa"]);

/** Reserved catalog row for the live site mind map (same as graph library / member hub). */
const SITE_PUBLIC_GRAPH_SLUG = "dsa-site-map";

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const key = url.searchParams.get("k");
    if (!key || !ALLOWED.has(key)) {
        return new Response(JSON.stringify({ error: "bad or missing k" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const db = subscribersDb(env);
    if (!db) {
        return new Response(
            JSON.stringify({ error: "Subscribers D1 not bound (bind DB_SUBSCRIBERS / dsa-pattern-practice-subscribers)" }),
            {
                status: 503,
                headers: { "Content-Type": "application/json" },
            },
        );
    }

    try {
        const row = await db
            .prepare("SELECT payload_json FROM graph_catalog WHERE slug = ? AND deleted_at IS NULL")
            .bind(SITE_PUBLIC_GRAPH_SLUG)
            .first();
        if (row && row.payload_json) {
            return new Response(row.payload_json, {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "private, no-cache, must-revalidate",
                },
            });
        }
    } catch (e) {
        console.error("graph_catalog read for public site map", e);
    }

    const emptyBody = "[]";
    return new Response(emptyBody, {
        status: 200,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
        },
    });
}

export async function onRequestPut(context) {
    const { request, env } = context;
    const db = subscribersDb(env);
    if (!db) {
        return new Response(
            JSON.stringify({ error: "Subscribers D1 not bound" }),
            {
                status: 503,
                headers: { "Content-Type": "application/json" },
            },
        );
    }

    const url = new URL(request.url);
    const key = url.searchParams.get("k");
    if (!key || !ALLOWED.has(key)) {
        return new Response(JSON.stringify({ error: "bad or missing k" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const auth = request.headers.get("Authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }
    const ok = await verifyAdminJwt(m[1].trim());
    if (!ok) {
        return new Response(JSON.stringify({ error: "invalid token" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    const text = await request.text();
    try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
            return new Response(JSON.stringify({ error: "body must be a JSON array of root topics" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }
    } catch {
        return new Response(JSON.stringify({ error: "body must be JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const now = Math.floor(Date.now() / 1000);

    let row;
    try {
        row = await db
            .prepare("SELECT id FROM graph_catalog WHERE slug = ? AND deleted_at IS NULL")
            .bind(SITE_PUBLIC_GRAPH_SLUG)
            .first();
    } catch (e) {
        console.error("site public graph lookup", e);
        return new Response(JSON.stringify({ error: "lookup failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }

    if (!row || !row.id) {
        return new Response(
            JSON.stringify({
                error:
                    'No graph_catalog row with slug "' +
                    SITE_PUBLIC_GRAPH_SLUG +
                    '". Create it in Graph library or seed SQL before PUT.',
            }),
            {
                status: 404,
                headers: { "Content-Type": "application/json" },
            },
        );
    }

    try {
        await db
            .prepare("UPDATE graph_catalog SET payload_json = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL")
            .bind(text, now, row.id)
            .run();
    } catch (e) {
        console.error("site public graph update", e);
        return new Response(JSON.stringify({ error: "update failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ ok: true, key, slug: SITE_PUBLIC_GRAPH_SLUG, updated_at: now }), {
        headers: { "Content-Type": "application/json" },
    });
}
