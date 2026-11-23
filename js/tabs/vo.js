/* ---------- VO (rakam VO terus dari phone) ----------
   Senarai video perlu VO = folder 41. TUNGGU VO (sync/toedit) + doc vo/<id> status perlu (Claude tambah masa storyboard).
   Point penting (bukan skrip), Jangan sebut, sasaran saat. Rakam: butang "Ulang ayat tadi" tanda ayat sebelumnya untuk dibuang.
   Mac mini (job vo_take) transkrip + kumpul ayat berulang (default simpan yang terakhir). Mira tick ayat, pilih gap,
   HANTAR (job vo_save): potong, buang senyap hujung, bersihkan bunyi, VO.wav ke folder projek, 41 dipindah ke 28. */
const VO_ST={perlu:['Perlu VO','var(--warn)'],proses:['Mac mini sedang dengar…','var(--c)'],semak:['Semak ayat','#5A8FB5'],simpan:['Sedang simpan…','var(--c)'],siap:['Siap','#4E9B63'],error:['Ralat','var(--bad)']};
const voId=sub=>'vo-'+String(sub).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);
const voRec={mr:null,chunks:[],t0:0,marks:[],timer:null,blob:null,url:''};
/* Auto: 41. TUNGGU VO + semua folder yang ada "VLOG" pada nama. Mira boleh Buang dari senarai (status buang) atau Tambah video lain. */
const voAuto=name=>name==='41. TUNGGU VO'||/vlog/i.test(name);
function voAll(){
  const out=[],seen=new Set();
  ((S.sync.toedit||{}).stages||[]).filter(s=>voAuto(s.name)).forEach(st=>st.items.forEach(it=>{const id=voId(it.name);if(seen.has(id))return;const d=get('vo',id);seen.add(id);
    out.push(Object.assign({id,folder:st.name,sub:it.name,status:'perlu',points:[]},d||{},{_new:!d}))}));
  S.vo.forEach(d=>{if(!seen.has(d.id))out.push(d)});return out}
function voList(){const wk=Date.now()-3*864e5;
  return voAll().filter(d=>d.status!=='buang'&&(d.status!=='siap'||(d.done||0)>wk)).sort((a,b)=>(a.status==='siap')-(b.status==='siap')||(b.updated||0)-(a.updated||0))}
const voHidden=()=>voAll().filter(d=>d.status==='buang');
const voPending=()=>voList().filter(d=>d.status!=='siap');
function voEnsure(d){if(!d._new)return get('vo',d.id);const o=Object.assign({},d);delete o._new;return save('vo',o,true)}
const voPill=d=>{const [l,c]=VO_ST[d.status]||VO_ST.perlu;return `<span class="pill" style="--pc:${c}">${l}</span>`};
const voKeptDur=d=>((d.take||{}).segs||[]).filter(x=>x.keep).reduce((a,x)=>a+(x.e-x.s),0);
V.vo=()=>{const d=ui.voOpen&&voList().find(x=>x.id===ui.voOpen);if(d)return voDetail(d);const list=voList(),n=voPending().length;
  const hid=voHidden();
  return head(n?n+' video perlu VO':'Rakam VO terus dari phone',`<button class="btn sm" data-act="voAdd">${IC.plus}Tambah</button>`)+`<div class="list">${list.map(d=>`<div class="card glass" style="position:relative">
    <button style="all:unset;display:block;cursor:pointer;width:100%" data-act="voOpen" data-id="${esc(d.id)}"><div class="rowh" style="align-items:center;padding-right:34px"><div><h3 style="margin:0">${esc(d.sub||d.title||d.id)}</h3><div class="meta">${esc((d.folder||'').replace(/^\d+\.\s*/,''))}${d.target?' · sasaran ±'+d.target+' s':''}${(d.vos||[]).length?' · '+d.vos.length+' VO · '+voTot(d)+' s'+(d.target?' / '+d.target+' s':''):d.status==='siap'&&d.voDur?' · VO '+d.voDur+' s':''}</div></div>${voPill(d)}</div></button>
    ${d.status==='siap'?'':`<button class="btn sm" style="position:absolute;top:8px;right:8px;padding:6px" data-act="voHide" data-id="${esc(d.id)}" aria-label="Buang dari senarai VO" title="Buang dari senarai">${IC.x}</button>`}</div>`).join('')||`<div class="empty">Tiada video perlu VO. Folder 41. TUNGGU VO dan semua folder VLOG masuk sini sendiri.</div>`}</div>
    ${hid.length?`<details style="margin-top:14px"><summary class="meta">Dibuang dari senarai (${hid.length})</summary><div class="list" style="margin-top:8px">${hid.map(d=>`<div class="rowh" style="align-items:center;padding:6px 4px"><span>${esc(d.sub||d.id)} <small class="meta">${esc((d.folder||'').replace(/^\d+\.\s*/,''))}</small></span><button class="btn sm" data-act="voUnhide" data-id="${esc(d.id)}">Pulihkan</button></div>`).join('')}</div></details>`:''}`};
