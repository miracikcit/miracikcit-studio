/* ---------- FOOTAGE (B-roll + klip terbaik, semua lalu kelulusan Mira) ----------
   Semak: B-roll yang Mac mini dah pre-cut (swipe dalam B-Roll Picker, kemudian Dah semak) dan klip terbaik lepas final
   (tanda simpan / buang, kemudian Dah semak). Stok klip: semua klip yang diluluskan, gambar kecil + preview dalam Drive.
   Hard disk: set yang belum pindah ke TOSHIBA. Salinan penuh setiap klip yang diluluskan dibackup ke Drive FOOTAGE/BACKUP. */
const BR_HOME='http://Miras-Mac-Mini.local:8787';
const brCfg=()=>Object.assign({home:BR_HOME,away:''},((S.settings||{}).broll)||{});
const dThumb=id=>id?`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w320`:'';
const dView=id=>'https://drive.google.com/file/d/'+encodeURIComponent(id)+'/view';
const gb=b=>b?(b/1073741824>=1?(b/1073741824).toFixed(1)+' GB':Math.round(b/1048576)+' MB'):'';
const brPending=b=>b&&['precut','ready','backup'].includes(b.status);
const brFor=key=>S.broll.find(b=>b.key===key)||null;
const ftSemak=()=>S.broll.filter(b=>brPending(b)||b.status==='error').length+S.footage.filter(f=>f.status==='semak'||f.status==='backup').length;
function thumbImg(id,extra){return id?`<img src="${esc(dThumb(id))}" alt="" loading="lazy" referrerpolicy="no-referrer"${extra||''}>`:'<span class="noth"></span>'}
V.footage=()=>{const seg=ui.ftSeg||'semak';const n=ftSemak();
  const segs=[['semak','Semak'+(n?' · '+n:'')],['stok','Stok klip'],['disk','Hard disk']];
  return head(n?n+' tunggu semak':'Klip pilihan dan b-roll')+`<div class="seg" style="margin-bottom:14px">${segs.map(([k,l])=>`<button type="button" class="${seg===k?'on':''}" data-act="ftSeg" data-x="${k}">${l}</button>`).join('')}</div>`+
    (seg==='semak'?ftSemakView():seg==='stok'?ftStokView():ftDiskView())};
