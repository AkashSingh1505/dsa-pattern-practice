import { subscribersDb } from "../../_lib/d1-bindings.js";
import { randomSaltB64, hashPassword, signPracticeToken } from "../../_lib/practice-jwt.js";

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function validEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}

export async function onRequestPost(context) {
    const { request, env } = context;
    const db = subscribersDb(env);
    if (!db) {
        return json(
            { error: "Subscribers D1 not bound (bind DB_SUBSCRIBERS or dsa-pattern-practice-subscribers)" },
            503,
        );
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
    if (!validEmail(email)) {
        return json({ error: "invalid email" }, 400);
    }
    if (password.length < 8) {
        return json({ error: "password must be at least 8 characters" }, 400);
    }

    const publicId = crypto.randomUUID();
    const salt = randomSaltB64();
    let hash;
    try {
        hash = await hashPassword(password, salt);
    } catch (e) {
        console.error("hash", e);
        return json({ error: "server error" }, 500);
    }

    const now = Math.floor(Date.now() / 1000);
    try {
        await db.prepare(
            `INSERT INTO practice_users (
                public_id, email, password_hash, salt, role, plan, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'user', 'free', 'active', ?, ?)`,
        )
            .bind(publicId, email, hash, salt, now, now)
            .run();
    } catch (e) {
        const msg = String(e && e.message ? e.message : e);
        if (/unique|constraint/i.test(msg)) {
            return json({ error: "email already registered" }, 409);
        }
        console.error("insert user", e);
        return json({ error: "could not create account" }, 500);
    }

    try {
        const row = await db.prepare("SELECT id FROM practice_users WHERE email = ?")
            .bind(email)
            .first();
        if (row && row.id != null) {
            await db.prepare(
                "INSERT OR IGNORE INTO security_audit (user_id, action, created_at) VALUES (?, 'register', ?)",
            )
                .bind(row.id, now)
                .run();
        }
    } catch (e) {
        console.warn("audit register", e);
    }

    const token = await signPracticeToken({
        email,
        role: "user",
        plan: "free",
        secret: env.USER_JWT_SECRET,
    });
    return json({ ok: true, token });
}
