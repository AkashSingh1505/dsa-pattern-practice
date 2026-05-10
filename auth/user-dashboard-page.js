/**
 * Member dashboard: full-screen panels, localStorage-backed features, paid gates.
 */
(function () {
    var LS_KEY = "dsaDashV1";

    var STUDY_PATHS = [
        {
            id: "p30",
            title: "30-day pattern sprint",
            blurb: "High-frequency interview patterns in four weeks.",
            steps: ["Arrays & two pointers", "Sliding window", "Binary search variants", "Linked list tricks", "Trees BFS/DFS", "Heaps & greedy", "Graphs & BFS/DFS", "DP intro", "Bit tricks", "Mixed review"],
        },
        {
            id: "uni",
            title: "Semester fundamentals",
            blurb: "Aligns with typical DS&A coursework.",
            steps: ["Big-O intuition", "Lists, stacks, queues", "Trees & traversals", "Hashing", "Sorting", "BST & heaps", "Graph representations", "Shortest paths intro"],
        },
        {
            id: "faang",
            title: "Interview compression",
            blurb: "Short burst before onsite / phone screens.",
            steps: ["Pattern map pass", "Blind 75-style set", "System of reviews", "Timed mixed quiz", "Weak-topic redo"],
        },
    ];

    var QUIZ = {
        pattern: [
            {
                q: "You must find a target in a sorted array that was rotated at an unknown pivot. Which pattern is the primary fit?",
                opts: ["Binary search on answer", "Sliding window", "Two pointers from ends", "Union-find"],
                i: 0,
                exp: "Rotated sorted arrays are still amenable to binary search with careful mid comparisons.",
            },
            {
                q: "Count subarrays with product less than k (positive nums). Typical approach?",
                opts: ["Sliding window", "Dijkstra", "Topological sort", "Bitmask DP"],
                i: 0,
                exp: "Expand right while product < k; shrink left when invalid — classic variable window.",
            },
            {
                q: "Detect cycle in a directed graph. What’s the standard pattern?",
                opts: ["DFS three-color / topo", "Kruskal", "Floyd’s tortoise-hare on array as graph", "Meet in the middle"],
                i: 0,
                exp: "White/gray/black DFS or Kahn’s algorithm for cycle detection in directed graphs.",
            },
        ],
        complexity: [
            {
                q: "Single loop over n elements, constant work inside. Time complexity?",
                opts: ["O(n)", "O(n log n)", "O(n²)", "O(2ⁿ)"],
                i: 0,
                exp: "Linear scan → O(n).",
            },
            {
                q: "Balanced BST contains n nodes. Search, insert, delete worst-case time?",
                opts: ["O(log n)", "O(n)", "O(1)", "O(n log n)"],
                i: 0,
                exp: "Height is O(log n) when balanced.",
            },
            {
                q: "Nested loops: outer n, inner n. Inner does O(1).",
                opts: ["O(n²)", "O(n)", "O(log n)", "O(n log n)"],
                i: 0,
                exp: "n × n iterations → quadratic.",
            },
        ],
        topic: [
            {
                q: "Implement LRU cache with O(1) get/put. Core structures?",
                opts: ["Hash map + doubly linked list", "Min-heap only", "Trie only", "Segment tree"],
                i: 0,
                exp: "Hash map for key→node; DLL for recency order.",
            },
            {
                q: "K-way merge of sorted lists. Natural first choice?",
                opts: ["Min-heap of size k", "Union-find", "Fenwick tree", "Deque only"],
                i: 0,
                exp: "Heap tracks smallest head among k lists.",
            },
            {
                q: "Number of islands in a binary grid.",
                opts: ["Grid DFS/BFS (connected components)", "Shortest path BFS only", "Topo sort", "Binary search"],
                i: 0,
                exp: "Flood fill connected 1’s — graph traversal on implicit grid.",
            },
        ],
    };

    var state = {
        prefs: { emailTips: false, compact: false, digest: false },
        profile: { displayName: "", bio: "", tz: "" },
        graphs: [],
        shared: [],
        invite: null,
        reminders: [],
        study: {},
        mistakes: [],
        quizStats: { pattern: { c: 0, t: 0 }, complexity: { c: 0, t: 0 }, topic: { c: 0, t: 0 } },
        notifications: [],
        streak: 0,
        lastVisit: "",
        quizIdx: { pattern: 0, complexity: 0, topic: 0 },
    };

    var activeQuiz = "pattern";
    var quizAnswered = false;

    function load() {
        try {
            var raw = localStorage.getItem(LS_KEY);
            if (!raw) {
                return;
            }
            var o = JSON.parse(raw);
            if (o && typeof o === "object") {
                if (o.prefs) {
                    state.prefs = Object.assign(state.prefs, o.prefs);
                }
                if (o.profile) {
                    state.profile = Object.assign(state.profile, o.profile);
                }
                if (Array.isArray(o.graphs)) {
                    state.graphs = o.graphs;
                }
                if (Array.isArray(o.shared)) {
                    state.shared = o.shared;
                }
                if (o.invite) {
                    state.invite = o.invite;
                }
                if (Array.isArray(o.reminders)) {
                    state.reminders = o.reminders;
                }
                if (o.study) {
                    state.study = o.study;
                }
                if (Array.isArray(o.mistakes)) {
                    state.mistakes = o.mistakes;
                }
                if (o.quizStats) {
                    state.quizStats = Object.assign(state.quizStats, o.quizStats);
                }
                if (Array.isArray(o.notifications)) {
                    state.notifications = o.notifications;
                }
                state.streak = typeof o.streak === "number" ? o.streak : state.streak;
                state.lastVisit = typeof o.lastVisit === "string" ? o.lastVisit : state.lastVisit;
                if (o.quizIdx) {
                    state.quizIdx = Object.assign(state.quizIdx, o.quizIdx);
                }
            }
        } catch (e) {}
    }

    function save() {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(state));
        } catch (e) {}
    }

    function uid() {
        return "u" + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
    }

    function toast(msg) {
        var t = document.getElementById("udash-toast");
        if (!t) {
            return;
        }
        t.textContent = msg;
        t.classList.add("is-visible");
        clearTimeout(toast._tm);
        toast._tm = setTimeout(function () {
            t.classList.remove("is-visible");
        }, 2600);
    }

    function isPracticeUser() {
        return typeof dsaIsPracticeUser === "function" && dsaIsPracticeUser();
    }

    function isPaidMember() {
        var c = typeof dsaParsePracticeUserClaims === "function" ? dsaParsePracticeUserClaims() : null;
        if (!c) {
            return false;
        }
        if (typeof dsaIsSubscriberRole === "function") {
            return dsaIsSubscriberRole(c);
        }
        var p = String(c.plan || "free");
        return p === "pro" || p === "team" || p === "lifetime" || c.role === "subscriber" || c.role === "admin";
    }

    function pushNotification(text, kind) {
        state.notifications.unshift({
            id: uid(),
            text: text,
            kind: kind || "info",
            at: Date.now(),
            read: false,
        });
        state.notifications = state.notifications.slice(0, 80);
        save();
        refreshAlertsUi();
    }

    function updateVisitStreak() {
        var d = new Date();
        var day =
            d.getFullYear() +
            "-" +
            String(d.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(d.getDate()).padStart(2, "0");
        if (state.lastVisit === day) {
            return;
        }
        var y = new Date(d);
        y.setDate(y.getDate() - 1);
        var yday =
            y.getFullYear() +
            "-" +
            String(y.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(y.getDate()).padStart(2, "0");
        if (state.lastVisit === yday) {
            state.streak += 1;
        } else if (state.lastVisit) {
            state.streak = 1;
        } else {
            state.streak = 1;
        }
        state.lastVisit = day;
        save();
    }

    var PANEL_TITLES = {
        graph: "Graph",
        "map-tools": "Map tools",
        study: "Study",
        shared: "Shared",
        collab: "Collab",
        quizzes: "Quizzes",
        reminders: "Reminders",
        billing: "Billing",
        alerts: "Alerts",
        settings: "Settings",
        profile: "Profile",
    };

    /** Site feature key per hub section (Graph has no key — always reachable). */
    var PANEL_NAV_SITE_KEY = {
        study: "sub_study_module",
        shared: "sub_shared_inbox",
        collab: "sub_collaboration",
        quizzes: "sub_quizzes_module",
        reminders: "sub_reminders_module",
        billing: "sub_billing_module",
        alerts: "sub_alerts_module",
        settings: "sub_settings_module",
        profile: "sub_profile_module",
    };

    var SITE_SHADE_PANELS = [
        { panelId: "panel-study", siteKey: "sub_study_module" },
        { panelId: "panel-quizzes", siteKey: "sub_quizzes_module" },
        { panelId: "panel-reminders", siteKey: "sub_reminders_module" },
        { panelId: "panel-billing", siteKey: "sub_billing_module" },
        { panelId: "panel-alerts", siteKey: "sub_alerts_module" },
        { panelId: "panel-settings", siteKey: "sub_settings_module" },
        { panelId: "panel-profile", siteKey: "sub_profile_module" },
    ];

    var MEMBER_HUB_GATE_ROWS = [
        {
            gateId: "udash-gate-graphs",
            siteKey: "sub_personal_graphs",
            proHtml:
                '<strong>Pro feature</strong><p style="margin: 8px 0 12px; font-size: 13px; color: var(--udash-muted)">Upgrade to manage personal graphs, sharing presets, and exports.</p><button type="button" class="dsa-udash-btn dsa-udash-btn--primary" data-jump-panel="billing">View billing</button>',
        },
        {
            gateId: "udash-gate-shared",
            siteKey: "sub_shared_inbox",
            proHtml:
                '<strong>Pro inbox</strong><p style="margin: 8px 0 12px; font-size: 13px; color: var(--udash-muted)">Paid members get shared-graph inbox and publish presets.</p><button type="button" class="dsa-udash-btn dsa-udash-btn--primary" data-jump-panel="billing">Upgrade</button>',
        },
        {
            gateId: "udash-gate-collab",
            siteKey: "sub_collaboration",
            proHtml:
                '<strong>Pro collaboration</strong><p style="margin: 8px 0 12px; font-size: 13px; color: var(--udash-muted)">Invite links and roles for paid members.</p><button type="button" class="dsa-udash-btn dsa-udash-btn--primary" data-jump-panel="billing">Upgrade</button>',
        },
        {
            gateId: "udash-gate-quizlab",
            siteKey: "sub_quiz_lab",
            proHtml:
                '<strong>Pro analytics</strong><p style="margin: 8px 0 12px; font-size: 13px; color: var(--udash-muted)">Unlock aggregated quiz lab on this device.</p><button type="button" class="dsa-udash-btn dsa-udash-btn--primary" data-jump-panel="billing">Upgrade</button>',
        },
        {
            gateId: "udash-gate-digest",
            siteKey: "sub_digest",
            proHtml:
                '<strong>Pro</strong><p style="margin: 8px 0 12px; font-size: 13px; color: var(--udash-muted)">Digest toggle for paid plans.</p><button type="button" class="dsa-udash-btn dsa-udash-btn--primary" data-jump-panel="billing">Upgrade</button>',
        },
    ];

    function siteUse(featureId) {
        if (typeof dsaSiteFeatureUse !== "function") {
            return true;
        }
        return dsaSiteFeatureUse(featureId);
    }

    function memberHubPanelAllowed(panelId) {
        if (panelId === "graph" || panelId === "map-tools") {
            return true;
        }
        var k = PANEL_NAV_SITE_KEY[panelId];
        return k ? siteUse(k) : true;
    }

    function showPanel(id) {
        document.querySelectorAll(".dsa-udash-panel").forEach(function (p) {
            p.classList.toggle("is-active", p.getAttribute("data-panel-id") === id);
        });
        document.querySelectorAll(".dsa-udash-nav-btn[data-panel]").forEach(function (b) {
            var on = b.getAttribute("data-panel") === id;
            b.classList.toggle("is-active", on);
            if (on) {
                b.setAttribute("aria-current", "page");
            } else {
                b.removeAttribute("aria-current");
            }
        });
        document.querySelectorAll(".dsa-udash-mnav button[data-panel]").forEach(function (b) {
            b.classList.toggle("is-active", b.getAttribute("data-panel") === id);
        });
        var tb = document.getElementById("udash-topbar-section");
        if (tb) {
            tb.textContent = PANEL_TITLES[id] || id;
        }
        try {
            history.replaceState(null, "", "#" + id);
        } catch (e) {}
    }

    function navigateDashboardPanel(id) {
        showPanel(id);
        var sb = document.getElementById("udash-sidebar");
        var bd = document.getElementById("udash-sidebar-backdrop");
        var mb = document.getElementById("udash-menu-btn");
        if (sb) {
            sb.classList.remove("is-open");
        }
        if (bd) {
            bd.setAttribute("hidden", "");
            bd.classList.remove("is-visible");
        }
        if (mb) {
            mb.setAttribute("aria-expanded", "false");
        }
    }

    function applyMemberHubFeatureUi() {
        var paid = isPaidMember();
        var siteOffInner =
            "<strong>Unavailable on this site</strong><p style=\"margin: 8px 0 12px; font-size: 13px; color: var(--udash-muted)\">This feature is turned off in Admin → Site → User-facing features.</p>";

        MEMBER_HUB_GATE_ROWS.forEach(function (row) {
            var gate = document.getElementById(row.gateId);
            if (!gate) {
                return;
            }
            var inner = gate.querySelector(".dsa-udash-gate-banner-inner");
            if (!inner) {
                return;
            }
            var siteOn = siteUse(row.siteKey);
            if (!siteOn) {
                gate.classList.add("is-locked", "is-site-off");
                inner.innerHTML = siteOffInner;
                return;
            }
            gate.classList.remove("is-site-off");
            if (paid) {
                gate.classList.remove("is-locked");
            } else {
                gate.classList.add("is-locked");
                inner.innerHTML = row.proHtml;
            }
        });

        SITE_SHADE_PANELS.forEach(function (x) {
            var panel = document.getElementById(x.panelId);
            if (!panel) {
                return;
            }
            panel.classList.add("dsa-udash-panel--shade-host");
            var sid = x.panelId + "-site-shade";
            var el = document.getElementById(sid);
            if (!el) {
                el = document.createElement("div");
                el.id = sid;
                el.className = "dsa-udash-site-shade";
                el.setAttribute("role", "presentation");
                el.innerHTML = '<div class="dsa-udash-site-shade-inner">' + siteOffInner + "</div>";
                panel.appendChild(el);
            }
            var showShade = !siteUse(x.siteKey);
            el.classList.toggle("is-active", showShade);
            panel.classList.toggle("is-site-disabled", showShade);
        });

        var stats = document.getElementById("udash-overview-stats");
        if (stats) {
            stats.hidden = !siteUse("sub_overview_stats");
        }

        document.querySelectorAll(".dsa-udash-nav-btn[data-panel], .dsa-udash-mnav button[data-panel]").forEach(function (btn) {
            var pid = btn.getAttribute("data-panel");
            if (!pid || pid === "graph" || pid === "map-tools") {
                return;
            }
            var key = PANEL_NAV_SITE_KEY[pid];
            if (!key) {
                return;
            }
            var on = siteUse(key);
            btn.hidden = !on;
            btn.setAttribute("aria-hidden", on ? "false" : "true");
            if (!on) {
                btn.classList.remove("is-active");
                btn.removeAttribute("aria-current");
            }
        });

        var bell = document.getElementById("dsa-udash-notif-bell");
        if (bell) {
            bell.hidden = !siteUse("sub_alerts_module");
        }

        var pill = document.getElementById("dsa-udash-plan-pill");
        if (pill) {
            pill.textContent = paid ? "Pro / paid" : "Free";
            pill.classList.toggle("dsa-udash-plan-pill--pro", paid);
        }
        var customizeBtn = document.getElementById("dsa-udash-open-customize");
        if (customizeBtn) {
            var can =
                typeof dsaHasCustomizeGraphAccess === "function" && dsaHasCustomizeGraphAccess();
            customizeBtn.disabled = !can;
        }
        var bh = document.getElementById("udash-billing-hint");
        if (bh) {
            bh.textContent = paid
                ? "You’re on a paid-capable plan in this JWT. Stripe portal links will appear here when checkout is wired."
                : "Upgrade runs through Stripe / app billing (roadmap). Pro unlocks graph library, sharing, collab, quiz lab, digest.";
        }
        var up = document.getElementById("udash-btn-upgrade");
        if (up) {
            up.disabled = paid;
            up.textContent = paid ? "Current plan includes Pro features" : "Upgrade to Pro";
        }
    }

    function fillJwtProfile() {
        var c = typeof dsaParsePracticeUserClaims === "function" ? dsaParsePracticeUserClaims() : null;
        var emailEl = document.getElementById("dsa-udash-profile-email");
        var planEl = document.getElementById("dsa-udash-profile-plan");
        if (emailEl && c) {
            emailEl.textContent = c.email || "—";
        }
        if (planEl && c) {
            planEl.textContent = (c.plan || "free") + " · " + (c.role || "user");
        }
    }

    function refreshStats() {
        var today = new Date().toDateString();
        var qToday = 0;
        try {
            var raw = sessionStorage.getItem("dsaDashQuizToday");
            if (raw) {
                var o = JSON.parse(raw);
                if (o && o.day === today) {
                    qToday = o.n || 0;
                }
            }
        } catch (e) {}
        var elQ = document.getElementById("udash-stat-quiz");
        var elR = document.getElementById("udash-stat-reminders");
        var elG = document.getElementById("udash-stat-graphs");
        var elS = document.getElementById("udash-stat-streak");
        if (elQ) {
            elQ.textContent = String(qToday);
        }
        if (elR) {
            elR.textContent = String(state.reminders.filter(function (r) {
                return !r.done;
            }).length);
        }
        if (elG) {
            elG.textContent = String(state.graphs.length);
        }
        if (elS) {
            elS.textContent = String(state.streak);
        }
    }

    function bumpQuizToday() {
        var today = new Date().toDateString();
        try {
            var raw = sessionStorage.getItem("dsaDashQuizToday");
            var o = raw ? JSON.parse(raw) : {};
            if (!o || o.day !== today) {
                o = { day: today, n: 0 };
            }
            o.n = (o.n || 0) + 1;
            sessionStorage.setItem("dsaDashQuizToday", JSON.stringify(o));
        } catch (e) {}
        refreshStats();
    }

    function renderGraphList() {
        var ul = document.getElementById("udash-graph-list");
        if (!ul) {
            return;
        }
        ul.innerHTML = "";
        if (!state.graphs.length) {
            var li = document.createElement("li");
            li.style.border = "0";
            li.textContent = "No personal graphs yet — add one above.";
            ul.appendChild(li);
            return;
        }
        state.graphs.forEach(function (g) {
            var li = document.createElement("li");
            li.style.flexDirection = "column";
            li.style.alignItems = "stretch";
            var row = document.createElement("div");
            row.style.display = "flex";
            row.style.flexWrap = "wrap";
            row.style.gap = "8px";
            row.style.alignItems = "center";
            row.innerHTML =
                "<strong>" +
                escapeHtml(g.name) +
                '</strong> <span class="dsa-udash-tag">' +
                escapeHtml(g.visibility || "private") +
                "</span>";
            var sel = document.createElement("select");
            sel.className = "dsa-udash-select";
            sel.style.maxWidth = "200px";
            ["private", "unlisted", "public"].forEach(function (v) {
                var o = document.createElement("option");
                o.value = v;
                o.textContent = v;
                if (g.visibility === v) {
                    o.selected = true;
                }
                sel.appendChild(o);
            });
            sel.addEventListener("change", function () {
                g.visibility = sel.value;
                g.updated = Date.now();
                save();
                renderGraphList();
                toast("Visibility updated (local)");
            });
            var del = document.createElement("button");
            del.type = "button";
            del.className = "dsa-udash-btn";
            del.textContent = "Remove";
            del.addEventListener("click", function () {
                state.graphs = state.graphs.filter(function (x) {
                    return x.id !== g.id;
                });
                save();
                renderGraphList();
                refreshStats();
                toast("Graph removed");
            });
            row.appendChild(sel);
            row.appendChild(del);
            li.appendChild(row);
            ul.appendChild(li);
        });
    }

    function escapeHtml(s) {
        var d = document.createElement("div");
        d.textContent = s;
        return d.innerHTML;
    }

    function studyDoneArray(path) {
        var len = path.steps.length;
        var v = state.study[path.id];
        if (Array.isArray(v) && v.length === len) {
            return v.map(function (x) {
                return !!x;
            });
        }
        if (typeof v === "number" && v >= 0) {
            var arr = Array(len).fill(false);
            for (var i = 0; i < Math.min(v, len); i++) {
                arr[i] = true;
            }
            return arr;
        }
        return Array(len).fill(false);
    }

    function renderStudy() {
        var host = document.getElementById("udash-study-paths-host");
        if (!host) {
            return;
        }
        host.innerHTML = "";
        STUDY_PATHS.forEach(function (path) {
            var arr = studyDoneArray(path);
            var doneCount = arr.filter(Boolean).length;
            var pct = Math.round((doneCount / path.steps.length) * 100);
            var det = document.createElement("details");
            det.className = "dsa-udash-acc";
            det.open = false;
            var sum = document.createElement("summary");
            sum.innerHTML =
                "<span>" +
                escapeHtml(path.title) +
                '</span><span class="dsa-udash-tag">' +
                pct +
                "%</span>";
            det.appendChild(sum);
            var body = document.createElement("div");
            body.className = "dsa-udash-acc-body";
            body.appendChild(document.createTextNode(path.blurb));
            var bar = document.createElement("div");
            bar.className = "dsa-udash-progress";
            bar.innerHTML = "<i style=\"width:" + pct + '%"></i>';
            body.appendChild(bar);
            path.steps.forEach(function (step, idx) {
                var lab = document.createElement("label");
                lab.style.display = "flex";
                lab.style.alignItems = "center";
                lab.style.gap = "8px";
                lab.style.marginTop = "8px";
                lab.style.cursor = "pointer";
                var cb = document.createElement("input");
                cb.type = "checkbox";
                cb.checked = !!arr[idx];
                cb.addEventListener("change", function () {
                    var boxes = det.querySelectorAll('input[type="checkbox"]');
                    var next = [];
                    boxes.forEach(function (bx) {
                        next.push(!!bx.checked);
                    });
                    state.study[path.id] = next;
                    save();
                    renderStudy();
                    if (next.every(Boolean)) {
                        pushNotification("Finished path: " + path.title, "study");
                    }
                    refreshStats();
                });
                lab.appendChild(cb);
                lab.appendChild(document.createTextNode(step));
                body.appendChild(lab);
            });
            det.appendChild(body);
            host.appendChild(det);
        });
    }

    function renderMistakes() {
        var ul = document.getElementById("udash-mistake-list");
        if (!ul) {
            return;
        }
        ul.innerHTML = "";
        if (!state.mistakes.length) {
            var li = document.createElement("li");
            li.style.border = "0";
            li.textContent = "No mistakes logged yet.";
            ul.appendChild(li);
            return;
        }
        state.mistakes.slice(0, 30).forEach(function (m) {
            var li = document.createElement("li");
            li.innerHTML =
                "<div><div>" +
                escapeHtml(m.q) +
                '</div><div class="dsa-udash-list-meta">' +
                new Date(m.at).toLocaleString() +
                "</div></div>";
            ul.appendChild(li);
        });
    }

    function renderShared() {
        var ul = document.getElementById("udash-shared-list");
        if (!ul) {
            return;
        }
        ul.innerHTML = "";
        if (!state.shared.length) {
            var li = document.createElement("li");
            li.style.border = "0";
            li.textContent = "Inbox empty. Add a sample (Pro) to preview the list.";
            ul.appendChild(li);
            return;
        }
        state.shared.forEach(function (s) {
            var li = document.createElement("li");
            li.innerHTML =
                "<div><strong>" +
                escapeHtml(s.title) +
                "</strong><div class=\"dsa-udash-list-meta\">From " +
                escapeHtml(s.from) +
                " · " +
                escapeHtml(s.kind) +
                "</div></div>";
            ul.appendChild(li);
        });
    }

    function renderInvite() {
        var box = document.getElementById("udash-invite-url");
        if (!box) {
            return;
        }
        if (!state.invite || !state.invite.token) {
            box.textContent = "No active invite.";
            return;
        }
        var base = "";
        try {
            base = new URL("./", location.href).href.replace(/\/?$/, "/");
        } catch (e) {
            base = "";
        }
        box.textContent = base + "index.html?collab=" + state.invite.token + "&role=" + state.invite.role;
    }

    function renderReminders() {
        var ul = document.getElementById("udash-reminder-list");
        if (!ul) {
            return;
        }
        state.reminders.sort(function (a, b) {
            return new Date(a.due) - new Date(b.due);
        });
        ul.innerHTML = "";
        state.reminders.forEach(function (r) {
            var li = document.createElement("li");
            li.style.flexDirection = "column";
            li.style.alignItems = "stretch";
            var top = document.createElement("div");
            top.style.display = "flex";
            top.style.justifyContent = "space-between";
            top.style.gap = "8px";
            top.style.flexWrap = "wrap";
            var left = document.createElement("div");
            left.innerHTML =
                "<strong>" +
                escapeHtml(r.title) +
                '</strong><div class="dsa-udash-list-meta">' +
                new Date(r.due).toLocaleString() +
                (r.done ? " · done" : "") +
                "</div>";
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "dsa-udash-btn";
            btn.textContent = r.done ? "Undo" : "Mark done";
            btn.addEventListener("click", function () {
                r.done = !r.done;
                save();
                renderReminders();
                refreshStats();
            });
            var del = document.createElement("button");
            del.type = "button";
            del.className = "dsa-udash-btn";
            del.textContent = "Delete";
            del.addEventListener("click", function () {
                state.reminders = state.reminders.filter(function (x) {
                    return x.id !== r.id;
                });
                save();
                renderReminders();
                refreshStats();
            });
            top.appendChild(left);
            var btns = document.createElement("div");
            btns.className = "dsa-udash-btn-row";
            btns.appendChild(btn);
            btns.appendChild(del);
            top.appendChild(btns);
            li.appendChild(top);
            ul.appendChild(li);
        });
        if (!state.reminders.length) {
            var empty = document.createElement("li");
            empty.style.border = "0";
            empty.textContent = "No reminders.";
            ul.appendChild(empty);
        }
    }

    function checkDueReminders() {
        var now = Date.now();
        state.reminders.forEach(function (r) {
            if (r.done || r.notified) {
                return;
            }
            if (new Date(r.due).getTime() <= now) {
                r.notified = true;
                pushNotification("Due: " + r.title, "reminder");
            }
        });
        save();
    }

    function renderQuizStats() {
        var ul = document.getElementById("udash-quiz-stats");
        if (!ul) {
            return;
        }
        ul.innerHTML = "";
        ["pattern", "complexity", "topic"].forEach(function (k) {
            var s = state.quizStats[k] || { c: 0, t: 0 };
            var li = document.createElement("li");
            li.style.border = "0";
            li.innerHTML =
                "<div><strong>" +
                k +
                "</strong><div class=\"dsa-udash-list-meta\">Correct " +
                s.c +
                " / " +
                s.t +
                " attempts</div></div>";
            ul.appendChild(li);
        });
    }

    function renderQuiz() {
        var host = document.getElementById("udash-quiz-host");
        if (!host) {
            return;
        }
        var bank = QUIZ[activeQuiz] || [];
        var idx = state.quizIdx[activeQuiz] % bank.length;
        var item = bank[idx];
        quizAnswered = false;
        host.innerHTML = "";
        var box = document.createElement("div");
        box.className = "dsa-udash-quiz-box";
        var q = document.createElement("p");
        q.className = "dsa-udash-quiz-q";
        q.textContent = item.q;
        box.appendChild(q);
        var opts = document.createElement("div");
        opts.className = "dsa-udash-quiz-opts";
        var fb = document.createElement("div");
        fb.className = "dsa-udash-quiz-feedback";
        item.opts.forEach(function (opt, oi) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "dsa-udash-quiz-opt";
            b.textContent = opt;
            b.addEventListener("click", function () {
                if (quizAnswered) {
                    return;
                }
                quizAnswered = true;
                var st = state.quizStats[activeQuiz];
                st.t += 1;
                if (oi === item.i) {
                    st.c += 1;
                    b.classList.add("is-right");
                    fb.textContent = "Correct. " + item.exp;
                } else {
                    b.classList.add("is-wrong");
                    item.opts.forEach(function (_, j) {
                        if (j === item.i) {
                            opts.children[j].classList.add("is-right");
                        }
                    });
                    fb.textContent = "Not quite. " + item.exp;
                    state.mistakes.unshift({ id: uid(), q: item.q, at: Date.now() });
                    state.mistakes = state.mistakes.slice(0, 50);
                }
                save();
                bumpQuizToday();
                renderQuizStats();
                renderMistakes();
            });
            opts.appendChild(b);
        });
        box.appendChild(opts);
        box.appendChild(fb);
        var next = document.createElement("button");
        next.type = "button";
        next.className = "dsa-udash-btn";
        next.style.marginTop = "12px";
        next.textContent = "Next question";
        next.addEventListener("click", function () {
            state.quizIdx[activeQuiz] = (state.quizIdx[activeQuiz] + 1) % bank.length;
            save();
            renderQuiz();
        });
        box.appendChild(next);
        host.appendChild(box);
    }

    function refreshAlertsUi() {
        var ul = document.getElementById("udash-alerts-list");
        if (!ul) {
            return;
        }
        ul.innerHTML = "";
        var unread = 0;
        state.notifications.forEach(function (n) {
            if (!n.read) {
                unread++;
            }
            var li = document.createElement("li");
            li.style.cursor = "pointer";
            li.style.opacity = n.read ? "0.75" : "1";
            li.innerHTML =
                "<div><div style=\"font-weight:" +
                (n.read ? "500" : "700") +
                "\">" +
                escapeHtml(n.text) +
                '</div><div class="dsa-udash-list-meta">' +
                new Date(n.at).toLocaleString() +
                " · " +
                escapeHtml(n.kind) +
                "</div></div>";
            li.addEventListener("click", function () {
                n.read = true;
                save();
                refreshAlertsUi();
            });
            ul.appendChild(li);
        });
        if (!state.notifications.length) {
            var li = document.createElement("li");
            li.style.border = "0";
            li.textContent = "No alerts yet.";
            ul.appendChild(li);
        }
        var badge = document.getElementById("udash-nav-badge-alerts");
        var dot = document.getElementById("udash-bell-dot");
        if (badge) {
            if (unread > 0) {
                badge.hidden = false;
                badge.textContent = unread > 9 ? "9+" : String(unread);
            } else {
                badge.hidden = true;
            }
        }
        if (dot) {
            dot.hidden = unread === 0;
        }
    }

    function wireNav() {
        document.querySelectorAll("[data-panel]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var id = btn.getAttribute("data-panel");
                if (id) {
                    navigateDashboardPanel(id);
                }
            });
        });
        if (!window.__dsaUdashJumpDelegation) {
            window.__dsaUdashJumpDelegation = true;
            document.addEventListener("click", function (ev) {
                var t = ev.target && ev.target.closest && ev.target.closest("[data-jump-panel]");
                if (!t || !document.body.classList.contains("dsa-udash-body")) {
                    return;
                }
                var jid = t.getAttribute("data-jump-panel");
                if (!jid || !PANEL_TITLES[jid]) {
                    return;
                }
                ev.preventDefault();
                navigateDashboardPanel(jid);
            });
        }
        var bell = document.getElementById("dsa-udash-notif-bell");
        if (bell) {
            bell.addEventListener("click", function () {
                navigateDashboardPanel("alerts");
            });
        }
        var mb = document.getElementById("udash-menu-btn");
        var sb = document.getElementById("udash-sidebar");
        var bd = document.getElementById("udash-sidebar-backdrop");
        if (mb && sb && bd) {
            mb.addEventListener("click", function () {
                var open = !sb.classList.contains("is-open");
                sb.classList.toggle("is-open", open);
                if (open) {
                    bd.removeAttribute("hidden");
                } else {
                    bd.setAttribute("hidden", "");
                }
                bd.classList.toggle("is-visible", open);
                mb.setAttribute("aria-expanded", open ? "true" : "false");
            });
            bd.addEventListener("click", function () {
                sb.classList.remove("is-open");
                bd.setAttribute("hidden", "");
                bd.classList.remove("is-visible");
                mb.setAttribute("aria-expanded", "false");
            });
        }
        var hash = (location.hash || "").replace(/^#/, "");
        var target = hash && PANEL_TITLES[hash] && memberHubPanelAllowed(hash) ? hash : "graph";
        showPanel(target);
        if (hash && PANEL_TITLES[hash] && target !== hash) {
            try {
                history.replaceState(null, "", "#" + target);
            } catch (e) {}
        }
    }

    function wireGraph() {
        var btn = document.getElementById("udash-btn-add-graph");
        var inp = document.getElementById("udash-new-graph-name");
        if (btn && inp) {
            btn.addEventListener("click", function () {
                var name = String(inp.value || "").trim();
                if (!name) {
                    toast("Enter a graph name");
                    return;
                }
                state.graphs.push({
                    id: uid(),
                    name: name,
                    visibility: "private",
                    updated: Date.now(),
                });
                inp.value = "";
                save();
                renderGraphList();
                refreshStats();
                toast("Graph added (local)");
                pushNotification("Created graph: " + name, "graph");
            });
        }
        var cz = document.getElementById("dsa-udash-open-customize");
        if (cz) {
            cz.addEventListener("click", function () {
                if (!cz.disabled) {
                    navigateDashboardPanel("map-tools");
                    window.requestAnimationFrame(function () {
                        var seg = document.getElementById("udash-modeSeg");
                        var tab = seg && seg.querySelector('[data-mode="custom"]');
                        if (tab) {
                            tab.click();
                            try {
                                tab.scrollIntoView({ block: "nearest", behavior: "smooth" });
                            } catch (e) {
                                /* ignore */
                            }
                        }
                    });
                }
            });
        }
    }

    function wireShared() {
        var btn = document.getElementById("udash-add-sample-share");
        if (btn) {
            btn.addEventListener("click", function () {
                state.shared.unshift({
                    id: uid(),
                    from: "friend@example.com",
                    title: "Shared map: Graph algorithms sprint",
                    kind: "view",
                    at: Date.now(),
                });
                state.shared = state.shared.slice(0, 40);
                save();
                renderShared();
                toast("Sample share added");
                pushNotification("New share: Graph algorithms sprint", "share");
            });
        }
    }

    function wireCollab() {
        document.getElementById("udash-gen-invite") &&
            document.getElementById("udash-gen-invite").addEventListener("click", function () {
                var roleEl = document.getElementById("udash-collab-role");
                var role = roleEl ? roleEl.value : "viewer";
                state.invite = { token: uid(), role: role, at: Date.now() };
                save();
                renderInvite();
                toast("Invite generated (demo link)");
                pushNotification("Collab invite created (" + role + ")", "collab");
            });
        document.getElementById("udash-copy-invite") &&
            document.getElementById("udash-copy-invite").addEventListener("click", function () {
                var box = document.getElementById("udash-invite-url");
                if (box && navigator.clipboard) {
                    navigator.clipboard.writeText(box.textContent).then(
                        function () {
                            toast("Copied");
                        },
                        function () {
                            toast("Copy failed");
                        },
                    );
                }
            });
        document.getElementById("udash-revoke-invite") &&
            document.getElementById("udash-revoke-invite").addEventListener("click", function () {
                state.invite = null;
                save();
                renderInvite();
                toast("Invite revoked");
            });
    }

    function wireQuizzes() {
        document.querySelectorAll("#udash-quiz-tabs [data-quiz]").forEach(function (b) {
            b.addEventListener("click", function () {
                activeQuiz = b.getAttribute("data-quiz") || "pattern";
                document.querySelectorAll("#udash-quiz-tabs [data-quiz]").forEach(function (x) {
                    x.classList.toggle("is-active", x === b);
                });
                renderQuiz();
            });
        });
        document.getElementById("udash-export-quiz-stats") &&
            document.getElementById("udash-export-quiz-stats").addEventListener("click", function () {
                var blob = new Blob([JSON.stringify(state.quizStats, null, 2)], { type: "application/json" });
                var a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "quiz-stats.json";
                a.click();
                URL.revokeObjectURL(a.href);
                toast("Exported");
            });
        document.getElementById("udash-reset-quiz-stats") &&
            document.getElementById("udash-reset-quiz-stats").addEventListener("click", function () {
                if (confirm("Reset all quiz stats on this device?")) {
                    state.quizStats = { pattern: { c: 0, t: 0 }, complexity: { c: 0, t: 0 }, topic: { c: 0, t: 0 } };
                    save();
                    renderQuizStats();
                    toast("Quiz stats reset");
                }
            });
    }

    function wireReminders() {
        document.getElementById("udash-add-reminder") &&
            document.getElementById("udash-add-reminder").addEventListener("click", function () {
                var t = document.getElementById("udash-rem-title");
                var d = document.getElementById("udash-rem-due");
                var title = t && String(t.value || "").trim();
                var due = d && d.value;
                if (!title || !due) {
                    toast("Title and due date required");
                    return;
                }
                state.reminders.push({
                    id: uid(),
                    title: title,
                    due: new Date(due).toISOString(),
                    done: false,
                    notified: false,
                });
                if (t) {
                    t.value = "";
                }
                save();
                renderReminders();
                refreshStats();
                toast("Reminder saved");
                pushNotification("Reminder scheduled: " + title, "reminder");
            });
        var dig = document.getElementById("udash-pref-digest");
        if (dig) {
            dig.classList.toggle("is-on", !!state.prefs.digest);
            dig.setAttribute("aria-pressed", state.prefs.digest ? "true" : "false");
            dig.addEventListener("click", function () {
                state.prefs.digest = !state.prefs.digest;
                dig.classList.toggle("is-on", state.prefs.digest);
                dig.setAttribute("aria-pressed", state.prefs.digest ? "true" : "false");
                save();
                toast(state.prefs.digest ? "Digest on (local)" : "Digest off");
            });
        }
    }

    function wireBilling() {
        document.getElementById("udash-btn-upgrade") &&
            document.getElementById("udash-btn-upgrade").addEventListener("click", function () {
                if (!isPaidMember()) {
                    toast("Stripe checkout — connect in BACKLOG P0");
                }
            });
        document.getElementById("udash-btn-manage") &&
            document.getElementById("udash-btn-manage").addEventListener("click", function () {
                toast("Customer portal link — after Stripe billing");
            });
        document.getElementById("udash-btn-invoices") &&
            document.getElementById("udash-btn-invoices").addEventListener("click", function () {
                toast("Invoices — after Stripe billing");
            });
    }

    function wireAlerts() {
        document.getElementById("udash-alerts-readall") &&
            document.getElementById("udash-alerts-readall").addEventListener("click", function () {
                state.notifications.forEach(function (n) {
                    n.read = true;
                });
                save();
                refreshAlertsUi();
            });
        document.getElementById("udash-alerts-clear") &&
            document.getElementById("udash-alerts-clear").addEventListener("click", function () {
                if (confirm("Clear all alerts?")) {
                    state.notifications = [];
                    save();
                    refreshAlertsUi();
                }
            });
    }

    function wireSettings() {
        function bindToggle(id, key) {
            var el = document.getElementById(id);
            if (!el) {
                return;
            }
            el.classList.toggle("is-on", !!state.prefs[key]);
            el.setAttribute("aria-pressed", state.prefs[key] ? "true" : "false");
            el.addEventListener("click", function () {
                state.prefs[key] = !state.prefs[key];
                el.classList.toggle("is-on", state.prefs[key]);
                el.setAttribute("aria-pressed", state.prefs[key] ? "true" : "false");
                save();
                toast("Saved");
            });
        }
        bindToggle("udash-pref-emailtips", "emailTips");
        var compactEl = document.getElementById("udash-pref-compact");
        if (compactEl) {
            compactEl.classList.toggle("is-on", !!state.prefs.compact);
            compactEl.setAttribute("aria-pressed", state.prefs.compact ? "true" : "false");
            compactEl.addEventListener("click", function () {
                state.prefs.compact = !state.prefs.compact;
                compactEl.classList.toggle("is-on", state.prefs.compact);
                compactEl.setAttribute("aria-pressed", state.prefs.compact ? "true" : "false");
                save();
                applyCompactUi();
                toast("Saved");
            });
        }
        document.getElementById("udash-oauth-google") &&
            document.getElementById("udash-oauth-google").addEventListener("click", function () {
                toast("Google OAuth — see BACKLOG");
            });
        document.getElementById("udash-oauth-apple") &&
            document.getElementById("udash-oauth-apple").addEventListener("click", function () {
                toast("Apple sign-in — see BACKLOG");
            });
        document.getElementById("udash-export-all") &&
            document.getElementById("udash-export-all").addEventListener("click", function () {
                var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
                var a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "dsa-dashboard-backup.json";
                a.click();
                URL.revokeObjectURL(a.href);
                toast("Download started");
            });
        document.getElementById("udash-reset-local") &&
            document.getElementById("udash-reset-local").addEventListener("click", function () {
                if (
                    confirm(
                        "Erase all local dashboard data on this browser? (graphs, reminders, quiz stats, alerts)",
                    )
                ) {
                    try {
                        localStorage.removeItem(LS_KEY);
                    } catch (e) {}
                    location.reload();
                }
            });
    }

    function fillTimezones() {
        var sel = document.getElementById("udash-tz");
        if (!sel) {
            return;
        }
        var zones = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Kolkata", "Asia/Tokyo"];
        if (typeof Intl.supportedValuesOf === "function") {
            try {
                zones = Intl.supportedValuesOf("timeZone");
            } catch (e) {}
        }
        sel.innerHTML = "";
        zones.forEach(function (z) {
            var o = document.createElement("option");
            o.value = z;
            o.textContent = z;
            sel.appendChild(o);
        });
        if (state.profile.tz) {
            sel.value = state.profile.tz;
        }
    }

    function applyCompactUi() {
        var sc = document.querySelector(".dsa-udash-scroll");
        if (sc) {
            sc.classList.toggle("is-compact", !!state.prefs.compact);
        }
    }

    function wireProfile() {
        var dn = document.getElementById("udash-display-name");
        var bio = document.getElementById("udash-bio");
        if (dn) {
            dn.value = state.profile.displayName || "";
        }
        if (bio) {
            bio.value = state.profile.bio || "";
        }
        fillTimezones();
        document.getElementById("udash-save-profile") &&
            document.getElementById("udash-save-profile").addEventListener("click", function () {
                state.profile.displayName = dn ? String(dn.value || "").trim() : "";
                state.profile.bio = bio ? String(bio.value || "").trim() : "";
                var tz = document.getElementById("udash-tz");
                state.profile.tz = tz ? tz.value : "";
                save();
                toast("Profile saved locally");
            });
    }

    function wireSignOut() {
        var btn = document.getElementById("dsa-udash-signout");
        if (btn) {
            btn.addEventListener("click", function () {
                if (typeof dsaPracticeUserSignOut === "function") {
                    dsaPracticeUserSignOut();
                }
                window.location.href = "./account.html";
            });
        }
    }

    function wireMistakes() {
        document.getElementById("udash-clear-mistakes") &&
            document.getElementById("udash-clear-mistakes").addEventListener("click", function () {
                state.mistakes = [];
                save();
                renderMistakes();
            });
    }

    function seedWelcome() {
        if (!state.notifications.length) {
            pushNotification("Welcome to your member hub — data here is stored in this browser until cloud sync ships.", "info");
        }
    }

    function runDashboard() {
        load();
        updateVisitStreak();
        fillJwtProfile();
        applyMemberHubFeatureUi();
        seedWelcome();
        wireNav();
        wireGraph();
        wireShared();
        wireCollab();
        wireQuizzes();
        wireReminders();
        wireBilling();
        wireAlerts();
        wireSettings();
        wireProfile();
        wireSignOut();
        wireMistakes();
        applyCompactUi();
        renderGraphList();
        renderStudy();
        renderMistakes();
        renderShared();
        renderInvite();
        renderReminders();
        renderQuiz();
        renderQuizStats();
        refreshAlertsUi();
        refreshStats();
        setInterval(checkDueReminders, 30000);
        checkDueReminders();
    }

    function init() {
        if (!isPracticeUser()) {
            window.location.href = "./account.html?next=" + encodeURIComponent("user-dashboard.html");
            return;
        }
        function afterFlags() {
            if (typeof dsaSiteFeatureUse === "function" && !dsaSiteFeatureUse("member_dashboard")) {
                window.location.href = "./index.html";
                return;
            }
            runDashboard();
        }
        if (typeof dsaEnsureSiteFeaturesLoaded === "function") {
            dsaEnsureSiteFeaturesLoaded().then(afterFlags).catch(afterFlags);
        } else {
            afterFlags();
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
