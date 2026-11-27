/* ---------- TO EDIT ----------
   Kad folder edit sync sendiri dari Mac mini. EDIT NOW: Mac mini buka sesi Claude Code baru (Opus 5.5, medium)
   dalam folder utama dengan /edit-reel <no>/<projek> dan Remote Control hidup, jadi boleh dikawal dari phone.
   Status (Sesi dibuka > Storyboard > Draf) dibaca dari tracker Editor. Kad hilang bila video final masuk 00. TO POST FINAL. */
const edFor=(key,name)=>S.editor.filter(e=>(e.folder===key||(!e.folder&&pMatch(e.name,name)))&&(e.chat||e.url||e.status||e.final)).sort((a,b)=>(b.updated||0)-(a.updated||0))[0]||null;
const edTone=st=>/siap|jalan/i.test(st||'')?'var(--ok)':/perlu/i.test(st||'')?'var(--bad)':/sesi/i.test(st||'')?'var(--c)':'var(--warn)';
/* Deadline: ikut tarikh akhir post sample kalau ada, kalau tiada 2 minggu dari folder masuk */
const smpFor=name=>S.items.find(it=>it.sample&&!sampleDone(it)&&itMatch(it,name))||null;
function edDeadline(name,start){const it=smpFor(name);if(!it)return {d:deadline(start,14),t:'Edit dalam 2 minggu'};
  const left=daysTo(it.sample.postBy);const tot=Math.max(1,-daysTo(smpStart(it))+left);const pct=Math.max(4,Math.min(100,Math.round((tot-left)/tot*100)));
  return {d:{left,pct,color:left>7?'var(--ok)':left>=3?'var(--warn)':'var(--bad)',label:left>0?left+' hari lagi':left===0?'Hari terakhir':'Lewat '+(-left)+' hari'},t:'Akhir post sample '+dmy(it.sample.postBy)}}
V['to-edit']=()=>{const te=S.sync.toedit;const folders=toEditFolders();const fset=new Set(folders.map(f=>nrm(f.name)));
  const rows=folders.map(x=>({kind:'f',key:x.key,stage:x.stage,no:fno(x.stage),name:x.name,sub:[x.stage.replace(/^\d+\.\s*/,''),(x.clips||0)+' klip'+(x.images?' + '+x.images+' gambar':'')].join(' · '),start:x.mtime}))
   .concat(byStage('toedit').filter(it=>!fset.has(nrm(it.title))).map(it=>({kind:'i',key:it.id,stage:it.folder||'',no:fno(it.folder),name:it.title,sub:[(it.folder||'Belum pilih folder').replace(/^\d+\.\s*/,''),it.account,'folder belum ada footage'].filter(Boolean).join(' · '),start:(it.stageAt&&it.stageAt.toedit)||it.created})))
   .filter(r=>(!isPublishedName(r.name)||(r.kind==='f'&&multiKey(r.key)))&&!HELPER_DIR.test(r.name))   /* 26 Nov (Mira): projek banyak video (GENTING 7 video) kekal walaupun satu video (versi bajet) dah published */.concat(redoRows()).map(r=>Object.assign(r,edDeadline(r.name,r.start),{ed:edFor(r.key,r.name)})).sort((a,b)=>(a.d?a.d.left:99)-(b.d?b.d.left:99));
  const off=macOff();
  if(ui.teSeg==='broll')return head('B-roll untuk semak')+teSegs()+ftSemakView();
  return head(te?'Folder sync '+fmtD(te.syncedAt):'Belum sync',`<button class="btn sm" data-act="addEdit">${IC.plus}Tambah</button>`)+teSegs()+airHome()+shotList()+
  `<p class="eyebrow" style="margin:4px 0 10px">Dalam folder edit · ${rows.length}</p>${off?`<div class="banner glass">Mac mini tak jawab sejak ${esc(off)}. EDIT NOW perlukan Mac mini hidup dan app Claude dibuka.</div>`:''}<div class="list">${rows.map(r=>{const e=r.ed;const busy=ui.edNow&&ui.edNow[r.key];
    return `<div class="card glass"><div class="rowh">${fnoBadge(r.no)}<div style="flex:1;min-width:0">${r.kind==='r'?`<span class="pill rdp">Video baru #${r.round}</span>`:''}<h3>${esc(r.title||r.name)}</h3><div class="meta">${esc(r.sub)}${r.start?' · masuk '+fmtD(r.start):''}</div></div>${e?`<span class="pill" style="--pc:${edMulti(e)?(edFinN(e)>=edTot(e)?'var(--ok)':'var(--warn)'):edTone(e.status)}">${esc(edMulti(e)?edFinN(e)+'/'+edTot(e)+' siap':e.status||'Draf')}</span>`:''}${voMic(r)}</div>
    ${trk(r.d,r.t)}
    ${brSteps(r,e)}
    ${edPartsList(e)}
    <div class="btns tem" style="margin-top:12px">${edBtns(r,e,busy,off)}${r.kind==='f'||r.kind==='r'?`<button class="btn icon sm" data-act="peek" data-id="${esc(r.key)}" data-x="${esc(r.stage)}" data-n="${esc(r.name)}" aria-label="Lihat footage" title="Lihat footage">${IC.footage}</button>`:''}${r.kind==='f'?`<button class="btn icon sm" data-act="airMore" data-x="${esc(r.stage)}" data-n="${esc(r.name)}" aria-label="Tambah footage dengan AirDrop" title="Tambah footage dengan AirDrop">${IC.up}</button>`:''}<button class="btn icon sm bad" data-act="${r.kind==='f'?'fHide':r.kind==='r'?'redoDel':'delItem'}" data-id="${esc(r.kind==='r'?r.rid:r.key)}" aria-label="Buang">${IC.trash}</button></div>
    ${r.kind==='f'?airRowStatus(r):''}${edNote(r,e)}${tipRep(e)}</div>`}).join('')||`<div class="empty">${te?'Tiada video tunggu edit.':'Belum sync. Tekan Sync folder di Home.'}</div>`}</div>`};
