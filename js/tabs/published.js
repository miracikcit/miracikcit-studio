/* ---------- PUBLISHED ---------- */
V.published=()=>{const sv=sheetView();const num=e=>{const g=e.groups.find(x=>x.tab==='PRODUCTS');return g?(+g.no||0):-1};
  const all=publishedEntries(sv).sort((a,b)=>num(b)-num(a)||a.name.localeCompare(b.name));const list=all.filter(e=>hit('pub',e.name));
  return head(all.length+' barang · nombor ikut sheet')+sheetNote()+searchBox('pub','Cari barang')+
  `<div class="list">${list.map(e=>{const g=e.groups.find(x=>x.tab==='PRODUCTS');const pm=get('pubmeta',e.key)||{};const kind=pm.kind||(g&&g.kind)||'';const price=pm.price!==undefined?pm.price:(g&&g.price)||'';
    return `<div class="card glass"><div class="rowh"><span class="bigno">${g?esc(g.no):'·'}</span><div><h3>${esc(e.name)}</h3><div class="meta">${e.vids}${e.total>e.vids?' / '+e.total:''} video settled${e.tab==='NON'?' · bukan produk':e.tab==='APP'||e.tab==='FAIL'?' · tiada dalam sheet':''}</div></div>${e.legacy?`<button class="btn icon sm" data-act="unPub" data-id="${e.legacy.id}" aria-label="Batal published">${IC.back}</button>`:''}</div>
    <div class="btns" style="margin-top:12px"><div class="seg">${['SAMPLE','BELI','NIL'].map(k=>`<button type="button" class="${kind===k?'on':''}" data-act="pubKind" data-id="${esc(e.key)}" data-x="${k}">${k}</button>`).join('')}</div>
     <input class="inp" style="width:130px" id="pp-${esc(e.key)}" data-pubprice="${esc(e.key)}" value="${esc(price)}" placeholder="Harga RM" inputmode="decimal"></div></div>`}).join('')||`<div class="empty">${all.length?'Tiada padanan.':'Belum ada video settled.'}</div>`}</div>
  <p class="meta" style="margin-top:16px">Barang baru di atas. Jenis dan harga disimpan ke sheet CONTENT 2026, lajur JENIS (R) dan HARGA (S).</p>`};
function savePub(key,patch){const pm=Object.assign({id:key},get('pubmeta',key)||{},patch);save('pubmeta',pm);
  if(MCP){const e=publishedEntries(sheetView()).find(x=>x.key===key);const g=e&&e.groups.find(x=>x.tab==='PRODUCTS');if(g)sheetWrite(`PRODUCTS!R${g.start}:S${g.start}`,[[pm.kind||'',pm.price||'']]).then(()=>toast('Sheet dikemas kini')).catch(()=>toast('Disimpan dalam app. Sheet tak dapat dikemas kini'))}}
A.pubKind=el=>{const pm=get('pubmeta',el.dataset.id)||{};savePub(el.dataset.id,{kind:pm.kind===el.dataset.x?'':el.dataset.x})};
A.unPub=el=>del('published',el.dataset.id);

