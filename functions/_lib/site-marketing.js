/**
 * Public marketing copy for index / premium / content.html.
 * Stored in content D1 `app_kv` under SITE_MARKETING_KV_KEY (JSON string).
 * @see GET /api/site-marketing
 */

export const SITE_MARKETING_KV_KEY = "site_marketing_v1";

export function getDefaultSiteMarketing() {
    return {
        version: 1,
        index: defaultIndex(),
        premium: defaultPremium(),
        contentPage: defaultContentPage(),
    };
}

function defaultIndex() {
    return {
        documentTitle: "DSA Pattern Practice Studio — Learn DSA as a Connected System",
        brand: { title: "DSA Pattern Practice", subtitle: "Visual study studio" },
        navLinks: [
            { label: "Studio", href: "#studio" },
            { label: "Why it works", href: "#why" },
            { label: "Live graph", href: "#preview" },
        ],
        toolbar: {
            signInLabel: "Sign in",
            signInHref: "./account.html",
            premiumLabel: "Premium",
            premiumHref: "./premium.html",
        },
        hero: {
            eyebrowHtml: '<span class="dot"></span> Pattern-first DSA learning studio',
            titleHtml: "Learn DSA as a <em>connected map</em>, not a random problem list.",
            leadHtml:
                "A visual studio where every data structure, algorithm and interview pattern is connected on one graph — so you understand <strong>why a solution works</strong> and where to use it again.",
            ctaPrimary: "Start learning free",
            ctaSecondary: "Compare plans",
            trust: [
                { num: "2,400+", lab: "Active learners" },
                { num: "180+", lab: "Pattern nodes" },
                { num: "12k+", lab: "Connections mapped" },
            ],
        },
        studioSection: {
            tag: "// what the studio gives you",
            titleHtml: "Everything important <em>stays in one visual flow.</em>",
            subHtml:
                "Not another problem list. This is a studio — discovery, focus, practice and tracking woven into a single map you can actually understand.",
        },
        finalCta: {
            titleHtml: "Stop solving problems. <em>Start understanding patterns.</em>",
            lead: "Join thousands of learners turning scattered DSA practice into a connected, confident system.",
            primaryLabel: "Start learning free",
            secondaryLabel: "Explore the live map",
            trustLines: ["No credit card required", "Free forever plan", "Cancel anytime"],
        },
        footer: defaultFooterIndex(),
    };
}

function defaultFooterIndex() {
    return {
        tagline:
            "A visual study studio where every data structure, algorithm and interview pattern lives on one connected map.",
        columns: [
            {
                title: "Studio",
                links: [
                    { label: "Full map", href: "#" },
                    { label: "One-topic mode", href: "#" },
                    { label: "Graph library", href: "#" },
                    { label: "Dashboard", href: "#" },
                    { label: "Reminders", href: "#" },
                ],
            },
            {
                title: "Learn",
                links: [
                    { label: "Arrays & strings", href: "#" },
                    { label: "Trees & graphs", href: "#" },
                    { label: "Dynamic prog.", href: "#" },
                    { label: "Interview tracks", href: "#" },
                    { label: "Pattern guide", href: "#" },
                ],
            },
            {
                title: "Company",
                links: [
                    { label: "About", href: "./content.html" },
                    { label: "Pricing", href: "./premium.html" },
                    { label: "Changelog", href: "#" },
                    { label: "Contact", href: "./account.html" },
                    { label: "Privacy", href: "#" },
                ],
            },
        ],
        bottomLeft: "© 2026 DSA Pattern Practice Studio. Built for learners who think in patterns.",
        bottomRight: "Made with care · v2.4",
    };
}

