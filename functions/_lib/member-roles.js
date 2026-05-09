/**
 * Product roles for Workers: `free`, `subscriber`, `staff_admin`.
 * Practice rows map to free | subscriber; staff_admin is RSA-only (see admin-api).
 *
 * Public visitors are unauthenticated — no role here.
 */

export const MEMBER_ROLES = Object.freeze({
    FREE: "free",
    SUBSCRIBER: "subscriber",
    STAFF_ADMIN: "staff_admin",
});

export const PAID_PLANS = new Set(["pro", "team", "lifetime"]);

/**
 * @param {string} [role]
 * @param {string} [plan]
 * @returns {"free" | "subscriber"}
 */
export function practiceMemberRoleFromRolePlan(role, plan) {
    const r = String(role || "user");
    const p = String(plan || "free");
    if (PAID_PLANS.has(p)) {
        return MEMBER_ROLES.SUBSCRIBER;
    }
    if (r === "subscriber" || r === "admin") {
        return MEMBER_ROLES.SUBSCRIBER;
    }
    return MEMBER_ROLES.FREE;
}

/**
 * Subscriber / paid-capable practice user (for API gates; add entitlements as needed).
 * @param {string} [role]
 * @param {string} [plan]
 */
export function isSubscriberPracticeMember(role, plan) {
    return practiceMemberRoleFromRolePlan(role, plan) === MEMBER_ROLES.SUBSCRIBER;
}
