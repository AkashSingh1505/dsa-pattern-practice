#!/usr/bin/env python3
"""Emit premium brush tray HTML for dsa-sketch-studio-fragment.html."""
from pathlib import Path

def prefix_ids(svg: str, prefix: str) -> str:
    import re
    svg = re.sub(r'\bid="([^"]+)"', lambda m: f'id="{prefix}{m.group(1)}"', svg)
    svg = re.sub(r'url\(#([^)]+)\)', lambda m: f'url(#{prefix}{m.group(1)})', svg)
    return svg

PEN = '''<svg viewBox="0 0 90 300" aria-hidden="true"><defs>
        <linearGradient id="b1Body" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#b8b8be"/><stop offset="8%" stop-color="#e8e8ec"/>
          <stop offset="22%" stop-color="#ffffff"/><stop offset="38%" stop-color="#fcfcfd"/>
          <stop offset="55%" stop-color="#f4f4f6"/><stop offset="72%" stop-color="#fbfbfc"/>
          <stop offset="88%" stop-color="#e0e0e4"/><stop offset="100%" stop-color="#a8a8ae"/>
        </linearGradient>
        <linearGradient id="b1Band" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0a0a0a"/><stop offset="50%" stop-color="#2c2c2e"/>
          <stop offset="100%" stop-color="#0a0a0a"/>
        </linearGradient>
        <radialGradient id="b1Bottom" cx="50%" cy="0%" r="80%">
          <stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#b8b8be"/>
        </radialGradient>
        <radialGradient id="b1Floor" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(0,0,0,0.18)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/>
        </radialGradient>
      </defs>
      <ellipse cx="45" cy="294" rx="32" ry="5" fill="url(#b1Floor)"/>
      <path class="dsa-sk-ink" d="M 45 18 Q 47 20 48 24 L 60 80 Q 60 83 57 83 L 33 83 Q 30 83 30 80 L 42 24 Q 43 20 45 18 Z" fill="var(--bc, #1c1c1e)"/>
      <path d="M 45 20 L 41 80 L 44 80 Z" fill="rgba(255,255,255,0.4)"/>
      <ellipse cx="45" cy="83" rx="20" ry="3" fill="#f0f0f3"/>
      <path d="M 25 83 L 25 282 Q 25 289 32 289 L 58 289 Q 65 289 65 282 L 65 83 Z" fill="url(#b1Body)"/>
      <rect x="25" y="152" width="40" height="10" fill="url(#b1Band)"/>
      <rect x="25" y="152" width="40" height="1.5" fill="rgba(255,255,255,0.15)"/>
      <path d="M 25 280 Q 25 289 32 289 L 58 289 Q 65 289 65 280 Z" fill="url(#b1Bottom)"/>
      <rect x="32" y="85" width="2.5" height="200" rx="1.25" fill="rgba(255,255,255,0.7)"/>
      <rect x="55" y="85" width="1.5" height="200" rx="0.75" fill="rgba(255,255,255,0.4)"/>
      <rect x="60" y="85" width="5" height="200" fill="rgba(0,0,0,0.04)"/>
    </svg>'''

