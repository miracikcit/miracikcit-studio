/* ---------- TO SHOOT ---------- */
/* 2026-11-23 (Mira): Shoot ada dua tab: Jobs (paid / sample) dan Creative (idea + creative nak shoot). Setiap kad ada butang Edit. */
const isJob=it=>it.kind?it.kind==='job':!!(it.sample||it.productId||it.brand||it.paid);
const jobPill=it=>it.sample?`<span class="pill" style="--pc:#5A8FB5">Sample</span>`:it.paid?`<span class="pill" style="--pc:#3E8E5A">Paid${it.paid>0&&it.paid!==true?' RM '+esc(String(it.paid)):''}</span>`:`<span class="pill" style="--pc:#999">Tanpa bayaran</span>`;
const kindSeg=(k,nj,nc,act)=>`<div class="seg" style="margin-bottom:12px"><button type="button" class="${k==='job'?'on':''}" data-act="${act}" data-id="job">Jobs · ${nj}</button><button type="button" class="${k==='creative'?'on':''}" data-act="${act}" data-id="creative">Creative · ${nc}</button></div>`;
A.shootTab=el=>{ui.shootTab=el.dataset.id;try{localStorage.setItem('ms:shootTab',ui.shootTab)}catch(e){}render(true)};
V['to-shoot']=()=>{if(!ui.shootTab){try{ui.shootTab=localStorage.getItem('ms:shootTab')||'job'}catch(e){ui.shootTab='job'}}
  const key=it=>it.sample?it.sample.postBy:String(it.shootDate||'9');const all=byStage('toshoot').sort((a,b)=>key(a).localeCompare(key(b)));
  const jobs=all.filter(isJob),cre=all.filter(it=>!isJob(it)),ideas=byStage('ideas');
  if(ui.shootTab==='creative')return head('Idea dan video creative',`<button class="btn sm solid tab" data-act="tsNew">${IC.plus}Tambah creative</button>`)+kindSeg('creative',jobs.length,cre.length+ideas.length,'shootTab')+creList(cre,ideas);
  const list=jobs;
  return head('Paid job dan sample',`<button class="btn sm solid tab" data-act="smpAdd">${IC.plus}Tambah sample</button>`)+kindSeg('job',jobs.length,cre.length+ideas.length,'shootTab')+`<div class="list alt">${list.map(it=>{
    const left=it.shootDate?Math.ceil((new Date(it.shootDate+'T00:00:00')-Date.now())/DAY):null;const col=left===null?'var(--muted)':left>7?'var(--ok)':left>=0?'var(--warn)':'var(--bad)';
    const badge=it.sample&&!sampleDone(it)?smpBadge(it):`<div class="smpb" style="--pc:${col}">${left!==null?`<span class="pill">${left>0?left+' hari lagi':left===0?'Hari ni':'Lewat '+(-left)+' hari'}</span>`:''}<button class="smpd" data-act="tsDate" data-id="${it.id}">${it.shootDate?'Shoot '+dmy(it.shootDate):'Set tarikh shoot'}</button></div>`;
    return `<div class="card glass tsc"><div class="rowh" style="align-items:flex-start;gap:10px"><div style="min-width:0"><h3>${esc(it.title||'Nota')} ${jobPill(it)}</h3><div class="meta">${esc([it.sample?'Sample '+smpPlat(it.sample.plat):'',it.sample&&it.sample.price?'RM '+it.sample.price:'',it.brand,it.nota?'ada nota':''].filter(Boolean).join(' · '))}</div></div>${badge}</div>
    <div class="tsx">${accSel(`id="ac-${it.id}" data-col="items" data-id="${it.id}" data-f="account"`,it.account||'','Akaun')}${it.sample?smpListing(it):''}${notaBtn(it,it.sample?'smpNotaBtn':'nota')}${tsMic(it)}</div>${prodLine(it)}
    <div class="tsm">${footBtn(it)}<button class="btn icon sm" data-act="tsEdit" data-id="${it.id}" aria-label="Edit">${IC.edit}</button><button class="btn icon sm bad" data-act="delItem" data-id="${it.id}" aria-label="Padam">${IC.trash}</button></div>${fuStatus(it)}</div>`}).join('')||`<div class="empty">Tiada job menunggu. Tambah sample, atau job dari tab Projects.</div>`}</div>`};