A.voHide=el=>{const d=voAll().find(x=>x.id===el.dataset.id);if(!d)return;const o=voEnsure(d);save('vo',Object.assign({},o,{status:'buang',prev:o.status==='buang'?'perlu':o.status}));toast('Dibuang dari senarai VO')};
A.voUnhide=el=>{const d=get('vo',el.dataset.id);if(d)save('vo',Object.assign({},d,{status:d.prev&&d.prev!=='buang'?d.prev:'perlu'}))};
A.voAdd=()=>{const have=new Set(voList().map(d=>d.id));
  const opts=((S.sync.toedit||{}).stages||[]).map(st=>({st:st.name,items:st.items.filter(it=>!have.has(voId(it.name)))})).filter(g=>g.items.length);
  modal(`<h2>Tambah video perlu VO</h2>${opts.length?`<div class="list" style="max-height:60vh;overflow:auto">${opts.map(g=>`<p class="eyebrow" style="margin:10px 0 4px">${esc(g.st)}</p>${g.items.map(it=>`<button class="btn" style="justify-content:flex-start;width:100%;margin-bottom:6px" data-act="voAddPick" data-id="${esc(g.st)}" data-x="${esc(it.name)}">${esc(it.name)}</button>`).join('')}`).join('')}</div>`:'<p class="meta">Semua folder edit dah ada dalam senarai.</p>'}
  <div class="btns" style="justify-content:flex-end;margin-top:10px"><button class="btn" data-act="closeModal">Tutup</button></div>`,TAB.vo.c)};
A.voAddPick=el=>{const id=voId(el.dataset.x),cur=get('vo',id);save('vo',Object.assign({id,folder:el.dataset.id,sub:el.dataset.x,points:[]},cur||{},{status:'perlu'}));closeModal();toast('Ditambah ke senarai VO')};
function voDetailOld(d){
  const back=`<button class="btn sm" data-act="voBack">${IC.back}Senarai</button>`;
  const pts=(d.points||[]).filter(Boolean),ban=(d.banned||[]).filter(Boolean);
  const top=`<div class="card glass"><div class="rowh" style="align-items:center"><div><h2 style="margin:0">${esc(d.sub||d.id)}</h2><div class="meta">${esc(d.folder||'')}${d.target?' · sasaran ±'+d.target+' s':''}</div></div>${voPill(d)}</div>
    ${pts.length?`<ol style="margin:12px 0 0;padding-left:22px;font-size:17px;line-height:1.5">${pts.map(p=>`<li>${esc(p)}</li>`).join('')}</ol>`:`<p class="meta" style="margin:10px 0 0">Point belum ada. Claude isi masa storyboard, atau tekan Edit point.</p>`}
    ${ban.length?`<p style="margin:10px 0 0;color:var(--bad)">Jangan sebut: ${ban.map(esc).join(', ')}</p>`:''}
    <div class="btns" style="margin-top:10px"><button class="btn sm" data-act="voEditPts" data-id="${esc(d.id)}">${IC.edit}Edit point</button></div></div>`;
  let body='';
  if(voRec.mr)body=`<div class="card glass" style="text-align:center"><p class="eyebrow">Sedang rakam</p><div id="voClock" style="font-size:44px;font-weight:700">0:00</div>
    <p class="meta" id="voMarks">${voRec.marks.length?voRec.marks.length+' ayat ditanda untuk buang':'Tersasul? Tekan butang bawah dan terus cakap semula.'}</p>
    <div class="btns" style="justify-content:center;flex-direction:column;gap:12px;margin-top:12px"><button class="btn" style="font-size:18px;padding:16px" data-act="voMark">${IC.x}Ulang ayat tadi</button><button class="btn solid rose" style="font-size:18px;padding:16px" data-act="voStop">Berhenti</button></div></div>`;
  else if(voRec.blob&&ui.voRecFor===d.id)body=`<div class="card glass"><p class="eyebrow">Rakaman siap</p><audio controls src="${voRec.url}" style="width:100%"></audio>
    <div class="btns" style="margin-top:12px"><button class="btn solid tab" data-act="voSend" data-id="${esc(d.id)}">${IC.check}Hantar ke Mac mini</button><button class="btn" data-act="voDiscard">Rakam semula</button></div></div>`;
  else if(d.status==='proses'||d.status==='simpan')body=`<div class="card glass"><p class="meta">${d.status==='proses'?'Mac mini sedang buat transkrip dan cari ayat berulang (1–2 minit).':'Mac mini sedang potong dan bersihkan VO.'}</p></div>`;
  else if(d.status==='semak'&&d.take)body=voReview(d);
  else if(d.status==='siap')body=`<div class="card glass"><p>VO siap${d.voDur?' ('+d.voDur+' s)':''}.</p><p class="meta">${esc(d.file||'')}</p><div class="btns"><button class="btn" data-act="voStart" data-id="${esc(d.id)}">${IC.mic}Rakam semula</button></div></div>`;
  if(!voRec.mr&&!(voRec.blob&&ui.voRecFor===d.id)&&d.status!=='proses'&&d.status!=='simpan'&&d.status!=='siap')
    body+=`${d.err?`<p style="color:var(--bad)">${esc(d.err)}</p>`:''}<div style="text-align:center;margin:18px 0">${d.take?`<button class="btn" data-act="voStart" data-id="${esc(d.id)}">${IC.mic}Rakam semula</button>`:`<button class="btn solid rose" style="font-size:20px;padding:20px 34px;border-radius:999px" data-act="voStart" data-id="${esc(d.id)}">${IC.mic}Rakam</button>`}</div>`;
  return head(d.folder||'VO',back)+top+body}
