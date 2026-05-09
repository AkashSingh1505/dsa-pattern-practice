/**
 * Site admin dashboard: Dashboard, Site settings (app_kv), Users, Content, System.
 * Each area supports UI + JSON modes. Requires dsa-admin-auth.js + admin.html portal markup (#portal-panel-cms).
 */
(function () {
    const CMS_KEY = "dsa";

    const dualMode = {
        dashboard: "ui",
        site: "ui",
        users: "ui",
        content: "ui",
        system: "ui",
    };

    let usersCache = [];
    let usersOffset = 0;
    let usersLimit = 50;
    let usersTotal = 0;
    let selectedUserId = null;
    let lastUserPayload = null;
    let lastDashboardPayload = null;

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
        const n = Number(ts);
        if (!Number.isFinite(n)) return String(ts);
        try {
            return new Date(n * 1000).toLocaleString();
        } catch (e) {
            return String(ts);
        }
    }

    function setStatus(id, msg, cls) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = msg || "";
        el.className = "status" + (cls ? " " + cls : "");
    }

    function activeMainTab(name) {
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
                const cms = (d.cms_keys || []).find(function (x) {
                    return x && x.key === CMS_KEY;
                });
                statsHost.appendChild(
                    statCard(
                        "Live revision",
                        cms && cms.revision != null ? String(cms.revision) : "—",
                        "key " + CMS_KEY,
                    ),
                );
                const dr = (d.cms_drafts || []).find(function (x) {
                    return x && x.key === CMS_KEY;
                });
                statsHost.appendChild(
                    statCard(
                        "Draft",
                        dr ? "Yes" : "None",
                        dr && dr.updated_at != null ? fmtTime(dr.updated_at) : "",
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
            setStatus("adm-dash-msg", "Updated " + fmtTime(d.generated_at) + ".", "ok");
        } catch (e) {
            setStatus("adm-dash-msg", e.message, "err");
            if (statsHost) statsHost.innerHTML = "";
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
        f1.innerHTML = "<label>Key</label>";
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

    async function loadKvUi() {
        setStatus("adm-kv-msg", "Loading…", "");
        try {
            const d = await fetchJson(apiAdmin("kv") + "?limit=200");
            renderKvList(d.rows || []);
            const sj = document.getElementById("adm-site-json");
            if (sj) sj.value = JSON.stringify(d.rows || [], null, 2);
            setStatus("adm-kv-msg", "Loaded " + (d.rows && d.rows.length) + " keys.", "ok");
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
            "adm-user-email",
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
        document.getElementById("adm-user-email").value = u.email || "";
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

    function updateContentSummary(editor, cmsState) {
        const host = document.getElementById("adm-content-summary");
        if (!host) return;
        host.innerHTML = "";
        const pub = cmsState && cmsState.published;
        const dr = cmsState && cmsState.draft;
        let nodes = "—";
        try {
            const parsed = JSON.parse(editor.value || "[]");
            if (Array.isArray(parsed)) nodes = String(parsed.length) + " roots/items";
            else if (parsed && typeof parsed === "object") nodes = String(Object.keys(parsed).length) + " keys";
        } catch (e) {
            nodes = "Invalid JSON";
        }
        host.appendChild(statCard("Live revision", pub && pub.revision != null ? String(pub.revision) : "—", fmtTime(pub && pub.updated_at)));
        host.appendChild(statCard("Published at", pub && pub.published_at ? fmtTime(pub.published_at) : "—", ""));
        host.appendChild(statCard("Draft", dr ? "Active" : "None", dr ? fmtTime(dr.updated_at) : ""));
        host.appendChild(statCard("Editor", nodes, "parsed summary"));
    }

    function initContentCms() {
        const editor = document.getElementById("cms-editor");
        const status = document.getElementById("cms-status");
        if (!editor) return;

        let lastCms = null;

        function graphSetStatus(el, msg, cls) {
            if (!el) return;
            el.textContent = msg || "";
            el.className = "status" + (cls ? " " + cls : "");
        }

        async function loadGraphState() {
            graphSetStatus(status, "Loading…", "");
            try {
                const d = await fetchJson(apiAdmin("cms") + "?k=" + encodeURIComponent(CMS_KEY));
                lastCms = d;
                const src =
                    d.draft && d.draft.payload
                        ? d.draft.payload
                        : d.published && d.published.payload
                          ? d.published.payload
                          : "[]";
                try {
                    editor.value = JSON.stringify(JSON.parse(src), null, 2);
                } catch (e) {
                    editor.value = src;
                }
                updateContentSummary(editor, d);
                const hint = d.draft
                    ? "Draft in progress — live revision " + (d.published && d.published.revision) + "."
                    : "No draft — editor shows live published JSON.";
                graphSetStatus(status, hint, "ok");
            } catch (e) {
                graphSetStatus(status, "Load failed: " + e.message, "err");
            }
        }

        async function saveDraft() {
            let body = editor.value;
            try {
                JSON.parse(body);
            } catch (e) {
                graphSetStatus(status, "Invalid JSON: " + e.message, "err");
                return;
            }
            graphSetStatus(status, "Saving draft…", "");
            try {
                await fetchJson(apiAdmin("cms") + "?k=" + encodeURIComponent(CMS_KEY), {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: body,
                });
                graphSetStatus(status, "Draft saved.", "ok");
                await loadGraphState();
            } catch (e) {
                graphSetStatus(status, e.message, "err");
            }
        }

        async function publish() {
            graphSetStatus(status, "Publishing…", "");
            try {
                const r = await fetchJson(
                    apiAdmin("cms") + "?k=" + encodeURIComponent(CMS_KEY) + "&action=publish",
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: "",
                    },
                );
                graphSetStatus(status, "Published — revision " + (r.revision != null ? r.revision : "") + ".", "ok");
                await loadGraphState();
            } catch (e) {
                graphSetStatus(status, e.message, "err");
            }
        }

        async function discardDraft() {
            graphSetStatus(status, "Discarding draft…", "");
            try {
                await fetchJson(apiAdmin("cms") + "?k=" + encodeURIComponent(CMS_KEY), { method: "DELETE" });
                graphSetStatus(status, "Draft discarded.", "ok");
                await loadGraphState();
            } catch (e) {
                graphSetStatus(status, e.message, "err");
            }
        }

        const bind = function (id, fn) {
            const b = document.getElementById(id);
            if (b) b.addEventListener("click", fn);
        };

        bind("cms-load", loadGraphState);
        bind("cms-save-draft", saveDraft);
        bind("cms-publish", publish);
        bind("cms-discard-draft", discardDraft);
        bind("cms-json-format", function () {
            try {
                editor.value = JSON.stringify(JSON.parse(editor.value), null, 2);
                graphSetStatus(status, "Formatted.", "ok");
                updateContentSummary(editor, lastCms);
            } catch (e) {
                graphSetStatus(status, "Format failed: " + e.message, "err");
            }
        });
        bind("cms-json-save-draft", saveDraft);
        bind("cms-json-publish", publish);

        editor.addEventListener("input", function () {
            updateContentSummary(editor, lastCms);
        });

        loadGraphState();
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
                if (name === "content") {
                    const cl = document.getElementById("cms-load");
                    if (cl) cl.click();
                }
                if (name === "system") loadSystemUi();
            });
        });

        bindDualToggles();
        Object.keys(dualMode).forEach(function (k) {
            setDualSection(k, dualMode[k]);
        });

        const refreshBtn = document.getElementById("adm-refresh-all");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", function () {
                const open = document.querySelector(".adm-nav-main button.active[data-admin-tab]");
                const name = open && open.getAttribute("data-admin-tab");
                if (name === "dashboard") loadDashboard();
                else if (name === "site") loadKvUi();
                else if (name === "users") loadUsers();
                else if (name === "content") {
                    const cl = document.getElementById("cms-load");
                    if (cl) cl.click();
                } else if (name === "system") loadSystemUi();
            });
        }

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

        activeMainTab("dashboard");
        loadDashboard();
        initContentCms();
        formSetUserEmpty();
    };
})();