A.tsDate=el=>{const it=get('items',el.dataset.id);modal(`<h2>Tarikh shoot</h2><p class="meta">${esc(it.title||'')}</p><label class="f"><span>Tarikh</span><input type="date" class="inp" id="tsD" value="${esc(it.shootDate||'')}"></label><div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="tsDateSave" data-id="${it.id}">Simpan</button></div>`,TAB['to-shoot'].c)};
A.tsDateSave=el=>{const it=get('items',el.dataset.id);save('items',Object.assign({},it,{shootDate:($('#tsD')||{}).value||''}));closeModal();toast('Tarikh disimpan')};
A.toShot=el=>moveItem(get('items',el.dataset.id),'shot',{shotAt:ymd(new Date())});


/* Creative (2026-11-25, Mira): kad "Nak shoot" sama bentuk dengan Jobs: tajuk penuh, tiada gambar listing / link produk,
   semua butang di baris bawah. Idea kekal senarai ringkas. */
function creCard(it){const left=it.shootDate?Math.ceil((new Date(it.shootDate+'T00:00:00')-Date.now())/DAY):null;const col=left===null?'#999':left>7?'var(--ok)':left>=0?'var(--warn)':'var(--bad)';
  const meta=[it.nota?'ada nota':'',noEmoji(it.details||((it.src&&it.src.text)||'')).slice(0,140)].filter(Boolean).join(' · ');
  return `<div class="card glass tsc crc"><div class="crp"><span class="pill" style="--pc:#9A4F5D">Creative</span><button class="pill crd" style="--pc:${col}" data-act="tsDate" data-id="${it.id}">${it.shootDate?'Shoot '+dmy(it.shootDate)+(left>0?' · '+left+' hari lagi':left===0?' · hari ni':' · lewat '+(-left)+' hari'):'Set tarikh shoot'}</button>${accSel(`id="ac-${it.id}" data-col="items" data-id="${it.id}" data-f="account"`,it.account||'','Akaun')}${tsMic(it)}</div>
    <h3>${esc(it.title||'Tanpa tajuk')}</h3>${meta?`<div class="meta">${esc(meta)}</div>`:''}${fuStatus(it)}
    <div class="crm">${footBtn(it)}${notaBtn(it,'nota')}<button class="btn icon sm" data-act="tsEdit" data-id="${it.id}" aria-label="Edit">${IC.edit}</button><button class="btn icon sm bad" data-act="delItem" data-id="${it.id}" aria-label="Padam">${IC.trash}</button></div></div>`}
function creList(cre,ideas){
  const row=it=>{const meta=['Idea',it.account,noEmoji(it.details||((it.src&&it.src.text)||'')).slice(0,90)].filter(Boolean).join(' · ');
    return `<div class="crow glass"><div class="crt"><b>${esc(it.title||'Tanpa tajuk')}</b><small>${esc(meta)}</small></div><div class="crb"><button class="btn sm" data-act="tsPlan" data-id="${it.id}">Nak shoot</button>
      <button class="btn sm" data-act="tsEdit" data-id="${it.id}" aria-label="Edit">${IC.edit}</button><button class="btn icon sm bad" data-act="delItem" data-id="${it.id}" aria-label="Padam">${IC.trash}</button></div></div>`};
  return `<p class="eyebrow">Nak shoot · ${cre.length}</p><div class="list alt">${cre.map(creCard).join('')||'<div class="empty">Tiada video creative menunggu.</div>'}</div>
    <p class="eyebrow" style="margin-top:18px">Idea · ${ideas.length} <a href="#ideas" class="meta" style="margin-left:6px">+ idea baru</a></p><div class="clist">${ideas.map(row).join('')||'<div class="empty">Belum ada idea.</div>'}</div>`;
}
A.tsPlan=el=>{const it=get('items',el.dataset.id);moveItem(it,'toshoot',{kind:'creative'})};
A.tsNew=()=>tsForm({stage:'toshoot',kind:'creative'});
A.tsEdit=el=>tsForm(get('items',el.dataset.id));
function tsForm(it){const job=it.kind?it.kind==='job':isJob(it);
  modal(`<h2>${it.id?'Edit':'Tambah'} kad</h2>
   <label class="f"><span>Tajuk</span><input class="inp" id="tfT" value="${esc(it.title||'')}"></label>
   <div class="seg" style="margin:4px 0 12px"><button type="button" class="${job?'on':''}" data-act="tfKind" data-id="job">Jobs</button><button type="button" class="${job?'':'on'}" data-act="tfKind" data-id="creative">Creative</button></div>
   <div id="tfJob" ${job?'':'hidden'}><label class="f"><span>Brand</span><input class="inp" id="tfB" value="${esc(it.brand||'')}"></label>
    <label class="f"><span>Bayaran (RM, kosong = tanpa bayaran)</span><input class="inp" id="tfP" inputmode="decimal" value="${esc(it.paid&&it.paid!==true?String(it.paid):'')}" ${it.sample?'placeholder="Sample"':''}></label></div>
   <label class="f"><span>Tarikh shoot</span><input type="date" class="inp" id="tfD" value="${esc(it.shootDate||'')}"></label>
   <label class="f"><span>Akaun</span>${accSel('id="tfA"',it.account||'')}</label>
   ${tsVoBtn(!!it.vo,'tfVo','')}
   <label class="f"><span>Folder footage (kalau dah upload di Mac mini)</span>${fuSel('tfF',it.folder||'',false,it.title)}</label>
   <label class="f"><span>Details (lokasi, props, point penting, link)</span><textarea class="inp" id="tfX" rows="5">${esc(it.details||'')}</textarea></label>
   <div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="tfSave" data-id="${esc(it.id||'')}" data-stage="${esc(it.stage||'toshoot')}">Simpan</button></div>`,TAB['to-shoot'].c);
  ui.tfKind=job?'job':'creative';ui.tfVo=!!it.vo}
