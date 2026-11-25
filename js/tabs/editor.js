/* ---------- EDITOR ---------- */
const ED_STATUS=['Storyboard','Draf','Tunggu semakan','Sedia render','Siap'];
/* 25 Nov 2026 (Mira): senarai Editor rupa baru (gelap kaca + teal, sama dengan editor). Lakaran diluluskan: claude.ai/artifact/D2qnWv9iCXEzXkZf1CTgDw
   Kotak New Video di atas (dari phone = muat naik ke Drive lalu job ed_new; dari Mac mini = folder footage), penapis, Sambung edit, kad bergambar.
   Gaya dalam css/editor-list.css (kelas .edlist / .el-*), hidup hanya di tab ni. Satu senarai: rekod tracker (S.editor, dari Claude) digabung dengan doc edpwa. */
const EL={search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',book:'<svg viewBox="0 0 24 24"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M9 9h6M9 13h6"/></svg>',
  plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',x:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',dots:'<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/></svg>',
  chev:'<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',cut:'<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8.2 7.5 20 18M8.2 16.5 20 6"/></svg>',play:'<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10-6.5z"/></svg>'};
const edHue=s=>{let h=0;for(const ch of String(s||''))h=(h*31+ch.charCodeAt(0))%360;return h};
function edItems(){const pubPw=x=>edPublished({name:x.title,folder:String(x.dir||'').split('/CLAUDE EDITS/')[1]||''});const used=new Set(),out=[];
  S.editor.filter(e=>!edPublished(e)).forEach(e=>{const pw=edPwaFor(e);if(pw)used.add(pw.id);out.push({k:'t:'+e.id,e,pw,name:e.name||'Video',own:false,done:edDone(e),at:Math.max(e.updated||0,(pw&&pw.updated)||0)})});
  (S.edpwa||[]).filter(x=>!pubPw(x)&&!used.has(x.id)).forEach(pw=>out.push({k:'p:'+pw.id,e:null,pw,name:pw.title||pw.id,own:pw.src==='sendiri',done:false,at:pw.updated||0}));
  (ui.edWait||[]).filter(w=>Date.now()-w.at<15*6e4&&!(S.edpwa||[]).some(x=>x.src==='sendiri'&&(x.created||0)>w.at-6e4&&nrm(x.title||'')===nrm(w.name))).forEach(w=>out.push({k:'w:'+w.at,e:null,pw:{status:'proses',pct:1,step:'Menunggu Mac mini',title:w.name},name:w.name,own:true,done:false,at:w.at}));
  return out.sort((a,b)=>b.at-a.at)}
function edStat(it){const pw=it.pw,e=it.e,d=pw&&pw.draft;
  if(pw&&pw.status==='proses')return{t:'Disediakan '+Math.round(pw.pct||0)+'%',c:'var(--el-warn)',pct:Math.max(3,pw.pct||0),sub:pw.step||'Mac mini sedang sediakan'};
  if(pw&&pw.status==='error')return{t:'Ralat',c:'var(--el-bad)',sub:String(pw.msg||'Tak jadi').slice(0,80)};
  if(d&&d.status==='proses')return{t:'Render draf…',c:'var(--el-warn)'};
  if(d&&d.status==='error')return{t:'Draf gagal',c:'var(--el-bad)'};
  if(e)return{t:edMulti(e)?`${(e.finals||[]).length}/${e.videos} siap`:(e.status||'Draf'),c:/siap|sedia/i.test(e.status||'')?'var(--el-ok)':''};
  if(d&&d.id)return{t:'Draf sedia',c:'var(--el-ok)'};
  return{t:'Sedia edit',c:'var(--el-teal)'}}
