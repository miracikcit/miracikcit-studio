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
V.footage=()=>{const seg=ui.ftSeg==='disk'?'disk':'stok';
  const segs=[['stok','Stok klip'],['disk','Lokasi & ruang']];
  return head('Library klip',`<button class="btn sm" data-act="go" data-id="to-edit">${IC.back||'←'} Edit</button>`)+ftNotes()+`<div class="seg" style="margin-bottom:14px">${segs.map(([k,l])=>`<button type="button" class="${seg===k?'on':''}" data-act="ftSeg" data-x="${k}">${l}</button>`).join('')}</div>`+
    (seg==='stok'?ftStokView():ftDiskView())};
A.ftSeg=el=>{ui.ftSeg=el.dataset.x;render(true)};
function ftSemakView(){const c=brCfg();
  const brs=S.broll.filter(b=>brPending(b)||b.status==='error').sort((a,b)=>(b.updated||0)-(a.updated||0));
  const best=S.footage.filter(f=>f.status==='semak'||f.status==='backup').sort((a,b)=>(b.updated||0)-(a.updated||0));
  const todo=toEditFolders().filter(f=>!brsFor(f.key).length&&f.clips&&BR_VO.test(f.stage));
  const bestCard=f=>{const drop=(ui.ftDrop&&ui.ftDrop[f.id])||new Set(f.drop||[]);const busy=f.status==='backup'||(ui.ftBusy&&ui.ftBusy[f.id]);
    return `<div class="card glass"><div class="rowh" style="align-items:flex-start"><div style="flex:1;min-width:0"><h3>${esc(f.name)}</h3><div class="meta"><span class="kchip paid">KLIP TERBAIK</span> ${esc(f.folder||'')}</div></div><span class="pill" style="--pc:var(--warn)">${(f.files||[]).length} klip</span></div>
     <p class="meta" style="margin:8px 0 0">Cadangan Claude lepas final. Tekan gambar untuk buang / simpan, ▶ untuk tengok preview.</p>
     <div class="fthumbs big">${(f.files||[]).map(x=>`<span class="fth${drop.has(x.name)?' off':''}"><button type="button" data-act="ftTog" data-id="${esc(f.id)}" data-x="${esc(x.name)}" aria-pressed="${!drop.has(x.name)}" aria-label="${esc(x.name)}">${thumbImg(x.thumb)}<i>${drop.has(x.name)?'✕':'✓'}</i></button>${x.prev?`<a href="${esc(dView(x.prev))}" target="_blank" rel="noopener" class="fplay" aria-label="Preview">▶</a>`:''}<em>${esc(x.kind||'')}</em></span>`).join('')}</div>
     ${f.msg?`<p class="meta" style="margin:8px 0 0">${esc(f.msg)}</p>`:''}
     <div class="btns" style="margin-top:10px;justify-content:flex-end"><button class="btn sm solid tab" data-act="bestDone" data-id="${esc(f.id)}"${busy?' disabled':''}>${busy?'<i class="spin"></i>Simpan…':IC.check+'Dah semak · simpan '+((f.files||[]).length-drop.size)}</button></div></div>`};
  return `<div class="banner glass" style="margin-bottom:12px">B-roll untuk folder 29. VLOG BATCH sahaja</div>`+brProjectsView()+(best.length?`<p class="eyebrow" style="margin:18px 0 8px">Klip terbaik lepas final · ${best.length}</p><div class="list">${best.map(bestCard).join('')}</div>`:'')+`
   <details class="col card glass" style="margin-top:20px"><summary><div class="rowh" style="align-items:center"><div><p class="eyebrow" style="margin:0">Alamat B-Roll Picker</p><span class="meta">Swipe perlu Wi-Fi rumah, atau Tailscale masa travel</span></div><span class="ic chev">${IC.chev}</span></div></summary>
    <label class="f" style="margin-top:12px"><span>Di rumah</span><input class="inp" id="brHome" value="${esc(c.home)}" inputmode="url" autocapitalize="off"></label>
    <label class="f"><span>Masa travel (Tailscale, pilihan)</span><input class="inp" id="brAway" value="${esc(c.away)}" placeholder="http://miras-mac-mini:8787" inputmode="url" autocapitalize="off"></label>
    <button class="btn solid tab" data-act="brSave">Simpan</button></details>`}
