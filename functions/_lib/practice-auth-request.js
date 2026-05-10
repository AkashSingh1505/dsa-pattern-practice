import { subscribersDb } from "./d1-bindings.js";
import { verifyPracticeToken } from "./practice-jwt.js";
import { json, requireAdmin } from "./admin-api.js";

/**
 * @param {Request} request
 * @param {Record<string, unknown>} env
 */
export async function requirePracticeUser(request, env) {
    const db = subscribersDb(env);
    if (!db) {
        return { response: json({ error: "Subscribers D1 not bound" }, 503) };
    }
    if (!env.USER_JWT_SECRET) {
        return { response: json({ error: "USER_JWT_SECRET not configured" }, 503) };
    }
    const auth = request.headers.get("Authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) {
        return { response: json({ error: "unauthorized" }, 401) };
    }
    const payload = await verifyPracticeToken(m[1].trim(), env.USER_JWT_SECRET);
    if (!payload) {
        return { response: json({ error: "invalid token" }, 401) };
    }
    const email = String(payload.sub || "")
        .trim()
        .toLowerCase();
    if (!email) {
        return { response: json({ error: "invalid token" }, 401) };
    }
    let row;
    try {
        row = await db.prepare("SELECT id, status FROM practice_users WHERE email = ?").bind(email).first();
    } catch (e) {
        console.error("practice user lookup", e);
        return { response: json({ error: "server error" }, 500) };
    }
    if (!row || String(row.status || "active") !== "active") {
        return { response: json({ error: "forbidden" }, 403) };
    }
    return {
        ok: true,
        email,
        role: String(payload.role || "user"),
        plan: String(payload.plan || "free"),
        userId: row.id,
        db,
    };
}

/** Site RSA admin OR practice account with role admin (product operator). */
export async function requireGraphCatalogWriter(request, env) {
    const db = subscribersDb(env);
    if (!db) {
        return { response: json({ error: "Subscribers D1 not bound" }, 503) };
    }
    const adminGate = await requireAdmin(request);
    if (adminGate.ok) {
        return { ok: true, db, via: "rsa" };
    }
    if (!env.USER_JWT_SECRET) {
        return { response: adminGate.response };
    }
    const auth = request.headers.get("Authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) {
        return { response: json({ error: "unauthorized" }, 401) };
    }
    const payload = await verifyPracticeToken(m[1].trim(), env.USER_JWT_SECRET);
    if (!payload || String(payload.role || "") !== "admin") {
        return { response: json({ error: "forbidden" }, 403) };
    }
    const email = String(payload.sub || "")
        .trim()
        .toLowerCase();
    const row = await db.prepare("SELECT id, status FROM practice_users WHERE email = ?").bind(email).first();
    if (!row || String(row.status || "active") !== "active") {
        return { response: json({ error: "forbidden" }, 403) };
    }
    return { ok: true, db, via: "practice_admin" };
}

export function newGraphId() {
    return crypto.randomUUID();
}
