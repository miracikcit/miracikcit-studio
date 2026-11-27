/* ---------- B-ROLL dalam Edit (2026-11-20) ----------
   Aliran: footage masuk folder edit -> Mac mini pre-cut sendiri (folder VLOG / VO / produk, termasuk subfolder tempat)
   -> Studio Edit › B-roll: swipe terus di sini (preview kecil dalam Drive, boleh guna data phone) -> Dah semak
   -> klip ke B-ROLL LIBRARY -> EDIT NOW. Trim / + Part / Split / close-up masih dalam Picker (Wi-Fi rumah).
   Folder produk: video bercakap = suara (A-roll, ditranskrip di Mac mini), B-roll + close-up dari video bercakap
   (tanpa bunyi) tutup atas suara. Doc: broll/<slug> (Mac), brm/<slug>-<n> senarai moment (Mac), brd/<slug> keputusan swipe (phone). */
const BR_TAGS=['Close-up','Tekstur','Demo','Packaging','Tangan','Before/After'];
const brsFor=key=>S.broll.filter(b=>b.key===key||b.project===key||String(b.key||'').startsWith(key+'/'));
const brLib=key=>brsFor(key).filter(b=>b.status==='stok').reduce((a,b)=>a+(b.kept||(b.clips||[]).length||0),0);
const brMoms=b=>(S.brm||[]).filter(x=>x.slug===b.id).sort((a,c)=>(a.part||0)-(c.part||0)).flatMap(x=>x.m||[])
  .map(r=>({id:r[0],video:r[1],start:r[2],len:r[3],kind:r[4],badge:r[5],sprite:r[6],prev:r[7],p:r[8]}));
const brDec=b=>((S.brd||[]).find(x=>x.id===b.id)||{}).d||{};
const brLocalKeeps=b=>{const d=brDec(b),p=b.pdec||{};const ids=new Set([...Object.keys(d),...Object.keys(p)]);let n=0;ids.forEach(id=>{const a=d[id]?d[id].a:p[id];if(a==='k')n++});return n};
const brSeen=b=>new Set([...Object.keys(brDec(b)),...Object.keys(b.pdec||{})]).size;
/* 23 Nov: kiraan terus dari Picker (Mac hantar setiap ~30 s): left = shot perlu swipe (wakil shot serupa sahaja), final = klip Final */
const brLeft=b=>b.left!=null?b.left:Math.max(0,(b.moments||0)-brSeen(b));
const brPick=b=>`${brCfg().home.replace(/\/$/,'')}/?job=${encodeURIComponent(b.job||'')}#${brLeft(b)?'swipe':'kept'}`;
/* status satu set B-roll: [teks, warna, % atau null, sedang kerja] */
function brState(b){const e=b.exp||{};const k=b.kept!=null?b.kept:brLocalKeeps(b),f=b.final||0,left=brLeft(b);
  if(e.running)return ['Mac simpan Final '+(e.done||0)+'/'+(e.total||0),'var(--c)',e.total?e.done/e.total*100:0,true];
  if(left>0)return [left+' tunggu swipe · keep '+k,'var(--warn)',null,false];
  if(k&&f<k)return ['Final '+f+'/'+k+' · tekan ✓ Final dalam Picker','var(--warn)',null,false];
  return ['Siap swipe · keep '+k,'#4E9B63',null,false]}

