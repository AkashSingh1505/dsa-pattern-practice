/**
 * Fetches public GET /api/site-features and exposes helpers for gating UI site-wide.
 * Merge rules mirror functions/_lib/site-user-features.js so DB-backed flags apply consistently.
 * Load before script.js (index) and before portal scripts that need gating.
 */
(function () {
    var readyPromise = null;
    var cache = null;
    var SNAP_KEY = "dsa_sf_snap_v1";
    var BC_NAME = "dsa_site_features_v1";

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

    /**
     * Same semantics as mergeSiteUserFeaturesFromKv (object form of merged KV).
     * @param {Record<string, {enabled?:boolean,visible?:boolean}>|null|undefined} parsed
     */
    function mergeFeaturesPayload(parsed) {
        var defs = defaultsAllOn();
        var out = {};
        Object.keys(defs).forEach(function (k) {
            out[k] = { enabled: !!defs[k].enabled, visible: !!defs[k].visible };
        });
        if (!parsed || typeof parsed !== "object") {
            return applyLegacyOAuthMigration(out, {});
        }
        Object.keys(defs).forEach(function (key) {
            var row = parsed[key];
            if (!row || typeof row !== "object") {
                return;
            }
            if (typeof row.enabled === "boolean") {
                out[key].enabled = row.enabled;
            }
            if (typeof row.visible === "boolean") {
                out[key].visible = row.visible;
            }
        });
        Object.keys(parsed).forEach(function (key) {
            if (defs[key]) {
                return;
            }
            var row = parsed[key];
            if (!row || typeof row !== "object") {
                return;
            }
            out[key] = { enabled: true, visible: true };
            if (typeof row.enabled === "boolean") {
                out[key].enabled = row.enabled;
            }
            if (typeof row.visible === "boolean") {
                out[key].visible = row.visible;
            }
        });
        return applyLegacyOAuthMigration(out, parsed);
    }

    function applyLegacyOAuthMigration(out, parsed) {
        var legacy = parsed.social_oauth_ui;
        if (legacy && typeof legacy === "object") {
            var le = legacy.enabled !== false;
            var lv = legacy.visible !== false;
            var hasG = parsed.social_oauth_google && typeof parsed.social_oauth_google === "object";
            var hasA = parsed.social_oauth_apple && typeof parsed.social_oauth_apple === "object";
            if (!hasG && out.social_oauth_google) {
                out.social_oauth_google = { enabled: le, visible: lv };
            }
            if (!hasA && out.social_oauth_apple) {
                out.social_oauth_apple = { enabled: le, visible: lv };
            }
        }
        return out;
    }

    function persistSnapshot(features) {
        try {
            localStorage.setItem(
                SNAP_KEY,
                JSON.stringify({ savedAt: Date.now(), features: features }),
            );
        } catch (e) {}
    }

    function readSnapshotFeatures() {
        try {
            var raw = localStorage.getItem(SNAP_KEY);
            if (!raw) {
                return null;
            }
            var o = JSON.parse(raw);
            return o && o.features && typeof o.features === "object" ? o.features : null;
        } catch (e) {
            return null;
        }
    }

    function dispatchReady(detail) {
        try {
            document.dispatchEvent(new CustomEvent("dsa-site-features-ready", { detail: detail }));
        } catch (e) {}
    }

    function commitCache(merged) {
        cache = merged;
        window.__dsaSiteFeatures = cache;
        persistSnapshot(cache);
        dispatchReady(cache);
        return cache;
    }

    function fetchSiteFeaturesOnce() {
        var sfUrl = new URL("api/site-features", document.baseURI);
        sfUrl.searchParams.set("_", String(Date.now()));
        return fetch(sfUrl.href, {
            credentials: "same-origin",
            cache: "no-store",
            headers: {
                Accept: "application/json",
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
            },
        }).then(function (r) {
            if (!r.ok) {
                throw new Error("site-features HTTP " + r.status);
            }
            return r.json();
        });
    }

    function fetchSiteFeaturesWithRetries(attempt) {
        attempt = attempt || 0;
        return fetchSiteFeaturesOnce().catch(function (err) {
            if (attempt >= 2) {
                throw err;
            }
            return new Promise(function (resolve, reject) {
                setTimeout(function () {
                    fetchSiteFeaturesWithRetries(attempt + 1)
                        .then(resolve)
                        .catch(reject);
                }, 320 * (attempt + 1));
            });
        });
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
        readyPromise = fetchSiteFeaturesWithRetries(0)
            .then(function (j) {
                var feat = j && (j.features || (j.data && j.data.features));
                if (!feat || typeof feat !== "object") {
                    throw new Error("site-features: missing features object");
                }
                return commitCache(mergeFeaturesPayload(feat));
            })
            .catch(function () {
                var snap = readSnapshotFeatures();
                var merged = mergeFeaturesPayload(snap || {});
                return commitCache(merged);
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

    /** Called after admin saves site_user_features so all tabs reload flags from D1. */
    function dsaNotifySiteFeaturesChanged() {
        try {
            localStorage.setItem("dsa_sf_rev", String(Date.now()));
        } catch (e) {}
        try {
            var bc = new BroadcastChannel(BC_NAME);
            bc.postMessage({ bump: true });
            bc.close();
        } catch (e) {}
        dsaRefreshSiteFeatures().catch(function () {});
    }

    window.dsaEnsureSiteFeaturesLoaded = dsaEnsureSiteFeaturesLoaded;
    window.dsaRefreshSiteFeatures = dsaRefreshSiteFeatures;
    window.dsaSiteFeatureUse = dsaSiteFeatureUse;
    window.dsaSiteFeatureVisible = dsaSiteFeatureVisible;
    window.dsaSiteFeatureEnabled = dsaSiteFeatureEnabled;
    window.dsaNotifySiteFeaturesChanged = dsaNotifySiteFeaturesChanged;

    try {
        var bcListen = new BroadcastChannel(BC_NAME);
        bcListen.onmessage = function () {
            dsaRefreshSiteFeatures().catch(function () {});
        };
    } catch (e) {}

    window.addEventListener("storage", function (ev) {
        if (ev.key === "dsa_sf_rev") {
            dsaRefreshSiteFeatures().catch(function () {});
        }
    });

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

    try {
        dsaEnsureSiteFeaturesLoaded().catch(function () {});
    } catch (e) {}
})();
