#!/usr/bin/env python3
"""Build dsa-sketch-studio.js from _sketch_extract_body.html + _sketch_extract_script.js."""
import json
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent

ID_REPL = [
    ('id="app"', 'id="dsaSkApp"'),
    ('id="imgInput"', 'id="dsaSkImgInput"'),
    ('id="doneBtn"', 'id="dsaSkDoneBtn"'),
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
    ('id="stage"', 'id="dsaSkStage"'),
    ('id="canvas"', 'id="dsaSkCv"'),
    ('id="overlay"', 'id="dsaSkOv"'),
    ('id="textEditor"', 'id="dsaSkTextEditor"'),
    ('id="gridActions"', 'id="dsaSkGridActions"'),
    ('id="gridDone"', 'id="dsaSkGridDone"'),
    ('id="gridRemove"', 'id="dsaSkGridRemove"'),
    ('id="gridCtl"', 'id="dsaSkGridCtl"'),
    ('id="gRows"', 'id="dsaSkGRows"'),
    ('id="gCols"', 'id="dsaSkGCols"'),
    ('id="penBadge"', 'id="dsaSkPenBadge"'),
    ('id="brandMark"', 'id="dsaSkBrandMark"'),
    ('id="brandMarkText"', 'id="dsaSkBrandMarkText"'),
    ('id="brandTitle"', 'id="dsaSkBrandTitle"'),
    ('id="brandSubtitle"', 'id="dsaSkBrandSubtitle"'),
    ('id="zV"', 'id="dsaSkZV"'),
    ('id="sT"', 'id="dsaSkST"'),
    ('id="sCD"', 'id="dsaSkSCD"'),
    ('id="sCT"', 'id="dsaSkSCT"'),
    ('id="sS"', 'id="dsaSkSS"'),
    ('id="sP"', 'id="dsaSkSP"'),
    ('id="sPr"', 'id="dsaSkSPr"'),
    ('id="pressureWrap"', 'id="dsaSkPressureWrap"'),
    ('id="toast"', 'id="dsaSkToast"'),
    ('id="tT"', 'id="dsaSkTT"'),
    ('id="cp"', 'id="dsaSkCp"'),
]

GET_REPL = [
    ("document.getElementById('canvas')", "$('dsaSkCv')"),
    ("document.getElementById('overlay')", "$('dsaSkOv')"),
    ("document.getElementById('cw')", "$('dsaSkCw')"),
    ("document.getElementById('stage')", "$('dsaSkStage')"),
    ("document.getElementById('app')", "$('dsaSkApp')"),
    ("document.getElementById('textEditor')", "$('dsaSkTextEditor')"),
    ("document.getElementById('zV')", "$('dsaSkZV')"),
    ("document.getElementById('sP')", "$('dsaSkSP')"),
    ("document.getElementById('toast')", "$('dsaSkToast')"),
    ("document.getElementById('tT')", "$('dsaSkTT')"),
    ("document.getElementById('sT')", "$('dsaSkST')"),
    ("document.getElementById('colors')", "$('dsaSkColors')"),
    ("document.querySelectorAll('#colors .swatch')", "mount.querySelectorAll('#dsaSkColors .swatch')"),
    ("document.querySelectorAll('.swatch')", "mount.querySelectorAll('.swatch')"),
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
    ("document.getElementById('doneBtn')", "$('dsaSkDoneBtn')"),
    ("document.getElementById('fsBtn')", "$('dsaSkFsBtn')"),
    ("document.getElementById('ziBtn')", "$('dsaSkZiBtn')"),
    ("document.getElementById('zoBtn')", "$('dsaSkZoBtn')"),
    ("document.getElementById('zrBtn')", "$('dsaSkZrBtn')"),
    ("document.getElementById('imgInput')", "$('dsaSkImgInput')"),
    ("document.getElementById('gridCtl')", "$('dsaSkGridCtl')"),
    ("document.getElementById('gRows')", "$('dsaSkGRows')"),
    ("document.getElementById('gCols')", "$('dsaSkGCols')"),
    ("document.getElementById('gridActions')", "$('dsaSkGridActions')"),
    ("document.getElementById('gridDone')", "$('dsaSkGridDone')"),
    ("document.getElementById('gridRemove')", "$('dsaSkGridRemove')"),
    ("document.getElementById('penBadge')", "$('dsaSkPenBadge')"),
    ("document.getElementById('pressureWrap')", "$('dsaSkPressureWrap')"),
    ("document.getElementById('sPr')", "$('dsaSkSPr')"),
    ("document.querySelectorAll('.btn[data-tool]')", "mount.querySelectorAll('.btn[data-tool]')"),
    ("document.querySelector(`.btn[data-tool=\"${name}\"]`)", 'mount.querySelector(`.btn[data-tool="${name}"]`)'),
    ("document.querySelector(`.btn[data-tool=\"${n}\"]`)", 'mount.querySelector(`.btn[data-tool="${n}"]`)'),
    ("document.querySelectorAll('.group')", "mount.querySelectorAll('.group')"),
]