function voReview(d){const segs=d.take.segs||[],gap=d.gap||'tiada';let lastG=-1;
  const rows=segs.map((x,i)=>{const grp=x.n>1&&x.g!==lastG;lastG=x.g;const end=x.n>1&&(i+1>=segs.length||segs[i+1].g!==x.g);
    return `${grp?`<div style="border:1px solid var(--line);border-radius:12px;padding:6px 8px;margin:8px 0"><p class="eyebrow" style="margin:2px 4px">Ulang ×${x.n}</p>`:''}
    <div class="rowh" style="align-items:center;gap:8px;padding:6px 4px"><button class="chip${x.keep?' on':''}" data-act="voTog" data-id="${esc(d.id)}" data-x="${i}" aria-pressed="${x.keep}" style="min-width:44px">${x.keep?'✓':'✗'}</button>
    <span style="flex:1;${x.keep?'':'text-decoration:line-through;opacity:.5'}">${esc(x.t)}${x.why&&!x.keep?` <small class="meta">(${x.why==='tanda'?'kau tanda':x.why==='emm'?'emm':'ulang'})</small>`:''}</span>
    <button class="btn sm" data-act="voPlay" data-id="${esc(d.id)}" data-x="${i}" aria-label="Dengar">▶</button></div>${end?'</div>':''}`}).join('');
  return `<div class="card glass"><div class="rowh"><h3 style="margin:0">Semak ayat</h3><span class="meta">${d.take.dur||0} s → ±${voKeptDur(d).toFixed(1)} s</span></div>
    <p class="meta">Tekan ✓ / ✗ untuk simpan atau buang. Hujung depan dan belakang dipotong sendiri.</p>${rows}
    <p class="eyebrow" style="margin-top:12px">Gap antara ayat</p><div class="seg">${[['tiada','Tiada'],['sikit','Sikit'],['asli','Asli']].map(([k,l])=>`<button type="button" class="${gap===k?'on':''}" data-act="voGap" data-id="${esc(d.id)}" data-x="${k}">${l}</button>`).join('')}</div>
    <div class="btns" style="margin-top:14px"><button class="btn" data-act="voPlayAll" data-id="${esc(d.id)}">▶ Dengar semua</button><button class="btn solid tab" data-act="voSave" data-id="${esc(d.id)}">${IC.check}HANTAR</button></div></div>`}
/* home: kad VO perlu dirakam (ganti peringatan harian) */
function voAlert(){const l=voPending();if(!l.length)return '';
  return `<button class="card big glass" style="--c:${TAB.vo.c};margin-top:14px;text-align:left;width:100%" data-act="go" data-id="vo"><div class="rowh" style="align-items:center"><h2 style="margin:0">🎙 VO perlu dirakam</h2><b class="bigno" style="font-size:40px">${l.length}</b></div>
  ${l.slice(0,4).map(d=>`<div class="rowh" style="margin-top:8px"><span>${esc(d.sub||d.id)}</span>${voPill(d)}</div>`).join('')}</button>`}
A.voOpen=el=>{ui.voOpen=el.dataset.id;render(true);window.scrollTo(0,0)};
A.voBack=()=>{if(voRec.mr||VR.on){toast('Tekan FINAL atau Batal dulu');return}ui.voOpen=null;render(true)};
A.voEditPts=el=>{const d=voList().find(x=>x.id===el.dataset.id);if(!d)return;
  modal(`<h2>Point penting</h2><p class="meta">Satu point satu baris. Ayat kau cakap sendiri.</p><textarea class="inp" id="voP" rows="7">${esc((d.points||[]).join('\n'))}</textarea>
  <label class="f"><span>Jangan sebut (asing dengan koma)</span><input class="inp" id="voB" value="${esc((d.banned||[]).join(', '))}"></label>
  <label class="f"><span>Sasaran (saat)</span><input class="inp" id="voT" type="number" inputmode="numeric" value="${esc(d.target||'')}"></label>
  <div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="voPtsSave" data-id="${esc(d.id)}">Simpan</button></div>`,TAB.vo.c)};
