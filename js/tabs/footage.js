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
function thumbImg(id,extra){return id?`<img src="${esc(dThumb(id))}" alt="" loading="lazy" referrerpolicy="no-referrer"${extra||''}>`:'<span class="noth"></span>'}
V.footage=()=>{const seg=['stok','disk'].includes(ui.ftSeg)?ui.ftSeg:'all';   /* 28 Nov: Semua footage jadi utama */
  const segs=[['all','Semua footage'],['disk','B-roll & ruang'],['stok','Stok klip']];
  return head('Footage library',`<button class="btn sm" data-act="go" data-id="to-edit">${IC.back||'←'} Edit</button>`)+`<div class="seg" style="margin-bottom:14px;max-width:100%;overflow-x:auto">${segs.map(([k,l])=>`<button type="button" class="${seg===k?'on':''}" data-act="ftSeg" data-x="${k}" style="white-space:nowrap">${l}</button>`).join('')}</div>`+
    (seg==='stok'?ftNotes()+ftStokView():seg==='disk'?ftNotes()+ftDiskView():ftAllView())};
A.ftSeg=el=>{ui.ftSeg=el.dataset.x;render(true)};
/* 28 Nov (Mira): "senang aku tengok kedudukan footage aku sekarang". Satu senarai SEMUA footage dalam Mac + PERTAMA:
   di mana (Mac sahaja / Mac + PERTAMA / PERTAMA sahaja) dan status (Dalam edit / Belum published / Published, dibuang dalam N hari).
   Data: doc sync/footinv (rawfoot.inventory, Mac mini setiap 10 minit, 0 token) + sync/rawfoot + sync/storage. */
function ftAllRows(){const I=S.sync.footinv||{},F=((S.sync.rawfoot||{}).folders)||{},st=S.sync.storage||{};
  let live=new Set();try{live=new Set(toEditFolders().map(f=>f.key))}catch(e){}
  const out=(I.rows||[]).map(r=>{const raw=F[r.key];const where=r.n===0?'hd':r.disk==null?'mac':r.disk>=r.n?'both':r.disk>0?'part':'mac';
    let stat='',col='#999';
    if(r.kind==='final'){stat='Video siap (final)';col='var(--ok)'}
    else if(r.kind==='raw'){stat='Folder RAW · tiada salinan auto';col='var(--warn)'}
    else if(r.kind==='best'){stat='Klip terbaik';col='var(--ok)'}
    else if(raw&&raw.state==='hdonly'||where==='hd'){stat='Dah dibuang dari Mac';col='#999'}
    else if(raw&&raw.state==='wait'){stat='Published · menunggu salin';col='var(--warn)'}
    else if(raw&&raw.state==='hd'){stat=raw.hold?'Published · masih diguna':'Published · keluar dari Mac dalam '+raw.left+' hari';col=raw.hold?'#5A8FB5':raw.left<=5?'var(--bad)':'var(--ok)'}
    else if(live.has(r.key)){stat='Dalam edit';col='#8676BE'}
    else{stat='Belum published';col='#B0937B'}
    return Object.assign({},r,{where,stat,col,size:r.size||0,hdSize:r.n===0?(r.diskSize||0):where==='both'?r.size:0,raw})});
  const tr=st.tree||[];if(tr.length){const n=tr.reduce((a,t)=>a+(t.n||0),0),mac=tr.reduce((a,t)=>a+(t.mac||0),0),disk=tr.reduce((a,t)=>a+(t.disk||0),0),size=tr.reduce((a,t)=>a+(t.size||0),0);
    const where=!mac?'hd':disk>=n?'both':disk>0?'part':'mac';
    out.push({key:'lib',main:'Movies',name:'B-ROLL LIBRARY',kind:'lib',n:mac,disk,size:mac?size:0,hdSize:disk>=n?size:0,where,stat:'Klip B-roll Final · '+tr.length+' tempat',col:'var(--ok)'})}
  return out}
