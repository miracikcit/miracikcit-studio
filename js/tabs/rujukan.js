/* ---------- RUJUKAN (28 Nov 2026, Mira): Copy Style + Inspiration board digabung, satu pintu masuk ----------
   Dump: gambar (board, untuk templat Design), video / link (Resipi Style untuk Editor, aliran gaya.js sedia ada).
   Templat: pilih rujukan gambar + nota > "Minta jadi templat" (job tpl_req: Mac mini buka sesi Claude Code yang tambah
   Kit Gaya baru dalam design_kits.py, kemudian tanda kitreq/<id> siap dan kemas kini sync/kits).
   Resipi reel: paparan Copy Style sedia ada (gyView). */
const rjSeg=()=>{const s=ui.inSeg||'dump';return s==='board'?'dump':s};
function rjSegs(){const s=rjSeg();const b=(k,l)=>`<button type="button" class="${s===k?'on':''}" data-act="inSeg" data-x="${k}">${l}</button>`;
  return `<div class="seg crseg" style="margin:0 0 14px">${b('dump','Dump')}${b('templat','Templat')}${b('resipi','Resipi reel')}</div>`}
V.inspiration=()=>{const s=rjSeg();
  if(s==='resipi')return `<div class="head"><div><p class="eyebrow">Semua yang kau suka</p><h1>Rujukan</h1></div></div>`+rjSegs()+gyView().replace('<h1>Copy Style</h1>','<h1>Resipi reel</h1>');
  return head('Semua yang kau suka')+rjSegs()+(s==='templat'?rjTemplat():rjDump())};

function rjDump(){const imgs=S.inspo.slice().sort((a,b)=>(b.created||0)-(a.created||0));
  const reels=S.gaya.slice().sort((a,b)=>(b.created||0)-(a.created||0)).slice(0,3);
  return `<div class="card glass rjdump"><b>Dump di sini</b><p class="meta">Tak perlu label. Gambar jadi bahan templat Design, video jadi Resipi reel.</p>
    <div class="rjbtns"><button class="btn solid tab" data-act="rjImg">${IC.up}Gambar</button><button class="btn" data-act="rjVid">${IC.up}Video</button><button class="btn" data-act="rjLink">${IC.ext}Paste link</button></div></div>
   <div class="rowh" style="margin:16px 0 8px;align-items:baseline"><p class="eyebrow" style="margin:0">Gambar untuk templat · ${imgs.length}</p><button class="btn sm" data-act="inSeg" data-x="templat">Jadikan templat</button></div>
   ${imgs.length?`<div class="rjgrid">${imgs.map(i=>`<button type="button" class="rjcell" data-act="inOpen" data-id="${esc(i.id)}" aria-label="${esc(i.title||'Rujukan')}">${i.asset?`<img src="${blobUrl(esc(i.asset))}" alt="" loading="lazy">`:'<span>Nota</span>'}${i.kit?`<em>${esc(crKitName(i.kit))}</em>`:''}</button>`).join('')}</div>`:`<div class="empty">Belum ada gambar. Dump screenshot design yang kau suka.</div>`}
   <div class="rowh" style="margin:18px 0 8px;align-items:baseline"><p class="eyebrow" style="margin:0">Reel terbaru · ${S.gaya.length}</p><button class="btn sm" data-act="inSeg" data-x="resipi">Lihat semua</button></div>
   ${reels.length?reels.map(g=>`<div class="card glass" style="padding:10px 14px;margin-bottom:8px"><b style="font-weight:500">${esc(g.name||g.title||csMeta(g)||'Reel')}</b><span class="meta" style="display:block">${esc(g.status==='scan'?'Sedang dibaca Mac mini':g.status==='error'?'Gagal':'Resipi siap')}</span></div>`).join(''):`<p class="meta">Belum ada reel.</p>`}`}
A.rjImg=A.inUp;
A.rjVid=()=>{ui.inSeg='resipi';render(true);setTimeout(()=>A.gyUpload({dataset:{}}),50)};
A.rjLink=()=>{ui.inSeg='resipi';render(true);setTimeout(()=>A.gyPaste(),50)};

