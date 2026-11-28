/* ---------- CAROUSEL (28 Nov 2026, Mira) ----------
   Upload gambar, pilih setting, Mac mini jana carousel IG seamless (job `carousel`, carousel_engine.py, 0 token).
   Setiap Generate / Shuffle guna seed baru dan elak resipi 8 carousel terakhir, jadi susunan sentiasa berlainan.
   Kunci slide yang dah cantik, Shuffle tukar yang lain sahaja. Mod Enhance sahaja: tingkatkan warna gambar penuh.
   Doc `carousel/<id>`: {title, photos:[{id,name,star}], opts, seed, lock:[], status queued|run|done|error, pct, msg, err,
   out:{slides|photos, preview, thumb, folder, recipe, warnings}, old:[versi sebelum ni]} */
const CR_VIBES=[['rawak','Rawak'],['scrapbook','Scrapbook'],['minimal','Minimal'],['film','Film'],['majalah','Majalah']];
const CR_CUTS=[['rawak','Rawak'],['longgar','Longgar'],['ketat','Ketat'],['campur','Campur']];
const CR_COLS=[['natural','Natural'],['vivid','Vivid'],['warm','Warm'],['misty','Misty'],['film','Film'],['pastel','Pastel'],['off','Asal']];
const CR_DEF={mode:'carousel',slides:5,aspect:'4:5',vibe:'rawak',cutout:'rawak',decor:1,enhance:'natural',strength:100,order:false};
const crUi=()=>ui.cr||(ui.cr={open:'',form:null,busy:''});
const crImg=id=>studioFileUrl(id);
const crSorted=()=>S.carousel.filter(c=>!c.gone).sort((a,b)=>(b.created||0)-(a.created||0));
const crAutoSlides=n=>Math.max(3,Math.min(10,Math.round(n/1.5)||3));

V.carousel=()=>{const u=crUi();
  if(u.form)return crFormView();
  const c=u.open&&get('carousel',u.open);if(c)return crDetail(c);
  const L=crSorted();
  return head('Gambar jadi carousel seamless, 0 token',`<button class="btn solid tab" data-act="crNew">${IC.plus}Buat baru</button>`)+
   `<p class="meta" style="margin:-8px 0 14px">Setiap kali susunan, cutout dan hiasan berlainan. Mac mini buat semua (percuma, tanpa Claude).</p>`+
   (L.length?`<div class="crlist">${L.map(crCard).join('')}</div>`:`<div class="empty">Belum ada carousel. Tekan Buat baru, pilih gambar trip kau.</div>`)};

function crCard(c){const o=c.out||{};const th=o.thumb||(o.photos||[])[0]||'';
  const st=c.status==='done'?'':c.status==='error'?`<span class="pill" style="--pc:var(--bad)">Gagal</span>`:`<span class="pill" style="--pc:var(--warn)">${c.status==='run'?(c.pct||0)+'%':'Giliran'}</span>`;
  return `<button class="crcard glass" data-act="crOpen" data-id="${esc(c.id)}">${th?`<img src="${esc(crImg(th))}" alt="" loading="lazy">`:`<span class="crph">${IC.carousel}</span>`}
   <span class="crct"><b>${esc(c.title||'Tanpa tajuk')}</b><span class="meta">${(c.photos||[]).length} gambar · ${c.opts&&c.opts.mode==='enhance'?'Enhance':(c.opts||{}).slides+' slide'} · ${esc(fmtShort(c.created))}</span>${st}</span></button>`}
const fmtShort=t=>{const d=new Date(t||Date.now());return d.getDate()+' '+BULAN[d.getMonth()].slice(0,3)};

