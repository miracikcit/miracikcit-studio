/* ---------- HOME ---------- */
const GC='Google Calendar',MARK='#miracikcitstudio';
let calEvents=[],calState='off',calErr=null;
async function loadCal(){if(!MCP){calState='off';return}if(!calEvents.length)calState='loading';
  const d=new Date();const s=ymd(new Date(d.getFullYear(),d.getMonth()-1,1))+'T00:00:00',e=ymd(new Date(d.getFullYear(),d.getMonth()+4,1))+'T00:00:00';
  try{const r=await MCP.callTool(GC,'list_events',{fullText:'miracikcitstudio',startTime:s,endTime:e,pageSize:250,orderBy:'startTime'},{cache:false});
    calEvents=(((r.payload||{}).events)||[]).filter(ev=>ev.status!=='cancelled').map(ev=>{const st=ev.start||{};const dt=st.dateTime||'';const desc=String(ev.description||'').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'');const m=desc.match(/Akaun:\s*([^\n]+)/i);
      return {id:ev.id,title:ev.summary||'',date:String(dt||st.date||'').slice(0,10),time:dt?dt.slice(11,16):'',account:m?m[1].trim():'',note:desc.split('\n').filter(l=>!/^Akaun:/i.test(l)&&!l.includes(MARK)).join('\n').trim()}});
    calState='ok';calErr=null;setTimeout(autoCal,3000);setTimeout(()=>schedCal(),6000)}catch(err){calErr=err&&err.code;calState='err'}
  render()}
/* Deadline masuk Google Calendar sendiri: akhir post sample + tarikh draf / posting / submission paid job.
   Setiap event ada baris "Ref: <kunci>" supaya tak dibuat dua kali. Tarikh berubah: event dikemas kini. */
let calAutoBusy=false;
async function autoCal(){if(calAutoBusy||mode!=='live'||calState!=='ok'||!MCP)return;calAutoBusy=true;const td=ymd(new Date());
  const want=[];activeSamples().forEach(it=>want.push({ref:'smp-'+it.id,date:it.sample.postBy,title:'Akhir post: '+it.title,acc:it.account||''}));
  S.jobs.filter(j=>j.paid!==false&&!/bayaran/i.test(j.status||'')).forEach(j=>[['draftDate','Draf'],['postDate','Posting'],['submitDate','Submission']].forEach(([k,l])=>{if(j[k])want.push({ref:'job-'+j.id+'-'+k,date:j[k],title:l+': '+(j.brand||j.no||'Job'),acc:''})}));
  let n=0;
  try{for(const w of want.filter(x=>x.date>=td)){if(n>=8)break;const ex=calEvents.find(e=>e.note.includes('Ref: '+w.ref));if(ex&&ex.date===w.date)continue;
      const nx=new Date(w.date+'T00:00:00');nx.setDate(nx.getDate()+1);
      const p={summary:w.title,description:[w.acc?'Akaun: '+w.acc:'','Ref: '+w.ref,MARK].filter(Boolean).join('\n'),allDay:true,startTime:w.date+'T00:00:00',endTime:ymd(nx)+'T00:00:00'};
      if(ex)await MCP.callTool(GC,'update_event',Object.assign({eventId:ex.id},p));else await MCP.callTool(GC,'create_event',p);n++}}
  catch(e){}finally{calAutoBusy=false}
  if(n){toast(n+' deadline dimasukkan ke Google Calendar');loadCal()}}
