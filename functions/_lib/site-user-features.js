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
        social_oauth_google: { enabled: true, visible: true },
        social_oauth_apple: { enabled: true, visible: true },
        site_admin_link: { enabled: true, visible: true },
        footer_visit_counter: { enabled: true, visible: true },
        /** Member hub — Pro / roadmap (admin can pre-disable before launch) */
        sub_personal_graphs: { enabled: true, visible: true },
        sub_shared_inbox: { enabled: true, visible: true },
        sub_collaboration: { enabled: true, visible: true },
        sub_quiz_lab: { enabled: true, visible: true },
        sub_digest: { enabled: true, visible: true },
        sub_study_module: { enabled: true, visible: true },
        sub_quizzes_module: { enabled: true, visible: true },
        sub_reminders_module: { enabled: true, visible: true },
        sub_billing_module: { enabled: true, visible: true },
        sub_alerts_module: { enabled: true, visible: true },
        sub_settings_module: { enabled: true, visible: true },
        sub_profile_module: { enabled: true, visible: true },
        sub_overview_stats: { enabled: true, visible: true },
        /** Community + personal cloud graph library (D1-backed) */
        sub_graph_library: { enabled: true, visible: true },
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
    const legacy = parsed.social_oauth_ui;
    if (legacy && typeof legacy === "object") {
        const le = legacy.enabled !== false;
        const lv = legacy.visible !== false;
        const hasG = parsed.social_oauth_google && typeof parsed.social_oauth_google === "object";
        const hasA = parsed.social_oauth_apple && typeof parsed.social_oauth_apple === "object";
        if (!hasG) {
            out.social_oauth_google = { enabled: le, visible: lv };
        }
        if (!hasA) {
            out.social_oauth_apple = { enabled: le, visible: lv };
        }
    }
    return out;
}