function defaultPremium() {
    return {
        documentTitle: "Premium plans — DSA Pattern Practice",
        brand: { title: "DSA Pattern Practice", subtitle: "Visual study studio" },
        navLinks: [
            { label: "Studio", href: "./index.html#studio" },
            { label: "Why it works", href: "./index.html#why" },
            { label: "Live graph", href: "./index.html#preview" },
        ],
        toolbar: {
            signInLabel: "Sign in",
            signInHref: "./account.html",
            premiumLabel: "Premium",
            premiumHref: "./premium.html",
        },
        faqSection: {
            tag: "// frequently asked",
            titleHtml: "Questions <em>answered</em>",
            subHtml:
                'Tap a question to expand the answer. The full comparison table is <a href="#compare" style="color:var(--c-accent);font-weight:600">above</a> — these entries go deeper on common questions.',
        },
        faqItems: defaultPremiumFaqItems(),
        finalCta: {
            titleHtml: "Try the studio now, <em>upgrade when you need more.</em>",
            leadHtml:
                'Open the public graph, create your account, and move into the tier that matches how you study. Questions? See the <a href="#faq" style="color:var(--c-accent);font-weight:600">FAQ</a> on this page.',
        },
        footer: defaultFooterPremium(),
    };
}

function defaultPremiumFaqItems() {
    return [
        {
            question: "What is included in the Free plan?",
            answerHtml:
                "<p>Free is for exploring the studio before you pay.</p><ul><li>Full DSA map and one-topic browsing</li><li>Practice account and core member dashboard (as enabled by site settings)</li><li>Public graph library and community browsing</li><li>Basic study flow on the shared graph</li></ul><p>Personal graph workflows, advanced focus, and premium study tools require Pro or Lifetime.</p>",
        },
        {
            question: "What does Pro add on top of Free?",
            answerHtml:
                "<p>Pro unlocks the full premium workflow for individual learners:</p><ul><li>Unlimited personal graphs and saved workflows</li><li>Advanced focus mode and personal pattern collections</li><li>Smart spaced revision and reminders</li><li>Quiz history, analytics, export and share for graphs</li><li>Priority support</li></ul><p>Billing is <strong>$9/month</strong>, cancel anytime.</p>",
        },
        {
            question: "How does Lifetime work?",
            answerHtml:
                "<p>Lifetime matches the <strong>same feature surface as Pro</strong> but is positioned as a one-time purchase for learners who want the studio as a long-lived resource (multi-year self-paced depth, stable access beyond short interview cycles).</p><p>Exact pricing and checkout are handled in your account flow — use “Ask about Lifetime” on the plan card to start from account.</p>",
        },
        {
            question: "Where is the full feature comparison table?",
            answerHtml:
                '<p>The same comparison you see in marketing lives in the <strong>Feature comparison</strong> section on this page. Jump to <a href="#compare" style="color:var(--c-accent);font-weight:600">#compare</a> or scroll up to the table titled “What changes between tiers.”</p>',
        },
        {
            question: "What does “the full studio” mean?",
            answerHtml:
                "<p>It is the Pro experience: go beyond one-off practice with unlimited personal graphs, advanced focus mode, spaced revision, quiz history and analytics, exports, and priority support — built for learners who are serious about interviews.</p><p><strong>Pro snapshot ($9/mo):</strong> personal graphs unlimited, pattern library 180+ nodes, focus mode advanced, revision reminders smart, analytics included, community graphs full access.</p>",
        },
        {
            question: "How active is the community?",
            answerHtml:
                '<p>Live counts from the product (when available):</p><div class="faq-proof-grid"><article class="proof-card"><strong data-public-stat="subscribers">—</strong><span>Subscribers using the studio</span></article><article class="proof-card"><strong data-plan-count="pro">—</strong><span>Pro plans in the member base</span></article><article class="proof-card"><strong data-plan-count="lifetime">—</strong><span>Lifetime members in the mix</span></article></div>',
        },
        {
            question: "Can I cancel Pro anytime?",
            answerHtml:
                "<p>Yes. Pro is billed monthly and you can cancel when you like; you keep access through the end of the paid period per whatever terms your checkout provider shows at purchase.</p>",
        },
        {
            question: "Is there a Team plan?",
            answerHtml:
                "<p>No. Tiers are <strong>Free</strong>, <strong>Pro</strong>, and <strong>Lifetime</strong> only — every workflow is designed around individual learners and your own graph workspace.</p>",
        },
    ];
}

