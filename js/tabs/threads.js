/* ---------- PHOTO EDITOR (dulu Threads; 27 Nov 2026, Mira) ----------
   Tab kekal id `threads`, koleksi `threads`. Empat langkah (t.step): 1 Gambar > 2 Edit > 3 Posting > 4 Post.
   1. Upload gambar (sampai 10). Tiada token, gambar tak naik ke Drive sampai posting dicopy.
   2. Edit: kad doodle (thdeco.js, 0 token; outline perlukan job subjek Mac mini), kotak tulisan, Lain-lain (warna, potong, laras), Download image.
   3. Posting: tanda platform (Threads, Facebook, Instagram, TikTok Photos) > Claude di Mac mini tulis caption setiap satu. Kotak boleh edit.
   4. Post: Copy caption setiap platform + gambar ikut saiz platform. (Fasa 2: slot dalam Jadual To Publish.)
   Draf disimpan sendiri dalam phone (IndexedDB `studio-photo`), bukan dalam Sheet.
   Belajar gaya Threads: versi yang Mira copy / edit disimpan dalam koleksi threads (tanpa `plat`); fb / ig / tt tak masuk belajar gaya. */
const TH_MAX=500,TH_TONE=['Auto','Santai','Cerita','Tips','Soalan','Jual lembut'];
const TH_PRE={asli:{l:'Asli',b:0,c:0,s:0,w:0},cantik:{l:'Auto cantik',b:8,c:10,s:14,w:4},cerah:{l:'Cerah',b:16,c:4,s:6,w:2},hangat:{l:'Hangat',b:6,c:6,s:10,w:16},
  pastel:{l:'Pastel',b:14,c:-12,s:-10,w:6},pop:{l:'Pop',b:4,c:18,s:28,w:0},filem:{l:'Filem',b:2,c:-6,s:-18,w:10},sejuk:{l:'Sejuk',b:6,c:6,s:4,w:-14}};
const TH_RATIO={asal:'Asal','3:4':'3:4','4:5':'4:5','1:1':'1:1','9:16':'9:16'};
const PE_PLAT={th:{l:'Threads',r:'3:4',b:'tab'},fb:{l:'Facebook',r:'4:5',b:'fb'},ig:{l:'Instagram',r:'4:5',b:'ig'},tt:{l:'TikTok',r:'9:16',b:'tt'}};
const PE_STEP=['Gambar','Edit','Posting','Post'];
const thUi=()=>ui.th||(ui.th={imgs:[],sel:0,points:'',tone:'Auto',thread:false,res:null,edit:{},postIds:{},busy:false,learnBusy:false,seg:'buat',dtxt:null,q:'',lf:'all',keep:null,step:1,plats:['th','fb'],rp:'th',more:false,dl:null,did:null});
const thStyle=()=>(S.settings&&S.settings.thStyle)||{};
const thPosts=()=>S.threads.slice().sort((a,b)=>(b.created||0)-(a.created||0));
const thFinal=p=>String(p.final||'').trim();

/* ---------- gambar: edit dengan canvas ---------- */
function thFilter(e){const b=100+e.b,c=100+e.c,s=100+e.s;return `brightness(${b}%) contrast(${c}%) saturate(${s}%)`+(e.w>0?` sepia(${e.w*0.9}%)`:'')+(e.w<0?` hue-rotate(${e.w*0.8}deg)`:'')}
function thCrop(img,ratio){const W=img.naturalWidth,H=img.naturalHeight;if(ratio==='asal')return {sx:0,sy:0,sw:W,sh:H};
  const [a,b]=ratio.split(':').map(Number);const r=a/b;let sw=W,sh=W/r;if(sh>H){sh=H;sw=H*r}return {sx:(W-sw)/2,sy:(H-sh)/2,sw,sh}}
function thRender(im,max,ratio){const c=thCrop(im.el,ratio||im.ratio);const k=Math.min(1,(max||2160)/Math.max(c.sw,c.sh));const cv=document.createElement('canvas');
  cv.width=Math.round(c.sw*k);cv.height=Math.round(c.sh*k);const x=cv.getContext('2d');x.filter=thFilter(im.e);x.drawImage(im.el,c.sx,c.sy,c.sw,c.sh,0,0,cv.width,cv.height);
  if(im.e.w<0){x.filter='none';x.globalCompositeOperation='soft-light';x.fillStyle=`rgba(90,140,220,${-im.e.w/100})`;x.fillRect(0,0,cv.width,cv.height)}
  return cv}
/* 27 Nov (Mira): tulisan + outline + doodle atas gambar, enjin dalam thdeco.js (0 token). */
/* Tulisan setiap gambar berasingan (im.deco.t); null = ikut tulisan am (t.dtxt, atau point). */
const thDecoText=im=>{const t=thUi();im=im||t.imgs[t.sel];return im&&im.deco.t!=null?im.deco.t:(t.dtxt!=null?t.dtxt:t.points)};
const thDirty=()=>{if(ui.th){ui.th.keep=null;ui.th.dl=null;peSaveSoon()}};
/* Topeng subjek diminta SEKALI untuk gambar penuh (im.mk); medan setiap nisbah dipotong dalam phone, jadi saiz platform lain tak perlukan job baru. */
function thF(im,key){key=key||im.ratio;if(im.mkS!=='ok'||!im.mk)return null;
  if(!im.F[key]){const c=thCrop(im.el,key),kx=(im.mk.naturalWidth||im.mk.width)/im.el.naturalWidth,ky=(im.mk.naturalHeight||im.mk.height)/im.el.naturalHeight,Hd=Math.round(300*c.sh/c.sw),cv=document.createElement('canvas');
    cv.width=300;cv.height=Hd;cv.getContext('2d').drawImage(im.mk,c.sx*kx,c.sy*ky,c.sw*kx,c.sh*ky,0,0,300,Hd);im.F[key]=tdField(cv,Hd)}
  return im.F[key]}
function thCompose(im,max,ratio){const r=ratio||im.ratio,cv=thRender(im,max,r);const d=r===im.ratio?im.deco:Object.assign({},im.deco,{pos:{}});
  if(d&&d.style)tdDraw(cv,d,thF(im,r),thDecoText(im));return cv}
const thBlob=async(im,ratio)=>{await tdFonts();return new Promise(r=>thCompose(im,2160,ratio).toBlob(r,'image/jpeg',0.92))};
async function thPaint(){await tdFonts();const cv=$('#thCv'),t=thUi(),im=t.imgs[t.sel];if(!cv||!im||!im.deco.style||!im.el.naturalWidth)return;
  const c=thRender(im,900);
  if(t.lasso){im._bx=[];const x=c.getContext('2d');x.fillStyle='rgba(0,0,0,.28)';x.fillRect(0,0,c.width,c.height)}
  else im._bx=tdDraw(c,im.deco,thF(im),thDecoText(im));
  if(cv.width!==c.width||cv.height!==c.height){cv.width=c.width;cv.height=c.height}cv.getContext('2d').drawImage(c,0,0)}
/* Topeng subjek dari Mac mini (job subjek, Apple Vision, 0 token). Gambar kecil 640 px dihantar, dibuang dari Drive sebaik siap. */
async function thMask(im){if(im.mkS)return;if(!ASSETS||!window.studioJob||mode!=='live'){im.mkS='none';return}
  im.mkS='busy';const t0=Date.now();render(true);let up=null;
  const iv=setInterval(()=>{const n=$('#thMkP');if(n)n.textContent=Math.min(95,Math.round((Date.now()-t0)/160))},400);
  try{const b=await new Promise(r=>thRender(im,640,'asal').toBlob(r,'image/jpeg',0.8));up=await ASSETS.upload(new File([b],'subjek.jpg',{type:'image/jpeg'}));
    const o=await window.studioJob('subjek',{file:up.id},90000);
    if(o&&o.b64){const m=new Image();await new Promise((r,j)=>{m.onload=r;m.onerror=j;m.src='data:image/png;base64,'+o.b64});im.mk=m;im.mkB=o.b64;im.mkS='ok'}else im.mkS='none'}
  catch(e){im.mkS='none';toast('Tak dapat cari bentuk subjek. Tulisan dan doodle masih jalan')}
  finally{clearInterval(iv);if(up)ASSETS.delete(up.id).catch(()=>{});thDirty();render(true)}}
function thAddImgs(files){const t=thUi();files.filter(f=>/^image\//.test(f.type)).slice(0,10-t.imgs.length).forEach(f=>{const url=URL.createObjectURL(f);const el=new Image();
  const im={id:uid(),name:f.name.replace(/\.[^.]+$/,''),file:f,url,el,ratio:'asal',pre:'cantik',e:Object.assign({},TH_PRE.cantik),deco:{style:'',col:null,seed:1,pos:{},txt:true,t:t.imgs.length?'':null,font:''},F:{}};el.onload=()=>{render(true);peSaveSoon()};el.src=url;t.imgs.push(im)});
  t.sel=Math.max(0,t.imgs.length-1);if(t.step===1&&t.imgs.length)t.step=2;thDirty();render(true)}

/* ---------- langkah ---------- */
function peSteps(){const t=thUi();return `<div class="pe-steps" style="--c:${TAB.threads.c}">${PE_STEP.map((l,i)=>`<button type="button" class="${t.step===i+1?'on':i+1<t.step?'past':''}" data-act="peStep" data-x="${i+1}" aria-current="${t.step===i+1?'step':'false'}"><i>${i+1}</i>${l}</button>`).join('')}</div>`}
A.peStep=el=>{thUi().step=+el.dataset.x;render(true);window.scrollTo(0,0);peSaveSoon()};

