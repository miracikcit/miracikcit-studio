/* ---------- derived data ---------- */
const byStage=s=>S.items.filter(x=>x.stage===s).sort((a,b)=>(b.stageAt&&b.stageAt[s]||b.created||0)-(a.stageAt&&a.stageAt[s]||a.created||0));
function moveItem(it,stage,extra){const o=Object.assign({},it,extra||{},{stage});o.stageAt=Object.assign({},it.stageAt,{[stage]:Date.now()});save('items',o);toast('Dipindah ke '+TAB[STAGE_TAB[stage]].l)}
function toEditFolders(){const mk=S.sync.toeditmarks||{};const gone=k=>Math.max(((mk.done||{})[k]||0)+3*DAY,(mk.hidden||{})[k]||0);const out=[];
  (((S.sync.toedit||{}).stages)||[]).forEach(st=>(st.items||[]).forEach(it=>{const key=st.name+'/'+it.name;if(!multiKey(key)&&(gone(key)>=(it.mtime||0)||folderRendered(it)||edFinal(key)))return;out.push(Object.assign({stage:st.name,key},it))}));return out}
/* Folder edit dianggap siap bila video final dengan nama produk tu muncul dalam 00. TO POST FINAL selepas folder diubah */
function folderRendered(f){const files=((S.sync.topost||{}).files)||[];const fn=nrm(f.name);if(fn.length<4)return false;
  return files.some(x=>{const t=nrm(String(x.name||'').split(/[_-]+/)[0]);return t.length>=4&&(fn.startsWith(t)||t.startsWith(fn))&&(x.mtime||0)>=(f.mtime||0)-14*DAY})}
function markToEdit(key,kind){const m=Object.assign({done:{},hidden:{}},S.sync.toeditmarks||{});m[kind]=Object.assign({},m[kind],{[key]:Date.now()});S.sync.toeditmarks=m;render();saveDoc('sync/toeditmarks',m)}
function publishedEntries(sv){const map=new Map();
  if(sv)sv.groups.forEach(g=>{const n=g.rows.filter(isSettled).length;if(!n)return;const k=nrm(g.name);const e=map.get(k)||{key:k,name:g.name,vids:0,total:0,groups:[],tab:g.tab};e.vids+=n;e.total+=g.rows.length;e.groups.push(g);map.set(k,e)});
  byStage('published').filter(it=>!it.sheetMatched).forEach(it=>{const k=nrm(it.title);const e=map.get(k)||{key:k,name:it.title,vids:0,total:0,groups:[],tab:'APP',item:it};e.vids+=1;e.total+=1;if(!e.item)e.item=it;map.set(k,e)});
  S.published.forEach(p=>{const k=nrm(p.title||p.name);const e=map.get(k)||{key:k,name:p.title||p.name,vids:0,total:0,groups:[],tab:'FAIL',legacy:p};e.vids+=1;e.total+=1;map.set(k,e)});
  return [...map.values()]}
const fno=name=>{const m=String(name||'').match(/^(\d+)/);return m?m[1]:''};
const fnoBadge=n=>`<div class="fno" style="--fc:${FCOL[n]||'#8C8179'}">${esc(n||'·')}</div>`;


/* Sesi EDIT NOW tanda Siap / final dalam tracker Editor: folder edit tu dah render, keluar dari tab Edit */
/* Projek banyak video (tracker ada `videos` > 1): kekal dalam senarai sampai SEMUA video dah published dalam Sheet (2026-11-21, Mira) */
/* 26 Nov (Mira): GENTING ada 7 video tapi tracker tulis "Siap" lepas video pertama, storyboard Awana P1/P2 terlepas.
   Sekarang setiap video projek didaftar dalam `parts` [{id,name,file,url,status,final}] oleh sesi Claude; worker isi `final`
   setiap bahagian bila fail muncul dalam 00. TO POST FINAL. Projek dikira siap hanya bila SEMUA bahagian ada final. */
const edParts=e=>(e&&Array.isArray(e.parts)?e.parts:[]).filter(p=>p&&typeof p==='object');
const edTot=e=>Math.max(+e.videos||0,edParts(e).length);
const edFinN=e=>edParts(e).length?edParts(e).filter(p=>p.final).length:(e.finals||[]).length;
const edMulti=e=>edTot(e)>1;
function edPub(e){const sv=sheetView();if(!sv)return 0;const n=nrm(e.name||'');if(n.length<3)return 0;let c=0;sv.groups.forEach(g=>{if(nrm(g.name).startsWith(n))g.rows.forEach(r=>{if(isSettled(r)||r.posted.some(Boolean))c++})});return c}
function edDone(e){return edMulti(e)?(edParts(e).length||e.finals?edFinN(e)>=edTot(e):true)&&edPub(e)>=edTot(e):!!(e.final||/siap/i.test(e.status||''))}
const multiKey=key=>S.editor.some(e=>e.folder===key&&edMulti(e)&&!edDone(e));
function edFinal(key){return S.editor.some(e=>e.folder===key&&edDone(e))}
/* Video yang baru masuk 00. TO POST FINAL (3 hari), untuk jalur "Baru siap render" */
function freshFinals(){const files=((S.sync.topost||{}).files)||[];return files.filter(f=>(f.mtime||0)>Date.now()-1*DAY).sort((a,b)=>b.mtime-a.mtime)}
