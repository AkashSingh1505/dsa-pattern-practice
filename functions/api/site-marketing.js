/**
 * Public read-only merged marketing payload for index / premium / content.html.
 * GET /api/site-marketing
 */

import { contentDb } from "../_lib/d1-bindings.js";
import { SITE_MARKETING_KV_KEY, buildMergedSiteMarketing } from "../_lib/site-marketing.js";

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
    const db = contentDb(env);
    let raw = null;
    if (db) {
        try {
            const row = await db.prepare("SELECT v FROM app_kv WHERE k = ?").bind(SITE_MARKETING_KV_KEY).first();
            if (row && row.v != null) {
                raw = String(row.v);
            }
        } catch (e) {
            console.error("site-marketing read", e);
        }
    }
    const marketing = buildMergedSiteMarketing(raw);
    return json({ ok: true, key: SITE_MARKETING_KV_KEY, marketing });
}
