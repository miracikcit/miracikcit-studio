/* ---------- To Publish: jadual posting dalam kad sedia ada (24 Nov 2026, tiada tab / segmen berasingan) ----------
   Senarai ikut hari, dikumpul ikut masa. Setiap kad: lencana akaun, Jualan/Creative, produk, hook, Drive, salin caption / hashtag,
   Excluded (atas kad: post cepat, tak dikira kuota, tiada tarikh/masa) dan Scheduled. Ubah slot = status Tetap. Data dalam Sheet U:Z / P:U. 0 token. */
const SCH_COL={miracikcit:'#7A4E2D',miracikcitjuga:'#C08A4B'};   /* coklat gelap / karamel, tiada hijau */
const SCH_CRE='#9A4F5D';
function capParts(cap){const c=noEmoji(cap||'');const ps=c.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);const isTags=p=>p.split(/\s+/).every(w=>/^[#@]/.test(w));
  return {body:ps.filter(p=>!isTags(p)).join('\n\n'),tags:ps.filter(isTags).join(' ')}}
const schBadge=a=>`<span class="pill smpp" style="--pc:${SCH_COL[a]||'#B0937B'}">@${esc(a||'tiada akaun')}</span>`;
const schKind=k=>`<span class="pill" style="--pc:${k==='Creative'?SCH_CRE:'#B0937B'}">${esc(k)}</span>`;
const schDayLbl=d=>{const x=new Date(d+'T00:00:00');const t=ymd(new Date());const lbl=d===t?'Hari ni':d===addDays(t,1)?'Esok':HARI[x.getDay()];return lbl+' · '+x.getDate()+' '+BULAN[x.getMonth()]};

function jadualRows(){const groups=parseSheet();if(!groups)return null;const plan=schedPlan(groups);const sv=sheetView();const list=[];
  groups.forEach(g=>g.rows.forEach(r=>{const v=plan.get(schKey(r));if(!v||v.status==='Posted')return;list.push({r,v,f:sv?rowFile(r,sv):null})}));
  return {groups,plan,list}}

/* Baris atas setiap video dalam kad To Publish: akaun, jenis, tarikh·masa (tekan untuk ubah) */
function schLine(k,v,late){if(v.status==='Excluded')return `<span class="pill">Post cepat · tak dikira kuota</span>`;
  const when=v.date?`${schDayLbl(v.date)} · ${timeLbl(v.time)}`:'Belum ada slot';
  return `<button type="button" class="pill schwhen${late?' late':''}" data-act="schEdit" data-id="${esc(k)}">${esc(when)}${v.status==='Tetap'?' · Tetap':''} ✎</button>`}
/* Atas To Publish: loader, amaran, pelan produksi (tertutup asal) */
function schTop(plan){const groups=parseSheet()||[];const W=schedWarn(plan,groups);const today=ymd(new Date());const warn=[];
  const late=W.soon.filter(x=>x.date<=addDays(today,3));if(late.length)warn.push(`<b>${late.length} video</b> perlu di-schedule dalam 3 hari.`);
  const emp=W.days.slice(0,7).reduce((n,d)=>n+d.empty.length,0);if(emp)warn.push(`<b>${emp} slot kosong</b> dalam 7 hari. Stok cukup ${W.fullUntil?'sampai '+schDayLbl(W.fullUntil):'kurang sehari'}.`);
  if(W.short.length)warn.push(`<b>${W.short.length} produk</b> kurang 3 video setiap akaun: ${W.short.slice(0,3).map(s=>esc(s.name)).join(', ')}${W.short.length>3?' dan '+(W.short.length-3)+' lagi':''}.`);
  const busy=schedBusy?`<div style="margin-bottom:12px">${ldr((schedProg&&schedProg.txt)||'Kemas kini jadual',schedProg&&schedProg.pct)}</div>`:'';
  return busy+(warn.length?`<div class="banner glass" style="--c:#C0392B;margin-bottom:12px">${warn.map(w=>`<div>⚠ ${w}</div>`).join('')}</div>`:'')+prodBox()}
/* Tick Scheduled (TT/IG/FB/SV) = status Scheduled dalam jadual; buang semua tick = kembali Tetap */
A.tick=async el=>{const [tab,row,kind,idx]=el.dataset.x.split('|');const p=sheetTick(tab,+row,kind,+idx);if(kind!=='sched')return;await p;
  const r=(parseSheet()||[]).flatMap(g=>g.rows).find(x=>x.tab===tab&&x.row===+row);if(!r)return;const k=schKey(r);const v=schedPlan(parseSheet()).get(k)||{};const any=r.sched.some(Boolean);
  if(any&&v.status!=='Scheduled'&&v.status!=='Excluded')schSet(k,{status:'Scheduled'},'Ditanda Scheduled');else if(!any&&v.status==='Scheduled')schSet(k,{status:'Tetap'},'Scheduled dibuang')};

/* Tulis satu baris ke Sheet (U:Z / P:U) */
async function schSet(k,patch,msg){const [tab,row]=k.split('|');const t=SH[tab],raw=sheetRaw[tab];if(!raw||!MCP){toast('Sheet belum bersambung');return}
  const r=(parseSheet()||[]).flatMap(g=>g.rows).find(x=>x.tab===tab&&x.row===+row);if(!r)return;
  const v=Object.assign({},schedPlan(parseSheet()).get(k)||{},patch);const vals=[v.date||'',v.time||'',v.acc||'',v.kind||'',v.prod||'',v.status||''];
  const a=raw[+row-1]=(raw[+row-1]||[]).slice();const old=vals.map((_,i)=>a[t.sc+i]);vals.forEach((x,i)=>a[t.sc+i]=x);schedBusy=true;schedProg={pct:30,txt:'Simpan ke Sheet'};render();
  const c0=String.fromCharCode(65+t.sc),c1=String.fromCharCode(65+t.sc+5);
  try{await sheetWrite(`${t.q}!${c0}${row}:${c1}${row}`,[vals]);schedProg={pct:70,txt:'Susun semula slot lain'};schedBusy=false;await autoSched(true);toast(msg||'Disimpan')}
  catch(e){old.forEach((x,i)=>a[t.sc+i]=x);toast('Tak dapat simpan ke Sheet')}finally{schedBusy=false;schedProg=null;render()}}
A.schExc=el=>{const k=el.dataset.id;const on=el.getAttribute('aria-pressed')!=='true';schSet(k,on?{status:'Excluded',date:'',time:''}:{status:'',date:'',time:''},on?'Excluded: tak dikira kuota':'Masuk semula jadual')};
A.schRun=()=>{autoSched(true);render()};
A.schEdit=el=>{const k=el.dataset.id;const v=schedPlan(parseSheet()).get(k)||{};const times=[...new Set(schedSlots().map(s=>s.t))].sort();
  modal(`<h2>Ubah slot</h2><p class="meta">${esc(v.prod||'')}</p>
   <label class="f"><span>Tarikh</span><input class="inp" type="date" id="se-d" value="${esc(v.date||ymd(new Date()))}"></label>
   <label class="f"><span>Masa</span><select class="inp" id="se-t">${times.concat(times.includes(v.time)||!v.time?[]:[v.time]).map(t=>`<option value="${t}" ${t===v.time?'selected':''}>${timeLbl(t)}</option>`).join('')}</select></label>
   <label class="f"><span>Akaun</span><select class="inp" id="se-a">${SCHED_ACC.map(a=>`<option ${a===v.acc?'selected':''}>${a}</option>`).join('')}</select></label>
   <div class="btns" style="justify-content:space-between"><button class="btn" data-act="schAuto" data-id="${esc(k)}">Biar app pilih</button><div class="btns"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="schSave" data-id="${esc(k)}">Simpan</button></div></div>`,'#7A4E2D')};
A.schSave=el=>{const k=el.dataset.id;const date=$('#se-d').value,time=$('#se-t').value,acc=$('#se-a').value;if(!date||!time)return;
  const clash=(jadualRows()||{list:[]}).list.find(x=>schKey(x.r)!==k&&x.v.date===date&&x.v.time===time&&x.v.acc===acc&&/^(scheduled|tetap)$/i.test(x.v.status));
  if(clash){toast('Slot tu dah ada video Tetap/Scheduled: '+clash.v.prod);return}
  closeModal();schSet(k,{date,time,acc,status:'Tetap'},'Slot ditukar')};
A.schAuto=el=>{closeModal();schSet(el.dataset.id,{date:'',time:'',status:''},'App akan pilih slot')};

/* Pelan produksi (peringkat 3): job akan datang + deadline shoot / edit + berapa video lagi */
function prodBox(){const P=prodPlanC();if(!P)return '';const rows=P.jobs.concat(P.cres).map(it=>{const p=P.res[it.id];if(!p)return '';const red=p.late||p.urgent||!p.post;
    return `<div class="prodrow${red?' red':''}"><div style="min-width:0"><b>${esc(it.title||'Item')}</b> <span class="meta">${p.kind} · ${p.need} video</span><div class="meta">${p.post?`${p.shootBy?'Shoot by '+dmy(p.shootBy)+' · ':''}Edit by ${dmy(p.editBy)} · Post ${dmy(p.post)}${p.postEnd?'–'+dmy(p.postEnd):''}`:'Tiada slot kosong'}${p.late?' · lewat dari deadline '+dmy(p.due):''}</div></div></div>`}).join('');
  const more=P.gapJ>0||P.gapC>0?`<div class="meta" style="margin-top:8px">Untuk penuhkan 14 hari: perlu <b>${P.moreProducts} produk lagi</b> (${P.gapJ} video jualan)${P.gapC?` dan <b>${P.gapC} video creative</b>`:''}.</div>`:`<div class="meta" style="margin-top:8px">14 hari ke depan penuh.</div>`;
  const open=ui.prodOpen===true;
  return `<div class="card glass" style="margin:6px 0 0;padding:10px 14px;border-radius:16px"><button class="rowh" type="button" data-act="prodTog" style="width:100%;background:none;border:0;padding:0;text-align:left"><p class="eyebrow" style="margin:0">Production plan · ${P.jobs.length+P.cres.length} upcoming</p><span class="meta">${open?'Close':'Open'}</span></button>${open?rows+more:''}</div>`}
A.prodTog=()=>{ui.prodOpen=!ui.prodOpen;render(true)};

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

/* ---------- 25 Nov 2026 (Mira): rupa baru To Publish ----------
   Tajuk nombor berdenyut + kalendar mini 7 hari (bulat TT / IG / FB ikut tick Scheduled) + cip notis +
   jadual hari › masa › dua akaun sebelah-menyebelah. Butang ↓ lompat ke kad posting di bawah. Label Inggeris. 0 token. */
const TP_PL=[['TT',0,'tt'],['IG',1,'ig'],['FB',2,'fb']];
const TP_DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],TP_MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const tpOn=(r,i)=>!!(r.sched[i]||r.posted[i]);
const tpDone=r=>TP_PL.every(p=>tpOn(r,p[1]));
const tpDayLbl=d=>{const x=new Date(d+'T00:00:00');const t=ymd(new Date());return (d===t?'Today · ':d===addDays(t,1)?'Tomorrow · ':'')+TP_DOW[x.getDay()]+' '+x.getDate()+' '+TP_MON[x.getMonth()]};
const tpTicks=r=>`<div class="tptk">${TP_PL.map(([l,i,c])=>`<button type="button" class="${c}" data-act="tick" data-x="${r.tab}|${r.row}|sched|${i}" aria-pressed="${!!r.sched[i]}" aria-label="Scheduled ${l}">${l}</button>`).join('')}</div>`;
const tpWho=a=>`<span class="tpwho ${a==='miracikcitjuga'?'j':'m'}">@${esc(a||'no account')}</span>`;
/* Baris masa dalam kad posting (ganti schLine dalam To Publish) */
function tpLine(k,v,late){if(v.status==='Excluded')return `<span class="pill">Post anytime · not counted</span>`;
  const when=v.date?`${tpDayLbl(v.date)} · ${timeLbl(v.time)}`:'No slot yet';
  return `<button type="button" class="pill tpwhen${late?' late':''}" data-act="schEdit" data-id="${esc(k)}">${esc(when)}${v.status==='Tetap'?' · Fixed':''} ✎</button>`}
