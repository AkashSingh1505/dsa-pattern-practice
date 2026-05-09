/**
 * Admin session — verified with RSA public key only (safe to ship).
 * Tokens are issued only by your Worker (GitHub OAuth, password, or TOTP; private key never in the repo).
 */
(function () {
    const JWT_STORAGE_KEY = "dsaAdminJwtV1";
    const ISS = "dsa-portfolio-admin";
    const ADMIN_GH_CLAIM = "gh";
    /** Must match Worker env ADMIN_GITHUB_LOGIN */
    const ADMIN_GITHUB_LOGIN = "AkashSingh1505";

    let cachedPubKey = null;
    let sessionValid = false;

    function storageGetToken() {
        try {
            const localTok = localStorage.getItem(JWT_STORAGE_KEY);
            if (localTok) {
                return localTok;
            }
        } catch (e) {
            /* ignore */
        }
        try {
            const sessionTok = sessionStorage.getItem(JWT_STORAGE_KEY);
            if (sessionTok) {
                return sessionTok;
            }
        } catch (e) {
            /* ignore */
        }
        return null;
    }

    function storageSetToken(token) {
        try {
            localStorage.setItem(JWT_STORAGE_KEY, token);
        } catch (e) {
            /* ignore */
        }
        try {
            sessionStorage.setItem(JWT_STORAGE_KEY, token);
        } catch (e) {
            /* ignore */
        }
    }

    function storageRemoveToken() {
        try {
            localStorage.removeItem(JWT_STORAGE_KEY);
        } catch (e) {
            /* ignore */
        }
        try {
            sessionStorage.removeItem(JWT_STORAGE_KEY);
        } catch (e) {
            /* ignore */
        }
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

    function utf8FromBase64UrlPayload(b64url) {
        const bytes = base64UrlToUint8Array(b64url);
        return new TextDecoder().decode(bytes);
    }

    function getMetaOAuthBase() {
        const m = document.querySelector('meta[name="dsa-admin-oauth-base"]');
        return (m && m.getAttribute("content") || "").trim();
    }

    async function loadPublicKeyCrypto() {
        if (cachedPubKey) {
            return cachedPubKey;
        }
        const path = window.location.pathname || "";
        const baseForAuthAssets = document.querySelector("base[href]")
            ? document.baseURI
            : window.location.href;
        const pemHref =
            path.includes("/skill pages/") || path.includes("/project pages/")
                ? new URL("../auth/dsa-admin-public.pem", window.location.href).href
                : new URL("auth/dsa-admin-public.pem", baseForAuthAssets).href;
        const r = await fetch(pemHref, { cache: "force-cache" });
        const pem = await r.text();
        const pemBody = pem
            .replace(/-----BEGIN PUBLIC KEY-----/g, "")
            .replace(/-----END PUBLIC KEY-----/g, "")
            .replace(/\s/g, "");
        const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
        const key = await crypto.subtle.importKey(
            "spki",
            binaryDer,
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            false,
            ["verify"]
        );
        cachedPubKey = key;
        return key;
    }

    async function verifyToken(token) {
        const parts = token.split(".");
        if (parts.length !== 3) {
            return false;
        }
        const [h, p, s] = parts;
        let payload;
        try {
            payload = JSON.parse(utf8FromBase64UrlPayload(p));
        } catch (e) {
            return false;
        }
        if (payload.iss !== ISS) {
            return false;
        }
        if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) {
            return false;
        }
        const isLegacyGithub =
            payload.sub === "github" &&
            typeof payload[ADMIN_GH_CLAIM] === "string" &&
            payload[ADMIN_GH_CLAIM] === ADMIN_GITHUB_LOGIN;
        if (payload.admin !== true && !isLegacyGithub) {
            return false;
        }
        const data = new TextEncoder().encode(`${h}.${p}`);
        const sig = base64UrlToUint8Array(s);
        const pub = await loadPublicKeyCrypto();
        const ok = await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, pub, sig, data);
        return ok;
    }

    function consumeHashToken() {
        const hash = window.location.hash || "";
        if (!hash.startsWith("#")) {
            return null;
        }
        const params = new URLSearchParams(hash.slice(1));
        const t = params.get("dsa_admin_jwt");
        if (!t) {
            return null;
        }
        params.delete("dsa_admin_jwt");
        const rest = params.toString();
        const newHash = rest ? `#${rest}` : "";
        const path = window.location.pathname + window.location.search + newHash;
        window.history.replaceState(null, "", path);
        return t;
    }

    async function dsaInitAdminAuth() {
        sessionValid = false;
        let token = consumeHashToken();
        if (!token) {
            token = storageGetToken();
        }
        if (!token) {
            return false;
        }
        let ok = false;
        try {
            ok = await verifyToken(token);
        } catch (e) {
            console.warn("dsaInitAdminAuth: token verify failed", e);
            ok = false;
        }
        if (!ok) {
            storageRemoveToken();
            return false;
        }
        storageSetToken(token);
        sessionValid = true;
        return true;
    }

    function dsaIsAdminSession() {
        return sessionValid;
    }

    /** JWT for PUT /api/data (same storage as session). Empty if not signed in. */
    function dsaGetAdminJwt() {
        if (!sessionValid) {
            return "";
        }
        return storageGetToken() || "";
    }

    function dsaGetAdminSignInUrl() {
        const base = getMetaOAuthBase().replace(/\/+$/, "");
        if (!base) {
            return "";
        }
        const ret = window.location.href.split("#")[0];
        return `${base}/login?return=${encodeURIComponent(ret)}`;
    }

    function dsaAdminSignOut() {
        sessionValid = false;
        storageRemoveToken();
    }

    window.dsaInitAdminAuth = dsaInitAdminAuth;
    window.dsaIsAdminSession = dsaIsAdminSession;
    window.dsaGetAdminJwt = dsaGetAdminJwt;
    window.dsaGetAdminSignInUrl = dsaGetAdminSignInUrl;
    window.dsaAdminSignOut = dsaAdminSignOut;
})();