A.ftSeg=el=>{ui.ftSeg=el.dataset.x;render(true)};
function ftSemakView(){const c=brCfg();
  const brs=S.broll.filter(b=>brPending(b)||b.status==='error').sort((a,b)=>(b.updated||0)-(a.updated||0));
  const best=S.footage.filter(f=>f.status==='semak'||f.status==='backup').sort((a,b)=>(b.updated||0)-(a.updated||0));
  const todo=toEditFolders().filter(f=>!brFor(f.key)&&f.clips&&!/^(29|41)/.test(f.stage));
  const brCard=b=>{const swipe=`${c.home.replace(/\/$/,'')}/?job=${encodeURIComponent(b.job||'')}#swipe`;const busy=ui.ftBusy&&ui.ftBusy[b.id];
    return `<div class="card glass"><div class="rowh" style="align-items:flex-start">${fnoBadge(fno(b.stage))}<div style="flex:1;min-width:0"><h3>${esc(b.name)}</h3><div class="meta"><span class="kchip smp">B-ROLL</span> ${esc(String(b.stage||'').replace(/^\d+\.\s*/,''))}</div></div>
      <span class="pill" style="--pc:${b.status==='ready'?'var(--warn)':b.status==='error'?'var(--bad)':'var(--c)'}">${b.status==='precut'?'Pre-cut '+(b.progress?Math.min(100,Math.round(b.progress))+'%':''):b.status==='backup'?'Simpan…':b.status==='error'?'Ralat':(b.moments||0)+' moment'}</span></div>
     ${(b.thumbs||[]).length?`<div class="fthumbs">${b.thumbs.map(t=>`<span class="fth">${thumbImg(t)}</span>`).join('')}</div>`:''}
     ${b.msg?`<p class="meta" style="margin:8px 0 0">${esc(b.msg)}</p>`:''}
     ${b.status==='ready'?`<p class="meta" style="margin:8px 0 0">${b.seen?`Dah swipe ${b.seen} / ${b.moments||0} · keep ${b.kept||0}`:'Belum swipe'}</p>
     <div class="btns" style="margin-top:10px"><a class="btn sm solid tab" href="${esc(swipe)}" target="_blank" rel="noopener">▶ Swipe (Wi-Fi rumah)</a>${isUrl(c.away)?`<a class="btn sm" href="${esc(c.away.replace(/\/$/,'')+'/?job='+encodeURIComponent(b.job||'')+'#swipe')}" target="_blank" rel="noopener">${IC.ext}Travel</a>`:''}<span style="flex:1"></span><button class="btn sm" data-act="brDone" data-id="${esc(b.id)}"${busy||!b.kept?' disabled':''}>${busy?'<i class="spin"></i>':IC.check}Dah semak</button></div>`:''}
     ${b.status==='error'?`<div class="btns" style="margin-top:10px"><button class="btn sm" data-act="brStart" data-id="${esc(b.key)}">Cuba pre-cut semula</button></div>`:''}</div>`};
  const bestCard=f=>{const drop=(ui.ftDrop&&ui.ftDrop[f.id])||new Set(f.drop||[]);const busy=f.status==='backup'||(ui.ftBusy&&ui.ftBusy[f.id]);
    return `<div class="card glass"><div class="rowh" style="align-items:flex-start"><div style="flex:1;min-width:0"><h3>${esc(f.name)}</h3><div class="meta"><span class="kchip paid">KLIP TERBAIK</span> ${esc(f.folder||'')}</div></div><span class="pill" style="--pc:var(--warn)">${(f.files||[]).length} klip</span></div>
     <p class="meta" style="margin:8px 0 0">Cadangan Claude lepas final. Tekan gambar untuk buang / simpan, ▶ untuk tengok preview.</p>
     <div class="fthumbs big">${(f.files||[]).map(x=>`<span class="fth${drop.has(x.name)?' off':''}"><button type="button" data-act="ftTog" data-id="${esc(f.id)}" data-x="${esc(x.name)}" aria-pressed="${!drop.has(x.name)}" aria-label="${esc(x.name)}">${thumbImg(x.thumb)}<i>${drop.has(x.name)?'✕':'✓'}</i></button>${x.prev?`<a href="${esc(dView(x.prev))}" target="_blank" rel="noopener" class="fplay" aria-label="Preview">▶</a>`:''}<em>${esc(x.kind||'')}</em></span>`).join('')}</div>
     ${f.msg?`<p class="meta" style="margin:8px 0 0">${esc(f.msg)}</p>`:''}
     <div class="btns" style="margin-top:10px;justify-content:flex-end"><button class="btn sm solid tab" data-act="bestDone" data-id="${esc(f.id)}"${busy?' disabled':''}>${busy?'<i class="spin"></i>Simpan…':IC.check+'Dah semak · simpan '+((f.files||[]).length-drop.size)}</button></div></div>`};
  return `<div class="list">${brs.map(brCard).join('')}${best.map(bestCard).join('')}</div>${!brs.length&&!best.length?`<div class="empty">Tiada yang tunggu semak. Footage baru dalam folder edit di-pre-cut sendiri oleh Mac mini.</div>`:''}
   ${todo.length?`<p class="eyebrow" style="margin-top:20px">Folder edit lama, belum pre-cut · ${todo.length}</p><div class="list">${todo.map(f=>`<div class="card glass"><div class="rowh" style="align-items:center">${fnoBadge(fno(f.stage))}<div style="flex:1;min-width:0"><h3>${esc(f.name)}</h3><div class="meta">${f.clips} klip</div></div><button class="btn sm" data-act="brStart" data-id="${esc(f.key)}"${ui.ftBusy&&ui.ftBusy[f.key]?' disabled':''}>Pre-cut</button></div></div>`).join('')}</div>`:''}
   <details class="col card glass" style="margin-top:20px"><summary><div class="rowh" style="align-items:center"><div><p class="eyebrow" style="margin:0">Alamat B-Roll Picker</p><span class="meta">Swipe perlu Wi-Fi rumah, atau Tailscale masa travel</span></div><span class="ic chev">${IC.chev}</span></div></summary>
    <label class="f" style="margin-top:12px"><span>Di rumah</span><input class="inp" id="brHome" value="${esc(c.home)}" inputmode="url" autocapitalize="off"></label>
    <label class="f"><span>Masa travel (Tailscale, pilihan)</span><input class="inp" id="brAway" value="${esc(c.away)}" placeholder="http://miras-mac-mini:8787" inputmode="url" autocapitalize="off"></label>
    <button class="btn solid tab" data-act="brSave">Simpan</button></details>`}
