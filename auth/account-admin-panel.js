/**
 * Site admin dashboard: Dashboard, Site settings (app_kv), Users, Workspace, Library, System.
 * Each area supports UI + JSON modes. Requires dsa-admin-auth.js + admin.html portal markup (#portal-panel-cms).
 */
(function () {
    /** Reserved catalog slug mirrored to GET /api/data?k=dsa */
    const SITE_PUBLIC_GRAPH_SLUG = "dsa-site-map";

    /** Stored in content D1 `app_kv`; public read via GET /api/site-features */
    const SITE_USER_FEATURES_KV_KEY = "site_user_features";
    const SITE_FEATURE_ROWS = [
        { section: "Public & account", id: "practice_map", title: "Practice map", desc: "Home-page DSA mind map (visitors). Site admins still see the map if this is off." },
        { id: "one_topic_mode", title: "One topic mode", desc: "Tab to focus on a single data-structure branch." },
        {
            id: "graph_customize_tab",
            title: "Customize graph tab",
            desc: "Tab for Pro-capable accounts. Site admins always keep Customize even when off for members.",
        },
        { id: "member_dashboard", title: "Member dashboard", desc: "Nav link and user-dashboard.html hub." },
        { id: "practice_auth", title: "Practice sign-in / register", desc: "Account page and Sign in link (signed-out users)." },
        { id: "social_oauth_ui", title: "Google / Apple buttons", desc: "OAuth placeholders on the account page." },
        { id: "site_admin_link", title: "Site admin link", desc: "Footer link from the account page to admin." },
        { id: "footer_visit_counter", title: "Visit counter", desc: "Footer visitor counter on the practice page (if API exists)." },
        {
            section: "Member hub — subscribers",
            id: "sub_personal_graphs",
            title: "Personal graph library",
            desc: "Paid graph list + add/remove on the member hub (site can disable before launch).",
        },
        { id: "sub_shared_inbox", title: "Shared inbox", desc: "Shared-with-you panel (Pro-gated; site-wide off hides nav + locks area)." },
        { id: "sub_collaboration", title: "Collaboration / invites", desc: "Invite link demo panel (Pro-gated)." },
        { id: "sub_quiz_lab", title: "Quiz lab stats", desc: "Aggregated quiz stats card (Pro-gated) inside Quizzes." },
        { id: "sub_digest", title: "Digest & push prefs", desc: "Digest toggle block (Pro-gated) inside Reminders." },
        { id: "sub_study_module", title: "Study module", desc: "Study paths + mistake log panel." },
        { id: "sub_quizzes_module", title: "Quizzes module", desc: "Whole Quizzes section (tabs + quiz lab)." },
        { id: "sub_reminders_module", title: "Reminders module", desc: "Reminders + digest block section." },
        { id: "sub_billing_module", title: "Billing panel", desc: "Plan + upgrade copy on the hub." },
        { id: "sub_alerts_module", title: "Alerts panel", desc: "In-app notifications list + bell shortcut." },
        { id: "sub_settings_module", title: "Settings panel", desc: "Preferences on the hub." },
        { id: "sub_profile_module", title: "Profile panel", desc: "Display name, bio, timezone." },
        { id: "sub_overview_stats", title: "Overview stat row", desc: "Quiz / reminders / graphs / streak chips on the Graph panel." },
        {
            id: "sub_graph_library",
            title: "Graph library (community)",
            desc: "Member hub: community catalog + personal cloud copies (D1). Turn off to hide Library nav site-wide.",
        },
    ];

    /** Mind map mount targets — must match admin.html preview markup. */
    const ADMIN_GRAPH_MOUNT = {
        viewportId: "admin-dsa-hierarchy-root",
        mapToolbarHostId: "admin-dsa-map-toolbar-host",
        shellToolbarId: null,
    };

    const dualMode = {
        dashboard: "ui",
        site: "ui",
        users: "ui",
        library: "ui",
        workspace: "ui",
        system: "ui",
    };

    let usersCache = [];
    let usersOffset = 0;
    let usersLimit = 50;
    let usersTotal = 0;
    let selectedUserId = null;
    let lastUserPayload = null;
    let lastDashboardPayload = null;
    let adminMainTabName = "dashboard";
    let graphInventoryCache = [];
    let glibSelectedRecordType = null;
    let glibSelectedCatalogId = null;
    let glibSelectedUserGraphId = null;

    /** Workspace: which graph is loaded in the studio */
    let wsContext = { mode: "idle" };
    /** Recently opened graphs in workspace (persisted) */
    const WS_RECENTS_MAX = 8;
    const WS_RECENTS_STORAGE_KEY = "dsaAdminWsRecentsV1";
    let wsRecentsList = [];
    let wsSelectedRecordType = null;
    let wsSelectedCatalogId = null;
    let wsSelectedUserGraphId = null;

    /** Serialized snapshot for catalog form dirty detection */
    let glibFormBaselineStr = "";

    /** True while composing a new catalog row before first save */
    let glibCatalogNewDraft = false;

    function glibClientRootId() {
        return "glib-root-" + Math.random().toString(36).slice(2, 11);
    }

    function buildDefaultGraphPayloadFromTitle(title) {
        const name = String(title || "").trim() || "Untitled graph";
        return [
            {
                id: glibClientRootId(),
                name: name,
                tree: [{ name: "Topic", problems: [] }],
            },
        ];
    }

    const DEFAULT_GLIB_PAYLOAD_TEXT = JSON.stringify(buildDefaultGraphPayloadFromTitle("Untitled graph"), null, 2);

    const ADMIN_THEME_KEY = "dsaAdminThemeV1";

    /** Section titles moved into each pane; keep hook for future instrumentation */
    function syncAdminConsoleHeader() {}

    function applyAdminTheme(mode) {
        const m = mode === "dark" ? "dark" : "light";
        document.documentElement.setAttribute("data-admin-theme", m);
        try {
            localStorage.setItem(ADMIN_THEME_KEY, m);
        } catch (e) {
            /* ignore */
        }
        const lightBtn = document.getElementById("adm-theme-light");
        const darkBtn = document.getElementById("adm-theme-dark");
        if (lightBtn) lightBtn.classList.toggle("active", m === "light");
        if (darkBtn) darkBtn.classList.toggle("active", m === "dark");
    }

    function initAdminThemeControls() {
        let initial = document.documentElement.getAttribute("data-admin-theme");
        if (initial !== "dark" && initial !== "light") {
            initial = "light";
        }
        applyAdminTheme(initial);
        const lightBtn = document.getElementById("adm-theme-light");
        const darkBtn = document.getElementById("adm-theme-dark");
        if (lightBtn) {
            lightBtn.addEventListener("click", function () {
                applyAdminTheme("light");
            });
        }
        if (darkBtn) {
            darkBtn.addEventListener("click", function () {
                applyAdminTheme("dark");
            });
        }
    }

    function apiAdmin(segment) {
        return new URL("api/admin/" + segment, document.baseURI).href;
    }

    function getAdminToken() {
        if (typeof dsaGetAdminJwt === "function") {
            const tok = dsaGetAdminJwt();
            if (tok) return tok;
        }
        try {
            return localStorage.getItem("dsaAdminJwtV1") || sessionStorage.getItem("dsaAdminJwtV1");
        } catch (e) {
            return null;
        }
    }

    function authHeaders() {
        const tok = getAdminToken();
        const h = { Accept: "application/json" };
        if (tok) h.Authorization = "Bearer " + tok;
        return h;
    }

    async function fetchJson(url, opts) {
        const r = await fetch(url, {
            ...opts,
            headers: { ...authHeaders(), ...(opts && opts.headers) },
        });
        const text = await r.text();
        let j = null;
        try {
            j = text ? JSON.parse(text) : null;
        } catch (e) {
            j = { _raw: text };
        }
        if (!r.ok) {
            const err = new Error((j && j.error) || text || r.status);
            err.status = r.status;
            err.body = j;
            throw err;
        }
        return j;
    }

    function escapeHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function fmtTime(ts) {
        if (ts == null || ts === "") return "—";
        if (typeof ts === "string") {
            const t = ts.trim();
            if (!t) return "—";
            const iso = Date.parse(t);
            if (!Number.isNaN(iso)) return new Date(iso).toLocaleString();
            if (/^\d+$/.test(t)) {
                const n = parseInt(t, 10);
                const ms = n < 1e12 ? n * 1000 : n;
                try {
                    return new Date(ms).toLocaleString();
                } catch (e) {
                    return String(ts);
                }
            }
            return String(ts);
        }
        const n = Number(ts);
        if (!Number.isFinite(n)) return String(ts);
        const ms = n < 1e12 ? n * 1000 : n;
        try {
            return new Date(ms).toLocaleString();
        } catch (e) {
            return String(ts);
        }
    }

    let admToastHideTimer = null;
    function showAdminToast(message, variant) {
        const host = document.getElementById("adm-toast-host");
        if (!host || message == null || String(message).trim() === "") {
            return;
        }
        host.textContent = String(message);
        host.classList.remove("adm-toast-host--ok", "adm-toast-host--err", "adm-toast-host--info");
        host.classList.add(
            "adm-toast-host--visible",
            variant === "err" ? "adm-toast-host--err" : variant === "info" ? "adm-toast-host--info" : "adm-toast-host--ok",
        );
        if (admToastHideTimer) {
            clearTimeout(admToastHideTimer);
        }
        admToastHideTimer = setTimeout(function () {
            host.classList.remove("adm-toast-host--visible");
        }, 4200);
    }

    function setStatus(id, msg, cls) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = msg || "";
        el.className = "status" + (cls ? " " + cls : "");
        if ((cls === "ok" || cls === "err" || cls === "info") && msg) {
            if (id === "adm-glib-msg" && /^\d+\s+graph\(s\)\s+in\s+this\s+view\.?$/.test(String(msg).trim())) {
                /* Inventory count refresh — keep inline only */
            } else {
                showAdminToast(msg, cls === "info" ? "info" : cls);
            }
        }
    }

    function activeMainTab(name) {
        const prev = adminMainTabName;
        adminMainTabName = name;
        if (prev === "workspace" && name !== "workspace") {
            if (typeof dsaTeardownAdminGraphPreview === "function") {
                dsaTeardownAdminGraphPreview();
            }
        }
        document.querySelectorAll("[data-admin-tab]").forEach(function (btn) {
            const on = btn.getAttribute("data-admin-tab") === name;
            btn.classList.toggle("active", on);
        });
        document.querySelectorAll(".adm-pane[data-admin-pane]").forEach(function (pane) {
            const on = pane.getAttribute("data-admin-pane") === name;
            pane.hidden = !on;
            /* HTML uses .adm-hidden on panes (display:none !important); hidden="" alone does not remove it. */
            pane.classList.toggle("adm-hidden", !on);
        });
        syncAdminConsoleHeader();
    }

    function setDualSection(section, mode) {
        dualMode[section] = mode;
        document.querySelectorAll('[data-adm-dual="' + section + '"]').forEach(function (btn) {
            const on = btn.getAttribute("data-adm-mode") === mode;
            btn.classList.toggle("active", on);
        });
        const ui = document.querySelector('[data-adm-panel="' + section + '-ui"]');
        const json = document.querySelector('[data-adm-panel="' + section + '-json"]');
        const showUi = mode === "ui";
        if (ui) ui.classList.toggle("adm-hidden", !showUi);
        if (json) json.classList.toggle("adm-hidden", showUi);
        if (section === "library" && mode === "json") {
            const ta = document.getElementById("adm-glib-json");
            if (ta) {
                ta.value = JSON.stringify({ ok: true, items: graphInventoryCache }, null, 2);
            }
        }
        if (section === "workspace" && mode === "json") {
            refreshWorkspaceJsonFromGraph();
        }
    }

    function refreshWorkspaceJsonFromGraph() {
        const ta = document.getElementById("adm-ws-json-editor");
        if (!ta) {
            return;
        }
        if (typeof dsaGetMindMapHierarchyJsonString !== "function") {
            ta.value = "[]";
            return;
        }
        try {
            const s = dsaGetMindMapHierarchyJsonString();
            ta.value = JSON.stringify(JSON.parse(s), null, 2);
        } catch (e) {
            ta.value = String(dsaGetMindMapHierarchyJsonString());
        }
    }

    function statCard(lbl, val, sub) {
        const d = document.createElement("div");
        d.className = "adm-stat-card";
        d.innerHTML =
            '<div class="lbl">' +
            escapeHtml(lbl) +
            '</div><div class="val">' +
            escapeHtml(val) +
            "</div>" +
            (sub ? '<div class="sub">' + escapeHtml(sub) + "</div>" : "");
        return d;
    }

    function fillMiniTable(tableId, rows, rowFn) {
        const table = document.getElementById(tableId);
        if (!table) return;
        const tb = table.querySelector("tbody");
        if (!tb) return;
        tb.innerHTML = "";
        (rows || []).forEach(function (r) {
            const tr = document.createElement("tr");
            tr.innerHTML = rowFn(r);
            tb.appendChild(tr);
        });
    }

    function numAgg(x) {
        if (typeof x === "number" && Number.isFinite(x)) {
            return x;
        }
        const p = parseInt(x, 10);
        return Number.isFinite(p) ? p : 0;
    }

    function isoDayFromUnix(ts) {
        const n = Number(ts);
        if (!Number.isFinite(n)) {
            return null;
        }
        try {
            return new Date(n * 1000).toISOString().slice(0, 10);
        } catch (e) {
            return null;
        }
    }

    let admLoaderDepth = 0;
    function admShowLoader(msg) {
        admLoaderDepth += 1;
        const el = document.getElementById("adm-global-loader");
        const tx = document.getElementById("adm-global-loader-text");
        if (tx) {
            tx.textContent = msg || "Loading…";
        }
        if (el) {
            el.hidden = false;
        }
    }
    function admHideLoader() {
        admLoaderDepth = Math.max(0, admLoaderDepth - 1);
        if (admLoaderDepth > 0) {
            return;
        }
        const el = document.getElementById("adm-global-loader");
        if (el) {
            el.hidden = true;
        }
    }

    function adminConfirm(title, body) {
        return new Promise(function (resolve) {
            const wrap = document.getElementById("adm-confirm-modal");
            if (!wrap) {
                resolve(window.confirm(String(body || title || "")));
                return;
            }
            const t = document.getElementById("adm-confirm-title");
            const b = document.getElementById("adm-confirm-body");
            const cancel = document.getElementById("adm-confirm-cancel");
            const ok = document.getElementById("adm-confirm-ok");
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
                if (ev.target === wrap || (ev.target && ev.target.getAttribute("data-adm-confirm-dismiss"))) {
                    done(false);
                }
            }
            cancel.addEventListener("click", onCancel);
            ok.addEventListener("click", onOk);
            wrap.addEventListener("click", onBackdrop);
        });
    }

    function admGlibVisClass(v) {
        const s = String(v || "").toLowerCase();
        if (s === "public") {
            return "adm-glib-vis adm-glib-vis--public";
        }
        if (s === "unlisted") {
            return "adm-glib-vis adm-glib-vis--unlisted";
        }
        return "adm-glib-vis adm-glib-vis--private";
    }

    function setGlibStatus(msg, cls) {
        setStatus("adm-glib-msg", msg, cls);
    }

    function buildGlibInventoryQuery() {
        const p = new URLSearchParams();
        const qEl = document.getElementById("adm-glib-filter-q");
        const sc = document.getElementById("adm-glib-filter-scope");
        const vi = document.getElementById("adm-glib-filter-vis");
        const so = document.getElementById("adm-glib-filter-sort");
        const df = document.getElementById("adm-glib-filter-dfrom");
        const dt = document.getElementById("adm-glib-filter-dto");
        if (qEl && qEl.value.trim()) {
            p.set("q", qEl.value.trim());
        }
        p.set("scope", (sc && sc.value) || "all");
        p.set("visibility", (vi && vi.value) || "all");
        p.set("sort", (so && so.value) || "updated_desc");
        p.set("dateField", "updated");
        if (df && df.value) {
            p.set("dateFrom", df.value);
        }
        if (dt && dt.value) {
            p.set("dateTo", dt.value);
        }
        p.set("limit", "300");
        return p.toString();
    }

    function isGlibRowSelected(it) {
        if (!it || !it.id) {
            return false;
        }
        if (it.recordType === "catalog") {
            return glibSelectedRecordType === "catalog" && glibSelectedCatalogId === it.id;
        }
        if (it.recordType === "user_graph") {
            return glibSelectedRecordType === "user_graph" && glibSelectedUserGraphId === it.id;
        }
        return false;
    }

    function captureGlibFormSnapshot() {
        const id = (document.getElementById("adm-glib-edit-id") && document.getElementById("adm-glib-edit-id").value) || "";
        const title = (document.getElementById("adm-glib-title") && document.getElementById("adm-glib-title").value) || "";
        const slugNew = (document.getElementById("adm-glib-slug-new") && document.getElementById("adm-glib-slug-new").value) || "";
        const vis = (document.getElementById("adm-glib-visibility") && document.getElementById("adm-glib-visibility").value) || "";
        const desc = (document.getElementById("adm-glib-description") && document.getElementById("adm-glib-description").value) || "";
        const accent = (document.getElementById("adm-glib-accent") && document.getElementById("adm-glib-accent").value) || "";
        const est = (document.getElementById("adm-glib-estimated") && document.getElementById("adm-glib-estimated").value) || "";
        const diff = (document.getElementById("adm-glib-difficulty") && document.getElementById("adm-glib-difficulty").value) || "";
        const tags = (document.getElementById("adm-glib-tags") && document.getElementById("adm-glib-tags").value) || "";
        const pay = document.getElementById("adm-glib-payload");
        const payload = pay ? pay.value : "";
        return JSON.stringify({
            id: id,
            title: title,
            slugNew: slugNew,
            vis: vis,
            desc: desc,
            accent: accent,
            est: est,
            diff: diff,
            tags: tags,
            payload: payload,
        });
    }

    function snapshotGlibFormBaseline() {
        glibFormBaselineStr = captureGlibFormSnapshot();
    }

    function isGlibFormDirty() {
        return captureGlibFormSnapshot() !== glibFormBaselineStr;
    }

    function updateGlibCatalogEditorVisibility() {
        const idEl = document.getElementById("adm-glib-edit-id");
        const idTrim = idEl ? String(idEl.value || "").trim() : "";
        const showForm =
            glibCatalogNewDraft ||
            !!idTrim ||
            glibSelectedRecordType === "catalog" ||
            glibSelectedRecordType === "user_graph";
        const idleEl = document.getElementById("adm-glib-editor-idle");
        const formWrap = document.getElementById("adm-glib-editor-form-wrap");
        if (idleEl) {
            idleEl.hidden = !!showForm;
        }
        if (formWrap) {
            formWrap.hidden = !showForm;
        }
        const head = document.getElementById("adm-glib-form-heading");
        const sub = document.getElementById("adm-glib-form-sub");
        if (!showForm && head) {
            head.textContent = "Catalog editor";
        }
        if (!showForm && sub) {
            sub.textContent = "Select an inventory row or create a new catalog graph.";
        }
    }

    function glibNewGraphPayloadReady() {
        const pay = document.getElementById("adm-glib-payload");
        if (!pay) {
            return false;
        }
        try {
            const raw = String(pay.value || "").trim();
            if (!raw) {
                return false;
            }
            const p = JSON.parse(raw);
            return Array.isArray(p) && p.length > 0;
        } catch (e) {
            return false;
        }
    }

    function refreshGlibSaveAndWorkspaceUi() {
        updateGlibCatalogEditorVisibility();
        const id = (document.getElementById("adm-glib-edit-id") && document.getElementById("adm-glib-edit-id").value) || "";
        const idTrim = id.trim();
        const title = (document.getElementById("adm-glib-title") && document.getElementById("adm-glib-title").value) || "";
        const titleTrim = title.trim();
        const saveBtn = document.getElementById("adm-glib-save");
        const openBtn = document.getElementById("adm-glib-open-workspace");
        const isUser = glibSelectedRecordType === "user_graph";
        const idleEl = document.getElementById("adm-glib-editor-idle");
        const isIdle = idleEl && !idleEl.hidden;
        if (saveBtn) {
            if (isIdle) {
                saveBtn.hidden = true;
                saveBtn.disabled = true;
            } else if (isUser) {
                saveBtn.hidden = true;
            } else {
                saveBtn.hidden = false;
                if (!idTrim) {
                    saveBtn.disabled = !(titleTrim && glibNewGraphPayloadReady());
                } else {
                    saveBtn.disabled = !isGlibFormDirty();
                }
            }
        }
        if (openBtn) {
            const canOpen = !isIdle && !!idTrim && (isUser || glibSelectedRecordType === "catalog");
            if (isIdle) {
                openBtn.hidden = true;
                openBtn.disabled = true;
                openBtn.removeAttribute("aria-disabled");
            } else {
                openBtn.hidden = false;
                openBtn.disabled = !canOpen;
                openBtn.setAttribute("aria-disabled", canOpen ? "false" : "true");
                openBtn.title = canOpen
                    ? "Open this graph in Workspace (visual editor)"
                    : "Save the catalog graph first — then open it in Workspace.";
            }
        }
    }

    function syncGlibHiddenPayloadRootTitleFromTitle() {
        const idTrim = (document.getElementById("adm-glib-edit-id") && document.getElementById("adm-glib-edit-id").value) || "";
        if (idTrim.trim()) {
            return;
        }
        const title = (document.getElementById("adm-glib-title") && document.getElementById("adm-glib-title").value) || "";
        const pay = document.getElementById("adm-glib-payload");
        if (!pay) {
            return;
        }
        try {
            const arr = JSON.parse(pay.value || "[]");
            if (Array.isArray(arr) && arr[0] && typeof arr[0] === "object") {
                arr[0].name = title.trim() || "Untitled graph";
                pay.value = JSON.stringify(arr, null, 2);
            }
        } catch (e) {
            pay.value = JSON.stringify(buildDefaultGraphPayloadFromTitle(title), null, 2);
        }
        refreshGlibSaveAndWorkspaceUi();
    }

    function refreshGlibFilterChips() {
        const host = document.getElementById("adm-glib-filter-chips");
        if (!host) {
            return;
        }
        const q = (document.getElementById("adm-glib-filter-q") && document.getElementById("adm-glib-filter-q").value.trim()) || "";
        const sc = document.getElementById("adm-glib-filter-scope");
        const vi = document.getElementById("adm-glib-filter-vis");
        const so = document.getElementById("adm-glib-filter-sort");
        const df = document.getElementById("adm-glib-filter-dfrom");
        const dt = document.getElementById("adm-glib-filter-dto");
        const chips = [];
        if (q) {
            chips.push({ key: "q", label: "Search", val: q });
        }
        if (sc && sc.value !== "all") {
            chips.push({ key: "scope", label: "Scope", val: sc.options[sc.selectedIndex].text });
        }
        if (vi && vi.value !== "all") {
            chips.push({ key: "vis", label: "Visibility", val: vi.options[vi.selectedIndex].text });
        }
        if (so && so.value !== "updated_desc") {
            chips.push({ key: "sort", label: "Sort", val: so.options[so.selectedIndex].text });
        }
        if (df && df.value && dt && dt.value) {
            chips.push({ key: "dates", label: "Updated", val: df.value + " – " + dt.value });
        } else if (df && df.value) {
            chips.push({ key: "dfrom", label: "From", val: df.value });
        } else if (dt && dt.value) {
            chips.push({ key: "dto", label: "To", val: dt.value });
        }
        if (!chips.length) {
            host.innerHTML = "";
            host.hidden = true;
            return;
        }
        host.hidden = false;
        host.innerHTML = chips
            .map(function (c) {
                return (
                    '<span class="adm-glib-chip" data-chip-key="' +
                    escapeHtml(c.key) +
                    '"><strong>' +
                    escapeHtml(c.label) +
                    ":</strong> " +
                    escapeHtml(c.val) +
                    ' <button type="button" class="adm-glib-chip-remove" aria-label="Remove filter">×</button></span>'
                );
            })
            .join("");
    }

    function renderGraphInventoryCards() {
        const host = document.getElementById("adm-glib-card-host");
        if (!host) {
            return;
        }
        host.innerHTML = "";
        if (!graphInventoryCache.length) {
            host.innerHTML = '<p class="adm-glib-empty">No graphs match these filters.</p>';
            refreshGlibFilterChips();
            return;
        }
        graphInventoryCache.forEach(function (g) {
            const btn = document.createElement("button");
            btn.type = "button";
            const isUser = g.recordType === "user_graph";
            btn.className =
                "adm-glib-item" +
                (isGlibRowSelected(g) ? " adm-glib-item--active" : "") +
                (isUser ? " adm-glib-item--user" : "");
            btn.setAttribute("role", "listitem");
            let badges = "";
            let meta = "";
            if (isUser) {
                badges = '<span class="adm-glib-badge adm-glib-badge--user">User</span>';
                meta =
                    escapeHtml(String(g.kind || "")) +
                    " · " +
                    escapeHtml(String(g.ownerEmail || "")) +
                    " · " +
                    escapeHtml(fmtTime(g.updatedAt));
            } else {
                const vis = String(g.visibility || "public").toLowerCase();
                badges =
                    '<span class="adm-glib-badge adm-glib-badge--catalog">Catalog</span>' +
                    (vis === "public"
                        ? '<span class="adm-glib-badge adm-glib-badge--public">Public</span>'
                        : vis === "unlisted"
                          ? '<span class="adm-glib-badge adm-glib-badge--unlisted">Unlisted</span>'
                          : '<span class="adm-glib-badge adm-glib-badge--private">Private</span>');
                meta =
                    escapeHtml(String(g.slug || "")) +
                    " · ↓ " +
                    escapeHtml(String(g.downloadCount != null ? g.downloadCount : 0)) +
                    " · " +
                    escapeHtml(fmtTime(g.updatedAt));
            }
            btn.innerHTML =
                '<div class="adm-glib-item-title">' +
                escapeHtml(String(g.title || "Untitled")) +
                '</div><div class="adm-glib-badges">' +
                badges +
                '</div><div class="adm-glib-item-meta">' +
                meta +
                "</div>";
            btn.addEventListener("click", function () {
                void selectGraphInventoryItem(g.recordType, g.id);
            });
            host.appendChild(btn);
        });
        refreshGlibFilterChips();
    }

    function setGlibFormEditable(editable) {
        const ids = [
            "adm-glib-title",
            "adm-glib-slug-new",
            "adm-glib-visibility",
            "adm-glib-description",
            "adm-glib-accent",
            "adm-glib-estimated",
            "adm-glib-difficulty",
            "adm-glib-tags",
            "adm-glib-payload",
        ];
        ids.forEach(function (id) {
            const el = document.getElementById(id);
            if (el) {
                el.disabled = !editable;
            }
        });
        const del = document.getElementById("adm-glib-delete");
        if (del) {
            del.disabled = !editable || !(document.getElementById("adm-glib-edit-id") && document.getElementById("adm-glib-edit-id").value.trim());
        }
        const pub = document.getElementById("adm-glib-publish");
        const unpub = document.getElementById("adm-glib-unpublish");
        const hard = document.getElementById("adm-glib-delete-hard");
        const visEl = document.getElementById("adm-glib-visibility");
        const curVis = visEl ? String(visEl.value || "") : "";
        if (pub) {
            pub.disabled = !editable || !(document.getElementById("adm-glib-edit-id") && document.getElementById("adm-glib-edit-id").value.trim()) || curVis === "public";
        }
        if (unpub) {
            unpub.disabled = !editable || !(document.getElementById("adm-glib-edit-id") && document.getElementById("adm-glib-edit-id").value.trim()) || curVis !== "public";
        }
        if (hard) {
            hard.disabled = !editable || !(document.getElementById("adm-glib-edit-id") && document.getElementById("adm-glib-edit-id").value.trim());
        }
        refreshGlibSaveAndWorkspaceUi();
    }

    function updateGlibDeleteEnabled() {
        const idEl = document.getElementById("adm-glib-edit-id");
        const hasCat = !!(idEl && idEl.value.trim());
        const h = document.getElementById("adm-glib-form-heading");
        if (glibSelectedRecordType === "user_graph") {
            if (h) {
                h.textContent = "User graph (read-only)";
            }
            setGlibFormEditable(false);
            return;
        }
        if (h) {
            h.textContent = hasCat ? "Edit catalog graph" : "New catalog graph";
        }
        setGlibFormEditable(true);
    }

    function glibClearCatalogFormFieldsOnly() {
        const idEl = document.getElementById("adm-glib-edit-id");
        if (idEl) {
            idEl.value = "";
        }
        const t = document.getElementById("adm-glib-title");
        if (t) {
            t.value = "";
        }
        const slug = document.getElementById("adm-glib-slug-new");
        if (slug) {
            slug.value = "";
            slug.placeholder = "auto from title if empty";
        }
        const vis = document.getElementById("adm-glib-visibility");
        if (vis) {
            vis.value = "public";
        }
        const desc = document.getElementById("adm-glib-description");
        if (desc) {
            desc.value = "";
        }
        const acc = document.getElementById("adm-glib-accent");
        if (acc) {
            acc.value = "";
        }
        const est = document.getElementById("adm-glib-estimated");
        if (est) {
            est.value = "";
        }
        const diff = document.getElementById("adm-glib-difficulty");
        if (diff) {
            diff.value = "";
        }
        const tags = document.getElementById("adm-glib-tags");
        if (tags) {
            tags.value = "";
        }
        const pay = document.getElementById("adm-glib-payload");
        if (pay) {
            pay.value = JSON.stringify(buildDefaultGraphPayloadFromTitle(""), null, 2);
        }
    }

    function clearGraphCatalogForm() {
        glibCatalogNewDraft = false;
        glibSelectedRecordType = null;
        glibSelectedCatalogId = null;
        glibSelectedUserGraphId = null;
        glibClearCatalogFormFieldsOnly();
        const sub = document.getElementById("adm-glib-form-sub");
        if (sub) {
            sub.textContent = "Select an inventory row or create a new catalog graph.";
        }
        setGlibFormEditable(true);
        renderGraphInventoryCards();
        updateGlibDeleteEnabled();
        snapshotGlibFormBaseline();
        updateGlibCatalogEditorVisibility();
        refreshGlibSaveAndWorkspaceUi();
    }

    function glibBeginNewCatalogGraph() {
        glibCatalogNewDraft = true;
        glibSelectedRecordType = null;
        glibSelectedCatalogId = null;
        glibSelectedUserGraphId = null;
        glibClearCatalogFormFieldsOnly();
        const sub = document.getElementById("adm-glib-form-sub");
        if (sub) {
            sub.innerHTML =
                "Add a <strong>title</strong> (required), then <strong>Save</strong>. Edit mind-map JSON on the <strong>JSON</strong> tab or in <strong>Workspace</strong>.";
        }
        const h = document.getElementById("adm-glib-form-heading");
        if (h) {
            h.textContent = "New catalog graph";
        }
        setGlibFormEditable(true);
        renderGraphInventoryCards();
        updateGlibDeleteEnabled();
        snapshotGlibFormBaseline();
        updateGlibCatalogEditorVisibility();
        refreshGlibSaveAndWorkspaceUi();
    }

    function fillCatalogGraphForm(graph) {
        if (!graph) {
            return;
        }
        glibCatalogNewDraft = false;
        glibSelectedRecordType = "catalog";
        glibSelectedCatalogId = graph.id;
        glibSelectedUserGraphId = null;
        const idEl = document.getElementById("adm-glib-edit-id");
        if (idEl) {
            idEl.value = graph.id || "";
        }
        const t = document.getElementById("adm-glib-title");
        if (t) {
            t.value = graph.title || "";
        }
        const vis = document.getElementById("adm-glib-visibility");
        if (vis) {
            vis.value = graph.visibility || "public";
        }
        const desc = document.getElementById("adm-glib-description");
        if (desc) {
            desc.value = graph.description || "";
        }
        const acc = document.getElementById("adm-glib-accent");
        if (acc) {
            acc.value = graph.accentHue != null && graph.accentHue !== "" ? String(graph.accentHue) : "";
        }
        const est = document.getElementById("adm-glib-estimated");
        if (est) {
            est.value =
                graph.estimatedMinutes != null && graph.estimatedMinutes !== "" ? String(graph.estimatedMinutes) : "";
        }
        const diff = document.getElementById("adm-glib-difficulty");
        if (diff) {
            diff.value = graph.difficulty || "";
        }
        const tags = document.getElementById("adm-glib-tags");
        if (tags) {
            tags.value = Array.isArray(graph.tags) ? graph.tags.join(", ") : "";
        }
        const slugNew = document.getElementById("adm-glib-slug-new");
        if (slugNew) {
            slugNew.value = "";
            slugNew.placeholder = graph.slug ? String(graph.slug) + " (fixed after publish)" : "auto from title if empty";
        }
        const pay = document.getElementById("adm-glib-payload");
        if (pay && graph.payload) {
            try {
                pay.value = JSON.stringify(graph.payload, null, 2);
            } catch (e) {
                pay.value = DEFAULT_GLIB_PAYLOAD_TEXT;
            }
        }
        setGlibFormEditable(true);
        renderGraphInventoryCards();
        updateGlibDeleteEnabled();
        const sub = document.getElementById("adm-glib-form-sub");
        if (sub) {
            const slug = graph.slug ? String(graph.slug) : "";
            if (slug === "dsa-site-map") {
                sub.innerHTML =
                    "This row is the <strong>site public graph</strong> (same JSON as <strong>Content → dsa</strong>). Edit the mind map in <strong>Workspace</strong>; adjust listing fields here. <strong>Save</strong> is disabled until you change something.";
            } else {
                sub.innerHTML =
                    "Edit listing fields; <strong>Save</strong> enables only when something changes. Mind map body: use <strong>Open in workspace</strong>.";
            }
        }
        snapshotGlibFormBaseline();
        updateGlibCatalogEditorVisibility();
        refreshGlibSaveAndWorkspaceUi();
    }

    function fillUserGraphForm(graph) {
        if (!graph) {
            return;
        }
        glibCatalogNewDraft = false;
        glibSelectedRecordType = "user_graph";
        glibSelectedUserGraphId = graph.id;
        glibSelectedCatalogId = null;
        const idEl = document.getElementById("adm-glib-edit-id");
        if (idEl) {
            idEl.value = graph.id || "";
        }
        const t = document.getElementById("adm-glib-title");
        if (t) {
            t.value = graph.title || "";
        }
        const vis = document.getElementById("adm-glib-visibility");
        if (vis) {
            vis.value = "private";
        }
        const desc = document.getElementById("adm-glib-description");
        if (desc) {
            desc.value = graph.description || "";
        }
        const acc = document.getElementById("adm-glib-accent");
        if (acc) {
            acc.value = graph.accentHue != null && graph.accentHue !== "" ? String(graph.accentHue) : "";
        }
        const est = document.getElementById("adm-glib-estimated");
        if (est) {
            est.value = "";
        }
        const diff = document.getElementById("adm-glib-difficulty");
        if (diff) {
            diff.value = "";
        }
        const tags = document.getElementById("adm-glib-tags");
        if (tags) {
            tags.value = graph.kind ? "kind: " + String(graph.kind) : "";
        }
        const slugNew = document.getElementById("adm-glib-slug-new");
        if (slugNew) {
            slugNew.value = "";
            slugNew.placeholder = "— (user copy)";
        }
        const pay = document.getElementById("adm-glib-payload");
        if (pay && graph.payload) {
            try {
                pay.value = JSON.stringify(graph.payload, null, 2);
            } catch (e) {
                pay.value = DEFAULT_GLIB_PAYLOAD_TEXT;
            }
        }
        setGlibFormEditable(false);
        renderGraphInventoryCards();
        updateGlibDeleteEnabled();
        const sub = document.getElementById("adm-glib-form-sub");
        if (sub) {
            sub.textContent =
                "Member-owned copy — read-only here. Open workspace to inspect the map; changes are not written back to the member.";
        }
        snapshotGlibFormBaseline();
        updateGlibCatalogEditorVisibility();
        refreshGlibSaveAndWorkspaceUi();
    }

    async function loadGraphInventoryList() {
        setGlibStatus("Loading inventory…", "");
        admShowLoader("Loading inventory…");
        try {
            const qs = buildGlibInventoryQuery();
            const j = await fetchJson(apiAdmin("graph-inventory") + "?" + qs);
            graphInventoryCache = j.items || [];
            const ta = document.getElementById("adm-glib-json");
            if (ta && dualMode.library === "json") {
                ta.value = JSON.stringify({ ok: true, items: graphInventoryCache, limit: j.limit, scope: j.scope }, null, 2);
            }
            renderGraphInventoryCards();
            updateGlibCatalogEditorVisibility();
            setGlibStatus(graphInventoryCache.length + " graph(s) in this view.", "ok");
        } catch (e) {
            setGlibStatus(e.message || "Load failed", "err");
        } finally {
            admHideLoader();
        }
    }

    async function selectGraphInventoryItem(recordType, id) {
        if (!id) {
            return;
        }
        glibCatalogNewDraft = false;
        if (recordType === "catalog") {
            glibSelectedRecordType = "catalog";
            glibSelectedCatalogId = id;
            glibSelectedUserGraphId = null;
        } else {
            glibSelectedRecordType = "user_graph";
            glibSelectedUserGraphId = id;
            glibSelectedCatalogId = null;
        }
        renderGraphInventoryCards();
        setGlibStatus("Loading graph…", "");
        admShowLoader("Loading graph…");
        try {
            const rtParam = recordType === "catalog" ? "catalog" : "user_graph";
            const j = await fetchJson(
                apiAdmin("graph-inventory") +
                    "?id=" +
                    encodeURIComponent(id) +
                    "&recordType=" +
                    encodeURIComponent(rtParam),
            );
            if (j.recordType === "user_graph" || (j.graph && j.graph.locked)) {
                fillUserGraphForm(j.graph);
            } else {
                fillCatalogGraphForm(j.graph);
            }
            const ta = document.getElementById("adm-glib-json");
            if (ta && dualMode.library === "json") {
                ta.value = JSON.stringify(j, null, 2);
            }
            setGlibStatus("Loaded: " + (j.graph && j.graph.title ? j.graph.title : id), "ok");
        } catch (e) {
            setGlibStatus(e.message || "Load failed", "err");
        } finally {
            admHideLoader();
        }
    }

    function parseGlibPayload() {
        const pay = document.getElementById("adm-glib-payload");
        if (!pay) {
            throw new Error("Missing payload field");
        }
        let payload;
        try {
            payload = JSON.parse(pay.value);
        } catch (e) {
            throw new Error("Invalid JSON: " + (e && e.message ? e.message : "parse error"));
        }
        if (!Array.isArray(payload)) {
            throw new Error("Payload must be a JSON array of mind-map roots.");
        }
        return payload;
    }

    function getGlibPayloadForSave() {
        const pay = document.getElementById("adm-glib-payload");
        const titleEl = document.getElementById("adm-glib-title");
        const title = titleEl ? String(titleEl.value || "").trim() : "";
        if (!pay || !String(pay.value || "").trim()) {
            return buildDefaultGraphPayloadFromTitle(title);
        }
        return parseGlibPayload();
    }

    function readGlibOptionalNumber(elId) {
        const el = document.getElementById(elId);
        if (!el || el.value === "" || el.value == null) {
            return null;
        }
        const n = Number(el.value);
        return Number.isFinite(n) ? n : null;
    }

    async function saveGraphCatalogFromForm() {
        if (glibSelectedRecordType === "user_graph") {
            setGlibStatus("User-owned graphs are read-only here.", "err");
            return;
        }
        const id = (document.getElementById("adm-glib-edit-id") && document.getElementById("adm-glib-edit-id").value) || "";
        const titleEl = document.getElementById("adm-glib-title");
        const title = titleEl ? String(titleEl.value || "").trim() : "";
        if (!title) {
            setGlibStatus("Title is required.", "err");
            return;
        }
        let payload;
        try {
            payload = getGlibPayloadForSave();
        } catch (e) {
            setGlibStatus(e.message, "err");
            return;
        }
        const visibility = (document.getElementById("adm-glib-visibility") && document.getElementById("adm-glib-visibility").value) || "public";
        const description = (document.getElementById("adm-glib-description") && document.getElementById("adm-glib-description").value) || "";
        const tagsRaw = (document.getElementById("adm-glib-tags") && document.getElementById("adm-glib-tags").value) || "";
        const tags = tagsRaw
            .split(",")
            .map(function (s) {
                return s.trim();
            })
            .filter(Boolean);
        const difficultyRaw = (document.getElementById("adm-glib-difficulty") && document.getElementById("adm-glib-difficulty").value) || "";
        const difficulty = difficultyRaw.trim() ? difficultyRaw.trim().slice(0, 32) : null;
        const accentRaw = readGlibOptionalNumber("adm-glib-accent");
        const accentHue = accentRaw != null ? Math.floor(accentRaw) % 360 : null;
        const estRaw = readGlibOptionalNumber("adm-glib-estimated");
        const estimatedMinutes = estRaw != null ? Math.max(0, Math.floor(estRaw)) : null;

        setGlibStatus("Saving…", "");
        try {
            if (id.trim()) {
                await fetchJson(apiAdmin("graph-catalog"), {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: id.trim(),
                        title,
                        description,
                        visibility,
                        payload,
                        tags,
                        difficulty,
                        accentHue,
                        estimatedMinutes,
                    }),
                });
                setGlibStatus("Saved.", "ok");
            } else {
                const slugEl = document.getElementById("adm-glib-slug-new");
                const slugHint = slugEl ? String(slugEl.value || "").trim() : "";
                const body = {
                    title,
                    description,
                    visibility,
                    payload,
                    tags,
                    difficulty,
                    accentHue,
                    estimatedMinutes,
                };
                if (slugHint) {
                    body.slug = slugHint;
                }
                const r = await fetchJson(apiAdmin("graph-catalog"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                setGlibStatus("Created — slug: " + (r.slug || "") + ".", "ok");
                if (r.id) {
                    await selectGraphInventoryItem("catalog", r.id);
                }
            }
            await loadGraphInventoryList();
            if (glibSelectedCatalogId) {
                await selectGraphInventoryItem("catalog", glibSelectedCatalogId);
            }
        } catch (e) {
            setGlibStatus(e.message || "Save failed", "err");
        }
    }

    async function deleteGraphCatalogFromForm() {
        if (glibSelectedRecordType === "user_graph") {
            return;
        }
        const idEl = document.getElementById("adm-glib-edit-id");
        const id = idEl ? idEl.value.trim() : "";
        if (!id) {
            return;
        }
        const ok = await adminConfirm(
            "Remove from catalog?",
            "This hides the catalog entry. Members keep downloaded copies.",
        );
        if (!ok) {
            return;
        }
        setGlibStatus("Removing…", "");
        admShowLoader("Updating catalog…");
        try {
            await fetchJson(apiAdmin("graph-catalog") + "?id=" + encodeURIComponent(id), { method: "DELETE" });
            clearGraphCatalogForm();
            await loadGraphInventoryList();
            setGlibStatus("Removed from catalog.", "ok");
        } catch (e) {
            setGlibStatus(e.message || "Delete failed", "err");
        } finally {
            admHideLoader();
        }
    }

    async function admGlibPublish() {
        if (glibSelectedRecordType !== "catalog") {
            setGlibStatus("Select a catalog graph first.", "err");
            return;
        }
        const id = (document.getElementById("adm-glib-edit-id") && document.getElementById("adm-glib-edit-id").value) || "";
        if (!id.trim()) {
            return;
        }
        const ok = await adminConfirm("Publish graph", "Set visibility to public? Members can discover and download this map.");
        if (!ok) {
            return;
        }
        admShowLoader("Publishing…");
        try {
            await fetchJson(apiAdmin("graph-catalog"), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: id.trim(), visibility: "public" }),
            });
            await loadGraphInventoryList();
            await selectGraphInventoryItem("catalog", id.trim());
            setGlibStatus("Published (public).", "ok");
        } catch (e) {
            setGlibStatus(e.message || "Publish failed", "err");
        } finally {
            admHideLoader();
        }
    }

    async function admGlibUnpublish() {
        if (glibSelectedRecordType !== "catalog") {
            setGlibStatus("Select a catalog graph first.", "err");
            return;
        }
        const id = (document.getElementById("adm-glib-edit-id") && document.getElementById("adm-glib-edit-id").value) || "";
        if (!id.trim()) {
            return;
        }
        const ok = await adminConfirm("Unpublish graph", "Set visibility to private? It will no longer appear as public in the hub.");
        if (!ok) {
            return;
        }
        admShowLoader("Updating…");
        try {
            await fetchJson(apiAdmin("graph-catalog"), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: id.trim(), visibility: "private" }),
            });
            await loadGraphInventoryList();
            await selectGraphInventoryItem("catalog", id.trim());
            setGlibStatus("Set to private.", "ok");
        } catch (e) {
            setGlibStatus(e.message || "Unpublish failed", "err");
        } finally {
            admHideLoader();
        }
    }

    async function admGlibDeleteHard() {
        if (glibSelectedRecordType !== "catalog") {
            setGlibStatus("Only catalog graphs can be permanently deleted.", "err");
            return;
        }
        const id = (document.getElementById("adm-glib-edit-id") && document.getElementById("adm-glib-edit-id").value) || "";
        if (!id.trim()) {
            return;
        }
        const ok = await adminConfirm(
            "Delete permanently?",
            "This removes the catalog row from the database. This cannot be undone.",
        );
        if (!ok) {
            return;
        }
        admShowLoader("Deleting…");
        try {
            await fetchJson(apiAdmin("graph-catalog") + "?id=" + encodeURIComponent(id.trim()) + "&hard=1", {
                method: "DELETE",
            });
            clearGraphCatalogForm();
            await loadGraphInventoryList();
            setGlibStatus("Permanently deleted.", "ok");
        } catch (e) {
            setGlibStatus(e.message || "Delete failed", "err");
        } finally {
            admHideLoader();
        }
    }

    async function admGlibOpenWorkspace() {
        const ob = document.getElementById("adm-glib-open-workspace");
        if (ob && (ob.disabled || ob.getAttribute("aria-disabled") === "true")) {
            setGlibStatus("Save the graph first, or select a graph that is already stored.", "err");
            return;
        }
        const rt = glibSelectedRecordType;
        const id = rt === "catalog" ? glibSelectedCatalogId : rt === "user_graph" ? glibSelectedUserGraphId : null;
        if (!id) {
            setGlibStatus("Select a graph in the list first.", "err");
            return;
        }
        await openInventoryGraphInWorkspace(rt, id);
        setGlibStatus("Opened in Workspace tab.", "ok");
    }

    function admGlibFormatPayload() {
        try {
            const title = (document.getElementById("adm-glib-title") && document.getElementById("adm-glib-title").value) || "";
            const pay = document.getElementById("adm-glib-payload");
            if (!pay) {
                return;
            }
            let payload;
            if (!String(pay.value || "").trim()) {
                payload = buildDefaultGraphPayloadFromTitle(title);
            } else {
                payload = parseGlibPayload();
            }
            pay.value = JSON.stringify(payload, null, 2);
            setGlibStatus("Payload formatted.", "ok");
            refreshGlibSaveAndWorkspaceUi();
        } catch (e) {
            setGlibStatus(e.message, "err");
        }
    }

    function wsSetMsg(msg, cls) {
        setStatus("adm-ws-msg", msg, cls);
    }

    function wsRecentDedupeKey(rec) {
        if (!rec || !rec.recordType) {
            return "";
        }
        return String(rec.recordType) + ":" + String(rec.id || "");
    }

    function isWsRecentSelected(rec) {
        if (rec.recordType === "catalog") {
            return wsContext.mode === "catalog" && wsContext.catalogId === rec.id;
        }
        if (rec.recordType === "user_graph") {
            return wsContext.mode === "user_graph" && wsContext.userGraphId === rec.id;
        }
        return false;
    }

    function pushWsRecent(entry) {
        const rec = {
            recordType: entry.recordType,
            id: entry.id != null ? entry.id : undefined,
            title: entry.title ? String(entry.title) : "Untitled",
            slug: entry.slug != null ? String(entry.slug) : undefined,
            ts: Date.now(),
        };
        const key = wsRecentDedupeKey(rec);
        wsRecentsList = wsRecentsList.filter(function (x) {
            return wsRecentDedupeKey(x) !== key;
        });
        wsRecentsList.unshift(rec);
        while (wsRecentsList.length > WS_RECENTS_MAX) {
            wsRecentsList.pop();
        }
        try {
            localStorage.setItem(WS_RECENTS_STORAGE_KEY, JSON.stringify(wsRecentsList));
        } catch (e) {
            /* ignore */
        }
    }

    function loadWsRecentsFromStorage() {
        try {
            const raw = localStorage.getItem(WS_RECENTS_STORAGE_KEY);
            if (!raw) {
                return;
            }
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) {
                return;
            }
            wsRecentsList = arr
                .filter(function (x) {
                    return x && x.recordType && x.id != null && String(x.id).trim() !== "";
                })
                .slice(0, WS_RECENTS_MAX);
        } catch (e) {
            wsRecentsList = [];
        }
    }

    function renderWsRecents() {
        const host = document.getElementById("adm-ws-recents-list");
        const capNum = document.getElementById("adm-ws-recents-cap-num");
        const meta = document.getElementById("adm-ws-recents-meta");
        if (capNum) {
            capNum.textContent = String(WS_RECENTS_MAX);
        }
        if (meta) {
            meta.textContent = "Up to " + WS_RECENTS_MAX;
        }
        if (!host) {
            return;
        }
        const clrBtn = document.getElementById("adm-ws-recents-clear");
        if (clrBtn) {
            clrBtn.disabled = !wsRecentsList.length;
            clrBtn.setAttribute("aria-disabled", wsRecentsList.length ? "false" : "true");
        }
        host.innerHTML = "";
        if (!wsRecentsList.length) {
            host.innerHTML =
                '<p class="adm-ws-recents-empty">Open a graph from the library or use the empty-canvas action — it will appear here.</p>';
            return;
        }
        wsRecentsList.forEach(function (rec) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "adm-ws-recent-item" + (isWsRecentSelected(rec) ? " is-active" : "");
            btn.setAttribute("role", "listitem");
            let badge = "";
            if (rec.recordType === "user_graph") {
                badge = '<span class="adm-ws-recent-badge adm-ws-recent-badge--user">User</span>';
            } else if (rec.recordType === "catalog" && rec.slug === SITE_PUBLIC_GRAPH_SLUG) {
                badge = '<span class="adm-ws-recent-badge adm-ws-recent-badge--public-site">Public site</span>';
            } else {
                badge = '<span class="adm-ws-recent-badge adm-ws-recent-badge--cat">Catalog</span>';
            }
            btn.innerHTML =
                '<div class="adm-ws-recent-title">' +
                escapeHtml(rec.title) +
                '</div><div class="adm-ws-recent-meta">' +
                badge +
                "</div>";
            btn.addEventListener("click", function () {
                if (rec.recordType === "catalog") {
                    void wsSelectInventoryItem("catalog", rec.id);
                } else {
                    void wsSelectInventoryItem("user_graph", rec.id);
                }
            });
            host.appendChild(btn);
        });
    }

    function syncWorkspaceGraphCardEmptyState() {
        const card = document.getElementById("adm-ws-graph-card");
        if (!card) {
            return;
        }
        const idle = wsContext.mode === "idle";
        card.classList.toggle("adm-ws-graph-card--idle", idle);
    }

    function syncWorkspaceSaveButtons() {
        const canSave = wsContext.mode === "catalog" && wsContext.catalogId;
        document.querySelectorAll(".adm-ws-save-catalog").forEach(function (btn) {
            btn.disabled = !canSave;
            btn.setAttribute("aria-disabled", canSave ? "false" : "true");
        });
    }

    async function wsSaveCatalogGraphFromStudio() {
        if (wsContext.mode !== "catalog" || !wsContext.catalogId) {
            wsSetMsg("Open a catalog graph from Library or Recent, then save.", "err");
            return;
        }
        let payload;
        if (dualMode.workspace === "json") {
            const ta = document.getElementById("adm-ws-json-editor");
            if (!ta) {
                wsSetMsg("JSON editor not found.", "err");
                return;
            }
            try {
                payload = JSON.parse(String(ta.value || "").trim() || "[]");
            } catch (e) {
                wsSetMsg("Invalid JSON in editor: " + e.message, "err");
                return;
            }
        } else {
            if (typeof dsaGetMindMapHierarchyJsonString !== "function") {
                wsSetMsg("Graph helpers unavailable.", "err");
                return;
            }
            try {
                payload = JSON.parse(dsaGetMindMapHierarchyJsonString());
            } catch (e) {
                wsSetMsg(e.message || "Invalid graph JSON", "err");
                return;
            }
        }
        if (!Array.isArray(payload)) {
            wsSetMsg("Graph must be a JSON array of roots.", "err");
            return;
        }
        admShowLoader("Saving…");
        try {
            await fetchJson(apiAdmin("graph-catalog"), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: wsContext.catalogId,
                    payload: payload,
                }),
            });
            wsSetMsg("Graph saved.", "ok");
            try {
                await loadGraphInventoryList();
            } catch (e) {
                /* ignore */
            }
        } catch (e) {
            wsSetMsg(e.message || "Save failed", "err");
        } finally {
            admHideLoader();
        }
    }

    function wsClearRecents() {
        if (!wsRecentsList.length) {
            return;
        }
        wsRecentsList = [];
        try {
            localStorage.removeItem(WS_RECENTS_STORAGE_KEY);
        } catch (e) {
            /* ignore */
        }
        renderWsRecents();
        wsSetMsg("Recent list cleared.", "ok");
    }

    function wsRefreshChrome() {
        const ban = document.getElementById("adm-ws-context-banner");
        const mode = wsContext.mode;
        if (ban) {
            if (mode === "idle") {
                ban.hidden = true;
                ban.textContent = "";
            } else {
                ban.hidden = false;
                let line = "";
                if (mode === "catalog") {
                    const slug = wsContext.slug || "";
                    const isSite = slug === SITE_PUBLIC_GRAPH_SLUG;
                    line = isSite
                        ? "<strong>Site public graph</strong> — visitors read <code>/api/data?k=dsa</code>. Use <strong>Save graph</strong> in the header or edit listing in <strong>Graph library</strong>."
                        : "Catalog graph" +
                          (wsContext.title ? ": <strong>" + escapeHtml(String(wsContext.title)) + "</strong>" : "") +
                          " — <strong>Save graph</strong> persists the mind map; metadata in <strong>Graph library</strong>.";
                } else if (mode === "user_graph") {
                    line =
                        "View-only member copy" +
                        (wsContext.title ? ": <strong>" + escapeHtml(String(wsContext.title)) + "</strong>" : "") +
                        " — studio is for inspection only; changes are not saved to the member’s account.";
                }
                ban.innerHTML = line;
            }
        }
        syncWorkspaceGraphCardEmptyState();
        syncWorkspaceSaveButtons();
        renderWsRecents();
    }

    async function wsLoadGraphFromInventory(recordType, id) {
        const rtParam = recordType === "catalog" ? "catalog" : "user_graph";
        const j = await fetchJson(
            apiAdmin("graph-inventory") +
                "?id=" +
                encodeURIComponent(id) +
                "&recordType=" +
                encodeURIComponent(rtParam),
        );
        if (!j.graph || !Array.isArray(j.graph.payload)) {
            throw new Error("Invalid graph payload");
        }
        const jsonStr = JSON.stringify(j.graph.payload);
        if (typeof dsaReloadGraphFromEditorJson !== "function") {
            throw new Error("Graph studio is not available (script load order).");
        }
        const r = dsaReloadGraphFromEditorJson(jsonStr, ADMIN_GRAPH_MOUNT);
        if (!r.ok) {
            throw r.error || new Error("Could not render graph");
        }
        if (recordType === "catalog") {
            wsContext = {
                mode: "catalog",
                catalogId: id,
                title: j.graph.title || "",
                slug: j.graph.slug || "",
            };
            wsSelectedRecordType = "catalog";
            wsSelectedCatalogId = id;
            wsSelectedUserGraphId = null;
        } else {
            wsContext = { mode: "user_graph", userGraphId: id, title: j.graph.title || "" };
            wsSelectedRecordType = "user_graph";
            wsSelectedUserGraphId = id;
            wsSelectedCatalogId = null;
        }
        pushWsRecent({
            recordType: recordType === "catalog" ? "catalog" : "user_graph",
            id: id,
            title: j.graph.title || "",
            slug: recordType === "catalog" ? j.graph.slug || "" : undefined,
        });
        wsRefreshChrome();
    }

    async function openInventoryGraphInWorkspace(recordType, id) {
        if (!id) {
            return;
        }
        activeMainTab("workspace");
        admShowLoader("Opening graph…");
        wsSetMsg("Loading…", "");
        try {
            await wsLoadGraphFromInventory(recordType, id);
            try {
                window.dispatchEvent(new Event("resize"));
            } catch (e) {
                /* ignore */
            }
            const graphWrap = document.querySelector(".adm-ws-graph-wrap");
            if (graphWrap) {
                try {
                    graphWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
                } catch (e) {
                    graphWrap.scrollIntoView();
                }
            }
            wsSetMsg("Graph loaded in the studio.", "ok");
        } catch (e) {
            wsSetMsg(e.message || "Open failed", "err");
        } finally {
            admHideLoader();
        }
    }

    async function wsSelectInventoryItem(recordType, id) {
        activeMainTab("workspace");
        admShowLoader("Loading graph…");
        wsSetMsg("Loading…", "");
        try {
            await wsLoadGraphFromInventory(recordType, id);
            wsSetMsg("Loaded.", "ok");
        } catch (e) {
            wsSetMsg(e.message || "Load failed", "err");
        } finally {
            admHideLoader();
        }
    }

    /** Load reserved catalog graph `dsa-site-map` into the workspace (same data as public GET /api/data?k=dsa). */
    async function wsOpenSitePublicCatalogGraph() {
        activeMainTab("workspace");
        admShowLoader("Loading site map…");
        wsSetMsg("Loading…", "");
        try {
            const list = await fetchJson(apiAdmin("graph-catalog"));
            const graphs = list.graphs || [];
            const row = graphs.find(function (g) {
                return g && String(g.slug || "") === SITE_PUBLIC_GRAPH_SLUG;
            });
            if (!row || !row.id) {
                wsSetMsg(
                    "No catalog graph with slug `" +
                        SITE_PUBLIC_GRAPH_SLUG +
                        "`. Create or seed it in Graph library.",
                    "err",
                );
                return;
            }
            await wsLoadGraphFromInventory("catalog", row.id);
            try {
                window.dispatchEvent(new Event("resize"));
            } catch (e) {
                /* ignore */
            }
            const graphWrap = document.querySelector(".adm-ws-graph-wrap");
            if (graphWrap) {
                try {
                    graphWrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
                } catch (e) {
                    graphWrap.scrollIntoView();
                }
            }
            wsSetMsg("Loaded site public graph from catalog.", "ok");
        } catch (e) {
            wsSetMsg(e.message || "Load failed", "err");
        } finally {
            admHideLoader();
        }
    }

    /** Reload current graph from server (workspace toolbar Reload). */
    async function reloadWorkspaceSection() {
        admShowLoader("Refreshing…");
        wsSetMsg("", "");
        try {
            if (wsContext.mode === "catalog" && wsContext.catalogId) {
                await wsLoadGraphFromInventory("catalog", wsContext.catalogId);
                try {
                    window.dispatchEvent(new Event("resize"));
                } catch (e) {
                    /* ignore */
                }
                if (dualMode.workspace === "json") {
                    refreshWorkspaceJsonFromGraph();
                }
                wsSetMsg("Workspace reloaded.", "ok");
            } else if (wsContext.mode === "user_graph" && wsContext.userGraphId) {
                await wsLoadGraphFromInventory("user_graph", wsContext.userGraphId);
                try {
                    window.dispatchEvent(new Event("resize"));
                } catch (e) {
                    /* ignore */
                }
                if (dualMode.workspace === "json") {
                    refreshWorkspaceJsonFromGraph();
                }
                wsSetMsg("Workspace reloaded.", "ok");
            } else {
                void renderWsRecents();
                wsSetMsg("Open a catalog or user graph first — nothing to reload.", "info");
            }
        } catch (e) {
            wsSetMsg(e.message || "Reload failed", "err");
        } finally {
            admHideLoader();
        }
    }

    function wireAdminWorkspace() {
        const pane = document.querySelector('.adm-pane[data-admin-pane="workspace"]');
        if (!pane || pane.dataset.admWsBound === "1") {
            return;
        }
        if (!document.getElementById("adm-ws-recents-list")) {
            return;
        }
        pane.dataset.admWsBound = "1";
        loadWsRecentsFromStorage();
        renderWsRecents();
        document.getElementById("adm-ws-empty-open-public") &&
            document.getElementById("adm-ws-empty-open-public").addEventListener("click", function () {
                void wsOpenSitePublicCatalogGraph();
            });

        document.querySelectorAll(".adm-ws-save-catalog").forEach(function (btn) {
            if (btn.dataset.admWsSaveBound === "1") {
                return;
            }
            btn.dataset.admWsSaveBound = "1";
            btn.addEventListener("click", function () {
                void wsSaveCatalogGraphFromStudio();
            });
        });

        const clr = document.getElementById("adm-ws-recents-clear");
        if (clr && clr.dataset.admWsClearBound !== "1") {
            clr.dataset.admWsClearBound = "1";
            clr.addEventListener("click", function () {
                wsClearRecents();
            });
        }

        const fileIn = document.getElementById("admin-dsa-map-import-file");
        if (fileIn && fileIn.dataset.admWsFileWired !== "1") {
            fileIn.dataset.admWsFileWired = "1";
            fileIn.addEventListener("change", function () {
                const f = fileIn.files && fileIn.files[0];
                if (!f) {
                    return;
                }
                const reader = new FileReader();
                reader.onload = function () {
                    try {
                        const text = String(reader.result || "");
                        const data = JSON.parse(text);
                        if (!Array.isArray(data)) {
                            throw new Error("File must be a JSON array of roots.");
                        }
                        const pretty = JSON.stringify(data, null, 2);
                        if (typeof dsaReloadGraphFromEditorJson !== "function") {
                            throw new Error("Studio unavailable.");
                        }
                        const r = dsaReloadGraphFromEditorJson(pretty, ADMIN_GRAPH_MOUNT);
                        if (!r.ok) {
                            throw r.error || new Error("Render failed");
                        }
                        if (wsContext.mode !== "catalog") {
                            wsContext = { mode: "idle", title: "" };
                            wsRefreshChrome();
                        }
                        wsSetMsg("Imported JSON into the studio (save if needed).", "ok");
                    } catch (err) {
                        wsSetMsg(
                            "Import failed: " + (err && err.message ? err.message : "invalid file"),
                            "err",
                        );
                    }
                    fileIn.value = "";
                };
                reader.readAsText(f);
            });
        }
        const expBtn = document.getElementById("admin-dsa-map-export-json");
        if (expBtn && expBtn.dataset.admWsExpBound !== "1") {
            expBtn.dataset.admWsExpBound = "1";
            expBtn.addEventListener("click", function () {
                if (typeof dsaExportMindMapHierarchyJson === "function") {
                    dsaExportMindMapHierarchyJson();
                    wsSetMsg("Exported JSON.", "ok");
                }
            });
        }
        const impTrig = document.getElementById("admin-dsa-map-import-json-trigger");
        if (impTrig && impTrig.dataset.admWsImpTrig !== "1") {
            impTrig.dataset.admWsImpTrig = "1";
            impTrig.addEventListener("click", function () {
                if (fileIn) {
                    fileIn.click();
                }
            });
        }

        const wsJsonApply = document.getElementById("adm-ws-json-apply");
        if (wsJsonApply && wsJsonApply.dataset.admWsJsonBound !== "1") {
            wsJsonApply.dataset.admWsJsonBound = "1";
            wsJsonApply.addEventListener("click", function () {
                const ta = document.getElementById("adm-ws-json-editor");
                if (!ta || typeof dsaReloadGraphFromEditorJson !== "function") {
                    return;
                }
                try {
                    JSON.parse(ta.value);
                } catch (e) {
                    wsSetMsg("Invalid JSON: " + e.message, "err");
                    return;
                }
                const r = dsaReloadGraphFromEditorJson(ta.value, ADMIN_GRAPH_MOUNT);
                if (!r.ok) {
                    wsSetMsg((r.error && r.error.message) || "Could not apply graph", "err");
                    return;
                }
                wsSetMsg("Graph updated from JSON editor.", "ok");
            });
        }
        const wsJsonFmt = document.getElementById("adm-ws-json-format");
        if (wsJsonFmt && wsJsonFmt.dataset.admWsJsonBound !== "1") {
            wsJsonFmt.dataset.admWsJsonBound = "1";
            wsJsonFmt.addEventListener("click", function () {
                const ta = document.getElementById("adm-ws-json-editor");
                if (!ta) {
                    return;
                }
                try {
                    ta.value = JSON.stringify(JSON.parse(ta.value), null, 2);
                    wsSetMsg("Formatted.", "ok");
                } catch (e) {
                    wsSetMsg("Format failed: " + e.message, "err");
                }
            });
        }

        wsContext = { mode: "idle" };
        wsRefreshChrome();
    }

    function wireGraphLibraryPanel() {
        const root = document.getElementById("cms-editor-section");
        if (!root || root.dataset.admGlibBound === "1") {
            return;
        }
        if (!document.getElementById("adm-glib-card-host")) {
            return;
        }
        root.dataset.admGlibBound = "1";

        document.getElementById("adm-glib-filter-apply") &&
            document.getElementById("adm-glib-filter-apply").addEventListener("click", function () {
                void loadGraphInventoryList();
            });
        document.getElementById("adm-glib-filter-reset") &&
            document.getElementById("adm-glib-filter-reset").addEventListener("click", function () {
                const q = document.getElementById("adm-glib-filter-q");
                if (q) {
                    q.value = "";
                }
                const sc = document.getElementById("adm-glib-filter-scope");
                if (sc) {
                    sc.value = "all";
                }
                const vi = document.getElementById("adm-glib-filter-vis");
                if (vi) {
                    vi.value = "all";
                }
                const so = document.getElementById("adm-glib-filter-sort");
                if (so) {
                    so.value = "updated_desc";
                }
                const df = document.getElementById("adm-glib-filter-dfrom");
                const dt = document.getElementById("adm-glib-filter-dto");
                if (df) {
                    df.value = "";
                }
                if (dt) {
                    dt.value = "";
                }
                void loadGraphInventoryList();
            });
        document.getElementById("adm-glib-new") &&
            document.getElementById("adm-glib-new").addEventListener("click", function () {
                glibBeginNewCatalogGraph();
                setGlibStatus("New catalog graph — add a title, then Save.", "ok");
            });
        document.getElementById("adm-glib-idle-new") &&
            document.getElementById("adm-glib-idle-new").addEventListener("click", function () {
                glibBeginNewCatalogGraph();
                setGlibStatus("New catalog graph — add a title, then Save.", "ok");
            });

        const chipHost = document.getElementById("adm-glib-filter-chips");
        if (chipHost && chipHost.dataset.admGlibChipBound !== "1") {
            chipHost.dataset.admGlibChipBound = "1";
            chipHost.addEventListener("click", function (ev) {
                if (!ev.target.closest(".adm-glib-chip-remove")) {
                    return;
                }
                const chip = ev.target.closest("[data-chip-key]");
                const key = chip && chip.getAttribute("data-chip-key");
                if (key === "q") {
                    const el = document.getElementById("adm-glib-filter-q");
                    if (el) {
                        el.value = "";
                    }
                } else if (key === "scope") {
                    const el = document.getElementById("adm-glib-filter-scope");
                    if (el) {
                        el.value = "all";
                    }
                } else if (key === "vis") {
                    const el = document.getElementById("adm-glib-filter-vis");
                    if (el) {
                        el.value = "all";
                    }
                } else if (key === "sort") {
                    const el = document.getElementById("adm-glib-filter-sort");
                    if (el) {
                        el.value = "updated_desc";
                    }
                } else if (key === "dates" || key === "dfrom" || key === "dto") {
                    const df = document.getElementById("adm-glib-filter-dfrom");
                    const dt = document.getElementById("adm-glib-filter-dto");
                    if (key === "dates" || key === "dfrom") {
                        if (df) {
                            df.value = "";
                        }
                    }
                    if (key === "dates" || key === "dto") {
                        if (dt) {
                            dt.value = "";
                        }
                    }
                }
                void loadGraphInventoryList();
            });
        }

        [
            "adm-glib-title",
            "adm-glib-slug-new",
            "adm-glib-visibility",
            "adm-glib-description",
            "adm-glib-accent",
            "adm-glib-estimated",
            "adm-glib-difficulty",
            "adm-glib-tags",
            "adm-glib-payload",
        ].forEach(function (fid) {
            const el = document.getElementById(fid);
            if (!el || el.dataset.admGlibInputBound === "1") {
                return;
            }
            el.dataset.admGlibInputBound = "1";
            el.addEventListener("input", function () {
                if (fid === "adm-glib-title") {
                    syncGlibHiddenPayloadRootTitleFromTitle();
                } else {
                    refreshGlibSaveAndWorkspaceUi();
                }
            });
            el.addEventListener("change", function () {
                refreshGlibSaveAndWorkspaceUi();
            });
        });

        document.getElementById("adm-glib-format-payload") &&
            document.getElementById("adm-glib-format-payload").addEventListener("click", function () {
                admGlibFormatPayload();
            });
        document.getElementById("adm-glib-save") &&
            document.getElementById("adm-glib-save").addEventListener("click", function () {
                void saveGraphCatalogFromForm();
            });
        document.getElementById("adm-glib-delete") &&
            document.getElementById("adm-glib-delete").addEventListener("click", function () {
                void deleteGraphCatalogFromForm();
            });
        document.getElementById("adm-glib-publish") &&
            document.getElementById("adm-glib-publish").addEventListener("click", function () {
                void admGlibPublish();
            });
        document.getElementById("adm-glib-unpublish") &&
            document.getElementById("adm-glib-unpublish").addEventListener("click", function () {
                void admGlibUnpublish();
            });
        document.getElementById("adm-glib-delete-hard") &&
            document.getElementById("adm-glib-delete-hard").addEventListener("click", function () {
                void admGlibDeleteHard();
            });
        document.getElementById("adm-glib-open-workspace") &&
            document.getElementById("adm-glib-open-workspace").addEventListener("click", function () {
                void admGlibOpenWorkspace();
            });
        const jc = document.getElementById("adm-glib-json-copy");
        if (jc) {
            jc.addEventListener("click", function () {
                const t = document.getElementById("adm-glib-json");
                if (!t) {
                    return;
                }
                navigator.clipboard.writeText(t.value).then(
                    function () {
                        setGlibStatus("JSON copied.", "ok");
                    },
                    function () {
                        setGlibStatus("Copy failed.", "err");
                    },
                );
            });
        }

        refreshGlibSaveAndWorkspaceUi();
    }

    function renderAdmDashboardViz(d) {
        const host = document.getElementById("adm-dash-viz");
        if (!host) {
            return;
        }
        const u = d.users || {};
        if (u.error) {
            host.innerHTML = '<p class="adm-viz-fallback">User charts unavailable.</p>';
            return;
        }

        const roleRows = [
            { label: "User", v: numAgg(u.role_user), c: "#6366f1" },
            { label: "Subscriber", v: numAgg(u.role_subscriber), c: "#0ea5e9" },
            { label: "Admin", v: numAgg(u.role_admin), c: "#a855f7" },
        ];
        const maxRole = Math.max(1, roleRows[0].v, roleRows[1].v, roleRows[2].v);

        const planRows = [
            { label: "Free", v: numAgg(u.plan_free), c: "#94a3b8" },
            { label: "Pro", v: numAgg(u.plan_pro), c: "#22c55e" },
            { label: "Team", v: numAgg(u.plan_team), c: "#eab308" },
            { label: "Lifetime", v: numAgg(u.plan_lifetime), c: "#f97316" },
        ];
        const maxPlan = Math.max(1, ...planRows.map(function (r) {
            return r.v;
        }));

        const total = numAgg(u.total);
        const active = numAgg(u.status_active);
        const inactive = Math.max(0, total - active);

        const byDay = {};
        (d.recent_security_audit || []).forEach(function (r) {
            const day = isoDayFromUnix(r.created_at);
            if (!day) {
                return;
            }
            byDay[day] = (byDay[day] || 0) + 1;
        });
        const dayKeys = Object.keys(byDay).sort();
        let maxDay = 1;
        dayKeys.forEach(function (k) {
            if (byDay[k] > maxDay) {
                maxDay = byDay[k];
            }
        });

        function barCard(title, rows, maxV) {
            let html =
                '<div class="adm-viz-card"><h4 class="adm-viz-title">' + escapeHtml(title) + "</h4>";
            rows.forEach(function (row) {
                const pct = maxV > 0 ? Math.min(100, Math.round((row.v / maxV) * 100)) : 0;
                html +=
                    '<div class="adm-viz-bar-row"><span class="adm-viz-bar-label">' +
                    escapeHtml(row.label) +
                    '</span><div class="adm-viz-bar-track"><div class="adm-viz-bar-fill" style="width:' +
                    pct +
                    "%;background:" +
                    row.c +
                    '"></div></div><span class="adm-viz-bar-val">' +
                    escapeHtml(String(row.v)) +
                    "</span></div>";
            });
            html += "</div>";
            return html;
        }

        let activityCard =
            '<div class="adm-viz-card"><h4 class="adm-viz-title">Security events by day</h4>';
        if (!dayKeys.length) {
            activityCard +=
                '<p class="adm-viz-muted">No security rows in the last snapshot (see System for more).</p></div>';
        } else {
            dayKeys.forEach(function (dk) {
                const cnt = byDay[dk];
                const pct = maxDay > 0 ? Math.min(100, Math.round((cnt / maxDay) * 100)) : 0;
                activityCard +=
                    '<div class="adm-viz-bar-row"><span class="adm-viz-bar-label">' +
                    escapeHtml(dk) +
                    '</span><div class="adm-viz-bar-track"><div class="adm-viz-bar-fill adm-viz-bar-fill--emerald" style="width:' +
                    pct +
                    '%"></div></div><span class="adm-viz-bar-val">' +
                    escapeHtml(String(cnt)) +
                    "</span></div>";
            });
            activityCard += "</div>";
        }

        const activePct = total > 0 ? Math.round((active / total) * 100) : 0;
        const otherPct = total > 0 ? Math.round((inactive / total) * 100) : 0;
        const statusCard =
            '<div class="adm-viz-card"><h4 class="adm-viz-title">Active accounts</h4>' +
            '<div class="adm-viz-bar-row"><span class="adm-viz-bar-label">Active</span><div class="adm-viz-bar-track"><div class="adm-viz-bar-fill adm-viz-bar-fill--emerald" style="width:' +
            activePct +
            '%"></div></div><span class="adm-viz-bar-val">' +
            escapeHtml(String(active)) +
            "</span></div>" +
            '<div class="adm-viz-bar-row"><span class="adm-viz-bar-label">Not active</span><div class="adm-viz-bar-track"><div class="adm-viz-bar-fill" style="width:' +
            otherPct +
            '%;background:#cbd5e1"></div></div><span class="adm-viz-bar-val">' +
            escapeHtml(String(inactive)) +
            "</span></div>" +
            '<p class="adm-viz-foot">' +
            escapeHtml(String(total)) +
            " total practice accounts</p></div>";

        host.innerHTML =
            '<div class="adm-viz-grid">' +
            barCard("Users by role", roleRows, maxRole) +
            barCard("Users by plan", planRows, maxPlan) +
            statusCard +
            activityCard +
            "</div>";
    }

    async function loadDashboard() {
        const statsHost = document.getElementById("adm-dash-stats");
        const jta = document.getElementById("adm-dash-json");
        setStatus("adm-dash-msg", "Loading…", "");
        try {
            const d = await fetchJson(apiAdmin("dashboard"));
            lastDashboardPayload = d;
            if (jta) jta.value = JSON.stringify(d, null, 2);

            const u = d.users || {};
            if (statsHost) {
                statsHost.innerHTML = "";
                statsHost.appendChild(statCard("Users", String(u.total != null ? u.total : "—"), "practice accounts"));
                statsHost.appendChild(
                    statCard("Subscribers", String(u.role_subscriber != null ? u.role_subscriber : "—"), "role = subscriber"),
                );
                statsHost.appendChild(statCard("Admins", String(u.role_admin != null ? u.role_admin : "—"), "practice role admin"));
                statsHost.appendChild(statCard("Active", String(u.status_active != null ? u.status_active : "—"), "status"));
                const spg = d.site_public_graph;
                statsHost.appendChild(
                    statCard(
                        "Site public graph",
                        spg && spg.slug ? String(spg.slug) : "—",
                        spg && spg.updated_at != null ? fmtTime(spg.updated_at) : spg ? "" : "seed `dsa-site-map`",
                    ),
                );
                statsHost.appendChild(
                    statCard(
                        "Contacts",
                        d.subscriber_contacts_count != null ? String(d.subscriber_contacts_count) : "—",
                        "subscriber_contacts",
                    ),
                );
                statsHost.appendChild(
                    statCard("app_kv", d.app_kv_count != null ? String(d.app_kv_count) : "—", "feature flags"),
                );
            }

            fillMiniTable("adm-dash-table-content", d.recent_content_audit || [], function (r) {
                return (
                    "<td>" +
                    escapeHtml(r.entity_type) +
                    "</td><td>" +
                    escapeHtml(r.entity_key) +
                    "</td><td>" +
                    escapeHtml(r.action) +
                    "</td><td>" +
                    escapeHtml(r.revision) +
                    "</td><td>" +
                    escapeHtml(fmtTime(r.created_at)) +
                    "</td>"
                );
            });
            fillMiniTable("adm-dash-table-security", d.recent_security_audit || [], function (r) {
                return (
                    "<td>" +
                    escapeHtml(r.user_id) +
                    "</td><td>" +
                    escapeHtml(r.action) +
                    "</td><td>" +
                    escapeHtml(fmtTime(r.created_at)) +
                    "</td>"
                );
            });
            renderAdmDashboardViz(d);
            setStatus("adm-dash-msg", "Updated " + fmtTime(d.generated_at) + ".", "ok");
        } catch (e) {
            setStatus("adm-dash-msg", e.message, "err");
            if (statsHost) statsHost.innerHTML = "";
            const vz = document.getElementById("adm-dash-viz");
            if (vz) vz.innerHTML = "";
        }
    }

    function renderKvList(rows) {
        const host = document.getElementById("adm-kv-list");
        if (!host) return;
        host.innerHTML = "";
        (rows || []).forEach(function (row, idx) {
            host.appendChild(kvRowEl(row.k, row.v, row.meta, idx, row.updated_at));
        });
    }

    function kvRowEl(k, v, meta, idx, updatedAt) {
        const wrap = document.createElement("div");
        wrap.className = "adm-kv-row";
        wrap.dataset.kvIndex = String(idx);

        const sk = k != null && String(k).trim() ? String(k).trim() : "";
        if (sk) {
            wrap.dataset.savedKey = sk;
        }

        const f1 = document.createElement("div");
        f1.className = "adm-field";
        f1.innerHTML = '<label>Key <span class="adm-req" aria-hidden="true">*</span></label>';
        const inpK = document.createElement("input");
        inpK.type = "text";
        inpK.className = "adm-kv-k";
        inpK.spellcheck = false;
        inpK.value = k != null ? String(k) : "";
        if (sk) {
            inpK.readOnly = true;
            inpK.title = "Rename: delete old key and add a new row with the new name.";
        }
        f1.appendChild(inpK);

        const f2 = document.createElement("div");
        f2.className = "adm-field";
        f2.innerHTML = "<label>Value (string, often JSON)</label>";
        const ta = document.createElement("textarea");
        ta.className = "adm-kv-v";
        ta.rows = 4;
        ta.value = v != null ? String(v) : "";
        f2.appendChild(ta);

        const f3 = document.createElement("div");
        f3.className = "adm-field";
        f3.innerHTML = "<label>Meta (optional string)</label>";
        const taMeta = document.createElement("textarea");
        taMeta.className = "adm-kv-meta";
        taMeta.rows = 2;
        taMeta.value = meta != null ? String(meta) : "";
        f3.appendChild(taMeta);

        if (updatedAt != null) {
            const hint = document.createElement("p");
            hint.className = "meta-line";
            hint.style.marginTop = "4px";
            hint.textContent = "Server updated_at: " + fmtTime(updatedAt);
            f1.appendChild(hint);
        }

        const actions = document.createElement("div");
        actions.className = "adm-kv-row-actions";
        const btnSave = document.createElement("button");
        btnSave.type = "button";
        btnSave.className = "btn btn-sm adm-kv-save";
        btnSave.textContent = "Save";
        const btnRm = document.createElement("button");
        btnRm.type = "button";
        btnRm.className = "btn ghost btn-sm adm-kv-remove";
        btnRm.textContent = sk ? "Delete key" : "Discard row";
        actions.appendChild(btnSave);
        actions.appendChild(btnRm);

        wrap.appendChild(f1);
        wrap.appendChild(f2);
        wrap.appendChild(f3);
        wrap.appendChild(actions);

        btnSave.addEventListener("click", async function () {
            const kk = inpK.value.trim();
            const vv = ta.value;
            const metaStr = taMeta.value.trim();
            if (!kk) {
                setStatus("adm-kv-msg", "Key required.", "err");
                return;
            }
            setStatus("adm-kv-msg", "Saving " + kk + "…", "");
            try {
                await fetchJson(apiAdmin("kv"), {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        k: kk,
                        v: vv,
                        meta: metaStr ? metaStr : null,
                    }),
                });
                setStatus("adm-kv-msg", "Saved " + kk + ".", "ok");
                await loadKvUi();
            } catch (e) {
                setStatus("adm-kv-msg", e.message, "err");
            }
        });
        btnRm.addEventListener("click", async function () {
            const saved = wrap.dataset.savedKey || "";
            if (saved) {
                if (!confirm('Delete key "' + saved + '" from the server?')) {
                    return;
                }
                setStatus("adm-kv-msg", "Deleting…", "");
                try {
                    await fetchJson(apiAdmin("kv") + "?k=" + encodeURIComponent(saved), { method: "DELETE" });
                    setStatus("adm-kv-msg", "Deleted " + saved + ".", "ok");
                    await loadKvUi();
                } catch (e) {
                    setStatus("adm-kv-msg", e.message, "err");
                }
                return;
            }
            wrap.remove();
        });
        return wrap;
    }

    let siteFeaturesMatrixLoading = false;

    /**
     * @returns {{ cell: HTMLDivElement, input: HTMLInputElement }}
     */
    /**
     * @param {"en" | "vis"} kind — scoped save uses .adm-sf-switch-en / .adm-sf-switch-vis inside each row.
     */
    function createSiteFeatureSwitch(inputId, checked, ariaLabel, kind) {
        const cell = document.createElement("div");
        cell.className = "adm-sf-switch-cell";
        const lab = document.createElement("label");
        lab.className = "adm-sf-switch";
        const inp = document.createElement("input");
        inp.type = "checkbox";
        inp.className =
            "adm-sf-switch-input " + (kind === "vis" ? "adm-sf-switch-vis" : "adm-sf-switch-en");
        inp.id = inputId;
        inp.checked = !!checked;
        if (ariaLabel) {
            inp.setAttribute("aria-label", ariaLabel);
        }
        const track = document.createElement("span");
        track.className = "adm-sf-switch-track";
        track.setAttribute("aria-hidden", "true");
        const thumb = document.createElement("span");
        thumb.className = "adm-sf-switch-thumb";
        track.appendChild(thumb);
        lab.appendChild(inp);
        lab.appendChild(track);
        cell.appendChild(lab);
        return { cell, input: inp };
    }

    function syncSiteFeatureRowCoupling(featureId) {
        const en = document.getElementById("adm-sf-en-" + featureId);
        const vis = document.getElementById("adm-sf-vis-" + featureId);
        if (!en || !vis) {
            return;
        }
        const visCell = vis.closest(".adm-sf-switch-cell");
        if (!en.checked) {
            vis.checked = false;
            vis.disabled = true;
            if (visCell) {
                visCell.classList.add("is-slaved-off");
            }
        } else {
            vis.disabled = false;
            if (visCell) {
                visCell.classList.remove("is-slaved-off");
            }
        }
    }

    function setSiteFeatureFlagButtonsDisabled(disabled) {
        const saveBtn = document.getElementById("adm-site-features-save");
        const relBtn = document.getElementById("adm-site-features-reload");
        const resetBtn = document.getElementById("adm-site-features-reset");
        if (saveBtn) {
            saveBtn.disabled = !!disabled;
        }
        if (relBtn) {
            relBtn.disabled = !!disabled;
        }
        if (resetBtn) {
            resetBtn.disabled = !!disabled;
        }
    }

    function setSiteFeaturesMatrixLoadingUi(host, busy) {
        if (!host) {
            return;
        }
        host.classList.toggle("is-busy", !!busy);
        host.setAttribute("aria-busy", busy ? "true" : "false");
    }

    /**
     * @param {{ lockToolbar?: boolean }} [options] — lockToolbar false when called from loadKvUi() during save/reset so buttons stay managed by the parent action.
     */
    async function loadSiteFeaturesEditor(options) {
        const lockToolbar = !options || options.lockToolbar !== false;
        const host = document.getElementById("adm-site-features-matrix");
        if (!host) {
            return;
        }
        if (siteFeaturesMatrixLoading) {
            return;
        }
        siteFeaturesMatrixLoading = true;
        if (lockToolbar) {
            setSiteFeatureFlagButtonsDisabled(true);
        }
        setSiteFeaturesMatrixLoadingUi(host, true);
        setStatus("adm-site-features-msg", "Loading flags from server…", "");
        let features = {};
        try {
            const sfUrl = new URL("api/site-features", document.baseURI);
            sfUrl.searchParams.set("_", String(Date.now()));
            const r = await fetch(sfUrl.href, {
                headers: {
                    Accept: "application/json",
                    "Cache-Control": "no-cache",
                    Pragma: "no-cache",
                },
                cache: "no-store",
            });
            const j = await r.json();
            features = (j && j.features) || {};
        } catch (e) {
            setStatus("adm-site-features-msg", String(e.message || e), "err");
            host.innerHTML =
                "<p class=\"meta-line\">Could not load flags. Deploy <code>/api/site-features</code> and bind content D1.</p>";
            siteFeaturesMatrixLoading = false;
            setSiteFeaturesMatrixLoadingUi(host, false);
            if (lockToolbar) {
                setSiteFeatureFlagButtonsDisabled(false);
            }
            return;
        }
        host.innerHTML =
            '<div class="adm-sf-head"><span>Feature</span><span title="When on, the feature works if the user reaches it">Enabled</span><span title="When on, the feature is discoverable in navigation and UI chrome">Visibility</span></div>';
        try {
            SITE_FEATURE_ROWS.forEach(function (meta) {
                if (meta.section) {
                    const lab = document.createElement("div");
                    lab.className = "adm-sf-section-label";
                    lab.textContent = meta.section;
                    host.appendChild(lab);
                }
                const st = features[meta.id] || { enabled: true, visible: true };
                const row = document.createElement("div");
                row.className = "adm-sf-data-row";
                row.dataset.sfRow = meta.id;
                const title = document.createElement("div");
                title.innerHTML =
                    '<div class="adm-sf-title">' +
                    escapeHtml(meta.title) +
                    '</div><div class="adm-sf-desc">' +
                    escapeHtml(meta.desc) +
                    "</div>";
                const enPart = createSiteFeatureSwitch(
                    "adm-sf-en-" + meta.id,
                    st.enabled !== false,
                    "Enabled: " + meta.title,
                    "en"
                );
                const visPart = createSiteFeatureSwitch(
                    "adm-sf-vis-" + meta.id,
                    st.visible !== false,
                    "Visibility: " + meta.title,
                    "vis"
                );
                enPart.input.addEventListener("change", function () {
                    syncSiteFeatureRowCoupling(meta.id);
                });
                row.appendChild(title);
                row.appendChild(enPart.cell);
                row.appendChild(visPart.cell);
                host.appendChild(row);
                syncSiteFeatureRowCoupling(meta.id);
            });
            setStatus("adm-site-features-msg", "Loaded from server. Save writes to app_kv; Reload discards unsaved edits.", "ok");
        } finally {
            siteFeaturesMatrixLoading = false;
            setSiteFeaturesMatrixLoadingUi(host, false);
            if (lockToolbar) {
                setSiteFeatureFlagButtonsDisabled(false);
            }
        }
    }

    async function saveSiteFeaturesFromEditor() {
        const host = document.getElementById("adm-site-features-matrix");
        const obj = {};
        SITE_FEATURE_ROWS.forEach(function (meta) {
            const row = host && host.querySelector('.adm-sf-data-row[data-sf-row="' + meta.id + '"]');
            const en = row && row.querySelector("input.adm-sf-switch-en");
            const vis = row && row.querySelector("input.adm-sf-switch-vis");
            const enabled = !!(en && en.checked);
            const visible = !!(enabled && vis && vis.checked);
            obj[meta.id] = {
                enabled,
                visible,
            };
        });
        setSiteFeatureFlagButtonsDisabled(true);
        setStatus("adm-site-features-msg", "Saving to server…", "");
        try {
            await fetchJson(apiAdmin("kv"), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    k: SITE_USER_FEATURES_KV_KEY,
                    v: JSON.stringify(obj),
                    meta: "site_user_features_v1",
                }),
            });
            setStatus("adm-site-features-msg", "Saved. KV list and matrix refreshed from server. Visitors pick up changes within ~30–60s (CDN cache).", "ok");
            await loadKvUi();
        } catch (e) {
            setStatus("adm-site-features-msg", e.message, "err");
        } finally {
            setSiteFeatureFlagButtonsDisabled(false);
        }
    }

    async function resetSiteFeaturesDefaults() {
        const obj = {};
        SITE_FEATURE_ROWS.forEach(function (meta) {
            obj[meta.id] = { enabled: true, visible: true };
        });
        setSiteFeatureFlagButtonsDisabled(true);
        setStatus("adm-site-features-msg", "Writing defaults to server…", "");
        try {
            await fetchJson(apiAdmin("kv"), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    k: SITE_USER_FEATURES_KV_KEY,
                    v: JSON.stringify(obj),
                    meta: "site_user_features_v1",
                }),
            });
            setStatus("adm-site-features-msg", "Defaults saved. Matrix will refresh from server.", "ok");
            await loadKvUi();
        } catch (e) {
            setStatus("adm-site-features-msg", e.message, "err");
        } finally {
            setSiteFeatureFlagButtonsDisabled(false);
        }
    }

    async function loadKvUi() {
        setStatus("adm-kv-msg", "Loading…", "");
        try {
            const d = await fetchJson(apiAdmin("kv") + "?limit=200");
            renderKvList(d.rows || []);
            const sj = document.getElementById("adm-site-json");
            if (sj) sj.value = JSON.stringify(d.rows || [], null, 2);
            setStatus("adm-kv-msg", "Loaded " + (d.rows && d.rows.length) + " keys.", "ok");
            await loadSiteFeaturesEditor({ lockToolbar: false });
        } catch (e) {
            setStatus("adm-kv-msg", e.message, "err");
        }
    }

    async function applySiteJson() {
        const ta = document.getElementById("adm-site-json");
        const msg = "adm-site-json-msg";
        if (!ta) return;
        let rows;
        try {
            rows = JSON.parse(ta.value);
        } catch (e) {
            setStatus(msg, "Invalid JSON: " + e.message, "err");
            return;
        }
        if (!Array.isArray(rows)) {
            setStatus(msg, "Root must be an array of { k, v, meta }.", "err");
            return;
        }
        setStatus(msg, "Applying " + rows.length + " rows…", "");
        try {
            for (let i = 0; i < rows.length; i++) {
                const r = rows[i] || {};
                const k = String(r.k || "").trim();
                if (!k) continue;
                const v = r.v != null ? String(r.v) : "";
                await fetchJson(apiAdmin("kv"), {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ k: k, v: v, meta: r.meta != null ? String(r.meta) : null }),
                });
            }
            setStatus(msg, "Applied.", "ok");
            await loadKvUi();
        } catch (e) {
            setStatus(msg, e.message, "err");
        }
    }

    function renderUsersTable(filter) {
        const tbody = document.querySelector("#admin-users-table tbody");
        const meta = document.getElementById("admin-users-meta");
        if (!tbody) return;
        const q = (filter || "").trim().toLowerCase();
        tbody.innerHTML = "";
        const list = !q
            ? usersCache
            : usersCache.filter(function (u) {
                  return String(u.email || "")
                      .toLowerCase()
                      .indexOf(q) >= 0;
              });
        if (meta) meta.textContent = "Showing " + list.length + " of " + usersCache.length + " users.";
        list.forEach(function (row) {
            const tr = document.createElement("tr");
            if (selectedUserId === row.id) tr.classList.add("adm-row-selected");
            tr.innerHTML =
                "<td>" +
                row.id +
                "</td><td>" +
                escapeHtml(row.email) +
                "</td><td>" +
                escapeHtml(row.role) +
                "</td><td>" +
                escapeHtml(row.plan) +
                "</td><td>" +
                escapeHtml(row.status) +
                "</td>";
            tr.addEventListener("click", function () {
                selectUser(row.id);
            });
            tbody.appendChild(tr);
        });
    }

    function syncUsersPageControls() {
        const sel = document.getElementById("adm-users-page-size");
        if (sel) {
            const v = parseInt(sel.value, 10);
            if (v >= 25 && v <= 500) {
                usersLimit = v;
            }
        }
        const prev = document.getElementById("adm-users-prev");
        const next = document.getElementById("adm-users-next");
        if (prev) prev.disabled = usersOffset <= 0;
        if (next) next.disabled = usersOffset + usersLimit >= usersTotal && usersTotal > 0;
    }

    async function loadUsers() {
        const meta = document.getElementById("admin-users-meta");
        if (meta) meta.textContent = "Loading…";
        syncUsersPageControls();
        try {
            const d = await fetchJson(
                apiAdmin("users") + "?limit=" + encodeURIComponent(usersLimit) + "&offset=" + encodeURIComponent(usersOffset),
            );
            usersCache = d.users || [];
            usersTotal = typeof d.total === "number" ? d.total : usersCache.length;
            const pageStart = usersOffset + 1;
            const pageEnd = usersOffset + usersCache.length;
            if (meta) {
                meta.textContent =
                    "Showing " +
                    (usersCache.length ? pageStart + "–" + pageEnd : "0") +
                    " of " +
                    usersTotal +
                    " users (offset " +
                    usersOffset +
                    ").";
            }
            renderUsersTable(document.getElementById("adm-user-search") && document.getElementById("adm-user-search").value);
            syncUsersPageControls();
        } catch (e) {
            if (meta) meta.textContent = "Error: " + e.message;
        }
    }

    function formSetUserEmpty() {
        selectedUserId = null;
        lastUserPayload = null;
        const ids = [
            "adm-user-id",
            "adm-user-public-id",
            "adm-user-email",
            "adm-user-email-verified",
            "adm-user-last-login",
            "adm-user-created",
            "adm-user-updated",
            "admin-edit-role",
            "admin-edit-plan",
            "admin-edit-status",
            "adm-user-metadata",
            "adm-profile-display",
            "adm-profile-locale",
            "adm-profile-tz",
            "adm-profile-bio",
            "adm-profile-prefs",
            "adm-profile-avatar",
            "adm-profile-social",
        ];
        ids.forEach(function (id) {
            const el = document.getElementById(id);
            if (!el) return;
            if (el.tagName === "SELECT") {
                el.selectedIndex = 0;
            } else {
                el.value = "";
            }
        });
        fillMiniTable("adm-user-table-entitlements", [], function () {
            return "";
        });
        const bc = document.getElementById("adm-user-billing-customers");
        const bs = document.getElementById("adm-user-billing-subs");
        if (bc) bc.textContent = "—";
        if (bs) bs.textContent = "—";
        fillMiniTable("adm-user-table-sec-audit", [], function () {
            return "";
        });
    }

    function renderUserReadonlyBlocks(d) {
        const ent = (d && d.entitlements) || [];
        fillMiniTable("adm-user-table-entitlements", ent, function (r) {
            return (
                "<td>" +
                escapeHtml(r.feature_key) +
                "</td><td>" +
                escapeHtml(r.value_json) +
                "</td><td>" +
                escapeHtml(r.source) +
                "</td><td>" +
                escapeHtml(fmtTime(r.valid_until)) +
                "</td>"
            );
        });
        const bc = document.getElementById("adm-user-billing-customers");
        const bs = document.getElementById("adm-user-billing-subs");
        try {
            if (bc) bc.textContent = JSON.stringify(d.billing_customers || [], null, 2);
            if (bs) bs.textContent = JSON.stringify(d.billing_subscriptions || [], null, 2);
        } catch (e) {
            if (bc) bc.textContent = "—";
            if (bs) bs.textContent = "—";
        }
        fillMiniTable("adm-user-table-sec-audit", (d && d.security_audit_recent) || [], function (r) {
            return (
                "<td>" +
                escapeHtml(r.action) +
                "</td><td>" +
                escapeHtml(r.entity_type) +
                " / " +
                escapeHtml(r.entity_id) +
                "</td><td>" +
                escapeHtml(fmtTime(r.created_at)) +
                "</td>"
            );
        });
    }

    function populateUserForm(d) {
        if (!d || !d.user) return;
        const u = d.user;
        selectedUserId = u.id;
        lastUserPayload = d;
        document.getElementById("adm-user-id").value = String(u.id);
        const pub = document.getElementById("adm-user-public-id");
        if (pub) pub.value = u.public_id != null ? String(u.public_id) : "";
        document.getElementById("adm-user-email").value = u.email || "";
        const ev = document.getElementById("adm-user-email-verified");
        if (ev) ev.value = fmtTime(u.email_verified_at);
        const ll = document.getElementById("adm-user-last-login");
        if (ll) ll.value = fmtTime(u.last_login_at);
        const cr = document.getElementById("adm-user-created");
        if (cr) cr.value = fmtTime(u.created_at);
        const up = document.getElementById("adm-user-updated");
        if (up) up.value = fmtTime(u.updated_at);
        document.getElementById("admin-edit-role").value = u.role || "user";
        document.getElementById("admin-edit-plan").value = u.plan || "free";
        document.getElementById("admin-edit-status").value = u.status || "active";
        document.getElementById("adm-user-metadata").value = u.metadata != null ? String(u.metadata) : "";

        const p = d.profile || {};
        document.getElementById("adm-profile-display").value = p.display_name || "";
        document.getElementById("adm-profile-locale").value = p.locale || "";
        document.getElementById("adm-profile-tz").value = p.timezone || "";
        document.getElementById("adm-profile-bio").value = p.bio || "";
        document.getElementById("adm-profile-prefs").value = p.prefs_json != null ? String(p.prefs_json) : "";
        document.getElementById("adm-profile-avatar").value = p.avatar_url || "";
        document.getElementById("adm-profile-social").value = p.social_json != null ? String(p.social_json) : "";

        renderUserReadonlyBlocks(d);

        const uj = document.getElementById("adm-users-json");
        if (uj) uj.value = JSON.stringify(d, null, 2);
    }

    async function selectUser(id) {
        selectedUserId = id;
        setStatus("admin-edit-user-status", "Loading user…", "");
        try {
            const d = await fetchJson(apiAdmin("user") + "?id=" + encodeURIComponent(id));
            populateUserForm(d);
            renderUsersTable(document.getElementById("adm-user-search").value);
            setStatus("admin-edit-user-status", "Loaded.", "ok");
        } catch (e) {
            setStatus("admin-edit-user-status", e.message, "err");
        }
    }

    async function saveUserFromForm() {
        const id = parseInt(document.getElementById("adm-user-id").value, 10);
        const out = "admin-edit-user-status";
        if (!id) {
            setStatus(out, "Select a user from the table.", "err");
            return;
        }
        const body = {
            role: document.getElementById("admin-edit-role").value,
            plan: document.getElementById("admin-edit-plan").value,
            status: document.getElementById("admin-edit-status").value,
        };
        const meta = document.getElementById("adm-user-metadata").value.trim();
        if (meta) body.metadata = meta;

        const profile = {};
        const disp = document.getElementById("adm-profile-display").value.trim();
        const loc = document.getElementById("adm-profile-locale").value.trim();
        const tz = document.getElementById("adm-profile-tz").value.trim();
        const bio = document.getElementById("adm-profile-bio").value;
        const prefs = document.getElementById("adm-profile-prefs").value.trim();
        const avatar = document.getElementById("adm-profile-avatar").value.trim();
        const social = document.getElementById("adm-profile-social").value.trim();
        if (disp) profile.display_name = disp;
        if (loc) profile.locale = loc;
        if (tz) profile.timezone = tz;
        if (bio) profile.bio = bio;
        if (prefs) profile.prefs_json = prefs;
        if (avatar) profile.avatar_url = avatar;
        if (social) profile.social_json = social;
        if (Object.keys(profile).length) body.profile = profile;

        setStatus(out, "Saving…", "");
        try {
            await fetchJson(apiAdmin("user") + "?id=" + encodeURIComponent(id), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            setStatus(out, "Saved. User should sign in again to refresh JWT.", "ok");
            await selectUser(id);
            await loadUsers();
        } catch (e) {
            setStatus(out, e.message, "err");
        }
    }

    async function deleteUserFromForm() {
        const id = parseInt(document.getElementById("adm-user-id").value, 10);
        const out = "admin-edit-user-status";
        if (!id) {
            setStatus(out, "Select a user from the table.", "err");
            return;
        }
        const email = (document.getElementById("adm-user-email") && document.getElementById("adm-user-email").value) || "";
        const line = "Permanently delete user " + id + (email ? " (" + email + ")" : "") + "? This cannot be undone.";
        if (!window.confirm(line)) {
            return;
        }
        if (!window.confirm("Second confirmation: delete this user and cascade-linked rows?")) {
            return;
        }
        setStatus(out, "Deleting…", "");
        try {
            await fetchJson(apiAdmin("user") + "?id=" + encodeURIComponent(id), { method: "DELETE" });
            setStatus(out, "User deleted.", "ok");
            formSetUserEmpty();
            await loadUsers();
        } catch (e) {
            setStatus(out, e.message, "err");
        }
    }

    async function applyUserJson() {
        const ta = document.getElementById("adm-users-json");
        const msg = "adm-users-json-msg";
        if (!ta) return;
        let o;
        try {
            o = JSON.parse(ta.value);
        } catch (e) {
            setStatus(msg, "Invalid JSON: " + e.message, "err");
            return;
        }
        const u = o.user || o;
        const id = u.id != null ? parseInt(u.id, 10) : selectedUserId;
        if (!id) {
            setStatus(msg, "Missing user id in JSON.", "err");
            return;
        }
        const body = {};
        if (u.role != null) body.role = u.role;
        if (u.plan != null) body.plan = u.plan;
        if (u.status != null) body.status = u.status;
        if (u.metadata !== undefined) body.metadata = u.metadata;
        if (o.profile && typeof o.profile === "object") {
            body.profile = o.profile;
        }

        if (Object.keys(body).length === 0) {
            setStatus(msg, "Nothing to update (need role/plan/status/metadata/profile).", "err");
            return;
        }

        setStatus(msg, "Saving…", "");
        try {
            await fetchJson(apiAdmin("user") + "?id=" + encodeURIComponent(id), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            setStatus(msg, "Saved user " + id + ".", "ok");
            await selectUser(id);
            await loadUsers();
        } catch (e) {
            setStatus(msg, e.message, "err");
        }
    }

    async function loadSystemUi() {
        setStatus("adm-system-msg", "Loading…", "");
        try {
            const limEl = document.getElementById("adm-sys-rows-limit");
            const lim = limEl ? Math.min(500, Math.max(25, parseInt(limEl.value, 10) || 120)) : 120;

            const [dash, c, s, ct] = await Promise.all([
                fetchJson(apiAdmin("dashboard")),
                fetchJson(apiAdmin("audits") + "?type=content&limit=" + lim + "&offset=0"),
                fetchJson(apiAdmin("audits") + "?type=security&limit=" + lim + "&offset=0"),
                fetchJson(apiAdmin("contacts") + "?limit=" + lim + "&offset=0"),
            ]);
            lastDashboardPayload = dash;

            fillMiniTable("adm-sys-table-content", c.rows || [], function (r) {
                return (
                    "<td>" +
                    escapeHtml(r.entity_type) +
                    "</td><td>" +
                    escapeHtml(r.entity_key) +
                    "</td><td>" +
                    escapeHtml(r.action) +
                    "</td><td>" +
                    escapeHtml(r.revision) +
                    "</td><td>" +
                    escapeHtml(fmtTime(r.created_at)) +
                    "</td>"
                );
            });
            fillMiniTable("adm-sys-table-security", s.rows || [], function (r) {
                return (
                    "<td>" +
                    escapeHtml(r.user_id) +
                    "</td><td>" +
                    escapeHtml(r.action) +
                    "</td><td>" +
                    escapeHtml(r.entity_type) +
                    " / " +
                    escapeHtml(r.entity_id) +
                    "</td><td>" +
                    escapeHtml(fmtTime(r.created_at)) +
                    "</td>"
                );
            });
            fillMiniTable("adm-sys-table-contacts", ct.contacts || [], function (r) {
                return (
                    "<td>" +
                    escapeHtml(r.email) +
                    "</td><td>" +
                    escapeHtml(r.user_id) +
                    "</td><td>" +
                    escapeHtml(r.consent_marketing) +
                    "</td><td>" +
                    escapeHtml(fmtTime(r.created_at)) +
                    "</td>"
                );
            });

            const combined = {
                dashboard: dash,
                content_audit: c.rows,
                security_audit: s.rows,
                subscriber_contacts: ct.contacts,
                limits: { audits_contacts: lim },
                fetched_at: Math.floor(Date.now() / 1000),
            };
            const sj = document.getElementById("adm-system-json");
            if (sj) sj.value = JSON.stringify(combined, null, 2);
            setStatus("adm-system-msg", "Updated (" + lim + " rows per audit/contact table).", "ok");
        } catch (e) {
            setStatus("adm-system-msg", e.message, "err");
        }
    }

    function bindDualToggles() {
        document.querySelectorAll("[data-adm-dual]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                const section = btn.getAttribute("data-adm-dual");
                const mode = btn.getAttribute("data-adm-mode");
                if (section && mode) setDualSection(section, mode);
            });
        });
    }

    window.dsaInitAccountAdminPanel = function () {
        if (typeof dsaIsAdminSession !== "function" || !dsaIsAdminSession()) {
            return;
        }

        const section = document.getElementById("cms-editor-section");
        if (!section || section.dataset.admBound === "1") {
            return;
        }
        section.dataset.admBound = "1";

        const shell = document.querySelector(".shell");
        if (shell) shell.classList.add("shell--admin");

        document.querySelectorAll("[data-admin-tab]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                const name = btn.getAttribute("data-admin-tab");
                activeMainTab(name);
                if (name === "dashboard") loadDashboard();
                if (name === "site") loadKvUi();
                if (name === "users") loadUsers();
                if (name === "workspace") {
                    void renderWsRecents();
                }
                if (name === "library") {
                    void loadGraphInventoryList();
                }
                if (name === "system") loadSystemUi();
            });
        });

        document.querySelectorAll("[data-admin-tab-jump]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                const name = btn.getAttribute("data-admin-tab-jump");
                if (!name) {
                    return;
                }
                activeMainTab(name);
                if (name === "workspace") {
                    void renderWsRecents();
                }
                if (name === "library") {
                    void loadGraphInventoryList();
                }
            });
        });

        bindDualToggles();
        Object.keys(dualMode).forEach(function (k) {
            setDualSection(k, dualMode[k]);
        });
        initAdminThemeControls();
        syncAdminConsoleHeader();

        function refreshCurrentAdminSection() {
            const open = document.querySelector(".admin-session-pill.active[data-admin-tab]");
            const name = open && open.getAttribute("data-admin-tab");
            if (name === "dashboard") loadDashboard();
            else if (name === "site") loadKvUi();
            else if (name === "users") loadUsers();
            else if (name === "workspace") {
                void reloadWorkspaceSection();
            } else if (name === "library") {
                void loadGraphInventoryList();
            } else if (name === "system") loadSystemUi();
        }

        document.querySelectorAll(".adm-refresh-trigger").forEach(function (btn) {
            btn.addEventListener("click", function () {
                void refreshCurrentAdminSection();
            });
        });

        const dashCopy = document.getElementById("adm-dash-json-copy");
        if (dashCopy) dashCopy.addEventListener("click", function () {
            const t = document.getElementById("adm-dash-json");
            if (!t) return;
            navigator.clipboard.writeText(t.value).then(
                function () {
                    setStatus("adm-dash-msg", "Copied dashboard JSON.", "ok");
                },
                function () {
                    setStatus("adm-dash-msg", "Copy failed.", "err");
                },
            );
        });

        const kvAdd = document.getElementById("adm-kv-add");
        if (kvAdd) kvAdd.addEventListener("click", function () {
            const host = document.getElementById("adm-kv-list");
            if (!host) return;
            host.appendChild(kvRowEl("", "", null, host.children.length));
        });
        const kvReload = document.getElementById("adm-kv-reload");
        if (kvReload) kvReload.addEventListener("click", loadKvUi);
        const sfSave = document.getElementById("adm-site-features-save");
        if (sfSave) sfSave.addEventListener("click", saveSiteFeaturesFromEditor);
        const sfRel = document.getElementById("adm-site-features-reload");
        if (sfRel) sfRel.addEventListener("click", loadSiteFeaturesEditor);
        const sfReset = document.getElementById("adm-site-features-reset");
        if (sfReset) sfReset.addEventListener("click", resetSiteFeaturesDefaults);
        const siteJL = document.getElementById("adm-site-json-load");
        if (siteJL) siteJL.addEventListener("click", loadKvUi);
        const siteJA = document.getElementById("adm-site-json-apply");
        if (siteJA) siteJA.addEventListener("click", applySiteJson);

        const usersReload = document.getElementById("adm-users-reload");
        if (usersReload) usersReload.addEventListener("click", loadUsers);
        const userSearch = document.getElementById("adm-user-search");
        if (userSearch) userSearch.addEventListener("input", function () {
            renderUsersTable(this.value);
        });
        const saveUser = document.getElementById("admin-save-user-patch");
        if (saveUser) saveUser.addEventListener("click", saveUserFromForm);
        const delUser = document.getElementById("admin-delete-user");
        if (delUser) delUser.addEventListener("click", deleteUserFromForm);
        const ujLoad = document.getElementById("adm-users-json-load");
        if (ujLoad) ujLoad.addEventListener("click", function () {
            if (!selectedUserId) {
                setStatus("adm-users-json-msg", "Select a user first.", "err");
                return;
            }
            selectUser(selectedUserId);
        });
        const ujApply = document.getElementById("adm-users-json-apply");
        if (ujApply) ujApply.addEventListener("click", applyUserJson);

        const psz = document.getElementById("adm-users-page-size");
        if (psz) {
            usersLimit = Math.min(500, Math.max(25, parseInt(psz.value, 10) || 50));
        }
        const up = document.getElementById("adm-users-prev");
        if (up) {
            up.addEventListener("click", function () {
                usersOffset = Math.max(0, usersOffset - usersLimit);
                loadUsers();
            });
        }
        const un = document.getElementById("adm-users-next");
        if (un) {
            un.addEventListener("click", function () {
                if (usersOffset + usersLimit < usersTotal) {
                    usersOffset += usersLimit;
                    loadUsers();
                }
            });
        }
        if (psz) {
            psz.addEventListener("change", function () {
                usersLimit = Math.min(500, Math.max(25, parseInt(this.value, 10) || 50));
                usersOffset = 0;
                loadUsers();
            });
        }
        const uex = document.getElementById("adm-users-export-json");
        if (uex) {
            uex.addEventListener("click", function () {
                const payload = {
                    exported_at: Math.floor(Date.now() / 1000),
                    offset: usersOffset,
                    limit: usersLimit,
                    total: usersTotal,
                    users: usersCache,
                };
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "dsa-admin-users-page.json";
                a.click();
                URL.revokeObjectURL(a.href);
                setStatus("admin-edit-user-status", "Exported current page JSON.", "ok");
            });
        }

        const sysReload = document.getElementById("adm-system-reload");
        if (sysReload) sysReload.addEventListener("click", loadSystemUi);
        const sysJsonRefresh = document.getElementById("adm-system-json-refresh");
        if (sysJsonRefresh) sysJsonRefresh.addEventListener("click", loadSystemUi);

        const sysCopy = document.getElementById("adm-system-json-copy");
        if (sysCopy) sysCopy.addEventListener("click", function () {
            const t = document.getElementById("adm-system-json");
            if (!t) return;
            navigator.clipboard.writeText(t.value).then(
                function () {
                    setStatus("adm-system-msg", "Copied.", "ok");
                },
                function () {
                    setStatus("adm-system-msg", "Copy failed.", "err");
                },
            );
        });

        wireAdminWorkspace();
        wireGraphLibraryPanel();
        activeMainTab("dashboard");
        loadDashboard();
        formSetUserEmpty();
    };
})();
