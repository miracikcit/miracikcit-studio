/* ---------- PROJECTS (Confirmed Projects + Jobs jadi satu) ----------
   Satu kotak upload (Mac mini tentukan Paid atau Sample), dua jumlah RM di kanan atas,
   tab kecil Semua / Paid / Sample / Produk Sheet, satu bentuk kad dengan slider, tugasan boleh tick dan butang Edit.
   Kad pindah ke "Dah siap" bila semua tugasan ditick (atau sample published / bayaran diterima). */
const JSTEPS=['Brief','Shoot','Draf','Posting','Invois','Bayaran'];
const jobStep=j=>Math.max(0,JOB_STATUS.indexOf(j.status||'Baru'));
const taskList=o=>lines(o.kind==='paid'?o.j.deliverables:(o.it.sample||{}).tasks);
const taskDone=o=>(o.kind==='paid'?o.j.taskDone:(o.it.sample||{}).taskDone)||[];
const allTicked=o=>{const t=taskList(o);const d=taskDone(o);return t.length>0&&t.every(x=>d.includes(x))};
const jobDone=j=>/bayaran/i.test(j.status||'')||allTicked({kind:'paid',j});
function projItems(){const sv=sheetView();const gs=sv?sv.groups.filter(g=>g.tab==='PRODUCTS'):[];
  const smp=S.items.filter(it=>it.sample).map(it=>{const g=gs.find(x=>itMatch(it,x.name))||null;const eds=S.editor.filter(e=>pMatch(e.name,it.title));
    return {kind:'sample',it,id:it.id,name:it.title,date:it.sample.postBy||'9',done:sampleDone(it),step:prodDone([it],eds,g,sv),g}});
  const paid=S.jobs.filter(j=>j.paid!==false).map(j=>{const nx=jobNext(j);return {kind:'paid',j,id:j.id,name:j.brand||j.no||'Job baru',date:nx?nx.date:'9',done:jobDone(j),step:jobStep(j)}});
  return smp.concat(paid)}
function projCount(){return projItems().filter(o=>!o.done).length}
function taskHtml(o){const t=taskList(o);if(!t.length)return '';const d=taskDone(o);const k=o.kind==='paid'?'j':'s';
  return `<div class="tasks">${t.map((x,i)=>`<button type="button" class="tk${d.includes(x)?' on':''}" data-act="tTick" data-id="${esc(o.id)}" data-x="${k}|${i}" aria-pressed="${d.includes(x)}"><i>${IC.check}</i><span>${esc(x)}</span></button>`).join('')}</div>`}
