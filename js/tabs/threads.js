/* ---------- THREADS: gambar cantik + ayat ikut gaya Mira ----------
   1. Upload gambar (sampai 10) > edit dalam phone (preset, cerah, warna, potong 4:5 / 1:1). Tiada token, gambar tak naik ke Drive.
   1b. Tulisan + outline + doodle atas gambar (thdeco.js, 0 token; outline perlukan job subjek Mac mini). Gambar siap naik ke Drive bila posting dicopy.
   2. Tulis point atau sebut (mic) > Claude di Mac mini tulis 3 versi ikut gaya Mira. Setiap versi kotak boleh edit, copy terus.
   3. Belajar: bila Mira copy, versi yang dia edit disimpan sebagai contoh sebenar (koleksi threads). Contoh terbaru masuk dalam prompt,
      dan butang "Belajar gaya" minta Claude ringkaskan gaya + cadangan untuk naikkan posting (settings.thStyle). */
const TH_MAX=500,TH_TONE=['Auto','Santai','Cerita','Tips','Soalan','Jual lembut'];
const TH_PRE={asli:{l:'Asli',b:0,c:0,s:0,w:0},cantik:{l:'Auto cantik',b:8,c:10,s:14,w:4},cerah:{l:'Cerah',b:16,c:4,s:6,w:2},hangat:{l:'Hangat',b:6,c:6,s:10,w:16},
  pastel:{l:'Pastel',b:14,c:-12,s:-10,w:6},pop:{l:'Pop',b:4,c:18,s:28,w:0},filem:{l:'Filem',b:2,c:-6,s:-18,w:10},sejuk:{l:'Sejuk',b:6,c:6,s:4,w:-14}};
const TH_RATIO={asal:'Asal','4:5':'4:5','1:1':'1:1','3:4':'3:4'};
const thUi=()=>ui.th||(ui.th={imgs:[],sel:0,points:'',tone:'Auto',thread:false,res:null,edit:{},postIds:{},busy:false,learnBusy:false,seg:'buat',dtxt:null,q:'',lf:'all',keep:null});
const thStyle=()=>(S.settings&&S.settings.thStyle)||{};
const thPosts=()=>S.threads.slice().sort((a,b)=>(b.created||0)-(a.created||0));
const thFinal=p=>String(p.final||'').trim();

/* ---------- gambar: edit dengan canvas ---------- */
function thFilter(e){const b=100+e.b,c=100+e.c,s=100+e.s;return `brightness(${b}%) contrast(${c}%) saturate(${s}%)`+(e.w>0?` sepia(${e.w*0.9}%)`:'')+(e.w<0?` hue-rotate(${e.w*0.8}deg)`:'')}
function thCrop(img,ratio){const W=img.naturalWidth,H=img.naturalHeight;if(ratio==='asal')return {sx:0,sy:0,sw:W,sh:H};
  const [a,b]=ratio.split(':').map(Number);const r=a/b;let sw=W,sh=W/r;if(sh>H){sh=H;sw=H*r}return {sx:(W-sw)/2,sy:(H-sh)/2,sw,sh}}
function thRender(im,max){const c=thCrop(im.el,im.ratio);const k=Math.min(1,(max||2160)/Math.max(c.sw,c.sh));const cv=document.createElement('canvas');
  cv.width=Math.round(c.sw*k);cv.height=Math.round(c.sh*k);const x=cv.getContext('2d');x.filter=thFilter(im.e);x.drawImage(im.el,c.sx,c.sy,c.sw,c.sh,0,0,cv.width,cv.height);
  if(im.e.w<0){x.filter='none';x.globalCompositeOperation='soft-light';x.fillStyle=`rgba(90,140,220,${-im.e.w/100})`;x.fillRect(0,0,cv.width,cv.height)}
  return cv}
/* 27 Nov (Mira): tulisan + outline + doodle atas gambar, enjin dalam thdeco.js (0 token). */
const thDecoText=()=>{const t=thUi();return t.dtxt!=null?t.dtxt:t.points};
const thDirty=()=>{if(ui.th)ui.th.keep=null};
function thCompose(im,max,style){const cv=thRender(im,max);const d=style?Object.assign({},im.deco,{style}):im.deco;
  if(d&&d.style){const F=im.F[im.ratio];tdDraw(cv,d,F&&F.D?F:null,thDecoText())}return cv}
const thBlob=async(im,style)=>{await tdFonts();return new Promise(r=>thCompose(im,2160,style).toBlob(r,'image/jpeg',0.92))};
async function thPaint(){await tdFonts();const cv=$('#thCv'),t=thUi(),im=t.imgs[t.sel];if(!cv||!im||!im.deco.style||!im.el.naturalWidth)return;
  const c=thRender(im,900),F=im.F[im.ratio];im._bx=tdDraw(c,im.deco,F&&F.D?F:null,thDecoText());
  if(cv.width!==c.width||cv.height!==c.height){cv.width=c.width;cv.height=c.height}cv.getContext('2d').drawImage(c,0,0)}
