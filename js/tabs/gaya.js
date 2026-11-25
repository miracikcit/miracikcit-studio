/* ---------- COPY STYLE (tab `inspiration`; dulu Inspiration › Resipi Style / Editor › Style) ----------
   Mira paste link / upload video. Mac mini (job gaya_scan) tonton sekali dan cadang apa yang berbaloi diambil:
   tips (ayat pendek), rupa (caption / tajuk / transition / effect) dan template (slot ikut masa). Doc `gaya/<id>`:
   guess{kind,say}, tips[{g,t,on,saved}], looks[{type,name,d,recipe,on,saved,st bina|semak|lulus|gagal,pct,sample}],
   tpl{slots,need,saved}, fold ('21'.. atau '*' = semua folder), folderSug, pct (kemajuan scan).
   Setiap style duduk dalam library SATU folder utama; skrin Edit Style (lepas EDIT NOW) hanya tunjuk library folder tu. */
const gyImg=(id,w)=>id?`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${w||1200}`:'';
const gyDView=id=>'https://drive.google.com/file/d/'+encodeURIComponent(id)+'/view';
const gyHost=u=>{try{return new URL(u).hostname.replace(/^(www|vt|vm|m)\./,'')}catch(e){return 'link'}};
const CS_GO='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const CS_PLAY='<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const CS_KIND={tips:'Tips',rupa:'Rupa',template:'Template'};
/* Folder utama (21..42) dari sync folder edit + folder yang dah ada style */
function csFolds(){const m=new Map();(((S.sync.toedit||{}).stages)||[]).forEach(st=>{const no=fno(st.name);if(no)m.set(no,st.name)});
  S.gaya.forEach(g=>{const f=g.fold||g.folderSug;if(f&&f!=='*'&&!m.has(f))m.set(f,f+'.')});
  return [...m.entries()].sort((a,b)=>(+a[0])-(+b[0])).map(([no,name])=>({no,name,short:no+' '+(String(name).replace(/^\d+\.\s*/,'').replace(/^(EDIT|ENHANCE)\s+(?=\S)/i,'').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()))}))}
const csFoldOf=g=>g.fold||g.folderSug||'';
const csFoldName=f=>f==='*'?'Semua folder':((csFolds().find(x=>x.no===f)||{}).short||f||'folder');
const csDone=g=>g.status==='semak'||g.status==='simpan';
/* Library satu folder: apa yang Mira dah simpan (termasuk '*') */
function csLib(no){const mine=S.gaya.filter(g=>csDone(g)&&(!no||g.fold===no||g.fold==='*'));
  return {tips:mine.flatMap(g=>(g.tips||[]).filter(t=>t.saved)),tpls:mine.filter(g=>g.tpl&&g.tpl.saved),
    looks:mine.flatMap(g=>(g.looks||[]).map((l,i)=>({l,i,g})).filter(x=>x.l.saved&&(x.l.st==='lulus'||x.l.st==='semak')))}}
