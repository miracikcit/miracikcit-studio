/* ---------- PUBLISHED ----------
   Masuk sendiri bila video ditanda Settled dalam To Publish. Kad: No, nama produk, jumlah video.
   Tekan kad untuk isi link TT / IG / FB / SV setiap video (lajur LINK SUBMISSION, Q, dalam Sheet). */
const subParse=t=>{const o={TT:'',IG:'',FB:'',SV:''};String(t||'').split('\n').forEach(l=>{const m=l.match(/^\s*(TT|IG|FB|SV)\s*:\s*(.*)$/i);if(m)o[m[1].toUpperCase()]=m[2].trim()});return o};
const subText=o=>PLAT4.map(p=>p+': '+(o[p]||'')).join('\n\n');
/* Platform yang perlu link: yang ditanda Posted; kalau tiada tanda langsung, semua 4 */
const subPlats=r=>{const on=PLAT4.filter((p,i)=>r.posted[i]);return on.length?on:PLAT4};
const pubRows=e=>e.groups.filter(g=>g.tab==='PRODUCTS'||g.tab==='NON').flatMap(g=>g.rows.filter(isSettled));
/* 2026-11-23 (Mira): Published ada tab Jobs (PRODUCTS) dan Creative (NON PRODUCT), format sama, link dua-dua ke Sheet */
const pubKind=e=>e.groups.some(g=>g.tab==='PRODUCTS')?'job':e.tab==='NON'||e.groups.some(g=>g.tab==='NON')?'creative':'job';
A.pubTab=el=>{ui.pubTab=el.dataset.id;render(true)};
function linkGaps(e){return pubRows(e).reduce((n,r)=>{const o=subParse(r.sub);return n+subPlats(r).filter(p=>r.posted[PLAT4.indexOf(p)]&&!o[p]).length},0)}
V.published=()=>{const sv=sheetView();const num=e=>{const g=e.groups.find(x=>x.tab==='PRODUCTS');return g?(+g.no||0):-1};
  const every=publishedEntries(sv).sort((a,b)=>num(b)-num(a)||a.name.localeCompare(b.name));const k=ui.pubTab||'job',nj=every.filter(e=>pubKind(e)==='job').length;const all=every.filter(e=>pubKind(e)===k);const list=all.filter(e=>hit('pub',e.name));
  const gaps=all.filter(e=>linkGaps(e)>0).length;
  return head(all.length+(k==='job'?' barang':' video creative')+(gaps?' · '+gaps+' belum lengkap link':''))+sheetNote()+kindSeg(k,nj,every.length-nj,'pubTab')+searchBox('pub',k==='job'?'Cari barang':'Cari video')+
  `<div class="list">${list.map(e=>{const g=e.groups.find(x=>x.tab==='PRODUCTS');const rows=pubRows(e);const gap=linkGaps(e);const open=ui.openPub===e.key;
    return `<details class="col card glass"${open?' open':''} data-pub="${esc(e.key)}"><summary><div class="rowh" style="align-items:center"><span class="bigno">${g?esc(g.no):k==='creative'?'✦':'·'}</span><div style="flex:1;min-width:0"><h3>${esc(e.name)}</h3><div class="meta">${e.vids} video${e.tab==='NON'?' · creative':e.tab==='APP'||e.tab==='FAIL'?' · tiada dalam sheet':''}</div></div>
      ${rows.length?`<span class="pill" style="--pc:${gap?'var(--bad)':'var(--ok)'}">${gap?gap+' link':IC.check+'Link'}</span>`:''}${rows.length?`<span class="ic chev">${IC.chev}</span>`:''}</div></summary>
     ${rows.length?`<div style="margin-top:12px">${rows.map(r=>{const o=subParse(r.sub);return `<div class="vid"><div style="font-weight:500;margin-bottom:8px">${r.vid?'VID '+esc(r.vid)+' · ':''}${esc(noEmoji(String(r.caption).split('\n')[0]).slice(0,60))}</div>
       ${subPlats(r).map(p=>`<label class="f" style="margin:0 0 6px"><span>${p}${r.posted[PLAT4.indexOf(p)]?' · posted':''}</span><input class="inp" id="sub-${r.row}-${p}" data-sub="${r.row}|${p}" value="${esc(o[p])}" placeholder="Paste link ${p}" inputmode="url"></label>`).join('')}</div>`}).join('')}
      <div class="btns" style="justify-content:flex-end;margin-top:10px"><button class="btn solid tab" data-act="subSave" data-id="${esc(e.key)}">Simpan link ke Sheet</button></div></div>`:''}</details>`}).join('')||`<div class="empty">${all.length?'Tiada padanan.':'Belum ada video settled.'}</div>`}</div>
  <p class="meta" style="margin-top:16px">Video masuk sini bila kau tick Settled dalam To Publish. Link disimpan dalam lajur LINK SUBMISSION setiap video (PRODUCTS Q, NON PRODUCT N). Merah: ada platform dah posted tapi link belum diisi.</p>`};
AFTER.published=()=>document.querySelectorAll('details[data-pub]').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)ui.openPub=d.dataset.pub;else if(ui.openPub===d.dataset.pub)ui.openPub=null}));
A.subSave=async el=>{const e=publishedEntries(sheetView()).find(x=>x.key===el.dataset.id);if(!e)return;if(!MCP){toast('Sheet belum bersambung');return}
  const raw=sheetRaw.PRODUCTS;let n=0,bad=false;
  for(const r of pubRows(e)){const o=subParse(r.sub);let ch=false;
    subPlats(r).forEach(p=>{const inp=document.getElementById('sub-'+r.row+'-'+p);if(!inp)return;const v=pickUrl(inp.value)||inp.value.trim();if(v&&!isUrl(v)){bad=true;return}if(v!==o[p]){o[p]=v;ch=true}});
    if(!ch)continue;const txt=subText(o);
    const non=r.tab==='NON',rw=non?sheetRaw.NON:raw;try{await sheetWrite(non?`'NON PRODUCT'!N${r.row}`:`PRODUCTS!Q${r.row}`,[[txt]]);if(rw){const a=rw[r.row-1]=(rw[r.row-1]||[]).slice();a[non?13:16]=txt}n++}catch(err){toast(sheetErrText(err.code));return}}
  document.activeElement&&document.activeElement.blur&&document.activeElement.blur();render(true);
  toast(bad?'Ada link tak sah (mesti mula https://). Yang lain disimpan':n?'Link disimpan dalam Sheet ('+n+' video)':'Tiada perubahan')};
