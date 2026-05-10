/**
 * Fetches public GET /api/site-features and exposes helpers for gating UI site-wide.
 * Load before script.js (index) and before portal scripts that need gating.
 */
(function () {
    var readyPromise = null;
    var cache = null;

    function defaultsAllOn() {
        return {
            practice_map: { enabled: true, visible: true },
            one_topic_mode: { enabled: true, visible: true },
            graph_customize_tab: { enabled: true, visible: true },
            member_dashboard: { enabled: true, visible: true },
            practice_auth: { enabled: true, visible: true },
            social_oauth_ui: { enabled: true, visible: true },
            site_admin_link: { enabled: true, visible: true },
            footer_visit_counter: { enabled: true, visible: true },
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
        };
    }

    function mergeFromResponse(f) {
        var d = defaultsAllOn();
        if (!f || typeof f !== "object") {
            return d;
        }
        Object.keys(d).forEach(function (k) {
            var row = f[k];
            if (row && typeof row === "object") {
                if (typeof row.enabled === "boolean") {
                    d[k].enabled = row.enabled;
                }
                if (typeof row.visible === "boolean") {
                    d[k].visible = row.visible;
                }
            }
        });
        return d;
    }

    /**
     * @returns {Promise<Record<string, {enabled:boolean,visible:boolean}>>}
     */
    function dsaEnsureSiteFeaturesLoaded() {
        if (cache) {
            return Promise.resolve(cache);
        }
        if (readyPromise) {
            return readyPromise;
        }
        readyPromise = fetch(new URL("api/site-features", document.baseURI).href, {
            credentials: "same-origin",
            headers: { Accept: "application/json" },
        })
            .then(function (r) {
                return r.json().catch(function () {
                    return {};
                });
            })
            .then(function (j) {
                cache = mergeFromResponse(j && j.features);
                window.__dsaSiteFeatures = cache;
                try {
                    document.dispatchEvent(new CustomEvent("dsa-site-features-ready", { detail: cache }));
                } catch (e) {}
                return cache;
            })
            .catch(function () {
                cache = defaultsAllOn();
                window.__dsaSiteFeatures = cache;
                try {
                    document.dispatchEvent(new CustomEvent("dsa-site-features-ready", { detail: cache }));
                } catch (e) {}
                return cache;
            });
        return readyPromise;
    }

    function state(id) {
        var f = (window.__dsaSiteFeatures || {})[id];
        if (!f || typeof f !== "object") {
            return { enabled: true, visible: true };
        }
        return {
            enabled: f.enabled !== false,
            visible: f.visible !== false,
        };
    }

    /** Both on — feature is offered and discoverable. */
    function dsaSiteFeatureUse(id) {
        var s = state(id);
        return s.enabled && s.visible;
    }

    /** Shown in navigation / chrome (may still be disabled). */
    function dsaSiteFeatureVisible(id) {
        return state(id).visible !== false;
    }

    function dsaSiteFeatureEnabled(id) {
        return state(id).enabled !== false;
    }

    window.dsaEnsureSiteFeaturesLoaded = dsaEnsureSiteFeaturesLoaded;
    window.dsaSiteFeatureUse = dsaSiteFeatureUse;
    window.dsaSiteFeatureVisible = dsaSiteFeatureVisible;
    window.dsaSiteFeatureEnabled = dsaSiteFeatureEnabled;
})();