function ftAllView(){const I=S.sync.footinv;if(!I)return `<div class="card glass"><p class="meta" style="margin:0">Mac mini belum hantar senarai footage. Tunggu 10 minit (Mac mini mesti hidup).</p></div>`;
  const rows=ftAllRows(),st=S.sync.storage||{},m=st.mac||{},d=st.disk||{};
  const sum=f=>rows.filter(f).reduce((a,r)=>a+r.size,0);
  const onMac=sum(r=>r.n>0),safe=sum(r=>r.where==='both'),only=sum(r=>r.n>0&&r.where!=='both');
  const hdOnly=rows.filter(r=>r.where==='hd').reduce((a,r)=>a+(r.hdSize||0),0);
  const fl=['mac','both','hd'].includes(ui.ftAll)?ui.ftAll:'semua';
  const pick=rows.filter(r=>fl==='semua'||(fl==='mac'?r.n>0&&r.where!=='both':r.where===fl)).sort((a,b)=>(b.size||b.hdSize)-(a.size||a.hdSize));
  const W={mac:['Mac sahaja','var(--warn)'],part:['Mac · PERTAMA sebahagian','var(--warn)'],both:['Mac + PERTAMA','#5A8FB5'],hd:['PERTAMA sahaja','#999']};
  const pill=(t,c)=>`<span class="pill" style="--pc:${c}">${t}</span>`;
  const bar=onMac?`<div style="display:flex;height:10px;border-radius:99px;overflow:hidden;margin-top:10px;background:var(--line)"><i style="width:${safe/onMac*100}%;background:#5A8FB5"></i><i style="width:${only/onMac*100}%;background:var(--warn)"></i></div>`:'';
  const ago=t=>{const s=Math.round((Date.now()-t)/60000);return s<2?'baru tadi':s<60?s+' minit lepas':Math.round(s/60)+' jam lepas'};
  const row=r=>{const [wt,wc]=W[r.where]||W.mac;const busy=((S.sync.rawfoot||{}).copy||{}).running;
    return `<div class="brrow"><div style="flex:1;min-width:0"><strong style="overflow-wrap:anywhere">${esc(r.name)}</strong>
      <span class="meta" style="display:block">${esc(String(r.main).replace(/^(\d+)\.\s*/,'$1 · '))} · ${r.n?r.n+' video · '+gb(r.size):(r.disk||0)+' video · '+gb(r.hdSize)+' dalam PERTAMA'}${r.where==='part'?' · '+r.disk+'/'+r.n+' dah disalin':''}</span>
      <div class="btns" style="gap:4px;margin-top:5px;flex-wrap:wrap">${pill(wt,wc)}${pill(esc(r.stat),r.col)}</div>
      ${r.where==='hd'&&r.kind==='edit'&&/^[2-4]\d\. /.test(r.key)?`<div class="btns" style="margin-top:6px">${rawBackBtn(r.key)}</div>`:''}
      ${r.raw&&r.raw.state==='wait'?`<div class="btns" style="margin-top:6px"><button class="btn sm" data-act="rawNow"${(S.sync.rawfoot||{}).mounted&&!busy?'':' disabled'}>Simpan ke PERTAMA sekarang</button></div>`:''}</div>
      <b style="font-size:13px;white-space:nowrap">${gb(r.size||r.hdSize)||'0 MB'}</b></div>`};
  const fb=(k,l)=>`<button type="button" class="${fl===k?'on':''}" data-act="ftAll" data-x="${k}" style="white-space:nowrap">${l}</button>`;
  return `<div class="card glass"><p class="eyebrow" style="margin:0 0 4px">Kedudukan footage ${tok(0)}</p>
    <p class="meta" style="margin:0"><b>${gb(onMac)||'0 MB'}</b> footage dalam Mac · <b style="color:#5A8FB5">${gb(safe)||'0 MB'}</b> dah selamat dalam PERTAMA · <b style="color:var(--warn)">${gb(only)||'0 MB'}</b> dalam Mac sahaja${hdOnly?` · ${gb(hdOnly)} dalam PERTAMA sahaja`:''}</p>${bar}
    ${ftMeter('Mac mini',m)}${ftMeter('PERTAMA',d)}
    <p class="meta" style="margin:8px 0 0;font-size:11px">PERTAMA ${I.mounted?'disambung':'<span style="color:var(--warn)">tak bersambung</span>'} · dikemaskini ${ago(I.updated||0)}. Footage projek disalin ke PERTAMA sendiri bila SEMUA videonya dah published, kemudian keluar dari Mac 30 hari selepas tu.</p></div>
    <div class="seg" style="margin:14px 0 4px;max-width:100%;overflow-x:auto">${fb('semua','Semua · '+rows.length)}${fb('mac','Mac sahaja')}${fb('both','Mac + PERTAMA')}${fb('hd','PERTAMA sahaja')}</div>
    <div class="card glass">${pick.map(row).join('')||'<p class="meta" style="margin:0">Tiada folder dalam senarai ni.</p>'}</div>`}