const edReady=it=>!!(it.pw&&it.pw.id&&it.pw.status!=='proses'&&it.pw.status!=='error');
/* gambar poster: fail poster.jpg projek dalam Drive (EDITOR PWA), diambil melalui ed_chunk dan disimpan dalam cache phone 'ed-posters' */
const EDP={url:{},q:[],busy:0};
function edPosterId(pw){const f=(pw&&pw.files)||{};if(f['poster.jpg'])return f['poster.jpg'];const k=Object.keys(f).filter(x=>/(^|\/)poster\.jpg$/.test(x)).sort()[0];return k?f[k]:''}
function edPosterPump(){while(EDP.busy<2&&EDP.q.length){const id=EDP.q.shift();EDP.busy++;(async()=>{try{const c=await caches.open('ed-posters');let r=await c.match('/edp/'+encodeURIComponent(id));
      if(!r){const j=await studioCall('ed_chunk',{id,start:0,len:900000});const bin=atob(j.b64||'');if(!bin.length)throw 0;const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
        r=new Response(new Blob([u],{type:'image/jpeg'}));await c.put('/edp/'+encodeURIComponent(id),r.clone())}
      EDP.url[id]=URL.createObjectURL(await r.blob());document.querySelectorAll('.edlist [data-edp="'+id+'"]').forEach(el=>{el.style.backgroundImage='url('+EDP.url[id]+')';el.classList.add('has')})}
    catch(e){EDP.url[id]=''}finally{EDP.busy--;edPosterPump()}})()}}
AFTER.editor=()=>{document.querySelectorAll('.edlist [data-edp]').forEach(el=>{const id=el.dataset.edp;if(id&&EDP.url[id]===undefined){EDP.url[id]=null;EDP.q.push(id)}});edPosterPump();
  const dt=document.querySelector('.edlist details[data-eldone]');if(dt)dt.addEventListener('toggle',()=>{ui.edDoneOpen=dt.open})};
function edThumb(it,cls){const id=edPosterId(it.pw),u=id&&EDP.url[id];return `<span class="el-th${u?' has':''}${cls?' '+cls:''}" style="--h:${edHue(it.name)}${u?`;background-image:url(${u})`:''}"${id?` data-edp="${esc(id)}"`:''}><span class="ini">${esc(String(it.name||'V').trim().charAt(0).toUpperCase())}</span>`}
function edCard(it){const st=edStat(it),ok=edReady(it),tag=ok?'a':'div',href=ok?` href="editor/?v=${encodeURIComponent(it.pw.id)}"`:'';   /* butang ⋯ di LUAR pautan, supaya ketik ⋯ tak buka editor */
  return `<div class="el-card"><${tag} class="lk"${href}>${edThumb(it)}<span class="el-pill" style="${st.c?`--pc:${st.c}`:''}">${esc(st.t)}</span></span><div class="bd"><h4>${esc(it.name)}</h4>${st.pct?`<div class="el-bar"><i style="width:${Math.min(100,st.pct)}%"></i></div>`:''}<span class="el-meta">${esc(st.sub||(it.at?agoFmt(it.at):''))}</span></div></${tag}>${it.k[0]==='w'?'':`<button class="el-dots" data-act="edMenu" data-k="${esc(it.k)}" aria-label="Lagi untuk ${esc(it.name)}">${EL.dots}</button>`}</div>`}
