let projects = [];


/** Data structure → nested tree OR flat patterns (see getDsTree). Loaded from D1 only (`/api/data?k=dsa`). */
let dsaHierarchy = [];

const DSA_HIERARCHY_MINIMAL = [
    {
        id: "placeholder",
        name: "DSA Patterns",
        tree: [{ name: "No graph data yet — save key dsa in admin (CMS)", problems: [] }],
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
    shellToolbarId: "dsa-shell-view-toolbar",
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
        shellToolbarId: "dsa-shell-view-toolbar",
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
    return t === "branch" || t === "group" || t === "pattern";
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

function dsaTryApplyOneUserNode(clone, e) {
    const { parentKey, type, name, url, id } = e;
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
            clone.push({ id, name: name.trim(), tree: [] });
            return true;
        }
        return true;
    }
    const { parentNode, topArray } = resolved;
    const isQuestion = dsaUserPayloadIsProblemEntry({ type });
    const isBranch = type === "branch" || type === "group" || type === "pattern";

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
        const newNode = { name: nm, children: [] };
        if (!parentNode) {
            if (topArray.some((n) => n && String(n.name || "").trim() === nm)) {
                return true;
            }
            topArray.push(newNode);
            return true;
        }
        if (!parentNode.children) {
            parentNode.children = [];
        }
        if (parentNode.children.some((n) => n && String(n.name || "").trim() === nm)) {
            return true;
        }
        parentNode.children.push(newNode);
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
 * Each node (and each DS) may list either nested `children` or `problems`, not both.
 * If both exist (legacy data), keep `children` and drop `problems` on that holder.
 */
function dsaNormalizeExclusiveChildKindOnNode(node) {
    if (!node || typeof node !== "object") {
        return;
    }
    const ch = Array.isArray(node.children) ? node.children : [];
    const probs = Array.isArray(node.problems) ? node.problems : [];
    if (ch.length > 0 && probs.length > 0) {
        node.problems = [];
    }
    ch.forEach((c) => dsaNormalizeExclusiveChildKindOnNode(c));
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

/** For add-modal: whether the parent already holds subnodes vs problems (mutually exclusive). */
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
    const probs = Array.isArray(n.problems) ? n.problems : [];
    return { hasSubnodes: ch.length > 0, hasProblems: probs.length > 0 };
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
    dsaUserPayload.nodes.push({
        id,
        parentKey: entry.parentKey,
        type: entry.type,
        name: entry.name.trim(),
        url: (entry.url || "").trim(),
    });
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
    return {
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
    const r = dsaResolveProblemPlatform(url);
    if (r) {
        return r.label;
    }
    const h = getUrlHost(dsaNormalizeProblemUrlForPlatform(String(url || "").trim()));
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

/** Local `res/dsa-platforms/*.svg` — no remote fetch; icons ship with the site. */
function dsaStaticPlatformIconUrl(filename) {
    const path = `res/dsa-platforms/${filename}`;
    const qs = "v=4";
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
 * Map problem URL → static filename (LeetCode, GfG, Coding Ninjas only; else generic link.svg).
 * LeetCode: `leetcode.png` (Wikimedia LeetCode_logo_black). GfG: `gfg.png` (GeeksforGeeks CDN mark, bundled in res).
 */
function dsaStaticPlatformIconFilename(url) {
    const normalized = dsaNormalizeProblemUrlForPlatform(String(url || "").trim());
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
            return "codingninjas.svg";
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
        return "codingninjas.svg";
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
    const btnExpandAll = document.createElement("button");
    btnExpandAll.type = "button";
    btnExpandAll.className = "btn dsa-graph-expand-btn";
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
    btnCollapseAll.className = "btn dsa-graph-expand-btn";
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
 */
function dsaCreateGraphCanvasLayout(toolbarMountParent) {
    const canvas = document.createElement("div");
    canvas.className = "dsa-mind-canvas";
    canvas.id = "dsa-mind-canvas";

    const toolbar = document.createElement("div");
    toolbar.className = "dsa-graph-map-toolbar";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "Graph map controls");

    const toolbarExpand = document.createElement("div");
    toolbarExpand.className = "dsa-graph-map-toolbar-cluster";
    const toolbarZoom = document.createElement("div");
    toolbarZoom.className = "dsa-graph-map-toolbar-cluster dsa-graph-map-toolbar-cluster--zoom";

    let toolbarHintSlot = null;
    if (toolbarMountParent instanceof HTMLElement) {
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

    const body = document.createElement("div");
    body.className = "dsa-mind-canvas-body";
    body.id = "dsa-mind-canvas-body";

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
        dsaOpenCustomizeUnifiedModal(pathKey, refresh);
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
 * Platform badge: local `<img src="…/res/dsa-platforms/*.svg">`.
 * Do not use `loading="lazy"`: problem rows often live under `.dsa-h-children--collapsed { display: none }`;
 * lazy-loaded images in hidden subtrees frequently never start loading, so users only see the gray box.
 */
function appendPlatformIcon(container, url) {
    container.classList.add("dsa-h-platform-icon");
    while (container.firstChild) {
        container.removeChild(container.firstChild);
    }
    const file = dsaStaticPlatformIconFilename(url);
    const img = document.createElement("img");
    img.className = "dsa-h-platform-icon-img";
    img.alt = "";
    img.width = 22;
    img.height = 22;
    img.decoding = "async";
    img.setAttribute("aria-hidden", "true");
    img.src = dsaStaticPlatformIconUrl(file);
    container.appendChild(img);
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
function dsaFillProblemSolutionPane(prob, pane) {
    pane.innerHTML = "";
    pane.classList.add("dsa-h-prob-pane--solution");
    const solRows = [...dsaFilteredSolutionRows(prob)].sort(
        (a, b) => dsaSolutionApproachRank(a) - dsaSolutionApproachRank(b),
    );
    if (!solRows.length) {
        return;
    }

    const root = document.createElement("div");
    root.className = "dsa-h-sol-modern";

    const heading = document.createElement("p");
    heading.className = "dsa-h-sol-heading";
    heading.textContent = "Select an approach to view the solution code.";

    const chipsRow = document.createElement("div");
    chipsRow.className = "dsa-h-sol-chips";
    chipsRow.setAttribute("role", "tablist");
    chipsRow.setAttribute("aria-label", "Solution approaches");

    const codeHost = document.createElement("div");
    codeHost.className = "dsa-h-sol-code-host";

    const placeholder = document.createElement("div");
    placeholder.className = "dsa-h-sol-code-placeholder";
    placeholder.textContent = "Code will appear here.";
    codeHost.appendChild(placeholder);

    function runPrismOnHost() {
        const preBlock = codeHost.querySelector(".dsa-h-prob-code");
        if (preBlock) {
            requestAnimationFrame(() => dsaHighlightProbSolutionCode(preBlock));
        }
    }

    function selectIndex(idx) {
        chipsRow.querySelectorAll(".dsa-h-sol-chip").forEach((chip, i) => {
            const on = i === idx;
            chip.classList.toggle("dsa-h-sol-chip--active", on);
            chip.setAttribute("aria-selected", on ? "true" : "false");
            chip.tabIndex = on ? 0 : -1;
        });
        codeHost.innerHTML = "";
        codeHost.classList.remove("dsa-h-sol-code-host--idle");
        const sol = solRows[idx];
        const codeStr = sol && sol.code != null ? String(sol.code).trim() : "";
        if (!codeStr) {
            const noCode = document.createElement("div");
            noCode.className = "dsa-h-sol-no-code";
            noCode.textContent = "No code stored for this approach.";
            codeHost.appendChild(noCode);
            return;
        }
        const pre = document.createElement("pre");
        pre.className = "dsa-h-prob-code";
        const codeEl = document.createElement("code");
        codeEl.className = "dsa-h-prob-code-inner";
        codeEl.textContent = codeStr;
        pre.appendChild(codeEl);
        codeHost.appendChild(pre);
        runPrismOnHost();
    }

    solRows.forEach((sol, idx) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "dsa-h-sol-chip";
        chip.setAttribute("role", "tab");
        chip.setAttribute("aria-selected", "false");
        chip.tabIndex = -1;
        const apprLab = dsaSolutionCategoryLabel(dsaNormalizeSolutionCategory(sol.approach));
        const title = apprLab || `Solution ${idx + 1}`;
        const tc = sol.timeComplexity ? String(sol.timeComplexity).trim() : "";
        const sc = sol.spaceComplexity ? String(sol.spaceComplexity).trim() : "";

        const titleEl = document.createElement("span");
        titleEl.className = "dsa-h-sol-chip__title";
        titleEl.textContent = title;

        const metaEl = document.createElement("div");
        metaEl.className = "dsa-h-sol-chip__meta";
        if (tc) {
            const t = document.createElement("span");
            t.className = "dsa-h-sol-chip__pill dsa-h-sol-chip__pill--time";
            t.textContent = tc;
            metaEl.appendChild(t);
        }
        if (sc) {
            const s = document.createElement("span");
            s.className = "dsa-h-sol-chip__pill dsa-h-sol-chip__pill--space";
            s.textContent = sc;
            metaEl.appendChild(s);
        }

        chip.appendChild(titleEl);
        if (metaEl.children.length) {
            chip.appendChild(metaEl);
        }
        chip.addEventListener("click", () => selectIndex(idx));
        chipsRow.appendChild(chip);
    });

    codeHost.classList.add("dsa-h-sol-code-host--idle");
    root.appendChild(heading);
    root.appendChild(chipsRow);
    root.appendChild(codeHost);
    pane.appendChild(root);
}

function dsaFillProblemResourcesPane(prob, pane) {
    pane.innerHTML = "";
    pane.classList.add("dsa-h-prob-pane--resources");
    const drawing = prob && prob.drawing ? String(prob.drawing).trim() : "";
    const image = prob && prob.image ? String(prob.image).trim() : "";

    if (drawing) {
        const sec = document.createElement("section");
        sec.className = "dsa-h-res-sec";
        const h = document.createElement("h5");
        h.className = "dsa-h-res-sec-title";
        h.textContent = "Sketch";
        sec.appendChild(h);
        const im = document.createElement("img");
        im.src = drawing;
        im.alt = "Sketch";
        im.className = "dsa-h-prob-pane-img";
        sec.appendChild(im);
        pane.appendChild(sec);
    }

    if (image) {
        const sec = document.createElement("section");
        sec.className = "dsa-h-res-sec";
        const h = document.createElement("h5");
        h.className = "dsa-h-res-sec-title";
        h.textContent = "Image";
        sec.appendChild(h);
        const im = document.createElement("img");
        im.src = image;
        im.alt = "Image";
        im.className = "dsa-h-prob-pane-img";
        sec.appendChild(im);
        pane.appendChild(sec);
    }
}

function buildProblemListItem(prob, probCtx) {
    const li = document.createElement("li");
    li.className = "dsa-h-problem-li";

    const mainRow = document.createElement("div");
    mainRow.className = "dsa-h-problem-main";
    const isAdminViewer = !!(probCtx && probCtx.isAdmin === true);

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
            doneWrap.setAttribute("aria-label", doneInput.checked ? "Problem marked done" : "Mark problem done");
            doneInput.setAttribute("aria-label", doneInput.checked ? "Marked done" : "Mark done");
            dsaToggleProblemDone(probCtx.parentKey, prob, probCtx.refresh);
        });
    }
    doneWrap.appendChild(doneInput);
    mainRow.appendChild(doneWrap);

    const isStarred = dsaIsProblemMarkedImportant(prob);
    const canToggleStar =
        isAdminViewer && probCtx && probCtx.parentKey && typeof probCtx.refresh === "function";
    if (isAdminViewer) {
        const starBtn = document.createElement("button");
        starBtn.type = "button";
        starBtn.className = "dsa-h-prob-star-toggle";
        const setStarBtnState = (on) => {
            starBtn.classList.toggle("dsa-h-prob-star-toggle--on", !!on);
            starBtn.setAttribute("aria-pressed", on ? "true" : "false");
            starBtn.setAttribute("aria-label", on ? "Starred problem. Click to unstar" : "Mark problem as starred");
            starBtn.title = on ? "Starred (click to unstar)" : "Mark as starred";
        };
        setStarBtnState(isStarred);
        if (!canToggleStar) {
            starBtn.disabled = true;
        }
        starBtn.appendChild(dsaSvgIconStar());
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
                        emptyNote.textContent = "No starred problems yet for this topic.";
                    }
                } else if (emptyNote) {
                    emptyNote.hidden = true;
                }
            });
        }
        mainRow.appendChild(starBtn);
    }

    const a = document.createElement("a");
    a.className = "dsa-h-problem-link";
    const rawUrl = prob && prob.url != null ? String(prob.url).trim() : "";
    const href = rawUrl ? dsaNormalizeProblemUrlForPlatform(rawUrl) : "#";
    a.href = href || "#";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.title = `${prob.name} — ${getPlatformLabel(href)}`;

    const icon = document.createElement("span");
    appendPlatformIcon(icon, href);

    const text = document.createElement("span");
    text.className = "dsa-h-problem-link-text";
    text.textContent = prob.name;
    a.appendChild(icon);
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

    if (adminEdit) {
        const openOpts = {
            editQuestionName: prob && prob.name ? String(prob.name) : "",
            editUserNodeId: prob && prob.userNodeId ? String(prob.userNodeId) : "",
        };
        const btnEdit = document.createElement("button");
        btnEdit.type = "button";
        btnEdit.className = "dsa-h-prob-edit";
        btnEdit.setAttribute("aria-label", "Edit problem");
        btnEdit.title = "Edit problem";
        btnEdit.appendChild(dsaSvgIconPencil());
        btnEdit.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            dsaOpenCustomizeUnifiedModal(probCtx.parentKey, probCtx.refresh, openOpts);
        });
        mainRow.appendChild(btnEdit);

        const btnDel = document.createElement("button");
        btnDel.type = "button";
        btnDel.className = "dsa-h-prob-delete";
        btnDel.setAttribute("aria-label", "Remove problem from this topic");
        btnDel.title = "Remove this problem from the map (asks for confirmation)";
        btnDel.appendChild(dsaSvgIconTrashBin());
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
        mainRow.appendChild(btnDel);
    }

    const readerExtras =
        probCtx &&
        probCtx.parentKey &&
        !adminEdit &&
        (probCtx.viewExtras === true || probCtx.isAdmin === false);

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
            dsaIsLikelyYoutubeUrl(solutionVideoUrlRaw) ? dsaSvgIconYoutube() : dsaSvgIconExternalVideo(),
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
        if (adminEdit) {
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
        const setToggleGlyph = (expanded) => {
            icWrap.replaceChildren(expanded ? dsaProbToggleIconRevealed(key) : dsaProbToggleIconHidden(key));
        };
        setToggleGlyph(false);
        btn.appendChild(icWrap);

        const pane = document.createElement("div");
        pane.className = "dsa-h-prob-pane";
        pane.dataset.key = key;
        pane.hidden = true;
        if (key === "companies") {
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
        } else if (key === "resources") {
            dsaFillProblemResourcesPane(prob, pane);
        } else {
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
            btn.setAttribute("aria-expanded", String(nowOpen));
            btn.classList.toggle("dsa-h-prob-toggle--open", nowOpen);
            pane.hidden = !nowOpen;
            setToggleGlyph(nowOpen);
            btn.setAttribute(
                "aria-label",
                nowOpen ? `${label} — visible, click to hide` : `${label} — hidden, click to show`,
            );
            btn.title = nowOpen ? `${label} (visible)` : `${label} (hidden)`;
            if (nowOpen && key === "resources") {
                requestAnimationFrame(() => {
                    pane.querySelectorAll(".dsa-h-prob-code").forEach((preBlock) => {
                        dsaHighlightProbSolutionCode(preBlock);
                    });
                });
            }
            if (nowOpen && key === "solution") {
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

    if (readerExtras && bar.children.length > 0) {
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
            const showOpenEye = anyPaneOpen;
            btnEye.replaceChildren(showOpenEye ? dsaSvgIconEye() : dsaSvgIconEyeOff());
            btnEye.classList.toggle("dsa-h-prob-eye--all-visible", showOpenEye);
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
        mainRow.appendChild(wrap);
        li.appendChild(mainRow);
        li.appendChild(reveal);
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
                  refresh: ctx.refresh,
                  isAdmin: ctx.isAdmin,
              }
            : ve
              ? {
                    viewExtras: true,
                    pathKey: `${pathKey}::${ch.name}`,
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
                    ? { parentKey: pathKey, refresh: ctx.refresh, isAdmin: ctx.isAdmin }
                    : ve
                      ? { viewExtras: true, parentKey: pathKey, refresh: ctx.refresh }
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
        const cardTitle = document.createElement("div");
        cardTitle.className = "dsa-h-problems-card-title";
        cardTitle.textContent = "Practice problems";

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

        function resetProblemToolsUi() {
            searchQuery = "";
            toolsUiOpen = false;
            activeDifficultyFilters.clear();
            if (searchInputEl) {
                searchInputEl.value = "";
            }
            if (toolsPanelEl) {
                toolsPanelEl.hidden = true;
            }
            if (toolsToggleBtn) {
                toolsToggleBtn.classList.remove("dsa-h-problems-tools-tab--open");
                toolsToggleBtn.classList.remove("dsa-h-problems-tools-tab--active");
                toolsToggleBtn.setAttribute("aria-expanded", "false");
                toolsToggleBtn.title = "Search and filter";
            }
            activeFilterMode = "important";
        }

        const btnCloseCard = document.createElement("button");
        btnCloseCard.type = "button";
        btnCloseCard.className = "dsa-h-problems-card-close";
        btnCloseCard.setAttribute("aria-label", "Close practice problems");
        btnCloseCard.title = "Close";
        btnCloseCard.appendChild(dsaSvgIconClose());
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
            btnDelAll.appendChild(dsaSvgIconTrashBin());
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

        cardHead.appendChild(cardTitle);
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
        btnImportantIcon.appendChild(dsaSvgIconStar());
        const btnImportantText = document.createElement("span");
        btnImportantText.className = "dsa-h-problems-filter-tab-text";
        btnImportantText.textContent = "Star";
        btnImportant.appendChild(btnImportantIcon);
        btnImportant.appendChild(btnImportantText);
        const btnAll = document.createElement("button");
        btnAll.type = "button";
        btnAll.className = "dsa-h-problems-filter-tab dsa-h-problems-filter-tab--all";
        btnAll.setAttribute("aria-label", "Show all problems");
        btnAll.setAttribute("role", "tab");
        btnAll.setAttribute("aria-selected", "false");
        const btnAllIcon = document.createElement("span");
        btnAllIcon.className = "dsa-h-problems-filter-tab-icon";
        btnAllIcon.appendChild(dsaSvgIconListBullets());
        const btnAllText = document.createElement("span");
        btnAllText.className = "dsa-h-problems-filter-tab-text";
        btnAllText.textContent = "All";
        btnAll.appendChild(btnAllIcon);
        btnAll.appendChild(btnAllText);
        const controlsRow = document.createElement("div");
        controlsRow.className = "dsa-h-problems-controls-row";
        toolsToggleBtn = document.createElement("button");
        toolsToggleBtn.type = "button";
        toolsToggleBtn.className = "dsa-h-problems-tools-tab";
        toolsToggleBtn.setAttribute("aria-label", "Search and filter problems");
        toolsToggleBtn.setAttribute("aria-expanded", "false");
        toolsToggleBtn.title = "Search and filter";
        const toolsSearchIcon = document.createElement("span");
        toolsSearchIcon.className = "dsa-h-problems-tools-tab-icon";
        toolsSearchIcon.appendChild(dsaSvgIconSearch());
        const toolsFilterIcon = document.createElement("span");
        toolsFilterIcon.className = "dsa-h-problems-tools-tab-icon";
        toolsFilterIcon.appendChild(dsaSvgIconFilterFunnel());
        toolsToggleBtn.appendChild(toolsSearchIcon);
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
        searchInputEl = document.createElement("input");
        searchInputEl.type = "search";
        searchInputEl.className = "dsa-h-problems-tools-search-input";
        searchInputEl.placeholder = "Search problem…";
        searchInputEl.setAttribute("aria-label", "Search practice problems");
        toolsPanelEl.appendChild(searchInputEl);
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
            ? { parentKey: pathKey, refresh: ctx.refresh, isAdmin: ctx.isAdmin }
            : ve
              ? { viewExtras: true, parentKey: pathKey, refresh: ctx.refresh }
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
            }
            const resultList = byDifficulty;
            if (!resultList.length) {
                emptyListNote.hidden = false;
                if (q) {
                    emptyListNote.textContent = `No problems found for "${searchQuery.trim()}".`;
                } else if (activeDifficultyFilters.size > 0) {
                    emptyListNote.textContent = "No problems match selected difficulty filter(s).";
                } else {
                    emptyListNote.textContent = showImportant
                        ? "No starred problems yet for this topic."
                        : "No practice problems found.";
                }
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
            toolsUiOpen = !toolsUiOpen;
            toolsPanelEl.hidden = !toolsUiOpen;
            toolsToggleBtn.classList.toggle("dsa-h-problems-tools-tab--open", toolsUiOpen);
            toolsToggleBtn.setAttribute("aria-expanded", toolsUiOpen ? "true" : "false");
            toolsToggleBtn.title = toolsUiOpen ? "Hide search and filter" : "Search and filter";
            if (toolsUiOpen) {
                searchInputEl.focus();
                searchInputEl.select();
            }
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

/** All data structures under one “DSA Patterns” root (full map). */
function buildUnifiedMindmapTree(panel, scheduleRedraw, customizeCtx, graphRefreshForView) {
    const merged = getDsaHierarchyMerged();
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
    rootTitle.textContent = "DSA Patterns";

    const topicNodes = merged.map((ds) => ({
        name: ds.name,
        children: getDsTree(ds),
        problems: Array.isArray(ds.problems) ? ds.problems : [],
    }));

    const topicThemes = merged.map((ds) => dsaStableThemeForKey(ds.id));

    const kids = document.createElement("div");
    kids.className = "dsa-h-children";
    kids.dataset.dsaPath = "__DSA_META__";
    topicNodes.forEach((node, i) => {
        const ds = merged[i];
        const ctx = customizeCtx
            ? {
                  customize: true,
                  pathKey: ds.id,
                  refresh: customizeCtx.refresh,
                  isDsRoot: true,
                  isAdmin: customizeCtx.isAdmin,
              }
            : {
                  viewExtras: true,
                  pathKey: ds.id,
                  refresh: graphRefreshForView,
              };
        kids.appendChild(buildTreeNode(node, 1, panel, scheduleRedraw, topicThemes[i], ctx));
    });

    const rootCount = topicNodes.length;
    let rootBadgeEl;
    if (customizeCtx) {
        rootBadgeEl = createCustomizeClockBadge({
            count: rootCount,
            kindClass: "dsa-h-badge--root",
            pathKey: "__DSA_META__",
            nodeName: "DSA Patterns",
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
        });
    } else {
        rootBadgeEl = createExpandableCountBadge(rootCount, "dsa-h-badge--root");
        wireRootHubTopicToggle(rootBadgeEl, kids, rootCount, "DSA Patterns", scheduleRedraw);
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
        tp.replaceChildren();
    }
    const { canvas, toolbarExpand, toolbarZoom, body } = dsaCreateGraphCanvasLayout(
        tp instanceof HTMLElement ? tp : null,
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


/**
 * DSA problem sketch — native 2D canvas. Load dsa-sketch-native.js before script.js.
 * @param {HTMLElement} editorRoot
 * @param {() => void} onChange
 * @param {{ afterClear?: () => void; admin?: boolean }} [sketchOpts]
 */
function dsaWireSketchEditor(editorRoot, onChange, sketchOpts) {
    if (typeof dsaWireSketchEditorNative !== "function") {
        console.error("DSA: Native sketch not loaded. Include dsa-sketch-native.js before script.js.");
        const err = document.createElement("div");
        err.className = "dsa-sketch-missing-fabric";
        err.setAttribute("role", "alert");
        err.style.cssText =
            "padding:10px 12px;border:1px solid #fca5a5;border-radius:8px;background:#fef2f2;color:#991b1b;font-size:0.85rem;margin-bottom:8px;";
        err.textContent = "Sketch unavailable: add dsa-sketch-native.js before script.js on this page.";
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
    let syncEntryKey = "";

    const backdrop = document.createElement("div");
    backdrop.className = "dsa-dialog-backdrop";

    const dlg = document.createElement("div");
    dlg.className = "dsa-dialog dsa-dialog--question dsa-dialog--unified";
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.setAttribute("data-dsa-question-ui", "unified-v3");

    const title = document.createElement("h3");
    title.className = "dsa-dialog-title";
    title.textContent =
        editQuestionName || editUserNodeId
            ? isAdmin
                ? "Edit problem"
                : "Problem details"
            : isMetaRoot
              ? "Add data structure"
              : "Add to graph";

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
    catLeg.textContent = "Category";
    const rowCat = document.createElement("div");
    rowCat.className = "dsa-u-cat-row";
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
    if (isMetaRoot && addingNewItem) {
        catFs.hidden = true;
        catFs.setAttribute("aria-hidden", "true");
    }
    if (!isMetaRoot && addingNewItem && kindFlags.hasSubnodes) {
        radQ.hidden = true;
        labQ.hidden = true;
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

    const nodeBlock = document.createElement("div");
    nodeBlock.className = "dsa-u-node";
    const nodeLabEl = document.createElement("label");
    nodeLabEl.className = "dsa-field-label";
    nodeLabEl.setAttribute("for", "dsa-node-only");
    nodeLabEl.appendChild(document.createTextNode("Node label "));
    const nodeReqStar = document.createElement("span");
    nodeReqStar.className = "dsa-req";
    nodeReqStar.setAttribute("aria-hidden", "true");
    nodeReqStar.textContent = "*";
    nodeLabEl.appendChild(nodeReqStar);
    const nodeIn = document.createElement("input");
    nodeIn.type = "text";
    nodeIn.id = "dsa-node-only";
    nodeIn.className = "dsa-field-control";
    nodeIn.placeholder = "Node label";
    nodeIn.autocomplete = "off";
    nodeBlock.appendChild(nodeLabEl);
    nodeBlock.appendChild(nodeIn);
    if (isMetaRoot && addingNewItem) {
        const metaNote = document.createElement("p");
        metaNote.className = "dsa-dialog-note dsa-meta-root-add-note";
        metaNote.textContent =
            "DSA Patterns only lists data-structure topics. Add a problem under a topic (e.g. Arrays), not on this root.";
        nodeBlock.appendChild(metaNote);
    }

    const qBlock = document.createElement("div");
    qBlock.className = "dsa-u-question";

    const nameField = document.createElement("div");
    nameField.className = "dsa-q-field";
    const nameLabEl = document.createElement("label");
    nameLabEl.className = "dsa-field-label";
    nameLabEl.setAttribute("for", "dsa-q-name");
    nameLabEl.appendChild(document.createTextNode("Problem label "));
    const nameReqStar = document.createElement("span");
    nameReqStar.className = "dsa-req";
    nameReqStar.setAttribute("aria-hidden", "true");
    nameReqStar.textContent = "*";
    nameLabEl.appendChild(nameReqStar);

    const nameIn = document.createElement("input");
    nameIn.type = "text";
    nameIn.id = "dsa-q-name";
    nameIn.className = "dsa-field-control";
    nameIn.placeholder = "e.g. Two Sum";
    nameIn.autocomplete = "off";
    nameIn.readOnly = !!(editQuestionName || editUserNodeId);
    nameIn.setAttribute("aria-required", "true");
    nameField.appendChild(nameLabEl);
    nameField.appendChild(nameIn);

    const urlField = document.createElement("div");
    urlField.className = "dsa-q-field";
    const urlLabEl = document.createElement("label");
    urlLabEl.className = "dsa-field-label dsa-field-label--optional";
    urlLabEl.setAttribute("for", "dsa-q-url");
    urlLabEl.textContent = "Link";

    const urlIn = document.createElement("input");
    urlIn.type = "url";
    urlIn.id = "dsa-q-url";
    urlIn.className = "dsa-field-control";
    urlIn.placeholder = "https://… (optional)";
    urlIn.setAttribute("inputmode", "url");
    urlField.appendChild(urlLabEl);
    urlField.appendChild(urlIn);

    const existingCard = document.createElement("div");
    existingCard.className = "dsa-q-existing";
    existingCard.hidden = true;
    existingCard.setAttribute("aria-live", "polite");

    const qHint = document.createElement("p");
    qHint.className = "dsa-q-intro";
    qHint.textContent = editQuestionName
        ? "Details: hints, companies, and a read-only summary. Video link is on the problem row. Resources: solutions (+), sketch, image. Non-admins can view only."
        : "Details: hints, companies, and what is already saved. Video link is on the problem row. Resources: solutions (use +), sketch, and image.";

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
        wrap.className = "dsa-q-section-icon";
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "24");
        svg.setAttribute("height", "24");
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
        b.className = "dsa-q-section-clear-btn";
        b.setAttribute("aria-label", ariaLabel);
        b.title = titleText;
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "18");
        svg.setAttribute("height", "18");
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
        sec.className = "dsa-q-section";
        const head = document.createElement("div");
        head.className = "dsa-q-section-head";
        head.appendChild(makeSectionIcon(svgPaths));
        const h = document.createElement("h4");
        h.className = "dsa-q-section-title";
        h.textContent = title;
        head.appendChild(h);
        const headActions = document.createElement("div");
        headActions.className = "dsa-q-section-head-actions";
        if (typeof buildActions === "function") {
            buildActions(headActions);
        }
        head.appendChild(headActions);
        const body = document.createElement("div");
        body.className = "dsa-q-section-body";
        sec.appendChild(head);
        sec.appendChild(body);
        return { sec, body, headActions };
    }

    const hintTa = document.createElement("textarea");
    hintTa.className = "dsa-field-control dsa-q-hint";
    hintTa.rows = 4;
    hintTa.placeholder = "Hint / notes (admin; shown behind ? on the problem row)";
    hintTa.setAttribute("aria-label", "Hint / notes");

    const sketchEditorRoot = document.createElement("div");
    sketchEditorRoot.className = "dsa-sketch-editor-host";

    const drawRow = document.createElement("div");
    drawRow.className = "dsa-q-draw-row dsa-q-sketch-zoom-row";
    drawRow.hidden = !isEditProblem;
    const btnZoomOut = document.createElement("button");
    btnZoomOut.type = "button";
    btnZoomOut.className = "dsa-dialog-btn dsa-dialog-btn--ghost dsa-q-sketch-zoom";
    btnZoomOut.textContent = "−";
    btnZoomOut.setAttribute("aria-label", "Zoom sketch out");
    btnZoomOut.title = "Zoom out";
    btnZoomOut.hidden = !isEditProblem;
    const btnZoomIn = document.createElement("button");
    btnZoomIn.type = "button";
    btnZoomIn.className = "dsa-dialog-btn dsa-dialog-btn--ghost dsa-q-sketch-zoom";
    btnZoomIn.textContent = "+";
    btnZoomIn.setAttribute("aria-label", "Zoom sketch in");
    btnZoomIn.title = "Zoom in";
    btnZoomIn.hidden = !isEditProblem;

    const fileIn = document.createElement("input");
    fileIn.type = "file";
    fileIn.accept = "image/*";
    fileIn.hidden = true;
    fileIn.setAttribute("aria-hidden", "true");

    const imagePreview = document.createElement("div");
    imagePreview.className = "dsa-q-image-preview";

    const imageActions = document.createElement("div");
    imageActions.className = "dsa-q-image-actions";

    const btnPickImage = document.createElement("button");
    btnPickImage.type = "button";
    btnPickImage.className = "dsa-q-pick-image-btn";
    btnPickImage.textContent = "Choose image";

    const btnPasteImage = document.createElement("button");
    btnPasteImage.type = "button";
    btnPasteImage.className = "dsa-q-paste-image-btn dsa-q-paste-image-btn--icon";
    btnPasteImage.title = "Paste from clipboard (or use Ctrl/Cmd+V in this dialog)";
    btnPasteImage.setAttribute("aria-label", "Paste image from clipboard");
    btnPasteImage.appendChild(dsaSvgIconClipboard());

    let scratchApi;
    if (isEditProblem) {
        scratchApi = dsaWireSketchEditor(sketchEditorRoot, () => {}, {
            afterClear() {
                userClearedSketch = true;
            },
            admin: isAdmin,
        });
    } else {
        scratchApi = dsaStubSketchApi();
        const sketchNote = document.createElement("p");
        sketchNote.className = "dsa-q-sketch-add-note";
        sketchNote.textContent =
            "Save this problem first, then open Edit to use the sketch (pen, colors, eraser, undo).";
        sketchEditorRoot.appendChild(sketchNote);
    }

    let imageDataUrl = "";

    function setImagePreview(url) {
        imageDataUrl = url || "";
        imagePreview.innerHTML = "";
        if (!imageDataUrl) {
            return;
        }
        const wrap = document.createElement("div");
        wrap.className = "dsa-q-image-preview-wrap";
        const im = document.createElement("img");
        im.src = imageDataUrl;
        im.alt = "Attached";
        im.className = "dsa-q-image-thumb";
        wrap.appendChild(im);
        if (isAdmin) {
            const rm = document.createElement("button");
            rm.type = "button";
            rm.className = "dsa-q-image-remove-on-thumb";
            rm.setAttribute("aria-label", "Remove image");
            rm.title = "Remove image";
            rm.textContent = "×";
            rm.addEventListener("click", () => setImagePreview(""));
            wrap.appendChild(rm);
        }
        imagePreview.appendChild(wrap);
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

    async function pasteImageFromClipboardViaApi() {
        if (!isAdmin) {
            return;
        }
        try {
            if (navigator.clipboard && typeof navigator.clipboard.read === "function") {
                const items = await navigator.clipboard.read();
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const types = item.types || [];
                    for (let j = 0; j < types.length; j++) {
                        const type = types[j];
                        if (type && type.startsWith("image/")) {
                            const blob = await item.getType(type);
                            const ext = type.indexOf("jpeg") >= 0 ? "jpg" : "png";
                            const file = new File([blob], `paste.${ext}`, { type: type || "image/png" });
                            if (applyImageFileFromPaste(file)) {
                                return;
                            }
                        }
                    }
                }
            }
        } catch (_) {
            /* fall through */
        }
        window.alert(
            "No image found in the clipboard, or permission was denied. Copy an image first, focus this dialog, try Ctrl/Cmd+V, or use Choose image.",
        );
    }

    const hintSec = makeSection("Hint / notes", [
        "M9 21h6",
        "M12 3v1",
        "M4.22 4.22l.7.7",
        "M18.08 18.08l.7.7",
        "M2 12h1",
        "M21 12h1",
        "M4.22 19.78l.7-.7",
        "M18.08 5.92l.7-.7",
    ], (headActions) => {
        const btn = makeSectionClearIconBtn("Clear hint / notes", "Clear hint / notes");
        btn.addEventListener("click", () => {
            if (!isAdmin) {
                return;
            }
            if (!window.confirm("Clear all text in Hint / notes?")) {
                return;
            }
            hintTa.value = "";
        });
        headActions.appendChild(btn);
    });
    hintSec.body.appendChild(hintTa);

    const solutionVideoIn = document.createElement("input");
    solutionVideoIn.type = "url";
    solutionVideoIn.id = "dsa-q-solution-video";
    solutionVideoIn.className = "dsa-field-control";
    solutionVideoIn.placeholder = "https://www.youtube.com/watch?v=… or youtu.be/…";
    solutionVideoIn.setAttribute("aria-label", "Video solution URL");

    let solutionsState = [];
    let solutionsListExpanded = false;
    const solutionListRoot = document.createElement("div");
    solutionListRoot.className = "dsa-q-solution-list";
    solutionListRoot.setAttribute("aria-live", "polite");

    const sheetBackdrop = document.createElement("div");
    sheetBackdrop.className = "dsa-q-sheet-backdrop";
    sheetBackdrop.hidden = true;
    const sheetPanel = document.createElement("div");
    sheetPanel.className = "dsa-q-sheet-panel";
    sheetPanel.id = "dsa-q-solution-sheet";
    sheetPanel.setAttribute("role", "dialog");
    sheetPanel.setAttribute("aria-modal", "true");
    sheetPanel.setAttribute("aria-labelledby", "dsa-q-solution-sheet-title");

    const sheetGrab = document.createElement("div");
    sheetGrab.className = "dsa-q-sheet-grab";
    sheetGrab.setAttribute("aria-hidden", "true");

    const sheetTitle = document.createElement("h3");
    sheetTitle.className = "dsa-q-sheet-title";
    sheetTitle.id = "dsa-q-solution-sheet-title";
    sheetTitle.textContent = "Add solution";

    const approachField = document.createElement("div");
    approachField.className = "dsa-q-field";
    const approachLab = document.createElement("label");
    approachLab.className = "dsa-field-label";
    approachLab.setAttribute("for", "dsa-q-sheet-approach");
    approachLab.appendChild(document.createTextNode("Approach "));
    const approachReq = document.createElement("span");
    approachReq.className = "dsa-req";
    approachReq.setAttribute("aria-hidden", "true");
    approachReq.textContent = "*";
    approachLab.appendChild(approachReq);
    const sheetApproachSelect = document.createElement("select");
    sheetApproachSelect.id = "dsa-q-sheet-approach";
    sheetApproachSelect.required = true;
    sheetApproachSelect.setAttribute("aria-required", "true");
    DSA_SOLUTION_APPROACH_OPTIONS.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt.id;
        o.textContent = opt.label;
        sheetApproachSelect.appendChild(o);
    });
    const approachShell = document.createElement("div");
    approachShell.className = "dsa-q-modern-select-shell";
    approachShell.appendChild(sheetApproachSelect);
    approachField.appendChild(approachLab);
    approachField.appendChild(approachShell);

    const timeField = document.createElement("div");
    timeField.className = "dsa-q-field";
    const timeLab = document.createElement("label");
    timeLab.className = "dsa-field-label";
    timeLab.setAttribute("for", "dsa-q-sheet-time");
    timeLab.appendChild(document.createTextNode("Time complexity "));
    const timeReq = document.createElement("span");
    timeReq.className = "dsa-req";
    timeReq.setAttribute("aria-hidden", "true");
    timeReq.textContent = "*";
    timeLab.appendChild(timeReq);
    const sheetTimeIn = document.createElement("input");
    sheetTimeIn.type = "text";
    sheetTimeIn.id = "dsa-q-sheet-time";
    sheetTimeIn.className = "dsa-field-control";
    sheetTimeIn.placeholder = "e.g. O(n)";
    sheetTimeIn.required = true;
    sheetTimeIn.setAttribute("aria-required", "true");
    sheetTimeIn.setAttribute("aria-label", "Time complexity (required)");
    timeField.appendChild(timeLab);
    timeField.appendChild(sheetTimeIn);

    const spaceField = document.createElement("div");
    spaceField.className = "dsa-q-field";
    const spaceLab = document.createElement("label");
    spaceLab.className = "dsa-field-label";
    spaceLab.setAttribute("for", "dsa-q-sheet-space");
    spaceLab.appendChild(document.createTextNode("Space complexity "));
    const spaceReq = document.createElement("span");
    spaceReq.className = "dsa-req";
    spaceReq.setAttribute("aria-hidden", "true");
    spaceReq.textContent = "*";
    spaceLab.appendChild(spaceReq);
    const sheetSpaceIn = document.createElement("input");
    sheetSpaceIn.type = "text";
    sheetSpaceIn.id = "dsa-q-sheet-space";
    sheetSpaceIn.className = "dsa-field-control";
    sheetSpaceIn.placeholder = "e.g. O(1)";
    sheetSpaceIn.required = true;
    sheetSpaceIn.setAttribute("aria-required", "true");
    sheetSpaceIn.setAttribute("aria-label", "Space complexity (required)");
    spaceField.appendChild(spaceLab);
    spaceField.appendChild(sheetSpaceIn);

    const sheetCodeTa = document.createElement("textarea");
    sheetCodeTa.id = "dsa-q-code";
    sheetCodeTa.className = "dsa-field-control dsa-q-code dsa-q-code--sheet";
    sheetCodeTa.rows = 12;
    sheetCodeTa.spellcheck = false;
    sheetCodeTa.wrap = "off";
    sheetCodeTa.placeholder = "Solution code (indentation preserved)";
    sheetCodeTa.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
            e.preventDefault();
            const start = sheetCodeTa.selectionStart;
            const end = sheetCodeTa.selectionEnd;
            const tab = "    ";
            sheetCodeTa.value = sheetCodeTa.value.slice(0, start) + tab + sheetCodeTa.value.slice(end);
            const pos = start + tab.length;
            sheetCodeTa.selectionStart = sheetCodeTa.selectionEnd = pos;
        }
    });

    const codeField = document.createElement("div");
    codeField.className = "dsa-q-field";
    const codeLabSheet = document.createElement("label");
    codeLabSheet.className = "dsa-field-label";
    codeLabSheet.setAttribute("for", "dsa-q-code");
    codeLabSheet.appendChild(document.createTextNode("Solution code "));
    const codeReq = document.createElement("span");
    codeReq.className = "dsa-req";
    codeReq.setAttribute("aria-hidden", "true");
    codeReq.textContent = "*";
    codeLabSheet.appendChild(codeReq);
    sheetCodeTa.required = true;
    sheetCodeTa.setAttribute("aria-required", "true");
    sheetCodeTa.setAttribute("aria-label", "Solution code (required)");
    codeField.appendChild(codeLabSheet);
    codeField.appendChild(sheetCodeTa);

    const sheetActions = document.createElement("div");
    sheetActions.className = "dsa-q-sheet-actions";
    const sheetCancel = document.createElement("button");
    sheetCancel.type = "button";
    sheetCancel.className = "dsa-dialog-btn dsa-dialog-btn--ghost";
    sheetCancel.textContent = "Cancel";
    const sheetSave = document.createElement("button");
    sheetSave.type = "button";
    sheetSave.className = "dsa-dialog-btn dsa-dialog-btn--primary";
    sheetSave.textContent = "Save solution";
    sheetActions.appendChild(sheetCancel);
    sheetActions.appendChild(sheetSave);

    sheetPanel.appendChild(sheetGrab);
    sheetPanel.appendChild(sheetTitle);
    sheetPanel.appendChild(approachField);
    sheetPanel.appendChild(timeField);
    sheetPanel.appendChild(spaceField);
    sheetPanel.appendChild(codeField);
    sheetPanel.appendChild(sheetActions);
    sheetBackdrop.appendChild(sheetPanel);

    let sheetEditIndex = null;

    function closeSolutionSheet() {
        sheetBackdrop.hidden = true;
        sheetPanel.classList.remove("dsa-q-sheet-panel--open");
        sheetEditIndex = null;
    }

    function openSolutionSheet(editIndex) {
        sheetEditIndex = editIndex;
        const isEdit = editIndex != null && editIndex >= 0;
        sheetTitle.textContent = isEdit ? "Edit solution" : "Add solution";
        const sol = isEdit ? solutionsState[editIndex] : null;
        sheetApproachSelect.value = sol ? dsaNormalizeSolutionCategory(sol.approach) : "";
        sheetTimeIn.value = sol && sol.timeComplexity ? String(sol.timeComplexity) : "";
        sheetSpaceIn.value = sol && sol.spaceComplexity ? String(sol.spaceComplexity) : "";
        sheetCodeTa.value = sol && sol.code != null ? String(sol.code) : "";
        sheetBackdrop.hidden = false;
        requestAnimationFrame(() => {
            sheetPanel.classList.add("dsa-q-sheet-panel--open");
            sheetCodeTa.focus();
        });
    }

    function commitSolutionSheet() {
        const approach = sheetApproachSelect.value.trim();
        const timeComplexity = sheetTimeIn.value.trim();
        const spaceComplexity = sheetSpaceIn.value.trim();
        const code = sheetCodeTa.value.trim();
        if (!approach || !dsaNormalizeSolutionCategory(approach)) {
            window.alert("Select an approach (Brute force, Better, or Optimal).");
            sheetApproachSelect.focus();
            return;
        }
        if (!timeComplexity) {
            window.alert("Time complexity is required.");
            sheetTimeIn.focus();
            return;
        }
        if (!spaceComplexity) {
            window.alert("Space complexity is required.");
            sheetSpaceIn.focus();
            return;
        }
        if (!code) {
            window.alert("Solution code is required.");
            sheetCodeTa.focus();
            return;
        }
        const item = {
            id:
                sheetEditIndex != null && sheetEditIndex >= 0
                    ? solutionsState[sheetEditIndex].id
                    : dsaNewSolutionId(),
            approach,
            timeComplexity,
            spaceComplexity,
            code,
        };
        if (sheetEditIndex != null && sheetEditIndex >= 0) {
            solutionsState[sheetEditIndex] = item;
        } else {
            solutionsState.push(item);
        }
        renderSolutionsEditorList();
        closeSolutionSheet();
    }

    sheetBackdrop.addEventListener("click", (e) => {
        if (e.target === sheetBackdrop) {
            closeSolutionSheet();
        }
    });
    sheetPanel.addEventListener("click", (e) => e.stopPropagation());
    sheetCancel.addEventListener("click", () => closeSolutionSheet());
    sheetSave.addEventListener("click", () => commitSolutionSheet());

    function renderSolutionsEditorList() {
        solutionListRoot.innerHTML = "";
        if (!solutionsState.length) {
            solutionsListExpanded = false;
            const empty = document.createElement("p");
            empty.className = "dsa-q-solution-empty";
            empty.textContent =
                "No solutions yet. Tap + to add approach, time and space complexity, and code (all required).";
            solutionListRoot.appendChild(empty);
            return;
        }

        function appendCard(origIdx) {
            const sol = solutionsState[origIdx];
            const card = document.createElement("article");
            card.className = "dsa-q-solution-item";
            const head = document.createElement("div");
            head.className = "dsa-q-solution-item__head";
            const badges = document.createElement("div");
            badges.className = "dsa-q-solution-item__badges";
            const appr = dsaSolutionCategoryLabel(dsaNormalizeSolutionCategory(sol.approach));
            if (appr) {
                const b = document.createElement("span");
                b.className = "dsa-q-solution-item__pill dsa-q-solution-item__pill--appr";
                b.textContent = appr;
                badges.appendChild(b);
            }
            if (sol.timeComplexity && String(sol.timeComplexity).trim()) {
                const b = document.createElement("span");
                b.className = "dsa-q-solution-item__pill";
                b.textContent = `T: ${String(sol.timeComplexity).trim()}`;
                badges.appendChild(b);
            }
            if (sol.spaceComplexity && String(sol.spaceComplexity).trim()) {
                const b = document.createElement("span");
                b.className = "dsa-q-solution-item__pill dsa-q-solution-item__pill--space";
                b.textContent = `S: ${String(sol.spaceComplexity).trim()}`;
                badges.appendChild(b);
            }
            head.appendChild(badges);
            const actions = document.createElement("div");
            actions.className = "dsa-q-solution-item__actions";
            const btnEdit = document.createElement("button");
            btnEdit.type = "button";
            btnEdit.className = "dsa-q-solution-item__btn";
            btnEdit.textContent = "Edit";
            btnEdit.addEventListener("click", () => openSolutionSheet(origIdx));
            const btnDel = document.createElement("button");
            btnDel.type = "button";
            btnDel.className = "dsa-q-solution-item__btn dsa-q-solution-item__btn--danger";
            btnDel.textContent = "Remove";
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
            if (isAdmin) {
                actions.appendChild(btnEdit);
                actions.appendChild(btnDel);
            }
            head.appendChild(actions);
            card.appendChild(head);
            const codePreview = String(sol.code || "").trim();
            if (codePreview) {
                const pre = document.createElement("pre");
                pre.className = "dsa-q-solution-item__code";
                pre.textContent =
                    codePreview.length > 360 ? `${codePreview.slice(0, 357)}…` : codePreview;
                card.appendChild(pre);
            }
            solutionListRoot.appendChild(card);
        }

        const orderIdx = dsaSortedSolutionIndicesForDisplay(solutionsState);
        const n = orderIdx.length;
        if (n === 1) {
            appendCard(orderIdx[0]);
            return;
        }

        const limit = solutionsListExpanded ? n : 1;
        for (let i = 0; i < limit; i++) {
            appendCard(orderIdx[i]);
        }

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "dsa-q-solution-expand-toggle";
        toggle.setAttribute("aria-expanded", solutionsListExpanded ? "true" : "false");
        const chev = document.createElement("span");
        chev.className = "dsa-q-solution-expand-toggle__chev";
        chev.setAttribute("aria-hidden", "true");
        chev.textContent = solutionsListExpanded ? "\u25B2" : "\u25BC";
        const lab = document.createElement("span");
        lab.className = "dsa-q-solution-expand-toggle__label";
        lab.textContent = solutionsListExpanded ? "Show less" : `Show all ${n} solutions`;
        toggle.appendChild(chev);
        toggle.appendChild(lab);
        toggle.addEventListener("click", () => {
            solutionsListExpanded = !solutionsListExpanded;
            renderSolutionsEditorList();
        });
        solutionListRoot.appendChild(toggle);
    }

    const videoSec = makeSection(
        "Video solution",
        ["M14.752 11.168l-5.197-3.03A1 1 0 008 8.03v6.06a1 1 0 001.555.832l5.197-3.03a1 1 0 000-1.664z"],
        (headActions) => {
            const btn = makeSectionClearIconBtn("Clear video link", "Clear video link");
            btn.addEventListener("click", () => {
                if (!isAdmin) {
                    return;
                }
                if (!window.confirm("Clear the video URL?")) {
                    return;
                }
                solutionVideoIn.value = "";
            });
            headActions.appendChild(btn);
        },
    );
    videoSec.body.appendChild(solutionVideoIn);

    const solutionSec = makeSection(
        "Solutions",
        ["M16 18l6-6-6-6", "M8 6l-6 6 6 6"],
        (headActions) => {
            const btnAdd = document.createElement("button");
            btnAdd.type = "button";
            btnAdd.className = "dsa-q-solution-add-btn";
            btnAdd.setAttribute("aria-label", "Add solution");
            btnAdd.title = "Add solution";
            btnAdd.textContent = "+";
            btnAdd.addEventListener("click", () => openSolutionSheet(null));
            const btn = makeSectionClearIconBtn("Clear all solutions", "Clear all solutions");
            btn.addEventListener("click", () => {
                if (!isAdmin) {
                    return;
                }
                if (!window.confirm("Remove all solutions for this problem?")) {
                    return;
                }
                solutionsState = [];
                renderSolutionsEditorList();
            });
            headActions.appendChild(btnAdd);
            headActions.appendChild(btn);
        },
    );
    solutionSec.body.appendChild(solutionListRoot);
    const btnAddSolutionEl = solutionSec.headActions.querySelector(".dsa-q-solution-add-btn");
    renderSolutionsEditorList();

    const companyChipsWrap = document.createElement("div");
    companyChipsWrap.className = "dsa-q-company-chips";
    companyChipsWrap.setAttribute("aria-live", "polite");

    const companyPresetRow = document.createElement("div");
    companyPresetRow.className = "dsa-q-company-add-row";
    const companyPresetLab = document.createElement("label");
    companyPresetLab.className = "dsa-field-label";
    companyPresetLab.setAttribute("for", "dsa-q-company-preset");
    companyPresetLab.textContent = "Add company";
    const companySelectWrap = document.createElement("div");
    companySelectWrap.className = "dsa-q-company-select-wrap";
    const companyPresetSelect = document.createElement("select");
    companyPresetSelect.id = "dsa-q-company-preset";
    companyPresetSelect.className = "dsa-field-control dsa-q-company-select";
    companyPresetSelect.setAttribute("aria-label", "Choose a company or Other");
    const companyPresetOpt0 = document.createElement("option");
    companyPresetOpt0.value = "";
    companyPresetOpt0.textContent = "Select a company…";
    companyPresetSelect.appendChild(companyPresetOpt0);
    const companyOptgroup = document.createElement("optgroup");
    companyOptgroup.label = "Companies";
    DSA_COMPANY_PRESETS.forEach((p) => {
        const o = document.createElement("option");
        o.value = p.label;
        o.textContent = p.label;
        companyOptgroup.appendChild(o);
    });
    companyPresetSelect.appendChild(companyOptgroup);
    const companyOptOther = document.createElement("option");
    companyOptOther.value = "__other__";
    companyOptOther.textContent = "Other…";
    companyPresetSelect.appendChild(companyOptOther);
    companySelectWrap.appendChild(companyPresetSelect);

    let companyTagsList = [];

    function renderCompanyChips() {
        companyChipsWrap.innerHTML = "";
        companyTagsList.forEach((tag) => {
            const chip = document.createElement("span");
            chip.className = "dsa-q-company-chip";
            const lab = document.createElement("span");
            lab.className = "dsa-q-company-chip-label";
            lab.textContent = tag;
            chip.appendChild(lab);
            if (isAdmin) {
                const rm = document.createElement("button");
                rm.type = "button";
                rm.className = "dsa-q-company-chip-remove";
                rm.setAttribute("aria-label", `Remove ${tag}`);
                rm.title = "Remove";
                rm.textContent = "×";
                rm.addEventListener("click", () => {
                    const i = companyTagsList.indexOf(tag);
                    if (i >= 0) {
                        companyTagsList.splice(i, 1);
                    }
                    renderCompanyChips();
                });
                chip.appendChild(rm);
            }
            companyChipsWrap.appendChild(chip);
        });
    }

    companyPresetSelect.addEventListener("change", () => {
        if (!isAdmin) {
            companyPresetSelect.value = "";
            return;
        }
        const v = companyPresetSelect.value;
        if (!v) {
            return;
        }
        companyPresetSelect.value = "";
        if (v === "__other__") {
            const entered = window.prompt("Enter company name:", "");
            if (entered == null) {
                return;
            }
            const name = String(entered).trim();
            if (!name) {
                return;
            }
            if (!companyTagsList.some((t) => t.toLowerCase() === name.toLowerCase())) {
                companyTagsList.push(name);
                renderCompanyChips();
            }
            return;
        }
        const label = String(v).trim();
        if (!label) {
            return;
        }
        if (!companyTagsList.some((t) => t.toLowerCase() === label.toLowerCase())) {
            companyTagsList.push(label);
            renderCompanyChips();
        }
    });

    const companySec = makeSection(
        "Company tags",
        [
            "M4 21V9a1 1 0 011-1h4V4a1 1 0 011-1h4a1 1 0 011 1v4h4a1 1 0 011 1v12",
            "M9 21v-4h2v4M15 21v-4h2v4",
        ],
        (headActions) => {
            const btn = makeSectionClearIconBtn("Clear company tags", "Clear company tags");
            btn.addEventListener("click", () => {
                if (!isAdmin) {
                    return;
                }
                if (!window.confirm("Remove all company tags for this problem?")) {
                    return;
                }
                companyTagsList = [];
                renderCompanyChips();
            });
            headActions.appendChild(btn);
        },
    );
    companySec.body.appendChild(companyChipsWrap);
    companySec.body.appendChild(companyPresetRow);
    companyPresetRow.appendChild(companyPresetLab);
    companyPresetRow.appendChild(companySelectWrap);

    const sketchSec = makeSection("Sketch", [
        "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
    ], isEditProblem
        ? (headActions) => {
              const btn = makeSectionClearIconBtn("Clear sketch", "Clear sketch");
              btn.addEventListener("click", () => {
                  if (!isAdmin || sketchEditorRoot.classList.contains("dsa-sketch-editor-host--ro")) {
                      return;
                  }
                  if (!window.confirm("Clear the entire sketch? Use Undo in the sketch toolbar to remove the last stroke.")) {
                      return;
                  }
                  scratchApi.clear();
              });
              headActions.appendChild(btn);
          }
        : undefined);
    sketchSec.body.appendChild(sketchEditorRoot);
    drawRow.appendChild(btnZoomOut);
    drawRow.appendChild(btnZoomIn);
    sketchSec.body.appendChild(drawRow);

    const imageSec = makeSection("Image", [
        "M4 5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5z",
        "M8.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z",
        "M4 17l4.5-5.5 3 3L15 11l5 6",
    ]);
    imageActions.appendChild(btnPickImage);
    imageActions.appendChild(btnPasteImage);
    imageSec.body.appendChild(imageActions);
    imageSec.body.appendChild(fileIn);
    imageSec.body.appendChild(imagePreview);

    const headerTabsRow = document.createElement("div");
    headerTabsRow.className = "dsa-dialog-header-tabs";
    const tabPanelsWrap = document.createElement("div");
    tabPanelsWrap.className = "dsa-q-tabs-shell dsa-q-tabs-shell--below-heading";
    const tabList = document.createElement("div");
    tabList.className = "dsa-q-tabs";
    tabList.setAttribute("role", "tablist");
    tabList.setAttribute("aria-label", "Problem sections");
    const btnTabDetails = document.createElement("button");
    btnTabDetails.type = "button";
    btnTabDetails.className = "dsa-q-tab dsa-q-tab--active";
    btnTabDetails.setAttribute("role", "tab");
    btnTabDetails.setAttribute("aria-selected", "true");
    btnTabDetails.id = "dsa-q-tab-details";
    btnTabDetails.textContent = "Details";
    const btnTabResources = document.createElement("button");
    btnTabResources.type = "button";
    btnTabResources.className = "dsa-q-tab";
    btnTabResources.setAttribute("role", "tab");
    btnTabResources.setAttribute("aria-selected", "false");
    btnTabResources.id = "dsa-q-tab-resources";
    btnTabResources.textContent = "Resources";
    const detailsPanel = document.createElement("div");
    detailsPanel.className = "dsa-q-tab-panel";
    detailsPanel.setAttribute("role", "tabpanel");
    detailsPanel.id = "dsa-q-panel-details";
    detailsPanel.setAttribute("aria-labelledby", "dsa-q-tab-details");
    const resourcesPanel = document.createElement("div");
    resourcesPanel.className = "dsa-q-tab-panel";
    resourcesPanel.id = "dsa-q-panel-resources";
    resourcesPanel.setAttribute("role", "tabpanel");
    resourcesPanel.setAttribute("aria-labelledby", "dsa-q-tab-resources");
    resourcesPanel.hidden = true;

    function activateDsaProblemTab(which) {
        const det = which === "details";
        btnTabDetails.classList.toggle("dsa-q-tab--active", det);
        btnTabResources.classList.toggle("dsa-q-tab--active", !det);
        btnTabDetails.setAttribute("aria-selected", det ? "true" : "false");
        btnTabResources.setAttribute("aria-selected", !det ? "true" : "false");
        detailsPanel.hidden = !det;
        resourcesPanel.hidden = det;
    }
    btnTabDetails.addEventListener("click", () => activateDsaProblemTab("details"));
    btnTabResources.addEventListener("click", () => activateDsaProblemTab("resources"));

    tabList.appendChild(btnTabDetails);
    tabList.appendChild(btnTabResources);
    headerTabsRow.appendChild(tabList);
    tabPanelsWrap.appendChild(detailsPanel);
    tabPanelsWrap.appendChild(resourcesPanel);

    const difficultyField = document.createElement("div");
    difficultyField.className = "dsa-q-field";
    const diffLabEl = document.createElement("label");
    diffLabEl.className = "dsa-field-label";
    diffLabEl.setAttribute("for", "dsa-q-difficulty");
    diffLabEl.appendChild(document.createTextNode("Difficulty "));
    const diffReqStar = document.createElement("span");
    diffReqStar.className = "dsa-req";
    diffReqStar.setAttribute("aria-hidden", "true");
    diffReqStar.textContent = "*";
    diffLabEl.appendChild(diffReqStar);
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
    difficultySelectWrap.appendChild(difficultySelect);
    difficultyField.appendChild(diffLabEl);
    difficultyField.appendChild(difficultySelectWrap);

    const importantField = document.createElement("label");
    importantField.className = "dsa-q-important-toggle";
    importantField.setAttribute("for", "dsa-q-important");
    const importantInput = document.createElement("input");
    importantInput.type = "checkbox";
    importantInput.id = "dsa-q-important";
    importantInput.className = "dsa-q-important-input";
    importantInput.setAttribute("aria-label", "Mark as starred problem");
    const importantMeta = document.createElement("span");
    importantMeta.className = "dsa-q-important-meta";
    const importantTitle = document.createElement("span");
    importantTitle.className = "dsa-q-important-title";
    importantTitle.textContent = "Starred (most important)";
    const importantHelp = document.createElement("span");
    importantHelp.className = "dsa-q-important-help";
    importantHelp.textContent = "Shown first in the default Starred tab.";
    importantMeta.appendChild(importantTitle);
    importantMeta.appendChild(importantHelp);
    importantField.appendChild(importantInput);
    importantField.appendChild(importantMeta);

    detailsPanel.appendChild(difficultyField);
    detailsPanel.appendChild(importantField);
    detailsPanel.appendChild(qHint);
    detailsPanel.appendChild(hintSec.sec);
    detailsPanel.appendChild(companySec.sec);
    detailsPanel.appendChild(existingCard);
    resourcesPanel.appendChild(videoSec.sec);
    resourcesPanel.appendChild(solutionSec.sec);
    resourcesPanel.appendChild(sketchSec.sec);
    resourcesPanel.appendChild(imageSec.sec);

    qBlock.appendChild(nameField);
    qBlock.appendChild(urlField);
    qBlock.appendChild(tabPanelsWrap);

    function renderExistingCard(ent) {
        existingCard.innerHTML = "";
        if (!ent) {
            existingCard.hidden = true;
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
            return;
        }
        existingCard.hidden = false;
        const head = document.createElement("div");
        head.className = "dsa-q-existing-head";
        head.textContent = "Saved for this problem";
        existingCard.appendChild(head);
        const grid = document.createElement("div");
        grid.className = "dsa-q-existing-grid";
        const diffRow0 = document.createElement("div");
        diffRow0.className = "dsa-q-existing-block";
        const diffTag0 = document.createElement("span");
        diffTag0.className = "dsa-q-existing-tag";
        diffTag0.textContent = "Difficulty";
        const diffVal0 = document.createElement("span");
        diffVal0.className =
            "dsa-q-difficulty-pill dsa-q-difficulty-pill--" + dsaNormalizeProblemDifficulty(ent.difficulty);
        diffVal0.textContent = dsaProblemDifficultyLabel(ent.difficulty);
        diffRow0.appendChild(diffTag0);
        diffRow0.appendChild(diffVal0);
        grid.appendChild(diffRow0);
        if (ent.starred === true) {
            const impRow = document.createElement("div");
            impRow.className = "dsa-q-existing-block";
            const impTag = document.createElement("span");
            impTag.className = "dsa-q-existing-tag";
            impTag.textContent = "Starred";
            const impVal = document.createElement("span");
            impVal.className = "dsa-q-existing-val";
            impVal.textContent = "Yes";
            impRow.appendChild(impTag);
            impRow.appendChild(impVal);
            grid.appendChild(impRow);
        }
        const addBlock = (tagText, content, className) => {
            const row = document.createElement("div");
            row.className = "dsa-q-existing-block";
            const tag = document.createElement("span");
            tag.className = "dsa-q-existing-tag";
            tag.textContent = tagText;
            const el =
                className === "pre"
                    ? (() => {
                          const pre = document.createElement("pre");
                          pre.className = "dsa-q-existing-pre";
                          pre.textContent = content;
                          return pre;
                      })()
                    : (() => {
                          const block = document.createElement("blockquote");
                          block.className = "dsa-q-existing-comment";
                          block.textContent = content.length > 280 ? `${content.slice(0, 277)}…` : content;
                          return block;
                      })();
            row.appendChild(tag);
            row.appendChild(el);
            grid.appendChild(row);
        };
        const hi = dsaMergeHintCommentFromEntry(ent);
        if (hi) {
            addBlock("Hint / notes", hi, "quote");
        }
        const vid = ent.solutionVideoUrl && String(ent.solutionVideoUrl).trim();
        if (vid) {
            addBlock("Video", vid.length > 120 ? `${vid.slice(0, 117)}…` : vid, "quote");
        }
        const solsCard = dsaSolutionsFromEntry(ent);
        if (solsCard.length) {
            solsCard.forEach((sol, si) => {
                const co = sol.code && String(sol.code).trim();
                const stc = sol.timeComplexity && String(sol.timeComplexity).trim();
                const ssc = sol.spaceComplexity && String(sol.spaceComplexity).trim();
                const scatLab = dsaSolutionCategoryLabel(dsaNormalizeSolutionCategory(sol.approach));
                if (!co && !stc && !ssc && !scatLab) {
                    return;
                }
                const row = document.createElement("div");
                row.className = "dsa-q-existing-block";
                const tag = document.createElement("span");
                tag.className = "dsa-q-existing-tag";
                tag.textContent = solsCard.length > 1 ? `Solution ${si + 1}` : "Solution";
                row.appendChild(tag);
                const body = document.createElement("div");
                body.className = "dsa-q-existing-solution-wrap";
                if (scatLab || stc || ssc) {
                    const meta = document.createElement("div");
                    meta.className = "dsa-q-existing-sol-meta";
                    if (scatLab) {
                        const p = document.createElement("span");
                        p.className = "dsa-q-existing-sol-pill";
                        p.textContent = scatLab;
                        meta.appendChild(p);
                    }
                    if (stc) {
                        const p = document.createElement("span");
                        p.className = "dsa-q-existing-sol-pill dsa-q-existing-sol-pill--tc";
                        p.textContent = `T: ${stc}`;
                        meta.appendChild(p);
                    }
                    if (ssc) {
                        const p = document.createElement("span");
                        p.className = "dsa-q-existing-sol-pill dsa-q-existing-sol-pill--sp";
                        p.textContent = `S: ${ssc}`;
                        meta.appendChild(p);
                    }
                    body.appendChild(meta);
                }
                if (co) {
                    const pre = document.createElement("pre");
                    pre.className = "dsa-q-existing-pre";
                    pre.textContent = co.length > 400 ? `${co.slice(0, 397)}…` : co;
                    body.appendChild(pre);
                }
                row.appendChild(body);
                grid.appendChild(row);
            });
        }
        if (ent.drawing && String(ent.drawing).trim()) {
            const row = document.createElement("div");
            row.className = "dsa-q-existing-block";
            const tag = document.createElement("span");
            tag.className = "dsa-q-existing-tag";
            tag.textContent = "Sketch";
            const fig = document.createElement("figure");
            fig.className = "dsa-q-existing-fig";
            const img = document.createElement("img");
            img.src = String(ent.drawing);
            img.alt = "Sketch";
            fig.appendChild(img);
            row.appendChild(tag);
            row.appendChild(fig);
            grid.appendChild(row);
        }
        if (ent.image && String(ent.image).trim()) {
            const row = document.createElement("div");
            row.className = "dsa-q-existing-block";
            const tag = document.createElement("span");
            tag.className = "dsa-q-existing-tag";
            tag.textContent = "Image";
            const fig = document.createElement("figure");
            fig.className = "dsa-q-existing-fig";
            const img = document.createElement("img");
            img.src = String(ent.image);
            img.alt = "Image";
            fig.appendChild(img);
            row.appendChild(tag);
            row.appendChild(fig);
            grid.appendChild(row);
        }
        const compsPreview = dsaNormalizeCompaniesArray(ent && ent.companies);
        if (compsPreview.length) {
            const row = document.createElement("div");
            row.className = "dsa-q-existing-block";
            const tag = document.createElement("span");
            tag.className = "dsa-q-existing-tag";
            tag.textContent = "Companies";
            const div = document.createElement("div");
            div.className = "dsa-q-existing-companies";
            compsPreview.forEach((c) => {
                const pill = document.createElement("span");
                pill.className = "dsa-q-existing-company-pill";
                pill.textContent = c;
                div.appendChild(pill);
            });
            row.appendChild(tag);
            row.appendChild(div);
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
            scratchApi.loadDataUrl(ent.drawing || "");
            setImagePreview(ent.image && String(ent.image).trim() ? String(ent.image) : "");
            companyTagsList = dsaNormalizeCompaniesArray(ent.companies);
            solutionsState = dsaSolutionsFromEntry(ent).map((s) => ({ ...dsaNormalizeSolutionItem(s) }));
            difficultySelect.value = dsaNormalizeProblemDifficulty(ent.difficulty);
            importantInput.checked = !!(ent && ent.starred);
        } else {
            hintTa.value = "";
            urlIn.value = "";
            solutionVideoIn.value = "";
            scratchApi.clear();
            setImagePreview("");
            companyTagsList = [];
            solutionsState = [];
            difficultySelect.value = "medium";
            importantInput.checked = false;
        }
        renderSolutionsEditorList();
        renderCompanyChips();
    }

    function syncNameToEntry() {
        const n = nameIn.value.trim();
        const ent = n
            ? dsaResolveQuestionForModal(parentKey, n, editUserNodeId)
            : null;
        const k = ent ? ent.id || `${parentKey}::${ent.name}` : "";
        if (k !== syncEntryKey) {
            syncEntryKey = k;
            userClearedSketch = false;
        }
        renderExistingCard(ent);
        applyEntryToForm(ent);
    }

    let debounceTimer = 0;
    function clearFieldErrors() {
        nodeIn.classList.remove("dsa-field-control--error");
        nameIn.classList.remove("dsa-field-control--error");
        difficultySelect.classList.remove("dsa-field-control--error");
    }

    nameIn.addEventListener("input", () => {
        clearFieldErrors();
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
    });
    urlIn.addEventListener("input", () => {
        urlIn.classList.remove("dsa-field-control--error");
    });
    difficultySelect.addEventListener("change", () => {
        difficultySelect.classList.remove("dsa-field-control--error");
    });

    function syncCategory() {
        if (isRenameNode) {
            nodeBlock.hidden = false;
            qBlock.hidden = true;
            headerTabsRow.hidden = true;
            return;
        }
        const nodeMode = radN.checked;
        nodeBlock.hidden = !nodeMode;
        qBlock.hidden = nodeMode;
        headerTabsRow.hidden = nodeMode;
    }
    radQ.addEventListener("change", syncCategory);
    radN.addEventListener("change", syncCategory);
    syncCategory();

    const btnCancel = document.createElement("button");
    btnCancel.type = "button";
    btnCancel.className = "dsa-dialog-btn-icon dsa-dialog-btn-icon--close";
    btnCancel.setAttribute("aria-label", "Cancel");
    btnCancel.setAttribute("title", "Cancel");
    const svgX = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgX.setAttribute("width", "18");
    svgX.setAttribute("height", "18");
    svgX.setAttribute("viewBox", "0 0 24 24");
    svgX.setAttribute("fill", "none");
    svgX.setAttribute("stroke", "currentColor");
    svgX.setAttribute("stroke-width", "2");
    svgX.setAttribute("stroke-linecap", "round");
    svgX.setAttribute("aria-hidden", "true");
    const x1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    x1.setAttribute("d", "M18 6L6 18");
    const x2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    x2.setAttribute("d", "M6 6l12 12");
    svgX.appendChild(x1);
    svgX.appendChild(x2);
    btnCancel.appendChild(svgX);

    const btnOk = document.createElement("button");
    btnOk.type = "button";
    btnOk.className = "dsa-dialog-btn dsa-dialog-btn--primary";
    btnOk.textContent = "Save";

    const header = document.createElement("div");
    header.className = "dsa-dialog-header";
    const headerTop = document.createElement("div");
    headerTop.className = "dsa-dialog-header-top";
    const headerMain = document.createElement("div");
    headerMain.className = "dsa-dialog-header-main";
    headerMain.appendChild(title);
    const headerActions = document.createElement("div");
    headerActions.className = "dsa-dialog-header-actions";
    headerActions.appendChild(btnOk);
    headerActions.appendChild(btnCancel);
    headerTop.appendChild(headerMain);
    headerTop.appendChild(headerActions);
    header.appendChild(headerTop);
    header.appendChild(headerTabsRow);

    function setAdminDisabled() {
        const ro = !isAdmin;
        const addingNew = !editQuestionName && !editUserNodeId && !isRenameNode;
        const problemHidden = addingNew && (isMetaRoot || kindFlags.hasSubnodes);
        radQ.disabled = ro || problemHidden;
        radN.disabled = ro;
        nodeIn.disabled = ro;
        nameIn.disabled = ro;
        urlIn.disabled = ro;
        difficultySelect.disabled = ro;
        importantInput.disabled = ro;
        hintTa.disabled = ro;
        solutionVideoIn.disabled = ro;
        sheetApproachSelect.disabled = ro;
        sheetTimeIn.disabled = ro;
        sheetSpaceIn.disabled = ro;
        sheetCodeTa.disabled = ro;
        sheetCancel.disabled = ro;
        sheetSave.disabled = ro;
        if (btnAddSolutionEl) {
            btnAddSolutionEl.disabled = ro;
            btnAddSolutionEl.hidden = ro;
        }
        companyPresetSelect.disabled = ro;
        sketchEditorRoot.classList.toggle("dsa-sketch-editor-host--ro", ro || !isEditProblem);
        btnZoomOut.disabled = ro || !isEditProblem;
        btnZoomIn.disabled = ro || !isEditProblem;
        btnPickImage.disabled = ro;
        btnPasteImage.disabled = ro;
        btnOk.hidden = ro;
        dlg.querySelectorAll(".dsa-q-section-clear-btn").forEach((b) => {
            b.disabled = ro;
            b.hidden = ro;
        });
    }
    if (!isMetaRoot && !editQuestionName && !editUserNodeId && !isRenameNode && kindFlags.hasSubnodes) {
        radN.checked = true;
        radQ.checked = false;
    }
    syncCategory();
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
            if (!sheetBackdrop.hidden) {
                closeSolutionSheet();
                e.preventDefault();
                return;
            }
            close();
        }
    }
    document.addEventListener("keydown", onKey);
    btnCancel.addEventListener("click", close);
    backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) {
            close();
        }
    });

    btnPickImage.addEventListener("click", () => {
        if (!isAdmin) {
            return;
        }
        fileIn.click();
    });
    btnZoomOut.addEventListener("click", () => {
        if (isAdmin && typeof scratchApi.zoomOut === "function") {
            scratchApi.zoomOut();
        }
    });
    btnZoomIn.addEventListener("click", () => {
        if (isAdmin && typeof scratchApi.zoomIn === "function") {
            scratchApi.zoomIn();
        }
    });
    btnPasteImage.addEventListener("click", () => {
        pasteImageFromClipboardViaApi();
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

    async function performUnifiedSave(opts) {
        const fromFullscreen = !!(opts && opts.fromFullscreen);
        if (!isAdmin) {
            return;
        }
        if (isRenameNode) {
            clearFieldErrors();
            const nameRm = nodeIn.value.trim();
            if (!nameRm) {
                nodeIn.classList.add("dsa-field-control--error");
                nodeIn.focus();
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
            dsaAddUserNode({ parentKey, type: "pattern", name, url: "" });
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
            nameIn.focus();
            return;
        }
        const diffPick = difficultySelect.value.trim();
        if (!diffPick || !["easy", "medium", "hard"].includes(dsaNormalizeProblemDifficulty(diffPick))) {
            difficultySelect.classList.add("dsa-field-control--error");
            difficultySelect.focus();
            activateDsaProblemTab("details");
            return;
        }
        if (parentKey === "__DSA_META__") {
            alert(
                "Add problems under a data-structure topic (e.g. Arrays → Two pointers), not on DSA Patterns itself.",
            );
            return;
        }
        const kfQ = dsaParentChildKindFlags(parentKey);
        if (kfQ.hasSubnodes) {
            alert("This topic has subtopics. Remove or move them before adding problems here.");
            return;
        }
        if (typeof scratchApi.syncHasInkFromPixels === "function") {
            scratchApi.syncHasInkFromPixels();
        }
        let drawingPayload = "";
        if (scratchApi.getHasInk()) {
            drawingPayload =
                typeof scratchApi.toPersistedSketchDataUrl === "function"
                    ? scratchApi.toPersistedSketchDataUrl()
                    : scratchApi.toDataUrl();
        }
        if (!drawingPayload && !userClearedSketch) {
            const entKeep = dsaResolveQuestionForModal(parentKey, name, editUserNodeId);
            if (entKeep && String(entKeep.drawing || "").trim()) {
                drawingPayload = String(entKeep.drawing);
            }
        }
        const entForId = dsaResolveQuestionForModal(parentKey, name, editUserNodeId);
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
        dsaUpsertUserQuestionNode({
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
        });
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
    }
    btnOk.addEventListener("click", () => performUnifiedSave({}));

    dlg.appendChild(header);
    if (adminNote) {
        dlg.appendChild(adminNote);
    }
    dlg.appendChild(catFs);
    dlg.appendChild(nodeBlock);
    dlg.appendChild(qBlock);
    setAdminDisabled();

    backdrop.appendChild(dlg);
    document.body.appendChild(backdrop);
    document.body.appendChild(sheetBackdrop);
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
    } else if (isRenameNode) {
        nodeIn.focus();
        nodeIn.select();
    } else if (radN.checked) {
        nodeIn.focus();
    } else {
        difficultySelect.value = "medium";
        nameIn.focus();
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
        mapToolbarHost.replaceChildren();
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

    const topbar = document.createElement("div");
    topbar.className = "dsa-customize-topbar";
    const note = document.createElement("p");
    note.className = "dsa-customize-topbar-note";
    if (siteAdmin) {
        note.textContent =
            "Ring on each node: − remove, count expand/collapse, + add Problem or Node. Pencil beside the ring edits that topic’s label; pencil on a problem row edits the problem. Import/Export can sync to site CMS when signed in as site admin. Toolbar matches Full map (expand / collapse / zoom).";
    } else if (canEditGraph) {
        note.textContent =
            "You can customize the map locally (export JSON to back up). Pushing the shared site graph to the database still requires the site admin account. Upgrade or account type controls this access.";
    } else {
        note.textContent = "This view requires permission to customize the graph.";
    }

    const importInput = document.createElement("input");
    importInput.type = "file";
    importInput.accept = "application/json,.json";
    importInput.hidden = true;
    importInput.setAttribute("aria-hidden", "true");

    const btnExport = document.createElement("button");
    btnExport.type = "button";
    btnExport.className = "dsa-customize-topbar-btn";
    btnExport.textContent = "Export JSON";
    btnExport.addEventListener("click", () => dsaExportUserNodesJson());

    const btnImport = document.createElement("button");
    btnImport.type = "button";
    btnImport.className = "dsa-customize-topbar-btn";
    btnImport.textContent = "Import JSON…";
    if (!siteAdmin) {
        btnImport.hidden = true;
        btnImport.setAttribute("aria-hidden", "true");
    }
    btnImport.addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", () => {
        const file = importInput.files && importInput.files[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            try {
                dsaImportUserNodesFromText(String(reader.result || ""));
                refresh();
                void dsaFlushDsaCmsSync();
            } catch (err) {
                alert("Could not import JSON. Check the file format.");
            }
            importInput.value = "";
        };
        reader.readAsText(file);
    });

    const btnRow = document.createElement("div");
    btnRow.className = "dsa-customize-topbar-row";
    btnRow.appendChild(btnExport);
    btnRow.appendChild(btnImport);
    topbar.appendChild(note);
    topbar.appendChild(btnRow);

    const { canvas, toolbarExpand, toolbarZoom, body } = dsaCreateGraphCanvasLayout(
        mapToolbarHost instanceof HTMLElement ? mapToolbarHost : null,
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

    panel.appendChild(topbar);
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

/** Clear external map toolbar host (expand/collapse/zoom) so listeners are not orphaned. */
function dsaClearExternalMapToolbarHost() {
    const id = dsaGraphMount && dsaGraphMount.mapToolbarHostId;
    const host = id ? document.getElementById(id) : null;
    if (host) {
        host.replaceChildren();
    }
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
    const viewport = document.getElementById(dsaGraphMount.viewportId);
    if (!viewport) {
        return;
    }

    const shellId = dsaGraphMount.shellToolbarId;
    const shellViewToolbarSlot =
        shellId != null && shellId !== "" ? document.getElementById(shellId) : null;
    if (shellViewToolbarSlot) {
        shellViewToolbarSlot.replaceChildren();
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

    function setMindHint(text) {
        const s = text == null ? "" : String(text);
        hint.textContent = s;
        const inlineHint = document.getElementById("dsa-map-toolbar-inline-hint");
        if (inlineHint) {
            inlineHint.textContent = s;
            const wrap = inlineHint.closest(".dsa-graph-map-toolbar-hint");
            if (wrap) {
                wrap.hidden = !s.trim();
            }
            return;
        }
    }

    const toolbar = document.createElement("div");
    toolbar.className = "dsa-view-toolbar";

    const tablist = document.createElement("div");
    tablist.className = "dsa-view-tabs seg dsa-seg-track";
    tablist.setAttribute("role", "tablist");
    tablist.setAttribute("aria-label", "Graph layout");

    const tabThumb = document.createElement("span");
    tabThumb.className = "dsa-seg-thumb";
    tabThumb.setAttribute("aria-hidden", "true");

    const btnUnifiedView = document.createElement("button");
    btnUnifiedView.type = "button";
    btnUnifiedView.className = "dsa-view-btn dsa-view-btn--active";
    btnUnifiedView.setAttribute("role", "tab");
    btnUnifiedView.setAttribute("aria-selected", "true");
    btnUnifiedView.dataset.mode = "unified";
    btnUnifiedView.textContent = "Full map";

    const btnSingleView = document.createElement("button");
    btnSingleView.type = "button";
    btnSingleView.className = "dsa-view-btn";
    btnSingleView.setAttribute("role", "tab");
    btnSingleView.setAttribute("aria-selected", "false");
    btnSingleView.dataset.mode = "single";
    btnSingleView.textContent = "One topic";

    let btnCustomizeView = null;
    if (canCustomize) {
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
    tablist.appendChild(btnSingleView);
    if (btnCustomizeView) {
        tablist.appendChild(btnCustomizeView);
    }
    toolbar.appendChild(tablist);

    if (typeof ResizeObserver !== "undefined") {
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

    if (shellViewToolbarSlot) {
        shellViewToolbarSlot.appendChild(toolbar);
    } else {
        layer.appendChild(toolbar);
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
        if (restore.activeDsId) {
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
            '<p class="cms-empty-msg">No skills in CMS. Sign in at admin, choose <strong>skills</strong>, paste JSON, and save to D1.</p>';
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
    if (link) {
        link.removeAttribute("title");
        link.setAttribute("href", rsa ? "./admin.html" : "./account.html");
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
            if (document.getElementById("dsa-hierarchy-root") && typeof loadDsaPatternsPage === "function") {
                loadDsaPatternsPage();
            }
            syncNavbarAuthUi();
        });
    }
    syncNavbarAuthUi();
}

window.syncNavbarAuthUi = syncNavbarAuthUi;

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