/* Langkah projek dalam kad Edit: B-roll → Edit → Draf → Final */
function brSteps(r,e){const useBr=r.kind==='f'&&BR_VO.test(r.stage||'');const bbs=useBr?brsFor(r.key):[];const st=String((e&&e.status)||'');
  const pend=bbs.filter(b=>brPending(b)||b.status==='error');const pre=pend.find(b=>b.status==='precut');
  const tot=pend.reduce((a,b)=>a+(b.moments||0),0),seen=pend.reduce((a,b)=>a+brSeen(b),0);
  const lefts=pend.reduce((a,b)=>a+brLeft(b),0);const brLab=!bbs.length?(useBr?'Belum pre-cut':'—'):pre?'Pre-cut '+Math.min(100,Math.round(pre.progress||0))+'%':pend.length?(lefts>0?lefts+' tunggu swipe':'Final dalam Picker'):'Siap ✓';
  const brOk=bbs.length&&!pend.length;
  const steps=[...(useBr?[['B-roll',brLab,brOk,pend.length>0]]:[]),['Edit',e?'Sesi dibuka':'',!!e&&!/sesi/i.test(st),!!e&&/sesi/i.test(st)],['Draf',/draf|semak|render/i.test(st)?st:'',/render|siap/i.test(st)||!!(e&&e.final),/draf|semak/i.test(st)],['Final','',!!(e&&(e.final||/siap/i.test(st))),false]];
  return `<div class="brsteps">${steps.map(([n,l,ok,cur])=>`<button type="button" class="brs${ok?' ok':''}${cur?' cur':''}"${n==='B-roll'&&bbs.length?' data-act="teSeg" data-x="broll"':n==='Edit'?' data-act="brGo"':' tabindex="-1"'}><i>${ok?IC.check:''}</i><b>${n}</b>${l?`<span>${esc(l)}</span>`:''}</button>`).join('<em></em>')}</div>
`}
/* 27 Nov (Mira: "tekan Edit tak jalan apa-apa"): bulatan langkah EDIT nampak macam butang tapi dulu kosong.
   Kini ia tekan butang utama kad tu: EDIT NOW / Sambung kerja, atau Buka chat Claude bila sesi dah ada. */
A.brGo=el=>{const c=el.closest('.card');const b=c&&(c.querySelector('.tem a.btn.solid,.tem .edgo.solid:not([disabled])')||c.querySelector('.tem a.btn,.tem .edgo:not([disabled])'));
  if(b)b.click();else toast('Belum boleh buka: Mac mini tak jawab atau sesi sedang dibuka')};

/* Segmen Edit: Folder | B-roll */
function teSegs(){const n=S.broll.filter(b=>brPending(b)||b.status==='error').length;const seg=ui.teSeg||'folder';
  return `<div class="seg" style="margin-bottom:14px">${[['folder','Folder edit'],['broll','B-roll'+(n?' · '+n:'')]].map(([k,l])=>`<button type="button" class="${seg===k?'on':''}" data-act="teSeg" data-x="${k}">${l}</button>`).join('')}</div>`}
A.teSeg=el=>{ui.teSeg=el.dataset.x;if(ui.view!=='to-edit')go('to-edit');else render(true);window.scrollTo(0,0)};

/* Senarai shot B-roll dari nota produk (bahagian Trust Points / B-roll). Tick sendiri bila klip bertag sepadan di-keep. */
const BR_KW=[[/close.?up|dekat|zoom/i,'Close-up'],[/tekstur|texture|buih|cecair|krim/i,'Tekstur'],[/label|logo|kotak|box|packag|botol|pek\b/i,'Packaging'],[/tangan|hand|pegang|picit/i,'Tangan'],[/before|after|sebelum|selepas/i,'Before/After'],[/demo|cara guna|test|cuba|guna/i,'Demo']];
function brShots(b){if(b.type!=='product')return '';const proj=String(b.project||b.key||'').split('/').pop();
  const p=(S.products||[]).find(x=>pMatch(x.name,proj)||pMatch(x.brand,proj)||pMatch(String(x.folder||'').split('/').pop(),proj));if(!p)return '';
  const sec=(p.sections||[]).find(s=>/b-?roll|trust/i.test(s.title||''));const items=(sec&&sec.items)||[];if(!items.length)return '';
  const d=brDec(b);const keptTags=new Set(Object.values(d).filter(v=>v.a==='k').flatMap(v=>v.l||[]));const man=b.shots||{};
  return `<details class="col" style="margin-top:10px"><summary class="meta" style="cursor:pointer">Shot dalam nota ${esc(p.name)} · ${items.filter((t,i)=>man[i]||BR_KW.some(([re,tag])=>re.test(t)&&keptTags.has(tag))).length}/${items.length}</summary>
   ${items.map((t,i)=>{const auto=BR_KW.some(([re,tag])=>re.test(t)&&keptTags.has(tag));const on=man[i]||auto;
     return `<label class="brshot"><input type="checkbox" data-act="brShot" data-id="${esc(b.id)}" data-x="${i}"${on?' checked':''}><span>${esc(t)}${auto&&!man[i]?' <em>(dari tag)</em>':''}</span></label>`}).join('')}
   <p class="meta" style="margin:6px 0 0">Yang belum ditick: shoot lagi sebelum edit, atau ambil close-up dari video bercakap.</p></details>`}
