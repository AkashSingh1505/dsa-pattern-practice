/**
 * Category payloads for mind maps: `{ id, name, color }[]`.
 * Community catalog: canonical category rows live in **`graph_catalog_category`** (not JSON on `graph_catalog`).
 * Personal graphs: **`user_graphs.categories_json`** only (see user-graph-categories-json.js).
 */

import { newGraphId } from "./practice-auth-request.js";

/** @param {unknown} s */
function validCategoryId(s) {
    const t = String(s || "").trim();
    if (t.length < 1 || t.length > 80) {
        return false;
    }
    return /^[a-zA-Z0-9_-]+$/.test(t);
}

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
            const idRaw = item.id != null ? String(item.id).trim() : "";
            const id = idRaw && validCategoryId(idRaw) ? idRaw : null;
            out.push(id ? { id, name, color } : { name, color });
        }
        return out;
    } catch {
        return [];
    }
}

/**
 * @param {unknown} input
 * @returns {{ ok: true, categories: { id: string, name: string, color: string }[] } | { ok: false, error: string }}
 */
export function normalizeGraphCategoriesBody(input) {
    if (input == null) {
        return { ok: true, categories: [] };
    }
    if (!Array.isArray(input)) {
        return { ok: false, error: "categories must be an array" };
    }
    const out = [];
    const seenName = new Set();
    const seenId = new Set();
    for (const raw of input) {
        if (!raw || typeof raw !== "object") {
            continue;
        }
        const name = String(raw.name || "").trim();
        if (!name) {
            continue;
        }
        if (seenName.has(name)) {
            return { ok: false, error: 'duplicate category name: "' + name + '"' };
        }
        seenName.add(name);
        let id = String(raw.id != null ? raw.id : "").trim();
        if (id && !validCategoryId(id)) {
            return { ok: false, error: "invalid category id" };
        }
        if (!id) {
            id = newGraphId();
        }
        if (seenId.has(id)) {
            return { ok: false, error: 'duplicate category id: "' + id + '"' };
        }
        seenId.add(id);
        const color = String(raw.color || "").trim() || "#6b7280";
        out.push({ id, name, color });
    }
    return { ok: true, categories: out };
}