/* Stok klip: semua yang diluluskan (B-roll + klip terbaik) */
function ftClips(){const out=[];const seen=new Set();
  (S.brlib||[]).forEach(d=>(d.clips||[]).forEach(x=>{seen.add(x.f);out.push({set:d.place,src:'B-roll Final',tags:(x.tag||[]).map(t=>String(t).toLowerCase()),thumb:x.drive,prev:x.drive,name:x.f,len:x.len,date:Date.parse(x.final||'')||0,lib:d.id,k:x.k,raw:x.tag||[],x})}));
  S.broll.filter(b=>b.status==='stok').forEach(b=>(b.clips||[]).filter(x=>!seen.has(x.name)).forEach(x=>out.push({set:b.name,src:'B-roll',tags:(x.labels||[]).map(s=>s.toLowerCase()),thumb:x.thumb,prev:x.prev,name:x.name,len:x.len,date:b.updated})));
  S.footage.filter(f=>f.status==='stok').forEach(f=>(f.files||[]).forEach(x=>out.push({set:f.name,src:'Klip terbaik',tags:[x.kind,f.product].concat(f.tags||[]).filter(Boolean).map(s=>String(s).toLowerCase()),thumb:x.thumb,prev:x.prev,name:x.name,date:f.updated})));
  return out.sort((a,b)=>(b.date||0)-(a.date||0))}
function ftStokView(){const all=ftClips();const tags=[...new Set(all.flatMap(c=>c.tags))].slice(0,24);
  const list=all.filter(c=>hit('ft',c.set,c.name,c.tags.join(' '))&&(!ui.ftTag||c.tags.includes(ui.ftTag)));
  return searchBox('ft','Cari produk, video atau jenis shot')+(tags.length?`<div class="btns" style="margin-bottom:14px;gap:6px"><button class="btn sm ${!ui.ftTag?'solid tab':''}" data-act="ftTag" data-x="">Semua</button>${tags.map(t=>`<button class="btn sm ${ui.ftTag===t?'solid tab':''}" data-act="ftTag" data-x="${esc(t)}">${esc(t)}</button>`).join('')}</div>`:'')+
  (list.length?`<div class="fgrid">${list.map(c=>c.k?`<button type="button" class="fcell" data-act="ftClip" data-id="${esc(c.lib)}" data-x="${esc(c.k)}">${thumbImg(c.thumb)}<span><b>${esc(c.set)}</b>${esc([c.len?c.len+' s':'',c.raw.slice(0,2).join(', ')].filter(Boolean).join(' · '))}</span></button>`:`<a class="fcell" ${c.prev?`href="${esc(dView(c.prev))}" target="_blank" rel="noopener"`:''}>${thumbImg(c.thumb)}<span><b>${esc(c.set)}</b>${esc([c.src,c.len?c.len+' s':'',c.tags[0]||''].filter(Boolean).join(' · '))}</span></a>`).join('')}</div>`:`<div class="empty">${all.length?'Tiada padanan.':'Belum ada klip diluluskan. Semak B-roll atau klip terbaik dulu.'}</div>`)}
A.ftTag=el=>{ui.ftTag=el.dataset.x||null;render(true)};
/* 23 Nov: nota lokasi + % ruang (Mac, hard disk PERTAMA, Google Drive). Data dari doc sync/storage (Mac mini, setiap 10 minit). */
function ftMeter(name,o){if(!o||!o.total)return '';const pct=o.pct!=null?o.pct:Math.round(o.used/o.total*100);const col=pct>85?'var(--bad)':pct>70?'var(--warn)':'var(--ok)';
  return `<div style="--sc:${col};margin-top:8px"><div class="trk"><div class="t"><span>${esc(name)}</span><span>${pct}% · ${gb(o.used)} / ${gb(o.total)}</span></div></div><div class="bar"><i style="width:${pct}%"></i></div></div>`}
