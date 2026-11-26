/* ---------- COPY STYLE (tab `inspiration`; dulu Inspiration › Resipi Style / Editor › Style) ----------
   Mira paste link / upload video. Mac mini (job gaya_scan) tonton sekali dan cadang apa yang berbaloi diambil:
   tips (ayat pendek), rupa (caption / tajuk / transition / effect) dan template (slot ikut masa). Doc `gaya/<id>`:
   guess{kind,say}, tips[{g,t,on,saved}], looks[{type,name,d,recipe,on,saved,st bina|trial|siap|semak|lulus|gagal,pct,sample}  (trial = contoh siap, tunggu Mira; siap/lulus = dalam library)],
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
    looks:mine.flatMap(g=>(g.looks||[]).map((l,i)=>({l,i,g})).filter(x=>x.l.saved&&(x.l.st==='siap'||x.l.st==='lulus'||x.l.st==='semak')))}}   /* trial belum masuk library */
const csLoad=(txt,pct)=>`<div class="csload" role="status"><i class="f" style="width:${Math.max(3,Math.min(100,pct||0))}%"></i><span class="spin"></span><span>${esc(txt)} · ${Math.round(pct||0)}%</span></div>`;
const csProg=(txt,pct)=>`<div class="csprog" role="status"><span class="spin"></span><span>${esc(txt)}</span><span class="t"><i style="width:${Math.max(3,Math.min(100,pct||0))}%"></i></span><b>${Math.round(pct||0)}%</b></div>`;
function gyKeep(){if(!$('#gyL'))return;ui.gyDraft=Object.assign({},ui.gyDraft,{link:$('#gyL').value},$('#gyN')?{note:$('#gyN').value}:{})}
/* Upload video rujukan (26 Nov, Mira: "upload tapi tak keluar"). Dulu kad hanya dibuat SELEPAS upload habis melalui Apps Script
   (uchunk 8 MB base64), jadi kalau upload lambat / terputus / phone tidur, tiada apa yang keluar. Sekarang:
   1) semak pilihan Template/Rupa/Tips DULU, 2) kad terus keluar (step upload) dengan %, 3) upload terus phone -> Drive (fuPut 32 MB,
   sama macam footage), 4) gagal = kad Gagal dengan butang Upload semula, bukan hilang. */
