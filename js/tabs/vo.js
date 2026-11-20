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
    <button style="all:unset;display:block;cursor:pointer;width:100%" data-act="voOpen" data-id="${esc(d.id)}"><div class="rowh" style="align-items:center;padding-right:34px"><div><h3 style="margin:0">${esc(d.sub||d.title||d.id)}</h3><div class="meta">${esc((d.folder||'').replace(/^\d+\.\s*/,''))}${d.target?' · sasaran ±'+d.target+' s':''}${d.status==='siap'&&d.voDur?' · VO '+d.voDur+' s':''}</div></div>${voPill(d)}</div></button>
    ${d.status==='siap'?'':`<button class="btn sm" style="position:absolute;top:8px;right:8px;padding:6px" data-act="voHide" data-id="${esc(d.id)}" aria-label="Buang dari senarai VO" title="Buang dari senarai">${IC.x}</button>`}</div>`).join('')||`<div class="empty">Tiada video perlu VO. Folder 41. TUNGGU VO dan semua folder VLOG masuk sini sendiri.</div>`}</div>
    ${hid.length?`<details style="margin-top:14px"><summary class="meta">Dibuang dari senarai (${hid.length})</summary><div class="list" style="margin-top:8px">${hid.map(d=>`<div class="rowh" style="align-items:center;padding:6px 4px"><span>${esc(d.sub||d.id)} <small class="meta">${esc((d.folder||'').replace(/^\d+\.\s*/,''))}</small></span><button class="btn sm" data-act="voUnhide" data-id="${esc(d.id)}">Pulihkan</button></div>`).join('')}</div></details>`:''}`};
A.voHide=el=>{const d=voAll().find(x=>x.id===el.dataset.id);if(!d)return;const o=voEnsure(d);save('vo',Object.assign({},o,{status:'buang',prev:o.status==='buang'?'perlu':o.status}));toast('Dibuang dari senarai VO')};
A.voUnhide=el=>{const d=get('vo',el.dataset.id);if(d)save('vo',Object.assign({},d,{status:d.prev&&d.prev!=='buang'?d.prev:'perlu'}))};
A.voAdd=()=>{const have=new Set(voList().map(d=>d.id));
  const opts=((S.sync.toedit||{}).stages||[]).map(st=>({st:st.name,items:st.items.filter(it=>!have.has(voId(it.name)))})).filter(g=>g.items.length);
  modal(`<h2>Tambah video perlu VO</h2>${opts.length?`<div class="list" style="max-height:60vh;overflow:auto">${opts.map(g=>`<p class="eyebrow" style="margin:10px 0 4px">${esc(g.st)}</p>${g.items.map(it=>`<button class="btn" style="justify-content:flex-start;width:100%;margin-bottom:6px" data-act="voAddPick" data-id="${esc(g.st)}" data-x="${esc(it.name)}">${esc(it.name)}</button>`).join('')}`).join('')}</div>`:'<p class="meta">Semua folder edit dah ada dalam senarai.</p>'}
  <div class="btns" style="justify-content:flex-end;margin-top:10px"><button class="btn" data-act="closeModal">Tutup</button></div>`,TAB.vo.c)};
A.voAddPick=el=>{const id=voId(el.dataset.x),cur=get('vo',id);save('vo',Object.assign({id,folder:el.dataset.id,sub:el.dataset.x,points:[]},cur||{},{status:'perlu'}));closeModal();toast('Ditambah ke senarai VO')};
function voDetail(d){
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
A.voBack=()=>{if(voRec.mr){toast('Berhenti rakam dulu');return}ui.voOpen=null;render(true)};
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
