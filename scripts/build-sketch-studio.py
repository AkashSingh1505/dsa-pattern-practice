#!/usr/bin/env python3
"""Build dsa-sketch-studio.js from _sketch_extract_body.html + _sketch_extract_script.js."""
import json
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent


def transform_body(body: str) -> str:
    repl = [
        ('id="app"', 'id="dsaSkApp"'),
        ('id="themeBtn"', 'id="dsaSkThemeBtn"'),
        ('id="imgInput"', 'id="dsaSkImgInput"'),
        ('id="saveBtn"', 'id="dsaSkSaveBtn"'),
        ('id="clearBtn"', 'id="dsaSkClearBtn"'),
        ('id="fsBtn"', 'id="dsaSkFsBtn"'),
        ('id="ziBtn"', 'id="dsaSkZiBtn"'),
        ('id="zoBtn"', 'id="dsaSkZoBtn"'),
        ('id="zrBtn"', 'id="dsaSkZrBtn"'),
        ('id="undoBtn"', 'id="dsaSkUndoBtn"'),
        ('id="redoBtn"', 'id="dsaSkRedoBtn"'),
        ('id="colors"', 'id="dsaSkColors"'),
        ('id="sizeR"', 'id="dsaSkSizeR"'),
        ('id="opR"', 'id="dsaSkOpR"'),
        ('id="sizeV"', 'id="dsaSkSizeV"'),
        ('id="opV"', 'id="dsaSkOpV"'),
        ('id="cw"', 'id="dsaSkCw"'),
        ('id="canvas"', 'id="dsaSkCv"'),
        ('id="overlay"', 'id="dsaSkOv"'),
        ('id="zV"', 'id="dsaSkZV"'),
        ('id="sT"', 'id="dsaSkST"'),
        ('id="sCD"', 'id="dsaSkSCD"'),
        ('id="sCT"', 'id="dsaSkSCT"'),
        ('id="sS"', 'id="dsaSkSS"'),
        ('id="sP"', 'id="dsaSkSP"'),
        ('id="toast"', 'id="dsaSkToast"'),
        ('id="tT"', 'id="dsaSkTT"'),
        ('id="cp"', 'id="dsaSkCp"'),
    ]
    for a, b in repl:
        body = body.replace(a, b)
    back_btn = (
        '<button type="button" class="btn-flat dsa-sketch-fs-back" '
        'id="dsaSkBackBtn" data-tip="Back to dialog">Back</button>\n'
    )
    return body.replace('<div class="header-actions">\n', '<div class="header-actions">\n' + back_btn, 1)


