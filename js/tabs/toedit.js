/* ---------- TO EDIT ---------- */
const editCmd=(stage,name)=>/^(21|31)/.test(stage)?`Edit folder ${name} / Product Listing ${name} dalam folder R1`:`Edit folder ${name} dalam folder ${stage}`;
V['to-edit']=()=>{const te=S.sync.toedit;
  const rows=toEditFolders().map(x=>({kind:'f',key:x.key,no:fno(x.stage),name:x.name,sub:[x.stage.replace(/^\d+\.\s*/,''),(x.clips||0)+' klip'+(x.images?' + '+x.images+' gambar':'')].join(' · '),start:x.mtime,copy:editCmd(x.stage,x.name)}))
   .concat(byStage('toedit').map(it=>({kind:'i',key:it.id,no:fno(it.folder),name:it.title,sub:[(it.folder||'Belum pilih folder').replace(/^\d+\.\s*/,''),it.account].filter(Boolean).join(' · '),start:(it.stageAt&&it.stageAt.toedit)||it.created,copy:editCmd(it.folder||'folder edit',it.title)})))
   .map(r=>Object.assign(r,{d:deadline(r.start,14)})).sort((a,b)=>(a.d?a.d.left:99)-(b.d?b.d.left:99));
  return head(te?'Folder sync '+fmtD(te.syncedAt):'Belum sync',`<button class="btn sm" data-act="addEdit">${IC.plus}Tambah</button>`)+
  `<div class="list">${rows.map(r=>`<div class="card glass"><div class="rowh">${fnoBadge(r.no)}<div><h3>${esc(r.name)}</h3><div class="meta">${esc(r.sub)}${r.start?' · masuk '+fmtD(r.start):''}</div></div></div>
    ${trk(r.d,'Edit dalam 2 minggu')}
    <div class="btns" style="margin-top:12px"><button class="btn sm solid tab" data-act="${r.kind==='f'?'fEdited':'iEdited'}" data-id="${esc(r.key)}">${IC.check}Dah edit</button><button class="btn sm" data-act="copy" data-x="${esc(r.copy)}">${IC.copy}Copy arahan</button><button class="btn icon sm bad" data-act="${r.kind==='f'?'fHide':'delItem'}" data-id="${esc(r.key)}" aria-label="Buang">${IC.trash}</button></div></div>`).join('')||`<div class="empty">${te?'Tiada video tunggu edit.':'Belum sync. Tekan Sync folder di Home, lepas tu paste dalam chat dengan Claude.'}</div>`}</div>`};
A.copy=el=>copyText(el.dataset.x);
A.fEdited=el=>{markToEdit(el.dataset.id,'done');toast('Siap edit')};
A.fHide=el=>{const k=el.dataset.id;confirmBox('Buang "'+k.split('/').pop()+'" dari To Edit?',()=>{markToEdit(k,'hidden');toast('Dibuang')},'Ya, buang')};
A.iEdited=el=>moveItem(get('items',el.dataset.id),'ready');
A.addEdit=()=>modal(`<h2>Tambah video untuk edit</h2><label class="f"><span>Nama video</span><input class="inp" id="aeT"></label><label class="f"><span>Folder</span><select class="inp" id="aeF">${FOLDERS.map(f=>`<option>${esc(f)}</option>`).join('')}</select></label><div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="addEditSave">Simpan</button></div>`);
A.addEditSave=()=>{const t=$('#aeT').value.trim();if(!t){toast('Isi nama video');return}save('items',{title:t,stage:'toedit',folder:$('#aeF').value,stageAt:{toedit:Date.now()}});closeModal()};

