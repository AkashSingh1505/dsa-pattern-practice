/**
 * DSA problem sketch — native 2D canvas (no Fabric). Same API as `dsaWireSketchEditor` in script.js.
 * Basic tools: pen colors, brush width, eraser, undo, zoom (CSS scale), full screen. Fits the scroll box on resize.
 *
 * @param {HTMLElement} editorRoot
 * @param {() => void} onChange
 * @param {{ afterClear?: () => void; admin?: boolean }} [sketchOpts]
 */
function dsaWireSketchEditorNative(editorRoot, onChange, sketchOpts) {
    const hooks = sketchOpts || {};

    const COLORS = ["#111827", "#2563eb", "#dc2626", "#16a34a", "#7c3aed", "#ca8a04"];

    const toolState = {
        color: COLORS[0],
        brushWidth: 6,
        isEraser: false,
    };

    let zoomLevel = 1;
    let hasInk = false;
    /** @type {ImageData[]} */
    const undoStack = [];
    const MAX_UNDO = 24;

    let fabricPointerDown = 0;
    let suppressAutoFitUntil = 0;
    let fitDebounceTimer = null;
    let lastLayoutW = 0;
    let lastLayoutH = 0;

    let fsParent = null;
    let fsNext = null;
    let isFullscreen = false;
    let fsHideBackdrop = null;
    let fsHideDlg = null;

    editorRoot.classList.add("dsa-sketch-editor", "dsa-sketch-editor--native");
    editorRoot.innerHTML = "";

    const sketchHead = document.createElement("div");
    sketchHead.className = "dsa-sketch-head dsa-sketch-head--fs-only";
    const headFsActions = document.createElement("div");
    headFsActions.className = "dsa-sketch-head-fs-actions";
    const btnFsBack = document.createElement("button");
    btnFsBack.type = "button";
    btnFsBack.className = "dsa-sketch-fs-action dsa-sketch-fs-action--back";
    btnFsBack.setAttribute("aria-label", "Back to dialog");
    btnFsBack.title = "Back to dialog";
    const backSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    backSvg.setAttribute("width", "18");
    backSvg.setAttribute("height", "18");
    backSvg.setAttribute("viewBox", "0 0 24 24");
    backSvg.setAttribute("fill", "none");
    backSvg.setAttribute("stroke", "currentColor");
    backSvg.setAttribute("stroke-width", "2");
    backSvg.setAttribute("aria-hidden", "true");
    backSvg.innerHTML = "<path d=\"M15 18l-6-6 6-6\"/>";
    btnFsBack.appendChild(backSvg);
    const backLab = document.createElement("span");
    backLab.textContent = "Back";
    btnFsBack.appendChild(backLab);
    headFsActions.appendChild(btnFsBack);
    sketchHead.appendChild(headFsActions);

    function toolButton(svgInner, title, isToggle) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "dsa-sketch-tool-btn";
        if (isToggle) {
            b.classList.add("dsa-sketch-tool-btn--toggle");
        }
        b.title = title;
        b.setAttribute("aria-label", title);
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "18");
        svg.setAttribute("height", "18");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.setAttribute("aria-hidden", "true");
        svg.innerHTML = svgInner;
        b.appendChild(svg);
        return b;
    }

    const svgFsExpand =
        '<path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>';
    const svgFsCompress =
        '<path d="M8 3v3a2 2 0 012 2h3"/><path d="M21 8h-3a2 2 0 00-2-2V3"/><path d="M16 21v-3a2 2 0 002-2h3"/><path d="M3 16h3a2 2 0 012 2v3"/>';
    const btnFs = toolButton(svgFsExpand, "Expand sketch to full screen", true);
    function setFsToolbarIcon(compressed) {
        const svg = btnFs.querySelector("svg");
        if (svg) {
            svg.innerHTML = compressed ? svgFsCompress : svgFsExpand;
        }
    }

    const toolbar = document.createElement("div");
    toolbar.className = "dsa-sketch-toolbar";

    const row1 = document.createElement("div");
    row1.className = "dsa-sketch-toolbar-row dsa-sketch-toolbar-row--compact";

    const btnUndo = toolButton(
        '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-15-6.7L3 13"/>',
        "Undo last stroke",
        false,
    );

    const btnEraser = toolButton(
        '<path fill="#fbcfe8" stroke="#db2777" stroke-width="1.5" d="M8.5 20h8l1-1.5-6.5-6.5-8 8 1.5 1.5z"/><path stroke="#9d174d" stroke-width="1.5" d="M15 5.5l4 4-3 3"/><path stroke="#831843" stroke-width="1.2" d="M5 21h6"/>',
        "Eraser",
        true,
    );

    const widthWrap = document.createElement("div");
    widthWrap.className = "dsa-sketch-tool-group dsa-sketch-brush-width-wrap";
    const widthIcon = document.createElement("span");
    widthIcon.className = "dsa-sketch-brush-width-icon";
    widthIcon.setAttribute("aria-hidden", "true");
    widthIcon.title = "Brush size";
    widthIcon.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">' +
        '<path d="M4 8h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
        '<path d="M5.5 13h13" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>' +
        '<path d="M7 18h10" stroke="currentColor" stroke-width="5.5" stroke-linecap="round"/>' +
        "</svg>";
    const widthRange = document.createElement("input");
    widthRange.type = "range";
    widthRange.className = "dsa-sketch-brush-width";
    widthRange.min = "2";
    widthRange.max = "28";
    widthRange.value = String(toolState.brushWidth);
    widthRange.title = "Brush size";
    widthRange.setAttribute("aria-label", "Brush size");
    widthWrap.appendChild(widthIcon);
    widthWrap.appendChild(widthRange);

    const colorGroup = document.createElement("div");
    colorGroup.className = "dsa-sketch-tool-group dsa-sketch-colors";
    const colorNative = document.createElement("input");
    colorNative.type = "color";
    colorNative.className = "dsa-sketch-color-native";
    colorNative.value = toolState.color;
    colorNative.setAttribute("aria-label", "Custom color");
    colorGroup.appendChild(colorNative);
    COLORS.forEach((hex) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "dsa-sketch-swatch";
        b.style.background = hex;
        b.dataset.color = hex;
        b.title = hex;
        b.setAttribute("aria-label", `Color ${hex}`);
        colorGroup.appendChild(b);
    });
    colorGroup.querySelector(".dsa-sketch-swatch").classList.add("dsa-sketch-swatch--on");

    row1.appendChild(btnFs);
    row1.appendChild(btnUndo);
    row1.appendChild(btnEraser);
    row1.appendChild(widthWrap);
    row1.appendChild(colorGroup);

    toolbar.appendChild(row1);

    const zoomScroll = document.createElement("div");
    zoomScroll.className = "dsa-sketch-zoom-scroll";
    const zoomInner = document.createElement("div");
    zoomInner.className = "dsa-sketch-zoom-inner";
    const stack = document.createElement("div");
    stack.className = "dsa-sketch-canvas-stack";

    const canvas = document.createElement("canvas");
    canvas.className = "dsa-q-canvas";
    canvas.width = 400;
    canvas.height = 220;
    canvas.setAttribute("aria-label", "Sketch canvas");

    stack.appendChild(canvas);
    zoomInner.appendChild(stack);
    zoomScroll.appendChild(zoomInner);

    editorRoot.appendChild(sketchHead);
    editorRoot.appendChild(toolbar);
    editorRoot.appendChild(zoomScroll);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        editorRoot.textContent = "Canvas is not supported in this browser.";
        return {
            clear() {},
            zoomIn() {},
            zoomOut() {},
            resetZoom() {},
            loadDataUrl() {},
            toDataUrl() {
                return "";
            },
            toPersistedSketchDataUrl() {
                return "";
            },
            getHasInk() {
                return false;
            },
            syncHasInkFromPixels() {},
            exitFullscreen() {},
            isFullscreen() {
                return false;
            },
            destroy() {},
        };
    }

    function applyZoom() {
        const z = Math.max(0.45, Math.min(2.75, zoomLevel));
        stack.style.transform = `scale(${z})`;
        stack.style.transformOrigin = "center center";
    }

    function fillWhite() {
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    /** Flatten transparent eraser holes onto white before JPEG (JPEG has no alpha). */
    function flattenCanvasForJpegExport() {
        const tmp = document.createElement("canvas");
        tmp.width = canvas.width;
        tmp.height = canvas.height;
        const t = tmp.getContext("2d");
        t.fillStyle = "#ffffff";
        t.fillRect(0, 0, tmp.width, tmp.height);
        t.drawImage(canvas, 0, 0);
        return tmp;
    }

    function pushUndoSnapshot() {
        try {
            const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
            undoStack.push(snap);
            if (undoStack.length > MAX_UNDO) {
                undoStack.shift();
            }
        } catch (_) {
            /* ignore */
        }
    }

    function updateUndoBtn() {
        btnUndo.disabled = undoStack.length === 0;
    }

    function syncInk() {
        hasInk = false;
        try {
            const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            for (let i = 0; i < d.length; i += 16) {
                if (d[i + 3] < 8) {
                    continue;
                }
                if (d[i] < 252 || d[i + 1] < 252 || d[i + 2] < 252) {
                    hasInk = true;
                    return;
                }
            }
        } catch (_) {
            hasInk = undoStack.length > 0;
        }
    }

    function paintDot(x, y) {
        const sw = Math.max(1, toolState.brushWidth);
        ctx.save();
        if (toolState.isEraser) {
            ctx.globalCompositeOperation = "destination-out";
            ctx.fillStyle = "rgba(0,0,0,1)";
        } else {
            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = toolState.color;
            ctx.fillStyle = toolState.color;
        }
        ctx.lineWidth = sw;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.arc(x, y, sw / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function paintLine(x0, y0, x1, y1) {
        const sw = Math.max(1, toolState.brushWidth);
        ctx.save();
        if (toolState.isEraser) {
            ctx.globalCompositeOperation = "destination-out";
            ctx.strokeStyle = "rgba(0,0,0,1)";
        } else {
            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = toolState.color;
        }
        ctx.lineWidth = sw;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.restore();
    }

    function canvasCoords(clientX, clientY) {
        const r = canvas.getBoundingClientRect();
        const sx = canvas.width / (r.width || 1);
        const sy = canvas.height / (r.height || 1);
        return {
            x: (clientX - r.left) * sx,
            y: (clientY - r.top) * sy,
        };
    }

    let drawing = false;
    let lastX = 0;
    let lastY = 0;

    function onPointerDown(ev) {
        if (
            editorRoot.classList.contains("dsa-sketch-editor-host--ro") ||
            editorRoot.classList.contains("dsa-sketch-studio-host--ro")
        ) {
            return;
        }
        ev.preventDefault();
        fabricPointerDown += 1;
        suppressAutoFitUntil = performance.now() + 1800;
        pushUndoSnapshot();
        drawing = true;
        const p = canvasCoords(ev.clientX, ev.clientY);
        lastX = p.x;
        lastY = p.y;
        paintDot(lastX, lastY);
        syncInk();
        onChange();
        updateUndoBtn();
        try {
            canvas.setPointerCapture(ev.pointerId);
        } catch (_) {
            /* ignore */
        }
    }

    function onPointerMove(ev) {
        if (
            !drawing ||
            editorRoot.classList.contains("dsa-sketch-editor-host--ro") ||
            editorRoot.classList.contains("dsa-sketch-studio-host--ro")
        ) {
            return;
        }
        ev.preventDefault();
        const p = canvasCoords(ev.clientX, ev.clientY);
        paintLine(lastX, lastY, p.x, p.y);
        lastX = p.x;
        lastY = p.y;
        syncInk();
        onChange();
    }

    function onPointerUp(ev) {
        if (drawing) {
            drawing = false;
            fabricPointerDown = Math.max(0, fabricPointerDown - 1);
            syncInk();
            onChange();
        }
        try {
            canvas.releasePointerCapture(ev.pointerId);
        } catch (_) {
            /* ignore */
        }
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("lostpointercapture", () => {
        drawing = false;
        fabricPointerDown = 0;
    });

    function resizeCanvasTo(w, h) {
        const lw = Math.max(160, Math.round(w));
        const lh = Math.max(80, Math.round(h));
        if (canvas.width === lw && canvas.height === lh) {
            stack.style.width = `${lw}px`;
            stack.style.height = `${lh}px`;
            lastLayoutW = lw;
            lastLayoutH = lh;
            applyZoom();
            return;
        }
        const jitterW = lastLayoutW > 0 ? Math.abs(lw - lastLayoutW) : 999;
        const jitterH = lastLayoutH > 0 ? Math.abs(lh - lastLayoutH) : 999;
        if (jitterW < 6 && jitterH < 6 && hasInk) {
            stack.style.width = `${lw}px`;
            stack.style.height = `${lh}px`;
            lastLayoutW = lw;
            lastLayoutH = lh;
            applyZoom();
            return;
        }

        let snap = null;
        try {
            if (canvas.width > 0 && canvas.height > 0 && hasInk) {
                snap = canvas.toDataURL("image/png");
            }
        } catch (_) {
            snap = null;
        }

        canvas.width = lw;
        canvas.height = lh;
        stack.style.width = `${lw}px`;
        stack.style.height = `${lh}px`;
        lastLayoutW = lw;
        lastLayoutH = lh;
        undoStack.length = 0;
        updateUndoBtn();

        fillWhite();
        if (snap) {
            const im = new Image();
            im.onload = () => {
                ctx.drawImage(im, 0, 0, lw, lh);
                syncInk();
                applyZoom();
                onChange();
            };
            im.onerror = () => {
                hasInk = false;
                applyZoom();
            };
            im.src = snap;
        } else {
            hasInk = false;
            applyZoom();
        }
    }

    function measureAndResize() {
        const pad = 14;
        const w = Math.floor(zoomScroll.clientWidth - pad);
        const h = Math.floor(zoomScroll.clientHeight - pad);
        if (w < 80 || h < 60) {
            return;
        }
        resizeCanvasTo(w, h);
    }

    function leaveFullscreen() {
        if (!isFullscreen) {
            return;
        }
        if (fsHideBackdrop) {
            fsHideBackdrop.classList.remove("dsa-sketch-fs-hide-dialog");
        }
        if (fsHideDlg) {
            fsHideDlg.classList.remove("dsa-sketch-fs-hide-dialog");
        }
        fsHideBackdrop = null;
        fsHideDlg = null;
        editorRoot.classList.remove("dsa-sketch-editor--fullscreen");
        if (fsParent) {
            if (fsNext) {
                fsParent.insertBefore(editorRoot, fsNext);
            } else {
                fsParent.appendChild(editorRoot);
            }
        }
        btnFs.setAttribute("aria-label", "Expand sketch to full screen");
        btnFs.title = "Expand sketch to full screen";
        setFsToolbarIcon(false);
        isFullscreen = false;
        fsParent = null;
        fsNext = null;
        requestAnimationFrame(() => {
            measureAndResize();
        });
    }

    function enterFullscreen() {
        if (isFullscreen) {
            return;
        }
        fsParent = editorRoot.parentNode;
        fsNext = editorRoot.nextSibling;
        fsHideBackdrop = editorRoot.closest(".dsa-dialog-backdrop");
        fsHideDlg = editorRoot.closest(".dsa-dialog");
        document.body.appendChild(editorRoot);
        editorRoot.classList.add("dsa-sketch-editor--fullscreen");
        if (fsHideBackdrop) {
            fsHideBackdrop.classList.add("dsa-sketch-fs-hide-dialog");
        }
        if (fsHideDlg) {
            fsHideDlg.classList.add("dsa-sketch-fs-hide-dialog");
        }
        btnFs.setAttribute("aria-label", "Exit full screen");
        btnFs.title = "Exit full screen";
        setFsToolbarIcon(true);
        isFullscreen = true;
        requestAnimationFrame(() => {
            measureAndResize();
        });
    }

    function scheduleFitFromWindowResize() {
        if (fitDebounceTimer) {
            clearTimeout(fitDebounceTimer);
        }
        fitDebounceTimer = setTimeout(() => {
            fitDebounceTimer = null;
            if (performance.now() < suppressAutoFitUntil) {
                return;
            }
            if (fabricPointerDown > 0) {
                return;
            }
            measureAndResize();
        }, 450);
    }

    function onWindowResize() {
        scheduleFitFromWindowResize();
    }
    window.addEventListener("resize", onWindowResize);

    function runInitialFit() {
        measureAndResize();
    }
    requestAnimationFrame(() => {
        requestAnimationFrame(runInitialFit);
    });
    setTimeout(runInitialFit, 480);

    widthRange.addEventListener("input", () => {
        toolState.brushWidth = Math.max(1, Math.min(40, Number(widthRange.value) || 6));
    });

    btnEraser.addEventListener("click", () => {
        toolState.isEraser = !toolState.isEraser;
        btnEraser.classList.toggle("dsa-sketch-tool-btn--active", toolState.isEraser);
    });

    colorNative.addEventListener("input", () => {
        toolState.color = colorNative.value;
        toolState.isEraser = false;
        btnEraser.classList.remove("dsa-sketch-tool-btn--active");
        colorGroup.querySelectorAll(".dsa-sketch-swatch").forEach((x) => x.classList.remove("dsa-sketch-swatch--on"));
    });

    colorGroup.querySelectorAll(".dsa-sketch-swatch").forEach((b) => {
        b.addEventListener("click", () => {
            toolState.color = b.dataset.color || COLORS[0];
            colorNative.value = toolState.color;
            toolState.isEraser = false;
            btnEraser.classList.remove("dsa-sketch-tool-btn--active");
            colorGroup.querySelectorAll(".dsa-sketch-swatch").forEach((x) => x.classList.toggle("dsa-sketch-swatch--on", x === b));
        });
    });

    btnUndo.addEventListener("click", () => {
        if (!undoStack.length) {
            return;
        }
        const prev = undoStack.pop();
        if (prev && prev.width === canvas.width && prev.height === canvas.height) {
            ctx.putImageData(prev, 0, 0);
        } else {
            fillWhite();
        }
        syncInk();
        onChange();
        updateUndoBtn();
    });

    updateUndoBtn();

    btnFs.addEventListener("click", () => {
        if (isFullscreen) {
            leaveFullscreen();
        } else {
            enterFullscreen();
        }
    });
    btnFsBack.addEventListener("click", () => leaveFullscreen());

    function onKeyDown(e) {
        if (!editorRoot.isConnected) {
            return;
        }
        const t = e.target;
        const inEditor =
            t &&
            (t === canvas ||
                (typeof t.closest === "function" && t.closest(".dsa-sketch-editor")) ||
                isFullscreen);
        if (!inEditor) {
            return;
        }
        if (e.key === "Escape" && isFullscreen) {
            e.preventDefault();
            e.stopPropagation();
            leaveFullscreen();
        }
    }
    document.addEventListener("keydown", onKeyDown, true);

    const api = {
        clear() {
            undoStack.length = 0;
            updateUndoBtn();
            fillWhite();
            hasInk = false;
            if (typeof hooks.afterClear === "function") {
                hooks.afterClear();
            }
            onChange();
        },
        zoomIn() {
            zoomLevel = Math.min(2.75, Math.round((zoomLevel + 0.12) * 100) / 100);
            applyZoom();
        },
        zoomOut() {
            zoomLevel = Math.max(0.45, Math.round((zoomLevel - 0.12) * 100) / 100);
            applyZoom();
        },
        resetZoom() {
            zoomLevel = 1;
            applyZoom();
        },
        loadDataUrl(url) {
            if (!url || !String(url).trim()) {
                api.clear();
                return;
            }
            const u = String(url).trim();
            const im = new Image();
            im.onload = () => {
                fillWhite();
                const cw = canvas.width;
                const ch = canvas.height;
                const scale = Math.min(cw / (im.naturalWidth || im.width || 1), ch / (im.naturalHeight || im.height || 1), 1);
                const dw = (im.naturalWidth || im.width) * scale;
                const dh = (im.naturalHeight || im.height) * scale;
                const ox = (cw - dw) / 2;
                const oy = (ch - dh) / 2;
                ctx.drawImage(im, ox, oy, dw, dh);
                undoStack.length = 0;
                updateUndoBtn();
                syncInk();
                onChange();
            };
            im.onerror = () => {
                api.clear();
            };
            im.src = u;
        },
        toDataUrl() {
            try {
                return canvas.toDataURL("image/png");
            } catch (_) {
                return "";
            }
        },
        toPersistedSketchDataUrl() {
            try {
                return flattenCanvasForJpegExport().toDataURL("image/jpeg", 0.82);
            } catch (_) {
                try {
                    return canvas.toDataURL("image/png");
                } catch (_) {
                    return "";
                }
            }
        },
        getHasInk() {
            return hasInk;
        },
        syncHasInkFromPixels() {
            syncInk();
        },
        exitFullscreen() {
            leaveFullscreen();
        },
        isFullscreen() {
            return isFullscreen;
        },
        destroy() {
            document.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("resize", onWindowResize);
            if (fitDebounceTimer) {
                clearTimeout(fitDebounceTimer);
                fitDebounceTimer = null;
            }
            canvas.removeEventListener("pointerdown", onPointerDown);
            canvas.removeEventListener("pointermove", onPointerMove);
            canvas.removeEventListener("pointerup", onPointerUp);
            canvas.removeEventListener("pointercancel", onPointerUp);
            if (fsHideBackdrop) {
                fsHideBackdrop.classList.remove("dsa-sketch-fs-hide-dialog");
            }
            if (fsHideDlg) {
                fsHideDlg.classList.remove("dsa-sketch-fs-hide-dialog");
            }
            if (isFullscreen && fsParent) {
                editorRoot.classList.remove("dsa-sketch-editor--fullscreen");
                setFsToolbarIcon(false);
                if (fsNext) {
                    fsParent.insertBefore(editorRoot, fsNext);
                } else {
                    fsParent.appendChild(editorRoot);
                }
            }
            isFullscreen = false;
            fsParent = null;
            fsNext = null;
            fsHideBackdrop = null;
            fsHideDlg = null;
        },
    };

    fillWhite();
    applyZoom();

    return api;
}