const gyUpBusy=id=>!!(ui.gyUp&&ui.gyUp[id]);
A.gyUpload=el=>{const rid=(el&&el.dataset&&el.dataset.id)||'';closeModal();gyKeep();
  const want=csWantGet();if(!want.length){toast('Tick dulu apa nak diambil: Template, Rupa atau Tips');return}
  pickFile('video/*',async f=>{if(f.size>500*1048576){toast('Video lebih 500 MB. Potong dulu atau guna link');return}
    const d=ui.gyDraft||{};const old=rid&&get('gaya',rid);const id=old?old.id:'g'+uid();
    if(!String(d.note||(old&&old.note)||'').trim()&&/screen ?record|rpreplay/i.test(f.name))d.note='Ini screen record: abaikan butang, ikon dan teks app di tepi skrin';
    save('gaya',Object.assign({},old||{},{id,link:'',upload:'',note:String(d.note||(old&&old.note)||'').trim().slice(0,200),want:(old&&(old.want||[]).length)?old.want:want,fx:[],tags:(old&&old.tags)||[],
      status:'scan',step:'upload',pct:0,msg:'Upload dari phone',srcName:f.name,upAt:Date.now()},ui.csF&&!(old&&old.fold)?{fold:ui.csF}:{}));
    ui.gyDraft={};ui.gyUp=Object.assign({},ui.gyUp,{[id]:{name:f.name,pct:0}});if(typeof wakeOn==='function')wakeOn();render(true);
    const setP=v=>{v=Math.min(100,Math.round(v));const u=ui.gyUp&&ui.gyUp[id];if(u&&u.pct!==v){u.pct=v;render()}};
    try{const s=await studioCall('ustart',{origin:location.origin,name:f.name,mime:f.type||'video/mp4',size:f.size});let fid=null,pos=0,tries=0;
      if(s.direct){const CH=32*1048576;
        while(pos<f.size&&!fid){try{const r=await fuPut(s.url,f.slice(pos,pos+CH),pos,f.size,l=>setP((pos+l)/f.size*100));if(r.id)fid=r.id;else pos=r.next;tries=0}
          catch(e){if(++tries>3)throw e;await new Promise(r=>setTimeout(r,2000*tries));try{const q=await fuPut(s.url,null,0,f.size);if(q.id)fid=q.id;else if(q.next!=null)pos=q.next}catch(_){}}
          setP((fid?f.size:pos)/f.size*100)}}
      else{const CH=8*1048576;const b64=blob=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=rej;r.readAsDataURL(blob)});
        while(pos<f.size&&!fid){try{const r=await studioCall('uchunk',{url:s.url,start:pos,total:f.size,b64:await b64(f.slice(pos,pos+CH))});if(r.id)fid=r.id;else pos=r.next;tries=0}
          catch(e){if(++tries>3)throw e;await new Promise(r=>setTimeout(r,2000*tries))}
          setP((fid?f.size:pos)/f.size*100)}}
      if(!fid)throw new Error('Drive tak bagi id fail');
      if(!get('gaya',id)){studioCall('file_delete',{id:fid}).catch(()=>{});return}   /* kad dibuang semasa upload */
      save('gaya',Object.assign({},get('gaya',id),{link:'https://drive.google.com/file/d/'+fid+'/view',upload:fid,step:'download',pct:3,msg:'Menunggu Mac mini'}));
      studioJob('gaya_scan',{id},3*60000).then(()=>toast('Upload siap. Mac mini mula analisis')).catch(e=>{toast('Mac mini tak jawab: '+String((e&&e.message)||'').slice(0,80));
        save('gaya',Object.assign({},get('gaya',id),{status:'error',step:'download',msg:'Video dah ada dalam Drive tapi Mac mini tak jawab. Semak Mac mini hidup, kemudian tekan Cuba lagi.'}))})}
    catch(e){const c=get('gaya',id);if(c)save('gaya',Object.assign({},c,{status:'error',step:'upload',msg:'Upload tak jadi: '+String((e&&e.message)||'semak internet').slice(0,120)}));toast('Upload tak jadi. Tekan Upload semula pada kad')}
    finally{const u=Object.assign({},ui.gyUp);delete u[id];ui.gyUp=u;if(!Object.keys(u).length&&typeof wakeOff==='function'&&!(typeof VR!=='undefined'&&VR.on)&&!Object.keys(ui.fuUp||{}).length)wakeOff();render(true)}})};
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
const csTipTxt=t=>`${t.bila?`<i class="cstb">Bila</i> ${esc(t.bila)} <i class="cstb">Buat</i> `:''}${esc(t.t)}`;
function csTips(g){const T=g.tips||[];const grp=[...new Set(T.map(t=>t.g||'Editing'))];const n=T.filter(t=>t.on!==false).length;const sv=T.filter(t=>t.saved).length;const f=csFoldOf(g);
  const dirty=T.some(t=>!!t.saved!==(t.on!==false));
  return grp.map(k=>`<p class="csgrp">${esc(k)}</p>${T.map((t,i)=>(t.g||'Editing')===k?`<div class="cstl"><label class="cstip"><input type="checkbox" data-act="csTip" data-id="${esc(g.id)}" data-x="${i}"${t.on!==false?' checked':''}><span>${csTipTxt(t)}</span></label><button type="button" class="csmini" data-act="csTipEdit" data-id="${esc(g.id)}" data-x="${i}" aria-label="Ubah tip">${IC.edit}</button><button type="button" class="csmini" data-act="csTipDel" data-id="${esc(g.id)}" data-x="${i}" aria-label="Buang tip">×</button></div>`:'').join('')}`).join('')+
   csFoldRow(g)+(sv&&!dirty?`<div class="csok">${IC.check}${sv} tips dalam library ${esc(csFoldName(f))}</div>`:`<button type="button" class="csbtn solid" data-act="csTipSave" data-id="${esc(g.id)}"${n&&f?'':' disabled'}>${f?`Simpan ${n} tips ke ${esc(csFoldName(f))}`:'Pilih folder dulu'}</button>`)}
