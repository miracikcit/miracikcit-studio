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
/* 26 Nov malam (Mira): kalendar bulanan penuh dengan titik warna akaun. Tekan hari = senarai video posting hari tu terbuka di bawah
   (dari jadual posting Sheet + event Google Calendar bertanda yang bukan slot jadual). Rupa sama dengan kad Posting Schedule. */
function calPosts(pre){const out={};const add=(d,o)=>(out[d]=out[d]||[]).push(o);
  try{const groups=parseSheet();if(groups){const plan=schedPlan(groups);groups.forEach(g=>g.rows.forEach(r=>{const v=plan.get(schKey(r));if(!v||!v.date||!v.date.startsWith(pre)||v.status==='Excluded')return;
    add(v.date,{t:v.time||'',acc:v.acc||'',name:r.group.name+(r.vid?' · VID '+r.vid:''),sub:[v.kind,v.acc?'@'+v.acc:''].filter(Boolean).join(' · '),done:v.status==='Posted'||tpDone(r),id:'rv-'+r.tab+'-'+r.row})}))}}catch(e){}
  try{ppPlanC().forEach(o=>{if(o.date&&o.date.startsWith(pre))add(o.date,{t:o.time||'',acc:o.acc||'',name:ppNo(o.p)+' · '+(o.p.title||'Posting gambar'),sub:'Posting gambar · '+[...new Set(o.u.rows.map(r=>PP_L[r.p]))].join(', '),done:ppDone(o.u),id:'pp-'+o.p.id+'-'+o.i})})}catch(e){}
  calEvents.filter(e=>e.date.startsWith(pre)&&!/Ref: (post|shoot|edit)-/.test(e.note||'')).forEach(e=>add(e.date,{t:e.time||'',acc:e.account||'',name:e.title,sub:e.account?'@'+e.account:'Google Calendar',ev:e.id}));
  Object.values(out).forEach(L=>L.sort((a,b)=>a.t.localeCompare(b.t)));return out}
function calHTML(){const c=ui.cal||(ui.cal={y:new Date().getFullYear(),m:new Date().getMonth()});const days=new Date(c.y,c.m+1,0).getDate();const off=(new Date(c.y,c.m,1).getDay()+6)%7;const pre=c.y+'-'+pad(c.m+1)+'-';
  const by=calPosts(pre),td=ymd(new Date()),sel=ui.calDay&&ui.calDay.startsWith(pre)?ui.calDay:null;const total=Object.values(by).reduce((a,L)=>a+L.length,0);
  let cells=['Isn','Sel','Rab','Kha','Jum','Sab','Ahd'].map(d=>`<span class="dow">${d}</span>`).join('');for(let i=0;i<off;i++)cells+='<span></span>';
  for(let d=1;d<=days;d++){const k=pre+pad(d),L=by[k]||[];cells+=`<button type="button" class="cd hpcd${k===td?' today':''}${k===sel?' sel':''}${k<td?' past':''}" data-act="calDay" data-id="${k}" aria-label="${d} ${BULAN[c.m]}, ${L.length} posting" aria-expanded="${k===sel}"><b>${d}</b><i>${L.slice(0,4).map(o=>`<u style="background:${o.done?'var(--ok)':ACC_COL[o.acc]||'var(--rose)'}"></u>`).join('')}</i></button>`}
  const L=sel?by[sel]||[]:[];
  const drop=sel?`<div class="hpday"><p class="eyebrow" style="margin:10px 0 5px">${esc(HARI[new Date(sel+'T00:00:00').getDay()])}, ${+sel.slice(8)} ${BULAN[c.m]} · ${L.length} posting</p>
    ${L.map(o=>hpRow(o.t?timeLbl(o.t):'Sepanjang hari',o.name,o.sub,o.done?hpPill('✓ Posted','var(--ok)'):`<u class="hpdot" style="background:${ACC_COL[o.acc]||'var(--rose)'}"></u>`,o.ev?{'data-act':'evEdit','data-id':o.ev}:{'data-act':'tpGo','data-id':o.id})).join('')||'<p class="meta" style="margin:4px 0 0">Tiada posting hari ni.</p>'}
    <button type="button" class="ccmore hpmore" data-act="evAdd" data-id="${sel}">${IC.plus} Tambah posting hari ni</button></div>`:'';
  const note=calState==='err'?`<p class="meta" style="color:var(--bad);margin:0 0 6px">Google Calendar tak dapat dibaca; jadual dari Sheet masih dipaparkan.</p>`:'';
  const lg=Object.entries(ACC_COL).map(([a,col])=>`<span><u class="hpdot" style="background:${col}"></u>@${esc(a)}</span>`).join('')+`<span><u class="hpdot" style="background:var(--ok)"></u>Posted</span>`;
  return `<div class="card glass tp hpc" style="--c:#B0937B"><div class="hphd" style="cursor:default"><b class="tpn hpn${total?'':' zero'}">${total}</b><span style="flex:1;min-width:0"><strong>Kalendar</strong><em>posting ${BULAN[c.m]} ${c.y}</em></span>
    <span class="btns" style="flex-wrap:nowrap;gap:6px"><button class="btn icon sm" data-act="calNav" data-x="-1" aria-label="Bulan lepas">${IC.back}</button><button class="btn icon sm" data-act="calNav" data-x="1" aria-label="Bulan depan">${IC.next}</button></span></div>
   ${note}<div class="calg">${cells}</div>${drop}<div class="hpcl">${lg}</div></div>`}
