/* ---------- SAMPLE (CONFIRMED PROJECTS): barang review dengan deadline ----------
   TikTok: tarikh akhir post = hari ni + "N days left".
   Shopee: tarikh dalam screenshot = mula; tarikh akhir post = tarikh tu + 14 hari.
   Scan screenshot terus masuk To Shoot. Selesai sendiri bila Published atau bila Posted ditanda dalam Sheet. */
const ymdAdd=(s,d)=>{const t=new Date(s+'T00:00:00');t.setDate(t.getDate()+d);return ymd(t)};
const daysTo=s=>Math.round((new Date(s+'T00:00:00')-new Date(ymd(new Date())+'T00:00:00'))/DAY);
const dmy=s=>{const t=new Date(s+'T00:00:00');return t.getDate()+' '+BULAN[t.getMonth()]};
function sampleDone(it){const s=it.sample;if(!s)return true;if(s.done||it.stage==='published')return true;
  const sv=sheetView();if(!sv)return false;const g=sv.groups.find(x=>x.tab==='PRODUCTS'&&itMatch(it,x.name));
  return !!(g&&g.start>(s.sheetRowAtAdd||0)&&g.rows.length&&g.rows.every(r=>r.posted.some(Boolean)||isSettled(r)))}
/* Countdown ke tarikh akhir post. Mula = tarikh dalam Shopee (deadline +14 hari) atau hari sample ditambah (TikTok).
   5 hari pertama hijau, 5 hari terakhir merah (SHOOT NOW), tengah kuning. */
const smpStart=it=>it.sample.start||it.sample.recvBy||ymd(new Date((it.stageAt&&it.stageAt.toshoot)||it.created||Date.now()));
function samplePlan(it){const s=it.sample;const left=daysTo(s.postBy);const gone=-daysTo(smpStart(it));const verb=it.stage==='toshoot'?'SHOOT':it.stage==='ready'?'POST':'EDIT';
  const col=left<=5?'#C2534F':gone<5?'#4E9B63':'#E3B23C';
  const label=left<0?'Lewat '+(-left)+' hari':left<=5?verb+' NOW':left+' days to '+verb;
  return {left,col,label,verb}}
const smpPlat=p=>p==='shopee'?'Shopee':p==='whatsapp'?'WhatsApp':'TikTok';
/* Lencana: nombor besar + label, tarikh akhir post di bawah (tekan untuk ubah) */
function smpBadge(it){const p=samplePlan(it);return `<div class="smpb" style="--pc:${p.col}"><span class="pill smpp"><b>${Math.max(p.left,0)}</b>${esc(p.label.replace(/^\d+ /,''))}</span><button class="smpd" data-act="smpEdit" data-id="${it.id}">Akhir post ${dmy(it.sample.postBy)}</button></div>`}
/* Baris gambar listing: thumbnail kecil + butang tambah (auto simpan ke R1. PRODUCT LISTING) */
function smpListing(it){const l=it.listing||{};const busy=ui.lsUp&&ui.lsUp[it.id];const lk=it.shopee||it.tiktok;
  const st=busy?' st-run':l.n?' st-done':'';
  return `<button class="btn sm${st}" data-act="lsAdd" data-id="${it.id}"${busy?' disabled':''}>${busy?'<i class="spin"></i>'+esc(busy):(l.n?IC.check+l.n+' gambar':IC.up+'Gambar listing')}</button><button class="btn sm${lk?' st-done':''}" data-act="smpLink" data-id="${it.id}">${lk?IC.check+'Link':'+ Link'}</button>`}
/* Butang Nota berwarna: kelabu = belum, kuning = sedang buat, hijau = siap */
function notaBtn(it,act){const run=ui.notaUp&&ui.notaUp[it.id];const done=it.nota||it.productId;
  return `<button class="btn sm${run?' st-run':done?' st-done':''}" data-act="${act||'nota'}" data-id="${it.id}"${run?' disabled':''}>${run?'<i class="spin"></i>'+esc(run):done?IC.check+'Nota':'Nota'}</button>`}