function csLooks(g){const L=g.looks||[];const pick=L.filter(l=>l.on!==false&&!l.saved).length;const build=L.filter(l=>l.st==='bina');const f=csFoldOf(g);
  const tile=(l,i)=>{const st=l.st;return `<label class="cslook${l.on!==false||l.saved?' on':''}">${l.saved?'':`<input type="checkbox" data-act="csLook" data-id="${esc(g.id)}" data-x="${i}"${l.on!==false?' checked':''} aria-label="${esc(l.name)}">`}
    <div class="tile t-${esc(l.type)}"><span>${l.type==='caption'?'Aa':l.type==='tajuk'?'Tajuk':l.type==='transition'?'⇄':'✦'}</span></div><b>${esc(l.name)}</b><span class="d">${esc(l.d||'')}</span>
    ${st==='semak'||st==='trial'?`${st==='trial'?'<span class="lkst trial">Trial · tunggu kau lulus</span>':''}<div class="lkact">${l.sample?`<a class="chip" href="${esc(gyDView(l.sample))}" target="_blank" rel="noopener">▶ Contoh</a>`:''}<button type="button" class="chip on" data-act="csLookOk" data-id="${esc(g.id)}" data-x="${i}">Lulus</button><button type="button" class="chip" data-act="csLookNo" data-id="${esc(g.id)}" data-x="${i}">Buang</button></div>`
     :st==='lulus'||st==='siap'?`<span class="lkst ok">Dalam library</span>`:st==='bina'?`<span class="lkst">Membina ${Math.round(l.pct||0)}%</span>`:st==='gagal'?`<span class="lkst bad">Gagal${l.err?': '+esc(l.err):''}</span>`:''}</label>`};
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
  if(g.status==='scan'&&g.step==='upload'){const u=(ui.gyUp||{})[g.id];
    if(u)return `<div class="cscard run"><div class="cstop"><span class="csthumb"><i class="spin"></i></span><div class="csinfo"><span class="csbadge">Uploading</span><span class="csname">${esc(g.srcName||u.name||'Video')}</span><p class="csmeta">Jangan tutup app sampai 100%</p></div></div>${csProg('Upload ke Drive',u.pct)}</div>`;
    return `<div class="cscard err"><div class="cstop"><span class="csthumb"><b>!</b></span><div class="csinfo"><span class="csbadge bad">Terputus</span><span class="csname">${esc(g.srcName||'Video')}</span><p class="csmeta">Upload berhenti (app ditutup atau phone tidur)</p></div></div>
      <div class="csrow"><button type="button" class="chip on" data-act="gyUpload" data-id="${esc(g.id)}">Upload semula</button><span style="flex:1"></span><button type="button" class="chip" data-act="gyDel" data-id="${esc(g.id)}">Buang</button></div></div>`}
  if(g.status==='scan'){const stale=Date.now()-(g.updated||0)>25*60000;
    return `<div class="cscard run"><div class="cstop"><span class="csthumb"><i class="spin"></i></span><div class="csinfo"><span class="csbadge">${g.step==='analyse'?'Analysing':'Downloading'}</span><p class="csmeta">${esc(csMeta(g))}</p>${g.useFor?`<p class="csmeta">Untuk ${esc(g.useFor.name)}: sesi edit dibuka sendiri bila siap</p>`:''}</div></div>
      ${csProg(g.msg||'Menunggu Mac mini',g.pct||3)}${stale?`<div class="csrow"><span class="csmeta" style="flex:1">Dah lebih 25 minit tanpa berita.</span><button type="button" class="chip" data-act="gyRetry" data-id="${esc(g.id)}">Cuba lagi</button><button type="button" class="chip" data-act="gyDel" data-id="${esc(g.id)}">Buang</button></div>`:''}</div>`}
  if(g.status==='error'){const dl=g.step!=='analyse',upf=g.step==='upload'||!isUrl(g.link);
    return `<div class="cscard err"><div class="cstop"><span class="csthumb"><b>!</b></span><div class="csinfo"><span class="csbadge bad">Gagal</span><span class="csname">${upf?'Upload gagal':dl?'Link gagal download':'Analisis gagal'}</span><p class="csmeta">${esc(csMeta(g))}</p></div></div>
      <p class="cserr">${esc(g.msg||'Tak tahu sebabnya. Cuba lagi.')}</p>
      <div class="csrow">${upf?'':`<button type="button" class="chip on" data-act="gyRetry" data-id="${esc(g.id)}">Cuba lagi</button>`}${dl?`<button type="button" class="chip${upf?' on':''}" data-act="gyUpload" data-id="${esc(g.id)}">${upf?'Upload semula':'Upload video'}</button>`:''}<span style="flex:1"></span><button type="button" class="chip" data-act="gyDel" data-id="${esc(g.id)}">Buang</button></div></div>`}
  const h=csHas(g);const avail=['tips','rupa','template'].filter(k=>h[k]);const gk=(g.guess||{}).kind;
  const tab=avail.includes((ui.csTab||{})[g.id])?ui.csTab[g.id]:avail.includes(gk)?gk:avail[0];
  const say=(g.guess||{}).say||(g.card||{}).summary||'';
  const cnt=tab==='tips'?` Aku jumpa ${(g.tips||[]).length} tips. Tick yang kau setuju.`:tab==='rupa'?` Aku jumpa ${(g.looks||[]).length} rupa yang boleh dibina. Pilih yang kau nak.`:tab==='template'&&h.tp&&!h.tp.old?` ${h.tp.slots.length} bahagian${g.info&&g.info.dur?' dalam '+Math.round(g.info.dur)+' saat':''}.`:'';
  return `<div class="cscard"><div class="cstop">${csThumb(g)}<div class="csinfo"><span class="csbadge k-${tab||'x'}">${CS_KIND[tab]||'Rujukan'}</span><span class="csname">${esc(g.name||'Style baru')}</span><p class="csmeta">${esc(csMeta(g))}</p></div>
      <button type="button" class="csx" data-act="csMenu" data-id="${esc(g.id)}" aria-label="Lagi pilihan">⋯</button></div>
    ${say?`<p class="cssay"><b>${esc(say)}</b>${cnt}</p>`:''}
    ${tab==='tips'?csTips(g):tab==='rupa'?csLooks(g):tab==='template'?csTpl(g):`<p class="csmeta">Tiada apa yang jelas boleh diambil dari video ni.</p>`}
    ${avail.length>1?`<div class="csmore"><span>Ambil juga:</span>${avail.filter(k=>k!==tab).map(k=>`<button type="button" class="csbtn" data-act="csTab" data-id="${esc(g.id)}" data-x="${k}">${CS_KIND[k]}</button>`).join('')}</div>`:''}
    ${csFixRow(g)}
    ${ui.gyOpen===g.id?`<div class="csdet">${gyResipi(g)}</div>`:''}</div>`}