A.voPtsSave=el=>{const d=voList().find(x=>x.id===el.dataset.id);const o=voEnsure(d);
  save('vo',Object.assign({},o,{points:$('#voP').value.split('\n').map(s=>s.trim()).filter(Boolean),banned:$('#voB').value.split(',').map(s=>s.trim()).filter(Boolean),target:+$('#voT').value||null}));closeModal()};
A.voStart=async el=>{if(!navigator.mediaDevices||!window.MediaRecorder){toast('Phone ni tak boleh rakam di sini');return}
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:true}})}catch(e){toast('Benarkan mikrofon untuk Studio');return}
  const mime=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(m=>MediaRecorder.isTypeSupported(m))||'';
  Object.assign(voRec,{chunks:[],marks:[],blob:null,t0:Date.now()});if(voRec.url)URL.revokeObjectURL(voRec.url);
  const mr=new MediaRecorder(stream,mime?{mimeType:mime}:{});voRec.mr=mr;ui.voRecFor=el.dataset.id;
  mr.ondataavailable=e=>{if(e.data&&e.data.size)voRec.chunks.push(e.data)};
  mr.onstop=()=>{stream.getTracks().forEach(t=>t.stop());voRec.blob=new Blob(voRec.chunks,{type:mr.mimeType||'audio/mp4'});voRec.url=URL.createObjectURL(voRec.blob);voRec.mr=null;clearInterval(voRec.timer);render(true)};
  mr.start(1000);voRec.timer=setInterval(()=>{const c=$('#voClock');if(c){const s=Math.floor((Date.now()-voRec.t0)/1000);c.textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}},250);render(true)};
A.voMark=()=>{if(!voRec.mr)return;voRec.marks.push(+((Date.now()-voRec.t0)/1000).toFixed(2));const m=$('#voMarks');if(m)m.textContent=voRec.marks.length+' ayat ditanda untuk buang';if(navigator.vibrate)navigator.vibrate(40)};
A.voStop=()=>{if(voRec.mr)voRec.mr.stop()};
A.voDiscard=()=>{voRec.blob=null;if(voRec.url)URL.revokeObjectURL(voRec.url);voRec.url='';render(true)};
A.voSend=async el=>{const d=voList().find(x=>x.id===el.dataset.id);if(!ASSETS){toast('Upload tak tersedia');return}
  const ext=/webm/.test(voRec.blob.type)?'webm':'m4a';const f=new File([voRec.blob],d.id+'-'+Date.now()+'.'+ext,{type:voRec.blob.type});
  toast('Sedang upload');let r;try{r=await ASSETS.upload(f)}catch(e){toast('Upload gagal. Semak internet');return}
  const o=voEnsure(d);const marks=voRec.marks.slice();ui.voLocal=Object.assign({},ui.voLocal,{[d.id]:voRec.url});voRec.blob=null;voRec.url='';render(true);save('vo',Object.assign({},o,{status:'proses',err:''}));
  try{await studioJob('vo_take',{id:d.id,asset:r.id,marks},15*60000);toast('Ayat sedia untuk disemak')}catch(e){toast('Mac mini tak dapat proses: '+String((e&&e.message)||'').slice(0,80))}};
A.voTog=el=>{const d=get('vo',el.dataset.id);const segs=d.take.segs.slice(),i=+el.dataset.x;segs[i]=Object.assign({},segs[i],{keep:!segs[i].keep});save('vo',Object.assign({},d,{take:Object.assign({},d.take,{segs})}))};
A.voGap=el=>{const d=get('vo',el.dataset.id);save('vo',Object.assign({},d,{gap:el.dataset.x}))};
let voAud=null,voQ=[];
function voPlaySegs(d,list){if(!voAud){voAud=new Audio();voAud.addEventListener('timeupdate',()=>{const c=voQ[0];if(c&&voAud.currentTime>=c.e){voQ.shift();if(voQ.length){voAud.currentTime=voQ[0].s}else voAud.pause()}})}
  const src=(ui.voLocal||{})[d.id]||blobUrl(d.take.asset);if(!src){toast('Rakaman tiada');return}if(voAud.dataset.src!==src){voAud.src=src;voAud.dataset.src=src}
  voQ=list.map(x=>({s:Math.max(0,x.s-0.05),e:x.e+0.1}));if(!voQ.length)return;voAud.currentTime=voQ[0].s;voAud.play().catch(()=>toast('Tak dapat main audio'))}
