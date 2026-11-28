/* ---------- TO SHOOT ---------- */
/* 2026-11-23 (Mira): Shoot ada dua tab: Jobs (paid / sample) dan Creative (idea + creative nak shoot). Setiap kad ada butang Edit. */
const isJob=it=>it.kind?it.kind==='job':!!(it.sample||it.productId||it.brand||it.paid);
const jobPill=it=>it.sample?`<span class="pill" style="--pc:#5A8FB5">Sample</span>`:it.paid?`<span class="pill" style="--pc:#3E8E5A">Paid${it.paid>0&&it.paid!==true?' RM '+esc(String(it.paid)):''}</span>`:`<span class="pill" style="--pc:#999">Tanpa bayaran</span>`;
const kindSeg=(k,nj,nc,act)=>`<div class="seg" style="margin-bottom:12px"><button type="button" class="${k==='job'?'on':''}" data-act="${act}" data-id="job">Jobs · ${nj}</button><button type="button" class="${k==='creative'?'on':''}" data-act="${act}" data-id="creative">Creative · ${nc}</button></div>`;
A.shootTab=el=>{ui.shootTab=el.dataset.id;try{localStorage.setItem('ms:shootTab',ui.shootTab)}catch(e){}render(true)};
V['to-shoot']=()=>{if(!ui.shootTab){try{ui.shootTab=localStorage.getItem('ms:shootTab')||'job'}catch(e){ui.shootTab='job'}}
  const key=it=>it.sample?it.sample.postBy:String(it.shootDate||'9');const all=byStage('toshoot').sort((a,b)=>key(a).localeCompare(key(b)));
  const jobs=all.filter(isJob),cre=all.filter(it=>!isJob(it)),ideas=byStage('ideas');
  if(ui.shootTab==='creative')return head('Idea dan video creative',`<button class="btn sm solid tab" data-act="tsNew">${IC.plus}Tambah creative</button>`)+kindSeg('creative',jobs.length,cre.length+ideas.length,'shootTab')+airHome()+creList(cre,ideas);
  const list=jobs;
  return head('Paid job dan sample',`<button class="btn sm solid tab" data-act="smpAdd">${IC.plus}Tambah sample</button>`)+kindSeg('job',jobs.length,cre.length+ideas.length,'shootTab')+airHome()+`<div class="list alt">${list.map(it=>{
    const left=it.shootDate?Math.ceil((new Date(it.shootDate+'T00:00:00')-Date.now())/DAY):null;const col=left===null?'var(--muted)':left>7?'var(--ok)':left>=0?'var(--warn)':'var(--bad)';
    const badge=it.sample&&!sampleDone(it)?smpBadge(it):`<div class="smpb" style="--pc:${col}">${left!==null?`<span class="pill">${left>0?left+' hari lagi':left===0?'Hari ni':'Lewat '+(-left)+' hari'}</span>`:''}<button class="smpd" data-act="tsDate" data-id="${it.id}">${it.shootDate?'Shoot '+dmy(it.shootDate):'Set tarikh shoot'}</button></div>`;
    return `<div class="card glass tsc"><div class="rowh" style="align-items:flex-start;gap:10px"><div style="min-width:0"><h3>${esc(it.title||'Nota')} ${jobPill(it)}</h3><div class="meta">${esc([it.sample?'Sample '+smpPlat(it.sample.plat):'',it.sample&&it.sample.price?'RM '+it.sample.price:'',it.brand,it.nota?'ada nota':''].filter(Boolean).join(' · '))}</div></div>${badge}</div>
    <div class="tsx">${accSel(`id="ac-${it.id}" data-col="items" data-id="${it.id}" data-f="account"`,it.account||'','Akaun')}${it.sample?smpListing(it):''}${notaBtn(it,it.sample?'smpNotaBtn':'nota')}${sbtAddBtn(it)}${tsMic(it)}</div>${prodLine(it)}
    ${sbtBox(it)}<div class="tsm">${footBtn(it)}<button class="btn icon sm" data-act="tsEdit" data-id="${it.id}" aria-label="Edit">${IC.edit}</button><button class="btn icon sm bad" data-act="delItem" data-id="${it.id}" aria-label="Padam">${IC.trash}</button></div>${sbtOn(it)?'':fuStatus(it)}</div>`}).join('')||`<div class="empty">Tiada job menunggu. Tambah sample, atau job dari tab Projects.</div>`}</div>`};
A.tsDate=el=>{const it=get('items',el.dataset.id);modal(`<h2>Tarikh shoot</h2><p class="meta">${esc(it.title||'')}</p><label class="f"><span>Tarikh</span><input type="date" class="inp" id="tsD" value="${esc(it.shootDate||'')}"></label><div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="tsDateSave" data-id="${it.id}">Simpan</button></div>`,TAB['to-shoot'].c)};
A.tsDateSave=el=>{const it=get('items',el.dataset.id);save('items',Object.assign({},it,{shootDate:($('#tsD')||{}).value||''}));closeModal();toast('Tarikh disimpan')};


/* Creative (2026-11-25, Mira): kad "Nak shoot" sama bentuk dengan Jobs: tajuk penuh, tiada gambar listing / link produk,
   semua butang di baris bawah. Idea kekal senarai ringkas. */