V.editor=()=>{const all=edItems().filter(it=>hit('ed',it.name,(it.e&&it.e.style)||'',(it.e&&it.e.status)||''));const live=all.filter(it=>!it.done),done=all.filter(it=>it.done);
  const F=ui.edF||'all',sets={all:live,own:live.filter(it=>it.own),claude:live.filter(it=>!it.own)};const q=(ui.q.ed||'').trim();
  const cont=F==='all'&&!q?live.find(edReady):null,list=(sets[F]||[]).filter(it=>it!==cont);
  const chip=(k,l,n)=>`<button class="el-chip" data-act="edFilt" data-f="${k}" aria-pressed="${F===k}">${l}<i>${n}</i></button>`;
  return `<div class="edlist">
   <div class="el-top"><b>Editor</b><button class="el-ib" data-act="edSearch" aria-pressed="${!!(ui.edQ||q)}" aria-label="Cari">${EL.search}</button><button class="el-ib" data-act="edHow" aria-label="Cara edit setiap folder">${EL.book}</button></div>
   ${ui.edQ||q?`<div class="el-search">${EL.search}<input class="inp" id="q-ed" data-q="ed" value="${esc(ui.q.ed||'')}" placeholder="Cari video, gaya atau status" autocomplete="off"></div>`:''}
   <button class="el-new" data-act="edNewOpen"><span class="p">${EL.plus}</span><span><b>New Video</b><span>Tambah video dari phone, atau pilih folder di Mac mini</span></span></button>
   <div class="el-chips">${chip('all','Semua',live.length)}${chip('own','Edit sendiri',sets.own.length)}${chip('claude','Dari Claude',sets.claude.length)}${chip('done','Siap',done.length)}</div>
   ${cont?`<p class="el-eye">Sambung edit</p><div class="el-cont">${edThumb(cont)}</span><div class="inf"><h3>${esc(cont.name)}</h3><span class="el-meta">${esc([cont.e&&cont.e.style,cont.at?'diedit '+agoFmt(cont.at):''].filter(Boolean).join(' · '))}</span>
      <div class="el-btns"><a class="el-btn go" href="editor/?v=${encodeURIComponent(cont.pw.id)}">${EL.cut}Buka editor</a>${cont.pw.draft&&cont.pw.draft.status==='sedia'&&cont.pw.draft.id?`<a class="el-btn" href="https://drive.google.com/file/d/${encodeURIComponent(cont.pw.draft.id)}/view" target="_blank" rel="noopener">${EL.play}Draf</a>`:''}<button class="el-btn" data-act="edMenu" data-k="${esc(cont.k)}" aria-label="Lagi">${EL.dots}</button></div></div></div>`:''}
   ${F==='done'?'':`${cont?'<p class="el-eye">Semua video</p>':''}${list.length?`<div class="el-grid">${list.map(edCard).join('')}</div>`:(cont?'':`<div class="el-empty">${q?'Tiada video sepadan dengan carian.':'Tiada video lagi. Ketik New Video untuk mula.'}</div>`)}`}
   ${done.length?`<details class="el-more" data-eldone${ui.edDoneOpen||F==='done'?' open':''}><summary><span>Siap render · ${done.length} projek</span>${EL.chev}</summary><div class="rows">${done.map(it=>{const e=it.e;return `<div class="r"><div><strong>${esc(it.name)}</strong><span class="el-meta">${esc([e.folder||e.style,e.final?String(e.final).split('/').pop():''].filter(Boolean).join(' · '))}</span></div>${edReady(it)?`<a class="el-btn" href="editor/?v=${encodeURIComponent(it.pw.id)}">Editor</a>`:''}<button class="el-ib" data-act="edMenu" data-k="${esc(it.k)}" aria-label="Lagi">${EL.dots}</button></div>`}).join('')}</div></details>`:(F==='done'?'<div class="el-empty">Belum ada projek siap render.</div>':'')}
   <div class="el-foot"><button class="el-link" data-act="edAdd">Tambah rekod projek</button><a class="el-link" href="https://miracikcit.github.io/miracikcit-studio/editor/?app=1" target="_blank" rel="noopener">Editor app sendiri</a></div>
   ${ui.edNew?edNewSheet():''}</div>`};
