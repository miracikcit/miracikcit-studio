/* ---------- INSIGHT (28 Nov 2026, Mira lulus lakaran https://claude.ai/artifact/Fuj5NVBsm6BLDYswAkgEPM) ----------
   Data sosmed 11 akaun dalam doc insight/latest (Claude tulis dengan studio.py, sebulan sekali). Tab dalam menu bawah, kad di bawah sekali Home.
   Kad Insight = item stage 'ideas' (kind creative) dengan medan ins {rank, prio p1|p2|p3, why, plat[], fmt[], formula, demand} dan media 'video' | 'gambar'.
   Aliran sama untuk video dan gambar: Idea → Nak shoot (tab Shoot) → video: Edit / Editor, gambar: Photo Editor → To Publish › Jadual (Reels atas, Photo posts bawah) → Published.
   Kad gambar selesai (stage 'photo') bila Photo Editor hantar set ke To Publish (threads.js peSend, t.itemId). */
const INS_PL={th:'Threads',tt:'TikTok',ig:'IG',fb:'FB',yt:'YouTube'};
const INS_PC={th:'#6250d6',tt:'#2a78d6',ig:'#eb6834',fb:'#d4588a',yt:'#e34948',ttj:'#1baf7a',igj:'#c98a00',off:'#a8a09a'};
const insDoc=()=>S.insight.find(x=>x.id==='latest');
const INS_GUIDE='https://claude.ai/artifact/25TyvUjYqHxxRqv1JTiUfL';
const insAge=d=>d&&d.date?Math.floor((Date.now()-new Date(d.date+'T00:00:00'))/DAY):0;   /* hari sejak data terakhir; >=28 = masa kemaskini */
const insItems=()=>S.items.filter(x=>x.ins);
const insPl=p=>`<span class="pill" style="--pc:${INS_PC[p]||'#999'}">${esc(INS_PL[p]||p)}</span>`;
const insPrio=I=>I&&I.rank?`<span class="insp ${esc(I.prio||'p2')}">${I.prio==='p3'?'Uji':I.prio==='p1'?'Shoot dulu':'Seterusnya'} · ${I.rank}</span>`:'';
const insMedia=it=>it.media==='gambar'?`<span class="pill" style="--pc:#7A5C6E">Gambar</span>`:`<span class="pill" style="--pc:#CF8A55">Video</span>`;
function insProg(){const c={belum:0,nak:0,jalan:0,siap:0,N:0};insItems().forEach(it=>{c.N++;const s=it.stage;if(s==='ideas')c.belum++;else if(s==='toshoot')c.nak++;else if(s==='photo'||s==='published')c.siap++;else c.jalan++});return c}
function insBar(c){const w=n=>c.N?(n/c.N*100).toFixed(1)+'%':'0';
  return `<div class="insbar"><i style="width:${w(c.siap)};background:#3E8E5A"></i><i style="width:${w(c.jalan)};background:#8676BE"></i><i style="width:${w(c.nak)};background:var(--warn)"></i></div>
  <div class="inslg"><span><i style="background:#3E8E5A"></i>Siap ${c.siap}</span><span><i style="background:#8676BE"></i>Edit / post ${c.jalan}</span><span><i style="background:var(--warn)"></i>Nak shoot ${c.nak}</span><span><i></i>Idea ${c.belum}</span></div>`}
function insPlanBox(){const c=insProg();if(!c.N)return '';const f=ui.creF||'all';const nv=insItems().filter(i=>i.media!=='gambar').length;
  const chip=(k,l)=>`<button type="button" class="${f===k?'on':''}" data-act="creF" data-id="${k}">${l}</button>`;
  return `<div class="card glass insplan" style="--c:${TAB.insight.c}"><div class="rowh"><b>Pelan Insight</b><span class="meta">${c.siap} / ${c.N} siap</span></div>${insBar(c)}
   <div class="seg insf">${chip('all','Semua')}${chip('video','Video · '+nv)}${chip('gambar','Gambar · '+(c.N-nv))}</div></div>`}