/* Butang kad: belum mula = EDIT NOW; dah tekan = link terus ke chat Claude (Remote Control) atau status */
function edBtns(r,e,busy,off){if(r.kind==='r'&&!r.clips)return rawBackBtn(String(r.key).replace(/#r\d+$/,''));
  /* 23 Nov: EDIT NOW tak lagi tunggu semua B-roll disemak; Claude guna klip Final yang dah ada */
  const now=`<button class="btn sm${e?'':' solid tab'} edgo" data-act="esOpen" data-id="${esc(r.key)}" data-x="${esc(r.stage)}" data-n="${esc(r.name)}"${r.round?` data-r="${r.round}"`:''}${busy||off||!r.stage||esScan(r.key)?' disabled':''}>${esScan(r.key)?'<i class="spin"></i>Analysing '+Math.round(esScan(r.key).pct||0)+'%':busy?'<i class="spin"></i>'+esc(busy):e?'Buka sesi baru':'▶ EDIT NOW'}</button>${tok(TOK.edit,'satu sesi edit Claude, ikut panjang video',TOKM.edit)}`;
  if(!e)return now;const st=e.status||'';const stuck=/perlu|tiada link/i.test(st);
  const chat=isUrl(e.chat)?`<a class="btn sm solid tab" href="${esc(e.chat)}" target="_blank" rel="noopener">${IC.ext}Buka chat Claude</a>`:'';
  const page=isUrl(e.url)?`<a class="btn sm${chat?'':' solid tab'}" href="${esc(e.url)}" target="_blank" rel="noopener">${IC.ext}${/storyboard/i.test(st)?'Storyboard':'Editor'}</a>`:'';
  const wait=!chat&&!page&&!stuck?`<span class="pill" style="--pc:var(--c)"><i class="spin"></i>Sedang buka sesi</span>`:'';
  return chat+page+wait+(r.kind==='r'||stuck||(!chat&&Date.now()-(e.sessionAt||e.updated||0)>15*60000)?now:'')}
/* Bahagian projek banyak video: mana dah ada final, mana masih storyboard / draf (26 Nov, Mira) */
function edPartsList(e){const P=e?edParts(e):[];if(!P.length)return '';const tone=p=>p.final?'var(--ok)':/storyboard|lulus/i.test(p.status||'')?'var(--bad)':'var(--warn)';
  return `<div class="edparts">${P.map(p=>`<div class="edpart"><span class="ccn">${esc(p.name||p.id||'Video')}</span>${isUrl(p.url)&&!p.final?`<a class="pill" style="--pc:var(--c);text-decoration:none" href="${esc(p.url)}" target="_blank" rel="noopener">Buka</a>`:''}<span class="pill" style="--pc:${tone(p)}">${esc(p.final?'Siap':p.status||'Belum mula')}</span></div>`).join('')}</div>`}
function edNote(r,e){if(!e)return '';const st=e.status||'';
  if(/persediaan/i.test(st))return `<p class="meta" style="margin:8px 0 0;color:var(--bad)">Sesi tunggu di Terminal Mac mini (persediaan kali pertama). Tekan Enter di Terminal, kemudian jawab Yes untuk Trust folder.</p>`;
  if(/trust/i.test(st))return `<p class="meta" style="margin:8px 0 0;color:var(--bad)">Sesi tunggu di Terminal Mac mini: pilih Yes untuk Trust folder ${esc(r.stage)}. Sekali sahaja untuk folder ni.</p>`;
  if(/log masuk/i.test(st))return `<p class="meta" style="margin:8px 0 0;color:var(--bad)">Claude dalam Terminal Mac mini perlu log masuk.</p>`;
  return ''}
/* Mac mini dianggap offline kalau tiada ping lebih 5 minit (sel P1 tab Transcribe, diisi oleh worker setiap minit) */
function macOff(){const t=Date.parse(((typeof trRaw!=='undefined'&&trRaw&&trRaw[0])||[])[15]||'');if(!t)return '';return Date.now()-t>5*60000?fmtD(t)+' '+new Date(t).toTimeString().slice(0,5):''}
A.edNow=async el=>{const key=el.dataset.id,stage=el.dataset.x,name=el.dataset.n;ui.edNow=Object.assign({},ui.edNow,{[key]:'Buka sesi...'});render();
  try{const r=await studioJob('edit_now',{stage,name,key},3*60000);toast('Sesi Claude dibuka di Mac mini. Buka app Claude di phone untuk kawal')}
  catch(e){toast('Tak dapat buka sesi: '+String((e&&(e.message||e.code))||'semak Mac mini hidup').slice(0,80))}
  finally{const b=Object.assign({},ui.edNow);delete b[key];ui.edNow=b;render()}};
A.copy=el=>copyText(el.dataset.x);
A.fHide=el=>{const k=el.dataset.id;confirmBox('Buang "'+k.split('/').pop()+'" dari To Edit?',()=>{markToEdit(k,'hidden');toast('Dibuang')},'Ya, buang')};
A.addEdit=()=>modal(`<h2>Tambah video untuk edit</h2><label class="f"><span>Nama video</span><input class="inp" id="aeT"></label><label class="f"><span>Folder</span><select class="inp" id="aeF">${FOLDERS.map(f=>`<option>${esc(f)}</option>`).join('')}</select></label><p class="meta">Mac mini buat folder ni dalam folder edit. Masukkan footage ke situ, kemudian tekan EDIT NOW.</p><div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="addEditSave">Simpan</button></div>`);
A.addEditSave=()=>{const t=$('#aeT').value.trim();if(!t){toast('Isi nama video');return}const f=$('#aeF').value;save('items',{title:t,stage:'toedit',folder:f,stageAt:{toedit:Date.now()}});closeModal();mkEditFolder(f,t)};
/* Shoot terus ke folder edit: Mac mini buat folder <folder edit>/<produk>, kemudian imbas semula */
function mkEditFolder(stage,name){if(!window.studioJob)return;studioJob('mkfolder',{stage,name},2*60000).then(r=>toast('Folder dibuat: '+stage.replace(/^\d+\.\s*/,'')+' / '+r.name+'. Masukkan footage')).catch(()=>{})}

/* 2026-11-23 (Mira): video yang dah published (semua baris Sheet dah settled) terus keluar dari senarai edit */
const HELPER_DIR=/^(videos|build|editor|page|render|renders|draft|tmp)$|-(edit|build|draft)$/i;   /* folder kerja Claude, bukan projek */
function isPublishedName(name){const k=nrm(name);if(k.length<4)return false;const sv=sheetView();return publishedEntries(sv).some(e=>{const n=nrm(e.name);return e.vids>=e.total&&(pMatch(e.name,name)||(k.length>=5&&(n.includes(k)||k.includes(n)&&n.length>=5)))})}
/* Lihat footage: Mac mini buat gambar grid frame setiap video dalam folder (job folder_peek, 0 token) */
A.peek=async el=>{const stage=el.dataset.x,name=el.dataset.n;
  modal(`<h2>${esc(name)}</h2><p class="meta">${esc(stage)}</p><div id="pkBox"><p class="meta"><i class="spin"></i> Mac mini sedang ambil gambar setiap video…</p></div><div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Tutup</button></div>`,TAB['to-edit'].c);
  try{const r=await studioJob('folder_peek',{stage,name},3*60000);const b=$('#pkBox');if(!b)return;
    b.innerHTML=r&&r.img?`<img src="${esc(r.img)}" alt="Gambar footage ${esc(name)}" style="width:100%;border-radius:12px;display:block"><p class="meta" style="margin:8px 0 0">${r.n} video${r.n>=24?' (24 pertama)':''}: ${esc((r.names||[]).join(', ')).slice(0,600)}</p>`:'<p class="meta">Tiada video dalam folder ni.</p>'}
  catch(e){const b=$('#pkBox');if(b)b.innerHTML=`<p class="meta" style="color:var(--bad)">Tak dapat: ${esc(String((e&&(e.message||e.code))||'semak Mac mini hidup').slice(0,100))}</p>`}};

/* 2026-11-23 (Mira): butang mic. Merah = folder perlu VO tapi belum ada, hijau = VO dah ada. Tekan = terus ke kad VO. */
function voMic(r){const id=voId(r.name),d=get('vo',id),need=voAuto(r.stage||'')||(d&&d.status!=='buang'),has=d&&(((d.vos||[]).some(v=>v.status==='siap'))||d.status==='siap');
  if(!need&&!has)return '';return `<button class="micb ${has?'ok':'need'}" data-act="voGo" data-id="${esc(id)}" data-x="${esc(r.stage||'')}" data-n="${esc(r.name)}" aria-label="${has?'VO dah ada':'Perlu rakam VO'}">${IC.mic.replace('<svg ','<svg style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8" ')}</button>`}
A.voGo=el=>{const id=el.dataset.id;if(!get('vo',id))save('vo',{id,folder:el.dataset.x,sub:el.dataset.n,status:'perlu',points:[]},true);ui.voOpen=id;location.hash='#vo'};

/* 2026-11-25 (Mira): START EDIT dari Published = kad "Video baru #N" di sini (koleksi redo {title, folder, n, pubKey}).
   EDIT NOW sama macam kad lain; tracker pusingan = editor/ed-f-<folder>-r<n> (folder "<kunci>#r<n>"). Kad hilang bila final baru masuk 00. */
function redoStyles(folder){return S.editor.filter(t=>t.folder&&(t.folder===folder||t.folder.startsWith(folder+'#r'))&&(t.jenis||/^(Tiru|Resipi)/.test(t.style||''))).map(t=>t.jenis||String(t.style).replace(/^(Tiru|Resipi):\s*/,''))}
function redoRows(){return S.redo.filter(x=>!redoDone(x)).map(x=>{const [st,...rest]=String(x.folder||'').split('/'),nm=rest.join('/');const fi=folderInfo(x.folder);const used=redoStyles(x.folder);
  return {kind:'r',rid:x.id,key:x.folder+'#r'+x.n,round:x.n,stage:st,no:fno(st),name:nm,title:x.title,clips:fi?(fi.clips||0)+(fi.images||0):0,
    sub:[st.replace(/^\d+\.\s*/,'')+' › '+nm,fi?(fi.clips||0)+' klip'+(fi.images?' + '+fi.images+' gambar':''):'folder tak dijumpai',used.length?'dah dibuat: '+used.join(', '):''].filter(Boolean).join(' · '),start:x.at||x.created}})}
A.redoDel=el=>{const x=get('redo',el.dataset.id);if(!x)return;confirmBox('Buang kad "'+(x.title||'')+' · video baru #'+x.n+'"? Footage tak disentuh.',()=>{del('redo',x.id);toast('Dibuang')},'Ya, buang')};

/* 2026-11-25 (Mira): cara Claude belajar ikut tips. Sesi edit tulis doc tipsrep/<id tracker> {items[{id,tip,pakai,cara,ans}]}
   (gaya.py report). Mira jawab Kena / Tak kena; kiraan disimpan pada tip (used, hit, miss) dan tahap berubah sendiri:
   tak kena 2 kali = turun ke Cuba, kena 3 kali = naik ke Wajib (kalau belum cukup 7). */
function tipFind(id){for(const g of S.gaya){const T=g.tips||[];for(let i=0;i<T.length;i++)if(T[i].id===id||g.id+':'+i===id)return {g,i,t:T[i]}}return null}
function tipRep(e){if(!e)return '';const d=get('tipsrep',e.id);if(!d||!(d.items||[]).length)return '';const open=d.items.map((x,i)=>({x,i})).filter(o=>!o.x.ans);
  if(!open.length)return `<p class="meta tpr0">Laporan tips: semua ${d.items.length} dah dijawab.</p>`;
  return `<div class="tprep"><p class="eyebrow">Laporan tips · ${open.length} belum dijawab</p>${open.map(({x,i})=>{const f=tipFind(x.id);const txt=x.tip||(f&&f.t.t)||'';
    return `<div class="tpri"><p><b>${x.pakai?'✓ Dipakai':'✕ Tak dipakai'}:</b> ${esc(txt)}${x.cara?`<span>${esc(x.cara)}</span>`:''}</p><div class="btns">${x.pakai?`<button class="btn sm st-done" data-act="tipAns" data-id="${esc(e.id)}" data-x="${i}" data-k="kena">Kena</button><button class="btn sm" data-act="tipAns" data-id="${esc(e.id)}" data-x="${i}" data-k="tak">Tak kena</button>`:`<button class="btn sm" data-act="tipAns" data-id="${esc(e.id)}" data-x="${i}" data-k="ok">Okay</button><button class="btn sm" data-act="tipAns" data-id="${esc(e.id)}" data-x="${i}" data-k="patut">Patut pakai</button>`}</div></div>`}).join('')}<p class="meta">${tok(0)} Jawapan kau ubah tahap tip (Wajib / Cuba) sendiri.</p></div>`}
A.tipAns=el=>{const d=get('tipsrep',el.dataset.id);if(!d)return;const i=+el.dataset.x,k=el.dataset.k,x=d.items[i];if(!x)return;
  save('tipsrep',Object.assign({},d,{items:d.items.map((y,j)=>j===i?Object.assign({},y,{ans:k}):y)}));
  const f=tipFind(x.id);if(!f||k==='ok')return;const t=Object.assign({},f.t);const fo=f.g.fold==='*'?'':f.g.fold;const room=()=>csTipRefs(fo).filter(r=>r.t.lvl!=='cuba').length<CS_MAXW;
  if(k==='kena'){t.used=(t.used||0)+1;t.hit=(t.hit||0)+1;if(t.lvl==='cuba'&&t.hit>=3&&room()){t.lvl='wajib';toast('Tip naik ke Wajib')}}
  else if(k==='tak'){t.used=(t.used||0)+1;t.miss=(t.miss||0)+1;if(t.lvl!=='cuba'&&t.miss>=2){t.lvl='cuba';toast('Tip turun ke Cuba')}}
  else if(k==='patut'){if(t.lvl==='cuba'&&room()){t.lvl='wajib';toast('Tip dinaikkan ke Wajib')}}
  save('gaya',Object.assign({},f.g,{tips:f.g.tips.map((y,j)=>j===f.i?t:y)}))};
