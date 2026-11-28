/* ---------- RUJUKAN (28 Nov 2026, Mira): Copy Style + Inspiration board digabung, satu pintu masuk ----------
   Dump: gambar (board, untuk templat Design), video / link (Resipi Style untuk Editor, aliran gaya.js sedia ada).
   Templat: pilih rujukan gambar + nota > "Minta jadi templat" (job tpl_req: Mac mini buka sesi Claude Code yang tambah
   Kit Gaya baru dalam design_kits.py, kemudian tanda kitreq/<id> siap dan kemas kini sync/kits).
   Resipi reel: paparan Copy Style sedia ada (gyView). */
const rjSeg=()=>{const s=ui.inSeg||'dump';return s==='board'?'dump':s};
function rjSegs(){const s=rjSeg();const b=(k,l)=>`<button type="button" class="${s===k?'on':''}" data-act="inSeg" data-x="${k}">${l}</button>`;
  return `<div class="seg crseg" style="margin:0 0 14px">${b('dump','Dump')}${b('templat','Templat')}${b('rasa','Rasa Mira')}${b('resipi','Resipi reel')}</div>`}
V.inspiration=()=>{const s=rjSeg();
  if(s==='resipi')return `<div class="head"><div><p class="eyebrow">Semua yang kau suka</p><h1>Rujukan</h1></div></div>`+rjSegs()+gyView().replace('<h1>Copy Style</h1>','<h1>Resipi reel</h1>');
  return head('Semua yang kau suka')+rjSegs()+(s==='templat'?rjTemplat():s==='rasa'?rjRasa():rjDump())};

function rjDump(){const imgs=S.inspo.slice().sort((a,b)=>(b.created||0)-(a.created||0));
  const reels=S.gaya.slice().sort((a,b)=>(b.created||0)-(a.created||0)).slice(0,3);
  return `<div class="card glass rjdump"><b>Dump di sini</b><p class="meta">Tak perlu label. Gambar jadi bahan templat Design, video jadi Resipi reel.</p>
    <div class="rjbtns"><button class="btn solid tab" data-act="rjImg">${IC.up}Gambar</button><button class="btn" data-act="rjVid">${IC.up}Video</button><button class="btn" data-act="rjLink">${IC.ext}Paste link</button></div></div>
   <div class="rowh" style="margin:16px 0 8px;align-items:baseline"><p class="eyebrow" style="margin:0">Gambar untuk templat · ${imgs.length}</p><button class="btn sm" data-act="inSeg" data-x="templat">Jadikan templat</button></div>
   ${imgs.length?`<div class="rjgrid">${imgs.map(i=>`<button type="button" class="rjcell" data-act="inOpen" data-id="${esc(i.id)}" aria-label="${esc(i.title||'Rujukan')}">${i.asset?`<img src="${blobUrl(esc(i.asset))}" alt="" loading="lazy">`:'<span>Nota</span>'}${i.group?`<em>${esc(i.group)}</em>`:i.asset&&!i.tagged?`<em style="background:#F6E7C4">Sedang dibaca</em>`:''}</button>`).join('')}</div>${imgs.some(i=>i.asset&&!i.tagged)?`<div class="btns" style="margin-top:8px"><button class="btn sm" data-act="rjTag">Susun yang belum dilabel</button>${tok(TOK.reftag,'setiap gambar, Claude baca')}</div>`:''}`:`<div class="empty">Belum ada gambar. Dump screenshot design yang kau suka.</div>`}
   <div class="rowh" style="margin:18px 0 8px;align-items:baseline"><p class="eyebrow" style="margin:0">Reel terbaru · ${S.gaya.length}</p><button class="btn sm" data-act="inSeg" data-x="resipi">Lihat semua</button></div>
   ${reels.length?reels.map(g=>`<div class="card glass" style="padding:10px 14px;margin-bottom:8px"><b style="font-weight:500">${esc(g.name||g.title||csMeta(g)||'Reel')}</b><span class="meta" style="display:block">${esc(g.status==='scan'?'Sedang dibaca Mac mini':g.status==='error'?'Gagal':'Resipi siap')}</span></div>`).join(''):`<p class="meta">Belum ada reel.</p>`}`}