A.brShot=el=>{const b=get('broll',el.dataset.id);const sh=Object.assign({},b.shots||{});const i=el.dataset.x;if(el.checked)sh[i]=1;else delete sh[i];save('broll',Object.assign({},b,{shots:sh}),true)};

/* ---------- Swipe dalam Studio ---------- */
let brSw=null;
A.brSwipe=el=>{const b=get('broll',el.dataset.id);if(!b)return;brSw={id:b.id,hist:[],tags:[]};brSwDraw()};
function brQueue(b){const d=brDec(b),p=b.pdec||{};return brMoms(b).filter(m=>!d[m.id]&&!p[m.id])}
function brSwDraw(){const b=get('broll',brSw.id);if(!b){closeModal();return}const all=brMoms(b);const q=brQueue(b);const m=q[0];const prod=b.type==='product';
  const keeps=brLocalKeeps(b);
  if(!m){modal(`<h2>${esc(b.name)}</h2><div class="empty" style="padding:26px 10px"><p class="hand" style="font-size:26px;margin:0">Siap swipe!</p><p class="meta">${keeps} klip di-keep daripada ${all.length}. Mac mini simpan pilihan ni dalam beberapa minit.</p></div>
    <div class="btns" style="justify-content:space-between"><button class="btn" data-act="brUndo"${brSw.hist.length?'':' disabled'}>${IC.undo||'↶'} Undo</button><button class="btn solid tab" data-act="brSwClose">Tutup</button></div>
    <p class="meta" style="margin:10px 0 0">Lepas ni tekan <b>Dah semak</b> pada kad untuk simpan ke B-ROLL LIBRARY.</p>`);return}
  if(brSw.mid!==m.id){brSw.mid=m.id;brSw.tags=[];brSw.play=false}
  const sp=m.sprite?`https://drive.google.com/thumbnail?id=${encodeURIComponent(m.sprite)}&sz=w1000`:'';
  modal(`<div class="rowh" style="align-items:center;margin-bottom:8px"><h2 style="margin:0;flex:1;min-width:0">${esc(b.name)}</h2><span class="meta">${all.length-q.length+1} / ${all.length} · keep ${keeps}</span></div>
   <div class="brcard" id="brCard">${brSw.play&&m.prev?`<iframe src="https://drive.google.com/file/d/${encodeURIComponent(m.prev)}/preview" allow="autoplay" title="Preview"></iframe>`:`<div class="brspr" style="background-image:url('${esc(sp)}')"></div>`}
    <div class="brst k">KEEP</div><div class="brst s">SKIP</div>
    ${m.prev&&!brSw.play?`<button type="button" class="brplay" data-act="brPlay" aria-label="Main video">▶</button>`:''}
    <div class="brsrc"><span>${esc(m.video)} · ${esc(fmtSec(m.start))}</span><span>${m.len}s</span></div></div>
   <div class="btns" style="margin-top:8px;gap:6px">${m.kind==='closeup'?'<span class="pill" style="--pc:#5A7FA8">Close-up dari video bercakap · tanpa bunyi</span>':''}${m.kind!=='closeup'&&m.badge?`<span class="pill" style="--pc:${/Sharp/.test(m.badge)?'#7FA36B':'var(--warn)'}">${esc(m.badge)}</span>`:''}${m.p!=null?`<span class="pill" style="--pc:var(--rose,#9A4F5D)">${Math.round(m.p*100)}% gaya kau</span>`:''}</div>
   ${prod?`<div class="btns" style="margin-top:8px;gap:6px">${BR_TAGS.map(t=>`<button type="button" class="btn sm${brSw.tags.includes(t)?' solid tab':''}" data-act="brTag" data-x="${esc(t)}">${esc(t)}</button>`).join('')}</div><p class="meta" style="margin:4px 0 0">Tag jenis shot (pilihan) supaya Claude padankan dengan ayat kau.</p>`:''}
   <div class="brbar"><button class="btn icon" data-act="brUndo" aria-label="Undo"${brSw.hist.length?'':' disabled'}>${IC.undo||'↶'}</button><button class="btn big2b" data-act="brPick" data-x="s">✕ Skip</button><button class="btn big2b solid tab" data-act="brPick" data-x="k">♥ Keep</button></div>
   <p class="meta" style="margin:8px 0 0">Swipe kanan = Keep, kiri = Skip. Nak trim, gabung bahagian atau close-up sendiri: buka Picker (Wi-Fi rumah).</p>`);
  brSwipeGesture()}
