/* ---------- EDITOR › STYLE (Tiru Gaya dari link video rujukan) ----------
   Mira tampal link (Drive / TikTok / IG) + nota + masa effect + tag. Mac mini (job gaya_scan) muat turun, ukur rentak cut,
   transkrip, BPM, OCR, scan sheet 12 frame + jalur effect, kemudian Claude Opus (low) tulis kad gaya: status `semak`.
   Mira luluskan (Tukar nama / Simpan / Buang, atau Tambah ke gaya yang hampir sama). Effect dari video sama dilekat pada
   kad secara lalai; boleh tanggal (Tak pakai). Kad `simpan` dibaca Claude bila Mira kata "edit gaya <nama>". */
const GY_TAGS=['Hotel','Vlog','Talking head','Affiliate','Unboxing','Resepi','Review','Before/After','Tutorial'];
const GY_F=[['hook','Hook'],['cut','Rentak cut'],['text','Teks'],['font','Font'],['color','Warna'],['transition','Transition'],['zoom','Zoom'],['audio','Muzik / SFX'],['cta','CTA'],['length','Panjang']];
const gyTags=()=>((S.settings||{}).gayaTags)||GY_TAGS;
const gyImg=(id,w)=>id?`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${w||1200}`:'';
const gyDView=id=>'https://drive.google.com/file/d/'+encodeURIComponent(id)+'/view';
const gyChip=(on,label,act,id,x)=>`<button type="button" class="chip${on?' on':''}" data-act="${act}"${id?` data-id="${esc(id)}"`:''} data-x="${esc(x==null?label:x)}" aria-pressed="${on?'true':'false'}">${esc(label)}</button>`;
function edSegs(){const n=S.gaya.filter(g=>g.status==='semak').length;const seg=ui.edSeg||'projek';
  return `<div class="seg" style="margin-bottom:14px">${[['projek','Projek'],['style','Style'+(n?' · '+n:'')]].map(([k,l])=>`<button type="button" class="${seg===k?'on':''}" data-act="edSeg" data-x="${k}">${l}</button>`).join('')}</div>`}
A.edSeg=el=>{gyKeep();ui.edSeg=el.dataset.x;render(true)};
function gyKeep(){if(!$('#gyN'))return;ui.gyDraft=Object.assign({},ui.gyDraft,{note:$('#gyN').value,fx:$('#gyF').value},$('#gyL')?{link:$('#gyL').value}:{})}
/* Upload terus ke Drive: Apps Script buka sesi resumable, phone hantar 8 MB setiap kali (tiada token Claude). */
A.gyUpload=()=>pickFile('video/*',async f=>{gyKeep();if(f.size>500*1048576){toast('Video lebih 500 MB. Potong dulu atau guna link');return}
  ui.gyUp={name:f.name,pct:0};render(true);
  const b64=blob=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=rej;r.readAsDataURL(blob)});
  try{const s=await studioCall('ustart',{name:f.name,mime:f.type||'video/mp4',size:f.size});const CH=8*1048576;let pos=0,id=null,tries=0;
    while(pos<f.size&&!id){try{const r=await studioCall('uchunk',{url:s.url,start:pos,total:f.size,b64:await b64(f.slice(pos,pos+CH))});
        if(r.id)id=r.id;else pos=r.next;tries=0}catch(e){if(++tries>3)throw e;await new Promise(r=>setTimeout(r,2000*tries))}
      ui.gyUp.pct=Math.min(100,Math.round((id?f.size:pos)/f.size*100));render()}
    if(!id)throw new Error('Drive tak bagi id fail');
    ui.gyDraft=Object.assign({},ui.gyDraft,{link:'https://drive.google.com/file/d/'+id+'/view',up:{id,name:f.name,size:f.size}});toast('Video dah masuk Drive. Tekan Hantar ke Mac mini')}
  catch(e){toast('Upload tak jadi: '+String((e&&e.message)||'semak internet').slice(0,80))}
  finally{ui.gyUp=null;render(true)}});