A.calDay=el=>{ui.calDay=ui.calDay===el.dataset.id?null:el.dataset.id;render(true);const d=document.querySelector('.hpday');if(d)d.scrollIntoView({block:'nearest',behavior:'smooth'})};
function evForm(ev){modal(`<h2>${ev.id?'Edit posting':'Posting baru'}</h2><label class="f"><span>Tajuk</span><input class="inp" id="evT" value="${esc(ev.title||'')}" placeholder="cth. Tjean VID 1"></label>
  <div class="row2"><label class="f"><span>Tarikh</span><input type="date" class="inp" id="evD" value="${esc(ev.date||'')}"></label><label class="f"><span>Masa</span><input type="time" class="inp" id="evM" value="${esc(ev.time||'')}"></label></div>
  <label class="f"><span>Akaun</span>${accSel('id="evA"',ev.account||'')}</label><label class="f"><span>Nota</span><textarea class="inp" id="evN" rows="2">${esc(ev.note||'')}</textarea></label>
  <div class="btns" style="justify-content:space-between">${ev.id?`<button class="btn sm bad" data-act="evDel" data-id="${esc(ev.id)}">${IC.trash}Padam</button>`:'<span></span>'}<div class="btns"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="evSave" data-id="${esc(ev.id||'')}">Simpan</button></div></div>`,'#B0937B')}
A.evAdd=el=>evForm({date:el.dataset.id});
A.evEdit=el=>{const e=calEvents.find(x=>x.id===el.dataset.id);if(e)evForm(e)};
A.calNav=el=>{const c=ui.cal;const d=new Date(c.y,c.m+(+el.dataset.x),1);ui.cal={y:d.getFullYear(),m:d.getMonth()};render(true)};
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
/* Ongoing projects (WORK SORTER): status dari Mac (koleksi workprojects). Gambar kekal dalam Mac; butang buka page sorter untuk edit. */
/* 26 Nov (Mira): kotak kecil "Sedang berjalan" supaya tak lupa apa yang tengah loading dalam Studio.
   Setiap baris: bulat kecil dengan % (tiada % = bulat berpusing). Tekan baris = buka tab tu. Kosong = kotak tak keluar. */