const fmtSec=t=>{t=+t||0;const m=Math.floor(t/60),s=Math.floor(t%60);return m+':'+(s<10?'0':'')+s};
function brSwipeGesture(){const el=$('#brCard');if(!el||brSw.play)return;let x0=null,dx=0;
  el.onpointerdown=e=>{if(e.target.closest('button'))return;x0=e.clientX;dx=0;el.style.transition='none';el.setPointerCapture(e.pointerId)};
  el.onpointermove=e=>{if(x0==null)return;dx=e.clientX-x0;el.style.transform=`translateX(${dx}px) rotate(${dx/24}deg)`;el.querySelector('.k').style.opacity=Math.max(0,Math.min(1,dx/90));el.querySelector('.s').style.opacity=Math.max(0,Math.min(1,-dx/90))};
  el.onpointerup=el.onpointercancel=()=>{if(x0==null)return;x0=null;el.style.transition='';if(Math.abs(dx)>90)brDecide(dx>0?'k':'s');else{el.style.transform='';el.querySelectorAll('.brst').forEach(s=>s.style.opacity=0)}}}
function brDecide(a){const b=get('broll',brSw.id);const m=brQueue(b)[0];if(!m)return;
  const doc=(S.brd||[]).find(x=>x.id===b.id)||{id:b.id,d:{}};const d=Object.assign({},doc.d||{});d[m.id]=a==='k'&&brSw.tags.length?{a,l:brSw.tags.slice()}:{a};
  brSw.hist.push(m.id);save('brd',Object.assign({},doc,{id:b.id,d,key:b.key}),true);brSwDraw()}
A.brPick=el=>brDecide(el.dataset.x);
A.brTag=el=>{const t=el.dataset.x;const i=brSw.tags.indexOf(t);if(i>=0)brSw.tags.splice(i,1);else brSw.tags.push(t);brSwDraw()};
A.brPlay=()=>{brSw.play=true;brSwDraw()};
A.brUndo=()=>{const b=get('broll',brSw.id);const mid=brSw.hist.pop();if(!mid)return;const doc=(S.brd||[]).find(x=>x.id===b.id);if(!doc)return;const d=Object.assign({},doc.d);delete d[mid];save('brd',Object.assign({},doc,{d}),true);brSw.mid=null;brSwDraw();toast('Undo')};
A.brSwClose=()=>{brSw=null;closeModal();render(true)};

/* ---------- Edit › B-roll: satu kad setiap projek (2026-11-20) ----------
   Semua folder edit, subfolder jadi baris dalam kad. Susunan: perlu swipe, sedang pre-cut, belum pre-cut, siap (dilipat).
   Butang Pre-cut untuk satu subfolder, semua yang belum dalam projek, atau satu folder utama. */
