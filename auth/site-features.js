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
            social_oauth_google: { enabled: true, visible: true },
            social_oauth_apple: { enabled: true, visible: true },
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
            sub_graph_library: { enabled: true, visible: true },
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
        /* Legacy KV used a single social_oauth_ui row for both providers */
        var leg = f && f.social_oauth_ui;
        if (leg && typeof leg === "object") {
            var le = leg.enabled !== false;
            var lv = leg.visible !== false;
            if (!f.social_oauth_google || typeof f.social_oauth_google !== "object") {
                d.social_oauth_google = { enabled: le, visible: lv };
            }
            if (!f.social_oauth_apple || typeof f.social_oauth_apple !== "object") {
                d.social_oauth_apple = { enabled: le, visible: lv };
            }
        }
        return d;
    }

    function dispatchReady(detail) {
        try {
            document.dispatchEvent(new CustomEvent("dsa-site-features-ready", { detail: detail }));
        } catch (e) {}
    }

    /**
     * Fetch merged flags from GET /api/site-features (no HTTP cache / CDN stale reads).
     * @param {boolean} [forceRefresh] When true, drop in-memory cache and fetch again (e.g. after admin changes).
     * @returns {Promise<Record<string, {enabled:boolean,visible:boolean}>>}
     */
    function dsaEnsureSiteFeaturesLoaded(forceRefresh) {
        if (forceRefresh) {
            cache = null;
            readyPromise = null;
        }
        if (cache) {
            return Promise.resolve(cache);
        }
        if (readyPromise) {
            return readyPromise;
        }
        var sfUrl = new URL("api/site-features", document.baseURI);
        sfUrl.searchParams.set("_", String(Date.now()));
        readyPromise = fetch(sfUrl.href, {
            credentials: "same-origin",
            cache: "no-store",
            headers: {
                Accept: "application/json",
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
            },
        })
            .then(function (r) {
                return r.json().catch(function () {
                    return {};
                });
            })
            .then(function (j) {
                cache = mergeFromResponse(j && j.features);
                window.__dsaSiteFeatures = cache;
                dispatchReady(cache);
                return cache;
            })
            .catch(function () {
                cache = defaultsAllOn();
                window.__dsaSiteFeatures = cache;
                dispatchReady(cache);
                return cache;
            })
            .finally(function () {
                readyPromise = null;
            });
        return readyPromise;
    }

    /** Invalidate cache and refetch (after visibility change or admin KV updates). */
    function dsaRefreshSiteFeatures() {
        return dsaEnsureSiteFeaturesLoaded(true);
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
    window.dsaRefreshSiteFeatures = dsaRefreshSiteFeatures;
    window.dsaSiteFeatureUse = dsaSiteFeatureUse;
    window.dsaSiteFeatureVisible = dsaSiteFeatureVisible;
    window.dsaSiteFeatureEnabled = dsaSiteFeatureEnabled;

    /** Refetch when the tab is foregrounded so admin Site settings show up without a hard reload. */
    (function attachVisibilityRefetch() {
        var tm = null;
        document.addEventListener("visibilitychange", function () {
            if (document.visibilityState !== "visible") {
                return;
            }
            clearTimeout(tm);
            tm = setTimeout(function () {
                dsaRefreshSiteFeatures().catch(function () {});
            }, 350);
        });
        window.addEventListener("pageshow", function (ev) {
            if (ev.persisted) {
                dsaRefreshSiteFeatures().catch(function () {});
            }
        });
    })();
})();