const rjTagReq=items=>studioCall('job_add',{type:'ref_tag',input:{items,kits:crKits().map(k=>k.id),
  groups:[...new Set(S.inspo.map(i=>i.group).filter(Boolean))].slice(0,30)}});
A.rjImg=()=>{if(!ASSETS){toast('Upload tak tersedia di sini');return}pickFile('image/*',async files=>{const items=[];toast('Sedang upload '+files.length+' gambar');
  for(const f of files.slice(0,24)){if(f.size>20*1048576)continue;try{const sm=await crShrink(f);const r=await ASSETS.upload(sm);const d=save('inspo',{asset:r.id,title:'',note:'',tag:'',url:''},true);items.push({id:d.id,asset:r.id})}catch(e){}}
  render(true);if(!items.length)return;
  try{for(let i=0;i<items.length;i+=12)await rjTagReq(items.slice(i,i+12));toast(items.length+' gambar masuk. Mac mini sedang susun')}catch(e){toast(items.length+' gambar masuk. Label nanti bila Mac mini online')}},true)};
A.rjTag=async()=>{const items=S.inspo.filter(i=>i.asset&&!i.tagged).slice(0,12).map(i=>({id:i.id,asset:i.asset}));if(!items.length)return;
  try{await rjTagReq(items);toast('Mac mini sedang susun '+items.length+' gambar')}catch(e){toast('Tak dapat hantar ke Mac mini')}};
A.rjVid=()=>{ui.inSeg='resipi';render(true);setTimeout(()=>A.gyUpload({dataset:{}}),50)};
A.rjLink=()=>{ui.inSeg='resipi';render(true);setTimeout(()=>A.gyPaste(),50)};