const BR_SKIP=/^(25|27|42)/;
function brProjects(){const P={};const add=(key,stage,name)=>P[key]||(P[key]={key,stage,name,subs:[]});
  const tg=((S.sync.brfolders||{}).p)||{};
  toEditFolders().filter(f=>BR_VO.test(f.stage)).forEach(f=>{const p=add(f.key,f.stage,f.name);(tg[f.key]||(!S.sync.brfolders&&f.clips?[[f.key,'']]:[])).forEach(([rel,sub])=>p.subs.push({rel,sub}))});
  S.broll.forEach(b=>{const k=b.project||String(b.key||'').split('/').slice(0,2).join('/');const p=add(k,b.stage||k.split('/')[0],k.split('/')[1]||k);
    if(!p.subs.some(s=>s.rel===b.key))p.subs.push({rel:b.key,sub:b.key===k?'':String(b.key).split('/').pop()})});
  return Object.values(P).filter(p=>p.subs.length).map(p=>{p.subs.forEach(s=>{s.b=S.broll.find(b=>b.key===s.rel)||null;const b=s.b;
      s.st=!b||b.skip?'belum':b.status==='precut'?'precut':b.status==='backup'?'backup':b.status==='error'?'error':b.status==='stok'?'siap':brLeft(b)>0?'swipe':'semak'});
    const has=k=>p.subs.some(s=>s.st===k);p.rank=has('swipe')||has('semak')||has('error')?0:has('precut')||has('backup')?1:has('belum')?2:3;
    /* 27 Nov: subfolder yang video Editornya masih perlu klip Final (part.broll.need) = belum siap, naik ke "Perlu swipe" */
    const ed=S.editor.find(x=>x.folder===p.key);p.subs.forEach(s=>{s.short=null;edParts(ed).forEach(pt=>{const x=typeof partBr==='function'?partBr(pt):null;if(x&&x.need&&!x.ok&&x.b&&s.b&&x.b.key===s.b.key)s.short={name:pt.name,have:x.have,need:x.need}})});
    if(p.subs.some(s=>s.short))p.rank=0;return p})
   .sort((a,b)=>a.rank-b.rank||String(a.key).localeCompare(String(b.key)))}
function brSubRow(s,c){const b=s.b;const busy=ui.ftBusy&&(ui.ftBusy[s.rel]||(b&&ui.ftBusy[b.id]));const nm=s.sub||'Semua video';
  const pick=b?brPick(b):'';
  const ext=`<a class="btn icon sm" href="${esc(pick)}" target="_blank" rel="noopener" aria-label="Buka dalam Picker" title="Swipe, edit dan Final dalam Picker (Wi-Fi rumah)">${IC.ext}</a>`;
  let txt,col,act='';
  if(s.short){const h=`<div class="brshort"><b>Perlu ${s.short.need-s.short.have} s lagi</b> untuk video ${esc(s.short.name)} (${s.short.have}/${s.short.need} s). Buka Picker, tanda lagi klip Final.</div>`;
    return `<div class="brrow"><div style="flex:1;min-width:0"><strong>${esc(nm)}</strong>${h}</div><a class="btn sm solid tab" href="${esc(pick)}" target="_blank" rel="noopener">${IC.ext}Final lagi</a></div>`}
  if(s.st==='belum'){txt='Belum pre-cut';col='#999';act=`<button class="btn sm" data-act="brStart" data-id="${esc(s.rel)}"${busy?' disabled':''}>${busy?'<i class="spin"></i>':''}Pre-cut</button>`}
  else if(s.st==='precut'){txt='Mac mini sedang potong';col='var(--c)';act=ldr('Pre-cut',b.progress||0)}
  else if(s.st==='backup'){txt='Sedang simpan';col='var(--c)';act=ldr('Simpan')}
  else if(s.st==='error'){txt=String(b.msg||'Ralat').slice(0,50);col='var(--bad)';act=`<button class="btn sm" data-act="brStart" data-id="${esc(s.rel)}">Cuba lagi</button>`}
  else if(s.st==='siap'){txt='✓ '+(b.kept||(b.clips||[]).length||0)+' klip dalam library';col='var(--ok)'}
  else{const [t,cl,pct,run]=brState(b);txt=t;col=cl;if(run)act=ldr('Final',pct)}
  return `<div class="brrow"><div style="flex:1;min-width:0"><strong>${esc(nm)}</strong><span class="meta" style="display:block;color:${col}">${esc(txt)}</span></div>${act}${b&&s.st!=='belum'&&s.st!=='precut'?ext:''}</div>`}
