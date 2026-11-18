/* ---------- READY TO PUBLISH ---------- */
function capVariants(cap,link){const c=noEmoji(cap);const ps=c.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);const isTags=p=>p.split(/\s+/).every(w=>/^[#@]/.test(w));
  const body=ps.filter(p=>!isTags(p)),tags=ps.filter(isTags);
  const strip=p=>p.split(/\s+/).filter(w=>!/shopee/i.test(w)).join(' ');
  return {fb:[body.join('\n\n'),link||'',tags.join('\n\n')].filter(Boolean).join('\n\n'),ig:[body.join('\n\n'),tags.join('\n\n')].filter(Boolean).join('\n\n'),tt:[body.join('\n\n'),tags.map(strip).filter(Boolean).join('\n\n')].filter(Boolean).join('\n\n')}}
const ticks=(r,kind)=>`<div class="btns" style="gap:5px;flex-wrap:nowrap">${PLAT4.map((p,i)=>`<button class="btn sm ${r[kind][i]?'solid tab':''}" style="padding:4px 9px;min-height:28px" data-act="tick" data-x="${r.tab}|${r.row}|${kind}|${i}" aria-pressed="${r[kind][i]}">${p}</button>`).join('')}</div>`;
V.ready=()=>{const sv=sheetView();const items=appReady(sv);
  if(!sv)return head('Sheet CONTENT 2026')+sheetNote()+itemReady(items);
  const byG=new Map();sv.ready.forEach(r=>{if(!byG.has(r.group))byG.set(r.group,[]);byG.get(r.group).push(r)});
  const groups=[...byG.entries()].map(([g,rows])=>({g,rows:rows.map(r=>({r,d:deadline(rowStart(r,sv),7)}))})).sort((a,b)=>Math.min(...a.rows.map(x=>x.d?x.d.left:99))-Math.min(...b.rows.map(x=>x.d?x.d.left:99)));
  return head(sv.ready.length+' video belum settled')+sheetNote()+`<div class="list">${groups.map(({g,rows})=>{
    const sug=!g.shopee&&S.items.find(it=>it.shopee&&nrm(g.name).startsWith(nrm(it.title).slice(0,8)));
    return `<div class="card big glass"><div class="rowh"><div><h3 style="font-size:16px">${esc(g.name)}</h3><div class="meta">${g.tab==='PRODUCTS'?'No. '+esc(g.no)+' · ':''}${rows.length} video menunggu</div></div>
     ${g.shopee?`<button class="btn solid shopee" data-act="copy" data-x="${esc(g.shopee)}">${IC.links}Link Shopee</button>`:''}</div>
    ${g.tab==='PRODUCTS'&&!g.shopee?`<div class="btns" style="margin-top:12px;flex-wrap:nowrap"><input class="inp" id="rs-${g.start}" data-lk="${g.start}|s" value="${esc(sug?sug.shopee:'')}" placeholder="Paste link Shopee di sini" inputmode="url"><button class="btn solid shopee" data-act="lkSave" data-id="${g.start}">Simpan</button></div>`:''}
    ${rows.map(({r,d})=>{const rm=get('readymeta',rmKey(r))||{};const done=isPub(r);return `<div class="vid"><div class="rowh"><div><div style="font-weight:500">${r.vid?'VID '+esc(r.vid)+' · ':''}${esc(noEmoji(String(r.caption).split('\n')[0]))}</div>${done?`<span class="pill" style="margin-top:6px">Semua dah posted, tick Settled</span>`:''}</div>
       <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">${dlBtn(rowFile(r,sv),rm.downloaded,rmKey(r),'dl')}${chk(rm.settled,'settle',rmKey(r),'Settled')}</div></div>
      <div class="btns" style="margin-top:10px"><button class="btn sm solid fb" data-act="cap" data-x="${r.tab}|${r.row}|fb">${IC.copy}FB</button><button class="btn sm solid ig" data-act="cap" data-x="${r.tab}|${r.row}|ig">${IC.copy}IG</button><button class="btn sm solid tt" data-act="cap" data-x="${r.tab}|${r.row}|tt">${IC.copy}TikTok</button></div>
      ${trk(d,'Publish dalam 1 minggu')}
      <div class="rowh" style="margin-top:10px;align-items:center"><span class="num" style="min-width:60px">Jadual</span><div style="flex:none">${ticks(r,'sched')}</div></div>
      <div class="rowh" style="margin-top:6px;align-items:center"><span class="num" style="min-width:60px">Posted</span><div style="flex:none">${ticks(r,'posted')}</div></div>
      <div class="row2" style="margin-top:8px;grid-template-columns:1fr 1fr"><label class="f" style="margin:0"><span>Akaun TT</span>${accSel(`id="at-${r.tab}-${r.row}" data-sacc="${r.tab}|${r.row}|0"`,r.acc[0],'Akaun')}</label><label class="f" style="margin:0"><span>Akaun IG / FB</span>${accSel(`id="ai-${r.tab}-${r.row}" data-sacc="${r.tab}|${r.row}|1"`,r.acc[1],'Akaun')}</label></div></div>`}).join('')}</div>`}).join('')||(items.length?'':`<div class="empty">Semua video dah settled.</div>`)}</div>
  ${itemReady(items)}
  ${sv.unmatched.length?`<p class="eyebrow" style="margin-top:22px">Ada dalam folder, tiada dalam sheet · ${sv.unmatched.length}</p><div class="list">${sv.unmatched.map(f=>`<div class="card glass"><div class="rowh"><div><h3>${esc(f.name.replace(/\.(mp4|mov|m4v)$/i,'').replace(/_FINAL$/i,'').replace(/[_-]+/g,' '))}</h3><div class="meta">${esc(f.name)}</div></div><button class="btn sm" data-act="filePub" data-x="${esc(f.name)}">${IC.check}Published</button></div>${trk(deadline(f.mtime,7),'Publish dalam 1 minggu')}</div>`).join('')}</div>`:''}
  <p class="meta" style="margin-top:16px">Jadual dan Posted hanya tanda dalam sheet; listing kekal di sini sampai kau tick Settled. FB: caption, link dan hashtag Shopee. IG: tanpa link. TikTok: tanpa hashtag Shopee.</p>`};
const itemReady=items=>items.length?`<p class="eyebrow" style="margin-top:22px">Dari app, belum dalam sheet · ${items.length}</p><div class="list">${items.map(it=>`<div class="card glass"><div class="rowh"><div><h3>${esc(it.title)}</h3><div class="meta">${esc([it.account,it.note].filter(Boolean).join(' · '))}</div></div>${dlBtn(itemFile(it),it.downloaded,it.id,'dlItem')}</div>${trk(deadline((it.stageAt&&it.stageAt.ready)||it.created,7),'Publish dalam 1 minggu')}<div class="btns" style="margin-top:12px"><button class="btn sm solid tab" data-act="itemPub" data-id="${it.id}">${IC.check}Settled</button><button class="btn icon sm bad" data-act="delItem" data-id="${it.id}" aria-label="Padam">${IC.trash}</button></div></div>`).join('')}</div>`:'';
/* Download: video final dari 00. TO POST FINAL, disalin ke Drive oleh Mac mini. */
function rowFile(r,sv){const fs=sv.gf.get(r.group)||[];return fs.find(f=>r.vid&&new RegExp('_'+r.vid+'_').test(f.name))||(fs.length===1||r.group.rows.length===1?fs[0]:null)||null}
function itemFile(it){const files=((S.sync.topost||{}).files)||[];return files.find(f=>(it.files||[]).includes(f.name))||null}
const dlUrl=id=>'https://drive.usercontent.google.com/download?id='+encodeURIComponent(id)+'&export=download&confirm=t';
function dlBtn(f,done,id,act){
  if(!f)return done?`<span class="pill" style="--pc:var(--ok)">${IC.check}Downloaded</span>`:`<span class="pill" title="Tiada fail dalam folder 00. TO POST FINAL">Tiada fail</span>`;
  if(!f.drive)return `<span class="pill" style="--pc:var(--warn)">Sedang upload</span>`;
  return `<a class="btn sm ${done?'':'solid tab'}" href="${esc(dlUrl(f.drive))}" target="_blank" rel="noopener" data-act="dlGo" data-id="${esc(id)}" data-x="${act}" data-u="${esc(dlUrl(f.drive))}">${done?IC.check+'Downloaded':IC.dl+'Download'}</a>`}
A.dlGo=el=>{window.open(el.dataset.u,'_blank');const id=el.dataset.id;
  if(el.dataset.x==='dlItem'){const it=get('items',id);if(it&&!it.downloaded)save('items',Object.assign({},it,{downloaded:true,downloadedAt:Date.now()}))}
  else{const rm=get('readymeta',id)||{id};if(!rm.downloaded)save('readymeta',Object.assign({},rm,{downloaded:true,downloadedAt:Date.now()}))}};
A.tick=el=>{const [tab,row,kind,idx]=el.dataset.x.split('|');sheetTick(tab,+row,kind,+idx)};
A.cap=el=>{const [tab,row,v]=el.dataset.x.split('|');for(const g of parseSheet()||[])for(const r of g.rows)if(r.tab===tab&&r.row===+row){const nolink=v==='fb'&&g.tab==='PRODUCTS'&&!g.shopee;return copyText(capVariants(r.caption,g.shopee)[v],nolink?'Dicopy tanpa link, belum ada link Shopee':'Caption '+({fb:'FB',ig:'IG',tt:'TikTok'}[v])+' dicopy')}};
A.lkSave=el=>saveLinks(+el.dataset.id);
A.dl=el=>{const id=el.dataset.id;const rm=get('readymeta',id)||{id};save('readymeta',Object.assign({},rm,{downloaded:!rm.downloaded}))};
A.settle=el=>{const id=el.dataset.id;const rm=get('readymeta',id)||{id};save('readymeta',Object.assign({},rm,{settled:!rm.settled,settledAt:Date.now()}));toast('Settled. Dipindah ke Published')};
A.dlItem=el=>{const it=get('items',el.dataset.id);save('items',Object.assign({},it,{downloaded:!it.downloaded}))};
A.itemPub=el=>moveItem(get('items',el.dataset.id),'published');
A.filePub=el=>{const n=el.dataset.x;save('published',{name:n,title:n.replace(/\.(mp4|mov|m4v)$/i,'').replace(/_FINAL$/i,'').replace(/[_-]+/g,' '),date:ymd(new Date()),source:'file'});toast('Published')};
A.shConn=async()=>{try{const r=await MCP.callTool(GS,'get_values',{spreadsheetId:SHEET_ID,range:SH.PRODUCTS.range});sheetRaw.PRODUCTS=(r.payload||{}).values||[];sheetState='ok';sheetErr=null;render();MCP.invalidate(GS,'get_values').catch(()=>{})}catch(e){sheetErr=e.code;toast(sheetErrText(e.code))}};
async function sheetAcc(tab,row,i,val){const t=SH[tab],raw=sheetRaw[tab];if(!raw)return;const ci=t.acc+i;const col=String.fromCharCode(65+ci);const r=raw[row-1]=(raw[row-1]||[]).slice();const old=r[ci];r[ci]=val;
  try{await sheetWrite(`${t.q}!${col}${row}`,[[val]]);toast('Akaun disimpan dalam sheet')}catch(e){r[ci]=old;render();toast(e.code==='tool_error'?'Sheet tolak perubahan':sheetErrText(e.code))}}

