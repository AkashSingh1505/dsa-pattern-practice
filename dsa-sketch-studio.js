/**
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
        lk.href = "./dsa-sketch-studio.css?v=20";
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
    editorRoot.innerHTML = `<div class="sketch-studio" id="dsaSkStudio">

  <div class="canvas-wrap" id="dsaSkCanvasWrap">
    <canvas id="dsaSkCanvas" width="2400" height="1800"></canvas>
    <canvas id="dsaSkLaserCanvas"></canvas>

    <!-- Table overlay -->
    <div class="table-overlay" id="dsaSkTableOverlay">
      <div class="table-grid" id="dsaSkTableGrid"></div>
      <button class="table-add t-add-col" data-table="col" data-delta="1">+</button>
      <button class="table-add t-del-col" data-table="col" data-delta="-1">−</button>
      <button class="table-add t-add-row" data-table="row" data-delta="1">+</button>
      <button class="table-add t-del-row" data-table="row" data-delta="-1">−</button>
      <div class="resize-handle" id="dsaSkTableResize"></div>
      <div class="table-controls">
        <button class="t-cancel" data-action="table-cancel">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
        <button class="t-confirm" data-action="table-confirm">
          <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
        </button>
      </div>
    </div>

<div class="image-overlay" id="dsaSkImageOverlay">
  <img id="dsaSkImagePreview" />
  <div class="resize-handle" id="dsaSkImageResize"></div>
  <div class="table-controls">
    <button class="t-cancel" data-action="table-cancel" title="Remove">
      <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
    <button class="t-confirm" data-action="image-confirm" title="Done">
      <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
    </button>
  </div>
</div>

    <!-- Text overlay -->
    <div class="text-overlay" id="dsaSkTextOverlay">
      <div class="text-drag-handle" id="dsaSkTextHandle"></div>
      <textarea id="dsaSkTextInput" placeholder="Type something..." rows="2"></textarea>

      <div class="table-controls">
  <button class="t-delete" id="dsaSkTextDeleteBtn" title="Delete" style="display:none;">
    <svg viewBox="0 0 24 24" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M3 6h18M19 6l-1.5 14a2 2 0 01-2 1.8H8.5a2 2 0 01-2-1.8L5 6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
  </button>
  <button class="t-cancel" data-action="text-cancel" title="Cancel">
    <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
  </button>
  <button class="t-confirm" data-action="text-confirm" title="Done">
    <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
  </button>
</div>

    </div>
  </div>

  <div class="top-toolbar">
    <button class="icon-btn" type="button" id="dsaSkBackBtn" title="Back">
      <svg viewBox="0 0 24 24" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
    </button>

    <!-- Centered top tools (PC only) -->
    <div class="top-tools-tab glass-pill" id="dsaSkTopToolsTab">
      <button title="Text" id="dsaSkTtText">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
      </button>
      <button title="Insert Table" id="dsaSkTtGrid">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
      </button>
      <button title="Attach" id="dsaSkTtAttach">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M21.4 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
      </button>
      <button title="Laser" id="dsaSkBtnLaserTop">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="#ff3b30"/><circle cx="12" cy="12" r="8" fill="none" stroke="#ff3b30" stroke-width="1.6" opacity="0.45"/></svg>
      </button>
    </div>

    <div class="toolbar-right">
      <div class="undo-redo-tab glass-pill" id="dsaSkUndoRedoTab">
        <button id="dsaSkUndoBtn" disabled>
          <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-15-6.7L3 13"/></svg>
        </button>
        <button id="dsaSkRedoBtn" disabled>
          <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0115-6.7L21 13"/></svg>
        </button>
      </div>

      <div class="menu-tab glass-pill">
        <button type="button" id="dsaSkMenuToggleBtn" title="More">
          <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6" fill="#1c1c1e"/><circle cx="12" cy="12" r="1.6" fill="#1c1c1e"/><circle cx="19" cy="12" r="1.6" fill="#1c1c1e"/></svg>
        </button>
        <button type="button" id="dsaSkMenuClearBtn" title="Clear">
          <svg viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6l-1.5 14a2 2 0 01-2 1.8H8.5a2 2 0 01-2-1.8L5 6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      </div>

      <button class="icon-btn minimize-btn" type="button" id="dsaSkMinimizeBtn" title="Minimize">
        <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>
      </button>

      <button class="done-btn" type="button" id="dsaSkDoneBtn" title="Done">
        <svg viewBox="0 0 24 24" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
      </button>
    </div>
  </div>

  <div class="menu-dropdown" id="dsaSkMenuDropdown">
    <div class="menu-item" id="dsaSkMenuExport">
      <span>Export as PNG</span>
      <svg viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5-5 5 5"/><path d="M12 5v12"/></svg>
    </div>
    <div class="menu-item" id="dsaSkMenuGrid">
      <span>Toggle Grid Canvas</span>
      <svg viewBox="0 0 24 24" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
    </div>
    <div class="menu-item" id="dsaSkMenuResetZoom">
      <span>Reset Zoom</span>
      <svg viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M8 11h6"/></svg>
    </div>
  </div>

  <div class="bottom-area">
    <div class="brush-settings" id="dsaSkBrushSettings">
      <div class="settings-row" id="dsaSkShapeRow" style="display:none;">
        <span class="settings-label">Shape</span>
        <div class="shape-options" id="dsaSkShapeOptions">
          <div class="shape-opt active" data-shape="rectangle"><svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="1"/></svg></div>
          <div class="shape-opt" data-shape="circle"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg></div>
          <div class="shape-opt" data-shape="triangle"><svg viewBox="0 0 24 24"><path d="M12 4l9 16H3z"/></svg></div>
          <div class="shape-opt" data-shape="line"><svg viewBox="0 0 24 24"><path d="M4 20L20 4"/></svg></div>
          <div class="shape-opt" data-shape="arrow"><svg viewBox="0 0 24 24"><path d="M4 20L20 4M20 4h-7M20 4v7"/></svg></div>
        </div>
      </div>
      <div class="settings-row">
        <span class="settings-label">Size</span>
        <div class="size-dots" id="dsaSkSizeDots"></div>
      </div>
      <div class="settings-row">
        <span class="settings-label">Opacity</span>
        <div class="opacity-slider" id="dsaSkOpacitySlider">
          <div class="opacity-track"></div>
          <div class="opacity-thumb" id="dsaSkOpacityThumb" style="left:100%"></div>
        </div>
      </div>
    </div>

    <div class="color-modal" id="dsaSkColorModal">
      <div class="swatches-grid" id="dsaSkSwatchesGrid"></div>
      <div class="color-mixer">
        <span class="mixer-label">Mixer</span>
        <div class="hue-slider" id="dsaSkHueSlider"><div class="hue-thumb" id="dsaSkHueThumb" style="left:0%"></div></div>
        <input type="color" class="native-color" id="dsaSkNativeColor" value="#1c1c1e">
      </div>
    </div>

    <div class="bottom-tab" id="dsaSkMainTab">
      <button class="tool-btn" id="dsaSkBtnPencil">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
      </button>
      <button class="tool-btn">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
      </button>
      <button class="tool-btn">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>
      </button>
      <button class="tool-btn">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M21.4 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
      </button>
      <div class="divider"></div>
      <button class="tool-btn" id="dsaSkBtnLaser">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="#ff3b30" stroke="#ff3b30"/><circle cx="12" cy="12" r="8" stroke="#ff3b30" fill="none" stroke-width="1.6" opacity="0.45"/></svg>
      </button>
    </div>

    <div class="brush-tray" id="dsaSkDrawTab" style="display:none;">
<div class="brushes-scroll">
      <div class="brush" data-brush="pen">
        <svg viewBox="0 0 60 90"><polygon points="30,88 22,72 38,72" fill="var(--bc, #1c1c1e)"/><rect x="20" y="68" width="20" height="5" fill="#c4c4c6"/><rect x="18" y="20" width="24" height="48" fill="#2c2c2e" rx="3"/><rect x="18" y="20" width="24" height="48" fill="url(#penGrad)" rx="3"/><rect x="20" y="10" width="20" height="12" fill="#1c1c1e" rx="3"/><rect x="18" y="58" width="24" height="8" fill="var(--bc, #1c1c1e)"/><defs><linearGradient id="penGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="rgba(255,255,255,0.18)"/><stop offset="0.5" stop-color="rgba(255,255,255,0)"/><stop offset="1" stop-color="rgba(0,0,0,0.25)"/></linearGradient></defs></svg>

      </div>
      <div class="brush" data-brush="pencil">
        <svg viewBox="0 0 60 90"><polygon points="30,88 24,78 36,78" fill="#2c2c2e"/><polygon points="22,70 38,70 36,78 24,78" fill="#f4d6a8"/><polygon points="30,72 36,78 24,78" fill="#dbb780" opacity="0.6"/><rect x="20" y="60" width="20" height="10" fill="#e8c547"/><rect x="20" y="62" width="20" height="1.5" fill="#a8881e"/><rect x="20" y="67" width="20" height="1.5" fill="#a8881e"/><rect x="20" y="14" width="20" height="46" fill="#f9c440"/><rect x="20" y="14" width="20" height="46" fill="url(#pcGrad)"/><rect x="20" y="10" width="20" height="6" fill="var(--bc, #ff3b30)" rx="2"/><defs><linearGradient id="pcGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="rgba(255,255,255,0.25)"/><stop offset="0.5" stop-color="rgba(255,255,255,0)"/><stop offset="1" stop-color="rgba(0,0,0,0.2)"/></linearGradient></defs></svg>

      </div>
      <div class="brush" data-brush="highlighter">
        <svg viewBox="0 0 60 90"><polygon points="18,88 42,88 39,76 21,76" fill="var(--bc, #ffeb3b)"/><rect x="16" y="64" width="28" height="13" fill="#2c2c2e" rx="3"/><rect x="14" y="14" width="32" height="50" fill="var(--bc, #ffeb3b)" rx="4"/><rect x="14" y="14" width="32" height="50" fill="url(#hgGrad)" rx="4"/><rect x="14" y="32" width="32" height="14" fill="rgba(255,255,255,0.55)"/><rect x="18" y="8" width="24" height="8" fill="#2c2c2e" rx="3"/><defs><linearGradient id="hgGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="rgba(255,255,255,0.35)"/><stop offset="0.5" stop-color="rgba(255,255,255,0)"/><stop offset="1" stop-color="rgba(0,0,0,0.18)"/></linearGradient></defs></svg>

      </div>
      <div class="brush" data-brush="eraser">
        <svg viewBox="0 0 60 90"><rect x="12" y="46" width="36" height="42" fill="#ffb3c1" rx="5"/><rect x="12" y="46" width="36" height="42" fill="url(#erGrad)" rx="5"/><rect x="12" y="14" width="36" height="34" fill="#f5f5f7" rx="5"/><rect x="12" y="14" width="36" height="34" fill="url(#erTop)" rx="5"/><polygon points="12,28 48,16 48,28 12,40" fill="#5ac8fa" opacity="0.85"/><defs><linearGradient id="erGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="rgba(255,255,255,0.35)"/><stop offset="0.5" stop-color="rgba(255,255,255,0)"/><stop offset="1" stop-color="rgba(0,0,0,0.18)"/></linearGradient><linearGradient id="erTop" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="rgba(0,0,0,0.06)"/><stop offset="0.5" stop-color="rgba(255,255,255,0.35)"/><stop offset="1" stop-color="rgba(0,0,0,0.12)"/></linearGradient></defs></svg>

      </div>
      <div class="brush" data-brush="shape">
        <svg viewBox="0 0 60 90"><rect x="14" y="14" width="32" height="60" rx="6" fill="#5856d6"/><rect x="14" y="14" width="32" height="60" rx="6" fill="url(#shGrad)"/><circle cx="24" cy="34" r="7" fill="#fff" opacity="0.9"/><rect x="32" y="28" width="12" height="12" fill="#fff" opacity="0.9" rx="2"/><polygon points="30,50 38,64 22,64" fill="#fff" opacity="0.9"/><defs><linearGradient id="shGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="rgba(255,255,255,0.25)"/><stop offset="0.5" stop-color="rgba(255,255,255,0)"/><stop offset="1" stop-color="rgba(0,0,0,0.2)"/></linearGradient></defs></svg>

      </div>
</div>

      <div class="divider"></div>
      <button class="color-btn" id="dsaSkColorBtn"></button>
      <button class="tray-btn" id="dsaSkBtnLaser2">
        <svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="#ff3b30"/><circle cx="12" cy="12" r="8" fill="none" stroke="#ff3b30" stroke-width="1.6" opacity="0.45"/></svg>
      </button>
      <button class="tray-btn" id="dsaSkBackBtnTray">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1c1c1e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </button>
    </div>
  </div>
</div>

`;

    const eraserCursor = document.createElement("div");
    eraserCursor.className = "eraser-cursor";
    eraserCursor.id = "dsaSkEraserCursor";
    document.body.appendChild(eraserCursor);

function $(id) { return mount.querySelector('#' + id); }

const canvas = $('dsaSkCanvas');
const ctx = canvas.getContext('2d');
ctx.lineCap = 'round';
ctx.lineJoin = 'round';
const laserCanvas = $('dsaSkLaserCanvas');
const lctx = laserCanvas.getContext('2d');

const state = {
  device: device,
  minimized: false,
  tool: null,
  brush: 'pen',
  shape: 'rectangle',
  color: '#1c1c1e',
  size: 3,
  opacity: 1,
  drawing: false,
  paths: [],
  redoStack: [],
  currentPath: null,
  laser: false,
  showGrid: false,
  scale: 1,
  panX: 0,
  panY: 0,
};

let destroyed = false;
const listeners = [];

function roBool() {
  return editorRoot.classList.contains('dsa-sketch-studio-host--ro');
}

function notifyChange() {
  onChange();
}

function getHasInk() {
  return state.paths.length > 0;
}

function syncInkFlag() {
  notifyChange();
}

let fsParent = null;
let fsNext = null;
let fsHideBackdrop = null;
let fsHideDlg = null;

function isBigScreen() {
  return device === 'pc';
}

function isFullscreen() {
  return editorRoot.classList.contains('dsa-sketch-studio-host--fullscreen');
}

function isNativeFullscreen() {
  const el = document.fullscreenElement || document.webkitFullscreenElement;
  return el === editorRoot || (el && editorRoot.contains(el));
}

function requestNativeFullscreen() {
  const req =
    editorRoot.requestFullscreen ||
    editorRoot.webkitRequestFullscreen ||
    editorRoot.msRequestFullscreen;
  if (req) {
    Promise.resolve(req.call(editorRoot)).catch(() => {});
  }
}

function exitNativeFullscreen() {
  const ex = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
  if (ex && isNativeFullscreen()) {
    Promise.resolve(ex.call(document)).catch(() => {});
  }
}

/** PC/iPad: top tools pill + brush tray. Mobile: bottom mainTab or brush tray; top back always visible. */
function syncToolbarUi() {
  const studio = $('dsaSkStudio');
  if (!studio) return;

  mount.classList.toggle('dsa-sk-state-fullscreen', isFullscreen());
  mount.classList.toggle('dsa-sk-state-minimized', !!state.minimized && !isFullscreen());
  mount.classList.toggle('dsa-sk-bottom-draw', !isBigScreen() && state.tool === 'pencil');
  mount.classList.toggle('dsa-sk-bottom-main', !isBigScreen() && state.tool !== 'pencil');
  /* iPad/PC: hide top back only when minimized (same toolbar as fullscreen otherwise) */
  mount.classList.toggle('dsa-sk-back-hidden', isBigScreen() && state.minimized && !isFullscreen());
}

