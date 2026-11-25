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
A.pubF=el=>{ui.pubF=el.dataset.id;render(true)};
function linkGaps(e){return pubRows(e).reduce((n,r)=>{const o=subParse(r.sub);return n+subPlats(r).filter(p=>r.posted[PLAT4.indexOf(p)]&&!o[p]).length},0)}
/* 2026-11-25 (Mira): kad Published disusun tiga bahagian: Video dan link (tekan kotak platform untuk tampal link),
   Footage asal (di mana footage duduk), START EDIT (pindah ke tab Edit sebagai VIDEO BARU dari footage sama; 0 token).
   Folder footage: padanan nama sendiri, atau pilihan Mira disimpan dalam sync/pubfoot {<kunci produk>: "<folder utama>/<projek>"}. */
function pubFolderKey(e){const m=(S.sync.pubfoot||{})[e.key];if(m)return m;
  const k=nrm(e.name),near=n=>{const a=nrm(n);return pMatch(n,e.name)||(a.length>=5&&k.length>=5&&(a.includes(k)||k.includes(a)))};
  const f=fuFolders().find(o=>{const n=o.v.split('/').slice(1).join('/');return !HELPER_DIR.test(n)&&near(n)});if(f)return f.v;
  const t=S.editor.find(x=>x.folder&&!/#r\d+$/.test(x.folder)&&near(x.name));return t?t.folder:''}
function folderInfo(key){if(!key)return null;const [st,...rest]=key.split('/'),nm=rest.join('/');const s=(((S.sync.toedit||{}).stages)||[]).find(x=>x.name===st);return (s&&(s.items||[]).find(x=>x.name===nm))||null}
const folderLabel=key=>String(key||'').replace(/^(\d+)\.\s*/,'$1 · ').replace('/',' › ');
const pubRedo=e=>S.redo.filter(x=>x.pubKey===e.key&&!redoDone(x));
function pubFoot(e){const key=pubFolderKey(e),fi=folderInfo(key);const best=(S.footage||[]).filter(d=>/TO HARD DRIVE/i.test(d.folder||d.clips||'')&&(pMatch(d.product,e.name)||pMatch(d.name,e.name)));
  const fin=(((S.sync.topost||{}).files)||[]).filter(x=>{const t=nrm(String(x.name||'').split(/[_-]+/)[0]),k=nrm(e.name);return t.length>=4&&(k.startsWith(t)||t.startsWith(k))}).length;
  const line=(c,h)=>`<p class="pbl"><i class="pbdot ${c}"></i><span>${h}</span></p>`;
  const raw=fi?line('ok',`<b>Mac mini</b> · ${esc(folderLabel(key))} · ${fi.clips||0} klip${fi.images?' + '+fi.images+' gambar':''}`)
    :key?line('bad',`<b>Mac mini</b> · ${esc(folderLabel(key))} · folder tak dijumpai`)
    :line('bad','<b>Folder footage belum dipaut</b>');
  const bst=best.map(d=>{const hd=d.moved||d.location;return line(hd?'hd':'wait',`<b>Klip terbaik</b> · ${esc(d.name||'')} · ${esc(String(d.files||d.clips||'').slice(0,12))} klip <span class="pill" style="--pc:${hd?'#5A8FB5':'var(--warn)'}">${hd?'Dalam Hard Disk':'Waiting to transfer'}</span>${d.backedUp?' · Drive ✓':''}`)}).join('');
  return raw+bst+(fin?line('ok',`<b>Video final</b> · 00 · TO POST FINAL · ${fin} fail`):'')+
    `<button type="button" class="pblink" data-act="pubFolder" data-id="${esc(e.key)}">${key?'Tukar folder footage':'Pilih folder footage'}</button>`}
V.published=()=>{const sv=sheetView();const num=e=>{const g=e.groups.find(x=>x.tab==='PRODUCTS')||e.groups.find(x=>x.tab==='NON');return g?(+g.no||0):-1};
  const every=publishedEntries(sv).sort((a,b)=>num(b)-num(a)||a.name.localeCompare(b.name));const k=ui.pubTab||'job',nj=every.filter(e=>pubKind(e)==='job').length;const all=every.filter(e=>pubKind(e)===k);
  const gapN=all.filter(e=>linkGaps(e)>0).length,edN=all.filter(e=>pubRedo(e).length).length;const pf=ui.pubF||'';
  const list=all.filter(e=>hit('pub',e.name)&&(pf==='link'?linkGaps(e)>0:pf==='edit'?pubRedo(e).length>0:true));
  const chip=(id,t)=>`<button type="button" class="pbf${pf===id?' on':''}" data-act="pubF" data-id="${id}">${t}</button>`;
  return head(all.length+(k==='job'?' barang':' video creative'))+sheetNote()+kindSeg(k,nj,every.length-nj,'pubTab')+searchBox('pub',k==='job'?'Cari barang':'Cari video')+
  `<div class="pbfs">${chip('','Semua')}${chip('link','Link belum · '+gapN)}${chip('edit','Sedang edit · '+edN)}</div>
  <div class="list">${list.map(e=>{const g=e.groups.find(x=>x.tab==='PRODUCTS')||e.groups.find(x=>x.tab==='NON');const rows=pubRows(e);const gap=linkGaps(e);const open=ui.openPub===e.key;const rd=pubRedo(e);
    return `<details class="col card glass pbc"${open?' open':''} data-pub="${esc(e.key)}"><summary><div class="rowh" style="align-items:center"><span class="bigno">${g&&g.no?esc(g.no):'·'}</span><div style="flex:1;min-width:0"><h3>${esc(e.name)}</h3><div class="meta">${e.vids} video dibuat${rd.length?' · '+rd.length+' sedang edit':''}${e.tab==='APP'||e.tab==='FAIL'?' · tiada dalam sheet':''}</div></div>
      ${gap?`<span class="pill" style="--pc:var(--bad)">${gap} link</span>`:''}<span class="ic chev">${IC.chev}</span></div></summary>
     ${open?`${rows.length?`<p class="eyebrow pbh">Video dan link</p>${rows.map((r,i)=>{const o=subParse(r.sub);return `<div class="pbv"><span class="pbt"><b>${esc(String(r.vid||i+1))}</b> · ${esc(noEmoji(String(r.caption).split('\n')[0]).slice(0,70))}</span><span class="pbxs">${subPlats(r).map(p=>{const po=r.posted[PLAT4.indexOf(p)];return `<button type="button" class="pbx${o[p]?' ok':po?' bad':''}" data-act="pubLink" data-id="${esc(e.key)}" data-x="${r.tab||''}|${r.row}|${p}" aria-label="Link ${p}${o[p]?' ada':po?' belum ada':''}">${p}</button>`}).join('')}</span></div>`}).join('')}`:''}
      <p class="eyebrow pbh">Footage asal</p>${pubFoot(e)}
      <div class="pbs"><button class="btn solid tab pbgo" data-act="pubStart" data-id="${esc(e.key)}">Start edit${IC.next}</button><span class="pbsn">${tok(0)} Pindah ke tab Edit sebagai video baru</span></div>`:''}</details>`}).join('')||`<div class="empty">${all.length?'Tiada padanan.':'Belum ada video settled.'}</div>`}</div>
  <p class="meta" style="margin-top:16px">Kotak platform: hijau = link ada, merah = dah posted tapi link belum. Link disimpan dalam Sheet (PRODUCTS Q, NON PRODUCT N).</p>`};
AFTER.published=()=>document.querySelectorAll('details[data-pub]').forEach(d=>d.addEventListener('toggle',()=>{if(d.open){if(ui.openPub!==d.dataset.pub){ui.openPub=d.dataset.pub;render(true)}}else if(ui.openPub===d.dataset.pub){ui.openPub=null}}));
const pubEntry=key=>publishedEntries(sheetView()).find(x=>x.key===key);
const pubRowOf=(e,x)=>{const [tab,row]=x.split('|');return pubRows(e).find(r=>String(r.row)===row&&String(r.tab||'')===tab)};
/* Tampal link satu platform terus dari kotak */
A.pubLink=el=>{const e=pubEntry(el.dataset.id);if(!e)return;const x=el.dataset.x,p=x.split('|')[2],r=pubRowOf(e,x);if(!r)return;const o=subParse(r.sub);
  modal(`<h2>Link ${esc(p)}</h2><p class="meta">${esc(e.name)} · ${r.vid?'VID '+esc(String(r.vid)):''} ${esc(noEmoji(String(r.caption).split('\n')[0]).slice(0,50))}</p>
   <label class="f"><span>Link ${esc(p)}</span><input class="inp" id="pbL" value="${esc(o[p])}" placeholder="https://" inputmode="url" autocapitalize="off" autocorrect="off"></label>
   <div class="btns" style="justify-content:flex-end;flex-wrap:wrap"><button class="btn" data-act="pubPaste">Paste</button>${isUrl(o[p])?`<a class="btn" href="${esc(o[p])}" target="_blank" rel="noopener">${IC.ext}Buka</a>`:''}<button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="pubLinkSave" data-id="${esc(e.key)}" data-x="${esc(x)}">Simpan</button></div>`,TAB.published.c)};
A.pubPaste=async()=>{try{const t=await navigator.clipboard.readText();const i=$('#pbL');if(i&&t)i.value=pickUrl(t)||t.trim()}catch(e){toast('Tekan lama dalam kotak, pilih Paste')}};
A.pubLinkSave=async el=>{const e=pubEntry(el.dataset.id);if(!e)return;if(!MCP){toast('Sheet belum bersambung');return}const x=el.dataset.x,p=x.split('|')[2],r=pubRowOf(e,x);if(!r)return;
  const raw=($('#pbL')||{}).value||'',v=pickUrl(raw)||raw.trim();if(v&&!isUrl(v)){toast('Link mesti mula https://');return}
  const o=subParse(r.sub);if(v===o[p]){closeModal();return}o[p]=v;const txt=subText(o),non=r.tab==='NON',rw=non?sheetRaw.NON:sheetRaw.PRODUCTS;el.disabled=true;el.innerHTML='<i class="spin"></i>Simpan';
  try{await sheetWrite(non?`'NON PRODUCT'!N${r.row}`:`PRODUCTS!Q${r.row}`,[[txt]]);if(rw){const a=rw[r.row-1]=(rw[r.row-1]||[]).slice();a[non?13:16]=txt}closeModal();render(true);toast('Link '+p+' disimpan dalam Sheet')}
  catch(err){el.disabled=false;el.textContent='Simpan';toast(sheetErrText(err.code))}};
/* Pilih / tukar folder footage untuk satu produk published */
A.pubFolder=el=>{const e=pubEntry(el.dataset.id);if(!e)return;modal(`<h2>Folder footage</h2><p class="meta">${esc(e.name)}</p>
  <label class="f"><span>Folder dalam CLAUDE EDITS</span>${fuSel('pbF',pubFolderKey(e),false,e.name)}</label><p class="meta">Footage yang dishoot sekali untuk banyak video (cth GENTING): pilih folder yang sama untuk setiap produk.</p>
  <div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="pubFolderSave" data-id="${esc(e.key)}"${el.dataset.x?' data-x="1"':''}>Simpan</button></div>`,TAB.published.c)};
A.pubFolderSave=el=>{const v=($('#pbF')||{}).value||'';if(!v){toast('Pilih folder dulu');return}const m=Object.assign({},S.sync.pubfoot||{},{[el.dataset.id]:v});S.sync.pubfoot=m;saveDoc('sync/pubfoot',m);closeModal();
  if(el.dataset.x)A.pubStart(el);else{render(true);toast('Folder footage disimpan')}};
/* START EDIT: buat kad "video baru" dalam tab Edit (koleksi redo). Tiada sesi Claude dibuka di sini. */
const redoTracker=x=>S.editor.find(t=>t.folder===x.folder+'#r'+x.n)||null;
const redoDone=x=>{const t=redoTracker(x);return !!(t&&edDone(t))};
A.pubStart=el=>{const e=pubEntry(el.dataset.id);if(!e)return;const key=pubFolderKey(e);
  if(!key){toast('Pilih folder footage dulu');A.pubFolder({dataset:{id:e.key,x:'1'}});return}
  const n=Math.max(e.vids,...S.redo.filter(x=>x.pubKey===e.key).map(x=>x.n||0))+1;
  save('redo',{id:'r'+uid(),title:e.name,folder:key,n,pubKey:e.key,kind:pubKind(e),at:Date.now()});
  toast('Video baru #'+n+' masuk tab Edit. Tekan EDIT NOW di sana');location.hash='#to-edit'};
