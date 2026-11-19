/* ---------- SAMPLE: barang review dengan deadline ----------
   TikTok: tarikh akhir post = hari ni + "N days left".
   Shopee: tekan Received sebelum tarikh dalam app Shopee; tarikh akhir post = tarikh Received + 14 hari.
   Setiap sample = kad dalam To Shoot (it.sample), ikut ke Shot, To Edit, Ready. Jadual mundur: shoot 4 hari dan
   siap edit 2 hari sebelum tarikh post. Selesai sendiri bila Published atau bila Posted ditanda dalam Sheet. */
const ymdAdd=(s,d)=>{const t=new Date(s+'T00:00:00');t.setDate(t.getDate()+d);return ymd(t)};
const daysTo=s=>Math.round((new Date(s+'T00:00:00')-new Date(ymd(new Date())+'T00:00:00'))/DAY);
const dmy=s=>{const t=new Date(s+'T00:00:00');return t.getDate()+' '+BULAN[t.getMonth()]};
function sampleDone(it){const s=it.sample;if(!s)return true;if(s.done||it.stage==='published')return true;
  const sv=sheetView();if(!sv)return false;const g=sv.groups.find(x=>x.tab==='PRODUCTS'&&itMatch(it,x.name));
  return !!(g&&g.start>(s.sheetRowAtAdd||0)&&g.rows.length&&g.rows.every(r=>r.posted.some(Boolean)||isSettled(r)))}
function samplePlan(it){const s=it.sample;const post=daysTo(s.postBy);const shootBy=ymdAdd(s.postBy,-4),editBy=ymdAdd(s.postBy,-2);
  const late=it.stage==='toshoot'&&daysTo(shootBy)<0?'Lewat shoot':(it.stage==='shot'||it.stage==='toedit')&&daysTo(editBy)<0?'Lewat edit':'';
  const next=it.stage==='toshoot'?'Shoot sebelum '+dmy(shootBy):(it.stage==='shot'||it.stage==='toedit')?'Siap edit sebelum '+dmy(editBy):'Post hari ni atau sebelum '+dmy(s.postBy);
  const recv=s.plat==='shopee'&&!s.received&&s.recvBy?daysTo(s.recvBy):null;
  return {post,shootBy,editBy,late,next,recv}}
const smpCol=d=>d<2?'var(--bad)':d<=5?'var(--warn)':'var(--ok)';
const smpLeft=d=>d>1?d+' hari lagi':d===1?'Esok':d===0?'Hari ni':'Lewat '+(-d)+' hari';
const smpPlat=p=>p==='shopee'?'Shopee':'TikTok';
function sampleBlock(it){if(!it.sample||sampleDone(it))return '';const s=it.sample,p=samplePlan(it);
  return `<div style="margin-top:10px;border-top:1px solid var(--line);padding-top:10px">
    <div class="rowh" style="align-items:center"><span class="meta">Sample ${smpPlat(s.plat)} · post sebelum <b>${dmy(s.postBy)}</b></span><span class="pill" style="--pc:${smpCol(p.post)}">${smpLeft(p.post)}</span></div>
    <div class="meta" style="margin-top:4px;${p.late?'color:var(--bad);font-weight:500':''}">${p.late?p.late+' · ':''}${p.next}</div>
    ${p.recv!==null?`<div class="rowh" style="align-items:center;margin-top:8px"><span class="meta" style="color:${smpCol(p.recv)};font-weight:500">Tekan Received dalam Shopee sebelum ${dmy(s.recvBy)} (${smpLeft(p.recv).toLowerCase()})</span><button class="btn sm" data-act="smpRecv" data-id="${it.id}">${IC.check}Dah tekan</button></div>`:''}
    <div class="btns" style="margin-top:8px;gap:6px"><button class="btn sm" data-act="smpEdit" data-id="${it.id}">${IC.edit}Tarikh</button><button class="btn sm" data-act="smpDone" data-id="${it.id}">${IC.check}Dah post</button></div></div>`}