function enterFullscreen() {
  if (isFullscreen() || roBool()) return;
  fsParent = editorRoot.parentNode;
  fsNext = editorRoot.nextSibling;
  fsHideBackdrop = editorRoot.closest('.dsa-dialog-backdrop');
  fsHideDlg = editorRoot.closest('.dsa-dialog');
  document.body.appendChild(editorRoot);
  editorRoot.classList.add('dsa-sketch-studio-host--fullscreen');
  const studio = $('dsaSkStudio');
  if (studio) {
    studio.classList.remove('minimized');
    state.minimized = false;
  }
  if (fsHideBackdrop) fsHideBackdrop.classList.add('dsa-sketch-fs-hide-dialog');
  if (fsHideDlg) fsHideDlg.classList.add('dsa-sketch-fs-hide-dialog');
  requestNativeFullscreen();
  syncToolbarUi();
  requestAnimationFrame(() => setTimeout(fitCanvas, 80));
}

function exitFullscreen() {
  if (!isFullscreen()) return;
  exitNativeFullscreen();
  if (fsHideBackdrop) fsHideBackdrop.classList.remove('dsa-sketch-fs-hide-dialog');
  if (fsHideDlg) fsHideDlg.classList.remove('dsa-sketch-fs-hide-dialog');
  fsHideBackdrop = null;
  fsHideDlg = null;
  editorRoot.classList.remove('dsa-sketch-studio-host--fullscreen');
  if (fsParent) {
    if (fsNext) fsParent.insertBefore(editorRoot, fsNext);
    else fsParent.appendChild(editorRoot);
  }
  fsParent = null;
  fsNext = null;
  syncToolbarUi();
  requestAnimationFrame(() => setTimeout(fitCanvas, 80));
}

function toggleMinimize() {
  if (roBool()) return;
  const studio = $('dsaSkStudio');
  if (!studio) return;
  if (isFullscreen()) {
    exitFullscreen();
    studio.classList.add('minimized');
    state.minimized = true;
    syncToolbarUi();
    setTimeout(fitCanvas, 480);
    return;
  }
  if (state.minimized) {
    enterFullscreen();
    return;
  }
  state.minimized = true;
  studio.classList.add('minimized');
  syncToolbarUi();
  setTimeout(fitCanvas, 480);
}

