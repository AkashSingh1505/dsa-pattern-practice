/**
 * Public read-only: merged site user feature flags from app_kv.
 * GET /api/site-features
 */

import { contentDb } from "../_lib/d1-bindings.js";
import { SITE_USER_FEATURES_KV_KEY, mergeSiteUserFeaturesFromKv } from "../_lib/site-user-features.js";

function json(body, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=30, s-maxage=60",
            ...extraHeaders,
        },
    });
}

export async function onRequestGet(context) {
    const { env } = context;
    const db = contentDb(env);
    let raw = null;
    if (db) {
        try {
            const row = await db
                .prepare("SELECT v FROM app_kv WHERE k = ?")
                .bind(SITE_USER_FEATURES_KV_KEY)
                .first();
            if (row && row.v != null) {
                raw = String(row.v);
            }
        } catch (e) {
            console.error("site-features read", e);
        }
    }
    const features = mergeSiteUserFeaturesFromKv(raw);
    return json({ ok: true, key: SITE_USER_FEATURES_KV_KEY, features });
}