A.tfKind=el=>{ui.tfKind=el.dataset.id;document.querySelectorAll('#modal .seg button').forEach(b=>b.classList.toggle('on',b.dataset.id===ui.tfKind));const j=$('#tfJob');if(j)j.hidden=ui.tfKind!=='job'};
A.tfSave=el=>{const id=el.dataset.id,old=id?get('items',id):{created:Date.now(),stage:el.dataset.stage||'toshoot',stageAt:{toshoot:Date.now()},src:{type:'text',text:''}};const v=s=>(($(s)||{}).value||'').trim();
  const title=v('#tfT');if(!title){toast('Tulis tajuk dulu');return}
  const pay=v('#tfP'),o=Object.assign({},old,{title,kind:ui.tfKind,shootDate:v('#tfD'),account:v('#tfA'),details:v('#tfX'),folder:v('#tfF'),vo:!!ui.tfVo});
  if(ui.tfKind==='job'){o.brand=v('#tfB');o.paid=pay?(+pay||pay):(old.sample?old.paid:false)}
  if(!id)o.id='c'+Date.now().toString(36);save('items',o);tsVoSync(o,!!old.vo);closeModal();toast(o.vo&&!old.vo?'Disimpan. Peringatan VO masuk tab VO':'Disimpan')};

/* UPLOAD FOOTAGE (2026-11-23, Mira): pilih folder dalam CLAUDE EDITS, pilih video dari phone, upload terus ke Drive
   (8 MB sekeping, bar %), Mac mini pindah ke folder tu (job foot_in) dan pautkan folder ke kad. */
function fuFolders(){return (((S.sync.toedit||{}).stages)||[]).flatMap(st=>(st.items||[]).map(i=>({v:st.name+'/'+i.name,l:st.name.replace(/^(\d+)\.\s*/,'$1 · ')+' › '+i.name})))}
function fuSel(id,val,withNew,title){const L=fuFolders();const nw=withNew?FOLDERS.map(f=>`<option value="new|${esc(f)}">＋ Folder baru dalam ${esc(f)}</option>`).join(''):'';
  return `<select class="inp" id="${id}"><option value="">${withNew?'Pilih folder':'Tiada / belum'}</option>${nw?`<optgroup label="Folder baru (nama: ${esc(title||'kad')})">${nw}</optgroup>`:''}<optgroup label="Folder sedia ada">${L.map(o=>`<option value="${esc(o.v)}"${o.v===val?' selected':''}>${esc(o.l)}</option>`).join('')}</optgroup>${val&&!L.some(o=>o.v===val)?`<option value="${esc(val)}" selected>${esc(val)}</option>`:''}</select>`}
