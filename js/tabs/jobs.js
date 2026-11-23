/* ---------- JOBS ---------- */
const JOBS_RANGE='JOBS!A2:R300',JSPDF='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';let jobsRaw=null;const jobsPending={};
const padRow=r=>{r=r||[];const a=r.slice(0,13).concat([r[15],r[16],r[17]]).map(x=>String(x??''));while(a.length<16)a.push('');return a};
const jobRow=j=>[j.no,j.brand,j.paid===false?'NON PAID':'PAID',j.status||'Baru',j.deadline,j.fee,j.contact,j.deliverables,j.requirements,j.notes,j.clientName,j.clientAddress,j.clientContact,j.draftDate,j.postDate,j.submitDate].map(x=>String(x??''));
const toYmd=s=>{s=String(s||'').trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);if(m)return m[3]+'-'+pad(+m[2])+'-'+pad(+m[1]);const d=new Date(s);return s&&!isNaN(d)?ymd(d):''};
const rowToJob=f=>({no:f[0],brand:f[1],paid:!/non/i.test(f[2]),status:f[3]||'Baru',deadline:toYmd(f[4]),fee:f[5],contact:f[6],deliverables:f[7],requirements:f[8],notes:f[9],clientName:f[10],clientAddress:f[11],clientContact:f[12],draftDate:toYmd(f[13]),postDate:toYmd(f[14]),submitDate:toYmd(f[15])});
function jobsFromSheet(){if(mode!=='live'||!jobsRaw||!MCP)return;let ch=0;
  jobsRaw.forEach((r,i)=>{const f=padRow(r);const id=String((r||[])[13]||'').trim();const rn=i+2;
    if(id){const j=get('jobs',id);if(!j||!j.sheetSnap||Date.now()-(j.sheetAt||0)<90000)return;
      if(JSON.stringify(f)!==JSON.stringify(j.sheetSnap)){save('jobs',Object.assign({},j,rowToJob(f),{sheetSnap:f}),true);ch++}}
    else if(f[1].trim()&&!jobsPending[rn]){jobsPending[rn]=1;const j=save('jobs',Object.assign(rowToJob(f),{sheetSnap:f,sheetAt:Date.now()}),true);sheetWrite(`JOBS!N${rn}`,[[j.id]]).catch(()=>{});ch++}});
  if(ch)render()}
function jobRowNo(j){const rows=jobsRaw||[];let i=rows.findIndex(r=>String((r||[])[13]||'').trim()===j.id);if(i<0)i=rows.findIndex(r=>!String((r||[])[13]||'').trim()&&!padRow(r).join('').trim());return (i<0?rows.length:i)+2}
async function jobToSheet(j){if(!MCP)throw {code:'off'};const rn=jobRowNo(j);const row=jobRow(j);
  const full=row.slice(0,13).concat([j.id,new Date().toLocaleString('en-GB')],row.slice(13));
  await sheetWrite(`JOBS!A${rn}:R${rn}`,[full]);
  if(jobsRaw){while(jobsRaw.length<rn-1)jobsRaw.push([]);jobsRaw[rn-2]=full}
  save('jobs',Object.assign({},get('jobs',j.id)||j,{sheetSnap:row,sheetAt:Date.now()}),true)}