/* Stok klip: semua yang diluluskan (B-roll + klip terbaik) */
function ftClips(){const out=[];
  S.broll.filter(b=>b.status==='stok').forEach(b=>(b.clips||[]).forEach(x=>out.push({set:b.name,src:'B-roll',tags:(x.labels||[]).map(s=>s.toLowerCase()),thumb:x.thumb,prev:x.prev,name:x.name,len:x.len,date:b.updated})));
  S.footage.filter(f=>f.status==='stok').forEach(f=>(f.files||[]).forEach(x=>out.push({set:f.name,src:'Klip terbaik',tags:[x.kind,f.product].concat(f.tags||[]).filter(Boolean).map(s=>String(s).toLowerCase()),thumb:x.thumb,prev:x.prev,name:x.name,date:f.updated})));
  return out.sort((a,b)=>(b.date||0)-(a.date||0))}
function ftStokView(){const all=ftClips();const tags=[...new Set(all.flatMap(c=>c.tags))].slice(0,24);
  const list=all.filter(c=>hit('ft',c.set,c.name,c.tags.join(' '))&&(!ui.ftTag||c.tags.includes(ui.ftTag)));
  return searchBox('ft','Cari produk, video atau jenis shot')+(tags.length?`<div class="btns" style="margin-bottom:14px;gap:6px"><button class="btn sm ${!ui.ftTag?'solid tab':''}" data-act="ftTag" data-x="">Semua</button>${tags.map(t=>`<button class="btn sm ${ui.ftTag===t?'solid tab':''}" data-act="ftTag" data-x="${esc(t)}">${esc(t)}</button>`).join('')}</div>`:'')+
  (list.length?`<div class="fgrid">${list.map(c=>`<a class="fcell" ${c.prev?`href="${esc(dView(c.prev))}" target="_blank" rel="noopener"`:''}>${thumbImg(c.thumb)}<span><b>${esc(c.set)}</b>${esc([c.src,c.len?c.len+' s':'',c.tags[0]||''].filter(Boolean).join(' · '))}</span></a>`).join('')}</div>`:`<div class="empty">${all.length?'Tiada padanan.':'Belum ada klip diluluskan. Semak B-roll atau klip terbaik dulu.'}</div>`)}
A.ftTag=el=>{ui.ftTag=el.dataset.x||null;render(true)};
/* Hard disk: set yang belum pindah ke TOSHIBA (semua dah ada backup penuh dalam Drive) */
function ftDiskView(){const sets=S.broll.filter(b=>b.status==='stok').map(b=>({col:'broll',o:b,name:b.name,where:b.lib||'~/Movies/B-ROLL LIBRARY',size:b.size,n:(b.clips||[]).length}))
   .concat(S.footage.filter(f=>f.status==='stok'||!f.status).map(f=>({col:'footage',o:f,name:f.name,where:f.folder||'',size:f.size,n:(f.files||[]).length||+f.clips||0})));
  const left=sets.filter(s=>!s.o.moved),done=sets.filter(s=>s.o.moved);const tot=left.reduce((a,s)=>a+(s.size||0),0);
  const row=s=>`<div class="card glass"><div class="rowh" style="align-items:flex-start"><div style="flex:1;min-width:0"><h3>${esc(s.name)}</h3><div class="meta">${esc([s.n+' klip',gb(s.size),s.where].filter(Boolean).join(' · '))}</div></div>${s.o.backedUp?`<span class="pill" style="--pc:var(--ok)">${IC.check}Backup Drive</span>`:''}</div>
    <div style="margin-top:10px">${chk(s.o.moved,'ftMoved',s.o.id,'Dah pindah ke TOSHIBA',s.col)}</div>
    <label class="f" style="margin:8px 0 0"><span>Lokasi dalam TOSHIBA EXT</span><input class="inp" id="fl-${esc(s.o.id)}" data-col="${s.col}" data-id="${esc(s.o.id)}" data-f="location" value="${esc(s.o.location||'')}" placeholder="cth. B-ROLL/2026/${esc(s.name)}"></label></div>`;
  return `<p class="meta" style="margin:0 0 12px">${left.length} set belum pindah${tot?' · '+gb(tot):''}. Semua klip yang diluluskan dah ada salinan penuh dalam Google Drive (FOOTAGE / BACKUP).</p><div class="list">${left.map(row).join('')||'<div class="empty">Semua dah dipindah.</div>'}</div>
   ${done.length?`<details class="col card glass pubgrp" style="margin-top:14px"><summary><div class="rowh" style="align-items:center"><div><p class="eyebrow" style="margin:0">Dah dipindah</p><h3>${done.length} set</h3></div><span class="ic chev">${IC.chev}</span></div></summary><div class="list" style="margin-top:10px">${done.map(row).join('')}</div></details>`:''}`}