function fuStatus(it){const u=(ui.fuUp||{})[it.id],d=get('footin',it.id);
  if(u)return `<div class="stbar" style="--c:var(--c)"><div class="stt"><span>Upload ${u.i}/${u.n}: ${esc(u.name)}</span><span>${u.pct}%</span></div><div class="stg"><i style="width:${Math.max(3,u.pct)}%"></i></div></div>`;
  if(d&&d.status==='proses'&&Date.now()-(d.at||0)<3*36e5)return `<div class="stbar" style="--c:var(--warn)"><div class="stt"><span><i class="spin"></i> Mac mini pindah ke folder (${d.done||0}/${d.n||'?'})</span><span>${d.n?Math.round((d.done||0)/d.n*100):0}%</span></div><div class="stg"><i style="width:${Math.max(3,d.n?(d.done||0)/d.n*100:5)}%"></i></div></div>`;
  if(d&&d.status==='tunggu'&&Date.now()<(d.until||0)){const left=Math.max(1,Math.ceil((d.until-Date.now())/60000));return `<div class="stbar" style="--c:var(--warn)"><div class="stt"><span><i class="spin"></i> Menunggu AirDrop${d.done?' · '+d.done+' dah masuk':''}</span><span>baki ${left} min</span></div><div class="stg"><i style="width:${Math.max(3,Math.round(left/30*100))}%"></i></div></div>`}
  if(d&&d.status==='error')return `<p class="meta" style="color:var(--bad);margin:6px 0 0">Upload footage gagal: ${esc(d.msg||'')}</p>`;
  return it.folder?`<p class="meta" style="margin:6px 0 0">📁 ${esc(it.folder.replace(/^(\d+)\.\s*/,'$1 · ').replace('/',' › '))}${d&&d.status==='sedia'&&Date.now()-(d.at||0)<864e5?` · ${d.done} video baru masuk`:''}</p>`:''}
/* 2026-11-25 (Mira): butang Footage (Jobs dan Creative) buka TIGA cara: upload dari iPhone, pilih folder sedia ada dalam
   CLAUDE EDITS (paut sahaja), atau buat folder baru dalam folder utama (21, 22, 23...) terus dari phone. Semua 0 token. */
const fuSafe=t=>String(t||'Footage').replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,60);
function fuMains(){const st=(((S.sync.toedit||{}).stages)||[]).map(x=>x.name);const all=[...new Set(st.concat(FOLDERS))].filter(n=>/^2\d\./.test(n));return all.sort((a,b)=>a.localeCompare(b))}
const fuMainL=n=>{const m=String(n).match(/^(\d+)\.\s*(.*)$/);if(!m)return n;const t=m[2].replace(/^EDIT\b\s*/i,'').toLowerCase().replace(/(^|\s)([a-z])/g,(x,a,b)=>a+b.toUpperCase()).replace(/\bVo\b/g,'VO');return m[1]+' '+t};
/* Cadangan folder utama ikut jenis kad; Mira tukar kalau salah */
function fuGuess(it){const M=fuMains(),has=no=>M.find(n=>n.startsWith(no+'.'));if(it.folder&&has(fno(it.folder)))return has(fno(it.folder));
  const t=nrm((it.title||'')+' '+(it.details||''));const pick=isJob(it)?(/unbox/.test(t)?'26':'21'):/hotel|resort|staycation/.test(t)?'23':/masak|resipi|recipe|cook/.test(t)?'24':/vlog|trip|jalan|cuti/.test(t)?'22':/cakap|talk|cerita/.test(t)?'25':'28';
  return has(pick)||M[0]||''}
