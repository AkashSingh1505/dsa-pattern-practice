/**
 * RSA JWT for site admin (GitHub OAuth worker). Shared by /api/data and /api/admin/*.
 */

const ISS = "dsa-portfolio-admin";
const ADMIN_GH = "AkashSingh1505";

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
        ["verify"],
    );
    return cachedPub;
}

/** @param {string} token */
export async function verifyAdminJwt(token) {
    if (!token || typeof token !== "string") {
        return false;
    }
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
    let sig;
    try {
        sig = base64UrlToUint8Array(s);
    } catch {
        return false;
    }
    const pub = await getPubKey();
    try {
        return await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, pub, sig, data);
    } catch {
        return false;
    }
}