function busyList(){const L=[],now=Date.now();const add=(name,pct,go,sub)=>L.push({name,go,sub:sub||'',pct:pct==null||!isFinite(pct)?null:Math.max(0,Math.min(100,Math.round(pct)))});
  Object.entries(ui.fuUp||{}).forEach(([k,u])=>{const it=get('items',k);add('Upload footage · '+((it&&it.title)||u.name),u.pct,'to-shoot',u.n>1?u.i+'/'+u.n:'')});
  S.gaya.forEach(g=>{const u=(ui.gyUp||{})[g.id];
    if(g.status==='scan'&&(g.step!=='upload'||u))add('Copy Style · '+(g.name||g.srcName||'video'),u?u.pct:g.pct,'inspiration',u?'Upload':g.step==='analyse'?'Analisis':'Download');
    (g.looks||[]).forEach(l=>{if(l.st==='bina')add('Rupa · '+(l.name||''),l.pct,'inspiration','Bina contoh')});
    if(g.fix&&g.fix.st==='proses'&&now-(g.fix.at||0)<10*60000)add('Copy Style · '+(g.name||''),null,'inspiration','Betulkan')});
  S.broll.forEach(b=>{const e=b.exp||{};if(b.status==='precut')add('B-roll · '+b.name,b.progress||0,'to-edit','Pre-cut');else if(b.status==='backup')add('B-roll · '+b.name,null,'to-edit','Simpan');else if(e.running)add('B-roll · '+b.name,e.total?e.done/e.total*100:0,'to-edit','Final')});
  (S.carousel||[]).forEach(c=>{if((c.status==='scan'||c.status==='make')&&now-(c.updated||0)<20*60000)add('Carousel · '+(c.title||''),c.pct,'published',c.status==='make'?'Susun':'Kumpul')});
  (S.edpwa||[]).forEach(d=>{if(d.finStatus==='proses'&&now-(d.updated||0)<30*60000)add('Render · '+String(d.title||'').replace(/^Edit\s+/,''),d.finPct,'editor','Render')});
  const fu=S.sync.finalsup||{};if(fu.name&&(fu.pct||0)<100&&now-(fu.at||0)<15*60000)add('Final ke Drive · '+fu.name,fu.pct,'ready','Upload');
  if(typeof DLQ!=='undefined')Object.values(DLQ).forEach(q=>add('Muat turun video',q.pct||0,'ready',''));
  Object.entries(ui.edNow||{}).forEach(([k,v])=>add('Edit · '+String(k).split('/').pop(),null,'to-edit',v));
  if(typeof schedBusy!=='undefined'&&schedBusy)add('Jadual posting',schedProg&&schedProg.pct,'ready','');
  return L}
const bRing=p=>`<span class="bring${p==null?' ind':''}" style="--p:${p||0}" aria-hidden="true"><i></i>${p==null?'':`<b>${p}</b>`}</span>`;
function busyHome(){const L=busyList();if(!L.length)return '';
  return `<div class="busy glass" role="status" aria-label="${L.length} kerja sedang berjalan"><p class="bh"><i class="spin"></i>Sedang berjalan · ${L.length}</p>
   ${L.slice(0,5).map(x=>`<button type="button" class="bi" data-act="go" data-id="${esc(x.go)}">${bRing(x.pct)}<span class="bn">${esc(x.name)}</span>${x.sub?`<span class="bs">${esc(x.sub)}</span>`:''}</button>`).join('')}
   ${L.length>5?`<p class="bs" style="margin:4px 0 0">+${L.length-5} lagi</p>`:''}</div>`}
