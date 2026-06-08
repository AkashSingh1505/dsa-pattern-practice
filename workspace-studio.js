/**
 * Orbital graph studio (workspace sandbox) — sector radial layout, zoom/pan, minimap, chips.
 * Expects orbital layer in #ws-graph-layer-orbital inside #canvas-wrap (see workspace.html). Call ORB.init() after DOM ready.
 */
(function () {
    var CATS = { ds: "Data Structure", pattern: "Pattern", problem: "Problem" };
    var CAT_COLORS = { ds: "#3a5bd9", pattern: "#c89020", problem: "#d65082" };
    var NODE_CATS = {
        core: "pattern",
        arrays: "ds",
        graphs: "ds",
        hashing: "pattern",
        strings: "ds",
        recursion: "pattern",
        dp: "pattern",
        trees: "ds",
        sliding: "pattern",
        bfs: "pattern",
        dfs: "pattern",
    };
    var S = {
        nodes: {
            core: { id: "core", name: "DSA", r: 46, color: "accent", isCore: true, mastery: 54, diff: "Mixed" },
            arrays: { id: "arrays", name: "Arrays", r: 30, color: "accent", count: 12, mastery: 62, diff: "Medium" },
            graphs: { id: "graphs", name: "Graphs", r: 30, color: "mint", count: 9, mastery: 41, diff: "Hard" },
            hashing: { id: "hashing", name: "Hashing", r: 30, color: "peach", count: 7, mastery: 74, diff: "Easy" },
            strings: { id: "strings", name: "Strings", r: 30, color: "amber", count: 9, mastery: 48, diff: "Easy" },
            recursion: { id: "recursion", name: "Recursion", r: 30, color: "pink", count: 6, mastery: 60, diff: "Medium" },
            dp: { id: "dp", name: "DP", r: 30, color: "red", count: 14, mastery: 28, diff: "Hard" },
            trees: { id: "trees", name: "Trees", r: 30, color: "accent", count: 8, mastery: 55, diff: "Medium" },
            sliding: { id: "sliding", name: "Sliding W.", r: 22, color: "accent", count: 6, mastery: 62, diff: "Medium" },
            bfs: { id: "bfs", name: "BFS", r: 22, color: "mint", count: 5, mastery: 70, diff: "Medium" },
            dfs: { id: "dfs", name: "DFS", r: 22, color: "accent", count: 7, mastery: 58, diff: "Medium" },
        },
        edges: [
            ["core", "arrays", 1],
            ["core", "graphs", 1],
            ["core", "hashing", 0],
            ["core", "strings", 0],
            ["core", "recursion", 0],
            ["core", "dp", 0],
            ["core", "trees", 1],
            ["arrays", "sliding", 1],
            ["graphs", "bfs", 0],
            ["trees", "dfs", 0],
        ],
        selected: null,
        mode: "customize",
        uid: 100,
        zoom: 1,
        pan: { x: 0, y: 0 },
        collapsed: new Set(),
        focus: "core",
        navPathChain: null,
        categoryFilterSlug: "",
        prevSelected: null,
        canvasUserHeight: null,
        canvasAutoHeight: null,
    };
    Object.keys(S.nodes).forEach(function (k) {
        S.nodes[k].category = NODE_CATS[k] || "pattern";
    });

    var CM = {
        accent: "#3a5bd9",
        mint: "#1aa37a",
        peach: "#e08658",
        amber: "#c89020",
        pink: "#d65082",
        red: "#d04040",
    };

    function pickMindGc(obj) {
        if (!obj || typeof obj !== "object") {
            return "";
        }
        var slug = obj.nodeCategorySlug != null ? String(obj.nodeCategorySlug).trim().toUpperCase() : "";
        if (slug) {
            return slug;
        }
        var a = obj.graphCategoryId != null ? String(obj.graphCategoryId).trim() : "";
        var b = obj.catalogCategoryId != null ? String(obj.catalogCategoryId).trim() : "";
        return a || b;
    }

    function hexForMindCategory(gcId) {
        var id = String(gcId || "").trim();
        if (!id) {
            return "";
        }
        var cats =
            typeof window !== "undefined" && Array.isArray(window.__dsaGraphBodyCategories)
                ? window.__dsaGraphBodyCategories
                : [];
        for (var i = 0; i < cats.length; i++) {
            var c = cats[i];
            if (c && String(c.id) === id && c.color) {
                return String(c.color).trim();
            }
        }
        return "";
    }

    function refreshOrbitalLegendBot() {
        var lb = document.querySelector(".legend-bot");
        if (!lb) {
            return;
        }
        var hint = lb.querySelector("#hint-text");
        var cats =
            typeof window !== "undefined" && Array.isArray(window.__dsaGraphBodyCategories)
                ? window.__dsaGraphBodyCategories
                : [];
        lb.querySelectorAll(".legend-tone").forEach(function (el) {
            el.remove();
        });
        if (cats.length) {
            cats.forEach(function (c) {
                if (!c || (!c.name && !c.id)) {
                    return;
                }
                var sp = document.createElement("span");
                sp.className = "legend-tone";
                var col = String(c.color || "#6b7280").trim();
                sp.style.borderLeft = "3px solid " + col;
                sp.style.paddingLeft = "6px";
                sp.textContent = String(c.name || c.id || "");
                if (hint) {
                    lb.insertBefore(sp, hint);
                } else {
                    lb.appendChild(sp);
                }
            });
        } else {
            ["structure", "pattern", "problems"].forEach(function (lab, idx) {
                var sp = document.createElement("span");
                sp.className = "legend-tone";
                var cols = ["var(--c-accent)", "var(--c-amber)", "var(--c-pink)"];
                sp.style.borderLeft = "3px solid " + cols[idx];
                sp.style.paddingLeft = "6px";
                sp.textContent = lab;
                if (hint) {
                    lb.insertBefore(sp, hint);
                } else {
                    lb.appendChild(sp);
                }
            });
        }
    }
    function rgbaFromHex(hex, a) {
        var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ""));
        if (!m) {
            return "rgba(58,91,217," + a + ")";
        }
        return (
            "rgba(" +
            parseInt(m[1], 16) +
            "," +
            parseInt(m[2], 16) +
            "," +
            parseInt(m[3], 16) +
            "," +
            a +
            ")"
        );
    }
    /** Darken a #RRGGBB badge color for node ring stroke (factor 0–1, lower = darker). */
    function darkenHex(hex, factor) {
        factor = factor == null ? 0.58 : factor;
        var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ""));
        if (!m) {
            return "#243a9a";
        }
        function ch(x) {
            x = Math.round(parseInt(x, 16) * factor);
            return Math.max(0, Math.min(255, x));
        }
        function h2(n) {
            var h = n.toString(16);
            return h.length === 1 ? "0" + h : h;
        }
        return "#" + h2(ch(m[1])) + h2(ch(m[2])) + h2(ch(m[3]));
    }
    /** Lighten #RRGGBB toward white (t 0–1, higher = brighter). */
    function brightenHex(hex, t) {
        t = t == null ? 0.22 : t;
        var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ""));
        if (!m) {
            return "#5a7aff";
        }
        function lift(ch) {
            var x = parseInt(ch, 16);
            return Math.round(Math.min(255, x + (255 - x) * t));
        }
        function h2(n) {
            var h = n.toString(16);
            return h.length === 1 ? "0" + h : h;
        }
        return "#" + h2(lift(m[1])) + h2(lift(m[2])) + h2(lift(m[3]));
    }
    var DIF = ["Easy", "Medium", "Hard", "Mixed"];
    var NS = "http://www.w3.org/2000/svg";
    var svg,
        eg,
        ng,
        cw,
        cb;
    var VB_MIN = { w: 640, h: 560 };
    var VB = { w: VB_MIN.w, h: VB_MIN.h, cx: VB_MIN.w / 2, cy: VB_MIN.h / 2 };

    function visibleNodeIds() {
        return Object.keys(S.nodes).filter(function (id) {
            return visible(id);
        });
    }

    function layoutMetrics() {
        var ids = visibleNodeIds();
        var maxDepth = 0;
        ids.forEach(function (id) {
            maxDepth = Math.max(maxDepth, relDepth(id, S.focus));
        });
        return { count: ids.length, maxDepth: maxDepth };
    }

    function ringRadiiForLayout(count, maxDepth) {
        var BASE = [0, 130, 230, 320, 400, 470];
        var countScale = Math.max(1, Math.sqrt(Math.max(count, 1) / 10) * 0.92);
        var depthExtra = Math.max(0, maxDepth - 4) * 0.12;
        var scale = countScale * (1 + depthExtra);
        var rings = BASE.map(function (r, i) {
            return i === 0 ? 0 : Math.round(r * scale);
        });
        while (rings.length < maxDepth + 2) {
            var last = rings[rings.length - 1] || 470;
            rings.push(last + Math.round(75 * countScale));
        }
        return rings;
    }

    function nodeSizesForLayout(maxDepth) {
        var sizes = [46, 30, 22, 17, 14, 12];
        while (sizes.length < maxDepth + 2) {
            sizes.push(Math.max(10, sizes[sizes.length - 1] - 1));
        }
        return sizes;
    }

    function fitViewBoxToContent() {
        var margin = 84;
        var list = visibleNodeIds().map(function (id) {
            return S.nodes[id];
        });
        if (!list.length) {
            VB.w = VB_MIN.w;
            VB.h = VB_MIN.h;
            VB.cx = VB.w / 2;
            VB.cy = VB.h / 2;
            updateMinimapViewBox();
            return;
        }
        var minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity;
        list.forEach(function (n) {
            minX = Math.min(minX, n.x - n.r);
            maxX = Math.max(maxX, n.x + n.r);
            minY = Math.min(minY, n.y - n.r);
            maxY = Math.max(maxY, n.y + n.r);
        });
        VB.w = Math.max(VB_MIN.w, maxX - minX + margin * 2);
        VB.h = Math.max(VB_MIN.h, maxY - minY + margin * 2);
        VB.cx = (minX + maxX) / 2;
        VB.cy = (minY + maxY) / 2;
        updateMinimapViewBox();
    }

    function updateMinimapViewBox() {
        var mmSvg = $("mm-svg");
        if (mmSvg) {
            mmSvg.setAttribute("viewBox", "0 0 " + VB.w + " " + VB.h);
        }
    }

    function syncCanvasElementSize() {
        if (!cw) {
            return;
        }
        var metrics = layoutMetrics();
        var aspect = VB.w / Math.max(VB.h, 1);
        var baseW = cw.clientWidth || 720;
        var autoH = Math.round(baseW / aspect);
        var countBoost = Math.max(0, (metrics.count - 10) * 10);
        autoH = Math.max(VB_MIN.h, autoH, 480 + countBoost);
        var maxAuto = Math.round(window.innerHeight * (metrics.count > 24 ? 1.2 : 0.86));
        autoH = Math.min(autoH, maxAuto);
        if (S.canvasUserHeight) {
            autoH = Math.max(autoH, S.canvasUserHeight);
        }
        S.canvasAutoHeight = autoH;
        cw.style.height = autoH + "px";
        cw.style.minHeight = autoH + "px";
    }

    function $(id) {
        return document.getElementById(id);
    }
    function E(t, a) {
        var e = document.createElementNS(NS, t);
        a = a || {};
        for (var k in a) {
            if (Object.prototype.hasOwnProperty.call(a, k)) {
                e.setAttribute(k, a[k]);
            }
        }
        return e;
    }
    /** Resolves url(#id) when the page uses a base URL (bare fragment refs can break). */
    function svgFragUrl(id) {
        try {
            if (typeof document !== "undefined" && document.baseURI) {
                return "url(" + new URL("#" + id, document.baseURI).href + ")";
            }
        } catch (e) {}
        return "url(#" + id + ")";
    }
    function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }
    function advanceSelection(newSel) {
        if (S.selected === newSel) {
            return;
        }
        S.prevSelected = S.selected;
        S.selected = newSel;
    }

    function childIds(id) {
        return S.edges
            .filter(function (ft) {
                return ft[0] === id;
            })
            .map(function (ft) {
                return ft[1];
            })
            .filter(function (t) {
                return S.nodes[t];
            });
    }
    function parentOf(id) {
        var e = S.edges.find(function (ft) {
            return ft[1] === id;
        });
        return e ? e[0] : null;
    }
    /** Chain from current focus root down to `id` (inclusive). */
    function pathFocusTo(id) {
        if (!id || !S.nodes[id]) {
            return [];
        }
        var full = pathTo(id);
        var i = full.indexOf(S.focus);
        if (i < 0) {
            return [];
        }
        return full.slice(i);
    }
    function pathTo(id) {
        var out = [];
        var c = id;
        while (c) {
            out.unshift(c);
            c = parentOf(c);
        }
        return out;
    }
    function inSubtree(id, root) {
        if (id === root) {
            return true;
        }
        var c = parentOf(id);
        while (c) {
            if (c === root) {
                return true;
            }
            c = parentOf(c);
        }
        return false;
    }
    function relDepth(id, root) {
        if (id === root) {
            return 0;
        }
        var d = 0,
            c = id;
        while (c && c !== root) {
            c = parentOf(c);
            d++;
            if (d > 50) {
                break;
            }
        }
        return d;
    }
    function hiddenCount(id) {
        var c = 0;
        var stk = [id];
        while (stk.length) {
            var x = stk.pop();
            childIds(x).forEach(function (k) {
                c++;
                stk.push(k);
            });
        }
        return c;
    }
    function visible(id) {
        if (id === S.focus) {
            return true;
        }
        if (!inSubtree(id, S.focus)) {
            return false;
        }
        var c = parentOf(id);
        while (c && c !== S.focus) {
            if (S.collapsed.has(c)) {
                return false;
            }
            c = parentOf(c);
        }
        return true;
    }

    function layoutRadial() {
        var root = S.focus;
        var metrics = layoutMetrics();
        var RINGS = ringRadiiForLayout(metrics.count, metrics.maxDepth);
        var SIZES = nodeSizesForLayout(metrics.maxDepth);
        function w(id) {
            var k = childIds(id).filter(function (c) {
                return visible(c);
            });
            if (!k.length) {
                return 1;
            }
            return k.reduce(function (s, c) {
                return s + w(c);
            }, 0);
        }
        function place(id, depth, a0, a1) {
            var n = S.nodes[id];
            if (!n) {
                return;
            }
            if (id === root) {
                n.x = VB.cx;
                n.y = VB.cy;
                n.r = SIZES[0];
            } else {
                var mid = (a0 + a1) / 2,
                    r = RINGS[Math.min(depth, RINGS.length - 1)];
                n.x = VB.cx + Math.cos(mid) * r;
                n.y = VB.cy + Math.sin(mid) * r;
                n.r = SIZES[Math.min(depth, SIZES.length - 1)];
            }
            var k = childIds(id).filter(function (c) {
                return visible(c);
            });
            if (!k.length) {
                return;
            }
            var ws = k.map(function (c) {
                    return w(c);
                }),
                tot = ws.reduce(function (a, b) {
                    return a + b;
                }, 0);
            var cur = a0;
            k.forEach(function (c, i) {
                var wd = (a1 - a0) * (ws[i] / tot);
                place(c, depth + 1, cur, cur + wd);
                cur += wd;
            });
        }
        place(root, 0, -Math.PI / 2, (Math.PI * 3) / 2);
        Object.keys(S.nodes).forEach(function (nid) {
            var nn = S.nodes[nid];
            if (nn) {
                nn._lr = nn.r;
            }
        });
        recalcNodeRadii();
        resolveOverlaps();
        fitViewBoxToContent();
        syncCanvasElementSize();
        applyView();
    }

    /** Push overlapping nodes apart (core fixed). View box expands to fit afterward. */
    function resolveOverlaps(maxIter) {
        var list = Object.keys(S.nodes)
            .map(function (k) {
                return S.nodes[k];
            })
            .filter(function (n) {
                return visible(n.id);
            });
        maxIter = maxIter == null ? Math.min(36, 14 + Math.floor(list.length / 6)) : maxIter;
        var pad = Math.max(10, Math.min(26, 8 + list.length * 0.14));
        for (var iter = 0; iter < maxIter; iter++) {
            var moved = false;
            for (var i = 0; i < list.length; i++) {
                for (var j = i + 1; j < list.length; j++) {
                    var a = list[i],
                        b = list[j];
                    var dx = b.x - a.x,
                        dy = b.y - a.y;
                    var d = Math.hypot(dx, dy) || 1e-6;
                    var need = a.r + b.r + pad;
                    if (d >= need) {
                        continue;
                    }
                    var gap = need - d;
                    var ux = dx / d,
                        uy = dy / d;
                    if (a.isCore && !b.isCore) {
                        b.x += ux * gap;
                        b.y += uy * gap;
                        moved = true;
                    } else if (b.isCore && !a.isCore) {
                        a.x -= ux * gap;
                        a.y -= uy * gap;
                        moved = true;
                    } else if (!a.isCore && !b.isCore) {
                        var half = gap / 2;
                        a.x -= ux * half;
                        a.y -= uy * half;
                        b.x += ux * half;
                        b.y += uy * half;
                        moved = true;
                    }
                }
            }
            if (!moved) {
                break;
            }
        }
    }

    /** After layout, grow each node radius so title + optional child count fit without clipping. */
    function recalcNodeRadii() {
        Object.keys(S.nodes).forEach(function (nid) {
            var nn = S.nodes[nid];
            if (!nn || nn._lr == null) {
                return;
            }
            nn.r = computeMinRadiusForNode(nn, nn._lr);
        });
    }

    function autoCollapseFirstLevelSubtrees() {
        S.collapsed = new Set();
        Object.keys(S.nodes).forEach(function (id) {
            if (id === S.focus || !inSubtree(id, S.focus)) {
                return;
            }
            if (relDepth(id, S.focus) === 1 && childIds(id).length) {
                S.collapsed.add(id);
            }
        });
    }

    /** Same tree resolution as script.js getDsTree (inline for orbital sync). */
    function getDsTreeForOrb(ds) {
        if (!ds || typeof ds !== "object") {
            return [];
        }
        if (Array.isArray(ds.tree) && ds.tree.length > 0) {
            return ds.tree;
        }
        return (ds.patterns || []).map(function (p) {
            return {
                name: p.name,
                problems: p.problems || [],
                children: p.children || [],
            };
        });
    }

    /**
     * Rebuild orbital graph from live mind-map JSON (same source as Linear / Apply).
     * @returns {boolean} true if rebuild ran
     */
    function syncFromMindMapHierarchy() {
        if (typeof dsaGetMindMapHierarchyJsonString !== "function") {
            return false;
        }
        var arr;
        try {
            arr = JSON.parse(
                typeof dsaGetMindMapHierarchyMergedJsonString === "function"
                    ? dsaGetMindMapHierarchyMergedJsonString()
                    : dsaGetMindMapHierarchyJsonString(),
            );
        } catch (e1) {
            return false;
        }
        if (!Array.isArray(arr)) {
            return false;
        }

        var nodes = {};
        var edges = [];
        var colors = ["accent", "mint", "peach", "amber", "pink", "red"];
        var uid = 0;
        function nextId() {
            uid += 1;
            return "h_" + uid;
        }

        var metaLabel =
            arr.length === 1 && arr[0] && typeof arr[0].name === "string" && String(arr[0].name).trim()
                ? String(arr[0].name).trim().slice(0, 28)
                : "Graph";
        nodes.core = {
            id: "core",
            name: metaLabel,
            r: 44,
            color: "accent",
            isCore: true,
            mastery: 0,
            diff: "Mixed",
            category: "pattern",
            ringHex: "",
        };

        if (!arr.length) {
            S.nodes = nodes;
            S.edges = [];
            S.focus = "core";
            S.selected = null;
            S.prevSelected = null;
            S.collapsed = new Set();
            S.uid = Math.max(S.uid || 0, uid) + 100;
            autoCollapseFirstLevelSubtrees();
            layoutRadial();
            render();
            applyView();
            refreshOrbitalLegendBot();
            return true;
        }

        arr.forEach(function (ds, i) {
            if (!ds || typeof ds !== "object") {
                return;
            }
            var tree = getDsTreeForOrb(ds);
            var col = colors[i % colors.length];
            var singleTop = arr.length === 1;
            var parentForTopics = "core";
            if (!singleTop) {
                var dsKey = nextId();
                var dsName = String(ds.name != null ? ds.name : "Root " + (i + 1)).slice(0, 22);
                var hexDs = hexForMindCategory(pickMindGc(ds));
                nodes[dsKey] = {
                    id: dsKey,
                    name: dsName,
                    r: 32,
                    color: col,
                    ringHex: hexDs || "",
                    count: tree.length,
                    mastery: 0,
                    diff: "Medium",
                    category: "ds",
                    mindPath: String(ds.id != null ? ds.id : dsKey),
                    categorySlug: "ROOT",
                };
                edges.push(["core", dsKey, 1]);
                parentForTopics = dsKey;
            }

            var dsId = String(ds.id != null ? ds.id : "ds" + i);
            var dsPathPrefix = singleTop ? dsId : String(nodes[parentForTopics] && nodes[parentForTopics].mindPath ? nodes[parentForTopics].mindPath : dsId);
            var maxTopics = 14;
            var maxOrbNodes = 500;
            var orbNodeCount = Object.keys(nodes).length;

            function appendMindBranch(node, orbParentId, pathPrefix, depth, siblingIdx) {
                if (!node || typeof node !== "object" || orbNodeCount >= maxOrbNodes) {
                    return null;
                }
                var rawName = String(node.name != null ? node.name : "Untitled").trim() || "Untitled";
                var name = rawName.slice(0, 22);
                var mindPath = (pathPrefix ? pathPrefix + "::" + rawName : rawName).trim();
                var chChildren = Array.isArray(node.children) ? node.children : [];
                var probs = Array.isArray(node.problems) ? node.problems : [];
                var isLeafProblems = probs.length > 0 && chChildren.length === 0;
                var hexCh = hexForMindCategory(pickMindGc(node));
                var slug = String(
                    node.nodeCategorySlug || (isLeafProblems ? "PROBLEM" : depth <= 1 ? "TOPIC" : "PATTERN"),
                ).toUpperCase();
                var key = nextId();
                orbNodeCount += 1;
                nodes[key] = {
                    id: key,
                    name: name,
                    r: depth > 1 || tree.length > 10 ? 17 : 20,
                    color: col,
                    ringHex: hexCh || "",
                    count: chChildren.length + probs.length,
                    mastery: 0,
                    diff: String(node.difficulty || node.diff || "Medium").replace(/^\w/, function (c) {
                        return c.toUpperCase();
                    }),
                    category: isLeafProblems || slug === "PROBLEM" ? "problem" : "pattern",
                    mindPath: mindPath,
                    categorySlug: slug,
                };
                edges.push([orbParentId, key, depth <= 1 && siblingIdx < 5 ? 1 : 0]);

                chChildren.forEach(function (ch, j) {
                    appendMindBranch(ch, key, mindPath, depth + 1, j);
                });
                probs.forEach(function (pr) {
                    if (orbNodeCount >= maxOrbNodes) {
                        return;
                    }
                    var pRaw = String(pr && pr.name != null ? pr.name : "Problem").trim() || "Problem";
                    var pName = pRaw.slice(0, 22);
                    var pKey = nextId();
                    orbNodeCount += 1;
                    var pHex = hexForMindCategory(pickMindGc(pr));
                    nodes[pKey] = {
                        id: pKey,
                        name: pName,
                        r: 14,
                        color: col,
                        ringHex: pHex || "",
                        count: 0,
                        mastery: 0,
                        diff: String(pr.difficulty || "Medium").replace(/^\w/, function (c) {
                            return c.toUpperCase();
                        }),
                        category: "problem",
                        mindPath: mindPath + "::" + pRaw,
                        categorySlug: "PROBLEM",
                    };
                    edges.push([key, pKey, 0]);
                });
                return key;
            }

            tree.slice(0, maxTopics).forEach(function (ch, j) {
                appendMindBranch(ch, parentForTopics, dsPathPrefix, 1, j);
            });
        });

        S.nodes = nodes;
        S.edges = edges;
        S.focus = "core";
        S.selected = null;
        S.prevSelected = null;
        S.collapsed = new Set();
        S.uid = Math.max(S.uid || 0, uid) + 100;

        autoCollapseFirstLevelSubtrees();
        layoutRadial();
        render();
        applyView();
        refreshOrbitalLegendBot();
        if (typeof window.wsRenderFileTree === "function") {
            window.wsRenderFileTree();
        }
        return true;
    }

    function resolveMindPathToNodeId(path) {
        var p = String(path || "").trim();
        if (!p || !S.nodes) {
            return null;
        }
        var exact = null;
        var prefixBest = null;
        var prefixLen = 0;
        Object.keys(S.nodes).forEach(function (nid) {
            var n = S.nodes[nid];
            if (!n || n.isCore) {
                return;
            }
            var mp = n.mindPath ? String(n.mindPath) : "";
            if (mp === p) {
                exact = nid;
                return;
            }
            if (mp && p.indexOf(mp) === 0 && mp.length > prefixLen) {
                prefixBest = nid;
                prefixLen = mp.length;
            }
        });
        var target = exact || prefixBest;
        if (!target) {
            var parts = p.split("::").filter(Boolean);
            var want = parts.length ? parts[parts.length - 1].toLowerCase() : "";
            Object.keys(S.nodes).forEach(function (nid) {
                var n = S.nodes[nid];
                if (!n || n.isCore) {
                    return;
                }
                if (String(n.name || "").toLowerCase() === want) {
                    target = nid;
                }
            });
        }
        return target && S.nodes[target] ? target : null;
    }

    /** Double-click / nav focus — zoom into subtree rooted at target. */
    function focusByMindPath(path) {
        var target = resolveMindPathToNodeId(path);
        if (target) {
            S.navPathChain = null;
            S.categoryFilterSlug = "";
            setFocus(target);
        }
    }

    /** File explorer → expand root→node path, highlight edges, select target. */
    function navigateMindPath(path) {
        var target = resolveMindPathToNodeId(path);
        if (!target) {
            return;
        }
        S.categoryFilterSlug = "";
        S.focus = "core";
        var chain = pathTo(target);
        chain.forEach(function (nid) {
            S.collapsed.delete(nid);
        });
        S.navPathChain = chain;
        layoutRadial();
        advanceSelection(target);
        render();
        apply();
        sidebar();
        inspector();
    }

    function highlightCategory(slug, paths) {
        S.categoryFilterSlug = String(slug || "").toUpperCase();
        S.navPathChain = null;
        advanceSelection(null);
        render();
        apply();
    }

    function clearCategoryFilter() {
        S.categoryFilterSlug = "";
        S.navPathChain = null;
        apply();
    }

    function curve(a, b) {
        var dx = b.x - a.x,
            dy = b.y - a.y,
            L = Math.hypot(dx, dy) || 1,
            ux = dx / L,
            uy = dy / L,
            x1 = a.x + ux * a.r,
            y1 = a.y + uy * a.r,
            x2 = b.x - ux * b.r,
            y2 = b.y - uy * b.r,
            px = -uy,
            py = ux,
            bow = Math.min(18, L * 0.06),
            mx = (x1 + x2) / 2 + px * bow,
            my = (y1 + y2) / 2 + py * bow;
        return "M" + x1 + "," + y1 + " Q" + mx + "," + my + " " + x2 + "," + y2;
    }

    /** Padding between ring and label content (~8dp in CSS px). */
    var NODE_CONTENT_PAD = 8;

    function wrapLines(str, maxWpx, fontPx) {
        str = String(str || "").trim();
        var maxChars = Math.max(4, Math.floor(maxWpx / (fontPx * 0.5)));
        function hardChunk(word) {
            var out = [],
                w = word;
            while (w.length > maxChars) {
                out.push(w.slice(0, maxChars));
                w = w.slice(maxChars);
            }
            if (w) {
                out.push(w);
            }
            return out.length ? out : [""];
        }
        if (!str) {
            return [" "];
        }
        var words = str.split(/\s+/);
        var lines = [];
        var cur = "";
        words.forEach(function (word) {
            var parts = word.length > maxChars ? hardChunk(word) : [word];
            parts.forEach(function (pw) {
                var next = cur ? cur + " " + pw : pw;
                if (next.length <= maxChars) {
                    cur = next;
                } else {
                    if (cur) {
                        lines.push(cur);
                    }
                    cur = pw;
                }
            });
        });
        if (cur) {
            lines.push(cur);
        }
        return lines.length ? lines : [" "];
    }

    /** Layout plan for title (and optional sub row); `truncated` true if text had to ellipsize. */
    function planLabelLines(n, r, reserveSubRow) {
        var fontPx = r <= 18 ? 9.5 : r <= 22 ? 10.5 : 11.5;
        var innerR = Math.max(4, r - NODE_CONTENT_PAD);
        var maxW = 2 * innerR;
        var lh = fontPx * 1.18;
        var maxChars = Math.max(4, Math.floor(maxW / (fontPx * 0.5)));
        var lines = wrapLines(n.name, maxW, fontPx);
        var truncated = false;
        lines = lines.map(function (ln) {
            if (ln.length <= maxChars) {
                return ln;
            }
            truncated = true;
            return ln.slice(0, Math.max(1, maxChars - 1)) + "\u2026";
        });
        var innerD = 2 * innerR;
        var subReserve = reserveSubRow ? 18 : 0;
        var maxLinesByH = Math.max(1, Math.floor((innerD - fontPx - subReserve) / lh));
        var maxLines = Math.min(r <= 18 ? 5 : r <= 22 ? 6 : 7, maxLinesByH);
        if (lines.length > maxLines) {
            truncated = true;
            lines = lines.slice(0, maxLines);
            var lastPlain = lines[maxLines - 1].replace(/\u2026$/, "");
            lines[maxLines - 1] = lastPlain.slice(0, Math.max(1, maxChars - 1)) + "\u2026";
        }
        var startY = -((lines.length - 1) * lh) / 2;
        return { lines: lines, fontPx: fontPx, lh: lh, truncated: truncated, startY: startY };
    }

    function computeMinRadiusForNode(n, baseR) {
        var ch = childIds(n.id).length;
        var reserve = ch > 0;
        var cap = n.isCore ? 64 : Math.min(56, Math.max(30, baseR + 28));
        var lo = Math.max(12, baseR);
        var r;
        for (r = lo; r <= cap; r++) {
            if (!planLabelLines(n, r, reserve).truncated) {
                return r;
            }
        }
        return cap;
    }

    function appendNodeLabels(labelG, n, r) {
        var ch = childIds(n.id).length;
        var plan = planLabelLines(n, r, ch > 0);
        var t = E("text", {
            class: "node-title",
            x: 0,
            y: plan.startY,
            "text-anchor": "middle",
        });
        if (r <= 18) {
            t.setAttribute("font-size", "9.5px");
        } else if (r <= 22) {
            t.setAttribute("font-size", "10.5px");
        }
        plan.lines.forEach(function (ln, i) {
            var ts = E("tspan", { x: 0, dy: i === 0 ? 0 : plan.lh });
            ts.textContent = ln;
            t.appendChild(ts);
        });
        labelG.appendChild(t);
        if (ch > 0) {
            var subFs = r <= 20 ? 8.5 : 9.5;
            var gap = 5;
            var subY = plan.startY + (plan.lines.length - 1) * plan.lh + plan.fontPx * 0.72 + gap + subFs * 0.35;
            var st = E("text", {
                class: "sub",
                x: 0,
                y: subY,
                "text-anchor": "middle",
            });
            st.setAttribute("font-size", subFs + "px");
            st.textContent = ch === 1 ? "1 child" : ch + " children";
            labelG.appendChild(st);
        }
    }

    function buildNode(n) {
        var isSel = !!S.selected && n.id === S.selected;
        var isPrev = S.prevSelected && n.id === S.prevSelected && n.id !== S.selected;
        var brandHex = (n.ringHex && String(n.ringHex).trim()) || CM[n.color] || CM.accent;
        var cls =
            "pv-node " +
            n.color +
            (isSel ? " selected" : "") +
            (!n.isCore ? " active" : "") +
            (isPrev && !isSel ? " prev-selected" : "");
        var g = E("g", {
            class: cls.replace(/\s+/g, " ").trim(),
            "data-id": n.id,
            transform: "translate(" + n.x + "," + n.y + ")",
        });
        if (isPrev && !isSel) {
            g.style.setProperty("--prev-ring-fill", rgbaFromHex(brandHex, 0.14));
            g.style.setProperty("--prev-ring-stroke", brightenHex(brandHex, 0.26));
        } else {
            g.style.removeProperty("--prev-ring-fill");
            g.style.removeProperty("--prev-ring-stroke");
        }
        var r = n.r,
            pR = n.r + 6,
            circ = 2 * Math.PI * pR,
            pct = (Math.max(0, Math.min(100, n.mastery || 0)) / 100);
        var safeId = String(n.id).replace(/[^a-zA-Z0-9_-]/g, "_");
        var clipId = "nclip_" + safeId;
        var localDefs = E("defs");
        var cp = E("clipPath", { id: clipId });
        cp.appendChild(
            E("circle", {
                cx: 0,
                cy: 0,
                r: Math.max(4, r - NODE_CONTENT_PAD),
            }),
        );
        localDefs.appendChild(cp);
        g.appendChild(localDefs);
        g.appendChild(E("circle", { class: "prog-track", cx: 0, cy: 0, r: pR }));
        if (pct > 0) {
            g.appendChild(
                E("circle", {
                    class: "prog-arc",
                    cx: 0,
                    cy: 0,
                    r: pR,
                    stroke: brandHex,
                    "stroke-dasharray": circ * pct + " " + circ,
                    transform: "rotate(-90)",
                }),
            );
        }
        g.appendChild(
            E("circle", {
                class: "ring",
                cx: 0,
                cy: 0,
                r: r,
            }),
        );
        var labelG = E("g", { class: "pv-node-labels", "clip-path": svgFragUrl(clipId) });
        if (n.category === "problem") {
            g.classList.add("ws-problem-node");
            g.setAttribute("data-full-name", n.name);
            g.appendChild(
                E("circle", {
                    class: "problem-dot",
                    cx: 0,
                    cy: 0,
                    r: Math.max(3, r * 0.38),
                    fill: brandHex,
                    opacity: 0.92,
                    style: "display:none",
                }),
            );
        }
        appendNodeLabels(labelG, n, r);
        g.appendChild(labelG);
        return g;
    }

    function svgScreenScale() {
        if (!svg) {
            return 1;
        }
        var sr = svg.getBoundingClientRect();
        var vb = svg.viewBox.baseVal;
        if (!vb || !vb.width || !sr.width) {
            return 1;
        }
        return sr.width / vb.width;
    }

    function zoomDetailTier() {
        if (S.zoom <= 0.48) {
            return "far";
        }
        if (S.zoom <= 0.72) {
            return "mid";
        }
        return "near";
    }

    function rebuildNodeTitle(g, n) {
        var labelG = g.querySelector(".pv-node-labels");
        if (!labelG || !n) {
            return;
        }
        labelG.innerHTML = "";
        appendNodeLabels(labelG, n, n.r);
    }

    function applyProblemLabelLod(tier) {
        document.querySelectorAll("#svg .pv-node.ws-problem-node").forEach(function (g) {
            var title = g.querySelector(".node-title");
            var sub = g.querySelector(".sub");
            var dot = g.querySelector(".problem-dot");
            var id = g.dataset.id;
            var n = id ? S.nodes[id] : null;
            if (tier === "far") {
                if (dot) {
                    dot.removeAttribute("display");
                }
                if (title) {
                    title.style.display = "none";
                }
                if (sub) {
                    sub.style.display = "none";
                }
            } else if (tier === "mid") {
                if (dot) {
                    dot.setAttribute("display", "none");
                }
                if (title) {
                    title.style.display = "";
                    title.innerHTML = "";
                    var ts = E("tspan", { x: 0, dy: 0 });
                    ts.textContent = "\u2026";
                    title.appendChild(ts);
                }
                if (sub) {
                    sub.style.display = "none";
                }
            } else if (n) {
                if (dot) {
                    dot.setAttribute("display", "none");
                }
                rebuildNodeTitle(g, n);
            }
        });
    }

    function semanticZoom() {
        if (!svg) {
            return;
        }
        var pxPerUnit = svgScreenScale();
        if (!pxPerUnit || pxPerUnit <= 0) {
            return;
        }
        var tier = zoomDetailTier();
        svg.setAttribute("data-zoom-tier", tier);

        var edgePx = clamp(2.1 - S.zoom * 0.8, 1.6, 3.2);
        var ringPx = clamp(1.85 - S.zoom * 0.55, 1.35, 2.8);
        var edgeSw = clamp(edgePx / pxPerUnit, 1.5, 14);
        var ringSw = clamp(ringPx / pxPerUnit, 1.2, 12);
        var titlePx = clamp(10.5 / pxPerUnit, 10, 26);
        var subPx = clamp(8.5 / pxPerUnit, 8, 18);

        document.querySelectorAll("#svg .pv-edge").forEach(function (p) {
            var isProblem = p.classList.contains("pv-edge-problem");
            var isSel = p.classList.contains("sel-ring");
            var isDim = p.classList.contains("dim") && !isSel;
            var sw = isProblem ? edgeSw * 1.15 : edgeSw;
            if (isSel) {
                sw *= 1.2;
            }
            p.setAttribute("stroke-width", sw.toFixed(2));
            p.setAttribute("stroke-opacity", isDim ? 0.38 : isProblem ? 0.72 : S.zoom < 0.55 ? 0.62 : 0.78);
        });

        document.querySelectorAll("#svg .pv-node .ring").forEach(function (ring) {
            ring.setAttribute("stroke-width", ringSw.toFixed(2));
        });

        document.querySelectorAll("#svg .pv-node:not(.ws-problem-node) .node-title").forEach(function (t) {
            t.setAttribute("font-size", titlePx.toFixed(1) + "px");
        });
        document.querySelectorAll("#svg .pv-node:not(.ws-problem-node) .sub").forEach(function (t) {
            t.setAttribute("font-size", subPx.toFixed(1) + "px");
        });

        document.querySelectorAll("#svg .pv-node.ws-problem-node .problem-dot").forEach(function (dot) {
            var rPx = clamp(5.5, 4.5, 7);
            dot.setAttribute("r", (rPx / pxPerUnit).toFixed(2));
        });

        applyProblemLabelLod(tier);
    }

    function applyView() {
        var w = VB.w / S.zoom,
            h = VB.h / S.zoom;
        var x = VB.cx - w / 2 + (S.pan.x || 0);
        var y = VB.cy - h / 2 + (S.pan.y || 0);
        svg.setAttribute("viewBox", x + " " + y + " " + w + " " + h);
        var zv = $("zoom-val");
        if (zv) {
            zv.textContent = Math.round(S.zoom * 100) + "%";
        }
        meta();
        drawMinimap();
        semanticZoom();
    }

    function drawMinimap() {
        var mng = $("mm-nodes");
        var vp = $("mm-vp");
        if (!mng || !vp || !svg) {
            return;
        }
        mng.innerHTML = "";
        Object.values(S.nodes).forEach(function (n) {
            if (!visible(n.id)) {
                return;
            }
            mng.appendChild(
                E("circle", {
                    cx: n.x,
                    cy: n.y,
                    r: Math.max(4, n.r * 0.45),
                    fill: (n.ringHex && String(n.ringHex).trim()) || CM[n.color] || "#888",
                    opacity: 0.45,
                }),
            );
        });
        var vb = svg.viewBox.baseVal;
        vp.setAttribute("x", vb.x);
        vp.setAttribute("y", vb.y);
        vp.setAttribute("width", vb.width);
        vp.setAttribute("height", vb.height);
    }

    function meta() {
        var mc = $("meta-corner");
        if (mc) {
            mc.textContent =
                "graph.render · " +
                Object.keys(S.nodes).length +
                "n · " +
                S.edges.length +
                "e · z" +
                Math.round(S.zoom * 100) +
                "%";
        }
        var e = 0,
            m = 0,
            h = 0,
            total = 0,
            sum = 0,
            cds = 0,
            cp = 0,
            cpr = 0;
        Object.values(S.nodes).forEach(function (n) {
            if (n.category === "ds") {
                cds++;
            } else if (n.category === "pattern") {
                cp++;
            } else if (n.category === "problem") {
                cpr++;
            }
            if (n.isCore) {
                return;
            }
            var c = n.count || 0;
            if (n.diff === "Easy") {
                e += c;
            } else if (n.diff === "Hard") {
                h += c;
            } else if (n.diff === "Medium") {
                m += c;
            }
            sum += n.mastery || 0;
            total++;
        });
        var ge = $("cnt-easy"),
            gm = $("cnt-med"),
            gh = $("cnt-hard");
        if (typeof window.wsRenderDifficultyStats === "function") {
            window.wsRenderDifficultyStats();
        } else {
            if (ge) {
                ge.textContent = e;
            }
            if (gm) {
                gm.textContent = m;
            }
            if (gh) {
                gh.textContent = h;
            }
        }
        var cd = $("cnt-ds"),
            cpat = $("cnt-pat"),
            cprob = $("cnt-prob");
        if (cd) {
            cd.textContent = cds;
        }
        if (cpat) {
            cpat.textContent = cp;
        }
        if (cprob) {
            cprob.textContent = cpr;
        }
        var am = $("avg-mastery");
        if (am) {
            am.textContent = (total ? Math.round(sum / total) : 0) + "%";
        }
    }

    function sidebar() {
        var w = $("patterns");
        if (!w) {
            return;
        }
        w.innerHTML = "";
        childIds(S.focus).forEach(function (id) {
            var n = S.nodes[id];
            if (!n) {
                return;
            }
            var it = document.createElement("div");
            it.className = "item" + (S.selected === id ? " active" : "");
            it.dataset.id = id;
            var tone = (n.ringHex && String(n.ringHex).trim()) || CAT_COLORS[n.category || "pattern"] || CAT_COLORS.pattern;
            it.innerHTML =
                '<span class="orb-row-tone" style="border-left:3px solid ' +
                tone +
                '"></span> ' +
                n.name +
                ' <span class="count">' +
                (n.count || hiddenCount(id) || 0) +
                "</span>";
            it.onclick = function () {
                select(id);
            };
            w.appendChild(it);
        });
    }

    function select(id) {
        var n = S.nodes[id];
        var didExpand = false;
        if (n) {
            pathTo(id).forEach(function (nid) {
                if (S.collapsed.has(nid)) {
                    S.collapsed.delete(nid);
                    didExpand = true;
                }
            });
            if (didExpand) {
                layoutRadial();
            }
        }
        advanceSelection(id);
        if (didExpand) {
            render();
        } else {
            apply();
            sidebar();
            inspector();
        }
    }

    function clearSelection() {
        advanceSelection(null);
        apply();
        sidebar();
        inspector();
    }

    function patchRingPaint() {
        document.querySelectorAll("#svg .pv-node").forEach(function (g) {
            var nid = g.dataset.id;
            var node = S.nodes[nid];
            var ring = g.querySelector(".ring");
            if (!ring || !node) {
                return;
            }
            var isPrev = S.prevSelected && nid === S.prevSelected && nid !== S.selected;
            g.classList.toggle("prev-selected", !!isPrev && !g.classList.contains("selected"));
            if (isPrev && !g.classList.contains("selected")) {
                var bh = (node.ringHex && String(node.ringHex).trim()) || CM[node.color] || CM.accent;
                g.style.setProperty("--prev-ring-fill", rgbaFromHex(bh, 0.14));
                g.style.setProperty("--prev-ring-stroke", brightenHex(bh, 0.26));
            } else {
                g.style.removeProperty("--prev-ring-fill");
                g.style.removeProperty("--prev-ring-stroke");
            }
            ring.removeAttribute("fill");
            ring.removeAttribute("stroke");
            ring.removeAttribute("stroke-width");
        });
    }

    function apply() {
        var id = S.selected;
        document.querySelectorAll("#svg .pv-node").forEach(function (n) {
            n.classList.toggle("selected", !!id && n.dataset.id === id);
        });
        if (S.categoryFilterSlug) {
            document.querySelectorAll("#svg .pv-node").forEach(function (el) {
                var nid = el.dataset.id;
                var node = S.nodes[nid];
                var slug = node && node.categorySlug ? String(node.categorySlug).toUpperCase() : "";
                var match =
                    node &&
                    !node.isCore &&
                    (slug === S.categoryFilterSlug ||
                        (S.categoryFilterSlug === "ROOT" && node.category === "ds") ||
                        (S.categoryFilterSlug === "PATTERN" && node.category === "pattern") ||
                        (S.categoryFilterSlug === "PROBLEM" && node.category === "problem"));
                el.classList.toggle("dim", !match && nid !== id);
                el.classList.toggle("ws-cat-match", !!match);
            });
            document.querySelectorAll("#svg .pv-edge").forEach(function (e) {
                e.classList.remove("sel-ring");
                e.classList.add("dim");
            });
            patchRingPaint();
            semanticZoom();
            return;
        }
        if (!id || !S.nodes[id]) {
            document.querySelectorAll("#svg .pv-node").forEach(function (el) {
                el.classList.remove("dim", "ws-cat-match");
            });
            document.querySelectorAll("#svg .pv-edge").forEach(function (e) {
                e.classList.remove("dim", "sel-ring");
            });
            patchRingPaint();
            semanticZoom();
            return;
        }
        var bright = {};
        var path = S.navPathChain && S.navPathChain.length ? S.navPathChain : pathFocusTo(id);
        if (!path.length) {
            path = [id];
        }
        path.forEach(function (nid) {
            bright[nid] = true;
        });
        childIds(id).forEach(function (c) {
            bright[c] = true;
        });
        document.querySelectorAll("#svg .pv-node").forEach(function (el) {
            var nid = el.dataset.id;
            if (bright[nid]) {
                el.classList.remove("dim");
            } else {
                el.classList.add("dim");
            }
            el.classList.remove("ws-cat-match");
        });
        document.querySelectorAll("#svg .pv-edge").forEach(function (e) {
            var nf = e.getAttribute("data-from"),
                nt = e.getAttribute("data-to");
            var onPath = false;
            if (S.navPathChain && S.navPathChain.length > 1) {
                for (var pi = 0; pi < S.navPathChain.length - 1; pi++) {
                    if (S.navPathChain[pi] === nf && S.navPathChain[pi + 1] === nt) {
                        onPath = true;
                        break;
                    }
                }
            } else {
                onPath = bright[nf] && bright[nt];
            }
            if (onPath) {
                e.classList.add("sel-ring");
                e.classList.remove("dim");
            } else {
                e.classList.remove("sel-ring");
                e.classList.add("dim");
            }
        });
        patchRingPaint();
        semanticZoom();
    }

    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function conns(id) {
        var ns = {};
        S.edges.forEach(function (ft) {
            var f = ft[0],
                t = ft[1];
            if (f === id && t !== S.focus && S.nodes[t]) {
                ns[S.nodes[t].name] = 1;
            }
            if (t === id && f !== S.focus && S.nodes[f]) {
                ns[S.nodes[f].name] = 1;
            }
        });
        return Object.keys(ns).filter(Boolean).join(" · ");
    }

    function inspector() {
        var p = $("right-panel");
        if (!p) {
            return;
        }
        p.innerHTML = "";
        if (!S.selected || !S.nodes[S.selected]) {
            p.innerHTML =
                '<h6>// inspector</h6><div class="pv-detail"><div class="meta">Select a node on the map or from the list. Click empty canvas to clear.</div></div>';
            return;
        }
        var n = S.nodes[S.selected];
        if (!n) {
            return;
        }
        var cat = n.category || "pattern";
        if (S.mode === "customize") {
            p.innerHTML =
                '<h6>// edit node</h6><div class="pv-detail">' +
                '<div class="field"><label>Name</label><input type="text" id="f-name" value="' +
                esc(n.name) +
                '"></div>' +
                '<div class="field"><label>Category <b>' +
                CATS[cat] +
                '</b></label><div class="seg" id="f-cat">' +
                Object.keys(CATS)
                    .map(function (k) {
                        var on = cat === k;
                        return (
                            '<button type="button" data-c="' +
                            k +
                            '" class="cat-' +
                            k +
                            (on ? " on" : "") +
                            '" style="border-bottom:2px solid ' +
                            (on ? CAT_COLORS[k] : "transparent") +
                            '">' +
                            CATS[k] +
                            "</button>"
                        );
                    })
                    .join("") +
                "</div></div>" +
                '<div class="field"><label>Color</label><div class="swatches" id="f-sw">' +
                Object.keys(CM)
                    .map(function (k) {
                        return (
                            '<div class="swatch ' +
                            (n.color === k ? "on" : "") +
                            '" data-c="' +
                            k +
                            '" style="background:' +
                            CM[k] +
                            '"></div>'
                        );
                    })
                    .join("") +
                "</div></div>" +
                (n.isCore
                    ? ""
                    : '<div class="field"><label>Difficulty</label><div class="seg" id="f-diff">' +
                      DIF.map(function (d) {
                          return '<button type="button" data-d="' + d + '" class="' + (n.diff === d ? "on" : "") + '">' + d + "</button>";
                      }).join("") +
                      "</div></div>" +
                      '<div class="field"><label>Items count</label><input type="number" id="f-count" min="0" max="9999" value="' +
                      (n.count || 0) +
                      '"></div>') +
                '<div class="field"><label>Mastery <b id="f-mv">' +
                (n.mastery || 0) +
                '%</b></label><input type="range" id="f-m" min="0" max="100" value="' +
                (n.mastery || 0) +
                '"></div>' +
                '<div class="form-actions"><button type="button" class="btn primary" id="f-add">+ Add child</button>' +
                (n.isCore ? "" : '<button type="button" class="btn danger" id="f-del">Delete</button>') +
                "</div>" +
                '<div class="kbd-row"><div><span>Explorer</span><span class="kbd">click row</span></div>' +
                '<div><span>Pan canvas</span><span class="kbd">drag bg</span></div>' +
                '<div><span>Zoom</span><span class="kbd">scroll</span></div>' +
                '<div><span>Deselect</span><span class="kbd">Esc</span></div></div></div>' +
                '<div class="pv-detail" style="background:linear-gradient(180deg,rgba(58,91,217,.06),rgba(58,91,217,.01))">' +
                '<div class="name" style="color:var(--c-accent)">▸ Connections</div>' +
                '<div class="meta" style="margin-top:6px">' +
                (conns(n.id) || "No connections") +
                "</div></div>";
            wire(n);
        } else {
            var l = conns(n.id) || "—";
            p.innerHTML =
                '<h6>// inspector</h6><div class="pv-detail">' +
                '<div class="name">' +
                esc(n.name) +
                ' <span class="orb-cat-pill" style="border-left:3px solid ' +
                (CAT_COLORS[cat] || CAT_COLORS.pattern) +
                ";color:" +
                (CAT_COLORS[cat] || CAT_COLORS.pattern) +
                '">' +
                esc(CATS[cat]) +
                "</span></div>" +
                '<div class="meta">' +
                (n.isCore ? "Root" : CATS[cat]) +
                " · " +
                (n.count || "multi") +
                " items · " +
                (n.diff || "mixed") +
                '</div><div class="prog"><i style="width:' +
                (n.mastery || 0) +
                '%"></i></div>' +
                '<div class="pv-mini-stat"><span>Mastery</span><b>' +
                (n.mastery || 0) +
                "%</b></div>" +
                '<div class="pv-mini-stat"><span>Category</span><b>' +
                CATS[cat] +
                "</b></div>" +
                '<div class="pv-mini-stat"><span>Difficulty</span><b>' +
                (n.diff || "Mixed") +
                "</b></div>" +
                '<div class="pv-mini-stat"><span>Children</span><b>' +
                childIds(n.id).length +
                "</b></div>" +
                '<div class="pv-mini-stat"><span>Descendants</span><b>' +
                hiddenCount(n.id) +
                "</b></div></div>" +
                '<div class="pv-detail"><div class="name">Linked nodes</div><div class="meta" style="margin-top:8px">' +
                l +
                "</div></div>";
        }
    }

    function wire(n) {
        var fn = $("f-name");
        if (fn) {
            fn.oninput = function (e) {
                n.name = e.target.value || "Untitled";
                var g = ng.querySelector('.pv-node[data-id="' + n.id + '"]');
                if (g) {
                    var lg = g.querySelector(".pv-node-labels");
                    if (lg) {
                        while (lg.firstChild) {
                            lg.removeChild(lg.firstChild);
                        }
                        appendNodeLabels(lg, n, n.r);
                    }
                }
                sidebar();
            };
        }
        var ct = $("f-cat");
        if (ct) {
            ct.querySelectorAll("button").forEach(function (b) {
                b.onclick = function () {
                    n.category = b.getAttribute("data-c");
                    render();
                };
            });
        }
        document.querySelectorAll("#f-sw .swatch").forEach(function (s) {
            s.onclick = function () {
                n.color = s.getAttribute("data-c");
                render();
            };
        });
        var df = $("f-diff");
        if (df) {
            df.querySelectorAll("button").forEach(function (b) {
                b.onclick = function () {
                    n.diff = b.getAttribute("data-d");
                    df.querySelectorAll("button").forEach(function (x) {
                        x.classList.toggle("on", x.getAttribute("data-d") === n.diff);
                    });
                    meta();
                };
            });
        }
        var cn = $("f-count");
        if (cn) {
            cn.oninput = function (e) {
                n.count = +e.target.value || 0;
                sidebar();
                meta();
            };
        }
        var fm = $("f-m");
        if (fm) {
            fm.oninput = function (e) {
                n.mastery = +e.target.value;
                var mv = $("f-mv");
                if (mv) {
                    mv.textContent = n.mastery + "%";
                }
                render();
            };
        }
        var fa = $("f-add");
        if (fa) {
            fa.onclick = function () {
                addChild(n.id);
            };
        }
        var dl = $("f-del");
        if (dl) {
            dl.onclick = function () {
                if (confirm('Delete "' + n.name + '"?')) {
                    del(n.id);
                }
            };
        }
    }

    function addChild(pid) {
        var p = S.nodes[pid];
        if (!p) {
            return;
        }
        var id = "n" + ++S.uid;
        var cat = p.category === "ds" ? "pattern" : "problem";
        S.nodes[id] = {
            id: id,
            name: cat === "problem" ? "New problem" : cat === "ds" ? "New DS" : "New pattern",
            r: 20,
            color: p.color || "accent",
            count: 0,
            mastery: 0,
            diff: "Medium",
            category: cat,
        };
        S.edges.push([pid, id, 1]);
        advanceSelection(id);
        layoutRadial();
        render();
    }

    function del(id) {
        if (id === "core" || id === S.focus) {
            return;
        }
        descendants(id).forEach(function (d) {
            delete S.nodes[d];
        });
        delete S.nodes[id];
        S.edges = S.edges.filter(function (ft) {
            return S.nodes[ft[0]] && S.nodes[ft[1]];
        });
        S.selected = null;
        S.prevSelected = null;
        autoCollapseFirstLevelSubtrees();
        layoutRadial();
        render();
    }

    function descendants(id) {
        var out = [];
        var stk = [id];
        while (stk.length) {
            var c = stk.pop();
            childIds(c).forEach(function (k) {
                out.push(k);
                stk.push(k);
            });
        }
        return out;
    }

    function setFocus(id) {
        if (!S.nodes[id]) {
            return;
        }
        S.focus = id;
        advanceSelection(id);
        S.pan = { x: 0, y: 0 };
        S.zoom = 1;
        applyView();
        autoCollapseFirstLevelSubtrees();
        layoutRadial();
        render();
    }

    function exitFocus() {
        setFocus("core");
    }

    function drawBreadcrumb() {
        var bc = $("breadcrumb");
        if (!bc) {
            return;
        }
        if (S.focus === "core") {
            bc.classList.remove("show");
            return;
        }
        bc.classList.add("show");
        var path = pathTo(S.focus);
        bc.innerHTML =
            path
                .map(function (id, i) {
                    var node = S.nodes[id];
                    var isLast = i === path.length - 1;
                    return (
                        '<span class="crumb' +
                        (isLast ? " current" : "") +
                        '" data-id="' +
                        esc(id) +
                        '">' +
                        esc((node && node.name) || id) +
                        "</span>" +
                        (isLast ? "" : '<span class="sep">›</span>')
                    );
                })
                .join("") + '<span class="exit" id="bc-exit">× exit focus</span>';
        bc.querySelectorAll(".crumb").forEach(function (c) {
            c.onclick = function () {
                setFocus(c.getAttribute("data-id"));
            };
        });
        var ex = $("bc-exit");
        if (ex) {
            ex.onclick = exitFocus;
        }
    }

    function toggleCollapse(id) {
        if (S.collapsed.has(id)) {
            S.collapsed.delete(id);
        } else {
            S.collapsed.add(id);
        }
        layoutRadial();
        render();
    }

    function expandAll() {
        S.collapsed = new Set();
        layoutRadial();
        render();
    }

    function collapseAll() {
        S.collapsed = new Set();
        Object.keys(S.nodes).forEach(function (id) {
            if (id === S.focus) {
                return;
            }
            if (inSubtree(id, S.focus) && relDepth(id, S.focus) === 1 && childIds(id).length) {
                S.collapsed.add(id);
            }
        });
        layoutRadial();
        render();
    }

    var hover = null;

    function showChips(n) {
        if (S.mode !== "customize") {
            return;
        }
        hover = n;
        var sr = svg.getBoundingClientRect(),
            wr = cw.getBoundingClientRect(),
            vb = svg.viewBox.baseVal;
        var sx = sr.width / vb.width,
            sy = sr.height / vb.height;
        cb.style.left = sr.left - wr.left + (n.x - vb.x) * sx + "px";
        cb.style.top = sr.top - wr.top + (n.y - vb.y - n.r - 6) * sy + "px";
        cb.classList.add("show");
        var cd = $("chip-del");
        if (cd) {
            cd.style.display = n.isCore || n.id === S.focus ? "none" : "";
        }
        var cf = $("chip-focus");
        if (cf) {
            cf.style.display = n.id === S.focus ? "none" : "";
        }
        var cc = $("chip-collapse-n");
        if (cc) {
            cc.textContent = S.collapsed.has(n.id) ? "⊞" : "⊟";
        }
    }

    var drag = null;
    var nodeClickTimer = null;
    var suppressNodeClick = false;
    function startDrag(e, n) {
        if (e.button !== 0) {
            return;
        }
        e.stopPropagation();
        if (S.mode !== "customize") {
            return;
        }
        var pt = svgPt(e);
        drag = { n: n, ox: pt.x - n.x, oy: pt.y - n.y, sx: e.clientX, sy: e.clientY, moved: false };
        var gn = ng.querySelector('.pv-node[data-id="' + n.id + '"]');
        if (gn) {
            gn.classList.add("dragging");
        }
        cb.classList.remove("show");
    }
    function svgPt(e) {
        var p = svg.createSVGPoint();
        p.x = e.clientX;
        p.y = e.clientY;
        return p.matrixTransform(svg.getScreenCTM().inverse());
    }

    var panDrag = null;

    function render() {
        eg.innerHTML = "";
        ng.innerHTML = "";
        S.edges.forEach(function (ft) {
            var f = ft[0],
                t = ft[1],
                a = ft[2];
            if (!visible(f) || !visible(t)) {
                return;
            }
            var A = S.nodes[f],
                B = S.nodes[t];
            if (!A || !B) {
                return;
            }
            eg.appendChild(
                E("path", {
                    class:
                        "pv-edge" +
                        (a ? " active" : "") +
                        (B.category === "problem" || A.category === "problem" ? " pv-edge-problem" : ""),
                    d: curve(A, B),
                    "data-from": f,
                    "data-to": t,
                }),
            );
        });
        Object.values(S.nodes).forEach(function (n) {
            if (!visible(n.id)) {
                return;
            }
            var g = buildNode(n);
            ng.appendChild(g);
            g.addEventListener("mousedown", function (e) {
                startDrag(e, n);
            });
            g.addEventListener("click", function (e) {
                e.stopPropagation();
                if (suppressNodeClick) {
                    suppressNodeClick = false;
                    return;
                }
                clearTimeout(nodeClickTimer);
                nodeClickTimer = setTimeout(function () {
                    advanceSelection(n.id);
                    apply();
                    sidebar();
                    inspector();
                }, 260);
            });
            g.addEventListener("mouseenter", function () {
                showChips(n);
            });
            g.addEventListener("dblclick", function (e) {
                e.stopPropagation();
                clearTimeout(nodeClickTimer);
                setFocus(n.id);
            });
        });
        apply();
        sidebar();
        inspector();
        meta();
        drawBreadcrumb();
        drawMinimap();
        semanticZoom();
    }

    function exportJson() {
        var blob = new Blob([JSON.stringify({ nodes: S.nodes, edges: S.edges, focus: S.focus }, null, 2)], { type: "application/json" });
        var u = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = u;
        a.download = "orbital-graph.json";
        a.click();
        URL.revokeObjectURL(u);
    }

    function importFromFile(text) {
        var data = JSON.parse(text);
        if (data.nodes) {
            S.nodes = data.nodes;
        }
        if (data.edges) {
            S.edges = data.edges;
        }
        if (data.focus && S.nodes[data.focus]) {
            S.focus = data.focus;
        }
        S.selected = null;
        S.prevSelected = null;
        autoCollapseFirstLevelSubtrees();
        layoutRadial();
        render();
    }

    function bindUi() {
        svg = $("svg");
        eg = $("edges-g");
        ng = $("nodes-g");
        cw = $("canvas-wrap");
        cb = $("node-chips");
        if (!svg || !eg || !ng || !cw) {
            return;
        }

        cw.addEventListener("mouseleave", function () {
            if (cb) {
                cb.classList.remove("show");
            }
        });

        var chipFocus = $("chip-focus");
        if (chipFocus) {
            chipFocus.onclick = function (e) {
                e.stopPropagation();
                if (hover) {
                    setFocus(hover.id);
                }
            };
        }
        var chipCol = $("chip-collapse-n");
        if (chipCol) {
            chipCol.onclick = function (e) {
                e.stopPropagation();
                if (hover && childIds(hover.id).length) {
                    toggleCollapse(hover.id);
                }
            };
        }
        var chipAdd = $("chip-add");
        if (chipAdd) {
            chipAdd.onclick = function (e) {
                e.stopPropagation();
                if (hover) {
                    addChild(hover.id);
                }
            };
        }
        var chipEdit = $("chip-edit");
        if (chipEdit) {
            chipEdit.onclick = function (e) {
                e.stopPropagation();
                if (hover) {
                    select(hover.id);
                }
            };
        }
        var chipDel = $("chip-del");
        if (chipDel) {
            chipDel.onclick = function (e) {
                e.stopPropagation();
                if (hover && !hover.isCore && confirm('Delete "' + hover.name + '" and all descendants?')) {
                    del(hover.id);
                }
            };
        }

        window.addEventListener("mousemove", function (e) {
            if (drag) {
                if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) {
                    drag.moved = true;
                }
                var pt = svgPt(e);
                drag.n.x = pt.x - drag.ox;
                drag.n.y = pt.y - drag.oy;
                var g = ng.querySelector('.pv-node[data-id="' + drag.n.id + '"]');
                if (g) {
                    g.setAttribute("transform", "translate(" + drag.n.x + "," + drag.n.y + ")");
                }
                S.edges.forEach(function (ft) {
                    var f = ft[0],
                        t = ft[1];
                    if (f === drag.n.id || t === drag.n.id) {
                        var pth = document.querySelector('.pv-edge[data-from="' + f + '"][data-to="' + t + '"]');
                        if (pth && S.nodes[f] && S.nodes[t]) {
                            pth.setAttribute("d", curve(S.nodes[f], S.nodes[t]));
                        }
                    }
                });
                drawMinimap();
            } else if (panDrag) {
                if (Math.hypot(e.clientX - panDrag.sx, e.clientY - panDrag.sy) > 5) {
                    panDrag.moved = true;
                }
                var dx = e.clientX - panDrag.sx,
                    dy = e.clientY - panDrag.sy;
                var sr = svg.getBoundingClientRect();
                S.pan.x = panDrag.ix - (dx * (VB.w / S.zoom)) / sr.width;
                S.pan.y = panDrag.iy - (dy * (VB.h / S.zoom)) / sr.height;
                applyView();
            }
        });
        window.addEventListener("mouseup", function () {
            if (drag) {
                if (drag.moved) {
                    suppressNodeClick = true;
                }
                var gn = ng.querySelector('.pv-node[data-id="' + drag.n.id + '"]');
                if (gn) {
                    gn.classList.remove("dragging");
                }
                drag = null;
            }
            if (panDrag) {
                if (!panDrag.moved) {
                    clearSelection();
                }
                svg.classList.remove("panning");
                panDrag = null;
            }
        });

        svg.addEventListener("mousedown", function (e) {
            if (e.button !== 0) {
                return;
            }
            if (e.target.closest && e.target.closest(".pv-node")) {
                return;
            }
            panDrag = { sx: e.clientX, sy: e.clientY, ix: S.pan.x, iy: S.pan.y, moved: false };
            svg.classList.add("panning");
            if (cb) {
                cb.classList.remove("show");
            }
        });

        svg.addEventListener(
            "wheel",
            function (e) {
                if (!(e.ctrlKey || e.metaKey)) {
                    return;
                }
                e.preventDefault();
                var delta = e.deltaY > 0 ? 0.92 : 1.08;
                S.zoom = clamp(S.zoom * delta, 0.28, 2.75);
                applyView();
            },
            { passive: false },
        );

        var zin = $("zoom-in"),
            zout = $("zoom-out"),
            zval = $("zoom-val");
        if (zin) {
            zin.onclick = function () {
                S.zoom = clamp(S.zoom * 1.12, 0.28, 2.75);
                applyView();
            };
        }
        if (zout) {
            zout.onclick = function () {
                S.zoom = clamp(S.zoom / 1.12, 0.28, 2.75);
                applyView();
            };
        }
        if (zval) {
            zval.onclick = function () {
                S.zoom = 1;
                S.pan = { x: 0, y: 0 };
                applyView();
            };
        }

        var canvasResize = $("canvas-resize-handle");
        var canvasResizeDrag = null;
        if (canvasResize) {
            canvasResize.addEventListener("mousedown", function (e) {
                if (e.button !== 0) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                canvasResizeDrag = { sy: e.clientY, sh: cw.offsetHeight };
                document.body.classList.add("ws-canvas-resizing");
            });
        }
        window.addEventListener("mousemove", function (e) {
            if (!canvasResizeDrag || !cw) {
                return;
            }
            var nh = clamp(canvasResizeDrag.sh + (e.clientY - canvasResizeDrag.sy), 360, Math.round(window.innerHeight - 72));
            S.canvasUserHeight = nh;
            cw.style.height = nh + "px";
            cw.style.minHeight = nh + "px";
        });
        window.addEventListener("mouseup", function () {
            if (canvasResizeDrag) {
                canvasResizeDrag = null;
                document.body.classList.remove("ws-canvas-resizing");
                applyView();
            }
        });

        window.addEventListener("resize", function () {
            if (!document.body.classList.contains("ws-repr-orbital")) {
                return;
            }
            syncCanvasElementSize();
            applyView();
        });

        var ex = $("expand-chip"),
            col = $("collapse-chip");
        if (ex) {
            ex.onclick = expandAll;
        }
        if (col) {
            col.onclick = collapseAll;
        }

        var ap = $("add-pattern");
        if (ap) {
            ap.onclick = function () {
                addChild(S.focus);
            };
        }

        document.addEventListener("keydown", function (e) {
            if (
                !document.body.classList.contains("ws-repr-orbital") ||
                document.body.classList.contains("mode-json")
            ) {
                return;
            }
            if (["INPUT", "TEXTAREA", "SELECT"].indexOf(document.activeElement.tagName) >= 0) {
                return;
            }
            var n = S.selected ? S.nodes[S.selected] : null;
            if (e.key === "Escape") {
                clearSelection();
            } else if ((e.key === "Delete" || e.key === "Backspace") && n && !n.isCore) {
                if (confirm('Delete "' + n.name + '"?')) {
                    del(n.id);
                }
            }
        });
    }

    function relayout() {
        autoCollapseFirstLevelSubtrees();
        layoutRadial();
        render();
    }

    function setMode(m) {
        S.mode = m || "customize";
        var cbMode = $("node-chips");
        if (cbMode) {
            cbMode.classList.remove("show");
        }
        var reprCls = document.body.classList.contains("ws-repr-orbital") ? "ws-repr-orbital" : "ws-repr-linear";
        document.body.className = "mode-" + S.mode + " " + reprCls;
        var mc = $("mode-chip");
        if (mc) {
            mc.textContent = "● " + S.mode;
            mc.classList.toggle("live", S.mode === "customize");
        }
        var ht = $("hint-text");
        if (ht) {
            ht.textContent =
                S.mode === "customize"
                    ? "drag bg · Ctrl+scroll zoom · click explorer to navigate"
                    : S.mode === "topic"
                      ? "topic lens · Ctrl+scroll zoom · click explorer to navigate"
                      : "drag bg · Ctrl+scroll zoom · click explorer to navigate";
        }
        render();
    }

    function init() {
        if (window.__wsOrbStudioInited) {
            return;
        }
        window.__wsOrbStudioInited = true;
        bindUi();
        autoCollapseFirstLevelSubtrees();
        layoutRadial();
        render();
        refreshOrbitalLegendBot();
    }

    window.ORB = {
        init: init,
        exportJson: exportJson,
        importFromText: importFromFile,
        setMode: setMode,
        relayout: relayout,
        syncFromMindMapHierarchy: syncFromMindMapHierarchy,
        navigateMindPath: navigateMindPath,
        focusByMindPath: focusByMindPath,
        setFocus: setFocus,
        highlightCategory: highlightCategory,
        clearCategoryFilter: clearCategoryFilter,
        refreshLegend: refreshOrbitalLegendBot,
        getState: function () {
            return S;
        },
    };
})();
