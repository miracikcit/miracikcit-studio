/* ---------- TO EDIT ----------
   Kad folder edit sync sendiri dari Mac mini. EDIT NOW: Mac mini buka sesi Claude Code baru (Opus 5.5, medium)
   dalam folder utama dengan /edit-reel <no>/<projek> dan Remote Control hidup, jadi boleh dikawal dari phone.
   Status (Sesi dibuka > Storyboard > Draf) dibaca dari tracker Editor. Kad hilang bila video final masuk 00. TO POST FINAL. */
const edFor=(key,name)=>S.editor.filter(e=>e.folder===key||(!e.folder&&pMatch(e.name,name))).sort((a,b)=>(b.updated||0)-(a.updated||0))[0]||null;
const edTone=st=>/siap/i.test(st||'')?'var(--ok)':/sesi/i.test(st||'')?'var(--c)':'var(--warn)';
/* Deadline: ikut tarikh akhir post sample kalau ada, kalau tiada 2 minggu dari folder masuk */
const smpFor=name=>S.items.find(it=>it.sample&&!sampleDone(it)&&itMatch(it,name))||null;
function edDeadline(name,start){const it=smpFor(name);if(!it)return {d:deadline(start,14),t:'Edit dalam 2 minggu'};
  const left=daysTo(it.sample.postBy);const tot=Math.max(1,-daysTo(smpStart(it))+left);const pct=Math.max(4,Math.min(100,Math.round((tot-left)/tot*100)));
  return {d:{left,pct,color:left>7?'var(--ok)':left>=3?'var(--warn)':'var(--bad)',label:left>0?left+' hari lagi':left===0?'Hari terakhir':'Lewat '+(-left)+' hari'},t:'Akhir post sample '+dmy(it.sample.postBy)}}
V['to-edit']=()=>{const te=S.sync.toedit;const folders=toEditFolders();const fset=new Set(folders.map(f=>nrm(f.name)));
  const rows=folders.map(x=>({kind:'f',key:x.key,stage:x.stage,no:fno(x.stage),name:x.name,sub:[x.stage.replace(/^\d+\.\s*/,''),(x.clips||0)+' klip'+(x.images?' + '+x.images+' gambar':'')].join(' · '),start:x.mtime}))
   .concat(byStage('toedit').filter(it=>!fset.has(nrm(it.title))).map(it=>({kind:'i',key:it.id,stage:it.folder||'',no:fno(it.folder),name:it.title,sub:[(it.folder||'Belum pilih folder').replace(/^\d+\.\s*/,''),it.account,'folder belum ada footage'].filter(Boolean).join(' · '),start:(it.stageAt&&it.stageAt.toedit)||it.created})))
   .map(r=>Object.assign(r,edDeadline(r.name,r.start),{ed:edFor(r.key,r.name)})).sort((a,b)=>(a.d?a.d.left:99)-(b.d?b.d.left:99));
  const off=macOff();
  return head(te?'Folder sync '+fmtD(te.syncedAt):'Belum sync',`<button class="btn sm" data-act="addEdit">${IC.plus}Tambah</button>`)+shotList()+
  `<p class="eyebrow" style="margin:4px 0 10px">Dalam folder edit · ${rows.length}</p>${off?`<div class="banner glass">Mac mini tak jawab sejak ${esc(off)}. EDIT NOW perlukan Mac mini hidup dan app Claude dibuka.</div>`:''}<div class="list">${rows.map(r=>{const e=r.ed;const busy=ui.edNow&&ui.edNow[r.key];
    return `<div class="card glass"><div class="rowh">${fnoBadge(r.no)}<div style="flex:1;min-width:0"><h3>${esc(r.name)}</h3><div class="meta">${esc(r.sub)}${r.start?' · masuk '+fmtD(r.start):''}</div></div>${e?`<span class="pill" style="--pc:${edTone(e.status)}">${esc(e.status||'Draf')}</span>`:''}</div>
    ${trk(r.d,r.t)}
    <div class="btns" style="margin-top:12px">${!e||/sesi/i.test(e.status||'')?`<button class="btn sm solid tab edgo" data-act="edNow" data-id="${esc(r.key)}" data-x="${esc(r.stage)}" data-n="${esc(r.name)}"${busy||off||!r.stage?' disabled':''}>${busy?'<i class="spin"></i>'+esc(busy):e?'▶ EDIT NOW sekali lagi':'▶ EDIT NOW'}</button>`:''}
     ${e&&isUrl(e.url)?`<a class="btn sm${/sesi/i.test(e.status||'')?'':' solid tab'}" href="${esc(e.url)}" target="_blank" rel="noopener">${IC.ext}Buka ${/storyboard/i.test(e.status||'')?'storyboard':'Editor'}</a>`:''}
     <button class="btn icon sm bad" data-act="${r.kind==='f'?'fHide':'delItem'}" data-id="${esc(r.key)}" aria-label="Buang">${IC.trash}</button></div>
    ${e&&/sesi/i.test(e.status||'')?`<p class="meta" style="margin:8px 0 0">Sesi Claude dah dibuka ${fmtD(e.updated)}. Buka app Claude di phone, sesi "${esc(r.name)}" ada dalam senarai Remote Control.</p>`:''}</div>`}).join('')||`<div class="empty">${te?'Tiada video tunggu edit.':'Belum sync. Tekan Sync folder di Home.'}</div>`}</div>`};
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
