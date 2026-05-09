/**
 * Single-page shell: #app = practice map, #sign-in = portal (practice), #admin = admin dashboard.
 */
(function () {
    function parseShellHash() {
        let raw = (window.location.hash || "").replace(/^#/, "").trim();
        if (!raw) {
            raw = "app";
        }
        const base = raw.split("&")[0].split("?")[0].toLowerCase();
        return { base, raw };
    }

    window.dsaApplyShellRoute = function () {
        const { base } = parseShellHash();
        const app = document.getElementById("dsa-route-app");
        const portal = document.getElementById("dsa-route-portal");
        const foot = document.querySelector("footer.footer");

        const showPortal =
            base === "sign-in" ||
            base === "signin" ||
            base === "account" ||
            base === "admin" ||
            base === "cms";

        if (app) {
            app.hidden = showPortal;
        }
        if (foot) {
            foot.hidden = showPortal;
        }
        if (portal) {
            portal.hidden = !showPortal;
        }

        const adminTab = base === "admin" || base === "cms";
        const tabPractice = document.getElementById("portal-tab-practice");
        const tabCms = document.getElementById("portal-tab-cms");
        if (showPortal && tabPractice && tabCms) {
            if (adminTab) {
                tabCms.click();
            } else {
                tabPractice.click();
            }
        }

        const appLink = document.getElementById("nav-link-app");
        const adminLink = document.getElementById("nav-link-admin");
        if (appLink) {
            const appActive = !showPortal || base === "app";
            appLink.classList.toggle("active", appActive);
            if (appActive) {
                appLink.setAttribute("aria-current", "page");
            } else {
                appLink.removeAttribute("aria-current");
            }
        }
        if (adminLink) {
            const admActive = showPortal && adminTab;
            adminLink.classList.toggle("active", admActive);
            if (admActive) {
                adminLink.setAttribute("aria-current", "page");
            } else {
                adminLink.removeAttribute("aria-current");
            }
        }

        if (showPortal && adminTab && typeof window.dsaPortalSyncAdminUi === "function") {
            window.dsaPortalSyncAdminUi();
        }
    };

    window.addEventListener("hashchange", function () {
        window.dsaApplyShellRoute();
    });
})();
