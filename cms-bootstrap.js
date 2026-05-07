/**
 * Loads CMS JSON from /api/data (D1 only). No static /data/*.json fallback.
 * Must run before script.js uses `projects` / home / skills.
 */

function coerceCmsArray(raw) {
    if (raw == null) {
        return [];
    }
    if (typeof raw === "string") {
        try {
            raw = JSON.parse(raw);
        } catch (e) {
            return [];
        }
    }
    if (Array.isArray(raw)) {
        return raw;
    }
    if (raw && typeof raw === "object") {
        if (Array.isArray(raw.skills)) {
            return raw.skills;
        }
        if (Array.isArray(raw.items)) {
            return raw.items;
        }
        if (Array.isArray(raw.data)) {
            return raw.data;
        }
        if (Array.isArray(raw.projects)) {
            return raw.projects;
        }
    }
    return [];
}

function coerceCmsHome(raw) {
    if (raw == null || raw === undefined) {
        return null;
    }
    if (typeof raw === "string") {
        try {
            raw = JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }
    if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
        return raw;
    }
    return null;
}

async function fetchCmsKey(key) {
    try {
        const url =
            typeof window !== "undefined" && window.location
                ? new URL(`api/data?k=${encodeURIComponent(key)}`, window.location.href).href
                : `/api/data?k=${encodeURIComponent(key)}`;
        const r = await fetch(url, { cache: "no-store" });
        if (r.status === 503) {
            console.warn("CMS: D1 not bound or unavailable", key);
            return key === "home" ? null : [];
        }
        if (!r.ok) {
            console.warn("CMS: bad response", key, r.status);
            return key === "home" ? null : [];
        }
        const data = await r.json();
        if (key === "home") {
            return coerceCmsHome(data);
        }
        return coerceCmsArray(data);
    } catch (e) {
        console.warn("CMS fetch", key, e);
        return key === "home" ? null : [];
    }
}

async function cmsBootstrap() {
    const [p, s, h] = await Promise.all([
        fetchCmsKey("projects"),
        fetchCmsKey("skills"),
        fetchCmsKey("home"),
    ]);
    window.__CMS = {
        projects: coerceCmsArray(p),
        skills: coerceCmsArray(s),
        home: h && typeof h === "object" ? h : null,
    };
}
