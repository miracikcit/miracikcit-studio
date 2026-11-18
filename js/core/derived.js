/* ---------- derived data ---------- */
const byStage=s=>S.items.filter(x=>x.stage===s).sort((a,b)=>(b.stageAt&&b.stageAt[s]||b.created||0)-(a.stageAt&&a.stageAt[s]||a.created||0));
function moveItem(it,stage,extra){const o=Object.assign({},it,extra||{},{stage});o.stageAt=Object.assign({},it.stageAt,{[stage]:Date.now()});save('items',o);toast('Dipindah ke '+TAB[STAGE_TAB[stage]].l)}
function toEditFolders(){const mk=S.sync.toeditmarks||{};const gone=k=>Math.max((mk.done||{})[k]||0,(mk.hidden||{})[k]||0);const out=[];
  (((S.sync.toedit||{}).stages)||[]).forEach(st=>(st.items||[]).forEach(it=>{const key=st.name+'/'+it.name;if(gone(key)>=(it.mtime||0))return;out.push(Object.assign({stage:st.name,key},it))}));return out}
function markToEdit(key,kind){const m=Object.assign({done:{},hidden:{}},S.sync.toeditmarks||{});m[kind]=Object.assign({},m[kind],{[key]:Date.now()});S.sync.toeditmarks=m;render();saveDoc('sync/toeditmarks',m)}
function publishedEntries(sv){const map=new Map();
  if(sv)sv.groups.forEach(g=>{const n=g.rows.filter(isSettled).length;if(!n)return;const k=nrm(g.name);const e=map.get(k)||{key:k,name:g.name,vids:0,total:0,groups:[],tab:g.tab};e.vids+=n;e.total+=g.rows.length;e.groups.push(g);map.set(k,e)});
  byStage('published').forEach(it=>{const k=nrm(it.title);const e=map.get(k)||{key:k,name:it.title,vids:0,total:0,groups:[],tab:'APP',item:it};e.vids+=1;e.total+=1;if(!e.item)e.item=it;map.set(k,e)});
  S.published.forEach(p=>{const k=nrm(p.title||p.name);const e=map.get(k)||{key:k,name:p.title||p.name,vids:0,total:0,groups:[],tab:'FAIL',legacy:p};e.vids+=1;e.total+=1;map.set(k,e)});
  return [...map.values()]}
const fno=name=>{const m=String(name||'').match(/^(\d+)/);return m?m[1]:''};
const fnoBadge=n=>`<div class="fno" style="--fc:${FCOL[n]||'#8C8179'}">${esc(n||'·')}</div>`;