/* 2026-11-25 (Mira): Claude tak meneka lagi. Sebelum scan Mira tick apa nak diambil (want: template / rupa / tips) + nota pilihan.
   Library ada tiga rak tetap (ui.csShelf: '' = hasil scan, tpl, rupa, tips). Tip = {id,g,bila,t,lvl wajib|cuba,used,hit,miss}. */
const CS_WANT=[['template','Template','Susunan video: babak, masa, shot'],['rupa','Rupa','Font, caption, tajuk, transition, effect'],['tips','Tips','Pengajaran: hook, rentak, ayat, muzik']];
function csWantGet(){if(ui.csWant)return ui.csWant;let w=[];try{w=JSON.parse(localStorage.getItem('ms:csWant')||'[]')}catch(e){}return ui.csWant=w.filter(k=>CS_WANT.some(x=>x[0]===k))}
A.csWant=el=>{gyKeep();const w=csWantGet(),k=el.dataset.x;ui.csWant=w.includes(k)?w.filter(x=>x!==k):CS_WANT.map(x=>x[0]).filter(x=>x===k||w.includes(x));try{localStorage.setItem('ms:csWant',JSON.stringify(ui.csWant))}catch(e){}render(true)};
const TOK_FIX=6000,TOK_CHAT=30000;
function csFixRow(g){const fx=g.fix||{};const busy=fx.st==='proses'&&Date.now()-(fx.at||0)<10*60000;const chat=isUrl(g.chat);
  return `<div class="csfix">${busy?csProg('Claude betulkan ikut nota',50):`<button type="button" class="csbtn" data-act="csFix" data-id="${esc(g.id)}">Betulkan dengan nota</button>${tok(TOK_FIX,'Claude baca hasil scan + nota, tanpa tonton video','Sonnet L')}`}
    ${chat?`<a class="csbtn csa" href="${esc(g.chat)}" target="_blank" rel="noopener">${IC.ext}Buka chat</a>`:''}<button type="button" class="csbtn" data-act="csChat" data-id="${esc(g.id)}"${ui.csChat===g.id?' disabled':''}>${ui.csChat===g.id?'<i class="spin"></i>Buka sesi':chat?'Chat baru':'Chat Claude'}</button>${tok(TOK_CHAT,'buka sesi Terminal; tambah beberapa ribu setiap soalan','Sonnet M')}</div>
    ${fx.st==='error'?`<p class="cserr">Betulkan tak jadi: ${esc(fx.msg||'')}</p>`:''}${g.chatSt&&!chat&&Date.now()-(g.chatAt||0)<20*60000?`<p class="csmeta">Chat: ${esc(g.chatSt)}</p>`:''}`}
A.csFix=el=>{const g=get('gaya',el.dataset.id);modal(`<h2>Betulkan dengan nota</h2><p class="meta">${esc(g.name||'')}. Claude baca hasil scan sahaja, bukan video.</p>
  <label class="f"><span>Apa nak dibetulkan</span><textarea class="inp" id="csFx" rows="3" maxlength="500" placeholder="cth: aku nak font dia, bukan susunan"></textarea></label>
  <div class="btns" style="justify-content:flex-end;align-items:center">${tok(TOK_FIX,'','Sonnet L')}<button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="csFixGo" data-id="${esc(g.id)}">Hantar</button></div>`,TAB.inspiration.c)};
A.csFixGo=el=>{const g=get('gaya',el.dataset.id),nota=(($('#csFx')||{}).value||'').trim();if(!nota){toast('Tulis nota dulu');return}closeModal();
  save('gaya',Object.assign({},g,{fix:{st:'proses',at:Date.now()}}));
  studioJob('gaya_fix',{id:g.id,nota},3*60000).catch(e=>{save('gaya',Object.assign({},get('gaya',g.id),{fix:{st:'error',at:Date.now(),msg:'Mac mini tak jawab'}}))})};
A.csChat=async el=>{const id=el.dataset.id;ui.csChat=id;render();
  try{await studioJob('gaya_chat',{id},3*60000);toast('Sesi Claude dibuka di Mac mini. Butang Buka chat keluar sekejap lagi')}
  catch(e){toast('Tak dapat buka sesi: '+String((e&&(e.message||e.code))||'semak Mac mini hidup').slice(0,80))}finally{ui.csChat=null;render()}};