A.voPlay=el=>{const d=get('vo',el.dataset.id);voPlaySegs(d,[d.take.segs[+el.dataset.x]])};
A.voPlayAll=el=>{const d=get('vo',el.dataset.id);voPlaySegs(d,d.take.segs.filter(x=>x.keep))};
A.voSave=async el=>{const d=get('vo',el.dataset.id);const keep=d.take.segs.map((x,i)=>x.keep?i:-1).filter(i=>i>=0);if(!keep.length){toast('Pilih sekurang-kurangnya satu ayat');return}
  save('vo',Object.assign({},d,{status:'simpan',err:''}));
  try{const r=await studioJob('vo_save',{id:d.id,keep,gap:d.gap||'tiada'},10*60000);toast(r&&r.moved?'VO siap. Folder dipindah ke 28. EDIT + VO':'VO siap disimpan')}catch(e){toast('Simpan gagal: '+String((e&&e.message)||'').slice(0,80))}};

/* ---------- VO v3 (2026-11-23, Mira) ----------
   Satu kad = banyak VO; setiap VO jadi satu video utama yang Claude edit; ayat pertama VO = tajuk.
   Perakam: RECORD masuk mod rakam, STOP berhenti tapi kekal dalam mod, PLAY + slider untuk dengar semula,
   CUT belah di slider, DELETE buang bahagian di slider, FINAL baru keluar mod, simpan WAV (job vo_final). */
