/* ---------- IDEAS ---------- */
V.ideas=()=>{const d=ui.draft;const list=byStage('ideas');
  return head('Voice memo, PDF atau taip')+`
  <div class="card big glass">
   <div class="seg" style="margin-bottom:14px">${[['voice','Voice memo'],['pdf','PDF'],['text','Taip']].map(([k,l])=>`<button type="button" class="${d.type===k?'on':''}" data-act="draftType" data-id="${k}">${l}</button>`).join('')}</div>
   <label class="f"><span>Tajuk idea</span><input class="inp" id="dTitle" data-draft="title" value="${esc(d.title)}" placeholder="cth. Pewangi kereta mini"></label>
   ${d.type==='voice'?`<div class="btns" style="margin-bottom:10px"><button class="btn" data-act="pickVoice">${IC.up}Upload .m4a</button>${DICT?`<button class="btn ${ui.rec?'solid rose':''}" data-act="dictate">${IC.mic}${ui.rec?'Berhenti':'Rakam terus'}</button>`:''}${d.asset?`<span class="pill">${esc(d.fileName||'audio')}</span>`:''}</div>
     ${d.asset?`<audio controls preload="none" src="${blobUrl(esc(d.asset))}"></audio><p class="meta" style="margin:8px 0">Fail audio disimpan. Simpan idea dulu, kemudian tekan Transkrip di Mac mini (percuma, tiada token).</p>`:''}`:''}
   ${d.type==='pdf'?`<div class="btns" style="margin-bottom:10px"><button class="btn" data-act="pickPdf">${IC.up}Upload PDF</button>${d.fileName?`<span class="pill">${esc(d.fileName)}</span>`:''}</div>`:''}
   <label class="f"><span>${d.type==='text'?'Idea kau':d.type==='pdf'?'Teks dari PDF':'Transkrip atau isi ringkas'}</span><textarea class="inp" id="dText" data-draft="text" rows="5" placeholder="Produk apa, masalah apa, apa yang kau nak tunjuk">${esc(d.text)}</textarea></label>
   <div class="btns"><button class="btn solid tab" data-act="genDraft"${ui.busy?' disabled':''}>${ui.busy?'Sedang jana':'Generate'}</button><button class="btn" data-act="saveDraft">Simpan idea dulu</button></div>
   <p class="meta" style="margin:10px 0 0">Generate guna Claude melalui Mac mini (guna usage Claude kau; bulan ni ${studioUsage()} kali). Ia buat nota (point penting, skrip ringkas, shot list) dan terus masuk To Shoot. PDF yang dah berbentuk nota tak dijana semula, terus disimpan di To Shoot.</p>
  </div>
  <p class="eyebrow" style="margin-top:22px">Idea tersimpan · ${list.length}</p>
  <div class="list">${list.map(it=>`<div class="card glass"><div class="rowh"><div><h3>${esc(it.title||'Idea')}</h3><div class="meta">${esc(noEmoji((it.src&&it.src.text)||'').slice(0,160))}</div>${it.src&&it.src.asset&&it.src.type==='voice'?`<audio controls preload="none" src="${blobUrl(esc(it.src.asset))}"></audio>`:''}</div>
    <button class="btn icon sm bad" data-act="delItem" data-id="${it.id}" aria-label="Padam">${IC.trash}</button></div>
    <div class="btns" style="margin-top:10px"><button class="btn sm solid tab" data-act="genItem" data-id="${it.id}">Generate</button><button class="btn sm" data-act="editIdea" data-id="${it.id}">${IC.edit}Edit</button>${it.src&&it.src.type==='voice'&&!(it.src.text||'').trim()?`<button class="btn sm" data-act="askTranscribe" data-id="${it.id}">${IC.mic}Transkrip di Mac mini</button>`:''}</div></div>`).join('')||`<div class="empty">Belum ada idea tersimpan.</div>`}</div>`};
A.draftType=el=>{ui.draft.type=el.dataset.id;render(true)};
A.pickVoice=()=>pickFile('audio/*,.m4a',async f=>{if(!ASSETS){toast('Upload tak tersedia di sini');return}if(f.size>20*1048576){toast('Fail lebih 20 MB');return}toast('Sedang upload');
  try{const r=await ASSETS.upload(f);ui.draft.asset=r.id;ui.draft.fileName=f.name;if(!ui.draft.title)ui.draft.title=f.name.replace(/\.[^.]+$/,'');render(true);toast('Audio disimpan')}catch(e){toast('Upload gagal')}});