/* Tip: ubah sendiri (0 token) */
const CS_GRP=['Hook','Editing','Caption','Cerita','Audio','CTA'];
function csTipForm(title,t,attrs){modal(`<h2>${title}</h2>
  <label class="f"><span>Kategori</span><select class="inp" id="ctG">${[...new Set(CS_GRP.concat(t.g||[]))].map(k=>`<option${k===(t.g||'Editing')?' selected':''}>${esc(k)}</option>`).join('')}</select></label>
  <label class="f"><span>Bila (keadaan, cth "vlog tempat")</span><input class="inp" id="ctB" value="${esc(t.bila||'')}" maxlength="60" placeholder="semua video"></label>
  <label class="f"><span>Buat (satu ayat arahan)</span><textarea class="inp" id="ctT" rows="3" maxlength="220">${esc(t.t||'')}</textarea></label>
  <div class="btns" style="justify-content:flex-end;align-items:center">${tok(0)}<button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="csTipOk" ${attrs}>Simpan</button></div>`,TAB.inspiration.c)}
const csTipSet=(g,i,fn)=>csPut(g,{tips:(g.tips||[]).map((t,k)=>k===i?fn(t):t).filter(Boolean)});
A.csTipEdit=el=>{const g=get('gaya',el.dataset.id),i=+el.dataset.x;csTipForm('Ubah tip',(g.tips||[])[i]||{},`data-id="${esc(g.id)}" data-x="${i}"`)};
A.csTipDel=el=>{const g=get('gaya',el.dataset.id),i=+el.dataset.x;confirmBox('Buang tip ni?',()=>{csTipSet(g,i,()=>null);toast('Tip dibuang')},'Ya, buang')};
A.csTipNew=()=>csTipForm('Tip sendiri',{g:'Hook'},`data-k="${esc(ui.csF||'*')}"`);
A.csTipOk=el=>{const v={g:$('#ctG').value,bila:$('#ctB').value.trim(),t:$('#ctT').value.trim()};if(!v.t){toast('Tulis apa yang perlu dibuat');return}closeModal();
  if(el.dataset.id){csTipSet(get('gaya',el.dataset.id),+el.dataset.x,t=>Object.assign({},t,v));toast('Tip dikemas kini');return}
  const fold=el.dataset.k||'*',id='own-'+(fold==='*'?'all':fold),g=get('gaya',id)||{id,name:'Tip sendiri',own:true,status:'simpan',fold,tips:[]};
  const lvl=csLib(fold==='*'?'':fold).tips.filter(t=>t.lvl!=='cuba').length<CS_MAXW?'wajib':'cuba';
  csPut(g,{tips:(g.tips||[]).concat(Object.assign({id:'t'+uid(),on:true,saved:true,lvl},v))});toast('Tip disimpan ke library '+csFoldName(fold)+' ('+(lvl==='wajib'?'Wajib':'Cuba')+')')};
/* Rak library */
const CS_MAXW=7;
const csTipRefs=no=>S.gaya.filter(g=>csDone(g)&&(!no||g.fold===no||g.fold==='*')).flatMap(g=>(g.tips||[]).map((t,i)=>({t,i,g})).filter(x=>x.t.saved));
A.csShelf=el=>{gyKeep();ui.csShelf=el.dataset.x;ui.csG='';render(true)};
A.csG=el=>{ui.csG=el.dataset.x;render(true)};
A.csLvl=el=>{const g=get('gaya',el.dataset.id),i=+el.dataset.x,t=(g.tips||[])[i];if(!t)return;const up=t.lvl==='cuba';
  if(up&&csTipRefs(g.fold==='*'?'':g.fold).filter(x=>x.t.lvl!=='cuba').length>=CS_MAXW){toast('Dah ada '+CS_MAXW+' tip Wajib. Turunkan satu dulu');return}
  csTipSet(g,i,x=>Object.assign({},x,{lvl:up?'wajib':'cuba'}))};
A.csUnsave=el=>{const g=get('gaya',el.dataset.id),k=el.dataset.k,i=+el.dataset.x;confirmBox('Keluarkan dari library?',()=>{
  if(k==='tpl')csPut(g,{tpl:Object.assign({},g.tpl,{saved:false})});else if(k==='look')csPut(g,{looks:g.looks.map((l,j)=>j===i?Object.assign({},l,{saved:false,st:'',on:false}):l)});else csTipSet(g,i,g.own?()=>null:t=>Object.assign({},t,{saved:false,on:false}));toast('Dikeluarkan dari library')},'Ya, keluarkan')};
