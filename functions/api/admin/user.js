import { subscribersDb } from "../../_lib/d1-bindings.js";
import { json, requireAdmin } from "../../_lib/admin-api.js";

const ROLES = new Set(["user", "admin", "subscriber"]);
const PLANS = new Set(["free", "pro", "team", "lifetime"]);
const STATUSES = new Set(["active", "suspended", "deleted"]);

export async function onRequestGet(context) {
    const { request, env } = context;
    const gate = await requireAdmin(request);
    if (gate.response) return gate.response;

    const db = subscribersDb(env);
    if (!db) {
        return json({ error: "Subscribers D1 not bound" }, 503);
    }

    const url = new URL(request.url);
    const id = parseInt(url.searchParams.get("id") || "", 10);
    if (!id || id < 1) {
        return json({ error: "missing or invalid id" }, 400);
    }

    try {
        const user = await db
            .prepare(
                `SELECT id, public_id, email, role, plan, status, email_verified_at, last_login_at,
                        created_at, updated_at, metadata
                 FROM practice_users WHERE id = ?`,
            )
            .bind(id)
            .first();
        if (!user) {
            return json({ error: "not found" }, 404);
        }

        let profile = null;
        try {
            profile = await db.prepare("SELECT * FROM user_profiles WHERE user_id = ?").bind(id).first();
        } catch (e) {
            /* optional */
        }

        let entitlements = [];
        try {
            const e = await db
                .prepare(
                    `SELECT id, feature_key, value_json, source, valid_from, valid_until, created_at, meta
                     FROM user_entitlements WHERE user_id = ? ORDER BY id DESC LIMIT 100`,
                )
                .bind(id)
                .all();
            entitlements = d1ResultRows(e);
        } catch (e) {
            entitlements = [];
        }

        let billing_customers = [];
        try {
            const bc = await db.prepare("SELECT * FROM billing_customers WHERE user_id = ?").bind(id).all();
            billing_customers = d1ResultRows(bc);
        } catch (e) {
            billing_customers = [];
        }

        let billing_subscriptions = [];
        try {
            const bs = await db
                .prepare("SELECT * FROM billing_subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 20")
                .bind(id)
                .all();
            billing_subscriptions = d1ResultRows(bs);
        } catch (e) {
            billing_subscriptions = [];
        }

        let audit_tail = [];
        try {
            const a = await db
                .prepare(
                    `SELECT id, action, entity_type, entity_id, created_at FROM security_audit
                     WHERE user_id = ? ORDER BY id DESC LIMIT 30`,
                )
                .bind(id)
                .all();
            audit_tail = d1ResultRows(a);
        } catch (e) {
            audit_tail = [];
        }

        return json({
            ok: true,
            user,
            profile,
            entitlements,
            billing_customers,
            billing_subscriptions,
            security_audit_recent: audit_tail,
        });
    } catch (e) {
        console.error("admin user get", e);
        return json({ error: "server error" }, 500);
    }
}

export async function onRequestPatch(context) {
    const { request, env } = context;
    const gate = await requireAdmin(request);
    if (gate.response) return gate.response;

    const db = subscribersDb(env);
    if (!db) {
        return json({ error: "Subscribers D1 not bound" }, 503);
    }

    const url = new URL(request.url);
    const id = parseInt(url.searchParams.get("id") || "", 10);
    if (!id || id < 1) {
        return json({ error: "missing or invalid id" }, 400);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: "invalid JSON" }, 400);
    }

    const updates = [];
    const binds = [];

    if (body.role !== undefined) {
        const r = String(body.role || "");
        if (!ROLES.has(r)) {
            return json({ error: "invalid role" }, 400);
        }
        updates.push("role = ?");
        binds.push(r);
    }
    if (body.plan !== undefined) {
        const p = String(body.plan || "");
        if (!PLANS.has(p)) {
            return json({ error: "invalid plan" }, 400);
        }
        updates.push("plan = ?");
        binds.push(p);
    }
    if (body.status !== undefined) {
        const s = String(body.status || "");
        if (!STATUSES.has(s)) {
            return json({ error: "invalid status" }, 400);
        }
        updates.push("status = ?");
        binds.push(s);
    }

    if (updates.length === 0) {
        return json({ error: "no valid fields (role, plan, status)" }, 400);
    }

    const now = Math.floor(Date.now() / 1000);
    updates.push("updated_at = ?");
    binds.push(now);
    binds.push(id);

    try {
        const exists = await db.prepare("SELECT id FROM practice_users WHERE id = ?").bind(id).first();
        if (!exists) {
            return json({ error: "not found" }, 404);
        }
        await db
            .prepare(`UPDATE practice_users SET ${updates.join(", ")} WHERE id = ?`)
            .bind(...binds)
            .run();
        try {
            await db
                .prepare(
                    `INSERT INTO security_audit (user_id, action, entity_type, entity_id, payload_json, created_at)
                     VALUES (?, 'admin_patch_user', 'practice_users', ?, ?, ?)`,
                )
                .bind(id, String(id), JSON.stringify({ role: body.role, plan: body.plan, status: body.status }), now)
                .run();
        } catch (e) {
            console.warn("audit admin patch", e);
        }
        return json({ ok: true, id, updated_at: now });
    } catch (e) {
        console.error("admin user patch", e);
        return json({ error: "server error" }, 500);
    }
}

function d1ResultRows(rows) {
    if (rows && Array.isArray(rows.results)) return rows.results;
    return [];
}