function onNativeFullscreenChange() {
  if (!isFullscreen()) return;
  if (!isNativeFullscreen()) {
    const studio = $('dsaSkStudio');
    if (fsHideBackdrop) fsHideBackdrop.classList.remove('dsa-sketch-fs-hide-dialog');
    if (fsHideDlg) fsHideDlg.classList.remove('dsa-sketch-fs-hide-dialog');
    fsHideBackdrop = null;
    fsHideDlg = null;
    editorRoot.classList.remove('dsa-sketch-studio-host--fullscreen');
    if (fsParent) {
      if (fsNext) fsParent.insertBefore(editorRoot, fsNext);
      else fsParent.appendChild(editorRoot);
    }
    fsParent = null;
    fsNext = null;
    if (studio) {
      studio.classList.add('minimized');
      state.minimized = true;
    }
    syncToolbarUi();
    setTimeout(fitCanvas, 480);
  }
}

function flushSketchDone() {
  if (roBool()) return;
  if (textOverlay && textOverlay.classList.contains('show')) confirmText();
  if (tableOverlay && tableOverlay.classList.contains('show')) confirmTable();
  if (imageOverlay && imageOverlay.classList.contains('show')) confirmImage();
  syncInkFlag();
  notifyChange();
  if (typeof hooks.onPersist === 'function') hooks.onPersist();
}

function addL(target, type, fn, opts) {
  target.addEventListener(type, fn, opts);
  listeners.push([target, type, fn, opts]);
}


function exportRenderedCanvas() {
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width;
  tmp.height = canvas.height;
  const tctx = tmp.getContext('2d');
  tctx.fillStyle = '#ffffff';
  tctx.fillRect(0, 0, tmp.width, tmp.height);
  if (state.showGrid) {
    tctx.strokeStyle = 'rgba(0,0,0,0.07)';
    tctx.lineWidth = 1;
    for (let x = 0; x <= tmp.width; x += 50) {
      tctx.beginPath();
      tctx.moveTo(x, 0);
      tctx.lineTo(x, tmp.height);
      tctx.stroke();
    }
    for (let y = 0; y <= tmp.height; y += 50) {
      tctx.beginPath();
      tctx.moveTo(0, y);
      tctx.lineTo(tmp.width, y);
      tctx.stroke();
    }
  }
  state.paths.forEach((p) => {
    tctx.save();
    if (p.type === 'image' && p.img) {
      tctx.drawImage(p.img, p.x, p.y, p.w, p.h);
    } else if (p.type === 'table') {
      tctx.strokeStyle = p.color || '#1c1c1e';
      tctx.lineWidth = p.size || 2;
      tctx.lineCap = 'square';
      tctx.strokeRect(p.x, p.y, p.w, p.h);
      for (let i = 1; i < p.cols; i++) {
        const x = p.x + (p.w / p.cols) * i;
        tctx.beginPath();
        tctx.moveTo(x, p.y);
        tctx.lineTo(x, p.y + p.h);
        tctx.stroke();
      }
      for (let i = 1; i < p.rows; i++) {
        const y = p.y + (p.h / p.rows) * i;
        tctx.beginPath();
        tctx.moveTo(p.x, y);
        tctx.lineTo(p.x + p.w, y);
        tctx.stroke();
      }
    } else if (p.type === 'text') {
      tctx.font = `${p.fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
      tctx.fillStyle = p.color;
      tctx.textBaseline = 'top';
      const lines = p.text.split('\\n');
      lines.forEach((line, i) => tctx.fillText(line, p.x, p.y + i * p.fontSize * 1.35));
    } else if (p.brush === 'shape') {
      applyStyle(p);
      drawShape(p);
    } else {
      applyStyle(p);
      strokePath(p.points);
    }
    tctx.restore();
  });
  if (state.currentPath) {
    tctx.save();
    applyStyle(state.currentPath);
    if (state.currentPath.brush === 'shape') drawShape(state.currentPath);
    else strokePath(state.currentPath.points);
    tctx.restore();
  }
  return tmp;
}

const pencilPatternCache = {};
function getPencilPattern(color) {
  if (pencilPatternCache[color]) return pencilPatternCache[color];
  const pc = document.createElement('canvas');
  pc.width = 4; pc.height = 4;
  const pctx = pc.getContext('2d');
  pctx.fillStyle = color;
  // scattered dots make a graphite-like grain
  pctx.fillRect(0, 0, 1, 1);
  pctx.fillRect(2, 1, 1, 1);
  pctx.fillRect(1, 3, 1, 1);
  pctx.fillRect(3, 2, 1, 1);
  const pat = ctx.createPattern(pc, 'repeat');
  pencilPatternCache[color] = pat;
  return pat;
}

function disableLaserIfOn() { if (state.laser) toggleLaser(); }

/* ============ CANVAS FIT ============ */
function fitCanvas() {
  const wrap = $('dsaSkCanvasWrap');
  // ✅ Canvas always fills the full visible area — no padding, no aspect fit
  canvas.style.width  = wrap.clientWidth  + 'px';
  canvas.style.height = wrap.clientHeight + 'px';
  state.scale = 1;
  state.panX = 0;
  state.panY = 0;
  applyCanvasTransform();
  redrawAll();
  syncLaserCanvas();
}

function applyCanvasTransform() {
  const t = `translate(calc(-50% + ${state.panX}px), calc(-50% + ${state.panY}px)) scale(${state.scale})`;
  canvas.style.transform = t;
  laserCanvas.style.transform = t;
}

function syncLaserCanvas() {
  laserCanvas.width = canvas.width;
  laserCanvas.height = canvas.height;
  laserCanvas.style.width = canvas.style.width;
  laserCanvas.style.height = canvas.style.height;
}
function resetZoom() {
  state.scale = 1; state.panX = 0; state.panY = 0;
  applyCanvasTransform();
  $('dsaSkMenuDropdown').classList.remove('show');
}

function getPoint(e, cv = canvas) {
  const r = cv.getBoundingClientRect();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: (cx - r.left) * (cv.width / r.width), y: (cy - r.top) * (cv.height / r.height) };
}

/* ============ DRAWING ============ */
function startDraw(e) {
  if (roBool()) return;
  if (state.laser) { startLaserStroke(e); return; }

  // Text tool: edit existing OR create new text at click
  if (state.tool === 'text') {
    if (e.touches && e.touches.length > 1) return;
    const pt = getPoint(e);
    const idx = findTextAt(pt.x, pt.y);
    if (idx >= 0) { e.preventDefault(); startTextEdit(idx); }
    else if (!textOverlay.classList.contains('show')) {
      e.preventDefault();
      const wrapEl = $('dsaSkCanvasWrap');
      const wrRect = wrapEl.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      startText(cx - wrRect.left - 90, cy - wrRect.top - 30);
    }
    return;
  }

  // No tool → click existing text to edit
  if (!state.tool) {
    const pt = getPoint(e);
    const idx = findTextAt(pt.x, pt.y);
    if (idx >= 0) {
      e.preventDefault();
      selectTool('text');
      setTimeout(() => startTextEdit(idx), 50);
      return;
    }
  }

  if (state.tool !== 'pencil') return;
  if (e.touches && e.touches.length > 1) return;
  e.preventDefault();
  state.drawing = true;
  state.currentPath = {
    brush: state.brush, color: state.color,
    size: state.size, opacity: state.opacity,
    shape: state.shape,
    points: [getPoint(e)]
  };
}
function moveDraw(e) {
  if (roBool()) return;
  if (state.laser) { continueLaserStroke(e); return; }
  if (!state.drawing) return;
  if (e.touches && e.touches.length > 1) { state.drawing = false; return; }
  e.preventDefault();
  state.currentPath.points.push(getPoint(e));
  drawIncremental();
}
function endDraw() {
  if (roBool()) { state.drawing = false; return; }
  if (state.laser) { endLaserStroke(); return; }
  if (!state.drawing) return;
  state.drawing = false;
  if (state.currentPath && state.currentPath.points.length > 1) {
    state.paths.push(state.currentPath);
    state.redoStack = [];
    updateUndoRedo();
    syncInkFlag();
  }
  state.currentPath = null;
}

function applyStyle(p) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = p.opacity;
  ctx.strokeStyle = p.color;
  ctx.lineWidth = p.size * 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (p.brush === 'highlighter') {
    ctx.globalAlpha = Math.min(p.opacity * 0.4, 0.4);
    ctx.lineWidth = p.size * 7;
    ctx.lineCap = 'butt';
  }  else if (p.brush === 'pencil') {
  ctx.globalAlpha = p.opacity;
  ctx.strokeStyle = getPencilPattern(p.color);
  ctx.lineWidth = p.size * 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
} else if (p.brush === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = p.size * 5;
    ctx.globalAlpha = 1;
  }
}
function strokePath(pts) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i].x + pts[i+1].x) / 2;
    const yc = (pts[i].y + pts[i+1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
  }
  ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
  ctx.stroke();
}
function drawShape(p) {
  if (p.points.length < 2) return;
  const a = p.points[0], b = p.points[p.points.length - 1];
  ctx.beginPath();
  if (p.shape === 'rectangle') ctx.rect(Math.min(a.x,b.x), Math.min(a.y,b.y), Math.abs(b.x-a.x), Math.abs(b.y-a.y));
  else if (p.shape === 'circle') {
    ctx.ellipse((a.x+b.x)/2, (a.y+b.y)/2, Math.abs(b.x-a.x)/2, Math.abs(b.y-a.y)/2, 0, 0, Math.PI*2);
  } else if (p.shape === 'triangle') {
    ctx.moveTo((a.x+b.x)/2, a.y); ctx.lineTo(a.x, b.y); ctx.lineTo(b.x, b.y); ctx.closePath();
  } else if (p.shape === 'line') {
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
  } else if (p.shape === 'arrow') {
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    const ang = Math.atan2(b.y-a.y, b.x-a.x);
    const len = Math.max(14, p.size*4);
    ctx.moveTo(b.x, b.y); ctx.lineTo(b.x-len*Math.cos(ang-Math.PI/6), b.y-len*Math.sin(ang-Math.PI/6));
    ctx.moveTo(b.x, b.y); ctx.lineTo(b.x-len*Math.cos(ang+Math.PI/6), b.y-len*Math.sin(ang+Math.PI/6));
  }
  ctx.stroke();
}
function drawTable(p) {
  ctx.strokeStyle = p.color || '#1c1c1e';
  ctx.lineWidth = p.size || 2;
  ctx.lineCap = 'square';
  ctx.strokeRect(p.x, p.y, p.w, p.h);
  for (let i = 1; i < p.cols; i++) {
    const x = p.x + (p.w / p.cols) * i;
    ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(x, p.y + p.h); ctx.stroke();
  }
  for (let i = 1; i < p.rows; i++) {
    const y = p.y + (p.h / p.rows) * i;
    ctx.beginPath(); ctx.moveTo(p.x, y); ctx.lineTo(p.x + p.w, y); ctx.stroke();
  }
}
function drawText(p) {
  ctx.font = `${p.fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
  ctx.fillStyle = p.color;
  ctx.textBaseline = 'top';
  const lines = p.text.split('\n');
  lines.forEach((line, i) => ctx.fillText(line, p.x, p.y + i * p.fontSize * 1.35));
}
function drawIncremental() {
  redrawAll();
  if (!state.currentPath) return;
  ctx.save();
  applyStyle(state.currentPath);
  if (state.currentPath.brush === 'shape') drawShape(state.currentPath);
  else strokePath(state.currentPath.points);
  ctx.restore();
}
function redrawAll() {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.restore();
  state.paths.forEach(p => {
    ctx.save();
 if (p.type === 'image') {
    ctx.drawImage(p.img, p.x, p.y, p.w, p.h);
  } else if (p.type === 'table') drawTable(p);
    else if (p.type === 'text') drawText(p);
    else if (p.brush === 'shape') { applyStyle(p); drawShape(p); }
    else { applyStyle(p); strokePath(p.points); }
    ctx.restore();
  });
}

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', moveDraw);
window.addEventListener('mouseup', endDraw);
canvas.addEventListener('touchstart', startDraw, { passive: false });
canvas.addEventListener('touchmove', moveDraw, { passive: false });
canvas.addEventListener('touchend', endDraw);

/* ============ LASER ============ */
let laserStrokes = [], currentLaserStroke = null, laserDrawing = false;
let laserAnimating = false, laserLastActivity = 0, laserGlobalAlpha = 1;

function startLaserStroke(e) {
  if (!state.laser) return;
  if (e.preventDefault) e.preventDefault();
  laserDrawing = true;
  laserLastActivity = performance.now();
  laserGlobalAlpha = 1;
  currentLaserStroke = { points: [getPoint(e, laserCanvas)] };
  laserStrokes.push(currentLaserStroke);
  startLaserLoop();
}
function continueLaserStroke(e) {
  if (!state.laser || !laserDrawing || !currentLaserStroke) return;
  if (e.preventDefault) e.preventDefault();
  currentLaserStroke.points.push(getPoint(e, laserCanvas));
  laserLastActivity = performance.now();
}
function endLaserStroke() {
  laserDrawing = false;
  laserLastActivity = performance.now();
  currentLaserStroke = null;
}
function drawLaserFrame() {
  lctx.clearRect(0, 0, laserCanvas.width, laserCanvas.height);
  const now = performance.now();
  const idle = now - laserLastActivity;
  if (!laserDrawing && idle > 800) {
    const t = Math.min(1, (idle - 800) / 400);
    laserGlobalAlpha = 1 - t;
    if (laserGlobalAlpha <= 0) { laserStrokes = []; laserGlobalAlpha = 1; return; }
  } else laserGlobalAlpha = 1;
  laserStrokes.forEach(s => {
    const pts = s.points;
    if (pts.length < 2) return;
    lctx.save();
    lctx.globalAlpha = laserGlobalAlpha;
    lctx.shadowColor = '#ff3b30'; lctx.shadowBlur = 28;
    lctx.strokeStyle = '#ff3b30'; lctx.lineWidth = 12;
    lctx.lineCap = 'round'; lctx.lineJoin = 'round';
    lctx.beginPath();
    lctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const xc = (pts[i].x + pts[i+1].x) / 2;
      const yc = (pts[i].y + pts[i+1].y) / 2;
      lctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
    }
    lctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
    lctx.stroke();
    lctx.shadowBlur = 0;
    lctx.strokeStyle = '#ffffff'; lctx.lineWidth = 4.5;
    lctx.stroke();
    lctx.restore();
  });
}
function startLaserLoop() {
  if (laserAnimating) return;
  laserAnimating = true;
  const loop = () => {
    if (!state.laser && laserStrokes.length === 0) {
      lctx.clearRect(0, 0, laserCanvas.width, laserCanvas.height);
      laserAnimating = false; return;
    }
    drawLaserFrame();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
function toggleLaser() {
  state.laser = !state.laser;
  ['dsaSkBtnLaser', 'dsaSkBtnLaser2', 'dsaSkBtnLaserTop'].forEach((id) => {
    const el = $(id);
    if (el) el.classList.toggle('active', state.laser);
  });
  if (state.laser) {
    cancelTable(); cancelText();
    $('dsaSkBrushSettings').classList.remove('show');
    document.querySelectorAll('#dsaSkTopToolsTab button').forEach(b => { if (b.id !== 'dsaSkBtnLaserTop') b.classList.remove('active'); });
    document.querySelectorAll('.brush').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#dsaSkMainTab .tool-btn').forEach(b => b.classList.remove('active'));
    state.tool = null;
    syncLaserCanvas();
    laserLastActivity = performance.now();
    laserGlobalAlpha = 1;
    startLaserLoop();
  } else {
    laserStrokes = []; currentLaserStroke = null;
    lctx.clearRect(0, 0, laserCanvas.width, laserCanvas.height);
  }
}

/* ============ ZOOM + PAN ============ */
let pinchDist = null;
let pinchCenter = null;
const wrap = $('dsaSkCanvasWrap');

wrap.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    pinchDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    pinchCenter = {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2
    };
  }
});

wrap.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && pinchDist) {
    e.preventDefault();
    const d = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const c = {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2
    };
    state.scale = Math.max(0.3, Math.min(4, state.scale * (d / pinchDist)));
    state.panX += c.x - pinchCenter.x;
    state.panY += c.y - pinchCenter.y;
    applyCanvasTransform();
    pinchDist = d;
    pinchCenter = c;
  }
});
wrap.addEventListener('touchend', () => { pinchDist = null; pinchCenter = null; });