A.edFilt=el=>{ui.edF=el.dataset.f;render(true)};
A.edSearch=()=>{ui.edQ=!ui.edQ;if(!ui.edQ)ui.q.ed='';render(true);const i=$('#q-ed');if(i)i.focus()};
/* ⋯ pada kad: semua tindakan lama (Chat Claude, draf, edit rekod, padam rekod) kekal di sini */
A.edMenu=el=>{const it=edItems().find(x=>x.k===el.dataset.k);if(!it)return;const e=it.e,pw=it.pw,st=edStat(it),d=pw&&pw.draft;
  modal(`<h2>${esc(it.name)}</h2><p class="meta" style="margin:-6px 0 14px">${esc([st.t,st.sub,e&&e.style].filter(Boolean).join(' · '))}</p><div class="btns" style="flex-direction:column;align-items:stretch">
   ${edReady(it)?`<a class="btn solid" href="editor/?v=${encodeURIComponent(pw.id)}">Buka editor</a>`:''}
   ${d&&d.status==='sedia'&&d.id?`<a class="btn" href="https://drive.google.com/file/d/${encodeURIComponent(d.id)}/view" target="_blank" rel="noopener">▶ Tengok draf</a>`:''}
   ${e&&isUrl(e.chat)?`<a class="btn" href="${esc(e.chat)}" target="_blank" rel="noopener">Chat Claude</a>`:''}
   ${e&&!edReady(it)&&isUrl(e.url)&&!/claude\.ai/.test(e.url)?`<a class="btn" href="${esc(e.url)}" target="_blank" rel="noopener">Buka link</a>`:''}
   ${e?`<button class="btn" data-act="edEdit" data-id="${e.id}">Edit rekod</button><button class="btn solid bad" data-act="edDel" data-id="${e.id}">Padam dari senarai</button>`:''}
   <button class="btn" data-act="closeModal">Tutup</button></div>`)};
A.edHow=()=>{const d=S.styles;if(!d){toast('Cara edit belum disync');return}
  modal(`<h2>Cara edit setiap folder</h2><p class="meta" style="margin:-6px 0 12px">Kemas kini ${fmtD(d.updatedAt)}</p><div class="list">${(d.folders||[]).map(r=>`<details class="col card glass"><summary><div class="rowh" style="align-items:center">${fnoBadge(fno(r.folder))}<div><h3>${esc(String(r.folder).replace(/^\d+\.\s*/,''))}</h3><div class="meta">${esc(r.summary||'')}</div></div><span class="ic chev">${IC.chev}</span></div></summary><div style="margin-top:12px"><span class="pill">Page editor: ${esc(r.pageEditor||'')}</span>${(r.points||[]).length?`<ul style="margin:10px 0 0;padding-left:18px">${r.points.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`:''}${r.note?`<p class="meta">${esc(r.note)}</p>`:''}</div></details>`).join('')}
   ${(d.common||[]).length?`<details class="col card glass"><summary><div class="rowh" style="align-items:center"><div><h3>Untuk semua folder</h3></div><span class="ic chev">${IC.chev}</span></div></summary><ul style="margin:12px 0 0;padding-left:18px">${d.common.map(p=>`<li>${esc(p)}</li>`).join('')}</ul></details>`:''}
   ${d.howto?`<details class="col card glass"><summary><div class="rowh" style="align-items:center"><div><h3>Cara minta edit</h3></div><span class="ic chev">${IC.chev}</span></div></summary><pre class="txt" style="margin-top:12px">${esc(d.howto)}</pre></details>`:''}</div>
   <div class="btns" style="justify-content:flex-end;margin-top:14px"><button class="btn" data-act="closeModal">Tutup</button></div>`)};

/* ---- New Video (25 Nov 2026): dari phone (Photos) atau folder Mac mini. Phone: setiap video dimuat naik ke Drive (ustart / uchunk 8 MB, sama dengan Tiru Gaya),
   kemudian job ed_new {name, files, whole}; Mac mini simpan ke CLAUDE EDITS/R3 OWN EDITS/<nama>/ dan sediakan editor. 0 token Claude. ---- */
