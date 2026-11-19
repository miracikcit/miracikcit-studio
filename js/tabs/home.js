/* ---------- HOME ---------- */
const GC='Google Calendar',MARK='#miracikcitstudio';
let calEvents=[],calState='off',calErr=null;
async function loadCal(){if(!MCP){calState='off';return}if(!calEvents.length)calState='loading';
  const d=new Date();const s=ymd(new Date(d.getFullYear(),d.getMonth()-1,1))+'T00:00:00',e=ymd(new Date(d.getFullYear(),d.getMonth()+4,1))+'T00:00:00';
  try{const r=await MCP.callTool(GC,'list_events',{fullText:'miracikcitstudio',startTime:s,endTime:e,pageSize:250,orderBy:'startTime'},{cache:false});
    calEvents=(((r.payload||{}).events)||[]).filter(ev=>ev.status!=='cancelled').map(ev=>{const st=ev.start||{};const dt=st.dateTime||'';const desc=String(ev.description||'').replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,'');const m=desc.match(/Akaun:\s*([^\n]+)/i);
      return {id:ev.id,title:ev.summary||'',date:String(dt||st.date||'').slice(0,10),time:dt?dt.slice(11,16):'',account:m?m[1].trim():'',note:desc.split('\n').filter(l=>!/^Akaun:/i.test(l)&&!l.includes(MARK)).join('\n').trim()}});
    calState='ok';calErr=null}catch(err){calErr=err&&err.code;calState='err'}
  render()}