A.creF=el=>{ui.creF=el.dataset.id;render(true)};
const creFOk=it=>{const f=ui.creF||'all';return f==='all'||(f==='gambar'?it.media==='gambar':it.media!=='gambar')};
const insWhy=it=>it.ins&&it.ins.why?`<div class="inswhy"><b>Kenapa:</b> ${esc(it.ins.why)}</div>`:'';
const insFacts=it=>{const I=it.ins||{};return (I.plat||[]).length||(I.fmt||[]).length?`<div class="insfx">${(I.plat||[]).map(insPl).join('')}${(I.fmt||[]).map(x=>`<span class="insch">${esc(x)}</span>`).join('')}</div>`:''};

/* Photo Editor dibuka dengan isi kad (tajuk + sebab jadi point, platform ikut kad). */
A.insPhoto=async el=>{const it=get('items',el.dataset.id);if(!it)return;if(typeof peSave==='function')await peSave();const t=peClear();const I=it.ins||{};
  const pl=(I.plat||[]).filter(p=>PE_PLAT[p]);Object.assign(t,{itemId:it.id,points:[it.title,I.why||it.details||''].filter(Boolean).join('\n'),plats:pl.length?pl:['th'],rp:pl[0]||'th',step:1,seg:'buat'});go('threads')};
A.insGoCre=()=>{ui.shootTab='creative';try{localStorage.setItem('ms:shootTab','creative')}catch(e){}go('to-shoot')};

V.insight=()=>{const d=insDoc();
  if(!d)return head('Data sosmed')+`<div class="empty">Belum ada data. Minta Claude "kemaskini Insight".</div>`;
  const sg=ui.insSeg||'akaun';const c=insProg();
  const seg=`<div class="seg insseg">${[['akaun','Akaun'],['formula','Formula'],['minta','Permintaan'],['best','Best post']].map(([k,l])=>`<button type="button" class="${sg===k?'on':''}" data-act="insSeg" data-id="${k}">${l}</button>`).join('')}</div>`;
  const plan=c.N?`<button type="button" class="card glass insplan insgo" data-act="insGoCre"><div class="rowh"><b>Pelan Insight</b><span class="meta">${c.siap} / ${c.N} siap · buka Creative</span></div>${insBar(c)}</button>`:'';
  return head('Data '+dmy(d.date)+' · '+(d.period||'90 hari'),`<button class="btn sm" data-act="insUpd">Kemaskini</button>`)+plan+seg+
    (sg==='formula'?insFormula(d):sg==='minta'?insDemand(d):sg==='best'?insBest(d):insAcc(d))+
    (d.report?`<p class="meta" style="margin-top:16px">Report penuh dengan carta: <a href="${esc(d.report)}" target="_blank" rel="noopener">buka report</a></p>`:'')};
A.insSeg=el=>{ui.insSeg=el.dataset.id;render(true)};

function insAcc(d){const tile=a=>{const pc=INS_PC[a.pc||a.plat]||'#999';const tr=a.trend==='up'?'up':a.trend==='down'?'down':'';
    const sp=(a.spark||[]).length?`<span class="inssp">${a.spark.map((v,i,L)=>`<i style="height:${Math.max(8,Math.round(v/Math.max(...L)*100))}%"></i>`).join('')}</span>`:'';
    const tag=a.u?'a':'div';return `<${tag} class="insat glass" style="--pc:${pc}"${a.u?` href="${esc(a.u)}" target="_blank" rel="noopener"`:''}><span class="p">${esc(a.name)}</span><b>${esc(a.big)}</b><span class="tr ${tr}">${esc(a.sub||'')}</span>${sp}</${tag}>`};
  const grp=(g,l,col)=>{const L=(d.accounts||[]).filter(a=>a.g===g);return L.length?`<p class="eyebrow" style="--c:${col};margin-top:14px">${l}</p><div class="insacc">${L.map(tile).join('')}</div>`:''};
  return grp('mira','@miracikcit',ACC_COL.miracikcit)+grp('juga','@miracikcitjuga',ACC_COL.miracikcitjuga)}

