import { verifyPracticeToken } from "../../_lib/practice-jwt.js";

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

export async function onRequestGet(context) {
    const { request, env } = context;
    if (!env.USER_JWT_SECRET) {
        return json({ error: "USER_JWT_SECRET not configured" }, 503);
    }
    const auth = request.headers.get("Authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) {
        return json({ error: "unauthorized" }, 401);
    }
    const payload = await verifyPracticeToken(m[1].trim(), env.USER_JWT_SECRET);
    if (!payload) {
        return json({ error: "invalid token" }, 401);
    }
    return json({
        ok: true,
        email: payload.sub,
        role: payload.role,
        plan: payload.plan,
    });
}