function fuBody(){const u=ui.fu,it=get('items',u.id);if(!it)return '';
  const opt=(m,ic,t,d)=>`<button type="button" class="fuo${u.mode===m?' on':''}" data-act="fuMode" data-id="${m}"><i>${ic}</i><span><b>${t}</b><small>${d}</small></span></button>`;
  const pn=airPend().length;
  const body=u.mode==='air'?`${it.folder?`<p class="meta">Masuk folder ${esc(fuMainL(it.folder.split('/')[0]))}</p>`:`<p class="fulab">Folder utama</p><div class="fuchips">${fuMains().map(n=>`<button type="button" class="fuchip${u.main===n?' on':''}" data-act="fuMain" data-id="${esc(n)}">${esc(fuMainL(n))}</button>`).join('')}</div>`}
      ${pn?`<div class="btns fub"><button class="btn" data-act="fuAir" data-id="${it.id}" data-take="1">${IC.check}Masukkan ${pn} video yang dah sampai</button></div>`:''}
      <div class="btns fub"><button class="btn solid tab" data-act="fuAir" data-id="${it.id}">${IC.up}Buka Photos dan AirDrop</button></div>`
    :u.mode==='up'?`<label class="f"><span>Masuk folder mana</span>${fuSel('fuF',u.sel||it.folder||'',false,it.title)}</label>
      <p class="meta">Skrin tak akan tidur masa upload; jangan tutup atau tukar app sampai bar habis.</p>
      <div class="btns fub"><button class="btn solid tab" data-act="fuPick" data-id="${it.id}">${IC.up}Pilih video</button></div>`
    :u.mode==='pick'?`<label class="f"><span>Folder dalam CLAUDE EDITS</span>${fuSel('fuF',u.sel||it.folder||'',false,it.title)}</label>
      <p class="meta">Footage dah ada di Mac mini. Kad dipautkan ke folder tu, tiada upload.</p>
      <div class="btns fub"><button class="btn solid tab" data-act="fuLink" data-id="${it.id}">${IC.check}Paut folder ni</button></div>`
    :u.mode==='new'?`<p class="fulab">Folder utama</p><div class="fuchips">${fuMains().map(n=>`<button type="button" class="fuchip${u.main===n?' on':''}" data-act="fuMain" data-id="${esc(n)}">${esc(fuMainL(n))}</button>`).join('')}</div>
      <label class="f"><span>Nama folder</span><input class="inp" id="fuN" value="${esc(u.name)}" maxlength="60"></label>
      <p class="meta">Jadi: ${esc(u.main||'pilih folder utama')} › <span id="fuNp">${esc(fuSafe(u.name))}</span></p>
      <div class="btns fub"><button class="btn" data-act="fuNew" data-id="${it.id}">Buat folder sahaja</button><button class="btn solid tab" data-act="fuNewUp" data-id="${it.id}">${IC.up}Buat + upload</button></div>`:'';
  return `<h2>Masukkan footage</h2><p class="meta">${esc(it.title||'')}</p><div class="fuos">
    ${opt('air',IC.next,'AirDrop ke Mac mini','Paling laju. Di rumah, dekat Mac mini.')}
    ${opt('up',IC.up,'Upload dari iPhone','Di luar rumah. Perlu internet, lebih lambat.')}
    ${opt('pick',IC.footage,'Pilih folder dari CLAUDE EDITS','Footage dah ada di Mac mini. Pautkan sahaja.')}
    ${opt('new',IC.plus,'Buat folder baru','Dalam folder utama 21, 22, 23 dan seterusnya.')}</div>
    <div class="fubody">${body}</div>${tsVoBtn(!!it.vo,'fuVo',it.id)}<div class="btns" style="justify-content:space-between;align-items:center;margin-top:10px">${tok(0)}<button class="btn" data-act="closeModal">Tutup</button></div>`}
const fuKeep=()=>{const u=ui.fu;if(!u)return;const n=$('#fuN');if(n)u.name=n.value;const f=$('#fuF');if(f)u.sel=f.value};
A.fuOpen=el=>{const it=get('items',el.dataset.id);if((ui.fuUp||{})[it.id]){toast('Upload sedang berjalan');return}
  ui.fu={id:it.id,mode:'air',main:fuGuess(it),name:fuSafe(it.title),sel:it.folder||''};modal(fuBody(),TAB['to-shoot'].c)};
/* 2026-11-26 (Mira): "aku nak transfer files je". AirDrop dari Photos ke Mac mini; worker (mac-mini/airdrop.py) pindahkan fail yang
   sampai dalam 30 minit ke <folder utama>/<nama kad>. Mira pilih folder utama sahaja; subfolder = nama kad. 0 token. */
const airPend=()=>((S.sync.airdrop||{}).files)||[];
A.fuAir=async el=>{const it=get('items',el.dataset.id),u=ui.fu||{},take=!!el.dataset.take;let stage=(it.folder||'').split('/')[0],name=(it.folder||'').split('/').slice(1).join('/');
  if(!stage){if(!u.main){toast('Pilih folder utama dulu');return}stage=u.main}if(!name)name=fuSafe(it.title);
  const old=el.innerHTML;el.disabled=true;el.innerHTML='<i class="spin"></i>Beritahu Mac mini';
  try{const now=Date.now();await studioCall('job_add',{type:'air_wait',input:{item:it.id,stage,name,t0:now,take}});
    save('footin',{id:it.id,status:'tunggu',done:0,until:now+30*60000,at:now,air:true,folder:stage+'/'+name});
    if(take){S.sync.airdrop={files:[]}}closeModal();render();
    toast(take?'Mac mini sedang masukkan video ke folder':'Mac mini sedia. Dalam Photos: pilih video › Share › AirDrop › Mac mini');
    if(!take&&/iPhone|iPad|iPod/.test(navigator.userAgent))setTimeout(()=>{location.href='photos-redirect://'},700)}
  catch(e){el.disabled=false;el.innerHTML=old;toast('Mac mini tak jawab: '+String((e&&(e.message||e.code))||'semak internet').slice(0,70))}};
