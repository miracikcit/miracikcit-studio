/* ---------- TRANSCRIBE ---------- */
const TR_RANGE='Transcribe!A1:P500',TR_COLS=['id','link','tarikh_tambah','status','platform','tajuk','tempoh','bahasa','transkrip','transkrip_timestamp','isi_penting','ralat','tarikh_siap'];
let trRaw=null;
const trRows=()=>(trRaw||[]).slice(1).map((r,i)=>{const o={row:i+2};TR_COLS.forEach((k,j)=>o[k]=String((r||[])[j]??''));return o}).filter(o=>o.id&&o.link).sort((a,b)=>b.tarikh_tambah.localeCompare(a.tarikh_tambah));
const macSeen=()=>{const t=Date.parse(((trRaw||[])[0]||[])[15]||'');return isNaN(t)?0:t};
const TR_ST={'Dalam giliran':'#B98A2E','Jana semula':'#B98A2E','Sedang transkrip':'#5A7FA8','Siap':'#8A6A52','Gagal':'#C2534F'};
const platOf=u=>{u=String(u).toLowerCase();return /tiktok/.test(u)?'TikTok':/instagram/.test(u)?'Instagram':/facebook|fb\.watch/.test(u)?'Facebook':/\/shorts\//.test(u)?'YouTube Shorts':/youtu/.test(u)?'YouTube':'Video'};
const durFmt=s=>{s=parseInt(s,10);return s?Math.floor(s/60)+':'+pad(s%60):''};
const agoFmt=t=>{const m=Math.round((Date.now()-t)/6e4);return m<1?'baru tadi':m<60?m+' minit lalu':m<1440?Math.round(m/60)+' jam lalu':Math.round(m/1440)+' hari lalu'};
const trStLabel=s=>s==='Jana semula'?'Jana semula':s||'Dalam giliran';
function trOnData(vals){trRaw=vals;
  const box=$('#modal [data-trmodal]');if(box&&!$('#scrim').hidden){const r=trRows().find(x=>x.id===box.dataset.trmodal);if(r&&r.status!==box.dataset.st)A.trOpen({dataset:{id:r.id}})}
  if(ui.view==='transcribe')render()}
V.transcribe=()=>{
  const seen=macSeen();const online=seen&&Date.now()-seen<5*6e4;const rows=trRows();
  return head('Transkrip video, percuma dalam Mac mini')+sheetNote()+
  `<div style="margin:-6px 0 14px"><span class="mbadge${online?' on':''}"><i></i>${online?'Mac mini online':'Mac mini offline'}${seen?' · '+agoFmt(seen):''}</span></div>
  <div class="card big glass"><label class="f"><span>Link video</span><input class="inp" id="trLink" data-trlink="1" value="${esc(ui.trLink||'')}" placeholder="Link TikTok, Instagram, Facebook atau YouTube" inputmode="url" autocomplete="off" autocapitalize="off"></label>
   <div class="btns"><button class="btn" data-act="trPaste">${IC.copy}Tampal</button><button class="btn solid tab" data-act="trAdd"${ui.trBusy?' disabled':''}>${ui.trBusy?'Sedang hantar':'Transcribe'}</button></div>
   ${online?'':`<p class="meta" style="margin:10px 0 0">Mac mini tak check Sheet dalam 5 minit terakhir. Video tetap masuk giliran dan diproses bila Mac mini hidup semula.</p>`}</div>
  <p class="eyebrow" style="margin-top:22px">Terkini · ${rows.length}</p>
  <div class="list">${rows.map(r=>{const st=r.status||'Dalam giliran';return `<div role="button" tabindex="0" class="card glass trrow" data-act="trOpen" data-id="${esc(r.id)}"><div class="rowh"><div><h3>${esc(noEmoji(r.tajuk)||'Video '+(r.platform||platOf(r.link)))}</h3>${r.tajuk?'':`<div class="meta" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.link)}</div>`}<div class="meta">${esc([r.platform||platOf(r.link),durFmt(r.tempoh),r.bahasa,fmtD(Date.parse(r.tarikh_tambah))].filter(Boolean).join(' · '))}</div>${st==='Gagal'&&r.ralat?`<div class="meta" style="color:var(--bad);margin-top:4px">${esc(r.ralat.slice(0,140))}</div>`:''}</div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex:none"><span class="pill" style="--pc:${TR_ST[st]||'#999'}">${esc(trStLabel(st))}</span><button type="button" class="btn icon sm bad" data-act="trDel" data-id="${esc(r.id)}" aria-label="Padam">${IC.trash}</button></div></div></div>`}).join('')||`<div class="empty">${trRaw?'Belum ada video. Tampal link dan tekan Transcribe.':'Sedang baca Sheet.'}</div>`}</div>
  <p class="meta" style="margin-top:14px">Senarai ni refresh sendiri setiap 20 saat. Transkrip ditulis dalam bahasa asal video, tak diterjemah.</p>`};
const trLinkOf=t=>{const m=String(t||'').match(/https?:\/\/[^\s"'<>]+/);return m?m[0].replace(/[)\].,!?]+$/,''):''};
A.trPaste=async()=>{const el=$('#trLink');
  try{const t=await navigator.clipboard.readText();const l=trLinkOf(t);if(l){el.value=ui.trLink=l;toast('Link ditampal');return}}catch(e){}
  el.focus();el.select();toast('Tekan lama dalam kotak dan pilih Paste')};
document.addEventListener('paste',e=>{const el=e.target;if(!el||el.id!=='trLink')return;const t=(e.clipboardData||window.clipboardData).getData('text');const l=trLinkOf(t);if(l&&l!==t.trim()){e.preventDefault();el.value=ui.trLink=l}});
A.trAdd=async()=>{const link=trLinkOf(($('#trLink')||{}).value||ui.trLink);if(!link){toast('Tampal link video dulu');return}
  if(!MCP){toast('Sheet belum bersambung');return}
  if(trRows().some(r=>r.link===link&&r.status!=='Gagal')&&!ui.trDup){ui.trDup=true;toast('Link ni dah ada dalam senarai. Tekan Transcribe sekali lagi untuk buat semula');return}
  ui.trDup=false;ui.trBusy=true;render(true);
  try{const g=await MCP.callTool(GS,'get_values',{spreadsheetId:SHEET_ID,range:TR_RANGE},{cache:false});const vals=((g.payload||{}).values||[]).slice();
    const row=Math.max(2,vals.length+1);const id='tr'+uid();const now=new Date().toISOString().replace(/\.\d+Z$/,'Z');const rec=[id,link,now,'Dalam giliran',platOf(link)];
    await MCP.callTool(GS,'update_values',{spreadsheetId:SHEET_ID,range:`Transcribe!A${row}:E${row}`,values:[rec]});
    while(vals.length<row-1)vals.push([]);vals[row-1]=rec;trRaw=vals;ui.trLink='';MCP.invalidate(GS,'get_values').catch(()=>{});toast('Masuk giliran')}
  catch(e){toast(e&&e.code==='tool_error'?'Sheet tolak permintaan':sheetErrText(e&&e.code))}
  ui.trBusy=false;render(true)};
A.trOpen=el=>{const r=trRows().find(x=>x.id===el.dataset.id);if(!r)return;const st=r.status||'Dalam giliran';const done=!!(r.transkrip||r.transkrip_timestamp);
  const isi=lines(r.isi_penting).map(l=>l.replace(/^\d+[.)]\s*/,''));
  modal(`<div data-trmodal="${esc(r.id)}" data-st="${esc(r.status)}"><div class="rowh"><div><h2 style="margin-bottom:6px">${esc(noEmoji(r.tajuk)||'Video')}</h2><div class="meta">${esc([r.platform||platOf(r.link),durFmt(r.tempoh),r.bahasa].filter(Boolean).join(' · '))}</div><span class="pill" style="--pc:${TR_ST[st]||'#999'};margin-top:8px">${esc(trStLabel(st))}</span></div><button class="btn icon sm" data-act="closeModal" aria-label="Tutup">${IC.x}</button></div>
   <div class="btns" style="margin-top:14px">${done?`<button class="btn sm solid tab" data-act="trIdea" data-id="${esc(r.id)}">${IC.ideas}Hantar ke Ideas</button>`:''}<a class="btn sm" href="${esc(r.link)}" target="_blank" rel="noopener">${IC.ext}Buka video</a>${st==='Gagal'?`<button class="btn sm" data-act="trRetry" data-id="${esc(r.id)}">Cuba lagi</button>`:''}</div>
   ${r.ralat?`<p class="meta" style="color:var(--bad);margin:12px 0 0">${esc(r.ralat)}</p>`:''}
   ${!done?`<p class="meta" style="margin-top:16px">${st==='Gagal'?'Tekan Cuba lagi untuk masukkan semula dalam giliran.':'Transkrip keluar di sini bila Mac mini siap. Page ni refresh sendiri.'}</p>`:`
   <div class="rowh" style="align-items:center;margin-top:20px"><h4 style="margin:0">Transkrip penuh</h4><button class="btn sm" data-act="trCopy" data-id="${esc(r.id)}" data-x="full">${IC.copy}Salin</button></div>
   <div class="trtxt">${esc(r.transkrip_timestamp||r.transkrip).replace(/\[(\d+:\d{2}(?::\d{2})?)\]/g,'<span class="ts">$1</span>')}</div>
   <div class="rowh" style="align-items:center;margin-top:20px"><h4 style="margin:0">Isi penting sahaja</h4><button class="btn sm" data-act="trCopy" data-id="${esc(r.id)}" data-x="isi"${isi.length?'':' disabled'}>${IC.copy}Salin</button></div>
   ${isi.length?`<ol class="trisi">${isi.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`:`<p class="meta">${st==='Jana semula'?'Mac mini sedang buat semula isi penting.':'Belum ada isi penting.'}</p>`}
   <button class="btn sm" data-act="trRegen" data-id="${esc(r.id)}"${st==='Jana semula'||st==='Sedang transkrip'?' disabled':''}>${st==='Jana semula'?'Dalam giliran jana semula':'Jana semula isi penting'}</button>`}</div>`,TAB.transcribe.c)};
A.trCopy=el=>{const r=trRows().find(x=>x.id===el.dataset.id);if(!r)return;
  if(el.dataset.x==='isi')copyText(lines(r.isi_penting).join('\n'),'Isi penting disalin');
  else copyText(r.transkrip||r.transkrip_timestamp.replace(/^\[[\d:]+\]\s*/gm,''),'Transkrip disalin')};
async function trSetStatus(r,st){if(!MCP){toast('Sheet belum bersambung');return false}
  try{const g=await MCP.callTool(GS,'get_values',{spreadsheetId:SHEET_ID,range:`Transcribe!A${r.row}`},{cache:false});const v=((((g.payload||{}).values||[])[0])||[])[0];
    if(String(v||'')!==r.id){toast('Baris dah berubah dalam Sheet. Tunggu senarai refresh');return false}
    await MCP.callTool(GS,'update_values',{spreadsheetId:SHEET_ID,range:`Transcribe!D${r.row}`,values:[[st]]});
    if(st==='Dalam giliran')await MCP.callTool(GS,'update_values',{spreadsheetId:SHEET_ID,range:`Transcribe!L${r.row}`,values:[['']]});
    const raw=trRaw[r.row-1]=(trRaw[r.row-1]||[]).slice();raw[3]=st;if(st==='Dalam giliran')raw[11]='';MCP.invalidate(GS,'get_values').catch(()=>{});return true}
  catch(e){toast(e&&e.code==='tool_error'?'Sheet tolak permintaan':sheetErrText(e&&e.code));return false}}
A.trRegen=async el=>{const r=trRows().find(x=>x.id===el.dataset.id);if(r&&await trSetStatus(r,'Jana semula')){toast('Mac mini akan jana semula isi penting');A.trOpen(el);render()}};
A.trRetry=async el=>{const r=trRows().find(x=>x.id===el.dataset.id);if(r&&await trSetStatus(r,'Dalam giliran')){toast('Masuk giliran semula');A.trOpen(el);render()}};
A.trIdea=el=>{const r=trRows().find(x=>x.id===el.dataset.id);if(!r)return;
  const text=['Link: '+r.link,[r.platform,r.bahasa].filter(Boolean).join(' · '),'',r.isi_penting?'Isi penting:\n'+r.isi_penting:'',r.isi_penting?'':'Transkrip:\n'+(r.transkrip||'').slice(0,4000)].filter(x=>x!==undefined).join('\n').trim();
  save('items',{title:(noEmoji(r.tajuk)||'Idea dari video').slice(0,80),stage:'ideas',stageAt:{ideas:Date.now()},sourceLink:r.link,src:{type:'text',text}},true);
  closeModal();toast('Masuk tab Ideas');go('ideas')};


/* Padam: kosongkan baris dalam tab Transcribe (Mac mini abaikan baris kosong). */
A.trDel=el=>{const r=trRows().find(x=>x.id===el.dataset.id);if(!r)return;
  confirmBox('Padam "'+(noEmoji(r.tajuk)||'video ni').slice(0,60)+'" dari senarai?',async()=>{if(!MCP){toast('Sheet belum bersambung');return}
    try{const g=await MCP.callTool(GS,'get_values',{spreadsheetId:SHEET_ID,range:TR_RANGE},{cache:false});const vals=(g.payload||{}).values||[];
      const i=vals.findIndex((row,k)=>k>0&&String((row||[])[0])===r.id);if(i<0){toast('Dah tiada');return}
      await MCP.callTool(GS,'update_values',{spreadsheetId:SHEET_ID,range:`Transcribe!A${i+1}:M${i+1}`,values:[Array(13).fill('')]});
      if(trRaw&&trRaw[i])trRaw[i]=[];if(!$('#scrim').hidden)closeModal();render();toast('Dipadam');MCP.invalidate(GS,'get_values').catch(()=>{})}
    catch(e){toast('Tak dapat padam. Cuba lagi')}},'Ya, padam')};
