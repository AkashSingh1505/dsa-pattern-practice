/**
 * Applies GET /api/site-marketing payload to the current page.
 * Page key: <html data-site-mk-page="index|premium|content">
 */
(function () {
    var page = document.documentElement.getAttribute("data-site-mk-page") || "";

    function esc(s) {
        return String(s == null ? "" : s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function setNavLinks(container, links) {
        if (!container || !Array.isArray(links)) return;
        container.textContent = "";
        links.forEach(function (l) {
            var a = document.createElement("a");
            a.href = l.href != null ? String(l.href) : "#";
            a.textContent = l.label != null ? String(l.label) : "";
            container.appendChild(a);
        });
    }

    function setButtonLabelKeepSvg(btn, label) {
        if (!btn) return;
        var svg = btn.querySelector("svg");
        var t = String(label != null ? label : "").trim();
        btn.textContent = "";
        if (t) btn.appendChild(document.createTextNode(t));
        if (svg) btn.appendChild(svg);
    }

    function renderFaqList(container, items) {
        if (!container || !Array.isArray(items)) return;
        container.textContent = "";
        items.forEach(function (it) {
            var d = document.createElement("details");
            d.className = "faq-item";
            var s = document.createElement("summary");
            s.textContent = it.question != null ? String(it.question) : "";
            var panel = document.createElement("div");
            panel.className = "faq-panel";
            panel.innerHTML = it.answerHtml != null ? String(it.answerHtml) : "";
            d.appendChild(s);
            d.appendChild(panel);
            container.appendChild(d);
        });
    }

    function renderFooterColumns(footer, footerData) {
        if (!footer || !footerData || !Array.isArray(footerData.columns)) return;
        var grid = footer.querySelector(".foot-grid");
        if (!grid) return;
        var divs = grid.querySelectorAll(":scope > div");
        if (divs.length < 4) return;
        for (var c = 0; c < 3; c++) {
            var col = footerData.columns[c];
            var el = divs[c + 1];
            if (!el || !col) continue;
            var title = col.title != null ? String(col.title) : "";
            var links = Array.isArray(col.links) ? col.links : [];
            var parts = ["<h6>", esc(title), "</h6>"];
            links.forEach(function (ln) {
                parts.push(
                    '<a href="',
                    esc(ln.href != null ? ln.href : "#"),
                    '">',
                    esc(ln.label != null ? ln.label : ""),
                    "</a>",
                );
            });
            el.innerHTML = parts.join("");
        }
        var tag = grid.querySelector("#smk-footer-tagline");
        if (tag && footerData.tagline != null) {
            tag.textContent = String(footerData.tagline);
        }
        var bottom = footer.querySelector(".foot-bottom");
        if (bottom && footerData.bottomLeft != null) {
            var bdivs = bottom.querySelectorAll(":scope > div");
            if (bdivs[0]) bdivs[0].textContent = String(footerData.bottomLeft);
            if (bdivs[1] && footerData.bottomRight != null) bdivs[1].textContent = String(footerData.bottomRight);
        }
    }

    function applyBrandToolbarNav(pack) {
        if (!pack) return;
        var nav = document.querySelector("nav.dsa-site-nav");
        if (!nav) return;
        var bTitle = nav.querySelector("#smk-brand-title");
        var bSub = nav.querySelector("#smk-brand-sub");
        if (pack.brand) {
            if (bTitle && pack.brand.title != null) bTitle.textContent = String(pack.brand.title);
            if (bSub && pack.brand.subtitle != null) bSub.textContent = String(pack.brand.subtitle);
        }
        var navLinks = nav.querySelector("#smk-nav-links");
        if (navLinks && pack.navLinks) setNavLinks(navLinks, pack.navLinks);
        var tb = pack.toolbar || {};
        var signIn = nav.querySelector("#smk-toolbar-signin");
        if (signIn) {
            if (tb.signInHref != null) signIn.setAttribute("href", String(tb.signInHref));
            if (tb.signInLabel != null) signIn.textContent = String(tb.signInLabel);
        }
        var prem = nav.querySelector("#smk-toolbar-premium");
        var premLbl = nav.querySelector("#smk-toolbar-premium-label");
        if (prem && tb.premiumHref != null) prem.setAttribute("href", String(tb.premiumHref));
        if (premLbl && tb.premiumLabel != null) premLbl.textContent = String(tb.premiumLabel);
    }

    function applyIndex(m) {
        var pack = m.index;
        if (!pack) return;
        if (pack.documentTitle) document.title = String(pack.documentTitle);
        applyBrandToolbarNav(pack);
        var heroEyebrow = document.getElementById("smk-hero-eyebrow");
        if (heroEyebrow && pack.hero && pack.hero.eyebrowHtml != null) heroEyebrow.innerHTML = String(pack.hero.eyebrowHtml);
        var heroTitle = document.getElementById("smk-hero-title");
        if (heroTitle && pack.hero && pack.hero.titleHtml != null) heroTitle.innerHTML = String(pack.hero.titleHtml);
        var heroLead = document.getElementById("smk-hero-lead");
        if (heroLead && pack.hero && pack.hero.leadHtml != null) heroLead.innerHTML = String(pack.hero.leadHtml);
        var hp = document.getElementById("smk-hero-cta-primary");
        var hs = document.getElementById("smk-hero-cta-secondary");
        if (pack.hero) {
            if (hp && pack.hero.ctaPrimary != null) setButtonLabelKeepSvg(hp, pack.hero.ctaPrimary);
            if (hs && pack.hero.ctaSecondary != null) setButtonLabelKeepSvg(hs, pack.hero.ctaSecondary);
        }
        var trs = document.querySelectorAll("#smk-hero-trust .tr");
        if (pack.hero && Array.isArray(pack.hero.trust) && trs.length) {
            pack.hero.trust.forEach(function (row, i) {
                if (!trs[i] || !row) return;
                var num = trs[i].querySelector(".num");
                var lab = trs[i].querySelector(".lab");
                if (num && row.num != null) num.textContent = String(row.num);
                if (lab && row.lab != null) lab.textContent = String(row.lab);
            });
        }
        var st = document.getElementById("smk-studio-sec-tag");
        var sti = document.getElementById("smk-studio-sec-title");
        var sts = document.getElementById("smk-studio-sec-sub");
        if (pack.studioSection) {
            if (st && pack.studioSection.tag != null) st.textContent = String(pack.studioSection.tag);
            if (sti && pack.studioSection.titleHtml != null) sti.innerHTML = String(pack.studioSection.titleHtml);
            if (sts && pack.studioSection.subHtml != null) sts.innerHTML = String(pack.studioSection.subHtml);
        }
        var ft = document.getElementById("smk-final-title");
        var fl = document.getElementById("smk-final-lead");
        if (pack.finalCta) {
            if (ft && pack.finalCta.titleHtml != null) ft.innerHTML = String(pack.finalCta.titleHtml);
            if (fl && pack.finalCta.lead != null) fl.textContent = String(pack.finalCta.lead);
        }
        var ftrust = document.getElementById("smk-final-trust");
        if (ftrust && pack.finalCta && Array.isArray(pack.finalCta.trustLines)) {
            ftrust.textContent = "";
            pack.finalCta.trustLines.forEach(function (line) {
                var sp = document.createElement("span");
                sp.textContent = String(line != null ? line : "");
                ftrust.appendChild(sp);
            });
        }
        var fp = document.getElementById("smk-final-cta-primary");
        var fs = document.getElementById("smk-final-cta-secondary");
        if (pack.finalCta) {
            if (fp && pack.finalCta.primaryLabel != null) setButtonLabelKeepSvg(fp, pack.finalCta.primaryLabel);
            if (fs && pack.finalCta.secondaryLabel != null) setButtonLabelKeepSvg(fs, pack.finalCta.secondaryLabel);
        }
        var footer = document.querySelector('footer[data-smk-footer="index"]');
        if (footer && pack.footer) renderFooterColumns(footer, pack.footer);
    }

    function applyPremium(m) {
        var pack = m.premium;
        if (!pack) return;
        if (pack.documentTitle) document.title = String(pack.documentTitle);
        applyBrandToolbarNav(pack);
        var fqTag = document.getElementById("smk-premium-faq-tag");
        var fqTitle = document.getElementById("faq-heading");
        var fqSub = document.getElementById("smk-premium-faq-sub");
        if (pack.faqSection) {
            if (fqTag && pack.faqSection.tag != null) fqTag.textContent = String(pack.faqSection.tag);
            if (fqTitle && pack.faqSection.titleHtml != null) fqTitle.innerHTML = String(pack.faqSection.titleHtml);
            if (fqSub && pack.faqSection.subHtml != null) fqSub.innerHTML = String(pack.faqSection.subHtml);
        }
        var faqList = document.getElementById("smk-premium-faq-list");
        if (faqList && pack.faqItems) renderFaqList(faqList, pack.faqItems);
        var finH = document.getElementById("smk-premium-final-title");
        var finP = document.getElementById("smk-premium-final-lead");
        if (pack.finalCta) {
            if (finH && pack.finalCta.titleHtml != null) finH.innerHTML = String(pack.finalCta.titleHtml);
            if (finP && pack.finalCta.leadHtml != null) finP.innerHTML = String(pack.finalCta.leadHtml);
        }
        var footer = document.querySelector('footer[data-smk-footer="premium"]');
        if (footer && pack.footer) renderFooterColumns(footer, pack.footer);
    }

    function applyContent(m) {
        var pack = m.contentPage;
        if (!pack) return;
        if (pack.documentTitle) document.title = String(pack.documentTitle);
        applyBrandToolbarNav(pack);
        var ht = document.getElementById("smk-content-hero-title");
        var hs = document.getElementById("smk-content-hero-sub");
        if (ht && pack.heroTitle != null) ht.textContent = String(pack.heroTitle);
        if (hs && pack.heroSubtitleHtml != null) hs.innerHTML = String(pack.heroSubtitleHtml);
        var body = document.getElementById("smk-content-body");
        if (body && pack.bodyHtml != null) body.innerHTML = String(pack.bodyHtml);
        var fqTag = document.getElementById("smk-content-faq-tag");
        var fqTitle = document.getElementById("smk-content-faq-h");
        var fqSub = document.getElementById("smk-content-faq-sub");
        if (pack.faqSection) {
            if (fqTag && pack.faqSection.tag != null) fqTag.textContent = String(pack.faqSection.tag);
            if (fqTitle && pack.faqSection.titleHtml != null) fqTitle.innerHTML = String(pack.faqSection.titleHtml);
            if (fqSub && pack.faqSection.subHtml != null) fqSub.innerHTML = String(pack.faqSection.subHtml);
        }
        var faqList = document.getElementById("smk-content-faq-list");
        if (faqList && pack.faqItems) renderFaqList(faqList, pack.faqItems);
        var footer = document.querySelector('footer[data-smk-footer="content"]');
        if (footer && pack.footer) renderFooterColumns(footer, pack.footer);
    }

    function run() {
        if (!page || (page !== "index" && page !== "premium" && page !== "content")) return;
        var url = new URL("api/site-marketing", document.baseURI).href;
        fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" })
            .then(function (r) {
                if (!r.ok) throw new Error("site-marketing " + r.status);
                return r.json();
            })
            .then(function (j) {
                var m = j && j.marketing;
                if (!m) return;
                if (page === "index") applyIndex(m);
                else if (page === "premium") applyPremium(m);
                else applyContent(m);
                try {
                    document.dispatchEvent(new CustomEvent("dsa-site-marketing-ready", { detail: { page: page } }));
                } catch (e) {}
            })
            .catch(function () {
                /* keep static HTML */
            });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run);
    } else {
        run();
    }
})();
