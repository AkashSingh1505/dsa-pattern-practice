(function () {
    function formatNumber(n) {
        if (typeof n !== "number" || !isFinite(n)) {
            return "\u2014";
        }
        return n.toLocaleString();
    }

    function setText(selector, value) {
        document.querySelectorAll(selector).forEach(function (el) {
            el.textContent = value;
        });
    }

    function syncPrimaryCtas() {
        var href = "./account.html";
        var label = "Start free";
        var rsa = typeof dsaIsAdminSession === "function" && dsaIsAdminSession();
        var practice = typeof dsaIsPracticeUser === "function" && dsaIsPracticeUser();

        if (rsa) {
            href = "./admin.html";
            label = "Open admin";
        } else if (practice) {
            href = "./user-dashboard.html";
            label = "Open dashboard";
        }

        document.querySelectorAll("[data-marketing-primary-cta]").forEach(function (el) {
            el.setAttribute("href", href);
            el.textContent = label;
        });
    }

    async function loadPublicStats() {
        try {
            var r = await fetch(new URL("api/public-stats", document.baseURI).href, {
                headers: { Accept: "application/json" },
                cache: "no-store",
            });
            if (!r.ok) {
                throw new Error("public-stats HTTP " + r.status);
            }
            var j = await r.json();
            var stats = j && j.stats;
            if (!stats || typeof stats !== "object") {
                return;
            }

            setText('[data-public-stat="subscribers"]', formatNumber(stats.subscribers));
            setText('[data-public-stat="total_users"]', formatNumber(stats.total_users));
            setText('[data-public-stat="active_users"]', formatNumber(stats.active_users));
            setText('[data-public-stat="public_graphs"]', formatNumber(stats.public_graphs));
            setText('[data-public-stat="graph_downloads"]', formatNumber(stats.graph_downloads));
            setText('[data-public-stat="subscriber_contacts"]', formatNumber(stats.subscriber_contacts));

            var plans = stats.plan_counts || {};
            Object.keys(plans).forEach(function (planKey) {
                setText('[data-plan-count="' + planKey + '"]', formatNumber(Number(plans[planKey] || 0)));
            });
        } catch (e) {
            /* Keep server-rendered placeholders if stats are unavailable. */
        }
    }

    function bootMarketingPage() {
        syncPrimaryCtas();
        loadPublicStats();
    }

    document.addEventListener("dsa-site-marketing-ready", function () {
        loadPublicStats();
        syncPrimaryCtas();
    });

    document.addEventListener("dsa-site-features-ready", syncPrimaryCtas);
    window.addEventListener("load", syncPrimaryCtas);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bootMarketingPage);
    } else {
        bootMarketingPage();
    }
})();
