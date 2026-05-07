/**
 * HS256 JWT for practice users. Env: USER_JWT_SECRET (≥16 chars).
 */

const ISS = "dsa-pattern-practice";
const TYP = "practice";

function base64UrlEncodeBytes(bytes) {
    let bin = "";
    const arr = new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i++) {
        bin += String.fromCharCode(arr[i]);
    }
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeJson(obj) {
    return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(obj)));
}

function base64UrlToUint8Array(b64url) {
    let s = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const pad = s.length % 4;
    if (pad) {
        s += "====".slice(0, 4 - pad);
    }
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        out[i] = bin.charCodeAt(i);
    }
    return out;
}

export function randomSaltB64() {
    const s = crypto.getRandomValues(new Uint8Array(16));
    return base64UrlEncodeBytes(s);
}

export async function hashPassword(password, saltB64) {
    const salt = base64UrlToUint8Array(saltB64);
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt,
            iterations: 100000,
            hash: "SHA-256",
        },
        keyMaterial,
        256,
    );
    return base64UrlEncodeBytes(bits);
}

export async function verifyPassword(password, saltB64, storedHashB64) {
    const h = await hashPassword(password, saltB64);
    return timingSafeEqualStr(h, storedHashB64);
}

function timingSafeEqualStr(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    let x = 0;
    for (let i = 0; i < a.length; i++) {
        x |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return x === 0;
}

export async function signPracticeToken({ email, role, plan, secret, ttlSec = 60 * 60 * 24 * 30 }) {
    const header = base64UrlEncodeJson({ alg: "HS256", typ: "JWT" });
    const now = Math.floor(Date.now() / 1000);
    const payload = base64UrlEncodeJson({
        iss: ISS,
        typ: TYP,
        sub: email,
        role: role || "user",
        plan: plan || "free",
        exp: now + ttlSec,
        iat: now,
    });
    const data = `${header}.${payload}`;
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
    return `${data}.${base64UrlEncodeBytes(sig)}`;
}

export async function verifyPracticeToken(token, secret) {
    if (!token || typeof token !== "string") {
        return null;
    }
    const parts = token.split(".");
    if (parts.length !== 3) {
        return null;
    }
    const [h, p, s] = parts;
    const data = `${h}.${p}`;
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
    );
    let sigBytes;
    try {
        sigBytes = base64UrlToUint8Array(s);
    } catch {
        return null;
    }
    let ok;
    try {
        ok = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(data));
    } catch {
        return null;
    }
    if (!ok) {
        return null;
    }
    let payload;
    try {
        const raw = base64UrlToUint8Array(p);
        payload = JSON.parse(new TextDecoder().decode(raw));
    } catch {
        return null;
    }
    if (payload.iss !== ISS || payload.typ !== TYP) {
        return null;
    }
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
    }
    return payload;
}
