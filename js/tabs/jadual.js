/* ---------- To Publish › Jadual (24 Nov 2026, peringkat 2) ----------
   Senarai ikut hari, dikumpul ikut masa. Setiap kad: lencana akaun, Jualan/Creative, produk, hook, Drive, salin caption / hashtag,
   Excluded (atas kad: post cepat, tak dikira kuota, tiada tarikh/masa) dan Scheduled. Ubah slot = status Tetap. Data dalam Sheet U:Z / P:U. 0 token. */
const SCH_COL={miracikcit:'#7A4E2D',miracikcitjuga:'#C08A4B'};   /* coklat gelap / karamel, tiada hijau */
const SCH_CRE='#9A4F5D';
const V_readyProduk=V.ready;
V.ready=()=>{const seg=ui.rdSeg==='produk'?'produk':'jadual';
  const segs=`<div class="seg" style="margin-bottom:14px"><button type="button" class="${seg==='jadual'?'on':''}" data-act="rdSeg" data-x="jadual">Jadual</button><button type="button" class="${seg==='produk'?'on':''}" data-act="rdSeg" data-x="produk">Ikut produk</button></div>`;
  if(seg==='produk'){const h=V_readyProduk();const i=h.indexOf('</div></div>')+12;return i>11?h.slice(0,i)+segs+h.slice(i):segs+h}
  return jadualView(segs)};
A.rdSeg=el=>{ui.rdSeg=el.dataset.x;render(true)};