def transform_body(body: str) -> str:
    for a, b in ID_REPL:
        body = body.replace(a, b)
    back_btn = (
        '<button type="button" class="btn-flat primary dsa-sketch-fs-back" '
        'id="dsaSkBackBtn" data-tip="Return to problem" hidden>'
        '<span class="dsa-sk-back-label">Close</span></button>\n'
    )
    return body.replace(
        '<div class="header-actions">\n',
        '<div class="header-actions">\n' + back_btn,
        1,
    )


def transform_script(scr: str) -> str:
    scr = re.sub(r"^\(\(\)=>\{", "", scr.strip())
    scr = re.sub(r"\}\)\(\);\s*$", "", scr)

    scr = (
        "function $(id){return mount.querySelector('#'+id);}\n"
        + scr.replace("const cv=document.getElementById('canvas')", "const cv=$('dsaSkCv')")
        .replace("const ov=document.getElementById('overlay')", "const ov=$('dsaSkOv')")
        .replace("const cw=document.getElementById('cw')", "const cw=$('dsaSkCw')")
        .replace("const stage=document.getElementById('stage')", "const stage=$('dsaSkStage')")
        .replace("const app=document.getElementById('app')", "const app=$('dsaSkApp')")
        .replace("const txEditor=document.getElementById('textEditor')", "const txEditor=$('dsaSkTextEditor')")
    )

    for old, new in GET_REPL:
        scr = scr.replace(old, new)

    # Remove native fullscreen on .app
    scr = re.sub(
        r"\$\('dsaSkFsBtn'\)\.addEventListener\('click',\(\)=>\{[\s\S]*?\}\);\s*"
        r"document\.addEventListener\('fullscreenchange'[\s\S]*?setTimeout\(resize,120\);\}\);\s*",
        "",
        scr,
    )

    scr = scr.replace(
        "function restore(state){",
        "function restore(state){",
    )
    scr = scr.replace(
        "function restore(state){",
        "function restore(state){",
        1,
    )
    # enhance restore with syncInk/onChange
    scr = scr.replace(
        "i.src=state.img;\n}",
        "i.src=state.img;syncInk();onChange();\n}",
    )

    scr = scr.replace("window.addEventListener('resize',()=>{resize();refreshGroupShown();});", "")
    scr = re.sub(
        r"/\* ===== INIT ===== \*/\s*resize\(\);\s*saveH\(\);\s*overlayLoop\(\);\s*",
        "",
        scr,
    )

    scr = scr.replace("function onDown(e){", "function onDown(e){if(roBool())return;")
    scr = scr.replace("function onMove(e){", "function onMove(e){if(roBool())return;")
    scr = scr.replace("function onUp(e){", "function onUp(e){if(roBool()){S.drawing=false;return;}")

    scr = scr.replace(
        "if(confirm('Clear canvas?')){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);"
        "ctx.restore();G.current=null;T.list=[];T.selected=null;T.editing=null;txEditor.style.display='none';saveH();toast('Canvas cleared');}",
        "if(confirm('Clear canvas?')){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);"
        "ctx.restore();G.current=null;T.list=[];T.selected=null;T.editing=null;txEditor.style.display='none';saveH();syncInk();"
        "if(typeof hooks.afterClear==='function')hooks.afterClear();onChange();toast('Canvas cleared');}",
    )

    # Replace saveH calls that should notify parent (strokes, text, grid bake, import)
    for pat in [
        "saveH();toast('Undo')",
        "saveH();toast('Redo')",
        "T.drag=null;T.ds=null;saveH();return;",
        "finishStroke();S.pts=[];saveH();return;",
        "saveH();\n}",
        "saveHNotify();toast('Imported')",
    ]:
        pass
    scr = scr.replace("T.drag=null;T.ds=null;saveH();return;", "T.drag=null;T.ds=null;saveHNotify();return;")
    scr = scr.replace("finishStroke();S.pts=[];saveH();return;", "finishStroke();S.pts=[];saveHNotify();return;")
    scr = scr.replace("ctx.restore();\n  S._lastPrev=null;\n  saveH();\n}", "ctx.restore();\n  S._lastPrev=null;\n  saveHNotify();\n}")
    scr = scr.replace("commitTextEdit(){", "commitTextEdit(){")
    scr = scr.replace(
        "txEditor.style.display='none';\n  saveH();\n}",
        "txEditor.style.display='none';\n  saveHNotify();\n}",
    )
    scr = scr.replace("saveH();\n  toast('Table fixed')", "saveHNotify();\n  toast('Table fixed')")
    scr = scr.replace("saveHNotify();toast('Imported')", "saveHNotify();toast('Imported')")
    scr = scr.replace("saveH();\n      toast('Image imported')", "saveHNotify();\n      toast('Image imported')")
    scr = scr.replace(
        "T.list=T.list.filter(t=>t.id!==T.selected);\n      T.selected=null;saveH();",
        "T.list=T.list.filter(t=>t.id!==T.selected);\n      T.selected=null;saveHNotify();",
    )

    # Remove standalone done / sketch:save block (fullscreen uses back button)
    scr = re.sub(
        r"\$\('dsaSkDoneBtn'\)\.addEventListener\('click',\(\)=>\{[\s\S]*?toast\('Saved ✓'\);\s*\}\);\s*",
        "",
        scr,
    )
    scr = re.sub(
        r"function flushSketchDone\(\)\{[\s\S]*?toast\('Saved'\);\s*\}\s*\$\('dsaSkDoneBtn'\)\.addEventListener\('click',\(\)=>\{flushSketchDone\(\);\}\);\s*",
        "",
        scr,
    )
    scr = scr.replace(
        "function resize(){\n  const r=cw.getBoundingClientRect();\n  const padding=48;\n  const w=Math.floor(r.width-padding);\n  const h=Math.floor(r.height-padding);\n  if(w<=0||h<=0)return;",
        "function resize(){\n  const r=cw.getBoundingClientRect();\n  const padding=isFakeFs?40:16;\n  let w=Math.max(120,Math.floor(r.width-padding));\n  let h=Math.max(120,Math.floor(r.height-padding));\n  if(r.width<4||r.height<4){if(!isFakeFs){w=320;h=220;}else return;}",
    )

    scr = scr.replace(
        "document.addEventListener('keydown',e=>{",
        "function onDocKeyInner(e){",
        1,
    )
    scr = scr.replace(
        "if(e.key==='Escape' && S.tool==='grid' && G.current){gridRemove();}\n});",
        "if(e.key==='Escape' && S.tool==='grid' && G.current){gridRemove();}\n"
        "if((e.ctrlKey||e.metaKey)&&e.key==='s'&&isFakeFs){e.preventDefault();if(flushSketchDone())return;}\n}",
        1,
    )
    scr = scr.replace(
        "if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();$('dsaSkDoneBtn').click();return;}",
        "",
    )

    scr = scr.replace(
        "let rt;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(resize,100);});",
        "let rt;function onWinResize(){clearTimeout(rt);rt=setTimeout(()=>{resize();refreshGroupShown();},100);}\n"
        "window.addEventListener('resize',onWinResize);",
        1,
    )

    scr = scr.replace(
        "const FADE=900;\n\nfunction toast",
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
        "  }catch(_){hasInk=S.hist.length>1||T.list.length>0;}\n"
        "}\n"
        "let isFakeFs=false,fsParent=null,fsNext=null,fsHideBackdrop=null,fsHideDlg=null;\n"
        "function enterFakeFullscreen(){\n"
        "  if(isFakeFs)return;\n"
        "  fsParent=editorRoot.parentNode;fsNext=editorRoot.nextSibling;\n"
        "  fsHideBackdrop=editorRoot.closest('.dsa-dialog-backdrop');\n"
        "  fsHideDlg=editorRoot.closest('.dsa-dialog');\n"
        "  document.body.appendChild(editorRoot);\n"
        "  editorRoot.classList.add('dsa-sketch-studio-host--fullscreen');\n"
        "  $('dsaSkApp').classList.add('fs');\n"
        "  if(fsHideBackdrop)fsHideBackdrop.classList.add('dsa-sketch-fs-hide-dialog');\n"
        "  if(fsHideDlg)fsHideDlg.classList.add('dsa-sketch-fs-hide-dialog');\n"
        "  isFakeFs=true;\n"
        "  syncFsChrome();\n"
        "  requestAnimationFrame(()=>setTimeout(resize,80));\n"
        "}\n"
        "function leaveFakeFullscreen(){\n"
        "  if(!isFakeFs)return;\n"
        "  if(fsHideBackdrop)fsHideBackdrop.classList.remove('dsa-sketch-fs-hide-dialog');\n"
        "  if(fsHideDlg)fsHideDlg.classList.remove('dsa-sketch-fs-hide-dialog');\n"
        "  fsHideBackdrop=null;fsHideDlg=null;\n"
        "  editorRoot.classList.remove('dsa-sketch-studio-host--fullscreen');\n"
        "  $('dsaSkApp').classList.remove('fs');\n"
        "  if(fsParent){\n"
        "    if(fsNext)fsParent.insertBefore(editorRoot,fsNext);\n"
        "    else fsParent.appendChild(editorRoot);\n"
        "  }\n"
        "  fsParent=null;fsNext=null;isFakeFs=false;\n"
        "  syncFsChrome();\n"
        "  requestAnimationFrame(()=>setTimeout(resize,80));\n"
        "}\n"
        "function applySiteBrand(){\n"
        "  const b=(typeof dsaGetSiteBrandForSketch==='function')?dsaGetSiteBrandForSketch():null;\n"
        "  if(!b)return;\n"
        "  const t=$('dsaSkBrandTitle'),s=$('dsaSkBrandSubtitle'),m=$('dsaSkBrandMarkText');\n"
        "  if(t&&b.title)t.textContent=b.title;\n"
        "  if(s&&b.subtitle)s.textContent=b.subtitle;\n"
        "  if(m&&b.markText)m.textContent=b.markText;\n"
        "}\n"
        "function syncFsChrome(){\n"
        "  const back=$('dsaSkBackBtn');\n"
        "  if(!back)return;\n"
        "  if(isFakeFs){\n"
        "    back.hidden=false;\n"
        "    syncInk();\n"
        "    const lab=back.querySelector('.dsa-sk-back-label');\n"
        "    if(lab)lab.textContent=hasInk?'Done':'Close';\n"
        "    back.dataset.tip=hasInk?'Save sketch and return':'Return without saving';\n"
        "  }else{back.hidden=true;}\n"
        "}\n"
        "function flushSketchDone(){\n"
        "  if(T.editing!==null)commitTextEdit();\n"
        "  if(G.current)gridDone();\n"
        "  syncInk();\n"
        "  onChange();\n"
        "  if(!hasInk){return false;}\n"
        "  if(typeof hooks.onPersist==='function'){hooks.onPersist();}\n"
        "  toast('Saved');\n"
        "  return true;\n"
        "}\n"
        "function exitFullscreenSmart(){\n"
        "  if(T.editing!==null)commitTextEdit();\n"
        "  if(G.current)gridDone();\n"
        "  syncInk();\n"
        "  onChange();\n"
        "  if(hasInk&&typeof hooks.onPersist==='function'){hooks.onPersist();toast('Saved');}\n"
        "  leaveFakeFullscreen();\n"
        "}\n"
        "function toast",
    )

    scr = scr.replace(
        "function saveH(){try{S.hist.push({img:cv.toDataURL(),texts:JSON.parse(JSON.stringify(T.list))});",
        "function saveH(){try{S.hist.push({img:cv.toDataURL(),texts:JSON.parse(JSON.stringify(T.list))});",
    )
    scr = scr.replace(
        "S.redo=[];}catch(e){}}\nfunction restore",
        "S.redo=[];}catch(e){}}\nfunction saveHNotify(){saveH();syncInk();if(isFakeFs)syncFsChrome();onChange();}\nfunction restore",
    )

    if "document.getElementById" in scr:
        i = scr.index("document.getElementById")
        raise RuntimeError("leftover getElementById: " + scr[i : i + 120])

    return scr


