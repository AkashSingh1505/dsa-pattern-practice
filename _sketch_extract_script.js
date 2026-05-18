(()=>{
const cv=document.getElementById('canvas'),ctx=cv.getContext('2d');
const ov=document.getElementById('overlay'),octx=ov.getContext('2d');
const cw=document.getElementById('cw');
const stage=document.getElementById('stage');
const app=document.getElementById('app');
const txEditor=document.getElementById('textEditor');
const DPR=Math.max(window.devicePixelRatio||1,1);

const S={tool:'brush',color:'#1d1d1f',size:6,opacity:1,drawing:false,sx:0,sy:0,
  hist:[],redo:[],zoom:1,pts:[],laser:[],laserActive:false,laserStop:0,
  lastPenT:0,usePressure:false,_lastPrev:null};

/* Multi-table: one editable grid at a time. Done bakes into canvas */
const G={current:null, drag:null, ds:null};

/* Text boxes — live, editable, movable */
const T={list:[], selected:null, editing:null, drag:null, ds:null, nextId:1};

const FADE=900;

function toast(msg){
  const t=document.getElementById('toast');
  document.getElementById('tT').textContent=msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t=setTimeout(()=>t.classList.remove('show'),1700);
}

/* ===== RESIZE: stage = canvas container ===== */
function resize(){
  const r=cw.getBoundingClientRect();
  const padding=48;
  const w=Math.floor(r.width-padding);
  const h=Math.floor(r.height-padding);
  if(w<=0||h<=0)return;
  let tmp=null;
  if(cv.width&&cv.height){
    tmp=document.createElement('canvas');
    tmp.width=cv.width;tmp.height=cv.height;
    tmp.getContext('2d').drawImage(cv,0,0);
  }
  stage.style.width=w+'px';
  stage.style.height=h+'px';
  cv.width=w*DPR;cv.height=h*DPR;
  ov.width=w*DPR;ov.height=h*DPR;
  cv.style.width=w+'px';cv.style.height=h+'px';
  ov.style.width=w+'px';ov.style.height=h+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
  octx.setTransform(DPR,0,0,DPR,0,0);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  octx.imageSmoothingEnabled=true;octx.imageSmoothingQuality='high';
  if(tmp){
    ctx.save();ctx.setTransform(1,0,0,1,0,0);
    ctx.drawImage(tmp,0,0,cv.width,cv.height);
    ctx.restore();
  }
  applyZoom();
}
function applyZoom(){
  stage.style.transform=`scale(${S.zoom})`;
  document.getElementById('zV').textContent=Math.round(S.zoom*100)+'%';
}

/* ===== HISTORY ===== */
function saveH(){
  try{
    S.hist.push({img:cv.toDataURL(),texts:JSON.parse(JSON.stringify(T.list))});
    if(S.hist.length>60)S.hist.shift();
    S.redo=[];
  }catch(e){}
}
function restore(state){
  T.list=JSON.parse(JSON.stringify(state.texts||[]));
  T.selected=null;T.editing=null;
  const i=new Image();
  i.onload=()=>{
    ctx.save();ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.drawImage(i,0,0,cv.width,cv.height);
    ctx.restore();
  };
  i.src=state.img;
}
function undo(){if(S.hist.length>1){S.redo.push(S.hist.pop());restore(S.hist[S.hist.length-1]);toast('Undo');}}
function redoFn(){if(S.redo.length){const d=S.redo.pop();S.hist.push(d);restore(d);toast('Redo');}}

/* ===== POSITION (canvas coords, transform-aware via getBoundingClientRect) ===== */
function pos(e){
  const r=cv.getBoundingClientRect();
  return{x:(e.clientX-r.left)/S.zoom, y:(e.clientY-r.top)/S.zoom};
}

/* ===== STROKE SETUP ===== */
function setupStroke(pr){
  ctx.save();
  ctx.lineCap='round';ctx.lineJoin='round';
  const base=S.tool==='pencil'?S.size*0.7:(S.tool==='marker'?S.size*1.8:S.size);
  const lw=S.usePressure?base*(0.4+pr*0.9):base;
  if(S.tool==='eraser'){
    ctx.globalCompositeOperation='destination-out';
    ctx.strokeStyle='rgba(0,0,0,1)';ctx.fillStyle='rgba(0,0,0,1)';
    ctx.lineWidth=lw;
  }else if(S.tool==='marker'){
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=S.opacity*0.32;
    ctx.strokeStyle=S.color;ctx.fillStyle=S.color;
    ctx.lineWidth=lw;
  }else{
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=S.opacity;
    ctx.strokeStyle=S.color;ctx.fillStyle=S.color;
    ctx.lineWidth=lw;
  }
}

/* ===== TEXT BOXES ===== */
function measureTextBox(tb){
  octx.save();
  octx.font=`600 ${tb.size}px -apple-system,sans-serif`;
  const lines=tb.text.split('\n');
  let maxW=0;
  for(const l of lines){const w=octx.measureText(l||' ').width;if(w>maxW)maxW=w;}
  const h=lines.length*tb.size*1.2;
  octx.restore();
  return{w:maxW,h};
}
function textBoxAt(x,y){
  for(let i=T.list.length-1;i>=0;i--){
    const tb=T.list[i];
    const m=measureTextBox(tb);
    if(x>=tb.x-6 && x<=tb.x+m.w+6 && y>=tb.y-6 && y<=tb.y+m.h+6) return tb;
  }
  return null;
}
function renderTextBoxes(){
  for(const tb of T.list){
    if(T.editing===tb.id)continue;
    octx.save();
    octx.fillStyle=tb.color;
    octx.globalAlpha=tb.opacity;
    octx.font=`600 ${tb.size}px -apple-system,sans-serif`;
    octx.textBaseline='top';
    const lines=tb.text.split('\n');
    let yy=tb.y;
    for(const line of lines){
      octx.fillText(line,tb.x,yy);
      yy+=tb.size*1.2;
    }
    if(T.selected===tb.id && S.tool==='text'){
      const m=measureTextBox(tb);
      octx.globalAlpha=1;
      octx.strokeStyle='rgba(168,85,247,.85)';
      octx.lineWidth=1.5;
      octx.setLineDash([5,3]);
      octx.strokeRect(tb.x-5,tb.y-5,m.w+10,m.h+10);
      octx.setLineDash([]);
      // corner dots
      octx.fillStyle='#a855f7';
      [[tb.x-5,tb.y-5],[tb.x+m.w+5,tb.y-5],[tb.x-5,tb.y+m.h+5],[tb.x+m.w+5,tb.y+m.h+5]].forEach(([cx,cy])=>{
        octx.beginPath();octx.arc(cx,cy,3.5,0,Math.PI*2);octx.fill();
      });
    }
    octx.restore();
  }
}
function startTextEdit(tb){
  T.editing=tb.id;
  T.selected=tb.id;
  txEditor.value=tb.text;
  txEditor.style.color=tb.color;
  txEditor.style.fontSize=tb.size+'px';
  txEditor.style.opacity=tb.opacity;
  txEditor.style.left=(tb.x-6)+'px';
  txEditor.style.top=(tb.y-6)+'px';
  txEditor.style.minWidth='80px';
  txEditor.style.display='block';
  autoSizeEditor();
  setTimeout(()=>{txEditor.focus();txEditor.select();},20);
}
function autoSizeEditor(){
  txEditor.style.height='auto';
  txEditor.style.width='auto';
  txEditor.style.height=(txEditor.scrollHeight+4)+'px';
  txEditor.style.width=Math.max(80,txEditor.scrollWidth+12)+'px';
}
function commitTextEdit(){
  if(T.editing===null)return;
  const tb=T.list.find(t=>t.id===T.editing);
  if(tb){
    tb.text=txEditor.value;
    if(!tb.text.trim()){
      T.list=T.list.filter(t=>t.id!==tb.id);
      T.selected=null;
    }
  }
  T.editing=null;
  txEditor.style.display='none';
  saveH();
}
txEditor.addEventListener('input',autoSizeEditor);
txEditor.addEventListener('keydown',e=>{
  e.stopPropagation();
  if(e.key==='Escape'){e.preventDefault();commitTextEdit();}
  // Enter alone commits (use Shift+Enter for newline)
  if(e.key==='Enter' && !e.shiftKey){e.preventDefault();commitTextEdit();}
});
txEditor.addEventListener('blur',()=>{if(T.editing!==null)commitTextEdit();});

/* ===== TABLES / GRID ===== */
function initGridDefaults(){
  const cssW=cv.width/DPR,cssH=cv.height/DPR;
  return{w:Math.min(420,cssW*0.6),h:Math.min(320,cssH*0.6)};
}
function addNewGrid(){
  if(G.current)return G.current;
  const cssW=cv.width/DPR,cssH=cv.height/DPR;
  const d=initGridDefaults();
  G.current={
    x:(cssW-d.w)/2,y:(cssH-d.h)/2,w:d.w,h:d.h,
    rows:+document.getElementById('gRows').value||6,
    cols:+document.getElementById('gCols').value||6
  };
  return G.current;
}
function gridHandleAt(x,y){
  if(!G.current||S.tool!=='grid')return null;
  const g=G.current;
  const h=[
    {x:g.x,y:g.y,t:'tl'},{x:g.x+g.w,y:g.y,t:'tr'},
    {x:g.x,y:g.y+g.h,t:'bl'},{x:g.x+g.w,y:g.y+g.h,t:'br'},
    {x:g.x+g.w/2,y:g.y,t:'t'},{x:g.x+g.w/2,y:g.y+g.h,t:'b'},
    {x:g.x,y:g.y+g.h/2,t:'l'},{x:g.x+g.w,y:g.y+g.h/2,t:'r'}
  ];
  for(const hh of h){if(Math.hypot(x-hh.x,y-hh.y)<=14)return hh.t;}
  if(x>=g.x&&x<=g.x+g.w&&y>=g.y&&y<=g.y+g.h)return 'move';
  return null;
}
function drawGridLines(target,g,color){
  target.strokeStyle=color;
  target.lineWidth=1;
  target.strokeRect(g.x,g.y,g.w,g.h);
  for(let i=1;i<g.cols;i++){
    const xx=g.x+(g.w/g.cols)*i;
    target.beginPath();target.moveTo(xx,g.y);target.lineTo(xx,g.y+g.h);target.stroke();
  }
  for(let i=1;i<g.rows;i++){
    const yy=g.y+(g.h/g.rows)*i;
    target.beginPath();target.moveTo(g.x,yy);target.lineTo(g.x+g.w,yy);target.stroke();
  }
}
function renderEditingGrid(){
  if(!G.current)return;
  const g=G.current;
  octx.save();
  octx.fillStyle='rgba(168,85,247,0.05)';
  octx.fillRect(g.x,g.y,g.w,g.h);
  drawGridLines(octx,g,'rgba(0,0,0,0.32)');
  if(S.tool==='grid'){
    const handles=[
      {x:g.x,y:g.y},{x:g.x+g.w,y:g.y},{x:g.x,y:g.y+g.h},{x:g.x+g.w,y:g.y+g.h},
      {x:g.x+g.w/2,y:g.y},{x:g.x+g.w/2,y:g.y+g.h},
      {x:g.x,y:g.y+g.h/2},{x:g.x+g.w,y:g.y+g.h/2}
    ];
    for(const h of handles){
      octx.shadowColor='rgba(168,85,247,0.5)';octx.shadowBlur=8;
      octx.fillStyle='#fff';
      octx.beginPath();octx.arc(h.x,h.y,7,0,Math.PI*2);octx.fill();
      octx.shadowBlur=0;
      octx.fillStyle='#a855f7';
      octx.beginPath();octx.arc(h.x,h.y,5,0,Math.PI*2);octx.fill();
    }
    octx.shadowBlur=0;
    octx.fillStyle='rgba(255,255,255,0.95)';
    octx.strokeStyle='rgba(168,85,247,0.5)';
    octx.lineWidth=1;
    const label=`${g.rows} × ${g.cols} • ${Math.round(g.w)}×${Math.round(g.h)}`;
    octx.font='600 11px -apple-system,sans-serif';
    const tw=octx.measureText(label).width;
    const lx=g.x+g.w/2-tw/2-7,ly=g.y-26;
    octx.beginPath();
    if(octx.roundRect)octx.roundRect(lx,ly,tw+14,20,5);
    else octx.rect(lx,ly,tw+14,20);
    octx.fill();octx.stroke();
    octx.fillStyle='#1d1d1f';
    octx.textBaseline='middle';
    octx.fillText(label,lx+7,ly+10);
  }
  octx.restore();
}
function bakeGridToCanvas(){
  if(!G.current)return;
  const g=G.current;
  ctx.save();
  ctx.globalCompositeOperation='source-over';
  ctx.globalAlpha=1;
  drawGridLines(ctx,g,'rgba(0,0,0,0.55)');
  ctx.restore();
}
function gridDone(){
  if(!G.current)return;
  bakeGridToCanvas();
  G.current=null;
  updateGridActionsPos();
  saveH();
  toast('Table fixed');
}
function gridRemove(){
  if(!G.current)return;
  G.current=null;
  updateGridActionsPos();
  toast('Table removed');
}
function updateGridActionsPos(){
  const el=document.getElementById('gridActions');
  if(!G.current||S.tool!=='grid'){el.classList.remove('show');return;}
  el.classList.add('show');
  const g=G.current;
  const cssW=cv.width/DPR, cssH=cv.height/DPR;
  const elW=220, elH=46;
  let lx=g.x + g.w/2 - elW/2;
  let ly=g.y + g.h + 12;
  if(ly+elH > cssH) ly = g.y - elH - 6;
  if(ly<0) ly = g.y + 10;
  lx = Math.max(8, Math.min(cssW-elW-8, lx));
  el.style.left=lx+'px';
  el.style.top=ly+'px';
}

/* ===== LASER ===== */
function startLaser(x,y){S.laser=[{x,y}];S.laserActive=true;S.laserStop=0;}
function moveLaser(x,y){
  const last=S.laser[S.laser.length-1];
  if(last&&Math.hypot(x-last.x,y-last.y)<0.5)return;
  S.laser.push({x,y});
}
function endLaser(){S.laserActive=false;S.laserStop=performance.now();}
function drawLaserPath(){
  octx.beginPath();
  if(S.laser.length===1){
    const p=S.laser[0];
    octx.arc(p.x,p.y,octx.lineWidth/2,0,Math.PI*2);octx.fill();return;
  }
  octx.moveTo(S.laser[0].x,S.laser[0].y);
  for(let i=1;i<S.laser.length-1;i++){
    const cu=S.laser[i],nx=S.laser[i+1];
    const mx=(cu.x+nx.x)/2,my=(cu.y+nx.y)/2;
    octx.quadraticCurveTo(cu.x,cu.y,mx,my);
  }
  const lst=S.laser[S.laser.length-1];
  octx.lineTo(lst.x,lst.y);
  octx.stroke();
}
function drawLaser(op){
  if(S.laser.length<1)return;
  const passes=[
    {w:22,a:0.22,b:40,c:'120,0,5'},
    {w:16,a:0.45,b:28,c:'180,0,15'},
    {w:11,a:0.75,b:18,c:'220,15,30'},
    {w:7, a:1.00,b:12,c:'255,40,55'},
    {w:4.5,a:1.00,b:9,c:'255,200,200'},
    {w:3, a:1.00,b:5, c:'255,255,255'}
  ];
  for(const p of passes){
    octx.save();
    octx.lineCap='round';octx.lineJoin='round';
    octx.shadowColor=`rgba(${p.c},1)`;octx.shadowBlur=p.b;
    octx.strokeStyle=`rgba(${p.c},${p.a*op})`;
    octx.fillStyle=`rgba(${p.c},${p.a*op})`;
    octx.lineWidth=p.w;
    drawLaserPath();
    octx.restore();
  }
  const tip=S.laser[S.laser.length-1];
  octx.save();
  octx.shadowColor='rgba(140,0,10,1)';octx.shadowBlur=50;
  octx.fillStyle=`rgba(180,0,15,${op})`;
  octx.beginPath();octx.arc(tip.x,tip.y,11,0,Math.PI*2);octx.fill();
  octx.shadowColor='rgba(255,30,40,1)';octx.shadowBlur=28;
  octx.fillStyle=`rgba(255,40,55,${op})`;
  octx.beginPath();octx.arc(tip.x,tip.y,6,0,Math.PI*2);octx.fill();
  octx.shadowColor='rgba(255,255,255,1)';octx.shadowBlur=18;
  octx.fillStyle=`rgba(255,255,255,${op})`;
  octx.beginPath();octx.arc(tip.x,tip.y,3.5,0,Math.PI*2);octx.fill();
  octx.restore();
}

/* ===== OVERLAY LOOP ===== */
function overlayLoop(){
  octx.save();octx.setTransform(1,0,0,1,0,0);
  octx.clearRect(0,0,ov.width,ov.height);
  octx.restore();
  renderTextBoxes();
  renderEditingGrid();
  updateGridActionsPos();
  if(S.laser.length>0){
    let op=1;
    if(!S.laserActive&&S.laserStop>0){
      const el=performance.now()-S.laserStop;
      if(el>=FADE){S.laser=[];S.laserStop=0;}
      else{const t=el/FADE;op=1-t*t;}
    }
    if(op>0)drawLaser(op);
  }
  if(S.drawing&&S._lastPrev&&['line','rect','circle','arrow'].includes(S.tool)){
    const p=S._lastPrev;
    octx.save();
    octx.strokeStyle=S.color;octx.fillStyle=S.color;
    octx.globalAlpha=S.opacity;
    octx.lineWidth=S.size;
    octx.lineCap='round';octx.lineJoin='round';
    if(S.tool==='line'){
      octx.beginPath();octx.moveTo(S.sx,S.sy);octx.lineTo(p.x,p.y);octx.stroke();
    }else if(S.tool==='rect'){
      octx.strokeRect(Math.min(S.sx,p.x),Math.min(S.sy,p.y),Math.abs(p.x-S.sx),Math.abs(p.y-S.sy));
    }else if(S.tool==='circle'){
      const r=Math.hypot(p.x-S.sx,p.y-S.sy);
      octx.beginPath();octx.arc(S.sx,S.sy,r,0,Math.PI*2);octx.stroke();
    }else if(S.tool==='arrow'){
      octx.beginPath();octx.moveTo(S.sx,S.sy);octx.lineTo(p.x,p.y);octx.stroke();
      const a=Math.atan2(p.y-S.sy,p.x-S.sx),hl=Math.max(10,S.size*3);
      octx.beginPath();
      octx.moveTo(p.x,p.y);
      octx.lineTo(p.x-hl*Math.cos(a-Math.PI/6),p.y-hl*Math.sin(a-Math.PI/6));
      octx.lineTo(p.x-hl*Math.cos(a+Math.PI/6),p.y-hl*Math.sin(a+Math.PI/6));
      octx.closePath();octx.fill();
    }
    octx.restore();
  }
  requestAnimationFrame(overlayLoop);
}

/* ===== SMOOTH STROKE ===== */
function drawSeg(){
  const n=S.pts.length;
  if(n<2)return;
  const p2=S.pts[n-1];
  setupStroke(p2.p);
  if(n===2){
    const p0=S.pts[0],p1=S.pts[1];
    const m={x:(p0.x+p1.x)/2,y:(p0.y+p1.y)/2};
    ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(m.x,m.y);ctx.stroke();
  }else{
    const p0=S.pts[n-3],p1=S.pts[n-2];
    const m1={x:(p0.x+p1.x)/2,y:(p0.y+p1.y)/2};
    const m2={x:(p1.x+p2.x)/2,y:(p1.y+p2.y)/2};
    ctx.beginPath();
    ctx.moveTo(m1.x,m1.y);
    ctx.quadraticCurveTo(p1.x,p1.y,m2.x,m2.y);
    ctx.stroke();
  }
  ctx.restore();
}
function finishStroke(){
  const n=S.pts.length;
  if(n<2)return;
  const p1=S.pts[n-1];
  setupStroke(p1.p);
  const p0=S.pts[n-2];
  const m1={x:(p0.x+p1.x)/2,y:(p0.y+p1.y)/2};
  ctx.beginPath();
  ctx.moveTo(m1.x,m1.y);
  ctx.lineTo(p1.x,p1.y);
  ctx.stroke();
  ctx.restore();
}

/* ===== PRESSURE ===== */
function getPressure(e){
  if(e.pointerType==='pen'){return e.pressure>0?e.pressure:0.5;}
  return 0.5;
}
function updatePressureUI(pr){
  const wrap=document.getElementById('pressureWrap');
  if(S.usePressure){wrap.style.display='';document.getElementById('sPr').textContent=pr.toFixed(2);}
  else wrap.style.display='none';
}

/* ===== POINTER EVENTS ===== */
function onDown(e){
  e.preventDefault();
  try{cv.setPointerCapture(e.pointerId);}catch(_){}
  const p=pos(e);
  const pr=getPressure(e);
  S.usePressure=(e.pointerType==='pen');
  if(e.pointerType==='pen'){
    S.lastPenT=performance.now();
    document.getElementById('penBadge').classList.add('show');
  }
  updatePressureUI(pr);

  /* ===== TEXT TOOL ===== */
  if(S.tool==='text'){
    if(T.editing!==null)commitTextEdit();
    const hit=textBoxAt(p.x,p.y);
    if(hit){
      T.selected=hit.id;
      T.drag='move';
      T.ds={x:hit.x,y:hit.y,mx:p.x,my:p.y};
    }else{
      // create new
      const tb={
        id:T.nextId++,x:p.x,y:p.y,text:'',
        color:S.color,size:Math.max(16,S.size*2.5),opacity:S.opacity
      };
      T.list.push(tb);
      startTextEdit(tb);
    }
    return;
  }

  /* ===== GRID TOOL ===== */
  if(S.tool==='grid'){
    if(G.current){
      const h=gridHandleAt(p.x,p.y);
      if(h){G.drag=h;G.ds={x:G.current.x,y:G.current.y,w:G.current.w,h:G.current.h,mx:p.x,my:p.y};return;}
    }
    return;
  }

  if(S.tool==='laser'){S.drawing=true;startLaser(p.x,p.y);return;}

  S.drawing=true;
  S.sx=p.x;S.sy=p.y;
  S._lastPrev={x:p.x,y:p.y};
  if(['brush','pencil','marker','eraser'].includes(S.tool)){
    S.pts=[{x:p.x,y:p.y,p:pr}];
  }
}

function onMove(e){
  const p=pos(e);
  document.getElementById('sP').textContent=`x: ${Math.round(p.x)} · y: ${Math.round(p.y)}`;
  const pr=getPressure(e);
  if(e.pointerType==='pen')updatePressureUI(pr);

  /* dragging text */
  if(T.drag && T.ds){
    const tb=T.list.find(t=>t.id===T.selected);
    if(tb){
      tb.x=T.ds.x+(p.x-T.ds.mx);
      tb.y=T.ds.y+(p.y-T.ds.my);
    }
    return;
  }

  /* dragging grid */
  if(G.drag&&G.ds&&G.current){
    const dx=p.x-G.ds.mx,dy=p.y-G.ds.my;
    if(G.drag==='move'){G.current.x=G.ds.x+dx;G.current.y=G.ds.y+dy;}
    else{
      let nx=G.ds.x,ny=G.ds.y,nw=G.ds.w,nh=G.ds.h;
      if(G.drag.includes('l')){nx=G.ds.x+dx;nw=G.ds.w-dx;}
      if(G.drag.includes('r')){nw=G.ds.w+dx;}
      if(G.drag.includes('t')){ny=G.ds.y+dy;nh=G.ds.h-dy;}
      if(G.drag.includes('b')){nh=G.ds.h+dy;}
      if(nw>=20&&nh>=20){G.current.x=nx;G.current.y=ny;G.current.w=nw;G.current.h=nh;}
    }
    return;
  }

  if(!S.drawing)return;
  if(S.tool==='laser'){moveLaser(p.x,p.y);return;}

  if(['brush','pencil','marker','eraser'].includes(S.tool)){
    const evs=(e.getCoalescedEvents&&e.getCoalescedEvents().length)?e.getCoalescedEvents():[e];
    for(const ev of evs){
      const pp=pos(ev);
      const ppr=getPressure(ev);
      S.pts.push({x:pp.x,y:pp.y,p:ppr});
      drawSeg();
    }
  }else{
    S._lastPrev={x:p.x,y:p.y};
  }
}

function onUp(e){
  try{cv.releasePointerCapture(e.pointerId);}catch(_){}
  if(T.drag){T.drag=null;T.ds=null;saveH();return;}
  if(G.drag){G.drag=null;G.ds=null;return;}
  if(!S.drawing)return;
  S.drawing=false;
  const p=pos(e);

  if(S.tool==='laser'){endLaser();return;}

  if(['brush','pencil','marker','eraser'].includes(S.tool)){
    finishStroke();S.pts=[];saveH();return;
  }

  ctx.save();
  ctx.strokeStyle=S.color;ctx.fillStyle=S.color;
  ctx.globalAlpha=S.opacity;
  ctx.lineWidth=S.size;
  ctx.lineCap='round';ctx.lineJoin='round';
  if(S.tool==='line'){
    ctx.beginPath();ctx.moveTo(S.sx,S.sy);ctx.lineTo(p.x,p.y);ctx.stroke();
  }else if(S.tool==='rect'){
    ctx.strokeRect(Math.min(S.sx,p.x),Math.min(S.sy,p.y),Math.abs(p.x-S.sx),Math.abs(p.y-S.sy));
  }else if(S.tool==='circle'){
    const r=Math.hypot(p.x-S.sx,p.y-S.sy);
    ctx.beginPath();ctx.arc(S.sx,S.sy,r,0,Math.PI*2);ctx.stroke();
  }else if(S.tool==='arrow'){
    ctx.beginPath();ctx.moveTo(S.sx,S.sy);ctx.lineTo(p.x,p.y);ctx.stroke();
    const a=Math.atan2(p.y-S.sy,p.x-S.sx),hl=Math.max(10,S.size*3);
    ctx.beginPath();
    ctx.moveTo(p.x,p.y);
    ctx.lineTo(p.x-hl*Math.cos(a-Math.PI/6),p.y-hl*Math.sin(a-Math.PI/6));
    ctx.lineTo(p.x-hl*Math.cos(a+Math.PI/6),p.y-hl*Math.sin(a+Math.PI/6));
    ctx.closePath();ctx.fill();
  }
  ctx.restore();
  S._lastPrev=null;
  saveH();
}

cv.addEventListener('pointerdown',onDown);
cv.addEventListener('pointermove',onMove);
cv.addEventListener('pointerup',onUp);
cv.addEventListener('pointercancel',onUp);
cv.addEventListener('pointerleave',e=>{if(S.drawing)onUp(e);});

/* Double click on text to edit */
cv.addEventListener('dblclick',e=>{
  if(S.tool!=='text')return;
  const p=pos(e);
  const hit=textBoxAt(p.x,p.y);
  if(hit)startTextEdit(hit);
});

/* ===== GROUP COLLAPSE (mobile) — respects data-nocollapse ===== */
function refreshGroupShown(){
  document.querySelectorAll('.group').forEach(g=>{
    if(g.hasAttribute('data-nocollapse'))return;
    const active=g.querySelector('.btn.active');
    g.querySelectorAll('.btn').forEach(b=>b.classList.remove('group-show'));
    (active||g.querySelector('.btn')).classList.add('group-show');
  });
}
refreshGroupShown();

document.addEventListener('click',(e)=>{
  if(window.innerWidth>900)return;
  const grp=e.target.closest('.group');
  if(!grp || grp.hasAttribute('data-nocollapse')){
    document.querySelectorAll('.group.expanded').forEach(g=>g.classList.remove('expanded'));
    return;
  }
  if(!grp.classList.contains('expanded')){
    e.stopPropagation();e.preventDefault();
    document.querySelectorAll('.group.expanded').forEach(g=>{if(g!==grp)g.classList.remove('expanded');});
    grp.classList.add('expanded');
  }else{
    if(e.target.closest('.btn')){
      setTimeout(()=>{grp.classList.remove('expanded');refreshGroupShown();},80);
    }
  }
},true);

/* ===== TOOL BUTTONS ===== */
const toolBtns=document.querySelectorAll('.btn[data-tool]');
function activateTool(name){
  // Commit any pending text edit when switching tools
  if(T.editing!==null && name!=='text')commitTextEdit();
  if(name!=='text')T.selected=null;
  toolBtns.forEach(x=>x.classList.remove('active'));
  const btn=document.querySelector(`.btn[data-tool="${name}"]`);
  if(btn)btn.classList.add('active');
  S.tool=name;
  const labels={brush:'Brush',pencil:'Pencil',marker:'Highlighter',eraser:'Eraser',laser:'Laser',line:'Line',rect:'Rectangle',circle:'Circle',arrow:'Arrow',text:'Text',grid:'Table'};
  document.getElementById('sT').textContent=labels[name]||name;
  document.getElementById('gridCtl').classList.toggle('show',name==='grid');
  cv.style.cursor=(name==='text')?'text':'crosshair';
  if(name==='grid' && !G.current)addNewGrid();
  refreshGroupShown();
  updateGridActionsPos();
}
toolBtns.forEach(b=>b.addEventListener('click',()=>activateTool(b.dataset.tool)));

/* ===== COLOR ===== */
document.querySelectorAll('.swatch').forEach(sw=>{
  sw.addEventListener('click',()=>{
    document.querySelectorAll('.swatch').forEach(x=>x.classList.remove('active'));
    sw.classList.add('active');
    S.color=sw.dataset.color;
    document.getElementById('sCT').textContent=S.color;
    document.getElementById('sCD').style.background=S.color;
    if(T.selected){
      const tb=T.list.find(t=>t.id===T.selected);
      if(tb && S.tool==='text'){tb.color=S.color;if(T.editing===tb.id)txEditor.style.color=S.color;}
    }
  });
});
document.getElementById('cp').addEventListener('input',e=>{
  S.color=e.target.value;
  document.querySelectorAll('.swatch').forEach(x=>x.classList.remove('active'));
  document.getElementById('sCT').textContent=S.color;
  document.getElementById('sCD').style.background=S.color;
});

/* ===== SIZE & OPACITY ===== */
const sizeR=document.getElementById('sizeR');
sizeR.addEventListener('input',()=>{
  S.size=+sizeR.value;
  document.getElementById('sizeV').textContent=S.size;
  document.getElementById('sS').textContent=S.size+' px';
  sizeR.style.setProperty('--val',((S.size-1)/79*100)+'%');
});
sizeR.dispatchEvent(new Event('input'));

const opR=document.getElementById('opR');
opR.addEventListener('input',()=>{
  S.opacity=+opR.value/100;
  document.getElementById('opV').textContent=opR.value;
  opR.style.setProperty('--val',(opR.value-10)/90*100+'%');
});
opR.dispatchEvent(new Event('input'));

/* ===== GRID INPUTS / DONE / CANCEL ===== */
document.getElementById('gRows').addEventListener('input',e=>{
  const v=Math.max(1,Math.min(50,+e.target.value||1));
  if(G.current)G.current.rows=v;
});
document.getElementById('gCols').addEventListener('input',e=>{
  const v=Math.max(1,Math.min(50,+e.target.value||1));
  if(G.current)G.current.cols=v;
});
document.getElementById('gridDone').addEventListener('click',(e)=>{e.stopPropagation();gridDone();});
document.getElementById('gridRemove').addEventListener('click',(e)=>{e.stopPropagation();gridRemove();});

/* ===== HEADER BUTTONS ===== */
document.getElementById('undoBtn').addEventListener('click',undo);
document.getElementById('redoBtn').addEventListener('click',redoFn);

document.getElementById('clearBtn').addEventListener('click',()=>{
  if(confirm('Clear canvas?')){
    ctx.save();ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.restore();
    G.current=null;
    T.list=[];T.selected=null;T.editing=null;
    txEditor.style.display='none';
    saveH();
    toast('Canvas cleared');
  }
});

/* ===== DONE button — hook for your DB save ===== */
function exportCanvas(){
  const tmp=document.createElement('canvas');
  tmp.width=cv.width;tmp.height=cv.height;
  const tctx=tmp.getContext('2d');
  tctx.drawImage(cv,0,0);
  tctx.scale(DPR,DPR);
  for(const tb of T.list){
    tctx.fillStyle=tb.color;
    tctx.globalAlpha=tb.opacity;
    tctx.font=`600 ${tb.size}px -apple-system,sans-serif`;
    tctx.textBaseline='top';
    const lines=tb.text.split('\n');
    let yy=tb.y;
    for(const line of lines){tctx.fillText(line,tb.x,yy);yy+=tb.size*1.2;}
  }
  return tmp.toDataURL('image/png');
}
/* ===== IMAGE IMPORT ===== */
document.getElementById('imgInput').addEventListener('change',e=>{
  const f=e.target.files[0];
  if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{
    const img=new Image();
    img.onload=()=>{
      const cssW=cv.width/DPR,cssH=cv.height/DPR;
      const sc=Math.min(cssW/img.width,cssH/img.height)*0.9;
      const w=img.width*sc,h=img.height*sc;
      ctx.drawImage(img,(cssW-w)/2,(cssH-h)/2,w,h);
      saveH();
      toast('Image imported');
    };
    img.src=ev.target.result;
  };
  r.readAsDataURL(f);
  e.target.value='';
});

/* ===== FULLSCREEN — on entire .app ===== */
document.getElementById('fsBtn').addEventListener('click',()=>{
  if(!document.fullscreenElement){
    app.classList.add('fs');
    const req=app.requestFullscreen||app.webkitRequestFullscreen;
    if(req)req.call(app).catch(()=>{});
  }else{document.exitFullscreen();}
});
document.addEventListener('fullscreenchange',()=>{
  if(!document.fullscreenElement)app.classList.remove('fs');
  setTimeout(resize,120);
});

/* ===== ZOOM ===== */
document.getElementById('ziBtn').addEventListener('click',()=>{S.zoom=Math.min(4,S.zoom*1.15);applyZoom();});
document.getElementById('zoBtn').addEventListener('click',()=>{S.zoom=Math.max(0.25,S.zoom/1.15);applyZoom();});
document.getElementById('zrBtn').addEventListener('click',()=>{S.zoom=1;applyZoom();});

/* ===== KEYBOARD ===== */
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
  if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!e.shiftKey){e.preventDefault();undo();return;}
  if((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.shiftKey&&(e.key==='Z'||e.key==='z')))){e.preventDefault();redoFn();return;}
  if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();document.getElementById('doneBtn').click();return;}
  if(e.key==='Delete' || e.key==='Backspace'){
    if(T.selected && S.tool==='text' && T.editing===null){
      e.preventDefault();
      T.list=T.list.filter(t=>t.id!==T.selected);
      T.selected=null;saveH();
      return;
    }
  }
  const map={b:'brush',p:'pencil',m:'marker',e:'eraser',l:'laser',r:'rect',c:'circle',a:'arrow',t:'text',g:'grid'};
  const k=e.key.toLowerCase();
  if(map[k]){activateTool(map[k]);}
  if(e.key==='['){sizeR.value=Math.max(1,+sizeR.value-1);sizeR.dispatchEvent(new Event('input'));}
  if(e.key===']'){sizeR.value=Math.min(80,+sizeR.value+1);sizeR.dispatchEvent(new Event('input'));}
  if(e.key==='Enter' && S.tool==='grid' && G.current){gridDone();}
  if(e.key==='Escape' && S.tool==='grid' && G.current){gridRemove();}
});

/* ===== PEN BADGE AUTO-HIDE ===== */
setInterval(()=>{
  if(S.lastPenT&&performance.now()-S.lastPenT>5000){
    document.getElementById('penBadge').classList.remove('show');
    S.lastPenT=0;
  }
},1000);

/* ===== INIT ===== */
window.addEventListener('resize',()=>{resize();refreshGroupShown();});
resize();
saveH();
overlayLoop();

})();