function sampleBlock(it){if(!it.sample||sampleDone(it))return '';
  return `<div class="rowh" style="align-items:center;margin-top:10px;border-top:1px solid var(--line);padding-top:10px"><span class="meta">Sample ${smpPlat(it.sample.plat)}</span>${smpBadge(it)}</div>`}
const activeSamples=()=>S.items.filter(it=>it.sample&&!sampleDone(it)).sort((a,b)=>a.sample.postBy.localeCompare(b.sample.postBy));
/* Kad Home: CONFIRMED PROJECTS, 4 paling dekat */
function sampleCard(){const list=activeSamples();
  return `<div class="card big glass" style="--c:${TAB['to-shoot'].c};margin-top:14px"><div class="rowh" style="align-items:center"><h2 style="margin:0">CONFIRMED PROJECTS</h2><b class="bigno" style="font-size:40px">${list.length}</b></div>
   ${list.slice(0,4).map(it=>{const p=samplePlan(it);return `<div class="rowh" style="align-items:center;margin-top:12px;gap:10px"><div class="rt" style="min-width:0"><strong>${esc(it.title)}</strong><span class="meta" style="display:block">${smpPlat(it.sample.plat)} · akhir post ${dmy(it.sample.postBy)}</span></div><span class="pill smpp" style="--pc:${p.col}"><b>${Math.max(p.left,0)}</b>${esc(p.label.replace(/^\d+ /,''))}</span></div>`}).join('')||'<p class="meta" style="margin:10px 0 0">Tiada project menunggu. Tambah bila dapat sample baru.</p>'}
   <div class="btns" style="margin-top:14px"><button class="btn solid tab" data-act="smpAdd">${IC.plus}Tambah sample</button>${list.length?`<button class="btn" data-act="go" data-id="to-shoot">Buka To Shoot${IC.next}</button>`:''}</div></div>`}
/* Tambah: screenshot terus masuk To Shoot (Mac mini baca teks, percuma) atau isi sendiri */
A.smpAdd=()=>{ui.smp={rows:[],busy:false};smpModal()};
function smpModal(){const m=ui.smp;const today=ymd(new Date());
  modal(`<h2>Tambah sample</h2>
   <div class="btns" style="gap:8px"><button class="btn solid tab" data-act="smpShot"${m.busy?' disabled':''}>${IC.up}${m.busy?esc(m.busy):'Dari screenshot'}</button><button class="btn" data-act="smpRow">${IC.plus}Isi sendiri</button></div>
   <p class="meta" style="margin:8px 0 0">Screenshot senarai sample TikTok / Shopee (dibaca percuma), atau screenshot chat kedai / WhatsApp (Mac mini baca harga, tugasan dan deadline). Terus masuk To Shoot.</p>
   ${m.rows.length?`<div class="list" style="margin-top:14px">${m.rows.map((r,i)=>`<div class="card glass" style="padding:12px">
     <label class="f" style="margin:0 0 8px"><span>Nama produk</span><input class="inp" data-smp="${i}|name" value="${esc(r.name)}"></label>
     <div class="btns" style="gap:6px;margin-bottom:8px">${['tiktok','shopee'].map(p=>`<button class="btn sm ${r.plat===p?'solid tab':''}" data-act="smpPlat" data-x="${i}|${p}">${smpPlat(p)}</button>`).join('')}<button class="btn icon sm bad" data-act="smpRm" data-x="${i}" aria-label="Buang">${IC.trash}</button></div>
     <div class="row2" style="grid-template-columns:1fr 110px"><label class="f" style="margin:0"><span>${r.plat==='shopee'?'Tarikh dalam Shopee (+14 hari)':'Hari akhir post'}</span><input type="date" class="inp" data-smp="${i}|date" value="${esc(r.date||today)}"></label><label class="f" style="margin:0"><span>Harga RM</span><input class="inp" data-smp="${i}|price" value="${esc(r.price||'')}" placeholder="89" inputmode="decimal"></label></div></div>`).join('')}</div>
     <div class="btns" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="smpSave">${IC.check}Tambah ${m.rows.length} sample</button></div>`:''}`,TAB['to-shoot'].c)}
