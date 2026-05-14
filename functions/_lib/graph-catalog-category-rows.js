/** Mind-map nodes: `graphCategoryId` (preferred) or legacy `catalogCategoryId` → category id from that graph's category list. */

import { normalizeGraphCategoriesBody, parseGraphCategoriesJson } from "./graph-catalog-categories.js";

function graphCatalogTableInfoRows(result) {
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

function graphCatalogHasCategoriesJsonColumn(rows) {
    return rows.some(function (row) {
        return String((row && row.name) || "").toLowerCase() === "categories_json";
    });
}

/**
 * Ensures `graph_catalog.categories_json` exists (runtime `ALTER` if migration not applied yet).
 * @param {*} db
 */
export async function ensureGraphCatalogCategoriesJsonColumn(db) {
    if (!db) {
        return;
    }
    let info;
    try {
        info = await db.prepare("PRAGMA table_info(graph_catalog)").all();
    } catch {
        return;
    }
    if (graphCatalogHasCategoriesJsonColumn(graphCatalogTableInfoRows(info))) {
        return;
    }
    try {
        await db.prepare("ALTER TABLE graph_catalog ADD COLUMN categories_json TEXT").run();
    } catch (e) {
        const msg = String((e && e.message) || e || "").toLowerCase();
        if (msg.indexOf("duplicate column") < 0 && msg.indexOf("already exists") < 0) {
            try {
                info = await db.prepare("PRAGMA table_info(graph_catalog)").all();
                if (!graphCatalogHasCategoriesJsonColumn(graphCatalogTableInfoRows(info))) {
                    return;
                }
            } catch {
                return;
            }
        }
    }
}

function categoriesFromCatalogJsonColumn(raw) {
    const parsed = parseGraphCategoriesJson(raw);
    const n = normalizeGraphCategoriesBody(parsed);
    return n.ok ? n.categories : [];
}

/**
 * @param {*} db
 * @param {string} catalogId
 * @returns {Promise<{ id: string, name: string, color: string }[]>}
 */
export async function listCatalogCategoriesForCatalog(db, catalogId) {
    await ensureGraphCatalogCategoriesJsonColumn(db);
    let row;
    try {
        row = await db
            .prepare(`SELECT categories_json FROM graph_catalog WHERE id = ? AND deleted_at IS NULL`)
            .bind(catalogId)
            .first();
    } catch (e) {
        console.error("listCatalogCategoriesForCatalog", e);
        return [];
    }
    return categoriesFromCatalogJsonColumn(row && row.categories_json);
}

/**
 * @param {*} db
 * @param {string} catalogId
 * @param {{ id: string, name: string, color: string }[]} categories
 * @param {number} now unix seconds
 */
export async function replaceCatalogCategoriesForCatalog(db, catalogId, categories, now) {
    await ensureGraphCatalogCategoriesJsonColumn(db);
    const text = JSON.stringify(
        (Array.isArray(categories) ? categories : []).map((c) => ({
            id: String(c.id || ""),
            name: String(c.name || ""),
            color: String(c.color || "").trim() || "#6b7280",
        })),
    );
    await db
        .prepare(`UPDATE graph_catalog SET categories_json = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`)
        .bind(text, now, catalogId)
        .run();
}

/**
 * @param {*} db
 * @param {string} catalogId
 * @returns {Promise<{ id: string, name: string, color: string }[]>}
 */
export async function getResolvedCatalogCategories(db, catalogId) {
    return listCatalogCategoriesForCatalog(db, catalogId);
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
    await ensureGraphCatalogCategoriesJsonColumn(db);
    const uniq = [...new Set(catalogIds)];
    const ph = uniq.map(() => "?").join(", ");
    let r;
    try {
        r = await db
            .prepare(`SELECT id, categories_json FROM graph_catalog WHERE id IN (${ph}) AND deleted_at IS NULL`)
            .bind(...uniq)
            .all();
    } catch (e) {
        console.error("listCatalogCategoriesByCatalogIds", e);
        return map;
    }
    for (const row of r.results || []) {
        const cid = String(row.id);
        map.set(cid, categoriesFromCatalogJsonColumn(row.categories_json));
    }
    return map;
}

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
        (Array.isArray(root.patterns) ? root.patterns : []).forEach(walkNode);
        (Array.isArray(root.problems) ? root.problems : []).forEach(walkNode);
    }
}
