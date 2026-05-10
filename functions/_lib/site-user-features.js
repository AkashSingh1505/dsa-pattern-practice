/**
 * Site-wide feature flags for end users (stored in content D1 `app_kv`).
 * @see GET /api/site-features
 */

export const SITE_USER_FEATURES_KV_KEY = "site_user_features";

export function defaultSiteUserFeatures() {
    return {
        practice_map: { enabled: true, visible: true },
        one_topic_mode: { enabled: true, visible: true },
        graph_customize_tab: { enabled: true, visible: true },
        member_dashboard: { enabled: true, visible: true },
        practice_auth: { enabled: true, visible: true },
        social_oauth_ui: { enabled: true, visible: true },
        site_admin_link: { enabled: true, visible: true },
        footer_visit_counter: { enabled: true, visible: true },
    };
}

/**
 * @param {string|null|undefined} v Raw `app_kv.v` JSON string
 * @returns {Record<string, { enabled: boolean, visible: boolean }>}
 */
export function mergeSiteUserFeaturesFromKv(v) {
    const defs = defaultSiteUserFeatures();
    const out = JSON.parse(JSON.stringify(defs));
    if (!v || typeof v !== "string") {
        return out;
    }
    let parsed = {};
    try {
        parsed = JSON.parse(v);
    } catch {
        return out;
    }
    if (!parsed || typeof parsed !== "object") {
        return out;
    }
    for (const key of Object.keys(defs)) {
        const row = parsed[key];
        if (!row || typeof row !== "object") {
            continue;
        }
        if (typeof row.enabled === "boolean") {
            out[key].enabled = row.enabled;
        }
        if (typeof row.visible === "boolean") {
            out[key].visible = row.visible;
        }
    }
    return out;
}