def main() -> None:
    body = transform_body((BASE / "_sketch_extract_body.html").read_text().strip())
    body_json = json.dumps(body, ensure_ascii=False)
    scr = transform_script((BASE / "_sketch_extract_script.js").read_text())

    prelude = f'''/**
 * DSA problem sketch — Sketch Studio Pro UI (embedded).
 * Generated by scripts/build-sketch-studio.py — edit _sketch_extract_* then re-run.
 */
function dsaWireSketchEditorStudio(editorRoot, onChange, sketchOpts) {{
    const hooks = sketchOpts || {{}};
    if (!editorRoot) {{
        return dsaWireSketchEditorStudioStub();
    }}
    if (!document.head.querySelector("link[data-dsa-sketch-studio-css]")) {{
        const lk = document.createElement("link");
        lk.rel = "stylesheet";
        lk.href = "./dsa-sketch-studio.css?v=3";
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
    applySiteBrand();

    $('dsaSkFsBtn').addEventListener('click', () => {
        if (isFakeFs) exitFullscreenSmart();
        else enterFakeFullscreen();
    });
    const backBtn = $('dsaSkBackBtn');
    if (backBtn) backBtn.addEventListener('click', () => exitFullscreenSmart());

    function onDocKey(e) {
        if (e.key === 'Escape' && isFakeFs) {
            e.preventDefault();
            e.stopPropagation();
            exitFullscreenSmart();
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
    syncFsChrome();
    onChange();
    overlayLoop();

    function exportCanvas() {
        const tmp = document.createElement('canvas');
        tmp.width = cv.width;
        tmp.height = cv.height;
        const tctx = tmp.getContext('2d');
        tctx.drawImage(cv, 0, 0);
        tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        for (const tb of T.list) {
            tctx.fillStyle = tb.color;
            tctx.globalAlpha = tb.opacity;
            tctx.font = `600 ${tb.size}px -apple-system,sans-serif`;
            tctx.textBaseline = 'top';
            const lines = tb.text.split('\n');
            let yy = tb.y;
            for (const line of lines) {
                tctx.fillText(line, tb.x, yy);
                yy += tb.size * 1.2;
            }
        }
        return tmp.toDataURL('image/png');
    }

    const api = {
        clear() {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, cv.width, cv.height);
            ctx.restore();
            G.current = null;
            T.list = [];
            T.selected = null;
            T.editing = null;
            if (txEditor) txEditor.style.display = 'none';
            S.hist = [];
            saveH();
            hasInk = false;
            if (typeof hooks.afterClear === 'function') hooks.afterClear();
            onChange();
        },
        zoomIn() {
            S.zoom = Math.min(4, S.zoom * 1.15);
            applyZoom();
        },
        zoomOut() {
            S.zoom = Math.max(0.25, S.zoom / 1.15);
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
                ctx.save();
                ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
                ctx.clearRect(0, 0, cssW, cssH);
                ctx.restore();
                const sc = Math.min(cssW / im.width, cssH / im.height) * 0.9;
                const w = im.width * sc;
                const h = im.height * sc;
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
                return exportCanvas();
            } catch (_) {
                return '';
            }
        },
        toPersistedSketchDataUrl() {
            try {
                const tmp = document.createElement('canvas');
                tmp.width = cv.width;
                tmp.height = cv.height;
                const tctx = tmp.getContext('2d');
                tctx.fillStyle = '#fff';
                tctx.fillRect(0, 0, tmp.width, tmp.height);
                tctx.drawImage(cv, 0, 0);
                tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
                for (const tb of T.list) {
                    tctx.fillStyle = tb.color;
                    tctx.globalAlpha = tb.opacity;
                    tctx.font = `600 ${tb.size}px -apple-system,sans-serif`;
                    tctx.textBaseline = 'top';
                    const lines = tb.text.split('\n');
                    let yy = tb.y;
                    for (const line of lines) {
                        tctx.fillText(line, tb.x, yy);
                        yy += tb.size * 1.2;
                    }
                }
                return tmp.toDataURL('image/jpeg', 0.82);
            } catch (_) {
                try {
                    return exportCanvas();
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
