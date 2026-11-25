/* ---------- Jadual Posting (24 Nov 2026) ----------
   Sehari: @miracikcit 4 jualan + 1 creative, @miracikcitjuga 4 jualan. Slot dalam settings/main.sched.slots (boleh ubah).
   Peraturan: video berlainan setiap akaun (satu baris Sheet = satu video), produk sama berselang hari,
   satu produk sekali sehari setiap akaun, creative hanya @miracikcit, produk ikut deadline sample (postBy) dulu.
   Status Sheet: Auto (app pilih) | Tetap (Mira ubah manual) | Scheduled (dah schedule) | Excluded (post cepat, tak dikira) | Posted.
   0 token: semua kiraan dalam app. */
const SCHED_ACC=['miracikcit','miracikcitjuga'];
const SCHED_DEF=[{t:'07:00',a:'miracikcit',k:'J'},{t:'08:00',a:'miracikcit',k:'C'},{t:'12:00',a:'miracikcit',k:'J'},{t:'16:00',a:'miracikcit',k:'J'},{t:'19:00',a:'miracikcit',k:'J'},
  {t:'07:00',a:'miracikcitjuga',k:'J'},{t:'12:00',a:'miracikcitjuga',k:'J'},{t:'16:00',a:'miracikcitjuga',k:'J'},{t:'19:00',a:'miracikcitjuga',k:'J'}];
const SCHED_MIN_BATCH=3;   /* sekurang-kurangnya 3 video produk sama setiap akaun dalam satu batch */
const schedSlots=()=>{const s=((S.settings||{}).sched||{}).slots;return (Array.isArray(s)&&s.length?s:SCHED_DEF).slice().sort((x,y)=>x.t.localeCompare(y.t))};
const timeLbl=t=>{const m=String(t||'').match(/^(\d{1,2}):(\d{2})/);if(!m)return t||'';let h=+m[1];const ap=h>=12?'pm':'am';h=h%12||12;return h+(m[2]!=='00'?':'+m[2]:'')+ap};
const schKey=r=>r.tab+'|'+r.row;
const schFixed=st=>/^(scheduled|tetap)$/i.test(st);
function addDays(d,n){const x=new Date(d+'T00:00:00');x.setDate(x.getDate()+n);return ymd(x)}
const dayDiff=(a,b)=>Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/864e5);
function schedPrio(g){/* deadline sample paling dekat dulu */
  const it=(typeof activeSamples==='function'?activeSamples():[]).find(x=>itMatch(x,g.name));return it&&it.sample&&it.sample.postBy||'9999-99-99'}