function calHTML(){const c=ui.cal||(ui.cal={y:new Date().getFullYear(),m:new Date().getMonth()});const days=new Date(c.y,c.m+1,0).getDate();const off=new Date(c.y,c.m,1).getDay();const pre=c.y+'-'+pad(c.m+1)+'-';
  const evs=calEvents.filter(e=>e.date.startsWith(pre)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));const by={};evs.forEach(e=>(by[e.date]=by[e.date]||[]).push(e));const td=ymd(new Date());
  let cells='';for(let i=0;i<off;i++)cells+='<span></span>';
  for(let d=1;d<=days;d++){const k=pre+pad(d);cells+=`<button type="button" class="cd${k===td?' today':''}" data-act="evAdd" data-id="${k}" aria-label="${d} ${BULAN[c.m]}"><b>${d}</b><i>${(by[k]||[]).slice(0,3).map(e=>`<u style="background:${ACC_COL[e.account]||'var(--rose)'}"></u>`).join('')}</i></button>`}
  const note=calState==='err'?`<p class="meta" style="color:var(--bad)">Google Calendar tak dapat dibaca. Semak connector Google Calendar dalam Settings, lepas tu tekan Sync.</p>`:calState==='off'?`<p class="meta">Google Calendar tak bersambung dalam paparan ni.</p>`:calState==='loading'?`<p class="meta">Sedang baca Google Calendar.</p>`:'';
  return `<div class="card big glass" style="--c:#B0937B;margin-top:14px"><div class="rowh" style="align-items:center"><p class="eyebrow" style="margin:0">Senarai posting · ${BULAN[c.m]} ${c.y}</p>
    <div class="btns" style="flex-wrap:nowrap;gap:6px"><button class="btn icon sm" data-act="calNav" data-x="-1" aria-label="Bulan lepas">${IC.back}</button><button class="btn icon sm" data-act="calNav" data-x="1" aria-label="Bulan depan">${IC.next}</button><button class="btn icon sm" data-act="evAdd" data-id="${td.startsWith(pre)?td:pre+'01'}" aria-label="Tambah posting">${IC.plus}</button></div></div>${note}

   ${evs.map(e=>`<button type="button" class="evrow" data-act="evEdit" data-id="${esc(e.id)}"><span class="evd"><b>${+e.date.slice(8)}</b>${HARI[new Date(e.date+'T00:00:00').getDay()].slice(0,3)}</span><span style="min-width:0;flex:1"><strong>${esc(e.title)}</strong><span class="meta" style="display:block">${esc([e.time,e.note.split('\n')[0]].filter(Boolean).join(' · '))}</span></span>${accPill(e.account)}</button>`).join('')||`<p class="meta" style="margin:0">Tiada posting bulan ni. Tekan + untuk tambah.</p>`}
   <p class="meta" style="margin:12px 0 0">Hanya event yang ada tanda ${MARK} dipaparkan, jadi event peribadi tak masuk. Event yang kau buat dari sini ditanda sendiri.</p></div>`}
function evForm(ev){modal(`<h2>${ev.id?'Edit posting':'Posting baru'}</h2><label class="f"><span>Tajuk</span><input class="inp" id="evT" value="${esc(ev.title||'')}" placeholder="cth. Tjean VID 1"></label>
  <div class="row2"><label class="f"><span>Tarikh</span><input type="date" class="inp" id="evD" value="${esc(ev.date||'')}"></label><label class="f"><span>Masa</span><input type="time" class="inp" id="evM" value="${esc(ev.time||'')}"></label></div>
  <label class="f"><span>Akaun</span>${accSel('id="evA"',ev.account||'')}</label><label class="f"><span>Nota</span><textarea class="inp" id="evN" rows="2">${esc(ev.note||'')}</textarea></label>
  <div class="btns" style="justify-content:space-between">${ev.id?`<button class="btn sm bad" data-act="evDel" data-id="${esc(ev.id)}">${IC.trash}Padam</button>`:'<span></span>'}<div class="btns"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="evSave" data-id="${esc(ev.id||'')}">Simpan</button></div></div>`,'#B0937B')}