wrap.addEventListener('wheel', (e) => {
  e.preventDefault();
  // ✅ Normal zoom: scroll up = bigger, scroll down = smaller (more empty area)
  const factor = e.deltaY > 0 ? 0.92 : 1.08;
  state.scale = Math.max(0.3, Math.min(4, state.scale * factor));
  applyCanvasTransform();
}, { passive: false });
/* ============ Space-bar + mouse drag to pan on desktop: ============ */

let spaceDown = false, panDrag = null;
document.addEventListener('keydown', (e) => { if (e.code === 'Space') spaceDown = true; });
document.addEventListener('keyup', (e) => { if (e.code === 'Space') spaceDown = false; });

wrap.addEventListener('mousedown', (e) => {
  if (spaceDown || e.button === 1) {
    panDrag = { sx: e.clientX, sy: e.clientY, px: state.panX, py: state.panY };
    e.preventDefault();
  }
});
document.addEventListener('mousemove', (e) => {
  if (!panDrag) return;
  state.panX = panDrag.px + (e.clientX - panDrag.sx);
  state.panY = panDrag.py + (e.clientY - panDrag.sy);
  applyCanvasTransform();
});
document.addEventListener('mouseup', () => { panDrag = null; });

/* ============ ERASER CURSOR ============ */
function eraserActive() {
  return state.tool === 'pencil' && state.brush === 'eraser' && !state.laser;
}

function updateEraserCursorSize() {
  const cvRect = canvas.getBoundingClientRect();
  const ratio = cvRect.width / canvas.width;
  const cssSize = state.size * 5 * ratio * state.scale;
  eraserCursor.style.width  = cssSize + 'px';
  eraserCursor.style.height = cssSize + 'px';
}