function thMaskSet(im,key,m){const c=thCrop(im.el,key);im.F[key]=tdField(m,Math.round(300*c.sh/c.sw))}
/* Topeng subjek dari Mac mini (job subjek, Apple Vision, 0 token). Gambar kecil 640 px dihantar, dibuang dari Drive sebaik siap. */
async function thMask(im){const key=im.ratio;if(im.F[key])return;if(!ASSETS||!window.studioJob||mode!=='live'){im.F[key]='none';return}
  im.F[key]='busy';const t0=Date.now();render(true);let up=null;
  const iv=setInterval(()=>{const n=$('#thMkP');if(n)n.textContent=Math.min(95,Math.round((Date.now()-t0)/160))},400);
  try{const b=await new Promise(r=>thRender(im,640).toBlob(r,'image/jpeg',0.8));up=await ASSETS.upload(new File([b],'subjek.jpg',{type:'image/jpeg'}));
    const o=await window.studioJob('subjek',{file:up.id},90000);
    if(o&&o.b64){const m=new Image();await new Promise((r,j)=>{m.onload=r;m.onerror=j;m.src='data:image/png;base64,'+o.b64});thMaskSet(im,key,m)}else im.F[key]='none'}
  catch(e){im.F[key]='none';toast('Tak dapat cari bentuk subjek. Tulisan dan doodle masih jalan')}
  finally{clearInterval(iv);if(up)ASSETS.delete(up.id).catch(()=>{});render(true)}}
function thAddImgs(files){const t=thUi();files.filter(f=>/^image\//.test(f.type)).slice(0,10-t.imgs.length).forEach(f=>{const url=URL.createObjectURL(f);const el=new Image();
  const im={id:uid(),name:f.name.replace(/\.[^.]+$/,''),url,el,ratio:'asal',pre:'cantik',e:Object.assign({},TH_PRE.cantik),deco:{style:'',col:null,seed:1,pos:{},txt:!t.imgs.length},F:{}};el.onload=()=>render(true);el.src=url;t.imgs.push(im)});
  t.sel=Math.max(0,t.imgs.length-1);thDirty();render(true)}
function thImgBox(){const t=thUi();const im=t.imgs[t.sel];
  const thumbs=t.imgs.map((x,i)=>`<button class="thth ${i===t.sel?'on':''}" data-act="thSel" data-x="${i}" aria-label="Gambar ${i+1}"><img src="${x.url}" style="filter:${thFilter(x.e)}" alt=""></button>`).join('')+
    (t.imgs.length<10?`<button class="thth add" data-act="thPick" aria-label="Tambah gambar">${IC.plus}</button>`:'');
  if(!im)return `<div class="card big glass"><span class="num">1 · Gambar</span><p class="meta" style="margin:6px 0 12px">Pilih sampai 10 gambar. Edit dalam phone sahaja, tak guna token.</p>
    <button class="btn solid tab" data-act="thPick">${IC.up}Upload gambar</button></div>`;
  const dk=im.deco,dF=im.F[im.ratio],dc=dk.style?(dk.col!=null?dk.col:TD_STY[dk.style].c):0;if(dk.style)requestAnimationFrame(thPaint);
  const sl=(k,lab,min,max)=>`<label class="thsl"><span>${lab}<b data-v="${k}">${im.e[k]>0?'+':''}${im.e[k]}</b></span><input type="range" min="${min}" max="${max}" step="1" value="${im.e[k]}" data-thsl="${k}"></label>`;
  return `<div class="card big glass"><div class="rowh" style="align-items:center"><span class="num">1 · Gambar ${t.sel+1}/${t.imgs.length}</span><button class="btn icon sm bad" data-act="thDelImg" aria-label="Buang gambar">${IC.trash}</button></div>
    <div class="thstage" style="${im.ratio!=='asal'?'aspect-ratio:'+im.ratio.replace(':','/'):''}">${dk.style?`<canvas id="thCv" class="thcv"></canvas>`:`<img id="thPrev" src="${im.url}" style="filter:${thFilter(im.e)};${im.ratio!=='asal'?'object-fit:cover;width:100%;height:100%':''}" alt="">${im.e.w<0?`<i class="thcool" style="opacity:${-im.e.w/100}"></i>`:''}`}</div>
    <div class="thrail">${thumbs}</div>
    <span class="num" style="display:block;margin:12px 0 6px">Gaya</span>
    <div class="thrail">${Object.entries(TH_PRE).map(([k,p])=>`<button class="thpre ${im.pre===k?'on':''}" data-act="thPre" data-x="${k}"><img src="${im.url}" style="filter:${thFilter(p)}" alt=""><span>${p.l}</span></button>`).join('')}</div>
    <details style="margin-top:10px"><summary class="meta" style="cursor:pointer">Laras sendiri</summary><div style="margin-top:8px">${sl('b','Cerah',-40,40)}${sl('c','Kontras',-40,40)}${sl('s','Warna',-60,60)}${sl('w','Hangat / sejuk',-40,40)}</div></details>
    <span class="num" style="display:block;margin:12px 0 6px">Potong</span>
    <div class="btns" style="gap:6px">${Object.entries(TH_RATIO).map(([k,l])=>`<button class="btn sm ${im.ratio===k?'solid tab':''}" data-act="thRatio" data-x="${k}">${l}</button>`).join('')}</div>
    <span class="num" style="display:block;margin:14px 0 6px">Tulisan & doodle ${tok(0)}</span>
    <div class="btns" style="gap:6px"><button class="btn sm ${!dk.style?'solid tab':''}" data-act="thDeco" data-x="">Tiada</button>${Object.entries(TD_STY).map(([k,s])=>`<button class="btn sm ${dk.style===k?'solid tab':''}" data-act="thDeco" data-x="${k}">${s.l}</button>`).join('')}</div>
    ${dk.style?`<div class="thcolrow">${TD_COL.map((c,i)=>`<button class="thcol ${dc===i?'on':''}" style="--k:${c[1]}" data-act="thCol" data-x="${i}" aria-label="Warna ${c[0]}"></button>`).join('')}<button class="btn sm" data-act="thShuf">Susun lain</button>${dF==='busy'?`<span class="pill" style="--pc:var(--c)"><i class="spin"></i>Cari bentuk <b id="thMkP">0</b>%</span>`:''}</div>
    <textarea class="inp" id="thDtx" data-thf="dtxt" rows="4" placeholder="Baris pertama = tajuk. Setiap baris lain = satu tulisan." style="margin-top:8px">${esc(thDecoText())}</textarea>
    ${t.imgs.length>1?`<div style="margin-top:8px">${chk(dk.txt!==false,'thDTxt','','Tulisan pada gambar ni')}</div>`:''}`:''}
    <div class="btns" style="margin-top:14px;gap:6px">${t.imgs.length>1?`<button class="btn sm" data-act="thAll">Guna untuk semua gambar</button>`:''}<button class="btn sm solid tab" data-act="thSave">${IC.dl}Simpan ${t.imgs.length>1?'semua':''}</button>${dk.style?`<button class="btn sm" data-act="thSave4">${IC.dl}Simpan 4 gaya</button>`:''}${navigator.share?`<button class="btn sm" data-act="thShare">${IC.ext}Share ke Threads</button>`:''}</div></div>`}