A.dictate=async()=>{if(!DICT)return;if(ui.rec){ui.rec=false;DICT.stop().catch(()=>{});render(true);return}
  const p=DICT.start({language:'ms'});ui.rec=true;
  if(!ui.dictBound){ui.dictBound=true;DICT.onFinal(({text})=>{ui.draft.text=(ui.draft.text?ui.draft.text+' ':'')+text;const el=$('#dText');if(el)el.value=ui.draft.text});DICT.onState(({state})=>{if(state==='idle'&&ui.rec){ui.rec=false;render(true)}})}
  p.catch(e=>{ui.rec=false;render(true);toast(e&&e.code==='not_granted'?'Mikrofon tak dibenarkan':'Rakaman tak dapat dimulakan')});render(true)};
A.pickPdf=()=>pickFile('.pdf,application/pdf',async f=>{
  const buf=new Uint8Array(await f.arrayBuffer());let txt='';for(let i=0;i<buf.length;i+=65536)txt+=String.fromCharCode.apply(null,buf.subarray(i,i+65536));
  const m=txt.match(/CIKCIT1:([A-Za-z0-9+\/=]+)/);
  if(m){try{const data=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(m[1]),c=>c.charCodeAt(0))));const prod=(data.docs||[]).find(x=>String(x.path||'').startsWith('products/'));
      if(prod){const id=prod.path.split('/')[1];if(ASSETS){try{const r=await ASSETS.upload(f);prod.data.pdf=r.id;prod.data.pdfName=f.name}catch(e){}}
        save('products',Object.assign({},prod.data,{id}),true);(data.docs||[]).filter(x=>String(x.path||'').startsWith('boards/')).forEach(b=>save('boards',Object.assign({},b.data,{id:b.path.split('/')[1]}),true));
        const now=Date.now();save('items',{title:prod.data.name||f.name,brand:prod.data.brand||'',stage:'toshoot',productId:id,noteAt:now,shootDate:ymd(new Date(now+30*DAY)),stageAt:{toshoot:now},src:{type:'pdf',name:f.name}});
        toast('Nota masuk To Shoot');go('to-shoot');return}}catch(e){}}
  toast('Sedang baca PDF');
  try{await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js');pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    const pdf=await pdfjsLib.getDocument({data:buf}).promise;let out='';for(let p=1;p<=Math.min(pdf.numPages,30);p++){const pg=await pdf.getPage(p);const c=await pg.getTextContent();out+=c.items.map(i=>i.str+(i.hasEOL?'\n':' ')).join('')+'\n'}
    ui.draft.text=out.trim().slice(0,20000);ui.draft.fileName=f.name;if(!ui.draft.title)ui.draft.title=f.name.replace(/\.pdf$/i,'').replace(/[_-]+/g,' ');
    if(ASSETS){try{const r=await ASSETS.upload(f);ui.draft.asset=r.id}catch(e){}}
    const keys=(out.match(/hook|usp|shot ?list|point utama|point penting|cta|skrip|script|idea video|jangan sebut/gi)||[]).map(x=>x.toLowerCase().replace(/\s/g,''));
    if(new Set(keys).size>=3){const now=Date.now();const d=ui.draft;save('items',{title:(d.title||f.name).slice(0,80),stage:'toshoot',noteAt:now,shootDate:ymd(new Date(now+30*DAY)),stageAt:{toshoot:now},nota:{raw:out.trim().slice(0,20000)},src:{type:'pdf',name:f.name,asset:d.asset||''}},true);ui.draft={type:'pdf',title:'',text:''};toast('PDF ni dah berbentuk nota. Terus masuk To Shoot');go('to-shoot');return}
    render(true);toast(out.trim()?'Teks PDF dah masuk':'PDF ni tiada teks. Taip isi ringkas')}
  catch(e){toast('Tak dapat baca PDF ni. Taip isi ringkas')}});
function draftToItem(){const d=ui.draft;const title=(d.title||'').trim()||lines(d.text)[0]||'';if(!title&&!d.asset){toast('Isi tajuk atau idea dulu');return null}
  const it=save('items',{title:(title||d.fileName||'Idea').slice(0,80),stage:'ideas',stageAt:{ideas:Date.now()},src:{type:d.type,text:d.text||'',asset:d.asset||'',name:d.fileName||''}},true);
  ui.draft={type:d.type,title:'',text:''};return it}
