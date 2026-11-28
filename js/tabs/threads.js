/* ---------- THREADS: gambar cantik + ayat ikut gaya Mira ----------
   1. Upload gambar (sampai 10) > edit dalam phone (preset, cerah, warna, potong 4:5 / 1:1). Tiada token, gambar tak naik ke Drive.
   2. Tulis point atau sebut (mic) > Claude di Mac mini tulis 3 versi ikut gaya Mira. Setiap versi kotak boleh edit, copy terus.
   3. Belajar: bila Mira copy, versi yang dia edit disimpan sebagai contoh sebenar (koleksi threads). Contoh terbaru masuk dalam prompt,
      dan butang "Belajar gaya" minta Claude ringkaskan gaya + cadangan untuk naikkan posting (settings.thStyle). */
const TH_PLAT=['Threads','Instagram','Facebook','TikTok'];const TH_MAX=500,TH_TONE=['Auto','Santai','Cerita','Tips','Soalan','Jual lembut'];
const TH_PRE={asli:{l:'Asli',b:0,c:0,s:0,w:0},cantik:{l:'Auto cantik',b:8,c:10,s:14,w:4},cerah:{l:'Cerah',b:16,c:4,s:6,w:2},hangat:{l:'Hangat',b:6,c:6,s:10,w:16},
  pastel:{l:'Pastel',b:14,c:-12,s:-10,w:6},pop:{l:'Pop',b:4,c:18,s:28,w:0},filem:{l:'Filem',b:2,c:-6,s:-18,w:10},sejuk:{l:'Sejuk',b:6,c:6,s:4,w:-14}};
const TH_RATIO={asal:'Asal','4:5':'4:5','1:1':'1:1','3:4':'3:4'};
const thUi=()=>ui.th||(ui.th={imgs:[],ext:[],from:'',plat:'Threads',sel:0,points:'',tone:'Auto',thread:false,res:null,edit:{},postIds:{},busy:false,learnBusy:false});
const thStyle=()=>(S.settings&&S.settings.thStyle)||{};
const thPosts=()=>S.threads.slice().sort((a,b)=>(b.created||0)-(a.created||0));
const thFinal=p=>String(p.final||'').trim();

/* ---------- gambar: edit dengan canvas ---------- */
function thFilter(e){const b=100+e.b,c=100+e.c,s=100+e.s;return `brightness(${b}%) contrast(${c}%) saturate(${s}%)`+(e.w>0?` sepia(${e.w*0.9}%)`:'')+(e.w<0?` hue-rotate(${e.w*0.8}deg)`:'')}
function thCrop(img,ratio){const W=img.naturalWidth,H=img.naturalHeight;if(ratio==='asal')return {sx:0,sy:0,sw:W,sh:H};
  const [a,b]=ratio.split(':').map(Number);const r=a/b;let sw=W,sh=W/r;if(sh>H){sh=H;sw=H*r}return {sx:(W-sw)/2,sy:(H-sh)/2,sw,sh}}
function thRender(im){const c=thCrop(im.el,im.ratio);const k=Math.min(1,2160/Math.max(c.sw,c.sh));const cv=document.createElement('canvas');
  cv.width=Math.round(c.sw*k);cv.height=Math.round(c.sh*k);const x=cv.getContext('2d');x.filter=thFilter(im.e);x.drawImage(im.el,c.sx,c.sy,c.sw,c.sh,0,0,cv.width,cv.height);
  if(im.e.w<0){x.filter='none';x.globalCompositeOperation='soft-light';x.fillStyle=`rgba(90,140,220,${-im.e.w/100})`;x.fillRect(0,0,cv.width,cv.height)}
  return cv}