/* 1 · Gambar */
function peGambar(){const t=thUi();
  if(!t.imgs.length)return `<div class="card big glass"><span class="num">1 · Gambar</span><div class="pe-act"><button class="btn solid tab" data-act="thPick">${IC.up}Upload gambar</button><button class="btn" data-act="peCar">Dari video</button><button class="btn" data-act="peDesign">Dari Design</button></div><div class="pe-act"><button class="btn" data-act="peStep" data-x="3">Tanpa gambar</button></div></div>`;
  return `<div class="card big glass"><div class="rowh" style="align-items:center"><span class="num">1 · Gambar</span><span class="meta">${t.imgs.length}/10</span></div>
    <div class="pe-grid">${t.imgs.map((x,i)=>`<div class="pe-tile"><button type="button" data-act="peGo" data-x="${i}" aria-label="Edit gambar ${i+1}"><img src="${x.url}" style="filter:${thFilter(x.e)}" alt=""></button><b>${i+1}</b><button type="button" class="pe-x" data-act="peDelAt" data-x="${i}" aria-label="Buang gambar ${i+1}">${IC.x}</button></div>`).join('')}${t.imgs.length<10?`<button type="button" class="pe-tile add" data-act="thPick" aria-label="Tambah gambar">${IC.plus}</button>`:''}</div>
    <div class="pe-act"><button class="btn" data-act="peCar">Dari video</button><button class="btn" data-act="peDesign">Dari Design</button><button class="btn solid tab" data-act="peStep" data-x="2">Seterusnya: Edit</button></div></div>`}
A.thPick=()=>pickFile('image/*',fs=>thAddImgs(fs),true);
A.peGo=el=>{const t=thUi();t.sel=+el.dataset.x;t.step=2;render(true);window.scrollTo(0,0)};
A.peDelAt=el=>{const t=thUi(),i=+el.dataset.x,im=t.imgs[i];if(im)URL.revokeObjectURL(im.url);t.imgs.splice(i,1);t.sel=Math.max(0,Math.min(t.sel,t.imgs.length-1));thDirty();render(true)};

/* 2 · Edit: pratonton, kad doodle, kotak tulisan, Lain-lain (dilipat), Download. Mesti muat satu skrin phone. */
async function peDood(){const t=thUi(),im=t.imgs[t.sel];if(!im||!im.el.naturalWidth)return;await tdFonts();
  const key=[im.id,JSON.stringify(im.e),im.deco.col,im.deco.seed,im.mkS,im.deco.font,im.mkB&&im.mkB.length,thDecoText(im)].join('|');
  if(!im._dd||im._dd.k!==key){const u={},F=thF(im,'1:1');for(const k of Object.keys(TD_STY)){const c=thRender(im,160,'1:1');tdDraw(c,Object.assign({},im.deco,{style:k,pos:{}}),F,thDecoText(im));u[k]=c.toDataURL('image/jpeg',.7)}im._dd={k:key,u}}
  document.querySelectorAll('[data-pedd]').forEach(n=>{const s=im._dd.u[n.dataset.pedd];if(s&&n.getAttribute('src')!==s)n.src=s})}
const peDlLab=k=>{const d=thUi().dl;if(d&&d.k===k){if(d.p!=null)return `<i class="spin"></i>Sedia ${d.p}%`;if(d.files)return IC.dl+'Simpan ke phone'}return IC.dl+(k==='edit'?'Download image':'Gambar')};
function peEdit(){const t=thUi();const im=t.imgs[t.sel];if(!im)return peGambar();
  const dk=im.deco,dc=dk.style?(dk.col!=null?dk.col:TD_STY[dk.style].c):0;if(!dk.style)t.lasso=false;if(dk.style)requestAnimationFrame(thPaint);requestAnimationFrame(peDood);requestAnimationFrame(()=>peGrow($('#thDtx')));
  const many=t.imgs.length>1,dd=im._dd&&im._dd.u||{};
  const sl=(k,lab,min,max)=>`<label class="thsl"><span>${lab}<b data-v="${k}">${im.e[k]>0?'+':''}${im.e[k]}</b></span><input type="range" min="${min}" max="${max}" step="1" value="${im.e[k]}" data-thsl="${k}"></label>`;
  return `<div class="card big glass pe-ed">
    <div class="thstage pe-stage${t.lasso?' las':''}" style="${im.ratio!=='asal'?'aspect-ratio:'+im.ratio.replace(':','/'):''}">${dk.style?`<canvas id="thCv" class="thcv"></canvas>`:`<img id="thPrev" src="${im.url}" style="filter:${thFilter(im.e)};${im.ratio!=='asal'?'object-fit:cover;width:100%;height:100%':''}" alt="">${im.e.w<0?`<i class="thcool" style="opacity:${-im.e.w/100}"></i>`:''}`}${im.mkS==='busy'?`<span class="pill pe-busy" style="--pc:var(--c)"><i class="spin"></i>Cari bentuk <b id="thMkP">0</b>%</span>`:''}${t.lasso?`<span class="pill pe-busy" style="--pc:var(--c)">Lukis keliling benda tu</span>`:''}${dk.style&&im.mkS!=='busy'?`<div class="pe-pick"><button class="btn sm ${t.lasso?'solid tab':''}" data-act="peLasso">${IC.edit}${t.lasso?'Batal':'Pilih benda'}</button>${im.mkU&&!t.lasso?`<button class="btn sm" data-act="peAuto">Auto</button>`:''}</div>`:''}<button class="btn icon sm bad pe-del" data-act="thDelImg" aria-label="Buang gambar ni">${IC.trash}</button></div>
    ${many?`<div class="thrail pe-rail">${t.imgs.map((x,i)=>`<button class="thth ${i===t.sel?'on':''}" data-act="thSel" data-x="${i}" aria-label="Gambar ${i+1}"><img src="${x.url}" style="filter:${thFilter(x.e)}" alt=""></button>`).join('')}</div>`:''}
    <div class="pe-dood"><button type="button" class="pe-dd ${!dk.style?'on':''}" data-act="thDeco" data-x="" aria-pressed="${!dk.style}"><img src="${im.url}" style="filter:${thFilter(im.e)}" alt=""><span>Tiada</span></button>${Object.entries(TD_STY).map(([k,s])=>`<button type="button" class="pe-dd ${dk.style===k?'on':''}" data-act="thDeco" data-x="${k}" aria-pressed="${dk.style===k}"><img data-pedd="${k}" src="${dd[k]||im.url}" alt=""><span>${s.l}</span></button>`).join('')}</div>
    <textarea class="inp pe-tx" id="thDtx" data-thf="dtxt" rows="1" placeholder="${many?'Tulisan gambar '+(t.sel+1)+'. ':''}Baris pertama = tajuk, baris lain = satu tulisan.">${esc(thDecoText(im))}</textarea>
    <details class="pe-more"${t.more?' open':''}><summary>Lain-lain</summary>
      ${dk.style?`<span class="num" style="display:block;margin:6px 0 2px">Font</span><div class="thrail pe-fonts"><button type="button" class="pe-fn ${!dk.font?'on':''}" data-act="peFont" data-x="">Asal</button>${Object.entries(TD_FACE).map(([k,f])=>`<button type="button" class="pe-fn ${dk.font===k?'on':''}" data-act="peFont" data-x="${k}" style="font:${f[1].replace('SZ','17')}">${f[0]}</button>`).join('')}</div>`:''}
      ${dk.style?`<div class="thcolrow">${TD_COL.map((c,i)=>`<button class="thcol ${dc===i?'on':''}" style="--k:${c[1]}" data-act="thCol" data-x="${i}" aria-label="Warna ${c[0]}"></button>`).join('')}<button class="btn sm" data-act="thShuf">Susun lain</button></div>`:''}
      ${many?`<div class="btns" style="gap:6px;margin-top:10px"><button class="btn sm" data-act="thAll">Guna gaya ni untuk semua gambar</button></div>`:''}
      <span class="num" style="display:block;margin:12px 0 6px">Potong</span>
      <div class="btns" style="gap:6px">${Object.entries(TH_RATIO).map(([k,l])=>`<button class="btn sm ${im.ratio===k?'solid tab':''}" data-act="thRatio" data-x="${k}">${l}</button>`).join('')}</div>
      <div class="rowh" style="align-items:center;margin:12px 0 2px"><span class="num">Laras</span><button class="btn sm" data-act="peE0">Asal</button></div>
      ${sl('b','Cerah',-40,40)}${sl('c','Kontras',-40,40)}${sl('s','Warna',-60,60)}${sl('w','Hangat / sejuk',-40,40)}
      <span class="num" style="display:block;margin:12px 0 2px">Preset warna</span>
      <div class="thrail">${Object.entries(TH_PRE).map(([k,p])=>`<button class="thpre ${im.pre===k?'on':''}" data-act="thPre" data-x="${k}"><img src="${im.url}" style="filter:${thFilter(p)}" alt=""><span>${p.l}</span></button>`).join('')}</div>
    </details>
    <div class="pe-act"><button class="btn" data-act="peDl" data-x="">${peDlLab('edit')}</button><button class="btn solid tab" data-act="peStep" data-x="3">Seterusnya</button></div></div>`}