const VR={on:false,id:'',n:0,stream:null,mr:null,ctx:null,pcm:new Float32Array(0),sr:48000,cuts:[],pos:0,rec:false,t0:0,src:null,play:false,raf:0,busy:false,tick:0};
const vrDur=()=>VR.pcm.length/VR.sr;
const vrFmt=t=>{t=Math.max(0,t||0);return Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0')+'.'+Math.floor(t*10%10)};
function vrSegs(){const d=vrDur(),b=[0,...VR.cuts.filter(c=>c>0.05&&c<d-0.05).sort((a,b)=>a-b),d];return b.slice(1).map((e,i)=>({s:b[i],e}))}
function voDetail(d){
  if(VR.on&&VR.id===d.id)return vrView(d);
  const back=`<button class="btn sm" data-act="voBack">${IC.back}Senarai</button>`;
  const pts=(d.points||[]).filter(Boolean),ban=(d.banned||[]).filter(Boolean),vos=(d.vos||[]).slice().sort((a,b)=>a.n-b.n);
  const top=`<div class="card glass"><div class="rowh" style="align-items:center"><div><h2 style="margin:0">${esc(d.sub||d.id)}</h2><div class="meta">${esc(d.folder||'')}${d.target?' · sasaran ±'+d.target+' s':''}</div></div>${voPill(d)}</div>
    ${pts.length?`<ol style="margin:12px 0 0;padding-left:22px;font-size:17px;line-height:1.5">${pts.map(p=>`<li>${esc(p)}</li>`).join('')}</ol>`:`<p class="meta" style="margin:10px 0 0">Point belum ada. Tekan Edit point kalau perlu.</p>`}
    ${ban.length?`<p style="margin:10px 0 0;color:var(--bad)">Jangan sebut: ${ban.map(esc).join(', ')}</p>`:''}
    <div class="btns" style="margin-top:10px"><button class="btn sm" data-act="voEditPts" data-id="${esc(d.id)}">${IC.edit}Edit point</button></div></div>`;
  const list=`<p class="eyebrow" style="margin-top:16px">VO dalam kad ni · ${vos.length}${vos.length?' · '+voTot(d)+' s'+(d.target?' / sasaran '+d.target+' s setiap video':''):''} <span class="meta" style="text-transform:none;letter-spacing:0">(setiap VO = satu video, ayat pertama = tajuk)</span></p>
    <div class="clist">${vos.map(v=>`<div class="crow glass"><div class="crt"><b>VO ${v.n}${v.title?': '+esc(v.title):''}</b><small>${v.status==='proses'?'<i class="spin"></i> Mac mini sedang bersihkan & simpan…':v.status==='error'?'Ralat: '+esc(v.err||''):esc((v.dur?v.dur+' s · ':'')+String(v.file||'').split('/').pop())}</small></div>
      <div class="crb">${v.asset&&v.status!=='proses'?`<button class="btn sm" data-act="voPlayV" data-x="${esc(v.asset)}" aria-label="Dengar">▶</button>`:''}<button class="btn sm" data-act="vrOpen" data-id="${esc(d.id)}" data-x="${v.n}" aria-label="Rakam semula">${IC.mic}</button><button class="btn icon sm bad" data-act="voDelV" data-id="${esc(d.id)}" data-x="${v.n}" aria-label="Buang">${IC.trash}</button></div></div>`).join('')||'<div class="empty">Belum ada VO.</div>'}</div>
    <div style="text-align:center;margin:18px 0"><button class="btn solid rose" style="font-size:18px;padding:16px 28px;border-radius:999px" data-act="vrOpen" data-id="${esc(d.id)}" data-x="${(vos.reduce((m,v)=>Math.max(m,v.n),0))+1}">${IC.mic}Rakam VO ${(vos.reduce((m,v)=>Math.max(m,v.n),0))+1}</button></div>`;
  const legacy=d.status==='semak'&&d.take?voReview(d):'';
  return head(d.folder||'VO',back)+top+list+legacy}
function vrView(d){const dur=vrDur(),segs=vrSegs(),cur=segs.findIndex(x=>VR.pos>=x.s&&VR.pos<=x.e);
  return head('Mod rakam',`<span class="pill" style="--pc:var(--bad)">● VO ${VR.n}</span>`)+`<div class="card glass vrbox">
   <p class="meta" style="margin:0 0 6px">${esc(d.sub||d.id)}</p>${vrPrompt(d)}
   <div class="vrclock" id="vrClock">${VR.rec?'● '+vrFmt((Date.now()-VR.t0)/1000):vrFmt(VR.pos)+' / '+vrFmt(dur)}</div>
   <canvas id="vrWave" class="vrwave" width="680" height="110"></canvas>
   <input type="range" id="vrPos" class="vrpos" min="0" max="${Math.max(0.1,dur).toFixed(2)}" step="0.05" value="${Math.min(VR.pos,dur).toFixed(2)}" ${VR.rec||!dur?'disabled':''}>
   <p class="meta" style="margin:4px 0 10px">${dur?`${segs.length} bahagian · bahagian di slider: ${cur+1}. Tekan CUT di awal dan akhir bahagian yang tak suka, letak slider di tengah, tekan DELETE. Rakaman baru disambung di hujung.`:'Tekan RECORD dan mula cakap. Ayat pertama jadi tajuk video.'}</p>
   <div class="vrbtns">
    <button class="vrb rec${VR.rec?' on':''}" data-act="vrRec" ${VR.busy?'disabled':''}><b>●</b>Record</button>
    <button class="vrb" data-act="vrStop" ${VR.rec||VR.play?'':'disabled'}><b>■</b>Stop</button>
    <button class="vrb" data-act="vrPlay" ${VR.rec||!dur?'disabled':''}><b>${VR.play?'❚❚':'▶'}</b>${VR.play?'Pause':'Play'}</button>
    <button class="vrb" data-act="vrCut" ${VR.rec||!dur?'disabled':''}><b>✂</b>Cut</button>
    <button class="vrb bad" data-act="vrDel" ${VR.rec||!dur?'disabled':''}><b>🗑</b>Delete</button>
    <button class="vrb fin" data-act="vrFinal" ${VR.rec||!dur||VR.busy?'disabled':''}><b>✓</b>FINAL</button>
   </div>
   <div class="btns" style="justify-content:center;margin-top:10px"><button class="btn sm" data-act="vrQuit">Batal (buang rakaman ni)</button></div></div>`}
AFTER.vo=()=>{if(VR.on){vrDraw();const r=$('#vrPos');if(r)r.oninput=()=>{VR.pos=+r.value;if(VR.play)vrPlayFrom(VR.pos);vrDraw();vrClock()}}};
function vrClock(){const c=$('#vrClock');if(c)c.textContent=VR.rec?'● '+vrFmt((Date.now()-VR.t0)/1000):vrFmt(VR.pos)+' / '+vrFmt(vrDur())}
function vrDraw(){const cv=$('#vrWave');if(!cv)return;const g=cv.getContext('2d'),W=cv.width,H=cv.height,d=vrDur(),n=VR.pcm.length;g.clearRect(0,0,W,H);
  if(n){const step=Math.max(1,Math.floor(n/W));const segs=vrSegs(),cur=segs.find(x=>VR.pos>=x.s&&VR.pos<=x.e);
    if(cur&&segs.length>1){g.fillStyle='rgba(181,84,107,.12)';g.fillRect(cur.s/d*W,0,(cur.e-cur.s)/d*W,H)}
    g.fillStyle='#b5546b';for(let x=0;x<W;x++){let m=0;const o=x*step;for(let k=0;k<step;k+=4){const v=Math.abs(VR.pcm[o+k]||0);if(v>m)m=v}const h=Math.max(1,m*H*.95);g.fillRect(x,(H-h)/2,1,h)}
    g.fillStyle='#1d1b1a';VR.cuts.forEach(c=>g.fillRect(c/d*W-1,0,2,H));g.fillStyle='#2b7a4b';g.fillRect(Math.min(W-2,VR.pos/d*W),0,2,H)}
  else{g.fillStyle='rgba(0,0,0,.08)';g.fillRect(0,H/2-1,W,2)}}
async function vrEnsure(){if(!VR.ctx){const AC=window.AudioContext||window.webkitAudioContext;VR.ctx=new AC();}if(VR.ctx.state==='suspended')await VR.ctx.resume();
  if(!VR.stream)VR.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:true}})}
