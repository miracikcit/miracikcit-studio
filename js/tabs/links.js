/* ---------- LINKS ---------- */
const bothText=(s,t)=>[s?'✅ Beli di Shopee: '+s:'',t?'✅ Beli di Tiktok: '+t:''].filter(Boolean).join('\n');
/* Products: timeline Nota > To Shoot > Storyboard > Editor > To Post > Published, ditanda sendiri dari data app, Editor dan Sheet. */
const PSTEPS=['Nota','To Shoot','Storyboard','Editor','To Post','Published'];
const pMatch=(a,b)=>{a=nrm(a);b=nrm(b);if(!a||!b)return false;const k=Math.min(12,a.length,b.length);return a.slice(0,k)===b.slice(0,k)};
const words=s=>String(s||'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const itMatch=(it,name)=>{if(pMatch(it.title,name)||pMatch((it.brand||'')+' '+it.title,name))return true;const gw=words(name);
  return words(it.title).some(w=>w.length>=7&&gw.includes(w))||(!!it.brand&&gw[0]===words(it.brand)[0]&&words(it.title).some(w=>w.length>=5&&gw.includes(w)))};
function prodDone(its,eds,g,sv){let d=-1;const st=its.map(i=>i.stage);
  if(its.length)d=0;
  if(st.some(s=>['shot','toedit','ready','published'].includes(s))||eds.length)d=1;
  if(eds.some(e=>e.status&&e.status!=='Storyboard'))d=2;
  const rows=g?g.rows:[];const files=g&&sv?(sv.gf.get(g)||[]):[];
  if(rows.length||files.length||eds.some(e=>/siap/i.test(e.status||''))||st.includes('ready'))d=3;
  if(rows.some(r=>isSettled(r)||r.posted.some(Boolean)))d=4;
  if((rows.length&&rows.every(r=>isSettled(r)||isPub(r)))||(!rows.length&&st.includes('published')))d=5;
  return d}
function timeline(d,info){return `<div class="tl" role="list" aria-label="Status produk">${PSTEPS.map((s,i)=>`<div role="listitem" class="s${i<=d?' d':i===d+1?' cur':''}"><i>${i<=d?IC.check:''}</i><span>${s}</span></div>`).join('')}</div>${info?`<div class="meta" style="margin-top:6px">${info}</div>`:''}`}
function products(sv){const gs=sv?sv.groups.filter(g=>g.tab==='PRODUCTS'):[];
  const live=S.items.filter(it=>it.stage&&it.stage!=='ideas'&&(it.productId||it.brand));const used=new Set();
  const out=gs.map(g=>{const its=live.filter(it=>itMatch(it,g.name));its.forEach(i=>used.add(i.id));const eds=S.editor.filter(e=>pMatch(e.name,g.name));return {g,name:g.name,its,eds}});
  const extra=new Map();live.filter(it=>!used.has(it.id)&&it.stage!=='published').forEach(it=>{const k=nrm(it.title).slice(0,12);if(!extra.has(k))extra.set(k,{g:null,name:it.title,its:[],eds:S.editor.filter(e=>pMatch(e.name,it.title))});extra.get(k).its.push(it)});
  return [...extra.values(),...out].map(p=>Object.assign(p,{d:prodDone(p.its,p.eds,p.g,sv)}))}
function prodInfo(p,sv){if(!p.g){const it=p.its[0];return esc([it.brand,it.stage==='toshoot'&&it.shootDate?'shoot '+fmtD(Date.parse(it.shootDate)):'',p.eds[0]?'Editor: '+p.eds[0].status:''].filter(Boolean).join(' · '))}
  const n=p.g.rows.length,pub=p.g.rows.filter(r=>isSettled(r)||isPub(r)).length;return n?`${n} video · ${pub} dah published`:''}