PENCIL = '''<svg viewBox="0 0 90 300" aria-hidden="true"><defs>
        <linearGradient id="pcWood" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#8a6a3a"/><stop offset="15%" stop-color="#c9a878"/>
          <stop offset="35%" stop-color="#e8cfa6"/><stop offset="55%" stop-color="#d8b88a"/>
          <stop offset="80%" stop-color="#a88456"/><stop offset="100%" stop-color="#6a4e26"/>
        </linearGradient>
        <linearGradient id="pcLead" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#2c2c2e"/><stop offset="50%" stop-color="#5a5a5e"/>
          <stop offset="100%" stop-color="#1c1c1e"/>
        </linearGradient>
        <linearGradient id="pcFaceL" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#b8841a"/><stop offset="100%" stop-color="#e8a93a"/>
        </linearGradient>
        <linearGradient id="pcFaceR" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#d49d2a"/><stop offset="100%" stop-color="#a8731a"/>
        </linearGradient>
        <linearGradient id="pcFerrule" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#6a6a6e"/><stop offset="15%" stop-color="#b8b8bc"/>
          <stop offset="35%" stop-color="#e8e8ec"/><stop offset="55%" stop-color="#d4d4d8"/>
          <stop offset="80%" stop-color="#9a9a9e"/><stop offset="100%" stop-color="#4a4a4e"/>
        </linearGradient>
        <linearGradient id="pcEraser" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f5b8b3"/><stop offset="40%" stop-color="#e09c97"/>
          <stop offset="100%" stop-color="#b87872"/>
        </linearGradient>
        <radialGradient id="pcEraserHi" cx="30%" cy="20%" r="55%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.65)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
        </radialGradient>
        <radialGradient id="pcFloor" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(0,0,0,0.18)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/>
        </radialGradient>
      </defs>
      <ellipse cx="45" cy="294" rx="32" ry="5" fill="url(#pcFloor)"/>
      <path d="M 45 14 L 41 42 L 49 42 Z" fill="url(#pcLead)"/>
      <path d="M 45 16 L 43 40 L 45 40 Z" fill="rgba(255,255,255,0.3)"/>
      <path d="M 41 42 L 27 80 L 35 80 L 43 42 Z" fill="#a8814a"/>
      <path d="M 43 42 L 35 80 L 55 80 L 47 42 Z" fill="url(#pcWood)"/>
      <path d="M 47 42 L 55 80 L 63 80 L 49 42 Z" fill="#8a6332"/>
      <path d="M 27 80 L 27 250 L 35 250 L 35 80 Z" fill="url(#pcFaceL)"/>
      <path class="dsa-sk-ink" d="M 35 80 L 35 250 L 55 250 L 55 80 Z" fill="var(--bc, #ff3b30)"/>
      <path d="M 55 80 L 55 250 L 63 250 L 63 80 Z" fill="url(#pcFaceR)"/>
      <rect x="43" y="82" width="3" height="166" rx="1.5" fill="rgba(255,255,255,0.5)"/>
      <rect x="26" y="250" width="38" height="22" fill="url(#pcFerrule)"/>
      <path d="M 26 272 L 64 272 L 64 285 Q 64 290 56 290 L 34 290 Q 26 290 26 285 Z" fill="url(#pcEraser)"/>
      <path d="M 26 272 L 64 272 L 64 285 Q 64 290 56 290 L 34 290 Q 26 290 26 285 Z" fill="url(#pcEraserHi)"/>
    </svg>'''

HIGHLIGHTER = '''<svg viewBox="0 0 110 300" aria-hidden="true"><defs>
        <linearGradient id="hlBody" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#a8a8ae"/><stop offset="10%" stop-color="#e0e0e4"/>
          <stop offset="25%" stop-color="#ffffff"/><stop offset="45%" stop-color="#fafafb"/>
          <stop offset="60%" stop-color="#f4f4f6"/><stop offset="78%" stop-color="#fcfcfd"/>
          <stop offset="92%" stop-color="#d8d8dc"/><stop offset="100%" stop-color="#989ea0"/>
        </linearGradient>
        <linearGradient id="hlBand" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#c9a40d"/><stop offset="20%" stop-color="#fde47a"/>
          <stop offset="50%" stop-color="#f4d03f"/><stop offset="80%" stop-color="#fde47a"/>
          <stop offset="100%" stop-color="#a88a08"/>
        </linearGradient>
        <radialGradient id="hlBottom" cx="50%" cy="0%" r="80%">
          <stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#b0b0b6"/>
        </radialGradient>
        <radialGradient id="hlFloor" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(0,0,0,0.20)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/>
        </radialGradient>
      </defs>
      <ellipse cx="55" cy="294" rx="42" ry="6" fill="url(#hlFloor)"/>
      <path class="dsa-sk-ink" d="M 32 25 Q 34 21 38 23 L 80 57 Q 84 60 82 64 L 80 77 Q 79 80 76 80 L 34 80 Q 30 80 30 76 L 30 30 Q 30 27 32 25 Z" fill="var(--bc, #ffeb3b)"/>
      <path d="M 32 27 L 76 59 L 74 64 L 33 32 Z" fill="rgba(255,255,255,0.4)"/>
      <path d="M 28 80 L 82 80 L 80 280 Q 80 290 72 290 L 38 290 Q 28 290 28 280 Z" fill="url(#hlBody)"/>
      <rect x="28" y="180" width="54" height="16" fill="url(#hlBand)"/>
      <rect x="34" y="85" width="3" height="180" rx="1.5" fill="rgba(255,255,255,0.85)"/>
    </svg>'''

