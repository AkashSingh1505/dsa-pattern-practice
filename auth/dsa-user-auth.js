/**
 * Practice account session (email/password via /api/auth/*). Separate from site-admin RSA JWT.
 */
(function () {
    const JWT_STORAGE_KEY = "dsaPracticeUserJwtV1";

    function storageGet() {
        try {
            return localStorage.getItem(JWT_STORAGE_KEY) || sessionStorage.getItem(JWT_STORAGE_KEY) || "";
        } catch (e) {
            return "";
        }
    }

    function storageSet(token) {
        try {
            localStorage.setItem(JWT_STORAGE_KEY, token);
        } catch (e) {}
        try {
            sessionStorage.setItem(JWT_STORAGE_KEY, token);
        } catch (e) {}
    }

    function storageRemove() {
        try {
            localStorage.removeItem(JWT_STORAGE_KEY);
        } catch (e) {}
        try {
            sessionStorage.removeItem(JWT_STORAGE_KEY);
        } catch (e) {}
    }

    function decodePayload(token) {
        if (!token || typeof token !== "string") {
            return null;
        }
        const parts = token.split(".");
        if (parts.length !== 3) {
            return null;
        }
        try {
            let p = parts[1].replace(/-/g, "+").replace(/_/g, "/");
            const pad = p.length % 4;
            if (pad) {
                p += "====".slice(0, 4 - pad);
            }
            const json = atob(p);
            return JSON.parse(json);
        } catch (e) {
            return null;
        }
    }

    function isPayloadFresh(payload) {
        if (!payload || typeof payload !== "object") {
            return false;
        }
        if (payload.typ !== "practice" || payload.iss !== "dsa-pattern-practice") {
            return false;
        }
        if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) {
            return false;
        }
        return true;
    }

    function dsaGetPracticeUserToken() {
        return storageGet();
    }

    function dsaParsePracticeUserClaims() {
        const t = storageGet();
        const p = decodePayload(t);
        if (!isPayloadFresh(p)) {
            return null;
        }
        return {
            email: String(p.sub || ""),
            role: String(p.role || "user"),
            plan: String(p.plan || "free"),
        };
    }

    function dsaIsPracticeUser() {
        return !!dsaParsePracticeUserClaims();
    }

    /**
     * Customize graph tab: site RSA admin, or paid plan, or practice roles admin / subscriber.
     */
    function dsaHasCustomizeGraphAccess() {
        if (typeof dsaIsAdminSession === "function" && dsaIsAdminSession()) {
            return true;
        }
        const c = dsaParsePracticeUserClaims();
        if (!c) {
            return false;
        }
        if (c.role === "admin" || c.role === "subscriber") {
            return true;
        }
        if (c.plan === "pro" || c.plan === "team" || c.plan === "lifetime") {
            return true;
        }
        return false;
    }

    function dsaPracticeUserSetToken(token) {
        if (token && typeof token === "string") {
            storageSet(token.trim());
        }
    }

    function dsaPracticeUserSignOut() {
        storageRemove();
    }

    window.dsaGetPracticeUserToken = dsaGetPracticeUserToken;
    window.dsaParsePracticeUserClaims = dsaParsePracticeUserClaims;
    window.dsaIsPracticeUser = dsaIsPracticeUser;
    window.dsaHasCustomizeGraphAccess = dsaHasCustomizeGraphAccess;
    window.dsaPracticeUserSetToken = dsaPracticeUserSetToken;
    window.dsaPracticeUserSignOut = dsaPracticeUserSignOut;
})();