def transform_script(scr: str) -> str:
    scr = re.sub(r"^\(\(\)=>\{", "", scr.strip())
    scr = re.sub(r"\}\)\(\);\s*$", "", scr)

    scr = (
        "function $(id){return mount.querySelector('#'+id);}\n"
        + scr.replace("document.getElementById('canvas')", "$('dsaSkCv')")
        .replace("document.getElementById('overlay')", "$('dsaSkOv')")
        .replace("document.getElementById('cw')", "$('dsaSkCw')")
        .replace("document.getElementById('app')", "$('dsaSkApp')")
    )

    scr = scr.replace("document.body.dataset.theme==='dark'", "mount.dataset.theme==='dark'")
    scr = scr.replace(
        "document.body.dataset.theme=isDark()?'light':'dark'",
        "mount.dataset.theme=isDark()?'light':'dark'",
    )

    pairs = [
        ("document.getElementById('zV')", "$('dsaSkZV')"),
        ("document.getElementById('sP')", "$('dsaSkSP')"),
        ("document.getElementById('toast')", "$('dsaSkToast')"),
        ("document.getElementById('tT')", "$('dsaSkTT')"),
        ("document.querySelector(`[data-tool=\"${n}\"]`)", 'mount.querySelector(`[data-tool="${n}"]`)'),
        ("document.querySelectorAll('[data-tool]')", "mount.querySelectorAll('[data-tool]')"),
        ("document.getElementById('sT')", "$('dsaSkST')"),
        ("document.getElementById('colors')", "$('dsaSkColors')"),
        ("document.querySelectorAll('#colors .swatch')", "mount.querySelectorAll('#dsaSkColors .swatch')"),
        ("document.getElementById('cp')", "$('dsaSkCp')"),
        ("document.getElementById('sCT')", "$('dsaSkSCT')"),
        ("document.getElementById('sCD')", "$('dsaSkSCD')"),
        ("document.getElementById('sizeR')", "$('dsaSkSizeR')"),
        ("document.getElementById('opR')", "$('dsaSkOpR')"),
        ("document.getElementById('sizeV')", "$('dsaSkSizeV')"),
        ("document.getElementById('sS')", "$('dsaSkSS')"),
        ("document.getElementById('opV')", "$('dsaSkOpV')"),
        ("document.getElementById('undoBtn')", "$('dsaSkUndoBtn')"),
        ("document.getElementById('redoBtn')", "$('dsaSkRedoBtn')"),
        ("document.getElementById('clearBtn')", "$('dsaSkClearBtn')"),
        ("document.getElementById('saveBtn')", "$('dsaSkSaveBtn')"),
        ("document.getElementById('fsBtn')", "$('dsaSkFsBtn')"),
        ("document.getElementById('ziBtn')", "$('dsaSkZiBtn')"),
        ("document.getElementById('zoBtn')", "$('dsaSkZoBtn')"),
        ("document.getElementById('zrBtn')", "$('dsaSkZrBtn')"),
        ("document.getElementById('imgInput')", "$('dsaSkImgInput')"),
        ("document.getElementById('themeBtn')", "$('dsaSkThemeBtn')"),
    ]
    for old, new in pairs:
        scr = scr.replace(old, new)

    scr = scr.replace(
        "$('dsaSkFsBtn').addEventListener('click',async()=>{try{if(!document.fullscreenElement)"
        "await app.requestFullscreen();else await document.exitFullscreen();}catch(e){}});\n"
        "document.addEventListener('fullscreenchange',()=>{cw.classList.toggle('fs',!!document.fullscreenElement);"
        "setTimeout(resize,100);});",
        "",
    )

    scr = scr.replace(
        "function restore(d){const i=new Image();i.onload=()=>{ctx.save();ctx.setTransform(1,0,0,1,0,0);"
        "ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(i,0,0,cv.width,cv.height);ctx.restore();};i.src=d;}",
        "function restore(d){const i=new Image();i.onload=()=>{ctx.save();ctx.setTransform(1,0,0,1,0,0);"
        "ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(i,0,0,cv.width,cv.height);ctx.restore();syncInk();"
        "onChange();};i.src=d;}",
    )

    scr = scr.replace(
        "window.addEventListener('load',()=>{resize();saveH();laserLoop();});",
        "",
    )

    scr = scr.replace("function start(e){", "function start(e){if(roBool())return;")
    scr = scr.replace("function move(e){", "function move(e){if(roBool())return;")
    scr = scr.replace("function end(){", "function end(){if(roBool()){S.drawing=false;return;}")

    scr = scr.replace(
        "if(confirm('Clear canvas?')){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);"
        "ctx.restore();saveH();toast('Cleared');}",
        "if(confirm('Clear canvas?')){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);"
        "ctx.restore();saveH();syncInk();if(typeof hooks.afterClear==='function')hooks.afterClear();"
        "onChange();toast('Cleared');}",
    )

    scr = scr.replace(
        "if(t){ctx.save();ctx.globalAlpha=S.opacity;ctx.fillStyle=S.color;ctx.font=`600 ${Math.max(14,S.size*3)}px -apple-system,sans-serif`;ctx.textBaseline='top';ctx.fillText(t,x,y);ctx.restore();saveH();}",
        "if(t){ctx.save();ctx.globalAlpha=S.opacity;ctx.fillStyle=S.color;ctx.font=`600 ${Math.max(14,S.size*3)}px -apple-system,sans-serif`;ctx.textBaseline='top';ctx.fillText(t,x,y);ctx.restore();saveHNotify();}",
    )

    scr = scr.replace("if(wasShape||wasStroke)saveH();", "if(wasShape||wasStroke)saveHNotify();")

    scr = scr.replace("saveH();toast('Imported')", "saveHNotify();toast('Imported')")

    scr = scr.replace(
        "document.addEventListener('keydown',e=>{",
        "function onDocKeyInner(e){",
        1,
    )
    scr = scr.replace(
        "else if(k==='f')$('dsaSkFsBtn').click();\n});",
        "else if(k==='f')$('dsaSkFsBtn').click();\n}",
        1,
    )

    scr = scr.replace(
        "let rt;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(resize,100);});",
        "let rt;function onWinResize(){clearTimeout(rt);rt=setTimeout(resize,100);}\n"
        "window.addEventListener('resize',onWinResize);",
        1,
    )

    # After const FADE, inject roBool + syncInk + fs helpers + saveHNotify anchor after saveH
    scr = scr.replace(
        "const FADE=900;\nconst isDark=",
        "const FADE=900;\n"
        "function roBool(){return editorRoot.classList.contains('dsa-sketch-studio-host--ro');}\n"
        "function syncInk(){\n"
        "  hasInk=false;\n"
        "  try{\n"
        "    const d=ctx.getImageData(0,0,cv.width,cv.height).data;\n"
        "    for(let i=0;i<d.length;i+=16){\n"
        "      if(d[i+3]<8)continue;\n"
        "      if(d[i]<252||d[i+1]<252||d[i+2]<252){hasInk=true;return;}\n"
        "    }\n"
        "  }catch(_){hasInk=S.hist.length>1;}\n"
        "}\n"
        "let isFakeFs=false,fsParent=null,fsNext=null,fsHideBackdrop=null,fsHideDlg=null;\n"
        "function enterFakeFullscreen(){\n"
        "  if(isFakeFs)return;\n"
        "  fsParent=editorRoot.parentNode;fsNext=editorRoot.nextSibling;\n"
        "  fsHideBackdrop=editorRoot.closest('.dsa-dialog-backdrop');\n"
        "  fsHideDlg=editorRoot.closest('.dsa-dialog');\n"
        "  document.body.appendChild(editorRoot);\n"
        "  editorRoot.classList.add('dsa-sketch-studio-host--fullscreen');\n"
        "  if(fsHideBackdrop)fsHideBackdrop.classList.add('dsa-sketch-fs-hide-dialog');\n"
        "  if(fsHideDlg)fsHideDlg.classList.add('dsa-sketch-fs-hide-dialog');\n"
        "  isFakeFs=true;\n"
        "  requestAnimationFrame(()=>setTimeout(resize,80));\n"
        "}\n"
        "function leaveFakeFullscreen(){\n"
        "  if(!isFakeFs)return;\n"
        "  if(fsHideBackdrop)fsHideBackdrop.classList.remove('dsa-sketch-fs-hide-dialog');\n"
        "  if(fsHideDlg)fsHideDlg.classList.remove('dsa-sketch-fs-hide-dialog');\n"
        "  fsHideBackdrop=null;fsHideDlg=null;\n"
        "  editorRoot.classList.remove('dsa-sketch-studio-host--fullscreen');\n"
        "  if(fsParent){\n"
        "    if(fsNext)fsParent.insertBefore(editorRoot,fsNext);\n"
        "    else fsParent.appendChild(editorRoot);\n"
        "  }\n"
        "  fsParent=null;fsNext=null;isFakeFs=false;\n"
        "  requestAnimationFrame(()=>setTimeout(resize,80));\n"
        "}\n"
        "const isDark=",
    )

    scr = scr.replace(
        "function saveH(){try{S.hist.push(cv.toDataURL());if(S.hist.length>60)S.hist.shift();S.redo=[];}catch(e){}}",
        "function saveH(){try{S.hist.push(cv.toDataURL());if(S.hist.length>60)S.hist.shift();S.redo=[];}catch(e){}}\n"
        "function saveHNotify(){saveH();syncInk();onChange();}",
    )

    if "document.getElementById" in scr:
        i = scr.index("document.getElementById")
        raise RuntimeError("leftover: " + scr[i : i + 100])

    return scr