function airHome(){const f=airPend();if(!f.length)return '';const gb=f.reduce((a,x)=>a+(x.size||0),0)/1e9;
  return `<div class="card big glass" style="--c:${TAB['to-shoot'].c};margin-top:14px"><p class="eyebrow" style="margin:0">AirDrop · Mac mini</p><h3 style="margin:4px 0">${f.length} video baru sampai</h3>
    <p class="meta">${esc(f.slice(0,3).map(x=>x.name).join(', '))}${f.length>3?' dan '+(f.length-3)+' lagi':''} · ${gb>=1?gb.toFixed(1)+' GB':Math.max(1,Math.round(gb*1000))+' MB'}. Untuk kad mana?</p>
    <div class="btns" style="margin-top:8px"><button class="btn solid tab" data-act="airPick">Pilih kad</button><button class="btn" data-act="airIgnore">Bukan footage</button></div></div>`}
A.airPick=()=>{const L=byStage('toshoot');modal(`<h2>Untuk kad mana?</h2><div class="fuos">${L.map(it=>`<button type="button" class="fuo" data-act="fuOpen" data-id="${it.id}"><i>${IC.footage}</i><span><b>${esc(it.title||'Nota')}</b><small>${isJob(it)?'Job':'Creative'}${it.folder?' · '+esc(fuMainL(it.folder.split('/')[0])):''}</small></span></button>`).join('')||'<p class="meta">Tiada kad dalam Shoot. Tambah kad dulu.</p>'}</div><div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Tutup</button></div>`,TAB['to-shoot'].c)};
A.airIgnore=async()=>{const keep=S.sync.airdrop;S.sync.airdrop={files:[]};render();
  try{await studioCall('job_add',{type:'air_ignore',input:{}});toast('Okay, video tu kekal dalam Downloads Mac mini')}catch(e){S.sync.airdrop=keep;render();toast('Mac mini tak jawab')}};
A.fuMode=el=>{fuKeep();ui.fu.mode=el.dataset.id;modal(fuBody(),TAB['to-shoot'].c)};
A.fuMain=el=>{fuKeep();ui.fu.main=el.dataset.id;modal(fuBody(),TAB['to-shoot'].c)};
function fuFiles(done){const inp=document.createElement('input');inp.type='file';inp.accept='video/*';inp.multiple=true;inp.onchange=()=>{const fs=[...inp.files];if(fs.length)done(fs)};inp.click()}
A.fuPick=el=>{const it=get('items',el.dataset.id),v=($('#fuF')||{}).value||'';if(!v){toast('Pilih folder dulu');return}
  const stage=v.split('/')[0],name=v.split('/').slice(1).join('/');fuFiles(fs=>{closeModal();fuRun(it,stage,name,fs)})};
A.fuLink=el=>{const it=get('items',el.dataset.id),v=($('#fuF')||{}).value||'';if(!v){toast('Pilih folder dulu');return}
  tsVoSync(save('items',Object.assign({},it,{folder:v})),!!it.vo);closeModal();toast('Folder dipaut ke kad')};
function fuNewVals(){fuKeep();const u=ui.fu,name=fuSafe(u.name);if(!u.main){toast('Pilih folder utama dulu');return null}if(!name){toast('Tulis nama folder');return null}
  if(fuFolders().some(o=>nrm(o.v)===nrm(u.main+'/'+name))){toast('Folder ni dah ada. Guna "Pilih folder dari CLAUDE EDITS"');return null}return {stage:u.main,name}}
A.fuNew=async el=>{const it=get('items',el.dataset.id),v=fuNewVals();if(!v)return;const b=el;b.disabled=true;b.innerHTML='<i class="spin"></i>Buat folder';
  try{const r=await studioJob('mkfolder',{stage:v.stage,name:v.name},2*60000);{const c=get('items',it.id);tsVoSync(save('items',Object.assign({},c,{folder:v.stage+'/'+((r&&r.name)||v.name)})),!!c.vo)}closeModal();toast('Folder dibuat: '+fuMainL(v.stage)+' › '+((r&&r.name)||v.name))}
  catch(e){b.disabled=false;b.textContent='Buat folder sahaja';toast('Tak dapat buat folder: '+String((e&&(e.message||e.code))||'semak Mac mini hidup').slice(0,80))}};