A.evAdd=el=>evForm({date:el.dataset.id});
A.evEdit=el=>{const e=calEvents.find(x=>x.id===el.dataset.id);if(e)evForm(e)};
A.calNav=el=>{const c=ui.cal;const d=new Date(c.y,c.m+(+el.dataset.x),1);ui.cal={y:d.getFullYear(),m:d.getMonth()};render(true)};
A.calSync=()=>{toast('Sedang sync kalendar');loadCal()};
A.evSave=async el=>{const t=$('#evT').value.trim(),d=$('#evD').value,tm=$('#evM').value,a=$('#evA').value,n=$('#evN').value.trim();if(!t||!d){toast('Isi tajuk dan tarikh');return}
  if(!MCP){toast('Google Calendar tak bersambung');return}
  const p={summary:t,description:[a?'Akaun: '+a:'',n,MARK].filter(Boolean).join('\n')};
  if(tm){const e=new Date(new Date(d+'T'+tm+':00').getTime()+30*6e4);p.startTime=d+'T'+tm+':00';p.endTime=ymd(e)+'T'+pad(e.getHours())+':'+pad(e.getMinutes())+':00'}
  else{const nx=new Date(d+'T00:00:00');nx.setDate(nx.getDate()+1);p.allDay=true;p.startTime=d+'T00:00:00';p.endTime=ymd(nx)+'T00:00:00'}
  const id=el.dataset.id;closeModal();toast('Sedang simpan ke Google Calendar');
  try{if(id)await MCP.callTool(GC,'update_event',Object.assign({eventId:id},p));else await MCP.callTool(GC,'create_event',p);toast('Disimpan dalam Google Calendar');loadCal()}catch(e){toast('Tak dapat simpan ke Google Calendar')}};
A.evDel=el=>{const id=el.dataset.id;confirmBox('Padam posting ni dari Google Calendar?',async()=>{try{await MCP.callTool(GC,'delete_event',{eventId:id});toast('Dipadam');loadCal()}catch(e){toast('Tak dapat padam')}})};
/* Footage Sorter (Mac mini): nombor sahaja, dari tab SORTER yang Mac hantar. Gambar kekal dalam Mac. */
let sorterRaw=null;
function sorterCard(){if(!sorterRaw||!sorterRaw.length)return '';
  const v=sorterRaw;const cell=(r,c)=>String(((v[r]||[])[c])??'').trim();
  const folders=v.slice(8).map(r=>({label:String(r[0]||''),group:String(r[1]||''),total:+r[2]||0,review:+r[3]||0})).filter(f=>f.label);
  const toReview=folders.filter(f=>!/check me|duplicates/i.test(f.label)).reduce((a,f)=>a+f.review,0);
  const checkMe=+cell(2,1)||0,link=cell(5,1);
  const meter=(name,used,total)=>{used=+used||0;total=+total||0;if(!total)return '';const pct=Math.min(100,Math.round(used/total*100));const col=pct>85?'var(--bad)':'var(--ok)';
    return `<div style="--sc:${col};margin-top:10px"><div class="trk"><div class="t"><span>${esc(name)}</span><span>${used} / ${total>=1000?(total/1000).toFixed(1)+' TB':total+' GB'}</span></div></div><div class="bar"><i style="width:${pct}%"></i></div></div>`};
  const rows=folders.filter(f=>f.review>0).sort((a,b)=>b.review-a.review).slice(0,6);
  return `<div class="rbox glass cc" style="--c:#8676BE;cursor:default"><div class="rowh" style="align-items:center"><div style="min-width:0"><h2>Footage baru dari phone</h2><div class="meta">Belum disemak${checkMe?' · '+checkMe+' dalam Check Me':''} · ${esc(cell(1,1))}</div></div><b class="rn">${toReview}</b></div>
   ${rows.slice(0,3).map(f=>`<div class="ccr"><div class="rowh"><span class="ccn">${esc(f.label.replace(/^[^\w]+\s*/,''))}</span><span class="pill" style="--pc:var(--warn)">${f.review} semak</span></div></div>`).join('')}
   ${meter(cell(3,1)||'Hard disk',cell(3,2),cell(3,3))}${meter('iCloud',cell(4,2),cell(4,3))}
   ${/^https?:\/\//.test(link)?`<a class="ccmore" href="${esc(link)}" target="_blank" rel="noopener" style="text-decoration:none">Buka folder &amp; semak (Wi-Fi rumah) ${IC.next}</a>`:''}${ongoingSlot()}</div>`}
