#!/usr/bin/env python3
"""Export a single self-contained HTML file with only the draw tray (HTML + CSS + JS)."""
from pathlib import Path
import re

BASE = Path(__file__).resolve().parent.parent
FRAG = BASE / "dsa-sketch-studio-fragment.html"
CSS = BASE / "dsa-sketch-studio.css"
OUT = BASE / "draw-tray-standalone.html"

frag = FRAG.read_text(encoding="utf-8")
start = frag.find('<div class="brush-tray" id="dsaSkDrawTab"')
if start < 0:
    raise SystemExit("Could not find brush-tray in fragment")
depth = 0
i = start
tray_end = len(frag)
while i < len(frag):
    if frag.startswith("<div", i):
        depth += 1
        i = frag.index(">", i) + 1
    elif frag.startswith("</div>", i):
        depth -= 1
        i += 6
        if depth == 0:
            tray_end = i
            break
    else:
        i += 1
tray_html = frag[start:tray_end].replace('style="display:none;"', 'style="display:flex;"')

css_all = CSS.read_text(encoding="utf-8")
# Pull mount variables + tray-related rules only
css_chunks = []
in_block = False
buf = []
for line in css_all.splitlines():
    if ".dsa-sketch-studio-mount {" in line and "--sk-brush" in css_all:
        if line.strip().startswith(".dsa-sketch-studio-mount {") and "fullscreen" not in line:
            in_block = True
            buf = [line]
            continue
    if in_block:
        buf.append(line)
        if line.strip() == "}":
            css_chunks.append("\n".join(buf))
            in_block = False
            buf = []
            continue

selectors = (
    "brushes-scroll",
    "brush-tray",
    "brush ",
    "brush:hover",
    "brush.active",
    "brush svg",
    "brush--upright",
    "divider",
    "tray-btn",
    "color-btn",
    "color-wheel",
)
for line in css_all.splitlines():
    stripped = line.strip()
    if not stripped.startswith(".dsa-sketch-studio-mount"):
        continue
    if any(s in line for s in selectors):
        css_chunks.append(line)

# Dedupe while keeping order
seen = set()
css_rules = []
for chunk in css_chunks:
    key = chunk[:80]
    if key not in seen:
        seen.add(key)
        css_rules.append(chunk)

tray_css = """
/* Draw tray standalone — copy/edit freely */
:root {
  --theme: #007aff;
  --theme-soft: rgba(0, 122, 255, 0.12);
  --text: #1c1c1e;
  --separator: rgba(60, 60, 67, 0.12);
  --float-bg: rgba(255, 255, 255, 0.92);
  --shadow-float: 0 10px 40px rgba(0, 0, 0, 0.12), 0 2px 10px rgba(0, 0, 0, 0.06);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 40px 16px 32px;
  background: linear-gradient(180deg, #e8ecf4 0%, #d4dae8 100%);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.demo-wrap {
  width: 100%;
  max-width: 720px;
  display: flex;
  justify-content: center;
}

/* Scoped like production mount — reference mock */
.dsa-sketch-studio-mount {
  --sk-brush-w: 40px;
  --sk-brush-h: 64px;
  --sk-brush-gap: 10px;
  --sk-brush-sink: 0px;
  --sk-scroll-pad-top: 6px;
  --sk-tray-pt: 14px;
  --sk-tray-pr: 22px;
  --sk-tray-pb: 10px;
  --sk-tray-pl: 22px;
  --sk-tray-gap: 12px;
  --sk-tray-min-h: 0px;
  --sk-color-btn-size: 36px;
  --sk-tray-btn-size: 36px;
  --sk-divider-h: 36px;
  --sk-divider-mx: 14px;
  --sk-brush-hover-lift: -3px;
  --sk-brush-active-lift: -6px;
  --sk-brush-active-scale: 1.04;
  --sk-brush-icon-scale: 1;
}

.dsa-sketch-studio-mount .brushes-scroll {
  display: flex;
  align-items: flex-end;
  gap: var(--sk-brush-gap);
  flex: 0 1 auto;
  min-width: 0;
  overflow-x: auto;
  overflow-y: visible;
  padding: var(--sk-scroll-pad-top) 0 0;
  margin: calc(-1 * var(--sk-scroll-pad-top)) 0 0;
  scrollbar-width: none;
}
.dsa-sketch-studio-mount .brushes-scroll::-webkit-scrollbar { display: none; }

.dsa-sketch-studio-mount .brush-tray {
  background: #ffffff;
  backdrop-filter: saturate(180%) blur(24px);
  -webkit-backdrop-filter: saturate(180%) blur(24px);
  border: 0.5px solid rgba(255, 255, 255, 0.85);
  border-radius: 999px;
  padding: var(--sk-tray-pt) var(--sk-tray-pr) var(--sk-tray-pb) var(--sk-tray-pl);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  gap: var(--sk-tray-gap);
  min-height: var(--sk-tray-min-h);
  overflow: visible;
}
.dsa-sketch-studio-mount .brush-tray .brushes-scroll { align-self: flex-end; }
.dsa-sketch-studio-mount .brush[data-brush="pen"] { height: 72px; flex: 0 0 var(--sk-brush-w); }
.dsa-sketch-studio-mount .brush[data-brush="pencil"],
.dsa-sketch-studio-mount .brush[data-brush="highlighter"] { height: 62px; flex: 0 0 var(--sk-brush-w); }
.dsa-sketch-studio-mount .brush[data-brush="eraser"],
.dsa-sketch-studio-mount .brush[data-brush="shape"] { height: 58px; flex: 0 0 var(--sk-brush-w); }

.dsa-sketch-studio-mount .brush {
  width: var(--sk-brush-w);
  height: var(--sk-brush-h);
  flex: 0 0 var(--sk-brush-w);
  margin: 0 0 var(--sk-brush-sink);
  padding: 0;
  cursor: pointer;
  position: relative;
  transition: transform 0.4s var(--ease-spring);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  transform-origin: bottom center;
  align-self: flex-end;
  overflow: visible;
}

.dsa-sketch-studio-mount .brush:hover {
  transform: translateY(var(--sk-brush-hover-lift));
}
.dsa-sketch-studio-mount .brush.active {
  transform: translateY(var(--sk-brush-active-lift)) scale(var(--sk-brush-active-scale));
}

.dsa-sketch-studio-mount .brush svg {
  width: 100%;
  height: 100%;
  display: block;
  flex-shrink: 0;
  overflow: visible;
  transform: scale(var(--sk-brush-icon-scale));
  transform-origin: bottom center;
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.16));
}

.dsa-sketch-studio-mount .brush-tray .divider {
  width: 1px;
  height: var(--sk-divider-h);
  background: var(--separator);
  margin: 0 var(--sk-divider-mx);
  align-self: center;
  flex-shrink: 0;
}

.dsa-sketch-studio-mount .tray-btn {
  width: var(--sk-tray-btn-size);
  height: var(--sk-tray-btn-size);
  border-radius: 50%;
  border: none;
  background: rgba(120, 120, 128, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  align-self: center;
  flex-shrink: 0;
  margin: 0;
}
.dsa-sketch-studio-mount .tray-btn:hover { background: rgba(0, 0, 0, 0.05); }
.dsa-sketch-studio-mount .tray-btn.active { background: var(--theme-soft); }

.dsa-sketch-studio-mount .color-btn {
  width: var(--sk-color-btn-size);
  height: var(--sk-color-btn-size);
  border-radius: 50%;
  border: none;
  box-shadow: none;
  cursor: pointer;
  transition: transform 0.2s var(--ease-spring);
  background: transparent;
  padding: 0;
  margin: 0;
  align-self: center;
  flex-shrink: 0;
}
.dsa-sketch-studio-mount .color-btn .dsa-sk-color-wheel {
  width: 100%;
  height: 100%;
  display: block;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.14));
}
.dsa-sketch-studio-mount .color-btn:hover { transform: scale(1.1); }
"""