function moveEraserCursor(e) {
  if (!eraserActive()) {
    eraserCursor.classList.remove('show');
    canvas.classList.remove('eraser-mode');
    return;
  }
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  updateEraserCursorSize();
  eraserCursor.style.left = cx + 'px';
  eraserCursor.style.top  = cy + 'px';
  eraserCursor.classList.add('show');
  canvas.classList.add('eraser-mode');
}

canvas.addEventListener('mousemove', moveEraserCursor);
canvas.addEventListener('mouseenter', moveEraserCursor);
canvas.addEventListener('mouseleave', () => eraserCursor.classList.remove('show'));
canvas.addEventListener('touchmove', moveEraserCursor, { passive: true });
canvas.addEventListener('touchend',  () => eraserCursor.classList.remove('show'));
// 👆 END OF ERASER CURSOR BLOCK 👆

/* ============ TOOL SELECTION ============ */
function selectTool(tool) {
  disableLaserIfOn();

  // Same tool → deactivate
  if (state.tool === tool) {
    if (tool === 'text') cancelText();
    if (tool === 'grid') cancelTable();
    if (tool === 'pencil' && !isBigScreen()) {
      $('dsaSkDrawTab').style.display = 'none';
      $('dsaSkMainTab').style.display = 'flex';
    }
    $('dsaSkBrushSettings').classList.remove('show');
    document.querySelectorAll('.brush').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#dsaSkTopToolsTab button').forEach(b => { if (b.id !== 'dsaSkBtnLaserTop') b.classList.remove('active'); });
    document.querySelectorAll('#dsaSkMainTab .tool-btn').forEach(b => b.classList.remove('active'));
    state.tool = null;
    syncToolbarUi();
    return;
  }

  // Deactivate everything else
  cancelTable();
  cancelText();
  $('dsaSkBrushSettings').classList.remove('show');
  document.querySelectorAll('.brush').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#dsaSkMainTab .tool-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#dsaSkTopToolsTab button').forEach(b => { if (b.id !== 'dsaSkBtnLaserTop') b.classList.remove('active'); });

  if (tool === 'pencil') {
    state.tool = 'pencil';
    $('dsaSkBtnPencil')?.classList.add('active');
    activateBrush(state.brush);
  } else if (tool === 'text') {
    state.tool = 'text';
    $('dsaSkTtText')?.classList.add('active');
    startText();
  } else if (tool === 'grid') {
    state.tool = 'grid';
    $('dsaSkTtGrid')?.classList.add('active');
    startTable();
  } else if (tool === 'attach') {
  $('dsaSkTtAttach')?.classList.add('active');
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = (ee) => startImage(ee.target.result);
    r.readAsDataURL(f);
  };
  input.click();
}
  syncToolbarUi();
}

function backToMain() {
  $('dsaSkBrushSettings').classList.remove('show');
  $('dsaSkColorModal').classList.remove('show');
  document.querySelectorAll('.brush').forEach(b => b.classList.remove('active'));
  state.tool = null;
  syncToolbarUi();
}

/* Activate brush without showing settings */
function activateBrush(brush) {
  state.brush = brush;
  document.querySelectorAll('.brush').forEach(b => b.classList.toggle('active', b.dataset.brush === brush));
  $('dsaSkShapeRow').style.display = brush === 'shape' ? 'flex' : 'none';
  buildSizeDots();
  updateBrushColors();
  // ✅ refresh eraser cursor state
  if (!eraserActive()) {
    eraserCursor.classList.remove('show');
    canvas.classList.remove('eraser-mode');
  }
  updateEraserCursorSize();
}
/* User clicks brush → toggle settings panel */

function selectBrush(brush) {
  disableLaserIfOn();
  state.tool = 'pencil';                                    // ✅ ensure drawing works
  // also clear top tools highlight
  document.querySelectorAll('#dsaSkTopToolsTab button').forEach(b => {
    if (b.id !== 'dsaSkBtnLaserTop') b.classList.remove('active');
  });

  const settings = $('dsaSkBrushSettings');
  const sameBrush = state.brush === brush &&
    document.querySelector(`.brush[data-brush="${brush}"]`)?.classList.contains('active');
  const wasVisible = settings.classList.contains('show');

  activateBrush(brush);

  // ✅ Settings panel ONLY toggles when clicking same active brush
  if (sameBrush) {
    if (wasVisible) settings.classList.remove('show');
    else settings.classList.add('show');
  } else {
    settings.classList.remove('show');
  }
  syncToolbarUi();
}

function updateBrushColors() {
  document.querySelectorAll('.brush').forEach(b => {
    if (b.dataset.brush !== 'eraser' && b.dataset.brush !== 'shape') {
      b.style.setProperty('--bc', state.color);
    }
  });
  $('dsaSkColorBtn').style.background = state.color;
}

document.querySelectorAll('.shape-opt').forEach(opt => {
  opt.onclick = () => {
    document.querySelectorAll('.shape-opt').forEach(o => o.classList.remove('active'));
    opt.classList.add('active');
    state.shape = opt.dataset.shape;
  };
});

/* ============ BRUSH SETTINGS UI ============ */
function buildSizeDots() {
  const c = $('dsaSkSizeDots');
  const sizes = [1, 2, 3, 5, 8, 12];
  c.innerHTML = '';
  sizes.forEach(s => {
    const dot = document.createElement('div');
    dot.className = 'size-dot';
    if (s === state.size) dot.classList.add('active');
    const inner = document.createElement('div');
    inner.className = 'size-dot-inner';
    const v = Math.min(s * 1.8 + 4, 22);
    inner.style.width = v + 'px';
    inner.style.height = v + 'px';
    inner.style.background = state.brush === 'eraser' ? '#999' : state.color;
    dot.appendChild(inner);
    dot.onclick = () => { state.size = s; buildSizeDots(); };
    c.appendChild(dot);
  });
}
const opSlider = $('dsaSkOpacitySlider');
const opThumb = $('dsaSkOpacityThumb');
let dragOp = false;
function setOpacity(cx) {
  const r = opSlider.getBoundingClientRect();
  let pct = Math.max(0.1, Math.min(1, (cx - r.left) / r.width));
  state.opacity = pct;
  opThumb.style.left = (pct * 100) + '%';
}
opSlider.addEventListener('mousedown', (e) => { dragOp = true; setOpacity(e.clientX); });
document.addEventListener('mousemove', (e) => { if (dragOp) setOpacity(e.clientX); });
document.addEventListener('mouseup', () => { dragOp = false; });
opSlider.addEventListener('touchstart', (e) => { dragOp = true; setOpacity(e.touches[0].clientX); });
opSlider.addEventListener('touchmove', (e) => { if (dragOp) { setOpacity(e.touches[0].clientX); e.preventDefault(); } }, { passive: false });
opSlider.addEventListener('touchend', () => { dragOp = false; });

/* ============ COLOR PALETTE ============ */
const colors = ['#1c1c1e','#5a5a5a','#9b9b9b','#ffffff','#ff3b30','#ff9500','#ffcc00','#34c759','#00c7be','#007aff','#5856d6','#af52de','#ff2d55','#a2845e','#8e8e93','#5a3825'];
function buildColorPicker() {
  const m = $('dsaSkSwatchesGrid');
  m.innerHTML = '';
  colors.forEach(c => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch';
    if (c === '#ffffff') sw.classList.add('white-sw');
    sw.style.background = c;
    if (c.toLowerCase() === state.color.toLowerCase()) sw.classList.add('active');
    sw.onclick = () => applyColor(c);
    m.appendChild(sw);
  });
}
function applyColor(c) {
  state.color = c;
  buildColorPicker(); buildSizeDots(); updateBrushColors();
  const nc = $('dsaSkNativeColor');
  if (nc) nc.value = c.length === 7 ? c : '#1c1c1e';
}
buildColorPicker();
function toggleColorPicker(e) {
  if (e) e.stopPropagation();
  $('dsaSkColorModal').classList.toggle('show');
}
const hueSlider = $('dsaSkHueSlider');
const hueThumb = $('dsaSkHueThumb');
let dragHue = false;
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = x => Math.round(255 * x).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}
function setHue(cx) {
  const r = hueSlider.getBoundingClientRect();
  let pct = Math.max(0, Math.min(1, (cx - r.left) / r.width));
  hueThumb.style.left = (pct * 100) + '%';
  applyColor(hslToHex(pct * 360, 90, 50));
}
hueSlider.addEventListener('mousedown', (e) => { dragHue = true; setHue(e.clientX); });
document.addEventListener('mousemove', (e) => { if (dragHue) setHue(e.clientX); });
document.addEventListener('mouseup', () => { dragHue = false; });
hueSlider.addEventListener('touchstart', (e) => { dragHue = true; setHue(e.touches[0].clientX); });
hueSlider.addEventListener('touchmove', (e) => { if (dragHue) { setHue(e.touches[0].clientX); e.preventDefault(); } }, { passive: false });
hueSlider.addEventListener('touchend', () => { dragHue = false; });
$('dsaSkNativeColor').addEventListener('input', (e) => applyColor(e.target.value));