document.addEventListener('input',e=>{const el=e.target;if(!el.dataset||!el.dataset.smp||!ui.smp)return;const [i,k]=el.dataset.smp.split('|');const r=ui.smp.rows[+i];if(r)r[k]=el.value});
A.smpRow=()=>{ui.smp.rows.push({name:'',plat:'tiktok',date:ymdAdd(ymd(new Date()),7)});smpModal()};
A.smpRm=el=>{ui.smp.rows.splice(+el.dataset.x,1);smpModal()};
A.smpPlat=el=>{const [i,p]=el.dataset.x.split('|');const r=ui.smp.rows[+i];if(r&&r.plat!==p){r.plat=p}smpModal()};
A.smpShot=()=>{if(!ASSETS){toast('Upload tak tersedia di sini');return}
  pickFile('image/*',async files=>{const fs=files.slice(0,6);if(!fs.length)return;const found=[],ups=[];let k=0;
    for(const f of fs){k++;ui.smp.busy='Mac mini baca gambar '+k+'/'+fs.length+'...';smpModal();
      try{const up=await ASSETS.upload(f);ups.push(up.id);const out=await studioJob('ocr',{file:up.id},2*60000);found.push(...smpParse(out.lines||[]))}
      catch(e){toast('Tak dapat baca '+f.name+'. Semak Mac mini hidup')}}
    /* Bukan senarai sample (contoh chat kedai / WhatsApp): Claude dalam Mac mini baca sebagai chat */
    if(!found.length&&ups.length){ui.smp.busy='Bukan senarai sample, baca sebagai chat...';smpModal();
      try{const x=await chatRead(ups,'');ups.forEach(i=>ASSETS.delete(i).catch(()=>{}));ui.smp.busy=false;closeModal();chatApply(x);return}catch(e){toast('Tak dapat baca chat: '+String((e&&e.message)||'').slice(0,60))}}
    ups.forEach(i=>ASSETS.delete(i).catch(()=>{}));
    ui.smp.busy=false;
    const fresh=found.filter((r,i)=>!S.items.some(it=>it.sample&&nrm(it.title)===nrm(r.name))&&found.findIndex(x=>nrm(x.name)===nrm(r.name))===i);
    const dup=found.length-fresh.length;
    if(!fresh.length){smpModal();toast(found.length?'Semua sample dalam gambar dah ada dalam To Shoot':'Tiada sample dijumpa dalam gambar');return}
    smpAddRows(fresh);closeModal();go('to-shoot');toast(fresh.length+' sample masuk To Shoot'+(dup?' · '+dup+' dah ada':''))},true)};
/* Baca baris OCR: TikTok "N days left" + tajuk di kanan gambar; Shopee tarikh dd-mm-yyyy (mula) + tajuk di atasnya */
function smpParse(lines){const out=[];const today=ymd(new Date());const L=lines.map(l=>({t:String(l.t||'').trim(),x:+l.x||0,y:+l.y||0})).filter(l=>l.t);
  const isTitle=l=>l.x>=0.22&&l.t.length>=12&&!/^(earn|rm\s?\d|rm0|needs content|get inspired|create|received|to receive|please confirm|managed by|\d+\s*days? left|×|x\s?\d)/i.test(l.t)&&!/days? left|fulfil+ment|quota|sample|refundable|official store|%|^to (receive|ship|publish|approve)/i.test(l.t);
  const clean=t=>t.replace(/\s*(\.{3}|…)\s*$/,'').replace(/^[\[【]([^\]】]+)[\]】]\s*/,'$1 ').replace(/\s*\|\s*$/,'').trim();
  L.forEach((l,i)=>{const m=l.t.match(/(\d+)\s*days?\s*left/i);if(!m)return;const t=L.slice(i+1).find(isTitle);if(t)out.push({name:clean(t.t),plat:'tiktok',date:ymdAdd(today,+m[1])})});
  let prevY=0;L.forEach((l,i)=>{const m=l.t.match(/(\d{2})[-\/.](\d{2})[-\/.](\d{4})/);if(!m)return;const date=`${m[3]}-${m[2]}-${m[1]}`;
    const t=L.filter(x=>x.y>prevY&&x.y<l.y).find(isTitle);prevY=l.y;if(t)out.push({name:clean(t.t),plat:'shopee',date})});
  return out}
