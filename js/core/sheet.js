/* ---------- Google Sheet CONTENT 2026 ---------- */
const SHEET_ID='1JryxaXeebnpFbAcZWGW_UkxUS7H7EkMBFgdE_14Y9Kw',GS='Google Sheets',PLAT4=['TT','IG','FB','SV'];
const SH={PRODUCTS:{range:'PRODUCTS!A1:T400',q:'PRODUCTS',sched:6,posted:10,acc:14},NON:{range:"'NON PRODUCT'!A1:N300",q:"'NON PRODUCT'",sched:3,posted:7,acc:11}};
const sheetRaw={PRODUCTS:null,NON:null};let sheetState='off',sheetErr=null,sheetAt=0;
const isT=v=>v===true||String(v).toUpperCase()==='TRUE';
function parseSheet(){
  if(!sheetRaw.PRODUCTS&&!sheetRaw.NON)return null;
  const groups=[];let g=null,seq=0;
  (sheetRaw.PRODUCTS||[]).forEach((r,i)=>{const rn=i+1;if(rn<5)return;r=r||[];
    if(String(r[3]||'').trim()!==''){seq++;const c=String(r[2]||'').trim();g={tab:'PRODUCTS',name:String(r[1]||'').trim(),no:String(r[0]||'').trim()||String(seq),shopee:isUrl(c)?c:'',tt:'',start:rn,rows:[],kind:String(r[17]||'').trim(),price:String(r[18]||'').trim()};groups.push(g)}
    else if(g){const c=String(r[2]||'').trim();if(isUrl(c)&&!g.tt)g.tt=c}
    if(g&&String(r[4]||'').trim()!=='')g.rows.push({tab:'PRODUCTS',row:rn,vid:String(r[4]),caption:r[5]||'',sched:[6,7,8,9].map(c=>isT(r[c])),posted:[10,11,12,13].map(c=>isT(r[c])),acc:[String(r[14]||'').trim(),String(r[15]||'').trim()],group:g})});
  (sheetRaw.NON||[]).forEach((r,i)=>{const rn=i+1;if(rn<5)return;r=r||[];const nm=String(r[1]||'').trim();if(!nm)return;
    const ng={tab:'NON',name:nm,rows:[],start:rn};ng.rows.push({tab:'NON',row:rn,vid:'',caption:r[2]||'',sched:[3,4,5,6].map(c=>isT(r[c])),posted:[7,8,9,10].map(c=>isT(r[c])),acc:[String(r[11]||'').trim(),String(r[12]||'').trim()],group:ng});groups.push(ng)});
  return groups}
const isPub=r=>r.sched.some(Boolean)?r.sched.every((sc,i)=>!sc||r.posted[i]):r.posted.every(Boolean);
function matchFile(name,groups){const t=name.replace(/\.(mp4|mov|m4v)$/i,'').split(/[_-]+/);const t1=nrm(t[0]),t2=nrm(t[1]);
  let c=groups.filter(g=>{const gn=nrm(g.name);return gn&&t1&&(gn.startsWith(t1)||t1.startsWith(gn))});
  if(c.length>1&&t2&&!/^\d+$/.test(t2)){const c2=c.filter(g=>nrm(g.name).includes(t2));if(c2.length)c=c2}
  return c.length?c[0]:null}
function sheetView(){
  const groups=parseSheet();if(!groups)return null;
  const files=((S.sync.topost||{}).files)||[];const gf=new Map();const unmatched=[];
  files.forEach(f=>{const g=matchFile(f.name,groups);if(g){if(!gf.has(g))gf.set(g,[]);gf.get(g).push(f)}else unmatched.push(f)});
  const ready=[],pub=[];groups.forEach(g=>g.rows.forEach(r=>(isSettled(r)?pub:ready).push(r)));
  return {groups,gf,unmatched,ready,pub}}
function rowStart(r,sv){const fs=sv.gf.get(r.group)||[];const m=fs.find(f=>new RegExp('_'+r.vid+'_').test(f.name));if(m&&m.mtime)return m.mtime;
  const rm=get('readymeta',rmKey(r));if(rm&&rm.start)return rm.start;return fs.length?Math.max(...fs.map(f=>f.mtime||0))||null:null}