tray_js = """
(function () {
  const DEFAULT_COLORS = {
    pen: '#1c1c1e',
    pencil: '#f4d03f',
    highlighter: '#ffeb3b',
    eraser: null,
    shape: '#5856d6',
  };
  let active = 'pen';
  const colors = { ...DEFAULT_COLORS };

  function shade(hex, n) {
    const h = (hex || '#1c1c1e').replace('#', '');
    if (h.length !== 6) return hex;
    const v = parseInt(h, 16);
    const r = Math.max(0, Math.min(255, ((v >> 16) & 255) + n));
    const g = Math.max(0, Math.min(255, ((v >> 8) & 255) + n));
    const b = Math.max(0, Math.min(255, (v & 255) + n));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function applyVars(el, c) {
    if (!el || !c) return;
    el.style.setProperty('--bc', c);
    el.style.setProperty('--bc-light', shade(c, 48));
    el.style.setProperty('--bc-deep', shade(c, -48));
  }

  function paint() {
    document.querySelectorAll('.brush[data-brush]').forEach((b) => {
      const id = b.dataset.brush;
      b.classList.toggle('active', id === active);
      if (id === 'eraser') {
        b.style.removeProperty('--bc');
        b.style.removeProperty('--bc-light');
        b.style.removeProperty('--bc-deep');
        return;
      }
      const c = colors[id];
      if (id === 'pen' || id === 'shape') {
        b.style.setProperty('--bc', c);
        b.style.removeProperty('--bc-light');
        b.style.removeProperty('--bc-deep');
      } else {
        applyVars(b, c);
      }
    });
    const btn = document.getElementById('dsaSkColorBtn');
    if (btn) {
      const c = active === 'eraser' ? '#8e8e93' : colors[active];
      applyVars(btn, c);
    }
  }

  document.querySelectorAll('.brush[data-brush]').forEach((b) => {
    b.addEventListener('click', () => {
      active = b.dataset.brush;
      paint();
    });
  });

  document.getElementById('dsaSkColorBtn')?.addEventListener('click', () => {
    if (active === 'eraser') return;
    const c = prompt('Brush color (hex)', colors[active] || '#1c1c1e');
    if (c) { colors[active] = c; paint(); }
  });

  document.getElementById('dsaSkBtnLaser2')?.addEventListener('click', function () {
    this.classList.toggle('active');
  });

  document.getElementById('dsaSkBackBtnTray')?.addEventListener('click', () => {
    alert('Back button — wire in app as needed');
  });

  paint();
})();
"""

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DSA Sketch — Draw Tray (standalone)</title>
  <style>
{tray_css}
  </style>
</head>
<body>
  <div class="demo-wrap">
    <div class="dsa-sketch-studio-mount" id="drawTrayRoot">
{tray_html}
    </div>
  </div>
  <script>
{tray_js}
  </script>
</body>
</html>
"""

OUT.write_text(html, encoding="utf-8")
print("Wrote", OUT, "bytes:", OUT.stat().st_size)