function brProjectsView(){const c=brCfg();const L=brProjects();
  const card=p=>{const belum=p.subs.filter(s=>s.st==='belum').length;const busy=ui.ftBusy&&ui.ftBusy[p.key];const prod=p.subs.some(s=>s.b&&s.b.type==='product');
    return `<div class="card glass"><div class="rowh" style="align-items:center">${fnoBadge(fno(p.stage))}<div style="flex:1;min-width:0"><h3>${esc(p.name)}</h3><div class="meta">${esc(String(p.stage).replace(/^\d+\.\s*/,''))}${p.subs.length>1?' · '+p.subs.length+' folder':''}</div></div></div>
     ${p.subs.map(s=>brSubRow(s,c)).join('')}
     ${belum>1?`<div class="btns" style="margin-top:10px"><button class="btn sm" data-act="brStart" data-id="${esc(p.key)}"${busy?' disabled':''}>${busy?'<i class="spin"></i>':IC.scis||''}Pre-cut semua yang belum · ${belum}</button></div>`:''}
     ${p.subs.map(s=>s.b&&s.st!=='siap'?brShots(s.b):'').join('')}</div>`};
  const mains=[...new Set(L.filter(p=>p.subs.some(s=>s.st==='belum')).map(p=>p.stage))].sort();
  const sec=(t,arr)=>arr.length?`<p class="eyebrow" style="margin:18px 0 8px">${t} · ${arr.length}</p><div class="list">${arr.map(card).join('')}</div>`:'';
  const done=L.filter(p=>p.rank===3);
  return (mains.length?`<div class="card glass"><p class="eyebrow" style="margin:0 0 8px">Pre-cut satu folder utama</p><div class="btns" style="gap:6px">${mains.map(m=>{const busy=ui.ftBusy&&ui.ftBusy['M:'+m];return `<button class="btn sm" data-act="brStartMain" data-id="${esc(m)}"${busy?' disabled':''}>${busy?'<i class="spin"></i>':''}${esc(fno(m))} ${esc(String(m).replace(/^\d+\.\s*/,''))}</button>`}).join('')}</div><p class="meta" style="margin:8px 0 0">Potong semua projek dan subfolder yang belum dalam folder tu. Kod Mac mini, tiada token.</p></div>`:'')+
   sec('Perlu swipe',L.filter(p=>p.rank===0))+sec('Sedang pre-cut',L.filter(p=>p.rank===1))+sec('Belum pre-cut',L.filter(p=>p.rank===2))+
   (done.length?`<details class="col card glass pubgrp" style="margin-top:18px"><summary><div class="rowh" style="align-items:center"><div><p class="eyebrow" style="margin:0">Siap</p><h3>${done.length} projek</h3></div><span class="ic chev">${IC.chev}</span></div></summary><div class="list" style="margin-top:10px">${done.map(card).join('')}</div></details>`:'')+
   (!L.length?'<div class="empty">Tiada folder edit dengan video.</div>':'')}
A.brStartMain=el=>{const stage=el.dataset.id;ui.ftBusy=Object.assign({},ui.ftBusy,{['M:'+stage]:1});render();
  studioJob('broll_start_main',{stage},3*60000).then(r=>toast((r.folders||0)+' folder dihantar untuk pre-cut')).catch(e=>toast('Tak dapat pre-cut: '+String((e&&e.message)||'').slice(0,80)))
   .finally(()=>{const x=Object.assign({},ui.ftBusy);delete x['M:'+stage];ui.ftBusy=x;render()})};