function rjTemplat(){const sel=ui.rjSel||(ui.rjSel=[]);const imgs=S.inspo.filter(i=>i.asset).sort((a,b)=>(b.created||0)-(a.created||0));
  const reqs=(S.kitreq||[]).slice().sort((a,b)=>(b.created||0)-(a.created||0));
  const ST={queued:['Menunggu Mac mini','var(--warn)'],dibuat:['Claude sedang buat','#7A5C6E'],siap:['Siap','var(--ok)'],error:['Gagal','var(--bad)']};
  return `<p class="eyebrow">Templat yang dah ada</p><div class="crkits" style="margin-bottom:16px">${crKits().map(k=>`<a class="crkit" href="#carousel">${crMini(k.id)}<span>${esc(k.name)}</span></a>`).join('')}</div>
   ${reqs.length?`<p class="eyebrow">Permintaan</p>${reqs.map(r=>{const st=ST[r.status]||ST.queued;return `<div class="card glass" style="padding:10px 14px;margin-bottom:8px;display:flex;gap:10px;align-items:center">
     <div class="rjstack">${(r.refs||[]).slice(0,3).map(a=>`<img src="${blobUrl(esc(a))}" alt="">`).join('')}</div>
     <div style="flex:1;min-width:0"><b style="font-weight:500">${esc(r.note||'Templat baru')}</b><span class="meta" style="display:block">${(r.refs||[]).length} rujukan${r.kit?' · '+esc(crKitName(r.kit)):''}</span></div>
     <span class="pill" style="--pc:${st[1]}">${st[0]}</span></div>`}).join('')}`:''}
   <div class="card glass" style="margin-top:12px"><b style="font-weight:500">Minta templat baru</b>
     <p class="meta" style="margin:4px 0 10px">Pilih 2 hingga 8 gambar yang rupanya sama, tulis apa yang kau suka. Mac mini buka sesi Claude Code yang buat templat, sekali sahaja. Lepas tu templat percuma dalam Design.</p>
     ${imgs.length?`<div class="rjgrid">${imgs.map(i=>`<button type="button" class="rjcell${sel.includes(i.asset)?' on':''}" data-act="rjPick" data-id="${esc(i.asset)}" aria-pressed="${sel.includes(i.asset)}"><img src="${blobUrl(esc(i.asset))}" alt="" loading="lazy">${sel.includes(i.asset)?`<em>✓</em>`:''}</button>`).join('')}</div>`:`<div class="empty">Dump gambar dulu.</div>`}
     <label class="f" style="margin-top:10px"><span>Apa yang kau suka</span><textarea class="inp" id="rjNote" rows="2" placeholder="Contoh: tajuk tulisan tangan putih, orang bergaris putih, latar gelap">${esc(ui.rjNote||'')}</textarea></label>
     <div class="btns" style="justify-content:space-between;align-items:center"><span class="meta">${sel.length} dipilih ${tok(TOK.kit,'sesi Claude Code, sekali setiap templat')}</span><button class="btn solid tab" data-act="rjAsk"${sel.length<1||ui.rjBusy?' disabled':''}>${ui.rjBusy?'<i class="spin"></i>Hantar':'Minta jadi templat'}</button></div></div>`}
A.rjPick=el=>{const s=ui.rjSel||(ui.rjSel=[]);const n=$('#rjNote');if(n)ui.rjNote=n.value;const id=el.dataset.id;const k=s.indexOf(id);if(k>=0)s.splice(k,1);else if(s.length<8)s.push(id);render(true)};
A.rjAsk=async()=>{const n=$('#rjNote');ui.rjNote=n?n.value:'';const refs=(ui.rjSel||[]).slice();if(!refs.length)return;
  ui.rjBusy=true;render(true);
  try{const r=save('kitreq',{refs,note:ui.rjNote.trim(),status:'queued'},true);
    await studioCall('job_add',{type:'tpl_req',input:{id:r.id,refs,note:r.note,kits:crKits().map(k=>k.id)}});
    ui.rjSel=[];ui.rjNote='';toast('Dihantar. Mac mini akan buka sesi Claude untuk buat templat')}
  catch(e){toast('Tak dapat hantar ke Mac mini. Cuba lagi')}finally{ui.rjBusy=false;render(true)}};