A.thPick=()=>pickFile('image/*',fs=>thAddImgs(fs),true);
A.thSel=el=>{thUi().sel=+el.dataset.x;render(true)};
A.thDeco=el=>{const im=thUi().imgs[thUi().sel];if(!im)return;im.deco.style=el.dataset.x;thDirty();if(im.deco.style&&!im.F[im.ratio])thMask(im);else render(true)};
A.thCol=el=>{const im=thUi().imgs[thUi().sel];if(!im)return;im.deco.col=+el.dataset.x;thDirty();render(true)};
A.thShuf=()=>{const im=thUi().imgs[thUi().sel];if(!im)return;im.deco.seed=(im.deco.seed||1)+1;im.deco.pos={};thDirty();thPaint()};
A.thDTxt=()=>{const im=thUi().imgs[thUi().sel];if(!im)return;im.deco.txt=im.deco.txt===false;thDirty();render(true)};
A.thSave4=async()=>{const im=thUi().imgs[thUi().sel];if(!im)return;let n=0;for(const k of Object.keys(TD_STY)){const b=await thBlob(im,k);await DL_save(new File([b],'threads-'+(im.name||'gambar')+'-'+k+'.jpg',{type:'image/jpeg'}));await new Promise(r=>setTimeout(r,350));n++}toast(n+' gaya disimpan')};
/* Seret tulisan dengan jari: bila mula seret, semua kedudukan dikunci supaya yang lain tak melompat. */
function thPt(e,cv){const r=cv.getBoundingClientRect(),p=e.touches?e.touches[0]:e,k=300/r.width;return {x:(p.clientX-r.left)*k,y:(p.clientY-r.top)*k}}
function thDragStart(e){const cv=e.target;if(!cv||cv.id!=='thCv'||!ui.th)return;const im=ui.th.imgs[ui.th.sel];if(!im||!im._bx)return;const p=thPt(e,cv);let i=-1;
  im._bx.forEach((b,k)=>{if(p.x>b.x-8&&p.x<b.x+b.w+8&&p.y>b.y-8&&p.y<b.y+b.h+8)i=k});if(i<0)return;e.preventDefault();
  const pos=im.deco.pos=im.deco.pos||{};im._bx.forEach((b,k)=>{if(!pos[k])pos[k]={x:b.x+b.w/2,y:b.y+b.h/2}});
  const b=im._bx[i];ui.thDrag={im,i,dx:p.x-(b.x+b.w/2),dy:p.y-(b.y+b.h/2),cv}}