const nextJobNo=paid=>{const pre=paid?'INV-':'JOB-';const mx=Math.max(0,...S.jobs.filter(j=>(j.paid!==false)===paid).map(j=>+String(j.no||'').replace(/\D/g,'')||0));return pre+String(mx+1).padStart(3,'0')};
const rm2=v=>{const n=parseFloat(String(v||'').replace(/[^0-9.]/g,''));return isNaN(n)?'':n.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})};
/* Tarikh paling dekat yang belum lepas: draf, posting, submission (atau deadline lama) */
const JDATES=[['draftDate','Draf'],['postDate','Posting'],['submitDate','Submission'],['deadline','Deadline']];
function jobNext(j){const td=ymd(new Date());const L=JDATES.filter(([k])=>j[k]).map(([k,l])=>({date:j[k],label:l})).sort((a,b)=>a.date.localeCompare(b.date));return L.find(x=>x.date>=td)||L[L.length-1]||null}
const jobYear=j=>String(j.draftDate||j.postDate||j.submitDate||j.deadline||ymd(new Date(j.created||Date.now()))).slice(0,4);
const rmTotal=arr=>arr.reduce((a,v)=>a+(parseFloat(String(v||'').replace(/[^0-9.]/g,''))||0),0);
const rmBig=n=>'RM '+n.toLocaleString('en-MY',{minimumFractionDigits:n%1?2:0,maximumFractionDigits:2});
function jobForm(j,paid){const nx=jobNext(j);const left=nx?daysTo(nx.date):null;const done=/siap|bayaran|invois/i.test(j.status||'');const col=done?'var(--ok)':left===null?'var(--muted)':left>7?'var(--ok)':left>=3?'var(--warn)':'var(--bad)';
    const f=(k,l,ph,type)=>`<label class="f"><span>${l}</span><input class="inp" ${type?`type="${type}"`:''} id="j${k}-${j.id}" data-col="jobs" data-id="${j.id}" data-f="${k}" value="${esc(j[k]||'')}" placeholder="${esc(ph||'')}"></label>`;
    const ta=(k,l,r)=>`<label class="f"><span>${l}</span><textarea class="inp" id="j${k}-${j.id}" data-col="jobs" data-id="${j.id}" data-f="${k}" rows="${r||3}">${esc(j[k]||'')}</textarea></label>`;
    return `<h2>${j.review?'Semak paid job':paid?'Edit paid job':'Edit job'}</h2><div>${j.review?`<p class="meta" style="color:var(--warn);margin:0 0 10px">Mac mini isi dari screenshot / nota. Semak setiap kotak, kemudian tekan Save.</p>`:''}
      <div class="row2">${f('no',paid?'No. invoice':'No. job')}${f('brand','Nama job / brand','Nama brand')}</div>
      <div class="row2">${paid?f('fee','Harga (RM)','500'):f('contact','Contact','Nama, email atau WhatsApp')}<label class="f"><span>Status</span><select class="inp" id="jstatus-${j.id}" data-col="jobs" data-id="${j.id}" data-f="status">${JOB_STATUS.filter(s=>paid||!/bayaran|invois/i.test(s)).map(s=>`<option ${(j.status||'Baru')===s?'selected':''}>${s}</option>`).join('')}</select></label></div>
      <div class="row3">${f('draftDate','Deadline draf','','date')}${f('postDate','Posting','','date')}${f('submitDate','Submission','','date')}</div>
      ${paid?f('contact','Contact','Nama, email atau WhatsApp'):''}
      ${ta('notes','Description job')}${ta('deliverables','Deliverables (satu baris satu)')}${ta('requirements','Requirements')}
      ${paid?`<p class="eyebrow" style="margin-top:6px">Details client (untuk invoice dan resit)</p>${f('clientName','Nama client / syarikat')}${ta('clientAddress','Alamat client',3)}${f('clientContact','Email / telefon client')}
       <div class="btns" style="margin-bottom:12px"><button class="btn sm" data-act="jobPdf" data-id="${j.id}" data-x="invoice">Invoice PDF</button><button class="btn sm" data-act="jobPdf" data-id="${j.id}" data-x="receipt">Resit PDF</button></div>`:''}
      <div class="btns" style="justify-content:space-between"><button class="btn sm bad" data-act="jobDel" data-id="${j.id}">${IC.trash}Delete</button><div class="btns"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid tab" data-act="jobSave" data-id="${j.id}">Save</button></div></div></div>`}
A.jobEdit=el=>{const j=get('jobs',el.dataset.id);if(j)modal(jobForm(j,j.paid!==false),TAB.jobs.c)};
A.jobAdd=()=>{ui.jadd={files:[],text:'',busy:false};jobAddModal()};
function jobAddModal(){const m=ui.jadd;
  modal(`<h2>Tambah dari screenshot</h2><p class="meta" style="margin-top:-4px">Screenshot chat Shopee / TikTok, WhatsApp, email atau brief. Mac mini baca dan tentukan sendiri ${tok(TOK.jobparse,'Claude baca screenshot')}: job berbayar masuk Paid, sample / kupon / barter masuk Non paid dan Shoot (dengan harga, tugasan dan deadline).</p>
   <button class="jdrop" type="button" data-act="jaPick"${m.busy?' disabled':''}>${IC.up}<span><b>${m.files.length?m.files.length+' gambar dipilih':'Pilih screenshot'}</b><span class="meta" style="display:block">Boleh pilih beberapa gambar sekali (sampai 6)</span></span></button>
   <label class="f"><span>Atau tampal teks chat / nota</span><textarea class="inp" id="jaT" rows="4" placeholder="Brief, harga, tarikh...">${esc(m.text)}</textarea></label>
   <div class="btns" style="justify-content:space-between"><button class="btn" data-act="jaManual">Isi sendiri</button><button class="btn solid tab" data-act="jaRead"${m.busy?' disabled':''}>${m.busy?'<i class="spin"></i>'+esc(m.busy):'Baca & isi'}</button></div>`,TAB.jobs.c)}