/* Video ikut hari untuk 7 hari ke depan (tanpa Excluded / Posted) */
function tpWeek(plan,groups){const today=ymd(new Date());const by={};
  (groups||[]).forEach(g=>g.rows.forEach(r=>{const v=plan.get(schKey(r));if(!v||!v.date||v.status==='Posted'||v.status==='Excluded')return;(by[v.date]=by[v.date]||[]).push({r,v,g})}));
  return Array.from({length:7},(_,i)=>{const date=addDays(today,i);return {date,rows:by[date]||[]}})}
function tpTop(plan,groups,ready,nNew){const W=schedWarn(plan,groups);const wk=tpWeek(plan,groups);const today=ymd(new Date());
  const n=ready.filter(r=>{const v=plan.get(schKey(r))||{};return v.status!=='Excluded'&&!tpDone(r)}).length;
  const cal=wk.map(({date,rows})=>{const x=new Date(date+'T00:00:00');const t=rows.length,done=rows.filter(o=>tpDone(o.r)).length;
    const dots=TP_PL.map(([,i,c])=>{const k=rows.filter(o=>tpOn(o.r,i)).length;return `<u class="${t&&k===t?'on':k?'half':''}" style="--pc:var(--${c})"></u>`}).join('');
    return `<button type="button" class="tpd${date===today?' today':''}${t?'':' none'}" data-act="tpDay" data-id="${date}" aria-label="${tpDayLbl(date)}, ${t?done+' of '+t+' videos scheduled':'no video'}"><span>${TP_DOW[x.getDay()]}</span><b>${x.getDate()}</b><i>${dots}</i><em>${t?done+'/'+t:'none'}</em></button>`}).join('');
  const emp=W.days.slice(0,7).reduce((a,d)=>a+d.empty.length,0);const chips=[];
  if(emp)chips.push(`<span class="tpchip w">⚠ <b>${emp}</b> empty slot${emp>1?'s':''}</span>`);
  chips.push(`<span class="tpchip">Stock ${W.fullUntil?'until <b>'+esc(tpDayLbl(W.fullUntil).replace(/^.*· /,''))+'</b>':'<b>under a day</b>'}</span>`);
  if(W.short.length)chips.push(`<button type="button" class="tpchip w" data-act="tpShort" data-x="${esc(W.short.map(s=>s.name).join(', '))}">⚠ <b>${W.short.length}</b> product${W.short.length>1?'s':''} short</button>`);
  if(nNew)chips.push(`<button type="button" class="tpchip" data-act="tpDay" data-id="new"><b>${nNew}</b> new</button>`);
  const busy=schedBusy?ldr((schedProg&&schedProg.txt)||'Updating schedule',schedProg&&schedProg.pct):`<button type="button" class="tpchip btnx" data-act="schRun">Auto-arrange</button>`;
  return `<div class="tph"><b class="tpn${n?'':' zero'}">${n}</b><h1>VIDEOS TO SCHEDULE</h1></div>
   <div class="tpcal glass"><div class="tpcalh"><span class="eyebrow">Next 7 days</span><span class="tpleg">${TP_PL.map(([l,,c])=>`<span><u class="on" style="--pc:var(--${c})"></u>${l}</span>`).join('')}</span></div><div class="tpgrid">${cal}</div></div>
   <div class="tpchips">${chips.join('')}<span style="margin-left:auto">${busy}</span></div>`}