ERASER = '''<svg viewBox="0 0 110 300" aria-hidden="true"><defs>
        <linearGradient id="erTop" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f2b8b3"/><stop offset="35%" stop-color="#e09c97"/>
          <stop offset="70%" stop-color="#c8857f"/><stop offset="100%" stop-color="#a06863"/>
        </linearGradient>
        <radialGradient id="erTopHi" cx="30%" cy="20%" r="55%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.7)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
        </radialGradient>
        <linearGradient id="erBody" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#a8a8ae"/><stop offset="25%" stop-color="#ffffff"/>
          <stop offset="75%" stop-color="#fdfdfe"/><stop offset="100%" stop-color="#9ca0a6"/>
        </linearGradient>
        <radialGradient id="erBottom" cx="50%" cy="0%" r="80%">
          <stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#b0b0b6"/>
        </radialGradient>
        <radialGradient id="erFloor" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(0,0,0,0.20)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/>
        </radialGradient>
      </defs>
      <ellipse cx="55" cy="294" rx="44" ry="6" fill="url(#erFloor)"/>
      <path d="M 25 40 Q 25 18 55 18 Q 85 18 85 40 L 85 75 L 25 75 Z" fill="url(#erTop)"/>
      <path d="M 25 40 Q 25 18 55 18 Q 85 18 85 40 L 85 75 L 25 75 Z" fill="url(#erTopHi)"/>
      <path d="M 22 75 L 22 280 Q 22 290 32 290 L 78 290 Q 88 290 88 280 L 88 75 Z" fill="url(#erBody)"/>
      <rect x="29" y="80" width="3.5" height="195" rx="1.75" fill="rgba(255,255,255,0.85)"/>
    </svg>'''

SHAPE = '''<svg viewBox="0 0 120 300" aria-hidden="true"><defs>
        <linearGradient id="shDSide1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0e8ac4"/><stop offset="100%" stop-color="#075d8e"/>
        </linearGradient>
        <linearGradient id="shDSide2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#075d8e"/><stop offset="100%" stop-color="#033752"/>
        </linearGradient>
        <linearGradient id="shSSide" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#c25a00"/><stop offset="100%" stop-color="#7a3500"/>
        </linearGradient>
        <linearGradient id="shHSide1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#c81e5a"/><stop offset="100%" stop-color="#80103a"/>
        </linearGradient>
        <linearGradient id="shHSide2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#80103a"/><stop offset="100%" stop-color="#4a0820"/>
        </linearGradient>
        <radialGradient id="shFloor" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(0,0,0,0.22)"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/>
        </radialGradient>
        <filter id="shBlur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5"/>
        </filter>
      </defs>
      <ellipse cx="60" cy="294" rx="48" ry="6" fill="url(#shFloor)"/>
      <g class="dsa-sk-sh-a">
        <ellipse cx="60" cy="98" rx="30" ry="3" fill="rgba(0,0,0,0.18)" filter="url(#shBlur)"/>
        <path d="M 64 25 L 99 60 L 64 95 L 29 60 Z" fill="#054168"/>
        <path d="M 60 20 L 95 55 L 99 60 L 64 25 Z" fill="url(#shDSide1)"/>
        <path d="M 95 55 L 60 90 L 64 95 L 99 60 Z" fill="url(#shDSide2)"/>
        <path class="dsa-sk-ink" d="M 60 20 L 95 55 L 60 90 L 25 55 Z" fill="var(--bc, #5856d6)"/>
        <ellipse cx="48" cy="42" rx="8" ry="4" fill="rgba(255,255,255,0.6)" transform="rotate(-45 48 42)"/>
      </g>
      <g class="dsa-sk-sh-b">
        <ellipse cx="60" cy="195" rx="34" ry="3.5" fill="rgba(0,0,0,0.18)" filter="url(#shBlur)"/>
        <path d="M 64 119 L 72 143 L 97 143 L 77 158 L 85 182 L 64 168 L 43 182 L 51 158 L 31 143 L 56 143 Z" fill="url(#shSSide)"/>
        <path class="dsa-sk-ink" d="M 60 115 L 68 139 L 93 139 L 73 154 L 81 178 L 60 164 L 39 178 L 47 154 L 27 139 L 52 139 Z" fill="var(--bc, #5856d6)"/>
        <ellipse cx="52" cy="132" rx="6" ry="3" fill="rgba(255,255,255,0.7)" transform="rotate(-30 52 132)"/>
      </g>
      <g class="dsa-sk-sh-c">
        <ellipse cx="60" cy="287" rx="32" ry="3.5" fill="rgba(0,0,0,0.18)" filter="url(#shBlur)"/>
        <path d="M 64 215 L 90 230 L 90 260 L 64 275 L 38 260 L 38 230 Z" fill="#4a0820"/>
        <path d="M 60 210 L 86 225 L 90 230 L 64 215 Z" fill="url(#shHSide1)"/>
        <path class="dsa-sk-ink" d="M 60 210 L 86 225 L 86 255 L 60 270 L 34 255 L 34 225 Z" fill="var(--bc, #5856d6)"/>
        <ellipse cx="48" cy="228" rx="8" ry="3" fill="rgba(255,255,255,0.6)" transform="rotate(-30 48 228)"/>
      </g>
    </svg>'''

