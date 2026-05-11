import { verifyPracticeToken } from "../../_lib/practice-jwt.js";
import { subscribersDb } from "../../_lib/d1-bindings.js";

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function parseJsonObj(s, fallback = {}) {
    if (!s || typeof s !== "string") {
        return fallback;
    }
    try {
        const o = JSON.parse(s);
        return o && typeof o === "object" && !Array.isArray(o) ? o : fallback;
    } catch {
        return fallback;
    }
}

function formatProfile(row) {
    if (!row) {
        return null;
    }
    const social = parseJsonObj(row.social_json, {});
    const expRaw = parseJsonObj(row.experience_json, {});
    return {
        display_name: row.display_name || "",
        bio: row.bio || "",
        timezone: row.timezone || "",
        locale: row.locale || "",
        avatar_url: row.avatar_url || "",
        avatar_data_url: row.avatar_data_url || "",
        prefs_json: row.prefs_json || "",
        gender: row.gender || "",
        location: row.location || "",
        birthday: row.birthday || "",
        social: {
            github: social.github != null ? String(social.github) : "",
            linkedin: social.linkedin != null ? String(social.linkedin) : "",
            x: social.x != null ? String(social.x) : "",
            readme: social.readme != null ? String(social.readme) : "",
        },
        experience: {
            work: expRaw.work != null ? String(expRaw.work) : "",
            education: expRaw.education != null ? String(expRaw.education) : "",
            skills: expRaw.skills != null ? String(expRaw.skills) : "",
        },
    };
}

async function userIdFromToken(db, payload) {
    const email = String(payload.sub || "")
        .trim()
        .toLowerCase();
    if (!email) {
        return null;
    }
    const row = await db.prepare("SELECT id FROM practice_users WHERE email = ? COLLATE NOCASE").bind(email).first();
    return row && row.id != null ? row.id : null;
}

export async function onRequestGet(context) {
    const { request, env } = context;
    if (!env.USER_JWT_SECRET) {
        return json({ error: "USER_JWT_SECRET not configured" }, 503);
    }
    const auth = request.headers.get("Authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) {
        return json({ error: "unauthorized" }, 401);
    }
    const payload = await verifyPracticeToken(m[1].trim(), env.USER_JWT_SECRET);
    if (!payload) {
        return json({ error: "invalid token" }, 401);
    }

    const db = subscribersDb(env);
    let profile = null;
    if (db) {
        const uid = await userIdFromToken(db, payload);
        if (uid) {
            try {
                const row = await db.prepare("SELECT * FROM user_profiles WHERE user_id = ?").bind(uid).first();
                profile = formatProfile(row);
            } catch (e) {
                console.warn("me profile read", e);
            }
        }
    }

    return json({
        ok: true,
        email: payload.sub,
        role: payload.role,
        plan: payload.plan,
        profile,
    });
}

const PROFILE_STRING_FIELDS = [
    "display_name",
    "bio",
    "timezone",
    "locale",
    "avatar_url",
    "avatar_data_url",
    "prefs_json",
    "social_json",
    "gender",
    "location",
    "birthday",
    "experience_json",
];

