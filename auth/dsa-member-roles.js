/**
 * Product roles (practice account + staff). Values: `free`, `subscriber`, `staff_admin`.
 *
 * - free — signed-in practice user on `plan: free` (typical `role: user`).
 * - subscriber — paid capability: plan pro / team / lifetime and/or DB `role: subscriber` (legacy `admin` counts as paid-capable).
 * - staff_admin — RSA session on `admin.html` only; not a practice_users variant.
 *
 * Load order: after `dsa-admin-auth.js`, before `dsa-user-auth.js`.
 */
(function () {
    var PAID_PLANS = { pro: 1, team: 1, lifetime: 1 };

    var MEMBER_ROLES = Object.freeze({
        FREE: "free",
        SUBSCRIBER: "subscriber",
        STAFF_ADMIN: "staff_admin",
    });

    /**
     * @param {string} [role]
     * @param {string} [plan]
     * @returns {"free"|"subscriber"}
     */
    function dsaMemberRoleFromPractice(role, plan) {
        var r = String(role || "user");
        var p = String(plan || "free");
        if (PAID_PLANS[p]) {
            return MEMBER_ROLES.SUBSCRIBER;
        }
        if (r === "subscriber") {
            return MEMBER_ROLES.SUBSCRIBER;
        }
        if (r === "admin") {
            return MEMBER_ROLES.SUBSCRIBER;
        }
        return MEMBER_ROLES.FREE;
    }

    /**
     * @returns {"free"|"subscriber"|null} null if not signed in as a practice user
     */
    function dsaGetPracticeMemberRole() {
        if (typeof dsaParsePracticeUserClaims !== "function") {
            return null;
        }
        var c = dsaParsePracticeUserClaims();
        if (!c) {
            return null;
        }
        return dsaMemberRoleFromPractice(c.role, c.plan);
    }

    /**
     * Paid / subscriber capability from JWT claims.
     * @param {{ role?: string, plan?: string } | null} claims
     */
    function dsaIsSubscriberRole(claims) {
        if (!claims || typeof claims !== "object") {
            return false;
        }
        return dsaMemberRoleFromPractice(claims.role, claims.plan) === MEMBER_ROLES.SUBSCRIBER;
    }

    /**
     * @param {{ role?: string, plan?: string } | null} claims
     */
    function dsaIsFreeRole(claims) {
        if (!claims || typeof claims !== "object") {
            return false;
        }
        return dsaMemberRoleFromPractice(claims.role, claims.plan) === MEMBER_ROLES.FREE;
    }

    /** Site operator — RSA admin JWT, not practice account. */
    function dsaIsStaffAdmin() {
        return typeof dsaIsAdminSession === "function" && dsaIsAdminSession();
    }

    /**
     * Single resolved role for UI/analytics: staff wins, then practice subscriber/free, else null (visitor).
     * @returns {"free"|"subscriber"|"staff_admin"|null}
     */
    function dsaResolveMemberRole() {
        if (dsaIsStaffAdmin()) {
            return MEMBER_ROLES.STAFF_ADMIN;
        }
        var pr = dsaGetPracticeMemberRole();
        return pr;
    }

    window.dsaMemberRoles = MEMBER_ROLES;
    window.dsaMemberRoleFromPractice = dsaMemberRoleFromPractice;
    window.dsaGetPracticeMemberRole = dsaGetPracticeMemberRole;
    window.dsaIsSubscriberRole = dsaIsSubscriberRole;
    window.dsaIsFreeRole = dsaIsFreeRole;
    window.dsaIsStaffAdmin = dsaIsStaffAdmin;
    window.dsaResolveMemberRole = dsaResolveMemberRole;
})();