A.jaPick=()=>{ui.jadd.text=($('#jaT')||{}).value||'';pickFile('image/*',fs=>{ui.jadd.files=fs.slice(0,6);jobAddModal()},true)};
A.jaManual=()=>{closeModal();if(ui.prSeg==='sample'){smpForm({},{},'Sample baru');return}const j=save('jobs',{brand:'',paid:true,status:'Baru',no:nextJobNo(true)},true);modal(jobForm(j,true),TAB.jobs.c)};
A.jaRead=async()=>{const m=ui.jadd;m.text=($('#jaT')||{}).value||'';if(!m.files.length&&!m.text.trim()){toast('Pilih screenshot atau tampal teks dulu');return}
  if(m.files.length&&!ASSETS){toast('Upload tak tersedia di sini');return}const ids=[];
  try{for(let i=0;i<m.files.length;i++){m.busy='Upload '+(i+1)+'/'+m.files.length;jobAddModal();ids.push((await ASSETS.upload(m.files[i])).id)}
    m.busy='Mac mini baca...';jobAddModal();const x=await chatRead(ids,m.text);closeModal();chatApply(x)}
  catch(e){m.busy=false;jobAddModal();toast('Tak dapat baca: '+String((e&&(e.message||e.code))||'semak Mac mini hidup').slice(0,80))}
  finally{ids.forEach(x=>ASSETS.delete(x).catch(()=>{}))}};
async function chatRead(ids,text){const r=await studioJob('jobparse',{files:ids,text:String(text||'').slice(0,8000),today:ymd(new Date())},6*60000);return r.job||{}}
/* Hasil bacaan: paid -> kad job kuning (semak); sample -> kad To Shoot (masuk Projects, Non paid, Calendar sendiri) */
function chatApply(x){const lines2=v=>Array.isArray(v)?v.join('\n'):String(v||'');
  const empty=!String(x.product||x.brand||'').trim()&&!String(x.fee||x.price||'').trim();
  if(empty){toast('Tak jumpa maklumat job atau sample dalam gambar. Pastikan screenshot chat yang betul, atau isi sendiri');
    if(ui.prSeg==='sample'||x.kind==='sample')smpForm({},{},'Sample baru (isi sendiri)');else A.jaManual();return null}
  if(x.kind==='sample'){const it=chatSample(x);go('links');render(true);smpForm(it,null,'Semak sample');toast('Dibaca. Semak dan tekan Simpan');return it}
  const j=save('jobs',{paid:true,status:'Baru',no:nextJobNo(true),review:true,brand:x.brand||x.product||'',fee:x.fee||'',draftDate:toYmd(x.draftDate),postDate:toYmd(x.postDate),submitDate:toYmd(x.submitDate),
    notes:x.description||'',deliverables:lines2(x.deliverables),requirements:lines2(x.requirements||x.tasks),contact:x.contact||'',clientName:x.clientName||''},true);
  go('links');render(true);modal(jobForm(j,true),TAB.jobs.c);toast('Paid job diisi. Semak dan tekan Save');return j}
function chatSample(x){const today=ymd(new Date());const title=String(x.product||x.brand||'Sample').trim();const days=+x.daysAfterReceive||0;
  const postBy=toYmd(x.postDate)||toYmd(x.submitDate)||ymdAdd(today,days||7);const plat=['shopee','tiktok','whatsapp'].includes(x.plat)?x.plat:'shopee';
  const tasks=(Array.isArray(x.tasks)?x.tasks.join('\n'):String(x.tasks||x.deliverables||'')).trim();
  const ex=S.items.find(it=>it.sample&&!sampleDone(it)&&(nrm(it.title)===nrm(title)||itMatch(it,title)));const sv=sheetView();
  const sample=Object.assign({plat,postBy,start:today,done:false,received:false,sheetRowAtAdd:sv?Math.max(0,...sv.groups.map(g=>g.start)):0},ex?ex.sample:{},
    {price:rmNum(x.price)||(ex&&ex.sample.price)||'',tasks,afterRecv:days,store:x.store||x.contact||'',note:x.description||''});
  if(!ex||!ex.sample.received)sample.postBy=postBy;
  return save('items',Object.assign({},ex||{title,stage:'toshoot',stageAt:{toshoot:Date.now()},noteAt:Date.now(),src:'sample'},{brand:(ex&&ex.brand)||x.brand||'',sample}),true)}
A.jobSave=async el=>{const j=jobCollect(el.dataset.id);delete j.review;save('jobs',j,true);closeModal();render(true);
  try{await jobToSheet(j);toast('Disimpan. Sheet JOBS dikemas kini')}catch(e){toast('Disimpan dalam app. Sheet tak dapat dikemas kini')}};
A.jobDel=el=>{const j=get('jobs',el.dataset.id);confirmBox('Delete job "'+(j.brand||j.no||'baru')+'"?',()=>{const rn=jobsRaw&&jobsRaw.some(r=>String((r||[])[13]||'').trim()===j.id)?jobRowNo(j):0;del('jobs',j.id);
    if(rn&&MCP)sheetWrite(`JOBS!A${rn}:R${rn}`,[Array(18).fill('')]).catch(()=>{});toast('Dipadam')},'Ya, delete')};