const ED_MAXMB=500;
function edNewOpts(){const st=((S.sync.toedit||{}).stages)||[];return st.flatMap(s=>(s.items||[]).filter(i=>i.clips>0).map(i=>`<option value="${esc(s.name+'|'+i.name)}">${esc(s.name.replace(/^\d+\.\s*/,''))} / ${esc(i.name)} (${i.clips} klip)</option>`)).join('')}
function edNewSheet(){const n=ui.edNew,up=n.up,mb=f=>f.size>=1048576?Math.round(f.size/1048576)+' MB':Math.max(1,Math.round(f.size/1024))+' KB',opts=n.src==='mac'?edNewOpts():'';
  const body=n.src==='phone'?(n.files.length?`<div class="el-picks">${n.files.map((f,i)=>`<div class="el-pk"><video src="${n.urls[i]}#t=0.1" muted playsinline preload="metadata"></video><span class="sz">${mb(f)}</span>${up?'':`<button class="rm" data-act="edNewRm" data-i="${i}" aria-label="Buang ${esc(f.name)}">${EL.x}</button>`}</div>`).join('')}${up?'':`<button class="el-add" data-act="edNewPick" aria-label="Tambah video lagi">${EL.plus}</button>`}</div>`
      :`<button class="el-add wide" data-act="edNewPick">${EL.plus}<span>Pilih video dari Photos</span></button>`)
    :(opts?`<label class="el-fld"><span>Folder footage</span><select class="inp" id="enF">${opts}</select></label>`:`<div class="el-note">Tiada folder footage. Tekan Sync dalam tab Edit dulu.</div>`);
  return `<div class="el-dim" ${up?'':'data-act="edNewClose"'}></div><div class="el-sheet" role="dialog" aria-modal="true" aria-label="New Video">
   <div class="hd"><b>New Video</b>${up?'':`<button class="el-ib" data-act="edNewClose" aria-label="Tutup">${EL.x}</button>`}</div>
   <div class="el-src"><button data-act="edNewSrc" data-s="phone" aria-pressed="${n.src==='phone'}"${up?' disabled':''}><b>Dari phone</b><span>Pilih video dari Photos</span></button><button data-act="edNewSrc" data-s="mac" aria-pressed="${n.src==='mac'}"${up?' disabled':''}><b>Dari Mac mini</b><span>Pilih folder footage</span></button></div>
   ${body}
   <label class="el-fld"><span>Nama video</span><input class="inp" id="enN" value="${esc(n.name||'')}" placeholder="${n.src==='mac'?'Ikut nama folder':'Contoh: Unboxing mesin canai'}" autocomplete="off"${up?' disabled':''}></label>
   <div class="el-fld"><span>Masuk timeline</span><div class="el-seg"><button data-act="edNewWhole" data-w="1" aria-pressed="${!!n.whole}"${up?' disabled':''}>Seluruh klip</button><button data-act="edNewWhole" data-w="" aria-pressed="${!n.whole}"${up?' disabled':''}>6 saat pertama</button></div>
     <span class="el-note">${n.whole?'Seluruh klip masuk timeline (paling panjang 5 minit setiap klip).':'6 saat pertama setiap klip masuk timeline; boleh panjangkan dalam editor.'}</span></div>
   ${up?`<div class="el-prog" role="status"><div class="r"><span id="enPt">Muat naik ${up.k} daripada ${up.n}</span><b id="enPp">${up.pct}%</b></div><div class="el-bar"><i id="enPb" style="width:${Math.max(2,up.pct)}%"></i></div><span class="el-note">Jangan tutup Studio sampai muat naik siap.</span></div>`
     :`<button class="el-cta" data-act="edNewGo">Mula edit</button>`}</div>`}
