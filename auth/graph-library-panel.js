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

    /** Map API graph_node_category rows to workspace palette entries (id = slug for ring colors). */
    function mapNodeCategoriesToPalette(list) {
        if (!Array.isArray(list)) {
            return [];
        }
        return list
            .map(function (c) {
                if (!c || !c.slug) {
                    return null;
                }
                return {
                    id: String(c.slug).toUpperCase(),
                    name: String(c.label || c.slug || ""),
                    description: c.description != null ? String(c.description) : "",
                    color: String(c.color || "#6b7280").trim(),
                };
            })
            .filter(Boolean);
    }

    function formatDateLabel(ts) {
        if (typeof ts !== "number" || !ts) {
            return "Updated recently";
        }
        try {
            return "Updated " + new Date(ts * 1000).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
            });
        } catch (e) {
            return "Updated recently";
        }
    }

    function formatClockLabel(ts) {
        if (typeof ts !== "number" || !ts) {
            return "—";
        }
        try {
            return new Date(ts * 1000).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
            });
        } catch (e) {
            return "—";
        }
    }

    function visualIndex(seed, index) {
        var n = typeof seed === "number" && Number.isFinite(seed) ? Math.round(seed) : index || 0;
        return (((n % 3) + 3) % 3) + 1;
    }

    function visualVariant(seed, index) {
        return "dsa-glib-preview--v" + visualIndex(seed, index);
    }

    function hashString(input) {
        var s = String(input || "");
        var h = 0;
        for (var i = 0; i < s.length; i += 1) {
            h = (h * 31 + s.charCodeAt(i)) >>> 0;
        }
        return h;
    }

    function graphStats(graph, index, isMine) {
        var seed = hashString((graph && graph.id) || "") + hashString((graph && graph.title) || "") + index * 17;
        var nodes =
            graph && Number.isFinite(Number(graph.nodeCount)) && Number(graph.nodeCount) > 0
                ? Number(graph.nodeCount)
                : isMine
                  ? 9 + (seed % 104)
                  : 24 + (seed % 120);
        var branches =
            graph && Number.isFinite(Number(graph.branchCount)) && Number(graph.branchCount) >= 0
                ? Number(graph.branchCount)
                : 3 + (seed % 12);
        return {
            nodes: nodes,
            branches: branches,
            previewMeta: nodes + " nodes · " + branches + " branches",
        };
    }

    function graphPreviewMarkup(kind) {
        var mod = kind === 2 ? "k2" : kind === 3 ? "k3" : "k1";
        return (
            '<div class="dsa-glib-card__preview dsa-glib-card__preview--' +
            mod +
            '" aria-hidden="true">' +
            '<span class="dsa-glib-card__pv-root"></span>' +
            '<span class="dsa-glib-card__pv-spine"></span>' +
            '<span class="dsa-glib-card__pv-dot dsa-glib-card__pv-dot--a"></span>' +
            '<span class="dsa-glib-card__pv-dot dsa-glib-card__pv-dot--b"></span>' +
            '<span class="dsa-glib-card__pv-dot dsa-glib-card__pv-dot--c"></span>' +
            "</div>"
        );
    }

    function updatedLabel(ts) {
        var label = formatDateLabel(ts);
        var clock = formatClockLabel(ts);
        return label + (clock !== "—" ? ", " + clock : "");
    }

    function statsMarkup(downloadCount, uniqueDownloaders) {
        return (
            '<div class="dsa-glib-stats-row">' +
            '<span class="dsa-glib-stat">' +
            escapeHtml(String(downloadCount || 0)) +
            ' downloads</span><span class="dsa-glib-stat-sep" aria-hidden="true"></span>' +
            '<span class="dsa-glib-stat">' +
            escapeHtml(String(uniqueDownloaders || 0)) +
            " members</span></div>"
        );
    }

    function menuButtonMarkup() {
        return '<span class="dsa-glib-card-menu-dots" aria-hidden="true">···</span>';
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
                if (typeof window !== "undefined") {
                    window.__dsaGraphBodyCategories = [];
                }
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
        /** @type {{ id: string, name: string, color: string }[]} */
        publicNodeCategories: [],
        mine: [],
        filter: "all",
        activeTab: "personal",
        loading: false,
    };

    function renderPublicGrid(host) {
        host.innerHTML = "";
        if (!state.public.length) {
            host.innerHTML =
                '<p class="dsa-glib-empty">No public graphs yet. Site staff can add them in <strong>Site admin → Library</strong>, or seed D1 / use the catalog API.</p>';
            return;
        }
        state.public.forEach(function (g, idx) {
            var card = document.createElement("article");
            card.className = "dsa-glib-card";
            var visualIdx = visualIndex(g.accentHue, idx);
            var stats = graphStats(g, idx, false);
            card.innerHTML =
                '<div class="dsa-glib-preview ' +
                visualVariant(g.accentHue, idx) +
                '">' +
                graphPreviewMarkup(visualIdx) +
                '<div class="dsa-glib-preview-badges"><span class="dsa-glib-badge">Community</span><span class="dsa-glib-badge dsa-glib-badge--visibility">Public</span></div>' +
                '<div class="dsa-glib-preview-meta">' +
                escapeHtml(stats.previewMeta) +
                "</div>" +
                "</div>" +
                '<div class="dsa-glib-card-body">' +
                '<div class="dsa-glib-card-head"><div><h3 class="dsa-glib-card-title">' +
                escapeHtml(g.title) +
                '</h3><p class="dsa-glib-card-desc">' +
                escapeHtml(g.description || "Community graph — download a copy to your library or preview it in the workspace.") +
                '</p></div><details class="dsa-glib-card-menu-wrap">' +
                '<summary class="dsa-glib-card-menu" aria-label="Graph actions">' +
                menuButtonMarkup() +
                '</summary><div class="dsa-glib-card-menu-list">' +
                '<button type="button" class="dsa-glib-card-menu-item dsa-glib-menu-preview" data-id="' +
                escapeHtml(g.id) +
                '">Preview in workspace</button>' +
                '<button type="button" class="dsa-glib-card-menu-item dsa-glib-menu-download" data-id="' +
                escapeHtml(g.id) +
                '">Download to my library</button>' +
                '<button type="button" class="dsa-glib-card-menu-item dsa-glib-menu-sharelink" data-id="' +
                escapeHtml(g.id) +
                '">Share library page</button>' +
                "</div></details></div>" +
                statsMarkup(g.downloadCount, g.uniqueDownloaders) +
                '<div class="dsa-glib-card-footer"><span class="dsa-glib-card-updated">' +
                escapeHtml(updatedLabel(g.updatedAt)) +
                '</span><div class="dsa-glib-card-actions">' +
                '<button type="button" class="dsa-glib-action dsa-glib-action--ghost dsa-glib-btn-sharelink" data-id="' +
                escapeHtml(g.id) +
                '" aria-label="Share graph">Share link</button>' +
                '<button type="button" class="dsa-glib-action dsa-glib-action--primary dsa-glib-btn-dl" data-id="' +
                escapeHtml(g.id) +
                '">Download</button>' +
                "</div></div></div>";
            host.appendChild(card);
        });
    }

    function kindClass(k) {
        if (k === "downloaded") {
            return "dsa-glib-card__tag--downloaded";
        }
        if (k === "shared") {
            return "dsa-glib-card__tag--shared";
        }
        return "dsa-glib-card__tag--created";
    }

    function kindLabel(k) {
        if (k === "downloaded") {
            return "Downloaded";
        }
        if (k === "shared") {
            return "Shared";
        }
        return "Created";
    }

    function visibilityLabel(v) {
        return String(v || "private").toLowerCase() === "public" ? "Public" : "Private";
    }

    function gridHost() {
        return document.getElementById("udash-glib-public-grid");
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
        }
        list.forEach(function (g, idx) {
            var card = document.createElement("article");
            card.className = "dsa-glib-card";
            var visualIdx = visualIndex(g.accentHue, idx + 1);
            var stats = graphStats(g, idx + 1, true);
            var pill =
                '<span class="dsa-glib-badge ' +
                kindClass(g.kind) +
                '">' +
                escapeHtml(kindLabel(g.kind)) +
                "</span>";
            var desc =
                g.description ||
                (g.kind === "shared"
                    ? "Shared with you — open it in the graph workspace or pass it to another member."
                    : "Your copy — open in the graph workspace to study or edit.");
            var visibility = visibilityLabel(g.visibility);
            var nextVisibility = visibility === "Public" ? "private" : "public";
            var publishLabel = visibility === "Public" ? "Make private" : "Publish";
            card.innerHTML =
                '<div class="dsa-glib-preview ' +
                visualVariant(g.accentHue, idx + 1) +
                '">' +
                graphPreviewMarkup(visualIdx) +
                '<div class="dsa-glib-preview-badges">' +
                pill +
                '<span class="dsa-glib-badge dsa-glib-badge--visibility">' +
                escapeHtml(visibility) +
                "</span></div>" +
                '<div class="dsa-glib-preview-meta">' +
                escapeHtml(stats.previewMeta) +
                "</div>" +
                "</div>" +
                '<div class="dsa-glib-card-body">' +
                '<div class="dsa-glib-card-head"><div><h3 class="dsa-glib-card-title">' +
                escapeHtml(g.title) +
                '</h3><p class="dsa-glib-card-desc">' +
                escapeHtml(desc) +
                '</p></div><details class="dsa-glib-card-menu-wrap">' +
                '<summary class="dsa-glib-card-menu" aria-label="Graph actions">' +
                menuButtonMarkup() +
                '</summary><div class="dsa-glib-card-menu-list">' +
                '<button type="button" class="dsa-glib-card-menu-item dsa-glib-menu-open" data-id="' +
                escapeHtml(g.id) +
                '">Open in workspace</button>' +
                '<button type="button" class="dsa-glib-card-menu-item dsa-glib-menu-share" data-id="' +
                escapeHtml(g.id) +
                '">Share with member</button>' +
                '<div class="dsa-glib-card-menu-sep" aria-hidden="true"></div>' +
                '<button type="button" class="dsa-glib-card-menu-item dsa-glib-card-menu-item--important dsa-glib-menu-publish" data-id="' +
                escapeHtml(g.id) +
                '" data-visibility="' +
                escapeHtml(nextVisibility) +
                '">' +
                escapeHtml(publishLabel) +
                "</button>" +
                '<button type="button" class="dsa-glib-card-menu-item dsa-glib-card-menu-item--danger dsa-glib-menu-delete" data-id="' +
                escapeHtml(g.id) +
                '">' +
                escapeHtml(g.kind === "shared" ? "Remove from library" : "Delete my copy") +
                "</button>" +
                "</div></details></div>" +
                statsMarkup(g.downloadCount, g.uniqueDownloaders) +
                '<div class="dsa-glib-card-footer"><span class="dsa-glib-card-updated">' +
                escapeHtml(updatedLabel(g.updatedAt)) +
                '</span><div class="dsa-glib-card-actions">' +
                '<button type="button" class="dsa-glib-action dsa-glib-action--ghost dsa-glib-btn-share" data-id="' +
                escapeHtml(g.id) +
                '">Share</button>' +
                '<button type="button" class="dsa-glib-action dsa-glib-action--primary dsa-glib-btn-open" data-id="' +
                escapeHtml(g.id) +
                '">Open</button>' +
                "</div></div></div>";
            host.appendChild(card);
        });

        var createCard = document.createElement("article");
        createCard.className = "dsa-glib-card dsa-glib-card--create dsa-glib-btn-create-card";
        createCard.innerHTML =
            '<div class="dsa-glib-card-create-inner">' +
            '<div class="dsa-glib-card-create-icon" aria-hidden="true"><span class="dsa-glib-card-create-glyph">+</span></div>' +
            '<h3 class="dsa-glib-card-create-title">Create a new graph</h3>' +
            '<p class="dsa-glib-card-create-text">Start blank or use a template from the community library.</p>' +
            "</div>";
        host.appendChild(createCard);
    }

    function renderActiveGrid() {
        var host = gridHost();
        if (!host) {
            return;
        }
        if (state.activeTab === "community") {
            renderPublicGrid(host);
        } else {
            renderMineGrid(host);
        }
    }

    async function refreshPublic() {
        var j = await fetchJson("api/graph-library/public", { method: "GET" });
        state.publicNodeCategories = mapNodeCategoriesToPalette(j.nodeCategories || []);
        state.public = j.graphs || [];
        if (state.activeTab === "community") {
            renderActiveGrid();
        }
    }

    async function refreshMine() {
        var j = await fetchJson("api/graph-library/mine", { method: "GET" });
        state.mine = (j.graphs || []).filter(function (g) {
            return g && (g.kind === "created" || g.kind === "downloaded" || g.kind === "shared");
        });
        if (state.activeTab === "personal") {
            renderActiveGrid();
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

    function closeMenuFromNode(node) {
        var menu = node && node.closest && node.closest(".dsa-glib-card-menu-wrap");
        if (menu) {
            menu.removeAttribute("open");
        }
    }

    function closeLibraryMenusExcept(node) {
        document.querySelectorAll(".dsa-glib-card-menu-wrap[open]").forEach(function (menu) {
            if (menu !== node) {
                menu.removeAttribute("open");
            }
        });
    }

    function graphShareUrl() {
        var url = new URL(window.location.href);
        url.search = "";
        url.hash = "#library";
        return url.toString();
    }

    async function shareCatalogLink(id) {
        var graph = state.public.find(function (item) {
            return item.id === id;
        });
        var title = graph && graph.title ? graph.title : "Graph library";
        var url = graphShareUrl();
        try {
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: title,
                        text: "Browse this graph in the DSA Patterns library.",
                        url: url,
                    });
                    toast("Share sheet opened");
                    return;
                } catch (e) {
                    if (e && e.name === "AbortError") {
                        return;
                    }
                }
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(url);
                toast("Library link copied");
                return;
            }
        } catch (e) {
            /* fallback below */
        }
        window.prompt("Copy this library link", url);
    }

    function setLibraryTab(tab) {
        state.activeTab = tab === "community" ? "community" : "personal";
        document.querySelectorAll("[data-glib-tab]").forEach(function (btn) {
            var on = btn.getAttribute("data-glib-tab") === state.activeTab;
            btn.classList.toggle("is-active", on);
            btn.setAttribute("aria-selected", on ? "true" : "false");
        });
        var personalControls = document.getElementById("udash-glib-personal-controls");
        if (personalControls) {
            personalControls.hidden = state.activeTab !== "personal";
        }
        var createBtn = document.getElementById("udash-glib-create");
        if (createBtn) {
            createBtn.hidden = state.activeTab !== "personal";
        }
        renderActiveGrid();
    }

    async function downloadCatalog(id) {
        var ok = await confirmDialog(
            "Download this graph?",
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
            "This loads the community graph for viewing only. Use Download to keep a personal copy.",
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
            if (typeof window !== "undefined") {
                window.__dsaGraphBodyCategories = mapNodeCategoriesToPalette((j.graph && j.graph.nodeCategories) || []);
                window.__dsaGraphNodeCategories = (j.graph && j.graph.nodeCategories) || [];
            }
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
            if (typeof window !== "undefined") {
                window.__dsaGraphBodyCategories = mapNodeCategoriesToPalette(g.nodeCategories || []);
                window.__dsaGraphNodeCategories = g.nodeCategories || [];
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

    async function setMineVisibility(id, visibility) {
        var vis = String(visibility || "").toLowerCase() === "public" ? "public" : "private";
        var ok = await confirmDialog(
            vis === "public" ? "Publish this graph?" : "Make this graph private?",
            vis === "public"
                ? "This will mark your graph as public."
                : "This will mark your graph as private.",
        );
        if (!ok) {
            return;
        }
        try {
            await fetchJson("api/graph-library/mine-detail?id=" + encodeURIComponent(id), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ visibility: vis }),
            });
            toast(vis === "public" ? "Graph published" : "Graph is now private");
            await refreshMine();
        } catch (e) {
            toast((e && e.message) || "Visibility update failed");
        }
    }

    function createModalElements() {
        return {
            wrap: document.getElementById("udash-glib-create-modal"),
            name: document.getElementById("udash-glib-create-name"),
            accent: document.getElementById("udash-glib-create-accent"),
            description: document.getElementById("udash-glib-create-description"),
            cancel: document.getElementById("udash-glib-create-cancel"),
            save: document.getElementById("udash-glib-create-save"),
        };
    }

    function openCreateGraphModal() {
        var els = createModalElements();
        if (!els.wrap) {
            return;
        }
        els.wrap.hidden = false;
        if (els.name) {
            els.name.focus();
            els.name.select();
        }
    }

    function closeCreateGraphModal() {
        var els = createModalElements();
        if (!els.wrap) {
            return;
        }
        els.wrap.hidden = true;
    }

    async function createGraph() {
        var els = createModalElements();
        if (!els.wrap) {
            return;
        }
        var name = els.name && els.name.value ? String(els.name.value).trim() : "";
        var description = els.description && els.description.value ? String(els.description.value).trim() : "";
        var accentHue = els.accent && els.accent.value !== "" ? Number(els.accent.value) : null;
        if (!name) {
            toast("Title required");
            if (els.name) {
                els.name.focus();
            }
            return;
        }
        if (accentHue != null && (!Number.isFinite(accentHue) || accentHue < 0 || accentHue > 359)) {
            toast("Accent hue must be between 0 and 359");
            if (els.accent) {
                els.accent.focus();
            }
            return;
        }
        if (els.save) {
            els.save.disabled = true;
        }
        try {
            var j = await fetchJson("api/graph-library/mine", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: name,
                    description: description,
                    accentHue: accentHue,
                }),
            });
            closeCreateGraphModal();
            if (els.name) {
                els.name.value = "";
            }
            if (els.description) {
                els.description.value = "";
            }
            if (els.accent) {
                els.accent.value = "";
            }
            await refreshMine();
            if (j.graph && j.graph.id) {
                await openMineCopy(j.graph.id, j.graph.title, "created");
            }
            toast("Graph created");
        } catch (e) {
            toast((e && e.message) || "Create failed");
        } finally {
            if (els.save) {
                els.save.disabled = false;
            }
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
            var payload = JSON.parse(
                typeof dsaGetMindMapHierarchyMergedJsonString === "function"
                    ? dsaGetMindMapHierarchyMergedJsonString()
                    : dsaGetMindMapHierarchyJsonString(),
            );
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
        var grid = gridHost();
        document.addEventListener("click", function (ev) {
            var menu = ev.target && ev.target.closest && ev.target.closest(".dsa-glib-card-menu-wrap");
            closeLibraryMenusExcept(menu || null);
        });
        if (grid) {
            grid.addEventListener("click", function (ev) {
                var dl = ev.target && ev.target.closest && ev.target.closest(".dsa-glib-btn-dl");
                var shareLinkBtn = ev.target && ev.target.closest && ev.target.closest(".dsa-glib-btn-sharelink");
                var openBtn = ev.target && ev.target.closest && ev.target.closest(".dsa-glib-btn-open");
                var shareBtn = ev.target && ev.target.closest && ev.target.closest(".dsa-glib-btn-share");
                var createBtn = ev.target && ev.target.closest && ev.target.closest(".dsa-glib-btn-create-card");
                var menuPreview = ev.target && ev.target.closest && ev.target.closest(".dsa-glib-menu-preview");
                var menuDownload = ev.target && ev.target.closest && ev.target.closest(".dsa-glib-menu-download");
                var menuShareLink = ev.target && ev.target.closest && ev.target.closest(".dsa-glib-menu-sharelink");
                var menuOpen = ev.target && ev.target.closest && ev.target.closest(".dsa-glib-menu-open");
                var menuPublish = ev.target && ev.target.closest && ev.target.closest(".dsa-glib-menu-publish");
                var menuShare = ev.target && ev.target.closest && ev.target.closest(".dsa-glib-menu-share");
                var menuDelete = ev.target && ev.target.closest && ev.target.closest(".dsa-glib-menu-delete");
                if (dl) {
                    downloadCatalog(dl.getAttribute("data-id"));
                } else if (shareLinkBtn) {
                    shareCatalogLink(shareLinkBtn.getAttribute("data-id"));
                } else if (openBtn) {
                    openMineCopy(openBtn.getAttribute("data-id"));
                } else if (shareBtn) {
                    shareMine(shareBtn.getAttribute("data-id"));
                } else if (createBtn) {
                    openCreateGraphModal();
                } else if (menuPreview) {
                    closeMenuFromNode(menuPreview);
                    previewCatalog(menuPreview.getAttribute("data-id"));
                } else if (menuDownload) {
                    closeMenuFromNode(menuDownload);
                    downloadCatalog(menuDownload.getAttribute("data-id"));
                } else if (menuShareLink) {
                    closeMenuFromNode(menuShareLink);
                    shareCatalogLink(menuShareLink.getAttribute("data-id"));
                } else if (menuOpen) {
                    closeMenuFromNode(menuOpen);
                    openMineCopy(menuOpen.getAttribute("data-id"));
                } else if (menuPublish) {
                    closeMenuFromNode(menuPublish);
                    setMineVisibility(menuPublish.getAttribute("data-id"), menuPublish.getAttribute("data-visibility"));
                } else if (menuShare) {
                    closeMenuFromNode(menuShare);
                    shareMine(menuShare.getAttribute("data-id"));
                } else if (menuDelete) {
                    closeMenuFromNode(menuDelete);
                    deleteMine(menuDelete.getAttribute("data-id"));
                }
            });
        }
    }

    function wireTabs() {
        document.querySelectorAll("[data-glib-tab]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var tab = btn.getAttribute("data-glib-tab");
                setLibraryTab(tab);
            });
        });
        document.querySelectorAll("[data-glib-filter]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                state.filter = btn.getAttribute("data-glib-filter") || "all";
                document.querySelectorAll("[data-glib-filter]").forEach(function (b) {
                    b.classList.toggle("is-active", b === btn);
                });
                renderActiveGrid();
            });
        });
        setLibraryTab(state.activeTab);
    }

    function wireCreateModal() {
        var els = createModalElements();
        if (!els.wrap) {
            return;
        }
        if (els.cancel) {
            els.cancel.addEventListener("click", closeCreateGraphModal);
        }
        if (els.save) {
            els.save.addEventListener("click", function () {
                createGraph();
            });
        }
        if (els.wrap) {
            els.wrap.addEventListener("click", function (ev) {
                if (ev.target === els.wrap || (ev.target && ev.target.classList && ev.target.classList.contains("dsa-udash-modal__backdrop"))) {
                    closeCreateGraphModal();
                }
            });
        }
        if (els.description) {
            els.description.addEventListener("keydown", function (ev) {
                if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") {
                    createGraph();
                }
            });
        }
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
        wireCreateModal();
        observePanel();
        syncWorkspaceBar();
        var createBtn = document.getElementById("udash-glib-create");
        if (createBtn) {
            createBtn.addEventListener("click", function () {
                openCreateGraphModal();
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
