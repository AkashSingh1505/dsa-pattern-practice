/**
 * Member dashboard (user-dashboard.html): auth gate, plan-based UI, section nav.
 */
(function () {
    function isPracticeUser() {
        return typeof dsaIsPracticeUser === "function" && dsaIsPracticeUser();
    }

    /** Paid member (pro / team / lifetime or subscriber role) — for gating product features, not staff RSA. */
    function isPaidMember() {
        var c = typeof dsaParsePracticeUserClaims === "function" ? dsaParsePracticeUserClaims() : null;
        if (!c) {
            return false;
        }
        if (typeof dsaIsSubscriberRole === "function") {
            return dsaIsSubscriberRole(c);
        }
        var p = String(c.plan || "free");
        return p === "pro" || p === "team" || p === "lifetime" || c.role === "subscriber" || c.role === "admin";
    }

    function applyPlanChrome() {
        var pill = document.getElementById("dsa-udash-plan-pill");
        var sub = isPaidMember();
        if (pill) {
            pill.textContent = sub ? "Pro / paid" : "Free";
            pill.classList.toggle("dsa-udash-plan-pill--pro", sub);
        }

        document.querySelectorAll("[data-requires-paid]").forEach(function (el) {
            var needPaid = el.getAttribute("data-requires-paid") !== "false";
            var locked = needPaid && !sub;
            el.classList.toggle("is-locked", locked);
            el.querySelectorAll("[data-paid-control]").forEach(function (innerBtn) {
                innerBtn.disabled = locked;
                if (locked) {
                    innerBtn.setAttribute("title", "Included with paid plans");
                } else {
                    innerBtn.removeAttribute("title");
                }
            });
        });

        var customizeBtn = document.getElementById("dsa-udash-open-customize");
        if (customizeBtn) {
            var canCustomize = typeof dsaHasCustomizeGraphAccess === "function" && dsaHasCustomizeGraphAccess();
            customizeBtn.disabled = !canCustomize;
            customizeBtn.removeAttribute("aria-disabled");
            if (!canCustomize) {
                customizeBtn.setAttribute("aria-disabled", "true");
            }
        }
    }

    function applyComingSoon() {
        document.querySelectorAll("[data-coming-soon]").forEach(function (el) {
            el.classList.add("is-locked");
            el.querySelectorAll("button, input, select, textarea").forEach(function (ctrl) {
                ctrl.disabled = true;
            });
        });
    }

    function fillProfile() {
        var c = typeof dsaParsePracticeUserClaims === "function" ? dsaParsePracticeUserClaims() : null;
        var emailEl = document.getElementById("dsa-udash-profile-email");
        var planEl = document.getElementById("dsa-udash-profile-plan");
        if (emailEl && c) {
            emailEl.textContent = c.email || "—";
        }
        if (planEl && c) {
            planEl.textContent = (c.plan || "free") + " · " + (c.role || "user");
        }
    }

    function wireSignOut() {
        var btn = document.getElementById("dsa-udash-signout");
        if (!btn) {
            return;
        }
        btn.addEventListener("click", function () {
            if (typeof dsaPracticeUserSignOut === "function") {
                dsaPracticeUserSignOut();
            }
            window.location.href = "./account.html";
        });
    }

    function wireNotifBell() {
        var btn = document.getElementById("dsa-udash-notif-bell");
        if (!btn) {
            return;
        }
        btn.addEventListener("click", function () {
            var t = document.getElementById("dash-notifications");
            if (t) {
                t.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    }

    function init() {
        if (!isPracticeUser()) {
            var next = "user-dashboard.html";
            try {
                window.location.href = "./account.html?next=" + encodeURIComponent(next);
            } catch (e) {
                window.location.href = "./account.html";
            }
            return;
        }

        fillProfile();
        applyPlanChrome();
        applyComingSoon();
        wireSignOut();
        wireNotifBell();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