/* Ongoing projects (WORK SORTER): status dari Mac (koleksi workprojects). Gambar kekal dalam Mac; butang buka page sorter untuk edit. */
function ongoingSlot(){const L=(S.workprojects||[]).slice().sort((a,b)=>(b.updated||0)-(a.updated||0));if(!L.length)return '';
  const tone=st=>/perlu semak|susun semula|belum kemas/i.test(st)?'var(--warn)':/siap/i.test(st)?'var(--ok)':'#8676BE';
  const edit=w=>/^https?:\/\//.test(w.link||'')?`${w.link}#p=${encodeURIComponent(w.key)}`:'';
  return `<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--line,rgba(0,0,0,.08))"><p class="eyebrow" style="margin:0 0 6px">Ongoing projects</p>
   ${L.map(w=>`<div class="evrow" style="cursor:default;align-items:flex-start"><span style="flex:1;min-width:0"><strong>${esc(w.title)}</strong>
     <span class="meta" style="display:block">${esc(w.folder)} · ${w.shots||0} shot · ${(w.places||[]).length} folder${w.kabur?' · '+w.kabur+' kabur':''}${w.stars?' · ⭐ '+w.stars:''}</span>
     ${(w.places||[]).length?`<span class="meta" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc((w.places||[]).join(' · '))}</span>`:''}
     ${edit(w)?`<a class="btn sm" style="margin-top:6px" href="${esc(edit(w))}" target="_blank" rel="noopener">✏️ Edit susunan</a>`:''}</span>
     <span class="pill" style="--pc:${tone(w.status||'')}">${/perlu semak/i.test(w.status||'')?'🔔 ':''}${esc(w.status||'')}</span></div>`).join('')}
   <p class="meta" style="margin:8px 0 0">Edit susunan buka page sorter (Wi-Fi rumah) terus pada projek tu: tukar nama, tambah atau padam folder, pindah gambar.</p></div>`}