function projCard(o){
  if(o.kind==='sample'){const it=o.it,s=it.sample;const p=samplePlan(it);const wait=s.afterRecv&&!s.received;
    return `<div class="card glass pc"><div class="rowh" style="align-items:flex-start;gap:10px"><div style="min-width:0">${o.g?`<span class="bigno" style="font-size:20px;margin-right:6px">${esc(o.g.no)}</span>`:''}<h3 style="display:inline">${esc(it.title)}</h3>
      <div class="meta"><span class="kchip smp">SAMPLE${s.price?' RM'+esc(s.price):''}</span> ${esc([smpPlat(s.plat),it.brand].filter(Boolean).join(' · '))}</div></div>${o.done?`<span class="pill" style="--pc:var(--ok)">${IC.check}Siap</span>`:smpBadge(it)}</div>
     ${timeline(o.step,'')}${wait&&!o.done?`<p class="meta" style="margin:6px 0 0;color:var(--warn)">Deadline kira ${s.afterRecv} hari dari terima barang.</p>`:''}${taskHtml(o)}
     <div class="btns" style="margin-top:10px;gap:6px">${wait&&!o.done?`<button class="btn sm solid tab" data-act="smpRecv" data-id="${it.id}">${IC.check}Dah terima</button>`:''}${linkRow(it).replace(/^<div class="btns"[^>]*>|<\/div>$/g,'')}<span style="flex:1"></span><button class="btn sm" data-act="smpEdit" data-id="${it.id}">${IC.edit}Edit</button></div></div>`}
  const j=o.j;const nx=jobNext(j);const left=nx?daysTo(nx.date):null;const col=left===null?'var(--muted)':left>7?'var(--ok)':left>=3?'var(--warn)':'var(--bad)';const unpaid=!/bayaran/i.test(j.status||'');
  return `<div class="card glass pc${j.review?' jrev':''}"><div class="rowh" style="align-items:flex-start;gap:10px"><div style="min-width:0"><h3>${esc(o.name)}</h3>
    <div class="meta"><span class="kchip paid">PAID RM${esc(rm2(j.fee)||'0')}</span> ${esc([j.no,j.review?'semak dulu':j.status||'Baru'].filter(Boolean).join(' · '))}</div></div>
    ${o.done?`<span class="pill" style="--pc:${unpaid?'var(--warn)':'var(--ok)'}">${unpaid?'Belum dibayar':IC.check+'Dibayar'}</span>`:nx?`<div class="smpb" style="--pc:${col}"><span class="pill smpp"><b>${Math.max(left,0)}</b>${left<0?'lewat':'hari'}</span><span class="smpd" style="cursor:default">${esc(nx.label)} ${dmy(nx.date)}</span></div>`:''}</div>
   <div class="tl" role="list" aria-label="Status job">${JSTEPS.map((s,i)=>`<div role="listitem" class="s${i<=o.step?' d':i===o.step+1?' cur':''}"><i>${i<=o.step?IC.check:''}</i><span>${s}</span></div>`).join('')}</div>
   ${taskHtml(o)}<div class="btns" style="margin-top:10px;gap:6px">${!o.done&&o.step<5?`<button class="btn sm solid tab" data-act="jobNextStep" data-id="${j.id}">${IC.next}${esc(JOB_STATUS[o.step+1])}</button>`:''}<button class="btn sm" data-act="jobPdf" data-id="${j.id}" data-x="invoice">Invoice</button><span style="flex:1"></span><button class="btn sm" data-act="jobEdit" data-id="${j.id}">${IC.edit}Edit</button></div></div>`}
V.links=()=>{const seg=ui.prSeg||'all';const yr=String(new Date().getFullYear());const all=projItems();
  const pj=S.jobs.filter(j=>j.paid!==false);const yj=pj.filter(j=>jobYear(j)===yr);const total=rmTotal(yj.map(j=>j.fee)),unpaid=rmTotal(yj.filter(j=>!/bayaran/i.test(j.status||'')).map(j=>j.fee));
  const smp=S.items.filter(it=>it.sample);const smpVal=rmTotal(smp.map(it=>it.sample.price));
  const pick=all.filter(o=>seg==='all'||(seg==='paid'?o.kind==='paid':o.kind==='sample')).filter(o=>hit('pr',o.name));
  const live=pick.filter(o=>!o.done).sort((a,b)=>String(a.date).localeCompare(String(b.date))),done=pick.filter(o=>o.done);
  const cnt=k=>all.filter(o=>!o.done&&(k==='all'||o.kind===k)).length;
  const segs=[['all','Semua',cnt('all')],['paid','Paid',cnt('paid')],['sample','Sample',cnt('sample')],['sheet','Produk Sheet','']];
  const others=S.jobs.filter(j=>j.paid===false);
  return `<div class="head"><div><p class="eyebrow">Sample, paid job dan produk</p><h1>Projects</h1></div><div class="rmtot"><b>${rmBig(total)}</b><span>Paid ${yr}${unpaid?' · '+rmBig(unpaid)+' belum dibayar':''}</span><b style="font-size:clamp(18px,5vw,24px);margin-top:6px;color:${TAB.links.c}">${rmBig(smpVal)}</b><span>Nilai ${smp.length} sample</span></div></div>`+sheetNote()+
  `<div class="seg prseg" style="margin-bottom:14px">${segs.map(([k,l,n])=>`<button type="button" class="${seg===k?'on':''}" data-act="prSeg" data-x="${k}">${l}${n!==''?' · '+n:''}</button>`).join('')}</div>`+
  (seg==='sheet'?prodSheetView():chatDrop()+searchBox('pr','Cari projek')+
  `<div class="list">${live.map(projCard).join('')||`<div class="empty">Tiada projek ongoing. Tambah dari screenshot di atas.</div>`}</div>
  ${seg!=='paid'&&others.length?`<p class="eyebrow" style="margin-top:20px">Job non paid lain · ${others.length}</p><div class="list">${others.map(j=>`<div class="card glass"><div class="rowh" style="align-items:center"><div style="flex:1;min-width:0"><h3>${esc(j.brand||j.no||'Job')}</h3><div class="meta">${esc(j.status||'Baru')}</div></div><button class="btn sm" data-act="jobEdit" data-id="${j.id}">${IC.edit}Edit</button></div></div>`).join('')}</div>`:''}
  ${done.length?`<details class="col card glass pubgrp" style="margin-top:16px"${ui.prDone?' open':''} data-prdone="1"><summary><div class="rowh" style="align-items:center"><div><p class="eyebrow" style="margin:0">Dah siap</p><h3>${done.length} projek</h3></div><span class="ic chev">${IC.chev}</span></div></summary>
    <div class="list" style="margin-top:12px">${done.map(o=>`<details class="col pubrow"><summary><div class="rowh" style="align-items:center"><span class="kchip ${o.kind==='paid'?'paid':'smp'}">${o.kind==='paid'?'PAID':'SAMPLE'}</span><strong style="flex:1;min-width:0;margin-left:6px">${esc(o.name)}</strong><span class="ic chev">${IC.chev}</span></div></summary><div style="margin-top:10px">${projCard(o)}</div></details>`).join('')}</div></details>`:''}`)};