function defaultFooterPremium() {
    return {
        tagline:
            "A visual study studio where every data structure, algorithm and interview pattern lives on one connected map.",
        columns: [
            {
                title: "Studio",
                links: [
                    { label: "Product tour", href: "./index.html#studio" },
                    { label: "Live graph preview", href: "./index.html#preview" },
                    { label: "Pricing", href: "./premium.html" },
                ],
            },
            {
                title: "Account",
                links: [
                    { label: "Sign in", href: "./account.html" },
                    { label: "Member area", href: "./user-dashboard.html" },
                ],
            },
            {
                title: "Company",
                links: [
                    { label: "Home", href: "./index.html" },
                    { label: "Content & policies", href: "./content.html" },
                    { label: "Contact via account", href: "./account.html" },
                ],
            },
        ],
        bottomLeft: "© 2026 DSA Pattern Practice",
        bottomRight: "Pricing · Free / Pro / Lifetime",
    };
}

function defaultContentPage() {
    return {
        documentTitle: "Site content — DSA Pattern Practice",
        brand: { title: "DSA Pattern Practice", subtitle: "Visual study studio" },
        navLinks: [
            { label: "Studio", href: "./index.html#studio" },
            { label: "Why it works", href: "./index.html#why" },
            { label: "Live graph", href: "./index.html#preview" },
        ],
        toolbar: {
            signInLabel: "Sign in",
            signInHref: "./account.html",
            premiumLabel: "Premium",
            premiumHref: "./premium.html",
        },
        heroTitle: "Content & policies",
        heroSubtitleHtml: "Edit this page from <strong>Site admin → Site → Marketing pages</strong>.",
        bodyHtml:
            "<p>This page is optional public copy — terms, privacy, about the studio, or announcements. Replace this block in the admin marketing editor (<code>contentPage.bodyHtml</code>).</p><p>Links in the toolbar and footer are driven from the same JSON as the home and premium pages.</p>",
        faqSection: {
            tag: "// frequently asked",
            titleHtml: "Common <em>questions</em>",
            subHtml: "Add or remove FAQ rows in the admin panel.",
        },
        faqItems: [
            {
                question: "How do I edit this page?",
                answerHtml:
                    "<p>Open <strong>Site admin</strong>, go to <strong>Site</strong>, scroll to <strong>Marketing pages (index, premium, content)</strong>, choose the <strong>Content</strong> tab, then <strong>Save to server</strong>.</p>",
            },
        ],
        footer: defaultFooterPremium(),
    };
}

/**
 * Deep-merge patch into base. Nested objects merge; arrays and scalars replace.
 */
export function mergeSiteMarketingPatch(base, patch) {
    if (patch == null || typeof patch !== "object") {
        return base;
    }
    const out = JSON.parse(JSON.stringify(base));
    mergeInto(out, patch);
    return out;
}

function mergeInto(target, patch) {
    if (patch == null || typeof patch !== "object" || Array.isArray(patch)) {
        return;
    }
    for (const k of Object.keys(patch)) {
        const pv = patch[k];
        if (pv === undefined) continue;
        if (Array.isArray(pv)) {
            target[k] = pv;
        } else if (pv !== null && typeof pv === "object") {
            if (target[k] == null || typeof target[k] !== "object" || Array.isArray(target[k])) {
                target[k] = {};
            }
            mergeInto(target[k], pv);
        } else {
            target[k] = pv;
        }
    }
}

export function parseSiteMarketingFromKv(raw) {
    if (raw == null || String(raw).trim() === "") {
        return null;
    }
    try {
        return JSON.parse(String(raw));
    } catch {
        return null;
    }
}

export function buildMergedSiteMarketing(rawKv) {
    const defaults = getDefaultSiteMarketing();
    const parsed = parseSiteMarketingFromKv(rawKv);
    if (!parsed) return defaults;
    return mergeSiteMarketingPatch(defaults, parsed);
}
