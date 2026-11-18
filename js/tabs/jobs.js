/* ---------- JOBS ---------- */
const JOBS_RANGE='JOBS!A2:O300',JSPDF='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';let jobsRaw=null;const jobsPending={};
const padRow=r=>{const a=(r||[]).slice(0,13).map(x=>String(x??''));while(a.length<13)a.push('');return a};
const jobRow=j=>[j.no,j.brand,j.paid===false?'NON PAID':'PAID',j.status||'Baru',j.deadline,j.fee,j.contact,j.deliverables,j.requirements,j.notes,j.clientName,j.clientAddress,j.clientContact].map(x=>String(x??''));
const toYmd=s=>{s=String(s||'').trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);if(m)return m[3]+'-'+pad(+m[2])+'-'+pad(+m[1]);const d=new Date(s);return s&&!isNaN(d)?ymd(d):''};
const rowToJob=f=>({no:f[0],brand:f[1],paid:!/non/i.test(f[2]),status:f[3]||'Baru',deadline:toYmd(f[4]),fee:f[5],contact:f[6],deliverables:f[7],requirements:f[8],notes:f[9],clientName:f[10],clientAddress:f[11],clientContact:f[12]});
function jobsFromSheet(){if(mode!=='live'||!jobsRaw||!MCP)return;let ch=0;
  jobsRaw.forEach((r,i)=>{const f=padRow(r);const id=String((r||[])[13]||'').trim();const rn=i+2;
    if(id){const j=get('jobs',id);if(!j||!j.sheetSnap||Date.now()-(j.sheetAt||0)<90000)return;
      if(JSON.stringify(f)!==JSON.stringify(j.sheetSnap)){save('jobs',Object.assign({},j,rowToJob(f),{sheetSnap:f}),true);ch++}}
    else if(f[1].trim()&&!jobsPending[rn]){jobsPending[rn]=1;const j=save('jobs',Object.assign(rowToJob(f),{sheetSnap:f,sheetAt:Date.now()}),true);sheetWrite(`JOBS!N${rn}`,[[j.id]]).catch(()=>{});ch++}});
  if(ch)render()}
function jobRowNo(j){const rows=jobsRaw||[];let i=rows.findIndex(r=>String((r||[])[13]||'').trim()===j.id);if(i<0)i=rows.findIndex(r=>!String((r||[])[13]||'').trim()&&!padRow(r).join('').trim());return (i<0?rows.length:i)+2}
async function jobToSheet(j){if(!MCP)throw {code:'off'};const rn=jobRowNo(j);const row=jobRow(j);
  await sheetWrite(`JOBS!A${rn}:O${rn}`,[row.concat([j.id,new Date().toLocaleString('en-GB')])]);
  if(jobsRaw){while(jobsRaw.length<rn-1)jobsRaw.push([]);jobsRaw[rn-2]=row.concat([j.id])}
  save('jobs',Object.assign({},get('jobs',j.id)||j,{sheetSnap:row,sheetAt:Date.now()}),true)}
