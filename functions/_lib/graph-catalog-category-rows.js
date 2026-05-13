import { newGraphId } from "./practice-auth-request.js";
import { parseGraphCategoriesJson } from "./graph-catalog-categories.js";

/** Mind-map nodes: `graphCategoryId` (preferred) or legacy `catalogCategoryId` → category row id for that graph. */

/**
 * @param {*} db
 * @param {string} catalogId
 * @returns {Promise<{ id: string, name: string, color: string }[]>}
 */
export async function listCatalogCategoriesForCatalog(db, catalogId) {
    const r = await db
        .prepare(
            `SELECT id, name, color, sort_order FROM graph_catalog_category WHERE catalog_id = ? ORDER BY sort_order ASC, id ASC`,
        )
        .bind(catalogId)
        .all();
    return (r.results || []).map((x) => ({
        id: String(x.id),
        name: String(x.name || ""),
        color: String(x.color || "").trim() || "#6b7280",
    }));
}

/**
 * Replace all category rows for a catalog and clear legacy `categories_json`.
 * @param {*} db
 * @param {string} catalogId
 * @param {{ id: string, name: string, color: string }[]} categories
 * @param {number} now unix seconds
 */
export async function replaceCatalogCategoriesForCatalog(db, catalogId, categories, now) {
    const stmts = [db.prepare(`DELETE FROM graph_catalog_category WHERE catalog_id = ?`).bind(catalogId)];
    for (let i = 0; i < categories.length; i++) {
        const c = categories[i];
        stmts.push(
            db
                .prepare(
                    `INSERT INTO graph_catalog_category (id, catalog_id, name, color, sort_order, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                )
                .bind(c.id, catalogId, c.name, c.color, i, now, now),
        );
    }
    stmts.push(db.prepare(`UPDATE graph_catalog SET categories_json = NULL WHERE id = ?`).bind(catalogId));
    await db.batch(stmts);
}

/**
 * If no rows exist but legacy `categories_json` has entries, migrate into `graph_catalog_category`.
 * @returns {Promise<{ id: string, name: string, color: string }[]>}
 */
export async function migrateLegacyCategoriesJsonToRowsIfNeeded(db, catalogId, categoriesJson, now) {
    const existing = await listCatalogCategoriesForCatalog(db, catalogId);
    if (existing.length) {
        return existing;
    }
    const legacy = parseGraphCategoriesJson(categoriesJson);
    if (!legacy.length) {
        return [];
    }
    const withIds = legacy.map((c) => ({
        id: c.id && String(c.id).trim() ? String(c.id).trim() : newGraphId(),
        name: c.name,
        color: c.color || "#6b7280",
    }));
    await replaceCatalogCategoriesForCatalog(db, catalogId, withIds, now);
    return withIds;
}

/**
 * @param {{ migrateLegacy?: boolean }} opts migrateLegacy: persist legacy JSON into rows (admin paths).
 */
export async function getResolvedCatalogCategories(db, catalogId, legacyJson, now, opts) {
    const migrateLegacy = !!(opts && opts.migrateLegacy);
    const fromTable = await listCatalogCategoriesForCatalog(db, catalogId);
    if (fromTable.length) {
        return fromTable;
    }
    if (migrateLegacy) {
        return migrateLegacyCategoriesJsonToRowsIfNeeded(db, catalogId, legacyJson, now);
    }
    const parsed = parseGraphCategoriesJson(legacyJson);
    return parsed.map((c) => ({
        id: c.id != null && String(c.id).trim() ? String(c.id).trim() : "",
        name: c.name,
        color: c.color || "#6b7280",
    }));
}

/**
 * @param {*} db
 * @returns {Promise<Map<string, { id: string, name: string, color: string }[]>>}
 */
export async function listCatalogCategoriesByCatalogIds(db, catalogIds) {
    const map = new Map();
    if (!catalogIds.length) {
        return map;
    }
    const uniq = [...new Set(catalogIds)];
    const ph = uniq.map(() => "?").join(", ");
    const r = await db
        .prepare(
            `SELECT catalog_id, id, name, color, sort_order FROM graph_catalog_category WHERE catalog_id IN (${ph}) ORDER BY catalog_id, sort_order ASC, id ASC`,
        )
        .bind(...uniq)
        .all();
    for (const row of r.results || []) {
        const cid = String(row.catalog_id);
        const list = map.get(cid) || [];
        list.push({
            id: String(row.id),
            name: String(row.name || ""),
            color: String(row.color || "").trim() || "#6b7280",
        });
        map.set(cid, list);
    }
    return map;
}

/** Mind-map nodes: `graphCategoryId` (preferred) or legacy `catalogCategoryId` → category row id for that graph. */

/**
 * @param {unknown} payload mind-map roots array
 * @returns {Set<string>}
 */
export function collectGraphCategoryIdsFromPayload(payload) {
    const ids = new Set();
    function pick(n) {
        if (!n || typeof n !== "object") {
            return;
        }
        const a = n.graphCategoryId != null ? String(n.graphCategoryId).trim() : "";
        const b = n.catalogCategoryId != null ? String(n.catalogCategoryId).trim() : "";
        const cid = a || b;
        if (cid) {
            ids.add(cid);
        }
    }
    function walkNode(n) {
        if (!n || typeof n !== "object") {
            return;
        }
        pick(n);
        const ch = Array.isArray(n.children) ? n.children : [];
        for (const c of ch) {
            walkNode(c);
        }
        const probs = Array.isArray(n.problems) ? n.problems : [];
        for (const p of probs) {
            walkNode(p);
        }
    }
    if (!Array.isArray(payload)) {
        return ids;
    }
    for (const root of payload) {
        if (!root || typeof root !== "object") {
            continue;
        }
        pick(root);
        const tree = Array.isArray(root.tree) ? root.tree : [];
        for (const t of tree) {
            walkNode(t);
        }
        const patterns = Array.isArray(root.patterns) ? root.patterns : [];
        for (const t of patterns) {
            walkNode(t);
        }
        const dsProbs = Array.isArray(root.problems) ? root.problems : [];
        for (const p of dsProbs) {
            walkNode(p);
        }
    }
    return ids;
}

export function collectCatalogCategoryIdsFromPayload(payload) {
    return collectGraphCategoryIdsFromPayload(payload);
}

/**
 * Graph bodies must declare ≥1 category before nodes are valid (member + catalog graphs).
 * @param {unknown} categories resolved `{ id, name, color }[]`
 * @returns {{ ok: true } | { ok: false, error: string, code: string }}
 */
export function validateGraphCategoriesNonEmpty(categories) {
    if (!Array.isArray(categories) || categories.length === 0) {
        return {
            ok: false,
            error: "graph must declare at least one category { id, name, color }",
            code: "GRAPH_CATEGORIES_REQUIRED",
        };
    }
    return { ok: true };
}

/**
 * Every root, tree/patterns topic node, and embedded problem must carry `graphCategoryId` (or legacy `catalogCategoryId`)
 * referencing a declared category id.
 * @param {unknown} payload mind-map roots array
 * @param {Set<string>|string[]} allowedIds
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validatePayloadMandatoryGraphCategoryOnEveryEntity(payload, allowedIds) {
    const allowed = allowedIds instanceof Set ? allowedIds : new Set(allowedIds);
    function pick(n) {
        if (!n || typeof n !== "object") {
            return "";
        }
        const a = n.graphCategoryId != null ? String(n.graphCategoryId).trim() : "";
        const b = n.catalogCategoryId != null ? String(n.catalogCategoryId).trim() : "";
        return a || b;
    }
    function fail(msg) {
        return { ok: false, error: msg };
    }
    function checkEntity(n, label) {
        const id = pick(n);
        if (!id) {
            return fail(`each topic and problem must set graphCategoryId (${label})`);
        }
        if (!allowed.has(id)) {
            return fail(`mind map references unknown graphCategoryId: "${id}" (${label})`);
        }
        return { ok: true };
    }
    function walkTopicNode(n, pathSeg) {
        if (!n || typeof n !== "object") {
            return { ok: true };
        }
        const nm = n.name != null ? String(n.name).slice(0, 48) : "?";
        const path = pathSeg + "/" + nm;
        let r = checkEntity(n, `topic "${nm}"`);
        if (!r.ok) {
            return r;
        }
        const probs = Array.isArray(n.problems) ? n.problems : [];
        for (let i = 0; i < probs.length; i++) {
            const pr = probs[i];
            const pn = pr && pr.name != null ? String(pr.name).slice(0, 48) : String(i);
            r = checkEntity(pr, `problem "${pn}" under ${path}`);
            if (!r.ok) {
                return r;
            }
        }
        const ch = Array.isArray(n.children) ? n.children : [];
        for (const c of ch) {
            r = walkTopicNode(c, path);
            if (!r.ok) {
                return r;
            }
        }
        return { ok: true };
    }

    if (!Array.isArray(payload)) {
        return fail("payload must be an array of roots");
    }
    if (payload.length === 0) {
        return { ok: true };
    }
    for (let ri = 0; ri < payload.length; ri++) {
        const root = payload[ri];
        if (!root || typeof root !== "object") {
            return fail("mind map root must be an object at index " + ri);
        }
        const rnm = root.name != null ? String(root.name).slice(0, 48) : String(ri);
        let r = checkEntity(root, `root "${rnm}"`);
        if (!r.ok) {
            return r;
        }
        const tree = Array.isArray(root.tree) ? root.tree : [];
        for (const t of tree) {
            r = walkTopicNode(t, `root "${rnm}"`);
            if (!r.ok) {
                return r;
            }
        }
        const patterns = Array.isArray(root.patterns) ? root.patterns : [];
        for (const t of patterns) {
            r = walkTopicNode(t, `root "${rnm}" (patterns)`);
            if (!r.ok) {
                return r;
            }
        }
        const dsProbs = Array.isArray(root.problems) ? root.problems : [];
        for (let i = 0; i < dsProbs.length; i++) {
            const pr = dsProbs[i];
            const pn = pr && pr.name != null ? String(pr.name).slice(0, 48) : String(i);
            r = checkEntity(pr, `problem "${pn}" on root "${rnm}"`);
            if (!r.ok) {
                return r;
            }
        }
    }
    return { ok: true };
}

/**
 * @param {unknown} payload mind-map roots
 * @param {{ id: string, name: string, color: string }[]} categories
 * @returns {{ ok: true } | { ok: false, error: string, code?: string }}
 */
export function validateMindMapGraphInvariant(payload, categories) {
    const nonEmpty = validateGraphCategoriesNonEmpty(categories);
    if (!nonEmpty.ok) {
        return nonEmpty;
    }
    const allowedIds = new Set(
        categories.map((c) => String(c && c.id != null ? c.id : "").trim()).filter(Boolean),
    );
    if (!allowedIds.size) {
        return {
            ok: false,
            error: "each category needs an id",
            code: "GRAPH_CATEGORIES_REQUIRED",
        };
    }
    return validatePayloadMandatoryGraphCategoryOnEveryEntity(payload, allowedIds);
}

/**
 * @param {unknown} payload
 * @param {Set<string>|string[]} allowedIds
 * @param {{ skipIfEmptyAllowed?: boolean }} [opts]
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validatePayloadGraphCategoryRefs(payload, allowedIds, opts) {
    const skipIfEmpty = !!(opts && opts.skipIfEmptyAllowed);
    const allowed = allowedIds instanceof Set ? allowedIds : new Set(allowedIds);
    if (skipIfEmpty && allowed.size === 0) {
        return { ok: true };
    }
    const used = collectGraphCategoryIdsFromPayload(payload);
    for (const id of used) {
        if (!allowed.has(id)) {
            return { ok: false, error: 'mind map references unknown graphCategoryId: "' + id + '"' };
        }
    }
    return { ok: true };
}

export function validatePayloadCatalogCategoryRefs(payload, allowedIds) {
    return validatePayloadGraphCategoryRefs(payload, allowedIds, { skipIfEmptyAllowed: false });
}

/**
 * @param {unknown} payload
 * @param {Map<string, string>} idMap old id -> new id
 */
export function remapGraphCategoryIdsInPayload(payload, idMap) {
    if (!Array.isArray(payload) || !(idMap instanceof Map) || idMap.size === 0) {
        return;
    }
    function apply(n) {
        if (!n || typeof n !== "object") {
            return;
        }
        const raw =
            n.graphCategoryId != null
                ? String(n.graphCategoryId).trim()
                : n.catalogCategoryId != null
                  ? String(n.catalogCategoryId).trim()
                  : "";
        if (raw && idMap.has(raw)) {
            n.graphCategoryId = idMap.get(raw);
            delete n.catalogCategoryId;
        }
    }
    function walkNode(n) {
        if (!n || typeof n !== "object") {
            return;
        }
        apply(n);
        (Array.isArray(n.children) ? n.children : []).forEach(walkNode);
        (Array.isArray(n.problems) ? n.problems : []).forEach(walkNode);
    }
    for (const root of payload) {
        if (!root || typeof root !== "object") {
            continue;
        }
        apply(root);
        (Array.isArray(root.tree) ? root.tree : []).forEach(walkNode);
    }
}