const activeSamples=()=>S.items.filter(it=>it.sample&&!sampleDone(it)).sort((a,b)=>a.sample.postBy.localeCompare(b.sample.postBy));
/* Kad Home: 3 paling dekat + peringatan Received Shopee */
function sampleCard(){const list=activeSamples();const recv=list.filter(it=>samplePlan(it).recv!==null);
  return `<div class="card big glass" style="--c:${TAB['to-shoot'].c};margin-bottom:14px"><div class="rowh" style="align-items:center"><div><p class="eyebrow" style="margin:0">Sample review</p><h2 style="margin:4px 0 0">Deadline sample</h2></div><b class="bigno" style="font-size:40px">${list.length}</b></div>
   ${recv.map(it=>{const p=samplePlan(it);return `<div class="evrow" style="cursor:default;margin-top:8px"><span style="flex:1;min-width:0"><strong>Tekan Received: ${esc(it.title)}</strong><span class="meta" style="display:block">Shopee · sebelum ${dmy(it.sample.recvBy)}</span></span><span class="pill" style="--pc:${smpCol(p.recv)}">${smpLeft(p.recv)}</span></div>`}).join('')}
   ${list.slice(0,3).map(it=>{const p=samplePlan(it);return `<div style="--sc:${smpCol(p.post)};margin-top:12px"><div class="rowh" style="align-items:center"><div class="rt" style="min-width:0"><strong>${esc(it.title)}</strong><span class="meta" style="display:block">${smpPlat(it.sample.plat)} · ${p.late?'<span style="color:var(--bad)">'+p.late+'</span> · ':''}${p.next}</span></div><span class="pill" style="--pc:${smpCol(p.post)}">${smpLeft(p.post)}</span></div></div>`}).join('')||'<p class="meta" style="margin:10px 0 0">Tiada sample menunggu. Tambah bila dapat barang baru.</p>'}
   <div class="btns" style="margin-top:14px"><button class="btn solid tab" data-act="smpAdd">${IC.plus}Tambah sample</button>${list.length?`<button class="btn" data-act="go" data-id="to-shoot">Buka To Shoot${IC.next}</button>`:''}</div></div>`}
/* Tambah: screenshot (Mac mini baca teks, percuma) atau manual */
A.smpAdd=()=>{ui.smp={rows:[],busy:false};smpModal()};
function smpModal(){const m=ui.smp;const today=ymd(new Date());
  modal(`<h2>Tambah sample</h2>
   <div class="btns" style="gap:8px"><button class="btn solid tab" data-act="smpShot"${m.busy?' disabled':''}>${IC.up}${m.busy?'Mac mini sedang baca...':'Dari screenshot'}</button><button class="btn" data-act="smpRow">${IC.plus}Isi sendiri</button></div>
   <p class="meta" style="margin:8px 0 0">Screenshot senarai sample TikTok (Needs content) atau Shopee (To Receive). Boleh pilih beberapa gambar sekali. Teks dibaca dalam Mac mini, tanpa token Claude.</p>
   ${m.rows.length?`<div class="list" style="margin-top:14px">${m.rows.map((r,i)=>`<div class="card glass" style="padding:12px">
     <label class="f" style="margin:0 0 8px"><span>Nama produk</span><input class="inp" data-smp="${i}|name" value="${esc(r.name)}"></label>
     <div class="btns" style="gap:6px;margin-bottom:8px">${['tiktok','shopee'].map(p=>`<button class="btn sm ${r.plat===p?'solid tab':''}" data-act="smpPlat" data-x="${i}|${p}">${smpPlat(p)}</button>`).join('')}<button class="btn icon sm bad" data-act="smpRm" data-x="${i}" aria-label="Buang">${IC.trash}</button></div>
     <label class="f" style="margin:0"><span>${r.plat==='shopee'?'Tekan Received sebelum (post = +14 hari)':'Hari akhir post'}</span><input type="date" class="inp" data-smp="${i}|date" value="${esc(r.date||today)}"></label>
     ${r.dup?'<p class="meta" style="color:var(--warn);margin:6px 0 0">Nama ni dah ada dalam tracker.</p>':''}</div>`).join('')}</div>
     <div class="btns" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="smpSave">${IC.check}Tambah ${m.rows.length} sample</button></div>`:''}`,TAB['to-shoot'].c)}
document.addEventListener('input',e=>{const el=e.target;if(!el.dataset||!el.dataset.smp||!ui.smp)return;const [i,k]=el.dataset.smp.split('|');const r=ui.smp.rows[+i];if(r)r[k]=el.value});
A.smpRow=()=>{ui.smp.rows.push({name:'',plat:'tiktok',date:ymdAdd(ymd(new Date()),7)});smpModal()};
A.smpRm=el=>{ui.smp.rows.splice(+el.dataset.x,1);smpModal()};
A.smpPlat=el=>{const [i,p]=el.dataset.x.split('|');const r=ui.smp.rows[+i];if(r&&r.plat!==p){r.plat=p}smpModal()};
A.smpShot=()=>{if(!ASSETS){toast('Upload tak tersedia di sini');return}const inp=document.createElement('input');inp.type='file';inp.accept='image/*';inp.multiple=true;
  inp.onchange=async()=>{const fs=[...inp.files].slice(0,6);if(!fs.length)return;ui.smp.busy=true;smpModal();let n=0;
    for(const f of fs){try{const up=await ASSETS.upload(f);const out=await studioJob('ocr',{file:up.id},2*60000);const rows=smpParse(out.lines||[]);rows.forEach(r=>{r.dup=S.items.some(it=>it.sample&&nrm(it.title)===nrm(r.name));ui.smp.rows.push(r)});n+=rows.length;ASSETS.delete(up.id).catch(()=>{})}
      catch(e){toast('Tak dapat baca '+f.name+'. Semak Mac mini hidup')}}
    ui.smp.busy=false;smpModal();toast(n?n+' sample dijumpa. Semak dan tekan Tambah':'Tiada sample dijumpa dalam gambar')};inp.click()};