const rmKey=r=>nrm(r.group.name)+'-'+(r.vid||'0');
const isSettled=r=>!!(get('readymeta',rmKey(r))||{}).settled;
function sheetErrText(c){return {needs_reauth:'Sambung semula Google Sheets dalam Settings, Connectors.',server_not_connected:'Tambah connector Google Sheets dalam Settings, Connectors.',approval_required:'App perlukan kebenaran kau untuk baca sheet.',not_in_manifest:'Akses Google Sheets ditutup untuk app ni.',selection_required:'Pilih akaun Google Sheets bila diminta.'}[c]||'Tak dapat baca sheet sekarang. Cuba lagi sekejap.'}
async function initSheet(){
  try{MCP=await claude.use('mcp')}catch(e){MCP=null}
  if(!MCP){sheetState='off';render();return}
  sheetState='loading';
  Object.entries(SH).forEach(([k,t])=>MCP.watchTool(GS,'get_values',{spreadsheetId:SHEET_ID,range:t.range},ev=>{
    if(ev.type==='data'){sheetRaw[k]=(ev.result.payload||{}).values||[];sheetState='ok';sheetAt=(ev.result.cache&&ev.result.cache.storedAt)||Date.now();sheetErr=null}
    else{sheetErr=ev.error&&ev.error.code;if(['needs_reauth','server_not_connected','blocked_by_policy','approval_required','not_in_manifest','not_granted','capability_disabled','selection_required','consent_required'].includes(sheetErr)){sheetRaw[k]=null;sheetState='err'}}
    render()},{refetchInterval:60000}));
  MCP.watchTool(GS,'get_values',{spreadsheetId:SHEET_ID,range:JOBS_RANGE},ev=>{if(ev.type==='data'){jobsRaw=(ev.result.payload||{}).values||[];jobsFromSheet()}},{refetchInterval:60000});
  MCP.watchTool(GS,'get_values',{spreadsheetId:SHEET_ID,range:TR_RANGE},ev=>{if(ev.type==='data')trOnData((ev.result.payload||{}).values||[])},{refetchInterval:20000});
  MCP.watchTool(GS,'get_values',{spreadsheetId:SHEET_ID,range:'SORTER!A1:D80'},ev=>{if(ev.type==='data'){sorterRaw=(ev.result.payload||{}).values||[];if(ui.view==='home')render()}},{refetchInterval:120000});
  loadCal()}
async function sheetWrite(range,values){if(!MCP)throw {code:'off'};await MCP.callTool(GS,'update_values',{spreadsheetId:SHEET_ID,range,values});MCP.invalidate(GS,'get_values').catch(()=>{})}
async function sheetTick(tab,row,kind,idx){
  const t=SH[tab],raw=sheetRaw[tab];if(!raw)return;const col=String.fromCharCode(65+t[kind]+idx);
  const r=raw[row-1]=(raw[row-1]||[]).slice();const cur=isT(r[t[kind]+idx]);r[t[kind]+idx]=cur?'FALSE':'TRUE';render();
  try{await sheetWrite(`${t.q}!${col}${row}`,[[!cur]]);toast('Sheet dikemas kini')}catch(e){r[t[kind]+idx]=cur?'TRUE':'FALSE';render();toast(e.code==='tool_error'?'Sheet tolak perubahan':sheetErrText(e.code))}}
async function saveLinks(start){
  const groups=parseSheet()||[];const g=groups.find(x=>x.tab==='PRODUCTS'&&x.start===start);if(!g)return;
  const sEl=document.querySelector(`[data-lk="${start}|s"]`),tEl=document.querySelector(`[data-lk="${start}|t"]`);
  const sv=sEl?sEl.value.trim():g.shopee,tv=tEl?tEl.value.trim():g.tt;
  if((sv&&!isUrl(sv))||(tv&&!isUrl(tv))){toast('Link mesti mula dengan https://');return}
  if(!MCP){toast('Sheet belum bersambung');return}
  const buy=[sv?'✅ Beli di Shopee: '+sv:'',tv?'✅ Beli di Tiktok: '+tv:''].filter(Boolean).join('\n');
  const raw=sheetRaw.PRODUCTS;const next=(raw&&raw[start])||[];const nextIsProduct=String(next[3]||'').trim()!=='';
  try{await sheetWrite(`PRODUCTS!C${start}`,[[sv]]);
    if(!nextIsProduct)await sheetWrite(`PRODUCTS!B${start+1}:C${start+1}`,[[buy,tv]]);
    if(raw){const a=raw[start-1]=(raw[start-1]||[]).slice();a[2]=sv;if(!nextIsProduct){const b=raw[start]=(raw[start]||[]).slice();b[1]=buy;b[2]=tv}}
    document.activeElement&&document.activeElement.blur&&document.activeElement.blur();render();toast('Link disimpan. Sheet dan tab Links dikemas kini')
  }catch(e){toast(e.code==='tool_error'?'Sheet tolak perubahan':sheetErrText(e.code))}}
const sheetNote=()=>sheetState==='err'?`<div class="banner glass">${esc(sheetErrText(sheetErr))} <button class="btn sm" data-act="shConn">Sambung sheet</button></div>`:sheetState==='loading'&&!sheetRaw.PRODUCTS?`<div class="banner glass">Sedang baca sheet CONTENT 2026.</div>`:sheetState==='off'&&mode!=='loading'?`<div class="banner glass">Sheet CONTENT 2026 tak bersambung dalam paparan ni.</div>`:'';