const thBlob=im=>new Promise(r=>thRender(im).toBlob(r,'image/jpeg',0.92));
function thAddImgs(files){const t=thUi();files.filter(f=>/^image\//.test(f.type)).slice(0,10-t.imgs.length-(t.ext||[]).length).forEach(f=>{const url=URL.createObjectURL(f);const el=new Image();
  const im={id:uid(),name:f.name.replace(/\.[^.]+$/,''),url,el,ratio:'asal',pre:'asli',e:Object.assign({},TH_PRE.asli)};el.onload=()=>render(true);el.src=url;t.imgs.push(im)});
  t.sel=Math.max(0,t.imgs.length-1);render(true)}
function thImgBox(){const t=thUi();const ext=t.ext||[];const n=t.imgs.length+ext.length;
  const thumbs=ext.map((x,i)=>`<div class="thth on ptx"><img src="${esc(studioFileUrl(x.id))}" alt=""><button class="ptrm" data-act="thExtRm" data-x="${i}" aria-label="Buang">${IC.x}</button></div>`).join('')+
    t.imgs.map((x,i)=>`<div class="thth on ptx"><img src="${x.url}" alt=""><button class="ptrm" data-act="thImgRm" data-x="${i}" aria-label="Buang">${IC.x}</button></div>`).join('')+
    (n<10?`<button class="thth add" data-act="thPick" aria-label="Tambah gambar">${IC.plus}</button>`:'');
  return `<div class="card big glass"><span class="num">1 · Gambar${t.from?' dari Design: '+esc(t.from):''}</span>
    <p class="meta" style="margin:6px 0 10px">${n?n+' gambar.':'Pilih gambar siap (sampai 10), atau hantar dari Design.'} Tiada edit di sini. Nak tukar rupa? Buka <a href="#carousel">Design</a>.</p>
    <div class="thrail">${thumbs}</div>
    ${n?`<div class="btns" style="margin-top:12px;gap:6px"><button class="btn sm solid tab" data-act="thSave">${IC.dl}Simpan ${n>1?'semua':''}</button>${navigator.share?`<button class="btn sm" data-act="thShare">${IC.ext}Share</button>`:''}</div>`:''}</div>`}
A.thPick=()=>pickFile('image/*',fs=>thAddImgs(fs),true);
A.thImgRm=el=>{const t=thUi();const im=t.imgs.splice(+el.dataset.x,1)[0];if(im)URL.revokeObjectURL(im.url);render(true)};
A.thExtRm=el=>{const t=thUi();(t.ext||[]).splice(+el.dataset.x,1);if(!(t.ext||[]).length)t.from='';render(true)};
async function thFiles(){const t=thUi();const out=[];
  for(const x of t.ext||[]){try{const r=await fetch(studioFileUrl(x.id),{mode:'cors'});if(!r.ok)throw 0;out.push(new File([await r.blob()],(x.name||'gambar')+'.jpg',{type:'image/jpeg'}))}
    catch(e){window.open(studioFileUrl(x.id),'_blank');}}
  for(const im of t.imgs){const b=await thBlob(im);out.push(new File([b],'posting-'+(im.name||'gambar')+'.jpg',{type:'image/jpeg'}))}return out}
A.thSave=async()=>{const fs=await thFiles();for(const f of fs){await DL_save(f);await new Promise(r=>setTimeout(r,350))}toast(fs.length+' gambar disimpan')};
const DL_save=f=>{const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000)};
A.thShare=async()=>{const fs=await thFiles();const i=thCurIdx();const txt=thCurText();const d={files:fs};if(txt)d.text=txt;
  if(txt)copyText(txt,'Ayat dicopy. Paste dalam Threads kalau tak masuk sendiri');
  try{if(navigator.canShare&&!navigator.canShare(d))delete d.text;await navigator.share(d);if(txt)thLearn(i)}catch(e){if(e.name!=='AbortError')toast('Tak dapat share. Guna Simpan')}};
