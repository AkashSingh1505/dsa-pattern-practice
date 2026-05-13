/**
 * Site admin — marketing copy for index / premium / content.html (app_kv key site_marketing_v1).
 * Depends: dsaGetAdminJwt from dsa-admin-auth.js, #adm-site-marketing-host in admin.html Site tab.
 */
(function () {
    var MK_KEY = "site_marketing_v1";
    var gMarketing = null;
    var currentTab = "index";
    var faqEditIdx = null;
    var navEditIdx = null;

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
        opts = opts || {};
        var merged = Object.assign({}, opts);
        merged.headers = Object.assign({}, authHeaders(), opts.headers || {});
        var r = await fetch(url, merged);
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

    function editorExtraClasses(path, type) {
        if (type !== "textarea") {
            return "";
        }
        var p = String(path || "");
        if (/Json$/i.test(p) || /TrustJson$/i.test(p)) {
            return " adm-code-surface adm-code-surface--json";
        }
        if (/Html$/i.test(p) || /bodyHtml/i.test(p) || /leadHtml/i.test(p)) {
            return " adm-code-surface adm-code-surface--html";
        }
        return "";
    }

    function htmlSyntaxHighlight(raw) {
        var esc = String(raw == null ? "" : raw)
            .replace(/&/g, "&amp;")
            .replace(/\u003c/g, "&lt;")
            .replace(/>/g, "&gt;");
        esc = esc.replace(/&lt;(\/?)([\w:-]+)/g, function (_, slash, tag) {
            return (
                '<span class="adm-html-br">&lt;</span>' +
                (slash ? '<span class="adm-html-sl">/</span>' : "") +
                '<span class="adm-html-tag">' +
                tag +
                "</span>"
            );
        });
        esc = esc.replace(/&gt;/g, '<span class="adm-html-br">&gt;</span>');
        return '<code class="adm-html-editor-highlight-inner">' + esc + "</code>";
    }

    function syncHtmlEditorLayer(wrap) {
        var ta = wrap.querySelector(".adm-html-editor-ta");
        var hl = wrap.querySelector(".adm-html-editor-highlight");
        if (!ta || !hl) {
            return;
        }
        hl.innerHTML = htmlSyntaxHighlight(ta.value) + "\n";
        var inner = hl.querySelector(".adm-html-editor-highlight-inner");
        if (inner) {
            inner.style.transform = "translate(" + -ta.scrollLeft + "px," + -ta.scrollTop + "px)";
        }
    }

    function initHtmlEditorLayers(panel) {
        if (!panel) {
            return;
        }
        panel.querySelectorAll(".adm-html-editor-wrap").forEach(function (wrap) {
            var ta = wrap.querySelector(".adm-html-editor-ta");
            if (!ta || ta.getAttribute("data-html-hl") === "1") {
                return;
            }
            ta.setAttribute("data-html-hl", "1");
            function onScrollOrInput() {
                syncHtmlEditorLayer(wrap);
            }
            ta.addEventListener("input", onScrollOrInput);
            ta.addEventListener("scroll", onScrollOrInput);
            syncHtmlEditorLayer(wrap);
        });
    }

    function field(label, path, type, rows) {
        var v = getPath(gMarketing, path);
        if (v == null) v = "";
        var id = "mk-" + path.replace(/\./g, "-");
        var extra = editorExtraClasses(path, type);
        var r = rows || 3;
        var ta;
        if (type === "textarea") {
            if (extra.indexOf("adm-code-surface--html") !== -1) {
                ta =
                    '<div class="adm-html-editor-wrap adm-json-input adm-code-surface adm-code-surface--html" style="min-height:' +
                    r +
                    'px">' +
                    '<pre class="adm-html-editor-highlight" spellcheck="false" aria-hidden="true"></pre>' +
                    '<textarea class="adm-json-input adm-html-editor-ta" spellcheck="false" style="min-height:' +
                    r +
                    'px;width:100%" id="' +
                    id +
                    '" data-path="' +
                    path +
                    '">' +
                    escapeHtml(String(v)) +
                    "</textarea></div>";
            } else {
                ta =
                    '<textarea class="adm-json-input' +
                    extra +
                    '" style="min-height:' +
                    r +
                    'px;width:100%" id="' +
                    id +
                    '" data-path="' +
                    path +
                    '">' +
                    escapeHtml(String(v)) +
                    "</textarea>";
            }
        } else {
            ta =
                '<input type="text" id="' +
                id +
                '" data-path="' +
                path +
                '" value="' +
                escapeAttr(String(v)) +
                '" style="width:100%;max-width:520px" />';
        }
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

    function truncateLine(s, max) {
        var t = String(s == null ? "" : s)
            .replace(new RegExp("\\s+", "g"), " ")
            .trim();
        if (t.length <= max) {
            return t;
        }
        return t.slice(0, max - 1) + "\u2026";
    }

    function navDraftValues(pageKey) {
        if (navEditIdx != null && gMarketing[pageKey] && gMarketing[pageKey].navLinks && gMarketing[pageKey].navLinks[navEditIdx]) {
            var r = gMarketing[pageKey].navLinks[navEditIdx];
            return { label: r.label || "", href: r.href || "" };
        }
        return { label: "", href: "" };
    }

    function faqDraftValues(pageKey) {
        if (faqEditIdx != null && gMarketing[pageKey] && gMarketing[pageKey].faqItems && gMarketing[pageKey].faqItems[faqEditIdx]) {
            var it = gMarketing[pageKey].faqItems[faqEditIdx];
            return { q: it.question || "", a: it.answerHtml || "" };
        }
        return { q: "", a: "" };
    }

    function renderNavTable(pageKey) {
        var arr = (gMarketing[pageKey] && gMarketing[pageKey].navLinks) || [];
        var draft = navDraftValues(pageKey);
        var rows = arr
            .map(function (row, idx) {
                var hrefEsc = escapeHtml(row.href || "");
                var labelEsc = escapeHtml(row.label || "Untitled");
                return (
                    '<div class="adm-mk-row" data-mk-nav-row="' +
                    pageKey +
                    '" data-i="' +
                    idx +
                    '">' +
                    '<button type="button" class="adm-mk-row__head" data-mk-nav-toggle aria-expanded="false">' +
                    '<span class="adm-mk-row__title">' +
                    labelEsc +
                    '</span><span class="adm-mk-row__hint">' +
                    escapeHtml(truncateLine(row.href || "\u2014", 56)) +
                    '</span><span class="adm-mk-row__chev" aria-hidden="true">\u25bc</span></button>' +
                    '<div class="adm-mk-row__body">' +
                    '<pre class="adm-mk-row__mono" spellcheck="false">' +
                    hrefEsc +
                    "</pre>" +
                    '<div class="adm-mk-row__actions">' +
                    '<button type="button" class="btn ghost btn-sm" data-mk-nav-edit data-i="' +
                    idx +
                    '">Edit</button>' +
                    '<button type="button" class="btn ghost btn-sm" data-mk-nav-del data-i="' +
                    idx +
                    '">Delete</button>' +
                    "</div></div></div>"
                );
            })
            .join("");
        var listHtml = rows || '<p class="adm-mk-empty">No toolbar links yet. Add one in the form above.</p>';
        var commitLabel = navEditIdx == null ? "Add link" : "Update link";
        var cancelHidden = navEditIdx == null ? " hidden" : "";
        return (
            '<div class="adm-mk-collection adm-subcard adm-mk-manager adm-mk-manager--nav" data-mk-page="' +
            pageKey +
            '" style="margin-top:14px">' +
            '<div class="adm-mk-collection__head">' +
            "<h4>Toolbar link manager</h4>" +
            '<p class="helper adm-mk-collection__lede">Compose a label and URL, then add to the list. Click a row to expand the full URL. Edit loads the row into the form; nothing is stored in D1 until you press <b>Save</b>.</p></div>' +
            '<div class="adm-mk-form adm-subcard">' +
            '<div class="adm-field adm-field--compact"><label for="mk-nav-draft-label">Label</label><input type="text" id="mk-nav-draft-label" placeholder="e.g. Pricing" value="' +
            escapeAttr(draft.label) +
            '" autocomplete="off" /></div>' +
            '<div class="adm-field adm-field--compact"><label for="mk-nav-draft-href">URL</label><input type="text" id="mk-nav-draft-href" placeholder="https://\u2026 or /path" value="' +
            escapeAttr(draft.href) +
            '" autocomplete="off" /></div>' +
            '<div class="adm-mk-form__actions">' +
            '<button type="button" class="btn btn-sm" data-mk-nav-commit>' +
            commitLabel +
            "</button>" +
            '<button type="button" class="btn ghost btn-sm" data-mk-nav-cancel' +
            cancelHidden +
            ">Cancel</button></div></div>" +
            '<div class="adm-mk-list">' +
            listHtml +
            "</div></div>"
        );
    }

    function renderFaqEditor(pageKey) {
        var arr = (gMarketing[pageKey] && gMarketing[pageKey].faqItems) || [];
        var draft = faqDraftValues(pageKey);
        var rows = arr
            .map(function (it, idx) {
                var qEsc = escapeHtml(it.question || "");
                var qHead = qEsc || escapeHtml("(No question)");
                var prev = truncateLine(
                    String(it.answerHtml || "")
                        .replace(new RegExp("\\s+", "g"), " ")
                        .trim(),
                    140
                );
                return (
                    '<div class="adm-mk-row" data-mk-faq-row="' +
                    pageKey +
                    '" data-i="' +
                    idx +
                    '">' +
                    '<button type="button" class="adm-mk-row__head" data-mk-faq-toggle aria-expanded="false">' +
                    '<span class="adm-mk-row__title">' +
                    qHead +
                    '</span><span class="adm-mk-row__chev" aria-hidden="true">\u25bc</span></button>' +
                    '<div class="adm-mk-row__body">' +
                    '<p class="helper adm-mk-row__peek">' +
                    escapeHtml(prev) +
                    "</p>" +
                    '<pre class="adm-mk-row__mono adm-mk-row__mono--html" spellcheck="false">' +
                    escapeHtml(it.answerHtml || "") +
                    "</pre>" +
                    '<div class="adm-mk-row__actions">' +
                    '<button type="button" class="btn ghost btn-sm" data-mk-faq-edit data-i="' +
                    idx +
                    '">Edit</button>' +
                    '<button type="button" class="btn ghost btn-sm" data-mk-faq-del data-i="' +
                    idx +
                    '">Delete</button>' +
                    "</div></div></div>"
                );
            })
            .join("");
        var listHtml = rows || '<p class="adm-mk-empty">No FAQ items yet. Add one in the form above.</p>';
        var commitLabel = faqEditIdx == null ? "Add FAQ" : "Update FAQ";
        var cancelHidden = faqEditIdx == null ? " hidden" : "";
        return (
            '<div class="adm-mk-collection adm-subcard adm-mk-manager adm-mk-manager--faq" data-mk-page="' +
            pageKey +
            '" style="margin-top:16px">' +
            '<div class="adm-mk-collection__head">' +
            "<h4>FAQ manager</h4>" +
            '<p class="helper adm-mk-collection__lede">Enter a question and HTML answer, then add to the list. Click the question to expand the full answer. Edit loads into the form; <b>Save</b> writes marketing to the server.</p></div>' +
            '<div class="adm-mk-form adm-subcard">' +
            '<div class="adm-field adm-field--compact"><label for="mk-faq-draft-q">Question</label><input type="text" id="mk-faq-draft-q" placeholder="Enter question\u2026" value="' +
            escapeAttr(draft.q) +
            '" autocomplete="off" /></div>' +
            '<div class="adm-field adm-field--compact"><label for="mk-faq-draft-html">Answer (HTML)</label><div class="adm-html-editor-wrap adm-json-input adm-code-surface adm-code-surface--html" style="min-height:100px">' +
            '<pre class="adm-html-editor-highlight" spellcheck="false" aria-hidden="true"></pre>' +
            '<textarea class="adm-json-input adm-html-editor-ta" id="mk-faq-draft-html" spellcheck="false" style="min-height:100px;width:100%">' +
            escapeHtml(draft.a) +
            "</textarea></div></div>" +
            '<div class="adm-mk-form__actions">' +
            '<button type="button" class="btn btn-sm" data-mk-faq-commit>' +
            commitLabel +
            "</button>" +
            '<button type="button" class="btn ghost btn-sm" data-mk-faq-cancel' +
            cancelHidden +
            ">Cancel</button></div></div>" +
            '<div class="adm-mk-list">' +
            listHtml +
            "</div></div>"
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

    function positionMkSegThumb() {
        var root = document.getElementById("adm-site-marketing-host");
        if (!root) {
            return;
        }
        var track = root.querySelector("[data-mk-site-seg]");
        var thumb = track && track.querySelector("[data-adm-seg-thumb]");
        var active = root.querySelector("[data-mk-tab].active");
        if (!track || !thumb || !active) {
            return;
        }
        var tr = track.getBoundingClientRect();
        var br = active.getBoundingClientRect();
        if (br.width < 8) {
            return;
        }
        thumb.style.width = br.width + "px";
        thumb.style.transform = "translateX(" + (br.left - tr.left) + "px)";
    }

    function syncMkTabActive() {
        var root = document.getElementById("adm-site-marketing-host");
        if (!root) return;
        root.querySelectorAll("[data-mk-tab]").forEach(function (b) {
            var tab = b.getAttribute("data-mk-tab");
            b.classList.toggle("active", tab === currentTab);
        });
        requestAnimationFrame(function () {
            positionMkSegThumb();
            requestAnimationFrame(positionMkSegThumb);
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

    function onMkMarketingManagerClick(ev) {
        var t = ev.target;
        if (!t || typeof t.closest !== "function") return;
        var mgr = t.closest(".adm-mk-manager");
        if (!mgr || !gMarketing) return;
        var pageKey = mgr.getAttribute("data-mk-page");
        if (!pageKey) return;
        var row = t.closest(".adm-mk-row");

        if (t.closest("[data-mk-nav-toggle]")) {
            ev.preventDefault();
            if (row && row.getAttribute("data-mk-nav-row") === pageKey) {
                row.classList.toggle("open");
            }
            return;
        }
        if (t.closest("[data-mk-faq-toggle]")) {
            ev.preventDefault();
            if (row && row.getAttribute("data-mk-faq-row") === pageKey) {
                row.classList.toggle("open");
            }
            return;
        }

        var editNav = t.closest("[data-mk-nav-edit]");
        if (editNav) {
            ev.preventDefault();
            navEditIdx = parseInt(editNav.getAttribute("data-i"), 10);
            faqEditIdx = null;
            renderTab();
            return;
        }
        var delNav = t.closest("[data-mk-nav-del]");
        if (delNav) {
            ev.preventDefault();
            if (!window.confirm("Remove this toolbar link?")) return;
            var ni = parseInt(delNav.getAttribute("data-i"), 10);
            if (gMarketing[pageKey] && gMarketing[pageKey].navLinks) {
                gMarketing[pageKey].navLinks.splice(ni, 1);
            }
            if (navEditIdx === ni) navEditIdx = null;
            else if (navEditIdx != null && navEditIdx > ni) navEditIdx -= 1;
            syncSpecialFieldsFromModel();
            renderTab();
            return;
        }
        if (t.closest("[data-mk-nav-commit]")) {
            ev.preventDefault();
            var labEl = document.getElementById("mk-nav-draft-label");
            var hrefEl = document.getElementById("mk-nav-draft-href");
            var lab = labEl ? String(labEl.value).trim() : "";
            var href = hrefEl ? String(hrefEl.value).trim() : "";
            if (!lab || !href) {
                window.alert("Enter both label and URL.");
                return;
            }
            if (!gMarketing[pageKey]) gMarketing[pageKey] = {};
            if (!Array.isArray(gMarketing[pageKey].navLinks)) gMarketing[pageKey].navLinks = [];
            if (navEditIdx == null) {
                gMarketing[pageKey].navLinks.push({ label: lab, href: href });
            } else if (gMarketing[pageKey].navLinks[navEditIdx]) {
                gMarketing[pageKey].navLinks[navEditIdx].label = lab;
                gMarketing[pageKey].navLinks[navEditIdx].href = href;
            }
            navEditIdx = null;
            syncSpecialFieldsFromModel();
            renderTab();
            return;
        }
        if (t.closest("[data-mk-nav-cancel]")) {
            ev.preventDefault();
            navEditIdx = null;
            renderTab();
            return;
        }

        var editFaq = t.closest("[data-mk-faq-edit]");
        if (editFaq) {
            ev.preventDefault();
            faqEditIdx = parseInt(editFaq.getAttribute("data-i"), 10);
            navEditIdx = null;
            renderTab();
            return;
        }
        var delFaq = t.closest("[data-mk-faq-del]");
        if (delFaq) {
            ev.preventDefault();
            if (!window.confirm("Remove this FAQ?")) return;
            var fi = parseInt(delFaq.getAttribute("data-i"), 10);
            if (gMarketing[pageKey] && gMarketing[pageKey].faqItems) {
                gMarketing[pageKey].faqItems.splice(fi, 1);
            }
            if (faqEditIdx === fi) faqEditIdx = null;
            else if (faqEditIdx != null && faqEditIdx > fi) faqEditIdx -= 1;
            syncSpecialFieldsFromModel();
            renderTab();
            return;
        }
        if (t.closest("[data-mk-faq-commit]")) {
            ev.preventDefault();
            var qEl = document.getElementById("mk-faq-draft-q");
            var aEl = document.getElementById("mk-faq-draft-html");
            var q = qEl ? String(qEl.value).trim() : "";
            var a = aEl ? String(aEl.value).trim() : "";
            if (!q || !a) {
                window.alert("Enter both question and HTML answer.");
                return;
            }
            if (!gMarketing[pageKey]) gMarketing[pageKey] = {};
            if (!Array.isArray(gMarketing[pageKey].faqItems)) gMarketing[pageKey].faqItems = [];
            if (faqEditIdx == null) {
                gMarketing[pageKey].faqItems.push({ question: q, answerHtml: a });
            } else if (gMarketing[pageKey].faqItems[faqEditIdx]) {
                gMarketing[pageKey].faqItems[faqEditIdx].question = q;
                gMarketing[pageKey].faqItems[faqEditIdx].answerHtml = a;
            }
            faqEditIdx = null;
            syncSpecialFieldsFromModel();
            renderTab();
            return;
        }
        if (t.closest("[data-mk-faq-cancel]")) {
            ev.preventDefault();
            faqEditIdx = null;
            renderTab();
            return;
        }
    }

    function ensureMkMarketingManagerDelegation() {
        var panel = document.getElementById("adm-site-marketing-panel");
        if (!panel || panel.getAttribute("data-mk-mgr-delegation") === "1") return;
        panel.setAttribute("data-mk-mgr-delegation", "1");
        panel.addEventListener("click", onMkMarketingManagerClick);
    }

    function bindPanelInputs() {
        var panel = document.getElementById("adm-site-marketing-panel");
        if (!panel) return;
        ensureMkMarketingManagerDelegation();
        panel.querySelectorAll("[data-path]").forEach(function (el) {
            el.addEventListener("input", function () {
                var path = el.getAttribute("data-path");
                setPath(gMarketing, path, el.value);
            });
        });
        initHtmlEditorLayers(panel);
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
            '<div class="adm-site-tabs-rail adm-site-tabs-rail--sticky adm-site-tabs-rail--mk">' +
            '<div class="adm-site-seg adm-seg adm-site-mk-seg" data-mk-site-seg role="tablist" aria-label="Marketing page">' +
            '<span class="adm-site-seg__thumb" data-adm-seg-thumb aria-hidden="true"></span>' +
            '<button type="button" class="adm-site-seg__btn active" data-mk-tab="index">' +
            "<span>Index</span></button>" +
            '<button type="button" class="adm-site-seg__btn" data-mk-tab="premium">' +
            "<span>Premium</span></button>" +
            '<button type="button" class="adm-site-seg__btn" data-mk-tab="contentPage">' +
            "<span>Content</span></button>" +
            "</div></div>" +
            '<details class="adm-site-tab__details">' +
            '<summary class="adm-site-tab__summary">Editing tips</summary>' +
            '<p class="helper adm-site-tab__help">Use <b>Toolbar link manager</b> and <b>FAQ manager</b> (form + expandable list) for repeating items. Other fields edit in place. <b>Save</b> writes the full document to D1. <b>Clear key</b> removes custom marketing (confirm).</p>' +
            "</details>" +
            '<div id="adm-site-marketing-panel" class="adm-site-marketing-panel"></div>' +
            '<div class="adm-site-actions-row">' +
            '<button type="button" class="btn btn-sm" id="adm-site-marketing-save" title="Save marketing to app_kv">' +
            "<span>Save</span></button>" +
            '<button type="button" class="btn ghost btn-sm" id="adm-site-marketing-reset" title="Delete marketing key from D1">' +
            "<span>Clear key</span></button>" +
            "</div>" +
            '<p id="adm-site-marketing-msg" class="status adm-site-tab__status" aria-live="polite"></p>' +
            "</div>";

        var mkResizeT = null;
        if (root.getAttribute("data-mk-resize") !== "1") {
            root.setAttribute("data-mk-resize", "1");
            window.addEventListener("resize", function () {
                if (mkResizeT) window.clearTimeout(mkResizeT);
                mkResizeT = window.setTimeout(positionMkSegThumb, 90);
            });
        }

        root.querySelectorAll("[data-mk-tab]").forEach(function (b) {
            b.addEventListener("click", function () {
                currentTab = b.getAttribute("data-mk-tab") || "index";
                faqEditIdx = null;
                navEditIdx = null;
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
