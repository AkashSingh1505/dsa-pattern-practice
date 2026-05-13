/**
 * Catalog graph categories (name + display color), stored as JSON on `graph_catalog.categories_json`.
 */

export function parseGraphCategoriesJson(s) {
    if (!s || typeof s !== "string") {
        return [];
    }
    try {
        const x = JSON.parse(s);
        if (!Array.isArray(x)) {
            return [];
        }
        const out = [];
        for (const item of x) {
            if (!item || typeof item !== "object") {
                continue;
            }
            const name = String(item.name || "").trim();
            if (!name) {
                continue;
            }
            const color = String(item.color || "").trim() || "#6b7280";
            out.push({ name, color });
        }
        return out;
    } catch {
        return [];
    }
}

/**
 * @param {unknown} input
 * @returns {{ ok: true, json: string, categories: { name: string, color: string }[] } | { ok: false, error: string }}
 */
export function normalizeGraphCategoriesBody(input) {
    if (input == null) {
        return { ok: true, json: "[]", categories: [] };
    }
    if (!Array.isArray(input)) {
        return { ok: false, error: "categories must be an array" };
    }
    const out = [];
    const seen = new Set();
    for (const raw of input) {
        if (!raw || typeof raw !== "object") {
            continue;
        }
        const name = String(raw.name || "").trim();
        if (!name) {
            continue;
        }
        const key = name.toLowerCase();
        if (seen.has(key)) {
            return { ok: false, error: 'duplicate category name: "' + name + '"' };
        }
        seen.add(key);
        const color = String(raw.color || "").trim() || "#6b7280";
        out.push({ name, color });
    }
    return { ok: true, json: JSON.stringify(out), categories: out };
}
