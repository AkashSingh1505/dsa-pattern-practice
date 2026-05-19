#!/usr/bin/env python3
"""Generate dsa-sketch-studio-fragment.html and dsa-sketch-studio-logic.js from glass UI sources."""
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
BODY_RAW = (BASE / "_glass_sketch_body_raw.html").read_text()
SCRIPT_RAW = (BASE / "_glass_sketch_script_raw.js").read_text()

ID_MAP = [
    ("studio", "dsaSkStudio"),
    ("canvasWrap", "dsaSkCanvasWrap"),
    ("canvas", "dsaSkCanvas"),
    ("laserCanvas", "dsaSkLaserCanvas"),
    ("tableOverlay", "dsaSkTableOverlay"),
    ("tableGrid", "dsaSkTableGrid"),
    ("tableResize", "dsaSkTableResize"),
    ("imageOverlay", "dsaSkImageOverlay"),
    ("imagePreview", "dsaSkImagePreview"),
    ("imageResize", "dsaSkImageResize"),
    ("textOverlay", "dsaSkTextOverlay"),
    ("textInput", "dsaSkTextInput"),
    ("textHandle", "dsaSkTextHandle"),
    ("textDeleteBtn", "dsaSkTextDeleteBtn"),
    ("undoRedoTab", "dsaSkUndoRedoTab"),
    ("undoBtn", "dsaSkUndoBtn"),
    ("redoBtn", "dsaSkRedoBtn"),
    ("topToolsTab", "dsaSkTopToolsTab"),
    ("ttText", "dsaSkTtText"),
    ("ttGrid", "dsaSkTtGrid"),
    ("ttAttach", "dsaSkTtAttach"),
    ("btnLaserTop", "dsaSkBtnLaserTop"),
    ("menuDropdown", "dsaSkMenuDropdown"),
    ("brushSettings", "dsaSkBrushSettings"),
    ("shapeRow", "dsaSkShapeRow"),
    ("shapeOptions", "dsaSkShapeOptions"),
    ("colorModal", "dsaSkColorModal"),
    ("swatchesGrid", "dsaSkSwatchesGrid"),
    ("hueSlider", "dsaSkHueSlider"),
    ("hueThumb", "dsaSkHueThumb"),
    ("nativeColor", "dsaSkNativeColor"),
    ("mainTab", "dsaSkMainTab"),
    ("drawTab", "dsaSkDrawTab"),
    ("sizeDots", "dsaSkSizeDots"),
    ("opacitySlider", "dsaSkOpacitySlider"),
    ("opacityThumb", "dsaSkOpacityThumb"),
    ("colorBtn", "dsaSkColorBtn"),
    ("btnLaser2", "dsaSkBtnLaser2"),
    ("backBtnTray", "dsaSkBackBtnTray"),
    ("btnPencil", "dsaSkBtnPencil"),
    ("btnLaser", "dsaSkBtnLaser"),
]


