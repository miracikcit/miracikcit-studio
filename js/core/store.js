/* ---------- persistence ---------- */
const chains={};
function queue(path,fn){chains[path]=(chains[path]||Promise.resolve()).then(fn).catch(err=>{
  if(err&&err.code==='quota_exceeded')toast('Storan penuh. Padam beberapa item');
  else if(err&&err.code==='unavailable')setTimeout(()=>queue(path,fn),900);
  else toast('Tak dapat simpan. Cuba lagi')})}
function localSave(){try{localStorage.setItem('miracikcit-studio-v2',JSON.stringify(S))}catch(e){}}
function localLoad(){try{const d=JSON.parse(localStorage.getItem('miracikcit-studio-v2')||'null');if(d)Object.assign(S,d)}catch(e){}}
function save(col,obj,silent){
  if(!obj.id)obj.id=uid();obj.updated=Date.now();if(!obj.created)obj.created=obj.updated;
  const arr=S[col];const i=arr.findIndex(x=>x.id===obj.id);if(i>=0)arr[i]=obj;else arr.push(obj);
  if(!silent)render();
  if(DB){const body=clean(obj);queue(col+'/'+obj.id,()=>DB.collection(col).doc(obj.id).set(body))}else localSave();
  return obj}
function del(col,id){S[col]=S[col].filter(x=>x.id!==id);render();if(DB)queue(col+'/'+id,()=>DB.collection(col).doc(id).delete());else localSave()}
function saveDoc(path,body){if(DB)queue(path,()=>DB.doc(path).set(clean(body)));else localSave()}
const get=(col,id)=>S[col].find(x=>x.id===id);
async function initStore(){
  const timer=setTimeout(()=>{if(mode==='loading'){mode='slow';render()}},10000);
  let db=null;try{db=await claude.use('db')}catch(e){}
  claude.use('assets').then(a=>{ASSETS=a;render()}).catch(()=>{});
  claude.use('sample').then(a=>{SAMPLE=a}).catch(()=>{});
  claude.use('dictation').then(a=>{DICT=a;render()}).catch(()=>{});
  if(!db){clearTimeout(timer);mode='local';localLoad();render();return}
  DB=db;let got=0;const done=()=>{if(++got>=COLS.length&&mode!=='live'){mode='live';clearTimeout(timer);setTimeout(()=>{jobsFromSheet();autoAdvance()},800)}};
  COLS.forEach(col=>{let first=true;DB.collection(col).onSnapshot(snap=>{S[col]=snap.docs.map(d=>Object.assign({},d.data(),{id:d.id}));if(first){first=false;done()}render()},()=>{clearTimeout(timer);mode='error';render()})});
  ['folders','topost','toedit','toeditmarks'].forEach(k=>DB.doc('sync/'+k).onSnapshot(snap=>{S.sync[k]=snap.exists?snap.data():null;render();if(k==='topost')autoAdvance()},()=>{}));
  DB.doc('reference/editstyles').onSnapshot(snap=>{S.styles=snap.exists?snap.data():null;render()},()=>{});
  DB.doc('settings/main').onSnapshot(snap=>{S.settings=snap.exists?Object.assign({},snap.data()):null;render()},()=>{});
}