A.saveDraft=()=>{if(draftToItem()){render(true);toast('Idea disimpan')}};
A.genDraft=()=>{const d=ui.draft;if(!(d.text||'').trim()&&!(d.title||'').trim()){toast(d.type==='voice'?'Perlu transkrip atau isi ringkas untuk generate':'Isi idea dulu');return}const it=draftToItem();if(it)generate(it)};
A.genItem=el=>{const it=get('items',el.dataset.id);if(!it)return;if(!((it.src&&it.src.text)||'').trim()&&!(it.title||'').trim()){toast('Idea ni belum ada isi');return}generate(it)};
A.askTranscribe=async el=>{const it=get('items',el.dataset.id);if(!it||!it.src||!it.src.asset)return;toast('Mac mini sedang transkrip (percuma, tiada token)');
  try{const r=await studioJob('voice',{file:it.src.asset},15*60000);const cur=get('items',it.id)||it;save('items',Object.assign({},cur,{src:Object.assign({},cur.src,{text:r.text||''})}));toast(r.text?'Transkrip siap':'Tiada suara dikesan')}
  catch(e){toast(e&&e.code==='unavailable'?'Tiada internet':'Transkrip gagal. Semak Mac mini hidup')}};
A.editIdea=el=>{const it=get('items',el.dataset.id);modal(`<h2>Edit idea</h2><label class="f"><span>Tajuk</span><input class="inp" id="eiT" value="${esc(it.title||'')}"></label><label class="f"><span>Isi idea</span><textarea class="inp" id="eiX" rows="6">${esc((it.src&&it.src.text)||'')}</textarea></label><div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="saveIdea" data-id="${it.id}">Simpan</button></div>`)};
A.saveIdea=el=>{const it=get('items',el.dataset.id);save('items',Object.assign({},it,{title:$('#eiT').value.trim()||it.title,src:Object.assign({},it.src,{text:$('#eiX').value})}));closeModal();toast('Disimpan')};
A.delItem=el=>{const it=get('items',el.dataset.id);confirmBox('Padam "'+(it.title||'item')+'"?',()=>{del('items',it.id);toast('Dipadam')})};
async function generate(it){
  if(!SAMPLE){render(true);toast('Generate tak tersedia dalam paparan ni. Idea disimpan');return}
  ui.busy=true;render(true);
  const prompt=`Kau pembantu content creator Malaysia @miracikcit yang buat video pendek 9:16 (TikTok, Reels) dalam Bahasa Melayu santai macam bercakap dengan kawan. Dari idea di bawah, sediakan nota untuk shoot video.
Balas JSON sahaja dengan bentuk: {"tajuk": string (maksimum 8 perkataan), "usp": [4 hingga 6 point penting atau USP], "hook": [3 pilihan hook, setiap satu maksimum 8 perkataan], "skrip": string (skrip ringkas 5 hingga 8 ayat santai, satu ayat satu baris), "shotlist": [6 hingga 10 shot, format "jenis shot: apa yang nampak"], "persediaan": [prop, lokasi, pakaian atau benda yang perlu disediakan sebelum shoot]}
Peraturan: semua dalam Bahasa Melayu. Tanpa emoji. Jangan reka harga, claim kesihatan atau fakta yang tiada dalam idea.

TAJUK: ${it.title||''}
IDEA:
${String((it.src&&it.src.text)||it.title||'').slice(0,12000)}`;
  try{const r=await SAMPLE.json(prompt,{cache:false});const arr=x=>Array.isArray(x)?x.map(v=>noEmoji(String(v))).filter(Boolean):lines(noEmoji(String(x||'')));
    const now=Date.now();const cur=get('items',it.id)||it;
    save('items',Object.assign({},cur,{title:noEmoji(r.tajuk||cur.title).slice(0,80)||cur.title,stage:'toshoot',noteAt:now,shootDate:ymd(new Date(now+30*DAY)),stageAt:Object.assign({},cur.stageAt,{toshoot:now}),
      nota:{usp:arr(r.usp),hook:arr(r.hook),script:noEmoji(Array.isArray(r.skrip)?r.skrip.join('\n'):String(r.skrip||'')),shots:arr(r.shotlist),extra:arr(r.persediaan)}}),true);
    ui.busy=false;toast('Nota siap. Masuk To Shoot');go('to-shoot')}
  catch(e){ui.busy=false;render(true);toast(e&&e.code==='declined'?'Dibatalkan. Idea disimpan':e&&e.code==='timeout'?'Mac mini lambat jawab. Tekan Generate lagi nanti (tiada token tambahan)':e&&e.code==='unavailable'?'Tiada internet. Idea disimpan':e&&e.code==='not_granted'?'Generate tak dibenarkan. Idea disimpan':e&&e.code==='rate_limited'?'Tunggu sekejap, cuba lagi':'Generate gagal. Idea disimpan, cuba lagi')}}

