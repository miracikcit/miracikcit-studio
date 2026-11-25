/* ---------- READY TO PUBLISH ---------- */
function capVariants(cap,link){const c=noEmoji(cap);const ps=c.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);const isTags=p=>p.split(/\s+/).every(w=>/^[#@]/.test(w));
  const body=ps.filter(p=>!isTags(p)),tags=ps.filter(isTags);
  const strip=p=>p.split(/\s+/).filter(w=>!/shopee/i.test(w)).join(' ');
  return {fb:[body.join('\n\n'),link||'',tags.join('\n\n')].filter(Boolean).join('\n\n'),ig:[body.join('\n\n'),tags.join('\n\n')].filter(Boolean).join('\n\n'),tt:[body.join('\n\n'),tags.map(strip).filter(Boolean).join('\n\n')].filter(Boolean).join('\n\n')}}
V.ready=()=>{const sv=sheetView();const items=appReady(sv);
  if(!sv)return head('Sheet CONTENT 2026')+sheetNote()+lsChoice()+itemReady(items);
  const byG=new Map();sv.ready.forEach(r=>{if(!byG.has(r.group))byG.set(r.group,[]);byG.get(r.group).push(r)});
  const groups=[...byG.entries()].map(([g,rows])=>({g,rows:rows.map(r=>({r,d:deadline(rowStart(r,sv),7)}))}));
  /* 24 Nov (Mira): jadual posting dalam kad sedia ada; kad disusun ikut slot terawal */
  const plan=schedPlan(sv.groups||parseSheet()||[]);const g1=x=>x.rows.reduce((m,{r})=>{const v=plan.get(schKey(r));return v&&v.date&&v.status!=='Excluded'&&(v.date+v.time)<m?v.date+v.time:m},'9999');
  groups.sort((a,b)=>g1(a)<g1(b)?-1:g1(a)>g1(b)?1:Math.min(...a.rows.map(x=>x.d?x.d.left:99))-Math.min(...b.rows.map(x=>x.d?x.d.left:99)));
  const fresh=freshFinals().map(f=>({f,g:matchFile(f.name,sv.groups)}));
  /* 25 Nov (Mira): rupa baru. Tajuk nombor + kalendar mini + cip + jadual dua akaun (jadual.js), kemudian kad posting padat. */
  const allG=sv.groups||parseSheet()||[];
  return `<div class="tp">`+tpTop(plan,allG,sv.ready,fresh.length)+sheetNote()+prodBox()+tpSched(plan,allG)+freshStrip(fresh)+lsChoice()+`<p class="tpday" style="margin-top:14px">Posting cards</p><div class="list">${groups.map(({g,rows})=>{
    const sug=!g.shopee&&S.items.find(it=>it.shopee&&nrm(g.name).startsWith(nrm(it.title).slice(0,8)));
    const isNew=fresh.some(x=>x.g===g);
    return `<div class="card glass tpc" id="rg-${g.tab}-${g.start}"${isNew?' style="box-shadow:0 0 0 1.5px var(--ok) inset"':''}><div class="rowh"><div><h3 style="font-size:14px">${isNew?'<span class="pill" style="--pc:var(--ok);margin-right:6px">New</span>':''}${esc(g.name)}</h3><div class="meta">${g.tab==='PRODUCTS'?'No. '+esc(g.no)+' · ':''}${rows.length} video${rows.length>1?'s':''} waiting</div></div>
     <div style="display:flex;align-items:center;gap:8px;flex:none">${g.shopee?`<button class="btn solid shopee" data-act="copy" data-x="${esc(g.shopee)}">${IC.links}Link Shopee</button>`:''}${chk(rows.every(({r})=>(get('readymeta',rmKey(r))||{}).settled),'settleG',rows.map(({r})=>rmKey(r)).join(','),'Settled')}</div></div>
    ${g.tab==='PRODUCTS'&&!g.shopee?`<div class="btns" style="margin-top:8px;flex-wrap:nowrap"><input class="inp" id="rs-${g.start}" data-lk="${g.start}|s" value="${esc(sug?sug.shopee:'')}" placeholder="Paste link Shopee di sini" inputmode="url"><button class="btn solid shopee" data-act="lkSave" data-id="${g.start}">Simpan</button></div>`:''}
    ${rows.map(({r,d})=>{const rm=get('readymeta',rmKey(r))||{};const done=isPub(r);const k=schKey(r);const v=plan.get(k)||{};const exc=v.status==='Excluded';const cp=capParts(r.caption);
      const late=!exc&&v.date&&v.status!=='Scheduled'&&!r.sched.some(Boolean)&&dayDiff(ymd(new Date()),v.date)<=3;const f=rowFile(r,sv);return `<div class="vid" id="rv-${r.tab}-${r.row}">
      <div class="rowh" style="align-items:center;gap:6px"><div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;min-width:0">${tpLine(k,v,late)}${exc||!v.acc?'':tpWho(v.acc)}${chk(exc,'schExc',k,'Excluded')}${exc?'':tpMoved(r,v)}${f&&!f.drive?dlBtn(f,rm.downloaded,rmKey(r),'dl'):''}</div><div class="tptop">${f?(f.drive?vidBtn(f,rm.downloaded,rmKey(r)):''):`<span class="tpvb off" role="img" aria-label="Video removed">❌</span>`}</div></div>
      <div class="tptitle">${r.vid?'VID '+esc(r.vid)+' · ':''}${esc(noEmoji(String(r.caption).split('\n')[0]))}${done?` <span class="pill">All posted, tick Settled</span>`:''}</div>
      <div class="tpgrid"><span class="tpgl">Copy</span><div class="tpacts"><button class="tt" data-act="cap" data-x="${r.tab}|${r.row}|tt">${IC.copy}TikTok</button><button class="ig" data-act="cap" data-x="${r.tab}|${r.row}|ig">${IC.copy}IG</button><button class="fb" data-act="cap" data-x="${r.tab}|${r.row}|fb">${IC.copy}FB</button>${cp.tags?`<button data-act="copy" data-x="${esc(cp.tags)}">#Tag</button>`:'<span></span>'}</div>
      <span class="tpgl">Sched</span>${tpTicks(r,1)}</div></div>`}).join('')}</div>`}).join('')||(items.length?'':`<div class="empty">All videos settled.</div>`)}</div>
  ${itemReady(items)}
  ${sv.unmatched.length?`<p class="eyebrow" style="margin-top:22px">Ada dalam folder, tiada dalam sheet · ${sv.unmatched.length}</p><div class="list">${sv.unmatched.map(f=>`<div class="card glass"><div class="rowh"><div><h3>${esc(f.name.replace(/\.(mp4|mov|m4v)$/i,'').replace(/_FINAL$/i,'').replace(/[_-]+/g,' '))}</h3><div class="meta">${esc(f.name)}</div></div><button class="btn sm" data-act="filePub" data-x="${esc(f.name)}">${IC.check}Published</button></div>${trk(deadline(f.mtime,7),'Publish dalam 1 minggu')}</div>`).join('')}</div>`:''}
</div>`};
const itemReady=items=>items.length?`<p class="eyebrow" style="margin-top:22px">Dari app, belum dalam sheet · ${items.length}</p><div class="list">${items.map(it=>`<div class="card glass"><div class="rowh"><div><h3>${esc(it.title)}</h3><div class="meta">${esc([it.account,it.note].filter(Boolean).join(' · '))}</div></div>${dlBtn(itemFile(it),it.downloaded,it.id,'dlItem')}</div>${it.sample?sampleBlock(it):trk(deadline((it.stageAt&&it.stageAt.ready)||it.created,7),'Publish dalam 1 minggu')}<div class="btns" style="margin-top:12px"><button class="btn sm solid tab" data-act="itemPub" data-id="${it.id}">${IC.check}Settled</button><button class="btn icon sm bad" data-act="delItem" data-id="${it.id}" aria-label="Padam">${IC.trash}</button></div></div>`).join('')}</div>`:'';
/* Download: video final dari 00. TO POST FINAL, disalin ke Drive oleh Mac mini. */
function rowFile(r,sv){const fs=sv.gf.get(r.group)||[];return fs.find(f=>r.vid&&new RegExp('_'+r.vid+'_').test(f.name))||(fs.length===1||r.group.rows.length===1?fs[0]:null)||null}
function itemFile(it){const files=((S.sync.topost||{}).files)||[];return files.find(f=>(it.files||[]).includes(f.name))||null}
const dlUrl=id=>'https://drive.usercontent.google.com/download?id='+encodeURIComponent(id)+'&export=download&confirm=t';
/* iPhone: link Drive tak boleh download dalam app home screen. Jadi app muat video dulu (tunjuk %),
   kemudian butang "Simpan video" buka menu Share iPhone (pilih Save Video untuk masuk Photos). */
const DLQ={};
function dlBtn(f,done,id,act){
  if(!f)return done?`<span class="pill" style="--pc:var(--ok)">${IC.check}Downloaded</span>`:`<span class="pill" title="Tiada fail dalam folder 00. TO POST FINAL">Tiada fail</span>`;
  if(!f.drive){const st=upState(f);return `<span class="pill" style="--pc:${st.c}"><i class="spin"></i>${st.pct!=null?'Upload '+st.pct+'%':st.t}</span>`}
  const q=DLQ[id];const a=`data-id="${esc(id)}" data-x="${act}" data-u="${esc(dlUrl(f.drive))}" data-n="${esc(f.name)}" data-f="${esc(f.drive)}" data-dlid="${esc(id)}"`;
  if(q&&q.file)return `<button class="btn sm solid tab" data-act="dlSave" ${a}>${IC.dl}Simpan video</button>`;
  if(q)return `<button class="btn sm" disabled ${a}>Memuat ${q.pct||0}%</button>`;
  const drv='https://drive.google.com/file/d/'+encodeURIComponent(f.drive)+'/view';
  /* 24 Nov (Mira): buang Download / Muat dalam app, guna butang Drive sahaja */
  return `<a class="btn sm ${done?'':'solid tab'}" href="${esc(drv)}" target="_blank" rel="noopener" data-drv="1" ${a}>${done?IC.check:IC.dl}Download</a>`}
/* 25 Nov petang (Mira): butang video bulat (emoji sahaja) di baris atas kad posting, buka fail di Drive */
function vidBtn(f,done,id){return `<a class="tpvb${done?' done':''}" href="${esc('https://drive.google.com/file/d/'+encodeURIComponent(f.drive)+'/view')}" target="_blank" rel="noopener" data-drv="1" data-id="${esc(id)}" data-x="dl" aria-label="Download video${done?' (downloaded)':''}">🎥</a>`}
/* Buka di Drive: link biasa (app Google Drive terbuka sendiri). Tanda Downloaded tanpa halang link. */
document.addEventListener('click',e=>{const el=e.target.closest&&e.target.closest('a[data-drv]');if(el)setTimeout(()=>dlMark(el),300)});
function dlMark(el){const id=el.dataset.id;
  if(el.dataset.x==='dlItem'){const it=get('items',id);if(it&&!it.downloaded)save('items',Object.assign({},it,{downloaded:true,downloadedAt:Date.now()}))}
  else{const rm=get('readymeta',id)||{id};if(!rm.downloaded)save('readymeta',Object.assign({},rm,{downloaded:true,downloadedAt:Date.now()}))}}
A.dlGo=async el=>{const id=el.dataset.id,fid=el.dataset.f,name=el.dataset.n;if(DLQ[id])return;DLQ[id]={pct:0};render();
  try{const parts=[];let got=0,total=1,CH=8000000;
    while(got<total){let j,tries=0;for(;;){try{j=await window.studioChunk(fid,got,CH);break}catch(e){if(++tries>=3)throw e;await new Promise(r=>setTimeout(r,1500))}}
      total=j.total;const bin=atob(j.b64);const u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
      if(!u8.length)throw new Error('kosong');parts.push(u8);got+=u8.length;
      const pct=Math.floor(got/total*100);DLQ[id].pct=pct;const b=document.querySelector(`[data-dlid="${CSS.escape(id)}"]`);if(b)b.textContent='Memuat '+pct+'%'}
    DLQ[id]={file:new File(parts,name,{type:'video/mp4'})};render();toast('Siap dimuat. Tekan Simpan video')}
  catch(e){delete DLQ[id];render();toast('Tak dapat muat video. Semak internet dan cuba lagi')}};
A.dlSave=async el=>{const id=el.dataset.id;const q=DLQ[id];if(!q||!q.file)return;
  try{if(navigator.canShare&&navigator.canShare({files:[q.file]})){await navigator.share({files:[q.file]})}
    else{const u=URL.createObjectURL(q.file);const a=document.createElement('a');a.href=u;a.download=q.file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000)}
    dlMark(el);delete DLQ[id];render();toast('Video disimpan')}
  catch(e){if(e&&e.name==='AbortError')toast('Dibatalkan. Tekan Simpan video sekali lagi');else toast('Tak dapat buka menu simpan')}};
A.tick=el=>{const [tab,row,kind,idx]=el.dataset.x.split('|');sheetTick(tab,+row,kind,+idx)};
A.cap=el=>{const [tab,row,v]=el.dataset.x.split('|');for(const g of parseSheet()||[])for(const r of g.rows)if(r.tab===tab&&r.row===+row){const nolink=v==='fb'&&g.tab==='PRODUCTS'&&!g.shopee;return copyText(capVariants(r.caption,g.shopee)[v],nolink?'Dicopy tanpa link, belum ada link Shopee':'Caption '+({fb:'FB',ig:'IG',tt:'TikTok'}[v])+' dicopy')}};
A.lkSave=el=>saveLinks(+el.dataset.id);
A.dl=el=>{const id=el.dataset.id;const rm=get('readymeta',id)||{id};save('readymeta',Object.assign({},rm,{downloaded:!rm.downloaded}))};
A.settle=el=>{const id=el.dataset.id;const rm=get('readymeta',id)||{id};const on=!rm.settled;save('readymeta',Object.assign({},rm,{settled:on,settledAt:Date.now()}));
  if(!on){toast('Dibatalkan');return}toast('Settled. Dipindah ke Published');
  /* Platform yang dijadual tapi belum ditanda Posted: tanda Posted dalam Sheet */
  const r=(parseSheet()||[]).flatMap(g=>g.rows).find(x=>rmKey(x)===id);if(!r||!MCP)return;const t=SH[r.tab];
  r.sched.forEach((sc,i)=>{if(sc&&!r.posted[i])sheetTick(r.tab,r.row,'posted',i)})};
A.settleG=el=>{const ids=el.dataset.id.split(',');const on=el.getAttribute('aria-pressed')!=='true';ids.forEach(id=>{const rm=get('readymeta',id)||{id};if(!!rm.settled!==on){const b=document.createElement('i');b.dataset.id=id;A.settle(b)}})};
A.dlItem=el=>{const it=get('items',el.dataset.id);save('items',Object.assign({},it,{downloaded:!it.downloaded}))};
A.itemPub=el=>moveItem(get('items',el.dataset.id),'published');
A.filePub=el=>{const n=el.dataset.x;save('published',{name:n,title:n.replace(/\.(mp4|mov|m4v)$/i,'').replace(/_FINAL$/i,'').replace(/[_-]+/g,' '),date:ymd(new Date()),source:'file'});toast('Published')};
A.shConn=async()=>{try{const r=await MCP.callTool(GS,'get_values',{spreadsheetId:SHEET_ID,range:SH.PRODUCTS.range});sheetRaw.PRODUCTS=(r.payload||{}).values||[];sheetState='ok';sheetErr=null;render();MCP.invalidate(GS,'get_values').catch(()=>{})}catch(e){sheetErr=e.code;toast(sheetErrText(e.code))}};
async function sheetAcc(tab,row,i,val){const t=SH[tab],raw=sheetRaw[tab];if(!raw)return;const ci=t.acc+i;const col=String.fromCharCode(65+ci);const r=raw[row-1]=(raw[row-1]||[]).slice();const old=r[ci];r[ci]=val;
  try{await sheetWrite(`${t.q}!${col}${row}`,[[val]]);toast('Akaun disimpan dalam sheet')}catch(e){r[ci]=old;render();toast(e.code==='tool_error'?'Sheet tolak perubahan':sheetErrText(e.code))}}


/* Kad New Videos (2026-11-23, Mira): nama = ayat hook (baris pertama caption Sheet) supaya setiap video lain-lain,
   dengan status setiap video: tunggu upload / sedang upload ke Drive (bar %) / sedia download / belum dalam Sheet. */
function fileRow(f,g){if(!g)return null;const vm=f.name.match(/_(\d+)(?:_|\.)/);return g.rows.find(r=>r.vid&&vm&&String(r.vid)===vm[1])||(g.rows.length===1?g.rows[0]:null)}
function newName(f,g){if(f.hook)return noEmoji(f.hook);const r=fileRow(f,g);const hook=r&&noEmoji(String(r.caption||'').split('\n')[0]).trim();return hook||f.name.replace(/\.(mp4|mov|m4v)$/i,'').replace(/_FINAL$/i,'').replace(/[_-]+/g,' ')}
function upState(f){const u=S.sync.finalsup||{};const fresh=Date.now()-(u.at||0)<15*60e3;
  if(f.drive)return {t:'Stored in GDrive',c:'var(--ok)'};
  if(fresh&&u.name===f.name)return {t:'Sedang upload ke Drive',c:'var(--warn)',pct:u.pct||0};
  if(Date.now()-(f.mtime||0)<120e3)return {t:'Baru siap render, tunggu sekejap',c:'var(--warn)',spin:1};
  return {t:fresh&&(u.queue||[]).includes(f.name)?'Dalam giliran upload':'Tunggu upload ke Drive',c:'var(--muted)',spin:1}}
/* 24 Nov (Mira): New videos jadi senarai ringkas: nama hook + Preview (Drive) + POST NOW (lompat ke kad posting di bawah). */
function freshStrip(fr){if(!fr.length)return '';const sv=sheetView();
  return `<div class="card glass" id="tpnew" style="margin:10px 0;box-shadow:0 0 0 1.5px var(--ok) inset"><p class="eyebrow" style="margin:0">New videos · ${fr.length}</p>
   ${fr.map(({f,g})=>{const st=upState(f),r=fileRow(f,g);const card=g&&sv&&sv.ready.some(x=>x.group.tab===g.tab&&x.group.start===g.start);
     const prev=f.drive?`<a class="btn sm" href="https://drive.google.com/file/d/${encodeURIComponent(f.drive)}/view" target="_blank" rel="noopener">${IC.ext}Preview</a>`:'';
     const stat=f.drive?'':st.pct!=null?`<div class="stbar" style="--c:${st.c}"><div class="stt"><span>${st.t}</span><span>${st.pct}%</span></div><div class="stg"><i style="width:${Math.max(3,st.pct)}%"></i></div></div>`:`<span class="pill" style="--pc:${st.c};margin-top:5px">${st.spin?'<i class="spin"></i>':''}${st.t}</span>`;
     return `<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line,rgba(0,0,0,.08))"><div style="min-width:0"><strong>${esc(newName(f,g))}</strong><span class="meta" style="display:block">${esc(g?g.name+(r&&r.vid?' · VID '+r.vid:''):'Belum ada dalam Sheet')} · ${fmtD(f.mtime)}</span>${stat}</div>
       <div class="btns" style="gap:6px;margin-top:8px">${prev}<button class="btn sm solid tab" data-act="toCard" data-x="${card?`rg-${g.tab}-${g.start}`:''}" data-f="${esc(f.name)}">POST NOW</button></div></div>`}).join('')}</div>`}
/* 24 Nov (Mira): POST NOW tanpa kad (produk lama dah published / tiada dalam Sheet) = batch baru: baris baru dalam Sheet, kemudian lompat ke kad. */
async function newBatch(fname){const files=((S.sync.topost||{}).files)||[];const f=files.find(x=>x.name===fname);if(!f)return;
  const groups=parseSheet()||[];const g=matchFile(f.name,groups);const tab=g?g.tab:(/_(FINAL)?\.|^[A-Z][a-z]+_\d/.test(f.name)?'NON':'NON');const raw=sheetRaw[tab]||[];
  let last=4;raw.forEach((r,i)=>{if(r&&String(r[1]||'').trim())last=i+1});const row=last+1;const nos=groups.filter(x=>x.tab===tab).map(x=>+x.no||0);const no=String(Math.max(0,...nos)+1);
  const name=g?g.name:f.name.replace(/\.(mp4|mov|m4v)$/i,'').replace(/_FINAL$/i,'').replace(/[_-]+/g,' ').toUpperCase();const cap=f.hook||'';const F8=Array(8).fill('FALSE');
  const vals=tab==='PRODUCTS'?[[no,name,g&&g.shopee||'','1','1',cap,...F8]]:[[no,name,cap,...F8]];const end=tab==='PRODUCTS'?'N':'K';
  toast('Buat baris baru dalam Sheet (batch baru)');
  try{await sheetWrite(`${SH[tab].q}!A${row}:${end}${row}`,vals);(raw[row-1]=vals[0].slice());raw.length=Math.max(raw.length,row);render(true);
    setTimeout(()=>{const c=document.getElementById(`rg-${tab}-${row}`);if(c)c.scrollIntoView({behavior:'smooth',block:'start'});toast('Kad baru dibuat. Tulis caption dan post')},300)}
  catch(e){toast(e&&e.code==='off'?'Sheet tak bersambung':'Tak dapat tulis ke Sheet')}}
A.toCard=el=>{if(!el.dataset.x&&el.dataset.f){confirmBox('Video ni belum ada kad (produk lama dah published). Buat kad + baris baru dalam Sheet untuk batch baru?',()=>newBatch(el.dataset.f),'Ya, buat kad baru');return}
const c=document.getElementById(el.dataset.x);if(c){c.scrollIntoView({behavior:'smooth',block:'start'});c.animate&&c.animate([{boxShadow:'0 0 0 3px var(--ok) inset'},{boxShadow:'none'}],{duration:1600})}else toast('Video ni dah settled, tengok di tab Published')};