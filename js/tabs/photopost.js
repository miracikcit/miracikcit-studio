/* ---------- POSTING GAMBAR dalam Jadual To Publish (27 Nov 2026, Mira; Photo Editor Fasa 2) ----------
   Photo Editor langkah 4 "Hantar ke To Publish" simpan satu doc `photos/<id>`:
   {no, title, prod, created, th, imgs:{'3:4':[id Drive], '4:5':[..], '9:16':[..]}, units:[{rows:[{k,p,v,text,ok,link}], date,time,acc,fixed}]}.
   Unit 0 = Threads versi 1 + Facebook + Instagram + TikTok (hari yang sama); unit 1, 2 = Threads versi 2, 3 (hari berikutnya).
   Slot: app pilih sendiri, HANYA pada hari yang slot videonya tak cukup (ada slot kosong), satu unit sehari. Dikira semula setiap kali
   (video baru boleh ambil slot tu) sehingga Mira tanda Scheduled pada mana-mana baris: masa tu tarikh dikunci (`fixed`).
   Dalam kad hari: Reels di atas, posting gambar di bawah. Rekod dalam Studio sahaja, tiada Sheet. 0 token. */
const PP_L={th:'Threads',fb:'Facebook',ig:'Instagram',tt:'TikTok'};
const PP_R={th:'3:4',fb:'4:5',ig:'4:5',tt:'9:16'};
const ppNo=p=>'P-'+String(p.no||0).padStart(3,'0');
const ppDone=u=>!!(u.rows||[]).length&&u.rows.every(r=>r.ok);
function ppPlan(plan,groups,now){now=now||new Date();const today=ymd(now),out=[],used=new Set(),last={};
  let days;
  if(plan&&groups)days=schedWarn(plan,groups,now).days;
  else days=Array.from({length:14},(_,i)=>({date:addDays(today,i+1),empty:[{t:'12:00',a:'miracikcit',k:'J'}]}));
  const all=(S.photos||[]).slice().sort((a,b)=>(a.created||0)-(b.created||0)).flatMap(p=>(p.units||[]).map((u,i)=>({p,u,i})));
  all.forEach(x=>{const u=x.u,dn=ppDone(u);if(u.date&&(dn||(u.fixed&&u.date>=today))){out.push(Object.assign({date:u.date,time:u.time,acc:u.acc,st:dn?'done':'fixed'},x));used.add(u.date);if(!last[x.p.id]||last[x.p.id]<u.date)last[x.p.id]=u.date}});
  all.filter(x=>!out.some(o=>o.p===x.p&&o.i===x.i)).forEach(x=>{const after=last[x.p.id]||'';
    const d=days.find(d=>d.empty.length&&!used.has(d.date)&&d.date>after);
    if(!d){out.push(Object.assign({date:'',time:'',acc:'',st:'wait'},x));return}
    const s=d.empty.find(s=>s.a==='miracikcit'&&s.k!=='C')||d.empty.find(s=>s.k!=='C')||d.empty[0];
    out.push(Object.assign({date:d.date,time:s.t,acc:s.a,st:'auto'},x));used.add(d.date);last[x.p.id]=d.date});
  return out}
let ppC=null,ppAt=0;
function ppPlanC(){if(!ppC||Date.now()-ppAt>3000){try{const g=typeof parseSheet==='function'?parseSheet():null;ppC=g?ppPlan(schedPlan(g),g):ppPlan(null,null)}catch(e){ppC=[]}ppAt=Date.now()}return ppC}
const ppOpen=()=>ppPlanC().filter(o=>o.st!=='done');
const ppFind=x=>{const [id,i,k]=String(x).split('|');const p=get('photos',id);const u=p&&(p.units||[])[+i];return {p,u,i:+i,r:u&&u.rows[+k],k:+k}};
const ppSave=p=>{ppC=null;return save('photos',p)};