A.vrOpen=async el=>{if(!navigator.mediaDevices||!window.MediaRecorder){toast('Phone ni tak boleh rakam di sini');return}
  try{await vrEnsure()}catch(e){toast('Benarkan mikrofon untuk Studio');return}
  const d=voList().find(x=>x.id===el.dataset.id);if(d)voEnsure(d);
  wakeOn();Object.assign(VR,{pt:0,on:true,id:el.dataset.id,n:+el.dataset.x||1,pcm:new Float32Array(0),sr:VR.ctx.sampleRate,cuts:[],pos:0,rec:false,play:false,busy:false});render(true);window.scrollTo(0,0)};
A.vrRec=()=>{if(VR.rec)return;vrStopPlay();const mime=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(m=>MediaRecorder.isTypeSupported(m))||'';
  const ch=[];const mr=new MediaRecorder(VR.stream,mime?{mimeType:mime}:{});VR.mr=mr;
  mr.ondataavailable=e=>{if(e.data&&e.data.size)ch.push(e.data)};
  mr.onstop=async()=>{VR.busy=true;render(true);try{const ab=await new Blob(ch,{type:mr.mimeType||'audio/mp4'}).arrayBuffer();const buf=await new Promise((res,rej)=>VR.ctx.decodeAudioData(ab,res,rej));
      const L=buf.getChannelData(0),R=buf.numberOfChannels>1?buf.getChannelData(1):null,add=new Float32Array(L.length);for(let i=0;i<L.length;i++)add[i]=R?(L[i]+R[i])/2:L[i];
      const out=new Float32Array(VR.pcm.length+add.length);out.set(VR.pcm);out.set(add,VR.pcm.length);if(VR.pcm.length)VR.cuts.push(vrDur());VR.pcm=out;VR.sr=buf.sampleRate;VR.pos=vrDur()}
    catch(e){toast('Rakaman tak dapat dibaca. Cuba rakam lagi')}VR.busy=false;render(true)};
  mr.start();VR.rec=true;VR.t0=Date.now();clearInterval(VR.tick);VR.tick=setInterval(vrClock,200);if(navigator.vibrate)navigator.vibrate(30);render(true)};
A.vrStop=()=>{if(VR.rec&&VR.mr){VR.rec=false;clearInterval(VR.tick);VR.mr.stop();return}if(VR.play){vrStopPlay();render(true)}};
function vrStopPlay(){if(VR.src){try{VR.src.onended=null;VR.src.stop()}catch(e){}VR.src=null}VR.play=false;cancelAnimationFrame(VR.raf)}
function vrPlayFrom(t){vrStopPlay();const d=vrDur();if(t>=d-0.05)t=0;const b=VR.ctx.createBuffer(1,VR.pcm.length,VR.sr);b.copyToChannel(VR.pcm,0);
  const s=VR.ctx.createBufferSource();s.buffer=b;s.connect(VR.ctx.destination);const t0=VR.ctx.currentTime-t;s.start(0,t);VR.src=s;VR.play=true;
  s.onended=()=>{if(VR.src===s){VR.play=false;VR.src=null;render(true)}};
  const loop=()=>{if(!VR.play)return;VR.pos=Math.min(d,VR.ctx.currentTime-t0);const r=$('#vrPos');if(r)r.value=VR.pos;vrDraw();vrClock();VR.raf=requestAnimationFrame(loop)};loop()}
A.vrPlay=async()=>{if(VR.play){vrStopPlay();render(true);return}await vrEnsure();vrPlayFrom(VR.pos);render(true)};
A.vrCut=()=>{const p=+VR.pos.toFixed(2);if(p<0.05||p>vrDur()-0.05){toast('Gerakkan slider ke tempat nak belah');return}if(VR.cuts.some(c=>Math.abs(c-p)<0.1))return;VR.cuts.push(p);if(navigator.vibrate)navigator.vibrate(20);render(true)};
A.vrDel=()=>{const segs=vrSegs(),k=segs.findIndex(x=>VR.pos>=x.s&&VR.pos<=x.e);if(k<0)return;const x=segs[k];
  const go=()=>{vrStopPlay();const a=Math.round(x.s*VR.sr),b=Math.round(x.e*VR.sr),len=b-a;const out=new Float32Array(VR.pcm.length-len);out.set(VR.pcm.subarray(0,a));out.set(VR.pcm.subarray(b),a);
    VR.pcm=out;const dl=x.e-x.s;VR.cuts=VR.cuts.filter(c=>c<x.s-0.01||c>x.e+0.01).map(c=>c>x.e?c-dl:c);VR.pos=Math.min(x.s,vrDur());render(true);toast('Bahagian dibuang')};
  if(segs.length===1)confirmBox('Buang semua rakaman ni?',go,'Ya, buang');else go()};
