import { verifyPassword, signPracticeToken } from "../../_lib/practice-jwt.js";

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

export async function onRequestPost(context) {
    const { request, env } = context;
    if (!env.DB_SUBSCRIBERS) {
        return json({ error: "DB_SUBSCRIBERS not bound" }, 503);
    }
    if (!env.USER_JWT_SECRET || String(env.USER_JWT_SECRET).length < 16) {
        return json({ error: "USER_JWT_SECRET not configured" }, 503);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: "invalid JSON" }, 400);
    }
    const email = String(body.email || "")
        .trim()
        .toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) {
        return json({ error: "email and password required" }, 400);
    }

    let row;
    try {
        row = await env.DB_SUBSCRIBERS.prepare(
            `SELECT id, email, password_hash, salt, role, plan, status
             FROM practice_users WHERE email = ?`,
        )
            .bind(email)
            .first();
    } catch (e) {
        console.error("login select", e);
        return json({ error: "server error" }, 500);
    }

    if (!row || !row.password_hash || !row.salt) {
        return json({ error: "invalid email or password" }, 401);
    }
    if (String(row.status || "active") !== "active") {
        return json({ error: "account disabled" }, 403);
    }

    const ok = await verifyPassword(password, row.salt, row.password_hash);
    if (!ok) {
        return json({ error: "invalid email or password" }, 401);
    }

    const now = Math.floor(Date.now() / 1000);
    try {
        await env.DB_SUBSCRIBERS.prepare(
            "UPDATE practice_users SET last_login_at = ?, updated_at = ? WHERE id = ?",
        )
            .bind(now, now, row.id)
            .run();
    } catch (e) {
        console.warn("last_login update", e);
    }

    try {
        await env.DB_SUBSCRIBERS.prepare(
            "INSERT INTO security_audit (user_id, action, created_at) VALUES (?, 'login', ?)",
        )
            .bind(row.id, now)
            .run();
    } catch (e) {
        console.warn("audit login", e);
    }

    const role = String(row.role || "user");
    const plan = String(row.plan || "free");
    const token = await signPracticeToken({
        email: row.email,
        role,
        plan,
        secret: env.USER_JWT_SECRET,
    });
    return json({ ok: true, token, email: row.email, role, plan });
}