function csShelfView(f){const k=ui.csShelf,lib=csLib(f);
  if(k==='tips'){const R=csTipRefs(f);const grp=[...new Set(R.map(x=>x.t.g||'Editing'))];const gsel=grp.includes(ui.csG)?ui.csG:'';const nw=R.filter(x=>x.t.lvl!=='cuba').length;
    const L=R.filter(x=>!gsel||(x.t.g||'Editing')===gsel).sort((a,b)=>(a.t.lvl==='cuba')-(b.t.lvl==='cuba'));
    return `<div class="cschips">${`<button type="button" class="chip${!gsel?' on':''}" data-act="csG" data-x="">Semua · ${R.length}</button>`+grp.map(x=>`<button type="button" class="chip${gsel===x?' on':''}" data-act="csG" data-x="${esc(x)}">${esc(x)} · ${R.filter(y=>(y.t.g||'Editing')===x).length}</button>`).join('')}</div>
    <p class="csmeta">${nw} / ${CS_MAXW} tip Wajib. Wajib = Claude mesti ikut dan lapor. Cuba = pakai bila sesuai.</p>
    ${L.map(({t,i,g})=>`<div class="cstp${t.lvl==='cuba'?'':' w'}"><div class="cstph"><button type="button" class="cslv" data-act="csLvl" data-id="${esc(g.id)}" data-x="${i}" aria-label="Tukar tahap">${t.lvl==='cuba'?'Cuba':'Wajib'}</button><span class="cstg">${esc(t.g||'Editing')}</span><span class="csmeta">${t.used?`dipakai ${t.used}× · kena ${t.hit||0}`:esc(g.own?'tip sendiri':g.name||'')}</span></div>
      <p>${t.bila?`<b>Bila:</b> ${esc(t.bila)}<br>`:''}<b>Buat:</b> ${esc(t.t)}</p>
      <div class="cstpa"><button type="button" class="csmini" data-act="csTipEdit" data-id="${esc(g.id)}" data-x="${i}" aria-label="Ubah tip">${IC.edit}</button><button type="button" class="csmini" data-act="csUnsave" data-id="${esc(g.id)}" data-k="tip" data-x="${i}" aria-label="Keluarkan dari library">×</button></div></div>`).join('')||'<div class="csempty">Belum ada tip dalam library folder ni.</div>'}
    <div class="csfix"><button type="button" class="csbtn" data-act="csTipNew">${IC.plus}Tip sendiri</button>${tok(0)}</div>`}
  if(k==='tpl')return lib.tpls.map(g=>`<details class="cscard cstd"><summary><span class="csname">${esc(g.name||'Template')}</span><span class="csmeta">${(g.tpl.slots||[]).length} bahagian${g.info&&g.info.dur?' · '+Math.round(g.info.dur)+' saat':''}${(g.used||[]).length?' · dipakai '+g.used.length+' kali':''} · ${esc(csFoldName(csFoldOf(g)))}</span></summary>
      <div class="csslots">${(g.tpl.slots||[]).map((x,i)=>`<div class="csslot"><i>${i+1}</i><div>${x.name?`<b>${esc(x.name)}</b>`:''}<span>${esc(x.d||'')}</span></div>${x.b>0?`<time>${+x.a}–${+x.b} s</time>`:''}</div>`).join('')}</div>
      <div class="csrow"><span style="flex:1"></span><button type="button" class="chip" data-act="csUnsave" data-id="${esc(g.id)}" data-k="tpl">Keluarkan dari library</button></div></details>`).join('')||'<div class="csempty">Belum ada template dalam library folder ni.</div>';
  const TY=[['caption','Caption'],['tajuk','Tajuk'],['transition','Transition'],['effect','Effect']];
  return TY.map(([ty,lb])=>{const L=lib.looks.filter(x=>(x.l.type||'effect')===ty);return L.length?`<p class="csgrp">${lb} · ${L.length}</p><div class="cslooks">${L.map(x=>`<div class="cslook on"><div class="tile t-${esc(ty)}"><span>${ty==='caption'?'Aa':ty==='tajuk'?'Tajuk':ty==='transition'?'⇄':'✦'}</span></div><b>${esc(x.l.name)}</b><span class="d">${esc(x.l.d||'')}</span>
      <div class="lkact">${x.l.sample?`<a class="chip" href="${esc(gyDView(x.l.sample))}" target="_blank" rel="noopener">▶ Contoh</a>`:''}<span class="lkst${x.l.st==='lulus'?' ok':''}">${x.l.st==='lulus'?'Lulus':'Belum lulus'}</span><button type="button" class="chip" data-act="csUnsave" data-id="${esc(x.g.id)}" data-k="look" data-x="${x.i}">Buang</button></div></div>`).join('')}</div>`:''}).join('')||'<div class="csempty">Belum ada rupa dalam library folder ni.</div>'}