/* ============ TABLE TOOL ============ */
const tableState = { rows: 3, cols: 3, x: 0, y: 0, w: 320, h: 220 };
const tableOverlay = $('dsaSkTableOverlay');
const tableGrid = $('dsaSkTableGrid');
const tableResize = $('dsaSkTableResize');

function startTable() {
  disableLaserIfOn();
  const wrapEl = $('dsaSkCanvasWrap');
  tableState.w = 320; tableState.h = 220;
  tableState.x = (wrapEl.clientWidth - tableState.w) / 2;
  tableState.y = (wrapEl.clientHeight - tableState.h) / 2;
  tableState.rows = 3; tableState.cols = 3;
  renderTable();
  tableOverlay.classList.add('show');
}
function renderTable() {
  tableOverlay.style.left = tableState.x + 'px';
  tableOverlay.style.top = tableState.y + 'px';
  tableOverlay.style.width = tableState.w + 'px';
  tableOverlay.style.height = tableState.h + 'px';
  tableGrid.style.gridTemplateColumns = `repeat(${tableState.cols}, 1fr)`;
  tableGrid.style.gridTemplateRows = `repeat(${tableState.rows}, 1fr)`;
  tableGrid.innerHTML = '';
  for (let i = 0; i < tableState.rows * tableState.cols; i++) {
    const cell = document.createElement('div');
    cell.className = 'table-cell';
    tableGrid.appendChild(cell);
  }
}
function changeTable(kind, delta) {
  if (kind === 'col') tableState.cols = Math.max(1, Math.min(12, tableState.cols + delta));
  else tableState.rows = Math.max(1, Math.min(12, tableState.rows + delta));
  renderTable();
}
function cancelTable() {
  tableOverlay.classList.remove('show');
  $('dsaSkTtGrid')?.classList.remove('active');
  if (state.tool === 'grid') state.tool = null;
}
function confirmTable() {
  const wrapEl = $('dsaSkCanvasWrap');
  const cvRect = canvas.getBoundingClientRect();
  const wrRect = wrapEl.getBoundingClientRect();
  const sx = canvas.width / cvRect.width;
  const sy = canvas.height / cvRect.height;
  state.paths.push({
    type: 'table',
    x: (tableState.x + wrRect.left - cvRect.left) * sx,
    y: (tableState.y + wrRect.top - cvRect.top) * sy,
    w: tableState.w * sx, h: tableState.h * sy,
    rows: tableState.rows, cols: tableState.cols,
    color: '#1c1c1e', size: 2
  });
  state.redoStack = [];
  updateUndoRedo();
  redrawAll();
  syncInkFlag();
  cancelTable();
}
let tDrag = null;
tableOverlay.addEventListener('mousedown', (e) => {
  if (e.target === tableResize || e.target.closest('button')) return;
  tDrag = { mode: 'move', sx: e.clientX, sy: e.clientY, ox: tableState.x, oy: tableState.y };
  e.preventDefault();
});
tableResize.addEventListener('mousedown', (e) => {
  tDrag = { mode: 'resize', sx: e.clientX, sy: e.clientY, ow: tableState.w, oh: tableState.h };
  e.stopPropagation(); e.preventDefault();
});
document.addEventListener('mousemove', (e) => {
  if (!tDrag) return;
  if (tDrag.mode === 'move') {
    tableState.x = tDrag.ox + (e.clientX - tDrag.sx);
    tableState.y = tDrag.oy + (e.clientY - tDrag.sy);
  } else {
    tableState.w = Math.max(120, tDrag.ow + (e.clientX - tDrag.sx));
    tableState.h = Math.max(100, tDrag.oh + (e.clientY - tDrag.sy));
  }
  renderTable();
});
document.addEventListener('mouseup', () => { tDrag = null; });
tableOverlay.addEventListener('touchstart', (e) => {
  if (e.target === tableResize || e.target.closest('button')) return;
  const t = e.touches[0];
  tDrag = { mode: 'move', sx: t.clientX, sy: t.clientY, ox: tableState.x, oy: tableState.y };
}, { passive: true });
tableResize.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  tDrag = { mode: 'resize', sx: t.clientX, sy: t.clientY, ow: tableState.w, oh: tableState.h };
  e.stopPropagation();
}, { passive: true });
document.addEventListener('touchmove', (e) => {
  if (!tDrag) return;
  const t = e.touches[0];
  if (tDrag.mode === 'move') {
    tableState.x = tDrag.ox + (t.clientX - tDrag.sx);
    tableState.y = tDrag.oy + (t.clientY - tDrag.sy);
  } else {
    tableState.w = Math.max(120, tDrag.ow + (t.clientX - tDrag.sx));
    tableState.h = Math.max(100, tDrag.oh + (t.clientY - tDrag.sy));
  }
  renderTable();
});
document.addEventListener('touchend', () => { tDrag = null; });

/* ============ Click-outside to confirm overlays ============ */
document.addEventListener('mousedown', (e) => {
  // Image overlay → confirm on outside click
  if (imageOverlay.classList.contains('show') &&
      !imageOverlay.contains(e.target)) {
    confirmImage();
    return;
  }
  // Table overlay → confirm on outside click
  if (tableOverlay.classList.contains('show') &&
      !tableOverlay.contains(e.target)) {
    confirmTable();
    return;
  }
}, true);  // ✅ capture phase — runs before canvas draw handler

document.addEventListener('touchstart', (e) => {
  if (imageOverlay.classList.contains('show') &&
      !imageOverlay.contains(e.target)) {
    confirmImage();
    return;
  }
  if (tableOverlay.classList.contains('show') &&
      !tableOverlay.contains(e.target)) {
    confirmTable();
    return;
  }
}, true);

/* ============ TEXT TOOL ============ */
const textState = { x: 100, y: 100, fontSize: 24, color: '#1c1c1e', editingIndex: -1 };
const textOverlay = $('dsaSkTextOverlay');
const textInput = $('dsaSkTextInput');
const textHandle = $('dsaSkTextHandle');

function startText(x, y) {
  disableLaserIfOn();
  const wrapEl = $('dsaSkCanvasWrap');
  textState.x = (x !== undefined) ? x : (wrapEl.clientWidth/2 - 100);
  textState.y = (y !== undefined) ? y : (wrapEl.clientHeight/2 - 30);
  textState.fontSize = 24;
  textState.color = state.color || '#1c1c1e';
  textState.editingIndex = -1;
  textInput.value = '';
  renderTextOverlay();
  textOverlay.classList.add('show');
$('dsaSkTextDeleteBtn').style.display = 'none';   // 👈 ADD
  setTimeout(() => textInput.focus(), 60);

}
function deleteText() {
  if (textState.editingIndex >= 0) {
    state.paths.splice(textState.editingIndex, 1);
    state.redoStack = [];
    updateUndoRedo();
    redrawAll();
  }
  cancelText();
}
function startTextEdit(idx) {
  const p = state.paths[idx];
  if (!p || p.type !== 'text') return;
  const wrapEl = $('dsaSkCanvasWrap');
  const cvRect = canvas.getBoundingClientRect();
  const wrRect = wrapEl.getBoundingClientRect();
  const sx = cvRect.width / canvas.width;
  const sy = cvRect.height / canvas.height;
  textState.x = p.x * sx + (cvRect.left - wrRect.left) - 16;
  textState.y = p.y * sy + (cvRect.top - wrRect.top) - 12;
  textState.fontSize = p.fontSize * sy;
  textState.color = p.color;
  textState.editingIndex = idx;
  textInput.value = p.text;
  renderTextOverlay();
  textOverlay.classList.add('show');
$('dsaSkTextDeleteBtn').style.display = 'flex';   // 👈 ADD
  setTimeout(() => { textInput.focus(); textInput.select(); }, 60);
}
function renderTextOverlay() {
  textOverlay.style.left = textState.x + 'px';
  textOverlay.style.top = textState.y + 'px';
  textInput.style.fontSize = textState.fontSize + 'px';
  textInput.style.color = textState.color;
}
function cancelText() {
  textOverlay.classList.remove('show');
  $('dsaSkTtText')?.classList.remove('active');
  textState.editingIndex = -1;
  if (state.tool === 'text') state.tool = null;
}
function confirmText() {
  const txt = textInput.value.trim();
  if (!txt) { cancelText(); return; }
  if (textState.editingIndex >= 0) state.paths.splice(textState.editingIndex, 1);
  const wrapEl = $('dsaSkCanvasWrap');
  const cvRect = canvas.getBoundingClientRect();
  const wrRect = wrapEl.getBoundingClientRect();
  const sx = canvas.width / cvRect.width;
  const sy = canvas.height / cvRect.height;
  const cx = (textState.x + wrRect.left - cvRect.left + 16) * sx;
  const cy = (textState.y + wrRect.top - cvRect.top + 12) * sy;
  const fontPx = textState.fontSize * sy;
  ctx.font = `${fontPx}px -apple-system, sans-serif`;
  const lines = txt.split('\n');
  let maxW = 0;
  lines.forEach(l => maxW = Math.max(maxW, ctx.measureText(l).width));
  state.paths.push({
    type: 'text', x: cx, y: cy, text: txt,
    fontSize: fontPx, color: textState.color,
    width: maxW, height: lines.length * fontPx * 1.35
  });
  state.redoStack = [];
  updateUndoRedo();
  redrawAll();
  syncInkFlag();
  cancelText();
}
function findTextAt(x, y) {
  for (let i = state.paths.length - 1; i >= 0; i--) {
    const p = state.paths[i];
    if (p.type !== 'text') continue;
    const w = p.width || 100;
    const h = p.height || (p.fontSize * 1.4);
    if (x >= p.x - 4 && x <= p.x + w + 8 && y >= p.y - 4 && y <= p.y + h + 4) return i;
  }
  return -1;
}
let textDrag = null;
textHandle.addEventListener('mousedown', (e) => {
  textDrag = { sx: e.clientX, sy: e.clientY, ox: textState.x, oy: textState.y };
  e.preventDefault(); e.stopPropagation();
});
textHandle.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  textDrag = { sx: t.clientX, sy: t.clientY, ox: textState.x, oy: textState.y };
  e.stopPropagation();
}, { passive: true });
document.addEventListener('mousemove', (e) => {
  if (!textDrag) return;
  textState.x = textDrag.ox + (e.clientX - textDrag.sx);
  textState.y = textDrag.oy + (e.clientY - textDrag.sy);
  renderTextOverlay();
});
document.addEventListener('touchmove', (e) => {
  if (!textDrag) return;
  const t = e.touches[0];
  textState.x = textDrag.ox + (t.clientX - textDrag.sx);
  textState.y = textDrag.oy + (t.clientY - textDrag.sy);
  renderTextOverlay();
});
document.addEventListener('mouseup', () => { textDrag = null; });
document.addEventListener('touchend', () => { textDrag = null; });

