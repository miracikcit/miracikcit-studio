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
    <div class="tsx">${accSel(`id="ac-${it.id}" data-col="items" data-id="${it.id}" data-f="account"`,it.account||'','Akaun')}${it.sample?smpListing(it):''}${notaBtn(it,it.sample?'smpNotaBtn':'nota')}</div>
    <div class="tsm">${footBtn(it)}<button class="btn icon sm" data-act="tsEdit" data-id="${it.id}" aria-label="Edit">${IC.edit}</button><button class="btn icon sm bad" data-act="delItem" data-id="${it.id}" aria-label="Padam">${IC.trash}</button></div>${fuStatus(it)}</div>`}).join('')||`<div class="empty">Tiada job menunggu. Tambah sample, atau job dari tab Projects.</div>`}</div>`};
A.tsDate=el=>{const it=get('items',el.dataset.id);modal(`<h2>Tarikh shoot</h2><p class="meta">${esc(it.title||'')}</p><label class="f"><span>Tarikh</span><input type="date" class="inp" id="tsD" value="${esc(it.shootDate||'')}"></label><div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="tsDateSave" data-id="${it.id}">Simpan</button></div>`,TAB['to-shoot'].c)};
A.tsDateSave=el=>{const it=get('items',el.dataset.id);save('items',Object.assign({},it,{shootDate:($('#tsD')||{}).value||''}));closeModal();toast('Tarikh disimpan')};
A.toShot=el=>moveItem(get('items',el.dataset.id),'shot',{shotAt:ymd(new Date())});