document.addEventListener('toggle',e=>{const n=e.target;if(n&&n.classList&&n.classList.contains('pe-more')&&ui.th)ui.th.more=n.open},true);
A.thSel=el=>{const t=thUi();t.sel=+el.dataset.x;t.lasso=false;render(true)};
A.thDeco=el=>{const im=thUi().imgs[thUi().sel];if(!im)return;im.deco.style=el.dataset.x;thDirty();if(im.deco.style&&!im.mkS)thMask(im);else render(true)};
A.thCol=el=>{const im=thUi().imgs[thUi().sel];if(!im)return;im.deco.col=+el.dataset.x;thDirty();render(true)};
A.thShuf=()=>{const im=thUi().imgs[thUi().sel];if(!im)return;im.deco.seed=(im.deco.seed||1)+1;im.deco.pos={};thDirty();thPaint();peDood()};
A.thPre=el=>{const im=thUi().imgs[thUi().sel];if(!im)return;im.pre=el.dataset.x;im.e=Object.assign({},TH_PRE[el.dataset.x]);thDirty();render(true)};
A.peFont=el=>{const im=thUi().imgs[thUi().sel];if(!im)return;im.deco.font=el.dataset.x;im.deco.pos={};thDirty();render(true)};
const peGrow=el=>{if(!el)return;el.style.height='auto';el.style.height=Math.min(140,el.scrollHeight+2)+'px'};
/* Pilih benda sendiri: Mac kadang pilih benda lain (cth anak, bukan tilam). Lukis keliling benda dengan jari = topeng baru (im.mkU); Auto = balik ke pilihan Mac. */
A.peLasso=()=>{const t=thUi();t.lasso=!t.lasso;render(true)};
A.peAuto=()=>{const im=thUi().imgs[thUi().sel];if(!im)return;im.mkU=false;im.F={};im.deco.pos={};if(im.mkA){im.mk=im.mkA.mk;im.mkB=im.mkA.mkB;im.mkS='ok';thDirty();render(true)}else{im.mk=null;im.mkB='';im.mkS=undefined;thDirty();thMask(im)}};
function peLassoDone(pts){const t=thUi(),im=t.imgs[t.sel];if(!im)return;
  if(pts.length<8){toast('Lukis satu pusingan keliling benda tu');thPaint();return}
  const c=thCrop(im.el,im.ratio),W=im.el.naturalWidth,H=im.el.naturalHeight,mw=240,mh=Math.max(1,Math.round(240*H/W)),cv=document.createElement('canvas');cv.width=mw;cv.height=mh;
  const x=cv.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,mw,mh);x.fillStyle='#fff';x.beginPath();
  pts.forEach((p,i)=>{const fx=(c.sx+p.x/300*c.sw)*mw/W,fy=(c.sy+p.y/300*c.sw)*mh/H;if(i)x.lineTo(fx,fy);else x.moveTo(fx,fy)});x.closePath();x.fill();
  if(!im.mkU&&im.mkS==='ok'&&im.mk)im.mkA={mk:im.mk,mkB:im.mkB};
  im.mk=cv;im.mkB=cv.toDataURL('image/png').split(',')[1];im.mkS='ok';im.mkU=true;im.F={};im.deco.pos={};t.lasso=false;thDirty();render(true)}
A.peE0=()=>{const im=thUi().imgs[thUi().sel];if(!im)return;im.pre='asli';im.e=Object.assign({},TH_PRE.asli);thDirty();render(true)};
/* Seret tulisan dengan jari: bila mula seret, semua kedudukan dikunci supaya yang lain tak melompat. */
function thPt(e,cv){const r=cv.getBoundingClientRect(),p=e.touches?e.touches[0]:e,k=300/r.width;return {x:(p.clientX-r.left)*k,y:(p.clientY-r.top)*k}}
function thDragStart(e){const cv=e.target;if(!cv||cv.id!=='thCv'||!ui.th)return;const im=ui.th.imgs[ui.th.sel];if(!im)return;const p=thPt(e,cv);let i=-1;
  if(ui.th.lasso){e.preventDefault();ui.thLas={cv,pts:[p]};return}
  if(!im._bx)return;
  im._bx.forEach((b,k)=>{if(p.x>b.x-8&&p.x<b.x+b.w+8&&p.y>b.y-8&&p.y<b.y+b.h+8)i=k});if(i<0)return;e.preventDefault();
  const pos=im.deco.pos=im.deco.pos||{};im._bx.forEach((b,k)=>{if(!pos[k])pos[k]={x:b.x+b.w/2,y:b.y+b.h/2}});
  const b=im._bx[i];ui.thDrag={im,i,dx:p.x-(b.x+b.w/2),dy:p.y-(b.y+b.h/2),cv}}
function thDragMove(e){const L=ui.thLas;if(L){if(e.cancelable)e.preventDefault();const p=thPt(e,L.cv),q=L.pts[L.pts.length-1];if(Math.hypot(p.x-q.x,p.y-q.y)<1.5)return;L.pts.push(p);
    const x=L.cv.getContext('2d'),u=L.cv.width/300;x.lineCap='round';x.lineJoin='round';x.strokeStyle='#fff';x.lineWidth=3*u;x.beginPath();x.moveTo(q.x*u,q.y*u);x.lineTo(p.x*u,p.y*u);x.stroke();return}
  const d=ui.thDrag;if(!d)return;if(e.cancelable)e.preventDefault();const p=thPt(e,d.cv);d.im.deco.pos[d.i]={x:p.x-d.dx,y:p.y-d.dy};if(!d.raf)d.raf=requestAnimationFrame(()=>{d.raf=0;thPaint()})}
function thDragEnd(){if(ui.thLas){const L=ui.thLas;ui.thLas=null;peLassoDone(L.pts);return}if(ui.thDrag){ui.thDrag=null;thDirty()}}
document.addEventListener('touchstart',thDragStart,{passive:false});document.addEventListener('touchmove',thDragMove,{passive:false});document.addEventListener('touchend',thDragEnd);
document.addEventListener('mousedown',thDragStart);document.addEventListener('mousemove',thDragMove);document.addEventListener('mouseup',thDragEnd);
A.thDelImg=()=>{const t=thUi();const im=t.imgs[t.sel];if(im)URL.revokeObjectURL(im.url);t.imgs.splice(t.sel,1);t.sel=Math.max(0,Math.min(t.sel,t.imgs.length-1));if(!t.imgs.length)t.step=1;thDirty();render(true)};
A.thRatio=el=>{const im=thUi().imgs[thUi().sel];im.ratio=el.dataset.x;im.deco.pos={};thDirty();render(true)};
A.thAll=()=>{const t=thUi();const im=t.imgs[t.sel];t.imgs.forEach(x=>{x.pre=im.pre;x.e=Object.assign({},im.e);x.ratio=im.ratio;if(x!==im)x.deco=Object.assign({},im.deco,{pos:{},t:x.deco.t,txt:true})});thDirty();render(true);if(im.deco.style)(async()=>{for(const x of t.imgs)if(!x.mkS)await thMask(x)})();toast('Sama untuk '+t.imgs.length+' gambar')};
/* Download image: satu butang, peratus semasa gambar disediakan. Di phone gambar keluar melalui helaian Simpan (Save Image = terus ke Photos);
   kalau phone tolak sebab terlalu lama selepas ketik, butang jadi "Simpan ke phone" dan ketik kedua terus buka. Di komputer = muat turun biasa. */
const DL_save=f=>{const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000)};
async function peGive(fs){const t=thUi(),d={files:fs};
  if(navigator.maxTouchPoints>1&&navigator.canShare&&navigator.canShare(d)){try{await navigator.share(d);t.dl=null}catch(e){if(e.name==='AbortError')t.dl=null;else toast('Tekan Simpan ke phone')}}
  else{for(const f of fs){DL_save(f);await new Promise(r=>setTimeout(r,350))}t.dl=null;toast(fs.length+' gambar dimuat turun')}}
A.peDl=async el=>{const t=thUi();if(!t.imgs.length)return;const r=el.dataset.x||'',k=r||'edit';
  const set=()=>document.querySelectorAll('[data-act="peDl"]').forEach(b=>{if((b.dataset.x||'')===r)b.innerHTML=peDlLab(k)});
  if(t.dl&&t.dl.p!=null)return;
  if(t.dl&&t.dl.k===k&&t.dl.files){await peGive(t.dl.files);set();return}
  const d=t.dl={k,p:0},n=t.imgs.length;set();
  try{const fs=[];for(let i=0;i<n;i++){const im=t.imgs[i];d.p=Math.round((i+.4)/n*100);set();await new Promise(z=>setTimeout(z,30));
      const b=await thBlob(im,r||undefined);fs.push(new File([b],'photo-'+(im.name||'gambar')+(r?'-'+r.replace(':','x'):'')+'.jpg',{type:'image/jpeg'}));d.p=Math.round((i+1)/n*100);set()}
    if(t.dl!==d)return;d.p=null;d.files=fs;await peGive(fs)}
  catch(e){t.dl=null;toast('Tak dapat sediakan gambar')}set()};
document.addEventListener('input',e=>{const el=e.target;if(!el.dataset||!el.dataset.thsl)return;const t=thUi();const im=t.imgs[t.sel];if(!im)return;
  const k=el.dataset.thsl;im.e[k]=+el.value;im.pre='';thDirty();const p=$('#thPrev');if(p)p.style.filter=thFilter(im.e);if($('#thCv'))thPaint();const v=document.querySelector(`[data-v="${k}"]`);if(v)v.textContent=(im.e[k]>0?'+':'')+im.e[k];
  const cool=document.querySelector('.thcool');if(cool)cool.style.opacity=im.e.w<0?-im.e.w/100:0});