/* ---------- ayat ---------- */
const thParts=txt=>String(txt||'').split(/\n\s*-{3,}\s*\n/).map(s=>s.trim()).filter(Boolean);
/* Share: versi pertama yang belum dicopy */
function thCurIdx(){const t=thUi();if(!t.res)return -1;const i=t.res.versions.findIndex((v,k)=>!t.postIds[k]);return i<0?0:i}
function thCurText(){const t=thUi();const i=thCurIdx();const v=t.res&&t.res.versions[i];return v?thParts(t.edit[i]??v.text).join('\n\n'):''}
function thTextBox(){const t=thUi();const st=thStyle();
  return `<div class="card big glass" style="margin-top:12px"><span class="num">2 · Apa kau nak cakap</span>
    <label class="f" style="margin-top:8px"><span class="inwrap" style="align-items:flex-start"><textarea class="inp" id="thPts" data-thf="points" rows="5" placeholder="Tulis point, sepatah dua pun boleh. Atau tekan mic dan cakap macam biasa.">${esc(t.points)}</textarea>${DICT?`<button type="button" class="btn icon sm ${t.rec?'solid rose':''}" data-act="thMic" aria-label="Cakap">${IC.mic}</button>`:''}</span></label>
    <span class="num" style="display:block;margin:4px 0 6px">Untuk</span>
    <div class="btns" style="gap:6px;margin-bottom:10px">${TH_PLAT.map(a=>`<button class="btn sm ${(t.plat||'Threads')===a?'solid tab':''}" data-act="thPlat" data-x="${a}" aria-pressed="${t.plat===a}">${a}</button>`).join('')}</div>
    <span class="num" style="display:block;margin:4px 0 6px">Nada</span>
    <div class="btns" style="gap:6px">${TH_TONE.map(a=>`<button class="btn sm ${t.tone===a?'solid tab':''}" data-act="thTone" data-x="${a}" aria-pressed="${t.tone===a}">${a}</button>`).join('')}</div>
    ${(t.plat||'Threads')==='Threads'?`<div style="margin-top:10px">${chk(t.thread,'thThread','','Pecah jadi thread bersiri (lebih 500 aksara)')}</div>`:''}
    <div class="btns" style="margin-top:14px"><button class="btn ${t.points.trim()?'solid tab':''}" data-act="thGen"${t.busy?' disabled':''}>${t.busy?'Sedang tulis...':IC.ideas+'Tulis 3 versi'}</button>${tok(TOK.threads,'3 versi, isi sama, ayat lain')}</div>
    <p class="meta" style="margin:10px 0 0">${t.busy?ldr('Claude sedang tulis'):`Belajar dari ${thPosts().filter(thFinal).length} posting kau${st.notes&&st.notes.length?' + nota gaya':''}.`}</p></div>`}