/* Baca baris OCR: TikTok "N days left" + tajuk di kanan gambar; Shopee "received by dd-mm-yyyy" + tajuk di atasnya */
function smpParse(lines){const out=[];const today=ymd(new Date());const L=lines.map(l=>({t:String(l.t||'').trim(),x:+l.x||0,y:+l.y||0})).filter(l=>l.t);
  const isTitle=l=>l.x>=0.22&&l.t.length>=12&&!/^(earn|rm\s?\d|rm0|needs content|get inspired|create|received|to receive|please confirm|managed by|\d+\s*days? left|×|x\s?\d)/i.test(l.t)&&!/days? left|fulfil+ment|quota|sample|refundable|official store|%|^to (receive|ship|publish|approve)/i.test(l.t);
  const clean=t=>t.replace(/\s*(\.{3}|…)\s*$/,'').replace(/^[\[【]([^\]】]+)[\]】]\s*/,'$1 ').replace(/\s*\|\s*$/,'').trim();
  L.forEach((l,i)=>{const m=l.t.match(/(\d+)\s*days?\s*left/i);if(!m)return;const t=L.slice(i+1).find(isTitle);if(t)out.push({name:clean(t.t),plat:'tiktok',date:ymdAdd(today,+m[1])})});
  let prevY=0;L.forEach((l,i)=>{const m=l.t.match(/(\d{2})[-\/.](\d{2})[-\/.](\d{4})/);if(!m)return;const date=`${m[3]}-${m[2]}-${m[1]}`;
    const ctx=L.slice(Math.max(0,i-2),i+1).map(x=>x.t).join(' ');const t=L.filter(x=>x.y>prevY&&x.y<l.y).find(isTitle);prevY=l.y;if(!t)return;
    if(/publish|post/i.test(ctx))out.push({name:clean(t.t),plat:'shopee',date:ymdAdd(date,-14)});else out.push({name:clean(t.t),plat:'shopee',date})});
  return out}
A.smpSave=()=>{const rows=ui.smp.rows.filter(r=>String(r.name).trim()&&r.date);if(!rows.length){toast('Isi nama dan tarikh dulu');return}
  const sv=sheetView();const lastRow=sv?Math.max(0,...sv.groups.map(g=>g.start)):0;
  rows.forEach(r=>{const postBy=r.plat==='shopee'?ymdAdd(r.date,14):r.date;
    save('items',{title:String(r.name).trim(),stage:'toshoot',stageAt:{toshoot:Date.now()},noteAt:Date.now(),shootDate:ymdAdd(postBy,-4),src:'sample',
      sample:{plat:r.plat,postBy,recvBy:r.plat==='shopee'?r.date:'',received:false,done:false,sheetRowAtAdd:lastRow}},true)});
  closeModal();render();toast(rows.length+' sample ditambah ke To Shoot')};
A.smpRecv=el=>{const it=get('items',el.dataset.id);save('items',Object.assign({},it,{sample:Object.assign({},it.sample,{received:true,receivedAt:Date.now()})}));toast('Ditanda dah tekan Received')};
A.smpDone=el=>{const it=get('items',el.dataset.id);confirmBox('Tanda "'+it.title+'" dah post? Ia keluar dari senarai deadline.',()=>{save('items',Object.assign({},it,{sample:Object.assign({},it.sample,{done:true,doneAt:Date.now()})}));toast('Sample selesai')},'Ya, dah post')};
A.smpEdit=el=>{const it=get('items',el.dataset.id);const s=it.sample;
  modal(`<h2>Tarikh sample</h2><p class="meta">${esc(it.title)} · ${smpPlat(s.plat)}</p>
   ${s.plat==='shopee'?`<label class="f"><span>Tekan Received sebelum</span><input type="date" class="inp" id="smpR" value="${esc(s.recvBy||'')}"></label>`:''}
   <label class="f"><span>Hari akhir post</span><input type="date" class="inp" id="smpP" value="${esc(s.postBy)}"></label>
   <div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="smpEditSave" data-id="${it.id}">Simpan</button></div>`,TAB['to-shoot'].c)};
A.smpEditSave=el=>{const it=get('items',el.dataset.id);const p=($('#smpP')||{}).value,r=($('#smpR')||{}).value;if(!p){toast('Pilih tarikh post');return}
  save('items',Object.assign({},it,{shootDate:ymdAdd(p,-4),sample:Object.assign({},it.sample,{postBy:p},r!==undefined&&it.sample.plat==='shopee'?{recvBy:r}:{})}));closeModal();toast('Tarikh dikemas kini')};
