/**
 * CMS API: GET /api/data?k=dsa  |  PUT /api/data?k=dsa  Authorization: Bearer <JWT>  body: raw JSON
 *
 * Requires content D1: binding `DB` or `dsa-pattern-practice-content` + JWT from your GitHub OAuth worker.
 */

import { contentDb } from "../_lib/d1-bindings.js";

const ISS = "dsa-portfolio-admin";
const ADMIN_GH = "AkashSingh1505";

const ALLOWED = new Set(["dsa"]);

/** Same as auth/dsa-admin-public.pem — public only */
const PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzgkacEByh0G5m8XIOR/i
czyNHoRoiXEjE6NaoJCOtDvd+d/E0TvtvMKQOslPPE8lZmqoxGv6vSPMpCOafGyD
jymubVqqYwDk19RuihcI9FG1U4Lz/egfVFR1OnEOvhvZgdC061jsm0s4Jix1QmsR
4b4uHubpiHjKGkchcL6ZPMttcgI8Bxthyq2GwNIML9o/7LowdBj9z+IbGVDZfUcF
Q16rc6a4q8BMBEn3WQqtENWDFsigV90Sj3XfVC25KY+PGKcNp3M3b/tAf/mxJiuq
LcnU0icnlfznUZCJ8hv0a1//JuAHlyl4LeFRx6xwuquP0VhrzI1Qz6oQwVhVtLjS
YQIDAQAB
-----END PUBLIC KEY-----`;

function base64UrlToUint8Array(b64url) {
    let s = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const pad = s.length % 4;
    if (pad) s += "====".slice(0, 4 - pad);
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function utf8FromBase64UrlPayload(b64url) {
    return new TextDecoder().decode(base64UrlToUint8Array(b64url));
}

let cachedPub = null;
async function getPubKey() {
    if (cachedPub) return cachedPub;
    const pemBody = PEM.replace(/-----BEGIN PUBLIC KEY-----/g, "")
        .replace(/-----END PUBLIC KEY-----/g, "")
        .replace(/\s/g, "");
    const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
    cachedPub = await crypto.subtle.importKey(
        "spki",
        binaryDer,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"]
    );
    return cachedPub;
}

async function verifyJwt(token) {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const [h, p, s] = parts;
    let payload;
    try {
        payload = JSON.parse(utf8FromBase64UrlPayload(p));
    } catch {
        return false;
    }
    if (payload.iss !== ISS) return false;
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return false;
    const legacyGithub = payload.sub === "github" && payload.gh === ADMIN_GH;
    if (payload.admin !== true && !legacyGithub) return false;
    const data = new TextEncoder().encode(`${h}.${p}`);
    const sig = base64UrlToUint8Array(s);
    const pub = await getPubKey();
    return crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, pub, sig, data);
}

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
            return new Response(row.payload, {
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "public, max-age=30",
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
    const ok = await verifyJwt(m[1].trim());
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