V.links=()=>{const sv=sheetView();
  if(!sv)return head('Sheet CONTENT 2026 · tab PRODUCTS')+sheetNote()+prodPipeline(products(null));
  const all=products(sv);const gs=sv.groups.filter(g=>g.tab==='PRODUCTS');const pm=new Map(all.filter(p=>p.g).map(p=>[p.g,p]));
  const list=gs.slice().sort((a,b)=>(+b.no||0)-(+a.no||0)).filter(g=>hit('lk',g.no,g.name));const miss=gs.filter(g=>!g.shopee).length;
  const extra=S.items.filter(it=>it.shopee&&!gs.some(g=>g.shopee===it.shopee));
  const bar=(id,lk,val,ph)=>`<span class="inwrap"><input class="inp" id="${id}" data-lk="${lk}" value="${esc(val)}" placeholder="${ph}" inputmode="url"><button type="button" class="btn icon sm" data-act="cpIn" data-id="${id}" aria-label="Copy">${IC.copy}</button></span>`;
  return head(gs.length+' produk dalam sheet · '+all.filter(p=>!p.g).length+' dalam proses')+searchBox('lk','Cari nombor atau nama produk')+prodPipeline(all.filter(p=>!p.g&&hit('lk',p.name)))+(miss?`<p class="meta" style="margin:14px 0 12px;color:var(--bad)">${miss} produk belum ada link Shopee.</p>`:'')+
  `<div class="list">${list.map(g=>`<div class="card glass"><div class="rowh"><span class="bigno">${esc(g.no)}</span><div style="flex:1;min-width:0"><h3>${esc(g.name)}</h3></div></div>${timeline(pm.get(g).d,prodInfo(pm.get(g),sv))}
    <label class="f" style="margin-top:12px"><span>Shopee</span>${bar('ls-'+g.start,g.start+'|s',g.shopee,'https://s.shopee.com.my/...')}</label>
    <label class="f"><span>TikTok</span>${bar('lt-'+g.start,g.start+'|t',g.tt,'https://vt.tiktok.com/...')}</label>
    <div class="btns" style="justify-content:flex-end"><button class="btn sm" data-act="lkBoth" data-id="${g.start}">Both</button><button class="btn sm solid tab" data-act="lkSave" data-id="${g.start}">Simpan ke sheet</button></div></div>`).join('')||`<div class="empty">Tiada padanan.</div>`}</div>
  ${extra.length?`<p class="eyebrow" style="margin-top:22px">Link dari nota, belum dalam sheet · ${extra.length}</p><div class="list">${extra.map(it=>`<div class="card glass"><div class="rowh"><div><h3>${esc(it.title)}</h3><div class="meta">${esc(it.shopee)}</div></div><button class="btn icon sm" data-act="copy" data-x="${esc(it.shopee)}" aria-label="Copy">${IC.copy}</button></div></div>`).join('')}</div>`:''}`};
const prodPipeline=list=>list.length?`<p class="eyebrow" style="margin-top:6px">Dalam proses, belum masuk sheet · ${list.length}</p><div class="list" style="margin-bottom:8px">${list.map(p=>`<div class="card glass"><h3>${esc(p.name)}</h3>${timeline(p.d,prodInfo(p))}<p class="meta" style="margin:8px 0 0">Link Shopee dan TikTok boleh diisi bila produk ni masuk sheet.</p></div>`).join('')}</div>`:'';
A.cpIn=el=>{const v=($('#'+el.dataset.id)||{}).value||'';if(!v.trim()){toast('Belum ada link');return}copyText(v.trim(),'Link dicopy')};
A.lkBoth=el=>{const s=($('#ls-'+el.dataset.id)||{}).value||'',t=($('#lt-'+el.dataset.id)||{}).value||'';const txt=bothText(s.trim(),t.trim());if(!txt){toast('Belum ada link');return}
  modal(`<h2>Shopee + TikTok</h2><textarea class="inp" id="bothTxt" rows="4" readonly>${esc(txt)}</textarea><div class="btns" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-act="closeModal">Tutup</button><button class="btn solid tab" data-act="bothCopy">${IC.copy}Copy</button></div>`)};
A.bothCopy=()=>{copyText($('#bothTxt').value,'Template dicopy');closeModal()};