/* Creative: senarai ringkas (video nak shoot, kemudian idea tersimpan) */
function creList(cre,ideas){
  const row=(it,idea)=>{const left=it.shootDate?Math.ceil((new Date(it.shootDate+'T00:00:00')-Date.now())/DAY):null;
    const meta=[idea?'Idea':it.shootDate?'Shoot '+dmy(it.shootDate)+(left!==null?(left>0?' · '+left+' hari lagi':left===0?' · hari ni':' · lewat '+(-left)+' hari'):''):'Belum ada tarikh',it.account,it.nota?'ada nota':'',noEmoji(it.details||((it.src&&it.src.text)||'')).slice(0,90)].filter(Boolean).join(' · ');
    return `<div class="crow glass"><div class="crt"><b>${esc(it.title||'Tanpa tajuk')}</b><small>${esc(meta)}</small></div><div class="crb">
      ${idea?`<button class="btn sm" data-act="tsPlan" data-id="${it.id}">Nak shoot</button>`:`${notaBtn(it,'nota')}${footBtn(it,true)}`}
      <button class="btn sm" data-act="tsEdit" data-id="${it.id}" aria-label="Edit">${IC.edit}</button><button class="btn icon sm bad" data-act="delItem" data-id="${it.id}" aria-label="Padam">${IC.trash}</button></div></div>${idea?'':fuStatus(it)}`};
  return `<p class="eyebrow">Nak shoot · ${cre.length}</p><div class="clist">${cre.map(it=>row(it,false)).join('')||'<div class="empty">Tiada video creative menunggu.</div>'}</div>
    <p class="eyebrow" style="margin-top:18px">Idea · ${ideas.length} <a href="#ideas" class="meta" style="margin-left:6px">+ idea baru</a></p><div class="clist">${ideas.map(it=>row(it,true)).join('')||'<div class="empty">Belum ada idea.</div>'}</div>`;
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
   <label class="f"><span>Folder footage (kalau dah upload di Mac mini)</span>${fuSel('tfF',it.folder||'',false,it.title)}</label>
   <label class="f"><span>Details (lokasi, props, point penting, link)</span><textarea class="inp" id="tfX" rows="5">${esc(it.details||'')}</textarea></label>
   <div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="tfSave" data-id="${esc(it.id||'')}" data-stage="${esc(it.stage||'toshoot')}">Simpan</button></div>`,TAB['to-shoot'].c);
  ui.tfKind=job?'job':'creative'}
A.tfKind=el=>{ui.tfKind=el.dataset.id;document.querySelectorAll('#modal .seg button').forEach(b=>b.classList.toggle('on',b.dataset.id===ui.tfKind));const j=$('#tfJob');if(j)j.hidden=ui.tfKind!=='job'};
A.tfSave=el=>{const id=el.dataset.id,old=id?get('items',id):{created:Date.now(),stage:el.dataset.stage||'toshoot',stageAt:{toshoot:Date.now()},src:{type:'text',text:''}};const v=s=>(($(s)||{}).value||'').trim();
  const title=v('#tfT');if(!title){toast('Tulis tajuk dulu');return}
  const pay=v('#tfP'),o=Object.assign({},old,{title,kind:ui.tfKind,shootDate:v('#tfD'),account:v('#tfA'),details:v('#tfX'),folder:v('#tfF')});
  if(ui.tfKind==='job'){o.brand=v('#tfB');o.paid=pay?(+pay||pay):(old.sample?old.paid:false)}
  if(!id)o.id='c'+Date.now().toString(36);save('items',o);closeModal();toast('Disimpan')};

/* UPLOAD FOOTAGE (2026-11-23, Mira): pilih folder dalam CLAUDE EDITS, pilih video dari phone, upload terus ke Drive
   (8 MB sekeping, bar %), Mac mini pindah ke folder tu (job foot_in) dan pautkan folder ke kad. */
function fuFolders(){return (((S.sync.toedit||{}).stages)||[]).flatMap(st=>(st.items||[]).map(i=>({v:st.name+'/'+i.name,l:st.name.replace(/^(\d+)\.\s*/,'$1 · ')+' › '+i.name})))}
function fuSel(id,val,withNew,title){const L=fuFolders();const nw=withNew?FOLDERS.map(f=>`<option value="new|${esc(f)}">＋ Folder baru dalam ${esc(f)}</option>`).join(''):'';
  return `<select class="inp" id="${id}"><option value="">${withNew?'Pilih folder':'Tiada / belum'}</option>${nw?`<optgroup label="Folder baru (nama: ${esc(title||'kad')})">${nw}</optgroup>`:''}<optgroup label="Folder sedia ada">${L.map(o=>`<option value="${esc(o.v)}"${o.v===val?' selected':''}>${esc(o.l)}</option>`).join('')}</optgroup>${val&&!L.some(o=>o.v===val)?`<option value="${esc(val)}" selected>${esc(val)}</option>`:''}</select>`}
function fuStatus(it){const u=(ui.fuUp||{})[it.id],d=get('footin',it.id);
  if(u)return `<div class="stbar" style="--c:var(--c)"><div class="stt"><span>Upload ${u.i}/${u.n}: ${esc(u.name)}</span><span>${u.pct}%</span></div><div class="stg"><i style="width:${Math.max(3,u.pct)}%"></i></div></div>`;
  if(d&&d.status==='proses'&&Date.now()-(d.at||0)<3*36e5)return `<div class="stbar" style="--c:var(--warn)"><div class="stt"><span><i class="spin"></i> Mac mini pindah ke folder (${d.done||0}/${d.n||'?'})</span><span>${d.n?Math.round((d.done||0)/d.n*100):0}%</span></div><div class="stg"><i style="width:${Math.max(3,d.n?(d.done||0)/d.n*100:5)}%"></i></div></div>`;
  if(d&&d.status==='error')return `<p class="meta" style="color:var(--bad);margin:6px 0 0">Upload footage gagal: ${esc(d.msg||'')}</p>`;
  return it.folder?`<p class="meta" style="margin:6px 0 0">📁 ${esc(it.folder.replace(/^(\d+)\.\s*/,'$1 · ').replace('/',' › '))}${d&&d.status==='sedia'&&Date.now()-(d.at||0)<864e5?` · ${d.done} video baru masuk`:''}</p>`:''}
A.fuOpen=el=>{const it=get('items',el.dataset.id);if((ui.fuUp||{})[it.id]){toast('Upload sedang berjalan');return}
  modal(`<h2>Upload footage</h2><p class="meta">${esc(it.title||'')}</p>
   <label class="f"><span>Raw footage masuk folder</span>${fuSel('fuF',it.folder||'',true,it.title)}</label>
   <p class="meta">Pilih video dari phone. Skrin tak akan tidur masa upload; jangan tutup atau tukar app sampai bar habis. Lepas tu Mac mini pindahkan sendiri.</p>
   <div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="fuPick" data-id="${it.id}">${IC.up}Pilih video</button></div>`,TAB['to-shoot'].c)};
A.fuPick=el=>{const it=get('items',el.dataset.id),v=($('#fuF')||{}).value||'';if(!v){toast('Pilih folder dulu');return}
  const [stage,name]=v.startsWith('new|')?[v.slice(4),String(it.title||'Footage').replace(/[\\/:*?"<>|]+/g,' ').trim().slice(0,60)]:[v.split('/')[0],v.split('/').slice(1).join('/')];
  const inp=document.createElement('input');inp.type='file';inp.accept='video/*';inp.multiple=true;
  inp.onchange=()=>{const fs=[...inp.files];closeModal();if(fs.length)fuRun(it,stage,name,fs)};inp.click()};
async function fuRun(it,stage,name,fs){const b64=blob=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=rej;r.readAsDataURL(blob)});
  const up=[];ui.fuUp=Object.assign({},ui.fuUp);wakeOn();
  try{for(let k=0;k<fs.length;k++){const f=fs[k];ui.fuUp[it.id]={i:k+1,n:fs.length,name:f.name,pct:0};render();
      const s=await studioCall('ustart',{name:f.name,mime:f.type||'video/mp4',size:f.size});const CH=8*1048576;let pos=0,id=null,tries=0;
      while(pos<f.size&&!id){try{const r=await studioCall('uchunk',{url:s.url,start:pos,total:f.size,b64:await b64(f.slice(pos,pos+CH))});if(r.id)id=r.id;else pos=r.next;tries=0}
        catch(e){if(++tries>3)throw e;await new Promise(r=>setTimeout(r,2000*tries))}
        ui.fuUp[it.id].pct=Math.min(100,Math.round((id?f.size:pos)/f.size*100));render()}
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
  if(!n)return `<button class="btn sm${compact?'':' solid tab tsgrow'}" data-act="fuOpen" data-id="${it.id}" aria-label="Upload footage">${IC.up}${compact?'':'Upload footage'}</button>`;
  return `<button class="btn sm st-done${compact?'':' tsgrow'}" data-act="fuOpen" data-id="${it.id}" title="Tambah lagi footage">${IC.check}${compact?n:'Ada footage · '+n+' video'}</button><button class="btn sm solid tab" data-act="tsToEdit" data-id="${it.id}">Ke Edit${IC.next}</button>`}
A.tsToEdit=el=>{const it=get('items',el.dataset.id);moveItem(it,'toedit',{folder:(it.folder||'').split('/')[0],shotAt:ymd(new Date())})};