function smpAddRows(rows){const sv=sheetView();const lastRow=sv?Math.max(0,...sv.groups.map(g=>g.start)):0;const today=ymd(new Date());
  rows.forEach(r=>{const postBy=r.plat==='shopee'?ymdAdd(r.date,14):r.date;
    save('items',{title:String(r.name).trim(),stage:'toshoot',stageAt:{toshoot:Date.now()},noteAt:Date.now(),src:'sample',
      sample:{plat:r.plat,postBy,start:r.plat==='shopee'?r.date:today,done:false,sheetRowAtAdd:lastRow,price:rmNum(r.price)}},true)})}
const rmNum=v=>{const n=parseFloat(String(v||'').replace(/[^0-9.]/g,''));return isNaN(n)?'':(n%1?n.toFixed(2):String(n))};
A.smpSave=()=>{const rows=ui.smp.rows.filter(r=>String(r.name).trim()&&r.date);if(!rows.length){toast('Isi nama dan tarikh dulu');return}
  smpAddRows(rows);closeModal();render();toast(rows.length+' sample ditambah ke To Shoot')};
A.smpEdit=el=>smpForm(get('items',el.dataset.id));
/* Borang penuh sample: semua butiran boleh diubah. it kosong = sample baru (cth bila Claude tak jumpa maklumat) */
function smpForm(it,pre,title){it=it||{};const s=Object.assign({plat:'shopee',postBy:ymdAdd(ymd(new Date()),7)},it.sample||{},pre||{});const nm=(pre&&pre.title)||it.title||'';
  ui.smpF={id:it.id||'',plat:s.plat};
  modal(`<h2>${esc(title||(it.id?'Edit sample':'Sample baru'))}</h2>
   <label class="f"><span>Nama produk</span><input class="inp" id="sfT" value="${esc(nm)}" placeholder="cth BOYAMIC 2 Wireless Microphone"></label>
   <div class="row2" style="grid-template-columns:1fr 1fr"><label class="f"><span>Brand</span><input class="inp" id="sfB" value="${esc((pre&&pre.brand)||it.brand||'')}"></label><label class="f"><span>Harga RM</span><input class="inp" id="sfR" value="${esc(s.price||'')}" inputmode="decimal" placeholder="708.10"></label></div>
   <label class="f"><span>Dari mana</span><div class="seg" id="sfP">${['shopee','tiktok','whatsapp'].map(p=>`<button type="button" class="${s.plat===p?'on':''}" data-act="sfPlat" data-x="${p}">${smpPlat(p)}</button>`).join('')}</div></label>
   <div class="row2" style="grid-template-columns:1fr 1fr"><label class="f"><span>Akhir post</span><input type="date" class="inp" id="sfD" value="${esc(s.postBy||'')}"></label><label class="f"><span>Hari selepas terima (0 = tiada)</span><input class="inp" id="sfA" value="${esc(s.afterRecv||0)}" inputmode="numeric"></label></div>
   ${s.afterRecv&&!s.received&&it.id?`<button class="btn sm solid tab" style="margin-bottom:12px" data-act="smpRecv" data-id="${it.id}">${IC.check}Dah terima barang hari ni (akhir post +${s.afterRecv} hari)</button>`:s.received?`<p class="meta" style="margin:-4px 0 12px">Barang diterima ${esc(s.recvAt?dmy(s.recvAt):'')}</p>`:''}
   <label class="f"><span>Tugasan (satu baris satu)</span><textarea class="inp" id="sfK" rows="3" placeholder="Ulasan Shopee 5 bintang (5 gambar + 1 video)">${esc(s.tasks||'')}</textarea></label>
   <label class="f"><span>Kedai / contact</span><input class="inp" id="sfS" value="${esc(s.store||'')}"></label>
   <div class="row2" style="grid-template-columns:1fr 1fr"><label class="f"><span>Link Shopee</span><input class="inp" id="sfLs" value="${esc(it.shopee||'')}" inputmode="url"></label><label class="f"><span>Link TikTok</span><input class="inp" id="sfLt" value="${esc(it.tiktok||'')}" inputmode="url"></label></div>
   <div class="btns" style="justify-content:space-between">${it.id?`<button class="btn sm bad" data-act="sfDel" data-id="${it.id}">${IC.trash}Padam</button>`:'<span></span>'}<div class="btns"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="sfSave">Simpan</button></div></div>`,TAB['to-shoot'].c)}