A.fuNewUp=el=>{const it=get('items',el.dataset.id),v=fuNewVals();if(!v)return;fuFiles(fs=>{closeModal();fuRun(it,v.stage,v.name,fs)})};
/* 2026-11-26: upload TERUS iPhone -> Drive (tanpa Apps Script di tengah, tanpa base64). Apps Script `ustart` buka sesi dengan
   Origin app, jadi Drive benarkan PUT dari browser. Sekeping 32 MB dengan % hidup. Gagal = balik ke cara lama (uchunk 8 MB). */
function fuPut(url,blob,start,total,onp){return new Promise((res,rej)=>{const x=new XMLHttpRequest();x.open('PUT',url);
  x.setRequestHeader('Content-Range',blob?`bytes ${start}-${start+blob.size-1}/${total}`:`bytes */${total}`);
  if(blob&&onp)x.upload.onprogress=e=>onp(e.loaded);x.timeout=15*60000;
  x.onload=()=>{if(x.status===308){let nx=blob?start+blob.size:null;try{const r=x.getResponseHeader('Range');if(r)nx=+r.split('-')[1]+1;else if(!blob)nx=0}catch(e){}res({next:nx})}
    else if(x.status===200||x.status===201){try{res({id:JSON.parse(x.responseText).id})}catch(e){rej(new Error('Drive jawab pelik'))}}
    else rej(new Error('Drive '+x.status))};
  x.onerror=()=>rej(new Error('Sambungan putus'));x.ontimeout=()=>rej(new Error('Terlalu lama'));x.send(blob||null)})}
async function fuRun(it,stage,name,fs){const b64=blob=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=rej;r.readAsDataURL(blob)});
  const up=[];ui.fuUp=Object.assign({},ui.fuUp);wakeOn();
  try{for(let k=0;k<fs.length;k++){const f=fs[k];ui.fuUp[it.id]={i:k+1,n:fs.length,name:f.name,pct:0};render();
      const meta={name:f.name,mime:f.type||'video/mp4',size:f.size};let s=await studioCall('ustart',Object.assign({origin:location.origin},meta));
      const CH=8*1048576,DCH=32*1048576;let pos=0,id=null,tries=0,direct=!!s.direct,sent=false;
      const pct=b=>{const v=Math.min(100,Math.round(b/f.size*100));if(v!==ui.fuUp[it.id].pct){ui.fuUp[it.id].pct=v;render()}};
      while(pos<f.size&&!id){try{const r=direct?await fuPut(s.url,f.slice(pos,pos+DCH),pos,f.size,l=>pct(pos+l)):await studioCall('uchunk',{url:s.url,start:pos,total:f.size,b64:await b64(f.slice(pos,pos+CH))});
          if(r.id)id=r.id;else pos=r.next;tries=0;sent=true}
        catch(e){if(direct&&!sent){direct=false;pos=0;s=await studioCall('ustart',meta);continue}
          if(++tries>3)throw e;await new Promise(r=>setTimeout(r,2000*tries));
          if(direct){try{const q=await fuPut(s.url,null,0,f.size);if(q.id)id=q.id;else if(q.next!=null)pos=q.next}catch(_){}}}
        pct(id?f.size:pos)}
      if(!id)throw new Error('Drive tak bagi id fail');up.push({id,name:f.name})}
    await studioCall('job_add',{type:'foot_in',input:{item:it.id,stage,name,files:up}});
    toast(fs.length+' video dah upload. Mac mini sedang pindah ke folder')}
  catch(e){toast('Upload tak jadi: '+String((e&&e.message)||'semak internet').slice(0,80));if(up.length)studioCall('job_add',{type:'foot_in',input:{item:it.id,stage,name,files:up}}).catch(()=>{})}
  finally{delete ui.fuUp[it.id];if(!Object.keys(ui.fuUp).length&&!VR.on)wakeOff();render()}}

/* 2026-11-23 (Mira): butang Shot dibuang. Satu butang footage: Upload footage -> bila folder ada video jadi "Ada footage · N video"
   + butang Ke Edit (kad pindah ke tab Edit, folder dah terpaut). */
function footCount(it){if(!it.folder)return 0;const [st,...rest]=it.folder.split('/'),nm=rest.join('/');const s=(((S.sync.toedit||{}).stages)||[]).find(x=>x.name===st);const i=s&&(s.items||[]).find(x=>x.name===nm);return i?(i.clips||0):0}
function footBtn(it,compact){const n=footCount(it),busy=(ui.fuUp||{})[it.id];
  if(busy)return `<button class="btn sm st-run" disabled><i class="spin"></i>${busy.pct}%</button>`;
  if(!n)return `<button class="btn sm${compact?'':' solid tab tsgrow'}" data-act="fuOpen" data-id="${it.id}" aria-label="Upload footage">${IC.up}${compact?'':'Footage'}</button>`;
  return `<button class="btn sm st-done${compact?'':' tsgrow'}" data-act="fuOpen" data-id="${it.id}" title="Tambah lagi footage">${IC.check}${compact?n:'Footage · '+n}</button><button class="btn sm solid tab" data-act="tsToEdit" data-id="${it.id}">Ke Edit${IC.next}</button>`}
