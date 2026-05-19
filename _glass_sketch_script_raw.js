
const state = {
  device: 'pc', minimized: false,
  tool: null, brush: 'pen', shape: 'rectangle',
  color: '#1c1c1e', size: 3, opacity: 1,
  drawing: false, paths: [], redoStack: [],
  currentPath: null, laser: false, showGrid: false,
  scale: 1, panX: 0, panY: 0
};

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
ctx.lineCap = 'round';
ctx.lineJoin = 'round';
const laserCanvas = document.getElementById('laserCanvas');
const lctx = laserCanvas.getContext('2d');

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
  const wrap = document.getElementById('canvasWrap');
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
  laserCanvas.width  = canvas.width;
  laserCanvas.height = canvas.height;
  laserCanvas.style.width  = canvas.style.width;
  laserCanvas.style.height = canvas.style.height;
}

function syncLaserCanvas() {
  laserCanvas.width = canvas.width;
  laserCanvas.height = canvas.height;
}
function resetZoom() {
  state.scale = 1; state.panX = 0; state.panY = 0;
  applyCanvasTransform();
  document.getElementById('menuDropdown').classList.remove('show');
}

function getPoint(e, cv = canvas) {
  const r = cv.getBoundingClientRect();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: (cx - r.left) * (cv.width / r.width), y: (cy - r.top) * (cv.height / r.height) };
}