A.gyUpClear=()=>{gyKeep();const d=ui.gyDraft||{};if(d.up)studioCall('file_delete',{id:d.up.id}).catch(()=>{});ui.gyDraft=Object.assign({},d,{up:null,link:''});render(true)};
function gyParseFx(s){return String(s||'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean).slice(0,3).map(x=>{const [a,b]=x.split(/\s*[-–]\s*/);return {a:a||'',b:b||''}}).filter(r=>/^\d/.test(r.a))}

function gyFacts(c){return `<dl class="gyfacts">${GY_F.filter(([k])=>c[k]).map(([k,l])=>`<dt>${l}</dt><dd>${esc(c[k])}</dd>`).join('')}</dl>${(c.beats||[]).length?`<details class="gybeats"><summary class="meta">Susunan babak · ${c.beats.length}</summary><ol>${c.beats.map(b=>`<li>${esc(b)}</li>`).join('')}</ol></details>`:''}`}
function gyEffects(g){const L=g.effects||[];if(!L.length)return '';
  return `<p class="eyebrow" style="margin:14px 0 6px">Effect dari video ni · ${L.filter(e=>e.on!==false).length} dipakai</p><div class="list gyfx">${L.map(e=>`<div class="gyfxrow${e.on===false?' off':''}">
    ${e.strip?`<a href="${esc(gyImg(e.strip,1600))}" target="_blank" rel="noopener" class="gystrip"><img src="${esc(gyImg(e.strip,600))}" alt="Jalur effect ${esc(e.name)}" loading="lazy" referrerpolicy="no-referrer"></a>`:''}
    <div style="flex:1;min-width:0"><strong>${esc(e.name)}</strong> <span class="meta">${esc(e.at||'')}</span><div class="meta">${esc(e.look||'')}</div></div>
    <div class="btns">${e.prev?`<a class="btn sm" href="${esc(gyDView(e.prev))}" target="_blank" rel="noopener">▶</a>`:''}<button class="btn sm${e.on===false?'':' solid tab'}" data-act="gyFx" data-id="${esc(g.id)}" data-x="${esc(e.id)}">${e.on===false?'Tak pakai':IC.check+'Pakai'}</button></div></div>`).join('')}</div>`}
function gyTagRow(g){const sug=(g.tagsSuggest||[]).filter(t=>!(g.tags||[]).includes(t));
  return `<div class="chips">${(g.tags||[]).map(t=>gyChip(true,t,'gyTag',g.id)).join('')}${sug.map(t=>gyChip(false,'+ '+t,'gyTag',g.id,t)).join('')}<button type="button" class="chip" data-act="gyTagPick" data-id="${esc(g.id)}">+ Tag</button></div>`}

function gyCard(g){
  if(g.status==='scan')return `<div class="card glass"><div class="rowh" style="align-items:center"><div style="flex:1;min-width:0"><h3>Sedang scan</h3><div class="meta" style="overflow-wrap:anywhere">${esc(g.link)}</div></div><span class="pill" style="--pc:var(--warn)"><i class="spin"></i>${esc(g.msg||'Menunggu Mac mini')}</span></div></div>`;
  if(g.status==='error')return `<div class="card glass"><div class="rowh" style="align-items:center"><div style="flex:1;min-width:0"><h3>Tak dapat scan</h3><div class="meta" style="overflow-wrap:anywhere">${esc(g.link)}</div></div><span class="pill" style="--pc:var(--bad)">Ralat</span></div>
    <p class="meta" style="margin:8px 0 0">${esc(g.msg||'')}</p><div class="btns" style="margin-top:10px"><button class="btn sm solid tab" data-act="gyRetry" data-id="${esc(g.id)}">Cuba lagi</button><button class="btn sm bad" data-act="gyDel" data-id="${esc(g.id)}">${IC.trash}Buang</button></div></div>`;
  const c=g.card||{};const m=g.match&&get('gaya',g.match.id)&&g.match.pct>=60?g.match:null;
  return `<div class="card glass gycard"><div class="rowh" style="align-items:baseline"><div style="flex:1;min-width:0"><span class="gyname">${esc(g.name||'Gaya baru')}</span><div class="meta">${esc(c.summary||'')}</div></div><span class="pill" style="--pc:var(--warn)">Menunggu lulus</span></div>
    ${gyTagRow(g)}
    ${g.scan?`<a href="${esc(gyImg(g.scan,1800))}" target="_blank" rel="noopener" class="gyscan"><img src="${esc(gyImg(g.scan))}" alt="Scan sheet 12 frame" loading="lazy" referrerpolicy="no-referrer"></a>`:''}
    ${gyFacts(c)}${gyEffects(g)}
    ${m?`<div class="gymatch"><b>Hampir sama dengan ${esc(m.name)} (${m.pct}%)</b><span class="meta">${esc(m.why||'')}</span><div class="btns"><button class="btn sm solid tab" data-act="gyMerge" data-id="${esc(g.id)}">Tambah ke ${esc(m.name)}</button><button class="btn sm" data-act="gySave" data-id="${esc(g.id)}">Simpan nama baru</button></div></div>`:''}
    <div class="btns" style="margin-top:12px"><button class="btn sm" data-act="gyRename" data-id="${esc(g.id)}">${IC.edit}Tukar nama</button><span style="flex:1"></span><button class="btn sm bad" data-act="gyDel" data-id="${esc(g.id)}">✕ Buang</button>${m?'':`<button class="btn sm solid tab" data-act="gySave" data-id="${esc(g.id)}">${IC.check}Simpan</button>`}</div>
    ${g.usage?`<p class="meta" style="margin:8px 0 0">Token: ${((g.usage.in||0)+(g.usage.out||0)).toLocaleString()} baru${g.usage.cache?' + '+g.usage.cache.toLocaleString()+' cache':''}</p>`:''}</div>`}

function gySaved(g){const c=g.card||{};
  return `<details class="col card glass gycard"><summary><div class="rowh" style="align-items:center"><div style="flex:1;min-width:0"><span class="gyname sm">${esc(g.name)}</span><div class="meta">${esc((g.tags||[]).join(' · '))}${(g.refs||[]).length>1?' · '+g.refs.length+' rujukan':''}</div></div><span class="ic chev">${IC.chev}</span></div></summary>
    <div style="margin-top:12px"><p class="meta" style="margin:0 0 8px">${esc(c.summary||'')}</p>${gyTagRow(g)}
    ${g.scan?`<a href="${esc(gyImg(g.scan,1800))}" target="_blank" rel="noopener" class="gyscan"><img src="${esc(gyImg(g.scan))}" alt="Scan sheet" loading="lazy" referrerpolicy="no-referrer"></a>`:''}
    ${gyFacts(c)}${gyEffects(g)}
    <p class="eyebrow" style="margin:14px 0 6px">Video rujukan</p><div class="list">${(g.refs||[]).map((r,i)=>`<a class="meta" href="${esc(r.link)}" target="_blank" rel="noopener" style="overflow-wrap:anywhere">${i+1}. ${esc(r.note||r.link)}</a>`).join('')}</div>
    <div class="btns" style="margin-top:12px"><button class="btn sm solid tab" data-act="gyCopy" data-x="${esc(g.name)}">${IC.copy}Copy "edit gaya ${esc(g.name)}"</button><button class="btn sm" data-act="gyRename" data-id="${esc(g.id)}">${IC.edit}Tukar nama</button><span style="flex:1"></span><button class="btn icon sm bad" data-act="gyDel" data-id="${esc(g.id)}" aria-label="Buang gaya">${IC.trash}</button></div></div></details>`}

function gyView(){const d=ui.gyDraft||{};const sel=new Set(d.tags||[]);const f=ui.gyFilter||'';
  const pend=S.gaya.filter(g=>g.status!=='simpan').sort((a,b)=>(b.updated||0)-(a.updated||0));
  const saved=S.gaya.filter(g=>g.status==='simpan').sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  const used=[...new Set(saved.flatMap(g=>g.tags||[]))];
  const shown=saved.filter(g=>!f||(g.tags||[]).includes(f));
  return head('Tiru gaya dari video rujukan')+edSegs()+
  `<div class="card glass"><h3 style="margin-bottom:8px">Video rujukan baru</h3>
    ${d.up?`<div class="gyup"><span style="flex:1;min-width:0;overflow-wrap:anywhere">${IC.check} ${esc(d.up.name)} <span class="meta">(${Math.round(d.up.size/1048576)} MB, dah dalam Drive)</span></span><button type="button" class="btn sm" data-act="gyUpClear">Tukar</button></div>`
    :ui.gyUp?`<div class="gyup"><i class="spin"></i><span style="flex:1">Upload ${esc(ui.gyUp.name)}… ${ui.gyUp.pct}%</span></div><div class="gybar"><i style="width:${ui.gyUp.pct}%"></i></div>`
    :`<button type="button" class="btn solid tab" style="width:100%;justify-content:center" data-act="gyUpload">${IC.plus}Upload video dari phone</button>
    <p class="meta" style="text-align:center;margin:8px 0">atau tampal link</p>
    <label class="f"><span>Link video (Google Drive, TikTok, IG, FB)</span><input class="inp" id="gyL" value="${esc(d.link||'')}" placeholder="https://drive.google.com/file/d/..." inputmode="url" autocapitalize="off"></label>`}
    <label class="f"><span>Nota (tak wajib)</span><input class="inp" id="gyN" value="${esc(d.note||'')}" placeholder="cth. suka cara teks pop masuk ikut beat"></label>
    <label class="f"><span>Masa effect yang nak ditiru (tak wajib, maks 3)</span><input class="inp" id="gyF" value="${esc(d.fx||'')}" placeholder="cth. 0:07-0:09, 0:15"></label>
    <div class="f"><span class="meta">Tag</span><div class="chips" style="margin-top:6px">${gyTags().map(t=>gyChip(sel.has(t),t,'gyFormTag')).join('')}<button type="button" class="chip" data-act="gyTagPick">+ Tag baru</button></div></div>
    <div class="btns" style="margin-top:12px;justify-content:flex-end"><button class="btn solid tab" data-act="gySend"${ui.gyBusy?' disabled':''}>${ui.gyBusy?'<i class="spin"></i>':''}Hantar ke Mac mini</button>${tok(TOK.gaya,'Claude tulis kad gaya sekali')}</div>
    <p class="meta" style="margin:8px 0 0">Mac mini scan tanpa token. Claude tulis kad sekali sahaja (lebih kurang 5,000–15,000 token). Video rujukan dibuang lepas scan. Tiru struktur dan rupa sahaja, bukan muzik, logo atau watermark orang lain.</p></div>
  ${pend.length?`<p class="eyebrow" style="margin-top:20px">Menunggu · ${pend.length}</p><div class="list">${pend.map(gyCard).join('')}</div>`:''}
  <p class="eyebrow" style="margin-top:22px">Gaya tersimpan · ${saved.length}</p>
  ${used.length?`<div class="chips" style="margin-bottom:10px">${gyChip(!f,'Semua','gyFilter',null,'')}${used.map(t=>gyChip(f===t,t,'gyFilter')).join('')}</div>`:''}
  <div class="list">${shown.map(gySaved).join('')||`<div class="empty">Belum ada gaya. Tampal link video rujukan di atas.</div>`}</div>`}

A.gyFormTag=el=>{gyKeep();const d=ui.gyDraft=Object.assign({tags:[]},ui.gyDraft);const t=el.dataset.x;d.tags=d.tags.includes(t)?d.tags.filter(x=>x!==t):d.tags.concat(t);render(true)};
A.gyFilter=el=>{ui.gyFilter=el.dataset.x;render(true)};
A.gySend=()=>{gyKeep();const d=ui.gyDraft||{};const link=String(d.link||'').trim();if(!isUrl(link)){toast('Tampal link video dulu (mula dengan https://)');return}
  const id='g'+uid();save('gaya',Object.assign({id,link,note:String(d.note||'').trim(),fx:gyParseFx(d.fx),tags:d.tags||[],status:'scan',msg:'Menunggu Mac mini'},d.up?{upload:d.up.id,srcName:d.up.name}:{}));
  ui.gyDraft={};ui.gyBusy=1;render(true);
  studioJob('gaya_scan',{id},3*60000).then(()=>toast('Mac mini mula scan. Kad keluar dalam beberapa minit')).catch(e=>{toast('Mac mini tak jawab: '+String((e&&e.message)||'').slice(0,80));save('gaya',Object.assign({},get('gaya',id),{status:'error',msg:'Mac mini tak jawab. Semak Mac mini hidup, kemudian Cuba lagi.'}))})
   .finally(()=>{ui.gyBusy=0;render()})};
A.gyRetry=el=>{const g=get('gaya',el.dataset.id);save('gaya',Object.assign({},g,{status:'scan',msg:'Menunggu Mac mini'}));
  studioJob('gaya_scan',{id:g.id},3*60000).catch(e=>toast('Mac mini tak jawab: '+String((e&&e.message)||'').slice(0,80)))};
A.gySave=el=>{const g=get('gaya',el.dataset.id);save('gaya',Object.assign({},g,{status:'simpan',match:null,savedAt:Date.now()}));toast('Gaya "'+g.name+'" disimpan')};
A.gyMerge=el=>{const g=get('gaya',el.dataset.id);const t=get('gaya',g.match.id);if(!t){toast('Gaya asal dah tiada');return}
  const fx=(t.effects||[]).concat((g.effects||[]).map(e=>Object.assign({},e,{from:g.id})));
  save('gaya',Object.assign({},t,{refs:(t.refs||[]).concat(g.refs||[]),tags:[...new Set((t.tags||[]).concat(g.tags||[]))],effects:fx,
    notes:(t.notes||[]).concat([{at:Date.now(),why:g.match.why||'',card:g.card||{}}])}),true);
  del('gaya',g.id);toast('Ditambah sebagai rujukan ke "'+t.name+'"')};
A.gyDel=el=>{const g=get('gaya',el.dataset.id);
  const inUse=S.gaya.some(x=>x.id!==g.id&&(x.refs||[]).some(r=>g.scan&&r.scan===g.scan));
  confirmBox('Buang gaya "'+(g.name||'ni')+'"? Scan sheet dalam Drive ke Trash.',()=>{const folder=inUse?'':g.folder||'';del('gaya',g.id);
    if(folder)studioJob('gaya_del',{id:g.id,folder},60000).catch(()=>{})},'Ya, buang')};
A.gyRename=el=>{const g=get('gaya',el.dataset.id);modal(`<h2>Tukar nama gaya</h2><label class="f"><span>Nama pendek, senang ingat</span><input class="inp" id="gyRn" value="${esc(g.name||'')}" maxlength="30"></label>
  <div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="gyRenameOk" data-id="${esc(g.id)}">Simpan</button></div>`)};
A.gyRenameOk=el=>{const n=$('#gyRn').value.trim();if(!n){toast('Isi nama');return}
  if(S.gaya.some(x=>x.id!==el.dataset.id&&x.status==='simpan'&&nrm(x.name)===nrm(n))){toast('Nama tu dah ada');return}
  save('gaya',Object.assign({},get('gaya',el.dataset.id),{name:n}));closeModal();toast('Nama ditukar')};
A.gyTag=el=>{const g=get('gaya',el.dataset.id);const t=el.dataset.x;const tags=(g.tags||[]).includes(t)?g.tags.filter(x=>x!==t):(g.tags||[]).concat(t);
  if(!gyTags().includes(t))saveSettings({gayaTags:gyTags().concat(t)});save('gaya',Object.assign({},g,{tags}))};
A.gyTagPick=el=>{gyKeep();const id=el.dataset.id||'';modal(`<h2>Tag baru</h2><label class="f"><span>Nama tag</span><input class="inp" id="gyTn" placeholder="cth. Staycation" maxlength="24"></label>
  ${id?`<div class="chips" style="margin:6px 0 12px">${gyTags().filter(t=>!(get('gaya',id).tags||[]).includes(t)).map(t=>gyChip(false,t,'gyTagOk',id)).join('')}</div>`:''}
  <div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="gyTagOk" data-id="${esc(id)}">Tambah</button></div>`)};
A.gyTagOk=el=>{const t=(el.dataset.x||($('#gyTn')&&$('#gyTn').value)||'').trim().replace(/\s+/g,' ');if(!t){toast('Isi nama tag');return}
  const exist=gyTags().find(x=>nrm(x)===nrm(t));const tag=exist||t;if(!exist)saveSettings({gayaTags:gyTags().concat(tag)});
  const id=el.dataset.id;if(id){const g=get('gaya',id);if(!(g.tags||[]).includes(tag))save('gaya',Object.assign({},g,{tags:(g.tags||[]).concat(tag)}),true)}
  else{const d=ui.gyDraft=Object.assign({tags:[]},ui.gyDraft);if(!d.tags.includes(tag))d.tags=d.tags.concat(tag)}
  closeModal();render(true)};
A.gyFx=el=>{const g=get('gaya',el.dataset.id);save('gaya',Object.assign({},g,{effects:(g.effects||[]).map(e=>e.id===el.dataset.x?Object.assign({},e,{on:e.on===false}):e)}))};
A.gyCopy=el=>copyText('edit gaya '+el.dataset.x,'Dicopy. Paste dalam chat edit');