function insFormula(d){const n=k=>insItems().filter(it=>it.ins.formula===k).length;
  return `<div class="list">${(d.formulas||[]).map(f=>`<div class="insfm ${f.good?'good':'bad'}"><div class="rowh"><b>${esc(f.title)}</b>${f.good?(f.plats||[]).map(insPl).join(''):`<span class="pill" style="--pc:var(--bad)">Kurangkan</span>`}</div>
    <div class="insfb"><i style="width:${Math.max(4,Math.min(100,f.w||50))}%"></i></div><div class="insfn"><span>${esc(f.stat||'')}</span>${f.good?(n(f.k)?`<button type="button" class="lnk" data-act="insGoCre">${n(f.k)} kad Creative</button>`:''):`<span>${esc(f.act||'')}</span>`}</div></div>`).join('')}</div>`}

function insDemand(d){const L=d.demand||[];const mx=Math.max(1,...L.map(x=>(x.tt||0)+(x.ig||0)+(x.th||0)));
  return `<div class="inslg" style="margin:0 0 10px"><span><i style="background:${INS_PC.tt}"></i>TikTok</span><span><i style="background:${INS_PC.ig}"></i>Instagram</span><span><i style="background:${INS_PC.th}"></i>Threads</span></div><div class="list">${L.map(x=>{
    const has=insItems().some(it=>it.ins.demand===x.k);const tot=(x.tt||0)+(x.ig||0)+(x.th||0);const w=v=>(v/mx*100).toFixed(1)+'%';
    return `<div class="insdm glass"><div class="rowh"><b>${esc(x.title)}</b>${has?`<button type="button" class="btn sm insok" data-act="insGoCre">✓ Dalam Creative</button>`:`<button type="button" class="btn sm solid tab" data-act="insMake" data-id="${esc(x.k)}">+ Jadi kad</button>`}</div>
      <div class="insdb"><i style="width:${w(x.tt||0)};background:${INS_PC.tt}"></i><i style="width:${w(x.ig||0)};background:${INS_PC.ig}"></i><i style="width:${w(x.th||0)};background:${INS_PC.th}"></i></div>
      <div class="meta">${x.quote?`“${esc(x.quote)}” · `:''}${tot?tot+' komen':esc(x.note||'')}</div></div>`}).join('')}</div>`}
A.insMake=el=>{const d=insDoc();const x=((d&&d.demand)||[]).find(y=>y.k===el.dataset.id);if(!x)return;
  save('items',{id:'ins-'+uid(),stage:'ideas',kind:'creative',media:x.media||'video',title:x.idea||('Jawab soalan: '+x.title),account:'miracikcit',details:x.quote||'',
    ins:{rank:0,prio:'p2',why:(x.quote?'“'+x.quote+'”. ':'')+((x.tt||0)+(x.ig||0)+(x.th||0))+' komen tanya.',plat:x.plat||['tt','ig'],fmt:['Reply komen'],demand:x.k},created:Date.now(),stageAt:{ideas:Date.now()}});
  toast('Kad masuk Shoot › Creative › Idea')};

function insBest(d){const B=d.best||{};const ks=Object.keys(B);if(!ks.length)return '<div class="empty">Tiada senarai best post.</div>';
  const k=ks.includes(ui.insBest)?ui.insBest:ks[0];const ac=(d.bestLabels||{})[k]||k;
  return `<div class="insbk">${ks.map(x=>`<button type="button" class="pill" style="--pc:${k===x?INS_PC[x.replace(/[^a-z]/g,'')]||'#888':'#d8d2cc'}" data-act="insBk" data-id="${esc(x)}">${esc((d.bestLabels||{})[x]||x)}</button>`).join('')}</div>
   <p class="eyebrow" style="margin-top:12px">${esc(ac)}</p><div class="list">${(B[k]||[]).map((p,i)=>{const tag=p.u?'a':'div';return `<${tag} class="insbp glass"${p.u?` href="${esc(p.u)}" target="_blank" rel="noopener"`:''}><span class="n">${i+1}</span><span class="t"><b>${esc(p.t)}</b>${p.s?`<small>${esc(p.s)}</small>`:''}</span><span class="v">${esc(p.v)}</span></${tag}>`}).join('')}</div>`}