function calHTML(){const c=ui.cal||(ui.cal={y:new Date().getFullYear(),m:new Date().getMonth()});const days=new Date(c.y,c.m+1,0).getDate();const off=new Date(c.y,c.m,1).getDay();const pre=c.y+'-'+pad(c.m+1)+'-';
  const evs=calEvents.filter(e=>e.date.startsWith(pre)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));const by={};evs.forEach(e=>(by[e.date]=by[e.date]||[]).push(e));const td=ymd(new Date());
  let cells='';for(let i=0;i<off;i++)cells+='<span></span>';
  for(let d=1;d<=days;d++){const k=pre+pad(d);cells+=`<button type="button" class="cd${k===td?' today':''}" data-act="evAdd" data-id="${k}" aria-label="${d} ${BULAN[c.m]}"><b>${d}</b><i>${(by[k]||[]).slice(0,3).map(e=>`<u style="background:${ACC_COL[e.account]||'var(--rose)'}"></u>`).join('')}</i></button>`}
  const note=calState==='err'?`<p class="meta" style="color:var(--bad)">Google Calendar tak dapat dibaca. Semak connector Google Calendar dalam Settings, lepas tu tekan Sync.</p>`:calState==='off'?`<p class="meta">Google Calendar tak bersambung dalam paparan ni.</p>`:calState==='loading'?`<p class="meta">Sedang baca Google Calendar.</p>`:'';
  return `<div class="card big glass" style="--c:#B0937B;margin-top:14px"><div class="rowh" style="align-items:center"><div><p class="eyebrow" style="margin:0">Jadual posting</p><h3 style="font-size:18px;margin-top:4px">${BULAN[c.m]} ${c.y}</h3></div>
    <div class="btns" style="flex-wrap:nowrap;gap:6px"><button class="btn icon sm" data-act="calNav" data-x="-1" aria-label="Bulan lepas">${IC.back}</button><button class="btn icon sm" data-act="calNav" data-x="1" aria-label="Bulan depan">${IC.next}</button><button class="btn sm" data-act="calSync">Sync</button></div></div>
   ${note}<div class="calg" style="margin-top:12px">${['A','I','S','R','K','J','S'].map(x=>`<span class="dow">${x}</span>`).join('')}${cells}</div>
   <div class="btns" style="margin-top:12px"><button class="btn sm solid tab" data-act="evAdd" data-id="${td.startsWith(pre)?td:pre+'01'}">${IC.plus}Tambah posting</button></div></div>
  <div class="card big glass" style="--c:#B0937B;margin-top:14px"><p class="eyebrow">Senarai posting · ${BULAN[c.m]}</p>
   ${evs.map(e=>`<button type="button" class="evrow" data-act="evEdit" data-id="${esc(e.id)}"><span class="evd"><b>${+e.date.slice(8)}</b>${HARI[new Date(e.date+'T00:00:00').getDay()].slice(0,3)}</span><span style="min-width:0;flex:1"><strong>${esc(e.title)}</strong><span class="meta" style="display:block">${esc([e.time,e.note.split('\n')[0]].filter(Boolean).join(' · '))}</span></span>${accPill(e.account)}</button>`).join('')||`<p class="meta" style="margin:0">Tiada posting bulan ni. Tekan tarikh dalam kalendar untuk tambah.</p>`}
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
  return `<div class="card big glass" style="--c:#8676BE;margin-top:14px"><div class="rowh" style="align-items:center"><div><p class="eyebrow" style="margin:0">Footage Sorter · Mac mini</p><h3 style="font-size:18px;margin-top:4px">Folder gambar &amp; video</h3></div><b class="bigno" style="font-size:40px">${toReview}</b></div>
   <div class="meta" style="margin-top:2px">belum disemak${checkMe?' · '+checkMe+' dalam Check Me':''}</div>
   ${rows.map(f=>`<div class="evrow" style="cursor:default"><span style="flex:1;min-width:0"><strong>${esc(f.label)}</strong><span class="meta" style="display:block">${esc(f.group)} · ${f.total} fail</span></span><span class="pill" style="--pc:var(--warn)">${f.review} semak</span></div>`).join('')}
   ${meter(cell(3,1)||'Hard disk',cell(3,2),cell(3,3))}${meter('iCloud',cell(4,2),cell(4,3))}
   <div class="btns" style="margin-top:14px">${/^https?:\/\//.test(link)?`<a class="btn solid tab" href="${esc(link)}" target="_blank" rel="noopener">${IC.ext}Buka folder &amp; semak</a>`:''}</div>
   <p class="meta" style="margin:10px 0 0">Butang tu buka page Footage Sorter. Phone mesti guna Wi-Fi rumah dan app terbuka di Mac mini. Dikemas kini ${esc(cell(1,1))}.</p>${ongoingSlot()}</div>`}
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
  const sv=sheetView();const te=toEditFolders();const hr=new Date().getHours();const eds=S.editor.filter(e=>!/siap/i.test(e.status||''));
  const n={ideas:byStage('ideas').length,'to-shoot':byStage('toshoot').length,shot:byStage('shot').length,'to-edit':te.length+byStage('toedit').length,
    ready:(sv?sv.ready.length:0)+appReady(sv).length,published:publishedEntries(sv).length,links:sv?sv.groups.filter(g=>g.tab==='PRODUCTS').length:'–',
    jobs:S.jobs.filter(j=>!/siap|bayaran/i.test(j.status||'')).length,editor:eds.length,footage:S.footage.length,inspiration:S.inspo.length,'media-kit':3};
  const urgent=sv?sv.ready.map(r=>({r,d:deadline(rowStart(r,sv),7)})).sort((a,b)=>(a.d?a.d.left:99)-(b.d?b.d.left:99)).slice(0,3):[];
  const box=k=>{const t=TAB[k];return `<button class="hbox glass" style="--c:${t.c}" data-act="go" data-id="${k}"><b>${n[k]}</b><span class="l">${t.l}</span></button>`};
  const r=TAB.ready,ed=TAB.editor;
  return `<div class="head"><div><p class="eyebrow">${hr<12?'Selamat pagi':hr<18?'Selamat petang':'Selamat malam'}, Mira</p><h1>Home</h1></div><button class="btn sm" data-act="syncReq">${IC.copy}Sync folder</button></div>
  ${sheetNote()}
  ${sampleCard()}
  <div class="hgrid">
   ${['ideas','to-shoot','shot','to-edit','published'].map(box).join('')}
   <button class="hbox tall glass" style="--c:${ed.c}" data-act="go" data-id="editor"><b>${n.editor}</b><span class="l">Editor</span><span class="edl">${eds.slice(0,4).map(e=>`<span>${esc(e.name)}</span>`).join('')||'<span>Tiada projek berjalan</span>'}</span></button>
   ${['links','jobs','footage','inspiration','media-kit'].map(box).join('')}
   <button class="hbox glass" style="--c:#B0704F" data-act="go" data-id="broll"><b style="display:flex;color:#B0704F">${IC.broll.replace('<svg ','<svg style="width:44px;height:44px;fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round" ')}</b><span class="l">B-Roll Picker</span></button>
   <button class="hbox glass" style="--c:${TAB.caption.c}" data-act="go" data-id="caption"><b style="display:flex;color:${TAB.caption.c}">${IC.caption.replace('<svg ','<svg style="width:44px;height:44px;fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round" ')}</b><span class="l">Caption</span></button>
   <button class="hbox glass" style="--c:${TAB.transcribe.c}" data-act="go" data-id="transcribe"><b style="display:flex;color:${TAB.transcribe.c}">${IC.transcribe.replace('<svg ','<svg style="width:44px;height:44px;fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round" ')}</b><span class="l">Transcribe</span></button>
  </div>
  <div class="rbox glass" style="--c:${r.c}"><div class="rowh" style="align-items:center"><div><h2>${r.l}</h2><div class="meta">Publish dalam 1 minggu selepas siap</div></div><b class="rn">${n.ready}</b></div>
    ${urgent.length?urgent.map(u=>`<div style="--sc:${u.d?u.d.color:'var(--muted)'};margin-top:14px"><div class="rowh" style="align-items:center"><div class="rt"><strong>${esc(u.r.group.name)}</strong>${u.r.vid?' · VID '+esc(u.r.vid):''}</div><span class="pill" style="--pc:${u.d?u.d.color:'#999'}">${u.d?u.d.label:'tiada tarikh'}</span></div><div class="bar"><i style="width:${u.d?u.d.pct:0}%"></i></div></div>`).join(''):`<div class="meta" style="margin-top:12px">${sv?'Tiada video menunggu.':'Menunggu sheet.'}</div>`}
    <div style="margin-top:16px"><button class="btn solid tab" data-act="go" data-id="ready">Buka senarai${IC.next}</button></div></div>
  ${sorterCard()||(S.workprojects&&S.workprojects.length?`<div class="card big glass" style="--c:#8676BE;margin-top:14px"><p class="eyebrow" style="margin:0">Footage Sorter · Mac mini</p>${ongoingSlot()}</div>`:'')}
  ${calHTML()}`};
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