export async function onRequestPatch(context) {
    const { request, env } = context;
    if (!env.USER_JWT_SECRET) {
        return json({ error: "USER_JWT_SECRET not configured" }, 503);
    }
    const auth = request.headers.get("Authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (!m) {
        return json({ error: "unauthorized" }, 401);
    }
    const payload = await verifyPracticeToken(m[1].trim(), env.USER_JWT_SECRET);
    if (!payload) {
        return json({ error: "invalid token" }, 401);
    }

    const db = subscribersDb(env);
    if (!db) {
        return json({ error: "Subscribers D1 not bound" }, 503);
    }

    const uid = await userIdFromToken(db, payload);
    if (!uid) {
        return json({ error: "user not found" }, 404);
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: "invalid JSON" }, 400);
    }

    const profileIn = body && body.profile && typeof body.profile === "object" ? body.profile : body;
    if (!profileIn || typeof profileIn !== "object") {
        return json({ error: "expected profile fields or { profile: { ... } }" }, 400);
    }

    let prev = null;
    try {
        prev = await db.prepare("SELECT * FROM user_profiles WHERE user_id = ?").bind(uid).first();
    } catch (e) {
        prev = null;
    }

    const row = {
        user_id: uid,
        display_name: prev && prev.display_name != null ? prev.display_name : null,
        avatar_url: prev && prev.avatar_url != null ? prev.avatar_url : null,
        avatar_data_url: prev && prev.avatar_data_url != null ? prev.avatar_data_url : null,
        locale: prev && prev.locale != null ? prev.locale : null,
        timezone: prev && prev.timezone != null ? prev.timezone : null,
        prefs_json: prev && prev.prefs_json != null ? prev.prefs_json : null,
        bio: prev && prev.bio != null ? prev.bio : null,
        social_json: prev && prev.social_json != null ? prev.social_json : null,
        gender: prev && prev.gender != null ? prev.gender : null,
        location: prev && prev.location != null ? prev.location : null,
        birthday: prev && prev.birthday != null ? prev.birthday : null,
        experience_json: prev && prev.experience_json != null ? prev.experience_json : null,
        updated_at: Math.floor(Date.now() / 1000),
    };

    let touched = false;
    for (const k of PROFILE_STRING_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(profileIn, k)) {
            continue;
        }
        touched = true;
        const v = profileIn[k];
        row[k] = v == null || v === "" ? null : String(v);
    }

    /* Merge social links if sent as nested object */
    if (profileIn.social && typeof profileIn.social === "object") {
        touched = true;
        const cur = parseJsonObj(row.social_json, {});
        for (const key of ["github", "linkedin", "x", "readme"]) {
            if (Object.prototype.hasOwnProperty.call(profileIn.social, key)) {
                const v = profileIn.social[key];
                cur[key] = v == null || v === "" ? "" : String(v);
            }
        }
        row.social_json = JSON.stringify(cur);
    }

    /* experience: object { work, education, skills } */
    if (profileIn.experience && typeof profileIn.experience === "object") {
        touched = true;
        const cur = parseJsonObj(row.experience_json, {});
        for (const key of ["work", "education", "skills"]) {
            if (Object.prototype.hasOwnProperty.call(profileIn.experience, key)) {
                const v = profileIn.experience[key];
                cur[key] = v == null ? "" : String(v);
            }
        }
        row.experience_json = JSON.stringify(cur);
    }

    if (!touched) {
        return json({ error: "no profile fields to update" }, 400);
    }

    try {
        await db
            .prepare(
                `INSERT INTO user_profiles (user_id, display_name, avatar_url, avatar_data_url, locale, timezone, prefs_json, bio, social_json, gender, location, birthday, experience_json, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(user_id) DO UPDATE SET
                   display_name = excluded.display_name,
                   avatar_url = excluded.avatar_url,
                   avatar_data_url = excluded.avatar_data_url,
                   locale = excluded.locale,
                   timezone = excluded.timezone,
                   prefs_json = excluded.prefs_json,
                   bio = excluded.bio,
                   social_json = excluded.social_json,
                   gender = excluded.gender,
                   location = excluded.location,
                   birthday = excluded.birthday,
                   experience_json = excluded.experience_json,
                   updated_at = excluded.updated_at`,
            )
            .bind(
                row.user_id,
                row.display_name,
                row.avatar_url,
                row.avatar_data_url,
                row.locale,
                row.timezone,
                row.prefs_json,
                row.bio,
                row.social_json,
                row.gender,
                row.location,
                row.birthday,
                row.experience_json,
                row.updated_at,
            )
            .run();
    } catch (e) {
        console.error("me profile patch", e);
        return json({ error: "server error" }, 500);
    }

    let outRow = row;
    try {
        outRow = await db.prepare("SELECT * FROM user_profiles WHERE user_id = ?").bind(uid).first();
    } catch (e) {
        /* use row */
    }

    return json({ ok: true, profile: formatProfile(outRow) });
}
