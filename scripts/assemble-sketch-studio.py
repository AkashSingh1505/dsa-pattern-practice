#!/usr/bin/env python3
"""Assemble dsa-sketch-studio.js from fragment HTML + logic module."""
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
FRAG = (BASE / "dsa-sketch-studio-fragment.html").read_text()
LOGIC = (BASE / "dsa-sketch-studio-logic.js").read_text()

OUT = BASE / "dsa-sketch-studio.js"
escaped = FRAG.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")

header = '''/**
 * DSA problem sketch — Sketch Studio (embedded, glass UI).
 */
function dsaDetectSketchDevice() {
    const ua = navigator.userAgent || "";
    const isIPad =
        /iPad/i.test(ua) ||
        (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1);
    const isMobile = /Android|iPhone|iPod|Mobile/i.test(ua) && !isIPad;
    return isMobile ? "mobile" : "pc";
}

function dsaWireSketchEditorStudioStub() {
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
        flushForPersist() {},
        prepareForSavedLoad() {},
        exitFullscreen() {},
        isFullscreen() {
            return false;
        },
        resize() {},
        destroy() {},
    };
}

function dsaWireSketchEditorStudio(editorRoot, onChange, sketchOpts) {
    const hooks = sketchOpts || {};
    if (!editorRoot) {
        return dsaWireSketchEditorStudioStub();
    }
    if (!document.head.querySelector("link[data-dsa-sketch-studio-css]")) {
        const lk = document.createElement("link");
        lk.rel = "stylesheet";
        lk.href = "./dsa-sketch-studio.css?v=42";
        lk.dataset.dsaSketchStudioCss = "1";
        document.head.appendChild(lk);
    }

    editorRoot.innerHTML = "";
    const device = dsaDetectSketchDevice();
    editorRoot.classList.add(
        "dsa-sketch-studio-host",
        "dsa-sketch-studio-mount",
        device === "pc" ? "device-pc" : "device-mobile"
    );
    const mount = editorRoot;
    editorRoot.innerHTML = `'''

footer = '''
`;

    const eraserCursor = document.createElement("div");
    eraserCursor.className = "eraser-cursor";
    eraserCursor.id = "dsaSkEraserCursor";
    document.body.appendChild(eraserCursor);

'''

tail = '''
    return api;
}
'''

OUT.write_text(header + escaped + footer + LOGIC + tail)
print("Wrote", OUT, "bytes:", OUT.stat().st_size)