A.ftAll=el=>{ui.ftAll=el.dataset.x;render(true)};
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
   ${cp.running?`<div class="stbar" style="--c:var(--warn);margin-top:8px"><div class="stt"><span>${esc(String(cp.msg||'Salin ke PERTAMA').slice(0,40))}</span><span>${cp.total?Math.round(cp.done/cp.total*100):0}% · ${cp.done}/${cp.total}</span></div><div class="stg"><i style="width:${Math.max(3,cp.total?cp.done/cp.total*100:0)}%"></i></div></div>`:''}
   <div class="btns" style="margin-top:10px"><button class="btn sm solid tab" data-act="diskNow"${cp.running||ui.diskBusy?' disabled':''}>${cp.running||ui.diskBusy?'<i class="spin"></i>Sedang salin':'💾 Simpan ke PERTAMA sekarang'}</button></div>
   <p class="meta" style="margin:10px 0 0"><b>Google Drive:</b> ${esc(g.path||'')} (${gb(g.lib)||'0 MB'})</p>${g.total?ftMeter('Google Drive',g):`<p class="meta" style="margin:2px 0 0;font-size:11px;color:var(--warn)">% Drive belum bersambung: Apps Script dalam Google belum dikemaskini (tampal Code.gs baru, kemudian Deploy › Manage deployments › New version).</p>`}
   <p class="meta" style="margin:8px 0 0;font-size:11px">Studio tunjuk preview sahaja. Fail sebenar: tekan klip, kemudian Buka fail sebenar.</p></div>`}
/* Lokasi: senarai ikut susunan folder dalam hard disk (dan Drive). Mac salin sendiri ke PERTAMA bila bersambung. */
function ftDiskView(){const st=S.sync.storage||{};const root=((st.disk||{}).path)||'PERTAMA/MIRA/WORK ARCHIVE/WORK 2026';
  const libs=(S.brlib||[]).slice().sort((a,b)=>String(a.place).localeCompare(String(b.place)));
  const chip=(on,t)=>`<span class="pill" style="--pc:${on?'var(--ok)':'#999'}">${on?IC.check:''}${t}</span>`;
  /* folder ikut Mac (doc storage.tree); kiraan Drive dari brlib, klip lama dari set B-roll yang dibackup */
  const folders=(st.tree||[]).map(t=>{const d=libs.find(x=>x.place===t.name)||(S.brlib||[]).find(x=>x.place===String(t.name).replace(/^\d{1,3}[ ._-]+/,''));
    const old=S.broll.find(b=>b.status==='stok'&&String(b.lib||'').endsWith('/'+t.name));
    return {place:t.name,n:t.n,mac:t.mac,disk:t.disk,size:t.size,oldest:t.oldest,drive:d?(d.clips||[]).filter(x=>x.drive).length:old&&old.backedUp?t.n:0,driveFolder:d&&d.driveFolder}});
  libs.filter(d=>!folders.some(f=>f.place===d.place)).forEach(d=>{const cl=d.clips||[];folders.push({place:d.place,n:cl.length,mac:cl.filter(x=>x.mac).length,disk:cl.filter(x=>x.disk).length,size:cl.reduce((a,x)=>a+(x.size||0),0),drive:cl.filter(x=>x.drive).length,driveFolder:d.driveFolder})});
  const keep=st.keepDays||30;
  /* 24 Nov: klip disimpan dalam PERTAMA sahaja; slider = berapa hari lagi sebelum salinan Mac dibuang ke Trash */
  const left=d=>{if(!d.mac)return null;const t=d.oldest||((S.brlib||[]).find(x=>x.place===d.place)||{clips:[]}).clips.reduce((a,x)=>Math.min(a,Date.parse(x.final||'')||a),Date.now());return Math.max(0,Math.ceil(keep-(Date.now()-t)/DAY))};
  const place=d=>{const l=left(d);const pct=l==null?0:Math.round(l/keep*100);const col=l==null?'var(--ok)':l<=5?'var(--bad)':l<=12?'var(--warn)':'var(--ok)';
    return `<div class="brrow"><div style="flex:1;min-width:0"><strong>📁 ${esc(d.place)}</strong><span class="meta" style="display:block">${d.n} klip · ${gb(d.size)}</span>
      <div class="btns" style="gap:4px;margin-top:4px">${chip(d.disk>=d.n,d.disk>=d.n?'Dalam PERTAMA':'PERTAMA '+d.disk+'/'+d.n)}</div>
      ${l==null?`<p class="meta" style="margin:4px 0 0;font-size:11px">Mac dah kosong, simpan dalam PERTAMA sahaja</p>`:`<div class="stbar" style="--c:${col};margin-top:6px"><div class="stt"><span>Dibuang dari Mac dalam</span><span>${l} hari</span></div><div class="stg"><i style="width:${Math.max(3,pct)}%"></i></div></div>${d.disk<d.n&&l<=5?`<p class="meta" style="margin:2px 0 0;font-size:11px;color:var(--bad)">Belum masuk PERTAMA: Mac tak buang selagi belum disalin</p>`:''}`}</div>
      ${d.driveFolder?`<a class="btn icon sm" href="https://drive.google.com/drive/folders/${encodeURIComponent(d.driveFolder)}" target="_blank" rel="noopener" aria-label="Buka folder Drive" title="Buka folder dalam Google Drive">${IC.ext}</a>`:''}</div>`};
  const best=S.footage.filter(f=>(f.status==='stok'||!f.status)&&((f.files||[]).length||+f.clips));
  return rawGroups()+`<div class="card glass"><p class="eyebrow" style="margin:0">📂 ${esc(root)}</p>
    <p class="meta" style="margin:8px 0 0"><b>B-ROLL LIBRARY</b> · simpanan tetap dalam PERTAMA</p>
    ${folders.map(place).join('')||'<p class="meta">Belum ada klip Final.</p>'}
    ${best.length?`<p class="meta" style="margin:14px 0 0"><b>KLIP TERBAIK</b></p>${best.map(f=>`<div class="brrow"><div style="flex:1;min-width:0"><strong>📁 ${esc(f.name)}</strong><span class="meta" style="display:block">${(f.files||[]).length||+f.clips||0} klip · ${gb(f.size)}</span></div>${f.backedUp?chip(true,'Drive'):''}</div>`).join('')}`:''}
    <p class="meta" style="margin:12px 0 0;font-size:11px">Bila PERTAMA disambung ke Mac mini, Mac salin sendiri (bar % keluar di atas). Salinan Mac dibuang ke Trash selepas ${keep} hari, hanya bila dah ada dalam PERTAMA. 0 token Claude.</p></div>`}
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
A.ftTog=el=>{const f=get('footage',el.dataset.id);ui.ftDrop=ui.ftDrop||{};const s=ui.ftDrop[f.id]||(ui.ftDrop[f.id]=new Set(f.drop||[]));const k=el.dataset.x;s.has(k)?s.delete(k):s.add(k);render(true)};
A.bestDone=el=>{const f=get('footage',el.dataset.id);const drop=[...((ui.ftDrop&&ui.ftDrop[f.id])||new Set())];const name=String(f.folder||'').split('/').pop();
  const go2=async()=>{ui.ftBusy=Object.assign({},ui.ftBusy,{[f.id]:1});render();
    try{const r=await studioJob('best_done',{name,drop},5*60000);toast((r.trashed?r.trashed+' klip ke Trash. ':'')+'Klip disimpan, sedang backup ke Drive')}
    catch(e){toast('Tak berjaya: '+String((e&&e.message)||'semak Mac mini hidup').slice(0,80))}
    finally{const b=Object.assign({},ui.ftBusy);delete b[f.id];ui.ftBusy=b;render()}};
  if(drop.length)confirmBox('Buang '+drop.length+' klip ke Trash Mac dan simpan '+((f.files||[]).length-drop.length)+'?',go2,'Ya, teruskan');else go2()};
A.brStart=el=>{const key=el.dataset.id;ui.ftBusy=Object.assign({},ui.ftBusy,{[key]:1});render();
  studioJob('broll_start',{key},3*60000).then(()=>toast('Pre-cut dimulakan. Siap dalam beberapa minit')).catch(e=>toast('Tak dapat pre-cut: '+String((e&&e.message)||'').slice(0,80)))
   .finally(()=>{const x=Object.assign({},ui.ftBusy);delete x[key];ui.ftBusy=x;render()})};
A.brSave=()=>{const h=$('#brHome').value.trim()||BR_HOME,a=$('#brAway').value.trim();if(!/^https?:\/\//i.test(h)||(a&&!/^https?:\/\//i.test(a))){toast('Alamat mesti mula dengan http://');return}saveSettings({broll:{home:h,away:a}});render(true);toast('Disimpan')};

A.diskNow=async()=>{ui.diskBusy=1;render();try{await studioJob('disk_now',{},2*60000);toast('Sedang salin ke PERTAMA. Bar % keluar di atas')}
  catch(e){toast(String((e&&e.message)||'Mac mini tak jawab').slice(0,90))}finally{ui.diskBusy=0;render()}};