/* ============ UNDO / REDO ============ */
function undo() {
  if (!state.paths.length) return;
  state.redoStack.push(state.paths.pop());
  redrawAll(); updateUndoRedo(); syncInkFlag();
}
function redo() {
  if (!state.redoStack.length) return;
  state.paths.push(state.redoStack.pop());
  redrawAll(); updateUndoRedo(); syncInkFlag();
}
function updateUndoRedo() {
  const tab = $('dsaSkUndoRedoTab');
  tab.classList.toggle('visible', state.paths.length > 0 || state.redoStack.length > 0);
  $('dsaSkUndoBtn').disabled = state.paths.length === 0;
  $('dsaSkRedoBtn').disabled = state.redoStack.length === 0;
}

/* ============ MENU ============ */
function toggleMenu(e) {
  e.stopPropagation();
  $('dsaSkMenuDropdown').classList.toggle('show');
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-tab') && !e.target.closest('.menu-dropdown')) {
    $('dsaSkMenuDropdown').classList.remove('show');
  }
  if (!e.target.closest('#dsaSkColorModal') && !e.target.closest('#dsaSkColorBtn')) {
    $('dsaSkColorModal').classList.remove('show');
  }
});
function toggleGridBg() {
  state.showGrid = !state.showGrid;
  canvas.classList.toggle('show-grid', state.showGrid);   // ✅ CSS-based grid
  $('dsaSkMenuDropdown').classList.remove('show');
}
function exportImg() {
  // Build a temp canvas with grid (if on) + drawing
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width;
  tmp.height = canvas.height;
  const tctx = tmp.getContext('2d');
  tctx.fillStyle = '#ffffff';
  tctx.fillRect(0, 0, tmp.width, tmp.height);
  if (state.showGrid) {
    tctx.strokeStyle = 'rgba(0,0,0,0.07)';
    tctx.lineWidth = 1;
    for (let x = 0; x <= tmp.width; x += 50) {
      tctx.beginPath(); tctx.moveTo(x, 0); tctx.lineTo(x, tmp.height); tctx.stroke();
    }
    for (let y = 0; y <= tmp.height; y += 50) {
      tctx.beginPath(); tctx.moveTo(0, y); tctx.lineTo(tmp.width, y); tctx.stroke();
    }
  }
  tctx.drawImage(canvas, 0, 0);
  const a = document.createElement('a');
  a.download = 'sketch.png';
  a.href = tmp.toDataURL('image/png');
  a.click();
  $('dsaSkMenuDropdown').classList.remove('show');
}function clearCanvas() {
  if (!state.paths.length) return;
  if (!confirm('Clear all drawing?')) return;
  state.paths = []; state.redoStack = [];
  redrawAll(); updateUndoRedo(); syncInkFlag();
  if (typeof hooks.afterClear === 'function') hooks.afterClear();
}


/* ============ IMAGE TOOL ============ */
const imageState = { x: 0, y: 0, w: 300, h: 300, src: '' };
const imageOverlay = $('dsaSkImageOverlay');
const imagePreview = $('dsaSkImagePreview');
const imageResize = $('dsaSkImageResize');

function startImage(src) {
  disableLaserIfOn();
  imageState.src = src;
  imagePreview.src = src;
  const img = new Image();
  img.onload = () => {
    const wrapEl = $('dsaSkCanvasWrap');
    const maxW = wrapEl.clientWidth * 0.5;
    const maxH = wrapEl.clientHeight * 0.5;
    let w = img.width, h = img.height;
    if (w > maxW) { h *= maxW / w; w = maxW; }
    if (h > maxH) { w *= maxH / h; h = maxH; }
    imageState.w = w; imageState.h = h;
    imageState.x = (wrapEl.clientWidth - w) / 2;
    imageState.y = (wrapEl.clientHeight - h) / 2;
    renderImage();
    imageOverlay.classList.add('show');
  };
  img.src = src;
}
function renderImage() {
  imageOverlay.style.left = imageState.x + 'px';
  imageOverlay.style.top = imageState.y + 'px';
  imageOverlay.style.width = imageState.w + 'px';
  imageOverlay.style.height = imageState.h + 'px';
}
function cancelImage() {
  imageOverlay.classList.remove('show');
  $('dsaSkTtAttach')?.classList.remove('active');
}
function confirmImage() {
  const wrapEl = $('dsaSkCanvasWrap');
  const cvRect = canvas.getBoundingClientRect();
  const wrRect = wrapEl.getBoundingClientRect();
  const sx = canvas.width / cvRect.width;
  const sy = canvas.height / cvRect.height;

  const img = new Image();
  let done = false;
  const finalize = () => {
    if (done) return;
    done = true;
    state.paths.push({
      type: 'image',
      x: (imageState.x + wrRect.left - cvRect.left) * sx,
      y: (imageState.y + wrRect.top - cvRect.top) * sy,
      w: imageState.w * sx,
      h: imageState.h * sy,
      img
    });
    state.redoStack = [];
    updateUndoRedo();
    redrawAll();
    syncInkFlag();
    cancelImage();
  };
  img.onload = finalize;
  img.onerror = () => cancelImage();
  img.src = imageState.src;
  // ✅ If the image was cached and loaded synchronously, onload may not fire
  if (img.complete && img.naturalWidth > 0) finalize();
}let imgDrag = null;
imageOverlay.addEventListener('mousedown', (e) => {
  if (e.target === imageResize || e.target.closest('button')) return;
  imgDrag = { mode: 'move', sx: e.clientX, sy: e.clientY, ox: imageState.x, oy: imageState.y };
  e.preventDefault();
});
imageResize.addEventListener('mousedown', (e) => {
  imgDrag = { mode: 'resize', sx: e.clientX, sy: e.clientY, ow: imageState.w, oh: imageState.h };
  e.stopPropagation(); e.preventDefault();
});
document.addEventListener('mousemove', (e) => {
  if (!imgDrag) return;
  if (imgDrag.mode === 'move') {
    imageState.x = imgDrag.ox + (e.clientX - imgDrag.sx);
    imageState.y = imgDrag.oy + (e.clientY - imgDrag.sy);
  } else {
    imageState.w = Math.max(40, imgDrag.ow + (e.clientX - imgDrag.sx));
    imageState.h = Math.max(40, imgDrag.oh + (e.clientY - imgDrag.sy));
  }
  renderImage();
});
document.addEventListener('mouseup', () => { imgDrag = null; });
imageOverlay.addEventListener('touchstart', (e) => {
  if (e.target === imageResize || e.target.closest('button')) return;
  const t = e.touches[0];
  imgDrag = { mode: 'move', sx: t.clientX, sy: t.clientY, ox: imageState.x, oy: imageState.y };
}, { passive: true });
imageResize.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  imgDrag = { mode: 'resize', sx: t.clientX, sy: t.clientY, ow: imageState.w, oh: imageState.h };
  e.stopPropagation();
}, { passive: true });
document.addEventListener('touchmove', (e) => {
  if (!imgDrag) return;
  const t = e.touches[0];
  if (imgDrag.mode === 'move') {
    imageState.x = imgDrag.ox + (t.clientX - imgDrag.sx);
    imageState.y = imgDrag.oy + (t.clientY - imgDrag.sy);
  } else {
    imageState.w = Math.max(40, imgDrag.ow + (t.clientX - imgDrag.sx));
    imageState.h = Math.max(40, imgDrag.oh + (t.clientY - imgDrag.sy));
  }
  renderImage();
});
document.addEventListener('touchend', () => { imgDrag = null; });

