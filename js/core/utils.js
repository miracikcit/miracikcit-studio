/* ---------- utils ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const BULAN=['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis'];
const HARI=['Ahad','Isnin','Selasa','Rabu','Khamis','Jumaat','Sabtu'];
const fmtD=t=>{if(!t)return '';const d=typeof t==='string'?new Date(t+'T00:00:00'):new Date(t);return isNaN(d)?'':d.getDate()+' '+BULAN[d.getMonth()]+' '+d.getFullYear()};
const noEmoji=s=>String(s||'').replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}\u{20E3}]/gu,'').replace(/[ \t]+\n/g,'\n').replace(/[ \t]{2,}/g,' ').replace(/ +([,.!?])/g,'$1').trim();
const nrm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const lines=t=>String(t||'').split('\n').map(x=>x.trim()).filter(Boolean);
const clean=o=>JSON.parse(JSON.stringify(o));
const blobUrl=id=>window.studioFileUrl(id);
const isUrl=u=>/^https?:\/\//i.test(String(u||'').trim());
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),2400)}
async function copyText(txt,msg){
  try{await navigator.clipboard.writeText(txt);toast(msg||'Dicopy')}
  catch(e){const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');toast(msg||'Dicopy')}catch(_){toast('Tak dapat copy. Pilih teks dan copy sendiri')}ta.remove()}
}
function pickFile(accept,cb,multi){const i=$('#filePick');i.accept=accept;i.multiple=!!multi;i.value='';i.onchange=()=>{if(i.files.length)cb(multi?[...i.files]:i.files[0])};i.click()}
function loadScript(src){return new Promise((res,rej)=>{if(document.querySelector(`script[src="${src}"]`))return res();const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('load'));document.head.appendChild(s)})}
const chk=(on,act,id,label,x)=>`<button class="chk" type="button" aria-pressed="${on?'true':'false'}" data-act="${act}" data-id="${esc(id)}"${x?` data-x="${esc(x)}"`:''}><i>${IC.check}</i>${label}</button>`;
/* countdown: start ms, limit days -> {left, pct, color, label} */
function deadline(start,days){if(!start)return null;const left=Math.ceil((start+days*DAY-Date.now())/DAY);const pct=Math.max(4,Math.min(100,Math.round((Date.now()-start)/(days*DAY)*100)));
  const lim=days>=14?[7,3]:[3,1];const color=left>lim[0]?'var(--ok)':left>=lim[1]?'var(--warn)':'var(--bad)';
  return {left,pct,color,label:left>0?left+' hari lagi':left===0?'Hari terakhir':'Lewat '+(-left)+' hari'}}
const trk=(d,title)=>d?`<div class="trk" style="--sc:${d.color}"><div class="t"><span>${title}</span><span>${d.label}</span></div><div class="bar"><i style="width:${d.pct}%"></i></div></div>`:`<div class="trk"><div class="t"><span>${title}</span><span>Tarikh mula tiada</span></div><div class="bar"><i style="width:0"></i></div></div>`;

/* Penanda token (2026-11-23): bulatan kecil gaya loader, isi ikut anggaran token Claude yang butang tu guna. 0 = percuma. */
const TOK={idea:3000,caption:4000,jobparse:8000,nota:30000,gaya:12000,autolabel:3000,edit:250000,edsend:150000,threads:6000,thstyle:7000};
function tok(n,note){if(!n)return `<span class="tokn free" title="Tiada token Claude"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/></svg>0 token</span>`;
  const f=Math.max(.08,Math.min(1,Math.log10(n)/Math.log10(500000))),c=2*Math.PI*6,col=n<10000?'var(--ok)':n<100000?'var(--warn)':'var(--bad)';
  const t=n>=1000?'~'+Math.round(n/1000)+'k':'~'+n;
  return `<span class="tokn" style="--tc:${col}" title="Anggaran token Claude${note?': '+esc(note):''}"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/><circle class="a" cx="8" cy="8" r="6" stroke-dasharray="${(f*c).toFixed(1)} ${c.toFixed(1)}"/></svg>${t} token</span>`}
/* Loader dengan %: pill kecil berputar, % bila diketahui */
function ldr(txt,pct){return `<span class="pill" style="--pc:var(--c)"><i class="spin"></i>${esc(txt)}${pct!=null&&isFinite(pct)?' '+Math.max(0,Math.min(100,Math.round(pct)))+'%':''}</span>`}
