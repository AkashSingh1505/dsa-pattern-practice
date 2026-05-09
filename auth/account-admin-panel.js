/**
 * Site admin panel (RSA JWT): overview, users, graph draft/publish, audits, app_kv.
 * Requires account.html CMS section + dsa-admin-auth.js.
 */
(function () {
    const CMS_KEY = "dsa";

    function apiAdmin(segment) {
        return new URL("api/admin/" + segment, window.location.href).href;
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

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text == null ? "" : String(text);
    }

    function showEl(id, on) {
        const el = document.getElementById(id);
        if (el) el.hidden = !on;
    }

    function activeAdminTab(name) {
        document.querySelectorAll("[data-admin-tab]").forEach(function (btn) {
            const on = btn.getAttribute("data-admin-tab") === name;
            btn.classList.toggle("active", on);
        });
        document.querySelectorAll(".admin-pane").forEach(function (pane) {
            const on = pane.getAttribute("data-admin-pane") === name;
            pane.hidden = !on;
        });
    }

    async function loadOverview() {
        const host = document.getElementById("admin-overview-mount");
        if (!host) return;
        host.textContent = "Loading…";
        try {
            const d = await fetchJson(apiAdmin("dashboard"));
            const u = d.users || {};
            const lines = [
                "Practice users (totals)",
                "  total: " + (u.total != null ? u.total : "—"),
                "  role user: " + (u.role_user != null ? u.role_user : "—"),
                "  role subscriber: " + (u.role_subscriber != null ? u.role_subscriber : "—"),
                "  role admin: " + (u.role_admin != null ? u.role_admin : "—"),
                "  plan free / pro / team / lifetime: " +
                    [u.plan_free, u.plan_pro, u.plan_team, u.plan_lifetime].join(" / "),
                "  active accounts: " + (u.status_active != null ? u.status_active : "—"),
                "",
                "Marketing contacts: " + (d.subscriber_contacts_count != null ? d.subscriber_contacts_count : "—"),
                "app_kv rows: " + (d.app_kv_count != null ? d.app_kv_count : "—"),
                "",
                "CMS keys: " + JSON.stringify(d.cms_keys || [], null, 0),
                "Drafts: " + JSON.stringify(d.cms_drafts || [], null, 0),
                "",
                "Recent content_audit: " + JSON.stringify(d.recent_content_audit || [], null, 2),
                "",
                "Recent security_audit: " + JSON.stringify(d.recent_security_audit || [], null, 2),
            ];
            host.textContent = lines.join("\n");
        } catch (e) {
            host.textContent = "Failed: " + e.message;
        }
    }

    let usersCache = [];

    async function loadUsersTable() {
        const tbody = document.querySelector("#admin-users-table tbody");
        const meta = document.getElementById("admin-users-meta");
        if (!tbody) return;
        tbody.innerHTML = "";
        if (meta) meta.textContent = "Loading…";
        try {
            const d = await fetchJson(apiAdmin("users") + "?limit=100&offset=0");
            usersCache = d.users || [];
            if (meta) meta.textContent = "Total " + (d.total != null ? d.total : usersCache.length) + " users.";
            usersCache.forEach(function (row) {
                const tr = document.createElement("tr");
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
                    '</td><td><button type="button" class="btn ghost btn-sm" data-admin-open-user="' +
                    row.id +
                    '">View</button></td>';
                tbody.appendChild(tr);
            });
            tbody.querySelectorAll("[data-admin-open-user]").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    openUserDetail(parseInt(btn.getAttribute("data-admin-open-user"), 10));
                });
            });
        } catch (e) {
            if (meta) meta.textContent = "Error: " + e.message;
        }
    }

    function escapeHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    async function openUserDetail(id) {
        const pre = document.getElementById("admin-user-detail-json");
        const panel = document.getElementById("admin-user-detail");
        if (!pre || !panel) return;
        panel.hidden = false;
        pre.textContent = "Loading user " + id + "…";
        try {
            const d = await fetchJson(apiAdmin("user") + "?id=" + encodeURIComponent(id));
            pre.textContent = JSON.stringify(d, null, 2);
        } catch (e) {
            pre.textContent = "Error: " + e.message;
        }
    }

    async function saveUserPatch() {
        const idEl = document.getElementById("admin-edit-user-id");
        const roleEl = document.getElementById("admin-edit-role");
        const planEl = document.getElementById("admin-edit-plan");
        const statusEl = document.getElementById("admin-edit-status");
        const out = document.getElementById("admin-edit-user-status");
        if (!idEl || !roleEl || !planEl || !statusEl || !out) return;
        const id = parseInt(idEl.value, 10);
        if (!id) {
            out.textContent = "Enter a user id.";
            return;
        }
        const body = {
            role: roleEl.value,
            plan: planEl.value,
            status: statusEl.value,
        };
        out.textContent = "Saving…";
        try {
            await fetchJson(apiAdmin("user") + "?id=" + encodeURIComponent(id), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            out.textContent = "Saved. User must sign in again to refresh practice JWT claims.";
            loadUsersTable();
        } catch (e) {
            out.textContent = "Error: " + e.message;
        }
    }

    async function loadAudits() {
        const pre = document.getElementById("admin-audits-json");
        if (!pre) return;
        pre.textContent = "Loading…";
        try {
            const c = await fetchJson(apiAdmin("audits") + "?type=content&limit=80");
            const s = await fetchJson(apiAdmin("audits") + "?type=security&limit=80");
            pre.textContent =
                "CONTENT AUDIT\n" + JSON.stringify(c.rows || [], null, 2) + "\n\nSECURITY AUDIT\n" + JSON.stringify(s.rows || [], null, 2);
        } catch (e) {
            pre.textContent = "Error: " + e.message;
        }
    }

    async function loadKv() {
        const pre = document.getElementById("admin-kv-json");
        if (!pre) return;
        pre.textContent = "Loading…";
        try {
            const d = await fetchJson(apiAdmin("kv") + "?limit=200");
            pre.textContent = JSON.stringify(d.rows || [], null, 2);
        } catch (e) {
            pre.textContent = "Error: " + e.message;
        }
    }

    async function loadContacts() {
        const pre = document.getElementById("admin-contacts-json");
        if (!pre) return;
        pre.textContent = "Loading…";
        try {
            const d = await fetchJson(apiAdmin("contacts") + "?limit=100");
            pre.textContent = JSON.stringify(d.contacts || [], null, 2);
        } catch (e) {
            pre.textContent = "Error: " + e.message;
        }
    }

    function graphSetStatus(el, msg, cls) {
        if (!el) return;
        el.textContent = msg || "";
        el.className = "status" + (cls ? " " + cls : "");
    }

    function initGraphCms() {
        const keySel = document.getElementById("cms-key");
        const editor = document.getElementById("cms-editor");
        const status = document.getElementById("cms-status");
        if (!keySel || !editor) return;

        async function loadGraphState() {
            graphSetStatus(status, "Loading graph…", "");
            try {
                const d = await fetchJson(apiAdmin("cms") + "?k=" + encodeURIComponent(CMS_KEY));
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
                const hint = d.draft ? "Editing draft (live revision " + (d.published && d.published.revision) + ")." : "No draft — showing live published JSON.";
                graphSetStatus(status, hint, "ok");
            } catch (e) {
                graphSetStatus(status, "Load failed: " + e.message, "err");
            }
        }

        document.getElementById("cms-load").addEventListener("click", loadGraphState);

        document.getElementById("cms-save-draft").addEventListener("click", async function () {
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
            } catch (e) {
                graphSetStatus(status, "Save draft failed: " + e.message, "err");
            }
        });

        document.getElementById("cms-publish").addEventListener("click", async function () {
            graphSetStatus(status, "Publishing…", "");
            try {
                const r = await fetchJson(apiAdmin("cms") + "?k=" + encodeURIComponent(CMS_KEY) + "&action=publish", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: "",
                });
                graphSetStatus(status, "Published. Revision " + (r.revision != null ? r.revision : "") + ".", "ok");
                await loadGraphState();
            } catch (e) {
                graphSetStatus(status, "Publish failed: " + e.message, "err");
            }
        });

        document.getElementById("cms-discard-draft").addEventListener("click", async function () {
            graphSetStatus(status, "Discarding draft…", "");
            try {
                await fetchJson(apiAdmin("cms") + "?k=" + encodeURIComponent(CMS_KEY), { method: "DELETE" });
                graphSetStatus(status, "Draft removed.", "ok");
                await loadGraphState();
            } catch (e) {
                graphSetStatus(status, "Discard failed: " + e.message, "err");
            }
        });

        loadGraphState();
    }

    window.dsaInitAccountAdminPanel = function () {
        if (typeof dsaIsAdminSession !== "function" || !dsaIsAdminSession()) {
            return;
        }
        if (window.__dsaAccountAdminPanelInit) {
            return;
        }
        window.__dsaAccountAdminPanelInit = true;

        const shell = document.querySelector(".shell");
        if (shell) shell.classList.add("shell--admin");

        document.querySelectorAll("[data-admin-tab]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                const name = btn.getAttribute("data-admin-tab");
                activeAdminTab(name);
                if (name === "overview") loadOverview();
                if (name === "users") loadUsersTable();
                if (name === "data") {
                    loadAudits();
                    loadKv();
                    loadContacts();
                }
            });
        });

        const savePatch = document.getElementById("admin-save-user-patch");
        if (savePatch) savePatch.addEventListener("click", saveUserPatch);

        activeAdminTab("overview");
        loadOverview();
        initGraphCms();
    };
})();