function capParts(cap){const c=noEmoji(cap||'');const ps=c.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);const isTags=p=>p.split(/\s+/).every(w=>/^[#@]/.test(w));
  return {body:ps.filter(p=>!isTags(p)).join('\n\n'),tags:ps.filter(isTags).join(' ')}}
const schBadge=a=>`<span class="pill smpp" style="--pc:${SCH_COL[a]||'#B0937B'}">@${esc(a||'tiada akaun')}</span>`;
const schKind=k=>`<span class="pill" style="--pc:${k==='Creative'?SCH_CRE:'#B0937B'}">${esc(k)}</span>`;
const schDayLbl=d=>{const x=new Date(d+'T00:00:00');const t=ymd(new Date());const lbl=d===t?'Hari ni':d===addDays(t,1)?'Esok':HARI[x.getDay()];return lbl+' · '+x.getDate()+' '+BULAN[x.getMonth()]};

function jadualRows(){const groups=parseSheet();if(!groups)return null;const plan=schedPlan(groups);const sv=sheetView();const list=[];
  groups.forEach(g=>g.rows.forEach(r=>{const v=plan.get(schKey(r));if(!v||v.status==='Posted')return;list.push({r,v,f:sv?rowFile(r,sv):null})}));
  return {groups,plan,list}}

function jadualView(segs){
  if(!sheetRaw.PRODUCTS)return head('Jadual posting')+segs+sheetNote()+`<div class="empty">${ldr('Sedang baca Sheet',null)}</div>`;
  const J=jadualRows();if(!J)return head('Jadual posting')+segs+sheetNote();
  const W=schedWarn(J.plan,J.groups);const today=ymd(new Date());
  const live=J.list.filter(x=>x.v.status!=='Excluded'&&x.v.date);const exc=J.list.filter(x=>x.v.status==='Excluded');
  const unslot=J.list.filter(x=>x.v.status!=='Excluded'&&!x.v.date);
  const by=new Map();live.forEach(x=>by.set(x.v.date+'|'+x.v.time+'|'+x.v.acc,x));
  const last=live.reduce((m,x)=>x.v.date>m?x.v.date:m,today);const nDays=Math.max(dayDiff(today,last)+1,7);
  const slots=schedSlots();const nowT=pad(new Date().getHours())+':'+pad(new Date().getMinutes());
  let html='';
  for(let d=0;d<nDays;d++){const date=addDays(today,d);const times=[...new Set(slots.map(s=>s.t))].sort();
    /* slot tarikh lepas yang dah Scheduled masih ditunjuk hari ni sahaja */
    const rowsT=times.map(t=>{const cells=slots.filter(s=>s.t===t).map(s=>{const x=by.get(date+'|'+t+'|'+s.a);if(x)return schCard(x);
        if(d===0&&t<=nowT)return '';return `<div class="schcell empty">${schBadge(s.a)}<span class="meta">${s.k==='C'?'Creative · ':''}Slot kosong</span></div>`}).join('');
      return cells?`<div class="schslot"><div class="schtime">${timeLbl(t)}</div><div class="schcells">${cells}</div></div>`:''}).join('');
    const extra=live.filter(x=>x.v.date===date&&!slots.some(s=>s.t===x.v.time&&s.a===x.v.acc)).map(schCard).join('');   /* slot luar jadual (Tetap) */
    const qd=W.days[d];const short=qd?SCHED_ACC.filter(a=>qd.quota[a].have<qd.quota[a].need).map(a=>`@${a} ${qd.quota[a].have}/${qd.quota[a].need}`):[];
    if(!rowsT&&!extra)continue;
    html+=`<div class="card big glass schday"><div class="rowh"><h3 style="font-size:16px">${schDayLbl(date)}</h3>${short.length?`<span class="pill" style="--pc:#C0392B">${esc(short.join(' · '))}</span>`:`<span class="pill" style="--pc:#7A4E2D">Penuh</span>`}</div>${rowsT}${extra?`<div class="schslot"><div class="schtime">Lain</div><div class="schcells">${extra}</div></div>`:''}</div>`}
  /* amaran */
  const warn=[];const late=W.soon.filter(x=>x.date<=addDays(today,3));
  if(late.length)warn.push(`<b>${late.length} video</b> perlu di-schedule dalam 3 hari dan belum ditanda Scheduled.`);
  const emp=W.days.slice(0,7).reduce((n,d)=>n+d.empty.length,0);if(emp)warn.push(`<b>${emp} slot kosong</b> dalam 7 hari ke depan. Stok cukup ${W.fullUntil?'sampai '+schDayLbl(W.fullUntil):'kurang dari sehari'}.`);
  if(W.short.length)warn.push(`<b>${W.short.length} produk</b> kurang 3 video setiap akaun: ${W.short.slice(0,3).map(s=>esc(s.name)+' ('+SCHED_ACC.map(a=>(s.c[a]||0)).join('/')+')').join(', ')}${W.short.length>3?' dan '+(W.short.length-3)+' lagi':''}.`);
  if(unslot.length)warn.push(`${unslot.length} video belum dapat slot dalam 90 hari.`);
  const busy=schedBusy?`<div style="margin-bottom:12px">${ldr((schedProg&&schedProg.txt)||'Kemas kini jadual',schedProg&&schedProg.pct)}</div>`:'';
  return head(live.length+' video dijadualkan',`<button class="btn sm" data-act="schRun">Susun semula</button>`)+segs+sheetNote()+busy+
    (warn.length?`<div class="banner glass" style="--c:#C0392B">${warn.map(w=>`<div>⚠ ${w}</div>`).join('')}</div>`:'')+prodBox()+
    `<div class="list">${html||'<div class="empty">Tiada video untuk dijadualkan.</div>'}</div>`+
    (exc.length?`<p class="eyebrow" style="margin-top:22px">Excluded · post cepat · ${exc.length}</p><div class="list">${exc.map(schCard).join('')}</div>`:'')+
    `<p class="meta" style="margin-top:16px">${tok(0)} Masa ini untuk semua platform. Tanda Scheduled bila dah schedule. Excluded = post cepat, tak dikira kuota.</p>`}

function schCard(x){const {r,v,f}=x;const k=schKey(r);const cp=capParts(r.caption);const hook=noEmoji(String(r.caption||'').split('\n')[0]).trim()||v.prod;
  const sch=v.status==='Scheduled',exc=v.status==='Excluded';const today=ymd(new Date());const late=!sch&&!exc&&v.date&&dayDiff(today,v.date)<=3;
  const drv=f&&f.drive?`<a class="btn sm" href="https://drive.google.com/file/d/${encodeURIComponent(f.drive)}/view" target="_blank" rel="noopener">${IC.ext}Drive</a>`:f?(()=>{const st=upState(f);return st.pct!=null?ldr('Upload',st.pct):`<span class="pill" style="--pc:${st.c}">${st.spin?'<i class="spin"></i>':''}${esc(st.t)}</span>`})():'';
  return `<div class="schcell${sch?' done':''}${late?' late':''}" id="sc-${esc(k.replace('|','-'))}">
   <div class="rowh" style="align-items:center;gap:6px">${chk(exc,'schExc',k,'Excluded')}${v.status==='Tetap'?'<span class="pill">Tetap</span>':''}</div>
   <div class="schtags">${schBadge(v.acc)}${schKind(v.kind)}${v.date?`<span class="pill" style="--pc:#D6C4B6">${schDayLbl(v.date).split(' · ')[1]} · ${timeLbl(v.time)}</span>`:''}</div>
   <div style="font-weight:600;margin-top:6px">${esc(v.prod)}${r.vid?` <span class="meta">· VID ${esc(r.vid)}</span>`:''}</div>
   <div class="meta schhook">${esc(hook)}</div>
   <div class="btns" style="margin-top:8px;gap:6px">${cp.body?`<button class="btn sm" data-act="copy" data-x="${esc(cp.body)}">${IC.copy}Caption</button>`:''}${cp.tags?`<button class="btn sm" data-act="copy" data-x="${esc(cp.tags)}">${IC.copy}Hashtag</button>`:''}${drv}
    ${exc?'':`<button class="btn sm" data-act="schEdit" data-id="${esc(k)}">Ubah slot</button>`}</div>
   ${exc?'':`<div style="margin-top:8px">${chk(sch,'schDone',k,'Scheduled')}</div>`}</div>`}

/* Tulis satu baris ke Sheet (U:Z / P:U) */
async function schSet(k,patch,msg){const [tab,row]=k.split('|');const t=SH[tab],raw=sheetRaw[tab];if(!raw||!MCP){toast('Sheet belum bersambung');return}
  const r=(parseSheet()||[]).flatMap(g=>g.rows).find(x=>x.tab===tab&&x.row===+row);if(!r)return;
  const v=Object.assign({},schedPlan(parseSheet()).get(k)||{},patch);const vals=[v.date||'',v.time||'',v.acc||'',v.kind||'',v.prod||'',v.status||''];
  const a=raw[+row-1]=(raw[+row-1]||[]).slice();const old=vals.map((_,i)=>a[t.sc+i]);vals.forEach((x,i)=>a[t.sc+i]=x);schedBusy=true;schedProg={pct:30,txt:'Simpan ke Sheet'};render();
  const c0=String.fromCharCode(65+t.sc),c1=String.fromCharCode(65+t.sc+5);
  try{await sheetWrite(`${t.q}!${c0}${row}:${c1}${row}`,[vals]);schedProg={pct:70,txt:'Susun semula slot lain'};schedBusy=false;await autoSched(true);toast(msg||'Disimpan')}
  catch(e){old.forEach((x,i)=>a[t.sc+i]=x);toast('Tak dapat simpan ke Sheet')}finally{schedBusy=false;schedProg=null;render()}}
A.schDone=el=>{const k=el.dataset.id;const on=el.getAttribute('aria-pressed')!=='true';schSet(k,{status:on?'Scheduled':'Tetap'},on?'Ditanda Scheduled':'Scheduled dibuang')};
A.schExc=el=>{const k=el.dataset.id;const on=el.getAttribute('aria-pressed')!=='true';schSet(k,on?{status:'Excluded',date:'',time:''}:{status:'',date:'',time:''},on?'Excluded: tak dikira kuota':'Masuk semula jadual')};
A.schRun=()=>{autoSched(true);render()};
A.schEdit=el=>{const k=el.dataset.id;const v=schedPlan(parseSheet()).get(k)||{};const times=[...new Set(schedSlots().map(s=>s.t))].sort();
  modal(`<h2>Ubah slot</h2><p class="meta">${esc(v.prod||'')}</p>
   <label class="f"><span>Tarikh</span><input class="inp" type="date" id="se-d" value="${esc(v.date||ymd(new Date()))}"></label>
   <label class="f"><span>Masa</span><select class="inp" id="se-t">${times.concat(times.includes(v.time)||!v.time?[]:[v.time]).map(t=>`<option value="${t}" ${t===v.time?'selected':''}>${timeLbl(t)}</option>`).join('')}</select></label>
   <label class="f"><span>Akaun</span><select class="inp" id="se-a">${SCHED_ACC.map(a=>`<option ${a===v.acc?'selected':''}>${a}</option>`).join('')}</select></label>
   <div class="btns" style="justify-content:space-between"><button class="btn" data-act="schAuto" data-id="${esc(k)}">Biar app pilih</button><div class="btns"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="schSave" data-id="${esc(k)}">Simpan</button></div></div>`,'#7A4E2D')};
A.schSave=el=>{const k=el.dataset.id;const date=$('#se-d').value,time=$('#se-t').value,acc=$('#se-a').value;if(!date||!time)return;
  const clash=jadualRows().list.find(x=>schKey(x.r)!==k&&x.v.date===date&&x.v.time===time&&x.v.acc===acc&&/^(scheduled|tetap)$/i.test(x.v.status));
  if(clash){toast('Slot tu dah ada video Tetap/Scheduled: '+clash.v.prod);return}
  closeModal();schSet(k,{date,time,acc,status:'Tetap'},'Slot ditukar')};
A.schAuto=el=>{closeModal();schSet(el.dataset.id,{date:'',time:'',status:''},'App akan pilih slot')};

/* Pelan produksi (peringkat 3): job akan datang + deadline shoot / edit + berapa video lagi */
function prodBox(){const P=prodPlanC();if(!P)return '';const rows=P.jobs.concat(P.cres).map(it=>{const p=P.res[it.id];if(!p)return '';const red=p.late||p.urgent||!p.post;
    return `<div class="prodrow${red?' red':''}"><div style="min-width:0"><b>${esc(it.title||'Item')}</b> <span class="meta">${p.kind} · ${p.need} video</span><div class="meta">${p.post?`${p.shootBy?'Shoot by '+dmy(p.shootBy)+' · ':''}Edit by ${dmy(p.editBy)} · Post ${dmy(p.post)}${p.postEnd?'–'+dmy(p.postEnd):''}`:'Tiada slot kosong'}${p.late?' · lewat dari deadline '+dmy(p.due):''}</div></div></div>`}).join('');
  const more=P.gapJ>0||P.gapC>0?`<div class="meta" style="margin-top:8px">Untuk penuhkan 14 hari: perlu <b>${P.moreProducts} produk lagi</b> (${P.gapJ} video jualan)${P.gapC?` dan <b>${P.gapC} video creative</b>`:''}.</div>`:`<div class="meta" style="margin-top:8px">14 hari ke depan penuh.</div>`;
  const open=ui.prodOpen!==false;
  return `<div class="card glass" style="margin-bottom:14px"><button class="rowh" type="button" data-act="prodTog" style="width:100%;background:none;border:0;padding:0;text-align:left"><p class="eyebrow" style="margin:0">Pelan produksi · ${P.jobs.length+P.cres.length} akan datang</p><span class="meta">${open?'Tutup':'Buka'}</span></button>${open?rows+more:''}</div>`}
A.prodTog=()=>{ui.prodOpen=ui.prodOpen===false;render(true)};

/* ---------- Peringkat 4: kad Home + Google Calendar ---------- */
const schStockCol=n=>n>=5?'#7A4E2D':n>=2?'#D1A23A':'#C0392B';
function schedHome(){if(!sheetRaw.PRODUCTS)return '';const J=jadualRows();if(!J)return '';const W=schedWarn(J.plan,J.groups);const today=ymd(new Date());
  const days=W.fullUntil?dayDiff(today,W.fullUntil)+1:0;const col=schStockCol(days);
  const strip=W.days.map(d=>{const need=SCHED_ACC.reduce((n,a)=>n+d.quota[a].need,0),have=SCHED_ACC.reduce((n,a)=>n+d.quota[a].have,0);const c=have>=need?'#7A4E2D':have>0?'#D1A23A':'#C0392B';
    return `<i title="${esc(schDayLbl(d.date))}: ${have}/${need}" style="background:${c}"></i>`}).join('');
  const late=W.soon.length,P=prodPlanC();const urg=P?Object.values(P.res).filter(p=>p.urgent||p.late).length:0;
  const rows=`<div class="schstrip">${strip}</div><div class="meta" style="display:flex;justify-content:space-between;margin-top:4px"><span>Hari ni</span><span>14 hari</span></div>`+
    ccRow('Stok cukup',days?'sampai '+schDayLbl(W.fullUntil).split(' · ')[1]:'kurang sehari',col,Math.min(100,days/14*100))+
    (late?ccRow('Belum Scheduled (3 hari)',late+' video','#C0392B',100):'')+
    (urg?ccRow('Perlu shoot / edit segera',urg+' job','#C0392B',100):'')+
    (P&&P.moreProducts?ccRow('Untuk penuhkan 14 hari',P.moreProducts+' produk lagi','#D1A23A',0):'');
  return ccard('ready','Jadual posting',days+' hari stok · 9 posting sehari',days,rows).replace('<div class="ccmore">',`<div style="margin-top:6px">${tok(0)}</div><div class="ccmore">`)}

/* Calendar: slot posting 7 hari ke depan (tajuk ada masa + akaun) dan deadline Shoot by / Edit by. noRemind = tiada notifikasi. */
let schCalBusy=false,schCalAt=0;
async function schedCal(){if(schCalBusy||mode!=='live'||calState!=='ok'||!MCP||!sheetRaw.PRODUCTS)return;if(Date.now()-schCalAt<180000)return;schCalAt=Date.now();schCalBusy=true;
  try{const J=jadualRows();if(!J)return;const today=ymd(new Date()),end=addDays(today,7);const want=[];
    J.list.forEach(({r,v})=>{if(v.status==='Excluded'||!v.date||v.date<today||v.date>end)return;
      want.push({ref:'post-'+r.tab+'-'+r.row,date:v.date,time:v.time,title:`${timeLbl(v.time).toUpperCase()} · @${v.acc} · ${v.kind} · ${v.prod}`,acc:v.acc})});
    const P=prodPlanC();if(P)P.jobs.concat(P.cres).forEach(it=>{const p=P.res[it.id];if(!p)return;
      if(p.shootBy&&p.shootBy>=today)want.push({ref:'shoot-'+it.id,date:p.shootBy,title:'Shoot by: '+(it.title||'')+' ('+p.need+' video)'});
      if(p.editBy&&p.editBy>=today)want.push({ref:'edit-'+it.id,date:p.editBy,title:'Edit by: '+(it.title||'')})});
    let n=0;const keep=new Set(want.map(w=>w.ref));
    for(const w of want){if(n>=15)break;const ex=calEvents.find(e=>e.note.includes('Ref: '+w.ref));if(ex&&ex.date===w.date&&(ex.time||'')===(w.time||'')&&ex.title===w.title)continue;
      const nx=addDays(w.date,1);const st=w.time?w.date+'T'+w.time+':00':w.date+'T00:00:00';const en=w.time?w.date+'T'+(()=>{const [h,m]=w.time.split(':').map(Number);const t=h*60+m+15;return pad(Math.floor(t/60))+':'+pad(t%60)})()+':00':nx+'T00:00:00';
      const p={summary:w.title,description:[w.acc?'Akaun: '+w.acc:'','Ref: '+w.ref,MARK].filter(Boolean).join('\n'),allDay:!w.time,startTime:st,endTime:en,noRemind:true};
      if(ex)await MCP.callTool(GC,'update_event',Object.assign({eventId:ex.id},p));else await MCP.callTool(GC,'create_event',p);n++}
    /* slot / deadline yang dah tiada (Excluded, ditukar, dah lepas) dibuang */
    for(const e of calEvents){const m=e.note.match(/Ref: ((?:post|shoot|edit)-\S+)/);if(!m||keep.has(m[1])||e.date<today||n>=25)continue;await MCP.callTool(GC,'delete_event',{eventId:e.id});n++}
    if(n)loadCal()}catch(e){}finally{schCalBusy=false}}
