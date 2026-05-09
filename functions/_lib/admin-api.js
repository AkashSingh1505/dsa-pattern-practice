import { verifyAdminJwt } from "./admin-rsa-jwt.js";

export function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

/** @returns {{ ok: true } | { response: Response }} */
export async function requireAdmin(request) {
    const auth = request.headers.get("Authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) {
        return { response: json({ error: "unauthorized" }, 401) };
    }
    const ok = await verifyAdminJwt(m[1].trim());
    if (!ok) {
        return { response: json({ error: "invalid token" }, 401) };
    }
    return { ok: true };
}