function edNewKeep(){const n=ui.edNew;if(n&&$('#enN'))n.name=$('#enN').value}
function edNewFree(){const n=ui.edNew;if(n)(n.urls||[]).forEach(u=>{try{URL.revokeObjectURL(u)}catch(e){}})}
A.edNewOpen=()=>{ui.edNew={src:'phone',files:[],urls:[],name:'',whole:true,up:null};render(true)};
A.edNewClose=()=>{const n=ui.edNew;if(!n||n.up)return;edNewFree();ui.edNew=null;render(true)};
A.edNewSrc=el=>{const n=ui.edNew;if(!n||n.up)return;edNewKeep();n.src=el.dataset.s;render(true)};
A.edNewWhole=el=>{const n=ui.edNew;if(!n||n.up)return;edNewKeep();n.whole=!!el.dataset.w;render(true)};
A.edNewPick=()=>pickFile('video/*',fs=>{const n=ui.edNew;if(!n||n.up)return;edNewKeep();fs.forEach(f=>{if(n.files.length>=30)return;if(f.size>ED_MAXMB*1048576){toast(f.name+' lebih '+ED_MAXMB+' MB, dilangkau');return}if(!f.size)return;n.files.push(f);n.urls.push(URL.createObjectURL(f))});render(true)},true);
A.edNewRm=el=>{const n=ui.edNew;if(!n||n.up)return;edNewKeep();const i=+el.dataset.i;try{URL.revokeObjectURL(n.urls[i])}catch(e){}n.files.splice(i,1);n.urls.splice(i,1);render(true)};
A.edNewGo=async()=>{const n=ui.edNew;if(!n||n.up)return;edNewKeep();const nm=(n.name||'').trim();
  if(n.src==='mac'){const v=(($('#enF')||{}).value||'').split('|');if(!v[1]){toast('Pilih folder footage');return}
    try{await studioCall('job_add',{type:'ed_new',input:{stage:v[0],item:v[1],name:nm||v[1],whole:!!n.whole}});(ui.edWait=ui.edWait||[]).push({name:nm||v[1],at:Date.now()});edNewFree();ui.edNew=null;toast('Mac mini sedang sediakan editor');render(true)}
    catch(e){toast('Tak dapat hantar ke Mac mini. Cuba lagi')}return}
  if(!n.files.length){toast('Pilih video dulu');return}
  const dt=new Date(),name=nm||('Video '+dt.getDate()+' '+BULAN[dt.getMonth()].slice(0,3)+' '+String(dt.getHours()).padStart(2,'0')+String(dt.getMinutes()).padStart(2,'0'));
  n.name=name;n.up={k:1,n:n.files.length,pct:0};render(true);
  const tot=n.files.reduce((a,f)=>a+f.size,0)||1,ids=[];let sent=0;
  const b64=blob=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=rej;r.readAsDataURL(blob)});
  const paint=()=>{const a=$('#enPt'),b=$('#enPp'),c=$('#enPb');if(a)a.textContent='Muat naik '+n.up.k+' daripada '+n.up.n;if(b)b.textContent=n.up.pct+'%';if(c)c.style.width=Math.max(2,n.up.pct)+'%'};
  try{for(let k=0;k<n.files.length;k++){const f=n.files[k];n.up.k=k+1;paint();
      const s=await studioCall('ustart',{name:f.name||('video'+(k+1)+'.mov'),mime:f.type||'video/quicktime',size:f.size});const CH=8*1048576;let pos=0,id=null,tries=0;
      while(pos<f.size&&!id){try{const r=await studioCall('uchunk',{url:s.url,start:pos,total:f.size,b64:await b64(f.slice(pos,pos+CH))});if(r.id)id=r.id;else pos=r.next;tries=0}catch(e){if(++tries>3)throw e;await new Promise(r=>setTimeout(r,2000*tries))}
        n.up.pct=Math.min(99,Math.round((sent+(id?f.size:pos))/tot*100));paint()}
      if(!id)throw new Error('Drive tak bagi id fail');sent+=f.size;ids.push({id,name:f.name||('video'+(k+1)+'.mov'),size:f.size})}
    await studioCall('job_add',{type:'ed_new',input:{name,files:ids,whole:!!n.whole}});
    (ui.edWait=ui.edWait||[]).push({name,at:Date.now()});edNewFree();ui.edNew=null;toast('Siap muat naik. Mac mini sedang sediakan editor');render(true)}
  catch(e){ids.forEach(x=>studioCall('file_delete',{id:x.id}).catch(()=>{}));n.up=null;toast('Muat naik tak jadi: '+String((e&&e.message)||'semak internet').slice(0,70));render(true)}};