def transform_fragment(body: str) -> str:
    body = re.split(r"<script[\s>]", body, maxsplit=1)[0]
    body = re.sub(r'<div class="device-toggle">[\s\S]*?</div>\s*', "", body)
    body = re.sub(r'<motion class="device-toggle">[\s\S]*?</motion>\s*', "", body, flags=re.I)
    body = re.sub(r'<motion class="entry-screen"[\s\S]*?</motion>\s*', "", body, flags=re.I)
    body = re.sub(r'<div class="entry-screen"[\s\S]*?</div>\s*', "", body)
    body = re.sub(r'<motion class="eraser-cursor"[\s\S]*?</motion>\s*', "", body, flags=re.I)
    body = re.sub(r'<motion class="eraser-cursor"[\s\S]*?</motion>\s*', "", body)
    body = re.sub(r'<div class="eraser-cursor"[\s\S]*?</div>\s*', "", body)

    # Fix corrupted menu button in source
    body = re.sub(
        r'<button onclick="toggleMenu\(event\)">\s*<svg viewBox="0 0 24 24\n<button',
        '<button type="button" title="More" id="dsaSkMenuBtn">\n          <button',
        body,
        count=1,
    )

    for old, new in ID_MAP:
        body = body.replace(f'id="{old}"', f'id="{new}"')
        body = body.replace(f"id='{old}'", f"id='{new}'")

    body = body.replace('id="dsaSkStudio" style="display:none;"', 'id="dsaSkStudio"')
    body = re.sub(
        r'(<div class="restore-bar">[\s\S]*?<button)\s+onclick="toggleMinimize\(\)"',
        r'\1 type="button" id="dsaSkExpandBtn"',
        body,
        count=1,
    )
    body = re.sub(
        r'(<button class="icon-btn")\s+onclick="closeSketch\(\)"',
        r'\1 type="button" id="dsaSkBackBtn"',
        body,
        count=1,
    )
    body = re.sub(
        r'(<button class="icon-btn minimize-btn")\s+onclick="toggleMinimize\(\)"',
        r'\1 type="button" id="dsaSkMinimizeBtn"',
        body,
        count=1,
    )
    body = re.sub(
        r'(<button class="done-btn")\s+onclick="saveSketch\(\)"',
        r'\1 type="button" id="dsaSkDoneBtn"',
        body,
        count=1,
    )
    body = body.replace('id="dsaSkMenuBtn"', 'type="button" title="More"')
    # menu tab first button
    body = re.sub(
        r'(<div class="menu-tab glass-pill">\s*)<button type="button" title="More"',
        r'\1<button type="button" id="dsaSkMenuToggleBtn" title="More"',
        body,
        count=1,
    )
    body = re.sub(
        r'(<div class="menu-tab glass-pill">[\s\S]*?<button)\s+onclick="clearCanvas\(\)"',
        r'\1 type="button" id="dsaSkMenuClearBtn"',
        body,
        count=1,
    )

    body = re.sub(r'\s+onclick="[^"]*"', "", body)
    body = re.sub(r"\s+onclick='[^']*'", "", body)

    # menu dropdown items
    body = body.replace(
        '<motion class="menu-item" onclick="exportImg()">',
        '<div class="menu-item" data-action="export" id="dsaSkMenuExport">',
    )
    body = body.replace('<div class="menu-item" onclick="exportImg()">', '<motion class="menu-item" data-action="export" id="dsaSkMenuExport">'.replace("motion", "motion"))
    body = body.replace('<div class="menu-item" onclick="exportImg()">', '<div class="menu-item" data-action="export" id="dsaSkMenuExport">')
    body = body.replace('<motion class="menu-item" onclick="toggleGridBg()">', '<div class="menu-item" data-action="grid" id="dsaSkMenuGrid">')
    body = body.replace('<div class="menu-item" onclick="toggleGridBg()">', '<div class="menu-item" data-action="grid" id="dsaSkMenuGrid">')
    body = body.replace('<motion class="menu-item" onclick="resetZoom()">', '<div class="menu-item" data-action="resetZoom" id="dsaSkMenuResetZoom">')
    body = body.replace('<div class="menu-item" onclick="resetZoom()">', '<motion class="menu-item" data-action="resetZoom" id="dsaSkMenuResetZoom">'.replace("motion", "motion"))
    body = body.replace('<motion class="menu-item" onclick="resetZoom()">', '<div class="menu-item" data-action="resetZoom" id="dsaSkMenuResetZoom">')
    body = body.replace('<div class="menu-item" onclick="resetZoom()">', '<div class="menu-item" data-action="resetZoom" id="dsaSkMenuResetZoom">')

    # table add buttons data attrs
    body = body.replace('class="table-add t-add-col"', 'class="table-add t-add-col" data-table="col" data-delta="1"')
    body = body.replace('class="table-add t-del-col"', 'class="table-add t-del-col" data-table="col" data-delta="-1"')
    body = body.replace('class="table-add t-add-row"', 'class="table-add t-add-row" data-table="row" data-delta="1"')
    body = body.replace('class="table-add t-del-row"', 'class="table-add t-del-row" data-table="row" data-delta="-1"')

    body = body.replace('class="t-cancel"', 'class="t-cancel" data-action="table-cancel"')
    body = body.replace('class="t-confirm"', 'class="t-confirm" data-action="table-confirm"', 1)
    # image overlay controls - fix duplicate
    body = body.replace(
        'id="dsaSkImageOverlay"',
        'id="dsaSkImageOverlay"',
    )

    return body.strip() + "\n"


