/**
 * Global node categories (TOPIC / PATTERN / PROBLEM + admin-defined slugs).
 * Mind-map nodes use **`nodeCategorySlug`** (must match `graph_node_category.slug`).
 */

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function parseAllowedChildSlugsJson(raw) {
    if (!raw || typeof raw !== "string") {
        return [];
    }
    try {
        const x = JSON.parse(raw);
        if (!Array.isArray(x)) {
            return [];
        }
        return x.map((s) => String(s || "").trim().toUpperCase()).filter(Boolean);
    } catch {
        return [];
    }
}

/**
 * @param {*} db
 * @returns {Promise<{ slug: string, label: string, color: string, allowedChildSlugs: string[], sortOrder: number, isSystem: boolean }[]>}
 */
export async function listGraphNodeCategories(db) {
    if (!db) {
        return [];
    }
    let r;
    try {
        r = await db
            .prepare(
                `SELECT slug, label, color, allowed_child_slugs_json, sort_order, is_system
                 FROM graph_node_category
                 ORDER BY sort_order ASC, slug ASC`,
            )
            .all();
    } catch (e) {
        console.error("listGraphNodeCategories", e);
        return [];
    }
    const rows = r.results || [];
    return rows.map((row) => ({
        slug: String(row.slug || "").toUpperCase(),
        label: String(row.label || ""),
        color: String(row.color || "").trim() || "#6b7280",
        allowedChildSlugs: parseAllowedChildSlugsJson(row.allowed_child_slugs_json),
        sortOrder: Number(row.sort_order) || 0,
        isSystem: Number(row.is_system) === 1,
    }));
}

/**
 * @param {{ slug: string, label: string, color: string, allowedChildSlugs: string[] }[]} list
 * @returns {Map<string, { label: string, color: string, allowed: string[] }>}
 */
export function graphNodeCategoryMapFromList(list) {
    const map = new Map();
    for (const c of list || []) {
        const slug = String(c.slug || "").toUpperCase().trim();
        if (!slug) {
            continue;
        }
        map.set(slug, {
            label: c.label,
            color: c.color,
            allowed: (c.allowedChildSlugs || []).map((s) => String(s).toUpperCase()),
        });
    }
    return map;
}

/** @param {unknown} n */
function pickNodeCategorySlug(n) {
    if (!n || typeof n !== "object") {
        return "";
    }
    const a = n.nodeCategorySlug != null ? String(n.nodeCategorySlug).trim() : "";
    if (a) {
        return a.toUpperCase();
    }
    return "";
}

function fail(msg, code) {
    return { ok: false, error: msg, code: code || "GRAPH_INVALID" };
}

/**
 * @param {unknown} payload mind-map roots
 * @param {Map<string, { label: string, color: string, allowed: string[] }>} slugMap
 * @returns {{ ok: true } | { ok: false, error: string, code?: string }}
 */
export function validateMindMapNodeCategoryPayload(payload, slugMap) {
    if (!(slugMap instanceof Map) || slugMap.size === 0) {
        return fail("no node categories configured", "GRAPH_NODE_CATEGORIES_MISSING");
    }
    if (!Array.isArray(payload)) {
        return fail("payload must be an array of mind-map roots", "GRAPH_INVALID");
    }
    if (payload.length === 0) {
        return { ok: true };
    }

    function checkEntity(n, parentSlug, pathLabel) {
        const slug = pickNodeCategorySlug(n);
        if (!slug) {
            return fail(`each node must set nodeCategorySlug (${pathLabel})`, "GRAPH_NODE_CATEGORY_REQUIRED");
        }
        if (!slugMap.has(slug)) {
            return fail(`unknown nodeCategorySlug: "${slug}" (${pathLabel})`, "GRAPH_INVALID");
        }
        if (parentSlug == null) {
            if (slug !== "TOPIC") {
                return fail(`mind-map root must use nodeCategorySlug TOPIC, not "${slug}" (${pathLabel})`, "GRAPH_INVALID");
            }
        } else {
            const allowed = slugMap.get(parentSlug)?.allowed || [];
            if (!allowed.includes(slug)) {
                return fail(
                    `nodeCategorySlug "${slug}" is not allowed under "${parentSlug}" (${pathLabel})`,
                    "GRAPH_NODE_CATEGORY_NOT_ALLOWED",
                );
            }
        }
        const tree = Array.isArray(n.tree) ? n.tree : [];
        for (let i = 0; i < tree.length; i++) {
            const t = tree[i];
            const nm = t && t.name != null ? String(t.name).slice(0, 48) : String(i);
            const r = checkEntity(t, slug, `topic "${nm}" under ${pathLabel}`);
            if (!r.ok) {
                return r;
            }
        }
        const patterns = Array.isArray(n.patterns) ? n.patterns : [];
        for (let i = 0; i < patterns.length; i++) {
            const t = patterns[i];
            const nm = t && t.name != null ? String(t.name).slice(0, 48) : String(i);
            const r = checkEntity(t, slug, `pattern "${nm}" under ${pathLabel}`);
            if (!r.ok) {
                return r;
            }
        }
        const probs = Array.isArray(n.problems) ? n.problems : [];
        for (let i = 0; i < probs.length; i++) {
            const p = probs[i];
            const pn = p && p.name != null ? String(p.name).slice(0, 48) : String(i);
            const r = checkEntity(p, slug, `problem "${pn}" under ${pathLabel}`);
            if (!r.ok) {
                return r;
            }
        }
        return { ok: true };
    }

    for (let ri = 0; ri < payload.length; ri++) {
        const root = payload[ri];
        if (!root || typeof root !== "object") {
            return fail("mind map root must be an object at index " + ri, "GRAPH_INVALID");
        }
        const rnm = root.name != null ? String(root.name).slice(0, 48) : String(ri);
        const r = checkEntity(root, null, `root "${rnm}"`);
        if (!r.ok) {
            return r;
        }
    }
    return { ok: true };
}

/**
 * @param {*} db
 * @param {unknown} payload
 */
export async function validateMindMapNodeCategoriesWithDb(db, payload) {
    const list = await listGraphNodeCategories(db);
    const map = graphNodeCategoryMapFromList(list);
    return validateMindMapNodeCategoryPayload(payload, map);
}

/** Deterministic color from slug (fallback when admin omits color). */
export function autoColorForSlug(slug) {
    const s = String(slug || "").toUpperCase();
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    const hue = h % 360;
    return `hsl(${hue}, 58%, 45%)`;
}

/**
 * @param {string} label
 * @returns {string} slug
 */
export function slugFromLabel(label) {
    const t = String(label || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_")
        .replace(/[^A-Z0-9_]/g, "");
    return t.slice(0, 48) || "TYPE";
}