function edForm(e){modal(`<h2>${e.id?'Edit projek':'Projek baru'}</h2><label class="f"><span>Nama video</span><input class="inp" id="edN" value="${esc(e.name||'')}"></label><label class="f"><span>Style edit</span><input class="inp" id="edS" value="${esc(e.style||'')}" placeholder="cth. 21. EDIT SHOP, editor v3"></label>
  <label class="f"><span>Status</span><select class="inp" id="edT">${ED_STATUS.map(s=>`<option ${(e.status||'Draf')===s?'selected':''}>${s}</option>`).join('')}</select></label><label class="f"><span>Link artifact / projek</span><input class="inp" id="edU" value="${esc(e.url||'')}" placeholder="https://claude.ai/artifact/..." inputmode="url"></label>
  <div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="edSave" data-id="${e.id||''}">Simpan</button></div>`)}
A.edSync=()=>copyText('Sync tab Editor dan Footage Miracikcit Studio (PWA, data dalam tab STUDIO_DATA Sheet CONTENT 2026): guna python3 ~/MiracikcitTranscribe/studio.py put editor/<id> \'<json>\' untuk setiap artifact storyboard / editor video aku yang masih berjalan (tanda yang dah siap), dan footage/<id> untuk set clip baru.','Arahan sync dicopy. Paste dalam chat dengan Claude');
A.edAdd=()=>edForm({});A.edEdit=el=>edForm(get('editor',el.dataset.id));
A.edSave=el=>{const n=$('#edN').value.trim();if(!n){toast('Isi nama video');return}const u=$('#edU').value.trim();if(u&&!isUrl(u)){toast('Link mesti mula dengan https://');return}
  save('editor',Object.assign({},get('editor',el.dataset.id)||{},{name:n,style:$('#edS').value.trim(),status:$('#edT').value,url:u}));closeModal();toast('Disimpan')};
A.edDel=el=>{const e=get('editor',el.dataset.id);confirmBox('Padam "'+(e.name||'projek')+'" dari senarai?',()=>del('editor',e.id))};

/* Kad Home 'Edit sendiri' (2026-11-22): pilih folder footage, Mac mini sediakan editor tanpa Claude (job ed_new, 0 token). Design ikut kad Home rbox. */
function edSelfHome(){
  const mine=(S.edpwa||[]).filter(e=>e.src==='sendiri').sort((a,b)=>(b.updated||0)-(a.updated||0));
  const row=e=>{const [pill,col,pct]=e.status==='proses'?['Disediakan…','var(--warn)',50]:e.status==='error'?['Ralat','var(--bad)',0]:['Buka','#4E9B63',100];
    const act=e.status==='proses'||e.status==='error'?`<span class="pill" style="--pc:${col}">${pill}</span>`:`<a class="pill" style="--pc:${col};text-decoration:none;color:inherit" href="editor/?v=${encodeURIComponent(e.id)}">✂ Buka</a>`+(e.draft&&e.draft.status==='sedia'&&e.draft.id?` <a class="pill" style="--pc:#4E9B63;text-decoration:none;color:inherit" href="https://drive.google.com/file/d/${encodeURIComponent(e.draft.id)}/view" target="_blank" rel="noopener">▶ Draf</a>`:e.draft&&e.draft.status==='proses'?' <span class="pill" style="--pc:var(--warn)">Render…</span>':'');
    return `<div class="ccr" style="--sc:${col}"><div class="rowh"><span class="ccn">${esc(e.title||e.id)}</span>${act}</div><div class="bar"><i style="width:${pct}%"></i></div>${e.status==='error'?`<div class="meta" style="font-size:11px;margin-top:3px">${esc(String(e.msg||'').slice(0,80))}</div>`:''}</div>`};
  return `<div class="rbox glass cc" style="--c:${TAB.editor.c};cursor:default"><div class="rowh" style="align-items:center"><div style="min-width:0"><h2>Edit sendiri</h2><div class="meta">Pilih folder footage, edit terus tanpa Claude</div></div><b class="rn">${mine.length}</b></div>
   ${mine.slice(0,4).map(row).join('')}
   <div class="ccmore" role="button" tabindex="0" data-act="edSelfNew" style="cursor:pointer">＋ Video baru ${IC.next}</div></div>`}
