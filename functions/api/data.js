/**
 * CMS API: GET /api/data?k=dsa  |  PUT /api/data?k=dsa  Authorization: Bearer <JWT>  body: raw JSON
 *
 * Requires content D1: binding `DB` or `dsa-pattern-practice-content` + JWT from your GitHub OAuth worker.
 */

import { contentDb } from "../_lib/d1-bindings.js";
import { verifyAdminJwt } from "../_lib/admin-rsa-jwt.js";

const ALLOWED = new Set(["dsa"]);

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

    const db = contentDb(env);
    if (!db) {
        return new Response(
            JSON.stringify({ error: "D1 not bound (bind DB or dsa-pattern-practice-content)" }),
            {
                status: 503,
                headers: { "Content-Type": "application/json" },
            },
        );
    }

    try {
        const row = await db.prepare("SELECT payload FROM cms_content WHERE key = ?").bind(key).first();
        if (row && row.payload) {
            /* Avoid edge/browser serving stale graph after admin publish (was max-age=30). */
            return new Response(row.payload, {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "private, no-cache, must-revalidate",
                },
            });
        }
    } catch (e) {
        console.error("D1 read", e);
    }

    /* No row: empty payload (no static file fallback). */
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
    const db = contentDb(env);
    if (!db) {
        return new Response(
            JSON.stringify({ error: "D1 not bound (bind DB or dsa-pattern-practice-content)" }),
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
        JSON.parse(text);
    } catch {
        return new Response(JSON.stringify({ error: "body must be JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const now = Math.floor(Date.now() / 1000);
    let revision = 1;
    try {
        const prev = await db.prepare("SELECT revision FROM cms_content WHERE key = ?").bind(key).first();
        if (prev && typeof prev.revision === "number" && prev.revision >= 1) {
            revision = prev.revision + 1;
        }
        await db.prepare(
            `INSERT INTO cms_content (key, payload, updated_at, revision, content_format, published_at)
             VALUES (?, ?, ?, ?, 'json', ?)
             ON CONFLICT(key) DO UPDATE SET
               payload = excluded.payload,
               updated_at = excluded.updated_at,
               revision = excluded.revision,
               content_format = excluded.content_format,
               published_at = excluded.published_at`,
        )
            .bind(key, text, now, revision, now)
            .run();
    } catch (e) {
        console.warn("D1 extended write, falling back", e);
        await db.prepare("INSERT OR REPLACE INTO cms_content (key, payload, updated_at) VALUES (?, ?, ?)")
            .bind(key, text, now)
            .run();
    }

    try {
        await db.prepare(
            `INSERT INTO content_audit (entity_type, entity_key, action, actor_ref, revision, created_at)
             VALUES ('cms_content', ?, 'put', 'jwt_admin', ?, ?)`,
        )
            .bind(key, revision, now)
            .run();
    } catch (e) {
        /* optional table */
    }

    return new Response(JSON.stringify({ ok: true, key, updated_at: now, revision }), {
        headers: { "Content-Type": "application/json" },
    });
}