/* ---------- ayat ---------- */
const thParts=txt=>String(txt||'').split(/\n\s*-{3,}\s*\n/).map(s=>s.trim()).filter(Boolean);
/* 3 · Posting: tanda platform, tulis point, satu butang untuk semua. Kunci teks: 0..2 = versi Threads, 'fb' / 'ig' / 'tt'. */
const peK=x=>/^\d+$/.test(String(x))?+x:String(x);
const peTok=()=>{const p=thUi().plats;return 3500+(p.includes('th')?3000:0)+(p.includes('fb')?1500:0)+(p.includes('ig')?1500:0)+(p.includes('tt')?1000:0)};
const peTxt=k=>{const t=thUi(),r=t.res;if(!r)return '';const base=typeof k==='number'?(r.versions[k]||{}).text:r[k];return String(t.edit[k]??base??'').trim()};
function peRows(){const t=thUi(),r=t.res,out=[];if(!r)return out;
  if(t.plats.includes('th'))r.versions.forEach((v,i)=>out.push({k:i,p:'th',l:'Threads · versi '+(i+1)}));
  ['fb','ig','tt'].forEach(p=>{if(t.plats.includes(p)&&r[p])out.push({k:p,p,l:PE_PLAT[p].l+(p==='tt'?' Photos':'')})});return out}
const peGenPct=()=>Math.min(95,Math.round((Date.now()-(thUi().gt0||Date.now()))/450));
function pePosting(){const t=thUi();const st=thStyle();const n=t.plats.length;
  return `<div class="card big glass"><span class="num">3 · Posting</span>
    <div class="btns" style="gap:6px;margin-top:8px">${Object.entries(PE_PLAT).map(([k,p])=>`<button class="btn sm ${t.plats.includes(k)?'solid '+p.b:''}" data-act="pePlat" data-x="${k}" aria-pressed="${t.plats.includes(k)}">${p.l}</button>`).join('')}</div>
    <label class="f" style="margin-top:10px"><span class="inwrap" style="align-items:flex-start"><textarea class="inp" id="thPts" data-thf="points" rows="4" placeholder="Tulis point, sepatah dua pun boleh. Atau tekan mic dan cakap macam biasa.">${esc(t.points)}</textarea>${DICT?`<button type="button" class="btn icon sm ${t.rec?'solid rose':''}" data-act="thMic" aria-label="Cakap">${IC.mic}</button>`:''}</span></label>
    <span class="num" style="display:block;margin:4px 0 6px">Nada</span>
    <div class="btns" style="gap:6px">${TH_TONE.map(a=>`<button class="btn sm ${t.tone===a?'solid tab':''}" data-act="thTone" data-x="${a}" aria-pressed="${t.tone===a}">${a}</button>`).join('')}</div>
    ${t.plats.includes('th')?`<div style="margin-top:10px">${chk(t.thread,'thThread','','Threads bersiri (lebih 500 aksara)')}</div>`:''}
    <label class="f" style="margin-top:10px"><span>Untuk produk</span><select class="inp" data-pesel="prod"><option value="">Bukan produk</option>${peProds().map(n=>`<option${t.prod===n?' selected':''}>${esc(n)}</option>`).join('')}${t.prod&&!peProds().includes(t.prod)?`<option selected>${esc(t.prod)}</option>`:''}</select></label>
    <div class="btns" style="margin-top:14px"><button class="btn ${t.points.trim()&&n?'solid tab':''}" data-act="thGen"${t.busy?' disabled':''}>${t.busy?`<i class="spin"></i>Sedang tulis <b id="peGenP">${peGenPct()}</b>%`:IC.ideas+'Tulis untuk '+n+' platform'}</button>${tok(peTok(),'caption setiap platform + tulisan gambar')}</div>
    ${t.plats.includes('th')?`<div class="btns" style="margin-top:8px"><button class="btn sm" data-act="thMine">${IC.copy}Aku tulis sendiri · Copy & simpan</button>${tok(0)}</div>`:''}</div>`+peRes()+thStyleBox()}
function peBox(k,title){const t=thUi(),r=t.res,num=typeof k==='number',base=num?r.versions[k].text:r[k],txt=t.edit[k]??base,parts=num?thParts(txt):[txt],done=t.postIds[k];
  return `<div class="card glass" style="margin-top:12px"><div class="rowh" style="align-items:center"><span class="num">${title}</span>${done?`<span class="pill" style="--pc:var(--ok)">Dicopy</span>`:''}</div>
    <textarea class="inp" id="thOut${k}" data-thedit="${k}" rows="${Math.max(6,Math.ceil(txt.length/34)+2)}" style="margin-top:8px;font-size:15px;line-height:1.5">${esc(txt)}</textarea>
    <div class="rowh" style="align-items:center;margin-top:8px"><span class="meta" id="thCount${k}">${num?thCountTxt(parts):txt.length+' aksara'}</span>
    <div class="btns" style="gap:6px">${t.edit[k]!=null?`<button class="btn sm" data-act="thReset" data-x="${k}">Asal</button>`:''}<button class="btn sm solid tab" data-act="peCopy" data-x="${k}">${IC.copy}Copy</button></div></div>
    ${parts.length>1?`<div class="btns" style="gap:6px;margin-top:8px">${parts.map((p,i)=>`<button class="btn sm" data-act="thCopyPart" data-x="${k}|${i}">${IC.copy}Post ${i+1}</button>`).join('')}</div>`:''}</div>`}