const csLoad=(txt,pct)=>`<div class="csload" role="status"><i class="f" style="width:${Math.max(3,Math.min(100,pct||0))}%"></i><span class="spin"></span><span>${esc(txt)} · ${Math.round(pct||0)}%</span></div>`;
const csProg=(txt,pct)=>`<div class="csprog" role="status"><span class="spin"></span><span>${esc(txt)}</span><span class="t"><i style="width:${Math.max(3,Math.min(100,pct||0))}%"></i></span><b>${Math.round(pct||0)}%</b></div>`;
function gyKeep(){if(!$('#gyL'))return;ui.gyDraft=Object.assign({},ui.gyDraft,{link:$('#gyL').value})}
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
function gyResipi(g){const c=g.card||{};const j=(...a)=>a.filter(Boolean).join(' ');
  const fx=[c.transition,c.zoom].filter(Boolean).join(' ');
  const rows=g.kind==='teks'?[['Hook',c.hook],['Susunan cerita',null],['Gaya ayat',c.text],['Mesej utama',c.message],['Kenapa menarik',c.why],['Penutup',c.cta],['Panjang',c.length]]
   :[['Hook 3 saat pertama',c.hook],['Susunan cerita',null],['Rentak / purata cut',c.cut],['Gaya teks',j(c.text,c.font&&'Font: '+c.font)],['Effect & transition',fx],['Sound effect & muzik',c.audio],['Mesej utama',c.message],['Kenapa menarik',c.why],['Warna',c.color],['Penutup / CTA',c.cta],['Panjang',c.length]];
  return `<div class="rsbody">${rows.map(([l,v])=>l==='Susunan cerita'?((c.beats||[]).length?`<div class="rsrow"><b>${l}</b><ol>${c.beats.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div>`:''):v?`<div class="rsrow"><b>${l}</b><p>${esc(v)}</p></div>`:'').join('')}</div>`}

function csThumb(g){const id=g.thumb;const src=((g.refs||[])[0]||{}).link||g.link;const pic=id?`<img src="${esc(gyImg(id,400))}" alt="" loading="lazy" referrerpolicy="no-referrer">`:g.kind==='teks'?'<b>Aa</b>':CS_PLAY;
  return isUrl(src)?`<a class="csthumb" href="${esc(src)}" target="_blank" rel="noopener" aria-label="Buka link asal">${pic}</a>`:`<span class="csthumb">${pic}</span>`}
const csMeta=g=>{const src=((g.refs||[])[0]||{}).link||g.link;const d=g.info&&g.info.dur?Math.round(g.info.dur)+' saat':g.kind==='teks'?'post teks':'';return [isUrl(src)?gyHost(src):(g.srcName||'upload'),d].filter(Boolean).join(' · ')};
/* Bahagian mana yang ada isi; kad lama (tiada tekaan) guna susunan babak sebagai template */
function csHas(g){const tp=g.tpl||(((g.card||{}).beats||[]).length?{slots:g.card.beats.map(b=>({name:'',d:b})),need:[],old:1}:null);
  return {tips:(g.tips||[]).length>0,rupa:(g.looks||[]).length>0,template:!!tp,tp}}
function csFoldRow(g){const cur=csFoldOf(g);const F=csFolds();const sug=g.folderSug;const show=[...new Set([cur,sug].filter(x=>x&&x!=='*'))];
  return `<div class="csfold"><span class="lb">Simpan ke library folder</span><div class="cs">${show.map(no=>`<button type="button" class="chip${cur===no?' on':''}" data-act="csFold" data-id="${esc(g.id)}" data-x="${esc(no)}">${esc(csFoldName(no))}${no===sug?' · cadangan':''}</button>`).join('')}<button type="button" class="chip${cur==='*'?' on':''}" data-act="csFold" data-id="${esc(g.id)}" data-x="*">Semua folder</button>${F.length?`<button type="button" class="chip" data-act="csFoldPick" data-id="${esc(g.id)}">Folder lain</button>`:''}</div></div>`}
function csTips(g){const T=g.tips||[];const grp=[...new Set(T.map(t=>t.g||'Editing'))];const n=T.filter(t=>t.on!==false).length;const sv=T.filter(t=>t.saved).length;const f=csFoldOf(g);
  const dirty=T.some(t=>!!t.saved!==(t.on!==false));
  return grp.map(k=>`<p class="csgrp">${esc(k)}</p>${T.map((t,i)=>(t.g||'Editing')===k?`<label class="cstip"><input type="checkbox" data-act="csTip" data-id="${esc(g.id)}" data-x="${i}"${t.on!==false?' checked':''}><span>${esc(t.t)}</span></label>`:'').join('')}`).join('')+
   csFoldRow(g)+(sv&&!dirty?`<div class="csok">${IC.check}${sv} tips dalam library ${esc(csFoldName(f))}</div>`:`<button type="button" class="csbtn solid" data-act="csTipSave" data-id="${esc(g.id)}"${n&&f?'':' disabled'}>${f?`Simpan ${n} tips ke ${esc(csFoldName(f))}`:'Pilih folder dulu'}</button>`)}
function csLooks(g){const L=g.looks||[];const pick=L.filter(l=>l.on!==false&&!l.saved).length;const build=L.filter(l=>l.st==='bina');const f=csFoldOf(g);
  const tile=(l,i)=>{const st=l.st;return `<label class="cslook${l.on!==false||l.saved?' on':''}">${l.saved?'':`<input type="checkbox" data-act="csLook" data-id="${esc(g.id)}" data-x="${i}"${l.on!==false?' checked':''} aria-label="${esc(l.name)}">`}
    <div class="tile t-${esc(l.type)}"><span>${l.type==='caption'?'Aa':l.type==='tajuk'?'Tajuk':l.type==='transition'?'⇄':'✦'}</span></div><b>${esc(l.name)}</b><span class="d">${esc(l.d||'')}</span>
    ${st==='semak'?`<div class="lkact">${l.sample?`<a class="chip" href="${esc(gyDView(l.sample))}" target="_blank" rel="noopener">▶ Contoh</a>`:''}<button type="button" class="chip on" data-act="csLookOk" data-id="${esc(g.id)}" data-x="${i}">Lulus</button><button type="button" class="chip" data-act="csLookNo" data-id="${esc(g.id)}" data-x="${i}">Buang</button></div>`
     :st==='lulus'?`<span class="lkst ok">Dalam library</span>`:st==='bina'?`<span class="lkst">Membina ${Math.round(l.pct||0)}%</span>`:st==='gagal'?`<span class="lkst bad">Gagal${l.err?': '+esc(l.err):''}</span>`:''}</label>`};
  const pct=build.length?build.reduce((a,l)=>a+(l.pct||0),0)/build.length:0;
  return `<div class="cslooks">${L.map(tile).join('')}</div>`+csFoldRow(g)+
   (build.length?csLoad('Membina contoh',pct):pick?`<button type="button" class="csbtn solid" data-act="csLookSave" data-id="${esc(g.id)}"${f&&!ui.csBusy?'':' disabled'}>${f?`Simpan ${pick} rupa`:'Pilih folder dulu'}</button><div class="csnote">${tok(TOK.look*pick,'Claude bina contoh 2 saat')}<span>Claude bina contoh 2 saat dulu. Kau lulus, baru masuk library.</span></div>`:'')}
function csTpl(g){const h=csHas(g);const tp=h.tp;const S2=tp.slots||[];const tot=S2.reduce((a,x)=>a+Math.max(.2,(x.b||0)-(x.a||0)),0)||1;const f=csFoldOf(g);const timed=S2.some(x=>x.b>0);
  return (timed?`<div class="csbar" role="img" aria-label="Jalur masa ${S2.length} bahagian">${S2.map(x=>`<i style="flex:${(Math.max(.2,(x.b||0)-(x.a||0))/tot*100).toFixed(1)}"></i>`).join('')}</div>`:'')+
   `<div class="csslots">${S2.map((x,i)=>`<div class="csslot"><i>${i+1}</i><div>${x.name?`<b>${esc(x.name)}</b>`:''}<span>${esc(x.d||'')}</span></div>${x.b>0?`<time>${+x.a}–${+x.b} s</time>`:''}</div>`).join('')}</div>`+
   ((tp.need||[]).length?`<div class="csneed">${tp.need.slice(0,3).map(n=>`<div><b>${+n.n||0}</b>${esc(n.what)}</div>`).join('')}</div>`:'')+csFoldRow(g)+
   (tp.saved?`<div class="csok">${IC.check}Template dalam library ${esc(csFoldName(f))}</div><button type="button" class="csbtn solid" data-act="gyUse" data-id="${esc(g.id)}">Guna template</button>`
    :`<button type="button" class="csbtn solid" data-act="csTplSave" data-id="${esc(g.id)}"${f?'':' disabled'}>${f?`Jadikan template ${esc(csFoldName(f))}`:'Pilih folder dulu'}</button>`)}

function gyCard(g){
  if(g.status==='scan'){const stale=Date.now()-(g.updated||0)>25*60000;
    return `<div class="cscard run"><div class="cstop"><span class="csthumb"><i class="spin"></i></span><div class="csinfo"><span class="csbadge">${g.step==='analyse'?'Analysing':'Downloading'}</span><p class="csmeta">${esc(csMeta(g))}</p>${g.useFor?`<p class="csmeta">Untuk ${esc(g.useFor.name)}: sesi edit dibuka sendiri bila siap</p>`:''}</div></div>
      ${csProg(g.msg||'Menunggu Mac mini',g.pct||3)}${stale?`<div class="csrow"><span class="csmeta" style="flex:1">Dah lebih 25 minit tanpa berita.</span><button type="button" class="chip" data-act="gyRetry" data-id="${esc(g.id)}">Cuba lagi</button><button type="button" class="chip" data-act="gyDel" data-id="${esc(g.id)}">Buang</button></div>`:''}</div>`}
  if(g.status==='error'){const dl=g.step!=='analyse';
    return `<div class="cscard err"><div class="cstop"><span class="csthumb"><b>!</b></span><div class="csinfo"><span class="csbadge bad">Gagal</span><span class="csname">${dl?'Link gagal download':'Analisis gagal'}</span><p class="csmeta">${esc(csMeta(g))}</p></div></div>
      <p class="cserr">${esc(g.msg||'Tak tahu sebabnya. Cuba lagi.')}</p>
      <div class="csrow"><button type="button" class="chip on" data-act="gyRetry" data-id="${esc(g.id)}">Cuba lagi</button>${dl?`<button type="button" class="chip" data-act="gyUpload" data-id="${esc(g.id)}">Upload video</button>`:''}<span style="flex:1"></span><button type="button" class="chip" data-act="gyDel" data-id="${esc(g.id)}">Buang</button></div></div>`}
  const h=csHas(g);const avail=['tips','rupa','template'].filter(k=>h[k]);const gk=(g.guess||{}).kind;
  const tab=avail.includes((ui.csTab||{})[g.id])?ui.csTab[g.id]:avail.includes(gk)?gk:avail[0];
  const say=(g.guess||{}).say||(g.card||{}).summary||'';
  const cnt=tab==='tips'?` Aku jumpa ${(g.tips||[]).length} tips. Tick yang kau setuju.`:tab==='rupa'?` Aku jumpa ${(g.looks||[]).length} rupa yang boleh dibina. Pilih yang kau nak.`:tab==='template'&&h.tp&&!h.tp.old?` ${h.tp.slots.length} bahagian${g.info&&g.info.dur?' dalam '+Math.round(g.info.dur)+' saat':''}.`:'';
  return `<div class="cscard"><div class="cstop">${csThumb(g)}<div class="csinfo"><span class="csbadge k-${tab||'x'}">${CS_KIND[tab]||'Rujukan'}</span><span class="csname">${esc(g.name||'Style baru')}</span><p class="csmeta">${esc(csMeta(g))}</p></div>
      <button type="button" class="csx" data-act="csMenu" data-id="${esc(g.id)}" aria-label="Lagi pilihan">⋯</button></div>
    ${say?`<p class="cssay"><b>${esc(say)}</b>${cnt}</p>`:''}
    ${tab==='tips'?csTips(g):tab==='rupa'?csLooks(g):tab==='template'?csTpl(g):`<p class="csmeta">Tiada apa yang jelas boleh diambil dari video ni.</p>`}
    ${avail.length>1?`<div class="csmore"><span>Ambil juga:</span>${avail.filter(k=>k!==tab).map(k=>`<button type="button" class="csbtn" data-act="csTab" data-id="${esc(g.id)}" data-x="${k}">${CS_KIND[k]}</button>`).join('')}</div>`:''}
    ${ui.gyOpen===g.id?`<div class="csdet">${gyResipi(g)}</div>`:''}</div>`}

function gyView(){const d=ui.gyDraft||{};const F=csFolds();const f=ui.csF||'';
  const all=S.gaya.slice().sort((a,b)=>(b.created||0)-(a.created||0));
  const run=all.filter(g=>g.status==='scan'||g.status==='error');const done=all.filter(csDone);
  const shown=done.filter(g=>!f||csFoldOf(g)===f||g.fold==='*'||!csFoldOf(g));const lib=csLib(f);
  const withN=new Set(done.map(csFoldOf));
  return `<div class="cs"><div class="cshead"><p class="cseye">${f?'Library '+esc(csFoldName(f)):'Semua library'} · ${lib.tips.length} tips · ${lib.looks.length} rupa · ${lib.tpls.length} template</p><h1>Copy Style</h1></div>
  <div class="cschips" aria-label="Library ikut folder"><button type="button" class="chip${!f?' on':''}" data-act="csF" data-x="">Semua</button>${F.map(x=>`<button type="button" class="chip${f===x.no?' on':''}${withN.has(x.no)?'':' dim'}" data-act="csF" data-x="${esc(x.no)}">${esc(x.short)}</button>`).join('')}</div>
  <div>${ui.gyUp?csLoad('Upload '+ui.gyUp.name,ui.gyUp.pct):`<div class="cspaste"><input id="gyL" aria-label="Paste link video" value="${esc(d.link||'')}" placeholder="Paste link video" inputmode="url" autocapitalize="off" autocorrect="off" enterkeyhint="send"><button type="button" class="go" data-act="gySend" aria-label="Hantar"${ui.gyBusy?' disabled':''}>${ui.gyBusy?'<i class="spin"></i>':CS_GO}</button></div>`}
    <div class="cssub"><span>TikTok, IG, FB, Threads, Drive ${tok(TOK.gaya,'Claude tonton video sekali')}</span><span><button type="button" data-act="gyPaste">Paste</button> · <button type="button" data-act="gyUpload">Upload video</button></span></div></div>
  ${run.map(gyCard).join('')}
  ${shown.map(gyCard).join('')||(run.length?'':`<div class="csempty">${done.length?'Belum ada style dalam library folder ni.':'Belum ada style. Paste link video yang kau suka di atas.'}</div>`)}
  <button type="button" class="cslink" data-act="inSeg" data-x="board">Board screenshot (${S.inspo.length})</button></div>`}
A.inSeg=el=>{gyKeep();ui.inSeg=el.dataset.x;render(true)};
function inSegs(){return `<div class="seg" style="margin-bottom:14px"><button type="button" data-act="inSeg" data-x="resipi">‹ Copy Style</button><button type="button" class="on">Board</button></div>`}
A.csF=el=>{gyKeep();ui.csF=el.dataset.x;render(true)};
A.csTab=el=>{gyKeep();ui.csTab=Object.assign({},ui.csTab,{[el.dataset.id]:el.dataset.x});render(true)};
const csPut=(g,o)=>save('gaya',Object.assign({},g,o));
A.csFold=el=>{const g=get('gaya',el.dataset.id);closeModal();csPut(g,{fold:el.dataset.x})};
A.csFoldPick=el=>{const g=get('gaya',el.dataset.id);modal(`<h2>Simpan ke library folder</h2><div class="rspick">${csFolds().map(x=>`<button type="button" class="rsfold" data-act="csFold" data-id="${esc(g.id)}" data-x="${esc(x.no)}"><b>${esc(x.name)}</b>${csFoldOf(g)===x.no?'<span class="meta">dipilih</span>':''}</button>`).join('')}</div><div class="btns" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-act="closeModal">Batal</button></div>`)};
const csEnsureFold=g=>g.fold?{}:{fold:csFoldOf(g)};
A.csTip=el=>{const g=get('gaya',el.dataset.id);const i=+el.dataset.x;csPut(g,{tips:(g.tips||[]).map((t,k)=>k===i?Object.assign({},t,{on:t.on===false}):t)})};
A.csTipSave=el=>{const g=get('gaya',el.dataset.id);const tips=(g.tips||[]).map(t=>Object.assign({},t,{saved:t.on!==false}));csPut(g,Object.assign({tips,status:'simpan'},csEnsureFold(g)));toast(tips.filter(t=>t.saved).length+' tips disimpan ke library '+csFoldName(csFoldOf(g)))};
A.csLook=el=>{const g=get('gaya',el.dataset.id);const i=+el.dataset.x;csPut(g,{looks:(g.looks||[]).map((l,k)=>k===i?Object.assign({},l,{on:l.on===false}):l)})};
A.csLookSave=el=>{const g=get('gaya',el.dataset.id);const idx=(g.looks||[]).map((l,i)=>l.on!==false&&!l.saved?i:-1).filter(i=>i>=0);if(!idx.length)return;
  confirmBox('Bina '+idx.length+' rupa? Mac mini buka sesi Claude untuk bina contoh 2 saat.',async()=>{closeModal();
    csPut(g,Object.assign({looks:g.looks.map((l,i)=>idx.includes(i)?Object.assign({},l,{saved:true,st:'bina',pct:2,err:''}):l),status:'simpan'},csEnsureFold(g)));ui.csBusy=1;render();
    try{await studioJob('look_build',{id:g.id,i:idx},3*60000);toast('Sesi Claude dibuka. Peratus naik pada kad ni')}
    catch(e){const c=get('gaya',g.id);csPut(c,{looks:(c.looks||[]).map((l,i)=>idx.includes(i)?Object.assign({},l,{saved:false,st:'gagal',err:'Mac mini tak jawab'}):l)});toast('Tak dapat mula: '+String((e&&e.message)||'semak Mac mini').slice(0,80))}
    finally{ui.csBusy=0;render()}},'Ya, bina')};
A.csLookOk=el=>{const g=get('gaya',el.dataset.id);const i=+el.dataset.x;csPut(g,{looks:g.looks.map((l,k)=>k===i?Object.assign({},l,{st:'lulus'}):l)});toast('Rupa masuk library '+csFoldName(csFoldOf(g)))};
A.csLookNo=el=>{const g=get('gaya',el.dataset.id);const i=+el.dataset.x;csPut(g,{looks:g.looks.map((l,k)=>k===i?Object.assign({},l,{st:'',saved:false,on:false}):l)});toast('Rupa dibuang')};
A.csTplSave=el=>{const g=get('gaya',el.dataset.id);const tp=csHas(g).tp;csPut(g,Object.assign({tpl:Object.assign({},tp,{saved:true,old:undefined}),status:'simpan'},csEnsureFold(g)));toast('Template disimpan ke library '+csFoldName(csFoldOf(g)))};
A.csMenu=el=>{const g=get('gaya',el.dataset.id);modal(`<h2>${esc(g.name||'Style')}</h2><div class="rspick">
  <button type="button" class="rsfold" data-act="csDet" data-id="${esc(g.id)}"><b>${ui.gyOpen===g.id?'Sorok':'Tunjuk'} butiran penuh</b></button>
  <button type="button" class="rsfold" data-act="gyRename" data-id="${esc(g.id)}"><b>Tukar nama</b></button>
  <button type="button" class="rsfold" data-act="gyRetry" data-id="${esc(g.id)}"><b>Analisis semula</b>${tok(TOK.gaya,'Claude tonton semula')}</button>
  <button type="button" class="rsfold" data-act="gyDel" data-id="${esc(g.id)}"><b>Buang style ni</b></button></div>
  <div class="btns" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-act="closeModal">Tutup</button></div>`)};
A.csDet=el=>{closeModal();ui.gyOpen=ui.gyOpen===el.dataset.id?null:el.dataset.id;render(true)};
A.gyPaste=async()=>{try{const t=(await navigator.clipboard.readText()||'').trim();const m=t.match(/https?:\/\/\S+/);if(!m){toast('Tiada link dalam clipboard. Copy link video dulu');return}$('#gyL').value=m[0];gyKeep();toast('Link ditampal. Tekan anak panah')}
  catch(e){toast('Tekan lama dalam kotak dan pilih Paste');$('#gyL')&&$('#gyL').focus()}};
A.gySend=()=>{gyKeep();const d=ui.gyDraft||{};const link=((String(d.link||'').match(/https?:\/\/\S+/)||[])[0]||'').trim();if(!isUrl(link)){toast('Paste link dulu (mula dengan https://)');return}
  if(!d.up&&S.gaya.some(g=>g.link===link&&g.status!=='error')){toast('Link ni dah ada dalam senarai');return}
  const old=d.retry&&get('gaya',d.retry);const id=old?old.id:'g'+uid();
  save('gaya',Object.assign({},old||{},{id,link,note:'',fx:[],tags:(old&&old.tags)||[],status:'scan',step:'download',pct:3,msg:'Menunggu Mac mini'},ui.csF&&!(old&&old.fold)?{fold:ui.csF}:{},d.up?{upload:d.up.id,srcName:d.up.name}:{}));
  ui.gyDraft={};ui.gyBusy=1;render(true);
  studioJob('gaya_scan',{id},3*60000).then(()=>toast('Mac mini mula download. Peratus naik pada kad')).catch(e=>{toast('Mac mini tak jawab: '+String((e&&e.message)||'').slice(0,80));save('gaya',Object.assign({},get('gaya',id),{status:'error',step:'download',msg:'Mac mini tak jawab. Semak Mac mini hidup, kemudian tekan Cuba lagi.'}))})
   .finally(()=>{ui.gyBusy=0;render()})};
A.gyRetry=el=>{closeModal();const g=get('gaya',el.dataset.id);save('gaya',Object.assign({},g,{status:'scan',step:'download',pct:3,msg:'Menunggu Mac mini'}));
  studioJob('gaya_scan',{id:g.id},3*60000).catch(e=>toast('Mac mini tak jawab: '+String((e&&e.message)||'').slice(0,80)))};
A.gyDel=el=>{const g=get('gaya',el.dataset.id);
  const inUse=S.gaya.some(x=>x.id!==g.id&&(x.refs||[]).some(r=>g.scan&&r.scan===g.scan));
  confirmBox('Buang style "'+(g.name||'ni')+'"? Tips, rupa dan template dari video ni keluar dari library.',()=>{const folder=inUse?'':g.folder||'';del('gaya',g.id);
    studioJob('gaya_del',{id:g.id,folder},60000).catch(()=>{})},'Ya, buang')};
A.gyRename=el=>{const g=get('gaya',el.dataset.id);modal(`<h2>Tukar nama gaya</h2><label class="f"><span>Nama pendek, senang ingat</span><input class="inp" id="gyRn" value="${esc(g.name||'')}" maxlength="30"></label>
  <div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="gyRenameOk" data-id="${esc(g.id)}">Simpan</button></div>`)};
A.gyRenameOk=el=>{const n=$('#gyRn').value.trim();if(!n){toast('Isi nama');return}
  if(S.gaya.some(x=>x.id!==el.dataset.id&&x.status==='simpan'&&nrm(x.name)===nrm(n))){toast('Nama tu dah ada');return}
  save('gaya',Object.assign({},get('gaya',el.dataset.id),{name:n}));closeModal();toast('Nama ditukar')};

/* Guna template (dari kad): pilih projek dalam folder library tu, kemudian skrin Edit Style dengan template dah dipilih */
A.gyUse=el=>{const g=get('gaya',el.dataset.id);const f=csFoldOf(g);const L=toEditFolders().filter(x=>!isPublishedName(x.name)&&!HELPER_DIR.test(x.name)&&(f==='*'||!f||fno(x.stage)===f));
  modal(`<h2>Guna template "${esc(g.name||'')}"</h2><p class="meta" style="margin:0 0 12px">Pilih projek dalam ${esc(csFoldName(f))}.</p>
    ${L.length?`<div class="rspick">${L.map(x=>`<button type="button" class="rsfold" data-act="esOpen" data-id="${esc(x.key)}" data-x="${esc(x.stage)}" data-n="${esc(x.name)}" data-k="${esc(g.id)}"><b>${esc(x.name)}</b><span class="meta">${esc(fno(x.stage))} · ${x.clips||0} klip</span></button>`).join('')}</div>`:`<div class="empty">Tiada projek dalam folder ni. Upload footage dari tab Shoot dulu.</div>`}
    <div class="btns" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-act="closeModal">Batal</button></div>`)};

/* ---------- EDIT STYLE: keluar bila tekan EDIT NOW. Hanya style dalam library folder utama projek tu. ---------- */
/* 2026-11-25 (Mira): "Satu Vlog Lima" = satu footage jadi lima jenis post. Senarai tetap (0 token, tiada scan semula);
   keluar untuk kad Video baru (START EDIT) dan folder vlog. Carousel ada aliran sendiri (belum dibina). */
const ES_JENIS=[['pendek','Versi pendek + muzik','Potong vlog yang sama, tambah muzik dan teks'],['split','Split screen','Klip atas, klip atau gambar lain di bawah'],['broll','B-roll estetik + teks','Satu potongan B-roll dengan teks relatable'],['penuh','Vlog penuh','Cerita penuh, bercakap atau VO']];
const esVlog=e=>!!e.round||/^(22|23|29)$/.test(fno(e.stage));
function esBody(){const e=ui.es;const no=fno(e.stage);const lib=csLib(no);const off=macOff();const base=String(e.key).replace(/#r\d+$/,'');const used=redoStyles(base);
  const opt=(on,inner,act,x,type,grp)=>`<label class="esopt${on?' on':''}"><input type="${type}" name="es${grp||type}" data-act="${act}" data-x="${esc(x)}"${on?' checked':''}>${inner}</label>`;
  return `<div class="cs es"><p class="cseye">${esc(e.name)} · Library ${esc(csFoldName(no))}</p><h2>Edit Style</h2>
    ${off?`<div class="banner glass">Mac mini tak jawab sejak ${esc(off)}.</div>`:''}
    <p class="essec">Susunan video</p><div class="esopts">${opt(!e.tpl,`<div><b>Ikut folder</b><span class="d">Cara biasa folder ${esc(no)}, tanpa template</span></div>`,'esTpl','','radio')}
      ${lib.tpls.map(g=>opt(e.tpl===g.id,`<div><span class="n">${esc(g.name)}</span><span class="d">Template · ${(g.tpl.slots||[]).length} bahagian${g.info&&g.info.dur?' · '+Math.round(g.info.dur)+' saat':''}${(g.used||[]).length?' · dipakai '+g.used.length+' kali':''}</span></div>`,'esTpl',g.id,'radio')).join('')}</div>
    ${lib.tpls.length?'':`<p class="csmeta">Belum ada template dalam library folder ${esc(no)}.</p>`}
    ${lib.looks.length?`<p class="essec">Rupa teks</p><div class="esopts">${lib.looks.map(x=>{const k=x.g.id+':'+x.i;return opt(e.looks.includes(k),`<div class="sw t-${esc(x.l.type)}">Aa</div><div><span class="n">${esc(x.l.name)}</span><span class="d">${esc(x.l.type)}${x.l.st==='semak'?' · belum lulus':''}</span></div>`,'esLook',k,'checkbox')}).join('')}</div>`:''}
    ${esVlog(e)?`<p class="essec">Jenis video · Satu Vlog Lima</p><div class="esopts">${opt(!e.jenis,`<div><b>Bebas</b><span class="d">Ikut susunan yang dipilih di atas</span></div>`,'esJenis','','radio','jenis')}${ES_JENIS.map(j=>opt(e.jenis===j[0],`<div><span class="n">${j[1]}</span><span class="d">${j[2]}${used.includes(j[1])?' · dah dibuat':''}</span></div>`,'esJenis',j[0],'radio','jenis')).join('')}</div>`:''}
    ${used.length?`<p class="csmeta">Dah dipakai untuk footage ni: ${esc(used.join(', '))}. Video baru akan dibuat lain.</p>`:''}
    <p class="essec">Atau tiru video baru (disimpan ke library ${esc(no)})</p>
    <div class="cspaste dash"><input id="esL" aria-label="Paste link video untuk ditiru" placeholder="Paste link, Claude tiru terus" inputmode="url" autocapitalize="off" autocorrect="off"><button type="button" class="go" data-act="esLink" aria-label="Tiru video ni"${off?' disabled':''}>${CS_GO}</button></div>
    <div class="estips"><span><b>Tips folder ${esc(no)}</b> · ${lib.tips.length} tips</span><span>Sentiasa dipakai</span></div>
    <p class="essec">Nota untuk Claude (pilihan)</p><textarea class="esnota" id="esN" rows="2" maxlength="600" aria-label="Nota untuk Claude" placeholder="cth: fokus bahagian cable car, 20 saat">${esc(e.nota||'')}</textarea>
    <button type="button" class="csbtn solid big" data-act="esGo"${off?' disabled':''}>Mula edit</button>
    <div class="csnote" style="justify-content:center">${tok(TOK.edit,'satu sesi edit Claude',TOKM.edit)}<span>${e.tpl||e.looks.length?'Draf masuk Editor dulu.':'Ikut cara biasa folder.'}</span><button type="button" class="chip" data-act="closeModal">Batal</button></div></div>`}
A.esOpen=el=>{ui.es={key:el.dataset.id,stage:el.dataset.x,name:el.dataset.n,tpl:el.dataset.k||'',looks:[],round:+el.dataset.r||0,jenis:'',nota:''};modal(esBody())};
const esRe=()=>{const v=$('#esL')?$('#esL').value:'';if($('#esN'))ui.es.nota=$('#esN').value;modal(esBody());if($('#esL'))$('#esL').value=v};
A.esJenis=el=>{ui.es.jenis=el.dataset.x;esRe()};
A.esTpl=el=>{ui.es.tpl=el.dataset.x;esRe()};
A.esLook=el=>{const k=el.dataset.x;const L=ui.es.looks;ui.es.looks=L.includes(k)?L.filter(x=>x!==k):L.concat(k);esRe()};
A.esGo=async()=>{const e=ui.es;if($('#esN'))e.nota=$('#esN').value.trim();closeModal();ui.edNow=Object.assign({},ui.edNow,{[e.key]:'Buka sesi...'});render();
  try{await studioJob('edit_now',{stage:e.stage,name:e.name,key:e.key,style:{tpl:e.tpl||'',looks:e.looks},round:e.round||0,jenis:e.jenis||'',nota:e.nota||''},3*60000);toast('Sesi Claude dibuka di Mac mini. Buka app Claude di phone untuk kawal')}
  catch(x){toast('Tak dapat buka sesi: '+String((x&&(x.message||x.code))||'semak Mac mini hidup').slice(0,80))}
  finally{const b=Object.assign({},ui.edNow);delete b[e.key];ui.edNow=b;render()}};
/* Tiru video baru: analisis dulu (kad folder tunjuk %), worker buka sesi edit sendiri bila siap */
A.esLink=()=>{const e=ui.es;const link=((String($('#esL').value||'').match(/https?:\/\/\S+/)||[])[0]||'').trim();if(!isUrl(link)){toast('Paste link video dulu');return}
  const id='g'+uid();save('gaya',{id,link,note:'',fx:[],tags:[],fold:fno(e.stage),useFor:{stage:e.stage,name:e.name,key:e.key},status:'scan',step:'download',pct:3,msg:'Menunggu Mac mini'});closeModal();
  toast('Mac mini analisis video dulu. Sesi edit dibuka sendiri bila siap');
  studioJob('gaya_scan',{id},3*60000).catch(x=>{save('gaya',Object.assign({},get('gaya',id),{status:'error',step:'download',useFor:null,msg:'Mac mini tak jawab. Semak Mac mini hidup.'}));toast('Mac mini tak jawab')})};
/* Untuk kad folder dalam tab Edit: analisis "tiru video baru" yang sedang jalan */
const esScan=key=>S.gaya.find(g=>g.useFor&&g.useFor.key===key&&g.status==='scan')||null;
