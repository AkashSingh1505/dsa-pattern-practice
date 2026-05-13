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

function hasCategoriesJsonColumn(rows) {
    return rows.some(function (row) {
        return String((row && row.name) || "").toLowerCase() === "categories_json";
    });
}

/**
 * Ensures `user_graphs.categories_json` exists and migrates legacy `user_graph_category` rows into JSON, then drops that table.
 * @param {*} db
 * @returns {Promise<boolean>}
 */
export async function ensureUserGraphCategoriesJsonColumn(db) {
    if (!db) {
        return false;
    }
    let info;
    try {
        info = await db.prepare("PRAGMA table_info(user_graphs)").all();
    } catch (e) {
        return false;
    }
    if (!hasCategoriesJsonColumn(tableInfoRows(info))) {
        try {
            await db.prepare("ALTER TABLE user_graphs ADD COLUMN categories_json TEXT").run();
        } catch (e) {
            const msg = String((e && e.message) || e || "").toLowerCase();
            if (msg.indexOf("duplicate column") < 0 && msg.indexOf("already exists") < 0) {
                try {
                    info = await db.prepare("PRAGMA table_info(user_graphs)").all();
                    if (!hasCategoriesJsonColumn(tableInfoRows(info))) {
                        return false;
                    }
                } catch (err) {
                    return false;
                }
            }
        }
    }

    let legacy;
    try {
        legacy = await db
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user_graph_category'")
            .first();
    } catch (e) {
        return true;
    }
    if (!legacy || !legacy.name) {
        return true;
    }

    try {
        const graphs = await db.prepare("SELECT id FROM user_graphs WHERE deleted_at IS NULL").all();
        const list = graphs && graphs.results ? graphs.results : [];
        for (let i = 0; i < list.length; i++) {
            const gid = list[i] && list[i].id != null ? String(list[i].id) : "";
            if (!gid) {
                continue;
            }
            const rows = await db
                .prepare(
                    `SELECT id, name, color FROM user_graph_category WHERE user_graph_id = ? ORDER BY sort_order ASC, id ASC`,
                )
                .bind(gid)
                .all();
            const rlist = rows && rows.results ? rows.results : [];
            const cats = rlist.map((r) => ({
                id: String(r.id || ""),
                name: String(r.name || ""),
                color: String(r.color || "").trim() || "#6b7280",
            }));
            if (cats.length > 0) {
                await db
                    .prepare(`UPDATE user_graphs SET categories_json = ? WHERE id = ?`)
                    .bind(JSON.stringify(cats), gid)
                    .run();
            }
        }
        await db.prepare("DROP TABLE IF EXISTS user_graph_category").run();
    } catch (e) {
        console.error("user_graph_category legacy migrate", e);
    }
    return true;
}

/**
 * @param {{ categories_json?: string } | null | undefined} row
 * @returns {{ id: string, name: string, color: string }[]}
 */
export function listCategoriesFromUserGraphRow(row) {
    const raw = parseGraphCategoriesJson(row && row.categories_json);
    if (!raw.length) {
        return [];
    }
    const n = normalizeGraphCategoriesBody(raw);
    return n.ok ? n.categories : [];
}

/**
 * @param {{ id: string, name: string, color: string }[]} categories
 * @returns {string}
 */
export function stringifyUserGraphCategories(categories) {
    return JSON.stringify(Array.isArray(categories) ? categories : []);
}