function peRes(){const t=thUi(),r=t.res;if(!r)return '';const ps=Object.keys(PE_PLAT).filter(p=>p==='th'?r.versions.length:r[p]);if(!ps.length)return '';const cur=ps.includes(t.rp)?t.rp:ps[0];
  return `<div class="seg pe-seg" style="--c:${TAB.threads.c}">${ps.map(p=>`<button type="button" class="${cur===p?'on':''}" data-act="peRp" data-x="${p}">${PE_PLAT[p].l}</button>`).join('')}</div>`+
    (cur==='th'?r.versions.map((v,i)=>peBox(i,'Versi '+(i+1)+' · hari '+(i+1))).join(''):peBox(cur,PE_PLAT[cur].l+(cur==='tt'?' Photos':'')))+
    ((r.tips||[]).length?`<div class="card glass" style="margin-top:12px"><span class="num">Cadangan</span><ul class="thtips">${r.tips.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:'')+
    `<div class="pe-act"><button class="btn" data-act="thGen" data-x="again"${t.busy?' disabled':''}>${t.busy?`<i class="spin"></i><b id="peGenP">${peGenPct()}</b>%`:IC.ideas+'Tulis semula'}</button><button class="btn solid tab" data-act="peStep" data-x="4">Seterusnya: Post</button></div>`}
/* 4 · Post: satu baris setiap posting (Copy), gambar ikut saiz platform. */
function pePost(){const t=thUi(),rows=peRows();
  if(!rows.length)return `<div class="card big glass"><span class="num">4 · Post</span><div class="pe-act"><button class="btn solid tab" data-act="peStep" data-x="3">Tulis caption dulu</button></div></div>`;
  const rs={};t.plats.forEach(p=>{const r=PE_PLAT[p].r;(rs[r]=rs[r]||[]).push(PE_PLAT[p].l)});
  return `<div class="card big glass"><div class="rowh" style="align-items:center"><span class="num">4 · Post</span><span class="meta">${rows.filter(r=>t.postIds[r.k]).length}/${rows.length} dicopy</span></div>
    ${rows.map(r=>`<div class="pe-row"><i class="pe-dot ${t.postIds[r.k]?'ok':''}"></i><span class="pe-l">${r.l}</span><button class="btn sm" data-act="peCopy" data-x="${r.k}">${IC.copy}${t.postIds[r.k]?'Copy lagi':'Copy'}</button></div>`).join('')}
    <div class="pe-act"><button class="btn solid tab" id="peSendB" data-act="peSend"${t.sending?' disabled':''}>${t.sending?'<i class="spin"></i>Hantar 1%':IC.next+'Hantar ke To Publish'}</button></div>
    <p class="meta" style="margin:8px 0 0">App pilih hari yang video tak cukup${rows.filter(r=>r.p==='th').length>1?'. Threads versi 2 dan 3 dapat hari berikutnya':''}.${t.prod?' Produk: '+esc(t.prod)+'.':''}</p></div>`+
    (t.imgs.length?`<div class="card glass" style="margin-top:12px"><div class="rowh" style="align-items:center"><span class="num">Gambar ikut saiz</span>${tok(0)}</div>
    ${Object.entries(rs).map(([r,ls])=>`<div class="pe-row"><b class="thno">${r}</b><span class="pe-l">${ls.join(' · ')}</span><button class="btn sm" data-act="peDl" data-x="${r}">${peDlLab(r)}</button></div>`).join('')}</div>`:'')}
/* Fasa 2 (27 Nov): hantar set posting ke Jadual To Publish (photopost.js). Gambar setiap saiz platform naik ke Drive `PHOTO POSTS/P-0xx`,
   caption setiap baris disimpan dalam Senarai (dan belajar gaya Threads), draf dibuang. */
const peProds=()=>{const out=new Set();try{(parseSheet()||[]).filter(g=>g.tab==='PRODUCTS').forEach(g=>out.add(g.name))}catch(e){}S.items.filter(it=>typeof isJob==='function'&&isJob(it)&&['toshoot','shot','toedit'].includes(it.stage)).forEach(it=>out.add(it.title));return [...out].filter(Boolean).sort((a,b)=>a.localeCompare(b))};
document.addEventListener('change',e=>{const el=e.target;if(el.dataset&&el.dataset.pesel==='prod'&&ui.th){ui.th.prod=el.value;peSaveSoon()}});
function peKeepRow(k,no){const t=thUi(),txt=peTxt(k);if(!txt)return;const num=typeof k==='number',base=num?t.res.versions[k].text:t.res[k],o=t.postIds[k]&&get('threads',t.postIds[k])||{no,pe:1};
  const p=save('threads',Object.assign({},o,{points:t.points.trim(),tone:t.tone,draft:base,final:txt,edited:txt!==String(base).trim()},num?{day:k+1}:{plat:k}),true);t.postIds[k]=p.id}
A.peSend=async()=>{const t=thUi(),rows=peRows();if(!rows.length||t.sending)return;t.sending=true;const set=p=>{const b=$('#peSendB');if(b){b.disabled=true;b.innerHTML=`<i class="spin"></i>Hantar ${p}%`}};set(1);
  try{const imgs={},live=ASSETS&&mode==='live',rs=[...new Set(t.plats.map(p=>PE_PLAT[p].r))],no=thNextNo(),dir='P-'+String(no).padStart(3,'0');
    if(t.imgs.length&&live){await tdFonts();const tot=rs.length*t.imgs.length;let n=0;
      for(const r of rs){imgs[r]=[];for(const im of t.imgs){const b=await new Promise(z=>thCompose(im,1440,r).toBlob(z,'image/jpeg',.88));
        imgs[r].push((await ASSETS.upload(new File([b],dir+'-'+r.replace(':','x')+'-'+(imgs[r].length+1)+'.jpg',{type:'image/jpeg'}),'PHOTO POSTS/'+dir)).id);set(Math.max(1,Math.round(++n/tot*94)))}}}
    const mk=r=>({k:String(r.k),p:r.p,v:typeof r.k==='number'?r.k+1:0,text:peTxt(r.k),ok:false,link:''});
    const units=[{rows:rows.filter(r=>r.p!=='th'||r.k===0).map(mk)}];rows.filter(r=>r.p==='th'&&r.k>0).forEach(r=>units.push({rows:[mk(r)]}));
    rows.forEach(r=>peKeepRow(r.k,no));
    const th=t.imgs[0]&&t.imgs[0].el.naturalWidth?thCompose(t.imgs[0],160).toDataURL('image/jpeg',.6):'';
    save('photos',{id:'ph'+uid(),no,title:String(thDecoText(t.imgs[0])||t.points).split('\n')[0].trim().slice(0,60),prod:t.prod||'',item:t.itemId||'',created:Date.now(),th,imgs,units:units.filter(u=>u.rows.length).map(u=>Object.assign({date:'',time:'',acc:'',fixed:false},u))},true);
    if(t.itemId){const it=get('items',t.itemId);if(it)save('items',Object.assign({},it,{stage:'photo',photoNo:no,stageAt:Object.assign({},it.stageAt,{photo:Date.now()})}),true)} /* 28 Nov: kad Idea gambar (Insight) selesai bila set masuk To Publish */
    if(typeof ppC!=='undefined')ppC=null;t.done=true;clearTimeout(t._sv);
    if(t.did){const id=t.did;t.did=null;peTx('readwrite',s=>s.delete(id)).catch(()=>{});ui.peDr=(ui.peDr||[]).filter(x=>x.id!==id)}
    thAutoStudy();peClear();toast(dir+' masuk To Publish');go('ready')}
  catch(e){t.sending=false;render(true);toast('Tak dapat hantar. Semak internet dan cuba lagi')}};
/* Fasa 3: gambar dari video. Guna gambar yang carousel dah kumpul (Published › ＋ Carousel imbas video, 0 token). */
const peCarList=()=>(S.carousel||[]).map(c=>({c,L:(c.slides||[]).length?c.slides.map(id=>({id:String(id).split('~')[0],hd:true})):(c.cands||[]).map(x=>({id:x.thumb,hd:false}))})).filter(x=>x.L.length);
A.peCar=()=>{const cs=peCarList();ui.peCarSel=[];
  modal(`<h2>Gambar dari video</h2>${cs.length?cs.map(({c,L})=>`<p class="eyebrow" style="margin:12px 0 6px">${esc(c.title||'Carousel')} · ${L.length}${L[0].hd?'':' · saiz kecil'}</p><div class="cargrid">${L.map(x=>`<button type="button" class="carth" data-act="peCarPick" data-id="${esc(x.id)}" aria-pressed="false"><img src="${esc(gyImg(x.id,300))}" alt="" loading="lazy" referrerpolicy="no-referrer"></button>`).join('')}</div>`).join(''):'<p class="meta">Belum ada gambar dari video. Buka Published, pilih produk dan tekan ＋ Carousel supaya Mac mini imbas videonya dulu.</p>'}
    <div class="btns" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-act="closeModal">Tutup</button>${cs.length?`<button class="btn solid tab" id="peCarGo" data-act="peCarGo">Masukkan</button>`:''}</div>`,TAB.threads.c)};
A.peCarPick=el=>{const L=ui.peCarSel||(ui.peCarSel=[]),id=el.dataset.id,i=L.indexOf(id);if(i<0){if(L.length+thUi().imgs.length>=10){toast('Maksimum 10 gambar');return}L.push(id)}else L.splice(i,1);el.classList.toggle('on',i<0);el.setAttribute('aria-pressed',i<0);const b=$('#peCarGo');if(b)b.textContent='Masukkan '+(L.length||'')};
A.peCarGo=async el=>{const L=ui.peCarSel||[];if(!L.length){toast('Ketik gambar dulu');return}el.disabled=true;const fs=[];
  try{for(let i=0;i<L.length;i++){el.innerHTML=`<i class="spin"></i>${Math.round(i/L.length*100)}%`;const r=await fetch('https://lh3.googleusercontent.com/d/'+L[i]+'=w2000',{referrerPolicy:'no-referrer'});if(!r.ok)throw new Error('http');fs.push(new File([await r.blob()],'video-'+(i+1)+'.jpg',{type:'image/jpeg'}))}
    closeModal();thAddImgs(fs)}
  catch(e){el.disabled=false;el.textContent='Masukkan';toast('Tak dapat ambil gambar dari Drive')}};
A.pePlat=el=>{const t=thUi(),k=el.dataset.x,i=t.plats.indexOf(k);if(i<0)t.plats=Object.keys(PE_PLAT).filter(p=>p===k||t.plats.includes(p));else t.plats.splice(i,1);render(true);peSaveSoon()};
A.peRp=el=>{thUi().rp=el.dataset.x;render(true)};
const thCountTxt=parts=>parts.length>1?parts.map((p,i)=>`Post ${i+1}: ${p.length}`).join(' · '):`${(parts[0]||'').length}/${TH_MAX} aksara${(parts[0]||'').length>TH_MAX?' · terlebih, tanda thread bersiri':''}`;
document.addEventListener('input',e=>{const el=e.target;if(!el.dataset)return;const t=ui.th;if(!t)return;
  if(el.dataset.thf){const k=el.dataset.thf,im=t.imgs[t.sel];
    if(k==='dtxt'){if(im)im.deco.t=el.value;t.dtxtMine=true;peGrow(el);thDirty();clearTimeout(t._pt);t._pt=setTimeout(()=>{if($('#thCv'))thPaint()},250);return}
    t[k]=el.value;
    if(k==='q'){const n=$('#thLs');if(n)n.innerHTML=thListRows();return}
    if(k==='points'&&t.dtxt==null){thDirty();clearTimeout(t._pt);t._pt=setTimeout(()=>{if($('#thCv'))thPaint()},250)}
    else peSaveSoon()}
  else if(el.dataset.thedit!=null){const k=peK(el.dataset.thedit);t.edit[k]=el.value;const c=$('#thCount'+k);if(c)c.textContent=typeof k==='number'?thCountTxt(thParts(el.value)):el.value.length+' aksara';peSaveSoon()}});
/* 26 Nov (Mira): tulis sendiri terus, tak perlu Claude. Copy + simpan sebagai contoh suara sebenar (source 'sendiri'), untuk kemaskini voice.md bulanan. */
A.thMine=()=>{const t=thUi();const txt=t.points.trim();if(txt.length<15){toast('Tulis posting kau dulu dalam kotak');return}copyText(thParts(txt).join('\n\n'),'Dicopy. Paste dalam Threads');
  const p=save('threads',{final:txt,source:'sendiri',edited:false,no:thNextNo(),pe:1},true);t.points='';render(true);thKeep(p.id);thAutoStudy()};
A.thTone=el=>{thUi().tone=el.dataset.x;render(true);peSaveSoon()};
A.thThread=()=>{const t=thUi();t.thread=!t.thread;render(true);peSaveSoon()};
A.thReset=el=>{delete thUi().edit[peK(el.dataset.x)];render(true);peSaveSoon()};
A.thMic=async()=>{const t=thUi();if(!DICT)return;if(t.rec){t.rec=false;DICT.stop().catch(()=>{});render(true);return}
  if(!ui.thDict){ui.thDict=true;DICT.onFinal(({text})=>{if(!ui.th||!ui.th.rec)return;ui.th.points=(ui.th.points?ui.th.points.replace(/\s+$/,'')+' ':'')+text;const n=$('#thPts');if(n)n.value=ui.th.points});
    DICT.onState(({state})=>{if(state==='idle'&&ui.th&&ui.th.rec){ui.th.rec=false;render(true)}})}
  try{t.rec=true;render(true);await DICT.start({language:'ms'});toast('Cakaplah. Tekan mic lagi bila siap')}catch(e){t.rec=false;render(true);toast('Benarkan mic dalam Settings')}};
/* Copy guna teks dalam keadaan (t.edit), bukan dari kotak, sebab langkah 4 tiada kotak teks. */
A.peCopy=el=>{const t=thUi(),k=peK(el.dataset.x),txt=peTxt(k);if(!txt)return;
  if(typeof k==='number'){copyText(thParts(txt).join('\n\n'),'Versi '+(k+1)+' dicopy. Paste dalam Threads');thLearn(k)}
  else{copyText(txt,PE_PLAT[k].l+' dicopy');
    const o=t.postIds[k]&&get('threads',t.postIds[k])||{no:thNextNo(),pe:1};const p=save('threads',Object.assign({},o,{points:t.points.trim(),tone:t.tone,draft:t.res[k],final:txt,edited:txt!==String(t.res[k]).trim(),plat:k}),true);t.postIds[k]=p.id;render(true);thKeep(p.id)}
  peDoneChk()};
A.thCopyPart=el=>{const [i,k]=el.dataset.x.split('|').map(Number);const p=thParts(peTxt(i))[k];if(p){copyText(p,'Post '+(k+1)+' dicopy');thLearn(i);peDoneChk()}};
/* Semua baris dah dicopy = draf dibuang dari phone (posting kekal dalam Senarai). */
function peDoneChk(){const t=thUi(),rows=peRows();if(!rows.length||!rows.every(r=>t.postIds[r.k]))return;t.done=true;clearTimeout(t._sv);
  if(t.did){const id=t.did;t.did=null;peTx('readwrite',s=>s.delete(id)).catch(()=>{});ui.peDr=(ui.peDr||[]).filter(x=>x.id!==id);render(true)}}

/* ---------- draf: simpan sendiri dalam phone (IndexedDB), termasuk gambar asal dan topeng subjek ---------- */
const peDb=()=>peDb.p||(peDb.p=new Promise((r,j)=>{const q=indexedDB.open('studio-photo',1);q.onupgradeneeded=()=>q.result.createObjectStore('drafts',{keyPath:'id'});q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)}));
const peTx=async(m,f)=>{const d=await peDb();return new Promise((r,j)=>{const q=f(d.transaction('drafts',m).objectStore('drafts'));q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)})};
const peEmpty=t=>!t.imgs.length&&!t.points.trim()&&!t.res;
function peSaveSoon(){const t=ui.th;if(!t||t.done)return;clearTimeout(t._sv);t._sv=setTimeout(peSave,900)}
async function peSave(){const t=ui.th;if(!t||t.done||peEmpty(t))return;clearTimeout(t._sv);if(!t.did)t.did=uid();
  try{await tdFonts();const im0=t.imgs[0];const d={id:t.did,updated:Date.now(),prod:t.prod||'',itemId:t.itemId||'',points:t.points,tone:t.tone,thread:t.thread,plats:t.plats.slice(),rp:t.rp,dtxt:t.dtxt,dtxtMine:!!t.dtxtMine,res:t.res,edit:Object.assign({},t.edit),postIds:Object.assign({},t.postIds),step:t.step,sel:t.sel,
      th:im0&&im0.el.naturalWidth?thCompose(im0,160).toDataURL('image/jpeg',.6):'',
      imgs:t.imgs.map(x=>({id:x.id,name:x.name,file:x.file,ratio:x.ratio,pre:x.pre,e:Object.assign({},x.e),deco:JSON.parse(JSON.stringify(x.deco)),mkB:x.mkB||'',mkU:!!x.mkU}))};
    await peTx('readwrite',s=>s.put(d));const L=ui.peDr||(ui.peDr=[]);const i=L.findIndex(x=>x.id===d.id);if(i<0)L.unshift(d);else L[i]=d;
    const n=$('#peDrN');if(n)n.textContent=L.length}catch(e){}}
async function peDrLoad(){if(ui.peDr)return;ui.peDr=[];try{const a=await peTx('readonly',s=>s.getAll());ui.peDr=(a||[]).sort((x,y)=>(y.updated||0)-(x.updated||0));if(ui.view==='threads'&&ui.peDr.length)render(true)}catch(e){}}
function peDrList(){const L=ui.peDr||[];
  if(!L.length)return `<div class="card glass"><p class="meta" style="margin:0 0 12px">Tiada draf.</p><button class="btn solid tab" data-act="peNew">${IC.plus}Posting baru</button></div>`;
  return `<div class="list">${L.map(d=>{const n=(d.imgs||[]).length,ti=String(d.dtxt||d.points||'').split('\n')[0].trim()||'Tanpa tajuk';
    return `<div class="col card glass"><div class="rowh" style="align-items:center;gap:10px">${d.th?`<img class="thlth" src="${d.th}" alt="">`:''}<button type="button" class="pe-drb" data-act="peOpen" data-id="${d.id}"><h3>${esc(ti)}</h3><span class="meta">${fmtD(d.updated)} · ${n} gambar · langkah ${d.step||1}: ${PE_STEP[(d.step||1)-1]}${d.id===thUi().did?' · sedang dibuka':''}</span></button><button class="btn icon sm bad" data-act="peDDel" data-id="${d.id}" aria-label="Buang draf">${IC.trash}</button></div></div>`}).join('')}</div>`}
const peClear=()=>{const o=ui.th;if(o){clearTimeout(o._sv);o.imgs.forEach(x=>URL.revokeObjectURL(x.url))}ui.th=null;return thUi()};
A.peNew=async()=>{await peSave();peClear();render(true);window.scrollTo(0,0)};
A.peOpen=async el=>{await peSave();const d=(ui.peDr||[]).find(x=>x.id===el.dataset.id);if(!d)return;const t=peClear();
  Object.assign(t,{did:d.id,prod:d.prod||'',itemId:d.itemId||'',points:d.points||'',tone:d.tone||'Auto',thread:!!d.thread,plats:d.plats||['th','fb'],rp:d.rp||'th',dtxt:d.dtxt==null?null:d.dtxt,dtxtMine:!!d.dtxtMine,res:d.res||null,edit:d.edit||{},postIds:d.postIds||{},step:d.step||1,sel:d.sel||0});
  t.imgs=(d.imgs||[]).filter(x=>x.file).map(x=>{const url=URL.createObjectURL(x.file),im={id:x.id,name:x.name,file:x.file,url,el:new Image(),ratio:x.ratio||'asal',pre:x.pre||'',e:x.e,deco:x.deco,F:{},mkB:x.mkB||'',mkU:!!x.mkU};if(im.deco.txt===false&&im.deco.t==null)im.deco.t='';im.deco.txt=true;
    im.el.onload=()=>render(true);im.el.src=url;
    if(x.mkB){const m=new Image();m.onload=()=>{im.mk=m;im.mkS='ok';render(true)};m.src='data:image/png;base64,'+x.mkB}return im});
  t.sel=Math.min(t.sel,Math.max(0,t.imgs.length-1));render(true);window.scrollTo(0,0)};
A.peDDel=el=>confirmBox('Buang draf ni dari phone? Gambar asal dalam Photos tak terusik.',()=>{const id=el.dataset.id;peTx('readwrite',s=>s.delete(id)).catch(()=>{});ui.peDr=(ui.peDr||[]).filter(x=>x.id!==id);if(ui.th&&ui.th.did===id)peClear();render(true);toast('Draf dibuang')},'Ya, buang');
/* Simpan versi akhir Mira (setiap versi berasingan; copy semula = kemaskini). Setiap 5 posting baru, belajar gaya sendiri. */
function thLearn(i){const t=thUi();if(!t.res)return;const v=t.res.versions[i];if(!v)return;const fin=String(t.edit[i]??v.text).trim();if(!fin)return;
  const o=t.postIds[i]&&get('threads',t.postIds[i])||{no:thNextNo(),pe:1};const edited=fin!==String(v.text).trim();
  const p=save('threads',Object.assign({},o,{points:t.points.trim(),tone:t.tone,draft:v.text,final:fin,edited,day:i+1}),true);t.postIds[i]=p.id;render(true);thKeep(p.id);thAutoStudy()}
/* Nombor rujukan T-001: posting lama dinombor ikut tarikh sekali sahaja (medan nf = bukan posting baru, tak cetus belajar gaya). */
const thNoTxt=p=>p.no?(p.pe?'P-':'T-')+String(p.no).padStart(3,'0'):'';
const thIsNew=(x,last)=>(x.updated||0)>last&&!(x.nf&&Math.abs((x.updated||0)-x.nf)<5000);
function thNoFix(){const miss=S.threads.filter(p=>!p.no&&thFinal(p)).sort((a,b)=>(a.created||0)-(b.created||0));if(!miss.length)return;
  let n=S.threads.reduce((m,p)=>Math.max(m,p.no||0),0);miss.forEach(p=>save('threads',Object.assign(p,{no:++n,nf:Date.now()}),true))}
function thNextNo(){thNoFix();return S.threads.reduce((m,p)=>Math.max(m,p.no||0),0)+1}
/* Gambar siap (dengan tulisan) naik ke Drive sekali untuk satu set gambar, dilekat pada setiap posting yang dicopy dari set tu. */
async function thKeep(id){const t=thUi();if(!t.imgs.length||!ASSETS||mode!=='live')return;
  if(!t.keep){const job=t.keep=(async()=>{await tdFonts();const ids=[];for(const im of t.imgs){const b=await new Promise(r=>thCompose(im,1440).toBlob(r,'image/jpeg',0.86));
      ids.push((await ASSETS.upload(new File([b],'photo-'+(im.name||'gambar')+'.jpg',{type:'image/jpeg'}))).id)}
    return {ids,th:thCompose(t.imgs[0],160).toDataURL('image/jpeg',0.6)}})();job.catch(()=>{if(t.keep===job)t.keep=null})}
  try{const k=await t.keep;const p=get('threads',id);if(p){save('threads',Object.assign({},p,{imgs:k.ids,th:k.th}),true);if(ui.view==='threads')render(true)}}
  catch(e){toast('Gambar tak sempat disimpan ke Drive')}}
function thAutoStudy(){const last=thStyle().learnedAt||0;const ps=thPosts().filter(p=>thFinal(p)&&!p.plat);const fresh=ps.filter(x=>thIsNew(x,last)).length;
  if(ps.length>=3&&(fresh>=5||(!last&&ps.length>=3)))A.thStudy()}

function thPrompt(again){const t=thUi();const st=thStyle();const P=k=>t.plats.includes(k);const ex=thPosts().filter(p=>thFinal(p)&&!p.edited&&!p.plat).slice(0,8);
  const edits=thPosts().filter(p=>p.edited&&p.draft&&!p.plat).slice(0,6);
  const keys=[];if(P('th'))keys.push('"versions":[{"text":".."},{"text":".."},{"text":".."}]');['fb','ig','tt'].forEach(k=>{if(P(k))keys.push('"'+k+'":".."')});keys.push('"tips":[".."]');if(t.imgs.length)keys.push('"gambar":{"tajuk":"..","label":[".."]}');
  return `Kau penulis posting untuk Mira (@miracikcit), content creator Malaysia (lifestyle, produk, vlog, keluarga).
Tulis posting gambar dari point Mira di bawah untuk: ${t.plats.map(k=>PE_PLAT[k].l).join(', ')}. Semua bawa ISI DAN MESEJ YANG SAMA, disesuaikan dengan cara setiap platform. MESTI bunyi macam Mira tulis sendiri, bukan macam AI.
${VOICE_MIRA}${st.summary?'\\nGAYA MIRA (dipelajari):\\n'+st.summary+'\\n':''}${st.notes&&st.notes.length?'Peraturan gaya:\\n- '+st.notes.join('\\n- ')+'\\n':''}${edits.length?'\\nPEMBETULAN MIRA (draf kau vs versi yang dia betulkan; ini paling penting, jangan ulang kesilapan draf):\\n'+edits.map(p=>`DRAF: ${p.draft}\\nMIRA: ${p.final}`).join('\\n\\n')+'\\n':''}${ex.length?'\\nCONTOH POSTING SEBENAR MIRA:\\n'+ex.map((p,i)=>`[${i+1}] ${p.final}`).join('\\n\\n')+'\\n':''}
POINT MIRA:
${t.points.trim()}
${t.imgs.length?`\\nPosting ni ada ${t.imgs.length} gambar.\\n`:''}Nada: ${t.tone==='Auto'?'ikut point':t.tone}
Peraturan am: hook di ayat pertama (berhenti scroll), ikut SUARA MIRA, jangan reka fakta yang tiada dalam point, tiada harga melainkan Mira tulis, tiada soalan penutup pada pembaca.${again?'\\nIni permintaan tulis semula: ayat lain dari sebelum ni. ('+Date.now()+')':''}
${P('th')?'versions: 3 versi posting Threads. Isi sama tapi ayat, hook dan susunan berlainan, sebab setiap satu di-post pada hari berbeza; setiap versi berdiri sendiri, jangan rujuk versi lain. Satu perenggan mengalir, maksimum 1 hashtag atau tiada. '+(t.thread?'Pecahkan setiap versi jadi thread bersiri 2 hingga 5 post. Asingkan setiap post dengan baris "---". Setiap post bawah 500 aksara, post pertama hook paling kuat.':'Setiap versi satu post sahaja, bawah 500 aksara.')+'\n':''}${P('fb')?'fb: SATU versi Facebook: 2 hingga 4 perenggan pendek, boleh sampai 900 aksara, tiada hashtag.\n':''}${P('ig')?'ig: SATU caption Instagram: ayat pertama hook yang nampak sebelum "more", 2 hingga 3 perenggan pendek, sampai 600 aksara, kemudian satu baris kosong dan 5 hingga 8 hashtag yang berkaitan.\n':''}${P('tt')?'tt: SATU caption TikTok Photos: bawah 150 aksara, terus kepada isi, kemudian 4 hingga 6 hashtag.\n':''}tips: 2 cadangan ringkas untuk naikkan engagement (cth. masa post, gambar mana dulu, ayat minta tolong crowd). Jangan cadang soalan penutup pada pembaca.
${t.imgs.length?'gambar: tulisan pendek untuk dilekat atas gambar. "tajuk" 2 hingga 3 perkataan yang tarik perhatian, "label" satu untuk setiap point (2 hingga 4 perkataan, maksimum 5 label). Guna perkataan Mira, jangan reka fakta.\n':''}Balas JSON sahaja: {${keys.join(',')}}`}
A.thGen=async el=>{const t=thUi();if(!t.points.trim()){toast('Tulis point dulu');const n=$('#thPts');if(n)n.focus();return}
  if(!t.plats.length){toast('Tanda sekurang-kurangnya satu platform');return}
  if(!SAMPLE){toast('Generate tak tersedia sekarang');return}
  if(t.rec){t.rec=false;DICT&&DICT.stop().catch(()=>{})}
  t.busy=true;t.gt0=Date.now();render(true);const iv=setInterval(()=>document.querySelectorAll('#peGenP').forEach(n=>{n.textContent=peGenPct()}),500);
  try{const j=await SAMPLE.json(thPrompt(el&&el.dataset.x==='again'));const vs=(j&&Array.isArray(j.versions)?j.versions:[]).filter(x=>x&&x.text).slice(0,3).map(x=>({text:String(x.text).trim()}));
    const o={versions:t.plats.includes('th')?vs:[],tips:(Array.isArray(j&&j.tips)?j.tips:[]).map(String).slice(0,3)};['fb','ig','tt'].forEach(k=>{o[k]=t.plats.includes(k)&&j&&j[k]?String(j[k]).trim():''});
    if(!o.versions.length&&!o.fb&&!o.ig&&!o.tt)throw new Error('kosong');t.res=o;t.edit={};t.postIds={};t.done=false;if(!o.versions.length||!t.plats.includes(t.rp))t.rp=t.plats.find(k=>k==='th'?o.versions.length:o[k])||'th';
    const g=j.gambar;if(g&&g.tajuk&&!t.dtxtMine){t.dtxt=[String(g.tajuk)].concat((Array.isArray(g.label)?g.label:[]).map(String).slice(0,5)).join('\n');t.imgs.forEach(x=>{x.deco.pos={}});thDirty()}
    peSaveSoon();toast('Caption siap')}
  catch(e){if(!(e&&(e.code==='declined'||e.name==='AbortError')))toast(e&&e.code==='timeout'?'Mac mini lambat jawab. Cuba lagi sekejap':'Tak berjaya. Semak Mac mini hidup')}
  finally{clearInterval(iv);t.busy=false;render(true)}};

/* ---------- belajar gaya + cadangan ---------- */
function thStyleBox(){const st=thStyle();const t=thUi();const ps=thPosts().filter(p=>thFinal(p)&&!p.plat);const ed=ps.filter(p=>p.edited).length;
  return `<div class="card glass" style="margin-top:22px"><div class="rowh" style="align-items:center"><span class="num">Gaya kau</span><span class="meta">${ps.length} contoh · ${ed} kau edit</span></div>
    ${st.summary?`<p style="margin:8px 0 0;font-size:14px">${esc(st.summary)}</p>`:`<p class="meta" style="margin:8px 0 0">Belum belajar. Copy beberapa posting dulu, atau tampal posting lama kau.</p>`}
    ${st.notes&&st.notes.length?`<ul class="thtips">${st.notes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
    ${st.tips&&st.tips.length?`<span class="num" style="display:block;margin-top:12px">Cadangan untuk naikkan posting kau</span><ul class="thtips">${st.tips.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
    ${st.learnedAt?`<p class="meta" style="margin:6px 0 0">Kemaskini ${fmtD(st.learnedAt)}</p>`:''}
    <div class="btns" style="gap:6px;margin-top:12px"><button class="btn sm" data-act="thPasteOld">${IC.plus}Tampal posting lama</button><button class="btn sm" data-act="thShotOld"${t.shotBusy?' disabled':''}>${t.shotBusy?'<i class="spin"></i>'+esc(t.shotBusy):'🖼 Upload gambar posting'}</button></div>
    <p class="meta" style="margin:8px 0 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap">${t.learnBusy?ldr('Sedang belajar gaya kau'):`Belajar sendiri setiap 5 posting baru (${ps.filter(x=>thIsNew(x,st.learnedAt||0)).length}/5)`}${tok(TOK.thstyle,'belajar gaya, auto')}</p></div>`}
A.thPasteOld=()=>modal(`<h2>Tampal posting lama</h2><p class="meta">Tampal posting Threads kau yang perform. Asingkan setiap posting dengan baris kosong berganda atau ---.</p>
  <textarea class="inp" id="thOld" rows="10" style="margin:10px 0"></textarea><div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="thOldOk">Simpan</button></div>`,TAB.threads.c);
A.thOldOk=()=>{const v=(($('#thOld')||{}).value||'');const ps=v.split(/\n\s*-{3,}\s*\n|\n\s*\n\s*\n/).map(s=>s.trim()).filter(s=>s.length>=15);
  if(!ps.length){toast('Tiada posting');return}ps.forEach(p=>save('threads',{final:p,source:'lama',edited:false},true));closeModal();render(true);toast(ps.length+' posting disimpan sebagai contoh');thAutoStudy()};
A.thStudy=async()=>{const t=thUi();if(t.learnBusy)return;const ps=thPosts().filter(p=>thFinal(p)&&!p.plat).slice(0,20);if(ps.length<3||!window.studioJob)return;const st=thStyle();
  const prompt=`Analisis cara Mira (@miracikcit, content creator Malaysia) menulis posting Threads dari contoh sebenar di bawah.
${st.summary?'Ringkasan gaya sebelum ni (kemaskini, jangan buang yang masih betul):\n'+st.summary+'\n':''}
CONTOH (terbaru dulu):
${ps.map((p,i)=>`[${i+1}]${p.edited&&p.draft?' (draf AI: '+p.draft+')\n VERSI MIRA:':''} ${p.final}`).join('\n\n')}

Balas JSON sahaja:
{"summary":"2-3 ayat gaya Mira (bahasa, panjang, nada, emoji, cara buka dan tutup)",
"notes":["5-8 peraturan gaya spesifik yang boleh diikut penulis lain, termasuk perkataan/frasa kegemaran dan apa yang Mira selalu betulkan/buang dari draf AI (DRAF vs VERSI MIRA)"],
"tips":["3-5 cadangan konkrit untuk Mira naikkan engagement Threads, berdasarkan kelemahan dalam contoh"]}`;
  t.learnBusy=true;render(true);
  try{const o=await window.studioJob('ai',{prompt},6*60000);const j=o&&o.json;if(!j||!j.summary)throw new Error('kosong');
    saveSettings({thStyle:{summary:String(j.summary),notes:(j.notes||[]).map(String).slice(0,8),tips:(j.tips||[]).map(String).slice(0,5),learnedAt:Date.now(),n:ps.length}});toast('Gaya kau dikemaskini')}
  catch(e){}
  finally{t.learnBusy=false;render(true)}};

/* ---------- senarai (27 Nov, Mira): semua posting yang dah dicopy, bernombor, boleh dicari ---------- */
function thListRows(){const t=thUi(),q=t.q.trim().toLowerCase(),qn=q.replace(/^[tp]-?0*/,'');let ps=thPosts().filter(thFinal);
  if(t.lf==='th')ps=ps.filter(p=>!p.plat);else if(PE_PLAT[t.lf])ps=ps.filter(p=>p.plat===t.lf);else if(t.lf==='img')ps=ps.filter(p=>(p.imgs||[]).length);
  if(q)ps=ps.filter(p=>(/^\d+$/.test(qn)&&String(p.no||'')===qn)||(p.final+' '+(p.points||'')).toLowerCase().includes(q));
  if(!ps.length)return `<p class="meta" style="margin:14px 0">Tiada posting sepadan.</p>`;
  return ps.slice(0,80).map(p=>{const im=p.imgs||[];
    return `<details class="col card glass"><summary><div class="rowh" style="align-items:center;gap:10px"><b class="thno">${thNoTxt(p)||'·'}</b>${p.th?`<img class="thlth" src="${p.th}" alt="">`:''}<div style="min-width:0;flex:1"><h3 style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.final.split('\n')[0])}</h3><div class="meta">${fmtD(p.created)} · ${(PE_PLAT[p.plat]||PE_PLAT.th).l}${p.source==='sendiri'?' · tulis sendiri':p.source==='lama'?' · posting lama':p.source==='gambar'?' · dari gambar':p.edited?' · kau edit':''}${im.length?' · '+im.length+' gambar':''}</div></div><span class="ic chev">${IC.chev}</span></div></summary>
    <div style="white-space:pre-wrap;font-size:14px;margin-top:10px">${esc(p.final)}</div>
    <div class="btns" style="gap:6px;margin-top:10px"><button class="btn sm solid tab" data-act="thHCopy" data-id="${p.id}">${IC.copy}Copy</button>${im.map((id,i)=>`<a class="btn sm" href="${esc(window.studioFileUrl?'https://drive.google.com/uc?export=download&id='+String(id).split('~')[0]:'#')}" target="_blank" rel="noopener">${IC.dl}Gambar ${i+1}</a>`).join('')}<button class="btn sm" data-act="thReuse" data-id="${p.id}">Guna semula</button>${im.length?`<button class="btn sm" data-act="thHImgDel" data-id="${p.id}">Buang gambar</button>`:''}<button class="btn icon sm bad" data-act="thHDel" data-id="${p.id}" aria-label="Padam">${IC.trash}</button></div></details>`}).join('')}
function thList(){const t=thUi();const n=thPosts().filter(thFinal).length;
  return `<div class="card glass"><input class="inp" id="thQ" data-thf="q" type="search" placeholder="Cari perkataan atau nombor (cth 12)" value="${esc(t.q)}">
    <div class="btns" style="gap:6px;margin-top:10px">${[['all','Semua'],['th','Threads'],['fb','Facebook'],['ig','Instagram'],['tt','TikTok'],['img','Ada gambar']].map(([k,l])=>`<button class="btn sm ${t.lf===k?'solid tab':''}" data-act="thLf" data-x="${k}">${l}</button>`).join('')}</div></div>
    <p class="eyebrow" style="margin-top:16px">${n} posting · gambar dalam Google Drive</p><div class="list" id="thLs">${thListRows()}</div>`}
A.thSeg=el=>{const t=thUi();t.seg=el.dataset.x;if(t.seg==='list'&&mode==='live')thNoFix();render(true)};
A.thLf=el=>{thUi().lf=el.dataset.x;render(true)};
A.thReuse=el=>{const p=get('threads',el.dataset.id);if(!p)return;const t=thUi();t.points=p.points||p.final;t.seg='buat';t.step=3;render(true);window.scrollTo(0,0);toast('Point dimasukkan semula')};
A.thHCopy=el=>{const p=get('threads',el.dataset.id);if(p)copyText(thParts(p.final).join('\n\n'),'Dicopy')};
const thImgGone=ids=>ids.filter(i=>!S.threads.some(o=>(o.imgs||[]).includes(i))).forEach(i=>{if(ASSETS)ASSETS.delete(i).catch(()=>{})});
A.thHImgDel=el=>confirmBox('Buang gambar posting ni dari Google Drive? Caption kekal.',()=>{const p=get('threads',el.dataset.id);if(!p)return;const ids=p.imgs||[];const o=Object.assign({},p);delete o.imgs;delete o.th;save('threads',o,true);thImgGone(ids);render(true);toast('Gambar dibuang')},'Ya, buang');
A.thHDel=el=>confirmBox('Padam posting ni dan gambarnya dalam Drive? Aku tak akan belajar dari dia lagi.',()=>{const p=get('threads',el.dataset.id);const ids=(p&&p.imgs)||[];del('threads',el.dataset.id);thImgGone(ids);toast('Dipadam')},'Ya, padam');

V.threads=()=>{const t=thUi();peDrLoad();const n=thPosts().filter(thFinal).length,dn=(ui.peDr||[]).length,sg=t.seg==='list'||t.seg==='draf'?t.seg:'buat';
  const b=(k,l)=>`<button type="button" class="${sg===k?'on':''}" data-act="thSeg" data-x="${k}">${l}</button>`;
  /* Sedang buat posting = tajuk besar disorok supaya skrin Edit muat satu skrin phone. */
  const work=sg==='buat'&&!peEmpty(t);
  return (work?'':head('Posting gambar, semua platform'))+
    `<div class="pe-top"><div class="seg" style="--c:${TAB.threads.c}">${b('buat','Buat')}${b('draf','Draf · <span id="peDrN">'+dn+'</span>')}${b('list','Senarai · '+n)}</div>${work?`<button class="btn sm" data-act="peNew">${IC.plus}Baru</button>`:''}</div>`+
    (sg==='list'?thList():sg==='draf'?peDrList():`<div class="pe" style="--c:${TAB.threads.c}">`+peSteps()+[peGambar,peEdit,pePosting,pePost][Math.max(0,Math.min(3,(t.step||1)-1))]()+`</div>`)};

/* 24 Nov (Mira): ingat gaya dari gambar. Screenshot posting lama > Mac mini baca teks (Apple Vision, 0 token) > disimpan sebagai contoh gaya. */
A.thShotOld=()=>pickFile('image/*',async fs=>{const t=thUi();if(!ASSETS||!window.studioJob){toast('Perlu sambungan Studio');return}let n=0;
  try{for(let i=0;i<fs.length&&i<10;i++){t.shotBusy='Baca '+(i+1)+'/'+Math.min(fs.length,10);render(true);
      const up=await ASSETS.upload(fs[i]);const o=await window.studioJob('ocr',{file:up.id},2*60000);
      const txt=(o.lines||[]).map(String).filter(l=>!/^\d+[smhj]$|^(like|reply|repost|share|suka|balas)$/i.test(l.trim())).join('\n').trim();
      if(txt.length>=15){save('threads',{final:txt,source:'gambar',edited:false},true);n++}}
    toast(n?n+' posting dari gambar disimpan sebagai contoh gaya':'Tiada teks dijumpai dalam gambar');if(n)thAutoStudy()}
  catch(e){toast('Tak dapat baca gambar. Semak Mac mini hidup')}finally{t.shotBusy=null;render(true)}},true);