COLOR_WHEEL = '''<svg class="dsa-sk-color-wheel" viewBox="0 0 100 100" aria-hidden="true"><defs>
        <radialGradient id="cpCenter" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#3a3a3c"/><stop offset="50%" stop-color="#1c1c1e"/>
          <stop offset="100%" stop-color="#000000"/>
        </radialGradient>
        <filter id="cpDrop">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
          <feOffset dx="0" dy="4" result="o"/>
          <feComponentTransfer><feFuncA type="linear" slope="0.2"/></feComponentTransfer>
          <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g filter="url(#cpDrop)">
        <g transform="translate(50,50)">
          <circle r="42" fill="none" stroke="#ff3b30" stroke-width="11" stroke-dasharray="22 241" transform="rotate(-90)"/>
          <circle r="42" fill="none" stroke="#ff6b35" stroke-width="11" stroke-dasharray="22 241" transform="rotate(-60)"/>
          <circle r="42" fill="none" stroke="#ff9500" stroke-width="11" stroke-dasharray="22 241" transform="rotate(-30)"/>
          <circle r="42" fill="none" stroke="#ffcc00" stroke-width="11" stroke-dasharray="22 241" transform="rotate(0)"/>
          <circle r="42" fill="none" stroke="#a8db4a" stroke-width="11" stroke-dasharray="22 241" transform="rotate(30)"/>
          <circle r="42" fill="none" stroke="#34c759" stroke-width="11" stroke-dasharray="22 241" transform="rotate(60)"/>
          <circle r="42" fill="none" stroke="#00c7be" stroke-width="11" stroke-dasharray="22 241" transform="rotate(90)"/>
          <circle r="42" fill="none" stroke="#30b0c7" stroke-width="11" stroke-dasharray="22 241" transform="rotate(120)"/>
          <circle r="42" fill="none" stroke="#007aff" stroke-width="11" stroke-dasharray="22 241" transform="rotate(150)"/>
          <circle r="42" fill="none" stroke="#5856d6" stroke-width="11" stroke-dasharray="22 241" transform="rotate(180)"/>
          <circle r="42" fill="none" stroke="#af52de" stroke-width="11" stroke-dasharray="22 241" transform="rotate(210)"/>
          <circle r="42" fill="none" stroke="#ff2d55" stroke-width="11" stroke-dasharray="22 241" transform="rotate(240)"/>
        </g>
        <circle cx="50" cy="50" r="32" fill="#ffffff"/>
        <circle class="dsa-sk-color-wheel-core" cx="50" cy="50" r="26" fill="url(#cpCenter)"/>
        <ellipse cx="42" cy="42" rx="10" ry="6" fill="rgba(255,255,255,0.15)" transform="rotate(-30 42 42)"/>
      </g>
    </svg>'''

icons = {
    'pen': prefix_ids(PEN, 'skPen_'),
    'pencil': prefix_ids(PENCIL, 'skPc_'),
    'highlighter': prefix_ids(HIGHLIGHTER, 'skHl_'),
    'eraser': prefix_ids(ERASER, 'skEr_'),
    'shape': prefix_ids(SHAPE, 'skSh_'),
}
color_wheel = prefix_ids(COLOR_WHEEL, 'skCp_')

lines = ['<div class="brushes-scroll">']
for key, title in [
    ('pen', 'Pen'),
    ('pencil', 'Pencil'),
    ('highlighter', 'Highlighter'),
    ('eraser', 'Eraser'),
    ('shape', 'Shapes'),
]:
    lines.append(f'      <div class="brush" data-brush="{key}" title="{title}">')
    lines.append('        ' + icons[key].replace('\n', '\n        '))
    lines.append('      </div>')
    lines.append('')
lines.append('</div>')
lines.append('')
lines.append('      <div class="divider"></div>')
lines.append('      <button class="color-btn" type="button" id="dsaSkColorBtn" title="Color">')
lines.append('        ' + color_wheel.replace('\n', '\n        '))
lines.append('      </button>')

out = Path(__file__).resolve().parent.parent / '_premium_brush_tray.html'
out.write_text('\n'.join(lines), encoding='utf-8')
print('Wrote', out)