function creCard(it){const left=it.shootDate?Math.ceil((new Date(it.shootDate+'T00:00:00')-Date.now())/DAY):null;const col=left===null?'#999':left>7?'var(--ok)':left>=0?'var(--warn)':'var(--bad)';
  const meta=[it.nota?'ada nota':'',noEmoji(it.details||((it.src&&it.src.text)||'')).slice(0,140)].filter(Boolean).join(' · ');
  const gb=it.media==='gambar';
  return `<div class="card glass tsc crc${it.ins?' insc':''}"><div class="crp">${it.ins?insPrio(it.ins):''}<span class="pill" style="--pc:#9A4F5D">Creative</span>${it.media?insMedia(it):''}<button class="pill crd" style="--pc:${col}" data-act="tsDate" data-id="${it.id}">${it.shootDate?'Shoot '+dmy(it.shootDate)+(left>0?' · '+left+' hari lagi':left===0?' · hari ni':' · lewat '+(-left)+' hari'):'Set tarikh shoot'}</button>${accSel(`id="ac-${it.id}" data-col="items" data-id="${it.id}" data-f="account"`,it.account||'','Akaun')}${sbtAddBtn(it)}${tsMic(it)}</div>
    <h3>${esc(it.title||'Tanpa tajuk')}</h3>${it.ins?insFacts(it)+insWhy(it):meta?`<div class="meta">${esc(meta)}</div>`:''}${gb?'':sbtOn(it)?sbtBox(it):fuStatus(it)}
    <div class="crm">${gb?`<button class="btn sm solid tab" data-act="insPhoto" data-id="${it.id}">${IC.threads}Photo Editor</button>`:footBtn(it)}${notaBtn(it,'nota')}<button class="btn icon sm" data-act="tsEdit" data-id="${it.id}" aria-label="Edit">${IC.edit}</button><button class="btn icon sm bad" data-act="delItem" data-id="${it.id}" aria-label="Padam">${IC.trash}</button></div></div>`}