/* Pelan penuh: kekalkan slot Tetap/Scheduled/Auto yang masih akan datang, isi baris lain ke slot kosong seterusnya. */
function schedPlan(groups,now){now=now||new Date();const today=ymd(now),nowT=pad(now.getHours())+':'+pad(now.getMinutes());
  const slots=schedSlots(),sales={},cre=slots.filter(s=>s.k==='C');SCHED_ACC.forEach(a=>sales[a]=slots.filter(s=>s.k==='J'&&s.a===a));
  const out=new Map(),occ=new Map(),last={},prodDay=new Set(),moved=new Map();const later=(d,t)=>d>today||(d===today&&t>nowT);
  const rows=[];groups.forEach(g=>g.rows.forEach(r=>{if(g.tab==='PRODUCTS'&&!r.vid)return;rows.push(r)}));
  const pkey=r=>r.tab==='NON'?'':nrm(r.group.name);
  const put=(r,v)=>{if(moved.has(schKey(r)))v.moved=moved.get(schKey(r));out.set(schKey(r),v);if(v.date&&v.time){occ.set(v.date+'|'+v.time+'|'+v.acc,r);const p=pkey(r);if(p){prodDay.add(p+'|'+v.acc+'|'+v.date);if(!last[p]||last[p]<v.date)last[p]=v.date}}};
  const base=r=>({acc:r.sch.acc,kind:r.tab==='NON'?'Creative':'Jualan',prod:r.tab==='NON'?r.group.name:r.group.name});
  const todo=[];
  rows.forEach(r=>{const s=r.sch,st=s.status;
    if(isSettled(r)){put(r,Object.assign(base(r),{date:s.date,time:s.time,status:'Posted'}));return}
    if(/^excluded$/i.test(st)){put(r,Object.assign(base(r),{date:'',time:'',status:'Excluded'}));return}
    /* 25 Nov (Mira): tarikh dah lepas dan belum settled = masuk semula barisan, dapat slot kosong seterusnya */
    if(s.date&&s.date<today){moved.set(schKey(r),s.date);todo.push(r);return}
    if(s.date&&s.time&&(schFixed(st)||(/^auto$/i.test(st)&&later(s.date,s.time)))){put(r,Object.assign(base(r),{date:s.date,time:s.time,acc:s.acc,status:schFixed(st)?st.charAt(0).toUpperCase()+st.slice(1).toLowerCase():'Auto'}));return}
    todo.push(r)});
  /* barisan setiap produk */
  const Q=new Map(),creQ=[];
  todo.forEach(r=>{if(r.tab==='NON'){creQ.push(r);return}const p=pkey(r);if(!Q.has(p))Q.set(p,{g:r.group,rows:[],prio:schedPrio(r.group),started:!!last[p]});Q.get(p).rows.push(r)});
  const left=()=>[...Q.values()].some(q=>q.rows.length)||creQ.length;
  for(let d=0;d<90&&left();d++){const date=addDays(today,d);
    cre.forEach(s=>{if(!creQ.length||!later(date,s.t)||occ.has(date+'|'+s.t+'|'+s.a))return;const r=creQ.shift();put(r,Object.assign(base(r),{date,time:s.t,acc:s.a,status:'Auto'}))});
    const cand=[...Q.entries()].filter(([p,q])=>q.rows.length&&(!last[p]||(last[p]!==date&&dayDiff(last[p],date)>=2)))
      .sort((a,b)=>(b[1].started-a[1].started)||a[1].prio.localeCompare(b[1].prio)||(a[1].g.start-b[1].g.start));
    for(const [p,q] of cand){
      SCHED_ACC.forEach(a=>{if(!q.rows.length||prodDay.has(p+'|'+a+'|'+date))return;
        const s=sales[a].find(x=>later(date,x.t)&&!occ.has(date+'|'+x.t+'|'+a));if(!s)return;
        let i=q.rows.findIndex(r=>r.sch.acc===a||r.acc[0]===a);if(i<0)i=q.rows.findIndex(r=>!SCHED_ACC.includes(r.sch.acc)&&!SCHED_ACC.includes(r.acc[0]));if(i<0)i=0;
        const r=q.rows.splice(i,1)[0];put(r,Object.assign(base(r),{date,time:s.t,acc:a,status:'Auto'}));q.started=true})}}
  return out}

/* Amaran + stok: slot kosong, kuota akaun, belum schedule dalam 3 hari, produk kurang dari 3 video setiap akaun */
function schedWarn(plan,groups,now){now=now||new Date();const today=ymd(now),slots=schedSlots();const by=new Map();
  plan.forEach((v,k)=>{if(v.date&&v.time)by.set(v.date+'|'+v.time+'|'+v.acc,Object.assign({k},v))});
  const days=[];let fullUntil=null,gap=false;
  for(let d=0;d<14;d++){const date=addDays(today,d);const empty=slots.filter(s=>!by.has(date+'|'+s.t+'|'+s.a)&&(d>0||s.t>pad(now.getHours())+':'+pad(now.getMinutes())));
    const quota={};SCHED_ACC.forEach(a=>{const need=slots.filter(s=>s.a===a).length;quota[a]={need,have:need-empty.filter(s=>s.a===a).length}});
    days.push({date,empty,quota});if(!empty.length&&!gap)fullUntil=date;else gap=true}
  const soon=[...by.values()].filter(v=>v.status==='Auto'||v.status==='Tetap').filter(v=>dayDiff(today,v.date)<=3);
  const short=[];(groups||[]).filter(g=>g.tab==='PRODUCTS').forEach(g=>{const c={};g.rows.forEach(r=>{const v=plan.get(schKey(r));if(v&&v.status!=='Posted'&&v.status!=='Excluded'&&v.acc)c[v.acc]=(c[v.acc]||0)+1});
    const n=Object.values(c).reduce((a,b)=>a+b,0);if(n&&SCHED_ACC.some(a=>(c[a]||0)<SCHED_MIN_BATCH))short.push({name:g.name,c})});
  return {days,fullUntil,soon,short}}