A.ftMoved=el=>{const col=el.dataset.x||'footage';const o=get(col,el.dataset.id);save(col,Object.assign({},o,{moved:!o.moved,movedAt:Date.now()}))};
A.ftTog=el=>{const f=get('footage',el.dataset.id);ui.ftDrop=ui.ftDrop||{};const s=ui.ftDrop[f.id]||(ui.ftDrop[f.id]=new Set(f.drop||[]));const k=el.dataset.x;s.has(k)?s.delete(k):s.add(k);render(true)};
A.bestDone=el=>{const f=get('footage',el.dataset.id);const drop=[...((ui.ftDrop&&ui.ftDrop[f.id])||new Set())];const name=String(f.folder||'').split('/').pop();
  const go2=async()=>{ui.ftBusy=Object.assign({},ui.ftBusy,{[f.id]:1});render();
    try{const r=await studioJob('best_done',{name,drop},5*60000);toast((r.trashed?r.trashed+' klip ke Trash. ':'')+'Klip disimpan, sedang backup ke Drive')}
    catch(e){toast('Tak berjaya: '+String((e&&e.message)||'semak Mac mini hidup').slice(0,80))}
    finally{const b=Object.assign({},ui.ftBusy);delete b[f.id];ui.ftBusy=b;render()}};
  if(drop.length)confirmBox('Buang '+drop.length+' klip ke Trash Mac dan simpan '+((f.files||[]).length-drop.length)+'?',go2,'Ya, teruskan');else go2()};
A.brDone=el=>{const b=get('broll',el.dataset.id);ui.ftBusy=Object.assign({},ui.ftBusy,{[b.id]:1});render();
  studioJob('broll_done',{key:b.key},3*60000).then(()=>toast(b.kept+' klip disimpan ke B-ROLL LIBRARY, sedang backup ke Drive')).catch(e=>toast('Tak berjaya: '+String((e&&e.message)||'semak Mac mini hidup').slice(0,80)))
   .finally(()=>{const x=Object.assign({},ui.ftBusy);delete x[b.id];ui.ftBusy=x;render()})};
A.brStart=el=>{const key=el.dataset.id;ui.ftBusy=Object.assign({},ui.ftBusy,{[key]:1});render();
  studioJob('broll_start',{key},3*60000).then(()=>toast('Pre-cut dimulakan. Siap dalam beberapa minit')).catch(e=>toast('Tak dapat pre-cut: '+String((e&&e.message)||'').slice(0,80)))
   .finally(()=>{const x=Object.assign({},ui.ftBusy);delete x[key];ui.ftBusy=x;render()})};
A.brSave=()=>{const h=$('#brHome').value.trim()||BR_HOME,a=$('#brAway').value.trim();if(!/^https?:\/\//i.test(h)||(a&&!/^https?:\/\//i.test(a))){toast('Alamat mesti mula dengan http://');return}saveSettings({broll:{home:h,away:a}});render(true);toast('Disimpan')};
