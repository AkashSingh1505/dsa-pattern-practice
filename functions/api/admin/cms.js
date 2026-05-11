/**
 * Site admin CMS: draft + publish for allowed keys (e.g. dsa mind-map JSON).
 * GET    /api/admin/cms?k=dsa           — live + draft metadata and payloads
 * PUT    /api/admin/cms?k=dsa           — body: raw JSON string → save draft
 * POST   /api/admin/cms?k=dsa&action=publish — publish draft or request body to live
 * DELETE /api/admin/cms?k=dsa           — remove draft row only
 */

import { contentDb, subscribersDb } from "../../_lib/d1-bindings.js";
import { json, requireAdmin } from "../../_lib/admin-api.js";
import { newGraphId } from "../../_lib/practice-auth-request.js";

const ALLOWED = new Set(["dsa"]);

/** Canonical public catalog row for the live site mind map (member library). */
const SITE_MAP_CATALOG_SLUG = "dsa-site-map";

/**
 * Mirror published `dsa` CMS JSON into subscribers `graph_catalog` as a public graph.
 * @param {Record<string, unknown>} env
 * @param {string} payloadText
 * @param {number} nowSec
 */
async function upsertSiteMapPublicCatalog(env, payloadText, nowSec) {
    const sub = subscribersDb(env);
    if (!sub) {
        return { ok: false, reason: "no_subscribers_db" };
    }
    let payload;
    try {
        payload = JSON.parse(payloadText);
    } catch {
        return { ok: false, reason: "bad_json" };
    }
    if (!Array.isArray(payload)) {
        return { ok: false, reason: "not_array" };
    }
    const title = "Practice map (site)";
    const description = "Live site mind map (Content → dsa). Public in the member graph library.";
    const payloadJson = JSON.stringify(payload);
    let row;
    try {
        row = await sub
            .prepare("SELECT id FROM graph_catalog WHERE slug = ? AND deleted_at IS NULL")
            .bind(SITE_MAP_CATALOG_SLUG)
            .first();
    } catch (e) {
        console.error("site map catalog lookup", e);
        return { ok: false, reason: "lookup_error" };
    }
    try {
        if (row && row.id) {
            await sub
                .prepare(
                    `UPDATE graph_catalog SET title = ?, description = ?, visibility = 'public', payload_json = ?, updated_at = ?
                     WHERE id = ? AND deleted_at IS NULL`,
                )
                .bind(title, description, payloadJson, nowSec, row.id)
                .run();
        } else {
            const id = newGraphId();
            await sub
                .prepare(
                    `INSERT INTO graph_catalog (id, slug, title, description, visibility, creator_user_id, payload_json, accent_hue, tags_json, difficulty, estimated_minutes, download_count, created_at, updated_at, deleted_at)
                     VALUES (?, ?, ?, ?, 'public', NULL, ?, NULL, NULL, NULL, NULL, 0, ?, ?, NULL)`,
                )
                .bind(id, SITE_MAP_CATALOG_SLUG, title, description, payloadJson, nowSec, nowSec)
                .run();
        }
    } catch (e) {
        console.error("site map catalog upsert", e);
        return { ok: false, reason: "write_error" };
    }
    return { ok: true };
}

export async function onRequestGet(context) {
    const { request, env } = context;
    const gate = await requireAdmin(request);
    if (gate.response) return gate.response;

    const url = new URL(request.url);
    const key = url.searchParams.get("k");
    if (!key || !ALLOWED.has(key)) {
        return json({ error: "bad or missing k" }, 400);
    }

    const db = contentDb(env);
    if (!db) {
        return json({ error: "Content D1 not bound" }, 503);
    }

    let published = null;
    try {
        published = await db
            .prepare("SELECT key, payload, revision, updated_at, published_at FROM cms_content WHERE key = ?")
            .bind(key)
            .first();
    } catch (e) {
        published = null;
    }

    let draft = null;
    try {
        draft = await db
            .prepare("SELECT key, draft_payload, base_revision, updated_at, editor_ref, meta FROM cms_content_drafts WHERE key = ?")
            .bind(key)
            .first();
    } catch (e) {
        draft = null;
    }

    return json({
        ok: true,
        key,
        published: published
            ? {
                  revision: published.revision ?? 1,
                  updated_at: published.updated_at,
                  published_at: published.published_at,
                  payload: published.payload,
              }
            : null,
        draft: draft
            ? {
                  updated_at: draft.updated_at,
                  base_revision: draft.base_revision,
                  payload: draft.draft_payload,
              }
            : null,
    });
}