function rjTemplat(){const sel=ui.rjSel||(ui.rjSel=[]);const imgs=S.inspo.filter(i=>i.asset).sort((a,b)=>(b.created||0)-(a.created||0));
  const reqs=(S.kitreq||[]).slice().sort((a,b)=>(b.created||0)-(a.created||0));
  const ST={queued:['Menunggu Mac mini','var(--warn)'],dibuat:['Claude sedang buat','#7A5C6E'],siap:['Siap','var(--ok)'],error:['Gagal','var(--bad)']};
  const groups={};S.inspo.filter(i=>i.asset&&i.group&&i.kind!=='reel'&&i.kind!=='ayat').forEach(i=>{(groups[i.group]=groups[i.group]||[]).push(i)});
  const G=Object.entries(groups).sort((a,b)=>b[1].length-a[1].length);
  const kol=G.length?`<p class="eyebrow">Koleksi (Claude kumpul ikut rupa)</p>${G.map(([g,L])=>{const km=L.map(i=>i.kit).filter(Boolean);const k=km.sort((a,b)=>km.filter(x=>x===b).length-km.filter(x=>x===a).length)[0];
    return `<div class="card glass" style="padding:10px 14px;margin-bottom:8px;display:flex;gap:10px;align-items:center"><div class="rjstack">${L.slice(0,3).map(i=>`<img src="${blobUrl(esc(i.asset))}" alt="">`).join('')}</div>
      <div style="flex:1;min-width:0"><b style="font-weight:500">${esc(g)}</b><span class="meta" style="display:block">${L.length} rujukan${k?' · paling dekat: '+esc(crKitName(k)):''}</span></div>
      <button class="btn sm${L.length>=2?' solid tab':''}" data-act="rjGroup" data-x="${esc(g)}"${L.length<2?' disabled title="Perlu sekurang-kurangnya 2"':''}>Buat templat</button></div>`}).join('')}`:'';
  return kol+`<p class="eyebrow"${kol?' style="margin-top:16px"':''}>Templat yang dah ada</p><div class="crkits" style="margin-bottom:16px">${crKits().map(k=>`<a class="crkit" href="#design">${crMini(k.id)}<span>${esc(k.name)}</span></a>`).join('')}</div>
   ${reqs.length?`<p class="eyebrow">Permintaan</p>${reqs.map(r=>{const st=ST[r.status]||ST.queued;return `<div class="card glass" style="padding:10px 14px;margin-bottom:8px;display:flex;gap:10px;align-items:center">
     <div class="rjstack">${(r.refs||[]).slice(0,3).map(a=>`<img src="${blobUrl(esc(a))}" alt="">`).join('')}</div>
     <div style="flex:1;min-width:0"><b style="font-weight:500">${esc(r.note||'Templat baru')}</b><span class="meta" style="display:block">${(r.refs||[]).length} rujukan${r.kit?' · '+esc(crKitName(r.kit)):''}</span></div>
     <span class="pill" style="--pc:${st[1]}">${st[0]}</span></div>`}).join('')}`:''}
   <div class="card glass" style="margin-top:12px"><b style="font-weight:500">Minta templat baru</b>
     <p class="meta" style="margin:4px 0 10px">Pilih 2 hingga 8 gambar yang rupanya sama, tulis apa yang kau suka. Mac mini buka sesi Claude Code yang buat templat, sekali sahaja. Lepas tu templat percuma dalam Design.</p>
     ${imgs.length?`<div class="rjgrid">${imgs.map(i=>`<button type="button" class="rjcell${sel.includes(i.asset)?' on':''}" data-act="rjPick" data-id="${esc(i.asset)}" aria-pressed="${sel.includes(i.asset)}"><img src="${blobUrl(esc(i.asset))}" alt="" loading="lazy">${sel.includes(i.asset)?`<em>✓</em>`:''}</button>`).join('')}</div>`:`<div class="empty">Dump gambar dulu.</div>`}
     <label class="f" style="margin-top:10px"><span>Apa yang kau suka</span><textarea class="inp" id="rjNote" rows="2" placeholder="Contoh: tajuk tulisan tangan putih, orang bergaris putih, latar gelap">${esc(ui.rjNote||'')}</textarea></label>
     <div class="btns" style="justify-content:space-between;align-items:center"><span class="meta">${sel.length} dipilih ${tok(TOK.kit,'sesi Claude Code, sekali setiap templat')}</span><button class="btn solid tab" data-act="rjAsk"${sel.length<1||ui.rjBusy?' disabled':''}>${ui.rjBusy?'<i class="spin"></i>Hantar':'Minta jadi templat'}</button></div></div>
   <div class="card glass" style="margin-top:12px"><b style="font-weight:500">Sticker PNG kau</b>
     <p class="meta" style="margin:4px 0 10px">${(S.sync.stickers||{}).n?S.sync.stickers.n+' sticker dalam Mac mini. ':''}Upload sticker PNG berlatar lutsinar (reben, bunga, beruang). Templat Comel guna sticker kau dulu, kemudian baru yang dilukis.</p>
     <button class="btn sm" data-act="rjStk"${ui.rjStk?' disabled':''}>${ui.rjStk?'<i class="spin"></i>'+esc(ui.rjStk):IC.up+'Upload PNG'}</button> ${tok(0)}</div>
   <div class="card glass" style="margin-top:12px"><b style="font-weight:500">Font kit dalam video</b>
     <p class="meta" style="margin:4px 0 10px">Preset Kit dalam Editor guna font yang paling dekat. Tekan ni sekali: Mac mini buka sesi Claude Code yang pasang font kit sebenar (Chewy, Fredoka, Playfair) dalam enjin render video.${(S.sync.kitfonts||{}).status?' Status: sesi dah dibuka '+fmtD((S.sync.kitfonts||{}).at)+'.':''}</p>
     <button class="btn sm" data-act="rjFonts">Pasang font kit</button> ${tok(TOK.edit,'sesi Claude Code, sekali sahaja')}</div>`}
