/**
 * Community + personal graph library (D1 via /api/graph-library/*).
 * Terminology: "Graph" = DSA pattern mind map (a rooted topic graph; trees are a special case).
 */
(function () {
    var SESSION_KEY = "dsaUdashCloudGraphV1";

    function apiUrl(path) {
        return new URL(path.replace(/^\//, ""), document.baseURI).href;
    }

    function authHeaders() {
        var t = typeof dsaGetPracticeUserToken === "function" ? dsaGetPracticeUserToken() : "";
        var h = { Accept: "application/json" };
        if (t) {
            h.Authorization = "Bearer " + t;
        }
        return h;
    }

    function toast(msg) {
        var el = document.getElementById("udash-toast");
        if (!el) {
            return;
        }
        el.textContent = msg;
        el.classList.add("is-visible");
        clearTimeout(toast._tm);
        toast._tm = setTimeout(function () {
            el.classList.remove("is-visible");
        }, 2800);
    }

    function escapeHtml(s) {
        var d = document.createElement("div");
        d.textContent = s;
        return d.innerHTML;
    }

    function formatTime(ts) {
        if (typeof ts !== "number" || !ts) {
            return "—";
        }
        try {
            return new Date(ts * 1000).toLocaleString();
        } catch (e) {
            return "—";
        }
    }

    function readSession() {
        try {
            var raw = sessionStorage.getItem(SESSION_KEY);
            if (!raw) {
                return null;
            }
            var o = JSON.parse(raw);
            if (o && typeof o === "object" && o.copyId) {
                return o;
            }
        } catch (e) {}
        return null;
    }

    function writeSession(ctx) {
        try {
            if (!ctx) {
                sessionStorage.removeItem(SESSION_KEY);
            } else {
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(ctx));
            }
        } catch (e) {}
        syncWorkspaceBar();
    }

    function syncWorkspaceBar() {
        var bar = document.getElementById("udash-cloud-graph-bar");
        var titleEl = document.getElementById("udash-cloud-graph-title");
        var metaEl = document.getElementById("udash-cloud-graph-meta");
        if (!bar || !titleEl) {
            return;
        }
        var ctx = readSession();
        if (!ctx) {
            bar.hidden = true;
            return;
        }
        bar.hidden = false;
        titleEl.textContent = ctx.title || "Cloud graph";
        var kindLabel =
            ctx.kind === "downloaded" ? "From library" : ctx.kind === "shared" ? "Shared with you" : "Your graph";
        metaEl.textContent = kindLabel + " · save updates your personal copy";
    }

    function confirmDialog(title, body) {
        return new Promise(function (resolve) {
            var wrap = document.getElementById("udash-glib-confirm");
            if (!wrap) {
                resolve(window.confirm(body || title));
                return;
            }
            var t = document.getElementById("udash-glib-confirm-title");
            var b = document.getElementById("udash-glib-confirm-body");
            var cancel = document.getElementById("udash-glib-confirm-cancel");
            var ok = document.getElementById("udash-glib-confirm-ok");
            if (t) {
                t.textContent = title || "Confirm";
            }
            if (b) {
                b.textContent = body || "";
            }
            wrap.hidden = false;
            function done(v) {
                wrap.hidden = true;
                cancel.removeEventListener("click", onCancel);
                ok.removeEventListener("click", onOk);
                wrap.removeEventListener("click", onBackdrop);
                resolve(v);
            }
            function onCancel() {
                done(false);
            }
            function onOk() {
                done(true);
            }
            function onBackdrop(ev) {
                if (ev.target === wrap) {
                    done(false);
                }
            }
            cancel.addEventListener("click", onCancel);
            ok.addEventListener("click", onOk);
            wrap.addEventListener("click", onBackdrop);
        });
    }

    async function fetchJson(path, opts) {
        var o = Object.assign({ credentials: "same-origin" }, opts || {});
        o.headers = Object.assign({}, authHeaders(), (opts && opts.headers) || {});
        var r = await fetch(apiUrl(path), o);
        var j = await r.json().catch(function () {
            return {};
        });
        if (!r.ok) {
            var err = (j && j.error) || r.statusText || "Request failed";
            throw new Error(err);
        }
        return j;
    }

    var state = {
        public: [],
        mine: [],
        filter: "all",
        loading: false,
    };

    function hueStyle(h) {
        if (typeof h !== "number" || !Number.isFinite(h)) {
            return "linear-gradient(135deg, #6366f1 0%, #8b5cf6 55%, #a855f7 100%)";
        }
        var x = ((h % 360) + 360) % 360;
        return "linear-gradient(135deg, hsl(" + x + ",72%,42%) 0%, hsl(" + (x + 40) + ",70%,52%) 100%)";
    }

    function renderPublicGrid(host) {
        host.innerHTML = "";
        if (!state.public.length) {
            host.innerHTML =
                '<p class="dsa-glib-empty">No public graphs yet. Site staff can add them in <strong>Site admin → Library</strong>, or seed D1 / use the catalog API.</p>';
            return;
        }
        state.public.forEach(function (g) {
            var card = document.createElement("article");
            card.className = "dsa-glib-card";
            card.innerHTML =
                '<div class="dsa-glib-card__hero" style="background:' +
                hueStyle(g.accentHue) +
                '">' +
                '<span class="dsa-glib-card__badge">Community</span>' +
                '<div class="dsa-glib-card__hero-title">' +
                escapeHtml(g.title) +
                "</div></div>" +
                '<div class="dsa-glib-card__body">' +
                '<p class="dsa-glib-card__desc">' +
                escapeHtml(g.description || "Pattern graph shared by the team or community.") +
                "</p>" +
                '<div class="dsa-glib-card__stats">' +
                '<span title="Total downloads"><svg class="dsa-glib-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> ' +
                g.downloadCount +
                "</span>" +
                '<span title="Unique members"><svg class="dsa-glib-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> ' +
                g.uniqueDownloaders +
                "</span>" +
                "</div>" +
                '<div class="dsa-glib-card__meta">By ' +
                escapeHtml(g.creatorLabel) +
                " · Updated " +
                formatTime(g.updatedAt) +
                "</div>" +
                '<div class="dsa-glib-card__actions">' +
                '<button type="button" class="dsa-udash-btn dsa-udash-btn--primary dsa-glib-btn-dl" data-id="' +
                escapeHtml(g.id) +
                '">Add to my library</button>' +
                '<button type="button" class="dsa-udash-btn dsa-glib-btn-prev" data-id="' +
                escapeHtml(g.id) +
                '">Preview</button>' +
                "</div></div>";
            host.appendChild(card);
        });
    }

    function kindClass(k) {
        if (k === "downloaded") {
            return "dsa-glib-pill--dl";
        }
        if (k === "shared") {
            return "dsa-glib-pill--sh";
        }
        return "dsa-glib-pill--cr";
    }

    function renderMineGrid(host) {
        host.innerHTML = "";
        var list = state.mine.filter(function (g) {
            if (state.filter === "all") {
                return true;
            }
            return g.kind === state.filter;
        });
        if (!list.length) {
            host.innerHTML =
                '<p class="dsa-glib-empty">Nothing here yet. Download from the community tab or create a new graph.</p>';
            return;
        }
        list.forEach(function (g) {
            var card = document.createElement("article");
            card.className = "dsa-glib-card dsa-glib-card--mine";
            var pill =
                '<span class="dsa-glib-pill ' +
                kindClass(g.kind) +
                '">' +
                escapeHtml(g.kind) +
                "</span>";
            var shareLine =
                g.kind === "shared" && g.sharedFromLabel
                    ? '<div class="dsa-glib-card__meta">From ' + escapeHtml(g.sharedFromLabel) + "</div>"
                    : "";
            card.innerHTML =
                '<div class="dsa-glib-card__hero dsa-glib-card__hero--mine" style="background:' +
                hueStyle(g.accentHue) +
                '">' +
                pill +
                '<div class="dsa-glib-card__hero-title">' +
                escapeHtml(g.title) +
                "</div></div>" +
                '<div class="dsa-glib-card__body">' +
                '<p class="dsa-glib-card__desc">' +
                escapeHtml(g.description || "Your copy — open in the graph workspace to study or edit.") +
                "</p>" +
                shareLine +
                '<div class="dsa-glib-card__meta">Updated ' +
                formatTime(g.updatedAt) +
                "</div>" +
                '<div class="dsa-glib-card__actions">' +
                '<button type="button" class="dsa-udash-btn dsa-udash-btn--primary dsa-glib-btn-open" data-id="' +
                escapeHtml(g.id) +
                '">Open workspace</button>' +
                '<button type="button" class="dsa-udash-btn dsa-glib-btn-share" data-id="' +
                escapeHtml(g.id) +
                '">Share…</button>' +
                '<button type="button" class="dsa-udash-btn dsa-glib-btn-del" data-id="' +
                escapeHtml(g.id) +
                '">Delete</button>' +
                "</div></div>";
            host.appendChild(card);
        });
    }

    async function refreshPublic() {
        var j = await fetchJson("api/graph-library/public", { method: "GET" });
        state.public = j.graphs || [];
        var host = document.getElementById("udash-glib-public-grid");
        if (host) {
            renderPublicGrid(host);
        }
    }

    async function refreshMine() {
        var j = await fetchJson("api/graph-library/mine", { method: "GET" });
        state.mine = j.graphs || [];
        var host = document.getElementById("udash-glib-mine-grid");
        if (host) {
            renderMineGrid(host);
        }
    }

    async function refreshAll() {
        if (state.loading) {
            return;
        }
        state.loading = true;
        try {
            await Promise.all([refreshPublic(), refreshMine()]);
        } catch (e) {
            toast((e && e.message) || "Library load failed");
        } finally {
            state.loading = false;
        }
    }

    async function downloadCatalog(id) {
        var ok = await confirmDialog(
            "Add to my library?",
            "A personal copy will be saved to your account. You can open it from the Personal tab.",
        );
        if (!ok) {
            return;
        }
        try {
            var j = await fetchJson("api/graph-library/download", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ catalogId: id }),
            });
            toast("Saved to your library");
            await refreshMine();
            if (j.copy) {
                await openMineCopy(j.copy.id, j.copy.title, "downloaded");
            }
        } catch (e) {
            toast((e && e.message) || "Download failed");
        }
    }

    async function previewCatalog(id) {
        var ok = await confirmDialog(
            "Preview in workspace?",
            "This loads the community graph for viewing only. Use “Add to my library” to keep a copy.",
        );
        if (!ok) {
            return;
        }
        try {
            var j = await fetchJson("api/graph-library/catalog-detail?id=" + encodeURIComponent(id), { method: "GET" });
            var payload = j.graph && j.graph.payload;
            if (!payload || typeof dsaImportMindMapHierarchyFromText !== "function") {
                throw new Error("Could not load graph");
            }
            dsaImportMindMapHierarchyFromText(JSON.stringify(payload));
            writeSession(null);
            toast("Preview loaded — not saved to your library");
            if (typeof window.__dsaUdashNavigatePanel === "function") {
                window.__dsaUdashNavigatePanel("graph");
            }
        } catch (e) {
            toast((e && e.message) || "Preview failed");
        }
    }

    async function openMineCopy(id, title, kind) {
        try {
            var j = await fetchJson("api/graph-library/mine-detail?id=" + encodeURIComponent(id), { method: "GET" });
            var g = j.graph;
            if (!g || !g.payload || typeof dsaImportMindMapHierarchyFromText !== "function") {
                throw new Error("Could not open graph");
            }
            dsaImportMindMapHierarchyFromText(JSON.stringify(g.payload));
            writeSession({ copyId: g.id, title: g.title || title || "Graph", kind: g.kind || kind || "created" });
            toast("Graph opened in workspace");
            if (typeof window.__dsaUdashNavigatePanel === "function") {
                window.__dsaUdashNavigatePanel("graph");
            }
        } catch (e) {
            toast((e && e.message) || "Open failed");
        }
    }

    async function deleteMine(id) {
        var ok = await confirmDialog("Delete this graph?", "This removes your personal copy from the cloud. This cannot be undone.");
        if (!ok) {
            return;
        }
        try {
            await fetchJson("api/graph-library/mine-detail?id=" + encodeURIComponent(id), { method: "DELETE" });
            var ctx = readSession();
            if (ctx && ctx.copyId === id) {
                writeSession(null);
            }
            toast("Graph deleted");
            await refreshMine();
        } catch (e) {
            toast((e && e.message) || "Delete failed");
        }
    }

    async function shareMine(id) {
        var email = window.prompt("Recipient practice account email");
        if (!email || !String(email).trim()) {
            return;
        }
        var ok = await confirmDialog("Share graph?", "We will add a copy to their personal library if they have an account.");
        if (!ok) {
            return;
        }
        try {
            await fetchJson("api/graph-library/share", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ copyId: id, recipientEmail: String(email).trim().toLowerCase() }),
            });
            toast("Shared successfully");
        } catch (e) {
            toast((e && e.message) || "Share failed");
        }
    }

    async function createGraph() {
        var name = window.prompt("Name for your new graph", "My pattern map");
        if (!name || !String(name).trim()) {
            return;
        }
        var ok = await confirmDialog("Create cloud graph?", "We will save an empty starter map to your personal library.");
        if (!ok) {
            return;
        }
        try {
            var j = await fetchJson("api/graph-library/mine", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: String(name).trim(), description: "" }),
            });
            await refreshMine();
            if (j.graph && j.graph.id) {
                await openMineCopy(j.graph.id, j.graph.title, "created");
            }
            toast("Graph created");
        } catch (e) {
            toast((e && e.message) || "Create failed");
        }
    }

    async function saveCloudGraph() {
        var ctx = readSession();
        if (!ctx || !ctx.copyId) {
            toast("Open a personal graph first");
            return;
        }
        if (typeof dsaGetMindMapHierarchyJsonString !== "function") {
            toast("Graph not ready");
            return;
        }
        var ok = await confirmDialog("Save changes?", "Overwrite your cloud copy with the current workspace map.");
        if (!ok) {
            return;
        }
        try {
            var payload = JSON.parse(dsaGetMindMapHierarchyJsonString());
            await fetchJson("api/graph-library/mine-detail?id=" + encodeURIComponent(ctx.copyId), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payload: payload }),
            });
            toast("Saved to cloud");
            await refreshMine();
        } catch (e) {
            toast((e && e.message) || "Save failed");
        }
    }

    async function siteDefaultMap() {
        var ok = await confirmDialog(
            "Load site default map?",
            "Replace the workspace with the published practice map from the server. Unsaved changes stay in Export JSON if you exported them.",
        );
        if (!ok) {
            return;
        }
        if (typeof dsaReloadSiteDefaultMapInView !== "function") {
            toast("Reload not available");
            return;
        }
        try {
            await dsaReloadSiteDefaultMapInView();
            writeSession(null);
            toast("Site map loaded");
        } catch (e) {
            toast("Reload failed");
        }
    }

    function wireGrids() {
        var pub = document.getElementById("udash-glib-public-grid");
        var mine = document.getElementById("udash-glib-mine-grid");
        if (pub) {
            pub.addEventListener("click", function (ev) {
                var dl = ev.target && ev.target.closest && ev.target.closest(".dsa-glib-btn-dl");
                var pr = ev.target && ev.target.closest && ev.target.closest(".dsa-glib-btn-prev");
                if (dl) {
                    downloadCatalog(dl.getAttribute("data-id"));
                } else if (pr) {
                    previewCatalog(pr.getAttribute("data-id"));
                }
            });
        }
        if (mine) {
            mine.addEventListener("click", function (ev) {
                var op = ev.target && ev.target.closest && ev.target.closest(".dsa-glib-btn-open");
                var sh = ev.target && ev.target.closest && ev.target.closest(".dsa-glib-btn-share");
                var del = ev.target && ev.target.closest && ev.target.closest(".dsa-glib-btn-del");
                if (op) {
                    openMineCopy(op.getAttribute("data-id"));
                } else if (sh) {
                    shareMine(sh.getAttribute("data-id"));
                } else if (del) {
                    deleteMine(del.getAttribute("data-id"));
                }
            });
        }
    }

    function wireTabs() {
        document.querySelectorAll("[data-glib-tab]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var tab = btn.getAttribute("data-glib-tab");
                document.querySelectorAll("[data-glib-tab]").forEach(function (b) {
                    b.classList.toggle("is-active", b === btn);
                });
                document.querySelectorAll(".dsa-glib-tab-panel").forEach(function (p) {
                    p.classList.toggle("is-active", p.getAttribute("data-glib-panel") === tab);
                });
            });
        });
        document.querySelectorAll("[data-glib-filter]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                state.filter = btn.getAttribute("data-glib-filter") || "all";
                document.querySelectorAll("[data-glib-filter]").forEach(function (b) {
                    b.classList.toggle("is-active", b === btn);
                });
                renderMineGrid(document.getElementById("udash-glib-mine-grid"));
            });
        });
    }

    function observePanel() {
        var panel = document.getElementById("panel-library");
        if (!panel) {
            return;
        }
        function onVis() {
            if (panel.classList.contains("is-active")) {
                refreshAll();
            }
        }
        var mo = new MutationObserver(onVis);
        mo.observe(panel, { attributes: true, attributeFilter: ["class"] });
        if (panel.classList.contains("is-active")) {
            refreshAll();
        }
    }

    function init() {
        if (!document.body || !document.body.classList.contains("dsa-udash-body")) {
            return;
        }
        if (typeof dsaIsPracticeUser === "function" && !dsaIsPracticeUser()) {
            return;
        }
        wireGrids();
        wireTabs();
        observePanel();
        syncWorkspaceBar();
        var createBtn = document.getElementById("udash-glib-create");
        if (createBtn) {
            createBtn.addEventListener("click", function () {
                createGraph();
            });
        }
        var saveBtn = document.getElementById("udash-cloud-graph-save");
        if (saveBtn) {
            saveBtn.addEventListener("click", function () {
                saveCloudGraph();
            });
        }
        var siteBtn = document.getElementById("udash-cloud-graph-site-default");
        if (siteBtn) {
            siteBtn.addEventListener("click", function () {
                siteDefaultMap();
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