/* Jadual: rel masa di kiri, @miracikcit dan @miracikcitjuga sebelah-menyebelah. Slot kosong = kotak putus-putus. */
function tpSched(plan,groups){const W=schedWarn(plan,groups);const wk=tpWeek(plan,groups);const slots=schedSlots();const today=ymd(new Date());
  return wk.map(({date,rows},di)=>{const emp=(W.days[di]||{empty:[]}).empty;
    const times=[...new Set(rows.map(o=>o.v.time).concat(emp.map(s=>s.t)))].filter(Boolean).sort();if(!times.length)return '';
    return `<div class="tpday" id="tpd-${date}">${tpDayLbl(date)}</div><div class="tpslots">${times.map(t=>{const m=String(timeLbl(t)).match(/^(.*?)(am|pm)$/)||[0,timeLbl(t),''];
      return `<div class="tpslot"><span class="tptm">${m[1]}<small>${m[2].toUpperCase()}</small></span>${SCHED_ACC.map(a=>{const o=rows.find(x=>x.v.time===t&&x.v.acc===a);
        if(!o)return emp.some(s=>s.t===t&&s.a===a)?`<div class="tpcell e">Empty</div>`:slots.some(s=>s.t===t&&s.a===a)?`<div class="tpcell x"></div>`:`<div></div>`;
        const r=o.r;const late=!r.sched.some(Boolean)&&dayDiff(today,date)<=3;
        return `<div class="tpcell glass${tpDone(r)?' all':''}${late?' late':''}">${tpWho(a)}<button type="button" class="tpjump" data-act="tpJump" data-id="rv-${r.tab}-${r.row}" aria-label="Jump to posting card">↓</button><span class="tpprod">${esc(o.g.name)}</span><span class="tphook">${r.vid?'VID '+esc(r.vid)+' · ':''}${esc(noEmoji(String(r.caption).split('\n')[0]))}</span>${tpTicks(r)}</div>`}).join('')}</div>`}).join('')}</div>`}).join('')}
function tpFlash(c){if(!c)return;c.scrollIntoView({behavior:'smooth',block:'center'});c.animate&&c.animate([{boxShadow:'0 0 0 3px #E2B38F'},{boxShadow:'0 0 0 0 transparent'}],{duration:1600})}
A.tpJump=el=>{const c=document.getElementById(el.dataset.id);if(c)tpFlash(c);else toast('Posting card not found')};
A.tpDay=el=>{const c=document.getElementById(el.dataset.id==='new'?'tpnew':'tpd-'+el.dataset.id);if(c)c.scrollIntoView({behavior:'smooth',block:'start'});else toast('No video on this day')};
A.tpShort=el=>toast('Under 3 videos per account: '+el.dataset.x);