A.insBk=el=>{ui.insBest=el.dataset.id;render(true)};

/* Kemaskini data: perlu dua profil Chrome Mira, jadi Claude yang buat. Modal ni beri arahan dan cara jimat token. */
A.insUpd=()=>{const msg='Kemaskini Insight. Fail export dah ada dalam INSIGHT INBOX.';
  modal(`<h2>Kemaskini data</h2><p class="meta">Sebulan sekali (peringatan 28hb dalam Calendar). Buat di Mac mini.</p>
   <ol class="insol"><li>Download fail export TikTok, Facebook dan IG juga ke folder <b>WORK 2026 › INSIGHT INBOX</b>. <a href="${INS_GUIDE}" target="_blank" rel="noopener">Buka panduan</a></li><li>Pastikan dua-dua Chrome terbuka, kemudian hantar mesej ni kepada Claude:</li></ol>
   <div class="inscopy"><span id="insMsg">${esc(msg)}</span><button class="btn sm" data-act="insCopy">Copy</button></div>
   <p class="meta" style="margin-top:12px">Claude guna skrip tetap dan cuma baca soalan dari post baru, jadi jauh lebih jimat token.</p>
   <div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Tutup</button></div>`,TAB.insight.c)};
A.insCopy=async()=>{const t=($('#insMsg')||{}).textContent||'';try{await navigator.clipboard.writeText(t);toast('Dicopy')}catch(e){const r=document.createRange();r.selectNodeContents($('#insMsg'));const s=getSelection();s.removeAllRanges();s.addRange(r);toast('Tekan Copy pada menu')}};

/* Kad di bawah sekali Home (Mira, 28 Nov). */
function insHome(){const d=insDoc();const c=insProg();if(!d&&!c.N)return '';
  const L=insItems().filter(it=>it.stage==='ideas'||it.stage==='toshoot').sort((a,b)=>(a.stage==='toshoot'?0:1)-(b.stage==='toshoot'?0:1)||(a.ins.rank||99)-(b.ins.rank||99)).slice(0,3);
  const row=it=>hpRow(it.ins.rank?String(it.ins.rank):'·',it.title,[it.media==='gambar'?'Gambar':'Video',it.stage==='toshoot'?'Nak shoot':'Idea'].join(' · '),hpPill(it.ins.prio==='p1'?'Shoot dulu':it.ins.prio==='p3'?'Uji':'Seterusnya',it.ins.prio==='p1'?'var(--bad)':it.ins.prio==='p3'?'#999':'var(--warn)'),{'data-act':'insGoCre'});
  const top=d&&d.headline?`<div class="inshl">${d.headline.map(h=>`<span><b>${esc(h.v)}</b><small>${esc(h.l)}</small></span>`).join('')}</div>`:'';
  const age=insAge(d),due=age>=28?`<button type="button" class="hprow hpx insdue" data-act="insUpd"><span class="tm">!</span><span class="nm"><b>Masa kemaskini data</b><i>Data dah ${age} hari. Download export, kemudian beritahu Claude.</i></span>${hpPill('Kemaskini','var(--bad)')}</button>`:'';
  return hpCard('insight',c.N-c.siap,'Insight',(d?'data '+dmy(d.date)+' · ':'')+c.siap+' / '+c.N+' siap',due+top+(c.N?insBar(c):'')+L.map(row).join(''),'Buka Insight')}