const appReady=sv=>byStage('ready').filter(it=>!(it.auto&&sv&&(it.files||[]).some(f=>matchFile(f,sv.groups))));
V.home=()=>{
  const sv=sheetView();const te=toEditFolders();const hr=new Date().getHours();const eds=S.editor.filter(e=>!edDone(e));
  const n={ideas:byStage('ideas').length,'to-shoot':byStage('toshoot').length,shot:byStage('shot').length,'to-edit':te.length+byStage('toedit').length,
    ready:(sv?sv.ready.length:0)+appReady(sv).length,published:publishedEntries(sv).length,links:sv?sv.groups.filter(g=>g.tab==='PRODUCTS').length:'–',
    jobs:S.jobs.filter(j=>!/siap|bayaran/i.test(j.status||'')).length,editor:eds.length,footage:S.footage.length,inspiration:S.inspo.length+S.gaya.length,'media-kit':3};
  const urgent=sv?sv.ready.map(r=>({r,d:deadline(rowStart(r,sv),7)})).sort((a,b)=>(a.d?a.d.left:99)-(b.d?b.d.left:99)).slice(0,3):[];
  const box=(k,num,lab)=>{const t=TAB[k];return `<button class="hbox glass" style="--c:${t.c}" data-act="go" data-id="${k}"><b>${num!==undefined?num:n[k]}</b><span class="l">${lab||navLabel(t.l)}</span></button>`};
  const icn=k=>IC[k].replace('<svg ','<svg style="width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round" ');
  const mini=(k,num,lab,icon)=>{const t=TAB[k];return `<button class="hbox glass mini" style="--c:${t.c}" data-act="go" data-id="${k}">${icon?`<b style="display:flex;color:${t.c}">${icn(icon)}</b>`:`<b>${num}</b>`}<span class="l">${lab}</span></button>`};
  const ed=TAB.editor;const cp=confirmedList(sv);
  return `<div class="head"><div><p class="eyebrow">${hr<12?'Selamat pagi':hr<18?'Selamat petang':'Selamat malam'}, Mira</p><h1>Home</h1></div><button class="btn sm" data-act="syncReq">${IC.copy}Sync folder</button></div>
  ${sheetNote()}
  
  <div class="hgrid">
   ${box('links',projCount(),'Projects')}${box('to-shoot')}${box('to-edit',n.shot+n['to-edit'])}
   <button class="hbox big2 edbox glass" style="--c:${ed.c}" data-act="go" data-id="editor"><span class="edn"><b>${n.editor}</b><span class="l">Editor</span></span><span class="edl">${eds.slice(0,6).map(e=>`<span class="edr"><span>${esc(shortName(e.name))}</span><i style="--pc:${/draf|sedia|semak/i.test(e.status||'')?'var(--warn)':'var(--c)'}">${esc(edShort(e.status))}</i></span>`).join('')||'<span>Tiada projek berjalan</span>'}${eds.length>6?`<span>+${eds.length-6} lagi</span>`:''}</span></button>
   ${box('ready')}${box('published')}
  </div>
  <div class="mgrid">${mini('ideas',n.ideas,'Ideas')}${mini('threads',0,'Threads','threads')}${mini('inspiration',n.inspiration,'Copy Style')}${mini('media-kit',n['media-kit'],'Media Kit')}${mini('footage',(S.brlib||[]).reduce((a,d)=>a+(d.clips||[]).length,0)||S.footage.length+S.broll.length,'Footage library')}${mini('shot',n.shot,'Shot')}${mini('caption',0,'Caption','caption')}${mini('transcribe',0,'Transcribe','transcribe')}</div>
  ${homePub()}
  ${schedHome()}
  ${ccard('links','Projects','Sample dan paid job ikut deadline',projCount(),projItems().filter(o=>!o.done).sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(0,4).map(projRow).join('')||'<p class="meta" style="margin:8px 0 0">Tiada projek menunggu.</p>')}
  ${sorterCard()||(S.workprojects&&S.workprojects.length?`<div class="card big glass" style="--c:#8676BE;margin-top:14px"><p class="eyebrow" style="margin:0">Footage Sorter · Mac mini</p>${ongoingSlot()}</div>`:'')}
  ${voAlert()}
  ${brHome()}
  ${edSelfHome()}
  ${calHTML()}`};