/* ============ WIRE UI (no inline handlers) ============ */
const studioEl = $('dsaSkStudio');
studioEl.style.display = 'flex';

if (device === 'pc') {
  studioEl.classList.add('minimized');
  state.minimized = true;
  state.tool = 'pencil';
  activateBrush('pen');
} else {
  state.tool = null;
}

const backBtn = $('dsaSkBackBtn');
if (backBtn) {
  addL(backBtn, 'click', () => {
    if (!isBigScreen() && state.tool === 'pencil') {
      backToMain();
      return;
    }
    if (isFullscreen()) {
      toggleMinimize();
      return;
    }
    if (isBigScreen() && !state.minimized) {
      state.minimized = true;
      const studio = $('dsaSkStudio');
      if (studio) studio.classList.add('minimized');
      syncToolbarUi();
      setTimeout(fitCanvas, 480);
    }
  });
}

addL(document, 'fullscreenchange', onNativeFullscreenChange);
addL(document, 'webkitfullscreenchange', onNativeFullscreenChange);

const minBtn = $('dsaSkMinimizeBtn');
if (minBtn) addL(minBtn, 'click', () => toggleMinimize());

addL($('dsaSkDoneBtn'), 'click', () => flushSketchDone());

addL($('dsaSkUndoBtn'), 'click', () => undo());
addL($('dsaSkRedoBtn'), 'click', () => redo());

const menuToggle = $('dsaSkMenuToggleBtn');
if (menuToggle) addL(menuToggle, 'click', (e) => toggleMenu(e));
const menuClear = $('dsaSkMenuClearBtn');
if (menuClear) addL(menuClear, 'click', () => clearCanvas());

addL($('dsaSkMenuExport'), 'click', () => exportImg());
addL($('dsaSkMenuGrid'), 'click', () => toggleGridBg());
addL($('dsaSkMenuResetZoom'), 'click', () => resetZoom());

addL($('dsaSkBtnPencil'), 'click', () => selectTool('pencil'));
mount.querySelectorAll('#dsaSkMainTab .tool-btn').forEach((btn) => {
  if (btn.id === 'dsaSkBtnPencil' || btn.id === 'dsaSkBtnLaser') return;
  addL(btn, 'click', () => {
    if (btn.id === 'dsaSkBtnLaser') toggleLaser();
    else if (btn.querySelector('path[d="M4 7V4h16v3"]')) selectTool('text');
    else if (btn.querySelector('rect')) selectTool('grid');
    else selectTool('attach');
  });
});
addL($('dsaSkBtnLaser'), 'click', () => toggleLaser());
addL($('dsaSkTtText'), 'click', () => selectTool('text'));
addL($('dsaSkTtGrid'), 'click', () => selectTool('grid'));
addL($('dsaSkTtAttach'), 'click', () => selectTool('attach'));
addL($('dsaSkBtnLaserTop'), 'click', () => toggleLaser());
addL($('dsaSkBtnLaser2'), 'click', () => toggleLaser());
addL($('dsaSkBackBtnTray'), 'click', () => backToMain());
addL($('dsaSkColorBtn'), 'click', (e) => toggleColorPicker(e));

mount.querySelectorAll('.brush[data-brush]').forEach((b) => {
  addL(b, 'click', () => selectBrush(b.dataset.brush));
});

mount.querySelectorAll('#dsaSkTableOverlay .table-add').forEach((btn) => {
  addL(btn, 'click', () => changeTable(btn.dataset.table, parseInt(btn.dataset.delta, 10)));
});
mount.querySelectorAll('[data-action="table-cancel"]').forEach((b) => addL(b, 'click', () => cancelTable()));
mount.querySelectorAll('[data-action="table-confirm"]').forEach((b) => addL(b, 'click', () => confirmTable()));

const imgOv = $('dsaSkImageOverlay');
if (imgOv) {
  imgOv.querySelectorAll('[data-action="image-confirm"]').forEach((b) => addL(b, 'click', () => confirmImage()));
  imgOv.querySelectorAll('.t-cancel').forEach((b) => addL(b, 'click', () => cancelImage()));
}
const txtOv = $('dsaSkTextOverlay');
if (txtOv) {
  addL($('dsaSkTextDeleteBtn'), 'click', () => deleteText());
  txtOv.querySelectorAll('[data-action="text-cancel"]').forEach((b) => addL(b, 'click', () => cancelText()));
  txtOv.querySelectorAll('[data-action="text-confirm"]').forEach((b) => addL(b, 'click', () => confirmText()));
}

mount.querySelectorAll('.shape-opt').forEach((opt) => {
  addL(opt, 'click', () => {
    mount.querySelectorAll('.shape-opt').forEach((o) => o.classList.remove('active'));
    opt.classList.add('active');
    state.shape = opt.dataset.shape;
  });
});

function onWinResize() {
  if (studioEl && studioEl.style.display !== 'none') fitCanvas();
}
addL(window, 'resize', onWinResize);

function onDocKey(e) {
  if (e.key === 'Escape' && isFullscreen() && isNativeFullscreen()) {
    e.preventDefault();
    toggleMinimize();
    return;
  }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    flushSketchDone();
  }
}
addL(document, 'keydown', onDocKey, true);

const ro = new ResizeObserver(() => {
  clearTimeout(ro._t);
  ro._t = setTimeout(fitCanvas, 50);
});
ro.observe($('dsaSkCanvasWrap'));

fitCanvas();
updateBrushColors();
buildColorPicker();
buildSizeDots();
updateUndoRedo();
syncToolbarUi();

if (device === 'mobile') {
  setTimeout(() => enterFullscreen(), 100);
}

const api = {
  clear() {
    state.paths = [];
    state.redoStack = [];
    redrawAll();
    updateUndoRedo();
    syncInkFlag();
    if (typeof hooks.afterClear === 'function') hooks.afterClear();
  },
  zoomIn() {
    state.scale = Math.max(0.3, Math.min(4, state.scale * 1.08));
    applyCanvasTransform();
  },
  zoomOut() {
    state.scale = Math.max(0.3, Math.min(4, state.scale * 0.92));
    applyCanvasTransform();
  },
  resetZoom() {
    resetZoom();
  },
  loadDataUrl(url) {
    if (!url || !String(url).trim()) {
      api.clear();
      return;
    }
    const im = new Image();
    im.onload = () => {
      const wrapEl = $('dsaSkCanvasWrap');
      const maxW = wrapEl.clientWidth * 0.55;
      const maxH = wrapEl.clientHeight * 0.55;
      let w = im.width;
      let h = im.height;
      if (w > maxW) {
        h *= maxW / w;
        w = maxW;
      }
      if (h > maxH) {
        w *= maxH / h;
        h = maxH;
      }
      const cvRect = canvas.getBoundingClientRect();
      const wrRect = wrapEl.getBoundingClientRect();
      const sx = canvas.width / cvRect.width;
      const sy = canvas.height / cvRect.height;
      state.paths = [
        {
          type: 'image',
          x: ((wrapEl.clientWidth - w) / 2 + wrRect.left - cvRect.left) * sx,
          y: ((wrapEl.clientHeight - h) / 2 + wrRect.top - cvRect.top) * sy,
          w: w * sx,
          h: h * sy,
          img: im,
        },
      ];
      state.redoStack = [];
      redrawAll();
      updateUndoRedo();
      syncInkFlag();
    };
    im.onerror = () => api.clear();
    im.src = String(url).trim();
  },
  toDataUrl() {
    try {
      return exportRenderedCanvas().toDataURL('image/png');
    } catch (_) {
      return '';
    }
  },
  toPersistedSketchDataUrl() {
    try {
      return exportRenderedCanvas().toDataURL('image/jpeg', 0.82);
    } catch (_) {
      return '';
    }
  },
  getHasInk() {
    return getHasInk();
  },
  syncHasInkFromPixels() {
    syncInkFlag();
  },
  exitFullscreen() {
    exitFullscreen();
  },
  resize() {
    fitCanvas();
  },
  isFullscreen() {
    return isFullscreen();
  },
  destroy() {
    if (destroyed) return;
    destroyed = true;
        exitFullscreen();
            exitNativeFullscreen();
            try {
                ro.disconnect();
            } catch (_) {}
    listeners.forEach(([t, ty, fn, opts]) => {
      try {
        t.removeEventListener(ty, fn, opts);
      } catch (_) {}
    });
    listeners.length = 0;
    if (eraserCursor && eraserCursor.parentNode) eraserCursor.parentNode.removeChild(eraserCursor);
    editorRoot.innerHTML = '';
    editorRoot.classList.remove('dsa-sketch-studio-host', 'dsa-sketch-studio-host--fullscreen');
  },
};

return api;

    return api;
}
