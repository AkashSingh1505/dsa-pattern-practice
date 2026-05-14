import { normalizeGraphCategoriesBody, parseGraphCategoriesJson } from "./graph-catalog-categories.js";

function tableInfoRows(result) {
    if (!result) {
        return [];
    }
    if (Array.isArray(result.results)) {
        return result.results;
    }
    if (Array.isArray(result)) {
        return result;
    }
    return [];
}

function hasSavedCategoriesColumn(rows) {
    return rows.some(function (row) {
        return String((row && row.name) || "").toLowerCase() === "saved_graph_categories_json";
    });
}

/**
 * Ensures `user_profiles.saved_graph_categories_json` exists.
 * @param {*} db
 * @returns {Promise<boolean>}
 */
export async function ensureUserSavedGraphCategoriesColumn(db) {
    if (!db) {
        return false;
    }
    let info;
    try {
        info = await db.prepare("PRAGMA table_info(user_profiles)").all();
    } catch {
        return false;
    }
    if (!hasSavedCategoriesColumn(tableInfoRows(info))) {
        try {
            await db.prepare("ALTER TABLE user_profiles ADD COLUMN saved_graph_categories_json TEXT").run();
        } catch (e) {
            const msg = String((e && e.message) || e || "").toLowerCase();
            if (msg.indexOf("duplicate column") < 0 && msg.indexOf("already exists") < 0) {
                try {
                    info = await db.prepare("PRAGMA table_info(user_profiles)").all();
                    if (!hasSavedCategoriesColumn(tableInfoRows(info))) {
                        return false;
                    }
                } catch {
                    return false;
                }
            }
        }
    }
    return true;
}

/**
 * Merge normalized graph categories into the saved palette (one entry per case-insensitive name).
 * @param {string|undefined|null} existingJson
 * @param {{ id: string, name: string, color: string }[]} normalizedCategories
 * @returns {string} JSON array string
 */
export function mergeNormalizedCategoriesIntoPaletteJson(existingJson, normalizedCategories) {
    const prev = normalizeGraphCategoriesBody(parseGraphCategoriesJson(existingJson));
    const base = prev.ok ? prev.categories : [];
    const map = new Map();
    for (const c of base) {
        const k = String(c.name || "").trim().toLowerCase();
        if (k) {
            map.set(k, { id: c.id, name: c.name, color: c.color });
        }
    }
    for (const c of normalizedCategories || []) {
        const k = String(c.name || "").trim().toLowerCase();
        if (!k) {
            continue;
        }
        if (!map.has(k)) {
            map.set(k, { id: c.id, name: c.name, color: c.color });
        }
    }
    const arr = Array.from(map.values());
    arr.sort(function (a, b) {
        return String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" });
    });
    return JSON.stringify(arr);
}

/**
 * Upsert palette from categories used on a graph (create/update/download/share).
 * @param {*} db
 * @param {number} userId
 * @param {{ id: string, name: string, color: string }[]} normalizedCategories
 */
export async function touchUserSavedCategories(db, userId, normalizedCategories) {
    if (!db || !normalizedCategories || !normalizedCategories.length) {
        return;
    }
    const okCol = await ensureUserSavedGraphCategoriesColumn(db);
    if (!okCol) {
        return;
    }
    const now = Math.floor(Date.now() / 1000);
    let prevJson = null;
    try {
        const row = await db
            .prepare("SELECT saved_graph_categories_json FROM user_profiles WHERE user_id = ?")
            .bind(userId)
            .first();
        prevJson = row ? row.saved_graph_categories_json : null;
    } catch {
        return;
    }
    const merged = mergeNormalizedCategoriesIntoPaletteJson(prevJson, normalizedCategories);
    try {
        const prof = await db.prepare("SELECT user_id FROM user_profiles WHERE user_id = ?").bind(userId).first();
        if (prof) {
            await db
                .prepare("UPDATE user_profiles SET saved_graph_categories_json = ?, updated_at = ? WHERE user_id = ?")
                .bind(merged, now, userId)
                .run();
        } else {
            await db
                .prepare(
                    "INSERT INTO user_profiles (user_id, saved_graph_categories_json, updated_at) VALUES (?, ?, ?)",
                )
                .bind(userId, merged, now)
                .run();
        }
    } catch (e) {
        console.error("touchUserSavedCategories", e);
    }
}