/* Tulis ke Sheet: satu blok setiap tab (PRODUCTS U5:Z, NON P5:U), hanya bila berubah */
let schedBusy=false,schedAt=0,schedProg=null;
async function autoSched(force){if(schedBusy||mode!=='live'||!MCP||!sheetRaw.PRODUCTS||!sheetRaw.NON)return;if(!force&&Date.now()-schedAt<120000)return;schedAt=Date.now();
  const groups=parseSheet();if(!groups)return;const plan=schedPlan(groups);schedBusy=true;let n=0;
  try{const tabs=Object.keys(SH);for(let ti=0;ti<tabs.length;ti++){const tab=tabs[ti],t=SH[tab],raw=sheetRaw[tab];const last=raw.length;if(last<5)continue;
      const vals=[];let changed=false;
      for(let rn=5;rn<=last;rn++){const r=raw[rn-1]||[];const cur=[0,1,2,3,4,5].map(i=>String(r[t.sc+i]==null?'':r[t.sc+i]));const v=plan.get(tab+'|'+rn);
        const nx=v?[v.date||'',v.time||'',v.acc||'',v.kind||'',v.prod||'',v.status||'']:cur;
        if(v&&nx.some((x,i)=>x!==(i===0?schDate(cur[0])||cur[0]:cur[i]))){changed=true;n++}vals.push(nx)}
      schedProg={pct:Math.round(ti/tabs.length*100),txt:'Kemas kini jadual dalam Sheet'};
      if(changed){const c0=String.fromCharCode(65+t.sc),c1=String.fromCharCode(65+t.sc+5);await sheetWrite(`${t.q}!${c0}5:${c1}${last}`,vals);
        vals.forEach((nx,i)=>{const a=raw[i+4]=(raw[i+4]||[]).slice();nx.forEach((x,j)=>a[t.sc+j]=x)})}}
    let mv=0;groups.forEach(g=>g.rows.forEach(r=>{const v=plan.get(schKey(r));if(v&&v.moved&&v.date){const id=rmKey(r);const rm=get('readymeta',id)||{id};if(rm.moved!==v.moved||rm.movedTo!==v.date){save('readymeta',Object.assign({},rm,{moved:v.moved,movedTo:v.date}));mv++}}}));
    if(n){render();toast(mv?mv+' missed video'+(mv>1?'s':'')+' moved to a new date':'Jadual posting dikemas kini: '+n+' video')}}
  catch(e){toast('Tak dapat tulis jadual ke Sheet')}finally{schedBusy=false;schedProg=null}}

/* ---------- Pelan produksi (24 Nov, peringkat 3) ----------
   Job akan datang (Shoot / Shot / Edit, belum dalam Sheet): setiap produk perlu 3 video setiap akaun = 6 video,
   post berselang hari (D, D+2, D+4). App cari slot kosong terawal yang muat, kemudian kira undur:
   Edit siap = D-2, Shoot siap = D-4 (folder VO/VLOG D-6). Creative: 1 video setiap slot creative kosong. 0 token. */