function thDragMove(e){const d=ui.thDrag;if(!d)return;if(e.cancelable)e.preventDefault();const p=thPt(e,d.cv);d.im.deco.pos[d.i]={x:p.x-d.dx,y:p.y-d.dy};if(!d.raf)d.raf=requestAnimationFrame(()=>{d.raf=0;thPaint()})}
function thDragEnd(){if(ui.thDrag){ui.thDrag=null;thDirty()}}
document.addEventListener('touchstart',thDragStart,{passive:false});document.addEventListener('touchmove',thDragMove,{passive:false});document.addEventListener('touchend',thDragEnd);
document.addEventListener('mousedown',thDragStart);document.addEventListener('mousemove',thDragMove);document.addEventListener('mouseup',thDragEnd);
A.thDelImg=()=>{thDirty();const t=thUi();const im=t.imgs[t.sel];if(im)URL.revokeObjectURL(im.url);t.imgs.splice(t.sel,1);t.sel=Math.max(0,Math.min(t.sel,t.imgs.length-1));render(true)};
A.thPre=el=>{thDirty();const im=thUi().imgs[thUi().sel];im.pre=el.dataset.x;im.e=Object.assign({},TH_PRE[el.dataset.x]);render(true)};
A.thRatio=el=>{const im=thUi().imgs[thUi().sel];im.ratio=el.dataset.x;im.deco.pos={};thDirty();if(im.deco.style&&!im.F[im.ratio])thMask(im);else render(true)};
A.thAll=()=>{const t=thUi();const im=t.imgs[t.sel];t.imgs.forEach(x=>{x.pre=im.pre;x.e=Object.assign({},im.e);x.ratio=im.ratio;if(x!==im)x.deco=Object.assign({},im.deco,{pos:{},txt:x.deco.txt})});thDirty();render(true);if(im.deco.style)(async()=>{for(const x of t.imgs)if(!x.F[x.ratio])await thMask(x)})();toast('Gaya sama untuk '+t.imgs.length+' gambar')};
async function thFiles(){const t=thUi();const out=[];for(const im of t.imgs){const b=await thBlob(im);out.push(new File([b],'threads-'+(im.name||'gambar')+'.jpg',{type:'image/jpeg'}))}return out}
A.thSave=async()=>{const fs=await thFiles();for(const f of fs){await DL_save(f);await new Promise(r=>setTimeout(r,350))}toast(fs.length+' gambar disimpan')};
const DL_save=f=>{const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000)};
A.thShare=async()=>{const fs=await thFiles();const i=thCurIdx();const txt=thCurText();const d={files:fs};if(txt)d.text=txt;
  if(txt)copyText(txt,'Ayat dicopy. Paste dalam Threads kalau tak masuk sendiri');
  try{if(navigator.canShare&&!navigator.canShare(d))delete d.text;await navigator.share(d);if(txt)thLearn(i)}catch(e){if(e.name!=='AbortError')toast('Tak dapat share. Guna Simpan')}};
document.addEventListener('input',e=>{const el=e.target;if(!el.dataset||!el.dataset.thsl)return;const t=thUi();const im=t.imgs[t.sel];if(!im)return;
  const k=el.dataset.thsl;im.e[k]=+el.value;im.pre='';thDirty();const p=$('#thPrev');if(p)p.style.filter=thFilter(im.e);if($('#thCv'))thPaint();const v=document.querySelector(`[data-v="${k}"]`);if(v)v.textContent=(im.e[k]>0?'+':'')+im.e[k];
  const cool=document.querySelector('.thcool');if(cool)cool.style.opacity=im.e.w<0?-im.e.w/100:0});

/* ---------- ayat ---------- */
const thParts=txt=>String(txt||'').split(/\n\s*-{3,}\s*\n/).map(s=>s.trim()).filter(Boolean);
/* Share: versi pertama yang belum dicopy */
function thCurIdx(){const t=thUi();if(!t.res)return -1;const i=t.res.versions.findIndex((v,k)=>!t.postIds[k]);return i<0?0:i}
function thCurText(){const t=thUi();const i=thCurIdx();const v=t.res&&t.res.versions[i];return v?thParts(t.edit[i]??v.text).join('\n\n'):''}
function thTextBox(){const t=thUi();const st=thStyle();
  return `<div class="card big glass" style="margin-top:12px"><span class="num">2 · Apa kau nak cakap</span>
    <label class="f" style="margin-top:8px"><span class="inwrap" style="align-items:flex-start"><textarea class="inp" id="thPts" data-thf="points" rows="5" placeholder="Tulis point, sepatah dua pun boleh. Atau tekan mic dan cakap macam biasa.">${esc(t.points)}</textarea>${DICT?`<button type="button" class="btn icon sm ${t.rec?'solid rose':''}" data-act="thMic" aria-label="Cakap">${IC.mic}</button>`:''}</span></label>
    <span class="num" style="display:block;margin:4px 0 6px">Nada</span>
    <div class="btns" style="gap:6px">${TH_TONE.map(a=>`<button class="btn sm ${t.tone===a?'solid tab':''}" data-act="thTone" data-x="${a}" aria-pressed="${t.tone===a}">${a}</button>`).join('')}</div>
    <div style="margin-top:10px">${chk(t.thread,'thThread','','Pecah jadi thread bersiri (lebih 500 aksara)')}</div>
    <div class="btns" style="margin-top:14px"><button class="btn ${t.points.trim()?'solid tab':''}" data-act="thGen"${t.busy?' disabled':''}>${t.busy?'Sedang tulis...':IC.ideas+'Tulis 3 versi + FB'}</button>${tok(TOK.threads,'3 versi Threads + 1 Facebook + tulisan gambar')}</div>
    <div class="btns" style="margin-top:8px"><button class="btn sm" data-act="thMine">${IC.copy}Aku tulis sendiri · Copy & simpan</button><span class="meta">0 token, jadi contoh gaya kau</span></div>
    <p class="meta" style="margin:10px 0 0">${t.busy?ldr('Claude sedang tulis'):`Belajar dari ${thPosts().filter(thFinal).length} posting kau${st.notes&&st.notes.length?' + nota gaya':''}.`}</p></div>`}
