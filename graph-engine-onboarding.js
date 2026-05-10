/**
 * First-time onboarding tour for graph.html — localStorage `dsaGraphEngineTourDoneV1`.
 */
(function () {
    var STORAGE_KEY = "dsaGraphEngineTourDoneV1";

    var STEPS = [
        {
            title: "Welcome to Graph Studio",
            body:
                "This page is the **shared graph engine** for exploring and editing the DSA mind map. The same tools work here as on the home page, with extra shortcuts for loading live data and importing/exporting JSON.",
        },
        {
            title: "Three ways to view the map",
            target: ".dsa-view-tabs",
            body:
                "**Full map** — entire hierarchy in one canvas. **One topic** — pick a data structure, then explore only that branch. **Customize** — edit rings on nodes (add/remove problems, labels) if your account allows; site admins can sync changes to the server from the admin console.",
        },
        {
            title: "Toolbar: zoom, expand, import & export",
            target: "#graph-dsa-map-toolbar-host",
            body:
                "Use **Expand all / Collapse all** to open or close branches. **Zoom** adjusts the map scale. **Export map** downloads the current **canonical** tree as JSON; **Import map** replaces the in-memory tree from a file (useful for drafts). Publishing to everyone still goes through **Site admin → Content** when you are signed in as staff.",
        },
        {
            title: "Pan, scroll, and progress",
            target: ".graph-engine-stage-wrap",
            body:
                "Drag inside the shaded area to pan when the map is large. Mark problems **Done** to track progress (saved with your account when signed in). Purple badges expand branches; leaf items open problem details.",
        },
        {
            title: "You are set",
            body:
                "Open **How to use this page** anytime for a written cheat sheet. Use **Reload live graph** to pull the latest published map from the site API after changes in admin.",
        },
    ];

    function parseSimpleMd(s) {
        return String(s || "").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    }

    function isTourDone() {
        try {
            return localStorage.getItem(STORAGE_KEY) === "1";
        } catch (e) {
            return false;
        }
    }

    function setTourDone() {
        try {
            localStorage.setItem(STORAGE_KEY, "1");
        } catch (e) {}
    }

    function scrollToTarget(sel) {
        if (!sel) {
            return;
        }
        try {
            var el = document.querySelector(sel);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
        } catch (e) {}
    }

    function removeOverlay(root) {
        if (root && root.parentNode) {
            root.parentNode.removeChild(root);
        }
    }

    function openTour(opts) {
        var force = opts && opts.force;
        if (!force && isTourDone()) {
            return;
        }
        var stepIndex = 0;
        var overlay = document.createElement("div");
        overlay.className = "dsa-graph-tour-overlay";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-labelledby", "dsa-graph-tour-title");

        var card = document.createElement("div");
        card.className = "dsa-graph-tour-card";

        var progress = document.createElement("div");
        progress.className = "dsa-graph-tour-progress";

        var h = document.createElement("h2");
        h.id = "dsa-graph-tour-title";

        var p = document.createElement("div");
        p.className = "dsa-graph-tour-body";

        var actions = document.createElement("div");
        actions.className = "dsa-graph-tour-actions";

        var btnSkip = document.createElement("button");
        btnSkip.type = "button";
        btnSkip.className = "dsa-graph-tour-skip";
        btnSkip.textContent = "Skip tour";

        var btnBack = document.createElement("button");
        btnBack.type = "button";
        btnBack.className = "btn ghost btn-sm";
        btnBack.textContent = "Back";

        var btnNext = document.createElement("button");
        btnNext.type = "button";
        btnNext.className = "btn btn-sm";
        btnNext.textContent = "Next";

        function render() {
            var st = STEPS[stepIndex];
            progress.textContent = "Step " + (stepIndex + 1) + " of " + STEPS.length;
            h.textContent = st.title;
            p.innerHTML = parseSimpleMd(st.body);
            btnBack.hidden = stepIndex === 0;
            btnNext.textContent = stepIndex >= STEPS.length - 1 ? "Done" : "Next";
            scrollToTarget(st.target);
        }

        btnSkip.addEventListener("click", function () {
            setTourDone();
            removeOverlay(overlay);
        });

        btnBack.addEventListener("click", function () {
            if (stepIndex > 0) {
                stepIndex--;
                render();
            }
        });

        btnNext.addEventListener("click", function () {
            if (stepIndex >= STEPS.length - 1) {
                setTourDone();
                removeOverlay(overlay);
                return;
            }
            stepIndex++;
            render();
        });

        overlay.addEventListener("click", function (ev) {
            if (ev.target === overlay) {
                /* don't close on backdrop — avoid accidental dismiss */
            }
        });

        actions.appendChild(btnSkip);
        actions.appendChild(btnBack);
        actions.appendChild(btnNext);
        card.appendChild(progress);
        card.appendChild(h);
        card.appendChild(p);
        card.appendChild(actions);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        render();
        btnNext.focus();
    }

    window.dsaGraphEngineOpenTour = function (opts) {
        openTour(opts || {});
    };

    window.dsaGraphEngineResetTour = function () {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {}
    };

    document.addEventListener("dsa-graph-engine-ready", function () {
        if (!isTourDone()) {
            window.setTimeout(function () {
                openTour({});
            }, 400);
        }
    });
})();