const PROD_SHOOT=4,PROD_SHOOT_VO=6,PROD_EDIT=2,PROD_DAYS=14;
function prodPlan(now){now=now||new Date();const today=ymd(now);const groups=parseSheet();if(!groups)return null;
  const plan=schedPlan(groups,now),W=schedWarn(plan,groups,now),slots=schedSlots();
  const cap={},cre={};for(let d=0;d<75;d++){const date=addDays(today,d);cap[date]={};SCHED_ACC.forEach(a=>cap[date][a]=0);cre[date]=0}
  for(let d=0;d<75;d++){const date=addDays(today,d);const nowT=pad(now.getHours())+':'+pad(now.getMinutes());
    slots.forEach(s=>{if(d===0&&s.t<=nowT)return;let used=false;plan.forEach(v=>{if(v.date===date&&v.time===s.t&&v.acc===s.a)used=true});if(used)return;if(s.k==='C')cre[date]++;else cap[date][s.a]++})}
  const isVO=it=>/VO|VLOG/i.test(String(it.folder||''));
  const due=it=>it.sample&&it.sample.postBy||it.postDate||'';
  const up=S.items.filter(it=>['toshoot','shot','toedit'].includes(it.stage));
  const jobs=up.filter(isJob).sort((a,b)=>(due(a)||'9').localeCompare(due(b)||'9')||(a.created||0)-(b.created||0));
  const cres=up.filter(it=>!isJob(it)).sort((a,b)=>(a.created||0)-(b.created||0));
  const res={},need=SCHED_MIN_BATCH*SCHED_ACC.length;
  const lead=it=>it.stage==='toshoot'?(isVO(it)?PROD_SHOOT_VO:PROD_SHOOT):PROD_EDIT;
  const fits=date=>[0,2,4].every(o=>{const x=addDays(date,o);return cap[x]&&SCHED_ACC.every(a=>cap[x][a]>0)});
  /* deadline dah dekat: mampatkan (shoot hari ni, edit esok, post lusa) */
  jobs.forEach(it=>{const L=lead(it),du=due(it);const L0=du?Math.max(2,Math.min(L,dayDiff(today,du))):L;let D=null;for(let d=L0;d<70;d++){const date=addDays(today,d);if(fits(date)){D=date;break}}
    if(D)[0,2,4].forEach(o=>SCHED_ACC.forEach(a=>cap[addDays(D,o)][a]--));
    const back=D?dayDiff(today,D):0,tight=D&&back<L;
    const sh=D?(tight?today:addDays(D,-(isVO(it)?PROD_SHOOT_VO:PROD_SHOOT))):'',ed=D?(tight?addDays(D,-1):addDays(D,-PROD_EDIT)):'';
    res[it.id]={kind:'Jualan',need,post:D||'',postEnd:D?addDays(D,4):'',shootBy:it.stage==='toshoot'?sh:'',editBy:ed,due:du,late:!!(D&&du&&D>du),urgent:!!(D&&(it.stage==='toshoot'?sh:ed)<=today)}});
  cres.forEach(it=>{let D=null;for(let d=lead(it);d<70;d++){const date=addDays(today,d);if(cre[date]>0){D=date;cre[date]--;break}}
    res[it.id]={kind:'Creative',need:1,post:D||'',shootBy:D&&it.stage==='toshoot'?addDays(D,-PROD_SHOOT):'',editBy:D?addDays(D,-PROD_EDIT):'',urgent:!!(D&&addDays(D,-(it.stage==='toshoot'?PROD_SHOOT:PROD_EDIT))<=today)}});
  /* baki kekosongan 14 hari selepas job akan datang */
  let gapJ=0,gapC=0;for(let d=0;d<PROD_DAYS;d++){const date=addDays(today,d);gapJ+=SCHED_ACC.reduce((n,a)=>n+Math.max(0,cap[date][a]),0);gapC+=Math.max(0,cre[date])}
  return {res,jobs,cres,W,gapJ,gapC,moreProducts:Math.ceil(gapJ/need)}}
const prodLine=it=>{const P=prodPlanC();const p=P&&P.res[it.id];if(!p)return '';const c=p.late||p.urgent?'#C0392B':'#7A4E2D';
  if(!p.post)return `<div class="tsplan" style="--pc:#C0392B">Perlu ${p.need} video · tiada slot kosong dalam 70 hari</div>`;
  return `<div class="tsplan" style="--pc:${c}"><b>Perlu ${p.need} video</b>${p.kind==='Jualan'?' (3 setiap akaun)':''}${p.shootBy?' · Shoot by '+dmy(p.shootBy):''} · Edit by ${dmy(p.editBy)} · Post ${dmy(p.post)}${p.postEnd?'–'+dmy(p.postEnd):''}${p.late?' · lewat dari deadline '+dmy(p.due):''}</div>`};
let prodCache=null,prodAt=0;
function prodPlanC(){if(!prodCache||Date.now()-prodAt>5000){try{prodCache=prodPlan()}catch(e){prodCache=null}prodAt=Date.now()}return prodCache}