/* Kad B-roll (bawah Footage perlu semak), design sama macam kad Home lain: swipe terus dari sini. */
function brHome(){
  /* 23 Nov: satu kad sahaja untuk B-roll (dulu ada kad 🔔 Footage perlu semak yang sama). Swipe / edit / Final dalam Picker. */
  const brs=S.broll.filter(b=>brPending(b)||b.status==='error').sort((a,b)=>(b.updated||0)-(a.updated||0));
  const best=S.footage.filter(f=>f.status==='semak'||f.status==='backup');if(!brs.length&&!best.length)return '';
  const pb='class="pill" style="--pc:%s;cursor:pointer;border:0;font-family:inherit;color:inherit;text-decoration:none"';
  const row=b=>{const tot=b.moments||0,left=brLeft(b);
    let line,act,col,pct;
    if(b.status==='precut'){pct=Math.min(100,Math.round(b.progress||0));line='Mac mini sedang potong';act=ldr('Pre-cut',pct);col='var(--c)'}
    else if(b.status==='backup'){line='Sedang simpan ke B-ROLL LIBRARY';act=ldr('Simpan');col='var(--c)';pct=100}
    else if(b.status==='error'){line=String(b.msg||'Ralat').slice(0,60);act=`<button ${pb.replace('%s','var(--bad)')} data-act="brStart" data-id="${esc(b.key)}">Cuba lagi</button>`;col='var(--bad)';pct=0}
    else{const [t,cl,p,run]=brState(b);line=t;col=cl;pct=run?Math.round(p):tot?Math.round((tot-left)/tot*100):0;
      act=run?ldr('Final',p):`<a ${pb.replace('%s',cl)} href="${esc(brPick(b))}" target="_blank" rel="noopener">${left?'▶ Swipe':'✓ Final'}</a>`}
    return `<div class="ccr" style="--sc:${col}"><div class="rowh"><span class="ccn">${esc(b.name)}</span>${act}</div><div class="bar"><i style="width:${pct}%"></i></div><div class="meta" style="font-size:11px;margin-top:3px">${esc(line)}</div></div>`};
  return `<div class="rbox glass cc" style="--c:${TAB['to-edit'].c};cursor:default"><div class="rowh" style="align-items:center"><div style="min-width:0"><h2>B-roll perlu semak</h2><div class="meta">Swipe, edit dan ✓ Final dalam Picker (Wi-Fi rumah) · ${tok(0)}</div></div><b class="rn">${brs.length+best.length}</b></div>
   ${brs.slice(0,4).map(row).join('')}${brs.length>4?`<p class="meta" style="margin:6px 0 0">+${brs.length-4} lagi</p>`:''}
   ${best.length?ccRow(best.length+' set klip terbaik lepas final','pilih simpan / buang','var(--warn)',0):''}
   <div class="ccmore" role="button" tabindex="0" data-act="teSeg" data-x="broll" style="cursor:pointer">Semua B-roll ${IC.next}</div></div>`}
/* Baris kad Projects di Home: sample guna slider aliran, paid guna slider job */
function projRow(o){if(o.kind==='sample')return cpRow({it:o.it,step:o.step});const j=o.j;const nx=jobNext(j);const left=nx?daysTo(nx.date):null;const col=left===null?'#999':left>7?'#4E9B63':left>=3?'#E3B23C':'#C2534F';
  return `<div class="ccr" style="--c:${TAB.links.c}"><div class="rowh"><span class="ccn">${esc(String(o.name).split(/\s+/).slice(0,3).join(' '))}</span><span class="pill smpp" style="--pc:${col}"><b>${left===null?'·':Math.max(left,0)}</b>${nx?esc(nx.label):'tiada tarikh'}</span></div><div class="tl tl-mini">${JSTEPS.map((s,i)=>`<div class="s${i<=o.step?' d':i===o.step+1?' cur':''}"><i>${i<=o.step?IC.check:''}</i></div>`).join('')}</div><div class="meta" style="font-size:11px;margin-top:-2px">Paid RM${esc(rm2(j.fee)||'0')} · sekarang ${esc(JSTEPS[Math.min(o.step+1,5)])}</div></div>`}
const edShort=st=>({'Storyboard':'SB','Sesi dibuka':'Sesi','Tunggu semakan':'Semak','Sedia render':'Render'})[st||'']||(st||'Draf');
/* Ringkasan minggu (Isnin): sample perlu shoot, video tunggu edit, link belum submit, job hampir deadline */
function weekCard(sv){if(new Date().getDay()!==1)return '';const wk=ymdAdd(ymd(new Date()),7);
  const shoot=activeSamples().filter(it=>it.stage==='toshoot'&&it.sample.postBy<=wk).length;
  const edit=toEditFolders().length+byStage('toedit').length;
  const links=sv?publishedEntries(sv).filter(e=>linkGaps(e)>0).length:0;
  const jobs=S.jobs.filter(j=>j.paid!==false&&!/bayaran/i.test(j.status||'')&&jobNext(j)&&jobNext(j).date<=wk).length;
  const row=(k,num,lab)=>`<button class="ccr" style="text-align:left;width:100%;background:none;border:0;padding:6px 0;font:inherit;color:inherit;cursor:pointer" data-act="go" data-id="${k}"><div class="rowh"><span class="ccn">${lab}</span><span class="pill" style="--pc:${num?'var(--warn)':'var(--ok)'}">${num}</span></div></button>`;
  return `<div class="rbox glass cc" style="--c:${TAB.home.c};cursor:default;margin-bottom:14px"><div class="rowh" style="align-items:center"><div style="min-width:0"><h2>Minggu ni</h2><div class="meta">Ringkasan Isnin · ${dmy(ymd(new Date()))} hingga ${dmy(wk)}</div></div></div>
   ${row('to-shoot',shoot,'Sample perlu shoot')}${row('to-edit',edit,'Video tunggu edit')}${row('published',links,'Link belum submit')}${row('links',jobs,'Paid job hampir deadline')}</div>`}