/* ---------- borang ---------- */
A.crNew=()=>{const u=crUi();u.form={files:[],title:'',opts:Object.assign({},CR_DEF),id:''};u.open='';render(true)};
A.crCancel=()=>{const u=crUi();(u.form&&u.form.files||[]).forEach(f=>f.url&&URL.revokeObjectURL(f.url));u.form=null;render(true)};
A.crPick=()=>{const f=crUi().form;pickFile('image/*',fs=>{fs.filter(x=>/^image\//.test(x.type)||/\.(jpe?g|png|heic|webp)$/i.test(x.name)).slice(0,30-f.files.length)
  .forEach(x=>f.files.push({file:x,url:URL.createObjectURL(x),name:x.name,star:false}));if(!f.touched)f.opts.slides=crAutoSlides(f.files.length);render(true)},true)};
A.crStar=el=>{const f=crUi().form,i=+el.dataset.i;f.files.forEach((x,k)=>x.star=k===i?!x.star:false);render(true)};
A.crRm=el=>{const f=crUi().form,i=+el.dataset.i;const x=f.files.splice(i,1)[0];if(x&&x.url&&x.file)URL.revokeObjectURL(x.url);render(true)};
A.crMv=el=>{const f=crUi().form,i=+el.dataset.i,j=i+(+el.dataset.d);if(j<0||j>=f.files.length)return;[f.files[i],f.files[j]]=[f.files[j],f.files[i]];render(true)};
A.crOpt=el=>{const f=crUi().form;let v=el.dataset.v;if(/^\d+$/.test(v))v=+v;if(v==='true'||v==='false')v=v==='true';f.opts[el.dataset.k]=v;if(el.dataset.k==='slides')f.touched=true;render(true)};
function crSeg(k,list,val){return `<div class="seg crseg">${list.map(([v,l])=>`<button class="${String(val)===String(v)?'on':''}" data-act="crOpt" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`}
function crChips(k,list,val){return `<div class="chips">${list.map(([v,l])=>`<button class="chip ${val===v?'on':''}" data-act="crOpt" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`}
function crFormView(){const u=crUi(),f=u.form,o=f.opts,enh=o.mode==='enhance';
  const thumbs=f.files.map((x,i)=>`<div class="crth${x.star?' star':''}"><img src="${esc(x.url||crImg(x.id))}" alt="">
     <button class="crstar" data-act="crStar" data-i="${i}" aria-label="Slide pertama">${x.star?'★':'☆'}</button>
     <button class="crx" data-act="crRm" data-i="${i}" aria-label="Buang">${IC.x}</button>
     ${o.order?`<span class="crmv"><button data-act="crMv" data-i="${i}" data-d="-1" aria-label="Ke kiri">‹</button><button data-act="crMv" data-i="${i}" data-d="1" aria-label="Ke kanan">›</button></span>`:''}</div>`).join('');
  const slides=[3,4,5,6,7,8,9,10].map(n=>[n,n]);
  return head(f.id?'Tukar setting':'Carousel baru',`<button class="btn" data-act="crCancel">${IC.back}Batal</button>`)+
   `<div class="card glass">
    ${f.id?`<p class="meta" style="margin:0 0 10px">Gambar sama, setting baru. Tekan Generate untuk versi baru.</p>`:
    `<button class="jdrop" type="button" data-act="crPick"${u.busy?' disabled':''}>${IC.up}<span><b>${f.files.length?f.files.length+' gambar dipilih':'Pilih gambar'}</b><span class="meta" style="display:block">Sampai 30 gambar. Gambar asal dari phone (bukan screenshot) supaya tajam.</span></span></button>`}
    ${f.files.length?`<p class="meta" style="margin:0 0 6px">Tekan ☆ untuk gambar slide pertama (hero). Kosong: Mac mini pilih sendiri.</p><div class="crthumbs">${thumbs}</div>`:''}
    <label class="f" style="margin-top:12px"><span>Tajuk (untuk folder Drive)</span><input class="inp" id="crTitle" value="${esc(f.title)}" placeholder="Contoh: Genting Nov 2026"></label>
    <div class="f"><span>Mod</span>${crSeg('mode',[['carousel','Carousel'],['enhance','Enhance sahaja']],o.mode)}</div>
    ${enh?'':`<div class="row2"><div class="f"><span>Jumlah slide</span><select class="inp" id="crSlides">${slides.map(([v])=>`<option ${o.slides==v?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="f"><span>Saiz</span>${crSeg('aspect',[['4:5','4:5'],['1:1','1:1'],['9:16','9:16']],o.aspect)}</div></div>
    <div class="f"><span>Gaya</span>${crChips('vibe',CR_VIBES,o.vibe)}</div>
    <div class="f"><span>Cutout</span>${crChips('cutout',CR_CUTS,o.cutout)}<p class="meta" style="margin:4px 0 0">Longgar: tepi licin, ada sikit latar, tak terpotong tangan / telinga. Ketat: ikut badan.</p></div>
    <div class="row2"><div class="f"><span>Hiasan</span>${crSeg('decor',[[0,'Off'],[1,'Sikit'],[2,'Banyak']],o.decor)}</div>
      <div class="f"><span>Susunan gambar</span>${crSeg('order',[[false,'Rawak'],[true,'Ikut aku']],o.order)}</div></div>`}
    <div class="f"><span>Warna (enhance)</span>${crChips('enhance',CR_COLS,o.enhance)}</div>
    ${o.enhance==='off'?'':`<label class="f"><span>Kekuatan warna: <b id="crStrV">${o.strength}%</b></span><input type="range" id="crStr" min="20" max="150" step="10" value="${o.strength}" style="width:100%"></label>`}
    <div class="btns" style="justify-content:flex-end"><button class="btn solid tab" data-act="crGo"${u.busy||!f.files.length?' disabled':''}>${u.busy?'<i class="spin"></i>'+esc(u.busy):enh?'Enhance':'Generate'}</button></div>
   </div>`}
AFTER.carousel=()=>{const s=$('#crStr');if(s)s.oninput=()=>{const f=crUi().form;if(f){f.opts.strength=+s.value;$('#crStrV').textContent=s.value+'%'}};
  const sl=$('#crSlides');if(sl)sl.onchange=()=>{const f=crUi().form;if(f){f.opts.slides=+sl.value;f.touched=true}};
  const t=$('#crTitle');if(t)t.oninput=()=>{const f=crUi().form;if(f)f.title=t.value}};

/* Kecilkan gambar dalam phone (maks 2560 px) supaya upload laju; orientasi ikut gambar */
async function crShrink(file){const MAX=2560;
  try{const url=URL.createObjectURL(file);const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url});
    const w=img.naturalWidth,h=img.naturalHeight,s=Math.min(1,MAX/Math.max(w,h));
    if(s===1&&/jpe?g/i.test(file.type)&&file.size<6e6){URL.revokeObjectURL(url);return file}
    const c=document.createElement('canvas');c.width=Math.round(w*s);c.height=Math.round(h*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);
    const b=await new Promise(r=>c.toBlob(r,'image/jpeg',0.92));
    return new File([b],file.name.replace(/\.\w+$/,'')+'.jpg',{type:'image/jpeg'})}catch(e){return file}}

/* Resipi carousel terakhir (elak susunan berulang) */
function crAvoid(cur){const seqs=[];const add=o=>{const r=o&&o.recipe;if(r&&r.slides)seqs.push(r.slides.map(s=>s.tpl))};
  if(cur){add(cur.out);(cur.old||[]).forEach(add)}
  crSorted().filter(c=>!cur||c.id!==cur.id).slice(0,8).forEach(c=>add(c.out));return seqs.slice(0,10)}
const crOptsOut=o=>Object.assign({},o,{strength:(+o.strength||100)/100});
async function crSend(c,extra){
  const input=Object.assign({id:c.id,title:c.title,photos:c.photos,opts:crOptsOut(c.opts),seed:c.seed,avoid:crAvoid(c)},extra||{});
  await studioCall('job_add',{type:'carousel',input})}

A.crGo=async()=>{const u=crUi(),f=u.form;if(!f||!f.files.length)return;f.title=($('#crTitle')||{}).value||f.title;
  if(!ASSETS){toast('Upload tak tersedia di sini');return}
  try{
    const photos=[];
    for(let i=0;i<f.files.length;i++){const x=f.files[i];
      if(x.id){photos.push({id:x.id,name:x.name,star:x.star});continue}
      u.busy='Upload '+(i+1)+'/'+f.files.length;render(true);
      const sm=await crShrink(x.file);if(sm.size>20*1048576){toast(x.name+' terlalu besar, dilangkau');continue}
      const r=await ASSETS.upload(sm);x.id=r.id;photos.push({id:r.id,name:x.name,star:x.star})}
    if(!photos.length)throw new Error('tiada gambar');
    u.busy='Hantar ke Mac mini';render(true);
    const old=f.id&&get('carousel',f.id);
    const c=save('carousel',Object.assign({},old||{},{id:f.id||undefined,title:f.title.trim()||('Carousel '+fmtShort(Date.now())),photos,opts:Object.assign({},f.opts),
      seed:Math.floor(Math.random()*1e9),lock:[],status:'queued',pct:0,msg:'Menunggu Mac mini',err:'',asked:Date.now()}),true);
    await crSend(c);
    f.files.forEach(x=>x.url&&x.file&&URL.revokeObjectURL(x.url));u.form=null;u.busy='';u.open=c.id;render(true);toast('Dihantar. Mac mini sedang buat')}
  catch(e){u.busy='';render(true);toast('Tak berjaya: '+String((e&&(e.message||e.code))||'semak internet').slice(0,80))}};

/* ---------- butiran ---------- */
A.crOpen=el=>{const u=crUi();u.open=el.dataset.id;u.form=null;render(true);window.scrollTo(0,0)};
A.crBack=()=>{crUi().open='';render(true)};
function crDetail(c){const o=c.out||{},enh=(c.opts||{}).mode==='enhance',lock=c.lock||[];
  const running=c.status==='queued'||c.status==='run';
  const wait=c.status==='queued'&&Date.now()-(c.asked||c.updated||0)>3*60000;
  let body='';
  if(running)body+=`<div class="card glass"><div class="stbar"><div class="stt"><span>${esc(c.msg||'Menunggu Mac mini')}</span><span>${c.pct||0}%</span></div><div class="stg"><i style="width:${Math.max(3,c.pct||0)}%"></i></div></div>
    ${wait?`<p class="meta" style="margin:8px 0 0;color:var(--warn)">Mac mini belum ambil. Pastikan Mac mini hidup dan carousel_setup.sh dah dijalankan.</p>`:'<p class="meta" style="margin:8px 0 0">Biasanya 1 hingga 3 minit. Boleh tutup app, hasil akan ada di sini.</p>'}</div>`;
  if(c.status==='error')body+=`<div class="card glass"><p class="meta" style="color:var(--bad);margin:0 0 10px">${esc(c.err||'Gagal')}</p><button class="btn solid tab" data-act="crRetry">Cuba lagi</button></div>`;
  if(enh&&o.photos&&o.photos.length)body+=`<div class="crgrid">${o.photos.map(id=>`<a href="${esc(crImg(id))}" target="_blank" rel="noopener"><img src="${esc(crImg(id))}" alt="" loading="lazy"></a>`).join('')}</div>
    <p class="meta">Tekan gambar untuk buka saiz penuh, kemudian tekan lama untuk simpan.</p>`;
  if(!enh&&o.slides&&o.slides.length){
    body+=`<div class="crswipe">${o.slides.map((id,i)=>`<div class="crslide"><img src="${esc(crImg(id))}" alt="Slide ${i+1}" loading="lazy">
       <span class="crno">${i+1}/${o.slides.length}</span>
       <button class="crlock${lock.includes(i)?' on':''}" data-act="crLock" data-i="${i}" aria-label="Kunci slide ${i+1}">${lock.includes(i)?'Dikunci':'Kunci'}</button>
       <a class="crsave" href="${esc(crImg(id))}" target="_blank" rel="noopener" aria-label="Buka slide ${i+1}">${IC.dl}</a></div>`).join('')}</div>
     <p class="meta" style="margin:6px 0 12px">Swipe untuk tengok. Kunci slide yang dah cantik, kemudian Shuffle: yang lain sahaja bertukar.</p>
     ${o.preview?`<p class="eyebrow">Sambungan (segi tiga = garis potong)</p><a href="${esc(crImg(o.preview))}" target="_blank" rel="noopener"><img class="crstrip" src="${esc(crImg(o.preview))}" alt="Preview sambungan" loading="lazy"></a>`:''}`}
  if(o.warnings&&o.warnings.length)body+=`<ul class="meta crwarn">${o.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>`;
  const acts=`<div class="btns" style="margin:14px 0">${!running?`<button class="btn solid tab" data-act="crShuffle">${enh?'Enhance semula':'Shuffle'}${lock.length?' ('+lock.length+' dikunci)':''}</button><button class="btn" data-act="crEdit">Tukar setting</button>`:''}
    ${o.folder?`<a class="btn" href="https://drive.google.com/drive/folders/${esc(o.folder)}" target="_blank" rel="noopener">${IC.ext}Drive</a>`:''}<button class="btn bad" data-act="crDel">${IC.trash}Padam</button></div>`;
  const old=(c.old||[]).filter(x=>x&&(x.thumb||(x.photos||[])[0]));
  const oldRow=old.length?`<p class="eyebrow" style="margin-top:8px">Versi sebelum ni (tekan untuk guna semula)</p><div class="crold">${old.map((x,i)=>`<button data-act="crUseOld" data-i="${i}"><img src="${esc(crImg(x.thumb||x.photos[0]))}" alt="Versi ${i+2}" loading="lazy"></button>`).join('')}</div>`:'';
  const op=c.opts||{};const desc=enh?'Enhance '+op.enhance:`${op.slides} slide · ${op.aspect} · ${o.recipe?o.recipe.vibe:op.vibe} · cutout ${op.cutout} · warna ${op.enhance}`;
  return `<div class="head"><div><p class="eyebrow">${esc(desc)}</p><h1>${esc(c.title||'Carousel')}</h1></div><div class="btns"><button class="btn" data-act="crBack">${IC.back}Senarai</button></div></div>`+body+acts+oldRow}

A.crLock=el=>{const c=get('carousel',crUi().open);if(!c)return;const i=+el.dataset.i;const L=(c.lock||[]).slice();const k=L.indexOf(i);if(k>=0)L.splice(k,1);else L.push(i);save('carousel',Object.assign({},c,{lock:L.sort((a,b)=>a-b)}))};
A.crShuffle=async()=>{const c=get('carousel',crUi().open);if(!c)return;
  const lock=(c.lock||[]).filter(i=>c.out&&c.out.slides&&i<c.out.slides.length);
  const n=save('carousel',Object.assign({},c,{seed:Math.floor(Math.random()*1e9),status:'queued',pct:0,msg:'Menunggu Mac mini',err:'',asked:Date.now()}));
  try{await crSend(n,lock.length?{lock,recipe:(c.out||{}).recipe||{}}:{});toast(lock.length?'Shuffle, '+lock.length+' slide dikunci':'Shuffle dihantar')}
  catch(e){save('carousel',Object.assign({},n,{status:'error',err:'Tak dapat hantar ke Mac mini. Semak internet'}));}};
A.crRetry=A.crShuffle;
A.crEdit=()=>{const c=get('carousel',crUi().open);if(!c)return;
  crUi().form={id:c.id,title:c.title||'',files:(c.photos||[]).map(p=>Object.assign({},p)),opts:Object.assign({},CR_DEF,c.opts||{}),touched:true};render(true)};
A.crUseOld=el=>{const c=get('carousel',crUi().open);if(!c)return;const i=+el.dataset.i;const old=(c.old||[]).slice();const pick=old.splice(i,1)[0];if(!pick)return;
  if(c.out)old.unshift(c.out);save('carousel',Object.assign({},c,{out:pick,old,lock:[]}));toast('Versi lama digunakan')};
A.crDel=()=>{const c=get('carousel',crUi().open);if(!c)return;confirmBox('Padam carousel ni? Gambar dan slide dalam Drive dibuang juga',()=>{
  const ids=[];(c.photos||[]).forEach(p=>ids.push(p.id));[c.out].concat(c.old||[]).forEach(o=>{if(!o)return;(o.slides||[]).concat(o.photos||[],[o.preview,o.thumb]).forEach(x=>x&&ids.push(x))});
  if(ASSETS)ids.forEach(id=>ASSETS.delete(id).catch(()=>{}));del('carousel',c.id);crUi().open='';closeModal();toast('Dipadam')})};