A.sfPlat=el=>{ui.smpF.plat=el.dataset.x;document.querySelectorAll('#sfP button').forEach(b=>b.classList.toggle('on',b.dataset.x===el.dataset.x))};
A.sfDel=el=>{const it=get('items',el.dataset.id);confirmBox('Padam sample "'+(it.title||'')+'"?',()=>{del('items',it.id);toast('Dipadam')})};
A.sfSave=()=>{const f=ui.smpF;const v=id=>(($('#'+id)||{}).value||'').trim();const title=v('sfT');if(!title){toast('Isi nama produk');return}
  const postBy=v('sfD')||ymdAdd(ymd(new Date()),7);const it=f.id?get('items',f.id):null;const sv=sheetView();
  const sample=Object.assign({start:ymd(new Date()),done:false,received:false,sheetRowAtAdd:sv?Math.max(0,...sv.groups.map(g=>g.start)):0},it?it.sample:{},
    {plat:f.plat,postBy,price:rmNum(v('sfR')),afterRecv:parseInt(v('sfA'),10)||0,tasks:v('sfK'),store:v('sfS')});
  const sh=pickUrl(v('sfLs')),tt=pickUrl(v('sfLt'));
  const o=save('items',Object.assign({},it||{stage:'toshoot',stageAt:{toshoot:Date.now()},noteAt:Date.now(),src:'sample'},{title,brand:v('sfB'),shopee:sh,tiktok:tt,sample}));
  closeModal();toast(it?'Sample dikemas kini':'Sample masuk Shoot, Projects dan Non paid');smpPriceSheet(o);
  const g=sv&&sv.groups.find(x=>x.tab==='PRODUCTS'&&itMatch(o,x.name));if(g&&(sh||tt))itemLinksToSheet(o,g).catch(()=>{})};
/* Deadline dikira dari tarikh terima barang (contoh: 7 hari selepas terima) */
A.smpRecv=el=>{const it=get('items',el.dataset.id);const s=it.sample;const td=ymd(new Date());closeModal();
  save('items',Object.assign({},it,{sample:Object.assign({},s,{received:true,recvAt:td,start:td,postBy:ymdAdd(td,s.afterRecv||7)})}));toast('Akhir post: '+dmy(ymdAdd(td,s.afterRecv||7)))};
