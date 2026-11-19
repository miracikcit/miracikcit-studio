/* ---------- nota modal (To Shoot, Shot) ---------- */
function notaHTML(it){const p=it.productId&&get('products',it.productId);const n=it.nota||{};const ul=a=>(a||[]).length?`<ul>${a.map(x=>`<li>${esc(noEmoji(x))}</li>`).join('')}</ul>`:'';
  let h='';
  if(n.raw)h+=`<pre class="txt">${esc(noEmoji(n.raw))}</pre>`;
  if((n.usp||[]).length)h+=`<h4>Point penting / USP</h4>${ul(n.usp)}`;
  if((n.hook||[]).length)h+=`<h4>Pilihan hook</h4>${ul(n.hook)}`;
  if(n.script)h+=`<h4>Skrip ringkas</h4><pre class="txt">${esc(noEmoji(n.script))}</pre>`;
  if((n.shots||[]).length)h+=`<h4>Shot list</h4>${ul(n.shots)}`;
  if((n.extra||[]).length)h+=`<h4>Persediaan</h4>${ul(n.extra)}`;
  if(p){if(p.subtitle)h+=`<p class="meta">${esc(noEmoji(p.subtitle))}</p>`;if(p.assumption)h+=`<p class="meta">${esc(noEmoji(p.assumption))}</p>`;
    (p.sections||[]).forEach(s=>{h+=`<h4${s.danger?' style="color:var(--bad)"':''}>${esc(noEmoji(String(s.title||'').replace(/^\d+\.\s*/,'')))}</h4>${ul(s.items)}`;(s.groups||[]).forEach(g=>{h+=`<p style="margin:8px 0 4px;font-weight:500">${esc(noEmoji(g.title))}</p>${ul(g.items)}`})});
    S.boards.filter(b=>b.productId===p.id).forEach(b=>{h+=`<h4>Shot list: ${esc(noEmoji(b.title||''))}</h4><ul>${(b.shots||[]).map(s=>`<li>${esc(noEmoji('['+s.type+(s.dur?' · '+s.dur+'s':'')+'] '+(s.visual||'')+(s.vo?' · VO: '+s.vo:'')))}</li>`).join('')}</ul>`})}
  if(!h&&it.src&&it.src.text)h=`<h4>Idea asal</h4><pre class="txt">${esc(noEmoji(it.src.text))}</pre>`;
  return h||'<p class="meta">Belum ada nota.</p>'}
function notaText(it){const d=document.createElement('div');d.innerHTML=notaHTML(it).replace(/<\/(h4|li|p|pre)>/g,'\n').replace(/<li>/g,'• ');return (it.title||'')+'\n\n'+d.textContent.replace(/\n{3,}/g,'\n\n').trim()}
A.nota=el=>{const it=get('items',el.dataset.id);const p=it.productId&&get('products',it.productId);
  modal(`<div class="rowh"><h2>${esc(it.title||'Nota')}</h2><button class="btn icon sm" data-act="closeModal" aria-label="Tutup">${IC.x}</button></div>${notaHTML(it)}
  <div class="btns" style="margin-top:18px"><button class="btn sm" data-act="copyNota" data-id="${it.id}">${IC.copy}Copy nota</button>${it.listing&&it.listing.folder?`<button class="btn sm" data-act="notaRedo" data-id="${it.id}">${IC.edit}Buat semula dari listing</button>`:''}${it.nota?`<button class="btn sm" data-act="editNota" data-id="${it.id}">${IC.edit}Edit nota</button>`:''}${p&&p.pdf?`<button class="btn sm" data-act="pdfNota" data-id="${p.id}">PDF</button>`:''}</div>`,TAB[STAGE_TAB[it.stage]].c)};
A.copyNota=el=>copyText(notaText(get('items',el.dataset.id)));
A.pdfNota=el=>{const p=get('products',el.dataset.id);if(!p||!p.pdf){toast('PDF tiada');return}window.open(studioFileView(p.pdf),'_blank','noopener')};
A.editNota=el=>{const it=get('items',el.dataset.id);const n=it.nota||{};const ta=(id,l,v,r)=>`<label class="f"><span>${l}</span><textarea class="inp" id="${id}" rows="${r||4}">${esc(Array.isArray(v)?v.join('\n'):v||'')}</textarea></label>`;
  modal(`<h2>Edit nota</h2><label class="f"><span>Tajuk</span><input class="inp" id="enT" value="${esc(it.title||'')}"></label>${ta('enU','Point penting / USP (satu baris satu)',n.usp)}${ta('enH','Pilihan hook',n.hook,3)}${ta('enS','Skrip ringkas',n.script,6)}${ta('enL','Shot list',n.shots,6)}${ta('enE','Persediaan',n.extra,3)}
  <label class="f"><span>Link Shopee (kalau dah ada)</span><input class="inp" id="enK" value="${esc(it.shopee||'')}" placeholder="https://s.shopee.com.my/..." inputmode="url"></label>
  <div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="saveNota" data-id="${it.id}">Simpan</button></div>`,TAB[STAGE_TAB[it.stage]].c)};
A.saveNota=el=>{const it=get('items',el.dataset.id);const k=$('#enK').value.trim();if(k&&!isUrl(k)){toast('Link mesti mula dengan https://');return}
  save('items',Object.assign({},it,{title:$('#enT').value.trim()||it.title,shopee:k,nota:{raw:(it.nota||{}).raw||'',usp:lines($('#enU').value),hook:lines($('#enH').value),script:$('#enS').value.trim(),shots:lines($('#enL').value),extra:lines($('#enE').value)}}));closeModal();toast('Nota disimpan')};

A.notaRedo=el=>{const it=get('items',el.dataset.id);closeModal();smpNota(it)};