A.tsToEdit=el=>{const it=get('items',el.dataset.id);moveItem(it,'toedit',{folder:(it.folder||'').split('/')[0],shotAt:ymd(new Date())})};

/* 2026-11-25 (Mira): butang VO pada Tambah creative dan helaian Footage. Ditanda = mic bulat pada kad (merah = belum rakam,
   hijau = VO dah ada) dan kad tu masuk senarai tab VO sebagai peringatan (doc vo/<voId>, status perlu, from:'shoot').
   VO ikut folder footage kalau dah dipaut (supaya fail masuk <projek>/VO dan padan dengan mic di tab Edit); kalau belum, ikut tajuk. */
const TS_MIC=IC.mic.replace('<svg ','<svg style="width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8" ');
function tsVoRef(it){const [st,...r]=String(it.folder||'').split('/'),sub=r.join('/');return it.folder&&sub?{folder:st,sub}:{folder:'',sub:fuSafe(it.title)}}
const tsVoHas=d=>!!d&&(((d.vos||[]).some(v=>v.status==='siap'))||d.status==='siap');
function tsMic(it){if(!it.vo)return '';const ref=tsVoRef(it),d=get('vo',voId(ref.sub))||(it.voRef&&get('vo',it.voRef)),has=tsVoHas(d);
  return `<button class="micb crmic ${has?'ok':'need'}" data-act="tsVoGo" data-id="${it.id}" aria-label="${has?'VO dah ada':'Perlu rakam VO'}">${TS_MIC}</button>`}
const tsVoBtn=(on,act,id)=>`<button type="button" class="vot${on?' on':''}" data-act="${act}" data-id="${esc(id)}" aria-pressed="${on}"><i>${TS_MIC}</i><span><b>Perlu VO</b><small>${on?'Ditanda. Ada dalam tab VO sebagai peringatan.':'Tanda kalau video ni guna voiceover.'}</small></span><em>${on?IC.check:''}</em></button>`;
/* Samakan doc VO dengan kad: buat bila ditanda, pindah bila folder berubah, buang bila tanda dibuka (kalau belum ada rakaman) */
function tsVoSync(it,was){const ref=tsVoRef(it),id=voId(ref.sub);const empty=d=>!(d.vos||[]).length&&!d.take&&!(d.points||[]).length;
  if(!it.vo){if(was){[id,it.voRef].filter(Boolean).forEach(k=>{const d=get('vo',k);if(d&&d.from==='shoot'&&empty(d))del('vo',k)});if(it.voRef)save('items',Object.assign({},get('items',it.id),{voRef:''}),true)}return}
  const cur=get('vo',id),old=it.voRef&&it.voRef!==id?get('vo',it.voRef):null;
  if(cur)save('vo',Object.assign({},cur,{folder:cur.folder||ref.folder,sub:cur.sub||ref.sub,status:cur.status==='buang'?'perlu':cur.status}),true);
  else save('vo',Object.assign({points:[]},old||{},{id,folder:ref.folder,sub:ref.sub,status:(old&&old.status!=='buang'&&old.status)||'perlu',from:(old&&old.from)||'shoot',item:it.id}),true);
  if(old&&(!cur||empty(old)))del('vo',old.id);
  if(it.voRef!==id)save('items',Object.assign({},get('items',it.id),{voRef:id}),true);render()}
A.tfVo=el=>{ui.tfVo=!ui.tfVo;el.outerHTML=tsVoBtn(ui.tfVo,'tfVo','')};
A.fuVo=el=>{fuKeep();const it=get('items',el.dataset.id);const o=save('items',Object.assign({},it,{vo:!it.vo}));tsVoSync(o,!!it.vo);modal(fuBody(),TAB['to-shoot'].c);toast(o.vo?'Ditanda perlu VO. Ada dalam tab VO':'Tanda VO dibuang')};
A.tsVoGo=el=>{const it=get('items',el.dataset.id);tsVoSync(it,true);const ref=tsVoRef(it);ui.voOpen=voId(ref.sub);location.hash='#vo'};
