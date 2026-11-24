/* ---------- INSPIRATION ---------- */
V.inspiration=()=>{const list=S.inspo.slice().sort((a,b)=>(b.created||0)-(a.created||0));const nr=S.gaya.filter(g=>g.status==='semak'||g.status==='simpan').length;
  if((ui.inSeg||'resipi')==='resipi')return gyView();
  return head(list.length+' rujukan design',`<button class="btn solid tab" data-act="inUp">${IC.up}Upload screenshot</button>`)+inSegs()+
  (list.length?`<div class="igrid glass">${list.map(i=>`<div class="icell${ui.inSel===i.id?' sel':''}"><button type="button" class="ipic" data-act="inPick" data-id="${i.id}" aria-label="${esc(i.title||'Rujukan')}">${i.asset?`<img src="${blobUrl(esc(i.asset))}" alt="${esc(i.title||'')}" loading="lazy">`:esc(i.title||'Nota')}</button>
    <span class="iact"><button type="button" class="btn icon sm" data-act="inOpen" data-id="${i.id}" aria-label="Buka">${IC.edit}</button><button type="button" class="btn icon sm solid bad" data-act="inDel" data-id="${i.id}" aria-label="Padam">${IC.trash}</button></span></div>`).join('')}</div>`:`<div class="empty">Upload screenshot rujukan di sini. Bila kau cakap "refer inspiration board aku", Claude rujuk board ni.</div>`)+
  `<p class="meta" style="margin-top:14px">Tekan gambar untuk keluarkan butang buka dan padam. Claude baca board ni bila kau cakap "refer inspiration board aku".</p>`};
A.inPick=el=>{ui.inSel=ui.inSel===el.dataset.id?null:el.dataset.id;render(true)};
A.inUp=()=>{if(!ASSETS){toast('Upload tak tersedia di sini');return}pickFile('image/*',async files=>{let n=0;toast('Sedang upload '+files.length+' gambar');
  for(const f of files){if(f.size>20*1048576)continue;try{const r=await ASSETS.upload(f);save('inspo',{asset:r.id,title:'',note:'',tag:'',url:''},true);n++}catch(e){}}render(true);toast(n+' gambar masuk board')},true)};
A.inOpen=el=>{const i=get('inspo',el.dataset.id);modal(`${i.asset?`<img src="${blobUrl(esc(i.asset))}" alt="" style="width:100%;border-radius:18px;display:block;margin-bottom:14px">`:''}
  <label class="f"><span>Tajuk</span><input class="inp" id="inT" value="${esc(i.title||'')}" placeholder="cth. Gaya tajuk"></label><label class="f"><span>Kenapa suka</span><textarea class="inp" id="inN" rows="2">${esc(i.note||'')}</textarea></label>
  <div class="row2"><label class="f"><span>Tag</span><input class="inp" id="inG" value="${esc(i.tag||'')}" placeholder="hook, tajuk, end card"></label><label class="f"><span>Link</span><input class="inp" id="inU" value="${esc(i.url||'')}" inputmode="url"></label></div>
  <div class="btns" style="justify-content:flex-end">${isUrl(i.url)?`<a class="btn sm" href="${esc(i.url)}" target="_blank" rel="noopener">${IC.ext}Buka link</a>`:''}<button class="btn" data-act="closeModal">Tutup</button><button class="btn solid tab" data-act="inSave" data-id="${i.id}">Simpan</button></div>`)};
A.inSave=el=>{const i=get('inspo',el.dataset.id);save('inspo',Object.assign({},i,{title:$('#inT').value.trim(),note:$('#inN').value,tag:$('#inG').value.trim(),url:$('#inU').value.trim()}));closeModal();toast('Disimpan')};
A.inDel=el=>{const i=get('inspo',el.dataset.id);confirmBox('Padam gambar rujukan ni?',()=>{ui.inSel=null;del('inspo',i.id);if(i.asset&&ASSETS&&!S.inspo.some(x=>x.asset===i.asset))ASSETS.delete(i.asset).catch(()=>{});toast('Dipadam')})};