const nextJobNo=paid=>{const pre=paid?'INV-':'JOB-';const mx=Math.max(0,...S.jobs.filter(j=>(j.paid!==false)===paid).map(j=>+String(j.no||'').replace(/\D/g,'')||0));return pre+String(mx+1).padStart(3,'0')};
const rm2=v=>{const n=parseFloat(String(v||'').replace(/[^0-9.]/g,''));return isNaN(n)?'':n.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2})};
V.jobs=()=>{const paid=ui.jobTab!=='non';const all=S.jobs.filter(j=>(j.paid!==false)===paid);
  const list=all.filter(j=>hit('job',j.no,j.brand,j.status,j.contact,j.clientName)).sort((a,b)=>String(b.no||'').localeCompare(String(a.no||''),undefined,{numeric:true}));
  return head('Paid review dan collab',`<button class="btn solid tab" data-act="jobAdd">${IC.plus}Tambah job</button>`)+
  `<div class="seg" style="margin-bottom:14px"><button type="button" class="${paid?'on':''}" data-act="jobTab" data-x="paid">Paid · ${S.jobs.filter(j=>j.paid!==false).length}</button><button type="button" class="${!paid?'on':''}" data-act="jobTab" data-x="non">Non paid · ${S.jobs.filter(j=>j.paid===false).length}</button></div>`+searchBox('job','Cari nombor, brand atau status')+
  `<div class="list">${list.map(j=>{const left=j.deadline?Math.ceil((new Date(j.deadline+'T00:00:00')-Date.now())/DAY):null;const done=/siap|bayaran/i.test(j.status||'');const col=done?'var(--ok)':left===null?'var(--muted)':left>7?'var(--ok)':left>=3?'var(--warn)':'var(--bad)';
    const f=(k,l,ph,type)=>`<label class="f"><span>${l}</span><input class="inp" ${type?`type="${type}"`:''} id="j${k}-${j.id}" data-col="jobs" data-id="${j.id}" data-f="${k}" value="${esc(j[k]||'')}" placeholder="${esc(ph||'')}"></label>`;
    const ta=(k,l,r)=>`<label class="f"><span>${l}</span><textarea class="inp" id="j${k}-${j.id}" data-col="jobs" data-id="${j.id}" data-f="${k}" rows="${r||3}">${esc(j[k]||'')}</textarea></label>`;
    return `<details class="col card glass"${ui.openJob===j.id?' open':''} data-job="${j.id}"><summary><div class="rowh" style="align-items:center"><span class="jleft"><b>${esc(j.no||'·')}</b>${paid?`<i>RM ${esc(rm2(j.fee)||'0.00')}</i>`:''}</span><div><h3>${esc(j.brand||'Job baru')}</h3><div class="meta">${esc(j.status||'Baru')}${j.deadline?' · deadline '+fmtD(j.deadline):''}</div></div>${left!==null&&!done?`<span class="pill" style="--pc:${col}">${left>=0?left+' hari':'lewat '+(-left)}</span>`:''}<span class="ic chev">${IC.chev}</span></div></summary>
     <div style="margin-top:14px">
      <div class="row2">${f('no',paid?'No. invoice':'No. job')}${f('brand','Brand','Nama brand')}</div>
      <div class="row2">${f('contact','Contact','Nama, email atau WhatsApp')}${paid?f('fee','Fee (RM)','500'):f('deadline','Deadline','','date')}</div>
      <div class="row2">${paid?f('deadline','Deadline','','date'):''}<label class="f"><span>Status</span><select class="inp" id="jstatus-${j.id}" data-col="jobs" data-id="${j.id}" data-f="status">${JOB_STATUS.filter(s=>paid||!/bayaran/i.test(s)).map(s=>`<option ${(j.status||'Baru')===s?'selected':''}>${s}</option>`).join('')}</select></label></div>
      ${ta('deliverables','Deliverables (satu baris satu)')}${ta('requirements','Requirements')}${ta('notes','Nota')}
      ${paid?`<p class="eyebrow" style="margin-top:6px">Details client (untuk invoice dan resit)</p>${f('clientName','Nama client / syarikat')}${ta('clientAddress','Alamat client',3)}${f('clientContact','Email / telefon client')}
       <div class="btns" style="margin-bottom:12px"><button class="btn sm" data-act="jobPdf" data-id="${j.id}" data-x="invoice">Invoice PDF</button><button class="btn sm" data-act="jobPdf" data-id="${j.id}" data-x="receipt">Resit PDF</button></div>`:''}
      <div class="btns" style="justify-content:space-between"><button class="btn sm bad" data-act="jobDel" data-id="${j.id}">${IC.trash}Delete</button><button class="btn solid tab" data-act="jobSave" data-id="${j.id}">Save</button></div></div></details>`}).join('')||`<div class="empty">${all.length?'Tiada padanan.':'Belum ada job di sini. Tekan Tambah job.'}</div>`}</div>
  <p class="meta" style="margin-top:16px">Save simpan job dan kemas kini tab JOBS dalam sheet CONTENT 2026. Perubahan yang kau buat dalam sheet masuk semula ke sini.</p>`};
AFTER.jobs=()=>document.querySelectorAll('details[data-job]').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)ui.openJob=d.dataset.job;else if(ui.openJob===d.dataset.job)ui.openJob=null}));
A.jobTab=el=>{ui.jobTab=el.dataset.x;render(true)};
A.jobAdd=()=>{const paid=ui.jobTab!=='non';const j=save('jobs',{brand:'',paid,status:'Baru',no:nextJobNo(paid)},true);ui.openJob=j.id;render(true)};
function jobCollect(id){const j=Object.assign({},get('jobs',id));document.querySelectorAll(`[data-col="jobs"][data-id="${id}"]`).forEach(el=>{j[el.dataset.f]=el.value.trim()});if(!j.no)j.no=nextJobNo(j.paid!==false);return j}
A.jobSave=async el=>{const j=jobCollect(el.dataset.id);save('jobs',j,true);render(true);
  try{await jobToSheet(j);toast('Disimpan. Sheet JOBS dikemas kini')}catch(e){toast('Disimpan dalam app. Sheet tak dapat dikemas kini')}};
A.jobDel=el=>{const j=get('jobs',el.dataset.id);confirmBox('Delete job "'+(j.brand||j.no||'baru')+'"?',()=>{const rn=jobsRaw&&jobsRaw.some(r=>String((r||[])[13]||'').trim()===j.id)?jobRowNo(j):0;del('jobs',j.id);
    if(rn&&MCP)sheetWrite(`JOBS!A${rn}:O${rn}`,[Array(15).fill('')]).catch(()=>{});toast('Dipadam')},'Ya, delete')};
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