A.jobPdf=async el=>{const j=jobCollect(el.dataset.id);save('jobs',j,true);const kind=el.dataset.x;const me=((S.settings||{}).me)||{};toast('Sedang sediakan PDF');
  try{await loadScript(JSPDF);const doc=new jspdf.jsPDF({unit:'pt',format:'a4'});const W=595,M=56;let y=84;const rose=[154,79,93],ink=[46,39,35],mut=[95,84,77];
    const T=(t,x,yy,o)=>{o=o||{};doc.setFont('helvetica',o.b?'bold':'normal');doc.setFontSize(o.s||10);doc.setTextColor.apply(doc,o.c||ink);doc.text(String(t),x,yy,{align:o.a||'left',charSpace:o.cs||0})};
    const para=(t,x,yy,w,o)=>{o=o||{};doc.setFont('helvetica',o.b?'bold':'normal');doc.setFontSize(o.s||10);doc.setTextColor.apply(doc,o.c||ink);const ls=doc.splitTextToSize(String(t),w);doc.text(ls,x,yy);return yy+ls.length*(o.lh||14)};
    const no=kind==='receipt'?String(j.no||'').replace(/^INV/i,'RCP'):String(j.no||'');const amt=rm2(j.fee)||'0.00';
    T(kind==='receipt'?'OFFICIAL RECEIPT':'INVOICE',M,y,{s:22,cs:5});T(no,W-M,y,{s:13,a:'right',c:rose,b:1});y+=20;
    T('MIRA CIKCIT  |  MOM  |  CONTENT CREATOR',M,y,{s:8,cs:2,c:rose});T(fmtD(Date.now()),W-M,y,{s:9,a:'right',c:mut});y+=16;doc.setDrawColor(214,196,182);doc.setLineWidth(1);doc.line(M,y,W-M,y);y+=30;
    const blk=(title,arr,x)=>{let yy=y;T(title,x,yy,{s:8,cs:2,c:rose});yy+=16;arr.filter(Boolean).forEach(l=>{yy=para(l,x,yy,220)});return yy};
    const y1=blk('DARIPADA',[me.name||'Mira Cikcit'].concat(lines(me.address),[me.contact]),M);const y2=blk(kind==='receipt'?'DITERIMA DARIPADA':'KEPADA',[j.clientName||j.brand].concat(lines(j.clientAddress),[j.clientContact]),W/2+10);y=Math.max(y1,y2)+26;
    doc.setFillColor(239,231,224);doc.rect(M,y,W-2*M,26,'F');T('BUTIRAN',M+12,y+17,{s:8,cs:2});T('JUMLAH (RM)',W-M-12,y+17,{s:8,cs:2,a:'right'});y+=46;
    const items=lines(j.deliverables);(items.length?items:['Content creation untuk '+(j.brand||'client')]).forEach((l,i)=>{if(i===0)T(amt,W-M-12,y,{a:'right'});y=para(l,M+12,y,360)+6});
    y+=8;doc.line(M,y,W-M,y);y+=24;T(kind==='receipt'?'JUMLAH DITERIMA':'JUMLAH PERLU DIBAYAR',M+12,y,{s:9,cs:2});T('RM '+amt,W-M-12,y,{s:15,a:'right',b:1,c:rose});y+=40;
    if(kind==='receipt'){T('STATUS',M,y,{s:8,cs:2,c:rose});y+=16;y=para('Bayaran penuh telah diterima. Terima kasih.',M,y,W-2*M)}
    else{T('BUTIRAN BAYARAN',M,y,{s:8,cs:2,c:rose});y+=16;y=para(me.payment||'Sila isi butiran bayaran dalam Kit, Invoice / Receipt.',M,y,W-2*M);if(j.deadline){y+=6;y=para('Deadline kerja: '+fmtD(j.deadline),M,y,W-2*M,{c:mut,s:9})}}
    T('Terima kasih kerana bekerjasama.',W/2,780,{a:'center',s:9,c:mut});T('www.miracikcit.com',W/2,796,{a:'center',s:8,cs:2,c:rose});
    await kitDl((kind==='receipt'?'Resit_':'Invoice_')+no+'_'+String(j.brand||'client').replace(/[^A-Za-z0-9]+/g,'')+'.pdf',doc.output('blob'));
    save('invoices',{id:kind+'-'+nrm(no)+'-'+j.id,no,kind,jobId:j.id,brand:j.brand||'',amount:amt,date:ymd(new Date())},true)}
  catch(e){toast('Tak dapat buat PDF')}};