A.edSelfNew=()=>{const st=((S.sync.toedit||{}).stages)||[];
  const opts=st.flatMap(s=>(s.items||[]).filter(i=>i.clips>0).map(i=>`<option value="${esc(s.name+'|'+i.name)}">${esc(s.name.replace(/^\d+\.\s*/,''))} / ${esc(i.name)} (${i.clips} klip)</option>`)).join('');
  if(!opts){toast('Tiada folder footage. Tekan Sync dalam tab Edit dulu');return}
  modal(`<h2>Edit sendiri</h2><p class="meta">Mac mini masukkan semua klip dalam folder ke timeline (6 saat pertama setiap klip, boleh panjangkan). Tak guna Claude. Siap dalam 2–5 minit.</p>
   <label class="f"><span>Folder footage</span><select class="inp" id="esF">${opts}</select></label>
   <label class="f"><span>Nama video</span><input class="inp" id="esN" placeholder="Ikut nama folder"></label>
   <div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="edSelfGo">Sediakan editor</button></div>`,TAB.editor.c)};
A.edSelfGo=async()=>{const v=$('#esF').value.split('|'),n=$('#esN').value.trim()||v[1];closeModal();
  try{await studioCall('job_add',{type:'ed_new',input:{stage:v[0],item:v[1],name:n}});toast('Mac mini sedang sediakan editor. Kad Edit sendiri akan tunjuk Buka bila siap')}catch(e){toast('Tak dapat hantar ke Mac mini. Cuba lagi')}};
/* Draf dari butang Siap Editor PWA (job ed_draft, render di Mac mini) */
function edDraftBtn(e){const d=e.draft;if(!d)return'';if(d.status==='proses')return'<span class="pill" style="--pc:var(--warn)">Render draf…</span>';
  if(d.status==='error')return`<span class="pill" style="--pc:var(--bad)" title="${esc(d.msg||'')}">Draf gagal</span>`;
  return d.id?`<a class="btn sm" href="https://drive.google.com/file/d/${encodeURIComponent(d.id)}/view" target="_blank" rel="noopener">▶ Draf</a>`:''}

/* 2026-11-23 (Mira): projek yang semua videonya dah published (Sheet settled) tak keluar lagi dalam tab Editor */
function edPublished(e){const nm=[e.name,String(e.folder||'').split('/')[1],String(e.folder||'').split('/').pop()].filter(x=>x&&nrm(x).length>=4);return nm.some(n=>isPublishedName(n))}

/* 24 Nov (Mira): butang editor sentiasa ke Editor PWA, bukan artifact. Padankan projek tracker dengan doc edpwa (folder / nama). */
function edPwaFor(e){const L=(S.edpwa||[]).filter(x=>x.status!=='error');const f=String(e.folder||'').toLowerCase(),n=nrm(e.name||'');
  return L.filter(x=>(f&&String(x.dir||'').toLowerCase().includes(f))||(n.length>=4&&(nrm(x.title||'').includes(n)||n.includes(nrm(x.title||'')))&&nrm(x.title||'').length>=4)).sort((a,b)=>(b.updated||0)-(a.updated||0))[0]||null}
