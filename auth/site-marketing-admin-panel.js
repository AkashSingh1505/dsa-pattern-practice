/**
 * Site admin — marketing copy for index / premium / content.html (app_kv key site_marketing_v1).
 * Depends: dsaGetAdminJwt from dsa-admin-auth.js, #adm-site-marketing-host in admin.html Site tab.
 */
(function () {
    var MK_KEY = "site_marketing_v1";
    var gMarketing = null;
    var currentTab = "index";

    function apiAdmin(seg) {
        return new URL("api/admin/" + seg, document.baseURI).href;
    }

    function authHeaders() {
        var h = { Accept: "application/json" };
        var tok = typeof dsaGetAdminJwt === "function" ? dsaGetAdminJwt() : "";
        if (!tok) {
            try {
                tok = localStorage.getItem("dsaAdminJwtV1") || sessionStorage.getItem("dsaAdminJwtV1") || "";
            } catch (e) {}
        }
        if (tok) h.Authorization = "Bearer " + tok;
        return h;
    }

    async function fetchJson(url, opts) {
        var r = await fetch(url, Object.assign({ headers: authHeaders() }, opts || {}));
        var text = await r.text();
        var j = null;
        try {
            j = text ? JSON.parse(text) : null;
        } catch (e) {
            j = { _raw: text };
        }
        if (!r.ok) throw new Error((j && j.error) || text || String(r.status));
        return j;
    }

    function getPath(obj, path) {
        var parts = String(path || "").split(".").filter(Boolean);
        var cur = obj;
        for (var i = 0; i < parts.length; i++) {
            if (cur == null) return undefined;
            cur = cur[parts[i]];
        }
        return cur;
    }

    function setPath(obj, path, val) {
        var parts = String(path || "").split(".").filter(Boolean);
        if (!parts.length) return;
        var cur = obj;
        for (var i = 0; i < parts.length - 1; i++) {
            var p = parts[i];
            if (cur[p] == null || typeof cur[p] !== "object") cur[p] = {};
            cur = cur[p];
        }
        cur[parts[parts.length - 1]] = val;
    }

    function field(label, path, type, rows) {
        var v = getPath(gMarketing, path);
        if (v == null) v = "";
        var id = "mk-" + path.replace(/\./g, "-");
        var ta =
            type === "textarea"
                ? '<textarea class="adm-json-input" style="min-height:' +
                  (rows || 3) +
                  'px" id="' +
                  id +
                  '" data-path="' +
                  path +
                  '">' +
                  escapeHtml(String(v)) +
                  "</textarea>"
                : '<input type="text" id="' +
                  id +
                  '" data-path="' +
                  path +
                  '" value="' +
                  escapeAttr(String(v)) +
                  '" style="width:100%;max-width:520px" />';
        return (
            '<div class="adm-field" style="margin-bottom:12px"><label for="' +
            id +
            '">' +
            escapeHtml(label) +
            "</label>" +
            ta +
            "</div>"
        );
    }

    function escapeHtml(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function escapeAttr(s) {
        return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    }

    function renderNavTable(pageKey) {
        var arr = (gMarketing[pageKey] && gMarketing[pageKey].navLinks) || [];
        var rows = arr
            .map(function (row, idx) {
                return (
                    "<tr><td><input type=\"text\" data-nav=\"" +
                    pageKey +
                    "\" data-i=\"" +
                    idx +
                    "\" data-k=\"label\" value=\"" +
                    escapeAttr(row.label) +
                    "\" /></td><td><input type=\"text\" data-nav=\"" +
                    pageKey +
                    "\" data-i=\"" +
                    idx +
                    "\" data-k=\"href\" value=\"" +
                    escapeAttr(row.href) +
                    "\" /></td><td><button type=\"button\" class=\"btn ghost btn-sm\" data-nav-del=\"" +
                    pageKey +
                    "\" data-i=\"" +
                    idx +
                    "\">Remove</button></td></tr>"
                );
            })
            .join("");
        return (
            '<div class="adm-subcard" style="margin-top:14px"><h4>Toolbar links (center nav)</h4>' +
            '<table class="admin-table" style="margin-top:8px"><thead><tr><th>Label</th><th>href</th><th></th></tr></thead><tbody id="mk-nav-tbody-' +
            pageKey +
            '">' +
            rows +
            '</tbody></table><button type="button" class="btn ghost btn-sm" data-nav-add="' +
            pageKey +
            '">Add link</button></div>'
        );
    }

    function renderFaqEditor(pageKey) {
        var arr = (gMarketing[pageKey] && gMarketing[pageKey].faqItems) || [];
        var blocks = arr
            .map(function (it, idx) {
                return (
                    '<div class="adm-subcard" style="margin-top:12px" data-faq-card="' +
                    pageKey +
                    '" data-i="' +
                    idx +
                    '"><div class="adm-field"><label>Question</label><input type="text" data-faq-q="' +
                    pageKey +
                    '" data-i="' +
                    idx +
                    '" value="' +
                    escapeAttr(it.question || "") +
                    '" style="width:100%"/></div>' +
                    '<div class="adm-field"><label>Answer HTML</label><textarea class="adm-json-input" data-faq-a="' +
                    pageKey +
                    '" data-i="' +
                    idx +
                    '" style="min-height:120px;width:100%">' +
                    escapeHtml(it.answerHtml || "") +
                    "</textarea></div>" +
                    '<button type="button" class="btn ghost btn-sm" data-faq-del="' +
                    pageKey +
                    '" data-i="' +
                    idx +
                    '">Remove FAQ</button></div>'
                );
            })
            .join("");
        return (
            '<div style="margin-top:16px"><h4>FAQ items</h4><p class="helper" style="margin-top:4px">Add, remove, reorder. Answer fields allow a small subset of HTML (same as shipped pages).</p>' +
            blocks +
            '<button type="button" class="btn ghost btn-sm" data-faq-add="' +
            pageKey +
            '">Add FAQ item</button></div>'
        );
    }

    function renderTab() {
        var host = document.getElementById("adm-site-marketing-panel");
        if (!host || !gMarketing) return;
        var pk = currentTab;
        var html = "";
        if (pk === "index") {
            html +=
                field("Browser title (document)", "index.documentTitle", "text") +
                field("Brand title", "index.brand.title", "text") +
                field("Brand subtitle", "index.brand.subtitle", "text") +
                renderNavTable("index") +
                field("Sign in — label", "index.toolbar.signInLabel", "text") +
                field("Sign in — href", "index.toolbar.signInHref", "text") +
                field("Premium — label", "index.toolbar.premiumLabel", "text") +
                field("Premium — href", "index.toolbar.premiumHref", "text") +
                field("Hero eyebrow (HTML)", "index.hero.eyebrowHtml", "textarea", 2) +
                field("Hero title (HTML)", "index.hero.titleHtml", "textarea", 3) +
                field("Hero lead (HTML)", "index.hero.leadHtml", "textarea", 4) +
                field("Hero primary CTA label", "index.hero.ctaPrimary", "text") +
                field("Hero secondary CTA label", "index.hero.ctaSecondary", "text") +
                field("Hero trust stats (JSON array of {num, lab})", "index.heroTrustJson", "textarea", 5) +
                field("Studio section tag", "index.studioSection.tag", "text") +
                field("Studio title (HTML)", "index.studioSection.titleHtml", "textarea", 2) +
                field("Studio sub (HTML)", "index.studioSection.subHtml", "textarea", 3) +
                field("Final CTA title (HTML)", "index.finalCta.titleHtml", "textarea", 2) +
                field("Final CTA lead", "index.finalCta.lead", "textarea", 2) +
                field("Final primary button label", "index.finalCta.primaryLabel", "text") +
                field("Final secondary button label", "index.finalCta.secondaryLabel", "text") +
                field("Final trust lines (one per line)", "index.finalCta.trustLinesText", "textarea", 3) +
                field("Footer JSON (columns, tagline, bottomLeft, bottomRight)", "index.footerJson", "textarea", 12);
        } else if (pk === "premium") {
            html +=
                field("Browser title", "premium.documentTitle", "text") +
                field("Brand title", "premium.brand.title", "text") +
                field("Brand subtitle", "premium.brand.subtitle", "text") +
                renderNavTable("premium") +
                field("Sign in — label", "premium.toolbar.signInLabel", "text") +
                field("Sign in — href", "premium.toolbar.signInHref", "text") +
                field("Premium — label", "premium.toolbar.premiumLabel", "text") +
                field("Premium — href", "premium.toolbar.premiumHref", "text") +
                field("FAQ section tag", "premium.faqSection.tag", "text") +
                field("FAQ section title (HTML)", "premium.faqSection.titleHtml", "textarea", 2) +
                field("FAQ section intro (HTML)", "premium.faqSection.subHtml", "textarea", 3) +
                renderFaqEditor("premium") +
                field("Closing title (HTML)", "premium.finalCta.titleHtml", "textarea", 2) +
                field("Closing lead (HTML)", "premium.finalCta.leadHtml", "textarea", 4) +
                field("Footer JSON", "premium.footerJson", "textarea", 12);
        } else {
            html +=
                field("Browser title", "contentPage.documentTitle", "text") +
                field("Brand title", "contentPage.brand.title", "text") +
                field("Brand subtitle", "contentPage.brand.subtitle", "text") +
                renderNavTable("contentPage") +
                field("Sign in — label", "contentPage.toolbar.signInLabel", "text") +
                field("Sign in — href", "contentPage.toolbar.signInHref", "text") +
                field("Premium — label", "contentPage.toolbar.premiumLabel", "text") +
                field("Premium — href", "contentPage.toolbar.premiumHref", "text") +
                field("Hero title", "contentPage.heroTitle", "text") +
                field("Hero subtitle (HTML)", "contentPage.heroSubtitleHtml", "textarea", 3) +
                field("Main body (HTML)", "contentPage.bodyHtml", "textarea", 16) +
                field("FAQ section tag", "contentPage.faqSection.tag", "text") +
                field("FAQ section title (HTML)", "contentPage.faqSection.titleHtml", "textarea", 2) +
                field("FAQ section intro (HTML)", "contentPage.faqSection.subHtml", "textarea", 2) +
                renderFaqEditor("contentPage") +
                field("Footer JSON", "contentPage.footerJson", "textarea", 12);
        }
        host.innerHTML = html;
        bindPanelInputs();
        syncMkTabActive();
    }

    function syncMkTabActive() {
        var root = document.getElementById("adm-site-marketing-host");
        if (!root) return;
        root.querySelectorAll("[data-mk-tab]").forEach(function (b) {
            var tab = b.getAttribute("data-mk-tab");
            b.classList.toggle("active", tab === currentTab);
        });
    }

    function syncSpecialFieldsFromModel() {
        if (!gMarketing) return;
        if (gMarketing.index && gMarketing.index.finalCta && Array.isArray(gMarketing.index.finalCta.trustLines)) {
            gMarketing.index.finalCta.trustLinesText = gMarketing.index.finalCta.trustLines.join("\n");
        }
        if (gMarketing.index && gMarketing.index.hero && Array.isArray(gMarketing.index.hero.trust)) {
            gMarketing.index.heroTrustJson = JSON.stringify(gMarketing.index.hero.trust, null, 2);
        }
        if (gMarketing.index && gMarketing.index.footer) {
            gMarketing.index.footerJson = JSON.stringify(gMarketing.index.footer, null, 2);
        }
        if (gMarketing.premium && gMarketing.premium.footer) {
            gMarketing.premium.footerJson = JSON.stringify(gMarketing.premium.footer, null, 2);
        }
        if (gMarketing.contentPage && gMarketing.contentPage.footer) {
            gMarketing.contentPage.footerJson = JSON.stringify(gMarketing.contentPage.footer, null, 2);
        }
    }

    function syncSpecialFieldsToModel() {
        var t = getPath(gMarketing, "index.finalCta.trustLinesText");
        if (typeof t === "string" && gMarketing.index && gMarketing.index.finalCta) {
            gMarketing.index.finalCta.trustLines = t.split("\n").map(function (s) {
                return s.trim();
            }).filter(Boolean);
        }
        try {
            if (gMarketing.index && gMarketing.index.heroTrustJson) {
                gMarketing.index.hero = gMarketing.index.hero || {};
                gMarketing.index.hero.trust = JSON.parse(gMarketing.index.heroTrustJson);
            }
        } catch (e) {}
        try {
            if (gMarketing.index && gMarketing.index.footerJson) {
                gMarketing.index.footer = JSON.parse(gMarketing.index.footerJson);
            }
        } catch (e) {}
        try {
            if (gMarketing.premium && gMarketing.premium.footerJson) {
                gMarketing.premium.footer = JSON.parse(gMarketing.premium.footerJson);
            }
        } catch (e) {}
        try {
            if (gMarketing.contentPage && gMarketing.contentPage.footerJson) {
                gMarketing.contentPage.footer = JSON.parse(gMarketing.contentPage.footerJson);
            }
        } catch (e) {}
        delete gMarketing.index.heroTrustJson;
        delete gMarketing.index.footerJson;
        delete gMarketing.premium.footerJson;
        delete gMarketing.contentPage.footerJson;
        if (gMarketing.index && gMarketing.index.finalCta) delete gMarketing.index.finalCta.trustLinesText;
    }

    function bindPanelInputs() {
        var panel = document.getElementById("adm-site-marketing-panel");
        if (!panel) return;
        panel.querySelectorAll("[data-path]").forEach(function (el) {
            el.addEventListener("input", function () {
                var path = el.getAttribute("data-path");
                setPath(gMarketing, path, el.value);
            });
        });
        panel.querySelectorAll("[data-nav-add]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var pk = btn.getAttribute("data-nav-add");
                if (!gMarketing[pk]) gMarketing[pk] = {};
                if (!Array.isArray(gMarketing[pk].navLinks)) gMarketing[pk].navLinks = [];
                gMarketing[pk].navLinks.push({ label: "New", href: "#" });
                syncSpecialFieldsFromModel();
                renderTab();
            });
        });
        panel.querySelectorAll("[data-nav-del]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var pk = btn.getAttribute("data-nav-del");
                var i = parseInt(btn.getAttribute("data-i"), 10);
                if (gMarketing[pk] && gMarketing[pk].navLinks) gMarketing[pk].navLinks.splice(i, 1);
                syncSpecialFieldsFromModel();
                renderTab();
            });
        });
        panel.querySelectorAll("input[data-nav]").forEach(function (inp) {
            inp.addEventListener("input", function () {
                var pk = inp.getAttribute("data-nav");
                var i = parseInt(inp.getAttribute("data-i"), 10);
                var k = inp.getAttribute("data-k");
                if (gMarketing[pk] && gMarketing[pk].navLinks && gMarketing[pk].navLinks[i]) {
                    gMarketing[pk].navLinks[i][k] = inp.value;
                }
            });
        });
        panel.querySelectorAll("[data-faq-add]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var pk = btn.getAttribute("data-faq-add");
                if (!gMarketing[pk]) gMarketing[pk] = {};
                if (!Array.isArray(gMarketing[pk].faqItems)) gMarketing[pk].faqItems = [];
                gMarketing[pk].faqItems.push({ question: "New question", answerHtml: "<p>Answer</p>" });
                syncSpecialFieldsFromModel();
                renderTab();
            });
        });
        panel.querySelectorAll("[data-faq-del]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var pk = btn.getAttribute("data-faq-del");
                var i = parseInt(btn.getAttribute("data-i"), 10);
                if (gMarketing[pk] && gMarketing[pk].faqItems) gMarketing[pk].faqItems.splice(i, 1);
                syncSpecialFieldsFromModel();
                renderTab();
            });
        });
        panel.querySelectorAll("[data-faq-q]").forEach(function (inp) {
            inp.addEventListener("input", function () {
                var pk = inp.getAttribute("data-faq-q");
                var i = parseInt(inp.getAttribute("data-i"), 10);
                if (gMarketing[pk] && gMarketing[pk].faqItems && gMarketing[pk].faqItems[i]) {
                    gMarketing[pk].faqItems[i].question = inp.value;
                }
            });
        });
        panel.querySelectorAll("[data-faq-a]").forEach(function (ta) {
            ta.addEventListener("input", function () {
                var pk = ta.getAttribute("data-faq-a");
                var i = parseInt(ta.getAttribute("data-i"), 10);
                if (gMarketing[pk] && gMarketing[pk].faqItems && gMarketing[pk].faqItems[i]) {
                    gMarketing[pk].faqItems[i].answerHtml = ta.value;
                }
            });
        });
    }

    async function loadMarketing() {
        var j = await fetchJson(new URL("api/site-marketing", document.baseURI).href, { cache: "no-store" });
        gMarketing = j.marketing;
        if (!gMarketing) throw new Error("missing marketing");
        syncSpecialFieldsFromModel();
        renderTab();
        var st = document.getElementById("adm-site-marketing-msg");
        if (st) st.textContent = "Loaded merged marketing (defaults + server).";
    }

    async function saveMarketing() {
        syncSpecialFieldsToModel();
        var payload = JSON.parse(JSON.stringify(gMarketing));
        delete payload.index.heroTrustJson;
        delete payload.index.footerJson;
        delete payload.premium.footerJson;
        delete payload.contentPage.footerJson;
        if (payload.index && payload.index.finalCta) delete payload.index.finalCta.trustLinesText;
        await fetchJson(apiAdmin("kv"), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ k: MK_KEY, v: JSON.stringify(payload), meta: "site_marketing_v1" }),
        });
        var st = document.getElementById("adm-site-marketing-msg");
        if (st) st.textContent = "Saved. Public pages pick this up on next GET /api/site-marketing.";
        await loadMarketing();
    }

    async function resetMarketing() {
        if (!window.confirm("Delete custom marketing in D1 and restore built-in defaults for all public pages?")) return;
        await fetchJson(apiAdmin("kv") + "?k=" + encodeURIComponent(MK_KEY), { method: "DELETE" });
        await loadMarketing();
        var st = document.getElementById("adm-site-marketing-msg");
        if (st) st.textContent = "Key removed. Reloaded defaults.";
    }

    function mount() {
        var root = document.getElementById("adm-site-marketing-host");
        if (!root || root.getAttribute("data-mk-mounted") === "1") return;
        root.setAttribute("data-mk-mounted", "1");
        root.innerHTML =
            '<div class="adm-site-marketing-inner">' +
            '<p class="helper adm-site-tab__hint">Public copy for Index, Premium, and Content · <code>' +
            MK_KEY +
            '</code>. Use the header <b>Reload</b> to refetch merged defaults + server.</p>' +
            '<div class="adm-site-tabs-rail">' +
            '<div class="adm-seg adm-site-mk-seg" role="tablist" aria-label="Marketing page">' +
            '<button type="button" class="active" data-mk-tab="index">Index</button>' +
            '<button type="button" data-mk-tab="premium">Premium</button>' +
            '<button type="button" data-mk-tab="contentPage">Content</button>' +
            "</div></div>" +
            '<details class="adm-site-tab__details">' +
            '<summary class="adm-site-tab__summary">Editing tips</summary>' +
            '<p class="helper adm-site-tab__help">Nav links (add/remove), hero and FAQ fields, footer JSON. <b>Save</b> writes the full document. <b>Clear key</b> removes custom marketing from D1 (confirm).</p>' +
            "</details>" +
            '<div id="adm-site-marketing-panel" class="adm-site-marketing-panel"></div>' +
            '<div class="adm-site-actions-row">' +
            '<button type="button" class="btn btn-sm adm-btn-with-ico" id="adm-site-marketing-save" title="Save marketing to app_kv">' +
            '<svg class="adm-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>' +
            "<span>Save</span></button>" +
            '<button type="button" class="btn ghost btn-sm adm-btn-with-ico" id="adm-site-marketing-reset" title="Delete marketing key from D1">' +
            '<svg class="adm-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>' +
            "<span>Clear key</span></button>" +
            "</div>" +
            '<p id="adm-site-marketing-msg" class="status adm-site-tab__status" aria-live="polite"></p>' +
            "</div>";

        root.querySelectorAll("[data-mk-tab]").forEach(function (b) {
            b.addEventListener("click", function () {
                currentTab = b.getAttribute("data-mk-tab") || "index";
                syncSpecialFieldsFromModel();
                renderTab();
            });
        });
        syncMkTabActive();
        document.getElementById("adm-site-marketing-save").addEventListener("click", function () {
            saveMarketing().catch(function (e) {
                var st = document.getElementById("adm-site-marketing-msg");
                if (st) st.textContent = String(e.message || e);
            });
        });
        document.getElementById("adm-site-marketing-reset").addEventListener("click", function () {
            resetMarketing().catch(function (e) {
                var st = document.getElementById("adm-site-marketing-msg");
                if (st) st.textContent = String(e.message || e);
            });
        });

        loadMarketing().catch(function (e) {
            var st = document.getElementById("adm-site-marketing-msg");
            if (st) st.textContent = String(e.message || e);
        });
    }

    window.dsaAdminReloadSiteMarketing = function () {
        var h = document.getElementById("adm-site-marketing-host");
        if (!h || h.getAttribute("data-mk-mounted") !== "1") {
            return Promise.resolve();
        }
        return loadMarketing().catch(function (e) {
            var st = document.getElementById("adm-site-marketing-msg");
            if (st) st.textContent = String(e.message || e);
        });
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mount);
    } else {
        mount();
    }
})();