export async function onRequestPut(context) {
    const { request, env } = context;
    const gate = await requireAdmin(request);
    if (gate.response) return gate.response;

    const url = new URL(request.url);
    const key = url.searchParams.get("k");
    if (!key || !ALLOWED.has(key)) {
        return json({ error: "bad or missing k" }, 400);
    }

    const db = contentDb(env);
    if (!db) {
        return json({ error: "Content D1 not bound" }, 503);
    }

    const text = await request.text();
    try {
        JSON.parse(text);
    } catch {
        return json({ error: "body must be JSON" }, 400);
    }

    const now = Math.floor(Date.now() / 1000);
    let baseRevision = null;
    try {
        const prev = await db.prepare("SELECT revision FROM cms_content WHERE key = ?").bind(key).first();
        if (prev && typeof prev.revision === "number") {
            baseRevision = prev.revision;
        }
    } catch (e) {
        /* ignore */
    }

    try {
        await db
            .prepare(
                `INSERT INTO cms_content_drafts (key, draft_payload, base_revision, updated_at, editor_ref)
                 VALUES (?, ?, ?, ?, 'admin_panel')
                 ON CONFLICT(key) DO UPDATE SET
                   draft_payload = excluded.draft_payload,
                   base_revision = excluded.base_revision,
                   updated_at = excluded.updated_at,
                   editor_ref = excluded.editor_ref`,
            )
            .bind(key, text, baseRevision, now)
            .run();
    } catch (e) {
        console.error("draft save", e);
        return json({ error: "could not save draft" }, 500);
    }

    return json({ ok: true, key, updated_at: now, base_revision: baseRevision });
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const gate = await requireAdmin(request);
    if (gate.response) return gate.response;

    const url = new URL(request.url);
    const key = url.searchParams.get("k");
    if (!key || !ALLOWED.has(key)) {
        return json({ error: "bad or missing k" }, 400);
    }
    const action = url.searchParams.get("action") || "publish";
    if (action !== "publish") {
        return json({ error: "unsupported action" }, 400);
    }

    const db = contentDb(env);
    if (!db) {
        return json({ error: "Content D1 not bound" }, 503);
    }

    let text = await request.text();
    text = text && text.trim() ? text : null;

    if (!text) {
        try {
            const d = await db.prepare("SELECT draft_payload FROM cms_content_drafts WHERE key = ?").bind(key).first();
            if (d && d.draft_payload) {
                text = d.draft_payload;
            }
        } catch (e) {
            /* ignore */
        }
    }

    if (!text) {
        return json({ error: "no draft or body to publish" }, 400);
    }

    try {
        JSON.parse(text);
    } catch {
        return json({ error: "payload must be JSON" }, 400);
    }

    const now = Math.floor(Date.now() / 1000);
    let revision = 1;
    try {
        const prev = await db.prepare("SELECT revision FROM cms_content WHERE key = ?").bind(key).first();
        if (prev && typeof prev.revision === "number" && prev.revision >= 1) {
            revision = prev.revision + 1;
        }
        await db
            .prepare(
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
        console.warn("publish extended write, falling back", e);
        try {
            await db.prepare("INSERT OR REPLACE INTO cms_content (key, payload, updated_at) VALUES (?, ?, ?)")
                .bind(key, text, now)
                .run();
        } catch (e2) {
            console.error("publish fallback", e2);
            return json({ error: "publish failed" }, 500);
        }
    }

    try {
        await db.prepare("DELETE FROM cms_content_drafts WHERE key = ?").bind(key).run();
    } catch (e) {
        console.warn("draft delete after publish", e);
    }

    try {
        await db
            .prepare(
                `INSERT INTO content_audit (entity_type, entity_key, action, actor_ref, revision, created_at)
                 VALUES ('cms_content', ?, 'publish', 'jwt_admin', ?, ?)`,
            )
            .bind(key, revision, now)
            .run();
    } catch (e) {
        /* optional */
    }

    let graphCatalogSync = null;
    if (key === "dsa") {
        graphCatalogSync = await upsertSiteMapPublicCatalog(env, text, now);
    }

    return json({ ok: true, key, updated_at: now, revision, graph_catalog_sync: graphCatalogSync });
}

export async function onRequestDelete(context) {
    const { request, env } = context;
    const gate = await requireAdmin(request);
    if (gate.response) return gate.response;

    const url = new URL(request.url);
    const key = url.searchParams.get("k");
    if (!key || !ALLOWED.has(key)) {
        return json({ error: "bad or missing k" }, 400);
    }

    const db = contentDb(env);
    if (!db) {
        return json({ error: "Content D1 not bound" }, 503);
    }

    try {
        await db.prepare("DELETE FROM cms_content_drafts WHERE key = ?").bind(key).run();
    } catch (e) {
        console.error("draft delete", e);
        return json({ error: "could not delete draft" }, 500);
    }

    return json({ ok: true, key, draft_removed: true });
}