/* ============ DRAWING ============ */
function startDraw(e) {
  if (state.laser) { startLaserStroke(e); return; }

  // Text tool: edit existing OR create new text at click
  if (state.tool === 'text') {
    if (e.touches && e.touches.length > 1) return;
    const pt = getPoint(e);
    const idx = findTextAt(pt.x, pt.y);
    if (idx >= 0) { e.preventDefault(); startTextEdit(idx); }
    else if (!textOverlay.classList.contains('show')) {
      e.preventDefault();
      const wrapEl = document.getElementById('canvasWrap');
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
  if (state.laser) { continueLaserStroke(e); return; }
  if (!state.drawing) return;
  if (e.touches && e.touches.length > 1) { state.drawing = false; return; }
  e.preventDefault();
  state.currentPath.points.push(getPoint(e));
  drawIncremental();
}
function endDraw() {
  if (state.laser) { endLaserStroke(); return; }
  if (!state.drawing) return;
  state.drawing = false;
  if (state.currentPath && state.currentPath.points.length > 1) {
    state.paths.push(state.currentPath);
    state.redoStack = [];
    updateUndoRedo();
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
  ['btnLaser', 'btnLaser2', 'btnLaserTop'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', state.laser);
  });
  if (state.laser) {
    cancelTable(); cancelText();
    document.getElementById('brushSettings').classList.remove('show');
    document.querySelectorAll('#topToolsTab button').forEach(b => { if (b.id !== 'btnLaserTop') b.classList.remove('active'); });
    document.querySelectorAll('.brush').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#mainTab .tool-btn').forEach(b => b.classList.remove('active'));
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
const wrap = document.getElementById('canvasWrap');

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
const eraserCursor = document.getElementById('eraserCursor');

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
    if (tool === 'pencil' && state.device === 'mobile') {
      document.getElementById('drawTab').style.display = 'none';
      document.getElementById('mainTab').style.display = 'flex';
    }
    document.getElementById('brushSettings').classList.remove('show');
    document.querySelectorAll('.brush').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#topToolsTab button').forEach(b => { if (b.id !== 'btnLaserTop') b.classList.remove('active'); });
    document.querySelectorAll('#mainTab .tool-btn').forEach(b => b.classList.remove('active'));
    state.tool = null;
    return;
  }

  // Deactivate everything else
  cancelTable();
  cancelText();
  document.getElementById('brushSettings').classList.remove('show');
  document.querySelectorAll('.brush').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#mainTab .tool-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#topToolsTab button').forEach(b => { if (b.id !== 'btnLaserTop') b.classList.remove('active'); });

  if (tool === 'pencil') {
    document.getElementById('mainTab').style.display = 'none';
    document.getElementById('drawTab').style.display = 'flex';
    state.tool = 'pencil';
    activateBrush(state.brush);
  } else if (tool === 'text') {
    state.tool = 'text';
    document.getElementById('ttText')?.classList.add('active');
    startText();
  } else if (tool === 'grid') {
    state.tool = 'grid';
    document.getElementById('ttGrid')?.classList.add('active');
    startTable();
  } else if (tool === 'attach') {
  document.getElementById('ttAttach')?.classList.add('active');
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
}

function backToMain() {
  document.getElementById('drawTab').style.display = 'none';
  document.getElementById('mainTab').style.display = 'flex';
  document.getElementById('brushSettings').classList.remove('show');
  document.getElementById('colorModal').classList.remove('show');
  document.querySelectorAll('.brush').forEach(b => b.classList.remove('active'));
  state.tool = null;
}

/* Activate brush without showing settings */
function activateBrush(brush) {
  state.brush = brush;
  document.querySelectorAll('.brush').forEach(b => b.classList.toggle('active', b.dataset.brush === brush));
  document.getElementById('shapeRow').style.display = brush === 'shape' ? 'flex' : 'none';
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
  document.querySelectorAll('#topToolsTab button').forEach(b => {
    if (b.id !== 'btnLaserTop') b.classList.remove('active');
  });

  const settings = document.getElementById('brushSettings');
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
}

function updateBrushColors() {
  document.querySelectorAll('.brush').forEach(b => {
    if (b.dataset.brush !== 'eraser' && b.dataset.brush !== 'shape') {
      b.style.setProperty('--bc', state.color);
    }
  });
  document.getElementById('colorBtn').style.background = state.color;
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
  const c = document.getElementById('sizeDots');
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
const opSlider = document.getElementById('opacitySlider');
const opThumb = document.getElementById('opacityThumb');
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
  const m = document.getElementById('swatchesGrid');
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
  const nc = document.getElementById('nativeColor');
  if (nc) nc.value = c.length === 7 ? c : '#1c1c1e';
}
buildColorPicker();
function toggleColorPicker(e) {
  if (e) e.stopPropagation();
  document.getElementById('colorModal').classList.toggle('show');
}
const hueSlider = document.getElementById('hueSlider');
const hueThumb = document.getElementById('hueThumb');
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
document.getElementById('nativeColor').addEventListener('input', (e) => applyColor(e.target.value));

/* ============ TABLE TOOL ============ */
const tableState = { rows: 3, cols: 3, x: 0, y: 0, w: 320, h: 220 };
const tableOverlay = document.getElementById('tableOverlay');
const tableGrid = document.getElementById('tableGrid');
const tableResize = document.getElementById('tableResize');

function startTable() {
  disableLaserIfOn();
  const wrapEl = document.getElementById('canvasWrap');
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
  document.getElementById('ttGrid')?.classList.remove('active');
  if (state.tool === 'grid') state.tool = null;
}
function confirmTable() {
  const wrapEl = document.getElementById('canvasWrap');
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
const textOverlay = document.getElementById('textOverlay');
const textInput = document.getElementById('textInput');
const textHandle = document.getElementById('textHandle');

function startText(x, y) {
  disableLaserIfOn();
  const wrapEl = document.getElementById('canvasWrap');
  textState.x = (x !== undefined) ? x : (wrapEl.clientWidth/2 - 100);
  textState.y = (y !== undefined) ? y : (wrapEl.clientHeight/2 - 30);
  textState.fontSize = 24;
  textState.color = state.color || '#1c1c1e';
  textState.editingIndex = -1;
  textInput.value = '';
  renderTextOverlay();
  textOverlay.classList.add('show');
document.getElementById('textDeleteBtn').style.display = 'none';   // 👈 ADD
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
  const wrapEl = document.getElementById('canvasWrap');
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
document.getElementById('textDeleteBtn').style.display = 'flex';   // 👈 ADD
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
  document.getElementById('ttText')?.classList.remove('active');
  textState.editingIndex = -1;
  if (state.tool === 'text') state.tool = null;
}
function confirmText() {
  const txt = textInput.value.trim();
  if (!txt) { cancelText(); return; }
  if (textState.editingIndex >= 0) state.paths.splice(textState.editingIndex, 1);
  const wrapEl = document.getElementById('canvasWrap');
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
  redrawAll(); updateUndoRedo();
}
function redo() {
  if (!state.redoStack.length) return;
  state.paths.push(state.redoStack.pop());
  redrawAll(); updateUndoRedo();
}
function updateUndoRedo() {
  const tab = document.getElementById('undoRedoTab');
  tab.classList.toggle('visible', state.paths.length > 0 || state.redoStack.length > 0);
  document.getElementById('undoBtn').disabled = state.paths.length === 0;
  document.getElementById('redoBtn').disabled = state.redoStack.length === 0;
}

/* ============ MENU ============ */
function toggleMenu(e) {
  e.stopPropagation();
  document.getElementById('menuDropdown').classList.toggle('show');
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu-tab') && !e.target.closest('.menu-dropdown')) {
    document.getElementById('menuDropdown').classList.remove('show');
  }
  if (!e.target.closest('#colorModal') && !e.target.closest('#colorBtn')) {
    document.getElementById('colorModal').classList.remove('show');
  }
});
function toggleGridBg() {
  state.showGrid = !state.showGrid;
  canvas.classList.toggle('show-grid', state.showGrid);   // ✅ CSS-based grid
  document.getElementById('menuDropdown').classList.remove('show');
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
  document.getElementById('menuDropdown').classList.remove('show');
}function clearCanvas() {
  if (!state.paths.length) return;
  if (!confirm('Clear all drawing?')) return;
  state.paths = []; state.redoStack = [];
  redrawAll(); updateUndoRedo();
}

/* ============ OPEN / CLOSE / MINIMIZE ============ */
function openSketch() {
  document.getElementById('entryScreen').style.display = 'none';
  document.getElementById('studio').style.display = 'flex';
  setTimeout(() => {
    fitCanvas();
    if (state.device === 'pc') {
      state.tool = 'pencil';
      activateBrush(state.brush); // ✅ no settings shown by default
    }
  }, 60);
}
function closeSketch() {
  document.getElementById('studio').style.display = 'none';
  document.getElementById('entryScreen').style.display = 'flex';
}
function saveSketch() { alert('Sketch saved ✓'); closeSketch(); }
function toggleMinimize() {
  state.minimized = !state.minimized;
  document.getElementById('studio').classList.toggle('minimized', state.minimized);
  setTimeout(fitCanvas, 480);
}

/* ============ DEVICE TOGGLE ============ */
document.getElementById('modeMobile').onclick = () => {
  state.device = 'mobile';
  document.body.classList.remove('device-pc');
  document.body.classList.add('device-mobile');
  document.getElementById('modeMobile').classList.add('active');
  document.getElementById('modePC').classList.remove('active');
  document.getElementById('drawTab').style.display = 'none';
  document.getElementById('mainTab').style.display = 'flex';
  document.getElementById('brushSettings').classList.remove('show');
  document.querySelectorAll('.brush').forEach(b => b.classList.remove('active'));
  state.tool = null;
  if (state.minimized) toggleMinimize();
};
document.getElementById('modePC').onclick = () => {
  state.device = 'pc';
  document.body.classList.add('device-pc');
  document.body.classList.remove('device-mobile');
  document.getElementById('modePC').classList.add('active');
  document.getElementById('modeMobile').classList.remove('active');
  state.tool = 'pencil';
  activateBrush(state.brush); // no settings shown
};
document.body.classList.add('device-pc');

window.addEventListener('resize', () => {
  if (document.getElementById('studio').style.display !== 'none') fitCanvas();
});

updateBrushColors();

/* ============ IMAGE TOOL ============ */
const imageState = { x: 0, y: 0, w: 300, h: 300, src: '' };
const imageOverlay = document.getElementById('imageOverlay');
const imagePreview = document.getElementById('imagePreview');
const imageResize = document.getElementById('imageResize');

function startImage(src) {
  disableLaserIfOn();
  imageState.src = src;
  imagePreview.src = src;
  const img = new Image();
  img.onload = () => {
    const wrapEl = document.getElementById('canvasWrap');
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
  document.getElementById('ttAttach')?.classList.remove('active');
}
function confirmImage() {
  const wrapEl = document.getElementById('canvasWrap');
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