AFTER.links=()=>{const d=document.querySelector('details[data-prdone]');if(d)d.addEventListener('toggle',()=>{ui.prDone=d.open});const g=document.querySelector('details[data-pubgrp]:not([data-prdone])');if(g)g.addEventListener('toggle',()=>{ui.pubOpen=g.open})};
A.prSeg=el=>{ui.prSeg=el.dataset.x;render(true)};
A.jobNextStep=el=>{const j=get('jobs',el.dataset.id);const st=JOB_STATUS[Math.min(jobStep(j)+1,JOB_STATUS.length-1)];const o=save('jobs',Object.assign({},j,{status:st}));toast('Status: '+st);jobToSheet(o).catch(()=>{})};
/* Tick tugasan: semua ditick = kad pindah ke Dah siap (sample ditanda siap) */
A.tTick=el=>{const [k,i]=el.dataset.x.split('|');const id=el.dataset.id;
  if(k==='j'){const j=get('jobs',id);const t=lines(j.deliverables)[+i];const d=(j.taskDone||[]).slice();const at=d.indexOf(t);at>=0?d.splice(at,1):d.push(t);const o=save('jobs',Object.assign({},j,{taskDone:d}));
    if(allTicked({kind:'paid',j:o}))toast('Semua tugasan siap. Dipindah ke Dah siap');return}
  const it=get('items',id);const s=it.sample;const t=lines(s.tasks)[+i];const d=(s.taskDone||[]).slice();const at=d.indexOf(t);at>=0?d.splice(at,1):d.push(t);
  const all=lines(s.tasks).every(x=>d.includes(x));save('items',Object.assign({},it,{sample:Object.assign({},s,{taskDone:d,done:all?true:(s.doneByTask?false:s.done),doneByTask:all||undefined})}));
  if(all)toast('Semua tugasan siap. Sample dipindah ke Dah siap')};
const chatDrop=()=>`<button type="button" class="jdrop" data-act="jobAdd">${IC.up}<span><b>Tambah dari screenshot chat / WhatsApp</b><span class="meta" style="display:block">Mac mini baca sendiri. Job berbayar masuk Paid; sample, kupon atau barter masuk Sample dan Shoot</span></span></button>`;