function gyView(){const d=ui.gyDraft||{};const F=csFolds();const f=ui.csF||'';const want=csWantGet();const sh=ui.csShelf||'';
  const all=S.gaya.filter(g=>!g.own).sort((a,b)=>(b.created||0)-(a.created||0));
  const run=all.filter(g=>g.status==='scan'||g.status==='error');const done=all.filter(csDone);
  const shown=done.filter(g=>!f||csFoldOf(g)===f||g.fold==='*'||!csFoldOf(g));const lib=csLib(f);
  const withN=new Set(done.map(csFoldOf));const est=want.length>=3?30000:want.length===2?22000:15000;
  const seg=(k,t)=>`<button type="button" class="${sh===k?'on':''}" data-act="csShelf" data-x="${k}">${t}</button>`;
  return `<div class="cs"><div class="cshead"><p class="cseye">${f?'Library '+esc(csFoldName(f)):'Semua library'}</p><h1>Copy Style</h1></div>
  <div class="cschips" aria-label="Library ikut folder"><button type="button" class="chip${!f?' on':''}" data-act="csF" data-x="">Semua</button>${F.map(x=>`<button type="button" class="chip${f===x.no?' on':''}${withN.has(x.no)?'':' dim'}" data-act="csF" data-x="${esc(x.no)}">${esc(x.short)}</button>`).join('')}</div>
  <div class="csseg" role="tablist">${seg('','Scan · '+(shown.length+run.length))}${seg('tpl','Template · '+lib.tpls.length)}${seg('rupa','Rupa · '+lib.looks.length)}${seg('tips','Tips · '+lib.tips.length)}</div>
  ${sh?csShelfView(f):`<div>${`<div class="cspaste"><input id="gyL" aria-label="Paste link video" value="${esc(d.link||'')}" placeholder="Paste link video" inputmode="url" autocapitalize="off" autocorrect="off" enterkeyhint="send"><button type="button" class="go" data-act="gySend" aria-label="Scan"${ui.gyBusy?' disabled':''}>${ui.gyBusy?'<i class="spin"></i>':CS_GO}</button></div>`}
    <div class="cssub"><span>TikTok, IG, FB, Threads, Drive</span><span><button type="button" data-act="gyPaste">Paste</button> · <button type="button" data-act="gyUpload">Upload video / screen record</button></span></div>
    <p class="cswl">Aku nak ambil apa?</p><div class="cswant">${CS_WANT.map(([k,t,dd])=>`<button type="button" class="cswt${want.includes(k)?' on':''}" data-act="csWant" data-x="${k}" aria-pressed="${want.includes(k)}"><b>${t}</b><small>${dd}</small></button>`).join('')}</div>
    <input class="csnin" id="gyN" value="${esc(d.note||'')}" maxlength="200" aria-label="Apa yang aku suka dalam video ni" placeholder="Apa yang aku suka (pilihan), cth: cara tukar shot ikut beat">
    <div class="csnote">${tok(est,'Claude tonton video sekali; kurang kalau tick satu sahaja','Opus L')}<span>${want.length?'Claude cari '+want.map(k=>CS_KIND[k]).join(' + ')+' sahaja.':'Tick sekurang-kurangnya satu.'}</span></div></div>
  ${run.map(gyCard).join('')}
  ${shown.map(gyCard).join('')||(run.length?'':`<div class="csempty">${done.length?'Belum ada style dalam library folder ni.':'Belum ada style. Paste link video yang kau suka di atas.'}</div>`)}`}
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
A.csTipSave=el=>{const g=get('gaya',el.dataset.id);const fo=csFoldOf(g);let nw=csTipRefs(fo==='*'?'':fo).filter(x=>x.g.id!==g.id&&x.t.lvl!=='cuba').length;
  const tips=(g.tips||[]).map(t=>{const sv=t.on!==false;const o=Object.assign({},t,{saved:sv,id:t.id||'t'+uid()});if(sv&&!o.lvl){o.lvl=nw<CS_MAXW?'wajib':'cuba'}if(sv&&o.lvl!=='cuba')nw++;return o});csPut(g,Object.assign({tips,status:'simpan'},csEnsureFold(g)));toast(tips.filter(t=>t.saved).length+' tips disimpan ke library '+csFoldName(csFoldOf(g)))};
A.csLook=el=>{const g=get('gaya',el.dataset.id);const i=+el.dataset.x;csPut(g,{looks:(g.looks||[]).map((l,k)=>k===i?Object.assign({},l,{on:l.on===false}):l)})};
A.csLookSave=el=>{const g=get('gaya',el.dataset.id);const idx=(g.looks||[]).map((l,i)=>l.on!==false&&!l.saved?i:-1).filter(i=>i>=0);if(!idx.length)return;
  confirmBox('Bina '+idx.length+' rupa? Mac mini buka sesi Claude untuk bina contoh 2 saat.',async()=>{closeModal();
    csPut(g,Object.assign({looks:g.looks.map((l,i)=>idx.includes(i)?Object.assign({},l,{saved:true,st:'bina',pct:2,err:''}):l),status:'simpan'},csEnsureFold(g)));ui.csBusy=1;render();
    try{await studioJob('look_build',{id:g.id,i:idx},3*60000);toast('Sesi Claude dibuka. Peratus naik pada kad ni')}
    catch(e){const c=get('gaya',g.id);csPut(c,{looks:(c.looks||[]).map((l,i)=>idx.includes(i)?Object.assign({},l,{saved:false,st:'gagal',err:'Mac mini tak jawab'}):l)});toast('Tak dapat mula: '+String((e&&e.message)||'semak Mac mini').slice(0,80))}
    finally{ui.csBusy=0;render()}},'Ya, bina')};
A.csLookOk=el=>{const g=get('gaya',el.dataset.id);const i=+el.dataset.x;csPut(g,{looks:g.looks.map((l,k)=>k===i?Object.assign({},l,{st:'siap',pct:100,err:''}):l)});toast('Rupa masuk library '+csFoldName(csFoldOf(g)));
  if(window.studioJob)studioJob('look_ok',{id:g.id,i},2*60000).catch(()=>{})};   /* Mac mini: buang ref.mp4 bila semua rupa lulus (0 token) */
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
/* 26 Nov (Mira): link gagal = notifikasi terus dengan sebab (supaya tak cuba banyak kali), dan sebab tu diingat 14 hari dalam phone
   walaupun kad dibuang; tampal link sama lagi = amaran dulu. */
function gyFailGet(){try{const o=JSON.parse(localStorage.getItem('gyFail')||'{}')||{};Object.keys(o).forEach(k=>{if(Date.now()-(o[k].at||0)>14*864e5)delete o[k]});return o}catch(e){return {}}}
const gySeen={},gyPrev={};
setInterval(()=>{if(typeof S==='undefined'||!S.gaya)return;S.gaya.forEach(g=>{const was=gyPrev[g.id];gyPrev[g.id]=g.status;if(g.status!=='error'){delete gySeen[g.id];return}const sig=g.id+'|'+(g.msg||'');if(gySeen[g.id]===sig)return;gySeen[g.id]=sig;
  if(isUrl(g.link)){try{const o=gyFailGet();o[g.link]={msg:String(g.msg||'').slice(0,300),at:Date.now()};localStorage.setItem('gyFail',JSON.stringify(o))}catch(e){}}
  if(was&&was!=='error'&&$('#scrim').hidden)modal(`<h2>Copy Style gagal</h2><p class="meta" style="font-size:14px;line-height:1.5;color:var(--ink)">${esc(String(g.msg||'Tak pasti sebabnya.').slice(0,400))}</p><p class="meta">Jangan cuba link sama lagi; sebabnya sama.</p>
    <div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Tutup</button><button class="btn solid tab" data-act="gyUpload">Upload video / screen record</button></div>`,TAB.inspiration.c)})},3000);
A.gySend=()=>{gyKeep();const d=ui.gyDraft||{};const link=((String(d.link||'').match(/https?:\/\/\S+/)||[])[0]||'').trim();if(!isUrl(link)){toast('Paste link dulu (mula dengan https://)');return}
  const want=csWantGet();if(!want.length){toast('Tick dulu apa nak diambil: Template, Rupa atau Tips');return}
  if(!d.up&&S.gaya.some(g=>g.link===link&&g.status!=='error')){toast('Link ni dah ada dalam senarai');return}
  const bad=!d.up&&!d.force&&gyFailGet()[link];if(bad){confirmBox('Link ni dah gagal tadi: '+String(bad.msg||'').slice(0,160)+' Cuba juga?',()=>{ui.gyDraft=Object.assign({},d,{force:1});A.gySend()},'Cuba juga');return}
  const old=d.retry&&get('gaya',d.retry);const id=old?old.id:'g'+uid();
  save('gaya',Object.assign({},old||{},{id,link,note:String(d.note||'').trim().slice(0,200),want,fx:[],tags:(old&&old.tags)||[],status:'scan',step:'download',pct:3,msg:'Menunggu Mac mini'},ui.csF&&!(old&&old.fold)?{fold:ui.csF}:{},d.up?{upload:d.up.id,srcName:d.up.name}:{}));
  ui.gyDraft={};ui.gyBusy=1;render(true);
  studioJob('gaya_scan',{id},3*60000).then(()=>toast('Mac mini mula download. Peratus naik pada kad')).catch(e=>{toast('Mac mini tak jawab: '+String((e&&e.message)||'').slice(0,80));save('gaya',Object.assign({},get('gaya',id),{status:'error',step:'download',msg:'Mac mini tak jawab. Semak Mac mini hidup, kemudian tekan Cuba lagi.'}))})
   .finally(()=>{ui.gyBusy=0;render()})};
A.gyRetry=el=>{closeModal();const g=get('gaya',el.dataset.id);save('gaya',Object.assign({},g,(g.want||[]).length||!csWantGet().length?{}:{want:csWantGet()},{status:'scan',step:'download',pct:3,msg:'Menunggu Mac mini'}));
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