function ftNotes(){const st=S.sync.storage;if(!st)return `<div class="card glass"><p class="meta" style="margin:0">Mac mini belum hantar maklumat ruang. Tunggu beberapa minit.</p></div>`;
  const m=st.mac||{},d=st.disk||{},g=st.drive||{},cp=st.copy||{};
  return `<div class="card glass"><p class="eyebrow" style="margin:0 0 4px">Mana klip disimpan ${tok(0)}</p>
   <p class="meta" style="margin:0"><b>Mac:</b> ${esc(m.path||'~/Movies/B-ROLL LIBRARY')} (${gb(m.lib)||'0 MB'}) · klip Final ${st.keepDays||30} hari, kemudian Mac buang ke Trash</p>${ftMeter('Mac mini',m)}
   <p class="meta" style="margin:10px 0 0"><b>Hard disk:</b> ${esc(d.path||'PERTAMA')} ${d.mounted?'':'· <span style="color:var(--warn)">tak bersambung</span>'}</p>${ftMeter('PERTAMA',d)}
   ${cp.running?`<div style="margin-top:8px">${ldr(cp.msg||'Salin ke PERTAMA',cp.total?cp.done/cp.total*100:0)}</div>`:''}
   <p class="meta" style="margin:10px 0 0"><b>Google Drive:</b> ${esc(g.path||'')} (${gb(g.lib)||'0 MB'})</p>${g.total?ftMeter('Google Drive',g):`<p class="meta" style="margin:2px 0 0;font-size:11px">% Drive keluar lepas Apps Script dikemaskini.</p>`}
   <p class="meta" style="margin:8px 0 0;font-size:11px">Studio tunjuk preview sahaja. Fail sebenar: tekan klip, kemudian Buka fail sebenar.</p></div>`}
/* Lokasi: senarai ikut susunan folder dalam hard disk (dan Drive). Mac salin sendiri ke PERTAMA bila bersambung. */
function ftDiskView(){const st=S.sync.storage||{};const root=((st.disk||{}).path)||'PERTAMA/MIRA/WORK ARCHIVE/WORK 2026';
  const libs=(S.brlib||[]).slice().sort((a,b)=>String(a.place).localeCompare(String(b.place)));
  const chip=(on,t)=>`<span class="pill" style="--pc:${on?'var(--ok)':'#999'}">${on?IC.check:''}${t}</span>`;
  /* folder ikut Mac (doc storage.tree); kiraan Drive dari brlib, klip lama dari set B-roll yang dibackup */
  const folders=(st.tree||[]).map(t=>{const d=libs.find(x=>x.place===t.name)||(S.brlib||[]).find(x=>x.place===String(t.name).replace(/^\d{1,3}[ ._-]+/,''));
    const old=S.broll.find(b=>b.status==='stok'&&String(b.lib||'').endsWith('/'+t.name));
    return {place:t.name,n:t.n,mac:t.mac,disk:t.disk,size:t.size,drive:d?(d.clips||[]).filter(x=>x.drive).length:old&&old.backedUp?t.n:0,driveFolder:d&&d.driveFolder}});
  libs.filter(d=>!folders.some(f=>f.place===d.place)).forEach(d=>{const cl=d.clips||[];folders.push({place:d.place,n:cl.length,mac:cl.filter(x=>x.mac).length,disk:cl.filter(x=>x.disk).length,size:cl.reduce((a,x)=>a+(x.size||0),0),drive:cl.filter(x=>x.drive).length,driveFolder:d.driveFolder})});
  const place=d=>{return `<div class="brrow"><div style="flex:1;min-width:0"><strong>📁 ${esc(d.place)}</strong><span class="meta" style="display:block">${d.n} klip · ${gb(d.size)}</span>
      <div class="btns" style="gap:4px;margin-top:4px">${chip(d.mac>=d.n,'Mac '+d.mac)}${chip(d.disk>=d.n,'PERTAMA '+d.disk)}${chip(d.drive>=d.n,'Drive '+d.drive)}</div></div>
      ${d.driveFolder?`<a class="btn icon sm" href="https://drive.google.com/drive/folders/${encodeURIComponent(d.driveFolder)}" target="_blank" rel="noopener" aria-label="Buka folder Drive" title="Buka folder dalam Google Drive">${IC.ext}</a>`:''}</div>`};
  const best=S.footage.filter(f=>(f.status==='stok'||!f.status)&&((f.files||[]).length||+f.clips));
  return `<div class="card glass"><p class="eyebrow" style="margin:0">📂 ${esc(root)}</p>
    <p class="meta" style="margin:8px 0 0"><b>B-ROLL LIBRARY</b> (sama dalam Mac, PERTAMA dan Drive)</p>
    ${folders.map(place).join('')||'<p class="meta">Belum ada klip Final.</p>'}
    ${best.length?`<p class="meta" style="margin:14px 0 0"><b>KLIP TERBAIK</b></p>${best.map(f=>`<div class="brrow"><div style="flex:1;min-width:0"><strong>📁 ${esc(f.name)}</strong><span class="meta" style="display:block">${(f.files||[]).length||+f.clips||0} klip · ${gb(f.size)}</span></div>${f.backedUp?chip(true,'Drive'):''}</div>`).join('')}`:''}
    <p class="meta" style="margin:12px 0 0;font-size:11px">Mac salin sendiri ke PERTAMA setiap kali hard disk disambung. Tiada apa perlu ditick.</p></div>`}
