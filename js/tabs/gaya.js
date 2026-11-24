/* ---------- INSPIRATION › RESIPI STYLE (dulu Editor › Style / Tiru Gaya) ----------
   Mira tampal link (TikTok / IG / FB / Drive / Threads) atau upload fail video. Mac mini (job gaya_scan): yt-dlp, transkrip
   bahasa asal, scene cut, 1 frame sesaat, kemudian Claude Opus (low) tulis Resipi Style. Doc `gaya/<id>`:
   status scan (step download | analyse) → semak (siap) | error (step = tempat gagal). Suka = status simpan + like 1
   (jadi rujukan edit akan datang, dibaca skill edit-reel), tak suka = like -1. "Guna style ni" = job edit_now + gaya. */
const GY_TAGS=['Hotel','Vlog','Talking head','Affiliate','Unboxing','Resepi','Review','Before/After','Tutorial'];
const GY_F=[['hook','Hook'],['cut','Rentak cut'],['text','Teks'],['font','Font'],['color','Warna'],['transition','Transition'],['zoom','Zoom'],['audio','Muzik / SFX'],['cta','CTA'],['length','Panjang']];
const gyTags=()=>((S.settings||{}).gayaTags)||GY_TAGS;
const gyImg=(id,w)=>id?`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${w||1200}`:'';
const gyDView=id=>'https://drive.google.com/file/d/'+encodeURIComponent(id)+'/view';
const gyChip=(on,label,act,id,x)=>`<button type="button" class="chip${on?' on':''}" data-act="${act}"${id?` data-id="${esc(id)}"`:''} data-x="${esc(x==null?label:x)}" aria-pressed="${on?'true':'false'}">${esc(label)}</button>`;
const GY_UP='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v10H4V10zM7 10l4-7c1.5 0 2.5 1 2.5 2.5V9h5a2 2 0 0 1 2 2.4l-1.3 6.8a2 2 0 0 1-2 1.8H7"/></svg>';
const GY_DN=GY_UP.replace('aria-hidden','style="transform:rotate(180deg)" aria-hidden');
const gyLiked=g=>g.like===1||(g.like==null&&g.status==='simpan');
const gyHost=u=>{try{return new URL(u).hostname.replace(/^(www|vt|vm|m)\./,'')}catch(e){return 'link'}};
function inSegs(){const seg=ui.inSeg||'resipi';return `<div class="seg" style="margin-bottom:14px">${[['resipi','Resipi Style'],['board','Board']].map(([k,l])=>`<button type="button" class="${seg===k?'on':''}" data-act="inSeg" data-x="${k}">${l}</button>`).join('')}</div>`}
A.inSeg=el=>{gyKeep();ui.inSeg=el.dataset.x;render(true)};
function gyKeep(){if(!$('#gyN'))return;ui.gyDraft=Object.assign({},ui.gyDraft,{note:$('#gyN').value,fx:$('#gyF').value},$('#gyL')?{link:$('#gyL').value}:{})}
/* Upload terus ke Drive: Apps Script buka sesi resumable, phone hantar 8 MB setiap kali (tiada token Claude). */
A.gyUpload=el=>{const rid=(el&&el.dataset&&el.dataset.id)||'';pickFile('video/*',async f=>{gyKeep();if(rid)ui.gyDraft=Object.assign({},ui.gyDraft,{retry:rid});if(f.size>500*1048576){toast('Video lebih 500 MB. Potong dulu atau guna link');return}
  ui.gyUp={name:f.name,pct:0};render(true);
  const b64=blob=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=rej;r.readAsDataURL(blob)});
  try{const s=await studioCall('ustart',{name:f.name,mime:f.type||'video/mp4',size:f.size});const CH=8*1048576;let pos=0,id=null,tries=0;
    while(pos<f.size&&!id){try{const r=await studioCall('uchunk',{url:s.url,start:pos,total:f.size,b64:await b64(f.slice(pos,pos+CH))});
        if(r.id)id=r.id;else pos=r.next;tries=0}catch(e){if(++tries>3)throw e;await new Promise(r=>setTimeout(r,2000*tries))}
      ui.gyUp.pct=Math.min(100,Math.round((id?f.size:pos)/f.size*100));render()}
    if(!id)throw new Error('Drive tak bagi id fail');
    ui.gyDraft=Object.assign({},ui.gyDraft,{link:'https://drive.google.com/file/d/'+id+'/view',up:{id,name:f.name,size:f.size}});ui.gyUp=null;A.gySend()}
  catch(e){toast('Upload tak jadi: '+String((e&&e.message)||'semak internet').slice(0,80))}
  finally{ui.gyUp=null;render(true)}})};