function thResBox(){const t=thUi();if(!t.res)return '';
  const box=(v,i)=>{const txt=t.edit[i]??v.text;const parts=thParts(txt);const done=t.postIds[i];
    return `<div class="card glass" style="margin-top:12px"><div class="rowh" style="align-items:center"><span class="num">Versi ${i+1} · hari ${i+1}</span>${done?`<span class="pill" style="--pc:var(--ok)">Dicopy</span>`:''}</div>
      <textarea class="inp" id="thOut${i}" data-thedit="${i}" rows="${Math.max(6,Math.ceil(txt.length/34)+2)}" style="margin-top:8px;font-size:15px;line-height:1.5">${esc(txt)}</textarea>
      <div class="rowh" style="align-items:center;margin-top:8px"><span class="meta" id="thCount${i}">${thCountTxt(parts)}</span>
      <div class="btns" style="gap:6px">${t.edit[i]!=null?`<button class="btn sm" data-act="thReset" data-x="${i}">Asal</button>`:''}<button class="btn sm solid tab" data-act="thCopy" data-x="${i}">${IC.copy}Copy</button></div></div>
      ${parts.length>1?`<div class="btns" style="gap:6px;margin-top:8px">${parts.map((p,k)=>`<button class="btn sm" data-act="thCopyPart" data-x="${i}|${k}">${IC.copy}Post ${k+1}</button>`).join('')}</div>`:''}</div>`};
  return `<p class="eyebrow" style="margin:20px 0 0">3 versi · isi sama, ayat lain · satu untuk setiap hari</p>${t.res.versions.map(box).join('')}
    <p class="meta" style="margin:8px 0 0">Betulkan terus dalam kotak, kemudian Copy. Apa yang kau betulkan, aku belajar.</p>
    ${(t.res.tips||[]).length?`<div class="card glass" style="margin-top:12px"><span class="num">Cadangan</span><ul class="thtips">${t.res.tips.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
    <div class="btns" style="margin-top:10px"><button class="btn sm" data-act="thGen" data-x="again"${t.busy?' disabled':''}>${IC.ideas}Tulis semula</button>${tok(TOK.threads,'3 versi baru')}</div>`}
const thCountTxt=parts=>(ui.th&&ui.th.plat&&ui.th.plat!=='Threads')?`${(parts[0]||'').length} aksara`:parts.length>1?parts.map((p,i)=>`Post ${i+1}: ${p.length}`).join(' · '):`${(parts[0]||'').length}/${TH_MAX} aksara${(parts[0]||'').length>TH_MAX?' · terlebih, tanda thread bersiri':''}`;
document.addEventListener('input',e=>{const el=e.target;if(!el.dataset)return;const t=ui.th;if(!t)return;
  if(el.dataset.thf)t[el.dataset.thf]=el.value;
  else if(el.dataset.thedit!=null){const i=+el.dataset.thedit;t.edit[i]=el.value;const c=$('#thCount'+i);if(c)c.textContent=thCountTxt(thParts(el.value))}});
A.thTone=el=>{thUi().tone=el.dataset.x;render(true)};
A.thPlat=el=>{thUi().plat=el.dataset.x;render(true)};
A.thThread=()=>{const t=thUi();t.thread=!t.thread;render(true)};
A.thReset=el=>{delete thUi().edit[+el.dataset.x];render(true)};
A.thMic=async()=>{const t=thUi();if(!DICT)return;if(t.rec){t.rec=false;DICT.stop().catch(()=>{});render(true);return}
  if(!ui.thDict){ui.thDict=true;DICT.onFinal(({text})=>{if(!ui.th||!ui.th.rec)return;ui.th.points=(ui.th.points?ui.th.points.replace(/\s+$/,'')+' ':'')+text;const n=$('#thPts');if(n)n.value=ui.th.points});
    DICT.onState(({state})=>{if(state==='idle'&&ui.th&&ui.th.rec){ui.th.rec=false;render(true)}})}
  try{t.rec=true;render(true);await DICT.start({language:'ms'});toast('Cakaplah. Tekan mic lagi bila siap')}catch(e){t.rec=false;render(true);toast('Benarkan mic dalam Settings')}};
A.thCopy=el=>{const i=+el.dataset.x;const txt=(($('#thOut'+i)||{}).value||'').trim();if(!txt)return;copyText(thParts(txt).join('\n\n'),'Versi '+(i+1)+' dicopy. Paste dalam '+(thUi().plat||'Threads'));thLearn(i)};
A.thCopyPart=el=>{const [i,k]=el.dataset.x.split('|').map(Number);const p=thParts((($('#thOut'+i)||{}).value||''))[k];if(p){copyText(p,'Post '+(k+1)+' dicopy');thLearn(i)}};

/* Simpan versi akhir Mira (setiap versi berasingan; copy semula = kemaskini). Setiap 5 posting baru, belajar gaya sendiri. */
function thLearn(i){const t=thUi();if(!t.res)return;const v=t.res.versions[i];if(!v)return;const fin=String(t.edit[i]??v.text).trim();if(!fin)return;
  const o=t.postIds[i]&&get('threads',t.postIds[i])||{};const edited=fin!==String(v.text).trim();
  const p=save('threads',Object.assign({},o,{points:t.points.trim(),tone:t.tone,draft:v.text,final:fin,edited,day:i+1}),true);t.postIds[i]=p.id;render(true);thAutoStudy()}
function thAutoStudy(){const last=thStyle().learnedAt||0;const ps=thPosts().filter(thFinal);const fresh=ps.filter(x=>(x.updated||0)>last).length;
  if(ps.length>=3&&(fresh>=5||(!last&&ps.length>=3)))A.thStudy()}

function thPrompt(again){const t=thUi();const st=thStyle();const ex=thPosts().filter(p=>thFinal(p)&&!p.edited).slice(0,8);
  const edits=thPosts().filter(p=>p.edited&&p.draft).slice(0,6);
  const pl=t.plat||'Threads',isTh=pl==='Threads';
  return `Kau penulis posting ${pl} untuk Mira (@miracikcit), content creator Malaysia (lifestyle, produk, vlog, keluarga).
Tulis 3 versi posting ${pl} dari point Mira di bawah. Ketiga-tiga versi bawa ISI DAN MESEJ YANG SAMA, tapi ayat, hook dan susunan berlainan, sebab setiap satu akan di-post pada hari berbeza. Setiap versi berdiri sendiri, jangan rujuk versi lain. MESTI bunyi macam Mira tulis sendiri, bukan macam AI.
${st.summary?'\\nGAYA MIRA (dipelajari):\\n'+st.summary+'\\n':''}${st.notes&&st.notes.length?'Peraturan gaya:\\n- '+st.notes.join('\\n- ')+'\\n':''}${edits.length?'\\nPEMBETULAN MIRA (draf kau vs versi yang dia betulkan; ini paling penting, jangan ulang kesilapan draf):\\n'+edits.map(p=>`DRAF: ${p.draft}\\nMIRA: ${p.final}`).join('\\n\\n')+'\\n':''}${ex.length?'\\nCONTOH POSTING SEBENAR MIRA:\\n'+ex.map((p,i)=>`[${i+1}] ${p.final}`).join('\\n\\n')+'\\n':''}
POINT MIRA:
${t.points.trim()}
${t.imgs.length?`\\nPosting ni ada ${t.imgs.length} gambar.\\n`:''}Nada: ${t.tone==='Auto'?'ikut point':t.tone}
${!isTh?'Setiap versi satu caption '+pl+', 80 hingga 600 aksara'+(pl==='Facebook'?', tanpa hashtag atau 1 sahaja.':', 3 hingga 5 hashtag relevan di hujung.'):t.thread?'Pecahkan setiap versi jadi thread bersiri 2 hingga 5 post. Asingkan setiap post dengan baris "---". Setiap post bawah 500 aksara, post pertama hook paling kuat.':'Setiap versi satu post sahaja, bawah 500 aksara.'}
Peraturan: hook di baris pertama (berhenti scroll), ayat pendek, perenggan pendek,${isTh?' maksimum 1 hashtag atau tiada,':''} jangan reka fakta yang tiada dalam point, tiada harga melainkan Mira tulis.${again?'\\nIni permintaan tulis semula: ayat lain dari sebelum ni. ('+Date.now()+')':''}
tips: 2 cadangan ringkas untuk naikkan engagement (cth. soalan penutup, masa post, gambar mana dulu).
Balas JSON sahaja: {"versions":[{"text":".."},{"text":".."},{"text":".."}],"tips":[".."]}`}
A.thGen=async el=>{const t=thUi();if(!t.points.trim()){toast('Tulis point dulu');const n=$('#thPts');if(n)n.focus();return}
  if(!SAMPLE){toast('Generate tak tersedia sekarang');return}
  if(t.rec){t.rec=false;DICT&&DICT.stop().catch(()=>{})}
  t.busy=true;render(true);
  try{const j=await SAMPLE.json(thPrompt(el&&el.dataset.x==='again'));const vs=(j&&Array.isArray(j.versions)?j.versions:[]).filter(x=>x&&x.text).slice(0,3).map(x=>({text:String(x.text).trim()}));
    if(!vs.length)throw new Error('kosong');t.res={versions:vs,tips:(Array.isArray(j.tips)?j.tips:[]).map(String).slice(0,3)};t.edit={};t.postIds={};toast('3 versi siap')}
  catch(e){if(!(e&&(e.code==='declined'||e.name==='AbortError')))toast(e&&e.code==='timeout'?'Mac mini lambat jawab. Cuba lagi sekejap':'Tak berjaya. Semak Mac mini hidup')}
  finally{t.busy=false;render(true)}};

/* ---------- belajar gaya + cadangan ---------- */
function thStyleBox(){const st=thStyle();const t=thUi();const ps=thPosts().filter(thFinal);const ed=ps.filter(p=>p.edited).length;
  return `<div class="card glass" style="margin-top:22px"><div class="rowh" style="align-items:center"><span class="num">Gaya kau</span><span class="meta">${ps.length} contoh · ${ed} kau edit</span></div>
    ${st.summary?`<p style="margin:8px 0 0;font-size:14px">${esc(st.summary)}</p>`:`<p class="meta" style="margin:8px 0 0">Belum belajar. Copy beberapa posting dulu, atau tampal posting lama kau.</p>`}
    ${st.notes&&st.notes.length?`<ul class="thtips">${st.notes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
    ${st.tips&&st.tips.length?`<span class="num" style="display:block;margin-top:12px">Cadangan untuk naikkan posting kau</span><ul class="thtips">${st.tips.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
    ${st.learnedAt?`<p class="meta" style="margin:6px 0 0">Kemaskini ${fmtD(st.learnedAt)}</p>`:''}
    <div class="btns" style="gap:6px;margin-top:12px"><button class="btn sm" data-act="thPasteOld">${IC.plus}Tampal posting lama</button><button class="btn sm" data-act="thShotOld"${t.shotBusy?' disabled':''}>${t.shotBusy?'<i class="spin"></i>'+esc(t.shotBusy):'🖼 Upload gambar posting'}</button></div>
    <p class="meta" style="margin:8px 0 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap">${t.learnBusy?ldr('Sedang belajar gaya kau'):`Belajar sendiri setiap 5 posting baru (${ps.filter(x=>(x.updated||0)>(st.learnedAt||0)).length}/5)`}${tok(TOK.thstyle,'belajar gaya, auto')}</p></div>`}
A.thPasteOld=()=>modal(`<h2>Tampal posting lama</h2><p class="meta">Tampal posting Threads kau yang perform. Asingkan setiap posting dengan baris kosong berganda atau ---.</p>
  <textarea class="inp" id="thOld" rows="10" style="margin:10px 0"></textarea><div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="thOldOk">Simpan</button></div>`,TAB.threads.c);
A.thOldOk=()=>{const v=(($('#thOld')||{}).value||'');const ps=v.split(/\n\s*-{3,}\s*\n|\n\s*\n\s*\n/).map(s=>s.trim()).filter(s=>s.length>=15);
  if(!ps.length){toast('Tiada posting');return}ps.forEach(p=>save('threads',{final:p,source:'lama',edited:false},true));closeModal();render(true);toast(ps.length+' posting disimpan sebagai contoh');thAutoStudy()};
A.thStudy=async()=>{const t=thUi();if(t.learnBusy)return;const ps=thPosts().filter(thFinal).slice(0,20);if(ps.length<3||!window.studioJob)return;const st=thStyle();
  const prompt=`Analisis cara Mira (@miracikcit, content creator Malaysia) menulis posting Threads dari contoh sebenar di bawah.
${st.summary?'Ringkasan gaya sebelum ni (kemaskini, jangan buang yang masih betul):\n'+st.summary+'\n':''}
CONTOH (terbaru dulu):
${ps.map((p,i)=>`[${i+1}]${p.edited&&p.draft?' (draf AI: '+p.draft+')\n VERSI MIRA:':''} ${p.final}`).join('\n\n')}

Balas JSON sahaja:
{"summary":"2-3 ayat gaya Mira (bahasa, panjang, nada, emoji, cara buka dan tutup)",
"notes":["5-8 peraturan gaya spesifik yang boleh diikut penulis lain, termasuk perkataan/frasa kegemaran dan apa yang Mira selalu betulkan/buang dari draf AI (DRAF vs VERSI MIRA)"],
"tips":["3-5 cadangan konkrit untuk Mira naikkan engagement Threads, berdasarkan kelemahan dalam contoh"]}`;
  t.learnBusy=true;render(true);
  try{const o=await window.studioJob('ai',{prompt},6*60000);const j=o&&o.json;if(!j||!j.summary)throw new Error('kosong');
    saveSettings({thStyle:{summary:String(j.summary),notes:(j.notes||[]).map(String).slice(0,8),tips:(j.tips||[]).map(String).slice(0,5),learnedAt:Date.now(),n:ps.length}});toast('Gaya kau dikemaskini')}
  catch(e){}
  finally{t.learnBusy=false;render(true)}};

/* ---------- sejarah ---------- */
function thHistory(){const ps=thPosts().filter(thFinal);if(!ps.length)return '';
  return `<p class="eyebrow" style="margin-top:26px">Posting tersimpan · ${ps.length}</p><div class="list">${ps.slice(0,40).map(p=>`<details class="col card glass"><summary><div class="rowh" style="align-items:center"><div style="min-width:0"><h3 style="font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.final.split('\n')[0])}</h3><div class="meta">${fmtD(p.created)}${p.source==='lama'?' · posting lama':p.edited?' · kau edit':''}</div></div><span class="ic chev">${IC.chev}</span></div></summary>
    <div style="white-space:pre-wrap;font-size:14px;margin-top:10px">${esc(p.final)}</div>
    <div class="btns" style="gap:6px;margin-top:10px"><button class="btn sm" data-act="thHCopy" data-id="${p.id}">${IC.copy}Copy</button><button class="btn icon sm bad" data-act="thHDel" data-id="${p.id}" aria-label="Padam">${IC.trash}</button></div></details>`).join('')}</div>`}
A.thHCopy=el=>{const p=get('threads',el.dataset.id);if(p)copyText(thParts(p.final).join('\n\n'),'Dicopy')};
A.thHDel=el=>confirmBox('Padam posting ni? Aku tak akan belajar dari dia lagi.',()=>{del('threads',el.dataset.id);toast('Dipadam')},'Ya, padam');

V.threads=()=>{thUi();return head('Ayat gaya kau, semua social media')+thImgBox()+thTextBox()+thResBox()+thStyleBox()+thHistory()};

/* 24 Nov (Mira): ingat gaya dari gambar. Screenshot posting lama > Mac mini baca teks (Apple Vision, 0 token) > disimpan sebagai contoh gaya. */
A.thShotOld=()=>pickFile('image/*',async fs=>{const t=thUi();if(!ASSETS||!window.studioJob){toast('Perlu sambungan Studio');return}let n=0;
  try{for(let i=0;i<fs.length&&i<10;i++){t.shotBusy='Baca '+(i+1)+'/'+Math.min(fs.length,10);render(true);
      const up=await ASSETS.upload(fs[i]);const o=await window.studioJob('ocr',{file:up.id},2*60000);
      const txt=(o.lines||[]).map(String).filter(l=>!/^\d+[smhj]$|^(like|reply|repost|share|suka|balas)$/i.test(l.trim())).join('\n').trim();
      if(txt.length>=15){save('threads',{final:txt,source:'gambar',edited:false},true);n++}}
    toast(n?n+' posting dari gambar disimpan sebagai contoh gaya':'Tiada teks dijumpai dalam gambar');if(n)thAutoStudy()}
  catch(e){toast('Tak dapat baca gambar. Semak Mac mini hidup')}finally{t.shotBusy=null;render(true)}},true);