function thResBox(){const t=thUi();if(!t.res)return '';
  const box=(v,i)=>{const txt=t.edit[i]??v.text;const parts=thParts(txt);const done=t.postIds[i];
    return `<div class="card glass" style="margin-top:12px"><div class="rowh" style="align-items:center"><span class="num">Versi ${i+1} · hari ${i+1}</span>${done?`<span class="pill" style="--pc:var(--ok)">Dicopy</span>`:''}</div>
      <textarea class="inp" id="thOut${i}" data-thedit="${i}" rows="${Math.max(6,Math.ceil(txt.length/34)+2)}" style="margin-top:8px;font-size:15px;line-height:1.5">${esc(txt)}</textarea>
      <div class="rowh" style="align-items:center;margin-top:8px"><span class="meta" id="thCount${i}">${thCountTxt(parts)}</span>
      <div class="btns" style="gap:6px">${t.edit[i]!=null?`<button class="btn sm" data-act="thReset" data-x="${i}">Asal</button>`:''}<button class="btn sm solid tab" data-act="thCopy" data-x="${i}">${IC.copy}Copy</button></div></div>
      ${parts.length>1?`<div class="btns" style="gap:6px;margin-top:8px">${parts.map((p,k)=>`<button class="btn sm" data-act="thCopyPart" data-x="${i}|${k}">${IC.copy}Post ${k+1}</button>`).join('')}</div>`:''}</div>`};
  const fbT=t.res.fb?(t.edit.fb??t.res.fb):'';
  const fb=t.res.fb?`<div class="card glass" style="margin-top:12px"><div class="rowh" style="align-items:center"><span class="num">Versi Facebook</span>${t.postIds.fb?`<span class="pill" style="--pc:var(--ok)">Dicopy</span>`:''}</div>
      <textarea class="inp" id="thOutfb" data-thedit="fb" rows="${Math.max(6,Math.ceil(fbT.length/34)+2)}" style="margin-top:8px;font-size:15px;line-height:1.5">${esc(fbT)}</textarea>
      <div class="rowh" style="align-items:center;margin-top:8px"><span class="meta" id="thCountfb">${fbT.length} aksara</span><div class="btns" style="gap:6px"><button class="btn sm solid tab" data-act="thCopyFb">${IC.copy}Copy</button></div></div></div>`:'';
  return `<p class="eyebrow" style="margin:20px 0 0">3 versi · isi sama, ayat lain · satu untuk setiap hari</p>${t.res.versions.map(box).join('')}${fb}
    <p class="meta" style="margin:8px 0 0">Betulkan terus dalam kotak, kemudian Copy. Apa yang kau betulkan, aku belajar.</p>
    ${(t.res.tips||[]).length?`<div class="card glass" style="margin-top:12px"><span class="num">Cadangan</span><ul class="thtips">${t.res.tips.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
    <div class="btns" style="margin-top:10px"><button class="btn sm" data-act="thGen" data-x="again"${t.busy?' disabled':''}>${IC.ideas}Tulis semula</button>${tok(TOK.threads,'3 versi baru')}</div>`}
const thCountTxt=parts=>parts.length>1?parts.map((p,i)=>`Post ${i+1}: ${p.length}`).join(' · '):`${(parts[0]||'').length}/${TH_MAX} aksara${(parts[0]||'').length>TH_MAX?' · terlebih, tanda thread bersiri':''}`;
document.addEventListener('input',e=>{const el=e.target;if(!el.dataset)return;const t=ui.th;if(!t)return;
  if(el.dataset.thf){const k=el.dataset.thf;t[k]=el.value;
    if(k==='q'){const n=$('#thLs');if(n)n.innerHTML=thListRows()}
    else if(k==='dtxt'||(k==='points'&&t.dtxt==null)){if(k==='dtxt')t.dtxtMine=true;thDirty();clearTimeout(t._pt);t._pt=setTimeout(()=>{if($('#thCv'))thPaint();const d=$('#thDtx');if(d&&k==='points')d.value=t.points},250)}}
  else if(el.dataset.thedit!=null){const k=el.dataset.thedit,i=k==='fb'?'fb':+k;t.edit[i]=el.value;const c=$('#thCount'+i);if(c)c.textContent=i==='fb'?el.value.length+' aksara':thCountTxt(thParts(el.value))}});
/* 26 Nov (Mira): tulis sendiri terus, tak perlu Claude. Copy + simpan sebagai contoh suara sebenar (source 'sendiri'), untuk kemaskini voice.md bulanan. */
A.thMine=()=>{const t=thUi();const txt=t.points.trim();if(txt.length<15){toast('Tulis posting kau dulu dalam kotak');return}copyText(thParts(txt).join('\n\n'),'Dicopy. Paste dalam Threads');
  const p=save('threads',{final:txt,source:'sendiri',edited:false,no:thNextNo()},true);t.points='';render(true);thKeep(p.id);thAutoStudy()};
A.thTone=el=>{thUi().tone=el.dataset.x;render(true)};
A.thThread=()=>{const t=thUi();t.thread=!t.thread;render(true)};
A.thReset=el=>{delete thUi().edit[+el.dataset.x];render(true)};
A.thMic=async()=>{const t=thUi();if(!DICT)return;if(t.rec){t.rec=false;DICT.stop().catch(()=>{});render(true);return}
  if(!ui.thDict){ui.thDict=true;DICT.onFinal(({text})=>{if(!ui.th||!ui.th.rec)return;ui.th.points=(ui.th.points?ui.th.points.replace(/\s+$/,'')+' ':'')+text;const n=$('#thPts');if(n)n.value=ui.th.points});
    DICT.onState(({state})=>{if(state==='idle'&&ui.th&&ui.th.rec){ui.th.rec=false;render(true)}})}
  try{t.rec=true;render(true);await DICT.start({language:'ms'});toast('Cakaplah. Tekan mic lagi bila siap')}catch(e){t.rec=false;render(true);toast('Benarkan mic dalam Settings')}};
A.thCopy=el=>{const i=+el.dataset.x;const txt=(($('#thOut'+i)||{}).value||'').trim();if(!txt)return;copyText(thParts(txt).join('\n\n'),'Versi '+(i+1)+' dicopy. Paste dalam Threads');thLearn(i)};
A.thCopyFb=()=>{const t=thUi();if(!t.res||!t.res.fb)return;const txt=(($('#thOutfb')||{}).value||'').trim();if(!txt)return;copyText(txt,'Versi Facebook dicopy. Paste dalam FB');
  const o=t.postIds.fb&&get('threads',t.postIds.fb)||{no:thNextNo()};const p=save('threads',Object.assign({},o,{points:t.points.trim(),tone:t.tone,draft:t.res.fb,final:txt,edited:txt!==String(t.res.fb).trim(),plat:'fb'}),true);t.postIds.fb=p.id;render(true);thKeep(p.id)};
A.thCopyPart=el=>{const [i,k]=el.dataset.x.split('|').map(Number);const p=thParts((($('#thOut'+i)||{}).value||''))[k];if(p){copyText(p,'Post '+(k+1)+' dicopy');thLearn(i)}};

/* Simpan versi akhir Mira (setiap versi berasingan; copy semula = kemaskini). Setiap 5 posting baru, belajar gaya sendiri. */
function thLearn(i){const t=thUi();if(!t.res)return;const v=t.res.versions[i];if(!v)return;const fin=String(t.edit[i]??v.text).trim();if(!fin)return;
  const o=t.postIds[i]&&get('threads',t.postIds[i])||{no:thNextNo()};const edited=fin!==String(v.text).trim();
  const p=save('threads',Object.assign({},o,{points:t.points.trim(),tone:t.tone,draft:v.text,final:fin,edited,day:i+1}),true);t.postIds[i]=p.id;render(true);thKeep(p.id);thAutoStudy()}
/* Nombor rujukan T-001: posting lama dinombor ikut tarikh sekali sahaja (medan nf = bukan posting baru, tak cetus belajar gaya). */
const thNoTxt=p=>p.no?'T-'+String(p.no).padStart(3,'0'):'';
const thIsNew=(x,last)=>(x.updated||0)>last&&!(x.nf&&Math.abs((x.updated||0)-x.nf)<5000);
function thNoFix(){const miss=S.threads.filter(p=>!p.no&&thFinal(p)).sort((a,b)=>(a.created||0)-(b.created||0));if(!miss.length)return;
  let n=S.threads.reduce((m,p)=>Math.max(m,p.no||0),0);miss.forEach(p=>save('threads',Object.assign(p,{no:++n,nf:Date.now()}),true))}
function thNextNo(){thNoFix();return S.threads.reduce((m,p)=>Math.max(m,p.no||0),0)+1}
/* Gambar siap (dengan tulisan) naik ke Drive sekali untuk satu set gambar, dilekat pada setiap posting yang dicopy dari set tu. */
async function thKeep(id){const t=thUi();if(!t.imgs.length||!ASSETS||mode!=='live')return;
  if(!t.keep){const job=t.keep=(async()=>{await tdFonts();const ids=[];for(const im of t.imgs){const b=await new Promise(r=>thCompose(im,1440).toBlob(r,'image/jpeg',0.86));
      ids.push((await ASSETS.upload(new File([b],'threads-'+(im.name||'gambar')+'.jpg',{type:'image/jpeg'}))).id)}
    return {ids,th:thCompose(t.imgs[0],160).toDataURL('image/jpeg',0.6)}})();job.catch(()=>{if(t.keep===job)t.keep=null})}
  try{const k=await t.keep;const p=get('threads',id);if(p){save('threads',Object.assign({},p,{imgs:k.ids,th:k.th}),true);if(ui.view==='threads')render(true)}}
  catch(e){toast('Gambar tak sempat disimpan ke Drive')}}
function thAutoStudy(){const last=thStyle().learnedAt||0;const ps=thPosts().filter(p=>thFinal(p)&&p.plat!=='fb');const fresh=ps.filter(x=>thIsNew(x,last)).length;
  if(ps.length>=3&&(fresh>=5||(!last&&ps.length>=3)))A.thStudy()}

function thPrompt(again){const t=thUi();const st=thStyle();const ex=thPosts().filter(p=>thFinal(p)&&!p.edited&&p.plat!=='fb').slice(0,8);
  const edits=thPosts().filter(p=>p.edited&&p.draft&&p.plat!=='fb').slice(0,6);
  return `Kau penulis posting Threads untuk Mira (@miracikcit), content creator Malaysia (lifestyle, produk, vlog, keluarga).
Tulis 3 versi posting Threads dari point Mira di bawah. Ketiga-tiga versi bawa ISI DAN MESEJ YANG SAMA, tapi ayat, hook dan susunan berlainan, sebab setiap satu akan di-post pada hari berbeza. Setiap versi berdiri sendiri, jangan rujuk versi lain. MESTI bunyi macam Mira tulis sendiri, bukan macam AI.
${VOICE_MIRA}${st.summary?'\\nGAYA MIRA (dipelajari):\\n'+st.summary+'\\n':''}${st.notes&&st.notes.length?'Peraturan gaya:\\n- '+st.notes.join('\\n- ')+'\\n':''}${edits.length?'\\nPEMBETULAN MIRA (draf kau vs versi yang dia betulkan; ini paling penting, jangan ulang kesilapan draf):\\n'+edits.map(p=>`DRAF: ${p.draft}\\nMIRA: ${p.final}`).join('\\n\\n')+'\\n':''}${ex.length?'\\nCONTOH POSTING SEBENAR MIRA:\\n'+ex.map((p,i)=>`[${i+1}] ${p.final}`).join('\\n\\n')+'\\n':''}
POINT MIRA:
${t.points.trim()}
${t.imgs.length?`\\nPosting ni ada ${t.imgs.length} gambar.\\n`:''}Nada: ${t.tone==='Auto'?'ikut point':t.tone}
${t.thread?'Pecahkan setiap versi jadi thread bersiri 2 hingga 5 post. Asingkan setiap post dengan baris "---". Setiap post bawah 500 aksara, post pertama hook paling kuat.':'Setiap versi satu post sahaja, bawah 500 aksara.'}
Peraturan: hook di ayat pertama (berhenti scroll), satu perenggan mengalir ikut SUARA MIRA, maksimum 1 hashtag atau tiada, jangan reka fakta yang tiada dalam point, tiada harga melainkan Mira tulis.${again?'\\nIni permintaan tulis semula: ayat lain dari sebelum ni. ('+Date.now()+')':''}
tips: 2 cadangan ringkas untuk naikkan engagement (cth. masa post, gambar mana dulu, ayat minta tolong crowd). Jangan cadang soalan penutup pada pembaca.
fb: SATU versi untuk Facebook dengan isi yang sama: 2 hingga 4 perenggan pendek, boleh sampai 900 aksara, ayat pertama hook, ikut SUARA MIRA, tiada hashtag, tiada soalan penutup.
${t.imgs.length?'gambar: tulisan pendek untuk dilekat atas gambar. "tajuk" 2 hingga 3 perkataan yang tarik perhatian, "label" satu untuk setiap point (2 hingga 4 perkataan, maksimum 5 label). Guna perkataan Mira, jangan reka fakta.\n':''}Balas JSON sahaja: {"versions":[{"text":".."},{"text":".."},{"text":".."}],"fb":"..","tips":[".."]${t.imgs.length?',"gambar":{"tajuk":"..","label":[".."]}':''}}`}
A.thGen=async el=>{const t=thUi();if(!t.points.trim()){toast('Tulis point dulu');const n=$('#thPts');if(n)n.focus();return}
  if(!SAMPLE){toast('Generate tak tersedia sekarang');return}
  if(t.rec){t.rec=false;DICT&&DICT.stop().catch(()=>{})}
  t.busy=true;render(true);
  try{const j=await SAMPLE.json(thPrompt(el&&el.dataset.x==='again'));const vs=(j&&Array.isArray(j.versions)?j.versions:[]).filter(x=>x&&x.text).slice(0,3).map(x=>({text:String(x.text).trim()}));
    if(!vs.length)throw new Error('kosong');t.res={versions:vs,fb:j.fb?String(j.fb).trim():'',tips:(Array.isArray(j.tips)?j.tips:[]).map(String).slice(0,3)};t.edit={};t.postIds={};
    const g=j.gambar;if(g&&g.tajuk&&!t.dtxtMine){t.dtxt=[String(g.tajuk)].concat((Array.isArray(g.label)?g.label:[]).map(String).slice(0,5)).join('\n');t.imgs.forEach(x=>{x.deco.pos={}});thDirty()}
    toast(t.res.fb?'3 versi + Facebook siap':'3 versi siap')}
  catch(e){if(!(e&&(e.code==='declined'||e.name==='AbortError')))toast(e&&e.code==='timeout'?'Mac mini lambat jawab. Cuba lagi sekejap':'Tak berjaya. Semak Mac mini hidup')}
  finally{t.busy=false;render(true)}};

/* ---------- belajar gaya + cadangan ---------- */
function thStyleBox(){const st=thStyle();const t=thUi();const ps=thPosts().filter(p=>thFinal(p)&&p.plat!=='fb');const ed=ps.filter(p=>p.edited).length;
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
A.thStudy=async()=>{const t=thUi();if(t.learnBusy)return;const ps=thPosts().filter(p=>thFinal(p)&&p.plat!=='fb').slice(0,20);if(ps.length<3||!window.studioJob)return;const st=thStyle();
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
function thListRows(){const t=thUi(),q=t.q.trim().toLowerCase(),qn=q.replace(/^t-?0*/,'');let ps=thPosts().filter(thFinal);
  if(t.lf==='th')ps=ps.filter(p=>p.plat!=='fb');else if(t.lf==='fb')ps=ps.filter(p=>p.plat==='fb');else if(t.lf==='img')ps=ps.filter(p=>(p.imgs||[]).length);
  if(q)ps=ps.filter(p=>(/^\d+$/.test(qn)&&String(p.no||'')===qn)||(p.final+' '+(p.points||'')).toLowerCase().includes(q));
  if(!ps.length)return `<p class="meta" style="margin:14px 0">Tiada posting sepadan.</p>`;
  return ps.slice(0,80).map(p=>{const im=p.imgs||[];
    return `<details class="col card glass"><summary><div class="rowh" style="align-items:center;gap:10px"><b class="thno">${thNoTxt(p)||'·'}</b>${p.th?`<img class="thlth" src="${p.th}" alt="">`:''}<div style="min-width:0;flex:1"><h3 style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.final.split('\n')[0])}</h3><div class="meta">${fmtD(p.created)} · ${p.plat==='fb'?'Facebook':'Threads'}${p.source==='sendiri'?' · tulis sendiri':p.source==='lama'?' · posting lama':p.source==='gambar'?' · dari gambar':p.edited?' · kau edit':''}${im.length?' · '+im.length+' gambar':''}</div></div><span class="ic chev">${IC.chev}</span></div></summary>
    <div style="white-space:pre-wrap;font-size:14px;margin-top:10px">${esc(p.final)}</div>
    <div class="btns" style="gap:6px;margin-top:10px"><button class="btn sm solid tab" data-act="thHCopy" data-id="${p.id}">${IC.copy}Copy</button>${im.map((id,i)=>`<a class="btn sm" href="${esc(window.studioFileUrl?'https://drive.google.com/uc?export=download&id='+String(id).split('~')[0]:'#')}" target="_blank" rel="noopener">${IC.dl}Gambar ${i+1}</a>`).join('')}<button class="btn sm" data-act="thReuse" data-id="${p.id}">Guna semula</button>${im.length?`<button class="btn sm" data-act="thHImgDel" data-id="${p.id}">Buang gambar</button>`:''}<button class="btn icon sm bad" data-act="thHDel" data-id="${p.id}" aria-label="Padam">${IC.trash}</button></div></details>`}).join('')}
function thList(){const t=thUi();const n=thPosts().filter(thFinal).length;
  return `<div class="card glass"><input class="inp" id="thQ" data-thf="q" type="search" placeholder="Cari perkataan atau nombor (cth 12)" value="${esc(t.q)}">
    <div class="btns" style="gap:6px;margin-top:10px">${[['all','Semua'],['th','Threads'],['fb','Facebook'],['img','Ada gambar']].map(([k,l])=>`<button class="btn sm ${t.lf===k?'solid tab':''}" data-act="thLf" data-x="${k}">${l}</button>`).join('')}</div></div>
    <p class="eyebrow" style="margin-top:16px">${n} posting · gambar dalam Google Drive</p><div class="list" id="thLs">${thListRows()}</div>`}
A.thSeg=el=>{const t=thUi();t.seg=el.dataset.x;if(t.seg==='list'&&mode==='live')thNoFix();render(true)};
A.thLf=el=>{thUi().lf=el.dataset.x;render(true)};
A.thReuse=el=>{const p=get('threads',el.dataset.id);if(!p)return;const t=thUi();t.points=p.points||p.final;t.seg='buat';render(true);window.scrollTo(0,0);toast('Point dimasukkan semula')};
A.thHCopy=el=>{const p=get('threads',el.dataset.id);if(p)copyText(thParts(p.final).join('\n\n'),'Dicopy')};
const thImgGone=ids=>ids.filter(i=>!S.threads.some(o=>(o.imgs||[]).includes(i))).forEach(i=>{if(ASSETS)ASSETS.delete(i).catch(()=>{})});
A.thHImgDel=el=>confirmBox('Buang gambar posting ni dari Google Drive? Caption kekal.',()=>{const p=get('threads',el.dataset.id);if(!p)return;const ids=p.imgs||[];const o=Object.assign({},p);delete o.imgs;delete o.th;save('threads',o,true);thImgGone(ids);render(true);toast('Gambar dibuang')},'Ya, buang');
A.thHDel=el=>confirmBox('Padam posting ni dan gambarnya dalam Drive? Aku tak akan belajar dari dia lagi.',()=>{const p=get('threads',el.dataset.id);const ids=(p&&p.imgs)||[];del('threads',el.dataset.id);thImgGone(ids);toast('Dipadam')},'Ya, padam');

V.threads=()=>{const t=thUi();const n=thPosts().filter(thFinal).length;
  return head('Gambar cantik, ayat gaya kau')+`<div class="seg" style="margin-bottom:14px;--c:${TAB.threads.c}"><button type="button" class="${t.seg!=='list'?'on':''}" data-act="thSeg" data-x="buat">Buat</button><button type="button" class="${t.seg==='list'?'on':''}" data-act="thSeg" data-x="list">Senarai · ${n}</button></div>`+(t.seg==='list'?thList():thImgBox()+thTextBox()+thResBox()+thStyleBox())};

/* 24 Nov (Mira): ingat gaya dari gambar. Screenshot posting lama > Mac mini baca teks (Apple Vision, 0 token) > disimpan sebagai contoh gaya. */
A.thShotOld=()=>pickFile('image/*',async fs=>{const t=thUi();if(!ASSETS||!window.studioJob){toast('Perlu sambungan Studio');return}let n=0;
  try{for(let i=0;i<fs.length&&i<10;i++){t.shotBusy='Baca '+(i+1)+'/'+Math.min(fs.length,10);render(true);
      const up=await ASSETS.upload(fs[i]);const o=await window.studioJob('ocr',{file:up.id},2*60000);
      const txt=(o.lines||[]).map(String).filter(l=>!/^\d+[smhj]$|^(like|reply|repost|share|suka|balas)$/i.test(l.trim())).join('\n').trim();
      if(txt.length>=15){save('threads',{final:txt,source:'gambar',edited:false},true);n++}}
    toast(n?n+' posting dari gambar disimpan sebagai contoh gaya':'Tiada teks dijumpai dalam gambar');if(n)thAutoStudy()}
  catch(e){toast('Tak dapat baca gambar. Semak Mac mini hidup')}finally{t.shotBusy=null;render(true)}},true);