function creList(cre,ideas){
  /* 28 Nov (Mira): kad Insight masuk sebagai Idea, disusun ikut keutamaan, dengan sebab + platform. Nak shoot = pindah ke Nak shoot (video dan gambar). */
  const rk=it=>it.ins?(it.ins.rank||98):999;ideas=ideas.filter(creFOk).sort((a,b)=>rk(a)-rk(b));cre=cre.filter(creFOk);
  const row=it=>{if(it.ins)return `<div class="crow glass insr"><div class="crt"><span class="insrh">${insPrio(it.ins)}${insMedia(it)}</span><b>${esc(it.title||'Tanpa tajuk')}</b>${insFacts(it)}${insWhy(it)}</div><div class="crb"><button class="btn sm" data-act="tsPlan" data-id="${it.id}">Nak shoot</button>
      <button class="btn sm" data-act="tsEdit" data-id="${it.id}" aria-label="Edit">${IC.edit}</button><button class="btn icon sm bad" data-act="delItem" data-id="${it.id}" aria-label="Padam">${IC.trash}</button></div></div>`;
    const meta=['Idea',it.account,noEmoji(it.details||((it.src&&it.src.text)||'')).slice(0,90)].filter(Boolean).join(' · ');
    return `<div class="crow glass"><div class="crt"><b>${esc(it.title||'Tanpa tajuk')}</b><small>${esc(meta)}</small></div><div class="crb"><button class="btn sm" data-act="tsPlan" data-id="${it.id}">Nak shoot</button>
      <button class="btn sm" data-act="tsEdit" data-id="${it.id}" aria-label="Edit">${IC.edit}</button><button class="btn icon sm bad" data-act="delItem" data-id="${it.id}" aria-label="Padam">${IC.trash}</button></div></div>`};
  return `${insPlanBox()}<p class="eyebrow">Nak shoot · ${cre.length}</p><div class="list alt">${cre.map(creCard).join('')||'<div class="empty">Tiada video creative menunggu.</div>'}</div>
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
function fuStatus(it){return fuStat0(it)+edExtraBar(it.folder)}
function fuStat0(it){const u=(ui.fuUp||{})[it.id],d=get('footin',it.id);
  if(u)return `<div class="stbar" style="--c:var(--c)"><div class="stt"><span>Upload ${u.i}/${u.n}: ${esc(u.name)}</span><span>${u.pct}%</span></div><div class="stg"><i style="width:${Math.max(3,u.pct)}%"></i></div></div>`;
  if(d&&d.status==='proses'&&Date.now()-(d.at||0)<3*36e5)return `<div class="stbar" style="--c:var(--warn)"><div class="stt"><span><i class="spin"></i> Mac mini pindah ke folder (${d.done||0}/${d.n||'?'})</span><span>${d.n?Math.round((d.done||0)/d.n*100):0}%</span></div><div class="stg"><i style="width:${Math.max(3,d.n?(d.done||0)/d.n*100:5)}%"></i></div></div>`;
  if(d&&d.status==='tunggu'&&Date.now()<(d.until||0)){const left=Math.max(1,Math.ceil((d.until-Date.now())/60000)),age=Date.now()-(d.at||0);
    /* 27 Nov: selagi Mac mini belum sahkan (ack), jangan nampak macam okay. 40 saat tanpa jawapan = amaran + Cuba lagi. */
    if(!d.ack&&age>40000)return `<div class="stbar" style="--c:var(--bad)"><div class="stt"><span style="color:var(--bad)">Mac mini belum terima. Jangan AirDrop dulu</span><span><button type="button" class="airx" data-act="airRetry" data-id="${it.id}">Cuba lagi</button> · <button type="button" class="airx" data-act="airCancel" data-id="${it.id}">Batal</button></span></div></div>`;
    if(!d.ack)return `<div class="stbar" style="--c:var(--warn)"><div class="stt"><span><i class="spin"></i> Beritahu Mac mini</span><span class="afr-pc" data-t0="${d.at||0}">${Math.min(95,Math.round(age/400))}%</span></div><div class="stg"><i style="width:${Math.min(95,Math.round(age/400))}%"></i></div></div>`;
    return `<div class="stbar" style="--c:var(--warn)"><div class="stt"><span><i class="spin"></i> Mac mini sedia · ${d.done?d.done+' dah masuk':'hantar AirDrop sekarang'}</span><span>baki ${left} min · <button type="button" class="airx" data-act="airCancel" data-id="${it.id}">${d.done?'Semua dah sampai':'Batal'}</button></span></div><div class="stg"><i style="width:${Math.max(3,Math.round(left/30*100))}%"></i></div></div>`+afrRec(it,d)}
  if(d&&d.air&&d.status==='sedia'&&(d.done||d.have)&&Date.now()-(d.at||0)<7*864e5)return `<div class="stbar" style="--c:var(--ok)"><div class="stt"><span>${IC.check} ${d.done?'Diterima · '+d.done+' fail':'Folder dikemas kini'}</span><span>${esc((d.folder||it.folder||'').replace(/^(\d+)\.\s*/,'$1 · ').replace('/',' › '))}</span></div></div>`+afrRec(it,d);
  if(d&&d.status==='error')return `<p class="meta" style="color:var(--bad);margin:6px 0 0">Upload footage gagal: ${esc(d.msg||'')}</p>`;
  return it.folder?`<p class="meta" style="margin:6px 0 0">📁 ${esc(it.folder.replace(/^(\d+)\.\s*/,'$1 · ').replace('/',' › '))}${d&&d.status==='sedia'&&Date.now()-(d.at||0)<864e5?` · ${d.done} video baru masuk`:''}</p>${sbtThs(d,'afr-ths')}`:''}
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
  const T=fuT(it,u);
  const body=u.mode==='air'?`${T.stage?`<p class="meta">Masuk folder ${esc(fuMainL(T.stage))} › ${esc(T.name)}</p>`:`<p class="fulab">Folder utama</p><div class="fuchips">${fuMains().map(n=>`<button type="button" class="fuchip${u.main===n?' on':''}" data-act="fuMain" data-id="${esc(n)}">${esc(fuMainL(n))}</button>`).join('')}</div>`}
      ${pn?`<div class="btns fub"><button class="btn" data-act="fuAir" data-id="${it.id}" data-take="1">${IC.check}Masukkan ${pn} video yang dah sampai</button></div>`:''}
      <div class="btns fub"><button class="btn solid tab" data-act="fuAir" data-id="${it.id}">${IC.up}Buka Photos dan AirDrop</button></div>`
    :u.mode==='up'?`<label class="f"><span>Masuk folder mana</span>${fuSel('fuF',u.sel||T.folder||'',false,it.title)}</label>
      <p class="meta">Skrin tak akan tidur masa upload; jangan tutup atau tukar app sampai bar habis.</p>
      <div class="btns fub"><button class="btn solid tab" data-act="fuPick" data-id="${it.id}">${IC.up}Pilih video</button></div>`
    :u.mode==='pick'?`<label class="f"><span>Folder dalam CLAUDE EDITS</span>${fuSel('fuF',u.sel||T.folder||'',false,it.title)}</label>
      <p class="meta">Footage dah ada di Mac mini. Kad dipautkan ke folder tu, tiada upload.</p>
      <div class="btns fub"><button class="btn solid tab" data-act="fuLink" data-id="${it.id}">${IC.check}Paut folder ni</button></div>`
    :u.mode==='new'?`<p class="fulab">Folder utama</p><div class="fuchips">${fuMains().map(n=>`<button type="button" class="fuchip${u.main===n?' on':''}" data-act="fuMain" data-id="${esc(n)}">${esc(fuMainL(n))}</button>`).join('')}</div>
      <label class="f"><span>Nama folder</span><input class="inp" id="fuN" value="${esc(u.name)}" maxlength="60"></label>
      <p class="meta">Jadi: ${esc(u.main||'pilih folder utama')} › <span id="fuNp">${esc(fuSafe(u.name))}</span></p>
      <div class="btns fub"><button class="btn" data-act="fuNew" data-id="${it.id}">Buat folder sahaja</button><button class="btn solid tab" data-act="fuNewUp" data-id="${it.id}">${IC.up}Buat + upload</button></div>`:'';
  return `<h2>Masukkan footage</h2><p class="meta">${esc(it.title||'')}</p>${sbtChips(it,u)}<div class="fuos">
    ${opt('air',IC.next,'AirDrop ke Mac mini','Paling laju. Di rumah, dekat Mac mini.')}
    ${opt('up',IC.up,'Upload dari iPhone','Di luar rumah. Terus ke Drive, perlu internet.')}
    ${opt('pick',IC.footage,'Pilih folder dari CLAUDE EDITS','Footage dah ada di Mac mini. Pautkan sahaja.')}
    ${opt('new',IC.plus,'Buat folder baru','Dalam folder utama 21, 22, 23 dan seterusnya.')}</div>
    <div class="fubody">${body}</div>${tsVoBtn(!!it.vo,'fuVo',it.id)}<div class="btns" style="justify-content:space-between;align-items:center;margin-top:10px">${tok(0)}<button class="btn" data-act="closeModal">Tutup</button></div>`}
const fuKeep=()=>{const u=ui.fu;if(!u)return;const n=$('#fuN');if(n)u.name=n.value;const f=$('#fuF');if(f)u.sel=f.value};
A.fuOpen=el=>{const it=get('items',el.dataset.id);if((ui.fuUp||{})[it.id]){toast('Upload sedang berjalan');return}
  ui.fu={id:it.id,mode:'air',main:fuGuess(it),name:fuSafe(it.title),sel:it.folder||'',b:''};if(sbtOn(it))sbtPick(it,el.dataset.b||sbtNext(it));modal(fuBody(),TAB['to-shoot'].c)};
/* 2026-11-26 (Mira): "aku nak transfer files je". AirDrop dari Photos ke Mac mini; worker (mac-mini/airdrop.py) pindahkan fail yang
   sampai dalam 30 minit ke <folder utama>/<nama kad>. Mira pilih folder utama sahaja; subfolder = nama kad. 0 token. */
const airPend=()=>((S.sync.airdrop||{}).files)||[];
A.fuAir=async el=>{const it0=get('items',el.dataset.id),u=ui.fu||{},take=!!el.dataset.take,T=fuT(it0,u);let stage=T.stage,name=T.name;
  if(!stage){if(!u.main){toast('Pilih folder utama dulu');return}stage=u.main}
  const it={id:T.id};const busy=airBusy(it.id);if(busy){const bt=(get('items',busy.id)||{}).title||'kad lain';toast('"'+String(bt).slice(0,40)+'" masih menunggu AirDrop. Tunggu sampai Diterima, atau tekan Batal pada kad tu dulu');return}
  const old=el.innerHTML;el.disabled=true;el.innerHTML='<i class="spin"></i>Beritahu Mac mini';
  try{const now=Date.now();await studioCall('job_add',{type:'air_wait',input:{item:it.id,stage,name,t0:now,take}});
    save('footin',{id:it.id,status:'tunggu',done:0,until:now+30*60000,at:now,air:true,ack:0,folder:stage+'/'+name});sbtSet(it0,T.k,stage+'/'+name);
    if(take){S.sync.airdrop={files:[]}}closeModal();render();
    toast(take?'Mac mini sedang masukkan video ke folder':'Tunggu kad tunjuk "Mac mini sedia", kemudian AirDrop. Jangan tutup kad sampai semua video sampai');
    if(!take&&/iPhone|iPad|iPod/.test(navigator.userAgent))setTimeout(()=>{location.href='photos-redirect://'},700)}
  catch(e){el.disabled=false;el.innerHTML=old;toast('Mac mini tak jawab: '+String((e&&(e.message||e.code))||'semak internet').slice(0,70))}};
/* 27 Nov (Mira: "aku tak nak mix up footage"): resit setiap kad. Gambar kecil video yang baru masuk (d.list), bilangan sebenar dalam
   folder (d.have), yang ditambah terus dalam Finder (d.manual), yang hilang (d.gone), dan Salah kad = pindah ke kad lain (job air_wait {move}). */
function afrRec(it,d){const L=d.list||[],man=d.manual||[],gone=d.gone||[];if(!L.length&&!man.length&&!gone.length&&d.have==null)return '';
  return `<div class="afr-rec">${L.length?`<div class="afr-ths">${L.map(x=>x.th?`<img src="data:image/jpeg;base64,${x.th}" alt="${esc(x.n)}" title="${esc(x.n)}">`:`<i title="${esc(x.n)}">${esc(String(x.n).replace(/\.[^.]+$/,'').slice(-4))}</i>`).join('')}</div>`:''}
    <p class="meta">${d.have!=null?`<b>${d.have} video dalam folder</b>`:''}${man.length?` · ${man.length} ditambah terus dalam folder`:''}${gone.length?` · <span style="color:var(--bad)">${gone.length} hilang: ${esc(gone.slice(-3).join(', '))}</span>`:''}</p>
    ${L.length&&d.status!=='tunggu'?`<div class="btns"><button class="btn sm" data-act="afrWrong" data-id="${it.id}">Salah kad? Pindah</button></div>`:''}</div>`}
const afrCards=()=>byStage('toshoot').concat(byStage('toedit'));
const afrDest=it=>{let stage=(it.folder||'').split('/')[0],name=(it.folder||'').split('/').slice(1).join('/');if(!stage)stage=fuGuess(it);if(!name)name=fuSafe(it.title);return {item:it.id,stage,name}};
A.afrWrong=el=>{const id=el.dataset.id,d=get('footin',id);if(!d||!(d.list||[]).length)return;ui.afr={id,sel:(d.list||[]).map(x=>x.n)};
  modal(`<h2>Pindah ke kad mana?</h2><p class="meta">${ui.afr.sel.length} video yang baru masuk akan dipindah. Video lain kekal.</p><div class="fuos">${afrCards().filter(x=>x.id!==id).map(x=>`<button type="button" class="fuo" data-act="afrMove" data-id="${x.id}"><i>${IC.footage}</i><span><b>${esc(x.title||'Nota')}</b><small>${esc(fuMainL(afrDest(x).stage))}</small></span></button>`).join('')||'<p class="meta">Tiada kad lain.</p>'}</div><div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Tutup</button></div>`,TAB['to-shoot'].c)};
A.afrMove=async el=>{const a=ui.afr,to=get('items',el.dataset.id);if(!a||!to)return;const dst=afrDest(to);if(!dst.stage){toast('Kad tu belum ada folder utama');return}
  el.disabled=true;el.querySelector('i').innerHTML='<i class="spin"></i>';
  try{await studioCall('job_add',{type:'air_wait',input:{move:1,item:a.id,files:a.sel,to:dst}});closeModal();toast('Mac mini sedang pindahkan '+a.sel.length+' video ke "'+String(to.title||'').slice(0,30)+'"')}
  catch(e){el.disabled=false;toast('Mac mini tak jawab')}};
A.airRetry=async el=>{const d=get('footin',el.dataset.id);if(!d||!d.folder)return;const [stage,...r]=d.folder.split('/'),name=r.join('/');el.disabled=true;el.innerHTML='<i class="spin"></i>';
  try{const now=Date.now();await studioCall('job_add',{type:'air_wait',input:{item:d.id,stage,name,t0:now}});save('footin',Object.assign({},d,{at:now,until:now+30*60000,ack:0}));render();toast('Dihantar semula. Tunggu "Mac mini sedia" sebelum AirDrop')}
  catch(e){render();toast('Tak sampai. Semak internet phone')}};
/* Video sampai tanpa kad, kad terakhir dicadang: satu ketik masukkan ke kad tu (Mac mini tak pindah sendiri). */
A.airLast=async el=>{const l=(S.sync.airdrop||{}).last;if(!l)return;el.disabled=true;el.innerHTML='<i class="spin"></i>Beritahu Mac mini';
  try{const now=Date.now();await studioCall('job_add',{type:'air_wait',input:{item:l.item,stage:l.stage,name:l.name,t0:now,take:true}});
    save('footin',Object.assign({},get('footin',l.item)||{id:l.item},{status:'tunggu',until:now+30*60000,at:now,air:true,ack:0,folder:l.stage+'/'+l.name}));S.sync.airdrop={files:[]};render();toast('Mac mini sedang masukkan video ke "'+String(l.name).slice(0,30)+'"')}
  catch(e){render();toast('Mac mini tak jawab')}};
setInterval(()=>{let stale=false;document.querySelectorAll('.afr-pc').forEach(s=>{const age=Date.now()-(+s.dataset.t0||0);if(age>40000)stale=true;else{const p=Math.min(95,Math.round(age/400));s.textContent=p+'%';const b=s.closest('.stbar').querySelector('.stg i');if(b)b.style.width=p+'%'}});if(stale&&typeof render==='function')render()},2000);
/* 26 Nov petang (Mira): SATU kad sahaja boleh menunggu AirDrop pada satu masa (elak footage tercampur folder). Kad lain dikunci
   sampai kad tu Diterima (Mac mini tutup sendiri 30 saat selepas fail terakhir masuk) atau Mira tekan Batal / Selesai. */
function airBusy(except){return S.footin.find(d=>d.air&&d.status==='tunggu'&&Date.now()<(d.until||0)&&d.id!==except)}
A.airCancel=async el=>{const d=get('footin',el.dataset.id);if(!d)return;el.disabled=true;el.innerHTML='<i class="spin"></i>';
  try{await studioCall('job_add',{type:'air_wait',input:{item:d.id,cancel:true}});save('footin',Object.assign({},d,{status:d.done?'sedia':'batal',at:Date.now()}));render();toast(d.done?'Diterima · '+d.done+' fail':'AirDrop dibatalkan')}
  catch(e){render();toast('Mac mini tak jawab')}};
/* 26 Nov (Mira, cadangan A): footage tambahan selepas projek dah ada dalam Editor. Mac mini catat dalam sync/edextra bila video
   AirDrop masuk folder yang dah ada projek Editor belum final; di sini tanda "+N footage baru" + butang Masukkan ke projek
   (job air_wait {extra:kunci} -> edfoot._add: klip masuk Klip simpanan, edit sedia ada kekal). */
const edExtra=folder=>folder?Object.entries((S.sync.edextra||{}).items||{}).filter(([k,e])=>e&&e.folder===folder&&(e.files||[]).length).map(([k,e])=>Object.assign({k},e)):[];
const edxRun=e=>e.status==='proses'&&Date.now()-(e.t0||0)<30*6e4;
const edxPct=e=>Math.max(1,Math.min(95,Math.round((Date.now()-(e.t0||0))/(Math.max(1,e.n||e.files.length)*25000+15000)*100)));
function edExtraBar(folder){return edExtra(folder).map(e=>{const n=e.files.length,t=esc(String(e.title||'projek Editor').slice(0,48));
  if(edxRun(e))return `<div class="stbar edxb" style="--c:var(--warn)"><div class="stt"><span><i class="spin"></i> Masukkan ${n} footage ke ${t}</span><span class="edxp" data-t0="${e.t0||0}" data-n="${e.n||n}">${edxPct(e)}%</span></div><div class="stg"><i style="width:${edxPct(e)}%"></i></div></div>`;
  return `<div class="edxb"><p class="meta"><b>+${n} footage baru</b> untuk ${t}${e.status==='error'?` · <span style="color:var(--bad)">tak jadi: ${esc(String(e.msg||'').slice(0,70))}</span>`:''}</p>
    <div class="btns"><button class="btn sm solid tab" data-act="edExtraGo" data-id="${esc(e.k)}">${IC.plus}${e.status==='error'?'Cuba lagi':'Masukkan ke projek'}</button><button class="btn sm" data-act="edExtraNo" data-id="${esc(e.k)}">Tak perlu</button></div></div>`}).join('')}
A.edExtraGo=async el=>{const k=el.dataset.id,x=(S.sync.edextra||{}).items||{},e=x[k];if(!e)return;el.disabled=true;el.innerHTML='<i class="spin"></i>1%';
  try{await studioCall('job_add',{type:'air_wait',input:{extra:k}});x[k]=Object.assign({},e,{status:'proses',t0:Date.now(),n:e.files.length});render();toast('Mac mini sedang masukkan footage. Buka semula projek dalam Editor bila siap')}
  catch(err){render();toast('Mac mini tak jawab')}};
A.edExtraNo=async el=>{const k=el.dataset.id,x=(S.sync.edextra||{}).items||{},keep=x[k];if(!keep)return;delete x[k];render();
  try{await studioCall('job_add',{type:'air_wait',input:{extra:k,drop:true}});toast('Okay, footage kekal dalam folder sahaja')}catch(err){x[k]=keep;render();toast('Mac mini tak jawab')}};
setInterval(()=>document.querySelectorAll('.edxp').forEach(s=>{const p=edxPct({t0:+s.dataset.t0,n:+s.dataset.n,files:[]});s.textContent=p+'%';const b=s.closest('.stbar').querySelector('.stg i');if(b)b.style.width=p+'%'}),3000);
/* Baris tab Edit: butang AirDrop footage tambahan terus ke folder tu (kad dah keluar dari Shoot) */
const airRowId=(stage,name)=>((S.items.find(it=>it.folder===stage+'/'+name)||{}).id)||('fx-'+nrm(stage+' '+name).replace(/[^a-z0-9]+/g,'-').slice(0,40));
function airRowStatus(r){if(!r.stage||!r.name)return '';const id=airRowId(r.stage,r.name),d=get('footin',id),it={id,folder:''};
  return ((d&&d.air&&(d.status==='tunggu'||d.status==='sedia'))?fuStat0(it):'')+edExtraBar(r.stage+'/'+r.name)}
A.airMore=async el=>{const stage=el.dataset.x,name=el.dataset.n,id=airRowId(stage,name);
  const busy=airBusy(id);if(busy){const bt=(get('items',busy.id)||{}).title||busy.folder||'kad lain';toast('"'+String(bt).slice(0,40)+'" masih menunggu AirDrop. Tunggu sampai Diterima, atau tekan Batal dulu');return}
  const old=el.innerHTML;el.disabled=true;el.innerHTML='<i class="spin"></i>';
  try{const now=Date.now();await studioCall('job_add',{type:'air_wait',input:{item:id,stage,name,t0:now}});
    save('footin',{id,status:'tunggu',done:0,until:now+30*60000,at:now,air:true,ack:0,folder:stage+'/'+name});render();
    toast('Mac mini sedia. Dalam Photos: pilih video › Share › AirDrop › Mac mini');
    if(/iPhone|iPad|iPod/.test(navigator.userAgent))setTimeout(()=>{location.href='photos-redirect://'},700)}
  catch(e){el.disabled=false;el.innerHTML=old;toast('Mac mini tak jawab: '+String((e&&(e.message||e.code))||'semak internet').slice(0,70))}};
function airHome(){const f=airPend();if(!f.length)return '';const gb=f.reduce((a,x)=>a+(x.size||0),0)/1e9,l=(S.sync.airdrop||{}).last;
  return `<div class="card big glass afr-pend" style="--c:${TAB['to-shoot'].c};margin:14px 0"><p class="eyebrow" style="margin:0">AirDrop · belum masuk mana-mana folder</p><h3 style="margin:4px 0">${f.length} video sampai tanpa kad</h3>
    ${f.some(x=>x.th)?`<div class="afr-ths">${f.slice(0,8).map(x=>x.th?`<img src="data:image/jpeg;base64,${x.th}" alt="${esc(x.name)}" title="${esc(x.name)}">`:'').join('')}</div>`:''}
    <p class="meta">${esc(f.slice(0,3).map(x=>x.name).join(', '))}${f.length>3?' dan '+(f.length-3)+' lagi':''} · ${gb>=1?gb.toFixed(1)+' GB':Math.max(1,Math.round(gb*1000))+' MB'}. Untuk kad mana?</p>
    <div class="btns" style="margin-top:8px">${l?`<button class="btn solid tab" data-act="airLast">${IC.check}Masukkan ke ${esc(String(l.name).slice(0,16))}</button>`:''}<button class="btn${l?'':' solid tab'}" data-act="airPick">${l?'Kad lain':'Pilih kad'}</button><button class="btn" data-act="airIgnore">Bukan footage</button></div></div>`}
A.airPick=()=>{const L=afrCards();modal(`<h2>Untuk kad mana?</h2><div class="fuos">${L.map(it=>`<button type="button" class="fuo" data-act="fuOpen" data-id="${it.id}"><i>${IC.footage}</i><span><b>${esc(it.title||'Nota')}</b><small>${it.stage==='toedit'?'Edit':isJob(it)?'Job':'Creative'}${it.folder?' · '+esc(fuMainL(it.folder.split('/')[0])):''}</small></span></button>`).join('')||'<p class="meta">Tiada kad dalam Shoot atau Edit. Tambah kad dulu.</p>'}</div><div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Tutup</button></div>`,TAB['to-shoot'].c)};
A.airIgnore=async()=>{const keep=S.sync.airdrop;S.sync.airdrop={files:[]};render();
  try{await studioCall('job_add',{type:'air_ignore',input:{}});toast('Okay, video tu kekal dalam Downloads Mac mini')}catch(e){S.sync.airdrop=keep;render();toast('Mac mini tak jawab')}};
A.fuMode=el=>{fuKeep();ui.fu.mode=el.dataset.id;modal(fuBody(),TAB['to-shoot'].c)};
A.fuMain=el=>{fuKeep();ui.fu.main=el.dataset.id;modal(fuBody(),TAB['to-shoot'].c)};
function fuFiles(done){const inp=document.createElement('input');inp.type='file';inp.accept='video/*';inp.multiple=true;inp.onchange=()=>{const fs=[...inp.files];if(fs.length)done(fs)};inp.click()}
A.fuPick=el=>{const it=get('items',el.dataset.id),v=($('#fuF')||{}).value||'';if(!v){toast('Pilih folder dulu');return}
  const stage=v.split('/')[0],name=v.split('/').slice(1).join('/');const T=fuT(it,ui.fu);fuFiles(fs=>{closeModal();sbtSet(it,T.k,v);fuRun({id:T.id},stage,name,fs)})};
A.fuLink=el=>{const it=get('items',el.dataset.id),v=($('#fuF')||{}).value||'';if(!v){toast('Pilih folder dulu');return}
  const T=fuT(it,ui.fu);if(T.k!=='1'){sbtSet(it,T.k,v);closeModal();toast('Folder dipaut ke '+sbtLab(T.k));return}
  tsVoSync(save('items',Object.assign({},it,{folder:v})),!!it.vo);closeModal();toast('Folder dipaut ke kad')};
function fuNewVals(){fuKeep();const u=ui.fu,name=fuSafe(u.name);if(!u.main){toast('Pilih folder utama dulu');return null}if(!name){toast('Tulis nama folder');return null}
  if(fuFolders().some(o=>nrm(o.v)===nrm(u.main+'/'+name))){toast('Folder ni dah ada. Guna "Pilih folder dari CLAUDE EDITS"');return null}return {stage:u.main,name}}
A.fuNew=async el=>{const it=get('items',el.dataset.id),v=fuNewVals();if(!v)return;const b=el;b.disabled=true;b.innerHTML='<i class="spin"></i>Buat folder';
  try{const r=await studioJob('mkfolder',{stage:v.stage,name:v.name},2*60000);{const c=get('items',it.id),T=fuT(c,ui.fu),nf=v.stage+'/'+((r&&r.name)||v.name);if(T.k!=='1')sbtSet(c,T.k,nf);else tsVoSync(save('items',Object.assign({},c,{folder:nf})),!!c.vo)}closeModal();toast('Folder dibuat: '+fuMainL(v.stage)+' › '+((r&&r.name)||v.name))}
  catch(e){b.disabled=false;b.textContent='Buat folder sahaja';toast('Tak dapat buat folder: '+String((e&&(e.message||e.code))||'semak Mac mini hidup').slice(0,80))}};
A.fuNewUp=el=>{const it=get('items',el.dataset.id),v=fuNewVals();if(!v)return;const T=fuT(it,ui.fu);fuFiles(fs=>{closeModal();sbtSet(it,T.k,v.stage+'/'+v.name);fuRun({id:T.id},v.stage,v.name,fs)})};
/* 2026-11-26: upload TERUS iPhone -> Drive (tanpa Apps Script di tengah, tanpa base64). Apps Script `ustart` buka sesi dengan
   Origin app, jadi Drive benarkan PUT dari browser. Sekeping 32 MB dengan % hidup. Cara lama (uchunk 8 MB) dibuang dari sini 26 Nov (Mira); gagal = sambung dari bait terakhir, 3 cubaan. */
function fuPut(url,blob,start,total,onp){return new Promise((res,rej)=>{const x=new XMLHttpRequest();x.open('PUT',url);
  x.setRequestHeader('Content-Range',blob?`bytes ${start}-${start+blob.size-1}/${total}`:`bytes */${total}`);
  if(blob&&onp)x.upload.onprogress=e=>onp(e.loaded);x.timeout=15*60000;
  x.onload=()=>{if(x.status===308){let nx=blob?start+blob.size:null;try{const r=x.getResponseHeader('Range');if(r)nx=+r.split('-')[1]+1;else if(!blob)nx=0}catch(e){}res({next:nx})}
    else if(x.status===200||x.status===201){try{res({id:JSON.parse(x.responseText).id})}catch(e){rej(new Error('Drive jawab pelik'))}}
    else rej(new Error('Drive '+x.status))};
  x.onerror=()=>rej(new Error('Sambungan putus'));x.ontimeout=()=>rej(new Error('Terlalu lama'));x.send(blob||null)})}
async function fuRun(it,stage,name,fs){
  const up=[];ui.fuUp=Object.assign({},ui.fuUp);wakeOn();
  try{for(let k=0;k<fs.length;k++){const f=fs[k];ui.fuUp[it.id]={i:k+1,n:fs.length,name:f.name,pct:0};render();
      const s=await studioCall('ustart',{origin:location.origin,name:f.name,mime:f.type||'video/mp4',size:f.size});
      if(!s.direct)throw new Error('Drive tak benarkan upload terus');
      const DCH=32*1048576;let pos=0,id=null,tries=0;
      const pct=b=>{const v=Math.min(100,Math.round(b/f.size*100));if(v!==ui.fuUp[it.id].pct){ui.fuUp[it.id].pct=v;render()}};
      while(pos<f.size&&!id){try{const r=await fuPut(s.url,f.slice(pos,pos+DCH),pos,f.size,l=>pct(pos+l));
          if(r.id)id=r.id;else pos=r.next;tries=0}
        catch(e){if(++tries>3)throw e;await new Promise(r=>setTimeout(r,2000*tries));
          try{const q=await fuPut(s.url,null,0,f.size);if(q.id)id=q.id;else if(q.next!=null)pos=q.next}catch(_){}}
        pct(id?f.size:pos)}
      if(!id)throw new Error('Drive tak bagi id fail');up.push({id,name:f.name})}
    await studioCall('job_add',{type:'foot_in',input:{item:it.id,stage,name,files:up}});
    toast(fs.length+' video dah upload. Mac mini sedang pindah ke folder')}
  catch(e){toast('Upload tak jadi: '+String((e&&e.message)||'semak internet').slice(0,80));if(up.length)studioCall('job_add',{type:'foot_in',input:{item:it.id,stage,name,files:up}}).catch(()=>{})}
  finally{delete ui.fuUp[it.id];if(!Object.keys(ui.fuUp).length&&!VR.on)wakeOff();render()}}

/* 2026-11-23 (Mira): butang Shot dibuang. Satu butang footage: Upload footage -> bila folder ada video jadi "Ada footage · N video"
   + butang Ke Edit (kad pindah ke tab Edit, folder dah terpaut). */
const footCount=it=>footCountF(it.folder);
function footCountF(folder){if(!folder)return 0;const [st,...rest]=String(folder).split('/'),nm=rest.join('/');const s=(((S.sync.toedit||{}).stages)||[]).find(x=>x.name===st);const i=s&&(s.items||[]).find(x=>x.name===nm);return i?(i.clips||0):0}
function footBtn(it,compact){if(sbtOn(it))return sbtList(it).every(b=>footCountF(b.folder)>0)?`<button class="btn sm solid tab tsgrow" data-act="tsToEdit" data-id="${it.id}">Ke Edit${IC.next}</button>`:'<span class="sbt-sp"></span>';
  const n=footCount(it),busy=(ui.fuUp||{})[it.id];
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

/* ---------- BATCH (27 Nov 2026, Mira; lakaran https://claude.ai/artifact/PbbXqW3aoztTPs2p5cX7Wi) ----------
   Satu kad Shoot boleh ada beberapa batch shoot. Kad KEKAL dalam Shoot sampai semua batch ada footage (baru keluar butang Ke Edit).
   Satu deadline untuk semua batch. Data pada kad: it.batches [{n, folder}] (batch 1 = it.folder), it.shareF (folder "Semua batch").
   Setiap batch = folder sendiri di sebelah folder asal: "<nama>", "<nama> Batch 2", "<nama> Kongsi". Jadi tab Edit tunjuk satu kad
   setiap batch dengan EDIT NOW sendiri, tanpa ubah worker. Resit AirDrop setiap batch: doc footin/<id kad>-b<n> (kongsi: -bk).
   Footage dikongsi: Edit Style tambah nota supaya sesi Claude boleh guna folder batch lain + Kongsi (sbtInfo, gaya.js esGo). */
const sbtOn=it=>!!it&&Array.isArray(it.batches)&&it.batches.length>0;
const sbtList=it=>sbtOn(it)?it.batches.map(b=>b.n===1?{n:1,folder:it.folder&&it.folder.includes('/')?it.folder:(b.folder||'')}:b):[];
const sbtId=(it,k)=>String(k)==='1'?it.id:it.id+'-b'+k;
const sbtFolder=(it,k)=>k==='k'?(it.shareF||''):((sbtList(it).find(b=>String(b.n)===String(k))||{}).folder||'');
const sbtLab=k=>k==='k'?'Semua batch':'Batch '+k;
function sbtBase(it){const f=sbtFolder(it,1);return {stage:f?f.split('/')[0]:((it.folder||'').split('/')[0]||''),name:f?f.split('/').slice(1).join('/'):fuSafe(it.title)}}
const sbtName=(it,k)=>String(k)==='1'?sbtBase(it).name:sbtBase(it).name.slice(0,50).trim()+(k==='k'?' Kongsi':' Batch '+k);
function fuT(it,u){const k=sbtOn(it)?String((u&&u.b)||'1'):'1';const f=k==='1'?(it.folder&&it.folder.includes('/')?it.folder:''):sbtFolder(it,k);const b=sbtBase(it);
  return {k,id:sbtId(it,k),folder:f,stage:f?f.split('/')[0]:b.stage,name:f?f.split('/').slice(1).join('/'):sbtName(it,k)}}
function sbtSet(it0,k,folder){k=String(k);if(k==='1')return;const it=get('items',it0.id);if(!it||!sbtOn(it))return;
  save('items',Object.assign({},it,k==='k'?{shareF:folder}:{batches:it.batches.map(b=>String(b.n)===k?Object.assign({},b,{folder}):b)}))}
const sbtNext=it=>{const b=sbtList(it).find(b=>!footCountF(b.folder));return String(b?b.n:sbtList(it)[0].n)};
function sbtPick(it,k){const u=ui.fu;u.b=String(k);const T=fuT(it,u);u.sel=T.folder;u.name=T.name}
const sbtThs=(d,cls)=>d&&(d.list||[]).some(x=>x.th)?`<div class="${cls}">${d.list.filter(x=>x.th).slice(-8).map(x=>`<img src="data:image/jpeg;base64,${x.th}" alt="${esc(x.n)}" title="${esc(x.n)}">`).join('')}</div>`:'';
const sbtAddBtn=it=>sbtOn(it)?'':`<button class="btn sm" data-act="sbtAdd" data-id="${it.id}" aria-label="Tambah batch">${IC.plus}Batch</button>`;
function sbtBox(it){if(!sbtOn(it))return '';const L=sbtList(it),has=L.filter(b=>footCountF(b.folder)>0).length;
  const row=(k,folder)=>{const n=footCountF(folder),id=sbtId(it,k),d=get('footin',id),nm=folder?folder.split('/').slice(1).join('/'):'';const e=n&&typeof edFor==='function'?edFor(folder,nm):null;
    const vids=e&&typeof edMulti==='function'&&edMulti(e)?' · '+edFinN(e)+'/'+edTot(e)+' video':'';const busy=(ui.fuUp||{})[id];
    const pill=k==='k'?'':n?(e?`<span class="pill" style="--pc:var(--ok)">Di Edit</span>`:`<span class="pill" style="--pc:var(--warn)">Ada footage</span>`):`<span class="pill" style="--pc:#999">Belum shoot</span>`;
    const st=d&&(busy||d.status==='tunggu'||d.status==='proses'||d.status==='error'||(d.status==='sedia'&&Date.now()-(d.at||0)<864e5))?fuStat0({id,folder:''}):sbtThs(d,'sbt-ths');
    return `<div class="sbt-row${n?'':' todo'}"><div class="sbt-h"><div class="sbt-t"><b>${sbtLab(k)}</b><small>${n?n+' klip'+vids:k==='k'?'Footage kongsi':'Belum ada footage'}</small></div>${pill}
      <button class="btn sm${n?'':' solid tab'}" data-act="fuOpen" data-id="${it.id}" data-b="${k}" aria-label="Footage ${sbtLab(k)}"${busy?' disabled':''}>${busy?'<i class="spin"></i>'+busy.pct+'%':IC.up}</button>
      ${!n&&!folder&&k!=='k'&&k!==1&&k===L[L.length-1].n?`<button class="btn icon sm bad" data-act="sbtDel" data-id="${it.id}" data-b="${k}" aria-label="Buang ${sbtLab(k)}">${IC.trash}</button>`:''}</div>${st}</div>`};
  return `<div class="sbt-box"><div class="sbt-sum"><span class="pill" style="--pc:${has===L.length?'var(--ok)':'var(--warn)'}">${has}/${L.length} batch ada footage</span><div class="sbt-bar"><i style="width:${Math.round(has/L.length*100)}%"></i></div></div>
    ${L.map(b=>row(b.n,b.folder)).join('')}${it.shareF?row('k',it.shareF):''}<button type="button" class="sbt-add" data-act="sbtAdd" data-id="${it.id}">${IC.plus}Batch</button></div>`}
A.sbtAdd=el=>{const it=get('items',el.dataset.id);if(!it)return;const L=sbtOn(it)?it.batches:[{n:1,folder:it.folder&&it.folder.includes('/')?it.folder:''}];const n=Math.max(...L.map(b=>b.n))+1;
  save('items',Object.assign({},it,{batches:L.concat({n,folder:''})}));toast(sbtOn(it)?'Batch '+n+' ditambah':'Kad ni kini ada Batch 1 dan Batch 2');return n};
A.sbtDel=el=>{const it=get('items',el.dataset.id),k=+el.dataset.b;if(!it||!sbtOn(it))return;const L=it.batches.filter(b=>b.n!==k);const o=Object.assign({},it,{batches:L});if(L.length<2&&!it.shareF)delete o.batches;save('items',o);toast('Batch '+k+' dibuang')};
/* Pilihan batch dalam helaian Masukkan footage */
function sbtChips(it,u){if(!sbtOn(it))return '';const c=(k,l)=>`<button type="button" class="fuchip${String(u.b)===String(k)?' on':''}" data-act="fuBatch" data-id="${k}">${l}</button>`;
  return `<p class="fulab">Footage ni untuk batch mana?</p><div class="fuchips">${sbtList(it).map(b=>{const n=footCountF(b.folder);return c(b.n,'Batch '+b.n+(n?' · '+n:''))}).join('')}${c('k','Semua batch')}${c('new',IC.plus+'Batch baru')}</div>`}
A.fuBatch=el=>{fuKeep();let k=el.dataset.id;const u=ui.fu;if(k==='new')k=A.sbtAdd({dataset:{id:u.id}});sbtPick(get('items',u.id),k);modal(fuBody(),TAB['to-shoot'].c)};
/* Untuk tab Edit: folder Kongsi tak jadi kad sendiri; folder batch tahu adik-beradiknya */
const sbtShares=()=>new Set(S.items.filter(it=>it.shareF).map(it=>it.shareF));
function sbtInfo(key){for(const it of S.items){if(!sbtOn(it))continue;const L=sbtList(it),b=L.find(x=>x.folder&&x.folder===key);if(!b)continue;
    return {n:b.n,total:L.length,others:L.filter(x=>x.n!==b.n&&x.folder&&footCountF(x.folder)>0).map(x=>x.folder),share:it.shareF&&footCountF(it.shareF)>0?it.shareF:''}}return null}
function sbtNote(key){const i=sbtInfo(key);if(!i)return '';const nm=f=>'"'+f.split('/').slice(1).join('/')+'"';const ex=i.others.concat(i.share?[i.share]:[]);
  return 'BATCH: projek ni ada '+i.total+' batch footage. Sesi ni untuk Batch '+i.n+' (folder '+nm(key)+'). Footage utama dari folder ni.'+(ex.length?' Footage dalam folder '+ex.map(nm).join(', ')+' (folder utama yang sama) BOLEH digunakan juga.':'')+' Opening dan ending mesti lain dari video batch lain.'}
