/* ---------- LINKS ---------- */
const bothText=(s,t)=>[s?'✅ Beli di Shopee: '+s:'',t?'✅ Beli di Tiktok: '+t:''].filter(Boolean).join('\n');
V.links=()=>{const sv=sheetView();
  if(!sv)return head('Sheet CONTENT 2026 · tab PRODUCTS')+sheetNote();
  const gs=sv.groups.filter(g=>g.tab==='PRODUCTS').slice().sort((a,b)=>(+b.no||0)-(+a.no||0));const list=gs.filter(g=>hit('lk',g.no,g.name));const miss=gs.filter(g=>!g.shopee).length;
  const extra=S.items.filter(it=>it.shopee&&!gs.some(g=>g.shopee===it.shopee));
  const bar=(id,lk,val,ph)=>`<span class="inwrap"><input class="inp" id="${id}" data-lk="${lk}" value="${esc(val)}" placeholder="${ph}" inputmode="url"><button type="button" class="btn icon sm" data-act="cpIn" data-id="${id}" aria-label="Copy">${IC.copy}</button></span>`;
  return head(gs.length+' produk · nombor ikut sheet')+searchBox('lk','Cari nombor atau nama produk')+(miss?`<p class="meta" style="margin:-4px 0 12px;color:var(--bad)">${miss} produk belum ada link Shopee.</p>`:'')+
  `<div class="list">${list.map(g=>`<div class="card glass"><div class="rowh"><span class="bigno">${esc(g.no)}</span><div><h3>${esc(g.name)}</h3><div class="meta">baris ${g.start} · ${g.rows.length} video</div></div></div>
    <label class="f" style="margin-top:12px"><span>Shopee</span>${bar('ls-'+g.start,g.start+'|s',g.shopee,'https://s.shopee.com.my/...')}</label>
    <label class="f"><span>TikTok</span>${bar('lt-'+g.start,g.start+'|t',g.tt,'https://vt.tiktok.com/...')}</label>
    <div class="btns" style="justify-content:flex-end"><button class="btn sm" data-act="lkBoth" data-id="${g.start}">Both</button><button class="btn sm solid tab" data-act="lkSave" data-id="${g.start}">Simpan ke sheet</button></div></div>`).join('')||`<div class="empty">Tiada padanan.</div>`}</div>
  ${extra.length?`<p class="eyebrow" style="margin-top:22px">Link dari nota, belum dalam sheet · ${extra.length}</p><div class="list">${extra.map(it=>`<div class="card glass"><div class="rowh"><div><h3>${esc(it.title)}</h3><div class="meta">${esc(it.shopee)}</div></div><button class="btn icon sm" data-act="copy" data-x="${esc(it.shopee)}" aria-label="Copy">${IC.copy}</button></div></div>`).join('')}</div>`:''}`};
A.cpIn=el=>{const v=($('#'+el.dataset.id)||{}).value||'';if(!v.trim()){toast('Belum ada link');return}copyText(v.trim(),'Link dicopy')};
A.lkBoth=el=>{const s=($('#ls-'+el.dataset.id)||{}).value||'',t=($('#lt-'+el.dataset.id)||{}).value||'';const txt=bothText(s.trim(),t.trim());if(!txt){toast('Belum ada link');return}
  modal(`<h2>Shopee + TikTok</h2><textarea class="inp" id="bothTxt" rows="4" readonly>${esc(txt)}</textarea><div class="btns" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-act="closeModal">Tutup</button><button class="btn solid tab" data-act="bothCopy">${IC.copy}Copy</button></div>`)};
A.bothCopy=()=>{copyText($('#bothTxt').value,'Template dicopy');closeModal()};