const appReady=sv=>byStage('ready').filter(it=>!(it.auto&&sv&&(it.files||[]).some(f=>matchFile(f,sv.groups))));
V.home=()=>{
  const sv=sheetView();const te=toEditFolders();const hr=new Date().getHours();const eds=S.editor.filter(e=>!edDone(e));
  const n={ideas:byStage('ideas').length,'to-shoot':byStage('toshoot').length,shot:byStage('shot').length,'to-edit':te.length+byStage('toedit').length,
    ready:(sv?sv.ready.length:0)+appReady(sv).length,published:publishedEntries(sv).length,links:sv?sv.groups.filter(g=>g.tab==='PRODUCTS').length:'–',
    jobs:S.jobs.filter(j=>!/siap|bayaran/i.test(j.status||'')).length,editor:eds.length,footage:S.footage.length,inspiration:S.inspo.length+S.gaya.length,'media-kit':3};
  const urgent=sv?sv.ready.map(r=>({r,d:deadline(rowStart(r,sv),7)})).sort((a,b)=>(a.d?a.d.left:99)-(b.d?b.d.left:99)).slice(0,3):[];
  const box=(k,num,lab)=>{const t=TAB[k];return `<button class="hbox glass" style="--c:${t.c}" data-act="go" data-id="${k}"><b>${num!==undefined?num:n[k]}</b><span class="l">${lab||navLabel(t.l)}</span></button>`};
  const icn=k=>IC[k].replace('<svg ','<svg style="width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round" ');
  const ed=TAB.editor;const cp=confirmedList(sv);
  const mini=k=>{const t=TAB[k];return `<button class="hbox glass mini hmi" style="--c:${t.c}" data-act="go" data-id="${k}"><b>${t.ic}</b><span class="l">${k==='footage'?'Footage':navLabel(t.l)}</span></button>`};
  const tall=(k,num,lab)=>{const t=TAB[k];return `<button class="hbox glass" style="--c:${t.c}" data-act="go" data-id="${k}"><b>${num}</b><span class="l">${lab}</span></button>`};
  /* 26 Nov malam (Mira): kotak atas = nombor; baris kecil = ikon sahaja (ikut tab paling selalu dibuka); Shot dibuang, VO masuk kotak atas.
     Susunan kad: To Publish, Posting Schedule, VO, Projects, Editor, Perlu shoot, kemudian yang lain. Semua kad guna rupa Posting Schedule (hpCard). */
  return `<div class="head"><div><p class="eyebrow">${hr<12?'Selamat pagi':hr<18?'Selamat petang':'Selamat malam'}, Mira</p><h1>Home</h1></div></div>
  ${sheetNote()}
  <div class="hgrid hgx">
   ${box('links',projCount(),'Projects')}${box('to-shoot')}${tall('vo',voPending().length,'VO')}
   <button class="hbox big2 edbox glass" style="--c:${ed.c}" data-act="go" data-id="editor"><span class="edn"><b>${n.editor}</b><span class="l">Editor</span></span><span class="edl">${eds.slice(0,6).map(e=>`<span class="edr"><span>${esc(shortName(e.name))}</span><i style="--pc:${/draf|sedia|semak/i.test(e.status||'')?'var(--warn)':'var(--c)'}">${esc(edMulti(e)?edFinN(e)+'/'+edTot(e):edShort(e.status))}</i></span>`).join('')||'<span>Tiada projek berjalan</span>'}${eds.length>6?`<span>+${eds.length-6} lagi</span>`:''}</span></button>
   ${box('to-edit',n.shot+n['to-edit'])}${box('ready')}${box('published')}
  </div>
  <div class="mgrid">${(u=>['ideas','threads','inspiration','media-kit','footage','caption','transcribe'].map((k,i)=>[k,u[k]||0,i]).sort((a,b)=>b[1]-a[1]||a[2]-b[2]).map(x=>mini(x[0])).join(''))(tabUse())}</div>
  ${homePub()}
  ${schedHome()}
  ${voAlert()}
  ${hpCard('links',projItems().filter(o=>!o.done).length,'Projects','sample dan paid job ikut deadline',projItems().filter(o=>!o.done).sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(0,4).map(projHp).join('')||'<p class="meta" style="margin:4px 0 0">Tiada projek menunggu.</p>','Buka Projects')}
  ${edSelfHome()}
  ${shootHome()}
  ${storeWarnHome()}
  ${airHome()}
  ${busyHome()}
  ${brHome()}
  ${calHTML()}
  ${storeHome()}`};
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
const edShort=st=>({'Storyboard':'SB','Sesi dibuka':'Sesi','Tunggu semakan':'Semak','Sedia render':'Render'})[st||'']||(st||'Draf');
/* Ringkasan minggu (Isnin): sample perlu shoot, video tunggu edit, link belum submit, job hampir deadline */
/* Kad depan padat: tajuk + nombor besar, baris satu garis dengan nama pendek */
const shortName=(name,vid)=>{const w=String(name||'').trim().split(/\s+/);return vid?'Vid '+vid+' '+w[0]:w.slice(0,3).join(' ')};
const ccRow=(name,pill,col,pct)=>`<div class="ccr" style="--sc:${col}"><div class="rowh"><span class="ccn">${esc(name)}</span><span class="pill" style="--pc:${col}">${esc(pill)}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;

/* 26 Nov (Mira): kotak kecil Home ikut tab yang paling selalu dibuka (kiraan dalam phone ni sahaja, localStorage tabUse).
   Kad "Footage baru dari phone" (Footage Sorter) dibuang dari Home; ganti dengan senarai video perlu shoot. */
function tabUse(){try{return JSON.parse(localStorage.getItem('tabUse')||'{}')||{}}catch(e){return {}}}
/* Kad Home seragam (rupa Posting Schedule): bulatan nombor + tajuk huruf besar + baris .hprow + "Buka" di bawah */
function hpCard(k,num,title,sub,body,more,tone){return `<div class="card glass tp hpc" style="--c:${TAB[k]?TAB[k].c:'var(--rose)'}"><button type="button" class="hphd" data-act="go" data-id="${k}"><b class="tpn hpn${num?(tone?' '+tone:''):' zero'}">${num}</b><span><strong>${esc(title)}</strong><em>${esc(sub)}</em></span></button>${body}${more?`<button type="button" class="ccmore hpmore" data-act="go" data-id="${k}">${esc(more)} ${IC.next}</button>`:''}</div>`}
function hpRow(left,name,sub,right,attrs){return `<${attrs&&attrs.href?'a':'button type="button"'} class="hprow hpx" ${attrs?Object.entries(attrs).map(([k,v])=>`${k}="${esc(v)}"`).join(' '):''}><span class="tm">${left}</span><span class="nm"><b>${esc(name)}</b>${sub?`<i>${esc(sub)}</i>`:''}</span>${right||''}</${attrs&&attrs.href?'a':'button'}>`}
const hpPill=(t,c)=>`<span class="pill" style="--pc:${c}">${esc(t)}</span>`;
function projHp(o){const d=o.kind==='sample'?(o.it.sample||{}).postBy:(jobNext(o.j)||{}).date;const left=d?daysTo(d):null;const col=left===null?'var(--muted)':left>7?'var(--ok)':left>=3?'var(--warn)':'var(--bad)';
  return hpRow(left===null?'·':left<0?'Lewat '+(-left)+'h':left===0?'Hari ni':left+' hari',o.name,o.kind==='sample'?'Sample':'Paid job',hpPill(o.kind==='sample'?(JSTEPS[o.step+1]||'Siap'):((jobNext(o.j)||{}).label||'Job'),col),{'data-act':'go','data-id':'links'})}
/* Storan: tunjuk hanya bila hampir penuh (lebih 85%) */
/* 27 Nov (Mira): tracker storan di bawah sekali Home: Mac mini, iCloud, Google Drive, PERTAMA. Data sync/storage (Mac mini) + tab SORTER (iCloud). 0 token. */
function storeHome(){const st=S.sync.storage||{},v=sorterRaw||[],num=(r,c)=>+String(((v[r]||[])[c])??'').trim()||0,G=1073741824,d=st.disk||null;
  const sz=b=>{const g=b/G;return g>=1000?(g/1000).toFixed(2)+' TB':g>=10?Math.round(g)+' GB':g.toFixed(1)+' GB'};
  const rows=[['Mac mini',st.mac],['iCloud',num(4,3)?{used:num(4,2)*G,total:num(4,3)*G}:null],['Google Drive',st.drive],['PERTAMA',d,d&&!d.mounted?'tak disambung':'']];
  const bar=([n,o,note])=>{if(!o||!o.total)return `<div class="hstor"><div class="hstt"><b>${n}</b><span>${note||'belum ada bacaan'}</span></div><div class="hstb"></div></div>`;
    const pct=Math.round(o.pct!=null?o.pct:o.used/o.total*100),col=pct>85?'var(--bad)':pct>70?'var(--warn)':'var(--ok)';
    return `<div class="hstor" style="--sc:${col}"><div class="hstt"><b>${n}${note?' · '+note:''}</b><span>${pct}% · ${sz(o.used)} / ${sz(o.total)}</span></div><div class="hstb"><i style="width:${Math.max(2,Math.min(100,pct))}%"></i></div></div>`};
  return `<div class="card glass hpc"><p class="eyebrow" style="margin:0">Storan</p>${rows.map(bar).join('')}</div>`}
function storeWarnHome(){if(!sorterRaw||!sorterRaw.length)return '';const v=sorterRaw,cell=(r,c)=>String(((v[r]||[])[c])??'').trim();
  const L=[[cell(3,1)||'Hard disk',+cell(3,2)||0,+cell(3,3)||0],['iCloud',+cell(4,2)||0,+cell(4,3)||0]].filter(x=>x[2]&&x[1]/x[2]>.85);if(!L.length)return '';
  return `<div class="banner glass" style="margin-top:14px">${L.map(x=>`<b>${esc(x[0])}</b> ${Math.round(x[1]/x[2]*100)}% penuh (${x[1]} / ${x[2]>=1000?(x[2]/1000).toFixed(1)+' TB':x[2]+' GB'})`).join(' · ')}. Kosongkan sikit, atau Sort gambar peribadi dalam Lagi.</div>`}
function shootHome(){const key=it=>it.sample?it.sample.postBy:String(it.shootDate||'9');const L=byStage('toshoot').sort((a,b)=>key(a).localeCompare(key(b)));
  const row=it=>{const d=it.sample?it.sample.postBy:it.shootDate,left=/^\d{4}-\d\d-\d\d$/.test(String(d||''))?daysTo(d):null;
    const col=left===null?'var(--muted)':left>7?'var(--ok)':left>=3?'var(--warn)':'var(--bad)';
    return hpRow(left===null?'·':left>0?left+' hari':left===0?'Hari ni':'Lewat '+(-left)+'h',it.title||'Tanpa tajuk',[isJob(it)?'Job':'Creative',footCount(it)?'ada footage':''].filter(Boolean).join(' · '),hpPill(left===null?'Tiada tarikh':left<0?'Lewat':left<=2?'Segera':'Shoot',col),{'data-act':'go','data-id':'to-shoot'})};
  return hpCard('to-shoot',L.length,'Perlu shoot','ikut tarikh paling hampir',L.slice(0,5).map(row).join('')+(L.length>5?`<p class="meta" style="margin:6px 0 0">+${L.length-5} lagi</p>`:'')||'<p class="meta" style="margin:4px 0 0">Tiada video menunggu shoot.</p>','Buka Shoot','bad')}
A.go=el=>{try{const u=tabUse(),k=el.dataset.id;u[k]=(u[k]||0)+1;localStorage.setItem('tabUse',JSON.stringify(u))}catch(e){}go(el.dataset.id)};
/* Folder di Mac mini diimbas sendiri oleh worker setiap 5 minit. Butang ni minta imbasan sekarang. */
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
  return head('Alat dan rekod')+`<div class="mgrid">${t('inspiration',S.inspo.length+S.gaya.length,'Copy Style')}${t('media-kit',3,'Media Kit')}${t('footage',S.footage.length,'Footage')}${t('caption',0,'Caption','caption')}${t('threads',0,'Photo Editor','threads')}${t('transcribe',0,'Transcribe','transcribe')}${t('ideas',byStage('ideas').length,'Ideas')}</div>
  ${(()=>{const v=sorterRaw||[],cell=(r,c)=>String(((v[r]||[])[c])??'').trim();return `<div class="card glass tp hpc" style="--c:#8676BE"><div class="hphd" style="cursor:default"><b class="tpn hpn zero">${IC.footage}</b><span><strong>Sort gambar peribadi</strong><em>Footage Sorter di Mac mini · iCloud ke PERTAMA</em></span></div>${sorterPersonal(+cell(4,2)||0,+cell(4,3)||0)}</div>`})()}`};

/* 2026-11-25 (Mira): gambar peribadi. Kad beritahu bila patut sort (iCloud 80% ke atas, atau 30 hari sejak Start sort terakhir)
   dan butang Start sort: Mac mini buka semula app Footage Sorter dengan -autoStart (sumber ikut tetapan app: iCloud Photos,
   langkau 30 hari terakhir; hasil ke PERTAMA › PHOTOS). 0 token. Mira yang tekan, app tak mula sendiri. */
function sorterPersonal(used,total){const run=(S.sync.sorterrun||{}).at||0,days=run?Math.floor((Date.now()-run)/DAY):null,pct=total?Math.round(used/total*100):0;
  const why=[pct>=80?'iCloud '+pct+'% penuh':'',days===null?'belum pernah Start sort dari sini':days>=30?days+' hari sejak sort terakhir':''].filter(Boolean);const due=why.length>0;const busy=ui.sorterBusy;
  return `<div class="srp"><div class="rowh" style="align-items:center"><div style="min-width:0"><b>Gambar peribadi</b><span class="meta" style="display:block">${due?esc(why.join(' · ')):'Sort terakhir '+(days===0?'hari ni':days+' hari lepas')}</span></div>${due?`<span class="pill" style="--pc:var(--bad)">Masa untuk sort</span>`:''}</div>
    <div class="btns" style="margin-top:8px;align-items:center"><button class="btn sm${due?' solid tab':''}" data-act="sorterStart"${busy?' disabled':''}>${busy?'<i class="spin"></i>Buka Footage Sorter':'Start sort'}</button>${tok(0)}</div></div>`}
A.sorterStart=()=>confirmBox('Mula sort gambar sekarang? Mac mini buka semula app Footage Sorter dan mula susun ke PERTAMA. Pastikan PERTAMA disambung.',async()=>{ui.sorterBusy=1;render();
  try{await studioJob('sorter_start',{},2*60000);const d={at:Date.now()};S.sync.sorterrun=d;saveDoc('sync/sorterrun',d);toast('Footage Sorter mula sort di Mac mini. Yang tak pasti masuk Check Me')}
  catch(e){toast(String((e&&(e.message||e.code))||'Mac mini tak jawab').slice(0,90))}finally{ui.sorterBusy=0;render()}},'Ya, mula');