const smpTasks=it=>{const t=lines((it.sample||{}).tasks);return t.length?`<ul class="smptask">${t.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''};
/* Harga sample: simpan dalam kad, dan ke Sheet (JENIS = SAMPLE, HARGA) bila produk dah ada dalam Sheet */
function smpPriceSheet(it){const sv=sheetView();const g=sv&&it&&it.sample&&it.sample.price&&sv.groups.find(x=>x.tab==='PRODUCTS'&&itMatch(it,x.name)&&x.start>(it.sample.sheetRowAtAdd||0));
  if(g&&MCP)sheetWrite(`PRODUCTS!R${g.start}:S${g.start}`,[[g.kind||'SAMPLE',it.sample.price]]).then(()=>toast('Harga disimpan dalam Sheet')).catch(()=>{})}
function smpPriceSave(id,v){const it=get('items',id);if(!it||!it.sample)return;const price=rmNum(v);if(price===(it.sample.price||''))return;
  save('items',Object.assign({},it,{sample:Object.assign({},it.sample,{price})}));toast('Harga disimpan');smpPriceSheet(get('items',id))}
/* Gambar listing: upload, Mac mini simpan ke R1. PRODUCT LISTING/<produk>, baca teks (percuma), kemudian nota auto */
A.lsAdd=el=>{if(!ASSETS){toast('Upload tak tersedia di sini');return}const id=el.dataset.id;const it0=get('items',id);
  pickFile('image/*',async files=>{const fs=files.filter(f=>f.size<=20*1048576).slice(0,12);if(!fs.length){toast('Gambar terlalu besar');return}ui.lsUp=ui.lsUp||{};const ids=[];let step='upload';
    try{for(let i=0;i<fs.length;i++){ui.lsUp[id]='Upload '+(i+1)+'/'+fs.length;render(true);ids.push((await ASSETS.upload(fs[i])).id)}
      step='simpan';ui.lsUp[id]='Simpan ke R1...';render(true);const it=get('items',id)||it0;
      const out=await studioJob('listing_save',{item:id,name:it.title,folder:(it.listing&&it.listing.folder)||'',files:ids,shopee:it.shopee||'',tiktok:it.tiktok||''},5*60000);
      step='kemas kini';const cur=get('items',id)||it;const text=[((cur.listing||{}).text||''),out.text||''].join('\n').trim().slice(0,12000);
      save('items',Object.assign({},cur,{listing:{folder:out.folder,n:out.total,text}}));delete ui.lsUp[id];render(true);toast(out.saved+' gambar disimpan dalam R1 / '+out.folder);
      if(!cur.nota&&!cur.productId)smpNota(get('items',id))}
    catch(e){delete ui.lsUp[id];render(true);toast('Gagal masa '+step+': '+String((e&&(e.message||e.code))||'cuba lagi').slice(0,80))}
    finally{ids.forEach(x=>ASSETS.delete(x).catch(()=>{}))}},true)};
/* Nota: Claude Opus 5.5 (effort low) dalam Mac mini baca gambar listing terus, templat sama macam nota Bath Garden */
async function smpNota(it){if(!window.studioJob||!(it.listing&&it.listing.folder))return;ui.notaUp=ui.notaUp||{};ui.notaUp[it.id]='Buat nota...';render(true);
  try{const r=await studioJob('nota',{item:it.id,folder:it.listing.folder,name:it.title,plat:it.sample?smpPlat(it.sample.plat):'',link:it.shopee||it.tiktok||''},15*60000);
    if(r.product)save('products',r.product);const cur=get('items',it.id)||it;const nx=Object.assign({},cur,{productId:r.productId,noteAt:Date.now()});delete nx.nota;save('items',nx);toast('Nota siap untuk '+it.title)}
  catch(e){toast('Nota gagal: '+String((e&&(e.message||e.code))||'cuba lagi').slice(0,80))}
  finally{delete ui.notaUp[it.id];render(true)}}
A.smpNotaBtn=el=>{const it=get('items',el.dataset.id);if(it.nota||it.productId){A.nota(el);return}if(!(it.listing&&it.listing.n)){toast('Tambah gambar listing dulu, nota dibuat sendiri');return}smpNota(it)};
/* Link produk (Shopee / TikTok): simpan dalam kad + link.txt dalam folder R1. Caption generator terus jumpa link ni. */
A.smpLink=el=>{const it=get('items',el.dataset.id);
  modal(`<h2>Link produk</h2><p class="meta">${esc(it.title)}</p>
   <label class="f"><span>Link Shopee</span><input class="inp" id="lkS" inputmode="url" placeholder="https://s.shopee.com.my/..." value="${esc(it.shopee||'')}"></label>
   <label class="f"><span>Link TikTok</span><input class="inp" id="lkT" inputmode="url" placeholder="https://vt.tiktok.com/..." value="${esc(it.tiktok||'')}"></label>
   <p class="meta">Boleh paste teks share penuh dari app, link diambil sendiri.</p>
   <div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="smpLinkSave" data-id="${it.id}">Simpan</button></div>`,TAB['to-shoot'].c)};
const pickUrl=v=>{const m=String(v||'').match(/https?:\/\/\S+/);return m?m[0].replace(/[)\].,]+$/,''):''};
A.smpLinkSave=el=>{const it=get('items',el.dataset.id);let sh=pickUrl($('#lkS').value),tt=pickUrl($('#lkT').value);
  if(sh&&/tiktok/i.test(sh)&&!tt){tt=sh;sh=''}if(tt&&/shopee|shp\.ee/i.test(tt)&&!sh){sh=tt;tt=''}
  save('items',Object.assign({},it,{shopee:sh,tiktok:tt}));closeModal();toast(sh||tt?'Link disimpan':'Link dibuang');
  const sv=sheetView();const g=sv&&sv.groups.find(x=>x.tab==='PRODUCTS'&&itMatch(it,x.name));if(g&&(sh||tt))itemLinksToSheet(Object.assign({},it,{shopee:sh,tiktok:tt}),g).then(()=>toast('Link disimpan, Sheet dikemas kini')).catch(()=>{});
  if((sh||tt)&&it.listing&&it.listing.folder&&window.studioJob)studioJob('listing_save',{item:it.id,name:it.title,folder:it.listing.folder,files:[],shopee:sh,tiktok:tt},2*60000).catch(()=>{})};
/* CONFIRMED PROJECTS: sample + slider aliran (Nota > Shoot > Storyboard > Editor > To Post > Published), dipadan dengan Sheet */
function confirmedList(sv){const gs=sv?sv.groups.filter(g=>g.tab==='PRODUCTS'):[];
  return activeSamples().map(it=>{const g=gs.find(x=>itMatch(it,x.name))||null;const eds=S.editor.filter(e=>pMatch(e.name,it.title));return {it,g,step:prodDone([it],eds,g,sv)}})}
const tlMini=d=>`<div class="tl tl-mini">${PSTEPS.map((s,i)=>`<div class="s${i<=d?' d':i===d+1?' cur':''}"><i>${i<=d?IC.check:''}</i></div>`).join('')}</div>`;
function cpRow(x){const p=samplePlan(x.it);const nm=String(x.it.title).split(/\s+/).slice(0,3).join(' ');const cur=PSTEPS[Math.min(x.step+1,5)];
  return `<div class="ccr" style="--c:${TAB.links.c}"><div class="rowh"><span class="ccn">${esc(nm)}</span><span class="pill smpp" style="--pc:${p.col}"><b>${Math.max(p.left,0)}</b>${esc(p.label.replace(/^\d+ /,''))}</span></div>${tlMini(x.step)}<div class="meta" style="font-size:11px;margin-top:-2px">${smpPlat(x.it.sample.plat)} · sekarang ${esc(cur)} · akhir post ${dmy(x.it.sample.postBy)}</div></div>`}
function confirmedSection(sv){const L=confirmedList(sv).filter(x=>hit('lk',x.it.title));if(!L.length)return '';
  return `<p class="eyebrow" style="margin-top:6px">Sample · ${L.length}</p><div class="list" style="margin-bottom:14px">${L.map(x=>`<div class="card glass"><div class="rowh" style="align-items:flex-start;gap:10px"><div style="min-width:0">${x.g?`<span class="bigno" style="font-size:20px;margin-right:6px">${esc(x.g.no)}</span>`:''}<h3 style="display:inline">${esc(x.it.title)}</h3><div class="meta">Sample ${smpPlat(x.it.sample.plat)}${x.g?' · dalam Sheet':' · belum masuk Sheet'}</div></div>${smpBadge(x.it)}</div>${timeline(x.step,'')}${x.it.sample.afterRecv&&!x.it.sample.received?`<p class="meta" style="margin:6px 0 0;color:var(--warn)">Deadline kira ${x.it.sample.afterRecv} hari dari terima barang. Tekan tarikh untuk tanda dah terima.</p>`:''}${smpTasks(x.it)}${linkRow(x.it)}<div class="btns" style="justify-content:flex-end;margin-top:6px"><button class="btn sm" data-act="smpEdit" data-id="${x.it.id}">${IC.edit}Edit sample</button></div></div>`).join('')}</div>`}