A.rjGroup=el=>{const g=el.dataset.x;ui.rjSel=S.inspo.filter(i=>i.asset&&i.group===g).slice(0,8).map(i=>i.asset);ui.rjNote=g;render(true);setTimeout(()=>{const n=$('#rjNote');if(n)n.scrollIntoView({block:'center'})},50);toast('Rujukan koleksi dipilih. Semak nota, tekan Minta jadi templat')};
A.rjStk=()=>{if(!ASSETS)return;pickFile('image/png',async fs=>{const ids=[];try{for(let i=0;i<fs.length&&i<30;i++){ui.rjStk='Upload '+(i+1)+'/'+fs.length;render(true);ids.push((await ASSETS.upload(fs[i])).id)}
  ui.rjStk='Hantar';render(true);await studioCall('job_add',{type:'stk_save',input:{files:ids}});toast(ids.length+' sticker dihantar ke Mac mini')}catch(e){toast('Tak dapat upload sticker')}finally{ui.rjStk='';render(true)}},true)};
A.rjFonts=()=>confirmBox('Buka sesi Claude Code di Mac mini untuk pasang font kit dalam enjin render video?',async()=>{closeModal();try{await studioCall('job_add',{type:'kit_fonts',input:{}});toast('Mac mini akan buka sesi Claude. Ikut dalam app Claude (Remote Control)')}catch(e){toast('Tak dapat hantar ke Mac mini')}},'Ya, buka sesi');
function rjRasa(){const r=S.sync.rasa||{};const n=S.inspo.filter(i=>i.tagged).length;
  if(!r.summary)return `<div class="empty">Belum ada. Dump beberapa gambar rujukan, Mac mini baca dan tulis rasa kau di sini.</div>`;
  return `<div class="card glass"><p style="margin:0;font-size:15px">${esc(r.summary)}</p><p class="meta" style="margin:6px 0 0">Dari ${n} rujukan · kemas kini ${fmtD(r.at)}</p></div>
   ${(r.elements||[]).length?`<div class="card glass" style="margin-top:10px"><p class="eyebrow">Yang selalu ada</p><ol style="margin:0;padding-left:20px">${r.elements.map(x=>`<li style="margin-bottom:4px">${esc(x)}</li>`).join('')}</ol></div>`:''}
   ${(r.palette||[]).length?`<div class="card glass" style="margin-top:10px"><p class="eyebrow">Palet</p><div style="display:flex;gap:8px;flex-wrap:wrap">${r.palette.filter(c=>/^#[0-9a-f]{3,8}$/i.test(c)).map(c=>`<span title="${esc(c)}" style="width:40px;height:40px;border-radius:10px;background:${esc(c)};border:1px solid rgba(0,0,0,.1)"></span>`).join('')}</div></div>`:''}
   ${(r.fonts||[]).length?`<div class="card glass" style="margin-top:10px"><p class="eyebrow">Font</p><p style="margin:0">${r.fonts.map(esc).join(' · ')}</p></div>`:''}
   <p class="meta" style="margin-top:10px">Templat baru dari "Minta jadi templat" ikut rasa ni.</p>`}
A.rjPick=el=>{const s=ui.rjSel||(ui.rjSel=[]);const n=$('#rjNote');if(n)ui.rjNote=n.value;const id=el.dataset.id;const k=s.indexOf(id);if(k>=0)s.splice(k,1);else if(s.length<8)s.push(id);render(true)};
A.rjAsk=async()=>{const n=$('#rjNote');ui.rjNote=n?n.value:'';const refs=(ui.rjSel||[]).slice();if(!refs.length)return;
  ui.rjBusy=true;render(true);
  try{const r=save('kitreq',{refs,note:ui.rjNote.trim(),status:'queued'},true);
    await studioCall('job_add',{type:'tpl_req',input:{id:r.id,refs,note:r.note,kits:crKits().map(k=>k.id)}});
    ui.rjSel=[];ui.rjNote='';toast('Dihantar. Mac mini akan buka sesi Claude untuk buat templat')}
  catch(e){toast('Tak dapat hantar ke Mac mini. Cuba lagi')}finally{ui.rjBusy=false;render(true)}};
