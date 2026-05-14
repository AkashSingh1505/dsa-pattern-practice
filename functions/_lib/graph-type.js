/**
 * Global graph types (whole-graph): DSA, GENERIC, and admin-defined slugs.
 * Catalog rows and personal copies store **`graph_type_slug`**.
 */

/** @param {unknown} raw @returns {string} */
export function normalizeGraphTypeSlug(raw) {
    const s = String(raw == null ? "" : raw)
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_")
        .replace(/[^A-Z0-9_]/g, "");
    return s || "GENERIC";
}

/**
 * @param {*} db
 * @returns {Promise<{ slug: string, label: string, description: string, sortOrder: number, isSystem: boolean }[]>}
 */
export async function listGraphTypes(db) {
    if (!db) {
        return [];
    }
    let r;
    try {
        r = await db
            .prepare(
                `SELECT slug, label, description, sort_order, is_system
                 FROM graph_type
                 ORDER BY sort_order ASC, slug ASC`,
            )
            .all();
    } catch (e) {
        console.error("listGraphTypes", e);
        return [];
    }
    const rows = r.results || [];
    return rows.map((row) => ({
        slug: String(row.slug || "").toUpperCase(),
        label: String(row.label || ""),
        description: row.description != null ? String(row.description) : "",
        sortOrder: Number(row.sort_order) || 0,
        isSystem: Number(row.is_system) === 1,
    }));
}

/**
 * @param {*} db
 * @param {string} slug
 * @returns {Promise<{ ok: boolean, slug?: string, error?: string }>}
 */
export async function assertGraphTypeSlug(db, slug) {
    const u = normalizeGraphTypeSlug(slug);
    let row;
    try {
        row = await db.prepare("SELECT slug FROM graph_type WHERE slug = ?").bind(u).first();
    } catch (e) {
        console.error("assertGraphTypeSlug", e);
        return { ok: false, error: "server error" };
    }
    if (!row) {
        return { ok: false, error: 'unknown graphTypeSlug: "' + u + '"' };
    }
    return { ok: true, slug: u };
}
