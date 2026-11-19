/* ---------- CAPTION: untuk video lama yang masih dalam draf media sosial ----------
   Tampal link produk > app cari produk dalam Sheet PRODUCTS dan nota Studio > Claude di Mac mini tulis 3 pilihan.
   Format ikut Sheet (2026-11-19): hook + emoji, ayat kedua, kemudian satu baris hashtag. Tiada 2 hashtag topik. */
const CAP_SHOPEE='#shopeemy #shopeeaffiliatesmy #shopeelagimurah @shopee_my @shopeeaffiliates_my';
const CAP_ANG=['Auto','Target','Shock','Open loop','Proof'];
const CAP_TT_BAN=['shopee','lazada','link di bio','link kat bio','paling murah','murah gila','diskaun','discount','rm'];
const normLink=u=>String(u||'').trim().replace(/[?#].*$/,'').replace(/\/+$/,'').toLowerCase();
function capFind(link,typed){const L=normLink(link);const sv=sheetView();const gs=sv?sv.groups.filter(x=>x.tab==='PRODUCTS'):[];let g=null,it=null;
  if(/^https?:\/\//.test(L)){g=gs.find(x=>(x.shopee&&normLink(x.shopee)===L)||(x.tt&&normLink(x.tt)===L))||null;it=S.items.find(i=>i.shopee&&normLink(i.shopee)===L)||null}
  else if(String(typed||'').trim().length>=4){const tw=words(typed).filter(w=>w.length>=3);let best=0;
    gs.forEach(x=>{const gw=words(x.name);const sc=tw.filter(w=>gw.includes(w)).reduce((n,w)=>n+w.length,0)+(pMatch(x.name,typed)?50:0);if(sc>best){best=sc;g=x}});if(best<4)g=null}
  const name=g?g.name:it?[it.brand,it.title].filter(Boolean).join(' '):'';if(!name)return null;
  const prod=(it&&it.productId&&get('products',it.productId))||S.products.find(p=>itMatch({title:p.name,brand:p.brand},name))||null;
  return {name,g,prod,caps:g?g.rows.map(r=>String(r.caption||'').split(/\n\s*\n/)[0]).filter(Boolean):[]}}
function capNotes(p){if(!p)return {usp:'',ban:[]};const ban=[];let usp=[];
  (p.sections||[]).forEach(s=>{const items=(s.items||[]).map(String);if(/jangan/i.test(s.title||''))items.forEach(x=>ban.push(x));else usp=usp.concat(items)});
  return {usp:usp.join('\n').slice(0,1400),ban}}
const capBuild=(c,tags,plat)=>[c.hook,c.line2].filter(Boolean).join('\n')+'\n\n'+(tags||[]).join(' ')+(plat==='sh'?' '+CAP_SHOPEE:'');
function capWarn(txt,plat,ban){const low=txt.toLowerCase();const w=[];
  if(plat==='tt')CAP_TT_BAN.forEach(b=>{if(new RegExp('(^|[^a-z])'+b.replace(/ /g,'\\s+')+'([^a-z]|$)').test(low))w.push(b)});
  ban.forEach(b=>{const s=String(b).toLowerCase();const q=[...s.matchAll(/["“]([^"”]{3,60})["”]/g)].map(m=>m[1].trim());
    const keys=q.length?q:[s.replace(/^jangan\s+(sebut|kata|guna)\s*/,'').split(/[,(:\-–]/)[0].trim()];
    keys.forEach(k=>{if(k.length>=4&&low.includes(k)&&!w.includes(k))w.push(k)})});
  return w}
V.caption=()=>{const c=ui.cap||(ui.cap={link:'',name:'',what:'',angle:'Auto',res:null,pick:0,busy:false});const f=capFind(c.link,c.name);
  const nm=f?f.name:c.name.trim();const byLink=!!c.link.trim();const notes=capNotes(f&&f.prod);const r=c.res;const pick=r?r.captions[c.pick]||r.captions[0]:null;
  const box=(plat,label)=>{if(!pick)return '';const key=c.pick+'|'+plat;const txt=(c.edit&&c.edit[key])??capBuild(pick,r.tags,plat);const w=capWarn(txt,plat,notes.ban);
    return `<div class="card glass" style="margin-top:12px"><div class="rowh" style="align-items:center"><span class="pill" style="--pc:${plat==='sh'?'var(--shopee)':'var(--tt)'}">${label}</span><span class="meta">${txt.length} aksara</span></div>
      <textarea class="inp" id="cap-${plat}" data-capedit="${key}" rows="${Math.max(6,Math.ceil(txt.length/34)+3)}" style="margin-top:10px;font-size:14px;line-height:1.45">${esc(txt)}</textarea>
      <div class="rowh" style="align-items:center;margin-top:8px">${w.length?`<span class="meta" style="color:var(--bad)">Semak perkataan: ${esc(w.join(', '))}</span>`:`<span class="meta" style="color:var(--ok)">${plat==='tt'?'Lulus semakan TikTok Shop':'Tiada perkataan JANGAN SEBUT'}</span>`}<div class="btns" style="gap:6px">${plat==='sh'?`<button class="btn sm" data-act="capSave"${c.saving?' disabled':''}>${c.saved&&c.saved[c.pick]?IC.check+'Dalam Sheet':IC.up+'Simpan ke Sheet'}</button>`:''}<button class="btn sm solid tab" data-act="capCopy" data-x="${plat}">${IC.copy}Copy</button></div></div></div>`};
  return head('Untuk video lama yang masih dalam draf')+
  `<div class="card big glass"><label class="f"><span>Link produk (pilihan)</span><span class="inwrap"><input class="inp" id="capLink" data-capf="link" value="${esc(c.link)}" placeholder="https://s.shopee.com.my/..." inputmode="url" autocomplete="off" autocapitalize="off"><button type="button" class="btn icon sm" data-act="capPaste" aria-label="Tampal">${IC.copy}</button></span></label>
    ${byLink&&f?'':capNameField(byLink?'Nama produk':'Atau nama produk')}
    ${(byLink||c.name.trim())?(f?`<div class="evrow" style="cursor:default;margin:2px 0 10px"><span style="flex:1;min-width:0"><strong>${esc(f.name)}</strong><span class="meta" style="display:block">Jumpa dalam ${f.g?'Sheet PRODUCTS':'nota Studio'}${f.prod?' · nota produk ada':''}${f.caps.length?' · '+f.caps.length+' caption lama akan dielak':''}</span></span><span class="pill" style="--pc:var(--ok)">Padan</span></div>`
      :`<p class="meta" style="margin:0 0 10px">${byLink&&!c.name.trim()?'Link ni tiada dalam Sheet. Isi nama produk di atas.':'Produk baru, tiada dalam Sheet. Bila simpan, ia masuk sebagai produk baru.'}</p>`):''}
    <label class="f"><span>Apa yang ada dalam video (pilihan)</span><input class="inp" id="capWhat" data-capf="what" value="${esc(c.what)}" placeholder="cth. unboxing, test bau, pasang kat aircond"></label>
    <span class="num" style="display:block;margin:4px 0 6px">Sudut hook</span>
    <div class="btns" style="gap:6px">${CAP_ANG.map(a=>`<button class="btn sm ${c.angle===a?'solid tab':''}" data-act="capAng" data-x="${a}" aria-pressed="${c.angle===a}">${a}</button>`).join('')}</div>
    <div class="btns" style="margin-top:14px"><button class="btn ${nm?'solid tab':''}" data-act="capGen"${c.busy?' disabled':''}>${c.busy?'Sedang generate...':nm?IC.ideas+'Generate 3 pilihan':'Taip nama produk dulu'}</button></div>
    ${c.busy?capLoader():`<p class="meta" style="margin:10px 0 0">Guna usage Claude kau di Mac mini, macam butang Ideas. Biasanya siap dalam 20 hingga 40 saat.</p>`}</div>
  ${capTagsBox()}
  ${r?`<div class="rowh" style="align-items:center;margin-top:20px"><p class="eyebrow" style="margin:0">Pilihan ${c.pick+1} · ${esc(pick.angle||'')}</p><div class="btns" style="gap:6px">${r.captions.map((x,i)=>`<button class="btn sm ${i===c.pick?'solid tab':''}" data-act="capPick" data-x="${i}" aria-label="Pilihan ${i+1}">${i+1}</button>`).join('')}</div></div>${box('sh','Shopee Video')}${box('tt','TikTok')}`:''}`};
/* Isi nama tanpa taip: tampal teks share Shopee/TikTok (nama + link), pilih dari senarai, atau sebut guna mic. */
function shareParse(t){t=String(t||'');const m=t.match(/https?:\/\/[^\s"'<>]+/);const link=m?m[0].replace(/[)\].,!?]+$/,''):'';
  let name=(m?t.replace(m[0],' '):t).replace(/\s+/g,' ').trim()
    .replace(/^(check out( this product)?:?|lihat|jom tengok|tengok|lihat produk ni:?)\s+/i,'')
    .replace(/\s+(for|untuk|dengan harga)\s+RM\s?[\d.,]+.*$/i,'')
    .replace(/[.!]?\s*(get it on shopee now|dapatkan(nya)? di shopee sekarang|beli di shopee sekarang|buy (it )?now|shop now).*$/i,'')
    .replace(/[!.,:\s]+$/,'').trim();
  return {link,name:name.length>=3?name.slice(0,120):''}}
function capNameField(label){const c=ui.cap;return `<label class="f"><span>${label}</span><span class="inwrap"><input class="inp" id="capName" data-capf="name" value="${esc(c.name)}" placeholder="Tampal, pilih atau sebut" autocomplete="off"><button type="button" class="btn icon sm ${c.mic?'solid rose':''}" data-act="capMic" aria-label="Sebut nama produk">${IC.mic}</button></span></label>
  <div class="btns" style="gap:6px;margin:-4px 0 10px"><button class="btn sm" data-act="capList">${IC.links}Pilih dari senarai</button></div>`}
function capProducts(){const out=new Map();const add=(n,src)=>{n=String(n||'').trim();const k=nrm(n);if(k.length>=3&&!out.has(k))out.set(k,{n,src})};
  S.items.filter(i=>i.stage&&i.stage!=='ideas'&&(i.brand||i.productId)).sort((a,b)=>(b.updated||0)-(a.updated||0)).forEach(i=>add([i.brand,i.title].filter(Boolean).join(' '),'Studio'));
  S.products.forEach(p=>add([p.brand,p.name].filter(Boolean).join(' '),'Nota'));
  const sv=sheetView();if(sv)sv.groups.filter(g=>g.tab==='PRODUCTS').sort((a,b)=>(+b.no||0)-(+a.no||0)).forEach(g=>add(g.name.toLowerCase().replace(/\b\w/g,x=>x.toUpperCase()),'Sheet No. '+g.no));
  return [...out.values()]}
A.capList=()=>{const ps=capProducts();modal(`<h2>Pilih produk</h2><input class="inp" id="capQ" placeholder="Cari" autocomplete="off" style="margin-bottom:10px"><div class="list" id="capPL" style="max-height:55vh;overflow:auto">${ps.map(p=>`<button class="btn" style="justify-content:space-between;text-align:left" data-act="capPickName" data-x="${esc(p.n)}" data-k="${esc(nrm(p.n))}"><span>${esc(p.n)}</span><span class="meta" style="color:inherit;flex:none">${esc(p.src)}</span></button>`).join('')}</div>`,TAB.caption.c);
  const q=$('#capQ');if(q)q.addEventListener('input',()=>{const v=nrm(q.value);document.querySelectorAll('#capPL [data-k]').forEach(b=>b.hidden=!!v&&!b.dataset.k.includes(v))})};
A.capPickName=el=>{ui.cap.name=el.dataset.x;closeModal();render(true)};
A.capMic=()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){toast('Mic tak disokong dalam browser ni');return}
  if(ui.cap.rec){try{ui.cap.rec.stop()}catch(e){}return}
  const r=new SR();r.lang='ms-MY';r.interimResults=false;r.continuous=false;ui.cap.rec=r;ui.cap.mic=true;render(true);
  r.onresult=e=>{const t=e.results[0][0].transcript.trim();if(t){ui.cap.name=t}};
  r.onerror=e=>toast(e.error==='not-allowed'?'Benarkan mic dalam Settings':'Tak dengar. Cuba lagi');
  r.onend=()=>{ui.cap.rec=null;ui.cap.mic=false;render(true)};try{r.start()}catch(e){ui.cap.rec=null;ui.cap.mic=false;render(true)}};
document.addEventListener('paste',e=>{const el=e.target;if(!el||el.id!=='capLink'&&el.id!=='capName')return;const t=(e.clipboardData||{}).getData?e.clipboardData.getData('text'):'';const p=shareParse(t);
  if(p.link&&p.name){e.preventDefault();ui.cap.link=p.link;ui.cap.name=p.name;render(true);toast('Link dan nama produk diisi')}});
/* Simpan ke Sheet PRODUCTS: produk dah ada = VID baru di bawahnya; produk baru = baris baru ikut format Sheet. */
A.capSave=()=>{const c=ui.cap;const f=capFind(c.link,c.name);const txt=($('#cap-sh')||{}).value||'';if(!txt.trim())return;
  const name=f?f.name:c.name.trim();
  modal(`<h2>Simpan ke Sheet</h2><p class="meta">${f&&f.g?`Caption ni masuk sebagai VID baru di bawah <b>${esc(f.g.name)}</b> (No. ${esc(f.g.no)}), dan TOTAL VID naik satu.`:`<b>${esc(name.toUpperCase())}</b> masuk sebagai produk baru di hujung tab PRODUCTS${c.link.trim()?', dengan link Shopee':''}.`}</p>
   <div class="btns" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="capSaveGo">${IC.up}Simpan</button></div>`,TAB.caption.c)};
A.capSaveGo=async()=>{const c=ui.cap;const f=capFind(c.link,c.name);const txt=(($('#cap-sh')||{}).value||'').trim();closeModal();
  const link=c.link.trim();const isTT=/tiktok/i.test(link);c.saving=true;render(true);
  try{const r=await window.studioProductAdd(f&&f.g?{start:f.g.start,caption:txt}:{name:(f?f.name:c.name).trim(),caption:txt,shopee:isTT?'':link,tt:isTT?link:''});
    c.saved=Object.assign({},c.saved,{[c.pick]:true});toast(`Disimpan: No. ${r.no}, VID ${r.vid} (baris ${r.row})`);if(MCP)MCP.invalidate(GS,'get_values').catch(()=>{})}
  catch(e){toast('Tak dapat simpan ke Sheet. Cuba lagi')}finally{c.saving=false;render(true)}};
/* Loader: tunjuk peringkat dan masa berlalu supaya Mira tahu Mac mini sedang buat kerja */
function capStage(sec){return sec<4?'Hantar ke Mac mini':sec<10?'Mac mini terima kerja':sec<45?'Claude sedang tulis 3 caption':'Masih menulis, Mac mini mungkin sibuk'}
function capLoader(){const sec=Math.round((Date.now()-(ui.cap.t0||Date.now()))/1000);const pct=Math.min(94,Math.round(sec/40*100));
  return `<div id="capProg" style="--sc:var(--c);margin-top:12px" aria-live="polite"><div class="trk"><div class="t"><span data-st>${capStage(sec)}</span><span data-sec>${sec} saat</span></div></div><div class="bar"><i data-bar style="width:${Math.max(4,pct)}%;transition:width .9s linear"></i></div></div>`}
setInterval(()=>{const el=document.getElementById('capProg');if(!el||!ui.cap||!ui.cap.busy)return;const sec=Math.round((Date.now()-ui.cap.t0)/1000);
  el.querySelector('[data-st]').textContent=capStage(sec);el.querySelector('[data-sec]').textContent=sec+' saat';el.querySelector('[data-bar]').style.width=Math.max(4,Math.min(94,Math.round(sec/40*100)))+'%'},1000);
/* Kotak hashtag Shopee untuk copy terus (juga di Home) */
const capTagsBox=()=>`<div class="card glass" style="margin-top:12px"><div class="rowh" style="align-items:center"><div style="min-width:0"><span class="num">Hashtag Shopee</span><div class="meta" style="margin-top:4px;overflow-wrap:anywhere">${esc(CAP_SHOPEE)}</div></div><button class="btn sm solid tab" data-act="capTags" style="flex:none">${IC.copy}Copy</button></div></div>`;
A.capTags=()=>copyText(CAP_SHOPEE,'Hashtag Shopee dicopy');
document.addEventListener('input',e=>{const el=e.target;if(!el.dataset)return;
  if(el.dataset.capf){ui.cap[el.dataset.capf]=el.value;if(el.dataset.capf==='link'||el.dataset.capf==='name'){const id=el.id;clearTimeout(el._t);el._t=setTimeout(()=>{render(true);const n=$('#'+id);if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}},600)}}
  else if(el.dataset.capedit){ui.cap.edit=Object.assign({},ui.cap.edit,{[el.dataset.capedit]:el.value})}});
A.capPaste=async()=>{try{const t=await navigator.clipboard.readText();const p=shareParse(t);if(!p.link&&!p.name){toast('Clipboard kosong');return}
  if(p.link)ui.cap.link=p.link;if(p.name)ui.cap.name=p.name;render(true);toast(p.link&&p.name?'Link dan nama produk diisi':p.link?'Link diisi':'Nama diisi')}catch(e){toast('Tekan lama dalam kotak, kemudian Paste')}};
A.capAng=el=>{ui.cap.angle=el.dataset.x;render(true)};
A.capPick=el=>{ui.cap.pick=+el.dataset.x;render(true)};
A.capCopy=el=>{const t=($('#cap-'+el.dataset.x)||{}).value||'';copyText(t,el.dataset.x==='sh'?'Caption Shopee dicopy':'Caption TikTok dicopy')};
A.capGen=async()=>{const c=ui.cap;const f=capFind(c.link,c.name);const name=(f?f.name:c.name).trim();if(!name){toast('Taip nama produk dulu');const n=$('#capName');if(n)n.focus();return}
  if(!SAMPLE){toast('Generate tak tersedia sekarang');return}
  const n=capNotes(f&&f.prod);
  const prompt=`Tulis 3 caption media sosial untuk video produk Mira (@miracikcit), content creator Malaysia. Video ni video lama yang masih dalam draf, belum di-post.
Produk: ${name}
${n.usp?'Nota produk (USP):\n'+n.usp+'\n':''}${c.what.trim()?'Apa dalam video: '+c.what.trim()+'\n':''}Sudut hook: ${c.angle==='Auto'?'pilih 3 sudut STOP berbeza (Shock, Target, Open loop, Proof)':c.angle+' (formula STOP), 3 variasi berbeza'}
${f&&f.caps.length?'Hook caption lain produk ni yang dah ada, JANGAN ulang ayat atau idea yang sama:\n- '+f.caps.slice(0,12).join('\n- ')+'\n':''}${n.ban.length?'JANGAN SEBUT: '+n.ban.join('; ')+'\n':''}
Format setiap caption:
- hook: satu ayat Bahasa Melayu santai macam cakap dengan kawan, satu emoji di hujung
- line2: satu ayat yang sebut nama produk penuh (huruf besar kecil biasa, bukan semua huruf besar) dan satu USP
Peraturan: tiada harga atau diskaun, tiada dakwaan perubatan, tiada janji yang tak pasti, tiada sebut Shopee atau platform lain, guna "aku" atau "Mira".
tags: 2 hashtag CamelCase tanpa ruang: #NamaProduk #Kategori (cth #Kathwi #PewangiKereta).
Balas JSON sahaja: {"tags":["#..","#.."],"captions":[{"angle":"..","hook":"..","line2":".."},{"angle":"..","hook":"..","line2":".."},{"angle":"..","hook":"..","line2":".."}]}`;
  c.busy=true;c.t0=Date.now();render(true);
  try{const j=await SAMPLE.json(prompt,{cache:false});const caps=(j&&Array.isArray(j.captions)?j.captions:[]).filter(x=>x&&x.hook).slice(0,3).map(x=>({angle:String(x.angle||''),hook:String(x.hook).trim(),line2:String(x.line2||'').trim()}));
    if(!caps.length)throw new Error('kosong');const tags=(Array.isArray(j.tags)?j.tags:[]).map(t=>'#'+String(t).replace(/^#+/,'').replace(/\s+/g,'')).filter(t=>t.length>1).slice(0,2);
    c.res={captions:caps,tags};c.pick=0;c.edit={};c.saved={};toast('3 pilihan siap')}
  catch(e){if(!(e&&(e.code==='declined'||e.name==='AbortError')))toast(e&&e.code==='timeout'?'Mac mini lambat jawab. Cuba lagi sekejap':'Tak berjaya generate. Semak Mac mini hidup')}
  finally{c.busy=false;render(true)}};