function ppCard(o){const p=o.p,u=o.u,n=(p.units||[]).length,all=ppDone(u),has=p.imgs&&Object.keys(p.imgs).length;
  const sub=[p.prod,o.date?timeLbl(o.time)+' · @'+o.acc:'',o.st==='auto'?'auto slot':''].filter(Boolean).map(esc).join(' · ');
  return `<div class="pp-card glass${all?' all':''}" id="pp-${p.id}-${o.i}"><div class="pp-h">${p.th?`<img src="${p.th}" alt="">`:''}<span class="pp-t"><b>${ppNo(p)}${n>1?' · day '+(o.i+1)+'/'+n:''}</b><i>${esc(p.title||'Photo post')}</i>${sub?`<small>${sub}</small>`:''}</span><button type="button" class="pp-x" data-act="ppDel" data-id="${p.id}" aria-label="Remove photo post">${IC.x}</button></div>
    ${u.rows.map((r,k)=>{const key=p.id+'|'+o.i+'|'+k;return `<div class="pp-r"><span class="pp-l" style="--pc:var(--${r.p==='th'?'tt':r.p})">${PP_L[r.p]}${r.v?' v'+r.v:''}</span><button type="button" class="pp-b" data-act="ppCopy" data-x="${key}">${IC.copy}Copy</button>${has?`<button type="button" class="pp-b" data-act="ppPhotos" data-x="${key}">${IC.dl}Photos</button>`:''}<button type="button" class="pp-ok" data-act="ppTick" data-x="${key}" aria-pressed="${!!r.ok}">${r.ok?'Scheduled ✓':'Scheduled'}</button></div>`}).join('')}</div>`}
const ppDay=L=>L.length?`<p class="pp-sec">Photo posts</p><div class="pp-list">${L.map(ppCard).join('')}</div>`:'';
function ppWait(PH){const L=PH.filter(o=>o.st==='wait');return L.length?`<div class="tpday" id="pp-wait">Photo posts · waiting for a free day</div><p class="meta" style="margin:0 0 8px">Every day in the next 2 weeks is full of videos. These move in when a slot is empty.</p><div class="pp-list">${L.map(ppCard).join('')}</div>`:''}
/* Home: satu baris ringkas dalam kad To Publish */
function ppHome(){const L=ppOpen();if(!L.length)return '';const today=ymd(new Date()),nx=L.filter(o=>o.date).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0],late=L.filter(o=>o.date&&o.date<=today).length;
  return `<button type="button" class="hprow pp-home" data-act="tpGo" data-id="${nx?'pp-'+nx.p.id+'-'+nx.i:'pp-wait'}"><span class="tm">${nx?esc(tpDayLbl(nx.date).replace(/ · .*$/,'').replace(/^(\w{3}) \d.*$/,'$1'))+' · '+timeLbl(nx.time):'No slot'}</span><span class="nm"><b>${L.length} photo post${L.length>1?'s':''} to schedule</b><i>${nx?esc(ppNo(nx.p)+' · '+(nx.p.title||'')):'waiting for a free day'}${late?' · '+late+' due today':''}</i></span></button>`}
/* Published: set yang semua barisnya dah Scheduled dan tarikh terakhirnya dah lepas. Link setiap platform boleh diisi. */
function ppPublished(){const today=ymd(new Date());const L=(S.photos||[]).filter(p=>(p.units||[]).length&&p.units.every(u=>ppDone(u)&&u.date&&u.date<=today)).sort((a,b)=>(b.no||0)-(a.no||0));if(!L.length)return '';
  return `<p class="eyebrow" style="margin:22px 0 8px">Posting gambar · ${L.length}</p><div class="list">${L.map(p=>`<details class="col card glass"><summary><div class="rowh" style="align-items:center;gap:10px"><b class="thno">${ppNo(p)}</b>${p.th?`<img class="thlth" src="${p.th}" alt="">`:''}<div style="min-width:0;flex:1"><h3 style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.title||'Posting gambar')}</h3><div class="meta">${esc([p.prod,dmy(p.units[0].date),[...new Set(p.units.flatMap(u=>u.rows.map(r=>PP_L[r.p])))].join(', ')].filter(Boolean).join(' · '))}</div></div><span class="ic chev">${IC.chev}</span></div></summary>
    ${p.units.map((u,i)=>u.rows.map((r,k)=>`<label class="pp-lk"><span>${PP_L[r.p]}${r.v?' v'+r.v:''} · ${dmy(u.date)}</span><input class="inp" type="url" inputmode="url" placeholder="Tampal link posting" value="${esc(r.link||'')}" data-pplink="${p.id}|${i}|${k}"></label>`).join('')).join('')}
    <div class="btns" style="margin-top:10px;justify-content:flex-end"><button class="btn sm bad" data-act="ppDel" data-id="${p.id}">${IC.trash}Buang</button></div></details>`).join('')}</div>`}