/* Satu klip Final: preview, buka fail sebenar, ubah tag (tambah / buang) */
A.ftClip=el=>{const d=(S.brlib||[]).find(x=>x.id===el.dataset.id);const x=d&&(d.clips||[]).find(c=>c.k===el.dataset.x);if(!x)return;
  ui.ftEd={lib:d.id,k:x.k,tag:(x.tag||[]).slice()};ftClipDraw()};
function ftClipDraw(){const e=ui.ftEd;const d=(S.brlib||[]).find(x=>x.id===e.lib);const x=d&&(d.clips||[]).find(c=>c.k===e.k);if(!x){closeModal();return}
  const busy=e.busy;const changed=JSON.stringify(e.tag)!==JSON.stringify(x.tag||[]);
  modal(`<div class="rowh" style="align-items:center;margin-bottom:8px"><button class="btn icon sm" data-act="closeModal" aria-label="Kembali">${IC.back}</button><h2 style="margin:0;flex:1;min-width:0;font-size:15px">${esc(x.f)}</h2></div>
   <div class="brcard">${x.drive?`<iframe src="https://drive.google.com/file/d/${encodeURIComponent(x.drive)}/preview" allow="autoplay" title="Preview"></iframe>`:'<div class="empty">Belum ada dalam Drive</div>'}</div>
   <p class="meta" style="margin:8px 0 0">${esc([d.place,x.len+' s',x.sp&&x.sp!==1?x.sp+'×':'',x.shot,'dari '+x.raw].filter(Boolean).join(' · '))}</p>
   <div class="btns" style="margin-top:8px">${x.drive?`<a class="btn sm" href="${esc(dView(x.drive))}" target="_blank" rel="noopener">${IC.ext}Buka fail sebenar</a>`:''}</div>
   <p class="eyebrow" style="margin:16px 0 6px">Tag</p>
   <div class="btns" style="gap:6px">${e.tag.map((t,i)=>`<button type="button" class="btn sm" data-act="ftTagDel" data-x="${i}" aria-label="Buang tag ${esc(t)}">${esc(t)} ✕</button>`).join('')||'<span class="meta">Tiada tag</span>'}</div>
   <div class="btns" style="margin-top:8px;gap:6px"><input class="inp" id="ftNewTag" placeholder="Tag baru, cth. kanak-kanak" style="flex:1;min-width:0" autocapitalize="off"><button class="btn sm" data-act="ftTagAdd">${IC.plus||'+'}Tambah</button></div>
   <p class="meta" style="margin:6px 0 0;font-size:11px">Claude cari klip ikut tag ni masa padankan dengan VO. ${tok(0)}</p>
   <div class="btns" style="margin-top:14px;justify-content:space-between"><button class="btn" data-act="closeModal">${IC.back} Kembali</button><button class="btn solid tab" data-act="ftTagSave"${busy||!changed?' disabled':''}>${busy?'<i class="spin"></i>Simpan…':'Simpan tag'}</button></div>`);
  const inp=$('#ftNewTag');if(inp)inp.onkeydown=ev=>{if(ev.key==='Enter'){ev.preventDefault();A.ftTagAdd()}}}