A.vrQuit=()=>confirmBox('Keluar dan buang rakaman yang belum FINAL?',()=>{vrClose();render(true)},'Ya, keluar');
function vrClose(){wakeOff();vrStopPlay();clearInterval(VR.tick);if(VR.mr&&VR.rec){try{VR.mr.stop()}catch(e){}}if(VR.stream){VR.stream.getTracks().forEach(t=>t.stop());VR.stream=null}Object.assign(VR,{on:false,rec:false,pcm:new Float32Array(0),cuts:[]})}
function vrWav(){const src=VR.pcm,sr0=VR.sr,sr=24000,n=Math.floor(src.length*sr/sr0),buf=new ArrayBuffer(44+n*2),v=new DataView(buf);
  const w=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};w(0,'RIFF');v.setUint32(4,36+n*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,n*2,true);
  for(let i=0;i<n;i++){const x=src[Math.min(src.length-1,Math.floor(i*sr0/sr))];v.setInt16(44+i*2,Math.max(-1,Math.min(1,x))*0x7fff,true)}return new Blob([buf],{type:'audio/wav'})}
A.vrFinal=async()=>{if(!ASSETS){toast('Upload tak tersedia');return}if(!vrDur())return;vrStopPlay();VR.busy=true;render(true);
  const id=VR.id,n=VR.n,f=new File([vrWav()],id+'-vo'+n+'-'+Date.now()+'.wav',{type:'audio/wav'});toast('Sedang simpan VO '+n);
  let r;try{r=await ASSETS.upload(f)}catch(e){VR.busy=false;render(true);toast('Upload gagal. Rakaman masih ada, tekan FINAL sekali lagi');return}
  vrClose();const d=get('vo',id)||{id};const vos=(d.vos||[]).filter(v=>v.n!==n).concat([{n,asset:r.id,status:'proses',at:Date.now()}]).sort((a,b)=>a.n-b.n);
  save('vo',Object.assign({},d,{vos}));render(true);
  try{await studioJob('vo_final',{id,asset:r.id,n},15*60000);toast('VO '+n+' disimpan')}catch(e){toast('Mac mini tak dapat simpan: '+String((e&&e.message)||'').slice(0,80))}};
A.voPlayV=el=>{if(!voAud)voAud=new Audio();voQ=[];voAud.src=blobUrl(el.dataset.x);voAud.play().catch(()=>toast('Tak dapat main audio'))};
A.voDelV=el=>{const id=el.dataset.id,n=+el.dataset.x;confirmBox('Buang VO '+n+'? Fail masuk Trash Mac.',async()=>{const d=get('vo',id);save('vo',Object.assign({},d,{vos:(d.vos||[]).filter(v=>v.n!==n)}));try{await studioJob('vo_del',{id,n},3*60000)}catch(e){}},'Ya, buang')};

/* Penambahbaikan 23 Nov: teleprompter (point besar, satu-satu), jumlah panjang VO, skrin tak tidur masa rakam / upload */
const voTot=d=>Math.round((d.vos||[]).filter(v=>v.status==='siap').reduce((a,v)=>a+(+v.dur||0),0));
function vrPrompt(d){const P=(d.points||[]).filter(Boolean);if(!P.length)return '';const k=Math.min(VR.pt||0,P.length-1);
  return `<div class="vrtp"><button class="vrtpb" data-act="vrPt" data-x="-1" ${k?'':'disabled'} aria-label="Point sebelum">‹</button><div><small>Point ${k+1}/${P.length}</small><p>${esc(P[k])}</p></div><button class="vrtpb" data-act="vrPt" data-x="1" ${k<P.length-1?'':'disabled'} aria-label="Point seterusnya">›</button></div>`}
A.vrPt=el=>{VR.pt=Math.max(0,(VR.pt||0)+(+el.dataset.x));const box=document.querySelector('.vrtp');const d=get('vo',VR.id);if(box&&d){box.outerHTML=vrPrompt(d)}};
let WL=null;
async function wakeOn(){try{if(navigator.wakeLock&&!WL){WL=await navigator.wakeLock.request('screen');WL.addEventListener('release',()=>{WL=null})}}catch(e){}}
function wakeOff(){try{if(WL)WL.release()}catch(e){}WL=null}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&(VR.on||Object.keys(ui.fuUp||{}).length))wakeOn()});