document.addEventListener('change',e=>{const el=e.target;if(!el.dataset||!el.dataset.pplink)return;const f=ppFind(el.dataset.pplink);if(!f.r)return;f.r.link=el.value.trim();ppSave(f.p);toast('Link disimpan')});

A.ppCopy=el=>{const f=ppFind(el.dataset.x);if(f.r)copyText(String(f.r.text||'').split(/\n\s*-{3,}\s*\n/).map(s=>s.trim()).filter(Boolean).join('\n\n'),PP_L[f.r.p]+' caption copied')};
A.ppTick=el=>{const f=ppFind(el.dataset.x);if(!f.r)return;const o=ppPlanC().find(z=>z.p.id===f.p.id&&z.i===f.i);f.r.ok=!f.r.ok;
  if(f.r.ok&&!f.u.fixed){if(!o||!o.date){f.r.ok=false;toast('No free day yet for this post');return}Object.assign(f.u,{date:o.date,time:o.time,acc:o.acc,fixed:true})}
  if(!f.u.rows.some(r=>r.ok))Object.assign(f.u,{fixed:false,date:'',time:'',acc:''});
  ppSave(f.p);render(true)};
/* Gambar ikut saiz platform: ambil dari Drive, kemudian helaian Simpan di phone (Save Image = Photos) atau muat turun di komputer. Peratus pada butang. */
A.ppPhotos=async el=>{const f=ppFind(el.dataset.x);if(!f.r||el.dataset.busy)return;const im=f.p.imgs||{},ids=im[PP_R[f.r.p]]||im[Object.keys(im)[0]]||[];if(!ids.length){toast('No photos saved for this post');return}
  if(el._files){ppGive(el._files,el);return}
  el.dataset.busy='1';const old=el.innerHTML,fs=[];
  try{for(let i=0;i<ids.length;i++){el.innerHTML=`<i class="spin"></i>${Math.round(i/ids.length*100)}%`;const r=await fetch('https://lh3.googleusercontent.com/d/'+String(ids[i]).split('~')[0],{referrerPolicy:'no-referrer'});if(!r.ok)throw new Error('http');
      fs.push(new File([await r.blob()],ppNo(f.p)+'-'+PP_L[f.r.p].toLowerCase()+'-'+(i+1)+'.jpg',{type:'image/jpeg'}))}
    el.innerHTML=old;delete el.dataset.busy;await ppGive(fs,el)}
  catch(e){el.innerHTML=old;delete el.dataset.busy;toast('Could not get photos from Drive. Opening Drive instead');window.open('https://drive.google.com/uc?export=download&id='+String(ids[0]).split('~')[0],'_blank','noopener')}};
async function ppGive(fs,el){const d={files:fs};
  if(navigator.maxTouchPoints>1&&navigator.canShare&&navigator.canShare(d)){try{await navigator.share(d);el._files=null;el.innerHTML=IC.dl+'Photos'}catch(e){if(e.name==='AbortError'){el._files=null;el.innerHTML=IC.dl+'Photos'}else{el._files=fs;el.innerHTML=IC.dl+'Save '+fs.length;toast('Tap Save to put them in Photos')}}}
  else{for(const f of fs){DL_save(f);await new Promise(r=>setTimeout(r,350))}toast(fs.length+' photo'+(fs.length>1?'s':'')+' downloaded')}}
A.ppDel=el=>confirmBox('Buang posting gambar ni? Gambarnya dalam Drive dibuang sekali. Caption kekal dalam Senarai Photo Editor.',()=>{const p=get('photos',el.dataset.id);if(!p)return;
  Object.values(p.imgs||{}).flat().forEach(id=>{if(ASSETS)ASSETS.delete(id).catch(()=>{})});ppC=null;del('photos',p.id);toast('Dibuang')},'Ya, buang');
A.ppJump=()=>{const o=ppOpen()[0];const c=o&&document.getElementById(o.date?'pp-'+o.p.id+'-'+o.i:'pp-wait');if(c)tpFlash(c)};
/* Published: senarai posting gambar di bawah senarai video */
(()=>{const base=V.published;V.published=()=>{const h=base();return ui.carOpen&&get('carousel',ui.carOpen)?h:h+ppPublished()}})();