A.ftTagDel=el=>{ui.ftEd.tag.splice(+el.dataset.x,1);ftClipDraw()};
A.ftTagAdd=()=>{const v=($('#ftNewTag')||{}).value||'';v.split(',').map(t=>t.trim()).filter(Boolean).forEach(t=>{if(!ui.ftEd.tag.some(x=>x.toLowerCase()===t.toLowerCase()))ui.ftEd.tag.push(t)});ftClipDraw();setTimeout(()=>{const i=$('#ftNewTag');if(i)i.focus()},0)};
A.ftTagSave=async()=>{const e=ui.ftEd;e.busy=true;ftClipDraw();
  try{await studioJob('brtag',{k:e.k,tag:e.tag},2*60000);toast('Tag disimpan. Sheet B-ROLL INDEX ikut dalam seminit');closeModal()}
  catch(err){e.busy=false;ftClipDraw();toast('Tak berjaya: '+String((err&&err.message)||'semak Mac mini hidup').slice(0,80))}};
A.ftMoved=el=>{const col=el.dataset.x||'footage';const o=get(col,el.dataset.id);save(col,Object.assign({},o,{moved:!o.moved,movedAt:Date.now()}))};
A.ftTog=el=>{const f=get('footage',el.dataset.id);ui.ftDrop=ui.ftDrop||{};const s=ui.ftDrop[f.id]||(ui.ftDrop[f.id]=new Set(f.drop||[]));const k=el.dataset.x;s.has(k)?s.delete(k):s.add(k);render(true)};
A.bestDone=el=>{const f=get('footage',el.dataset.id);const drop=[...((ui.ftDrop&&ui.ftDrop[f.id])||new Set())];const name=String(f.folder||'').split('/').pop();
  const go2=async()=>{ui.ftBusy=Object.assign({},ui.ftBusy,{[f.id]:1});render();
    try{const r=await studioJob('best_done',{name,drop},5*60000);toast((r.trashed?r.trashed+' klip ke Trash. ':'')+'Klip disimpan, sedang backup ke Drive')}
    catch(e){toast('Tak berjaya: '+String((e&&e.message)||'semak Mac mini hidup').slice(0,80))}
    finally{const b=Object.assign({},ui.ftBusy);delete b[f.id];ui.ftBusy=b;render()}};
  if(drop.length)confirmBox('Buang '+drop.length+' klip ke Trash Mac dan simpan '+((f.files||[]).length-drop.length)+'?',go2,'Ya, teruskan');else go2()};
A.brDone=el=>{const b=get('broll',el.dataset.id);ui.ftBusy=Object.assign({},ui.ftBusy,{[b.id]:1});render();
  studioJob('broll_done',{key:b.key},3*60000).then(()=>toast((b.kept||brLocalKeeps(b))+' klip disimpan ke B-ROLL LIBRARY, sedang backup ke Drive')).catch(e=>toast('Tak berjaya: '+String((e&&e.message)||'semak Mac mini hidup').slice(0,80)))
   .finally(()=>{const x=Object.assign({},ui.ftBusy);delete x[b.id];ui.ftBusy=x;render()})};
A.brStart=el=>{const key=el.dataset.id;ui.ftBusy=Object.assign({},ui.ftBusy,{[key]:1});render();
  studioJob('broll_start',{key},3*60000).then(()=>toast('Pre-cut dimulakan. Siap dalam beberapa minit')).catch(e=>toast('Tak dapat pre-cut: '+String((e&&e.message)||'').slice(0,80)))
   .finally(()=>{const x=Object.assign({},ui.ftBusy);delete x[key];ui.ftBusy=x;render()})};
A.brSave=()=>{const h=$('#brHome').value.trim()||BR_HOME,a=$('#brAway').value.trim();if(!/^https?:\/\//i.test(h)||(a&&!/^https?:\/\//i.test(a))){toast('Alamat mesti mula dengan http://');return}saveSettings({broll:{home:h,away:a}});render(true);toast('Disimpan')};