def gid(old: str) -> str:
    for o, n in ID_MAP:
        if o == old:
            return n
    return "dsaSk" + old[0].upper() + old[1:]


def transform_script(scr: str) -> str:
    # remove duplicate syncLaserCanvas
    scr = re.sub(
        r"function syncLaserCanvas\(\) \{[\s\S]*?\}\n\nfunction syncLaserCanvas\(\) \{[\s\S]*?\}\n",
        lambda m: m.group(0).split("function syncLaserCanvas()")[0]
        + "function syncLaserCanvas() {\n  laserCanvas.width = canvas.width;\n  laserCanvas.height = canvas.height;\n  laserCanvas.style.width = canvas.style.width;\n  laserCanvas.style.height = canvas.style.height;\n}\n",
        scr,
        count=1,
    )

    repls = [
        ("document.getElementById('canvas')", "$('dsaSkCanvas')"),
        ('document.getElementById("canvas")', "$('dsaSkCanvas')"),
        ("document.getElementById('laserCanvas')", "$('dsaSkLaserCanvas')"),
    ]
    for o, n in ID_MAP:
        repls.append((f"document.getElementById('{o}')", f"$('{n}')"))
        repls.append((f'document.getElementById("{o}")', f"$('{n}')"))
        repls.append((f"#{o}", f"#{n}"))
        repls.append((f"'{o}'", f"'{n}'") if o in ("mainTab", "drawTab", "topToolsTab") else None)

    for item in repls:
        if item:
            scr = scr.replace(item[0], item[1])

    scr = scr.replace("document.body.classList", "mount.classList")
    scr = scr.replace("document.body.classList", "mount.classList")

    # querySelectorAll with old ids
    scr = scr.replace("#topToolsTab", "#dsaSkTopToolsTab")
    scr = scr.replace("#mainTab", "#dsaSkMainTab")
    scr = scr.replace("#drawTab", "#dsaSkDrawTab")
    scr = scr.replace("#colorModal", "#dsaSkColorModal")
    scr = scr.replace("#colorBtn", "#dsaSkColorBtn")
    scr = scr.replace("['btnLaser', 'btnLaser2', 'btnLaserTop']", "['dsaSkBtnLaser', 'dsaSkBtnLaser2', 'dsaSkBtnLaserTop']")
    scr = scr.replace("'btnLaserTop'", "'dsaSkBtnLaserTop'")
    scr = scr.replace("'ttText'", "'dsaSkTtText'")
    scr = scr.replace("'ttGrid'", "'dsaSkTtGrid'")
    scr = scr.replace("'ttAttach'", "'dsaSkTtAttach'")
    scr = scr.replace("getElementById('ttText')", "$('dsaSkTtText')")
    scr = scr.replace("getElementById('ttGrid')", "$('dsaSkTtGrid')")
    scr = scr.replace("getElementById('ttAttach')", "$('dsaSkTtAttach')")
    scr = scr.replace("getElementById('textDeleteBtn')", "$('dsaSkTextDeleteBtn')")

    # Remove open/close/device blocks
    scr = re.sub(r"/\* ============ OPEN / CLOSE / MINIMIZE ============ \*/[\s\S]*?/\* ============ DEVICE TOGGLE ============ \*/", "", scr)
    scr = re.sub(r"/\* ============ DEVICE TOGGLE ============ \*/[\s\S]*?updateBrushColors\(\);\s*", "", scr)
    scr = re.sub(
        r"document\.getElementById\('modeMobile'\)\.onclick[\s\S]*?activateBrush\(state\.brush\);[^\n]*\n\};\s*",
        "",
        scr,
    )

    # Remove window resize that checks studio display
    scr = re.sub(
        r"window\.addEventListener\('resize', \(\) => \{\s*if \(document\.getElementById\('studio'\)[\s\S]*?\}\);\s*",
        "",
        scr,
    )

    prelude = r"""function $(id) { return mount.querySelector('#' + id); }

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

function isFullscreen() {
  return editorRoot.classList.contains('dsa-sketch-studio-host--fullscreen');
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
  if (studio) studio.classList.remove('minimized');
  state.minimized = false;
  if (fsHideBackdrop) fsHideBackdrop.classList.add('dsa-sketch-fs-hide-dialog');
  if (fsHideDlg) fsHideDlg.classList.add('dsa-sketch-fs-hide-dialog');
  requestAnimationFrame(() => setTimeout(fitCanvas, 80));
}

function exitFullscreen() {
  if (!isFullscreen()) return;
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
  requestAnimationFrame(() => setTimeout(fitCanvas, 80));
}

function toggleMinimize() {
  if (roBool()) return;
  const studio = $('dsaSkStudio');
  if (!studio) return;
  if (isFullscreen()) {
    exitFullscreen();
    return;
  }
  state.minimized = !state.minimized;
  studio.classList.toggle('minimized', state.minimized);
  setTimeout(fitCanvas, 480);
}

function flushSketchDone() {
  if (roBool()) return;
  if (textOverlay && textOverlay.classList.contains('show')) confirmText();
  if (tableOverlay && tableOverlay.classList.contains('show')) confirmTable();
  if (imageOverlay && imageOverlay.classList.contains('show')) confirmImage();
  syncInkFlag();
  if (typeof hooks.onPersist === 'function') hooks.onPersist();
}

function addL(target, type, fn, opts) {
  target.addEventListener(type, fn, opts);
  listeners.push([target, type, fn, opts]);
}

"""

    # strip duplicate state/canvas declarations from raw
    scr = re.sub(r"^const state = \{[\s\S]*?^\};\s*", "", scr, flags=re.M)
    scr = re.sub(
        r"^const canvas = document\.getElementById\('canvas'\);[\s\S]*?^const lctx = laserCanvas\.getContext\('2d'\);\s*",
        "",
        scr,
        flags=re.M,
    )
    scr = re.sub(r"^const canvas = \$\('dsaSkCanvas'\);[\s\S]*?^const lctx = laserCanvas\.getContext\('2d'\);\s*", "", scr, flags=re.M, count=1)
    scr = re.sub(
        r"^const eraserCursor = (?:document\.getElementById\('eraserCursor'\)|\$\('dsaSkEraserCursor'\)|eraserCursor);\s*",
        "",
        scr,
        flags=re.M,
    )

    # ro guards
    scr = scr.replace("function startDraw(e) {", "function startDraw(e) {\n  if (roBool()) return;")
    scr = scr.replace("function moveDraw(e) {", "function moveDraw(e) {\n  if (roBool()) return;")
    scr = scr.replace("function endDraw() {", "function endDraw() {\n  if (roBool()) { state.drawing = false; return; }")

    # notify on path changes
    scr = scr.replace(
        "state.paths.push(state.currentPath);\n    state.redoStack = [];\n    updateUndoRedo();",
        "state.paths.push(state.currentPath);\n    state.redoStack = [];\n    updateUndoRedo();\n    syncInkFlag();",
    )
    scr = scr.replace(
        "state.redoStack = [];\n  updateUndoRedo();\n  redrawAll();\n  cancelTable();",
        "state.redoStack = [];\n  updateUndoRedo();\n  redrawAll();\n  syncInkFlag();\n  cancelTable();",
    )
    scr = scr.replace(
        "state.redoStack = [];\n  updateUndoRedo();\n  redrawAll();\n  cancelText();",
        "state.redoStack = [];\n  updateUndoRedo();\n  redrawAll();\n  syncInkFlag();\n  cancelText();",
    )
    scr = scr.replace(
        "state.redoStack = [];\n    updateUndoRedo();\n    redrawAll();\n    cancelImage();",
        "state.redoStack = [];\n    updateUndoRedo();\n    redrawAll();\n    syncInkFlag();\n    cancelImage();",
    )
    scr = scr.replace(
        "state.redoStack.push(state.paths.pop());\n  redrawAll(); updateUndoRedo();",
        "state.redoStack.push(state.paths.pop());\n  redrawAll(); updateUndoRedo(); syncInkFlag();",
    )
    scr = scr.replace(
        "state.paths.push(state.redoStack.pop());\n  redrawAll(); updateUndoRedo();",
        "state.paths.push(state.redoStack.pop());\n  redrawAll(); updateUndoRedo(); syncInkFlag();",
    )
    scr = scr.replace(
        "state.paths = []; state.redoStack = [];\n  redrawAll(); updateUndoRedo();",
        "state.paths = []; state.redoStack = [];\n  redrawAll(); updateUndoRedo(); syncInkFlag();\n  if (typeof hooks.afterClear === 'function') hooks.afterClear();",
    )

    export_fn = r"""
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
"""

    scr = export_fn + scr

    # replace exportImg to use exportRenderedCanvas
    scr = re.sub(
        r"function exportImg\(\) \{[\s\S]*?document\.getElementById\('menuDropdown'\)\.classList\.remove\('show'\);\s*\}",
        """function exportImg() {
  const tmp = exportRenderedCanvas();
  const a = document.createElement('a');
  a.download = 'sketch.png';
  a.href = tmp.toDataURL('image/png');
  a.click();
  $('dsaSkMenuDropdown').classList.remove('show');
}""",
        scr,
    )

    wire_block = r"""
/* ============ WIRE UI (no inline handlers) ============ */
const studioEl = $('dsaSkStudio');
studioEl.style.display = 'flex';
mount.classList.add(device === 'pc' ? 'device-pc' : 'device-mobile');

if (device === 'pc') {
  studioEl.classList.add('minimized');
  state.minimized = true;
  state.tool = 'pencil';
  $('dsaSkDrawTab').style.display = 'flex';
  $('dsaSkMainTab').style.display = 'none';
  activateBrush('pen');
} else {
  $('dsaSkDrawTab').style.display = 'none';
  $('dsaSkMainTab').style.display = 'flex';
}

const backBtn = $('dsaSkBackBtn');
if (backBtn) addL(backBtn, 'click', () => { if (device === 'pc') toggleMinimize(); });

const expandBtn = $('dsaSkExpandBtn');
if (expandBtn) addL(expandBtn, 'click', () => enterFullscreen());

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
  imgOv.querySelectorAll('.t-cancel').forEach((b) => addL(b, 'click', () => cancelImage()));
  imgOv.querySelectorAll('.t-confirm').forEach((b) => addL(b, 'click', () => confirmImage()));
}
const txtOv = $('dsaSkTextOverlay');
if (txtOv) {
  addL($('dsaSkTextDeleteBtn'), 'click', () => deleteText());
  txtOv.querySelectorAll('.t-cancel').forEach((b) => addL(b, 'click', () => cancelText()));
  txtOv.querySelectorAll('.t-confirm').forEach((b) => addL(b, 'click', () => confirmText()));
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
  if (e.key === 'Escape' && isFullscreen()) {
    e.preventDefault();
    exitFullscreen();
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
    const studio = $('dsaSkStudio');
    if (studio && device === 'pc' && !state.minimized) {
      studio.classList.add('minimized');
      state.minimized = true;
    }
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
"""

    # Fix const declarations for overlays at bottom - they're already in script
    return prelude + scr + wire_block


def main():
    frag = transform_fragment(BODY_RAW)
    logic = transform_script(SCRIPT_RAW)
    (BASE / "dsa-sketch-studio-fragment.html").write_text(frag, encoding="utf-8")
    (BASE / "dsa-sketch-studio-logic.js").write_text(logic, encoding="utf-8")
    print("fragment", len(frag), "logic", len(logic))


if __name__ == "__main__":
    main()