A.gyUpClear=()=>{gyKeep();const d=ui.gyDraft||{};if(d.up)studioCall('file_delete',{id:d.up.id}).catch(()=>{});ui.gyDraft=Object.assign({},d,{up:null,link:''});render(true)};
function gyParseFx(s){return String(s||'').split(/[,;\n]+/).map(x=>x.trim()).filter(Boolean).slice(0,3).map(x=>{const [a,b]=x.split(/\s*[-–]\s*/);return {a:a||'',b:b||''}}).filter(r=>/^\d/.test(r.a))}


/* Resipi Style: 8 bahagian ikut permintaan Mira (24 Nov) */
function gyResipi(g){const c=g.card||{};const j=(...a)=>a.filter(Boolean).join(' ');
  const fx=[c.transition,c.zoom].filter(Boolean).join(' ');
  const rows=g.kind==='teks'?[['Hook',c.hook],['Susunan cerita',null],['Gaya ayat',c.text],['Mesej utama',c.message],['Kenapa menarik',c.why],['Penutup',c.cta],['Panjang',c.length]]
   :[['Hook 3 saat pertama',c.hook],['Susunan cerita',null],['Rentak / purata cut',c.cut],['Gaya teks',j(c.text,c.font&&'Font: '+c.font)],['Effect & transition',fx],['Sound effect & muzik',c.audio],['Mesej utama',c.message],['Kenapa menarik',c.why],['Warna',c.color],['Penutup / CTA',c.cta],['Panjang',c.length]];
  return `<div class="rsbody">${rows.map(([l,v])=>l==='Susunan cerita'?((c.beats||[]).length?`<div class="rsrow"><b>${l}</b><ol>${c.beats.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div>`:''):v?`<div class="rsrow"><b>${l}</b><p>${esc(v)}</p></div>`:'').join('')}</div>`}
function gyEffects(g){const L=g.effects||[];if(!L.length)return '';
  return `<p class="eyebrow" style="margin:14px 0 6px">Effect dari video ni · ${L.filter(e=>e.on!==false).length} dipakai</p><div class="list gyfx">${L.map(e=>`<div class="gyfxrow${e.on===false?' off':''}">
    ${e.strip?`<a href="${esc(gyImg(e.strip,1600))}" target="_blank" rel="noopener" class="gystrip"><img src="${esc(gyImg(e.strip,600))}" alt="Jalur effect ${esc(e.name)}" loading="lazy" referrerpolicy="no-referrer"></a>`:''}
    <div style="flex:1;min-width:0"><strong>${esc(e.name)}</strong> <span class="meta">${esc(e.at||'')}</span><div class="meta">${esc(e.look||'')}</div></div>
    <div class="btns">${e.prev?`<a class="btn sm" href="${esc(gyDView(e.prev))}" target="_blank" rel="noopener">▶</a>`:''}<button class="btn sm${e.on===false?'':' solid tab'}" data-act="gyFx" data-id="${esc(g.id)}" data-x="${esc(e.id)}">${e.on===false?'Tak pakai':IC.check+'Pakai'}</button></div></div>`).join('')}</div>`}
function gyTagRow(g){const sug=(g.tagsSuggest||[]).filter(t=>!(g.tags||[]).includes(t));
  return `<div class="chips">${(g.tags||[]).map(t=>gyChip(true,t,'gyTag',g.id)).join('')}${sug.map(t=>gyChip(false,'+ '+t,'gyTag',g.id,t)).join('')}<button type="button" class="chip" data-act="gyTagPick" data-id="${esc(g.id)}">+ Tag</button></div>`}
function gyThumb(g){const id=g.thumb||g.scan;const src=((g.refs||[])[0]||{}).link||g.link;
  const pic=id?`<img src="${esc(gyImg(id,400))}" alt="" loading="lazy" referrerpolicy="no-referrer"${g.thumb?'':' style="object-position:0 0;transform:scale(2.2);transform-origin:0 0"'}>`:`<span>${g.kind==='teks'?'Aa':IC.inspiration||''}</span>`;
  return isUrl(src)?`<a class="rsthumb" href="${esc(src)}" target="_blank" rel="noopener" aria-label="Buka link asal">${pic}</a>`:`<span class="rsthumb">${pic}</span>`}
const gyLinkRow=g=>{const L=(g.refs&&g.refs.length?g.refs:[{link:g.link}]).filter(r=>isUrl(r.link));
  return L.map((r,i)=>`<a class="rslink" href="${esc(r.link)}" target="_blank" rel="noopener">${IC.ext}${L.length>1?(i+1)+'. ':''}Link asal · ${esc(gyHost(r.link))}</a>`).join('')||(g.upload||g.srcName?`<span class="meta">Fail upload${g.srcName?' · '+esc(g.srcName):''}</span>`:'')};

function gyCard(g){
  if(g.status==='scan'){const an=g.step==='analyse';const stale=Date.now()-(g.updated||0)>25*60000;
    return `<div class="card glass rscard"><span class="rsthumb"><i class="spin"></i></span><div class="rsmain"><div class="rowh" style="align-items:center"><h3 style="flex:1">${an?'Analysing':'Downloading'}</h3><span class="pill" style="--pc:${an?'var(--c)':'var(--warn)'}"><i class="spin"></i>${an?'Analysing':'Downloading'}</span></div>
      <div class="meta">${esc(g.msg||'Menunggu Mac mini')}</div><div class="rssteps"><i class="on"></i><i class="${an?'on':''}"></i><i></i></div>${gyLinkRow(g)}
      ${stale?`<div class="btns" style="margin-top:8px"><span class="meta" style="flex:1">Dah lebih 25 minit tanpa berita.</span><button class="btn sm" data-act="gyRetry" data-id="${esc(g.id)}">Cuba lagi</button><button class="btn icon sm bad" data-act="gyDel" data-id="${esc(g.id)}" aria-label="Buang">${IC.trash}</button></div>`:''}</div></div>`}
  if(g.status==='error'){const dl=g.step!=='analyse';
    return `<div class="card glass rscard bad"><span class="rsthumb"><span>!</span></span><div class="rsmain"><div class="rowh" style="align-items:center"><h3 style="flex:1">${dl?'Link gagal download':'Analisis gagal'}</h3><span class="pill" style="--pc:var(--bad)">Gagal</span></div>
      <p class="rserr">${esc(g.msg||'Tak tahu sebabnya. Cuba lagi.')}</p>${gyLinkRow(g)}
      <div class="btns" style="margin-top:10px"><button class="btn sm solid tab" data-act="gyRetry" data-id="${esc(g.id)}">Cuba lagi</button>${dl?`<button class="btn sm" data-act="gyUpload" data-id="${esc(g.id)}">${IC.up}Upload video</button>`:''}<span style="flex:1"></span><button class="btn icon sm bad" data-act="gyDel" data-id="${esc(g.id)}" aria-label="Buang">${IC.trash}</button></div></div></div>`}
  const c=g.card||{};const lk=gyLiked(g),dk=g.like===-1;const m=g.match&&get('gaya',g.match.id)&&g.match.pct>=60&&g.status!=='simpan'?g.match:null;const busy=(ui.gyUse||{})[g.id];
  return `<div class="card glass rscard${dk?' off':''}">${gyThumb(g)}<div class="rsmain">
    <div class="rowh" style="align-items:center"><span class="gyname sm" style="flex:1;min-width:0">${esc(g.name||'Resipi baru')}</span><span class="pill" style="--pc:var(--ok)">Siap</span></div>
    <div class="meta">${esc(c.summary||'')}</div>${gyLinkRow(g)}
    <div class="btns rsact"><button class="btn icon sm${lk?' solid tab':''}" data-act="gyLike" data-id="${esc(g.id)}" data-x="1" aria-pressed="${lk}" aria-label="Suka style ni" title="Suka: jadi rujukan edit akan datang">${GY_UP}</button><button class="btn icon sm${dk?' solid bad':''}" data-act="gyLike" data-id="${esc(g.id)}" data-x="-1" aria-pressed="${dk}" aria-label="Tak suka style ni" title="Tak suka: Claude elak gaya ni">${GY_DN}</button><span style="flex:1"></span>
      <button class="btn sm solid tab" data-act="gyUse" data-id="${esc(g.id)}"${busy?' disabled':''}>${busy?'<i class="spin"></i>Buka sesi...':'Guna style ni'}</button></div></div>
    <details class="rsmore"${ui.gyOpen===g.id?' open':''}><summary data-act="gyOpen" data-id="${esc(g.id)}"><span>Resipi Style</span><span class="ic chev">${IC.chev}</span></summary>
      ${gyResipi(g)}${g.kind==='teks'&&g.text?`<details class="gybeats"><summary class="meta">Teks asal (rujukan sahaja, jangan salin)</summary><p style="white-space:pre-wrap;font-size:13px">${esc(g.text)}</p></details>`:''}
      ${gyEffects(g)}${gyTagRow(g)}
      ${g.scan?`<details class="gybeats"><summary class="meta">Scan frame</summary><a href="${esc(gyImg(g.scan,1800))}" target="_blank" rel="noopener" class="gyscan"><img src="${esc(gyImg(g.scan))}" alt="Scan sheet 12 frame" loading="lazy" referrerpolicy="no-referrer"></a></details>`:''}
      ${m?`<div class="gymatch"><b>Hampir sama dengan ${esc(m.name)} (${m.pct}%)</b><span class="meta">${esc(m.why||'')}</span><div class="btns"><button class="btn sm" data-act="gyMerge" data-id="${esc(g.id)}">Gabung ke ${esc(m.name)}</button></div></div>`:''}
      ${(g.used||[]).length?`<p class="meta" style="margin:10px 0 0">Dah diguna: ${esc(g.used.map(u=>u.folder).slice(-3).join(', '))}</p>`:''}
      <div class="btns" style="margin-top:12px"><button class="btn sm" data-act="gyRename" data-id="${esc(g.id)}">${IC.edit}Tukar nama</button><span style="flex:1"></span>${g.usage?`<span class="meta">${(((g.usage.in||0)+(g.usage.out||0)+(g.usage.cache||0))/1000).toFixed(0)}k token</span>`:''}<button class="btn icon sm bad" data-act="gyDel" data-id="${esc(g.id)}" aria-label="Buang resipi">${IC.trash}</button></div>
    </details></div>`}

function gyView(){const d=ui.gyDraft||{};const f=ui.gyFilter||'';
  const all=S.gaya.slice().sort((a,b)=>(b.created||0)-(a.created||0));
  const run=all.filter(g=>g.status==='scan'||g.status==='error');
  const done=all.filter(g=>g.status==='semak'||g.status==='simpan');
  const used=[...new Set(done.flatMap(g=>g.tags||[]))];
  const pass=g=>!f||(f==='♥'?gyLiked(g):(g.tags||[]).includes(f));
  const shown=done.filter(g=>g.like!==-1&&pass(g));const bad=done.filter(g=>g.like===-1);
  return `<div class="card glass rspaste"><label class="eyebrow" for="gyL">Paste link</label>
    ${ui.gyUp?`<div class="gyup"><i class="spin"></i><span style="flex:1">Upload ${esc(ui.gyUp.name)}… ${ui.gyUp.pct}%</span></div><div class="gybar"><i style="width:${ui.gyUp.pct}%"></i></div>`
    :`<div class="rsin"><input class="inp" id="gyL" value="${esc(d.link||'')}" placeholder="TikTok, IG, FB, Threads, Drive" inputmode="url" autocapitalize="off" autocorrect="off" enterkeyhint="send"><button class="btn solid tab" data-act="gySend"${ui.gyBusy?' disabled':''}>${ui.gyBusy?'<i class="spin"></i>':''}Hantar</button></div>
    <div class="btns rsbtn" style="margin-top:10px"><button type="button" class="btn sm" data-act="gyPaste">Paste</button><button type="button" class="btn sm" data-act="gyUpload">${IC.up}Upload video</button><span style="flex:1"></span>${tok(TOK.gaya,'Claude tulis Resipi Style sekali')}</div>
    <details class="gybeats"${d.note||d.fx?' open':''}><summary class="meta">Pilihan lagi</summary>
      <label class="f"><span>Nota (tak wajib)</span><input class="inp" id="gyN" value="${esc(d.note||'')}" placeholder="cth. suka cara teks pop masuk ikut beat"></label>
      <label class="f"><span>Masa effect yang nak ditiru (maks 3)</span><input class="inp" id="gyF" value="${esc(d.fx||'')}" placeholder="cth. 0:07-0:09, 0:15"></label></details>`}</div>
  ${run.length?`<div class="list" style="margin-top:14px">${run.map(gyCard).join('')}</div>`:''}
  ${done.length?`<div class="chips" style="margin:18px 0 10px">${gyChip(!f,'Semua · '+(done.length-bad.length),'gyFilter',null,'')}${gyChip(f==='♥','Suka · '+done.filter(gyLiked).length,'gyFilter',null,'♥')}${used.map(t=>gyChip(f===t,t,'gyFilter')).join('')}</div>`:''}
  <div class="list">${shown.map(gyCard).join('')||(run.length?'':`<div class="empty">${done.length?'Tiada resipi dalam tapisan ni.':'Belum ada resipi. Paste link video yang kau suka di atas.'}</div>`)}</div>
  ${bad.length?`<details class="col" style="margin-top:18px"><summary class="eyebrow" style="cursor:pointer">Tak suka · ${bad.length} (Claude elak gaya ni)</summary><div class="list" style="margin-top:10px">${bad.map(gyCard).join('')}</div></details>`:''}`}

A.gyOpen=el=>{gyKeep();ui.gyOpen=ui.gyOpen===el.dataset.id?null:el.dataset.id;render(true)};
A.gyPaste=async()=>{try{const t=(await navigator.clipboard.readText()||'').trim();const m=t.match(/https?:\/\/\S+/);if(!m){toast('Tiada link dalam clipboard. Copy link video dulu');return}$('#gyL').value=m[0];gyKeep();toast('Link ditampal. Tekan Hantar')}
  catch(e){toast('Tekan lama dalam kotak dan pilih Paste');$('#gyL').focus()}};
/* Suka = rujukan edit akan datang (status simpan, dibaca skill edit-reel). Tekan sekali lagi = neutral. */
A.gyLike=el=>{const g=get('gaya',el.dataset.id);const v=+el.dataset.x;const cur=gyLiked(g)?1:g.like===-1?-1:0;const like=cur===v?0:v;
  save('gaya',Object.assign({},g,{like,status:like===1?'simpan':'semak',likedAt:Date.now()}));
  toast(like===1?'Suka. Jadi rujukan edit akan datang':like===-1?'Tak suka. Claude elak gaya ni':'Tanda dibuang')};
/* Guna style ni: pilih folder footage dalam CLAUDE EDITS → Mac mini buka sesi Claude (edit_now + gaya) → draf masuk Editor PWA */
A.gyUse=el=>{const g=get('gaya',el.dataset.id);const off=macOff();const L=toEditFolders().filter(x=>!isPublishedName(x.name)&&!HELPER_DIR.test(x.name));
  const by={};L.forEach(x=>(by[x.stage]=by[x.stage]||[]).push(x));const st=Object.keys(by).sort((a,b)=>(+fno(a))-(+fno(b)));
  modal(`<h2>Guna style "${esc(g.name||'')}"</h2><p class="meta" style="margin:0 0 12px">Pilih folder footage. Claude tiru gaya dan susunan sahaja, bukan ayat atau footage asal. Draf masuk Editor dulu; final ke 00. TO POST FINAL lepas kau lulus.</p>
    ${off?`<div class="banner glass">Mac mini tak jawab sejak ${esc(off)}. Hidupkan Mac mini dulu.</div>`:''}
    ${st.length?`<div class="rspick">${st.map(s=>`<p class="eyebrow">${esc(s)}</p>${by[s].map(x=>`<button type="button" class="rsfold" data-act="gyUseGo" data-id="${esc(g.id)}" data-x="${esc(x.stage)}" data-n="${esc(x.name)}" data-k="${esc(x.key)}"${off?' disabled':''}><b>${esc(x.name)}</b><span class="meta">${x.clips||0} klip</span></button>`).join('')}`).join('')}</div>`:`<div class="empty">Tiada folder footage dalam CLAUDE EDITS. Upload footage dari tab Shoot dulu.</div>`}
    <div class="btns" style="justify-content:flex-end;margin-top:12px">${tok(TOK.edit,'Sesi edit Claude')}<button class="btn" data-act="closeModal">Batal</button></div>`)};
A.gyUseGo=el=>{const id=el.dataset.id,stage=el.dataset.x,name=el.dataset.n,key=el.dataset.k;const g=get('gaya',id);
  confirmBox('Edit "'+name+'" ikut style "'+(g.name||'')+'"? Mac mini buka sesi Claude sekarang.',async()=>{closeModal();ui.gyUse=Object.assign({},ui.gyUse,{[id]:1});render();
    try{await studioJob('edit_now',{stage,name,key,gaya:id},3*60000);toast('Sesi Claude dibuka di Mac mini. Draf akan masuk Studio › Editor')}
    catch(e){toast('Tak dapat buka sesi: '+String((e&&e.message)||'semak Mac mini').slice(0,90))}
    finally{const b=Object.assign({},ui.gyUse);delete b[id];ui.gyUse=b;render()}},'Ya, edit')};
A.gyFilter=el=>{ui.gyFilter=el.dataset.x;render(true)};
A.gySend=()=>{gyKeep();const d=ui.gyDraft||{};const link=((String(d.link||'').match(/https?:\/\/\S+/)||[])[0]||'').trim();if(!isUrl(link)){toast('Paste link dulu (mula dengan https://)');return}
  if(!d.up&&S.gaya.some(g=>g.link===link&&g.status!=='error')){toast('Link ni dah ada dalam senarai');return}
  const old=d.retry&&get('gaya',d.retry);const id=old?old.id:'g'+uid();
  save('gaya',Object.assign({},old||{},{id,link,note:String(d.note||'').trim(),fx:gyParseFx(d.fx),tags:(old&&old.tags)||[],status:'scan',step:'download',msg:'Menunggu Mac mini'},d.up?{upload:d.up.id,srcName:d.up.name}:{}));
  ui.gyDraft={};ui.gyBusy=1;render(true);
  studioJob('gaya_scan',{id},3*60000).then(()=>toast('Mac mini mula download. Resipi siap dalam beberapa minit')).catch(e=>{toast('Mac mini tak jawab: '+String((e&&e.message)||'').slice(0,80));save('gaya',Object.assign({},get('gaya',id),{status:'error',step:'download',msg:'Mac mini tak jawab. Semak Mac mini hidup, kemudian tekan Cuba lagi.'}))})
   .finally(()=>{ui.gyBusy=0;render()})};
A.gyRetry=el=>{const g=get('gaya',el.dataset.id);save('gaya',Object.assign({},g,{status:'scan',step:'download',msg:'Menunggu Mac mini'}));
  studioJob('gaya_scan',{id:g.id},3*60000).catch(e=>toast('Mac mini tak jawab: '+String((e&&e.message)||'').slice(0,80)))};
A.gyMerge=el=>{const g=get('gaya',el.dataset.id);const t=get('gaya',g.match.id);if(!t){toast('Gaya asal dah tiada');return}
  const fx=(t.effects||[]).concat((g.effects||[]).map(e=>Object.assign({},e,{from:g.id})));
  save('gaya',Object.assign({},t,{refs:(t.refs||[]).concat(g.refs||[]),tags:[...new Set((t.tags||[]).concat(g.tags||[]))],effects:fx,
    notes:(t.notes||[]).concat([{at:Date.now(),why:g.match.why||'',card:g.card||{}}])}),true);
  del('gaya',g.id);toast('Ditambah sebagai rujukan ke "'+t.name+'"')};
A.gyDel=el=>{const g=get('gaya',el.dataset.id);
  const inUse=S.gaya.some(x=>x.id!==g.id&&(x.refs||[]).some(r=>g.scan&&r.scan===g.scan));
  confirmBox('Buang resipi "'+(g.name||'ni')+'"? Gambar scan dalam Drive ke Trash.',()=>{const folder=inUse?'':g.folder||'';del('gaya',g.id);
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

