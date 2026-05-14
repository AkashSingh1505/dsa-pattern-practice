(()=>{
const cv=document.getElementById('canvas'),ctx=cv.getContext('2d');
const ov=document.getElementById('overlay'),octx=ov.getContext('2d');
const cw=document.getElementById('cw'),app=document.getElementById('app');
const DPR=Math.max(window.devicePixelRatio||1,1);
const S={tool:'brush',color:'#1d1d1f',size:6,opacity:1,drawing:false,sx:0,sy:0,snap:null,hist:[],redo:[],zoom:1,pts:[],laser:[],laserActive:false,laserStop:0};
const FADE=900;
const isDark=()=>document.body.dataset.theme==='dark';
function resize(){
  const r=cw.getBoundingClientRect(),w=Math.floor(r.width),h=Math.floor(r.height);
  let tmp=null;
  if(cv.width&&cv.height){tmp=document.createElement('canvas');tmp.width=cv.width;tmp.height=cv.height;tmp.getContext('2d').drawImage(cv,0,0);}
  cv.width=w*DPR;cv.height=h*DPR;ov.width=w*DPR;ov.height=h*DPR;
  cv.style.width=w+'px';cv.style.height=h+'px';ov.style.width=w+'px';ov.style.height=h+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);octx.setTransform(DPR,0,0,DPR,0,0);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  octx.imageSmoothingEnabled=true;octx.imageSmoothingQuality='high';
  if(tmp){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(tmp,0,0,cv.width,cv.height);ctx.restore();}
  applyZoom();
}
function applyZoom(){cv.style.transform=`scale(${S.zoom})`;ov.style.transform=`scale(${S.zoom})`;document.getElementById('zV').textContent=Math.round(S.zoom*100)+'%';}
function saveH(){try{S.hist.push(cv.toDataURL());if(S.hist.length>60)S.hist.shift();S.redo=[];}catch(e){}}
function restore(d){const i=new Image();i.onload=()=>{ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(i,0,0,cv.width,cv.height);ctx.restore();};i.src=d;}
function undo(){if(S.hist.length>1){S.redo.push(S.hist.pop());restore(S.hist[S.hist.length-1]);toast('Undo');}}
function redoFn(){if(S.redo.length){const d=S.redo.pop();S.hist.push(d);restore(d);toast('Redo');}}
function pos(e){const r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)/S.zoom,y:(e.clientY-r.top)/S.zoom};}
function setupStroke(){
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  if(S.tool==='eraser'){ctx.globalCompositeOperation='destination-out';ctx.strokeStyle='rgba(0,0,0,1)';ctx.fillStyle='rgba(0,0,0,1)';ctx.lineWidth=S.size;}
  else if(S.tool==='marker'){ctx.globalCompositeOperation='source-over';ctx.globalAlpha=S.opacity*0.32;ctx.strokeStyle=S.color;ctx.fillStyle=S.color;ctx.lineWidth=S.size*1.8;}
  else{ctx.globalCompositeOperation='source-over';ctx.globalAlpha=S.opacity;ctx.strokeStyle=S.color;ctx.fillStyle=S.color;ctx.lineWidth=S.tool==='pencil'?S.size*0.7:S.size;}
}
function startLaser(x,y){S.laser=[{x,y}];S.laserActive=true;S.laserStop=0;}
function moveLaser(x,y){const last=S.laser[S.laser.length-1];if(last&&Math.hypot(x-last.x,y-last.y)<0.5)return;S.laser.push({x,y});}
function endLaser(){S.laserActive=false;S.laserStop=performance.now();}
function drawLaserPath(){
  octx.beginPath();
  if(S.laser.length===1){const p=S.laser[0];octx.arc(p.x,p.y,octx.lineWidth/2,0,Math.PI*2);octx.fill();return;}
  octx.moveTo(S.laser[0].x,S.laser[0].y);
  for(let i=1;i<S.laser.length-1;i++){
    const cu=S.laser[i],nx=S.laser[i+1];
    const mx=(cu.x+nx.x)/2,my=(cu.y+nx.y)/2;
    octx.quadraticCurveTo(cu.x,cu.y,mx,my);
  }
  const lst=S.laser[S.laser.length-1];octx.lineTo(lst.x,lst.y);
  octx.stroke();
}
function drawLaser(op){
  if(S.laser.length<1)return;
  // DARK + GLOWING laser passes (dark blood-red base, intense glow, bright core)
  const passes=[
    {m:8.0, a:0.22, b:80, c:'120,0,5'},     // very wide dark red halo
    {m:5.5, a:0.45, b:55, c:'180,0,15'},    // dark red glow
    {m:3.5, a:0.75, b:32, c:'220,15,30'},   // deep red
    {m:2.0, a:1.00, b:18, c:'255,40,55'},   // bright red
    {m:0.9, a:1.00, b:12, c:'255,200,200'}, // hot pink core
    {m:0.4, a:1.00, b:6,  c:'255,255,255'}, // white center
  ];
  for(const p of passes){
    octx.save();
    octx.lineCap='round';octx.lineJoin='round';
    octx.shadowColor=`rgba(${p.c},1)`;octx.shadowBlur=p.b;
    octx.strokeStyle=`rgba(${p.c},${p.a*op})`;
    octx.fillStyle=`rgba(${p.c},${p.a*op})`;
    octx.lineWidth=Math.max(1.5,S.size*p.m);
    drawLaserPath();
    octx.restore();
  }
  // Intense glowing tip
  const tip=S.laser[S.laser.length-1];
  octx.save();
  octx.shadowColor='rgba(140,0,10,1)';octx.shadowBlur=70;
  octx.fillStyle=`rgba(180,0,15,${op})`;
  octx.beginPath();octx.arc(tip.x,tip.y,Math.max(7,S.size*3.2),0,Math.PI*2);octx.fill();
  octx.shadowColor='rgba(255,30,40,1)';octx.shadowBlur=40;
  octx.fillStyle=`rgba(255,40,55,${op})`;
  octx.beginPath();octx.arc(tip.x,tip.y,Math.max(4,S.size*1.8),0,Math.PI*2);octx.fill();
  octx.shadowColor='rgba(255,255,255,1)';octx.shadowBlur=25;
  octx.fillStyle=`rgba(255,255,255,${op})`;
  octx.beginPath();octx.arc(tip.x,tip.y,Math.max(2,S.size*0.9),0,Math.PI*2);octx.fill();
  octx.restore();
}
function laserLoop(){
  octx.save();octx.setTransform(1,0,0,1,0,0);octx.clearRect(0,0,ov.width,ov.height);octx.restore();
  if(S.laser.length>0){
    let op=1;
    if(!S.laserActive&&S.laserStop>0){
      const el=performance.now()-S.laserStop;
      if(el>=FADE){S.laser=[];S.laserStop=0;}
      else{const t=el/FADE;op=1-t*t;}
    }
    if(op>0)drawLaser(op);
  }
  requestAnimationFrame(laserLoop);
}
function drawSeg(){
  const n=S.pts.length;if(n<2)return;
  setupStroke();
  if(n===2){
    const p0=S.pts[0],p1=S.pts[1],m={x:(p0.x+p1.x)/2,y:(p0.y+p1.y)/2};
    ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(m.x,m.y);ctx.stroke();
  } else {
    const p0=S.pts[n-3],p1=S.pts[n-2],p2=S.pts[n-1];
    const m1={x:(p0.x+p1.x)/2,y:(p0.y+p1.y)/2},m2={x:(p1.x+p2.x)/2,y:(p1.y+p2.y)/2};
    ctx.beginPath();ctx.moveTo(m1.x,m1.y);ctx.quadraticCurveTo(p1.x,p1.y,m2.x,m2.y);ctx.stroke();
  }
  ctx.restore();
}
function finishStroke(){
  const n=S.pts.length;if(n<2)return;
  setupStroke();
  const p0=S.pts[n-2],p1=S.pts[n-1],m1={x:(p0.x+p1.x)/2,y:(p0.y+p1.y)/2};
  ctx.beginPath();ctx.moveTo(m1.x,m1.y);ctx.lineTo(p1.x,p1.y);ctx.stroke();
  ctx.restore();
}
function start(e){
  if(e.preventDefault)e.preventDefault();
  const{x,y}=pos(e);S.drawing=true;S.sx=x;S.sy=y;
  if(S.tool==='laser'){startLaser(x,y);return;}
  if(S.tool==='text'){
    const t=prompt('Enter text:');
    if(t){ctx.save();ctx.globalAlpha=S.opacity;ctx.fillStyle=S.color;ctx.font=`600 ${Math.max(14,S.size*3)}px -apple-system,sans-serif`;ctx.textBaseline='top';ctx.fillText(t,x,y);ctx.restore();saveH();}
    S.drawing=false;return;
  }
  if(['line','rect','circle','arrow'].includes(S.tool)){S.snap=ctx.getImageData(0,0,cv.width,cv.height);return;}
  S.pts=[{x,y}];
  setupStroke();
  ctx.beginPath();ctx.arc(x,y,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();
  ctx.restore();
}
function move(e){
  const{x,y}=pos(e);
  document.getElementById('sP').textContent=`x: ${Math.round(x)} · y: ${Math.round(y)}`;
  if(!S.drawing)return;
  if(S.tool==='laser'){moveLaser(x,y);return;}
  if(['brush','pencil','marker','eraser'].includes(S.tool)){
    const last=S.pts[S.pts.length-1];
    if(last&&Math.hypot(x-last.x,y-last.y)<0.6)return;
    S.pts.push({x,y});drawSeg();return;
  }
  if(S.snap){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.putImageData(S.snap,0,0);ctx.restore();shape(S.sx,S.sy,x,y,e.shiftKey);}
}
function end(){
  if(!S.drawing)return;
  if(S.tool==='laser'){endLaser();S.drawing=false;return;}
  const wasShape=S.snap!=null,wasStroke=['brush','pencil','marker','eraser'].includes(S.tool);
  if(wasStroke)finishStroke();
  S.drawing=false;S.snap=null;S.pts=[];
  if(wasShape||wasStroke)saveH();
}
function shape(x1,y1,x2,y2,sh){
  ctx.save();ctx.globalAlpha=S.opacity;ctx.strokeStyle=S.color;ctx.fillStyle=S.color;ctx.lineWidth=S.size;ctx.lineCap='round';ctx.lineJoin='round';
  if(S.tool==='line'){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  else if(S.tool==='rect'){
    let w=x2-x1,h=y2-y1;
    if(sh){const s=Math.min(Math.abs(w),Math.abs(h));w=Math.sign(w)*s;h=Math.sign(h)*s;}
    const r=Math.min(10,Math.min(Math.abs(w),Math.abs(h))/4);
    ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x1,y1,w,h,r);else ctx.rect(x1,y1,w,h);ctx.stroke();
  } else if(S.tool==='circle'){
    const dx=x2-x1,dy=y2-y1;ctx.beginPath();
    if(sh){const r=Math.min(Math.abs(dx),Math.abs(dy));ctx.arc(x1,y1,r,0,Math.PI*2);}
    else ctx.ellipse((x1+x2)/2,(y1+y2)/2,Math.abs(dx)/2,Math.abs(dy)/2,0,0,Math.PI*2);
    ctx.stroke();
  } else if(S.tool==='arrow'){
    const hd=Math.max(12,S.size*2.5),an=Math.atan2(y2-y1,x2-x1);
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x2,y2);
    ctx.lineTo(x2-hd*Math.cos(an-Math.PI/6),y2-hd*Math.sin(an-Math.PI/6));
    ctx.lineTo(x2-hd*Math.cos(an+Math.PI/6),y2-hd*Math.sin(an+Math.PI/6));
    ctx.closePath();ctx.fill();
  }
  ctx.restore();
}
let toastT;
function toast(m){const t=document.getElementById('toast');document.getElementById('tT').textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),1400);}
cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);start(e);});
cv.addEventListener('pointermove',move);
cv.addEventListener('pointerup',end);
cv.addEventListener('pointercancel',end);
function setTool(n){
  const b=document.querySelector(`[data-tool="${n}"]`);if(!b)return;
  document.querySelectorAll('[data-tool]').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');S.tool=n;
  document.getElementById('sT').textContent=n.charAt(0).toUpperCase()+n.slice(1);
  cv.style.cursor=n==='text'?'text':'crosshair';
}
document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
document.getElementById('colors').addEventListener('click',e=>{
  const sw=e.target.closest('.swatch');if(!sw)return;
  document.querySelectorAll('#colors .swatch').forEach(s=>s.classList.remove('active'));
  sw.classList.add('active');setColor(sw.dataset.color);
});
document.getElementById('cp').addEventListener('input',e=>{
  document.querySelectorAll('#colors .swatch').forEach(s=>s.classList.remove('active'));
  setColor(e.target.value);
});
function setColor(c){S.color=c;document.getElementById('sCT').textContent=c;document.getElementById('sCD').style.background=c;}
const sR=document.getElementById('sizeR'),oR=document.getElementById('opR');
function upR(el){const mn=+el.min||0,mx=+el.max||100;el.style.setProperty('--val',(((+el.value-mn)/(mx-mn))*100)+'%');}
sR.addEventListener('input',e=>{S.size=+e.target.value;document.getElementById('sizeV').textContent=S.size;document.getElementById('sS').textContent=S.size+' px';upR(sR);});
oR.addEventListener('input',e=>{S.opacity=+e.target.value/100;document.getElementById('opV').textContent=e.target.value;upR(oR);});
upR(sR);upR(oR);
document.getElementById('undoBtn').addEventListener('click',undo);
document.getElementById('redoBtn').addEventListener('click',redoFn);
document.getElementById('clearBtn').addEventListener('click',()=>{
  if(confirm('Clear canvas?')){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);ctx.restore();saveH();toast('Cleared');}
});
document.getElementById('saveBtn').addEventListener('click',()=>{
  const t=document.createElement('canvas');t.width=cv.width;t.height=cv.height;
  const tc=t.getContext('2d');tc.fillStyle=isDark()?'#2c2c2e':'#fff';tc.fillRect(0,0,t.width,t.height);
  tc.drawImage(cv,0,0);
  const a=document.createElement('a');a.download=`sketch-${Date.now()}.png`;a.href=t.toDataURL('image/png');a.click();toast('Saved!');
});
document.getElementById('fsBtn').addEventListener('click',async()=>{try{if(!document.fullscreenElement)await app.requestFullscreen();else await document.exitFullscreen();}catch(e){}});
document.addEventListener('fullscreenchange',()=>{cw.classList.toggle('fs',!!document.fullscreenElement);setTimeout(resize,100);});
document.getElementById('ziBtn').addEventListener('click',()=>{S.zoom=Math.min(S.zoom+0.25,5);applyZoom();});
document.getElementById('zoBtn').addEventListener('click',()=>{S.zoom=Math.max(S.zoom-0.25,1);applyZoom();});
document.getElementById('zrBtn').addEventListener('click',()=>{S.zoom=1;applyZoom();});
cw.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();S.zoom=Math.max(1,Math.min(5,S.zoom+(e.deltaY<0?0.1:-0.1)));applyZoom();}},{passive:false});
document.getElementById('imgInput').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();r.onload=ev=>{const i=new Image();i.onload=()=>{
    const cssW=cv.width/DPR,cssH=cv.height/DPR;
    const rt=Math.min(cssW/i.width,cssH/i.height)*0.9;
    const w=i.width*rt,h=i.height*rt;
    ctx.drawImage(i,(cssW-w)/2,(cssH-h)/2,w,h);saveH();toast('Imported');
  };i.src=ev.target.result;};r.readAsDataURL(f);e.target.value='';
});
document.getElementById('themeBtn').addEventListener('click',()=>{document.body.dataset.theme=isDark()?'light':'dark';toast(isDark()?'Dark mode':'Light mode');});
document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA'].includes(e.target.tagName))return;
  const k=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey)&&k==='z'&&!e.shiftKey){e.preventDefault();undo();}
  else if((e.ctrlKey||e.metaKey)&&(k==='y'||(e.shiftKey&&k==='z'))){e.preventDefault();redoFn();}
  else if((e.ctrlKey||e.metaKey)&&k==='s'){e.preventDefault();document.getElementById('saveBtn').click();}
  else if(k==='b')setTool('brush');else if(k==='p')setTool('pencil');
  else if(k==='h')setTool('marker');else if(k==='e')setTool('eraser');
  else if(k==='q')setTool('laser');else if(k==='l')setTool('line');
  else if(k==='r')setTool('rect');else if(k==='c')setTool('circle');
  else if(k==='a')setTool('arrow');else if(k==='t')setTool('text');
  else if(k==='+'||k==='=')document.getElementById('ziBtn').click();
  else if(k==='-'||k==='_')document.getElementById('zoBtn').click();
  else if(k==='0')document.getElementById('zrBtn').click();
  else if(k==='f')document.getElementById('fsBtn').click();
});
let rt;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(resize,100);});
window.addEventListener('load',()=>{resize();saveH();laserLoop();});
})();