/* Kad depan padat: tajuk + nombor besar, baris satu garis dengan nama pendek */
const shortName=(name,vid)=>{const w=String(name||'').trim().split(/\s+/);return vid?'Vid '+vid+' '+w[0]:w.slice(0,3).join(' ')};
const ccard=(k,title,sub,num,rows)=>`<div class="rbox glass cc" style="--c:${TAB[k].c}" role="button" tabindex="0" data-act="go" data-id="${k}"><div class="rowh" style="align-items:center"><div style="min-width:0"><h2>${esc(title)}</h2><div class="meta">${esc(sub)}</div></div><b class="rn">${num}</b></div>${rows}<div class="ccmore">Buka senarai ${IC.next}</div></div>`;
const ccRow=(name,pill,col,pct)=>`<div class="ccr" style="--sc:${col}"><div class="rowh"><span class="ccn">${esc(name)}</span><span class="pill" style="--pc:${col}">${esc(pill)}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;

A.go=el=>go(el.dataset.id);
/* Folder di Mac mini diimbas sendiri oleh worker setiap 5 minit. Butang ni minta imbasan sekarang. */
A.syncReq=async()=>{toast('Mac mini sedang imbas folder');try{const r=await studioJob('scan',{},3*60000);toast('Siap: '+(r.topost||0)+' video, '+(r.toedit||0)+' folder edit')}catch(e){toast(e&&e.code==='unavailable'?'Tiada internet':'Mac mini tak jawab. Semak Mac mini hidup')}};
/* item siap render: fail muncul dalam 00. TO POST FINAL -> pindah sendiri ke Ready */
function itemMatches(it,f){const t=String(f.name||'').replace(/\.\w+$/,'').split(/[_-]+/).map(nrm);const b=nrm(it.brand),ti=nrm(it.title);
  return (b.length>=3&&t[0]&&(t[0]===b||t[0].startsWith(b)||b.startsWith(t[0])))||(t[1]&&t[1].length>=5&&ti.includes(t[1].slice(0,8)))||(t[0]&&t[0].length>=5&&ti.includes(t[0]))}
function autoAdvance(){if(mode!=='live')return;const files=((S.sync.topost||{}).files)||[];if(!files.length)return;let n=0;
  S.items.filter(it=>it.stage==='shot'||it.stage==='toedit').forEach(it=>{const since=(it.stageAt&&(it.stageAt.shot||it.stageAt.toedit))||it.created||0;
    const fs=files.filter(f=>(f.mtime||0)>=since-DAY&&itemMatches(it,f));if(!fs.length)return;n++;
    save('items',Object.assign({},it,{stage:'ready',auto:true,files:fs.map(f=>f.name),stageAt:Object.assign({},it.stageAt,{ready:Math.max(...fs.map(f=>f.mtime||0))})}),true)});
  if(n){render();toast(n+' item dipindah sendiri ke Ready (video dah render)')}}
/* Lepas sheet dibaca: item lama yang dah ada video dalam Sheet keluar dari Shot / Edit, folder edit yang dah render ditanda siap,
   link dari To Shoot dan harga sample ditulis ke Sheet. Sekali setiap 2 minit. */
let autoSheetAt=0;const autoDone={};
function autoSheet(){if(mode!=='live'||!sheetRaw.PRODUCTS||Date.now()-autoSheetAt<120000)return;autoSheetAt=Date.now();
  const sv=sheetView();if(!sv)return;const gs=sv.groups.filter(g=>g.tab==='PRODUCTS');let moved=0;
  S.items.filter(it=>it.stage==='shot'||it.stage==='toedit').forEach(it=>{const g=gs.find(x=>itMatch(it,x.name));if(!g||!g.rows.length||(it.sample&&g.start<=(it.sample.sheetRowAtAdd||0)))return;
    if((it.stageAt&&(it.stageAt.shot||it.stageAt.toedit)||0)>Date.now()-3*DAY)return;
    moved++;save('items',Object.assign({},it,{stage:'published',sheetMatched:true,stageAt:Object.assign({},it.stageAt,{published:Date.now()})}),true)});
  (((S.sync.toedit||{}).stages)||[]).forEach(st=>(st.items||[]).forEach(f=>{const key=st.name+'/'+f.name;const mk=(S.sync.toeditmarks||{}).done||{};if(!mk[key]&&!multiKey(key)&&folderRendered(f))markToEdit(key,'done')}));
  S.items.filter(it=>it.sample||it.shopee||it.tiktok).forEach(it=>{const g=gs.find(x=>itMatch(it,x.name));if(!g)return;
    if((it.shopee&&!g.shopee)||(it.tiktok&&!g.tt)){const k='lk'+g.start;if(!autoDone[k]){autoDone[k]=1;itemLinksToSheet(it,g).catch(()=>{})}}
    if(it.sample&&it.sample.price&&(!g.price||!g.kind)){const k='pr'+g.start;if(!autoDone[k]){autoDone[k]=1;sheetWrite(`PRODUCTS!R${g.start}:S${g.start}`,[[g.kind||'SAMPLE',g.price||it.sample.price]]).catch(()=>{})}}});
  /* 24 Nov: tanda doc edpwa yang dah published (sama syarat dengan tab Editor) supaya app Editor sendiri sorok dari senarai */
  (S.edpwa||[]).forEach(e=>{const pub=edPublished({name:e.title,folder:String(e.dir||'').split('/CLAUDE EDITS/')[1]||''});if(!!e.pub!==pub)save('edpwa',Object.assign({},e,{pub}),true)});
  autoSched().catch(()=>{});   /* 24 Nov: jadual posting */
  try{rawPlanSync()}catch(e){}   /* 25 Nov: pelan raw footage untuk Mac mini */
  if(moved){render();toast(moved+' item lama dipindah ke Published (video dah ada dalam Sheet)')}}

/* Lagi: semua alat dan rekod yang jarang guna */
V.lagi=()=>{const sv=sheetView();const t=(k,num,lab,icon)=>{const c=TAB[k].c;return `<button class="hbox glass mini" style="--c:${c}" data-act="go" data-id="${k}">${icon?`<b style="display:flex;color:${c}">${IC[icon].replace('<svg ','<svg style="width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round" ')}</b>`:`<b>${num}</b>`}<span class="l">${lab}</span></button>`};
  return head('Alat dan rekod')+`<div class="mgrid">${t('inspiration',S.inspo.length+S.gaya.length,'Copy Style')}${t('media-kit',3,'Media Kit')}${t('footage',S.footage.length,'Footage library')}${t('caption',0,'Caption','caption')}${t('threads',0,'Threads','threads')}${t('transcribe',0,'Transcribe','transcribe')}${t('shot',byStage('shot').length,'Shot')}${t('ideas',byStage('ideas').length,'Ideas')}</div>`};
