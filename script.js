let projects = [];


/** Data structure → nested tree OR flat patterns (see getDsTree). Loaded from D1 only (`/api/data?k=dsa`). */
let dsaHierarchy = [];

const DSA_HIERARCHY_MINIMAL = [
    {
        id: "mind-root-placeholder",
        name: "DSA Patterns",
        nodeCategorySlug: "ROOT",
        tree: [
            {
                name: "No graph data yet — seed catalog graph `dsa-site-map` (site admin → Library)",
                nodeCategorySlug: "TOPIC",
                children: [],
                problems: [],
            },
        ],
        patterns: [],
        problems: [],
    },
];

/** Same-origin `/api/data` URL — works on GitHub Pages project paths (not only domain root). */
function dsaApiDataUrl(k) {
    return new URL("api/data?k=" + encodeURIComponent(k), window.location.href).href;
}

/**
 * Fills `dsaHierarchy` from GET /api/data?k=dsa; if empty or unavailable, uses minimal placeholder.
 */
async function dsaLoadHierarchyFromSources() {
    try {
        const r = await fetch(dsaApiDataUrl("dsa"), { cache: "no-store" });
        if (r.ok) {
            const data = await r.json();
            if (Array.isArray(data) && data.length) {
                dsaHierarchy = data;
                return;
            }
        }
    } catch (e) {
        console.warn("DSA: API fetch failed", e);
    }
    dsaHierarchy = DSA_HIERARCHY_MINIMAL;
}

let dsaGraphActiveRoot = null;
let dsaGraphResizeCleanup = null;
/** When set, the graph panel shows the all-topics map (no topic tab row). */
let dsaGraphUnifiedMode = false;
/** Customize graph editor tab — no SVG mind-map edges. */
let dsaGraphCustomizeMode = false;

/** DOM ids for embedding the mind map (admin preview uses alternate roots). */
let dsaGraphMount = {
    viewportId: "dsa-hierarchy-root",
    mapToolbarHostId: "dsa-map-toolbar-host",
    /** Index: static `#modeSeg` in `.head`. Preview / legacy: `#dsa-toolbar-view-tabs-slot` or layer. */
    shellToolbarId: null,
};
/** When true, keep `dsaHierarchy` from the editor — do not refetch /api/data on view switches. */
let dsaGraphPreviewMode = false;

function dsaMergeGraphMount(patch) {
    if (!patch || typeof patch !== "object") {
        return;
    }
    if (typeof patch.viewportId === "string" && patch.viewportId) {
        dsaGraphMount.viewportId = patch.viewportId;
    }
    if (typeof patch.mapToolbarHostId === "string" && patch.mapToolbarHostId) {
        dsaGraphMount.mapToolbarHostId = patch.mapToolbarHostId;
    }
    if ("shellToolbarId" in patch) {
        dsaGraphMount.shellToolbarId = patch.shellToolbarId;
    }
}

function dsaResetGraphMountAndPreview() {
    dsaGraphMount = {
        viewportId: "dsa-hierarchy-root",
        mapToolbarHostId: "dsa-map-toolbar-host",
        shellToolbarId: null,
    };
    dsaGraphPreviewMode = false;
}

const DSA_USER_STORAGE_KEY = "dsaUserNodesPayload";
/** Merged from `data/dsa-user-nodes.json` + localStorage (local wins by id). Not a DB — see export. */
let dsaUserPayload = { version: 1, nodes: [], removals: [] };

/** Stored JSON may use `type: "question"` (legacy) or `type: "problem"`. */
function dsaUserPayloadIsProblemEntry(x) {
    return x && (x.type === "question" || x.type === "problem");
}

function dsaUserPayloadIsBranchStyleEntry(x) {
    if (!x || typeof x !== "object" || dsaUserPayloadIsProblemEntry(x)) {
        return false;
    }
    const t = x.type;
    return t === "branch" || t === "group" || t === "pattern" || t === "topic";
}

/** Preset labels for admin “Company tags” (dropdown). */
const DSA_COMPANY_PRESETS = [
    { id: "google", label: "Google" },
    { id: "meta", label: "Meta" },
    { id: "amazon", label: "Amazon" },
    { id: "microsoft", label: "Microsoft" },
    { id: "apple", label: "Apple" },
    { id: "netflix", label: "Netflix" },
    { id: "uber", label: "Uber" },
    { id: "airbnb", label: "Airbnb" },
    { id: "adobe", label: "Adobe" },
    { id: "salesforce", label: "Salesforce" },
    { id: "oracle", label: "Oracle" },
    { id: "bloomberg", label: "Bloomberg" },
    { id: "goldman", label: "Goldman Sachs" },
    { id: "linkedin", label: "LinkedIn" },
    { id: "tesla", label: "Tesla" },
    { id: "shopify", label: "Shopify" },
    { id: "stripe", label: "Stripe" },
    { id: "paypal", label: "PayPal" },
    { id: "nvidia", label: "NVIDIA" },
    { id: "bytedance", label: "ByteDance" },
];

/** Problem difficulty for heatmap / sorting (Easy → Medium → Hard). */
function dsaNormalizeProblemDifficulty(v) {
    const s = String(v || "")
        .trim()
        .toLowerCase();
    if (s === "easy" || s === "e") {
        return "easy";
    }
    if (s === "hard" || s === "h") {
        return "hard";
    }
    if (s === "medium" || s === "med" || s === "m" || s === "") {
        return "medium";
    }
    return "medium";
}

function dsaProblemDifficultySortKey(diff) {
    const o = { easy: 0, medium: 1, hard: 2 };
    const k = dsaNormalizeProblemDifficulty(diff);
    return o[k] != null ? o[k] : 1;
}

function dsaProblemDifficultyLabel(diff) {
    const m = { easy: "Easy", medium: "Medium", hard: "Hard" };
    return m[dsaNormalizeProblemDifficulty(diff)] || "Medium";
}

function dsaSortProblemsByDifficulty(probs) {
    if (!Array.isArray(probs)) {
        return [];
    }
    return [...probs].sort((a, b) => {
        const d =
            dsaProblemDifficultySortKey(a && a.difficulty) - dsaProblemDifficultySortKey(b && b.difficulty);
        if (d !== 0) {
            return d;
        }
        return String((a && a.name) || "").localeCompare(String((b && b.name) || ""), undefined, {
            sensitivity: "base",
        });
    });
}

function dsaIsProblemMarkedImportant(prob) {
    return !!(prob && prob.starred === true);
}

/** Approach dropdown (Brute force / Better / Optimal) — stored per solution. */
const DSA_SOLUTION_APPROACH_OPTIONS = [
    { id: "", label: "Select approach…" },
    { id: "brute_force", label: "Brute force" },
    { id: "better", label: "Better" },
    { id: "optimal", label: "Optimal" },
];

/** @deprecated use DSA_SOLUTION_APPROACH_OPTIONS */
const DSA_SOLUTION_CATEGORY_OPTIONS = DSA_SOLUTION_APPROACH_OPTIONS;

/** Brute force / better / optimal — stored on solution JSON. */
function dsaNormalizeSolutionCategory(raw) {
    const s = String(raw || "").trim().toLowerCase().replace(/[- ]/g, "_");
    if (s === "brute_force" || s === "bruteforce") {
        return "brute_force";
    }
    if (s === "better") {
        return "better";
    }
    if (s === "optimal") {
        return "optimal";
    }
    return "";
}

function dsaSolutionCategoryLabel(id) {
    const m = { brute_force: "Brute force", better: "Better", optimal: "Optimal" };
    return m[id] || "";
}

/** Display order (read-only & editor): Brute force → Better → Optimal → other. */
function dsaSolutionApproachRank(sol) {
    const k = dsaNormalizeSolutionCategory(sol && sol.approach);
    if (k === "brute_force") {
        return 0;
    }
    if (k === "better") {
        return 1;
    }
    if (k === "optimal") {
        return 2;
    }
    return 3;
}

/** Indices into `state` sorted by approach order (stable tie-break by index). */
function dsaSortedSolutionIndicesForDisplay(state) {
    if (!Array.isArray(state) || !state.length) {
        return [];
    }
    return state
        .map((_, i) => i)
        .sort((ia, ib) => {
            const d = dsaSolutionApproachRank(state[ia]) - dsaSolutionApproachRank(state[ib]);
            if (d !== 0) {
                return d;
            }
            return ia - ib;
        });
}

function dsaNewSolutionId() {
    return `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function dsaNormalizeSolutionItem(s) {
    if (!s || typeof s !== "object") {
        return null;
    }
    const id = s.id != null && String(s.id).trim() ? String(s.id).trim() : dsaNewSolutionId();
    const approach = dsaNormalizeSolutionCategory(s.approach != null ? s.approach : s.category);
    const timeComplexity = s.timeComplexity != null ? String(s.timeComplexity).trim() : "";
    const spaceComplexity = s.spaceComplexity != null ? String(s.spaceComplexity).trim() : "";
    const code = s.code != null ? String(s.code) : "";
    return { id, approach, timeComplexity, spaceComplexity, code };
}

/** Build solution list from a saved entry or merged row-shaped object. */
function dsaSolutionsFromEntry(ent) {
    if (!ent) {
        return [];
    }
    if (Array.isArray(ent.solutions) && ent.solutions.length) {
        const out = [];
        for (const x of ent.solutions) {
            const n = dsaNormalizeSolutionItem(x);
            if (
                n &&
                (String(n.code || "").trim() ||
                    n.timeComplexity ||
                    n.spaceComplexity ||
                    dsaNormalizeSolutionCategory(n.approach))
            ) {
                out.push(n);
            }
        }
        return out;
    }
    const code = ent.code != null ? String(ent.code).trim() : "";
    const tc = ent.solutionTimeComplexity != null ? String(ent.solutionTimeComplexity).trim() : "";
    const sc = ent.solutionSpaceComplexity != null ? String(ent.solutionSpaceComplexity).trim() : "";
    const appr = dsaNormalizeSolutionCategory(ent.solutionCategory);
    if (!code && !tc && !sc && !appr) {
        return [];
    }
    return [
        {
            id: dsaNewSolutionId(),
            approach: appr,
            timeComplexity: tc,
            spaceComplexity: sc,
            code,
        },
    ];
}

function dsaSolutionsFromMergedRow(row) {
    if (!row) {
        return [];
    }
    if (Array.isArray(row.solutions) && row.solutions.length) {
        const out = [];
        for (const x of row.solutions) {
            const n = dsaNormalizeSolutionItem(x);
            if (n) {
                out.push(n);
            }
        }
        return out;
    }
    return dsaSolutionsFromEntry({
        code: row.code,
        solutionTimeComplexity: row.solutionTimeComplexity,
        solutionSpaceComplexity: row.solutionSpaceComplexity,
        solutionCategory: row.solutionCategory,
    });
}

/** Non-empty solution rows for read-only pickers (approach + complexity + code). */
function dsaFilteredSolutionRows(prob) {
    return dsaSolutionsFromMergedRow(prob).filter((sol) => {
        const codeStr = sol && sol.code != null ? String(sol.code).trim() : "";
        const tc = sol && sol.timeComplexity != null ? String(sol.timeComplexity).trim() : "";
        const sc = sol && sol.spaceComplexity != null ? String(sol.spaceComplexity).trim() : "";
        const appr = dsaNormalizeSolutionCategory(sol && sol.approach);
        return !!(codeStr || tc || sc || dsaSolutionCategoryLabel(appr));
    });
}

/** Sketch / image shown in Resources pane (video opens from row icon; solutions use Solution toggle). */
function dsaProblemHasSketchImageResource(prob) {
    if (!prob) {
        return false;
    }
    if (prob.drawing && String(prob.drawing).trim()) {
        return true;
    }
    if (prob.image && String(prob.image).trim()) {
        return true;
    }
    return false;
}

function dsaProblemHasResources(prob) {
    if (!prob) {
        return false;
    }
    if (prob.solutionVideoUrl && String(prob.solutionVideoUrl).trim()) {
        return true;
    }
    if (Array.isArray(prob.solutions) && prob.solutions.some((s) => s && String(s.code || "").trim())) {
        return true;
    }
    if (prob.code && String(prob.code).trim()) {
        return true;
    }
    if (prob.solutionTimeComplexity && String(prob.solutionTimeComplexity).trim()) {
        return true;
    }
    if (prob.solutionSpaceComplexity && String(prob.solutionSpaceComplexity).trim()) {
        return true;
    }
    if (dsaNormalizeSolutionCategory(prob.solutionCategory)) {
        return true;
    }
    if (prob.drawing && String(prob.drawing).trim()) {
        return true;
    }
    if (prob.image && String(prob.image).trim()) {
        return true;
    }
    return false;
}

/** Ensure https URL for opening in a new tab. */
function dsaNormalizeExternalVideoHref(url) {
    let s = String(url || "").trim();
    if (!s) {
        return "";
    }
    try {
        if (!/^https?:\/\//i.test(s)) {
            s = `https://${s}`;
        }
        return new URL(s).href;
    } catch {
        return s;
    }
}

function dsaIsLikelyYoutubeUrl(url) {
    const s = String(url || "").toLowerCase();
    return s.includes("youtube.com") || s.includes("youtu.be");
}

function dsaNormalizeCompaniesArray(raw) {
    if (!raw) {
        return [];
    }
    const arr = Array.isArray(raw) ? raw : [];
    const seen = new Set();
    const out = [];
    for (const x of arr) {
        const s = String(x || "").trim();
        if (!s) {
            continue;
        }
        const k = s.toLowerCase();
        if (seen.has(k)) {
            continue;
        }
        seen.add(k);
        out.push(s);
    }
    return out;
}

/** Canonical mutable top-level topic list for a DS — matches {@link getDsTree} (non-empty `tree`, else `patterns`). */
function dsaGetMutableTopArray(ds) {
    if (!ds || typeof ds !== "object") {
        return null;
    }
    if (Array.isArray(ds.tree) && ds.tree.length > 0) {
        return ds.tree;
    }
    if (Array.isArray(ds.patterns) && ds.patterns.length > 0) {
        return ds.patterns;
    }
    if (Array.isArray(ds.tree)) {
        return ds.tree;
    }
    if (Array.isArray(ds.patterns)) {
        return ds.patterns;
    }
    return null;
}

/** JSON `id` may be string or number; dataset / URL state is always string — compare coerced. */
function dsaDsIdEq(a, b) {
    return String(a ?? "") === String(b ?? "");
}

function dsaResolveParentNode(clone, parentKey) {
    if (parentKey === "__DSA_META__") {
        return { metaRoot: true, ds: null, parentNode: null, topArray: clone };
    }
    const parts = parentKey.split("::").map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) {
        return null;
    }
    const ds = clone.find((d) => dsaDsIdEq(d.id, parts[0]));
    if (!ds) {
        return null;
    }
    const top = dsaGetMutableTopArray(ds);
    if (!top) {
        return null;
    }
    if (parts.length === 1) {
        return { ds, parentNode: null, topArray: top };
    }
    let list = top;
    let node = null;
    for (let i = 1; i < parts.length; i++) {
        const seg = parts[i];
        node = list.find((n) => n.name === seg);
        if (!node) {
            return null;
        }
        if (i === parts.length - 1) {
            return { ds, parentNode: node, topArray: top };
        }
        if (!node.children) {
            node.children = [];
        }
        list = node.children;
    }
    return null;
}

/** Public API: global mind-map node types (slug, label, allowedChildSlugs, …). */
async function dsaFetchGraphNodeCategoriesList() {
    if (typeof window !== "undefined" && Array.isArray(window.__dsaGraphNodeCategories) && window.__dsaGraphNodeCategories.length) {
        return window.__dsaGraphNodeCategories;
    }
    try {
        const href =
            typeof document !== "undefined" && document.baseURI
                ? new URL("api/graph-library/node-categories", document.baseURI).href
                : "/api/graph-library/node-categories";
        const r = await fetch(href, { credentials: "same-origin" });
        const j = await r.json();
        if (j && j.ok && Array.isArray(j.categories)) {
            if (typeof window !== "undefined") {
                window.__dsaGraphNodeCategories = j.categories;
            }
            return j.categories;
        }
    } catch (e) {
        console.warn("dsaFetchGraphNodeCategoriesList", e);
    }
    return [];
}

function dsaMindParentCategorySlug(parentKey) {
    const merged = getDsaHierarchyMerged();
    if (!parentKey || parentKey === "__DSA_META__") {
        return "ROOT";
    }
    const parts = parentKey.split("::").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) {
        return "ROOT";
    }
    const ds = merged.find((d) => d && dsaDsIdEq(d.id, parts[0]));
    if (!ds) {
        return "ROOT";
    }
    if (parts.length === 1) {
        const s = ds.nodeCategorySlug != null ? String(ds.nodeCategorySlug).trim().toUpperCase() : "";
        return s || "ROOT";
    }
    const r = dsaResolveParentNode(merged, parentKey);
    if (!r || !r.parentNode) {
        return "TOPIC";
    }
    const n = r.parentNode;
    const slug = n.nodeCategorySlug != null ? String(n.nodeCategorySlug).trim().toUpperCase() : "";
    return slug || "TOPIC";
}

/**
 * @param {string} parentSlug
 * @param {{ slug?: string, allowedChildSlugs?: string[] }[]} cats
 * @returns {string[]}
 */
function dsaMindAllowedChildSlugs(parentSlug, cats) {
    const p = String(parentSlug || "")
        .toUpperCase()
        .trim();
    const list = Array.isArray(cats) ? cats : [];
    const row = list.find((c) => c && String(c.slug || "").toUpperCase().trim() === p);
    const raw = row && Array.isArray(row.allowedChildSlugs) ? row.allowedChildSlugs : [];
    return raw.map((s) => String(s || "").toUpperCase().trim()).filter((s) => s && s !== "ROOT");
}

/**
 * Allowed child slugs for the add-child modal — from `graph_node_category` only (parent category → allowedChildSlugs).
 * Branch vs practice-problem exclusivity is handled at save time with a confirm, not by hiding valid DB types.
 *
 * @param {string} parentKey mind-map path key (e.g. `rootId::Topic A`)
 * @param {{ slug?: string, allowedChildSlugs?: string[] }[]} cats `window.__dsaGraphNodeCategories`
 * @returns {string[]}
 */
function dsaMindAllowedChildSlugsRespectingParentState(parentKey, cats) {
    const slug = dsaMindParentCategorySlug(parentKey);
    return dsaMindAllowedChildSlugs(slug, cats);
}

/** Remove direct branch children on a parent so a practice problem can be added (after user confirms). */
function dsaRecordRemovalsForDirectBranchChildren(parentKey) {
    const merged = getDsaHierarchyMerged();
    const r = dsaResolveParentNode(merged, parentKey);
    if (!r || r.metaRoot) {
        return;
    }
    const paths = [];
    if (!r.parentNode) {
        const ds = r.ds;
        if (!ds) {
            return;
        }
        const base = String(ds.id || "").trim();
        if (!base) {
            return;
        }
        (Array.isArray(ds.tree) ? ds.tree : []).forEach((c) => {
            if (c && c.name) {
                paths.push(`${base}::${String(c.name).trim()}`);
            }
        });
        (Array.isArray(ds.patterns) ? ds.patterns : []).forEach((c) => {
            if (c && c.name) {
                paths.push(`${base}::${String(c.name).trim()}`);
            }
        });
    } else {
        const n = r.parentNode;
        (Array.isArray(n.children) ? n.children : []).forEach((c) => {
            if (c && c.name) {
                paths.push(`${parentKey}::${String(c.name).trim()}`);
            }
        });
        (Array.isArray(n.patterns) ? n.patterns : []).forEach((c) => {
            if (c && c.name) {
                paths.push(`${parentKey}::${String(c.name).trim()}`);
            }
        });
    }
    paths.forEach((p) => dsaRecordRemoval({ type: "node", path: p }));
    dsaUserPayload.nodes = (dsaUserPayload.nodes || []).filter((x) => {
        if (!x || dsaUserPayloadIsProblemEntry(x)) {
            return true;
        }
        const isBranch =
            x.type === "branch" || x.type === "group" || x.type === "pattern" || x.type === "topic";
        return !(isBranch && String(x.parentKey || "").trim() === String(parentKey || "").trim());
    });
    dsaPersistUserPayload();
}

/**
 * @param {{ ds: object, parentNode: object | null }} resolved
 * @param {{ name: string, children?: unknown[], problems?: unknown[], nodeCategorySlug?: string }} newNode
 * @param {string} mindSlug TOPIC | PATTERN
 */
function dsaMindInsertBranchChild(resolved, newNode, mindSlug) {
    const { ds, parentNode } = resolved;
    const s = String(mindSlug || "TOPIC").toUpperCase();
    if (!parentNode) {
        if (s === "PATTERN") {
            if (!Array.isArray(ds.patterns)) {
                ds.patterns = [];
            }
            ds.patterns.push(newNode);
            return;
        }
        if (!Array.isArray(ds.tree)) {
            ds.tree = [];
        }
        ds.tree.push(newNode);
        return;
    }
    if (s === "PATTERN") {
        if (!Array.isArray(parentNode.patterns)) {
            parentNode.patterns = [];
        }
        parentNode.patterns.push(newNode);
        return;
    }
    if (!Array.isArray(parentNode.children)) {
        parentNode.children = [];
    }
    parentNode.children.push(newNode);
}

function dsaTryApplyOneUserNode(clone, e) {
    const { parentKey, type, name, url, id } = e;
    const gc = e && e.graphCategoryId != null ? String(e.graphCategoryId).trim() : "";
    const mindSlug = e && e.nodeCategorySlug != null ? String(e.nodeCategorySlug).trim().toUpperCase() : "";
    if (!parentKey || !name || !type) {
        return true;
    }
    const resolved = dsaResolveParentNode(clone, parentKey);
    if (!resolved) {
        return false;
    }
    if (resolved.metaRoot) {
        const isBranch = type === "branch" || type === "group" || type === "pattern";
        if (isBranch && id) {
            if (clone.some((d) => d && dsaDsIdEq(d.id, id))) {
                return true;
            }
            const rootObj = {
                id,
                name: name.trim(),
                nodeCategorySlug: "ROOT",
                tree: [],
                patterns: [],
                problems: [],
            };
            if (gc) {
                rootObj.graphCategoryId = gc;
            }
            clone.push(rootObj);
            return true;
        }
        return true;
    }
    const { parentNode } = resolved;
    const isQuestion = dsaUserPayloadIsProblemEntry({ type });
    const isBranch = type === "branch" || type === "group" || type === "pattern" || type === "topic";

    if (isQuestion) {
        const hrefRaw = (url || "").trim();
        const href = hrefRaw || "#";
        const probObj = dsaBuildProblemFromQuestionEntry(e, name, href);
        /** DS-level key only (e.g. `arrays`): attach to `ds.problems`, not a new tree node under `tree`. */
        if (!parentNode) {
            const dsRef = resolved.ds;
            if (!dsRef) {
                return false;
            }
            if (!dsRef.problems) {
                dsRef.problems = [];
            }
            const pi = dsRef.problems.findIndex((p) => p && p.name === name);
            if (pi >= 0) {
                dsRef.problems[pi] = probObj;
            } else {
                dsRef.problems.push(probObj);
            }
            return true;
        }
        if (!parentNode.problems) {
            parentNode.problems = [];
        }
        const pi = parentNode.problems.findIndex((p) => p && p.name === name);
        if (pi >= 0) {
            parentNode.problems[pi] = probObj;
        } else {
            parentNode.problems.push(probObj);
        }
        return true;
    }

    if (isBranch) {
        const nm = String(name || "").trim();
        if (!nm) {
            return true;
        }
        const branchCat = mindSlug === "PATTERN" ? "PATTERN" : "TOPIC";
        const newNode = {
            name: nm,
            children: [],
            problems: [],
            nodeCategorySlug: branchCat,
        };
        if (gc) {
            newNode.graphCategoryId = gc;
        }
        if (!parentNode) {
            const treeN = Array.isArray(resolved.ds.tree) ? resolved.ds.tree : [];
            const patN = Array.isArray(resolved.ds.patterns) ? resolved.ds.patterns : [];
            const dup =
                treeN.some((n) => n && String(n.name || "").trim() === nm) ||
                patN.some((n) => n && String(n.name || "").trim() === nm);
            if (dup) {
                return true;
            }
            dsaMindInsertBranchChild(resolved, newNode, branchCat);
            return true;
        }
        if (branchCat === "PATTERN") {
            const pat = Array.isArray(parentNode.patterns) ? parentNode.patterns : [];
            if (pat.some((n) => n && String(n.name || "").trim() === nm)) {
                return true;
            }
            dsaMindInsertBranchChild(resolved, newNode, "PATTERN");
            return true;
        }
        const ch = Array.isArray(parentNode.children) ? parentNode.children : [];
        if (ch.some((n) => n && String(n.name || "").trim() === nm)) {
            return true;
        }
        dsaMindInsertBranchChild(resolved, newNode, "TOPIC");
        return true;
    }

    return true;
}

function dsaApplyUserNodesToClone(clone, entries) {
    const pending = [...(entries || [])];
    let guard = 0;
    while (pending.length && guard < 5000) {
        guard += 1;
        const batch = pending.length;
        const next = [];
        for (let i = 0; i < batch; i++) {
            const e = pending.shift();
            if (!dsaTryApplyOneUserNode(clone, e)) {
                next.push(e);
            }
        }
        if (next.length === batch) {
            break;
        }
        pending.push(...next);
    }
}

function dsaGetChildListForParentPath(clone, parentParts) {
    if (!parentParts || parentParts.length === 0) {
        return null;
    }
    const ds = clone.find((d) => dsaDsIdEq(d.id, parentParts[0]));
    if (!ds) {
        return null;
    }
    if (parentParts.length === 1) {
        return dsaGetMutableTopArray(ds);
    }
    let list = dsaGetMutableTopArray(ds);
    for (let i = 1; i < parentParts.length; i++) {
        const node = list.find((n) => n.name === parentParts[i]);
        if (!node) {
            return null;
        }
        if (i === parentParts.length - 1) {
            if (!node.children) {
                node.children = [];
            }
            return node.children;
        }
        if (!node.children) {
            return null;
        }
        list = node.children;
    }
    return null;
}

function dsaRemoveNodeByPathFromClone(clone, path) {
    const parts = path.split("::").map((s) => s.trim()).filter(Boolean);
    if (parts.length === 1) {
        const dsId = parts[0];
        const idx = clone.findIndex((d) => d && dsaDsIdEq(d.id, dsId));
        if (idx >= 0) {
            clone.splice(idx, 1);
            return true;
        }
        return false;
    }
    if (parts.length < 2) {
        return false;
    }
    const name = parts[parts.length - 1];
    const parentParts = parts.slice(0, -1);
    const list = dsaGetChildListForParentPath(clone, parentParts);
    if (!list) {
        return false;
    }
    const idx = list.findIndex((n) => n.name === name);
    if (idx >= 0) {
        list.splice(idx, 1);
        return true;
    }
    return false;
}

function dsaRemoveProblemFromClone(clone, parentPath, problemName) {
    const resolved = dsaResolveParentNode(clone, parentPath);
    if (!resolved) {
        return false;
    }
    const holder = resolved.parentNode || resolved.ds;
    if (!holder || !holder.problems || !holder.problems.length) {
        return false;
    }
    const idx = holder.problems.findIndex((p) => p.name === problemName);
    if (idx >= 0) {
        holder.problems.splice(idx, 1);
        return true;
    }
    return false;
}

function dsaApplyRemovalsToClone(clone, removals) {
    (removals || []).forEach((r) => {
        if (!r || !r.type) {
            return;
        }
        if (r.type === "node" && r.path) {
            dsaRemoveNodeByPathFromClone(clone, r.path);
        }
        if (r.type === "problem" && r.path && r.problemName) {
            dsaRemoveProblemFromClone(clone, r.path, r.problemName);
        }
    });
}

/**
 * Each node (and each DS) may list either nested branch children (`children` / `patterns`) or `problems`, not both.
 * If both exist (legacy data), keep branches and drop `problems` on that holder.
 */
function dsaNormalizeExclusiveChildKindOnNode(node) {
    if (!node || typeof node !== "object") {
        return;
    }
    const ch = Array.isArray(node.children) ? node.children : [];
    const pat = Array.isArray(node.patterns) ? node.patterns : [];
    const probs = Array.isArray(node.problems) ? node.problems : [];
    if ((ch.length > 0 || pat.length > 0) && probs.length > 0) {
        node.problems = [];
    }
    ch.forEach((c) => dsaNormalizeExclusiveChildKindOnNode(c));
    pat.forEach((c) => dsaNormalizeExclusiveChildKindOnNode(c));
}

function dsaNormalizeExclusiveChildKindInClone(clone) {
    if (!Array.isArray(clone)) {
        return;
    }
    clone.forEach((ds) => {
        if (!ds || typeof ds !== "object") {
            return;
        }
        if (Array.isArray(ds.tree) && ds.tree.length > 0 && Array.isArray(ds.problems) && ds.problems.length > 0) {
            ds.problems = [];
        }
        if (Array.isArray(ds.tree)) {
            ds.tree.forEach((n) => dsaNormalizeExclusiveChildKindOnNode(n));
        }
        /** When `tree` is empty, graph reads from `patterns`; normalize those nodes too (same exclusivity rules). */
        if (Array.isArray(ds.patterns)) {
            ds.patterns.forEach((n) => dsaNormalizeExclusiveChildKindOnNode(n));
        }
    });
}

function getDsaHierarchyMerged() {
    const clone = JSON.parse(JSON.stringify(dsaHierarchy));
    dsaApplyUserNodesToClone(clone, dsaUserPayload.nodes);
    dsaApplyRemovalsToClone(clone, dsaUserPayload.removals || []);
    dsaNormalizeExclusiveChildKindInClone(clone);
    return clone;
}

/** For add-modal: branch children vs problems on this parent (mutually exclusive holders). */
function dsaParentChildKindFlags(parentKey) {
    if (!parentKey || parentKey === "__DSA_META__") {
        return { hasSubnodes: false, hasProblems: false };
    }
    const merged = getDsaHierarchyMerged();
    const r = dsaResolveParentNode(merged, parentKey);
    if (!r || r.metaRoot) {
        return { hasSubnodes: false, hasProblems: false };
    }
    if (!r.parentNode) {
        const ds = r.ds;
        const tree = ds ? getDsTree(ds) : [];
        const probs = ds && Array.isArray(ds.problems) ? ds.problems : [];
        return { hasSubnodes: tree.length > 0, hasProblems: probs.length > 0 };
    }
    const n = r.parentNode;
    const ch = Array.isArray(n.children) ? n.children : [];
    const pat = Array.isArray(n.patterns) ? n.patterns : [];
    const probs = Array.isArray(n.problems) ? n.problems : [];
    return { hasSubnodes: ch.length > 0 || pat.length > 0, hasProblems: probs.length > 0 };
}

function dsaFlattenParentOptions(hierarchy) {
    const out = [];
    hierarchy.forEach((ds) => {
        out.push({
            key: ds.id,
            label: `${ds.name} (root)`,
        });
        function walk(node, keyPrefix) {
            const key = `${keyPrefix}::${node.name}`;
            out.push({
                key,
                label: key.split("::").join(" → "),
            });
            (node.children || []).forEach((ch) => walk(ch, key));
        }
        getDsTree(ds).forEach((n) => walk(n, ds.id));
    });
    return out;
}

function dsaPersistUserPayload() {
    try {
        if (!dsaUserPayload.removals) {
            dsaUserPayload.removals = [];
        }
        localStorage.setItem(DSA_USER_STORAGE_KEY, JSON.stringify(dsaUserPayload));
    } catch (err) {
        console.warn("DSA user data: localStorage save failed", err);
    }
}

function dsaAddUserNode(entry) {
    const id = `u-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const row = {
        id,
        parentKey: entry.parentKey,
        type: entry.type,
        name: entry.name.trim(),
        url: (entry.url || "").trim(),
    };
    const gbc = entry.graphCategoryId != null ? String(entry.graphCategoryId).trim() : "";
    if (gbc) {
        row.graphCategoryId = gbc;
    }
    const ncs = entry.nodeCategorySlug != null ? String(entry.nodeCategorySlug).trim().toUpperCase() : "";
    if (ncs) {
        row.nodeCategorySlug = ncs;
    }
    dsaUserPayload.nodes.push(row);
    dsaPersistUserPayload();
    dsaScheduleDsaCmsSync();
}

/** Rewrite parentKey / removal paths after a tree node rename (paths use :: segments; DS id is unchanged). */
function dsaRewriteDsaStoredPaths(oldFull, newFull) {
    if (!oldFull || !newFull || oldFull === newFull) {
        return;
    }
    (dsaUserPayload.nodes || []).forEach((n) => {
        if (!n || n.parentKey == null) {
            return;
        }
        const pk = String(n.parentKey);
        if (pk === oldFull) {
            n.parentKey = newFull;
        } else if (pk.startsWith(oldFull + "::")) {
            n.parentKey = newFull + pk.slice(oldFull.length);
        }
    });
    (dsaUserPayload.removals || []).forEach((r) => {
        if (!r || r.path == null) {
            return;
        }
        if (r.type !== "problem" && r.type !== "node") {
            return;
        }
        const p = String(r.path);
        if (p === oldFull) {
            r.path = newFull;
        } else if (p.startsWith(oldFull + "::")) {
            r.path = newFull + p.slice(oldFull.length);
        }
    });
}

/**
 * Admin: rename a data-structure root (path = id) or a nested topic node. Updates dsaHierarchy and/or user overlay;
 * rewrites stored parentKeys under the old path prefix.
 * @returns {boolean}
 */
function dsaRenameGraphNodeAtPath(oldPathKey, newName) {
    const nm = String(newName || "").trim();
    if (!nm || nm.indexOf("::") >= 0) {
        window.alert('Use a short label without "::" in it.');
        return false;
    }
    const parts = oldPathKey.split("::").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) {
        return false;
    }
    const oldSeg = parts[parts.length - 1];
    if (oldSeg === nm) {
        return true;
    }

    const merged = getDsaHierarchyMerged();
    const r = dsaResolveParentNode(merged, oldPathKey);
    if (!r || r.metaRoot) {
        return false;
    }

    const parentPk = parts.length > 1 ? parts.slice(0, -1).join("::") : "";
    const rParent = parentPk ? dsaResolveParentNode(merged, parentPk) : null;
    if (parts.length === 1) {
        const dup = merged.some((d) => d && !dsaDsIdEq(d.id, parts[0]) && String(d.name || "").trim() === nm);
        if (dup) {
            window.alert("Another data structure already uses that name.");
            return false;
        }
    } else if (rParent && !rParent.metaRoot) {
        const sibs =
            rParent.parentNode != null
                ? rParent.parentNode.children || []
                : dsaGetMutableTopArray(rParent.ds);
        if (Array.isArray(sibs) && sibs.some((n) => n && String(n.name || "").trim() === nm)) {
            window.alert("A sibling topic already uses that name.");
            return false;
        }
    }

    const newFullPath = parts.length === 1 ? parts[0] : [...parts.slice(0, -1), nm].join("::");
    if (parts.length > 1 && oldPathKey !== newFullPath) {
        dsaRewriteDsaStoredPaths(oldPathKey, newFullPath);
    }

    if (parts.length === 1) {
        const ds = dsaHierarchy.find((d) => dsaDsIdEq(d.id, parts[0]));
        const ent = (dsaUserPayload.nodes || []).find(
            (x) =>
                dsaUserPayloadIsBranchStyleEntry(x) &&
                x.parentKey === "__DSA_META__" &&
                dsaDsIdEq(x.id, parts[0]),
        );
        if (!ds && !ent) {
            return false;
        }
        if (ds) {
            ds.name = nm;
        }
        if (ent) {
            ent.name = nm;
        }
    } else {
        const rBase = dsaResolveParentNode(dsaHierarchy, parentPk);
        let updated = false;
        if (rBase && !rBase.metaRoot) {
            const list =
                rBase.parentNode != null
                    ? rBase.parentNode.children || []
                    : dsaGetMutableTopArray(rBase.ds);
            const node = Array.isArray(list) ? list.find((n) => n && String(n.name || "") === oldSeg) : null;
            if (node) {
                node.name = nm;
                updated = true;
            }
        }
        if (!updated) {
            const ent = (dsaUserPayload.nodes || []).find(
                (x) =>
                    dsaUserPayloadIsBranchStyleEntry(x) &&
                    String(x.parentKey || "") === parentPk &&
                    String(x.name || "").trim() === oldSeg,
            );
            if (!ent) {
                return false;
            }
            ent.name = nm;
        }
    }

    dsaPersistUserPayload();
    dsaScheduleDsaCmsSync();
    return true;
}

/** Legacy entries may have both; UI uses a single hint field. */
function dsaMergeHintCommentFromEntry(e) {
    if (!e) {
        return "";
    }
    const c = e.comment != null ? String(e.comment).trim() : "";
    const h = e.hint != null ? String(e.hint).trim() : "";
    if (c && h) {
        return `${c}\n\n${h}`;
    }
    return c || h;
}

/** Merge LeetCode-style problem row from a saved user problem entry. */
function dsaBuildProblemFromQuestionEntry(e, name, href) {
    const o = { name, url: href };
    if (e && e.id) {
        o.userNodeId = e.id;
    }
    const merged = dsaMergeHintCommentFromEntry(e);
    if (merged) {
        o.hint = merged;
    }
    const sols = dsaSolutionsFromEntry(e);
    if (sols.length) {
        o.solutions = sols;
        const fc = sols.find((x) => String(x.code || "").trim());
        if (fc) {
            o.code = String(fc.code).trim();
        }
    } else {
        const cd = e && e.code != null ? String(e.code).trim() : "";
        if (cd) {
            o.code = cd;
        }
    }
    const dr = e && e.drawing != null ? String(e.drawing).trim() : "";
    if (dr) {
        o.drawing = dr;
    }
    const im = e && e.image != null ? String(e.image).trim() : "";
    if (im) {
        o.image = im;
    }
    const comps = dsaNormalizeCompaniesArray(e && e.companies);
    if (comps.length) {
        o.companies = comps;
    }
    const sv = e && e.solutionVideoUrl != null ? String(e.solutionVideoUrl).trim() : "";
    if (sv) {
        o.solutionVideoUrl = sv;
    }
    if (!sols.length) {
        const stc = e && e.solutionTimeComplexity != null ? String(e.solutionTimeComplexity).trim() : "";
        if (stc) {
            o.solutionTimeComplexity = stc;
        }
        const ssc = e && e.solutionSpaceComplexity != null ? String(e.solutionSpaceComplexity).trim() : "";
        if (ssc) {
            o.solutionSpaceComplexity = ssc;
        }
        const scat = dsaNormalizeSolutionCategory(e && e.solutionCategory);
        if (scat) {
            o.solutionCategory = scat;
        }
    }
    if (e && e.starred) {
        o.starred = true;
    }
    if (e && e.done) {
        o.done = true;
    }
    o.difficulty = dsaNormalizeProblemDifficulty(e && e.difficulty);
    const gbc = e && e.graphCategoryId != null ? String(e.graphCategoryId).trim() : "";
    if (gbc) {
        o.graphCategoryId = gbc;
    }
    o.nodeCategorySlug = "PROBLEM";
    return o;
}

function dsaFindUserQuestionEntry(parentKey, name) {
    const n = String(name || "").trim();
    if (!n || !parentKey) {
        return null;
    }
    return (dsaUserPayload.nodes || []).find(
        (x) => dsaUserPayloadIsProblemEntry(x) && x.parentKey === parentKey && x.name === n,
    );
}

function dsaFindUserQuestionById(id) {
    const sid = String(id || "").trim();
    if (!sid) {
        return null;
    }
    return (
        (dsaUserPayload.nodes || []).find((x) => dsaUserPayloadIsProblemEntry(x) && x.id === sid) || null
    );
}

/** Problem row on a merged tree node (CMS + user overlay). */
function dsaFindMergedProblemRow(parentKey, problemName) {
    const want = String(problemName || "").trim();
    if (!parentKey || !want) {
        return null;
    }
    const merged = getDsaHierarchyMerged();
    const resolved = dsaResolveParentNode(merged, parentKey);
    if (!resolved) {
        return null;
    }
    let probs = null;
    if (resolved.parentNode) {
        probs = resolved.parentNode.problems;
    } else if (resolved.ds) {
        /* Problems attached at DS root (`parentKey` = e.g. `arrays`) live on `ds.problems`, not a tree node. */
        probs = resolved.ds.problems;
    }
    if (!Array.isArray(probs) || !probs.length) {
        return null;
    }
    return probs.find((p) => p && String(p.name || "").trim() === want) || null;
}

/**
 * Find a problem anywhere in merged hierarchy by stable user id (after overlay row was dropped post-sync).
 * @returns {{ row: object, parentKey: string } | null}
 */
function dsaFindMergedProblemByUserNodeId(clone, userNodeId) {
    const id = String(userNodeId || "").trim();
    if (!id || !Array.isArray(clone)) {
        return null;
    }
    function scanProbs(probs, parentKeyStr) {
        if (!Array.isArray(probs)) {
            return null;
        }
        const hit = probs.find((p) => p && String(p.userNodeId || "") === id);
        return hit ? { row: hit, parentKey: parentKeyStr } : null;
    }
    for (const ds of clone) {
        if (!ds) {
            continue;
        }
        const dsId = String(ds.id || "").trim();
        if (!dsId) {
            continue;
        }
        const atRoot = scanProbs(ds.problems, dsId);
        if (atRoot) {
            return atRoot;
        }
        const top = dsaGetMutableTopArray(ds);
        if (!Array.isArray(top)) {
            continue;
        }
        function walk(nodes, pathParts) {
            if (!Array.isArray(nodes)) {
                return null;
            }
            for (const n of nodes) {
                if (!n) {
                    continue;
                }
                const seg = String(n.name || "").trim();
                const next = [...pathParts, seg];
                const pk = next.join("::");
                const foundHere = scanProbs(n.problems, pk);
                if (foundHere) {
                    return foundHere;
                }
                const deeper = walk(n.children, next);
                if (deeper) {
                    return deeper;
                }
            }
            return null;
        }
        const found = walk(top, [dsId]);
        if (found) {
            return found;
        }
    }
    return null;
}

/** Build a user-payload-shaped row for the modal from a merged problem row (e.g. after CMS sync cleared local overlay). */
function dsaMergedProblemRowToQuestionEntry(row, parentKey, problemName) {
    const nm = row && row.name != null ? String(row.name).trim() : String(problemName || "").trim();
    const solutions = dsaSolutionsFromMergedRow(row);
    const firstCode =
        solutions.find((s) => String(s.code || "").trim()) || solutions[0] || null;
    const o = {
        id: row.userNodeId || undefined,
        parentKey,
        type: "problem",
        name: nm,
        url: row.url != null ? String(row.url) : "",
        comment: "",
        hint: row.hint != null ? String(row.hint) : "",
        code: firstCode && firstCode.code != null ? String(firstCode.code) : row.code != null ? String(row.code) : "",
        solutions,
        drawing: row.drawing != null ? String(row.drawing) : "",
        image: row.image != null ? String(row.image) : "",
        companies: dsaNormalizeCompaniesArray(row && row.companies),
        solutionVideoUrl: row.solutionVideoUrl != null ? String(row.solutionVideoUrl) : "",
        solutionTimeComplexity: row.solutionTimeComplexity != null ? String(row.solutionTimeComplexity) : "",
        solutionSpaceComplexity: row.solutionSpaceComplexity != null ? String(row.solutionSpaceComplexity) : "",
        solutionCategory: dsaNormalizeSolutionCategory(row && row.solutionCategory),
        starred: !!(row && row.starred),
        done: !!(row && row.done),
        difficulty: dsaNormalizeProblemDifficulty(row && row.difficulty),
    };
    const gbc = row && row.graphCategoryId != null ? String(row.graphCategoryId).trim() : "";
    if (gbc) {
        o.graphCategoryId = gbc;
    }
    return o;
}

/** Prefer user-payload row; else merged tree (same data shown on the card). */
function dsaResolveQuestionForModal(parentKey, problemName, userNodeId) {
    const n = String(problemName || "").trim();
    const uid = userNodeId ? String(userNodeId).trim() : "";
    if (uid) {
        const byId = dsaFindUserQuestionById(uid);
        if (byId) {
            return byId;
        }
        const mergedById = dsaFindMergedProblemByUserNodeId(getDsaHierarchyMerged(), uid);
        if (mergedById && mergedById.row) {
            return dsaMergedProblemRowToQuestionEntry(
                mergedById.row,
                mergedById.parentKey,
                n || String(mergedById.row.name || "").trim(),
            );
        }
    }
    if (!parentKey || !n) {
        return null;
    }
    const byPk = dsaFindUserQuestionEntry(parentKey, n);
    if (byPk) {
        return byPk;
    }
    const row = dsaFindMergedProblemRow(parentKey, n);
    if (row) {
        return dsaMergedProblemRowToQuestionEntry(row, parentKey, n);
    }
    return null;
}

function dsaUpsertUserQuestionNode(payload) {
    const name = String(payload.name || "").trim();
    const parentKey = payload.parentKey;
    if (!parentKey || !name) {
        return;
    }
    if (parentKey === "__DSA_META__") {
        return;
    }
    const wantId = payload.id != null ? String(payload.id).trim() : "";
    let idx = -1;
    if (wantId) {
        idx = dsaUserPayload.nodes.findIndex((x) => x && x.id === wantId);
    }
    if (idx < 0) {
        idx = dsaUserPayload.nodes.findIndex(
            (x) => dsaUserPayloadIsProblemEntry(x) && x.parentKey === parentKey && x.name === name,
        );
    }
    const id =
        idx >= 0
            ? dsaUserPayload.nodes[idx].id
            : wantId || `u-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const solsIn = Array.isArray(payload.solutions)
        ? payload.solutions.map((x) => dsaNormalizeSolutionItem(x)).filter(Boolean)
        : [];
    const firstWithCode = solsIn.find((s) => String(s.code || "").trim());
    const legacyCode =
        payload.code != null && String(payload.code).trim()
            ? String(payload.code)
            : firstWithCode
              ? String(firstWithCode.code)
              : "";
    const row = {
        id,
        parentKey,
        type: "problem",
        name,
        url: String(payload.url || "").trim(),
        comment: "",
        hint: payload.hint != null ? String(payload.hint) : "",
        code: legacyCode,
        solutions: solsIn,
        drawing: payload.drawing != null ? String(payload.drawing) : "",
        image: payload.image != null ? String(payload.image) : "",
        companies: dsaNormalizeCompaniesArray(payload.companies),
        solutionVideoUrl: payload.solutionVideoUrl != null ? String(payload.solutionVideoUrl).trim() : "",
        solutionTimeComplexity:
            payload.solutionTimeComplexity != null ? String(payload.solutionTimeComplexity).trim() : "",
        solutionSpaceComplexity:
            payload.solutionSpaceComplexity != null ? String(payload.solutionSpaceComplexity).trim() : "",
        solutionCategory: dsaNormalizeSolutionCategory(payload.solutionCategory),
        starred: payload.starred === true,
        done: payload.done === true,
        difficulty: dsaNormalizeProblemDifficulty(payload.difficulty),
    };
    const prevRow = idx >= 0 ? dsaUserPayload.nodes[idx] : null;
    if (Object.prototype.hasOwnProperty.call(payload, "graphCategoryId")) {
        const gb = payload.graphCategoryId != null ? String(payload.graphCategoryId).trim() : "";
        if (gb) {
            row.graphCategoryId = gb;
        }
    } else if (prevRow && prevRow.graphCategoryId) {
        row.graphCategoryId = prevRow.graphCategoryId;
    }
    const pSlug = payload.nodeCategorySlug != null ? String(payload.nodeCategorySlug).trim().toUpperCase() : "";
    if (pSlug) {
        row.nodeCategorySlug = pSlug;
    } else {
        row.nodeCategorySlug = "PROBLEM";
    }
    if (idx >= 0) {
        dsaUserPayload.nodes[idx] = row;
    } else {
        dsaUserPayload.nodes.push(row);
    }
    dsaPersistUserPayload();
    dsaScheduleDsaCmsSync();
}

/** Toggle practice problem “done” for any signed-in user; persists to overlay (+ CMS when admin). */
function dsaToggleProblemDone(parentKey, prob, refreshCb) {
    const name = prob && prob.name != null ? String(prob.name).trim() : "";
    if (!parentKey || !name) {
        return;
    }
    const uid = prob && prob.userNodeId ? String(prob.userNodeId).trim() : "";
    const ent = dsaResolveQuestionForModal(parentKey, name, uid);
    if (!ent) {
        return;
    }
    const nextDone = !(ent.done === true);
    dsaUpsertUserQuestionNode({
        id: ent.id,
        parentKey,
        name: ent.name,
        url: ent.url != null ? String(ent.url) : "",
        comment: "",
        hint: ent.hint != null ? String(ent.hint) : "",
        code: ent.code != null ? String(ent.code) : "",
        solutions: dsaSolutionsFromEntry(ent),
        drawing: ent.drawing != null ? String(ent.drawing) : "",
        image: ent.image != null ? String(ent.image) : "",
        companies: dsaNormalizeCompaniesArray(ent.companies),
        solutionVideoUrl: ent.solutionVideoUrl != null ? String(ent.solutionVideoUrl).trim() : "",
        solutionTimeComplexity: ent.solutionTimeComplexity != null ? String(ent.solutionTimeComplexity).trim() : "",
        solutionSpaceComplexity:
            ent.solutionSpaceComplexity != null ? String(ent.solutionSpaceComplexity).trim() : "",
        solutionCategory: dsaNormalizeSolutionCategory(ent.solutionCategory),
        starred: !!(ent && ent.starred),
        done: nextDone,
        difficulty: dsaNormalizeProblemDifficulty(ent && ent.difficulty),
    });
    const graphPanel = document.getElementById("dsa-graph-panel");
    const livePatched =
        graphPanel &&
        !graphPanel.hidden &&
        dsaPatchProgressUiLive(graphPanel, parentKey, drawDsaMindmapEdges);
    void dsaFlushDsaCmsSync().then(() => {
        if (typeof refreshCb === "function" && !livePatched) {
            refreshCb();
        }
    });
}

function dsaToggleProblemImportant(parentKey, prob, refreshCb) {
    const name = prob && prob.name != null ? String(prob.name).trim() : "";
    if (!parentKey || !name) {
        return;
    }
    const uid = prob && prob.userNodeId ? String(prob.userNodeId).trim() : "";
    const ent = dsaResolveQuestionForModal(parentKey, name, uid);
    if (!ent) {
        return;
    }
    const nextStarred = !(ent.starred === true);
    dsaUpsertUserQuestionNode({
        id: ent.id,
        parentKey,
        name: ent.name,
        url: ent.url != null ? String(ent.url) : "",
        comment: "",
        hint: ent.hint != null ? String(ent.hint) : "",
        code: ent.code != null ? String(ent.code) : "",
        solutions: dsaSolutionsFromEntry(ent),
        drawing: ent.drawing != null ? String(ent.drawing) : "",
        image: ent.image != null ? String(ent.image) : "",
        companies: dsaNormalizeCompaniesArray(ent.companies),
        solutionVideoUrl: ent.solutionVideoUrl != null ? String(ent.solutionVideoUrl).trim() : "",
        solutionTimeComplexity: ent.solutionTimeComplexity != null ? String(ent.solutionTimeComplexity).trim() : "",
        solutionSpaceComplexity:
            ent.solutionSpaceComplexity != null ? String(ent.solutionSpaceComplexity).trim() : "",
        solutionCategory: dsaNormalizeSolutionCategory(ent.solutionCategory),
        starred: nextStarred,
        done: !!(ent && ent.done),
        difficulty: dsaNormalizeProblemDifficulty(ent && ent.difficulty),
    });
    void dsaFlushDsaCmsSync();
    return nextStarred;
}

function dsaExportUserNodesJson() {
    const text = JSON.stringify(dsaUserPayload, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dsa-user-nodes.json";
    a.rel = "noopener";
    a.click();
    URL.revokeObjectURL(a.href);
}

/** Current mind map roots (`dsaHierarchy`) — site CMS / draft shape. */
function dsaExportMindMapHierarchyJson() {
    const text = JSON.stringify(dsaHierarchy, null, 2);
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dsa-mind-map.json";
    a.rel = "noopener";
    a.click();
    URL.revokeObjectURL(a.href);
}
window.dsaExportMindMapHierarchyJson = dsaExportMindMapHierarchyJson;

/**
 * Replace `dsaHierarchy` from mind-map JSON (array of roots) and redraw. Preserves view tab when possible.
 * @param {string} text
 */
function dsaImportMindMapHierarchyFromText(text) {
    const data = JSON.parse(String(text || ""));
    if (!Array.isArray(data)) {
        throw new Error("Mind map JSON must be an array of root topics.");
    }
    dsaHierarchy = data;
    const st = typeof dsaCaptureGraphViewState === "function" ? dsaCaptureGraphViewState() : null;
    loadDsaPatternsPage({ restore: st });
}
window.dsaImportMindMapHierarchyFromText = dsaImportMindMapHierarchyFromText;

/** Serialize current mind map roots for cloud save (member library). */
function dsaGetMindMapHierarchyJsonString() {
    return JSON.stringify(dsaHierarchy);
}
window.dsaGetMindMapHierarchyJsonString = dsaGetMindMapHierarchyJsonString;

/** Merge CMS hierarchy + user overlay (same as render); use before saving personal cloud graphs so categories persist. */
function dsaGetMindMapHierarchyMergedJsonString() {
    return JSON.stringify(getDsaHierarchyMerged());
}
window.dsaGetMindMapHierarchyMergedJsonString = dsaGetMindMapHierarchyMergedJsonString;

/** Reload published CMS map (`/api/data?k=dsa`) and redraw (e.g. leave a personal cloud graph). */
async function dsaReloadSiteDefaultMapInView() {
    if (typeof window !== "undefined") {
        window.__dsaGraphBodyCategories = [];
    }
    await dsaLoadHierarchyFromSources();
    const st = typeof dsaCaptureGraphViewState === "function" ? dsaCaptureGraphViewState() : null;
    loadDsaPatternsPage({ restore: st });
}
window.dsaReloadSiteDefaultMapInView = dsaReloadSiteDefaultMapInView;

/** Wire one Export / Import trio (practice graph JSON). Skips if any element missing. */
function dsaWireMapToolbarExportImport(expId, impTrigId, impFileId) {
    const exp = document.getElementById(expId);
    const impTrig = document.getElementById(impTrigId);
    const impFile = document.getElementById(impFileId);
    if (!exp || !impTrig || !impFile) {
        return;
    }
    if (exp.dataset.dsaBound === "1") {
        return;
    }
    exp.dataset.dsaBound = "1";
    exp.addEventListener("click", () => {
        if (typeof dsaExportMindMapHierarchyJson === "function") {
            dsaExportMindMapHierarchyJson();
        }
    });
    impTrig.addEventListener("click", () => impFile.click());
    impFile.addEventListener("change", () => {
        const f = impFile.files && impFile.files[0];
        if (!f) {
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            try {
                if (typeof window !== "undefined") {
                    window.__dsaGraphBodyCategories = [];
                }
                dsaImportMindMapHierarchyFromText(String(reader.result || ""));
            } catch (e) {
                window.alert((e && e.message) || "Could not import JSON.");
            }
            impFile.value = "";
        };
        reader.readAsText(f);
    });
}

/** Wire Export/Import on index + embedded graph studios (not admin CMS — that uses editor sync). */
function dsaWireIndexMapToolbarStatic() {
    dsaWireMapToolbarExportImport("dsa-map-export-json", "dsa-map-import-json-trigger", "dsa-map-import-file");
    dsaWireMapToolbarExportImport(
        "udash-dsa-map-export-json",
        "udash-dsa-map-import-json-trigger",
        "udash-dsa-map-import-file",
    );
}
window.dsaWireIndexMapToolbarStatic = dsaWireIndexMapToolbarStatic;

function dsaImportUserNodesFromText(text) {
    const data = JSON.parse(text);
    const nodes = data && data.nodes ? data.nodes : [];
    const removalsIn = data && data.removals ? data.removals : [];
    const byId = new Map();
    (dsaUserPayload.nodes || []).forEach((n) => byId.set(n.id, n));
    nodes.forEach((n) => {
        if (n && n.id) {
            byId.set(n.id, n);
        }
    });
    const remMerged = dsaDedupeRemovalsLastWins([...(dsaUserPayload.removals || []), ...removalsIn]);
    dsaUserPayload = { version: 1, nodes: Array.from(byId.values()), removals: remMerged };
    dsaPersistUserPayload();
    dsaScheduleDsaCmsSync();
}

async function dsaInitUserData() {
    let fromFile = { version: 1, nodes: [] };
    try {
        const jsonUrl = new URL("data/dsa-user-nodes.json", window.location.href).href;
        const r = await fetch(jsonUrl, { cache: "no-store" });
        if (r.ok) {
            fromFile = await r.json();
        }
    } catch (err) {
        /* offline or missing file */
    }
    let fromLs = null;
    try {
        fromLs = JSON.parse(localStorage.getItem(DSA_USER_STORAGE_KEY) || "null");
    } catch (err) {
        fromLs = null;
    }
    const byId = new Map();
    (fromFile.nodes || []).forEach((n) => {
        if (n && n.id) {
            byId.set(n.id, n);
        }
    });
    (fromLs && fromLs.nodes ? fromLs.nodes : []).forEach((n) => {
        if (n && n.id) {
            byId.set(n.id, n);
        }
    });
    const remFile = fromFile.removals || [];
    const remLs = (fromLs && fromLs.removals) || [];
    const remMerged = dsaDedupeRemovalsLastWins([...remFile, ...remLs]);
    dsaUserPayload = { version: 1, nodes: Array.from(byId.values()), removals: remMerged };
}

function dsaDedupeRemovalsLastWins(list) {
    const m = new Map();
    (list || []).forEach((r) => {
        if (!r || !r.type) {
            return;
        }
        const k =
            r.type === "problem" ? `problem:${r.path}:${r.problemName}` : r.type === "node" ? `node:${r.path}` : "";
        if (k) {
            m.set(k, r);
        }
    });
    return Array.from(m.values());
}

function dsaRecordRemoval(record) {
    dsaUserPayload.removals = dsaUserPayload.removals || [];
    dsaUserPayload.removals.push(record);
    dsaUserPayload.removals = dsaDedupeRemovalsLastWins(dsaUserPayload.removals);
    dsaPersistUserPayload();
    dsaScheduleDsaCmsSync();
}

/** Remove one practice problem from the merged graph (user node + removal record). */
function dsaDeletePracticeProblem(parentKey, problemName, userNodeId) {
    const n = String(problemName || "").trim();
    if (!parentKey || !n) {
        return;
    }
    const sid = userNodeId != null ? String(userNodeId).trim() : "";
    let i = -1;
    if (sid) {
        i = dsaUserPayload.nodes.findIndex((x) => dsaUserPayloadIsProblemEntry(x) && x.id === sid);
    }
    if (i < 0) {
        i = dsaUserPayload.nodes.findIndex(
            (x) => dsaUserPayloadIsProblemEntry(x) && x.parentKey === parentKey && x.name === n,
        );
    }
    if (i >= 0) {
        dsaUserPayload.nodes.splice(i, 1);
    }
    dsaRecordRemoval({ type: "problem", path: parentKey, problemName: n });
}

/** After successful PUT, hierarchy in D1 matches the graph; local overlay is cleared to avoid double-applying. */
let dsaCmsSyncQueue = Promise.resolve();

function dsaRemovalRecordKey(r) {
    if (!r || !r.type) {
        return "";
    }
    if (r.type === "problem") {
        return `problem:${String(r.path || "").trim()}:${String(r.problemName || "").trim()}`;
    }
    if (r.type === "node") {
        return `node:${String(r.path || "").trim()}`;
    }
    return "";
}

/** True if merged hierarchy already embeds this user overlay row (by id / userNodeId / top-level ds id). */
function dsaMergedHierarchyReferencesUserNodeId(clone, wantId) {
    const id = String(wantId || "").trim();
    if (!id) {
        return true;
    }
    if (!Array.isArray(clone)) {
        return false;
    }
    if (clone.some((d) => d && String(d.id || "") === id)) {
        return true;
    }
    function probHasId(node) {
        const probs = node && node.problems;
        if (!Array.isArray(probs)) {
            return false;
        }
        return probs.some((p) => p && String(p.userNodeId || "") === id);
    }
    function walk(nodes) {
        if (!Array.isArray(nodes)) {
            return false;
        }
        for (const n of nodes) {
            if (!n) {
                continue;
            }
            if (probHasId(n)) {
                return true;
            }
            if (walk(n.children)) {
                return true;
            }
        }
        return false;
    }
    for (const ds of clone) {
        if (!ds) {
            continue;
        }
        const rootProbs = ds.problems;
        if (Array.isArray(rootProbs) && rootProbs.some((p) => p && String(p.userNodeId || "") === id)) {
            return true;
        }
        if (walk(ds.tree)) {
            return true;
        }
        if (walk(ds.patterns)) {
            return true;
        }
    }
    return false;
}

/**
 * True if a merged clone already contains this user “branch” overlay (nested pattern/group rows have no userNodeId,
 * so {@link dsaMergedHierarchyReferencesUserNodeId} alone never clears them — that used to re-apply the same row on
 * every CMS sync wave and create dozens of duplicate siblings).
 */
function dsaMergedHierarchyContainsUserBranchOverlay(clone, entry) {
    if (!dsaUserPayloadIsBranchStyleEntry(entry)) {
        return false;
    }
    const pk = entry.parentKey;
    const nm = String(entry.name || "").trim();
    if (!pk || !nm) {
        return false;
    }
    if (pk === "__DSA_META__") {
        const eid = entry.id != null ? String(entry.id).trim() : "";
        return eid !== "" && clone.some((d) => d && String(d.id || "") === eid);
    }
    const resolved = dsaResolveParentNode(clone, pk);
    if (!resolved || resolved.metaRoot) {
        return false;
    }
    const list =
        resolved.parentNode != null
            ? resolved.parentNode.children || []
            : dsaGetMutableTopArray(resolved.ds);
    if (!Array.isArray(list)) {
        return false;
    }
    return list.some((n) => n && String(n.name || "").trim() === nm);
}

async function dsaSyncMergedHierarchyToCmsInternal() {
    if (typeof dsaIsAdminSession !== "function" || !dsaIsAdminSession()) {
        return;
    }
    const tok = typeof dsaGetAdminJwt === "function" ? dsaGetAdminJwt() : "";
    if (!tok) {
        return;
    }
    /**
     * Run one or more PUT waves in this single scheduled task so `await dsaFlushDsaCmsSync()` waits for
     * all overlay rows to reach D1. Previously we chained a follow-up sync with `dsaScheduleDsaCmsSync()`
     * after await fetch; the UI's `refresh()` ran before that second PUT, and the in-memory graph could miss
     * new problems (hint / sketch / image) that were still only in the user payload.
     */
    const MAX_WAVES = 24;
    for (let wave = 0; wave < MAX_WAVES; wave++) {
        const nodesNow = dsaUserPayload.nodes || [];
        const remsNow = dsaUserPayload.removals || [];
        if (!nodesNow.length && !remsNow.length) {
            break;
        }
        /* Snapshot ids/keys before await: while fetch is in flight another save may append nodes. */
        const nodeIdsBefore = new Set(
            nodesNow.map((n) => (n && n.id ? String(n.id).trim() : "")).filter(Boolean),
        );
        const removalKeysBefore = new Set();
        remsNow.forEach((r) => {
            const k = dsaRemovalRecordKey(r);
            if (k) {
                removalKeysBefore.add(k);
            }
        });
        const merged = getDsaHierarchyMerged();
        const body = JSON.stringify(merged);
        try {
            const r = await fetch(dsaApiDataUrl("dsa"), {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + tok,
                },
                body,
            });
            const errText = await r.text();
            if (!r.ok) {
                console.warn("DSA: could not save to CMS (D1)", r.status, errText);
                return;
            }
            dsaHierarchy = JSON.parse(JSON.stringify(merged));
            const nodesAfter = dsaUserPayload.nodes || [];
            /* Drop overlay rows only once they appear in merged — otherwise a failed merge used to wipe new problems from localStorage while D1 never got hint/sketch/image. */
            dsaUserPayload.nodes = nodesAfter.filter((n) => {
                const id = n && n.id ? String(n.id).trim() : "";
                if (!id || !nodeIdsBefore.has(id)) {
                    return true;
                }
                if (dsaMergedHierarchyReferencesUserNodeId(merged, id)) {
                    return false;
                }
                if (dsaMergedHierarchyContainsUserBranchOverlay(merged, n)) {
                    return false;
                }
                return true;
            });
            const remAfter = dsaUserPayload.removals || [];
            dsaUserPayload.removals = remAfter.filter((r) => {
                const k = dsaRemovalRecordKey(r);
                return !k || !removalKeysBefore.has(k);
            });
            if (!dsaUserPayload.removals.length) {
                dsaUserPayload.removals = [];
            }
            dsaPersistUserPayload();
        } catch (e) {
            console.warn("DSA: CMS save failed", e);
            return;
        }
    }
}

function dsaScheduleDsaCmsSync() {
    dsaCmsSyncQueue = dsaCmsSyncQueue
        .then(() => dsaSyncMergedHierarchyToCmsInternal())
        .catch((e) => {
            console.warn("DSA CMS sync", e);
        });
}

async function dsaFlushDsaCmsSync() {
    await dsaCmsSyncQueue;
}

/** Central “DSA Patterns” hub in full-map view — neutral / slate accent. */
const DSA_META_ROOT_THEME = {
    accent: "hsl(250, 42%, 48%)",
    accentMid: "hsl(250, 36%, 58%)",
    accentSoft: "hsl(250, 28%, 97%)",
    edge: "hsl(250, 42%, 38%)",
};

function dsaHueToTheme(hue) {
    const s = 56 + Math.floor(Math.random() * 14);
    const l = 46 + Math.floor(Math.random() * 10);
    return {
        accent: `hsl(${hue}, ${s}%, ${l}%)`,
        accentMid: `hsl(${hue}, ${s}%, ${Math.min(l + 12, 62)}%)`,
        accentSoft: `hsl(${hue}, ${Math.max(28, s - 28)}%, 96.5%)`,
        edge: `hsl(${hue}, ${s}%, ${Math.max(l - 14, 30)}%)`,
    };
}

/** Stable accent per id (topic row under DSA) — varied hues; same id always maps to the same colors. */
function dsaStableThemeForKey(key) {
    const s = String(key || "x");
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (h * 33 + s.charCodeAt(i)) >>> 0;
    }
    const hue = h % 360;
    const sat = 52 + (h % 18);
    const light = 44 + ((h >> 3) % 12);
    return {
        accent: `hsl(${hue}, ${sat}%, ${light}%)`,
        accentMid: `hsl(${hue}, ${sat}%, ${Math.min(light + 12, 62)}%)`,
        accentSoft: `hsl(${hue}, ${Math.max(28, sat - 26)}%, 96.5%)`,
        edge: `hsl(${hue}, ${sat}%, ${Math.max(light - 14, 30)}%)`,
    };
}

function dsaGenerateThemes(count) {
    const n = Math.max(count, 1);
    const step = 360 / n;
    const offset = Math.floor(Math.random() * 360);
    const themes = [];
    for (let i = 0; i < n; i++) {
        const hue = Math.floor((offset + i * step + Math.random() * 22) % 360);
        themes.push(dsaHueToTheme(hue));
    }
    return themes;
}

function dsaApplyThemeVars(el, t) {
    if (!el || !t) {
        return;
    }
    el.style.setProperty("--dsa-accent", t.accent);
    el.style.setProperty("--dsa-accent-mid", t.accentMid);
    el.style.setProperty("--dsa-accent-soft", t.accentSoft);
    el.style.setProperty("--dsa-edge", t.edge);
}

function dsaClearThemeVars(el) {
    if (!el || !el.style) {
        return;
    }
    ["--dsa-accent", "--dsa-accent-mid", "--dsa-accent-soft", "--dsa-edge"].forEach((p) => {
        el.style.removeProperty(p);
    });
}

function dsaResolveEdgeColor(branchEl) {
    const b = branchEl && branchEl.closest ? branchEl.closest(".dsa-h-branch") : null;
    if (!b) {
        return "#7B61FF";
    }
    const cs = getComputedStyle(b);
    const edge = cs.getPropertyValue("--dsa-edge").trim();
    const accent = cs.getPropertyValue("--dsa-accent").trim();
    return edge || accent || "#7B61FF";
}

/**
 * Prefer non-empty `tree`; otherwise use `patterns`.
 * Important: `[]` is truthy in JS — must not treat empty `tree` as “present” or we skip `patterns`
 * and render empty maps / 0-count badges while CMS data still lives under `patterns`.
 */
function getDsTree(ds) {
    if (!ds || typeof ds !== "object") {
        return [];
    }
    if (Array.isArray(ds.tree) && ds.tree.length > 0) {
        return ds.tree;
    }
    return (ds.patterns || []).map((p) => {
        const n = {
            name: p.name,
            problems: p.problems || [],
            children: p.children || []
        };
        dsaNormalizeExclusiveChildKindOnNode(n);
        return n;
    });
}

/** Badge number: direct child count for branches (nested topics only), problem count for leaves. */
function getBadgeCount(node) {
    const childrenArr = Array.isArray(node.children) ? node.children : [];
    const hasProb = node.problems && node.problems.length > 0;
    if (childrenArr.length > 0) {
        return childrenArr.length;
    }
    if (childrenArr.length === 0 && !hasProb) {
        return 0;
    }
    return (node.problems || []).length;
}

/** All practice problems under one data-structure entry (root list + tree), for done/total progress. */
function dsaCollectDsProblemStats(ds) {
    let total = 0;
    let done = 0;
    function countList(arr) {
        if (!Array.isArray(arr)) {
            return;
        }
        for (const p of arr) {
            if (!p || typeof p !== "object") {
                continue;
            }
            const nm = String(p.name || "").trim();
            if (!nm) {
                continue;
            }
            total += 1;
            if (p.done === true) {
                done += 1;
            }
        }
    }
    if (ds) {
        countList(ds.problems);
        walk(getDsTree(ds));
    }
    function walk(nodes) {
        if (!Array.isArray(nodes)) {
            return;
        }
        for (const n of nodes) {
            if (!n) {
                continue;
            }
            countList(n.problems);
            walk(n.children);
        }
    }
    return { total, done };
}

/** All problems under one tree `node` (its `problems` + every descendant), for progress on any branch/leaf row. */
function dsaCollectTreeNodeProblemStats(node) {
    let total = 0;
    let done = 0;
    function countList(arr) {
        if (!Array.isArray(arr)) {
            return;
        }
        for (const p of arr) {
            if (!p || typeof p !== "object") {
                continue;
            }
            const nm = String(p.name || "").trim();
            if (!nm) {
                continue;
            }
            total += 1;
            if (p.done === true) {
                done += 1;
            }
        }
    }
    function walk(n) {
        if (!n || typeof n !== "object") {
            return;
        }
        countList(n.problems);
        const ch = Array.isArray(n.children) ? n.children : [];
        for (const c of ch) {
            walk(c);
        }
    }
    walk(node);
    return { total, done };
}

/** Aggregate done/total across every data-structure entry (full “DSA Patterns” map). */
function dsaCollectMetaAllProblemStats() {
    let total = 0;
    let done = 0;
    for (const ds of getDsaHierarchyMerged()) {
        if (!ds) {
            continue;
        }
        const st = dsaCollectDsProblemStats(ds);
        total += st.total;
        done += st.done;
    }
    return { total, done };
}

function dsaTopicProgressPercent(stats) {
    const t = stats && stats.total > 0 ? stats.total : 0;
    const d = stats && stats.done > 0 ? stats.done : 0;
    if (t <= 0) {
        return 0;
    }
    return Math.min(100, Math.max(0, Math.round((100 * Math.min(d, t)) / t)));
}

/** Path segments from root → `parentKey` (inclusive), e.g. `a::b` → [`a`, `a::b`]. */
function dsaPathKeyAncestors(pathKey) {
    if (!pathKey || pathKey === "__DSA_META__") {
        return [];
    }
    const parts = pathKey.split("::").map((s) => s.trim()).filter(Boolean);
    const out = [];
    for (let i = 1; i <= parts.length; i++) {
        out.push(parts.slice(0, i).join("::"));
    }
    return out;
}

function dsaResolveNodeStatsForPathKey(pathKey) {
    if (!pathKey) {
        return null;
    }
    if (pathKey === "__DSA_META__") {
        return dsaCollectMetaAllProblemStats();
    }
    const merged = getDsaHierarchyMerged();
    const resolved = dsaResolveParentNode(merged, pathKey);
    if (!resolved || resolved.metaRoot) {
        return null;
    }
    const { ds, parentNode } = resolved;
    if (!parentNode) {
        return dsaCollectDsProblemStats(ds);
    }
    return dsaCollectTreeNodeProblemStats(parentNode);
}

function dsaFindProgressChipForPath(panel, pathKey) {
    if (!panel || !pathKey) {
        return null;
    }
    const activeRootId =
        dsaGraphActiveRoot && dsaGraphActiveRoot.dataset ? dsaGraphActiveRoot.dataset.dsId : null;
    if (
        activeRootId != null &&
        String(pathKey) === String(activeRootId) &&
        panel.querySelector(".dsa-h-branch--root:not(.dsa-h-branch--unified)")
    ) {
        const rootBranch = panel.querySelector(".dsa-h-tree > .dsa-h-branch--root:not(.dsa-h-branch--unified)");
        if (rootBranch) {
            const head = rootBranch.querySelector(":scope > .dsa-h-branch-head");
            const chip = head && head.querySelector(".dsa-h-name-badge-unit--progress-chip");
            if (chip) {
                return chip;
            }
        }
    }
    const wantPath = String(pathKey || "");
    const els = panel.querySelectorAll("[data-dsa-path]");
    for (let i = 0; i < els.length; i++) {
        const el = els[i];
        if (String(el.getAttribute("data-dsa-path") || "") !== wantPath) {
            continue;
        }
        if (el.classList.contains("dsa-h-leaf-block")) {
            return el.querySelector(":scope > .dsa-h-label-row .dsa-h-name-badge-unit--progress-chip");
        }
        const branch = el.parentElement;
        if (!branch || !branch.classList.contains("dsa-h-branch")) {
            continue;
        }
        const head = branch.querySelector(":scope > .dsa-h-branch-head");
        return head ? head.querySelector(".dsa-h-name-badge-unit--progress-chip") : null;
    }
    return null;
}

function dsaUpdateProgressChipElement(chipEl, stats) {
    if (!chipEl || !stats) {
        return;
    }
    const cnt = chipEl.querySelector(".dsa-h-topic-done-count");
    const fill = chipEl.querySelector(".dsa-h-topic-progress-fill--track");
    if (cnt) {
        cnt.textContent = `${stats.done}/${stats.total}`;
    }
    if (fill) {
        fill.style.width = `${dsaTopicProgressPercent(stats)}%`;
    }
}

/**
 * After toggling “done” on a problem, update done/total + bar width in-place (no graph remount).
 * @returns {boolean} true if at least one chip was updated (caller may skip full refresh).
 */
function dsaPatchProgressUiLive(panel, parentKey, scheduleEdgeRedraw) {
    if (!panel || panel.hidden || !parentKey || parentKey === "__DSA_META__") {
        return false;
    }
    const primaryStats = dsaResolveNodeStatsForPathKey(parentKey);
    const primaryChip = dsaFindProgressChipForPath(panel, parentKey);
    if (!primaryStats || !primaryChip) {
        return false;
    }
    const keys = [...new Set(dsaPathKeyAncestors(parentKey))];
    if (panel.querySelector(".dsa-h-branch--unified")) {
        keys.push("__DSA_META__");
    }
    for (let i = 0; i < keys.length; i++) {
        const pk = keys[i];
        const stats = dsaResolveNodeStatsForPathKey(pk);
        if (!stats) {
            continue;
        }
        const chip = dsaFindProgressChipForPath(panel, pk);
        if (chip) {
            dsaUpdateProgressChipElement(chip, stats);
        }
    }
    /* Practice-problems card has its own done/total chip in the header — keep it in sync too. */
    const leafBlock = panel.querySelector(`.dsa-h-leaf-block[data-dsa-path="${CSS.escape(String(parentKey))}"]`);
    const cardChip = leafBlock && leafBlock.querySelector(".dsa-h-problems-card-progress-chip");
    if (cardChip && primaryStats) {
        cardChip.textContent = `${primaryStats.done}/${primaryStats.total}`;
    }
    const rootsRow = document.querySelector(".dsa-graph-roots");
    if (rootsRow && !rootsRow.hidden) {
        const merged = getDsaHierarchyMerged();
        merged.forEach((ds) => {
            if (!ds) {
                return;
            }
            const id = String(ds.id);
            rootsRow.querySelectorAll(".dsa-node-root").forEach((btn) => {
                if (String(btn.dataset.dsId || "") !== id) {
                    return;
                }
                const chip = btn.querySelector(".dsa-h-name-badge-unit--progress-chip");
                if (chip) {
                    dsaUpdateProgressChipElement(chip, dsaCollectDsProblemStats(ds));
                }
            });
        });
    }
    if (typeof scheduleEdgeRedraw === "function") {
        requestAnimationFrame(scheduleEdgeRedraw);
    }
    return true;
}

/**
 * Snapshot Customize-graph UI before a full remount (save / sync / refresh) so expanded branches,
 * open practice-problem cards, and scroll position are restored — avoids “everything collapsed / jumped”.
 */
function captureDsaCustomizeGraphUiState() {
    const panel = document.getElementById("dsa-graph-panel");
    if (!panel || !panel.classList.contains("dsa-graph-panel--customize")) {
        return null;
    }
    const expandedBranchPaths = [];
    panel.querySelectorAll(".dsa-h-children:not(.dsa-h-children--collapsed)").forEach((el) => {
        const p = el.getAttribute("data-dsa-path");
        if (p != null && p !== "") {
            expandedBranchPaths.push(p);
        }
    });
    const openLeafKeys = [];
    panel.querySelectorAll(".dsa-h-leaf-block.dsa-h-leaf-block--open[data-dsa-leaf-key]").forEach((lb) => {
        const k = lb.getAttribute("data-dsa-leaf-key");
        if (k) {
            openLeafKeys.push(k);
        }
    });
    const scrollEl = panel.querySelector(".dsa-mind-scroll");
    const scroll =
        scrollEl && (scrollEl.scrollLeft > 0 || scrollEl.scrollTop > 0)
            ? { left: scrollEl.scrollLeft, top: scrollEl.scrollTop }
            : null;
    const out = {
        expandedBranchPaths: expandedBranchPaths.length ? expandedBranchPaths : null,
        openLeafKeys: openLeafKeys.length ? openLeafKeys : null,
        scroll,
    };
    if (!out.expandedBranchPaths && !out.openLeafKeys && !out.scroll) {
        return null;
    }
    return out;
}

/** @param {unknown} s */
function dsaNormalizeCustomizeGraphUiRestore(s) {
    if (!s) {
        return null;
    }
    if (Array.isArray(s)) {
        return s.length ? { expandedBranchPaths: s, openLeafKeys: null, scroll: null } : null;
    }
    if (typeof s === "object" && s !== null) {
        return s;
    }
    return null;
}

function dsaSyncCustomizeBranchOpenFromKids(kidsEl) {
    const branch = kidsEl.closest(".dsa-h-branch");
    if (!branch) {
        return;
    }
    const collapsed = kidsEl.classList.contains("dsa-h-children--collapsed");
    branch.querySelectorAll(".dsa-h-badge-ring-count").forEach((btn) => {
        btn.classList.toggle("dsa-h-badge--open", !collapsed);
        btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    });
}

function applyDsaCustomizeGraphUiState(panel, state, scheduleRedraw) {
    const st = dsaNormalizeCustomizeGraphUiRestore(state);
    if (!panel || !st) {
        if (typeof scheduleRedraw === "function") {
            requestAnimationFrame(() => scheduleRedraw());
        }
        return;
    }
    const paths = st.expandedBranchPaths;
    if (paths && paths.length) {
        paths.forEach((p) => {
            const el = Array.from(panel.querySelectorAll(".dsa-h-children[data-dsa-path]")).find(
                (k) => k.getAttribute("data-dsa-path") === p,
            );
            if (el) {
                el.classList.remove("dsa-h-children--collapsed");
                dsaSyncCustomizeBranchOpenFromKids(el);
            }
        });
    }
    const finish = () => {
        const leafKeys = st.openLeafKeys;
        if (leafKeys && leafKeys.length) {
            leafKeys.forEach((k) => {
                const lb = Array.from(panel.querySelectorAll(".dsa-h-leaf-block[data-dsa-leaf-key]")).find(
                    (el) => el.getAttribute("data-dsa-leaf-key") === k,
                );
                if (!lb) {
                    return;
                }
                const pp = lb.querySelector(".dsa-h-problems-panel");
                if (pp && pp.hidden) {
                    const btn = lb.querySelector(".dsa-h-badge-ring-count");
                    if (btn) {
                        btn.click();
                    }
                }
            });
        }
        const sc = st.scroll;
        if (sc && typeof sc.left === "number" && typeof sc.top === "number") {
            const scrollEl = panel.querySelector(".dsa-mind-scroll");
            if (scrollEl) {
                scrollEl.scrollLeft = sc.left;
                scrollEl.scrollTop = sc.top;
            }
        }
        if (typeof scheduleRedraw === "function") {
            requestAnimationFrame(() => requestAnimationFrame(() => scheduleRedraw()));
        }
    };
    if (st.openLeafKeys && st.openLeafKeys.length) {
        requestAnimationFrame(() => requestAnimationFrame(finish));
    } else {
        finish();
    }
}

/**
 * Vertical pipe before the count badge (progress chips under DSA Patterns / topic hubs / root bar).
 */
function createBadgeJoinerPipe() {
    const joiner = document.createElement("span");
    joiner.className = "dsa-h-badge-joiner dsa-h-badge-joiner--pipe";
    joiner.setAttribute("aria-hidden", "true");
    return joiner;
}

/**
 * Topic / DS chip: [ name + done/total + thin dark progress track ] | [count badge]. Text sits on the chip surface; fill is only in the track (no overlap).
 */
function createTopicProgressChipUnit(nameNode, doneCountNode, badgeNode, progressPct) {
    const unit = document.createElement("div");
    unit.className = "dsa-h-name-badge-unit dsa-h-name-badge-unit--progress-chip";
    const zone = document.createElement("div");
    zone.className = "dsa-h-name-badge-progress-zone";
    const inner = document.createElement("div");
    inner.className = "dsa-h-name-badge-progress-zone__inner";
    inner.appendChild(nameNode);
    inner.appendChild(doneCountNode);
    const track = document.createElement("div");
    track.className = "dsa-h-topic-progress-track";
    track.setAttribute("aria-hidden", "true");
    const fill = document.createElement("div");
    fill.className = "dsa-h-topic-progress-fill dsa-h-topic-progress-fill--track";
    fill.style.width = `${Math.min(100, Math.max(0, progressPct))}%`;
    track.appendChild(fill);
    zone.appendChild(inner);
    zone.appendChild(track);
    unit.appendChild(zone);
    unit.appendChild(createBadgeJoinerPipe());
    unit.appendChild(badgeNode);
    return unit;
}

/**
 * Wraps name + optional middle + pipe + count (same vertical rule as progress chips).
 */
function createNameBadgeUnit(nameNode, badgeNode, betweenNameAndJoiner) {
    const unit = document.createElement("div");
    unit.className = "dsa-h-name-badge-unit";
    unit.appendChild(nameNode);
    if (betweenNameAndJoiner) {
        unit.appendChild(betweenNameAndJoiner);
    }
    unit.appendChild(createBadgeJoinerPipe());
    unit.appendChild(badgeNode);
    return unit;
}

function getUrlHost(url) {
    if (!url || typeof url !== "string") {
        return "";
    }
    try {
        return new URL(url, typeof window !== "undefined" ? window.location.href : "https://placeholder.local")
            .hostname.replace(/^www\./i, "")
            .toLowerCase();
    } catch {
        return "";
    }
}

/** If the link omits https://, URL() uses the current page as base — host detection breaks. Fix known judges only. */
function dsaNormalizeProblemUrlForPlatform(url) {
    const s = String(url || "").trim();
    if (!s || s === "#") {
        return s;
    }
    if (/^https?:\/\//i.test(s)) {
        return s;
    }
    const u = s.replace(/^\/+/, "");
    if (
        /leetcode\.(com|cn)\b/i.test(u) ||
        /geeksforgeeks\.org\b/i.test(u) ||
        /codingninjas\.com\b/i.test(u) ||
        (/naukri\.com\b/i.test(u) && /code360/i.test(u))
    ) {
        return `https://${u}`;
    }
    return s;
}

/**
 * Hostname suffix → icon key + tooltip label. Order: most specific hosts first (leetcode.cn before leetcode.com).
 * Used so problem rows auto-pick the right badge from the link (LeetCode, GfG, Coding Ninjas, etc.).
 */
const DSA_PLATFORM_BY_HOST_SUFFIX = [
    { suffix: "leetcode.cn", key: "leetcode.cn", label: "LeetCode (CN)" },
    { suffix: "leetcode.com", key: "leetcode.com", label: "LeetCode" },
    { suffix: "geeksforgeeks.org", key: "geeksforgeeks.org", label: "GeeksforGeeks" },
    { suffix: "codingninjas.com", key: "codingninjas.com", label: "Coding Ninjas" },
    { suffix: "hackerrank.com", key: "hackerrank.com", label: "HackerRank" },
    { suffix: "codeforces.com", key: "codeforces.com", label: "Codeforces" },
    { suffix: "atcoder.jp", key: "atcoder.jp", label: "AtCoder" },
    { suffix: "spoj.com", key: "spoj.com", label: "SPOJ" },
    { suffix: "interviewbit.com", key: "interviewbit.com", label: "InterviewBit" },
    { suffix: "codechef.com", key: "codechef.com", label: "CodeChef" },
    { suffix: "topcoder.com", key: "topcoder.com", label: "TopCoder" },
    { suffix: "github.com", key: "github.com", label: "GitHub" },
];

function dsaHostEndsWithSuffix(host, suffix) {
    const h = String(host || "").toLowerCase();
    const su = String(suffix || "").toLowerCase();
    return h === su || h.endsWith("." + su);
}

/**
 * Resolve platform from problem URL for icon + title (hostname first, then substring heuristics).
 * @returns {{ key: string, label: string } | null}
 */
function dsaResolveProblemPlatform(url) {
    const normalized = dsaNormalizeProblemUrlForPlatform(String(url || "").trim());
    const host = getUrlHost(normalized);
    if (host) {
        for (const row of DSA_PLATFORM_BY_HOST_SUFFIX) {
            if (dsaHostEndsWithSuffix(host, row.suffix)) {
                return { key: row.key, label: row.label };
            }
        }
    }

    const s = normalized.toLowerCase();
    if (s.includes("leetcode.cn")) {
        return { key: "leetcode.cn", label: "LeetCode (CN)" };
    }
    if (
        s.includes("codingninjas.com") ||
        s.includes("codingninjas") ||
        s.includes("coding-ninjas") ||
        s.includes("coding.ninjas") ||
        (s.includes("naukri.com") && s.includes("code360"))
    ) {
        return { key: "codingninjas.com", label: "Coding Ninjas" };
    }
    if (s.includes("geeksforgeeks.org") || s.includes("geeksforgeeks")) {
        return { key: "geeksforgeeks.org", label: "GeeksforGeeks" };
    }
    if (s.includes("leetcode.com") || /\bleetcode\b/.test(s)) {
        return { key: "leetcode.com", label: "LeetCode" };
    }
    if (s.includes("hackerrank.com") || s.includes("hackerrank")) {
        return { key: "hackerrank.com", label: "HackerRank" };
    }
    if (s.includes("codeforces.com") || s.includes("codeforces")) {
        return { key: "codeforces.com", label: "Codeforces" };
    }
    if (s.includes("atcoder.jp") || s.includes("atcoder")) {
        return { key: "atcoder.jp", label: "AtCoder" };
    }
    if (s.includes("spoj.com") || /\bspoj\b/.test(s)) {
        return { key: "spoj.com", label: "SPOJ" };
    }
    if (s.includes("interviewbit.com") || s.includes("interviewbit")) {
        return { key: "interviewbit.com", label: "InterviewBit" };
    }
    if (s.includes("codechef.com") || s.includes("codechef")) {
        return { key: "codechef.com", label: "CodeChef" };
    }
    if (s.includes("topcoder.com") || s.includes("topcoder")) {
        return { key: "topcoder.com", label: "TopCoder" };
    }
    if (s.includes("github.com") || s.includes("github")) {
        return { key: "github.com", label: "GitHub" };
    }
    return null;
}

function getPlatformLabel(url) {
    const raw = String(url || "").trim();
    if (!raw) {
        return "Link";
    }
    const r = dsaResolveProblemPlatform(raw);
    if (r) {
        return r.label;
    }
    const h = getUrlHost(dsaNormalizeProblemUrlForPlatform(raw));
    return h || "Link";
}

let _dsaScriptBaseDir = null;

/** Directory URL where `script.js` lives (same folder as `res/`). */
function getDsaScriptBaseDir() {
    if (_dsaScriptBaseDir !== null) {
        return _dsaScriptBaseDir;
    }
    const el = document.querySelector('script[src*="script.js"]');
    if (el && el.src) {
        const i = el.src.lastIndexOf("/");
        _dsaScriptBaseDir = i >= 0 ? el.src.slice(0, i + 1) : "";
    } else {
        _dsaScriptBaseDir = "";
    }
    return _dsaScriptBaseDir;
}

/** Local `res/dsa-platforms/*` — bundled PNG/SVG logos, no remote fetch. */
function dsaStaticPlatformIconUrl(filename) {
    const path = `res/dsa-platforms/${filename}`;
    const qs = "v=6";
    const dir = getDsaScriptBaseDir();
    if (dir) {
        try {
            return new URL(`${path}?${qs}`, dir).href;
        } catch {
            /* fall through */
        }
    }
    return `/${path}?${qs}`;
}

/**
 * Map problem URL → bundled logo PNG under `res/dsa-platforms/`.
 * LeetCode (black mark), GeeksforGeeks, Coding Ninjas; empty/unknown → link.svg.
 */
function dsaStaticPlatformIconFilename(url) {
    const normalized = dsaNormalizeProblemUrlForPlatform(String(url || "").trim());
    if (!normalized) {
        return "link.svg";
    }
    const host = getUrlHost(normalized);
    const s = normalized.toLowerCase();

    if (host) {
        if (dsaHostEndsWithSuffix(host, "leetcode.cn") || dsaHostEndsWithSuffix(host, "leetcode.com")) {
            return "leetcode.png";
        }
        if (dsaHostEndsWithSuffix(host, "geeksforgeeks.org")) {
            return "gfg.png";
        }
        if (dsaHostEndsWithSuffix(host, "codingninjas.com")) {
            return "codingninjas.png";
        }
    }
    if (s.includes("leetcode.cn") || s.includes("leetcode.com") || /\bleetcode\b/.test(s)) {
        return "leetcode.png";
    }
    if (
        s.includes("codingninjas.com") ||
        s.includes("codingninjas") ||
        s.includes("coding-ninjas") ||
        s.includes("coding.ninjas") ||
        (s.includes("naukri.com") && s.includes("code360"))
    ) {
        return "codingninjas.png";
    }
    if (s.includes("geeksforgeeks.org") || s.includes("geeksforgeeks")) {
        return "gfg.png";
    }
    return "link.svg";
}

/** Count badge: number visible; when expanded (class dsa-h-badge--open) CSS shows white dot instead. Optional `displayText` (e.g. "Q" for question-only leaves). */
function createExpandableCountBadge(count, kindClass, displayText) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `dsa-h-badge dsa-h-badge--control ${kindClass}`;
    const val = document.createElement("span");
    val.className = "dsa-h-badge-value";
    if (displayText != null && displayText !== "") {
        val.textContent = String(displayText);
        if (String(displayText).length <= 2) {
            val.classList.add("dsa-h-badge-value--short");
        }
    } else {
        val.textContent = String(count);
    }
    const dot = document.createElement("span");
    dot.className = "dsa-h-badge-expanded-dot";
    dot.setAttribute("aria-hidden", "true");
    btn.appendChild(val);
    btn.appendChild(dot);
    return btn;
}

/** View-mode root hub: toggles the whole column under DSA Patterns / one topic root (starts expanded). */
function wireRootHubTopicToggle(badgeBtn, kids, rootCount, hubTitle, scheduleRedraw) {
    const title = hubTitle ? String(hubTitle) : "root";
    badgeBtn.setAttribute(
        "aria-label",
        `Expand or collapse ${rootCount} ${rootCount === 1 ? "branch" : "branches"} under ${title}`,
    );
    badgeBtn.setAttribute("aria-expanded", "true");
    badgeBtn.classList.add("dsa-h-badge--open");
    badgeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        kids.classList.toggle("dsa-h-children--collapsed");
        const hidden = kids.classList.contains("dsa-h-children--collapsed");
        badgeBtn.setAttribute("aria-expanded", hidden ? "false" : "true");
        badgeBtn.classList.toggle("dsa-h-badge--open", !hidden);
        if (!hidden) {
            dsaScrollMindMapElIntoView(kids, { padding: 24 });
        }
        if (typeof scheduleRedraw === "function") {
            requestAnimationFrame(scheduleRedraw);
        }
    });
}

/** After programmatic expand/collapse, keep count badges (ring or triangle) in sync with `.dsa-h-children` state. */
function dsaSyncGraphBranchBadgeUi(panel) {
    if (!panel) {
        return;
    }
    panel.querySelectorAll(".dsa-h-branch").forEach((br) => {
        const kids = br.querySelector(":scope > .dsa-h-children");
        if (!kids || !kids.children.length) {
            return;
        }
        const head = br.querySelector(":scope > .dsa-h-branch-head");
        if (!head) {
            return;
        }
        const collapsed = kids.classList.contains("dsa-h-children--collapsed");
        const ringBtn = head.querySelector(".dsa-h-badge-ring-count.dsa-h-badge--control");
        const flatBtn =
            head.querySelector(".dsa-h-badge--control.dsa-h-badge--branch") ||
            head.querySelector(".dsa-h-badge--control.dsa-h-badge--root");
        const btn = ringBtn || flatBtn;
        if (!btn) {
            return;
        }
        btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
        btn.classList.toggle("dsa-h-badge--open", !collapsed);
    });
}

/** Re-hook edge SVG when mind-map scroll width changes (e.g. triangle badge expands). */
function dsaGraphTreeExpandAll(panel) {
    if (!panel) {
        return;
    }
    panel.querySelectorAll(".dsa-h-children--collapsed").forEach((el) => {
        el.classList.remove("dsa-h-children--collapsed");
    });
    dsaSyncGraphBranchBadgeUi(panel);
}

function dsaGraphTreeCollapseAll(panel) {
    if (!panel) {
        return;
    }
    panel.querySelectorAll(".dsa-h-children").forEach((kids) => {
        if (kids.children.length > 0) {
            kids.classList.add("dsa-h-children--collapsed");
        }
    });
    panel.querySelectorAll(".dsa-h-problems-panel").forEach((pe) => {
        pe.hidden = true;
    });
    panel.querySelectorAll(".dsa-h-leaf-block--open").forEach((lb) => {
        lb.classList.remove("dsa-h-leaf-block--open");
    });
    panel.querySelectorAll(".dsa-h-badge--leaf.dsa-h-badge--control").forEach((b) => {
        b.classList.remove("dsa-h-badge--open");
        b.setAttribute("aria-expanded", "false");
    });
    dsaSyncGraphBranchBadgeUi(panel);
}

/** Chevron icon matching reference toolbar SVG (stroke polyline). */
function dsaToolbarChevronSvg(points) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2.2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    const pl = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    pl.setAttribute("points", points);
    svg.appendChild(pl);
    return svg;
}

/** Expand / collapse all branches — full map, one topic, and customize (all users). */
function dsaMountGraphExpandCollapseControls(hostEl, panel, scheduleRedraw) {
    if (!hostEl || !panel) {
        return;
    }
    hostEl.replaceChildren();
    const btnExpandAll = document.createElement("button");
    btnExpandAll.type = "button";
    btnExpandAll.className = "btn dsa-graph-expand-btn dsa-index-toolbar-expand-btn";
    btnExpandAll.appendChild(dsaToolbarChevronSvg("6 9 12 15 18 9"));
    btnExpandAll.appendChild(document.createTextNode("Expand all"));
    btnExpandAll.setAttribute("aria-label", "Expand all branches");
    btnExpandAll.addEventListener("click", () => {
        dsaGraphTreeExpandAll(panel);
        if (typeof scheduleRedraw === "function") {
            scheduleRedraw();
        }
    });
    const btnCollapseAll = document.createElement("button");
    btnCollapseAll.type = "button";
    btnCollapseAll.className = "btn dsa-graph-expand-btn dsa-index-toolbar-expand-btn";
    btnCollapseAll.appendChild(dsaToolbarChevronSvg("18 15 12 9 6 15"));
    btnCollapseAll.appendChild(document.createTextNode("Collapse all"));
    btnCollapseAll.setAttribute("aria-label", "Collapse all branches");
    btnCollapseAll.addEventListener("click", () => {
        dsaGraphTreeCollapseAll(panel);
        if (typeof scheduleRedraw === "function") {
            scheduleRedraw();
        }
    });
    hostEl.appendChild(btnExpandAll);
    hostEl.appendChild(btnCollapseAll);
}

/**
 * Mind map shell: top toolbar (expand / zoom) in flow, then body (SVG + scroll). No overlay on the graph.
 * @returns {{ canvas: HTMLDivElement, toolbarExpand: HTMLDivElement, toolbarZoom: HTMLDivElement, body: HTMLDivElement }}
 */
/**
 * @param {HTMLElement | null} [toolbarMountParent] — if set, map toolbar is appended here instead of inside the canvas (index shell).
 * @param {{ suppressExternalHint?: boolean }} [layoutOpts] — admin preview: omit inline hint so expand/collapse + zoom stay one row.
 */
function dsaCreateGraphCanvasLayout(toolbarMountParent, layoutOpts) {
    const lo = layoutOpts || {};
    const canvas = document.createElement("div");
    canvas.className = "dsa-mind-canvas";
    canvas.id = "dsa-mind-canvas";

    const body = document.createElement("div");
    body.className = "dsa-mind-canvas-body";
    body.id = "dsa-mind-canvas-body";

    /** index.html: static shell — expand + zoom mount into slots only */
    const useIndexSlots =
        toolbarMountParent instanceof HTMLElement && toolbarMountParent.dataset.dsaIndexToolbarSlots === "1";
    let toolbarExpand;
    let toolbarZoom;
    if (useIndexSlots) {
        toolbarExpand = toolbarMountParent.querySelector(".dsa-toolbar-expand-slot");
        toolbarZoom = toolbarMountParent.querySelector(".dsa-toolbar-zoom-host");
        if (!toolbarExpand || !toolbarZoom) {
            console.warn("DSA: index toolbar slots missing; falling back to inline toolbar");
        }
    }
    if (useIndexSlots && toolbarExpand && toolbarZoom) {
        canvas.appendChild(body);
        return { canvas, toolbarExpand, toolbarZoom, body };
    }

    const toolbar = document.createElement("div");
    toolbar.className = "dsa-graph-map-toolbar";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "Graph map controls");

    toolbarExpand = document.createElement("div");
    toolbarExpand.className = "dsa-graph-map-toolbar-cluster";
    toolbarZoom = document.createElement("div");
    toolbarZoom.className = "dsa-graph-map-toolbar-cluster dsa-graph-map-toolbar-cluster--zoom";

    let toolbarHintSlot = null;
    if (toolbarMountParent instanceof HTMLElement && !lo.suppressExternalHint) {
        toolbarHintSlot = document.createElement("span");
        toolbarHintSlot.className = "dsa-graph-map-toolbar-hint";
        const hintDot = document.createElement("span");
        hintDot.className = "dot";
        hintDot.setAttribute("aria-hidden", "true");
        const hintTextEl = document.createElement("span");
        hintTextEl.className = "dsa-graph-map-toolbar-hint-text";
        hintTextEl.id = "dsa-map-toolbar-inline-hint";
        toolbarHintSlot.appendChild(hintDot);
        toolbarHintSlot.appendChild(hintTextEl);
    }

    toolbar.appendChild(toolbarExpand);
    if (toolbarHintSlot) {
        toolbar.appendChild(toolbarHintSlot);
    }
    toolbar.appendChild(toolbarZoom);

    if (toolbarMountParent instanceof HTMLElement) {
        toolbarMountParent.appendChild(toolbar);
    } else {
        canvas.appendChild(toolbar);
    }
    canvas.appendChild(body);

    return { canvas, toolbarExpand, toolbarZoom, body };
}

function dsaChainMindScrollResizeForEdges(scheduleRedraw) {
    const canvas = document.getElementById("dsa-mind-canvas");
    const scrollEl = canvas && canvas.querySelector(".dsa-mind-scroll");
    if (!scrollEl || typeof ResizeObserver === "undefined") {
        return;
    }
    const roS = new ResizeObserver(() => {
        requestAnimationFrame(() => {
            if (typeof scheduleRedraw === "function") {
                scheduleRedraw();
            }
        });
    });
    roS.observe(scrollEl);
    const prev = dsaGraphResizeCleanup;
    dsaGraphResizeCleanup = () => {
        if (typeof prev === "function") {
            prev();
        }
        roS.disconnect();
    };
}

/**
 * Customize tab: always-visible ring with −, count, + inside one circle (admin customize only).
 */
function createCustomizeClockBadge(opts) {
    const {
        count,
        displayText,
        kindClass,
        pathKey,
        nodeName,
        refresh,
        isMetaRoot,
        isDsRoot,
        kidsEl,
        scheduleRedraw,
        mode,
        panel: graphPanel,
        leafBlock,
        problemsPanel,
        nameEl,
        isAdmin,
        openModalParentKey,
    } = opts;
    const canEdit = !!isAdmin;

    const wrap = document.createElement("span");
    wrap.className = "dsa-h-badge-ring";

    const btnRem = document.createElement("button");
    btnRem.type = "button";
    btnRem.className = "dsa-h-badge-ring-btn dsa-h-badge-ring-btn--minus";
    btnRem.setAttribute("aria-label", "Remove");
    btnRem.setAttribute("title", "Remove");
    btnRem.textContent = "−";

    const btnCount = document.createElement("button");
    btnCount.type = "button";
    btnCount.className = `dsa-h-badge-ring-count dsa-h-badge--control ${kindClass || ""}`;
    const val = document.createElement("span");
    val.className = "dsa-h-badge-value";
    if (displayText != null && displayText !== "") {
        val.textContent = String(displayText);
        if (String(displayText).length <= 2) {
            val.classList.add("dsa-h-badge-value--short");
        }
    } else {
        val.textContent = String(count);
    }
    const dot = document.createElement("span");
    dot.className = "dsa-h-badge-expanded-dot";
    dot.setAttribute("aria-hidden", "true");
    btnCount.appendChild(val);
    btnCount.appendChild(dot);

    const btnAdd = document.createElement("button");
    btnAdd.type = "button";
    btnAdd.className = "dsa-h-badge-ring-btn dsa-h-badge-ring-btn--plus";
    if (isMetaRoot) {
        btnAdd.setAttribute("aria-label", "Add data structure");
        btnAdd.setAttribute("title", "Add a top-level topic (e.g. Arrays). Add problems under that topic, not on DSA Patterns.");
    } else {
        btnAdd.setAttribute("aria-label", "Add");
        btnAdd.setAttribute("title", "Add");
    }
    btnAdd.textContent = "+";

    if (isMetaRoot) {
        btnRem.hidden = true;
    }

    wrap.appendChild(btnRem);
    wrap.appendChild(btnCount);
    wrap.appendChild(btnAdd);

    function runSchedule() {
        requestAnimationFrame(() => {
            if (typeof scheduleRedraw === "function") {
                scheduleRedraw();
            }
        });
    }

    function branchToggle() {
        if (!kidsEl) {
            return;
        }
        kidsEl.classList.toggle("dsa-h-children--collapsed");
        const hidden = kidsEl.classList.contains("dsa-h-children--collapsed");
        btnCount.setAttribute("aria-expanded", hidden ? "false" : "true");
        btnCount.classList.toggle("dsa-h-badge--open", !hidden);
        if (!hidden) {
            dsaScrollMindMapElIntoView(kidsEl, { padding: 24 });
        }
        runSchedule();
    }

    function leafToggle() {
        if (!problemsPanel || !leafBlock || !graphPanel) {
            return;
        }
        const wasHidden = problemsPanel.hidden;
        graphPanel.querySelectorAll(".dsa-h-problems-panel").forEach((pe) => {
            pe.hidden = true;
        });
        graphPanel.querySelectorAll(".dsa-h-leaf-block").forEach((lb) => {
            lb.classList.remove("dsa-h-leaf-block--open");
        });
        graphPanel.querySelectorAll(".dsa-h-badge--leaf").forEach((b) => {
            b.classList.remove("dsa-h-badge--open");
            b.setAttribute("aria-expanded", "false");
        });
        if (wasHidden) {
            problemsPanel.hidden = false;
            leafBlock.classList.add("dsa-h-leaf-block--open");
            btnCount.classList.add("dsa-h-badge--open");
            btnCount.setAttribute("aria-expanded", "true");
            dsaScrollMindMapElIntoView(problemsPanel, { padding: 24 });
        }
        runSchedule();
    }

    btnCount.addEventListener("click", (e) => {
        e.stopPropagation();
        if (mode === "leaf") {
            leafToggle();
        } else {
            branchToggle();
        }
    });

    btnRem.addEventListener("click", (e) => {
        e.stopPropagation();
        if (isMetaRoot) {
            return;
        }
        if (mode === "leaf") {
            if (isDsRoot) {
                if (!confirm(`Remove topic “${nodeName}” and all content under it?`)) {
                    return;
                }
            } else if (!confirm(`Remove “${nodeName}” (all problems in this group)?`)) {
                return;
            }
        } else if (!confirm(`Remove “${nodeName}” and everything under it?`)) {
            return;
        }
        dsaRecordRemoval({ type: "node", path: pathKey });
        refresh();
        void dsaFlushDsaCmsSync();
    });

    btnAdd.addEventListener("click", (e) => {
        e.stopPropagation();
        const pkModal = openModalParentKey != null && String(openModalParentKey).trim() ? String(openModalParentKey).trim() : pathKey;
        dsaOpenCustomizeUnifiedModal(pkModal, refresh);
    });

    if (!canEdit) {
        btnRem.hidden = true;
    }

    const host = document.createElement("span");
    host.className = "dsa-h-customize-node-actions";
    if (canEdit && pathKey && pathKey !== "__DSA_META__") {
        const btnEditLbl = document.createElement("button");
        btnEditLbl.type = "button";
        btnEditLbl.className = "dsa-h-node-label-edit-btn";
        btnEditLbl.appendChild(dsaSvgIconPencil());
        const lbl =
            nodeName != null && String(nodeName).trim() ? String(nodeName).trim() : "topic";
        btnEditLbl.title = `Edit label “${lbl}”`;
        btnEditLbl.setAttribute("aria-label", `Edit label: ${lbl}`);
        btnEditLbl.addEventListener("click", (e) => {
            e.stopPropagation();
            dsaOpenCustomizeUnifiedModal(pathKey, refresh, {
                renameTargetPathKey: pathKey,
                editNodeCurrentName: lbl,
            });
        });
        host.appendChild(btnEditLbl);
    }
    host.appendChild(wrap);
    return host;
}

/**
 * Pick a Prism grammar id for pasted solution code (extra grammars load via autoloader on demand).
 * Falls back to `clike` (always bundled) for C/Java/C++/JS-style snippets.
 */
function dsaGuessPrismLanguage(text) {
    const s = String(text || "").trim();
    if (!s) {
        return "clike";
    }
    const head = s.slice(0, 1400);
    if (/^\s*#include\s*[<"]/m.test(head) || /^\s*using\s+namespace\s+\w+\s*;/.test(head)) {
        return "cpp";
    }
    if (/^\s*(package|import)\s+[\w.]+\s*;/m.test(head) && /\bclass\s+\w+/.test(s)) {
        return "java";
    }
    if (/^\s*package\s+[\w.]+\s*\n/m.test(head) && /\bfun\s+main\b/.test(s)) {
        return "kotlin";
    }
    if (/^\s*package\s+main\b/m.test(head) || /^\s*func\s+main\s*\(/.test(head)) {
        return "go";
    }
    if (/^\s*(def |class \w*\(|from \w+ import|import \w+(,|\s|$))/m.test(head)) {
        return "python";
    }
    if (/^\s*(fn |let mut |impl |use |-> |match )/m.test(head)) {
        return "rust";
    }
    if (/^\s*(func |var |let |struct |enum )/m.test(head) && /\b(Swift|UIKit|Foundation|@objc)\b/.test(s)) {
        return "swift";
    }
    if (/^\s*(interface |type [A-Z]|as const)/m.test(head)) {
        return "typescript";
    }
    if (/^\s*(function |const |let |var |=>|\bconsole\.)/m.test(head)) {
        return "javascript";
    }
    if (/\bclass\s+Solution\s*\{/.test(s) && /\b(int|void|boolean|String|return|public|private)\b/.test(s)) {
        return "java";
    }
    if (/^\s*class\s+Solution\s*:/m.test(head) && /\bdef\s+\w+\(self/.test(s)) {
        return "python";
    }
    return "clike";
}

/** Run Prism on a solution `<pre>` once (when the user opens the Solution toggle). */
function dsaHighlightProbSolutionCode(preEl) {
    if (typeof Prism === "undefined" || !preEl) {
        return;
    }
    const code = preEl.querySelector("code.dsa-h-prob-code-inner");
    if (!code || code.getAttribute("data-prism-highlighted") === "1") {
        return;
    }
    const lang = dsaGuessPrismLanguage(code.textContent);
    code.className = "dsa-h-prob-code-inner language-" + lang;
    try {
        Prism.highlightElement(code);
    } catch (err) {
        console.warn("Prism highlight failed", err);
    }
    code.setAttribute("data-prism-highlighted", "1");
}

/**
 * Bundled brand mark from `res/dsa-platforms/` (PNG logos; link.svg fallback).
 * Do not use `loading="lazy"`: rows in collapsed subtrees may never load lazy images.
 */
function dsaBuildPlatformIconWrap(url, opts = {}) {
    const raw = String(url || "").trim();
    const card = !!opts.card;
    const size = opts.size != null ? opts.size : card ? 18 : 22;
    const label = getPlatformLabel(raw);
    const platform = dsaResolveProblemPlatform(raw);

    const wrap = document.createElement("span");
    wrap.className = card ? "dsa-h-platform-icon dsa-h-platform-icon--card" : "dsa-h-platform-icon";
    wrap.setAttribute("aria-label", label);
    wrap.title = label;
    if (platform && platform.key) {
        wrap.dataset.platform = platform.key;
    }

    const file = dsaStaticPlatformIconFilename(raw);
    const img = document.createElement("img");
    img.className = "dsa-h-platform-icon-img";
    img.alt = "";
    img.width = size;
    img.height = size;
    img.decoding = "async";
    img.setAttribute("aria-hidden", "true");
    img.src = dsaStaticPlatformIconUrl(file);
    wrap.appendChild(img);
    return wrap;
}

function appendPlatformIcon(container, url) {
    const icon = dsaBuildPlatformIconWrap(url, { size: 22 });
    container.className = icon.className;
    container.replaceChildren(...icon.childNodes);
    container.setAttribute("aria-label", icon.getAttribute("aria-label") || "");
    container.title = icon.title || "";
    if (icon.dataset.platform) {
        container.dataset.platform = icon.dataset.platform;
    } else {
        delete container.dataset.platform;
    }
}

/** Practice-problems card row — real platform logos from bundled SVGs. */
function dsaCardPlatformIcon(url) {
    return dsaBuildPlatformIconWrap(url, { card: true, size: 18 });
}

/** Building icon — company tags toggle (same size as other problem-row toggles). */
function dsaSvgIconCompany() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "22");
    svg.setAttribute("height", "22");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute(
        "d",
        "M4 21V8.5a1 1 0 011-.9h4V4a1 1 0 011-.9h4a1 1 0 011 .9V7.6h4a1 1 0 011 .9V21M9 21v-4h2v4M15 21v-4h2v4M4 21h16",
    );
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "2");
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("stroke-linejoin", "round");
    svg.appendChild(p);
    const d2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    d2.setAttribute("d", "M9 13h2M15 13h2M9 9h2M15 9h2");
    d2.setAttribute("stroke", "currentColor");
    d2.setAttribute("stroke-width", "2");
    d2.setAttribute("stroke-linecap", "round");
    svg.appendChild(d2);
    return svg;
}

/** Revealed-state icon for problem row toggles (hint / code / sketch / image / companies). */
function dsaProbToggleIconRevealed(key) {
    if (key === "image") {
        return dsaSvgIconImage();
    }
    if (key === "drawing") {
        return dsaSvgIconSketch();
    }
    if (key === "code") {
        return dsaSvgIconCode();
    }
    if (key === "companies") {
        return dsaSvgIconCompany();
    }
    if (key === "resources") {
        return dsaSvgIconResources();
    }
    if (key === "solution") {
        return dsaSvgIconCode();
    }
    return dsaSvgIconHint();
}

/** Hidden-state icon: same motif as revealed plus a diagonal slash (no eye). */
function dsaProbToggleIconHidden(key) {
    const svg = dsaProbToggleIconRevealed(key).cloneNode(true);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "3.5");
    line.setAttribute("y1", "3.5");
    line.setAttribute("x2", "20.5");
    line.setAttribute("y2", "20.5");
    line.setAttribute("stroke", "currentColor");
    line.setAttribute("stroke-width", "2.25");
    line.setAttribute("stroke-linecap", "round");
    svg.appendChild(line);
    return svg;
}

function dsaSvgIconImage() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "22");
    svg.setAttribute("height", "22");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("x", "3");
    r.setAttribute("y", "3");
    r.setAttribute("width", "18");
    r.setAttribute("height", "18");
    r.setAttribute("rx", "2");
    r.setAttribute("stroke", "currentColor");
    r.setAttribute("stroke-width", "2");
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", "8.5");
    c.setAttribute("cy", "8.5");
    c.setAttribute("r", "1.5");
    c.setAttribute("fill", "currentColor");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M21 15l-5-5L5 21");
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "2");
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("stroke-linejoin", "round");
    svg.appendChild(r);
    svg.appendChild(c);
    svg.appendChild(p);
    return svg;
}

function dsaSvgIconCode() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "22");
    svg.setAttribute("height", "22");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    const p1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p1.setAttribute("d", "M16 18l6-6-6-6");
    p1.setAttribute("stroke", "currentColor");
    p1.setAttribute("stroke-width", "2");
    p1.setAttribute("stroke-linecap", "round");
    p1.setAttribute("stroke-linejoin", "round");
    const p2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p2.setAttribute("d", "M8 6l-6 6 6 6");
    p2.setAttribute("stroke", "currentColor");
    p2.setAttribute("stroke-width", "2");
    p2.setAttribute("stroke-linecap", "round");
    p2.setAttribute("stroke-linejoin", "round");
    svg.appendChild(p1);
    svg.appendChild(p2);
    return svg;
}

function dsaSvgIconHint() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "22");
    svg.setAttribute("height", "22");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", "12");
    c.setAttribute("cy", "12");
    c.setAttribute("r", "9");
    c.setAttribute("stroke", "currentColor");
    c.setAttribute("stroke-width", "2");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M9.5 9.5a2.5 2.5 0 014.2 1.8c0 2-2.2 2.2-2.2 4.2M12 17h.01");
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "2");
    p.setAttribute("stroke-linecap", "round");
    svg.appendChild(c);
    svg.appendChild(p);
    return svg;
}

/** Sketch / drawing — matches DSA dialog sketch section */
function dsaSvgIconSketch() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "22");
    svg.setAttribute("height", "22");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    const p1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p1.setAttribute("d", "M4 20l4.5-9 3 3L20 6");
    p1.setAttribute("stroke", "currentColor");
    p1.setAttribute("stroke-width", "2");
    p1.setAttribute("stroke-linecap", "round");
    p1.setAttribute("stroke-linejoin", "round");
    const p2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p2.setAttribute("d", "M14 6l4 4");
    p2.setAttribute("stroke", "currentColor");
    p2.setAttribute("stroke-width", "2");
    p2.setAttribute("stroke-linecap", "round");
    p2.setAttribute("stroke-linejoin", "round");
    svg.appendChild(p1);
    svg.appendChild(p2);
    return svg;
}

function dsaSvgIconPencil() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute(
        "d",
        "M12 20h9M4 13l8-8a2.12 2.12 0 013 3l-8 8-4 1 1-4z",
    );
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "2");
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("stroke-linejoin", "round");
    svg.appendChild(p);
    return svg;
}

/** Remove problem from topic (admin). */
function dsaSvgIconTrashBin() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    const p1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p1.setAttribute("d", "M3 6h18");
    p1.setAttribute("stroke", "currentColor");
    p1.setAttribute("stroke-width", "2");
    p1.setAttribute("stroke-linecap", "round");
    const p2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p2.setAttribute("d", "M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2");
    p2.setAttribute("stroke", "currentColor");
    p2.setAttribute("stroke-width", "2");
    p2.setAttribute("stroke-linecap", "round");
    const p3 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p3.setAttribute("d", "M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6");
    p3.setAttribute("stroke", "currentColor");
    p3.setAttribute("stroke-width", "2");
    p3.setAttribute("stroke-linecap", "round");
    const p4 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p4.setAttribute("d", "M10 11v6M14 11v6");
    p4.setAttribute("stroke", "currentColor");
    p4.setAttribute("stroke-width", "2");
    p4.setAttribute("stroke-linecap", "round");
    svg.appendChild(p1);
    svg.appendChild(p2);
    svg.appendChild(p3);
    svg.appendChild(p4);
    return svg;
}

/** Reveal hint / code / sketch / image on the map (normal users). */
function dsaSvgIconEye() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    const p1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p1.setAttribute(
        "d",
        "M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z",
    );
    p1.setAttribute("stroke", "currentColor");
    p1.setAttribute("stroke-width", "2");
    p1.setAttribute("stroke-linecap", "round");
    p1.setAttribute("stroke-linejoin", "round");
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", "12");
    c.setAttribute("cy", "12");
    c.setAttribute("r", "3");
    c.setAttribute("stroke", "currentColor");
    c.setAttribute("stroke-width", "2");
    svg.appendChild(p1);
    svg.appendChild(c);
    return svg;
}

/** “Hidden” / toolbar closed — eye with slash (pair with {@link dsaSvgIconEye} when any extra is visible). */
function dsaSvgIconEyeOff() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    const p1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p1.setAttribute(
        "d",
        "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24",
    );
    p1.setAttribute("stroke", "currentColor");
    p1.setAttribute("stroke-width", "2");
    p1.setAttribute("stroke-linecap", "round");
    p1.setAttribute("stroke-linejoin", "round");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "1");
    line.setAttribute("y1", "1");
    line.setAttribute("x2", "23");
    line.setAttribute("y2", "23");
    line.setAttribute("stroke", "currentColor");
    line.setAttribute("stroke-width", "2");
    line.setAttribute("stroke-linecap", "round");
    svg.appendChild(p1);
    svg.appendChild(line);
    return svg;
}

function dsaProbCollapseAllTogglesInBar(bar, reveal) {
    if (!bar || !reveal) {
        return;
    }
    bar.querySelectorAll(".dsa-h-prob-toggle").forEach((btn) => {
        if (btn.getAttribute("aria-expanded") !== "true") {
            return;
        }
        const key = btn.dataset.key;
        const pane = key
            ? reveal.querySelector(`.dsa-h-prob-pane[data-key="${CSS.escape(String(key))}"]`)
            : null;
        const label = (btn.dataset.probToggleLabel && String(btn.dataset.probToggleLabel).trim()) || "Extra";
        btn.setAttribute("aria-expanded", "false");
        btn.classList.remove("dsa-h-prob-toggle--open");
        if (pane) {
            pane.hidden = true;
        }
        const icWrap = btn.querySelector(".dsa-h-prob-toggle-ic");
        if (icWrap && key) {
            icWrap.replaceChildren(dsaProbToggleIconHidden(key));
        }
        btn.setAttribute("aria-label", `${label} — hidden, click to show`);
        btn.title = `${label} (hidden)`;
    });
}

function dsaProbFullyCloseExtrasWrap(wrapEl) {
    if (!wrapEl) {
        return;
    }
    wrapEl.classList.remove("dsa-h-prob-extras-wrap--pinned");
    const eye = wrapEl.querySelector(".dsa-h-prob-eye");
    if (eye) {
        eye.setAttribute("aria-expanded", "false");
    }
    const barEl = wrapEl.querySelector(".dsa-h-prob-actions-bar");
    const liEl = wrapEl.closest(".dsa-h-problem-li");
    const revealEl = liEl && liEl.querySelector(":scope > .dsa-h-prob-reveal");
    dsaProbCollapseAllTogglesInBar(barEl, revealEl);
    if (eye && typeof eye._dsaProbSyncEye === "function") {
        eye._dsaProbSyncEye();
    }
}

function dsaProbUnpinOtherExtrasWraps(exceptWrap) {
    document.querySelectorAll(".dsa-h-prob-extras-wrap--pinned").forEach((w) => {
        if (w === exceptWrap) {
            return;
        }
        dsaProbFullyCloseExtrasWrap(w);
    });
}

let dsaProbExtrasOutsideCloseInstalled = false;
/** Intentionally no global outside-click close: users dismiss extras only via the eye control (open eye = hide all). */
function dsaInstallProbExtrasOutsideClose() {
    if (dsaProbExtrasOutsideCloseInstalled) {
        return;
    }
    dsaProbExtrasOutsideCloseInstalled = true;
}

/** Close / clear control (e.g. dismiss whole practice list). */
function dsaSvgIconClose() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    const p1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p1.setAttribute("d", "M18 6L6 18");
    p1.setAttribute("stroke", "currentColor");
    p1.setAttribute("stroke-width", "2");
    p1.setAttribute("stroke-linecap", "round");
    const p2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p2.setAttribute("d", "M6 6l12 12");
    p2.setAttribute("stroke", "currentColor");
    p2.setAttribute("stroke-width", "2");
    p2.setAttribute("stroke-linecap", "round");
    svg.appendChild(p1);
    svg.appendChild(p2);
    return svg;
}

/**
 * Practice-problems card icons — exact paths from the design mockup.
 * Centralised so every card surface (header, tabs, problem rows, toggles, panes) shares the same iconography.
 */
/**
 * Mockup-style JS syntax highlighter — emits `.tok-*` spans the card CSS knows about.
 * Self-contained (no Prism / external library), so the IDE-style solution code block
 * always renders with consistent colours.
 */
function dsaCardHighlightJsCode(code) {
    const KW = new Set([
        "const", "let", "var", "function", "return", "if", "else", "for", "while", "do",
        "break", "continue", "new", "class", "extends", "import", "export", "from", "default",
        "try", "catch", "finally", "throw", "typeof", "instanceof", "in", "of", "this",
        "null", "undefined", "true", "false", "async", "await", "yield", "static", "switch", "case",
    ]);
    const BI = new Set([
        "Map", "Set", "Array", "Object", "String", "Number", "Math", "console",
        "Promise", "JSON", "Symbol", "RegExp", "Date",
    ]);
    function esc(s) {
        return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    const re =
        /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([+\-*/%=<>!&|^~?:]+)|([\(\)\[\]\{\},;.])|(\s+)/g;
    let m;
    let out = "";
    while ((m = re.exec(code)) !== null) {
        if (m[1]) {
            out += `<span class="tok-com">${esc(m[1])}</span>`;
        } else if (m[2]) {
            out += `<span class="tok-str">${esc(m[2])}</span>`;
        } else if (m[3]) {
            out += `<span class="tok-num">${esc(m[3])}</span>`;
        } else if (m[4]) {
            const w = m[4];
            const next = code[re.lastIndex];
            if (KW.has(w)) {
                out += `<span class="tok-kw">${w}</span>`;
            } else if (BI.has(w)) {
                out += `<span class="tok-bi">${w}</span>`;
            } else if (next === "(") {
                out += `<span class="tok-fn">${w}</span>`;
            } else {
                out += esc(w);
            }
        } else if (m[5]) {
            out += `<span class="tok-op">${esc(m[5])}</span>`;
        } else if (m[6]) {
            out += `<span class="tok-pn">${esc(m[6])}</span>`;
        } else if (m[7]) {
            out += m[7];
        }
    }
    return out;
}

function dsaCardIcon(name) {
    const NS = "http://www.w3.org/2000/svg";
    function svgEl(opts) {
        const o = opts || {};
        const s = document.createElementNS(NS, "svg");
        s.setAttribute("width", String(o.size || 14));
        s.setAttribute("height", String(o.size || 14));
        s.setAttribute("viewBox", o.viewBox || "0 0 24 24");
        s.setAttribute("fill", o.fill || "none");
        if (!o.fill || o.fill === "none") {
            s.setAttribute("stroke", "currentColor");
            s.setAttribute("stroke-width", String(o.strokeWidth || 2));
            s.setAttribute("stroke-linecap", "round");
            s.setAttribute("stroke-linejoin", "round");
        }
        s.setAttribute("aria-hidden", "true");
        return s;
    }
    function addPath(s, d) {
        const p = document.createElementNS(NS, "path");
        p.setAttribute("d", d);
        s.appendChild(p);
    }
    function addPoly(s, pts) {
        const p = document.createElementNS(NS, "polygon");
        p.setAttribute("points", pts);
        s.appendChild(p);
    }
    function addPolyline(s, pts) {
        const p = document.createElementNS(NS, "polyline");
        p.setAttribute("points", pts);
        s.appendChild(p);
    }
    function addLine(s, x1, y1, x2, y2) {
        const l = document.createElementNS(NS, "line");
        l.setAttribute("x1", String(x1));
        l.setAttribute("y1", String(y1));
        l.setAttribute("x2", String(x2));
        l.setAttribute("y2", String(y2));
        s.appendChild(l);
    }
    function addCircle(s, cx, cy, r) {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", String(cx));
        c.setAttribute("cy", String(cy));
        c.setAttribute("r", String(r));
        s.appendChild(c);
    }
    function addRect(s, x, y, w, h, rx) {
        const r = document.createElementNS(NS, "rect");
        r.setAttribute("x", String(x));
        r.setAttribute("y", String(y));
        r.setAttribute("width", String(w));
        r.setAttribute("height", String(h));
        if (rx != null) {
            r.setAttribute("rx", String(rx));
        }
        s.appendChild(r);
    }

    if (name === "brain") {
        const s = svgEl({ size: 20 });
        addPath(
            s,
            "M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z",
        );
        addPath(
            s,
            "M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z",
        );
        return s;
    }
    if (name === "star") {
        const s = svgEl({ size: 16, fill: "currentColor" });
        addPoly(s, "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2");
        return s;
    }
    if (name === "starOutline") {
        const s = svgEl({ size: 16 });
        addPoly(s, "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2");
        return s;
    }
    if (name === "search") {
        const s = svgEl({ size: 14 });
        addCircle(s, 11, 11, 8);
        addLine(s, 21, 21, 16.65, 16.65);
        return s;
    }
    if (name === "filter") {
        const s = svgEl({ size: 14 });
        addPoly(s, "22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3");
        return s;
    }
    if (name === "trash") {
        const s = svgEl({ size: 14 });
        addPolyline(s, "3 6 5 6 21 6");
        addPath(s, "M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6");
        addPath(s, "M10 11v6M14 11v6");
        return s;
    }
    if (name === "pencil") {
        const s = svgEl({ size: 14 });
        addPath(s, "M12 20h9");
        addPath(s, "M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z");
        return s;
    }
    if (name === "eye") {
        const s = svgEl({ size: 14 });
        addPath(s, "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z");
        addCircle(s, 12, 12, 3);
        return s;
    }
    if (name === "eyeOff") {
        const s = svgEl({ size: 14 });
        addPath(
            s,
            "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24",
        );
        addLine(s, 1, 1, 23, 23);
        return s;
    }
    if (name === "youtube") {
        const s = svgEl({ size: 16, fill: "currentColor" });
        addPath(
            s,
            "M23.498 6.186a2.997 2.997 0 0 0-2.108-2.124C19.55 3.5 12 3.5 12 3.5s-7.55 0-9.39.562A2.997 2.997 0 0 0 .502 6.186C0 8.04 0 12 0 12s0 3.96.502 5.814a2.997 2.997 0 0 0 2.108 2.124C4.45 20.5 12 20.5 12 20.5s7.55 0 9.39-.562a2.997 2.997 0 0 0 2.108-2.124C24 15.96 24 12 24 12s0-3.96-.502-5.814zM9.6 15.6V8.4l6.24 3.6L9.6 15.6z",
        );
        return s;
    }
    if (name === "bulb") {
        const s = svgEl({ size: 14 });
        addPath(s, "M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2z");
        return s;
    }
    if (name === "building") {
        const s = svgEl({ size: 14 });
        addRect(s, 4, 2, 16, 20, 2);
        addPath(
            s,
            "M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01",
        );
        return s;
    }
    if (name === "code") {
        const s = svgEl({ size: 14 });
        addPolyline(s, "16 18 22 12 16 6");
        addPolyline(s, "8 6 2 12 8 18");
        return s;
    }
    if (name === "paperclip") {
        const s = svgEl({ size: 14 });
        addPath(
            s,
            "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48",
        );
        return s;
    }
    if (name === "close") {
        const s = svgEl({ size: 14, strokeWidth: 2.2 });
        addLine(s, 18, 6, 6, 18);
        addLine(s, 6, 6, 18, 18);
        return s;
    }
    if (name === "check") {
        const s = svgEl({ size: 12, strokeWidth: 3 });
        addPolyline(s, "20 6 9 17 4 12");
        return s;
    }
    if (name === "inbox") {
        const s = svgEl({ size: 38, strokeWidth: 1.5 });
        addPolyline(s, "22 12 16 12 14 15 10 15 8 12 2 12");
        addPath(s, "M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z");
        return s;
    }
    if (name === "copy") {
        const s = svgEl({ size: 11 });
        addRect(s, 9, 9, 13, 13, 2);
        addPath(s, "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1");
        return s;
    }
    return svgEl({});
}

/** Brain icon for the Practice problems card header. */
function dsaSvgIconBrain() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    const left = document.createElementNS("http://www.w3.org/2000/svg", "path");
    left.setAttribute(
        "d",
        "M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z",
    );
    left.setAttribute("stroke", "currentColor");
    left.setAttribute("stroke-width", "2");
    left.setAttribute("stroke-linecap", "round");
    left.setAttribute("stroke-linejoin", "round");
    const right = document.createElementNS("http://www.w3.org/2000/svg", "path");
    right.setAttribute(
        "d",
        "M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z",
    );
    right.setAttribute("stroke", "currentColor");
    right.setAttribute("stroke-width", "2");
    right.setAttribute("stroke-linecap", "round");
    right.setAttribute("stroke-linejoin", "round");
    svg.appendChild(left);
    svg.appendChild(right);
    return svg;
}

function dsaSvgIconStar() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.style.display = "block";
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M12 3.25l2.75 5.57 6.15.89-4.45 4.34 1.05 6.13L12 17.3 6.5 20.18l1.05-6.13L3.1 9.71l6.15-.89L12 3.25z");
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "1.8");
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("stroke-linejoin", "round");
    p.setAttribute("fill", "currentColor");
    svg.appendChild(p);
    return svg;
}

function dsaSvgIconListBullets() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.style.display = "block";
    const mk = (tag) => document.createElementNS("http://www.w3.org/2000/svg", tag);
    const l1 = mk("path");
    l1.setAttribute("d", "M8 7.5h10");
    l1.setAttribute("stroke", "currentColor");
    l1.setAttribute("stroke-width", "2");
    l1.setAttribute("stroke-linecap", "round");
    const l2 = mk("path");
    l2.setAttribute("d", "M8 12h10");
    l2.setAttribute("stroke", "currentColor");
    l2.setAttribute("stroke-width", "2");
    l2.setAttribute("stroke-linecap", "round");
    const l3 = mk("path");
    l3.setAttribute("d", "M8 16.5h10");
    l3.setAttribute("stroke", "currentColor");
    l3.setAttribute("stroke-width", "2");
    l3.setAttribute("stroke-linecap", "round");
    const b1 = mk("circle");
    b1.setAttribute("cx", "4");
    b1.setAttribute("cy", "7.5");
    b1.setAttribute("r", "1.4");
    b1.setAttribute("fill", "currentColor");
    const b2 = mk("circle");
    b2.setAttribute("cx", "4");
    b2.setAttribute("cy", "12");
    b2.setAttribute("r", "1.4");
    b2.setAttribute("fill", "currentColor");
    const b3 = mk("circle");
    b3.setAttribute("cx", "4");
    b3.setAttribute("cy", "16.5");
    b3.setAttribute("r", "1.4");
    b3.setAttribute("fill", "currentColor");
    svg.appendChild(l1);
    svg.appendChild(l2);
    svg.appendChild(l3);
    svg.appendChild(b1);
    svg.appendChild(b2);
    svg.appendChild(b3);
    return svg;
}

function dsaSvgIconSearch() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.style.display = "block";
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("cx", "11");
    c.setAttribute("cy", "11");
    c.setAttribute("r", "6.5");
    c.setAttribute("stroke", "currentColor");
    c.setAttribute("stroke-width", "2");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M16 16l4 4");
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "2");
    p.setAttribute("stroke-linecap", "round");
    svg.appendChild(c);
    svg.appendChild(p);
    return svg;
}

function dsaSvgIconFilterFunnel() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.style.display = "block";
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M3 5h18l-7 8v5l-4 2v-7L3 5z");
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "2");
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("stroke-linejoin", "round");
    svg.appendChild(p);
    return svg;
}

/** Stacked resources — problem row “Resources” toggle. */
function dsaSvgIconResources() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "22");
    svg.setAttribute("height", "22");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    const r1 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r1.setAttribute("x", "3");
    r1.setAttribute("y", "3");
    r1.setAttribute("width", "14");
    r1.setAttribute("height", "11");
    r1.setAttribute("rx", "2");
    r1.setAttribute("stroke", "currentColor");
    r1.setAttribute("stroke-width", "2");
    const r2 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r2.setAttribute("x", "7");
    r2.setAttribute("y", "10");
    r2.setAttribute("width", "14");
    r2.setAttribute("height", "11");
    r2.setAttribute("rx", "2");
    r2.setAttribute("stroke", "currentColor");
    r2.setAttribute("stroke-width", "2");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M8 7h4M8 14h4");
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", "2");
    p.setAttribute("stroke-linecap", "round");
    svg.appendChild(r1);
    svg.appendChild(r2);
    svg.appendChild(p);
    return svg;
}

function dsaSvgIconClipboard() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML =
        '<path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>';
    return svg;
}

/** YouTube-style play tile for video solution links (read-only). */
function dsaSvgIconYoutube() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "22");
    svg.setAttribute("height", "22");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    r.setAttribute("x", "2");
    r.setAttribute("y", "4");
    r.setAttribute("width", "20");
    r.setAttribute("height", "16");
    r.setAttribute("rx", "4");
    r.setAttribute("fill", "#FF0000");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M10 9.5v5l4-2.5-4-2.5z");
    p.setAttribute("fill", "#ffffff");
    svg.appendChild(r);
    svg.appendChild(p);
    return svg;
}

function dsaSvgIconExternalVideo() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "22");
    svg.setAttribute("height", "22");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML =
        '<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>';
    return svg;
}

/** Read-only: pick an approach (time/space shown), then reveal code + Prism. */
/**
 * Solution pane — mockup layout: pill-shaped chip row (approach dot + T/S complexity pills)
 * on top, then a macOS-style code block (traffic-light dots + language label + copy button
 * + gutter line numbers + JS syntax highlighting). First chip is selected by default.
 */
function dsaFillProblemSolutionPane(prob, pane) {
    pane.innerHTML = "";
    const solRows = [...dsaFilteredSolutionRows(prob)].sort(
        (a, b) => dsaSolutionApproachRank(a) - dsaSolutionApproachRank(b),
    );
    if (!solRows.length) {
        return;
    }

    const chipsRow = document.createElement("div");
    chipsRow.className = "sol-chips";
    chipsRow.setAttribute("role", "tablist");
    chipsRow.setAttribute("aria-label", "Solution approaches");

    const codeWrap = document.createElement("div");
    codeWrap.className = "sol-code-wrap";

    const codeHeader = document.createElement("div");
    codeHeader.className = "sol-code-header";

    const dots = document.createElement("div");
    dots.className = "sol-code-dots";
    dots.appendChild(document.createElement("span"));
    dots.appendChild(document.createElement("span"));
    dots.appendChild(document.createElement("span"));

    const lang = document.createElement("div");
    lang.className = "sol-code-lang";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "sol-code-copy";
    function renderCopyBtn(label) {
        copyBtn.replaceChildren();
        copyBtn.appendChild(dsaCardIcon("copy"));
        copyBtn.appendChild(document.createTextNode(" " + label));
    }
    renderCopyBtn("Copy");

    codeHeader.appendChild(dots);
    codeHeader.appendChild(lang);
    codeHeader.appendChild(copyBtn);
    codeWrap.appendChild(codeHeader);

    const pre = document.createElement("pre");
    pre.className = "sol-code";
    const gutter = document.createElement("div");
    gutter.className = "sol-code-gutter";
    const codeBody = document.createElement("code");
    codeBody.className = "sol-code-body";
    pre.appendChild(gutter);
    pre.appendChild(codeBody);
    codeWrap.appendChild(pre);

    let currentCode = "";
    function setCode(code) {
        currentCode = code || "";
        if (!currentCode.trim()) {
            gutter.textContent = "";
            codeBody.innerHTML = "";
            codeBody.textContent = "No code stored for this approach.";
            codeBody.style.color = "rgba(245,245,247,0.5)";
            codeBody.style.fontStyle = "italic";
            return;
        }
        codeBody.removeAttribute("style");
        const lines = currentCode.split("\n");
        gutter.textContent = lines.map((_, i) => i + 1).join("\n");
        codeBody.innerHTML = dsaCardHighlightJsCode(currentCode);
    }

    copyBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentCode || !navigator.clipboard) {
            return;
        }
        navigator.clipboard.writeText(currentCode).then(() => {
            copyBtn.classList.add("copied");
            renderCopyBtn("Copied!");
            setTimeout(() => {
                copyBtn.classList.remove("copied");
                renderCopyBtn("Copy");
            }, 1400);
        });
    });

    const APPROACH_LABEL_BY_KEY = { brute_force: "Brute Force", better: "Better", optimal: "Optimal" };

    function approachLabelForSol(sol) {
        const approachKey = dsaNormalizeSolutionCategory(sol && sol.approach);
        return (
            APPROACH_LABEL_BY_KEY[approachKey] ||
            dsaSolutionCategoryLabel(approachKey) ||
            "Solution"
        );
    }

    function selectIndex(idx) {
        chipsRow.querySelectorAll(".dsa-h-sol-chip").forEach((chip, i) => {
            const on = i === idx;
            chip.classList.toggle("dsa-h-sol-chip--active", on);
            chip.setAttribute("aria-selected", on ? "true" : "false");
            chip.tabIndex = on ? 0 : -1;
        });
        const sol = solRows[idx];
        lang.textContent = approachLabelForSol(sol);
        const codeStr = sol && sol.code != null ? String(sol.code).trim() : "";
        setCode(codeStr);
    }

    solRows.forEach((sol, idx) => {
        const approachKey = dsaNormalizeSolutionCategory(sol && sol.approach);
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "dsa-h-sol-chip";
        if (approachKey) {
            chip.dataset.approach = approachKey;
        }
        chip.setAttribute("role", "tab");
        chip.setAttribute("aria-selected", "false");
        chip.tabIndex = -1;

        const chipLabel = document.createElement("span");
        chipLabel.className = "sol-chip-label";
        const dot = document.createElement("span");
        dot.className = "sol-chip-dot";
        chipLabel.appendChild(dot);
        const labelText = approachLabelForSol(sol) || `Solution ${idx + 1}`;
        chipLabel.appendChild(document.createTextNode(labelText));
        chip.appendChild(chipLabel);

        const tc = sol.timeComplexity ? String(sol.timeComplexity).trim() : "";
        const sc = sol.spaceComplexity ? String(sol.spaceComplexity).trim() : "";
        if (tc || sc) {
            const cxWrap = document.createElement("span");
            cxWrap.className = "complexity-pills";
            if (tc) {
                const pill = document.createElement("span");
                pill.className = "complexity-pill complexity-pill--time";
                const pfx = document.createElement("span");
                pfx.className = "pill-prefix";
                pfx.textContent = "T";
                pill.appendChild(pfx);
                pill.appendChild(document.createTextNode(tc));
                cxWrap.appendChild(pill);
            }
            if (sc) {
                const pill = document.createElement("span");
                pill.className = "complexity-pill complexity-pill--space";
                const pfx = document.createElement("span");
                pfx.className = "pill-prefix";
                pfx.textContent = "S";
                pill.appendChild(pfx);
                pill.appendChild(document.createTextNode(sc));
                cxWrap.appendChild(pill);
            }
            chip.appendChild(cxWrap);
        }

        chip.addEventListener("click", () => selectIndex(idx));
        chipsRow.appendChild(chip);
    });

    pane.appendChild(chipsRow);
    pane.appendChild(codeWrap);
    selectIndex(0);
}

let _dsaResourceFsEl = null;

function dsaEnsureResourceFullscreenViewer() {
    if (_dsaResourceFsEl) {
        return _dsaResourceFsEl;
    }
    const root = document.createElement("div");
    root.className = "dsa-h-res-fs";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Resource preview");

    const backdrop = document.createElement("button");
    backdrop.type = "button";
    backdrop.className = "dsa-h-res-fs-backdrop";
    backdrop.setAttribute("aria-label", "Close fullscreen preview");

    const panel = document.createElement("div");
    panel.className = "dsa-h-res-fs-panel";

    const head = document.createElement("div");
    head.className = "dsa-h-res-fs-head";

    const titleEl = document.createElement("div");
    titleEl.className = "dsa-h-res-fs-title";
    titleEl.id = "dsa-h-res-fs-title";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "dsa-h-res-fs-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.title = "Close (Esc)";
    closeBtn.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';

    const body = document.createElement("div");
    body.className = "dsa-h-res-fs-body";

    const img = document.createElement("img");
    img.className = "dsa-h-res-fs-img";
    img.alt = "";

    head.appendChild(titleEl);
    head.appendChild(closeBtn);
    panel.appendChild(head);
    body.appendChild(img);
    panel.appendChild(body);
    root.appendChild(backdrop);
    root.appendChild(panel);
    root.setAttribute("aria-labelledby", titleEl.id);

    function closeFs() {
        root.hidden = true;
        document.body.classList.remove("dsa-h-res-fs-open");
        img.removeAttribute("src");
        titleEl.textContent = "";
    }

    backdrop.addEventListener("click", closeFs);
    closeBtn.addEventListener("click", closeFs);
    panel.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("keydown", (e) => {
        if (!root.hidden && e.key === "Escape") {
            e.preventDefault();
            closeFs();
        }
    });

    root._dsaOpen = (src, label) => {
        img.src = src;
        img.alt = label || "Resource";
        titleEl.textContent = label || "Preview";
        root.hidden = false;
        document.body.classList.add("dsa-h-res-fs-open");
        closeBtn.focus();
    };
    root._dsaClose = closeFs;

    document.body.appendChild(root);
    _dsaResourceFsEl = root;
    return root;
}

function dsaOpenResourceFullscreen(src, label) {
    const s = String(src || "").trim();
    if (!s) {
        return;
    }
    const viewer = dsaEnsureResourceFullscreenViewer();
    viewer._dsaOpen(s, label);
}

function dsaWireResourcePaneImage(img, label) {
    const wrap = document.createElement("button");
    wrap.type = "button";
    wrap.className = "dsa-h-res-sec-img-btn";
    wrap.setAttribute("aria-label", `View ${label} fullscreen`);
    wrap.title = "Open fullscreen";
    wrap.appendChild(img);
    const hint = document.createElement("span");
    hint.className = "dsa-h-res-sec-img-hint";
    hint.setAttribute("aria-hidden", "true");
    hint.textContent = "Fullscreen";
    wrap.appendChild(hint);
    wrap.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dsaOpenResourceFullscreen(img.src, label);
    });
    return wrap;
}

function dsaAppendResourceImageSection(pane, title, src, alt) {
    const url = String(src || "").trim();
    if (!url) {
        return;
    }
    const sec = document.createElement("section");
    sec.className = "dsa-h-res-sec";
    const h = document.createElement("h5");
    h.className = "dsa-h-res-sec-title";
    h.textContent = title;
    sec.appendChild(h);
    const im = document.createElement("img");
    im.src = url;
    im.alt = alt || title;
    im.className = "dsa-h-prob-pane-img";
    im.decoding = "async";
    sec.appendChild(dsaWireResourcePaneImage(im, title));
    pane.appendChild(sec);
}

function dsaFillProblemResourcesPane(prob, pane) {
    pane.innerHTML = "";
    pane.classList.add("dsa-h-prob-pane--resources");
    const drawing = prob && prob.drawing ? String(prob.drawing).trim() : "";
    const image = prob && prob.image ? String(prob.image).trim() : "";
    dsaAppendResourceImageSection(pane, "Sketch", drawing, "Sketch");
    dsaAppendResourceImageSection(pane, "Image", image, "Image");
}

function buildProblemListItem(prob, probCtx) {
    const li = document.createElement("li");
    li.className = "dsa-h-problem-li" + (prob && prob.done ? " dsa-h-problem-li--done" : "");

    const mainRow = document.createElement("div");
    mainRow.className = "dsa-h-problem-main";
    const isAdminViewer = !!(probCtx && probCtx.isAdmin === true);

    const prefix = document.createElement("div");
    prefix.className = "dsa-h-prob-prefix";

    const isDone = !!(prob && prob.done);
    const canMarkDone =
        probCtx && probCtx.parentKey && typeof probCtx.refresh === "function";
    const doneWrap = document.createElement(canMarkDone ? "label" : "span");
    doneWrap.className =
        "dsa-h-prob-done dsa-h-prob-done--icon-only" + (isDone ? " dsa-h-prob-done--on" : "");
    if (canMarkDone) {
        doneWrap.setAttribute("aria-label", isDone ? "Problem marked done" : "Mark problem done");
    }
    const doneInput = document.createElement("input");
    doneInput.type = "checkbox";
    doneInput.className = "dsa-h-prob-done-input";
    doneInput.checked = isDone;
    doneInput.disabled = !canMarkDone;
    doneInput.setAttribute("aria-label", isDone ? "Marked done" : "Mark done");
    if (canMarkDone) {
        doneInput.addEventListener("click", (e) => e.stopPropagation());
        doneInput.addEventListener("change", (e) => {
            e.stopPropagation();
            if (prob) {
                prob.done = !!doneInput.checked;
            }
            doneWrap.classList.toggle("dsa-h-prob-done--on", !!doneInput.checked);
            li.classList.toggle("dsa-h-problem-li--done", !!doneInput.checked);
            doneWrap.setAttribute("aria-label", doneInput.checked ? "Problem marked done" : "Mark problem done");
            doneInput.setAttribute("aria-label", doneInput.checked ? "Marked done" : "Mark done");
            const topicNode = probCtx && probCtx.topicNode;
            if (topicNode && Array.isArray(topicNode.problems)) {
                const card = li.closest(".dsa-h-problems-card");
                const chip = card && card.querySelector(".dsa-h-problems-card-progress-chip");
                if (chip) {
                    const stats = dsaCollectTreeNodeProblemStats(topicNode);
                    chip.textContent = `${stats.done}/${stats.total}`;
                }
            }
            dsaToggleProblemDone(probCtx.parentKey, prob, probCtx.refresh);
        });
    }
    doneWrap.appendChild(doneInput);
    prefix.appendChild(doneWrap);

    const isStarred = dsaIsProblemMarkedImportant(prob);
    const canToggleStar =
        probCtx && probCtx.parentKey && typeof probCtx.refresh === "function";
    const starBtn = document.createElement("button");
    starBtn.type = "button";
    starBtn.className = "dsa-h-prob-star-toggle" + (isStarred ? " dsa-h-prob-star-toggle--on" : "");
    const setStarBtnState = (on) => {
        starBtn.classList.toggle("dsa-h-prob-star-toggle--on", !!on);
        starBtn.setAttribute("aria-pressed", on ? "true" : "false");
        starBtn.setAttribute("aria-label", on ? "Starred problem. Click to unstar" : "Mark problem as starred");
        starBtn.title = on ? "Starred (click to unstar)" : "Mark as starred";
        starBtn.replaceChildren(dsaCardIcon(on ? "star" : "starOutline"));
    };
    setStarBtnState(isStarred);
    if (!canToggleStar) {
        starBtn.disabled = true;
    }
    if (canToggleStar) {
        starBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const nowOn = !(prob && prob.starred === true);
            if (prob) {
                prob.starred = nowOn;
            }
            setStarBtnState(nowOn);
            dsaToggleProblemImportant(probCtx.parentKey, prob, probCtx.refresh);
            const hostList = li.closest(".dsa-h-problems-list");
            const emptyNote = hostList && hostList.parentElement
                ? hostList.parentElement.querySelector(".dsa-h-problems-empty")
                : null;
            if (hostList && hostList.dataset.filterMode === "starred" && !nowOn) {
                li.remove();
                if (emptyNote && hostList.children.length === 0) {
                    emptyNote.hidden = false;
                    emptyNote.replaceChildren();
                    emptyNote.appendChild(dsaCardIcon("inbox"));
                    const titleEl = document.createElement("div");
                    titleEl.className = "dsa-h-problems-empty-title";
                    titleEl.textContent = "No starred problems";
                    emptyNote.appendChild(titleEl);
                    const detailEl = document.createElement("div");
                    detailEl.className = "dsa-h-problems-empty-detail";
                    detailEl.textContent = "Star problems to see them here.";
                    emptyNote.appendChild(detailEl);
                }
            } else if (emptyNote) {
                emptyNote.hidden = true;
            }
        });
    }
    prefix.appendChild(starBtn);

    mainRow.appendChild(prefix);

    const a = document.createElement("a");
    a.className = "dsa-h-problem-link";
    const rawUrl = prob && prob.url != null ? String(prob.url).trim() : "";
    const href = rawUrl ? dsaNormalizeProblemUrlForPlatform(rawUrl) : "#";
    a.href = href || "#";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.title = `${prob.name} — ${getPlatformLabel(rawUrl)}`;

    a.appendChild(dsaCardPlatformIcon(rawUrl));

    const text = document.createElement("span");
    text.className = "dsa-h-problem-link-text";
    text.textContent = prob.name;
    a.appendChild(text);

    mainRow.appendChild(a);

    const diffKey = dsaNormalizeProblemDifficulty(prob && prob.difficulty);
    const diffTag = document.createElement("span");
    diffTag.className = `dsa-h-prob-diff dsa-h-prob-diff--${diffKey}`;
    diffTag.textContent = dsaProblemDifficultyLabel(diffKey);
    diffTag.setAttribute("aria-label", `Difficulty: ${dsaProblemDifficultyLabel(diffKey)}`);
    mainRow.appendChild(diffTag);

    const adminEdit =
        isAdminViewer &&
        probCtx &&
        probCtx.parentKey &&
        typeof probCtx.refresh === "function";

    /* Edit + Delete buttons (admin only) — built here, appended later inside the mod-bar of the extras wrap. */
    let adminEditBtns = null;
    if (adminEdit) {
        const openOpts = {
            editQuestionName: prob && prob.name ? String(prob.name) : "",
            editUserNodeId: prob && prob.userNodeId ? String(prob.userNodeId) : "",
        };
        const btnEdit = document.createElement("button");
        btnEdit.type = "button";
        btnEdit.className = "dsa-h-prob-toggle dsa-h-prob-toggle--edit";
        btnEdit.setAttribute("aria-label", "Edit problem");
        btnEdit.title = "Edit problem";
        const editIc = document.createElement("span");
        editIc.className = "dsa-h-prob-toggle-ic";
        editIc.appendChild(dsaCardIcon("pencil"));
        btnEdit.appendChild(editIc);
        btnEdit.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            dsaOpenCustomizeUnifiedModal(probCtx.parentKey, probCtx.refresh, openOpts);
        });

        const btnDel = document.createElement("button");
        btnDel.type = "button";
        btnDel.className = "dsa-h-prob-toggle dsa-h-prob-toggle--delete";
        btnDel.setAttribute("aria-label", "Remove problem from this topic");
        btnDel.title = "Remove this problem from the map (asks for confirmation)";
        const delIc = document.createElement("span");
        delIc.className = "dsa-h-prob-toggle-ic";
        delIc.appendChild(dsaCardIcon("trash"));
        btnDel.appendChild(delIc);
        btnDel.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const nm = prob && prob.name ? String(prob.name) : "";
            if (
                !nm ||
                !confirm(
                    `Remove “${nm}” from this topic? It will disappear from the map (and from saved data when you sync).`,
                )
            ) {
                return;
            }
            dsaDeletePracticeProblem(
                probCtx.parentKey,
                nm,
                prob && prob.userNodeId ? String(prob.userNodeId) : "",
            );
            probCtx.refresh();
            void dsaFlushDsaCmsSync();
        });
        adminEditBtns = { btnEdit, btnDel };
    }

    const readerExtras =
        probCtx &&
        probCtx.parentKey &&
        (probCtx.viewExtras === true || probCtx.isAdmin === false || adminEdit);

    const solutionVideoUrlRaw =
        prob && prob.solutionVideoUrl ? String(prob.solutionVideoUrl).trim() : "";
    const hasSolutionRows = dsaFilteredSolutionRows(prob).length > 0;
    const hasMediaResources = dsaProblemHasSketchImageResource(prob);

    let probYoutubeLink = null;
    if (readerExtras && solutionVideoUrlRaw) {
        const vh = dsaNormalizeExternalVideoHref(solutionVideoUrlRaw) || solutionVideoUrlRaw;
        probYoutubeLink = document.createElement("a");
        probYoutubeLink.className =
            "dsa-h-prob-youtube" +
            (dsaIsLikelyYoutubeUrl(solutionVideoUrlRaw) ? " dsa-h-prob-youtube--brand" : "");
        probYoutubeLink.href = vh;
        probYoutubeLink.target = "_blank";
        probYoutubeLink.rel = "noopener noreferrer";
        probYoutubeLink.setAttribute(
            "aria-label",
            dsaIsLikelyYoutubeUrl(solutionVideoUrlRaw)
                ? "Open solution video on YouTube"
                : "Open solution video in a new tab",
        );
        probYoutubeLink.title = dsaIsLikelyYoutubeUrl(solutionVideoUrlRaw)
            ? "Video solution (YouTube)"
            : "Video solution";
        probYoutubeLink.appendChild(
            dsaIsLikelyYoutubeUrl(solutionVideoUrlRaw) ? dsaCardIcon("youtube") : dsaSvgIconExternalVideo(),
        );
    }

    const extras = [
        { key: "hint", label: "Hint" },
        { key: "companies", label: "Companies" },
    ];
    if (hasSolutionRows) {
        extras.push({ key: "solution", label: "Solution" });
    }
    if (hasMediaResources) {
        extras.push({ key: "resources", label: "Resources" });
    }

    const reveal = document.createElement("div");
    reveal.className = "dsa-h-prob-reveal";

    const bar = document.createElement("div");
    bar.className = "dsa-h-prob-actions-bar";
    bar.setAttribute("role", "toolbar");

    let syncProbEye = () => {};

    extras.forEach(({ key, label }) => {
        let raw;
        if (key === "companies") {
            const arr = prob && Array.isArray(prob.companies) ? prob.companies : [];
            raw = arr.length ? arr : null;
        } else if (key === "resources") {
            raw = hasMediaResources ? true : null;
        } else if (key === "solution") {
            raw = hasSolutionRows ? true : null;
        } else {
            raw = prob && prob[key];
            if (!raw || !String(raw).trim()) {
                return;
            }
        }
        if (!raw) {
            return;
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dsa-h-prob-toggle";
        btn.dataset.key = key;
        btn.dataset.probToggleLabel = label;
        btn.setAttribute("aria-expanded", "false");
        btn.setAttribute("aria-label", `${label} — hidden, click to show`);
        btn.title = `${label} (hidden)`;

        const icWrap = document.createElement("span");
        icWrap.className = "dsa-h-prob-toggle-ic";
        const TOGGLE_ICON_BY_KEY = {
            hint: "bulb",
            companies: "building",
            solution: "code",
            resources: "paperclip",
        };
        const setToggleGlyph = () => {
            icWrap.replaceChildren(dsaCardIcon(TOGGLE_ICON_BY_KEY[key] || "code"));
        };
        setToggleGlyph();
        btn.appendChild(icWrap);

        const pane = document.createElement("div");
        pane.className = "dsa-h-prob-pane";
        pane.dataset.key = key;
        pane.hidden = true;
        /* Mockup ships a small uppercase label above each pane's body — build it once and slot it in. */
        const PANE_LABEL_BY_KEY = {
            hint: "Hint",
            companies: "Asked at",
            solution: "Solution",
            resources: "Resources",
        };
        const paneLabel = document.createElement("div");
        paneLabel.className = "dsa-h-prob-pane-label";
        paneLabel.textContent = PANE_LABEL_BY_KEY[key] || label;
        if (key === "companies") {
            pane.appendChild(paneLabel);
            const box = document.createElement("div");
            box.className = "dsa-h-prob-companies";
            raw.forEach((tag) => {
                const pill = document.createElement("span");
                pill.className = "dsa-h-prob-company-pill";
                pill.textContent = String(tag);
                box.appendChild(pill);
            });
            pane.appendChild(box);
        } else if (key === "solution") {
            dsaFillProblemSolutionPane(prob, pane);
            pane.insertBefore(paneLabel, pane.firstChild);
        } else if (key === "resources") {
            dsaFillProblemResourcesPane(prob, pane);
            pane.insertBefore(paneLabel, pane.firstChild);
        } else {
            pane.appendChild(paneLabel);
            const div = document.createElement("div");
            div.className = "dsa-h-prob-hint";
            div.textContent = String(raw);
            pane.appendChild(div);
        }

        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const wasOpen = btn.getAttribute("aria-expanded") === "true";
            const nowOpen = !wasOpen;
            /* Mockup behaviour: only one pane is visible at a time — opening one closes the others. */
            if (nowOpen) {
                bar.querySelectorAll(".dsa-h-prob-toggle").forEach((otherBtn) => {
                    if (otherBtn === btn) {
                        return;
                    }
                    if (otherBtn.getAttribute("aria-expanded") === "true") {
                        otherBtn.setAttribute("aria-expanded", "false");
                        otherBtn.classList.remove("dsa-h-prob-toggle--open");
                        otherBtn.setAttribute(
                            "aria-label",
                            `${otherBtn.dataset.probToggleLabel || "Extra"} — hidden, click to show`,
                        );
                        otherBtn.title = `${otherBtn.dataset.probToggleLabel || "Extra"} (hidden)`;
                    }
                });
                reveal.querySelectorAll(".dsa-h-prob-pane").forEach((otherPane) => {
                    if (otherPane !== pane) {
                        otherPane.hidden = true;
                    }
                });
            }
            btn.setAttribute("aria-expanded", String(nowOpen));
            btn.classList.toggle("dsa-h-prob-toggle--open", nowOpen);
            pane.hidden = !nowOpen;
            setToggleGlyph(nowOpen);
            btn.setAttribute(
                "aria-label",
                nowOpen ? `${label} — visible, click to hide` : `${label} — hidden, click to show`,
            );
            btn.title = nowOpen ? `${label} (visible)` : `${label} (hidden)`;
            if (nowOpen && (key === "resources" || key === "solution")) {
                requestAnimationFrame(() => {
                    pane.querySelectorAll(".dsa-h-prob-code").forEach((preBlock) => {
                        dsaHighlightProbSolutionCode(preBlock);
                    });
                });
            }
            if (nowOpen) {
                dsaScrollMindMapElIntoView(pane, { padding: 24 });
            }
            syncProbEye();
        });

        bar.appendChild(btn);
        reveal.appendChild(pane);
    });

    const hasExtrasContent = bar.children.length > 0 || adminEditBtns;
    if (readerExtras && hasExtrasContent) {
        dsaInstallProbExtrasOutsideClose();
        const wrap = document.createElement("div");
        wrap.className = "dsa-h-prob-extras-wrap";
        const btnEye = document.createElement("button");
        btnEye.type = "button";
        btnEye.className = "dsa-h-prob-eye";
        btnEye.setAttribute("aria-expanded", "false");
        btnEye.setAttribute("aria-haspopup", "true");
        function syncProbEyeImpl() {
            const anyPaneOpen = Array.from(bar.querySelectorAll(".dsa-h-prob-toggle")).some(
                (b) => b.getAttribute("aria-expanded") === "true",
            );
            const showOpenEye = anyPaneOpen || wrap.classList.contains("dsa-h-prob-extras-wrap--pinned");
            btnEye.replaceChildren(dsaCardIcon(showOpenEye ? "eye" : "eyeOff"));
            btnEye.classList.toggle("dsa-h-prob-eye--all-visible", anyPaneOpen);
            if (showOpenEye) {
                btnEye.setAttribute(
                    "aria-label",
                    "Hide all extras for this problem (hint, companies, solutions, resources)",
                );
                btnEye.title = "Hide all";
            } else if (wrap.classList.contains("dsa-h-prob-extras-wrap--pinned")) {
                btnEye.setAttribute("aria-label", "Hide extras toolbar");
                btnEye.title = "Close toolbar";
            } else {
                btnEye.setAttribute(
                    "aria-label",
                    "Show extras: hint, companies, solution approaches, or media resources",
                );
                btnEye.title = "Hint, companies, solutions, resources";
            }
        }
        syncProbEye = syncProbEyeImpl;
        btnEye._dsaProbSyncEye = syncProbEyeImpl;
        syncProbEyeImpl();
        btnEye.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const anyPaneOpen = Array.from(bar.querySelectorAll(".dsa-h-prob-toggle")).some(
                (b) => b.getAttribute("aria-expanded") === "true",
            );
            if (anyPaneOpen) {
                dsaProbCollapseAllTogglesInBar(bar, reveal);
                wrap.classList.remove("dsa-h-prob-extras-wrap--pinned");
                btnEye.setAttribute("aria-expanded", "false");
                syncProbEyeImpl();
                return;
            }
            const willPin = !wrap.classList.contains("dsa-h-prob-extras-wrap--pinned");
            dsaProbUnpinOtherExtrasWraps(wrap);
            if (willPin) {
                wrap.classList.add("dsa-h-prob-extras-wrap--pinned");
                btnEye.setAttribute("aria-expanded", "true");
            } else {
                wrap.classList.remove("dsa-h-prob-extras-wrap--pinned");
                btnEye.setAttribute("aria-expanded", "false");
            }
            syncProbEyeImpl();
            if (wrap.classList.contains("dsa-h-prob-extras-wrap--pinned")) {
                dsaScrollMindMapElIntoView(bar, { padding: 28 });
            }
        });
        const eyeCluster = document.createElement("div");
        eyeCluster.className = "dsa-h-prob-eye-cluster";
        if (probYoutubeLink) {
            eyeCluster.appendChild(probYoutubeLink);
        }
        eyeCluster.appendChild(btnEye);
        wrap.appendChild(eyeCluster);
        wrap.appendChild(bar);
        if (adminEditBtns) {
            const modBar = document.createElement("div");
            modBar.className = "dsa-h-prob-mod-bar";
            modBar.setAttribute("role", "toolbar");
            modBar.appendChild(adminEditBtns.btnEdit);
            modBar.appendChild(adminEditBtns.btnDel);
            wrap.appendChild(modBar);
        }
        mainRow.appendChild(wrap);
        li.appendChild(mainRow);
        if (reveal.childElementCount > 0) {
            li.appendChild(reveal);
        }
    } else {
        li.appendChild(mainRow);
    }

    return li;
}

function dsaAddSvgPath(svg, d, stroke) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", stroke || "#7B61FF");
    p.setAttribute("stroke-width", "2.85");
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("stroke-linejoin", "round");
    svg.appendChild(p);
}

function drawDsaMindmapEdges() {
    const canvas = document.getElementById("dsa-mind-canvas");
    const graphArea =
        (canvas && canvas.querySelector(".dsa-mind-canvas-body")) || canvas;
    const svg = graphArea && graphArea.querySelector(".dsa-graph-svg");
    const graphOk = dsaGraphActiveRoot || dsaGraphUnifiedMode || dsaGraphCustomizeMode;
    if (!graphArea || !svg || !graphOk) {
        if (svg) {
            svg.innerHTML = "";
        }
        return;
    }

    const w = graphArea.offsetWidth;
    const h = graphArea.offsetHeight;
    if (w < 2 || h < 2) {
        return;
    }
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.innerHTML = "";

    const vr = graphArea.getBoundingClientRect();

    graphArea.querySelectorAll(".dsa-h-branch").forEach((branch) => {
        const kids = branch.querySelector(":scope > .dsa-h-children");
        if (!kids || kids.classList.contains("dsa-h-children--collapsed")) {
            return;
        }
        const head = branch.querySelector(":scope > .dsa-h-branch-head");
        if (!head) {
            return;
        }
        const hRect = head.getBoundingClientRect();

        kids.querySelectorAll(":scope > .dsa-h-branch").forEach((childBranch) => {
            const chHead = childBranch.querySelector(":scope > .dsa-h-branch-head");
            if (!chHead) {
                return;
            }
            const cRect = chHead.getBoundingClientRect();
            const x1 = hRect.right - vr.left;
            const y1 = (hRect.top + hRect.bottom) / 2 - vr.top;
            const x2 = cRect.left - vr.left;
            const y2 = (cRect.top + cRect.bottom) / 2 - vr.top;
            const span = Math.max(40, x2 - x1);
            const dx = span * 0.55;
            const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
            const stroke = dsaResolveEdgeColor(childBranch);
            dsaAddSvgPath(svg, d, stroke);
        });
    });
}

function buildTreeNode(node, depth, panel, scheduleRedraw, theme, ctx) {
    const cuz = ctx && ctx.customize;
    const ve = ctx && ctx.viewExtras;
    const pathKey = cuz || ve ? ctx.pathKey : "";

    const branch = document.createElement("div");
    branch.className = "dsa-h-branch";
    if (theme) {
        dsaApplyThemeVars(branch, theme);
    }
    const head = document.createElement("div");
    head.className = "dsa-h-branch-head";

    const hasProblems = node.problems && node.problems.length > 0;
    /** CMS JSON often omits `children`; treat like [] so stub topics (e.g. Dijkstra, Bellman-Ford) still get badge UI. */
    const childrenArr = Array.isArray(node.children) ? node.children : [];
    const hasNestedChildren = childrenArr.length > 0;
    /** User-added graph nodes are `{ name, children: [] }` — must render as branch rows like built-in topics. */
    const isEmptyBranch = childrenArr.length === 0 && !hasProblems;
    const hasChildren = hasNestedChildren || isEmptyBranch;

    const childCtx = (ch) =>
        cuz
            ? {
                  customize: true,
                  pathKey: `${pathKey}::${ch.name}`,
                  parentName: node && node.name ? String(node.name) : "",
                  refresh: ctx.refresh,
                  isAdmin: ctx.isAdmin,
              }
            : ve
              ? {
                    viewExtras: true,
                    pathKey: `${pathKey}::${ch.name}`,
                    parentName: node && node.name ? String(node.name) : "",
                    refresh: ctx.refresh,
                }
              : null;

    if (hasChildren) {
        const labelRow = document.createElement("div");
        labelRow.className = "dsa-h-label-row";

        const nameEl = document.createElement("span");
        nameEl.className = "dsa-h-label dsa-h-label--branch";
        nameEl.textContent = node.name;

        const kids = document.createElement("div");
        kids.className = "dsa-h-children dsa-h-children--collapsed";
        if ((cuz || ve) && pathKey) {
            kids.dataset.dsaPath = pathKey;
        }
        childrenArr.forEach((ch) =>
            kids.appendChild(buildTreeNode(ch, depth + 1, panel, scheduleRedraw, theme, childCtx(ch))),
        );

        if (!hasNestedChildren && node.problems && node.problems.length > 0) {
            const strip = document.createElement("div");
            strip.className = "dsa-h-branch-problems-strip";
            const ul = document.createElement("ul");
            ul.className = "dsa-h-problems-list dsa-h-problems-list--branch";
            dsaSortProblemsByDifficulty(node.problems).forEach((prob) => {
                const probCtx = cuz
                    ? { parentKey: pathKey, refresh: ctx.refresh, isAdmin: ctx.isAdmin, topicNode: node }
                    : ve
                      ? { viewExtras: true, parentKey: pathKey, refresh: ctx.refresh, topicNode: node }
                      : null;
                ul.appendChild(buildProblemListItem(prob, probCtx));
            });
            strip.appendChild(ul);
            kids.appendChild(strip);
        }

        let badgeEl;
        if (cuz) {
            badgeEl = createCustomizeClockBadge({
                count: getBadgeCount(node),
                kindClass: "dsa-h-badge--branch",
                pathKey,
                nodeName: node.name,
                refresh: ctx.refresh,
                isMetaRoot: false,
                isDsRoot: !!ctx.isDsRoot,
                kidsEl: kids,
                scheduleRedraw,
                mode: "branch",
                panel,
                leafBlock: null,
                problemsPanel: null,
                nameEl: null,
                isAdmin: ctx.isAdmin,
            });
        } else {
            const badgeBtn = createExpandableCountBadge(getBadgeCount(node), "dsa-h-badge--branch");
            badgeBtn.setAttribute("aria-label", `Expand ${getBadgeCount(node)} direct items`);
            badgeBtn.setAttribute("aria-expanded", "false");
            badgeBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                kids.classList.toggle("dsa-h-children--collapsed");
                const hidden = kids.classList.contains("dsa-h-children--collapsed");
                badgeBtn.setAttribute("aria-expanded", hidden ? "false" : "true");
                badgeBtn.classList.toggle("dsa-h-badge--open", !hidden);
                if (!hidden) {
                    dsaScrollMindMapElIntoView(kids, { padding: 24 });
                }
                requestAnimationFrame(scheduleRedraw);
            });
            badgeEl = badgeBtn;
        }

        let topicStatsForHead = null;
        if (pathKey && (ve || cuz)) {
            topicStatsForHead = dsaCollectTreeNodeProblemStats(node);
        }
        if (topicStatsForHead) {
            const cnt = document.createElement("span");
            cnt.className = "dsa-h-topic-done-count";
            cnt.textContent = `${topicStatsForHead.done}/${topicStatsForHead.total}`;
            labelRow.appendChild(
                createTopicProgressChipUnit(
                    nameEl,
                    cnt,
                    badgeEl,
                    dsaTopicProgressPercent(topicStatsForHead),
                ),
            );
        } else {
            labelRow.appendChild(createNameBadgeUnit(nameEl, badgeEl));
        }
        /** Clicking the topic name / progress chip (not the badge buttons) expands/collapses like the count badge. */
        labelRow.addEventListener("click", (e) => {
            if (e.target.closest("button, a, input, label")) {
                return;
            }
            e.stopPropagation();
            if (cuz) {
                const ringBtn = badgeEl.querySelector(".dsa-h-badge-ring-count");
                if (ringBtn) {
                    ringBtn.click();
                }
            } else {
                badgeEl.click();
            }
        });
        head.appendChild(labelRow);
        branch.appendChild(head);
        branch.appendChild(kids);
        return branch;
    }

    if (hasProblems) {
        const leafBlock = document.createElement("div");
        leafBlock.className = "dsa-h-leaf-block";
        if (cuz && pathKey) {
            leafBlock.setAttribute("data-dsa-leaf-key", JSON.stringify([pathKey, node.name]));
        }
        if ((cuz || ve) && pathKey) {
            leafBlock.dataset.dsaPath = pathKey;
        }

        const labelRow = document.createElement("div");
        labelRow.className = "dsa-h-label-row";

        const nameEl = document.createElement("span");
        nameEl.className = "dsa-h-label dsa-h-label--leaf";
        nameEl.textContent = node.name;

        const problemsPanel = document.createElement("div");
        problemsPanel.className = "dsa-h-problems-panel";
        problemsPanel.hidden = true;

        const connector = document.createElement("div");
        connector.className = "dsa-h-problems-connector";
        connector.setAttribute("aria-hidden", "true");

        const card = document.createElement("div");
        card.className = "dsa-h-problems-card";
        const cardHead = document.createElement("div");
        cardHead.className = "dsa-h-problems-card-head";

        const cardHeadIcon = document.createElement("div");
        cardHeadIcon.className = "dsa-h-problems-card-head-icon";
        cardHeadIcon.setAttribute("aria-hidden", "true");
        cardHeadIcon.appendChild(dsaCardIcon("brain"));

        const cardHeadText = document.createElement("div");
        cardHeadText.className = "dsa-h-problems-card-head-text";

        const cardTitle = document.createElement("div");
        cardTitle.className = "dsa-h-problems-card-title";
        cardTitle.textContent = "Practice Problems";
        cardHeadText.appendChild(cardTitle);

        const cardSubtitle = document.createElement("div");
        cardSubtitle.className = "dsa-h-problems-card-subtitle";
        /* The card lists problems that belong to `node` — the leaf topic itself is the immediate
           parent of those problems, so render its own name (e.g. "Two Pointers"). */
        const parentNameForSubtitle =
            node && node.name && String(node.name).trim()
                ? String(node.name).trim()
                : ctx && ctx.parentName
                  ? String(ctx.parentName).trim()
                  : "";
        const cardSubtitleParent = document.createElement("span");
        cardSubtitleParent.className = "dsa-h-problems-card-subtitle-parent";
        cardSubtitleParent.textContent = parentNameForSubtitle;
        cardSubtitle.appendChild(cardSubtitleParent);

        const cardProgressChip = document.createElement("span");
        cardProgressChip.className = "dsa-h-problems-card-progress-chip";
        const initialProgressStats = dsaCollectTreeNodeProblemStats(node);
        cardProgressChip.textContent = `${initialProgressStats.done}/${initialProgressStats.total}`;
        cardSubtitle.appendChild(cardProgressChip);
        cardHeadText.appendChild(cardSubtitle);

        const cardActions = document.createElement("div");
        cardActions.className = "dsa-h-problems-card-actions";
        let activeFilterMode = "important";
        let searchQuery = "";
        let toolsUiOpen = false;
        const activeDifficultyFilters = new Set();
        let toolsPanelEl = null;
        let searchInputEl = null;
        let toolsToggleBtn = null;

        function closeThisProblemCard() {
            resetProblemToolsUi();
            renderProblemListForFilter("important");
            problemsPanel.hidden = true;
            leafBlock.classList.remove("dsa-h-leaf-block--open");
            panel.querySelectorAll(".dsa-h-problems-panel").forEach((pe) => {
                pe.hidden = true;
            });
            panel.querySelectorAll(".dsa-h-leaf-block").forEach((lb) => {
                lb.classList.remove("dsa-h-leaf-block--open");
            });
            panel.querySelectorAll(".dsa-h-badge--leaf.dsa-h-badge--control").forEach((b) => {
                b.classList.remove("dsa-h-badge--open");
                b.setAttribute("aria-expanded", "false");
            });
            panel.querySelectorAll(".dsa-h-badge-ring-count.dsa-h-badge--leaf").forEach((b) => {
                b.classList.remove("dsa-h-badge--open");
                b.setAttribute("aria-expanded", "false");
            });
            requestAnimationFrame(scheduleRedraw);
        }

        function clearProblemToolsFilters() {
            searchQuery = "";
            toolsUiOpen = false;
            activeDifficultyFilters.clear();
            if (searchInputEl) {
                searchInputEl.value = "";
            }
            if (toolsPanelEl) {
                toolsPanelEl.hidden = true;
                toolsPanelEl.querySelectorAll(".dsa-h-problems-diff-chip--active").forEach((chipBtn) => {
                    chipBtn.classList.remove("dsa-h-problems-diff-chip--active");
                    chipBtn.setAttribute("aria-pressed", "false");
                });
            }
            if (toolsToggleBtn) {
                toolsToggleBtn.classList.remove("dsa-h-problems-tools-tab--open");
                toolsToggleBtn.classList.remove("dsa-h-problems-tools-tab--active");
                toolsToggleBtn.setAttribute("aria-expanded", "false");
                toolsToggleBtn.title = "Search and filter";
            }
        }

        function resetProblemToolsUi() {
            clearProblemToolsFilters();
            activeFilterMode = "important";
        }

        const btnCloseCard = document.createElement("button");
        btnCloseCard.type = "button";
        btnCloseCard.className = "dsa-h-problems-card-close";
        btnCloseCard.setAttribute("aria-label", "Close practice problems");
        btnCloseCard.title = "Close";
        btnCloseCard.appendChild(dsaCardIcon("close"));
        btnCloseCard.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeThisProblemCard();
        });
        cardActions.appendChild(btnCloseCard);

        if (cuz && ctx.isAdmin && (node.problems || []).length > 0) {
            const btnDelAll = document.createElement("button");
            btnDelAll.type = "button";
            btnDelAll.className = "dsa-h-problems-card-delete-all";
            btnDelAll.setAttribute("aria-label", "Delete all practice problems in this list");
            btnDelAll.title = "Remove all problems in this list";
            btnDelAll.appendChild(dsaCardIcon("trash"));
            btnDelAll.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const probs = [...(node.problems || [])];
                if (!probs.length) {
                    return;
                }
                if (
                    !confirm(
                        `Remove all ${probs.length} practice problem(s) from “${node.name}”? This cannot be undone.`,
                    )
                ) {
                    return;
                }
                probs.forEach((p) =>
                    dsaDeletePracticeProblem(
                        pathKey,
                        p && p.name ? String(p.name) : "",
                        p && p.userNodeId ? String(p.userNodeId) : "",
                    ),
                );
                ctx.refresh();
                void dsaFlushDsaCmsSync();
            });
            cardActions.insertBefore(btnDelAll, btnCloseCard);
        }

        cardHead.appendChild(cardHeadIcon);
        cardHead.appendChild(cardHeadText);
        cardHead.appendChild(cardActions);
        card.appendChild(cardHead);
        const filterTabs = document.createElement("div");
        filterTabs.className = "dsa-h-problems-filter-tabs";
        filterTabs.setAttribute("role", "tablist");
        filterTabs.setAttribute("aria-label", "Practice problem filter");
        filterTabs.dataset.mode = "star";
        const filterThumb = document.createElement("span");
        filterThumb.className = "dsa-h-problems-filter-thumb";
        filterThumb.setAttribute("aria-hidden", "true");
        const btnImportant = document.createElement("button");
        btnImportant.type = "button";
        btnImportant.className = "dsa-h-problems-filter-tab dsa-h-problems-filter-tab--star dsa-h-problems-filter-tab--active";
        btnImportant.setAttribute("aria-label", "Show starred problems");
        btnImportant.setAttribute("role", "tab");
        btnImportant.setAttribute("aria-selected", "true");
        const btnImportantIcon = document.createElement("span");
        btnImportantIcon.className = "dsa-h-problems-filter-tab-icon";
        btnImportantIcon.appendChild(dsaCardIcon("star"));
        const btnImportantText = document.createElement("span");
        btnImportantText.className = "dsa-h-problems-filter-tab-text";
        btnImportantText.textContent = "Starred";
        btnImportant.appendChild(btnImportantIcon);
        btnImportant.appendChild(btnImportantText);
        const btnAll = document.createElement("button");
        btnAll.type = "button";
        btnAll.className = "dsa-h-problems-filter-tab dsa-h-problems-filter-tab--all";
        btnAll.setAttribute("aria-label", "Show all problems");
        btnAll.setAttribute("role", "tab");
        btnAll.setAttribute("aria-selected", "false");
        const btnAllText = document.createElement("span");
        btnAllText.className = "dsa-h-problems-filter-tab-text";
        btnAllText.textContent = "All";
        btnAll.appendChild(btnAllText);
        const controlsRow = document.createElement("div");
        controlsRow.className = "dsa-h-problems-controls-row";
        toolsToggleBtn = document.createElement("button");
        toolsToggleBtn.type = "button";
        toolsToggleBtn.className = "dsa-h-problems-tools-tab";
        toolsToggleBtn.setAttribute("aria-label", "Search and filter problems");
        toolsToggleBtn.setAttribute("aria-expanded", "false");
        toolsToggleBtn.title = "Search and filter";
        const toolsFilterIcon = document.createElement("span");
        toolsFilterIcon.className = "dsa-h-problems-tools-tab-icon";
        toolsFilterIcon.appendChild(dsaCardIcon("filter"));
        toolsToggleBtn.appendChild(toolsFilterIcon);
        filterTabs.appendChild(filterThumb);
        filterTabs.appendChild(btnImportant);
        filterTabs.appendChild(btnAll);
        controlsRow.appendChild(filterTabs);
        controlsRow.appendChild(toolsToggleBtn);
        card.appendChild(controlsRow);
        toolsPanelEl = document.createElement("div");
        toolsPanelEl.className = "dsa-h-problems-tools-panel";
        toolsPanelEl.hidden = true;
        const searchWrap = document.createElement("div");
        searchWrap.className = "dsa-h-problems-tools-search-wrap";
        searchWrap.appendChild(dsaCardIcon("search"));
        searchInputEl = document.createElement("input");
        searchInputEl.type = "search";
        searchInputEl.className = "dsa-h-problems-tools-search-input";
        searchInputEl.placeholder = "Search problems…";
        searchInputEl.setAttribute("aria-label", "Search practice problems");
        searchWrap.appendChild(searchInputEl);
        toolsPanelEl.appendChild(searchWrap);
        const diffWrap = document.createElement("div");
        diffWrap.className = "dsa-h-problems-difficulty-filters";
        [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]].forEach(([key, label]) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = `dsa-h-problems-diff-chip dsa-h-problems-diff-chip--${key}`;
            b.textContent = label;
            b.setAttribute("aria-pressed", "false");
            b.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (activeDifficultyFilters.has(key)) {
                    activeDifficultyFilters.delete(key);
                } else {
                    activeDifficultyFilters.add(key);
                }
                b.classList.toggle("dsa-h-problems-diff-chip--active", activeDifficultyFilters.has(key));
                b.setAttribute("aria-pressed", activeDifficultyFilters.has(key) ? "true" : "false");
                renderProblemListForFilter(activeFilterMode);
            });
            diffWrap.appendChild(b);
        });
        toolsPanelEl.appendChild(diffWrap);
        card.appendChild(toolsPanelEl);
        const ul = document.createElement("ul");
        ul.className = "dsa-h-problems-list";
        const emptyListNote = document.createElement("div");
        emptyListNote.className = "dsa-h-problems-empty";
        emptyListNote.hidden = true;
        const allSortedProblems = dsaSortProblemsByDifficulty(node.problems || []);
        const probCtx = cuz
            ? { parentKey: pathKey, refresh: ctx.refresh, isAdmin: ctx.isAdmin, topicNode: node }
            : ve
              ? { viewExtras: true, parentKey: pathKey, refresh: ctx.refresh, topicNode: node }
              : null;
        function renderProblemListForFilter(mode) {
            activeFilterMode = mode === "all" ? "all" : "important";
            const showImportant = mode !== "all";
            btnImportant.classList.toggle("dsa-h-problems-filter-tab--active", showImportant);
            btnAll.classList.toggle("dsa-h-problems-filter-tab--active", !showImportant);
            btnImportant.setAttribute("aria-selected", showImportant ? "true" : "false");
            btnAll.setAttribute("aria-selected", showImportant ? "false" : "true");
            filterTabs.dataset.mode = showImportant ? "star" : "all";
            ul.dataset.filterMode = showImportant ? "starred" : "all";
            ul.innerHTML = "";
            const list = showImportant
                ? allSortedProblems.filter((p) => dsaIsProblemMarkedImportant(p))
                : allSortedProblems;
            const q = searchQuery.trim().toLowerCase();
            const byName = q
                ? list.filter((p) => String((p && p.name) || "").toLowerCase().includes(q))
                : list;
            const byDifficulty = activeDifficultyFilters.size
                ? byName.filter((p) => activeDifficultyFilters.has(dsaNormalizeProblemDifficulty(p && p.difficulty)))
                : byName;
            const hasToolsActive = toolsUiOpen || q.length > 0 || activeDifficultyFilters.size > 0;
            if (toolsPanelEl) {
                toolsPanelEl.hidden = !toolsUiOpen;
            }
            if (toolsToggleBtn) {
                toolsToggleBtn.classList.toggle("dsa-h-problems-tools-tab--active", hasToolsActive);
                toolsToggleBtn.title = hasToolsActive
                    ? "Clear search and filters"
                    : "Search and filter";
            }
            const resultList = byDifficulty;
            if (!resultList.length) {
                emptyListNote.hidden = false;
                let title;
                let detail;
                if (q) {
                    title = "No results";
                    detail = `No problems found for "${searchQuery.trim()}".`;
                } else if (activeDifficultyFilters.size > 0) {
                    title = "No matches";
                    detail = "No problems match the selected difficulty filters.";
                } else if (showImportant) {
                    title = "No starred problems";
                    detail = "Star problems to see them here.";
                } else {
                    title = "Nothing here yet";
                    detail = "No practice problems found.";
                }
                emptyListNote.replaceChildren();
                emptyListNote.appendChild(dsaCardIcon("inbox"));
                const titleEl = document.createElement("div");
                titleEl.className = "dsa-h-problems-empty-title";
                titleEl.textContent = title;
                emptyListNote.appendChild(titleEl);
                const detailEl = document.createElement("div");
                detailEl.className = "dsa-h-problems-empty-detail";
                detailEl.textContent = detail;
                emptyListNote.appendChild(detailEl);
                return;
            }
            emptyListNote.hidden = true;
            resultList.forEach((prob) => {
                ul.appendChild(buildProblemListItem(prob, probCtx));
            });
        }
        btnImportant.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            renderProblemListForFilter("important");
        });
        btnAll.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            renderProblemListForFilter("all");
        });
        toolsToggleBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const q = searchQuery.trim();
            const hasToolsActive =
                toolsUiOpen || q.length > 0 || activeDifficultyFilters.size > 0;
            if (hasToolsActive) {
                clearProblemToolsFilters();
                renderProblemListForFilter(activeFilterMode);
                return;
            }
            toolsUiOpen = true;
            toolsPanelEl.hidden = false;
            toolsToggleBtn.classList.add("dsa-h-problems-tools-tab--open");
            toolsToggleBtn.setAttribute("aria-expanded", "true");
            toolsToggleBtn.title = "Clear search and filters";
            renderProblemListForFilter(activeFilterMode);
        });
        searchInputEl.addEventListener("input", () => {
            searchQuery = searchInputEl.value || "";
            renderProblemListForFilter(activeFilterMode);
        });
        renderProblemListForFilter("important");
        card.appendChild(ul);
        card.appendChild(emptyListNote);

        problemsPanel.appendChild(connector);
        problemsPanel.appendChild(card);

        const probCount = getBadgeCount(node);
        const leafQBadge = "Q";

        let badgeEl;
        let viewLeafBadgeBtn = null;
        function toggleViewLeafProblemCard(e) {
            if (e) {
                e.stopPropagation();
            }
            if (!viewLeafBadgeBtn) {
                return;
            }
            const wasHidden = problemsPanel.hidden;
            panel.querySelectorAll(".dsa-h-problems-panel").forEach((pe) => {
                pe.hidden = true;
            });
            panel.querySelectorAll(".dsa-h-leaf-block").forEach((lb) => {
                lb.classList.remove("dsa-h-leaf-block--open");
            });
            panel.querySelectorAll(".dsa-h-badge--leaf.dsa-h-badge--control").forEach((b) => {
                b.classList.remove("dsa-h-badge--open");
                b.setAttribute("aria-expanded", "false");
            });
            panel.querySelectorAll(".dsa-h-badge-ring-count.dsa-h-badge--leaf").forEach((b) => {
                b.classList.remove("dsa-h-badge--open");
                b.setAttribute("aria-expanded", "false");
            });
            if (!wasHidden) {
                resetProblemToolsUi();
                renderProblemListForFilter("important");
            }
            if (wasHidden) {
                problemsPanel.hidden = false;
                leafBlock.classList.add("dsa-h-leaf-block--open");
                viewLeafBadgeBtn.classList.add("dsa-h-badge--open");
                viewLeafBadgeBtn.setAttribute("aria-expanded", "true");
                dsaScrollMindMapElIntoView(problemsPanel, { padding: 24 });
            }
            requestAnimationFrame(scheduleRedraw);
        }

        if (cuz) {
            badgeEl = createCustomizeClockBadge({
                count: probCount,
                displayText: leafQBadge,
                kindClass: "dsa-h-badge--leaf",
                pathKey,
                nodeName: node.name,
                refresh: ctx.refresh,
                isMetaRoot: false,
                isDsRoot: !!ctx.isDsRoot,
                kidsEl: null,
                scheduleRedraw,
                mode: "leaf",
                panel,
                leafBlock,
                problemsPanel,
                nameEl,
                isAdmin: ctx.isAdmin,
            });
        } else {
            const badgeBtn = createExpandableCountBadge(probCount, "dsa-h-badge--leaf", leafQBadge);
            viewLeafBadgeBtn = badgeBtn;
            badgeBtn.setAttribute(
                "aria-label",
                `Show ${probCount} problem link${probCount === 1 ? "" : "s"}`,
            );
            badgeBtn.setAttribute("aria-expanded", "false");

            badgeBtn.addEventListener("click", toggleViewLeafProblemCard);
            badgeEl = badgeBtn;
        }

        let leafStats = null;
        if (pathKey && (ve || cuz)) {
            leafStats = dsaCollectTreeNodeProblemStats(node);
        }
        if (leafStats) {
            const cnt = document.createElement("span");
            cnt.className = "dsa-h-topic-done-count";
            cnt.textContent = `${leafStats.done}/${leafStats.total}`;
            labelRow.appendChild(
                createTopicProgressChipUnit(
                    nameEl,
                    cnt,
                    badgeEl,
                    dsaTopicProgressPercent(leafStats),
                ),
            );
        } else {
            labelRow.appendChild(createNameBadgeUnit(nameEl, badgeEl));
        }
        if (ve && viewLeafBadgeBtn) {
            labelRow.classList.add("dsa-h-label-row--leaf-problems");
            labelRow.addEventListener("click", (e) => {
                if (e.target.closest("button, a, input, label")) {
                    return;
                }
                toggleViewLeafProblemCard(e);
            });
        }
        leafBlock.appendChild(labelRow);
        leafBlock.appendChild(problemsPanel);
        head.appendChild(leafBlock);
        branch.appendChild(head);
        return branch;
    }

    const labelRow = document.createElement("div");
    labelRow.className = "dsa-h-label-row";
    const span = document.createElement("span");
    span.className = "dsa-h-label";
    span.textContent = node.name;
    labelRow.appendChild(span);
    head.appendChild(labelRow);
    branch.appendChild(head);
    return branch;
}

/**
 * One-topic view: mirror each DS row under “DSA Patterns” in the full map — include `ds.problems` on the topic node.
 * The previous layout only rendered `getDsTree(ds)` children, so practice rows attached at the DS root (`parentKey` = ds.id)
 * never appeared and counts looked wrong vs Full map.
 */
function buildMindmapTree(ds, panel, scheduleRedraw, presetTheme, graphRefreshForView) {
    const topicTheme = presetTheme || dsaGenerateThemes(1)[0];
    const wrap = document.createElement("div");
    wrap.className = "dsa-h-tree";
    const topicNode = {
        name: ds.name,
        children: getDsTree(ds),
        problems: Array.isArray(ds.problems) ? ds.problems : [],
    };
    wrap.appendChild(
        buildTreeNode(topicNode, 1, panel, scheduleRedraw, topicTheme, {
            viewExtras: true,
            pathKey: String(ds.id),
            refresh: graphRefreshForView,
            isDsRoot: true,
        }),
    );
    return wrap;
}

/** After reloading CMS data / user overlay, refresh One-topic picker badges (topic count, done/total, progress bar). */
function dsaRefreshRootsRowUi(rootsRow) {
    if (!rootsRow) {
        return;
    }
    const merged = getDsaHierarchyMerged();
    rootsRow.querySelectorAll(".dsa-node-root[data-ds-id]").forEach((btn) => {
        const id = btn.dataset.dsId;
        const ds = merged.find((d) => d && dsaDsIdEq(d.id, id));
        if (!ds) {
            return;
        }
        const nTopics = getDsTree(ds).length;
        const badge = btn.querySelector(".dsa-h-badge--static");
        if (badge) {
            badge.textContent = String(nTopics);
            badge.setAttribute("aria-label", `${nTopics} top-level topics`);
        }
        const doneCnt = btn.querySelector(".dsa-h-topic-done-count");
        const st = dsaCollectDsProblemStats(ds);
        if (doneCnt) {
            doneCnt.textContent = `${st.done}/${st.total}`;
        }
        const fill = btn.querySelector(".dsa-h-topic-progress-fill--track");
        if (fill) {
            fill.style.width = `${dsaTopicProgressPercent(st)}%`;
        }
    });
}

/**
 * In embedded graph preview with a single merged root, show that graph’s title as the meta-hub label
 * instead of the fixed “DSA Patterns” label (community site maps keep the default).
 */
function dsaUnifiedMetaRootDisplayName(merged) {
    const list = merged || [];
    if (
        typeof dsaGraphPreviewMode !== "undefined" &&
        dsaGraphPreviewMode &&
        list.length === 1 &&
        list[0] &&
        typeof list[0].name === "string" &&
        String(list[0].name).trim()
    ) {
        return String(list[0].name).trim();
    }
    return "DSA Patterns";
}

/** One top-level graph row: slug ROOT, known root id prefix (`mind-root-`, `glib-root-`, …), or legacy ROOT-shaped row (slug omitted). */
function dsaMindMapLooksLikeRootGraphRow(r) {
    if (!r || typeof r !== "object") {
        return false;
    }
    const s = String(r.nodeCategorySlug || "").trim().toUpperCase();
    if (s === "ROOT") {
        return true;
    }
    const id = String(r.id || "").toLowerCase();
    if (id.includes("mind-root") || id.includes("glib-root") || id.includes("ug-root") || id.includes("gc-root")) {
        return true;
    }
    if (s) {
        return false;
    }
    return Array.isArray(r.tree) && Array.isArray(r.patterns) && Array.isArray(r.problems);
}

function dsaMindMapIsSingleRootPayload(merged) {
    return Array.isArray(merged) && merged.length === 1 && dsaMindMapLooksLikeRootGraphRow(merged[0]);
}

/** All data structures under one “DSA Patterns” root (full map). */
function buildUnifiedMindmapTree(panel, scheduleRedraw, customizeCtx, graphRefreshForView) {
    const merged = getDsaHierarchyMerged();
    const soloRoot = dsaMindMapIsSingleRootPayload(merged);
    const dsSolo = soloRoot ? merged[0] : null;
    const metaRootLabel =
        soloRoot && dsSolo && String(dsSolo.name || "").trim()
            ? String(dsSolo.name).trim()
            : dsaUnifiedMetaRootDisplayName(merged);
    const wrap = document.createElement("div");
    wrap.className = "dsa-h-tree";
    const rootBranch = document.createElement("div");
    rootBranch.className = "dsa-h-branch dsa-h-branch--root dsa-h-branch--unified";
    dsaApplyThemeVars(rootBranch, DSA_META_ROOT_THEME);

    const head = document.createElement("div");
    head.className = "dsa-h-branch-head dsa-h-branch-head--root";
    const rootHub = document.createElement("div");
    rootHub.className = "dsa-h-root-hub";
    const rootRow = document.createElement("div");
    rootRow.className = "dsa-h-label-row";
    const rootTitle = document.createElement("span");
    rootTitle.className = "dsa-h-label dsa-h-label--root";
    rootTitle.textContent = metaRootLabel;

    const soloTree = soloRoot && dsSolo ? getDsTree(dsSolo) : null;
    let topicNodes;
    let topicThemes;
    let topicPathKeys;
    if (soloRoot && dsSolo && soloTree) {
        topicNodes = soloTree.map((n) => ({
            name: n != null && n.name != null ? String(n.name).trim() : "",
            children: Array.isArray(n && n.children) ? n.children : [],
            problems: Array.isArray(n && n.problems) ? n.problems : [],
        }));
        topicThemes = soloTree.map((n, i) =>
            dsaStableThemeForKey(`${String(dsSolo.id)}::${String((n && n.name) || "").trim() || i}`),
        );
        topicPathKeys = soloTree.map((n) => `${String(dsSolo.id)}::${String((n && n.name) || "").trim()}`);
    } else {
        topicNodes = merged.map((ds) => ({
            name: ds.name,
            children: getDsTree(ds),
            problems: Array.isArray(ds.problems) ? ds.problems : [],
        }));
        topicThemes = merged.map((ds) => dsaStableThemeForKey(ds.id));
        topicPathKeys = merged.map((ds) => String(ds.id));
    }

    const kids = document.createElement("div");
    kids.className = "dsa-h-children";
    kids.dataset.dsaPath = "__DSA_META__";
    topicNodes.forEach((node, i) => {
        const pathKey = topicPathKeys[i];
        const ctx = customizeCtx
            ? {
                  customize: true,
                  pathKey,
                  parentName: metaRootLabel,
                  refresh: customizeCtx.refresh,
                  isDsRoot: !soloRoot,
                  isAdmin: customizeCtx.isAdmin,
              }
            : {
                  viewExtras: true,
                  pathKey,
                  parentName: metaRootLabel,
                  refresh: graphRefreshForView,
                  isDsRoot: !soloRoot,
              };
        kids.appendChild(buildTreeNode(node, 1, panel, scheduleRedraw, topicThemes[i], ctx));
    });

    const rootCount = soloRoot && dsSolo ? soloTree.length : topicNodes.length;
    let metaAddModalParentKey = "__DSA_META__";
    if (merged.length === 1 && merged[0] && merged[0].id != null) {
        metaAddModalParentKey = String(merged[0].id);
    }
    let rootBadgeEl;
    if (customizeCtx) {
        rootBadgeEl = createCustomizeClockBadge({
            count: rootCount,
            kindClass: "dsa-h-badge--root",
            pathKey: "__DSA_META__",
            nodeName: metaRootLabel,
            refresh: customizeCtx.refresh,
            isMetaRoot: true,
            isDsRoot: false,
            kidsEl: kids,
            scheduleRedraw,
            mode: "branch",
            panel,
            leafBlock: null,
            problemsPanel: null,
            nameEl: null,
            isAdmin: customizeCtx.isAdmin,
            openModalParentKey: metaAddModalParentKey,
        });
    } else {
        rootBadgeEl = createExpandableCountBadge(rootCount, "dsa-h-badge--root");
        wireRootHubTopicToggle(rootBadgeEl, kids, rootCount, metaRootLabel, scheduleRedraw);
    }

    const stMeta = dsaCollectMetaAllProblemStats();
    const rootMetaDoneCnt = document.createElement("span");
    rootMetaDoneCnt.className = "dsa-h-topic-done-count";
    rootMetaDoneCnt.textContent = `${stMeta.done}/${stMeta.total}`;
    rootRow.appendChild(
        createTopicProgressChipUnit(
            rootTitle,
            rootMetaDoneCnt,
            rootBadgeEl,
            dsaTopicProgressPercent(stMeta),
        ),
    );
    rootHub.appendChild(rootRow);
    head.appendChild(rootHub);
    rootBranch.appendChild(head);
    rootBranch.appendChild(kids);

    wrap.appendChild(rootBranch);
    return wrap;
}

function dsaCaptureGraphViewState() {
    const btn = dsaGraphActiveRoot;
    const id = btn && btn.dataset && btn.dataset.dsId ? btn.dataset.dsId : null;
    return {
        unified: !!dsaGraphUnifiedMode,
        activeDsId: id,
        customize: !!dsaGraphCustomizeMode,
    };
}

/**
 * Zoom / pinch graph tree inside .dsa-mind-scroll (expects .dsa-mind-zoom-sizer > .dsa-mind-zoom-content).
 * Pan: native scroll (trackpad / touch). Pinch: 2-finger touch. Zoom: Ctrl/Cmd + wheel
 * (trackpad pinch), mouse wheel (line/page delta mode), or toolbar buttons.
 * @param {HTMLElement} graphAreaEl — scroll parent (for layout); usually `.dsa-mind-canvas-body`.
 * @param {HTMLElement} [zoomMountEl] — host for − / % / + row (toolbar); defaults to graphAreaEl.
 */
function dsaWireMindScrollZoom(scrollEl, graphAreaEl, scheduleRedraw, zoomMountEl) {
    const content = scrollEl.querySelector(".dsa-mind-zoom-content");
    const sizer = scrollEl.querySelector(".dsa-mind-zoom-sizer");
    const zoomHost = zoomMountEl || graphAreaEl;
    if (!content || !sizer || !graphAreaEl || !zoomHost) {
        return () => {};
    }

    let scale = 1;
    const min = 0.35;
    const max = 2.75;
    let btnReset = null;
    let zoomValEl = null;

    function syncSizer() {
        content.style.transform = "none";
        const w = Math.max(1, content.offsetWidth);
        const h = Math.max(1, content.offsetHeight);
        content.style.transform = `scale(${scale})`;
        content.style.transformOrigin = "top left";
        /* Transform does not shrink layout: if sizer width were w*scale with scale<1, the flex
         * tree would be squeezed narrower than its intrinsic width and nodes overlap. */
        const sw = Math.max(w * scale, w);
        const sh = Math.max(h * scale, h);
        sizer.style.width = `${Math.ceil(sw)}px`;
        sizer.style.height = `${Math.ceil(sh)}px`;
        updateZoomPctLabel();
        if (typeof scheduleRedraw === "function") {
            requestAnimationFrame(() => scheduleRedraw());
        }
    }

    function setScale(next) {
        scale = Math.min(max, Math.max(min, next));
        syncSizer();
    }

    function updateZoomPctLabel() {
        const pct = Math.round(scale * 100);
        const text = `${pct}%`;
        if (zoomValEl) {
            zoomValEl.textContent = text;
            return;
        }
        if (!btnReset) {
            return;
        }
        btnReset.textContent = text;
        const at100 = pct === 100;
        const tip = at100 ? "Zoom is 100%. Click to reset." : `Zoom ${pct}%. Click to reset to 100%.`;
        btnReset.title = tip;
        btnReset.setAttribute("aria-label", tip);
    }

    const onWheel = (e) => {
        if (e.shiftKey) {
            return;
        }
        const chord = e.ctrlKey || e.metaKey;
        if (!chord) {
            return;
        }
        e.preventDefault();
        const DM = typeof WheelEvent !== "undefined" ? WheelEvent : { DOM_DELTA_PIXEL: 0, DOM_DELTA_LINE: 1, DOM_DELTA_PAGE: 2 };
        let step = 0.09;
        if (e.deltaMode === DM.DOM_DELTA_LINE) {
            step = 0.12;
        } else if (e.deltaMode === DM.DOM_DELTA_PAGE) {
            step = 0.35;
        }
        const delta = e.deltaY > 0 ? -step : step;
        setScale(scale + delta);
    };
    scrollEl.addEventListener("wheel", onWheel, { passive: false });

    let pinch = null;
    const onTouchStart = (e) => {
        if (e.touches.length === 2) {
            const a = e.touches[0];
            const b = e.touches[1];
            pinch = {
                dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
                scale,
            };
        }
    };
    const onTouchMove = (e) => {
        if (e.touches.length === 2 && pinch && pinch.dist > 0) {
            e.preventDefault();
            const a = e.touches[0];
            const b = e.touches[1];
            const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            setScale(pinch.scale * (d / pinch.dist));
        }
    };
    const onTouchEnd = (e) => {
        if (e.touches.length < 2) {
            pinch = null;
        }
    };
    scrollEl.addEventListener("touchstart", onTouchStart, { passive: true });
    scrollEl.addEventListener("touchmove", onTouchMove, { passive: false });
    scrollEl.addEventListener("touchend", onTouchEnd);
    scrollEl.addEventListener("touchcancel", onTouchEnd);

    const bar = document.createElement("div");
    const useShellZoomChrome = !!zoomMountEl;

    function mkBtn(label, cls, title) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `dsa-graph-zoom-btn${cls ? ` ${cls}` : ""}`;
        b.textContent = label;
        b.title = title;
        b.setAttribute("aria-label", title);
        return b;
    }

    let btnOut;
    let btnIn;
    if (useShellZoomChrome) {
        bar.className = "zoom";
        bar.setAttribute("role", "group");
        bar.setAttribute("aria-label", "Zoom");
        btnOut = document.createElement("button");
        btnOut.type = "button";
        btnOut.title = "Zoom out";
        btnOut.setAttribute("aria-label", "Zoom out");
        btnOut.textContent = "−";
        zoomValEl = document.createElement("span");
        zoomValEl.className = "val";
        zoomValEl.textContent = "100%";
        btnIn = document.createElement("button");
        btnIn.type = "button";
        btnIn.title = "Zoom in";
        btnIn.setAttribute("aria-label", "Zoom in");
        btnIn.textContent = "+";
    } else {
        bar.className = "dsa-graph-zoom-float";
        btnOut = mkBtn("−", "", "Zoom out");
        btnReset = mkBtn("100%", "dsa-graph-zoom-btn--text", "Zoom 100%. Click to reset to 100%.");
        btnIn = mkBtn("+", "", "Zoom in");
        btnReset.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            setScale(1);
        });
    }

    btnOut.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        setScale(scale - 0.15);
    });
    btnIn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        setScale(scale + 0.15);
    });
    bar.appendChild(btnOut);
    if (useShellZoomChrome) {
        bar.appendChild(zoomValEl);
    } else {
        bar.appendChild(btnReset);
    }
    bar.appendChild(btnIn);
    zoomHost.appendChild(bar);

    updateZoomPctLabel();

    let ro;
    if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => requestAnimationFrame(syncSizer));
        ro.observe(content);
    }

    requestAnimationFrame(() => requestAnimationFrame(syncSizer));

    return () => {
        scrollEl.removeEventListener("wheel", onWheel);
        scrollEl.removeEventListener("touchstart", onTouchStart);
        scrollEl.removeEventListener("touchmove", onTouchMove);
        scrollEl.removeEventListener("touchend", onTouchEnd);
        scrollEl.removeEventListener("touchcancel", onTouchEnd);
        if (ro) {
            ro.disconnect();
        }
        bar.remove();
        btnReset = null;
        zoomValEl = null;
    };
}

/**
 * Fade/slide swap of the mind-map tree only (keeps toolbar, zoom, scroll shell). Skipped when reduced motion.
 */
function dsaAnimateGraphContentSwap(zContent, replaceFn, afterFn) {
    if (!zContent || typeof replaceFn !== "function") {
        return;
    }
    const reduce =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const done = () => {
        if (typeof afterFn === "function") {
            afterFn();
        }
    };
    if (reduce) {
        replaceFn();
        done();
        return;
    }
    zContent.style.willChange = "opacity, transform";
    zContent.style.transition = "opacity 0.2s ease-out, transform 0.26s cubic-bezier(0.22, 1, 0.36, 1)";
    zContent.style.opacity = "0";
    zContent.style.transform = "translateY(8px)";
    window.setTimeout(() => {
        replaceFn();
        zContent.style.opacity = "0";
        zContent.style.transform = "translateY(5px)";
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                zContent.style.opacity = "1";
                zContent.style.transform = "translateY(0)";
                window.setTimeout(() => {
                    zContent.style.transition = "";
                    zContent.style.willChange = "";
                    done();
                }, 290);
            });
        });
    }, 160);
}

/**
 * Rebuilds only `.dsa-mind-zoom-content` when the canvas already exists (avoids full-page blink on done / save).
 * @returns {boolean} true if swap ran
 */
function dsaTrySoftRemountGraphTree(panel, scheduleRedraw, buildTreeFn, afterSwap) {
    if (!panel || typeof buildTreeFn !== "function") {
        return false;
    }
    const zContent = panel.querySelector(".dsa-mind-zoom-content");
    if (!zContent || !panel.querySelector(".dsa-mind-canvas")) {
        return false;
    }
    dsaAnimateGraphContentSwap(
        zContent,
        () => {
            zContent.replaceChildren();
            const root = buildTreeFn();
            if (root) {
                zContent.appendChild(root);
            }
        },
        () => {
            if (typeof scheduleRedraw === "function") {
                requestAnimationFrame(() => requestAnimationFrame(scheduleRedraw));
            }
            if (typeof afterSwap === "function") {
                afterSwap();
            }
        },
    );
    return true;
}

/**
 * Scroll `.dsa-mind-scroll` so `el` sits inside the viewport with padding (smooth).
 * Used when expanding branches or opening problem extras so content isn’t clipped horizontally/vertically.
 */
function dsaScrollMindMapElIntoView(el, opts) {
    if (!el || typeof el.getBoundingClientRect !== "function") {
        return;
    }
    const pad = opts && opts.padding != null ? opts.padding : 20;
    const run = () => {
        const panel = el.closest("#dsa-graph-panel");
        const scrollRoot = panel && panel.querySelector(".dsa-mind-scroll");
        if (!scrollRoot) {
            el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
            return;
        }
        const rootRect = scrollRoot.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        let dLeft = 0;
        let dTop = 0;
        if (elRect.right > rootRect.right - pad) {
            dLeft = elRect.right - rootRect.right + pad;
        } else if (elRect.left < rootRect.left + pad) {
            dLeft = elRect.left - rootRect.left - pad;
        }
        if (elRect.bottom > rootRect.bottom - pad) {
            dTop = elRect.bottom - rootRect.bottom + pad;
        } else if (elRect.top < rootRect.top + pad) {
            dTop = elRect.top - rootRect.top - pad;
        }
        if (dLeft !== 0 || dTop !== 0) {
            scrollRoot.scrollBy({ left: dLeft, top: dTop, behavior: "smooth" });
        }
    };
    requestAnimationFrame(() => {
        requestAnimationFrame(run);
    });
}

function attachDsaMindCanvas(panel, buildTreeFragment, scheduleRedraw, mindOpts) {
    panel.innerHTML = "";
    panel.classList.remove("dsa-graph-panel--customize");
    const mo = mindOpts || {};
    const tp = mo.toolbarParent;
    if (tp instanceof HTMLElement) {
        if (tp.dataset.dsaIndexToolbarSlots === "1") {
            dsaClearIndexMapToolbarSlots(tp);
        } else {
            tp.replaceChildren();
        }
    }
    const { canvas, toolbarExpand, toolbarZoom, body } = dsaCreateGraphCanvasLayout(
        tp instanceof HTMLElement ? tp : null,
        dsaGraphPreviewMode ? { suppressExternalHint: true } : undefined,
    );

    const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgEl.classList.add("dsa-graph-svg");
    svgEl.setAttribute("aria-hidden", "true");

    const scroll = document.createElement("div");
    scroll.className = "dsa-mind-scroll";
    const sizer = document.createElement("div");
    sizer.className = "dsa-mind-zoom-sizer";
    const zContent = document.createElement("div");
    zContent.className = "dsa-mind-zoom-content";
    zContent.appendChild(buildTreeFragment());
    sizer.appendChild(zContent);
    scroll.appendChild(sizer);
    body.appendChild(svgEl);
    body.appendChild(scroll);
    dsaMountGraphExpandCollapseControls(toolbarExpand, panel, scheduleRedraw);
    panel.appendChild(canvas);

    scroll.addEventListener("scroll", scheduleRedraw, { passive: true });
    dsaChainMindScrollResizeForEdges(scheduleRedraw);
    const zoomUnsub = dsaWireMindScrollZoom(scroll, body, scheduleRedraw, toolbarZoom);
    const prevCleanup = dsaGraphResizeCleanup;
    dsaGraphResizeCleanup = () => {
        if (typeof zoomUnsub === "function") {
            zoomUnsub();
        }
        if (typeof prevCleanup === "function") {
            prevCleanup();
        }
    };
    requestAnimationFrame(() => requestAnimationFrame(scheduleRedraw));
}


/** Brand copy for embedded Sketch Studio (reads site navbar when present). */
function dsaGetSiteBrandForSketch() {
    const markEl = document.querySelector(".dsa-shell-navbar .brand-mark");
    const nameEl = document.querySelector(".dsa-shell-navbar .brand-name");
    return {
        title: nameEl && nameEl.textContent ? nameEl.textContent.trim() : "DSA Patterns",
        subtitle: "Learn DSA as a Connected System",
        markText: markEl && markEl.textContent ? markEl.textContent.trim() : "D",
    };
}

/**
 * DSA problem sketch — Sketch Studio UI (dsa-sketch-studio.js) or native fallback (dsa-sketch-native.js). Load before script.js.
 * @param {HTMLElement} editorRoot
 * @param {() => void} onChange
 * @param {{ afterClear?: () => void; admin?: boolean; onPersist?: () => void }} [sketchOpts]
 */
function dsaWireSketchEditor(editorRoot, onChange, sketchOpts) {
    if (typeof dsaWireSketchEditorStudio === "function") {
        return dsaWireSketchEditorStudio(editorRoot, onChange, sketchOpts);
    }
    if (typeof dsaWireSketchEditorNative !== "function") {
        console.error("DSA: Sketch not loaded. Include dsa-sketch-studio.js or dsa-sketch-native.js before script.js.");
        const err = document.createElement("div");
        err.className = "dsa-sketch-missing-fabric";
        err.setAttribute("role", "alert");
        err.style.cssText =
            "padding:10px 12px;border:1px solid #fca5a5;border-radius:8px;background:#fef2f2;color:#991b1b;font-size:0.85rem;margin-bottom:8px;";
        err.textContent =
            "Sketch unavailable: add dsa-sketch-studio.js (or dsa-sketch-native.js) before script.js on this page.";
        editorRoot.appendChild(err);
        const hooks = sketchOpts || {};
        return {
            clear() {
                if (typeof hooks.afterClear === "function") {
                    hooks.afterClear();
                }
                onChange();
            },
            zoomIn() {},
            zoomOut() {},
            resetZoom() {},
            loadDataUrl() {},
            toDataUrl() {
                return "";
            },
            toPersistedSketchDataUrl() {
                return "";
            },
            getHasInk() {
                return false;
            },
            syncHasInkFromPixels() {},
            exitFullscreen() {},
            isFullscreen() {
                return false;
            },
            destroy() {},
        };
    }
    return dsaWireSketchEditorNative(editorRoot, onChange, sketchOpts);
}

/** No Fabric instance — add-problem flow; sketch is edit-only after first save. */
function dsaStubSketchApi() {
    return {
        clear() {},
        zoomIn() {},
        zoomOut() {},
        resetZoom() {},
        loadDataUrl() {},
        toDataUrl() {
            return "";
        },
        toPersistedSketchDataUrl() {
            return "";
        },
        getHasInk() {
            return false;
        },
        syncHasInkFromPixels() {},
        flushForPersist() {},
        prepareForSavedLoad() {},
        exitFullscreen() {},
        isFullscreen() {
            return false;
        },
        destroy() {},
    };
}

function dsaCompressImageToDataUrl(file, maxSide, quality, cb) {
    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            const max = maxSide || 1280;
            let width = img.naturalWidth || img.width;
            let height = img.naturalHeight || img.height;
            if (width < 1 || height < 1) {
                cb(null);
                return;
            }
            if (width > max || height > max) {
                const r = Math.min(max / width, max / height);
                width = Math.round(width * r);
                height = Math.round(height * r);
            }
            const c = document.createElement("canvas");
            c.width = width;
            c.height = height;
            const x = c.getContext("2d");
            x.drawImage(img, 0, 0, width, height);
            try {
                cb(c.toDataURL("image/jpeg", quality == null ? 0.82 : quality));
            } catch (err) {
                cb(null);
            }
        };
        img.onerror = () => cb(null);
        img.src = String(reader.result || "");
    };
    reader.onerror = () => cb(null);
    reader.readAsDataURL(file);
}

/** Info (i) control beside resource “Add …” buttons; intro panel hidden until clicked. */
function dsaCreateResInfoButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-btn dsa-res-info-btn";
    btn.setAttribute("aria-label", "Show description");
    btn.setAttribute("aria-expanded", "false");
    btn.title = "Info";
    btn.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12.01" y2="16"/><path d="M12 8v4"/></svg>';
    return btn;
}

function dsaCreateResAddRow(actionBtn) {
    const row = document.createElement("div");
    row.className = "dsa-res-add-row";
    const infoBtn = dsaCreateResInfoButton();
    row.appendChild(actionBtn);
    row.appendChild(infoBtn);
    return { row, infoBtn };
}

function dsaWireResAddIntroToggle(introEl, infoBtn) {
    introEl.hidden = true;
    infoBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const show = introEl.hidden;
        introEl.hidden = !show;
        infoBtn.classList.toggle("active", show);
        infoBtn.setAttribute("aria-expanded", show ? "true" : "false");
    });
}

function dsaCreateMediaSlot({ title, sub, svgInner, onActivate }) {
    const el = document.createElement("div");
    el.className = "media-slot";
    el.setAttribute("role", "button");
    el.tabIndex = 0;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "ic");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.7");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = svgInner;
    const ttl = document.createElement("div");
    ttl.className = "ttl";
    ttl.textContent = title;
    const subEl = document.createElement("div");
    subEl.className = "sub";
    subEl.textContent = sub;
    el.appendChild(svg);
    el.appendChild(ttl);
    el.appendChild(subEl);
    const activate = (e) => {
        if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") {
            return;
        }
        if (e.type === "keydown") {
            e.preventDefault();
        }
        if (typeof onActivate === "function") {
            onActivate(e);
        }
    };
    el.addEventListener("click", activate);
    el.addEventListener("keydown", activate);
    return el;
}

function dsaOpenCustomizeUnifiedModal(parentKey, refresh, opts) {
    const isMetaRoot = parentKey === "__DSA_META__";
    /** Edit mode in customize UI: site admin (RSA) or Pro / practice-admin (see dsa-user-auth). */
    const isAdmin =
        typeof dsaHasCustomizeGraphAccess === "function" && dsaHasCustomizeGraphAccess();
    const kindFlags = dsaParentChildKindFlags(parentKey);
    const editQuestionName =
        opts && opts.editQuestionName ? String(opts.editQuestionName).trim() : "";
    const editUserNodeId =
        opts && opts.editUserNodeId ? String(opts.editUserNodeId).trim() : "";
    const renameTargetPathKey =
        opts && opts.renameTargetPathKey ? String(opts.renameTargetPathKey).trim() : "";
    const isRenameNode = !!renameTargetPathKey;
    const isEditProblem = !!(editQuestionName || editUserNodeId);
    let userClearedSketch = false;
    /** Latest JPEG export while the modal is open — survives name sync that must not wipe the canvas. */
    let lastSketchExport = "";
    let syncEntryKey = "";

    const backdrop = document.createElement("div");
    backdrop.className = "dsa-dialog-backdrop dsa-dialog-backdrop--graph-ac-mock";

    const dlg = document.createElement("div");
    dlg.id = "modal";
    dlg.className = "dsa-dialog dsa-dialog--question dsa-dialog--unified graph-add-child-mock modal";
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.setAttribute("data-dsa-question-ui", "unified-v4");

    const title = document.createElement("h2");
    title.id = "modalTitle";
    title.className = "dsa-dialog-title";
    title.textContent =
        editQuestionName || editUserNodeId
            ? isAdmin
                ? "Edit problem"
                : "Problem details"
            : isMetaRoot
              ? "Add data structure"
              : "Add to graph";

    const subtitleEl = document.createElement("p");
    subtitleEl.id = "modalSubtitle";
    subtitleEl.className = "";
    subtitleEl.hidden = true;

    let adminNote = null;
    if (!isAdmin) {
        adminNote = document.createElement("p");
        adminNote.className = "dsa-dialog-note";
        adminNote.textContent =
            "View only. Sign in with a site admin or Pro / elevated practice account to edit the graph.";
    }

    const catFs = document.createElement("fieldset");
    catFs.className = "dsa-fieldset dsa-u-cat";
    const catLeg = document.createElement("legend");
    catLeg.className = "dsa-field-legend";
    catLeg.textContent = "Item type";
    const rowCat = document.createElement("div");
    rowCat.className = "dsa-u-cat-row u-cat-row-mock";
    const radQ = document.createElement("input");
    radQ.type = "radio";
    radQ.name = "dsaUcat";
    radQ.value = "problem";
    radQ.id = "dsaUcatQ";
    const labQ = document.createElement("label");
    labQ.htmlFor = "dsaUcatQ";
    labQ.textContent = "Problem";
    const radN = document.createElement("input");
    radN.type = "radio";
    radN.name = "dsaUcat";
    radN.value = "node";
    radN.id = "dsaUcatN";
    const labN = document.createElement("label");
    labN.htmlFor = "dsaUcatN";
    labN.textContent = "Node";
    if (isMetaRoot) {
        radQ.disabled = true;
        radN.checked = true;
    } else {
        radQ.checked = true;
    }
    rowCat.appendChild(radQ);
    rowCat.appendChild(labQ);
    rowCat.appendChild(radN);
    rowCat.appendChild(labN);
    catFs.appendChild(catLeg);
    catFs.appendChild(rowCat);
    const addingNewItem = !editQuestionName && !editUserNodeId && !isRenameNode;
    const mindCatsPre =
        typeof window !== "undefined" && Array.isArray(window.__dsaGraphNodeCategories) ? window.__dsaGraphNodeCategories : [];
    const mindParentSlugEff =
        addingNewItem && !isRenameNode && !editQuestionName && !editUserNodeId
            ? dsaMindParentCategorySlug(parentKey)
            : "";
    const mindAllowedEff =
        mindCatsPre.length > 0 &&
        mindParentSlugEff &&
        addingNewItem &&
        !isRenameNode &&
        !editQuestionName &&
        !editUserNodeId
            ? dsaMindAllowedChildSlugsRespectingParentState(parentKey, mindCatsPre)
            : [];
    const useMindTypePicker2 = mindAllowedEff.length > 0;

    if (isMetaRoot && addingNewItem) {
        catFs.hidden = true;
        catFs.setAttribute("aria-hidden", "true");
    }
    if (isRenameNode) {
        catFs.hidden = true;
        catFs.setAttribute("aria-hidden", "true");
        radN.checked = true;
        radQ.checked = false;
    }
    if (editQuestionName) {
        catFs.hidden = true;
        radQ.checked = true;
        radN.checked = false;
    }

    const mindTypeFs = document.createElement("div");
    mindTypeFs.className = "dsa-fieldset dsa-u-mind-kind";
    mindTypeFs.hidden = !useMindTypePicker2;
    if (useMindTypePicker2) {
        catFs.hidden = true;
        catFs.setAttribute("aria-hidden", "true");
        const mindTypeLabelRow = document.createElement("div");
        mindTypeLabelRow.className = "field-label";
        mindTypeLabelRow.textContent = "Node type";
        mindTypeFs.appendChild(mindTypeLabelRow);
        const typeGrid = document.createElement("div");
        typeGrid.className = "type-grid";
        typeGrid.setAttribute("role", "radiogroup");
        const order = ["TOPIC", "PATTERN", "PROBLEM"];
        const slugLabel = new Map(
            mindCatsPre.map((c) => [String(c.slug || "").toUpperCase().trim(), String(c.label || c.slug || "").trim()]),
        );
        const slugCardClass = (su) => {
            if (su === "PATTERN") {
                return "type-card pattern";
            }
            if (su === "PROBLEM") {
                return "type-card problem";
            }
            if (su === "TOPIC") {
                return "type-card topic";
            }
            return "type-card default";
        };
        const slugIconClass = (su) => {
            if (su === "PATTERN") {
                return "type-icon pattern";
            }
            if (su === "PROBLEM") {
                return "type-icon problem";
            }
            if (su === "TOPIC") {
                return "type-icon topic";
            }
            return "type-icon default";
        };
        const slugIconSvg = (su) => {
            if (su === "PATTERN") {
                return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 10v6M4.22 4.22l4.24 4.24m7.07 7.07l4.24 4.24M1 12h6m10 0h6M4.22 19.78l4.24-4.24m7.07-7.07l4.24-4.24"/></svg>';
            }
            if (su === "PROBLEM") {
                return "";
            }
            if (su === "TOPIC") {
                return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';
            }
            return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>';
        };
        const allowedSorted = [...mindAllowedEff].sort((a, b) => order.indexOf(a) - order.indexOf(b));
        allowedSorted.forEach((slug, idx) => {
            const su = String(slug).toUpperCase();
            const id = `graphMindKind_${su}`;
            const lab = document.createElement("label");
            lab.className = slugCardClass(su);
            lab.dataset.type = su.toLowerCase();
            lab.setAttribute("for", id);
            const inp = document.createElement("input");
            inp.type = "radio";
            inp.name = "graphMindKind";
            inp.value = su;
            inp.id = id;
            if (idx === 0) {
                inp.checked = true;
                lab.classList.add("selected");
            }
            lab.appendChild(inp);
            const icon = document.createElement("span");
            icon.className = slugIconClass(su);
            if (su === "PROBLEM") {
                const brainIc = dsaSvgIconBrain();
                brainIc.setAttribute("width", "16");
                brainIc.setAttribute("height", "16");
                icon.appendChild(brainIc);
            } else {
                icon.innerHTML = slugIconSvg(su);
            }
            lab.appendChild(icon);
            const nm = document.createElement("div");
            nm.className = "type-name";
            nm.textContent = slugLabel.get(su) || su;
            lab.appendChild(nm);
            const chk = document.createElement("span");
            chk.className = "check-mark";
            chk.innerHTML =
                '<svg width="8" height="8" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
            lab.appendChild(chk);
            const cardInfoBtn = document.createElement("button");
            cardInfoBtn.type = "button";
            cardInfoBtn.className = "type-card-info-btn";
            cardInfoBtn.setAttribute("aria-label", `About ${slugLabel.get(su) || su}`);
            cardInfoBtn.title = "About this node type";
            cardInfoBtn.setAttribute("aria-expanded", "false");
            cardInfoBtn.innerHTML =
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12.01" y2="16"/><path d="M12 8v4"/></svg>';
            cardInfoBtn.addEventListener("click", toggleTypeCardInfoPanel);
            lab.appendChild(cardInfoBtn);
            typeGrid.appendChild(lab);
        });
        mindTypeFs.appendChild(typeGrid);
    }

    const graphBodyCats =
        typeof window !== "undefined" && Array.isArray(window.__dsaGraphBodyCategories) ? window.__dsaGraphBodyCategories : [];
    const graphBodyCatFs = document.createElement("fieldset");
    graphBodyCatFs.className = "dsa-fieldset dsa-u-graph-body-cat u-graph-body-mock";
    const graphBodyCatLeg = document.createElement("legend");
    graphBodyCatLeg.className = "dsa-field-legend";
    graphBodyCatLeg.textContent = "Group (this graph)";
    const graphBodyCatRow = document.createElement("div");
    graphBodyCatRow.className = "dsa-q-field";
    const graphBodyCatLab = document.createElement("label");
    graphBodyCatLab.className = "dsa-field-label";
    graphBodyCatLab.setAttribute("for", "dsa-graph-body-category");
    graphBodyCatLab.textContent = "Category";
    const graphBodyCatSelect = document.createElement("select");
    graphBodyCatSelect.id = "dsa-graph-body-category";
    graphBodyCatSelect.className = "dsa-field-control";
    const optNoneGb = document.createElement("option");
    optNoneGb.value = "";
    optNoneGb.textContent = "— None —";
    if (!graphBodyCats.length) {
        graphBodyCatSelect.appendChild(optNoneGb);
    }
    graphBodyCats.forEach((c) => {
        if (!c || !c.id) {
            return;
        }
        const o = document.createElement("option");
        o.value = String(c.id);
        o.textContent = String(c.name || c.id);
        graphBodyCatSelect.appendChild(o);
    });
    if (graphBodyCats.length) {
        graphBodyCatSelect.value = String(graphBodyCats[0].id);
    }
    graphBodyCatRow.appendChild(graphBodyCatLab);
    const graphBodySelectWrap = document.createElement("div");
    graphBodySelectWrap.className = "select-wrap";
    graphBodySelectWrap.appendChild(graphBodyCatSelect);
    graphBodyCatRow.appendChild(graphBodySelectWrap);
    graphBodyCatFs.appendChild(graphBodyCatLeg);
    graphBodyCatFs.appendChild(graphBodyCatRow);
    graphBodyCatFs.hidden = true;

    const scrollBody = document.createElement("div");
    scrollBody.className = "body";

    const infoPanel = document.createElement("div");
    infoPanel.className = "info-panel topic";
    infoPanel.id = "infoPanel";
    infoPanel.setAttribute("aria-hidden", "true");
    const infoInner = document.createElement("div");
    infoInner.className = "info-content";
    const infoIconSm = document.createElement("div");
    infoIconSm.className = "info-icon-sm";
    infoIconSm.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    const infoBodyWrap = document.createElement("div");
    infoBodyWrap.className = "info-body";
    const infoTitleEl = document.createElement("div");
    infoTitleEl.id = "infoTitle";
    infoTitleEl.className = "info-title";
    const infoTextEl = document.createElement("div");
    infoTextEl.id = "infoText";
    infoTextEl.className = "info-text";
    const infoChipsEl = document.createElement("div");
    infoChipsEl.id = "infoChips";
    infoChipsEl.className = "info-chips";
    infoBodyWrap.appendChild(infoTitleEl);
    infoBodyWrap.appendChild(infoTextEl);
    infoBodyWrap.appendChild(infoChipsEl);
    infoInner.appendChild(infoIconSm);
    infoInner.appendChild(infoBodyWrap);
    infoPanel.appendChild(infoInner);

    function graphNodeCategoryLabelForSlug(slugUpper, cats) {
        const u = String(slugUpper || "").toUpperCase().trim();
        const row = (cats || []).find((c) => String(c.slug || "").toUpperCase().trim() === u);
        return row ? String(row.label || u).trim() || u : u;
    }

    function graphNodeCategoryAllowedChildren(row) {
        if (!row || typeof row !== "object") {
            return [];
        }
        if (Array.isArray(row.allowedChildSlugs)) {
            return row.allowedChildSlugs.map((s) => String(s || "").toUpperCase().trim()).filter(Boolean);
        }
        if (Array.isArray(row.allowed_child_slugs)) {
            return row.allowed_child_slugs.map((s) => String(s || "").toUpperCase().trim()).filter(Boolean);
        }
        return [];
    }

    function fillNodeTypeInfoFromCatalog(slugUpper) {
        const u = String(slugUpper || "TOPIC").toUpperCase().trim();
        const row = mindCatsPre.find((c) => String(c.slug || "").toUpperCase().trim() === u);
        const label = graphNodeCategoryLabelForSlug(u, mindCatsPre);
        infoTitleEl.textContent = `About ${label}`;
        const desc = row && row.description != null ? String(row.description).trim() : "";
        infoTextEl.textContent =
            desc ||
            "No description is configured for this node type. Admins can set it in graph node category settings.";
        infoChipsEl.replaceChildren();
        const allowed = graphNodeCategoryAllowedChildren(row);
        allowed.forEach((ch) => {
            const chip = document.createElement("span");
            chip.className = "chip";
            chip.textContent = graphNodeCategoryLabelForSlug(ch, mindCatsPre);
            infoChipsEl.appendChild(chip);
        });
        if (!allowed.length) {
            const chip = document.createElement("span");
            chip.className = "chip muted";
            chip.textContent = "No child types";
            infoChipsEl.appendChild(chip);
        }
        const slugVar =
            u === "PATTERN" ? "pattern" : u === "PROBLEM" ? "problem" : u === "TOPIC" ? "topic" : "default";
        const wasShow = infoPanel.classList.contains("show");
        infoPanel.className = `info-panel ${slugVar}${wasShow ? " show" : ""}`;
    }

    function syncTypeCardInfoBtnActive() {
        const panelOn = infoPanel.classList.contains("show");
        mindTypeFs.querySelectorAll(".type-card-info-btn").forEach((btn) => {
            const onCard = btn.closest(".type-card");
            btn.classList.toggle("active", panelOn && !!(onCard && onCard.classList.contains("selected")));
            btn.setAttribute("aria-expanded", panelOn && onCard && onCard.classList.contains("selected") ? "true" : "false");
        });
    }

    function toggleTypeCardInfoPanel(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const on = !infoPanel.classList.contains("show");
        infoPanel.classList.toggle("show", on);
        infoPanel.setAttribute("aria-hidden", on ? "false" : "true");
        syncTypeCardInfoBtnActive();
    }

    function syncMindTypeCardVisual() {
        if (!useMindTypePicker2) {
            return;
        }
        mindTypeFs.querySelectorAll(".type-card").forEach((card) => {
            const inp = card.querySelector('input[name="graphMindKind"]');
            card.classList.toggle("selected", !!(inp && inp.checked));
        });
        const mk = dlg.querySelector('input[name="graphMindKind"]:checked');
        fillNodeTypeInfoFromCatalog(mk ? mk.value : "TOPIC");
        syncTypeCardInfoBtnActive();
        syncNodeCategoryNameLabel();
    }

    function refreshAddChildChrome() {
        if (!useMindTypePicker2 || !addingNewItem || isRenameNode || editQuestionName || editUserNodeId) {
            subtitleEl.hidden = true;
            dlg.classList.remove("expanded");
            syncNodeCategoryNameLabel();
            return;
        }
        subtitleEl.hidden = false;
        const mk = dlg.querySelector('input[name="graphMindKind"]:checked');
        const slugU = mk ? String(mk.value).toUpperCase() : "TOPIC";
        const isProb = slugU === "PROBLEM";
        dlg.classList.toggle("expanded", isProb);
        fillNodeTypeInfoFromCatalog(slugU);
        subtitleEl.textContent = isProb
            ? "Capture problem details, difficulty and resources"
            : "Add a new item beneath the current node";
        title.textContent = isProb ? "Add problem" : "Add child node";
        syncNodeCategoryNameLabel();
    }

    function syncGraphBodyCategoryFieldset() {
        if (!graphBodyCats.length || isMetaRoot) {
            graphBodyCatFs.hidden = true;
            return;
        }
        if (isRenameNode) {
            graphBodyCatFs.hidden = true;
            return;
        }
        graphBodyCatFs.hidden = false;
    }

    const nodeBlock = document.createElement("div");
    nodeBlock.className = "dsa-u-node field-group";
    const nodeLabelRow = document.createElement("div");
    nodeLabelRow.className = "field-label";
    const nodeLabEl = document.createElement("label");
    nodeLabEl.setAttribute("for", "dsa-node-only");
    const nodeLabelText = document.createElement("span");
    nodeLabelText.id = "dsa-node-category-name-label";
    nodeLabelText.textContent = "Topic Name";
    const nodeReqStar = document.createElement("span");
    nodeReqStar.className = "dsa-req";
    nodeReqStar.setAttribute("aria-hidden", "true");
    nodeReqStar.textContent = "*";
    nodeLabEl.appendChild(nodeLabelText);
    nodeLabEl.appendChild(nodeReqStar);
    const nodeCountWrap = document.createElement("span");
    nodeCountWrap.className = "opt field-char-limit";
    const nodeCharSpan = document.createElement("span");
    nodeCharSpan.textContent = "0";
    nodeCountWrap.appendChild(nodeCharSpan);
    nodeCountWrap.appendChild(document.createTextNode("/60"));
    nodeLabelRow.appendChild(nodeLabEl);
    nodeLabelRow.appendChild(nodeCountWrap);
    const nodeInputWrap = document.createElement("div");
    nodeInputWrap.className = "input-wrap";
    const nodeLead = document.createElement("span");
    nodeLead.className = "input-wrap-lead";
    nodeLead.innerHTML =
        '<svg class="lead" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/><path d="M9 21h6M12 3v18"/></svg>';
    const nodeIn = document.createElement("input");
    nodeIn.type = "text";
    nodeIn.id = "dsa-node-only";
    nodeIn.className = "dsa-field-control field-input";
    nodeIn.placeholder = "e.g. Sliding Window";
    nodeIn.autocomplete = "off";
    nodeIn.maxLength = 60;
    nodeInputWrap.appendChild(nodeLead);
    nodeInputWrap.appendChild(nodeIn);
    nodeBlock.appendChild(nodeLabelRow);
    nodeBlock.appendChild(nodeInputWrap);
    if (isMetaRoot && addingNewItem) {
        const metaNote = document.createElement("p");
        metaNote.className = "dsa-dialog-note dsa-meta-root-add-note";
        metaNote.textContent =
            "DSA Patterns only lists data-structure topics. Add a problem under a topic (e.g. Arrays), not on this root.";
        nodeBlock.appendChild(metaNote);
    }

    function syncNodeCategoryNameLabel() {
        if (!nodeLabelText) {
            return;
        }
        if (isRenameNode) {
            nodeLabelText.textContent = "Name";
            return;
        }
        let slug = "TOPIC";
        if (useMindTypePicker2 && mindTypeFs && !mindTypeFs.hidden) {
            const mk = dlg.querySelector('input[name="graphMindKind"]:checked');
            slug = mk ? String(mk.value).toUpperCase() : "TOPIC";
        }
        const cat = graphNodeCategoryLabelForSlug(slug, mindCatsPre);
        nodeLabelText.textContent = `${cat} Name`;
    }

    const qBlock = document.createElement("div");
    qBlock.className = "dsa-u-question";
    const problemOuter = document.createElement("div");
    problemOuter.className = "problem-collapsible";

    const nameField = document.createElement("div");
    nameField.className = "dsa-q-field q-field-mock field-group";
    const nameLabelRow = document.createElement("div");
    nameLabelRow.className = "field-label";
    const nameLabEl = document.createElement("label");
    nameLabEl.setAttribute("for", "nodeName");
    const nameLabelSpan = document.createElement("span");
    nameLabelSpan.id = "nameLabel";
    nameLabelSpan.appendChild(document.createTextNode("Problem Name"));
    const nameReqStar = document.createElement("span");
    nameReqStar.className = "dsa-req";
    nameReqStar.setAttribute("aria-hidden", "true");
    nameReqStar.textContent = "*";
    nameLabelSpan.appendChild(nameReqStar);
    nameLabEl.appendChild(nameLabelSpan);
    const nameCountWrap = document.createElement("span");
    nameCountWrap.className = "char-count";
    nameCountWrap.id = "nameCount";
    nameCountWrap.textContent = "0/60";
    nameLabelRow.appendChild(nameLabEl);
    nameLabelRow.appendChild(nameCountWrap);

    const nameInputWrap = document.createElement("div");
    nameInputWrap.className = "input-wrap";
    const nameLead = document.createElement("span");
    nameLead.className = "input-wrap-lead";
    nameLead.innerHTML =
        '<svg class="lead" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/><path d="M9 21h6M12 3v18"/></svg>';

    const nameIn = document.createElement("input");
    nameIn.type = "text";
    nameIn.id = "nodeName";
    nameIn.className = "dsa-field-control field-input";
    nameIn.placeholder = "e.g. Two Sum";
    nameIn.autocomplete = "off";
    nameIn.maxLength = 60;
    nameIn.readOnly = false;
    nameIn.setAttribute("aria-required", "true");
    nameInputWrap.appendChild(nameLead);
    nameInputWrap.appendChild(nameIn);
    nameField.appendChild(nameLabelRow);
    nameField.appendChild(nameInputWrap);
    if (isEditProblem) {
        nameField.classList.add("field", "dsa-q-name-field");
        nameLabelRow.className = "field-label dsa-q-name-label-row";
        nameLabelRow.innerHTML = "";
        const nameLabText = document.createElement("span");
        nameLabText.className = "dsa-q-name-label-text";
        nameLabText.appendChild(document.createTextNode("Problem Name "));
        const nameReqInline = document.createElement("span");
        nameReqInline.className = "req";
        nameReqInline.setAttribute("aria-hidden", "true");
        nameReqInline.textContent = "*";
        nameLabText.appendChild(nameReqInline);
        nameCountWrap.className = "char-count";
        nameCountWrap.id = "nameCount";
        nameLabelRow.appendChild(nameLabText);
        nameLabelRow.appendChild(nameCountWrap);
        if (nameLead.parentNode) {
            nameLead.remove();
        }
        nameInputWrap.className = "";
        nameIn.classList.add("input");
    }

    const urlField = document.createElement("div");
    urlField.className = "dsa-q-field q-field-mock field-group";
    const urlLabelRow = document.createElement("div");
    urlLabelRow.className = "field-label";
    const urlLabInner = document.createElement("span");
    urlLabInner.appendChild(document.createTextNode("Link "));
    const urlOpt = document.createElement("span");
    urlOpt.className = "opt";
    urlOpt.textContent = "(optional)";
    urlLabInner.appendChild(urlOpt);
    urlLabelRow.appendChild(urlLabInner);

    const urlInputWrap = document.createElement("div");
    urlInputWrap.className = "input-wrap";
    const urlLead = document.createElement("span");
    urlLead.className = "input-wrap-lead";
    urlLead.innerHTML =
        '<svg class="lead" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

    const urlIn = document.createElement("input");
    urlIn.type = "url";
    urlIn.id = "dsa-q-url";
    urlIn.className = "dsa-field-control field-input";
    urlIn.placeholder = "https://leetcode.com/...";
    urlIn.setAttribute("aria-label", "Problem link (optional)");
    urlIn.setAttribute("inputmode", "url");
    urlInputWrap.appendChild(urlLead);
    urlInputWrap.appendChild(urlIn);
    urlField.appendChild(urlLabelRow);
    urlField.appendChild(urlInputWrap);
    if (isEditProblem) {
        urlField.classList.add("field");
        urlLabelRow.innerHTML = "<span>Link</span>";
        if (urlLead.parentNode) {
            urlLead.remove();
        }
        urlIn.classList.add("input");
    }

    const problemSectionInner = document.createElement("div");
    problemSectionInner.id = "problemSection";
    problemSectionInner.className = "problem-section";

    const existingCard = document.createElement("div");
    existingCard.className = "dsa-q-existing q-existing-mock";
    existingCard.id = "existingPreview";
    existingCard.hidden = true;
    existingCard.setAttribute("aria-live", "polite");

    function appendSvgPaths(svg, svgPaths) {
        svgPaths.forEach((d) => {
            const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
            p.setAttribute("d", d);
            p.setAttribute("stroke", "currentColor");
            p.setAttribute("stroke-width", "1.85");
            p.setAttribute("stroke-linecap", "round");
            p.setAttribute("stroke-linejoin", "round");
            p.setAttribute("fill", "none");
            svg.appendChild(p);
        });
    }

    function makeSectionIcon(svgPaths) {
        const wrap = document.createElement("span");
        wrap.className = "dsa-q-section-icon section-icon";
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "14");
        svg.setAttribute("height", "14");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("aria-hidden", "true");
        appendSvgPaths(svg, svgPaths);
        wrap.appendChild(svg);
        return wrap;
    }

    function makeSectionClearIconBtn(ariaLabel, titleText) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "dsa-q-section-clear-btn section-btn del";
        b.setAttribute("aria-label", ariaLabel);
        b.title = titleText;
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "13");
        svg.setAttribute("height", "13");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("aria-hidden", "true");
        svg.innerHTML =
            '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M10 11v6M14 11v6"/>';
        b.appendChild(svg);
        return b;
    }

    function makeSection(title, svgPaths, buildActions) {
        const sec = document.createElement("section");
        sec.className = "dsa-q-section section-card";
        const head = document.createElement("div");
        head.className = "dsa-q-section-head section-head";
        head.appendChild(makeSectionIcon(svgPaths));
        const h = document.createElement("h4");
        h.className = "dsa-q-section-title section-title";
        h.textContent = title;
        head.appendChild(h);
        const headActions = document.createElement("div");
        headActions.className = "dsa-q-section-head-actions section-actions";
        if (typeof buildActions === "function") {
            buildActions(headActions);
        }
        head.appendChild(headActions);
        const body = document.createElement("div");
        body.className = "dsa-q-section-body section-body";
        sec.appendChild(head);
        sec.appendChild(body);
        return { sec, head, body, headActions };
    }

    const hintTa = document.createElement("textarea");
    hintTa.className = "plain-textarea dsa-q-hint dsa-q-hint-note-ta";
    hintTa.rows = 4;
    hintTa.placeholder = "Hint / notes (admin: shown behind ? on the problem row)";
    hintTa.setAttribute("aria-label", "Hint / notes");

    const hintFieldGroup = document.createElement("div");
    hintFieldGroup.className = "field field-group dsa-q-hint-field-group";
    const hintTopLabel = document.createElement("div");
    hintTopLabel.className = "field-label";
    hintTopLabel.innerHTML = "<span>Hint / Notes <span class=\"opt\">(optional)</span></span>";
    hintTopLabel.innerHTML = isEditProblem
        ? "<span>Hint / Notes</span>"
        : "<span>Hint / Notes <span class=\"opt\">(optional)</span></span>";
    hintTa.className = "textarea plain-textarea dsa-q-hint dsa-q-hint-note-ta";
    hintTa.placeholder = isEditProblem
        ? "Write a short hint or notes for yourself…"
        : "Write a short hint or notes for yourself…";
    hintFieldGroup.appendChild(hintTopLabel);
    hintFieldGroup.appendChild(hintTa);

    const sketchEditorRoot = document.createElement("div");

    const sketchIntro = document.createElement("div");
    sketchIntro.className = "dsa-q-resource-intro dsa-q-sketch-intro";
    const sketchIntroBody = document.createElement("p");
    sketchIntroBody.className = "dsa-q-resource-intro-body";
    sketchIntroBody.textContent =
        "Draw trees, graphs, or pointers on a scratch pad attached to this problem. Use it to capture how you think through the solution before you code—helpful when revisiting problems or comparing approaches later.";
    sketchIntro.appendChild(sketchIntroBody);

    const sketchPanel = document.createElement("div");
    sketchPanel.className = "dsa-q-sketch-panel";
    sketchPanel.hidden = true;
    sketchPanel.appendChild(sketchEditorRoot);

    const fileIn = document.createElement("input");
    fileIn.type = "file";
    fileIn.accept = "image/*";
    fileIn.hidden = true;
    fileIn.setAttribute("aria-hidden", "true");

    const imagePreview = document.createElement("div");
    imagePreview.className = "dsa-q-image-preview";

    const imageUploadRow = document.createElement("div");
    imageUploadRow.className = "dsa-q-image-upload-row";

    let scratchApi = dsaStubSketchApi();
    let sketchEditorWired = false;

    function snapshotSketchExport() {
        if (!sketchEditorWired) {
            return "";
        }
        try {
            if (typeof scratchApi.flushForPersist === "function") {
                scratchApi.flushForPersist();
            }
            const hasInk = typeof scratchApi.getHasInk === "function" && scratchApi.getHasInk();
            if (!hasInk) {
                if (userClearedSketch) {
                    lastSketchExport = "";
                }
                return "";
            }
            userClearedSketch = false;
            const url =
                typeof scratchApi.toPersistedSketchDataUrl === "function"
                    ? scratchApi.toPersistedSketchDataUrl()
                    : typeof scratchApi.toDataUrl === "function"
                      ? scratchApi.toDataUrl()
                      : "";
            if (url && /^data:image\//i.test(url)) {
                lastSketchExport = url;
                return url;
            }
        } catch (err) {
            console.warn("DSA: sketch snapshot failed", err);
        }
        return lastSketchExport && !userClearedSketch ? lastSketchExport : "";
    }

    /** JPEG data URL for problem save — always wires editor if the sketch panel was used. */
    function collectSketchDrawingPayload(lookupNameOverride) {
        ensureSketchEditor();
        let drawingPayload = "";
        let hasInk = false;
        if (sketchEditorWired) {
            try {
                if (typeof scratchApi.resize === "function") {
                    scratchApi.resize();
                }
                drawingPayload = snapshotSketchExport();
                hasInk = typeof scratchApi.getHasInk === "function" && scratchApi.getHasInk();
                if (!drawingPayload && hasInk && lastSketchExport && !userClearedSketch) {
                    drawingPayload = lastSketchExport;
                }
                if (!hasInk && userClearedSketch) {
                    return "";
                }
            } catch (err) {
                console.warn("DSA: sketch export failed", err);
            }
        } else if (userClearedSketch) {
            return "";
        }
        const lookupName =
            lookupNameOverride != null && String(lookupNameOverride).trim()
                ? String(lookupNameOverride).trim()
                : isEditProblem && editQuestionName
                  ? editQuestionName
                  : nameIn.value.trim();
        if (!drawingPayload && !userClearedSketch && !hasInk && lookupName) {
            const entKeep = dsaResolveQuestionForModal(parentKey, lookupName, editUserNodeId);
            if (entKeep && String(entKeep.drawing || "").trim()) {
                drawingPayload = String(entKeep.drawing);
            }
        }
        return drawingPayload;
    }

    /** Save sketch only (JPEG) — optional hook; problem Save uses collectSketchDrawingPayload. */
    function persistSketchDrawingQuick() {
        if (!isAdmin) {
            return;
        }
        const name = nameIn.value.trim();
        if (!name || parentKey === "__DSA_META__") {
            return;
        }
        const drawingPayload = collectSketchDrawingPayload();
        const lookupName = isEditProblem && editQuestionName ? editQuestionName : name;
        const entForId = dsaResolveQuestionForModal(parentKey, lookupName, editUserNodeId);
        const persistId =
            (editUserNodeId && String(editUserNodeId).trim()) ||
            (entForId && entForId.id ? String(entForId.id).trim() : "");
        const solPayload = solutionsState
            .map((s) => dsaNormalizeSolutionItem(s))
            .filter(
                (s) =>
                    s &&
                    (String(s.code || "").trim() ||
                        s.timeComplexity ||
                        s.spaceComplexity ||
                        dsaNormalizeSolutionCategory(s.approach)),
            );
        const firstCode = solPayload.find((s) => String(s.code || "").trim());
        const upsertPayload = {
            id: persistId || undefined,
            parentKey,
            name,
            url: urlIn.value.trim(),
            comment: "",
            hint: hintTa.value,
            code: firstCode ? String(firstCode.code) : "",
            solutions: solPayload,
            drawing: drawingPayload,
            image: imageDataUrl,
            companies: dsaNormalizeCompaniesArray(companyTagsList),
            solutionVideoUrl: solutionVideoIn.value.trim(),
            solutionTimeComplexity: "",
            solutionSpaceComplexity: "",
            solutionCategory: "",
            starred: importantInput.checked === true,
            done: !!(entForId && entForId.done),
            difficulty: dsaNormalizeProblemDifficulty(difficultySelect.value),
            nodeCategorySlug: "PROBLEM",
        };
        if (graphBodyCats.length && graphBodyCatSelect && !graphBodyCatFs.hidden) {
            upsertPayload.graphCategoryId = graphBodyCatSelect.value.trim();
        }
        dsaUpsertUserQuestionNode(upsertPayload);
        userClearedSketch = false;
        void dsaFlushDsaCmsSync();
    }

    function ensureSketchEditor() {
        if (sketchEditorWired) {
            return;
        }
        sketchEditorWired = true;
        scratchApi = dsaWireSketchEditor(sketchEditorRoot, snapshotSketchExport, {
            embedInDialog: true,
            afterClear() {
                userClearedSketch = true;
                lastSketchExport = "";
            },
            admin: isAdmin,
            onPersist: persistSketchDrawingQuick,
        });
    }

    const sketchSlot = document.createElement("div");
    sketchSlot.id = "sketchSlot";
    sketchSlot.className = "dsa-q-sketch-slot";

    const sketchEmptySlot = dsaCreateMediaSlot({
        title: "Add sketch",
        sub: "Open the sketch studio to draw a diagram",
        svgInner:
            '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
        onActivate: () => {
            if (isAdmin) {
                openSketchPanel();
            }
        },
    });

    function syncSketchSlotUi() {
        sketchEmptySlot.hidden = !sketchPanel.hidden;
    }

    function openSketchPanel() {
        sketchIntro.hidden = true;
        if (btnSketchInfo) {
            btnSketchInfo.classList.remove("active");
            btnSketchInfo.setAttribute("aria-expanded", "false");
        }
        sketchPanel.hidden = false;
        if (sketchAddRow) {
            sketchAddRow.hidden = true;
        }
        syncSketchSlotUi();
        requestAnimationFrame(() => {
            ensureSketchEditor();
            requestAnimationFrame(() => {
                if (typeof scratchApi.resize === "function") {
                    scratchApi.resize();
                }
                sketchPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
            });
        });
    }

    function loadSketchDrawingIntoEditor(drawingUrl) {
        const url = drawingUrl != null ? String(drawingUrl).trim() : "";
        if (!url) {
            if (sketchEditorWired && typeof scratchApi.clear === "function") {
                const hasInk = typeof scratchApi.getHasInk === "function" && scratchApi.getHasInk();
                if (!hasInk) {
                    scratchApi.clear();
                    lastSketchExport = "";
                }
            }
            return;
        }
        openSketchPanel();
        const applyLoad = () => {
            ensureSketchEditor();
            if (typeof scratchApi.prepareForSavedLoad === "function") {
                scratchApi.prepareForSavedLoad();
            }
            if (typeof scratchApi.loadDataUrl === "function") {
                scratchApi.loadDataUrl(url);
            }
            if (typeof scratchApi.resize === "function") {
                scratchApi.resize();
            }
        };
        requestAnimationFrame(() => {
            requestAnimationFrame(applyLoad);
        });
        setTimeout(applyLoad, 150);
    }

    function syncSketchUiFromEntry(ent) {
        const hasDrawing = !!(ent && ent.drawing && String(ent.drawing).trim());
        if (hasDrawing) {
            openSketchPanel();
        } else if (!sketchEditorWired) {
            sketchIntro.hidden = true;
            if (btnSketchInfo) {
                btnSketchInfo.classList.remove("active");
                btnSketchInfo.setAttribute("aria-expanded", "false");
            }
            sketchPanel.hidden = true;
            if (sketchAddRow) {
                sketchAddRow.hidden = true;
            }
            syncSketchSlotUi();
        }
    }

    let imageDataUrl = "";

    const imageSlot = document.createElement("div");
    imageSlot.id = "imageSlot";
    imageSlot.className = "dsa-q-image-slot";

    function renderImageSlotUi() {
        imageSlot.innerHTML = "";
        if (!imageDataUrl) {
            const empty = dsaCreateMediaSlot({
                title: "Upload or paste image",
                sub: "Drag, click to choose, or press ⌘+V",
                svgInner:
                    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="1.6"/><path d="M21 15l-5-5L5 21"/>',
                onActivate: () => {
                    if (isAdmin) {
                        fileIn.click();
                    }
                },
            });
            imageSlot.appendChild(empty);
            return;
        }
        const wrap = document.createElement("div");
        wrap.className = "media-attached dsa-q-image-preview-wrap";
        const im = document.createElement("img");
        im.src = imageDataUrl;
        im.alt = "Attached";
        im.className = "dsa-q-image-thumb";
        wrap.appendChild(im);
        if (isAdmin) {
            const rm = document.createElement("button");
            rm.type = "button";
            rm.className = "media-clear dsa-q-image-remove-on-thumb";
            rm.setAttribute("aria-label", "Remove image");
            rm.title = "Remove image";
            rm.innerHTML =
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';
            rm.addEventListener("click", (e) => {
                e.stopPropagation();
                setImagePreview("");
            });
            wrap.appendChild(rm);
        }
        imageSlot.appendChild(wrap);
    }

    function setImagePreview(url) {
        imageDataUrl = url || "";
        renderImageSlotUi();
    }

    function applyImageFileFromPaste(file) {
        if (!file || !file.type || !file.type.startsWith("image/")) {
            return false;
        }
        dsaCompressImageToDataUrl(file, 1280, 0.82, (data) => {
            if (data) {
                setImagePreview(data);
            }
        });
        return true;
    }

    const solutionVideoIn = document.createElement("input");
    solutionVideoIn.type = "url";
    solutionVideoIn.id = "dsa-q-solution-video";
    solutionVideoIn.className = "dsa-field-control field-input";
    solutionVideoIn.placeholder = "https://www.youtube.com/watch?v=… or youtu.be/…";
    solutionVideoIn.setAttribute("aria-label", "Video solution URL");

    let solutionsState = [];
    let solutionsListExpanded = false;
    const solutionsContainer = document.createElement("div");
    solutionsContainer.id = "solutionsContainer";
    solutionsContainer.className = "dsa-q-solutions-container";
    const solutionListRoot = document.createElement("div");
    solutionListRoot.className = "dsa-q-solution-list";
    solutionListRoot.setAttribute("aria-live", "polite");

    const solutionSheet = dsaCreateSolutionSheetPro({
        isAdmin,
        normalizeApproach: dsaNormalizeSolutionCategory,
        onSave(data) {
            const item = {
                id:
                    data.editIndex != null && data.editIndex >= 0
                        ? solutionsState[data.editIndex].id
                        : dsaNewSolutionId(),
                approach: data.approach,
                timeComplexity: data.timeComplexity,
                spaceComplexity: data.spaceComplexity,
                code: data.code,
            };
            if (data.editIndex != null && data.editIndex >= 0) {
                solutionsState[data.editIndex] = item;
            } else {
                solutionsState.push(item);
            }
            renderSolutionsEditorList();
        },
    });
    const sheetBackdrop = solutionSheet.backdrop;

    function closeSolutionSheet() {
        solutionSheet.close();
    }

    function openSolutionSheet(editIndex) {
        const sol = editIndex != null && editIndex >= 0 ? solutionsState[editIndex] : null;
        solutionSheet.open(editIndex, sol);
    }

    function renderSolutionsEditorList() {
        solutionsContainer.innerHTML = "";
        if (solCountEl) {
            solCountEl.textContent = solutionsState.length ? `${solutionsState.length} added` : "";
        }

        if (!solutionsState.length) {
            solutionsListExpanded = false;
            const empty = dsaCreateMediaSlot({
                title: "Add solution",
                sub: "Brute force, Better, or Optimal — with code & complexity",
                svgInner:
                    '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><line x1="14" y1="4" x2="10" y2="20"/>',
                onActivate: () => {
                    if (isAdmin) {
                        openSolutionSheet(null);
                    }
                },
            });
            solutionsContainer.appendChild(empty);
            return;
        }

        const delTrashSvg =
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>';
        const editSvg =
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 113 3L7 19l-4 1 1-4z"/></svg>';

        solutionListRoot.innerHTML = "";
        solutionsContainer.appendChild(solutionListRoot);

        function appendCard(origIdx) {
            const sol = solutionsState[origIdx];
            const cat = dsaNormalizeSolutionCategory(sol.approach);
            const solTagCls = cat === "brute_force" ? "brute" : cat;

            const card = document.createElement("div");
            card.className = "dsa-q-solution-item solution-item";

            const tag = document.createElement("span");
            tag.className = `sol-tag ${solTagCls || "sol-tag--unknown"}`;
            tag.textContent = dsaSolutionCategoryLabel(cat) || "Approach";

            const meta = document.createElement("div");
            meta.className = "sol-meta sol-info";
            const tc = document.createElement("span");
            tc.className = "sol-cx";
            tc.textContent = String(sol.timeComplexity || "").trim() || "—";
            const sc = document.createElement("span");
            sc.className = "sol-cx";
            sc.textContent = String(sol.spaceComplexity || "").trim() || "—";
            meta.appendChild(tc);
            meta.appendChild(sc);

            card.appendChild(tag);
            card.appendChild(meta);

            if (isAdmin) {
                const actions = document.createElement("div");
                actions.className = "sol-actions";
                const btnEdit = document.createElement("button");
                btnEdit.type = "button";
                btnEdit.className = "icon-btn dsa-q-solution-edit";
                btnEdit.setAttribute("aria-label", "Edit solution");
                btnEdit.title = "Edit";
                btnEdit.innerHTML = editSvg;
                btnEdit.addEventListener("click", () => openSolutionSheet(origIdx));

                const btnDel = document.createElement("button");
                btnDel.type = "button";
                btnDel.className = "icon-btn";
                btnDel.setAttribute("aria-label", "Remove solution");
                btnDel.title = "Remove";
                btnDel.innerHTML = delTrashSvg;
                btnDel.addEventListener("click", () => {
                    if (!window.confirm("Remove this solution?")) {
                        return;
                    }
                    solutionsState.splice(origIdx, 1);
                    if (solutionsState.length <= 1) {
                        solutionsListExpanded = false;
                    }
                    renderSolutionsEditorList();
                });
                actions.appendChild(btnEdit);
                actions.appendChild(btnDel);
                card.appendChild(actions);
            }
            solutionListRoot.appendChild(card);
        }

        const orderIdx = dsaSortedSolutionIndicesForDisplay(solutionsState);
        const n = orderIdx.length;
        const limit = n > 1 && !solutionsListExpanded ? 1 : n;
        for (let i = 0; i < limit; i++) {
            appendCard(orderIdx[i]);
        }

        if (n > 1) {
            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "show-all-toggle dsa-q-solution-expand-toggle";
            toggle.setAttribute("aria-expanded", solutionsListExpanded ? "true" : "false");
            toggle.textContent = solutionsListExpanded ? "Show less" : `Show all ${n} solutions`;
            toggle.addEventListener("click", () => {
                solutionsListExpanded = !solutionsListExpanded;
                renderSolutionsEditorList();
            });
            solutionsContainer.appendChild(toggle);
        }

        if (isAdmin) {
            const addMore = document.createElement("button");
            addMore.type = "button";
            addMore.className = "add-more-btn";
            addMore.innerHTML =
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg> Add solution';
            addMore.addEventListener("click", () => openSolutionSheet(null));
            solutionsContainer.appendChild(addMore);
        }
    }

    const solutionsResGroup = document.createElement("div");
    solutionsResGroup.className = "field-group";
    const solResLab = document.createElement("div");
    solResLab.className = "field-label";
    const solResLabSpan = document.createElement("span");
    solResLabSpan.textContent = "Solutions";
    const solCountEl = document.createElement("span");
    solCountEl.className = "char-count";
    solCountEl.id = "solCount";
    solResLab.appendChild(solResLabSpan);
    solResLab.appendChild(solCountEl);
    const btnAddSolutionLink = document.createElement("button");
    btnAddSolutionLink.type = "button";
    btnAddSolutionLink.className = "res-add-btn";
    btnAddSolutionLink.setAttribute("aria-label", "Add solutions or code snippet");
    btnAddSolutionLink.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add solutions / Code snippet';
    btnAddSolutionLink.addEventListener("click", () => openSolutionSheet(null));
    const solutionsIntro = document.createElement("div");
    solutionsIntro.className = "dsa-q-resource-intro dsa-q-solutions-intro";
    const solutionsIntroBody = document.createElement("p");
    solutionsIntroBody.className = "dsa-q-resource-intro-body";
    solutionsIntroBody.textContent =
        "Add one or more solutions with approach (brute force, better, optimal), code snippets, and time/space complexity—so you can compare approaches when you revisit this problem.";
    solutionsIntro.appendChild(solutionsIntroBody);
    const { row: solutionsAddRow, infoBtn: btnSolutionsInfo } = dsaCreateResAddRow(btnAddSolutionLink);
    dsaWireResAddIntroToggle(solutionsIntro, btnSolutionsInfo);

    solutionsResGroup.appendChild(solResLab);
    solutionsResGroup.appendChild(solutionsIntro);
    solutionsResGroup.appendChild(solutionsContainer);
    renderSolutionsEditorList();

    let companyTagsList = [];

    function renderCompanyPicker() {
        if (companyApi) {
            companyApi.setSelected(companyTagsList);
        }
    }

    const companyFieldGroup = document.createElement("div");
    companyFieldGroup.className = "field field-group dsa-q-company-field-group";
    const companyLabRow = document.createElement("div");
    companyLabRow.className = "field-label";
    companyLabRow.innerHTML = isEditProblem
        ? "<span>Companies</span>"
        : "<span>Companies <span class=\"opt\">(optional)</span></span>";
    const btnCompanyInfo = null;
    const companyMount = document.createElement("div");
    companyMount.className = "dsa-q-company-selector-mount";
    let companyApi = null;
    if (typeof dsaMountCompanySelector === "function") {
        companyApi = dsaMountCompanySelector(companyMount, {
            presets: DSA_COMPANY_PRESETS,
            layout: "compact",
            onChange(names) {
                companyTagsList = names.slice();
            },
        });
    }
    companyFieldGroup.appendChild(companyLabRow);
    companyFieldGroup.appendChild(companyMount);
    renderCompanyPicker();

    const sketchResGroup = document.createElement("div");
    sketchResGroup.className = "field-group";
    const sketchResLab = document.createElement("div");
    sketchResLab.className = "field-label";
    sketchResLab.textContent = "Sketch / Diagram";
    const btnAddSketch = document.createElement("button");
    btnAddSketch.type = "button";
    btnAddSketch.className = "res-add-btn";
    btnAddSketch.setAttribute("aria-label", "Add sketch");
    btnAddSketch.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Add sketch';
    btnAddSketch.addEventListener("click", () => {
        openSketchPanel();
    });
    const { row: sketchAddRow, infoBtn: btnSketchInfo } = dsaCreateResAddRow(btnAddSketch);
    dsaWireResAddIntroToggle(sketchIntro, btnSketchInfo);
    sketchSlot.appendChild(sketchEmptySlot);
    sketchSlot.appendChild(sketchPanel);
    syncSketchSlotUi();
    sketchResGroup.appendChild(sketchResLab);
    sketchResGroup.appendChild(sketchIntro);
    sketchResGroup.appendChild(sketchSlot);

    const imageResGroup = document.createElement("div");
    imageResGroup.className = "field-group";
    const imageResLab = document.createElement("div");
    imageResLab.className = "field-label";
    imageResLab.innerHTML = "<span>Image (upload or paste)</span>";
    const btnUploadImage = document.createElement("button");
    btnUploadImage.type = "button";
    btnUploadImage.className = "res-add-btn";
    btnUploadImage.setAttribute("aria-label", "Upload image");
    btnUploadImage.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Upload image';
    btnUploadImage.addEventListener("click", () => {
        if (isAdmin) {
            fileIn.click();
        }
    });
    const imagePasteHint = document.createElement("div");
    imagePasteHint.className = "dsa-q-image-paste-hint";
    imagePasteHint.setAttribute("role", "note");
    imagePasteHint.setAttribute("aria-label", "Paste an image with the keyboard while this dialog is focused");
    imagePasteHint.innerHTML =
        '<kbd>Ctrl</kbd><span class="dsa-q-image-paste-hint__plus">+</span><kbd>V</kbd> <span class="dsa-q-image-paste-hint__for">for paste</span>';
    imageUploadRow.appendChild(btnUploadImage);
    imageUploadRow.appendChild(imagePasteHint);
    imageResGroup.appendChild(imageResLab);
    imageResGroup.appendChild(fileIn);
    imageResGroup.appendChild(imageSlot);
    renderImageSlotUi();

    const videoFieldGroup = document.createElement("div");
    videoFieldGroup.className = "field-group";
    const videoLabRow = document.createElement("div");
    videoLabRow.className = "field-label";
    videoLabRow.innerHTML = "<span>Video solution URL</span>";
    const videoInputWrap2 = document.createElement("div");
    videoInputWrap2.className = "input-wrap";
    const videoLead2 = document.createElement("span");
    videoLead2.className = "input-wrap-lead";
    videoLead2.innerHTML =
        '<svg class="lead" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor" stroke="none"/></svg>';
    videoInputWrap2.appendChild(videoLead2);
    videoInputWrap2.appendChild(solutionVideoIn);
    videoFieldGroup.appendChild(videoLabRow);
    videoFieldGroup.appendChild(videoInputWrap2);

    const headerTabsRow = document.createElement("div");
    headerTabsRow.id = "tabs";
    headerTabsRow.className = "tabs";
    headerTabsRow.setAttribute("role", "tablist");
    headerTabsRow.setAttribute("aria-label", "Problem sections");
    headerTabsRow.setAttribute("aria-hidden", "true");
    const tabPanelsWrap = document.createElement("div");
    tabPanelsWrap.className = "dsa-q-tabs-shell dsa-q-tabs-shell--below-heading q-tab-shell-mock";
    const btnTabDetails = document.createElement("button");
    btnTabDetails.type = "button";
    btnTabDetails.className = "tab active dsa-q-tab dsa-q-tab--active";
    btnTabDetails.setAttribute("role", "tab");
    btnTabDetails.setAttribute("tabindex", "0");
    btnTabDetails.setAttribute("data-tab", "details");
    btnTabDetails.setAttribute("aria-selected", "true");
    btnTabDetails.id = "dsa-q-tab-details";
    btnTabDetails.textContent = "Details";
    const btnTabResources = document.createElement("button");
    btnTabResources.type = "button";
    btnTabResources.className = "tab dsa-q-tab";
    btnTabResources.setAttribute("role", "tab");
    btnTabResources.setAttribute("tabindex", "0");
    btnTabResources.setAttribute("data-tab", "resources");
    btnTabResources.setAttribute("aria-selected", "false");
    btnTabResources.id = "dsa-q-tab-resources";
    btnTabResources.textContent = "Resources";
    const detailsPanel = document.createElement("div");
    detailsPanel.className = "details-section dsa-q-tab-panel tab-pane active";
    detailsPanel.setAttribute("role", "tabpanel");
    detailsPanel.id = "detailsSection";
    detailsPanel.setAttribute("aria-labelledby", "dsa-q-tab-details");
    const resourcesPanel = document.createElement("div");
    resourcesPanel.className = "res-section dsa-q-tab-panel tab-pane";
    resourcesPanel.id = "resSection";
    resourcesPanel.setAttribute("role", "tabpanel");
    resourcesPanel.setAttribute("aria-labelledby", "dsa-q-tab-resources");
    function activateDsaProblemTab(which) {
        const det = which === "details";
        btnTabDetails.classList.toggle("dsa-q-tab--active", det);
        btnTabResources.classList.toggle("dsa-q-tab--active", !det);
        btnTabDetails.classList.toggle("active", det);
        btnTabResources.classList.toggle("active", !det);
        btnTabDetails.setAttribute("aria-selected", det ? "true" : "false");
        btnTabResources.setAttribute("aria-selected", !det ? "true" : "false");
        detailsPanel.classList.toggle("active", det);
        resourcesPanel.classList.toggle("active", !det);
    }
    function onTabActivate(el, which) {
        el.addEventListener("click", () => activateDsaProblemTab(which));
        el.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                activateDsaProblemTab(which);
            }
        });
    }
    onTabActivate(btnTabDetails, "details");
    onTabActivate(btnTabResources, "resources");

    headerTabsRow.appendChild(btnTabDetails);
    headerTabsRow.appendChild(btnTabResources);
    tabPanelsWrap.appendChild(headerTabsRow);
    tabPanelsWrap.appendChild(detailsPanel);
    tabPanelsWrap.appendChild(resourcesPanel);

    if (isEditProblem) {
        nodeBlock.hidden = true;
        qBlock.hidden = false;
        headerTabsRow.classList.add("show");
        headerTabsRow.setAttribute("aria-hidden", "false");
    }

    const difficultyField = document.createElement("div");
    difficultyField.className = "dsa-q-field q-field-mock q-diff-field-mock field-group";
    const diffLabRow = document.createElement("div");
    diffLabRow.className = "field-label";
    const diffLabInner = document.createElement("span");
    diffLabInner.appendChild(document.createTextNode("Difficulty"));
    const diffReqStar = document.createElement("span");
    diffReqStar.className = "req";
    diffReqStar.setAttribute("aria-hidden", "true");
    diffReqStar.textContent = "*";
    diffLabInner.appendChild(diffReqStar);
    diffLabRow.appendChild(diffLabInner);
    const difficultyPillWrap = document.createElement("div");
    difficultyPillWrap.id = "diffPills";
    difficultyPillWrap.className = "difficulty-pills";
    const difficultySelectWrap = document.createElement("div");
    difficultySelectWrap.className = "dsa-q-difficulty-select-wrap";
    const difficultySelect = document.createElement("select");
    difficultySelect.id = "dsa-q-difficulty";
    difficultySelect.className = "dsa-q-difficulty-select";
    difficultySelect.required = true;
    difficultySelect.setAttribute("aria-required", "true");
    difficultySelect.setAttribute("aria-label", "Problem difficulty");
    [
        ["easy", "Easy"],
        ["medium", "Medium"],
        ["hard", "Hard"],
    ].forEach(([val, lab]) => {
        const o = document.createElement("option");
        o.value = val;
        o.textContent = lab;
        difficultySelect.appendChild(o);
    });
    difficultySelect.value = "medium";
    const diffPillDefs = [
        ["easy", "Easy", "easy"],
        ["medium", "Medium", "medium"],
        ["hard", "Hard", "hard"],
    ];
    diffPillDefs.forEach(([val, lab, cls]) => {
        const labEl = document.createElement("label");
        labEl.className = `diff-pill ${cls}`;
        labEl.dataset.diff = val;
        const inp = document.createElement("input");
        inp.type = "radio";
        inp.name = "difficulty";
        inp.value = val;
        if (difficultySelect.value === val) {
            labEl.classList.add("selected");
            inp.checked = true;
        }
        labEl.appendChild(inp);
        const dot = document.createElement("span");
        dot.className = "dot";
        labEl.appendChild(dot);
        labEl.appendChild(document.createTextNode(lab));
        difficultyPillWrap.appendChild(labEl);
    });
    difficultyPillWrap.addEventListener("change", (e) => {
        const t = e.target;
        if (!t || t.name !== "difficulty") {
            return;
        }
        difficultySelect.value = t.value;
        difficultyPillWrap.querySelectorAll(".diff-pill").forEach((labEl) => {
            const r = labEl.querySelector('input[name="difficulty"]');
            labEl.classList.toggle("selected", !!(r && r.checked));
        });
        difficultySelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    difficultySelect.classList.add("sr-diff-select");
    difficultySelectWrap.appendChild(difficultySelect);
    difficultyField.appendChild(diffLabRow);
    difficultyField.appendChild(difficultyPillWrap);
    difficultyField.appendChild(difficultySelectWrap);

    function syncDifficultyPillsFromSelect() {
        const v = dsaNormalizeProblemDifficulty(difficultySelect.value);
        difficultyPillWrap.querySelectorAll(".diff-pill").forEach((labEl) => {
            const r = labEl.querySelector('input[name="difficulty"]');
            const on = r && r.value === v;
            labEl.classList.toggle("selected", on);
            if (r) {
                r.checked = on;
            }
        });
    }

    const importantWrap = document.createElement("label");
    importantWrap.id = "starRow";
    importantWrap.className = "star-row";
    importantWrap.setAttribute("role", "button");
    importantWrap.tabIndex = 0;
    const importantInput = document.createElement("input");
    importantInput.type = "checkbox";
    importantInput.id = "dsa-q-important";
    importantInput.className = "dsa-q-important-input";
    importantInput.setAttribute("aria-label", "Mark as starred problem");
    const starIcon = document.createElement("div");
    starIcon.className = "star-icon";
    starIcon.innerHTML =
        '<svg class="star-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    const starText = document.createElement("div");
    starText.className = "star-text";
    const starTitle = document.createElement("div");
    starTitle.className = "star-title";
    starTitle.textContent = "Mark as starred";
    const starSub = document.createElement("div");
    starSub.className = "star-sub";
    starSub.textContent = "Add to your favorites for quick access";
    starText.appendChild(starTitle);
    starText.appendChild(starSub);
    const starSwitch = document.createElement("div");
    starSwitch.className = "switch";
    starSwitch.setAttribute("aria-hidden", "true");
    importantWrap.appendChild(starIcon);
    importantWrap.appendChild(starText);
    importantWrap.appendChild(starSwitch);
    importantWrap.appendChild(importantInput);

    function syncStarVisual() {
        importantWrap.classList.toggle("active", importantInput.checked);
        importantWrap.setAttribute("aria-pressed", importantInput.checked ? "true" : "false");
    }

    importantWrap.addEventListener("click", (e) => {
        if (!isAdmin || importantInput.disabled) {
            return;
        }
        e.preventDefault();
        importantInput.checked = !importantInput.checked;
        importantInput.dispatchEvent(new Event("change", { bubbles: true }));
        syncStarVisual();
    });
    importantWrap.addEventListener("keydown", (e) => {
        if (!isAdmin || importantInput.disabled) {
            return;
        }
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            importantInput.checked = !importantInput.checked;
            importantInput.dispatchEvent(new Event("change", { bubbles: true }));
            syncStarVisual();
        }
    });
    importantInput.addEventListener("change", syncStarVisual);

    const starFieldGroup = document.createElement("div");
    starFieldGroup.className = "field-group dsa-q-star-field-group";
    starFieldGroup.appendChild(importantWrap);

    problemSectionInner.appendChild(urlField);
    problemSectionInner.appendChild(difficultyField);
    problemSectionInner.appendChild(starFieldGroup);
    problemSectionInner.appendChild(hintFieldGroup);
    problemSectionInner.appendChild(companyFieldGroup);

    detailsPanel.appendChild(nameField);
    detailsPanel.appendChild(problemSectionInner);
    const savedDivider = document.createElement("div");
    savedDivider.className = "section-divider";
    savedDivider.innerHTML = "<span>Saved details</span>";
    savedDivider.hidden = true;
    detailsPanel.appendChild(savedDivider);
    detailsPanel.appendChild(existingCard);
    resourcesPanel.appendChild(videoFieldGroup);
    resourcesPanel.appendChild(solutionsResGroup);
    resourcesPanel.appendChild(sketchResGroup);
    resourcesPanel.appendChild(imageResGroup);

    qBlock.appendChild(tabPanelsWrap);
    problemOuter.appendChild(qBlock);

    function renderExistingCard(ent) {
        existingCard.innerHTML = "";
        if (!ent) {
            existingCard.hidden = true;
            if (savedDivider) {
                savedDivider.hidden = true;
            }
            return;
        }
        const solsPrev = dsaSolutionsFromEntry(ent);
        const has =
            dsaMergeHintCommentFromEntry(ent) ||
            solsPrev.length > 0 ||
            (ent.code && String(ent.code).trim()) ||
            (ent.solutionVideoUrl && String(ent.solutionVideoUrl).trim()) ||
            (ent.solutionTimeComplexity && String(ent.solutionTimeComplexity).trim()) ||
            dsaNormalizeSolutionCategory(ent && ent.solutionCategory) ||
            ent.starred === true ||
            (Array.isArray(ent.companies) && ent.companies.length > 0) ||
            (ent.drawing && String(ent.drawing).trim()) ||
            (ent.image && String(ent.image).trim()) ||
            dsaProblemDifficultyLabel(ent.difficulty);
        if (!has) {
            existingCard.hidden = true;
            if (savedDivider) {
                savedDivider.hidden = true;
            }
            return;
        }
        existingCard.hidden = false;
        if (savedDivider) {
            savedDivider.hidden = false;
        }
        const head = document.createElement("div");
        head.className = "preview-header dsa-q-existing-head";
        head.innerHTML =
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg> Saved';
        existingCard.appendChild(head);
        const grid = document.createElement("div");
        grid.className = "dsa-q-existing-grid";
        const diffNorm = dsaNormalizeProblemDifficulty(ent.difficulty);
        const diffRow0 = document.createElement("div");
        diffRow0.className = "preview-row dsa-q-existing-block";
        const diffTag0 = document.createElement("div");
        diffTag0.className = "preview-label";
        diffTag0.textContent = "Difficulty";
        const diffVal0 = document.createElement("div");
        diffVal0.className = "preview-val dsa-q-existing-val";
        const diffPill = document.createElement("span");
        diffPill.className = `sol-tag ${diffNorm === "easy" ? "optimal" : diffNorm === "medium" ? "better" : "brute"}`;
        diffPill.textContent = dsaProblemDifficultyLabel(ent.difficulty);
        diffVal0.appendChild(diffPill);
        diffRow0.appendChild(diffTag0);
        diffRow0.appendChild(diffVal0);
        grid.appendChild(diffRow0);
        if (ent.starred === true) {
            const impRow = document.createElement("div");
            impRow.className = "preview-row dsa-q-existing-block";
            const impTag = document.createElement("div");
            impTag.className = "preview-label";
            impTag.textContent = "Starred";
            const impVal = document.createElement("div");
            impVal.className = "preview-val dsa-q-existing-val";
            impVal.textContent = "Yes ⭐️";
            impRow.appendChild(impTag);
            impRow.appendChild(impVal);
            grid.appendChild(impRow);
        }
        const addBlock = (tagText, content, className) => {
            const row = document.createElement("div");
            row.className = "preview-row dsa-q-existing-block";
            const tag = document.createElement("div");
            tag.className = "preview-label";
            tag.textContent = tagText;
            const el =
                className === "pre"
                    ? (() => {
                          const pre = document.createElement("pre");
                          pre.className = "dsa-q-existing-pre preview-val";
                          pre.textContent = content;
                          return pre;
                      })()
                    : (() => {
                          const block = document.createElement("div");
                          block.className = "preview-val";
                          block.textContent = content.length > 280 ? `${content.slice(0, 277)}…` : content;
                          return block;
                      })();
            row.appendChild(tag);
            row.appendChild(el);
            grid.appendChild(row);
        };
        const hi = dsaMergeHintCommentFromEntry(ent);
        if (hi) {
            addBlock("Hint", hi.length > 120 ? `${hi.slice(0, 117)}…` : hi, "quote");
        }
        const vid = ent.solutionVideoUrl && String(ent.solutionVideoUrl).trim();
        if (vid) {
            addBlock("Video", vid.length > 50 ? `${vid.slice(0, 47)}…` : vid, "quote");
        }
        const solsCard = dsaSolutionsFromEntry(ent);
        const solsWithMeta = solsCard.filter((sol) => {
            const stc = sol.timeComplexity && String(sol.timeComplexity).trim();
            const ssc = sol.spaceComplexity && String(sol.spaceComplexity).trim();
            const scatLab = dsaSolutionCategoryLabel(dsaNormalizeSolutionCategory(sol.approach));
            return !!(stc || ssc || scatLab);
        });
        if (solsWithMeta.length) {
            const row = document.createElement("div");
            row.className = "preview-row dsa-q-existing-block";
            const tag = document.createElement("div");
            tag.className = "preview-label";
            tag.textContent = "Solutions";
            const val = document.createElement("div");
            val.className = "preview-val dsa-q-existing-val";
            solsWithMeta.forEach((sol) => {
                const cat = dsaNormalizeSolutionCategory(sol.approach);
                const solTagCls = cat === "brute_force" ? "brute" : cat;
                const line = document.createElement("div");
                line.className = "dsa-q-existing-sol-line";
                const pill = document.createElement("span");
                pill.className = `sol-tag ${solTagCls || ""}`;
                pill.textContent = dsaSolutionCategoryLabel(cat) || "Approach";
                line.appendChild(pill);
                const stc = sol.timeComplexity && String(sol.timeComplexity).trim();
                const ssc = sol.spaceComplexity && String(sol.spaceComplexity).trim();
                if (stc) {
                    const tc = document.createElement("span");
                    tc.className = "sol-cx";
                    tc.textContent = stc;
                    line.appendChild(tc);
                }
                if (ssc) {
                    const sc = document.createElement("span");
                    sc.className = "sol-cx";
                    sc.textContent = ssc;
                    line.appendChild(sc);
                }
                val.appendChild(line);
            });
            row.appendChild(tag);
            row.appendChild(val);
            grid.appendChild(row);
        }
        const compsPreview = dsaNormalizeCompaniesArray(ent && ent.companies);
        if (compsPreview.length) {
            const row = document.createElement("div");
            row.className = "preview-row dsa-q-existing-block";
            const tag = document.createElement("div");
            tag.className = "preview-label";
            tag.textContent = "Companies";
            const val = document.createElement("div");
            val.className = "preview-val";
            compsPreview.forEach((c) => {
                const pill = document.createElement("span");
                pill.className = "co-tag";
                pill.style.marginRight = "3px";
                pill.textContent = c;
                val.appendChild(pill);
            });
            row.appendChild(tag);
            row.appendChild(val);
            grid.appendChild(row);
        }
        const drawingPreview = ent && ent.drawing ? String(ent.drawing).trim() : "";
        if (drawingPreview) {
            const row = document.createElement("div");
            row.className = "preview-row dsa-q-existing-block";
            const tag = document.createElement("div");
            tag.className = "preview-label";
            tag.textContent = "Sketch";
            const val = document.createElement("div");
            val.className = "preview-val dsa-q-existing-val";
            const fig = document.createElement("div");
            fig.className = "dsa-q-existing-thumb dsa-q-existing-thumb--sketch";
            const im = document.createElement("img");
            im.src = drawingPreview;
            im.alt = "Saved sketch";
            im.loading = "lazy";
            fig.appendChild(im);
            val.appendChild(fig);
            row.appendChild(tag);
            row.appendChild(val);
            grid.appendChild(row);
        }
        const imagePreview = ent && ent.image ? String(ent.image).trim() : "";
        if (imagePreview) {
            const row = document.createElement("div");
            row.className = "preview-row dsa-q-existing-block";
            const tag = document.createElement("div");
            tag.className = "preview-label";
            tag.textContent = "Image";
            const val = document.createElement("div");
            val.className = "preview-val dsa-q-existing-val";
            const fig = document.createElement("div");
            fig.className = "dsa-q-existing-thumb dsa-q-existing-thumb--image";
            const im = document.createElement("img");
            im.src = imagePreview;
            im.alt = "Saved image";
            im.loading = "lazy";
            fig.appendChild(im);
            val.appendChild(fig);
            row.appendChild(tag);
            row.appendChild(val);
            grid.appendChild(row);
        }
        existingCard.appendChild(grid);
    }

    function applyEntryToForm(ent) {
        solutionsListExpanded = false;
        if (ent) {
            hintTa.value = dsaMergeHintCommentFromEntry(ent);
            urlIn.value = ent.url != null ? String(ent.url).trim() : "";
            solutionVideoIn.value = ent.solutionVideoUrl != null ? String(ent.solutionVideoUrl).trim() : "";
            setImagePreview(ent.image && String(ent.image).trim() ? String(ent.image) : "");
            companyTagsList = dsaNormalizeCompaniesArray(ent.companies);
            solutionsState = dsaSolutionsFromEntry(ent).map((s) => ({ ...dsaNormalizeSolutionItem(s) }));
            difficultySelect.value = dsaNormalizeProblemDifficulty(ent.difficulty);
            importantInput.checked = !!(ent && ent.starred);
            renderSolutionsEditorList();
            renderCompanyPicker();
            syncDifficultyPillsFromSelect();
            syncStarVisual();
            syncSketchUiFromEntry(ent);
            if (ent.drawing && String(ent.drawing).trim()) {
                loadSketchDrawingIntoEditor(String(ent.drawing).trim());
                userClearedSketch = false;
                lastSketchExport = String(ent.drawing).trim();
            } else if (sketchEditorWired) {
                const hasInk = typeof scratchApi.getHasInk === "function" && scratchApi.getHasInk();
                if (!hasInk) {
                    scratchApi.clear();
                    lastSketchExport = "";
                }
                userClearedSketch = false;
            }
        }
        const docTitleEl = sketchEditorRoot.querySelector("#dsaSkDocTitle");
        if (docTitleEl) {
            docTitleEl.value = "Sketch";
        }
    }

    function syncNameToEntry() {
        const n = nameIn.value.trim();
        const ent = n
            ? dsaResolveQuestionForModal(parentKey, n, editUserNodeId)
            : null;
        const k = ent ? ent.id || `${parentKey}::${ent.name}` : "";
        if (k !== syncEntryKey) {
            syncEntryKey = k;
            if (!(sketchEditorWired && typeof scratchApi.getHasInk === "function" && scratchApi.getHasInk())) {
                userClearedSketch = false;
            }
        }
        renderExistingCard(ent);
        applyEntryToForm(ent);
    }

    let debounceTimer = 0;
    function clearFieldErrors() {
        nodeIn.classList.remove("dsa-field-control--error");
        nameIn.classList.remove("dsa-field-control--error");
        difficultySelect.classList.remove("dsa-field-control--error");
        if (graphBodyCatSelect) {
            graphBodyCatSelect.classList.remove("dsa-field-control--error");
        }
    }

    nameIn.addEventListener("input", () => {
        clearFieldErrors();
        if (nameCountWrap.id === "nameCount") {
            nameCountWrap.textContent = `${String(nameIn.value.length)}/60`;
        }
        if (isEditProblem) {
            return;
        }
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            debounceTimer = 0;
            syncNameToEntry();
        }, 220);
    });
    nodeIn.addEventListener("input", () => {
        clearFieldErrors();
        nodeCharSpan.textContent = String(nodeIn.value.length);
    });
    urlIn.addEventListener("input", () => {
        urlIn.classList.remove("dsa-field-control--error");
    });
    difficultySelect.addEventListener("change", () => {
        difficultySelect.classList.remove("dsa-field-control--error");
        syncDifficultyPillsFromSelect();
    });
    graphBodyCatSelect.addEventListener("change", () => {
        graphBodyCatSelect.classList.remove("dsa-field-control--error");
    });

    function syncProblemSectionShell() {
        problemOuter.classList.toggle("show", !qBlock.hidden && !isRenameNode);
    }

    function syncCategory() {
        if (isRenameNode) {
            nodeBlock.hidden = false;
            qBlock.hidden = true;
            headerTabsRow.classList.remove("show");
            headerTabsRow.setAttribute("aria-hidden", "true");
            syncGraphBodyCategoryFieldset();
            syncProblemSectionShell();
            refreshAddChildChrome();
            return;
        }
        if (useMindTypePicker2) {
            const mk = dlg.querySelector('input[name="graphMindKind"]:checked');
            const isProb = mk && mk.value === "PROBLEM";
            nodeBlock.hidden = isProb;
            qBlock.hidden = !isProb;
            if (isProb) {
                headerTabsRow.classList.add("show");
                headerTabsRow.setAttribute("aria-hidden", "false");
            } else {
                headerTabsRow.classList.remove("show");
                headerTabsRow.setAttribute("aria-hidden", "true");
            }
            syncGraphBodyCategoryFieldset();
            syncProblemSectionShell();
            refreshAddChildChrome();
            return;
        }
        const nodeMode = radN.checked;
        nodeBlock.hidden = !nodeMode;
        qBlock.hidden = nodeMode;
        if (nodeMode) {
            headerTabsRow.classList.remove("show");
            headerTabsRow.setAttribute("aria-hidden", "true");
        } else {
            headerTabsRow.classList.add("show");
            headerTabsRow.setAttribute("aria-hidden", "false");
        }
        syncGraphBodyCategoryFieldset();
        syncProblemSectionShell();
        refreshAddChildChrome();
    }
    radQ.addEventListener("change", syncCategory);
    radN.addEventListener("change", syncCategory);

    const btnHeaderClose = document.createElement("button");
    btnHeaderClose.type = "button";
    btnHeaderClose.className = "icon-btn close";
    btnHeaderClose.setAttribute("aria-label", "Close");
    btnHeaderClose.setAttribute("title", "Close");
    const svgX = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgX.setAttribute("width", "11");
    svgX.setAttribute("height", "11");
    svgX.setAttribute("viewBox", "0 0 12 12");
    svgX.setAttribute("fill", "none");
    svgX.setAttribute("aria-hidden", "true");
    const x1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    x1.setAttribute("d", "M1 1l10 10M11 1L1 11");
    x1.setAttribute("stroke", "currentColor");
    x1.setAttribute("stroke-width", "1.6");
    x1.setAttribute("stroke-linecap", "round");
    svgX.appendChild(x1);
    btnHeaderClose.appendChild(svgX);

    const btnFooterCancel = document.createElement("button");
    btnFooterCancel.type = "button";
    btnFooterCancel.className = "btn btn-secondary";
    btnFooterCancel.textContent = "Cancel";

    const btnOk = document.createElement("button");
    btnOk.type = "button";
    btnOk.id = "save";
    btnOk.className = "dsa-dialog-btn dsa-dialog-btn--primary btn btn-primary";
    btnOk.textContent = "Save";

    const footer = document.createElement("div");
    footer.className = "footer";
    const kbdHint = document.createElement("div");
    kbdHint.className = "kbd-hint";
    const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || "");
    kbdHint.innerHTML = isMac
        ? '<span class="kbd">⌘</span><span class="kbd">↵</span> save · <span class="kbd">Esc</span> close'
        : '<span class="kbd">Ctrl</span><span class="kbd">↵</span> save · <span class="kbd">Esc</span> close';
    const footerBtns = document.createElement("div");
    footerBtns.className = "footer-actions btn-row";
    footerBtns.appendChild(btnFooterCancel);
    footerBtns.appendChild(btnOk);
    footer.appendChild(kbdHint);
    footer.appendChild(footerBtns);

    const header = document.createElement("div");
    header.className = "header";
    const headerTitles = document.createElement("div");
    headerTitles.appendChild(title);
    headerTitles.appendChild(subtitleEl);
    const headerActions = document.createElement("div");
    headerActions.className = "header-actions";
    headerActions.appendChild(btnHeaderClose);
    header.appendChild(headerTitles);
    header.appendChild(headerActions);

    function setAdminDisabled() {
        const ro = !isAdmin;
        const addingNew = !editQuestionName && !editUserNodeId && !isRenameNode;
        const problemHidden = addingNew && isMetaRoot;
        radQ.disabled = ro || problemHidden;
        radN.disabled = ro;
        nodeIn.disabled = ro;
        nameIn.disabled = ro;
        urlIn.disabled = ro;
        difficultySelect.disabled = ro;
        importantInput.disabled = ro;
        hintTa.disabled = ro;
        solutionVideoIn.disabled = ro;
        if (graphBodyCatSelect) {
            graphBodyCatSelect.disabled = ro;
        }
        dlg.querySelectorAll('input[name="graphMindKind"]').forEach((inp) => {
            inp.disabled = ro;
        });
        difficultyPillWrap.querySelectorAll('input[name="difficulty"]').forEach((inp) => {
            inp.disabled = ro;
        });
        importantWrap.style.pointerEvents = ro ? "none" : "";
        importantWrap.setAttribute("aria-disabled", ro ? "true" : "false");
        btnAddSolutionLink.disabled = ro;
        btnAddSolutionLink.hidden = ro;
        btnAddSketch.disabled = ro;
        btnSketchInfo.disabled = ro;
        btnSolutionsInfo.disabled = ro;
        btnUploadImage.disabled = ro;
        if (companyApi) {
            companyApi.setDisabled(ro);
        }
        if (btnCompanyInfo) {
            btnCompanyInfo.disabled = ro;
        }
        sketchPanel.classList.toggle("dsa-q-sketch-panel--ro", ro);
        imagePasteHint.classList.toggle("dsa-q-image-paste-hint--disabled", ro);
        btnOk.hidden = ro;
        kbdHint.hidden = ro;
        dlg.querySelectorAll(".dsa-q-section-clear-btn").forEach((b) => {
            b.disabled = ro;
            b.hidden = ro;
        });
    }
    if (isRenameNode) {
        btnOk.textContent = "Save name";
        nodeIn.value =
            opts && opts.editNodeCurrentName != null ? String(opts.editNodeCurrentName) : "";
    }

    function close() {
        closeSolutionSheet();
        if (typeof scratchApi.destroy === "function") {
            scratchApi.destroy();
        }
        if (sheetBackdrop.parentNode) {
            sheetBackdrop.parentNode.removeChild(sheetBackdrop);
        }
        if (solutionSheet.toast && solutionSheet.toast.parentNode) {
            solutionSheet.toast.parentNode.removeChild(solutionSheet.toast);
        }
        if (backdrop.parentNode) {
            backdrop.parentNode.removeChild(backdrop);
        }
        document.removeEventListener("keydown", onKey);
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
    }
    function onKey(e) {
        if (e.key === "Escape") {
            if (typeof scratchApi.isFullscreen === "function" && scratchApi.isFullscreen()) {
                return;
            }
            if (solutionSheet.isOpen && solutionSheet.isOpen()) {
                closeSolutionSheet();
                e.preventDefault();
                return;
            }
            close();
            return;
        }
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !e.repeat && isAdmin && !btnOk.hidden) {
            if (solutionSheet.isOpen && solutionSheet.isOpen()) {
                return;
            }
            const t = e.target;
            const tag = t && t.tagName;
            if (tag !== "TEXTAREA" && tag !== "SELECT") {
                e.preventDefault();
                void performUnifiedSave({});
            }
        }
    }
    document.addEventListener("keydown", onKey);
    btnHeaderClose.addEventListener("click", close);
    btnFooterCancel.addEventListener("click", close);
    backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) {
            close();
        }
    });

    dlg.addEventListener(
        "paste",
        (e) => {
            if (!isAdmin) {
                return;
            }
            const cd = e.clipboardData;
            if (!cd) {
                return;
            }
            const files = cd.files;
            if (files && files.length) {
                for (let i = 0; i < files.length; i++) {
                    if (applyImageFileFromPaste(files[i])) {
                        e.preventDefault();
                        return;
                    }
                }
            }
            const items = cd.items;
            if (items) {
                for (let i = 0; i < items.length; i++) {
                    const it = items[i];
                    if (it.kind === "file" && it.type && it.type.startsWith("image/")) {
                        const f = it.getAsFile();
                        if (f && applyImageFileFromPaste(f)) {
                            e.preventDefault();
                            return;
                        }
                    }
                }
            }
        },
        false,
    );
    fileIn.addEventListener("change", () => {
        const f = fileIn.files && fileIn.files[0];
        if (!f) {
            return;
        }
        dsaCompressImageToDataUrl(f, 1280, 0.82, (data) => {
            if (data) {
                setImagePreview(data);
            }
            fileIn.value = "";
        });
    });

    function showQToast(message, kind) {
        try {
            const root = document.body;
            if (!root) {
                return;
            }
            const existing = root.querySelector(".dsa-q-toast.dsa-q-toast--active");
            if (existing && existing.parentNode) {
                existing.parentNode.removeChild(existing);
            }
            const el = document.createElement("div");
            el.className = `dsa-q-toast dsa-q-toast--active dsa-q-toast--${kind || "error"}`;
            const icon = document.createElement("span");
            icon.className = "dsa-q-toast-icon";
            icon.setAttribute("aria-hidden", "true");
            icon.innerHTML =
                kind === "success"
                    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
                    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16.5" x2="12.01" y2="16.5"/></svg>';
            const text = document.createElement("span");
            text.className = "dsa-q-toast-msg";
            text.textContent = String(message || "");
            el.appendChild(icon);
            el.appendChild(text);
            root.appendChild(el);
            requestAnimationFrame(() => el.classList.add("dsa-q-toast--show"));
            setTimeout(() => {
                el.classList.remove("dsa-q-toast--show");
                setTimeout(() => {
                    if (el.parentNode) {
                        el.parentNode.removeChild(el);
                    }
                }, 250);
            }, 2600);
        } catch (_e) {
            /* no-op */
        }
    }

    async function performUnifiedSave(opts) {
        const fromFullscreen = !!(opts && opts.fromFullscreen);
        if (!isAdmin) {
            return;
        }
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = 0;
        }
        if (useMindTypePicker2) {
            const mk = dlg.querySelector('input[name="graphMindKind"]:checked');
            const kind = mk ? String(mk.value).toUpperCase() : "";
            if (!kind || !mindAllowedEff.includes(kind)) {
                showQToast("Choose a node type allowed for this parent.", "error");
                return;
            }
            radQ.checked = kind === "PROBLEM";
            radN.checked = kind !== "PROBLEM";
        }
        if (isRenameNode) {
            clearFieldErrors();
            const nameRm = nodeIn.value.trim();
            if (!nameRm) {
                nodeIn.classList.add("dsa-field-control--error");
                nodeIn.focus();
                showQToast("Name is required.", "error");
                return;
            }
            if (dsaRenameGraphNodeAtPath(renameTargetPathKey, nameRm)) {
                if (fromFullscreen && typeof scratchApi.exitFullscreen === "function") {
                    scratchApi.exitFullscreen();
                }
                close();
                refresh();
                void dsaFlushDsaCmsSync();
            }
            return;
        }
        if (radN.checked) {
            clearFieldErrors();
            const name = nodeIn.value.trim();
            if (!name) {
                nodeIn.classList.add("dsa-field-control--error");
                nodeIn.focus();
                showQToast("Name is required.", "error");
                return;
            }
            const kf = dsaParentChildKindFlags(parentKey);
            if (kf.hasProblems && !kf.hasSubnodes) {
                if (
                    !confirm(
                        "This topic has practice problems. Adding a subtopic removes them from this level (they are not moved). Continue?",
                    )
                ) {
                    return;
                }
            }
            if (
                graphBodyCats.length &&
                graphBodyCatSelect &&
                !graphBodyCatFs.hidden &&
                !graphBodyCatSelect.value.trim()
            ) {
                graphBodyCatSelect.classList.add("dsa-field-control--error");
                graphBodyCatSelect.focus();
                showQToast("Please choose a category.", "error");
                return;
            }
            const nodeEntry = {
                parentKey,
                type: "pattern",
                name,
                url: "",
            };
            if (graphBodyCats.length && graphBodyCatSelect && !graphBodyCatFs.hidden) {
                nodeEntry.graphCategoryId = graphBodyCatSelect.value.trim();
            }
            if (useMindTypePicker2) {
                const mk = dlg.querySelector('input[name="graphMindKind"]:checked');
                const k = mk ? String(mk.value).toUpperCase() : "TOPIC";
                if (k === "PATTERN" || k === "TOPIC") {
                    nodeEntry.nodeCategorySlug = k;
                }
            } else if (mindCatsPre.length > 0) {
                nodeEntry.nodeCategorySlug = "TOPIC";
            }
            dsaAddUserNode(nodeEntry);
            if (fromFullscreen && typeof scratchApi.exitFullscreen === "function") {
                scratchApi.exitFullscreen();
            }
            close();
            refresh();
            void dsaFlushDsaCmsSync();
            return;
        }
        clearFieldErrors();
        const name = nameIn.value.trim();
        const url = urlIn.value.trim();
        if (!name) {
            nameIn.classList.add("dsa-field-control--error");
            activateDsaProblemTab("details");
            nameIn.focus();
            showQToast("Problem name is required.", "error");
            return;
        }
        if (isEditProblem && editQuestionName && name.toLowerCase() !== editQuestionName.toLowerCase()) {
            const existingOther = dsaResolveQuestionForModal(parentKey, name, "");
            const myId =
                (editUserNodeId && String(editUserNodeId).trim()) ||
                ((() => {
                    const e = dsaResolveQuestionForModal(parentKey, editQuestionName, editUserNodeId);
                    return e && e.id ? String(e.id) : "";
                })());
            if (existingOther && (!myId || existingOther.id !== myId)) {
                nameIn.classList.add("dsa-field-control--error");
                activateDsaProblemTab("details");
                nameIn.focus();
                showQToast(`Another problem named "${name}" already exists in this topic.`, "error");
                return;
            }
        }
        const diffPick = difficultySelect.value.trim();
        if (!diffPick || !["easy", "medium", "hard"].includes(dsaNormalizeProblemDifficulty(diffPick))) {
            difficultySelect.classList.add("dsa-field-control--error");
            activateDsaProblemTab("details");
            difficultySelect.focus();
            showQToast("Please choose a difficulty.", "error");
            return;
        }
        if (parentKey === "__DSA_META__") {
            showQToast(
                "Add problems under a data-structure topic (e.g. Arrays → Two pointers).",
                "error",
            );
            return;
        }
        const kfQ = dsaParentChildKindFlags(parentKey);
        if (kfQ.hasSubnodes) {
            if (
                !confirm(
                    "This topic has subtopics. Adding a practice problem removes them from this level (they are not moved). Continue?",
                )
            ) {
                return;
            }
            dsaRecordRemovalsForDirectBranchChildren(parentKey);
        }
        if (
            graphBodyCats.length &&
            graphBodyCatSelect &&
            !graphBodyCatFs.hidden &&
            !graphBodyCatSelect.value.trim()
        ) {
            graphBodyCatSelect.classList.add("dsa-field-control--error");
            activateDsaProblemTab("details");
            graphBodyCatSelect.focus();
            showQToast("Please choose a category.", "error");
            return;
        }
        const lookupName = isEditProblem && editQuestionName ? editQuestionName : name;
        const drawingPayload = collectSketchDrawingPayload(lookupName);
        const entForId = dsaResolveQuestionForModal(parentKey, lookupName, editUserNodeId);
        const persistId =
            (editUserNodeId && String(editUserNodeId).trim()) ||
            (entForId && entForId.id ? String(entForId.id).trim() : "");
        const solPayload = solutionsState
            .map((s) => dsaNormalizeSolutionItem(s))
            .filter(
                (s) =>
                    s &&
                    (String(s.code || "").trim() ||
                        s.timeComplexity ||
                        s.spaceComplexity ||
                        dsaNormalizeSolutionCategory(s.approach)),
            );
        const firstCode = solPayload.find((s) => String(s.code || "").trim());
        const upsertPayload = {
            id: persistId || undefined,
            parentKey,
            name,
            url,
            comment: "",
            hint: hintTa.value,
            code: firstCode ? String(firstCode.code) : "",
            solutions: solPayload,
            drawing: drawingPayload,
            image: imageDataUrl,
            companies: dsaNormalizeCompaniesArray(companyTagsList),
            solutionVideoUrl: solutionVideoIn.value.trim(),
            solutionTimeComplexity: "",
            solutionSpaceComplexity: "",
            solutionCategory: "",
            starred: importantInput.checked === true,
            done: !!(entForId && entForId.done),
            difficulty: dsaNormalizeProblemDifficulty(difficultySelect.value),
            nodeCategorySlug: "PROBLEM",
        };
        if (graphBodyCats.length && graphBodyCatSelect && !graphBodyCatFs.hidden) {
            upsertPayload.graphCategoryId = graphBodyCatSelect.value.trim();
        }
        dsaUpsertUserQuestionNode(upsertPayload);
        if (fromFullscreen) {
            if (typeof scratchApi.exitFullscreen === "function") {
                scratchApi.exitFullscreen();
            }
            userClearedSketch = false;
            syncNameToEntry();
        } else {
            close();
        }
        refresh();
        void dsaFlushDsaCmsSync();
        showQToast(isEditProblem ? "Problem updated." : "Problem added.", "success");
    }
    let saveInFlight = false;
    btnOk.addEventListener("click", () => {
        if (saveInFlight) {
            return;
        }
        saveInFlight = true;
        try {
            void performUnifiedSave({});
        } finally {
            setTimeout(() => {
                saveInFlight = false;
            }, 400);
        }
    });

    dlg.appendChild(header);
    if (adminNote) {
        scrollBody.appendChild(adminNote);
    }
    scrollBody.appendChild(infoPanel);
    scrollBody.appendChild(catFs);
    scrollBody.appendChild(mindTypeFs);
    scrollBody.appendChild(graphBodyCatFs);
    scrollBody.appendChild(nodeBlock);
    scrollBody.appendChild(problemOuter);
    dlg.appendChild(scrollBody);
    dlg.appendChild(footer);
    setAdminDisabled();
    syncCategory();
    syncMindTypeCardVisual();
    if (useMindTypePicker2) {
        dlg.querySelectorAll('input[name="graphMindKind"]').forEach((inp) => {
            inp.addEventListener("change", () => {
                syncMindTypeCardVisual();
                syncCategory();
            });
        });
    }

    backdrop.appendChild(dlg);
    document.body.appendChild(backdrop);
    document.body.appendChild(sheetBackdrop);
    if (solutionSheet.toast) {
        document.body.appendChild(solutionSheet.toast);
    }
    if (editQuestionName || editUserNodeId) {
        if (editUserNodeId) {
            const e0 = dsaFindUserQuestionById(editUserNodeId);
            if (e0 && e0.name) {
                nameIn.value = String(e0.name);
            } else if (editQuestionName) {
                nameIn.value = editQuestionName;
            }
        } else {
            nameIn.value = editQuestionName;
        }
        syncNameToEntry();
        if (isAdmin) {
            urlIn.focus();
        }
        if (graphBodyCats.length && graphBodyCatSelect) {
            const entPick = editUserNodeId
                ? dsaFindUserQuestionById(editUserNodeId)
                : dsaResolveQuestionForModal(parentKey, editQuestionName, "");
            const gid = entPick && entPick.graphCategoryId != null ? String(entPick.graphCategoryId).trim() : "";
            const okOpt = gid && [...graphBodyCatSelect.options].some((o) => o.value === gid);
            graphBodyCatSelect.value = okOpt ? gid : "";
        }
    } else if (isRenameNode) {
        nodeIn.focus();
        nodeIn.select();
    } else if (radN.checked) {
        nodeIn.focus();
    } else {
        difficultySelect.value = "medium";
        nameIn.focus();
    }
    syncDifficultyPillsFromSelect();
    syncStarVisual();
    nodeCharSpan.textContent = String(nodeIn.value.length);
    if (nameCountWrap.id === "nameCount") {
        nameCountWrap.textContent = `${String(nameIn.value.length)}/60`;
    }
}
/**
 * @param {{ siteAdmin: boolean, canEditGraph: boolean }} authCtx — siteAdmin = RSA CMS token; canEditGraph = customize UI rings.
 */
function attachDsaCustomizePanel(panel, scheduleRedraw, restoredGraphUi, authCtx) {
    panel.innerHTML = "";
    panel.classList.add("dsa-graph-panel--customize");
    const mapToolbarHost = document.getElementById(dsaGraphMount.mapToolbarHostId);
    if (mapToolbarHost) {
        if (mapToolbarHost.dataset.dsaIndexToolbarSlots === "1") {
            dsaClearIndexMapToolbarSlots(mapToolbarHost);
        } else {
            mapToolbarHost.replaceChildren();
        }
    }
    const siteAdmin = !!(authCtx && authCtx.siteAdmin);
    const canEditGraph = !!(authCtx && authCtx.canEditGraph);
    const fullReload = () => loadDsaPatternsPage({ restore: { customize: true } });
    const refresh = () => {
        const ui = captureDsaCustomizeGraphUiState();
        const ok = dsaTrySoftRemountGraphTree(
            panel,
            scheduleRedraw,
            () =>
                buildUnifiedMindmapTree(
                    panel,
                    scheduleRedraw,
                    { refresh, isAdmin: canEditGraph },
                    refresh,
                ),
            () => {
                if (ui) {
                    applyDsaCustomizeGraphUiState(panel, ui, scheduleRedraw);
                }
            },
        );
        if (!ok) {
            fullReload();
        }
    };

    const { canvas, toolbarExpand, toolbarZoom, body } = dsaCreateGraphCanvasLayout(
        mapToolbarHost instanceof HTMLElement ? mapToolbarHost : null,
        dsaGraphPreviewMode ? { suppressExternalHint: true } : undefined,
    );

    const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgEl.classList.add("dsa-graph-svg");
    svgEl.setAttribute("aria-hidden", "true");

    const scroll = document.createElement("div");
    scroll.className = "dsa-mind-scroll";
    const zoomSizer = document.createElement("div");
    zoomSizer.className = "dsa-mind-zoom-sizer";
    const zoomContent = document.createElement("div");
    zoomContent.className = "dsa-mind-zoom-content";
    zoomContent.appendChild(
        buildUnifiedMindmapTree(panel, scheduleRedraw, { refresh, isAdmin: canEditGraph }),
    );
    zoomSizer.appendChild(zoomContent);
    scroll.appendChild(zoomSizer);

    body.appendChild(svgEl);
    body.appendChild(scroll);
    dsaMountGraphExpandCollapseControls(toolbarExpand, panel, scheduleRedraw);

    panel.appendChild(canvas);

    scroll.addEventListener("scroll", scheduleRedraw, { passive: true });
    dsaChainMindScrollResizeForEdges(scheduleRedraw);
    const zoomUnsubCuz = dsaWireMindScrollZoom(scroll, body, scheduleRedraw, toolbarZoom);
    const prevCleanupCuz = dsaGraphResizeCleanup;
    dsaGraphResizeCleanup = () => {
        if (typeof zoomUnsubCuz === "function") {
            zoomUnsubCuz();
        }
        if (typeof prevCleanupCuz === "function") {
            prevCleanupCuz();
        }
    };
    requestAnimationFrame(() => {
        applyDsaCustomizeGraphUiState(panel, restoredGraphUi, scheduleRedraw);
    });
}

/** Clear only expand/zoom slots on index.html map toolbar (keeps export/import, hint chrome). */
function dsaClearIndexMapToolbarSlots(host) {
    if (!host || host.dataset.dsaIndexToolbarSlots !== "1") {
        return;
    }
    const exp = host.querySelector(".dsa-toolbar-expand-slot");
    const zm = host.querySelector(".dsa-toolbar-zoom-host");
    if (exp) {
        exp.replaceChildren();
    }
    if (zm) {
        zm.replaceChildren();
    }
}

/** Clear external map toolbar host (expand/collapse/zoom) so listeners are not orphaned. */
function dsaClearExternalMapToolbarHost() {
    const id = dsaGraphMount && dsaGraphMount.mapToolbarHostId;
    const host = id ? document.getElementById(id) : null;
    if (!host) {
        return;
    }
    if (host.dataset.dsaIndexToolbarSlots === "1") {
        dsaClearIndexMapToolbarSlots(host);
        return;
    }
    host.replaceChildren();
}

/**
 * Tear down an embedded admin graph preview and restore default mount ids for index.
 */
function dsaTeardownAdminGraphPreview() {
    if (typeof dsaGraphResizeCleanup === "function") {
        dsaGraphResizeCleanup();
        dsaGraphResizeCleanup = null;
    }
    const vp = document.getElementById("admin-dsa-hierarchy-root");
    if (vp) {
        vp.innerHTML = "";
        vp.classList.remove("dsa-view-unified", "dsa-view-customize");
    }
    dsaClearExternalMapToolbarHost();
    dsaGraphActiveRoot = null;
    dsaGraphUnifiedMode = false;
    dsaGraphCustomizeMode = false;
    dsaResetGraphMountAndPreview();
}
window.dsaTeardownAdminGraphPreview = dsaTeardownAdminGraphPreview;

/**
 * Apply mind-map JSON to `dsaHierarchy` and render the graph (e.g. admin Content → UI).
 * @param {string} jsonStr
 * @param {{ viewportId?: string, mapToolbarHostId?: string, shellToolbarId?: string|null }} [mount]
 * @returns {{ ok: boolean, error?: Error }}
 */
function dsaReloadGraphFromEditorJson(jsonStr, mount) {
    let parsed;
    try {
        parsed = JSON.parse(String(jsonStr || ""));
    } catch (e) {
        return { ok: false, error: e };
    }
    if (!Array.isArray(parsed)) {
        return {
            ok: false,
            error: new Error("Mind map JSON must be an array of root topics."),
        };
    }
    dsaHierarchy = parsed;
    void (async () => {
        try {
            const base =
                typeof document !== "undefined" && document.baseURI ? document.baseURI : typeof window !== "undefined" ? window.location.href : "";
            const href = new URL("api/graph-library/node-categories", base || "http://localhost/").href;
            const r = await fetch(href, { credentials: "same-origin" });
            const j = await r.json();
            if (j && j.ok && Array.isArray(j.categories) && typeof window !== "undefined") {
                window.__dsaGraphNodeCategories = j.categories;
            }
        } catch (_) {
            /* ignore */
        }
    })();
    loadDsaPatternsPage({
        graphPreview: true,
        mount:
            mount ||
            {
                viewportId: "admin-dsa-hierarchy-root",
                mapToolbarHostId: "admin-dsa-map-toolbar-host",
                shellToolbarId: null,
            },
    });
    return { ok: true };
}
window.dsaReloadGraphFromEditorJson = dsaReloadGraphFromEditorJson;

/** Inline hint next to zoom for the currently mounted map toolbar host. */
function dsaGetActiveMapToolbarInlineHintEl() {
    const hostId = dsaGraphMount && dsaGraphMount.mapToolbarHostId;
    const host = hostId ? document.getElementById(hostId) : null;
    const scoped = host && host.querySelector(".dsa-graph-map-toolbar-hint-text");
    if (scoped) {
        return scoped;
    }
    return document.getElementById("dsa-map-toolbar-inline-hint");
}

function loadDsaPatternsPage(opts) {
    const restore = opts && opts.restore;
    if (opts && opts.mount) {
        dsaMergeGraphMount(opts.mount);
    }
    if (opts && Object.prototype.hasOwnProperty.call(opts, "graphPreview")) {
        dsaGraphPreviewMode = !!opts.graphPreview;
    }
    const siteAdmin = typeof dsaIsAdminSession === "function" && dsaIsAdminSession();
    const canCustomize =
        typeof dsaHasCustomizeGraphAccess === "function" && dsaHasCustomizeGraphAccess();
    if (canCustomize) {
        void dsaFetchGraphNodeCategoriesList();
    }
    const sfOk = typeof dsaSiteFeatureUse === "function";
    const showPracticeMap = !sfOk || dsaSiteFeatureUse("practice_map");
    const showOneTopic = !sfOk || dsaSiteFeatureUse("one_topic_mode");
    const showCustomizeForPublic = !sfOk || dsaSiteFeatureUse("graph_customize_tab");
    /** Site admins keep Customize even when the flag is off for members. */
    const allowCustomizeTab = canCustomize && (siteAdmin || showCustomizeForPublic);
    const viewport = document.getElementById(dsaGraphMount.viewportId);
    if (!viewport) {
        return;
    }

    if (!dsaGraphPreviewMode && !showPracticeMap && !siteAdmin) {
        viewport.innerHTML = "";
        viewport.classList.remove("dsa-view-unified", "dsa-view-customize");
        const blocked = document.createElement("div");
        blocked.className = "dsa-site-feature-blocked";
        blocked.setAttribute("role", "status");
        blocked.innerHTML =
            "<p><strong>Practice map unavailable</strong></p><p>This experience has been turned off in site settings. Try again later.</p>";
        viewport.appendChild(blocked);
        syncNavbarAuthUi();
        return;
    }

    const shellId = dsaGraphMount.shellToolbarId;
    const shellViewToolbarSlot =
        shellId != null && shellId !== "" ? document.getElementById(shellId) : null;
    if (shellViewToolbarSlot) {
        shellViewToolbarSlot.replaceChildren();
    }
    const legacyViewTabsSlotEarly = document.getElementById("dsa-toolbar-view-tabs-slot");
    if (legacyViewTabsSlotEarly && !dsaGraphPreviewMode) {
        legacyViewTabsSlotEarly.replaceChildren();
    }
    dsaClearExternalMapToolbarHost();

    const pendingCustomizeUi = captureDsaCustomizeGraphUiState();

    if (typeof dsaGraphResizeCleanup === "function") {
        dsaGraphResizeCleanup();
        dsaGraphResizeCleanup = null;
    }
    dsaGraphActiveRoot = null;
    dsaGraphUnifiedMode = false;
    dsaGraphCustomizeMode = false;
    viewport.innerHTML = "";
    viewport.classList.remove("dsa-view-unified", "dsa-view-customize");

    const layer = document.createElement("div");
    layer.className = "dsa-graph-layer";

    const hintSingle =
        "One topic: pick a data structure below, then use the map. Mark Done on problems to update progress; the topic hub shows done/total and a completion fill. Purple badges use the immediate child count and expand branches; leaf badges open problem links. Toolbar: expand / collapse / zoom; scroll to pan.";
    const hintUnified =
        "Rings on topics expand branches; leaf rings open problems. Mark Done to track progress. Pinch or Ctrl/⌘-scroll to zoom — drag to pan.";
    const hintCustomize =
        "Customize graph: same map as Full map with edit rings (− / count / +). Site admins sync to the database; Pro or elevated practice accounts can edit locally and export JSON.";
    const mapToolbarHost = document.getElementById(dsaGraphMount.mapToolbarHostId);
    const mindToolbarOpts =
        mapToolbarHost instanceof HTMLElement ? { toolbarParent: mapToolbarHost } : undefined;

    async function dsaReloadHierarchyAndUserIfLive() {
        if (dsaGraphPreviewMode) {
            return;
        }
        try {
            await dsaLoadHierarchyFromSources();
            await dsaInitUserData();
        } catch (e) {
            console.warn("DSA hierarchy/user reload skipped or failed", e);
        }
    }

    const hint = document.createElement("p");
    hint.className = "dsa-graph-hint";
    if (mapToolbarHost) {
        hint.classList.add("dsa-graph-hint--shell-external");
    }
    if (dsaGraphPreviewMode) {
        hint.hidden = true;
        hint.setAttribute("aria-hidden", "true");
    }

    function setMindHint(text) {
        if (dsaGraphPreviewMode) {
            hint.hidden = true;
            const inlineHint = dsaGetActiveMapToolbarInlineHintEl();
            if (inlineHint) {
                inlineHint.textContent = "";
                const wrap = inlineHint.closest(".dsa-graph-map-toolbar-hint");
                if (wrap) {
                    wrap.hidden = true;
                }
            }
            return;
        }
        hint.hidden = false;
        hint.removeAttribute("aria-hidden");
        const s = text == null ? "" : String(text);
        hint.textContent = s;
        const inlineHint = dsaGetActiveMapToolbarInlineHintEl();
        if (inlineHint) {
            inlineHint.textContent = s;
            const wrap = inlineHint.closest(".dsa-graph-map-toolbar-hint");
            if (wrap) {
                wrap.hidden = !s.trim();
            }
            return;
        }
    }

    const modeSegEl =
        document.getElementById("modeSeg") ||
        document.getElementById("admin-modeSeg") ||
        document.getElementById("udash-modeSeg");
    let staticTabsOk = false;
    let toolbar = null;
    let tablist;
    let btnUnifiedView;
    let btnSingleView;
    let btnCustomizeView = null;

    if (modeSegEl instanceof HTMLElement) {
        btnUnifiedView = modeSegEl.querySelector('[data-mode="full"]');
        btnSingleView = modeSegEl.querySelector('[data-mode="one"]');
        btnCustomizeView = modeSegEl.querySelector('[data-mode="custom"]');
        if (btnUnifiedView && btnSingleView) {
            staticTabsOk = true;
            tablist = modeSegEl;
        }
    }

    if (!staticTabsOk) {
        toolbar = document.createElement("div");
        toolbar.className = "dsa-view-toolbar";

        tablist = document.createElement("div");
        tablist.className = "dsa-view-tabs seg dsa-seg-track";
        tablist.setAttribute("role", "tablist");
        tablist.setAttribute("aria-label", "Graph layout");

        const tabThumb = document.createElement("span");
        tabThumb.className = "dsa-seg-thumb";
        tabThumb.setAttribute("aria-hidden", "true");

        btnUnifiedView = document.createElement("button");
        btnUnifiedView.type = "button";
        btnUnifiedView.className = "dsa-view-btn dsa-view-btn--active";
        btnUnifiedView.setAttribute("role", "tab");
        btnUnifiedView.setAttribute("aria-selected", "true");
        btnUnifiedView.dataset.mode = "unified";
        btnUnifiedView.textContent = "Full map";

        btnSingleView = document.createElement("button");
        btnSingleView.type = "button";
        btnSingleView.className = "dsa-view-btn";
        btnSingleView.setAttribute("role", "tab");
        btnSingleView.setAttribute("aria-selected", "false");
        btnSingleView.dataset.mode = "single";
        btnSingleView.textContent = "One topic";

        btnCustomizeView = null;
        if (allowCustomizeTab) {
            btnCustomizeView = document.createElement("button");
            btnCustomizeView.type = "button";
            btnCustomizeView.className = "dsa-view-btn";
            btnCustomizeView.setAttribute("role", "tab");
            btnCustomizeView.setAttribute("aria-selected", "false");
            btnCustomizeView.dataset.mode = "customize";
            btnCustomizeView.textContent = "Customize";
        }

        tablist.appendChild(tabThumb);
        tablist.appendChild(btnUnifiedView);
        if (showOneTopic) {
            tablist.appendChild(btnSingleView);
        } else {
            btnSingleView.hidden = true;
            btnSingleView.style.display = "none";
        }
        if (btnCustomizeView) {
            tablist.appendChild(btnCustomizeView);
        }
        toolbar.appendChild(tablist);
    } else {
        if (!allowCustomizeTab && btnCustomizeView) {
            btnCustomizeView.remove();
            btnCustomizeView = null;
        }
        if (!showOneTopic && btnSingleView) {
            btnSingleView.hidden = true;
            btnSingleView.style.display = "none";
        }
    }

    if (typeof ResizeObserver !== "undefined" && tablist) {
        const tablistThumbRo = new ResizeObserver(() => dsaSyncSegThumbTrack(tablist));
        tablistThumbRo.observe(tablist);
    }
    window.addEventListener(
        "resize",
        () => dsaSyncSegThumbTrack(tablist),
        { passive: true },
    );

    const rootsRow = document.createElement("div");
    rootsRow.className = "dsa-graph-roots";

    const panel = document.createElement("div");
    panel.className = "dsa-graph-panel";
    panel.id = "dsa-graph-panel";
    panel.hidden = true;

    const scheduleRedraw = () => requestAnimationFrame(drawDsaMindmapEdges);
    function graphRefresh() {
        const st = dsaCaptureGraphViewState();
        if (dsaGraphCustomizeMode) {
            loadDsaPatternsPage({ restore: st });
            return;
        }
        const buildFreshTree = () => {
            if (dsaGraphUnifiedMode) {
                return buildUnifiedMindmapTree(panel, scheduleRedraw, null, graphRefresh);
            }
            const btn = dsaGraphActiveRoot;
            const id = btn && btn.dataset && btn.dataset.dsId;
            const merged = id && getDsaHierarchyMerged().find((d) => dsaDsIdEq(d.id, id));
            if (!merged) {
                return null;
            }
            return buildMindmapTree(merged, panel, scheduleRedraw, dsaStableThemeForKey(id), graphRefresh);
        };
        if (!dsaTrySoftRemountGraphTree(panel, scheduleRedraw, buildFreshTree, null)) {
            loadDsaPatternsPage({ restore: st });
        }
    }

    function resetRootsRowInactive() {
        rootsRow.querySelectorAll(".dsa-node-root").forEach((b) => {
            dsaClearThemeVars(b);
            b.classList.remove("dsa-node--active");
            b.setAttribute("aria-expanded", "false");
            const rid = b.dataset.dsId;
            if (rid) {
                dsaApplyThemeVars(b, dsaStableThemeForKey(rid));
            }
        });
    }

    function setGraphViewMode(mode) {
        const u = mode === "unified";
        const s = mode === "single";
        const c = mode === "customize";
        btnUnifiedView.classList.toggle("dsa-view-btn--active", u);
        btnSingleView.classList.toggle("dsa-view-btn--active", s);
        if (btnCustomizeView) {
            btnCustomizeView.classList.toggle("dsa-view-btn--active", c);
            btnCustomizeView.setAttribute("aria-selected", c ? "true" : "false");
        }
        btnUnifiedView.setAttribute("aria-selected", u ? "true" : "false");
        btnSingleView.setAttribute("aria-selected", s ? "true" : "false");
        requestAnimationFrame(() => dsaSyncSegThumbTrack(tablist));
    }

    function enterSingleTopicChrome() {
        dsaGraphCustomizeMode = false;
        dsaGraphUnifiedMode = false;
        viewport.classList.remove("dsa-view-unified", "dsa-view-customize");
        rootsRow.hidden = false;
        panel.hidden = true;
        panel.innerHTML = "";
        dsaClearExternalMapToolbarHost();
        dsaGraphActiveRoot = null;
        resetRootsRowInactive();
        setMindHint(hintSingle);
        scheduleRedraw();
    }

    function enterUnifiedMap() {
        dsaGraphCustomizeMode = false;
        dsaGraphUnifiedMode = true;
        dsaGraphActiveRoot = null;
        resetRootsRowInactive();
        viewport.classList.remove("dsa-view-customize");
        viewport.classList.add("dsa-view-unified");
        rootsRow.hidden = true;
        panel.hidden = false;
        attachDsaMindCanvas(
            panel,
            () => buildUnifiedMindmapTree(panel, scheduleRedraw, null, graphRefresh),
            scheduleRedraw,
            mindToolbarOpts,
        );
        setMindHint(hintUnified);
    }

    function enterCustomizeMap() {
        dsaGraphCustomizeMode = true;
        dsaGraphUnifiedMode = false;
        dsaGraphActiveRoot = null;
        resetRootsRowInactive();
        viewport.classList.remove("dsa-view-unified");
        viewport.classList.add("dsa-view-customize");
        rootsRow.hidden = true;
        panel.hidden = false;
        attachDsaCustomizePanel(panel, scheduleRedraw, pendingCustomizeUi, {
            siteAdmin,
            canEditGraph: canCustomize,
        });
        setMindHint(hintCustomize);
    }

    btnSingleView.addEventListener("click", async () => {
        if (!showOneTopic) {
            return;
        }
        setGraphViewMode("single");
        await dsaReloadHierarchyAndUserIfLive();
        dsaRefreshRootsRowUi(rootsRow);
        enterSingleTopicChrome();
    });

    btnUnifiedView.addEventListener("click", async () => {
        setGraphViewMode("unified");
        await dsaReloadHierarchyAndUserIfLive();
        enterUnifiedMap();
    });

    if (btnCustomizeView) {
        btnCustomizeView.addEventListener("click", () => {
            setGraphViewMode("customize");
            enterCustomizeMap();
        });
    }

    const hierarchyMerged = getDsaHierarchyMerged();
    hierarchyMerged.forEach((ds) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dsa-node-root";
        btn.setAttribute("aria-expanded", "false");
        btn.dataset.dsId = ds.id;
        dsaApplyThemeVars(btn, dsaStableThemeForKey(ds.id));
        const rootInner = document.createElement("span");
        rootInner.className = "dsa-root-inner";
        const rootName = document.createElement("span");
        rootName.className = "dsa-root-name";
        rootName.textContent = ds.name;
        const rootBarBadge = document.createElement("span");
        rootBarBadge.className = "dsa-h-badge dsa-h-badge--static";
        rootBarBadge.textContent = String(getDsTree(ds).length);
        rootBarBadge.setAttribute("aria-label", `${getDsTree(ds).length} top-level topics`);
        const stBtn = dsaCollectDsProblemStats(ds);
        const rootDoneCnt = document.createElement("span");
        rootDoneCnt.className = "dsa-h-topic-done-count";
        rootDoneCnt.textContent = `${stBtn.done}/${stBtn.total}`;
        rootInner.appendChild(
            createTopicProgressChipUnit(
                rootName,
                rootDoneCnt,
                rootBarBadge,
                dsaTopicProgressPercent(stBtn),
            ),
        );
        btn.appendChild(rootInner);
        const dsIdSnapshot = ds.id;
        btn.addEventListener("click", async () => {
            if (!showOneTopic) {
                return;
            }
            setGraphViewMode("single");
            dsaGraphCustomizeMode = false;
            dsaGraphUnifiedMode = false;
            viewport.classList.remove("dsa-view-unified", "dsa-view-customize");
            rootsRow.hidden = false;

            const togglingOff = dsaGraphActiveRoot === btn;
            resetRootsRowInactive();
            if (togglingOff) {
                dsaGraphActiveRoot = null;
                panel.hidden = true;
                panel.innerHTML = "";
                dsaClearExternalMapToolbarHost();
                setMindHint(hintSingle);
                scheduleRedraw();
                return;
            }
            await dsaReloadHierarchyAndUserIfLive();
            dsaRefreshRootsRowUi(rootsRow);
            const mergedNow = getDsaHierarchyMerged();
            const freshDs = mergedNow.find((d) => d && dsaDsIdEq(d.id, dsIdSnapshot));
            if (!freshDs) {
                setMindHint(hintSingle);
                scheduleRedraw();
                return;
            }
            const topicTheme = dsaStableThemeForKey(freshDs.id);
            dsaApplyThemeVars(btn, topicTheme);
            dsaGraphActiveRoot = btn;
            btn.classList.add("dsa-node--active");
            btn.setAttribute("aria-expanded", "true");
            panel.hidden = false;

            attachDsaMindCanvas(
                panel,
                () => buildMindmapTree(freshDs, panel, scheduleRedraw, topicTheme, graphRefresh),
                scheduleRedraw,
                mindToolbarOpts,
            );
            setMindHint(hintSingle);
        });
        rootsRow.appendChild(btn);
    });

    if (!staticTabsOk && toolbar) {
        const viewTabsSlot = document.getElementById("dsa-toolbar-view-tabs-slot");
        if (viewTabsSlot && !dsaGraphPreviewMode) {
            viewTabsSlot.replaceChildren();
            viewTabsSlot.appendChild(toolbar);
        } else if (shellViewToolbarSlot) {
            shellViewToolbarSlot.appendChild(toolbar);
        } else {
            layer.appendChild(toolbar);
        }
    }
    layer.appendChild(hint);
    layer.appendChild(rootsRow);
    layer.appendChild(panel);

    viewport.appendChild(layer);

    const onResize = () => drawDsaMindmapEdges();
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(() => scheduleRedraw());
    ro.observe(viewport);
    dsaGraphResizeCleanup = () => {
        window.removeEventListener("resize", onResize);
        ro.disconnect();
    };

    function applyRestoreState() {
        if (!restore) {
            /* Match index.html: site admins land on Customize; preview embed (admin Content UI) keeps all three tabs. */
            if (siteAdmin) {
                setGraphViewMode("customize");
                enterCustomizeMap();
            } else {
                setGraphViewMode("unified");
                enterUnifiedMap();
            }
            return;
        }
        if (restore.customize) {
            if (!canCustomize || !btnCustomizeView) {
                setGraphViewMode("unified");
                enterUnifiedMap();
                return;
            }
            setGraphViewMode("customize");
            enterCustomizeMap();
            return;
        }
        if (restore.unified) {
            setGraphViewMode("unified");
            enterUnifiedMap();
            return;
        }
        if (restore.activeDsId && showOneTopic) {
            const merged = getDsaHierarchyMerged();
            const ds = merged.find((d) => dsaDsIdEq(d.id, restore.activeDsId));
            const topicBtn = rootsRow.querySelector(`[data-ds-id="${restore.activeDsId}"]`);
            if (ds && topicBtn) {
                setGraphViewMode("single");
                dsaGraphCustomizeMode = false;
                dsaGraphUnifiedMode = false;
                viewport.classList.remove("dsa-view-unified", "dsa-view-customize");
                rootsRow.hidden = false;
                resetRootsRowInactive();
                const topicTheme = dsaStableThemeForKey(ds.id);
                dsaApplyThemeVars(topicBtn, topicTheme);
                dsaGraphActiveRoot = topicBtn;
                topicBtn.classList.add("dsa-node--active");
                topicBtn.setAttribute("aria-expanded", "true");
                panel.hidden = false;
                attachDsaMindCanvas(
                    panel,
                    () => buildMindmapTree(ds, panel, scheduleRedraw, topicTheme, graphRefresh),
                    scheduleRedraw,
                    mindToolbarOpts,
                );
                setMindHint(hintSingle);
                return;
            }
        }
        setGraphViewMode("unified");
        enterUnifiedMap();
    }

    applyRestoreState();
    requestAnimationFrame(() => requestAnimationFrame(() => dsaSyncSegThumbTrack(tablist)));
    syncNavbarAuthUi();
}

// Function to get query parameters from the URL
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Function to open project details (from the main page)
function openProjectDetail(projectId,pathname) {
    // Navigate to the project details page with the projectId as a URL parameter
    window.location.href = `${pathname}projectDetails.html?projectId=${projectId}`;
}

function updateElementContent(elementId, data, prefix = '') {
    const element = document.getElementById(elementId);

    if (data) {
        element.textContent = `${prefix}${data}`;
        element.style.display = ''; // Ensure the element is visible
    } else {
        element.style.display = 'none'; // Hide the element
    }
}

function setThumbnail(impPath) {
    const element = document.getElementById("project-thumbnail");
    if (!element) {
        return;
    }
    element.src = normalizeAssetUrl(impPath);
}



function setLinkText(link) {
    // Define the text for different types of links
    const websiteText = "Visit Website";
    const playStoreText = "Open on Play Store";
    const githubText = "Go to Github";

    // Set the link text
    const linkTextElement = document.getElementById('link-text');
    if (link.includes("play.google.com")) {
        setLiveIndicator(true);
        linkTextElement.textContent = playStoreText;
    } else if(link.includes("github.com")) {
        setLiveIndicator(false);
        linkTextElement.textContent = githubText;
    }else{
        setLiveIndicator(true);
        linkTextElement.textContent = websiteText;
    }

    linkTextElement.href = link;

}

function setLiveIndicator(isLive){
    const liveIndicatorElement = document.getElementById('live-indicator');
    if (isLive) {
        liveIndicatorElement.classList.add('live');
    } else {
        liveIndicatorElement.style.display = 'none';
    }
}

function escapeHtml(s) {
    if (s == null) {
        return "";
    }
    const d = document.createElement("div");
    d.textContent = String(s);
    return d.innerHTML;
}

/** Site-root paths so images work from /index.html, /project%20pages/*, /skill%20pages/*. */
function normalizeAssetUrl(u) {
    if (u == null || u === "") {
        return "";
    }
    const s = String(u).trim();
    if (/^https?:\/\//i.test(s)) {
        return s;
    }
    if (s.startsWith("/")) {
        return s;
    }
    const noParent = s.replace(/^\.\.\//, "");
    return noParent.startsWith("/") ? noParent : "/" + noParent.replace(/^\/+/, "");
}

function normalizeThumbPath(th) {
    return normalizeAssetUrl(th);
}

function extractYouTubeId(url) {
    try {
        const u = new URL(url, window.location.href);
        const h = u.hostname.replace(/^www\./, "");
        if (h === "youtu.be") {
            return u.pathname.replace(/^\//, "").split("/")[0] || null;
        }
        if (h.includes("youtube.com")) {
            if (u.pathname.startsWith("/embed/")) {
                return u.pathname.slice(7).split("/")[0];
            }
            const v = u.searchParams.get("v");
            if (v) {
                return v;
            }
            const parts = u.pathname.split("/").filter(Boolean);
            const si = parts.indexOf("shorts");
            if (si >= 0 && parts[si + 1]) {
                return parts[si + 1];
            }
        }
    } catch (e) {
        /* ignore */
    }
    return null;
}

function appendProjectVideoEl(container, video) {
    const url = video && video.url;
    if (!url) {
        return;
    }
    const ytId = extractYouTubeId(url);
    if (ytId) {
        const q = new URLSearchParams();
        if (video.autoPlay) {
            q.set("autoplay", "1");
        }
        if (video.mute) {
            q.set("mute", "1");
        }
        if (video.loop) {
            q.set("loop", "1");
        }
        const qs = q.toString();
        const iframe = document.createElement("iframe");
        iframe.width = "100%";
        iframe.height = "100%";
        iframe.src = `https://www.youtube-nocookie.com/embed/${ytId}${qs ? "?" + qs : ""}`;
        iframe.title = "YouTube video";
        iframe.loading = "lazy";
        iframe.setAttribute("frameborder", "0");
        iframe.allow =
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        iframe.allowFullscreen = true;
        container.appendChild(iframe);
        return;
    }
    const v = document.createElement("video");
    v.setAttribute("controls", "");
    v.setAttribute("playsinline", "");
    v.setAttribute("preload", "metadata");
    v.style.width = "100%";
    v.style.maxHeight = "min(70vh, 520px)";
    v.style.background = "#000";
    v.src = url;
    const wrap = document.createElement("div");
    wrap.className = "project-video-wrap";
    wrap.appendChild(v);
    const fallback = document.createElement("p");
    fallback.className = "project-video-fallback";
    fallback.innerHTML = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open video</a>`;
    v.addEventListener(
        "error",
        () => {
            wrap.replaceWith(fallback);
        },
        { once: true }
    );
    container.appendChild(wrap);
}

function applyHomeFromCms() {
    const h = window.__CMS && window.__CMS.home;
    if (!h) {
        return;
    }
    const titleEl = document.querySelector(".flex-data .title");
    const nameEl = document.querySelector(".flex-data .name");
    const bioEl = document.getElementById("home-bio");
    if (h.title && titleEl) {
        titleEl.textContent = h.title;
    }
    if (h.name && nameEl) {
        nameEl.textContent = h.name;
    }
    if (h.bio && bioEl) {
        bioEl.textContent = h.bio;
    }
    const techWrap = document.getElementById("home-technologies");
    if (techWrap && Array.isArray(h.technologies)) {
        techWrap.innerHTML = "";
        h.technologies.forEach((t) => {
            const d = document.createElement("div");
            d.className = "tech-item";
            d.textContent = t;
            techWrap.appendChild(d);
        });
    }
    const svc = document.getElementById("home-services");
    if (svc && Array.isArray(h.services)) {
        svc.innerHTML = "";
        h.services.forEach((s) => {
            const tile = document.createElement("div");
            tile.className = "tile";
            tile.innerHTML = `<p class="tile-title">${escapeHtml(s.title)}</p>
                <p class="tile-subtitle">${escapeHtml(s.subtitle)}</p>
                <p class="tile-description">${escapeHtml(s.description)}</p>`;
            svc.appendChild(tile);
        });
    }
    const summ = document.getElementById("home-skill-summaries");
    if (summ && Array.isArray(h.skillSummaries)) {
        summ.innerHTML = "";
        h.skillSummaries.forEach((s) => {
            const tile = document.createElement("div");
            tile.className = "tile";
            tile.innerHTML = `<p class="tile-subtitle">${escapeHtml(s.subtitle)}</p>
                <p class="tile-description">${escapeHtml(s.description)}</p>`;
            summ.appendChild(tile);
        });
    }
}

function renderSkillsFromCms() {
    const list = window.__CMS && window.__CMS.skills;
    const mount = document.getElementById("skills-mount");
    if (!mount) {
        return;
    }
    mount.innerHTML = "";
    if (!list || !list.length) {
        mount.innerHTML =
            '<p class="cms-empty-msg">No skills list configured for this build.</p>';
        return;
    }
    list.forEach((s) => {
        const div = document.createElement("div");
        div.className = "skill";
        const imgSrc = normalizeAssetUrl(s.img);
        div.innerHTML =
            '<img src="' +
            escapeHtml(imgSrc) +
            '" alt="" class="card-img-top">' +
            '<div class="card-body">' +
            '<h5 class="card-title">' +
            escapeHtml(s.title) +
            "</h5>" +
            '<p class="card-subtitle">' +
            escapeHtml(s.subtitle) +
            "</p>" +
            '<h6 class="card-bottomTitle">' +
            escapeHtml(s.bottomTitle || "") +
            "</h6></div>";
        mount.appendChild(div);
    });
}

function loadHomePage(){
    applyHomeFromCms();
    const container = document.getElementById('feature-project');
    container.innerHTML = '';
    let filteredProjects = projects.filter(project => project.link.includes("github.com"));
    let count = 0;
    filteredProjects.forEach(project => {
        if(count>=4){
            return;
        }
        const thumb = normalizeThumbPath(project.thumbnail);
        const projectCard = `
       <div class="card" data-project-id="${project.id}">
       <div class="star-icon">
                <img src="/res/featured_icon.png" alt="Star Icon">
            </div>
            <img src="${thumb}" alt="Card Image" class="card-img-top">
            <div class="card-body">
                <h5 class="card-title">${escapeHtml(project.name)}</h5>
                <p class="card-subtitle">${escapeHtml(project.description)}</p>
            </div>
        </div>
        `;
        container.innerHTML += projectCard;
        count++
        
    });

      // Add click event listener to each card
     document.querySelectorAll('#feature-project .card').forEach(card => {
        card.addEventListener('click', (e) => {
            const projectId = e.currentTarget.dataset.projectId;
            openProjectDetail(projectId,"project pages/");
        });
    });

}

// Function to load project details (from the projectDetails.html page)
function loadProjectDetails() {
    const projectId = getQueryParam('projectId');
    const project = projects.find(p => p.id == projectId);

    if (project) {
        updateElementContent("project-year", project.projectYear, "Github: ");
        updateElementContent("project-name", project.name);
        updateElementContent("project-description", project.description);

        const firstImg =
            project.images && project.images.length ? project.images[0] : project.thumbnail;
        setThumbnail(firstImg);

        setLinkText(project.link);

        if (project.tags) {
            const tagsContainer = document.getElementById("project-tags");
            tagsContainer.innerHTML = "";
            project.tags.forEach((tag) => {
                const tagElement = document.createElement("div");
                tagElement.className = "tech-item";
                tagElement.textContent = tag;
                tagsContainer.appendChild(tagElement);
            });
        }

        const imagesContainer = document.getElementById("project-images");
        const imageTitle = document.getElementById("image-title");
        if (project.images && project.images.length) {
            imagesContainer.innerHTML = "";
            imagesContainer.style.display = "";
            if (imageTitle) {
                imageTitle.style.display = "";
            }
            project.images.forEach((imageUrl) => {
                const imgElement = document.createElement("img");
                imgElement.className = "card-img-top";
                imgElement.src = normalizeAssetUrl(imageUrl);
                imagesContainer.appendChild(imgElement);
            });
        } else {
            imagesContainer.innerHTML = "";
            imagesContainer.style.display = "none";
            if (imageTitle) {
                imageTitle.style.display = "none";
            }
        }

        const videosContainer = document.getElementById("project-videos");
        const videoTitle = document.getElementById("video-title");
        if (project.videos && project.videos.length) {
            videosContainer.innerHTML = "";
            videosContainer.style.display = "";
            if (videoTitle) {
                videoTitle.style.display = "";
            }
            project.videos.forEach((video) => appendProjectVideoEl(videosContainer, video));
        } else {
            videosContainer.innerHTML = "";
            videosContainer.style.display = "none";
            if (videoTitle) {
                videoTitle.style.display = "none";
            }
        }
    } else {
        console.error("Project not found!");
    }
}


function renderProjects(filteredProjects) {
    const projectContainer = document.querySelector(".card-container");
    if (!projectContainer) {
        return;
    }
    projectContainer.innerHTML = "";

    filteredProjects.forEach((project) => {
        const thumb = normalizeAssetUrl(project.thumbnail);
        const projectCard = `
            <div class="card" data-project-id="${project.id}">
                <img src="${escapeHtml(thumb)}" alt="" class="card-img-top">
                <div class="card-body">
                    <h5 class="card-Year">Github: ${escapeHtml(project.projectYear)}</h5>
                    <h5 class="card-title">${escapeHtml(project.name)}</h5>
                    <p class="card-subtitle">${escapeHtml(project.description)}</p>
                </div>
            </div>
        `;
        projectContainer.innerHTML += projectCard;
    });

     // Add click event listener to each card
     document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', (e) => {
            const projectId = e.currentTarget.dataset.projectId;
            openProjectDetail(projectId,"");
        });
    });


}

function filterProjects(category) {
    let filteredProjects;
    if (category === 'all') {
        filteredProjects = projects;
    } else {
        filteredProjects = projects.filter(project => project.category === category);
    }

    renderProjects(filteredProjects);
}

/** Navbar: Account page; label reflects site admin and/or practice session. */
function syncNavbarAuthUi() {
    const link = document.getElementById("nav-admin-entry");
    const signOut = document.getElementById("nav-admin-signout");
    const rsa = typeof dsaIsAdminSession === "function" && dsaIsAdminSession();
    const practice = typeof dsaIsPracticeUser === "function" && dsaIsPracticeUser();
    document.querySelectorAll('.nav-links a[href*="user-dashboard.html"]').forEach((a) => {
        const show =
            typeof dsaSiteFeatureUse !== "function" || dsaSiteFeatureUse("member_dashboard");
        a.hidden = !show;
        a.style.display = show ? "" : "none";
    });
    if (link) {
        link.removeAttribute("title");
        const authOn = typeof dsaSiteFeatureUse !== "function" || dsaSiteFeatureUse("practice_auth");
        if (!rsa && !authOn) {
            link.hidden = true;
            link.style.display = "none";
        } else {
            link.hidden = false;
            link.style.display = "";
            link.setAttribute("href", rsa ? "./admin.html" : "./account.html");
        }
        if (rsa && practice) {
            link.textContent = "Account";
            link.setAttribute("aria-label", "Account — site admin and practice user signed in");
        } else if (rsa) {
            link.textContent = "Admin";
            link.setAttribute("aria-label", "Open admin dashboard (site admin signed in)");
        } else if (practice) {
            link.textContent = "Account";
            link.setAttribute("aria-label", "Open account (practice user signed in)");
        } else {
            link.textContent = "Sign in";
            link.setAttribute("aria-label", "Sign in or create account");
        }
    }
    if (signOut) {
        signOut.hidden = !(rsa || practice);
    }
}

function wireNavbarAdmin() {
    const link = document.getElementById("nav-admin-entry");
    if (link) {
        link.setAttribute("href", "./account.html");
    }
    const signOut = document.getElementById("nav-admin-signout");
    if (signOut && signOut.dataset.wired !== "1") {
        signOut.dataset.wired = "1";
        signOut.addEventListener("click", () => {
            if (typeof dsaAdminSignOut === "function") {
                dsaAdminSignOut();
            }
            if (typeof dsaPracticeUserSignOut === "function") {
                dsaPracticeUserSignOut();
            }
            if (
                (document.getElementById("dsa-hierarchy-root") ||
                    document.getElementById("udash-dsa-hierarchy-root")) &&
                typeof loadDsaPatternsPage === "function"
            ) {
                loadDsaPatternsPage();
            }
            syncNavbarAuthUi();
        });
    }
    syncNavbarAuthUi();
}

window.syncNavbarAuthUi = syncNavbarAuthUi;

document.addEventListener("dsa-site-features-ready", function () {
    if (typeof syncNavbarAuthUi === "function") {
        syncNavbarAuthUi();
    }
});

const NAV_MOBILE_MQ = window.matchMedia("(max-width: 720px)");

/**
 * Apple-style sliding pill under the active segment.
 * Track: `position: relative`; first child `.dsa-seg-thumb`; active: `.dsa-view-btn--active` or `a.active`.
 */
function dsaSyncSegThumbTrack(track) {
    if (!track || !(track instanceof HTMLElement)) {
        return;
    }
    const thumb = track.querySelector(":scope > .dsa-seg-thumb");
    if (!thumb) {
        return;
    }
    const active =
        track.querySelector(".dsa-view-btn--active") ||
        track.querySelector("a.active") ||
        track.querySelector('[role="tab"][aria-selected="true"]');
    if (!active) {
        thumb.style.opacity = "0";
        return;
    }
    thumb.style.opacity = "1";
    const tr = track.getBoundingClientRect();
    const ar = active.getBoundingClientRect();
    const x = ar.left - tr.left;
    const y = ar.top - tr.top;
    thumb.style.width = `${Math.round(ar.width)}px`;
    thumb.style.height = `${Math.round(ar.height)}px`;
    thumb.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
}

/** Hamburger + slide-down panel on small screens; backdrop closes menu. */
function wireMobileNav() {
    const nav = document.querySelector("header.navbar") || document.querySelector("header.nav");
    if (!nav || nav.dataset.mobileNavWired === "1") {
        return;
    }
    let left = nav.querySelector(".left");
    let right = nav.querySelector(".right");
    if (!left) {
        left = nav.querySelector(".brand");
    }
    /* Index: .nav-links + .nav-auth are direct siblings of .brand (wrapped into .right for mobile). */
    if (!right && left) {
        const inner = nav.querySelector(".nav-inner");
        const links = nav.querySelector(".nav-links");
        const auth = nav.querySelector(".nav-auth");
        if (inner && links && auth && links.parentElement === inner && auth.parentElement === inner) {
            right = document.createElement("div");
            right.className = "right";
            inner.insertBefore(right, links);
            right.appendChild(links);
            right.appendChild(auth);
        }
    }
    if (!left || !right) {
        return;
    }
    nav.dataset.mobileNavWired = "1";

    function navMenuIsOpen() {
        return (
            nav.classList.contains("navbar--menu-open") || nav.classList.contains("nav--menu-open")
        );
    }

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "nav-mobile-toggle";
    toggle.setAttribute("aria-label", "Menu");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "nav-mobile-links");
    right.id = "nav-mobile-links";
    toggle.innerHTML =
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
    left.insertAdjacentElement("afterend", toggle);

    const backdrop = document.createElement("div");
    backdrop.className = "nav-mobile-backdrop";
    backdrop.hidden = true;
    document.body.appendChild(backdrop);

    function setMenuOpen(open) {
        nav.classList.toggle("navbar--menu-open", open);
        nav.classList.toggle("nav--menu-open", open);
        toggle.setAttribute("aria-expanded", open);
        toggle.setAttribute("aria-label", open ? "Close menu" : "Menu");
        backdrop.hidden = !open;
        document.body.classList.toggle("nav-mobile-menu-open", open);
    }

    function closeIfMobile() {
        if (NAV_MOBILE_MQ.matches) {
            setMenuOpen(false);
        }
    }

    toggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!NAV_MOBILE_MQ.matches) {
            return;
        }
        setMenuOpen(!navMenuIsOpen());
    });

    backdrop.addEventListener("click", () => closeIfMobile());

    right.addEventListener("click", (e) => {
        if (!NAV_MOBILE_MQ.matches) {
            return;
        }
        const go =
            e.target.closest("a") ||
            (e.target.closest(".nav-signout-btn") ? e.target.closest(".nav-signout-btn") : null);
        if (go) {
            setMenuOpen(false);
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && navMenuIsOpen()) {
            setMenuOpen(false);
        }
    });

    const mqChange = () => {
        if (!NAV_MOBILE_MQ.matches) {
            setMenuOpen(false);
        }
    };
    if (typeof NAV_MOBILE_MQ.addEventListener === "function") {
        NAV_MOBILE_MQ.addEventListener("change", mqChange);
    } else if (typeof NAV_MOBILE_MQ.addListener === "function") {
        NAV_MOBILE_MQ.addListener(mqChange);
    }
}

/** Register a page view and show total in #footer-visitors (public pages only). */
async function footerVisitorsHit() {
    const el = document.getElementById("footer-visitors");
    if (!el) return;
    if (typeof dsaSiteFeatureUse === "function" && !dsaSiteFeatureUse("footer_visit_counter")) {
        el.hidden = true;
        return;
    }
    try {
        const r = await fetch(new URL("api/visitors", window.location.href).href, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
        });
        if (!r.ok) throw new Error("visitors api");
        const data = await r.json();
        if (typeof data.visits === "number") {
            const numEl = document.getElementById("footer-visitors-num");
            if (numEl) {
                numEl.textContent = data.visits.toLocaleString();
            } else {
                el.textContent = String(data.visits.toLocaleString());
            }
            el.hidden = false;
        } else {
            el.hidden = true;
        }
    } catch {
        el.hidden = true;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof dsaEnsureSiteFeaturesLoaded === "function") {
        await dsaEnsureSiteFeaturesLoaded();
    }

    if (typeof cmsBootstrap === "function") {
        await cmsBootstrap();
        projects = window.__CMS.projects || [];
    }

    if (typeof dsaInitAdminAuth === "function") {
        await dsaInitAdminAuth();
    }
    wireNavbarAdmin();
    wireMobileNav();
    footerVisitorsHit();
    dsaWireIndexMapToolbarStatic();

    if (document.getElementById("dsa-hierarchy-root")) {
        /* DSA page — use DOM, not pathname (encoded paths / some hosts break includes("dsa-patterns.html")). */
        await dsaLoadHierarchyFromSources();
        dsaInitUserData()
            .then(() =>
                typeof dsaInitAdminAuth === "function" ? dsaInitAdminAuth() : Promise.resolve(false)
            )
            .then(() => loadDsaPatternsPage())
            .then(() => {
                try {
                    const u = new URL(window.location.href);
                    if (u.searchParams.has("published")) {
                        u.searchParams.delete("published");
                        const q = u.searchParams.toString();
                        window.history.replaceState(null, "", u.pathname + (q ? "?" + q : "") + u.hash);
                    }
                } catch (e) {
                    /* ignore */
                }
            });
    } else if (document.getElementById("udash-dsa-hierarchy-root")) {
        dsaMergeGraphMount({
            viewportId: "udash-dsa-hierarchy-root",
            mapToolbarHostId: "udash-dsa-map-toolbar-host",
            shellToolbarId: null,
        });
        await dsaLoadHierarchyFromSources();
        await dsaInitUserData();
        if (typeof dsaInitAdminAuth === "function") {
            await dsaInitAdminAuth();
        }
        loadDsaPatternsPage();
    } else if (document.body.classList.contains("projects-page")) {
        filterProjects("all");
        const menuItems = document.querySelectorAll(".menu-item");
        menuItems.forEach((menuItem) => {
            menuItem.addEventListener("click", (e) => {
                e.preventDefault();
                menuItems.forEach((item) => item.classList.remove("active"));
                menuItem.classList.add("active");
            });
        });
        const allBtn = document.getElementById("allProjects");
        if (allBtn) {
            allBtn.classList.add("active");
        }
    } else if (document.body.classList.contains("skills-page")) {
        renderSkillsFromCms();
    } else if (document.body.classList.contains("details-page")) {
        loadProjectDetails();
    } else if (document.body.classList.contains("pricing-page")) {
        /* Marketing plans page — shared nav/auth only. */
    } else if (
        window.location.pathname.includes("account.html") ||
        window.location.pathname.includes("admin.html") ||
        /\/(account|admin)\/?$/.test(window.location.pathname || "")
    ) {
        /* Account / CMS page — inline scripts on that HTML */
    } else {
        loadHomePage();
    }
    
});