def main() -> None:
    body = transform_body((BASE / "_sketch_extract_body.html").read_text().strip())
    body_json = json.dumps(body, ensure_ascii=False)
    scr = transform_script((BASE / "_sketch_extract_script.js").read_text())

    prelude = f'''/**
 * DSA problem sketch — Sketch Studio Pro UI (embedded).
 * Generated by scripts/build-sketch-studio.py — edit that script or _sketch_extract_* then re-run.
 */
function dsaWireSketchEditorStudio(editorRoot, onChange, sketchOpts) {{
    const hooks = sketchOpts || {{}};
    if (!editorRoot) {{
        return dsaWireSketchEditorStudioStub();
    }}
    if (!document.head.querySelector("link[data-dsa-sketch-studio-css]")) {{
        const lk = document.createElement("link");
        lk.rel = "stylesheet";
        lk.href = "./dsa-sketch-studio.css?v=1";
        lk.dataset.dsaSketchStudioCss = "1";
        document.head.appendChild(lk);
    }}
    editorRoot.innerHTML = "";
    editorRoot.classList.add("dsa-sketch-studio-host");
    const mount = document.createElement("div");
    mount.className = "dsa-sketch-studio-mount";
    mount.dataset.theme = "light";
    mount.innerHTML = {body_json};
    editorRoot.appendChild(mount);

    let hasInk = false;
    let destroyed = false;
'''

    postlude = r"""
    $('dsaSkFsBtn').addEventListener('click', () => {
        if (isFakeFs) leaveFakeFullscreen();
        else enterFakeFullscreen();
    });
    const backBtn = $('dsaSkBackBtn');
    if (backBtn) backBtn.addEventListener('click', () => leaveFakeFullscreen());

    function onDocKey(e) {
        if (e.key === 'Escape' && isFakeFs) {
            e.preventDefault();
            e.stopPropagation();
            leaveFakeFullscreen();
            return;
        }
        onDocKeyInner(e);
    }
    document.addEventListener('keydown', onDocKey, true);

    const ro = new ResizeObserver(() => {
        clearTimeout(rt);
        rt = setTimeout(resize, 50);
    });
    ro.observe(cw);

    resize();
    saveH();
    syncInk();
    onChange();
    laserLoop();

    const api = {
        clear() {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, cv.width, cv.height);
            ctx.restore();
            S.hist = [];
            saveH();
            hasInk = false;
            if (typeof hooks.afterClear === 'function') hooks.afterClear();
            onChange();
        },
        zoomIn() {
            S.zoom = Math.min(S.zoom + 0.25, 5);
            applyZoom();
        },
        zoomOut() {
            S.zoom = Math.max(S.zoom - 0.25, 1);
            applyZoom();
        },
        resetZoom() {
            S.zoom = 1;
            applyZoom();
        },
        loadDataUrl(url) {
            if (!url || !String(url).trim()) {
                api.clear();
                return;
            }
            const im = new Image();
            im.onload = () => {
                const cssW = cv.width / DPR;
                const cssH = cv.height / DPR;
                const rt0 = Math.min(cssW / im.width, cssH / im.height) * 0.9;
                const w = im.width * rt0;
                const h = im.height * rt0;
                ctx.save();
                ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
                ctx.clearRect(0, 0, cssW, cssH);
                ctx.restore();
                ctx.drawImage(im, (cssW - w) / 2, (cssH - h) / 2, w, h);
                S.hist = [];
                saveH();
                syncInk();
                onChange();
            };
            im.onerror = () => api.clear();
            im.src = String(url).trim();
        },
        toDataUrl() {
            try {
                return cv.toDataURL('image/png');
            } catch (_) {
                return '';
            }
        },
        toPersistedSketchDataUrl() {
            try {
                return cv.toDataURL('image/jpeg', 0.82);
            } catch (_) {
                try {
                    return cv.toDataURL('image/png');
                } catch (_) {
                    return '';
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
            leaveFakeFullscreen();
        },
        isFullscreen() {
            return isFakeFs;
        },
        destroy() {
            if (destroyed) return;
            destroyed = true;
            leaveFakeFullscreen();
            try {
                ro.disconnect();
            } catch (_) {}
            document.removeEventListener('keydown', onDocKey, true);
            window.removeEventListener('resize', onWinResize);
            editorRoot.innerHTML = '';
            editorRoot.classList.remove('dsa-sketch-studio-host', 'dsa-sketch-studio-host--fullscreen');
        },
    };
    return api;
}

function dsaWireSketchEditorStudioStub() {
    return {
        clear() {},
        zoomIn() {},
        zoomOut() {},
        resetZoom() {},
        loadDataUrl() {},
        toDataUrl() {
            return '';
        },
        toPersistedSketchDataUrl() {
            return '';
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
"""

    out = prelude + "\n" + scr + "\n" + postlude
    (BASE / "dsa-sketch-studio.js").write_text(out, encoding="utf-8")
    print("Wrote dsa-sketch-studio.js", len(out), "bytes")


if __name__ == "__main__":
    main()
