/* ---------- shell ---------- */
function go(v){location.hash=v}
const EDAPP='https://miracikcit.github.io/miracikcit-studio/editor/?app=1';   /* 27 Nov, Mira: butang Editor bawa ke APP EDITOR sendiri (luar Studio), bukan tab Studio */
/* 27 Nov malam (Mira, WAJIB, "JANGAN BAGI ULANG"): SEMUA butang Editor dalam Studio guna data-act="edGo", JANGAN href terus ke editor/.
   Punca dulu terbuka DALAM Studio: manifest Studio scope "./" termasuk editor/, jadi di iPhone link ke editor/ dari app Studio
   kekal dalam Studio (target _blank diabaikan). iOS tak benarkan satu app Home Screen buka app Home Screen lain. Jadi dalam app
   Studio (standalone): helaian "tekan ikon Editor di Home Screen" + Copy link. Dalam browser biasa: tab baru. */
const edStandalone=()=>!!(navigator.standalone||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches));

function route(){let h=location.hash.slice(1);if(h==='gaya'||h==='resipi')h='inspiration';if(h==='lab')h='media-kit';if(h==='inspire')h='inspiration';if(h==='products')h='links';if(h==='b-roll'||h==='broll')h='footage';if(h==='jobs')h='links';ui.view=TAB[h]?h:'home';render(true);window.scrollTo(0,0)}
window.addEventListener('hashchange',route);
function render(force){
  const ae=document.activeElement;
  if(!force&&ae&&ae.closest&&ae.closest('#main')&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)&&ae.type!=='checkbox'){renderPending=true;return}
  renderPending=false;const t=TAB[ui.view];
  const nv=NAV.includes(ui.view)?ui.view:ui.view==='shot'?'to-edit':'lagi';
  $('#nav').innerHTML=NAV.map(k=>TAB[k]).map(v=>`<a href="${v.k==='editor'?EDAPP:'#'+v.k}"${v.k==='editor'?' data-act="edGo"':''} class="${nv===v.k?'on':''}" style="--c:${v.c}"${nv===v.k?' aria-current="page"':''}>${v.ic}<span>${navLabel(v.l)}</span></a>`).join('');
  const on=$('#nav a.on');if(on&&force)on.scrollIntoView({inline:'center',block:'nearest'});
  const d=new Date();$('#today').textContent=HARI[d.getDay()]+', '+d.getDate()+' '+BULAN[d.getMonth()];
  const m=$('#main');m.style.setProperty('--c',t.c);
  m.innerHTML=banner()+V[ui.view]();
  AFTER[ui.view]&&AFTER[ui.view]()}
function banner(){
  if(mode==='local')return `<div class="banner glass">Disimpan pada peranti ni sahaja buat masa ni. Semak internet supaya data sync.</div>`;
  if(mode==='slow')return `<div class="banner glass">Masih menyambung. Perubahan terbaru mungkin belum nampak.</div>`;
  if(mode==='error')return `<div class="banner glass">Tak dapat capai data tersimpan. Perubahan sekarang mungkin tak disimpan.</div>`;
  return ''}
$('#main').addEventListener('focusout',()=>{if(renderPending)setTimeout(()=>{const ae=document.activeElement;if(renderPending&&!(ae&&ae.closest&&ae.closest('#main')&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)))render()},250)});
const head=(sub,right)=>{const t=TAB[ui.view];return `<div class="head"><div><p class="eyebrow">${esc(sub||'')}</p><h1>${t.l}</h1></div><div class="btns">${right||''}</div></div>`};
const searchBox=(k,ph)=>`<div class="search">${IC.search}<input class="inp" id="q-${k}" data-q="${k}" value="${esc(ui.q[k]||'')}" placeholder="${esc(ph)}" autocomplete="off"></div>`;
const hit=(k,...s)=>{const q=(ui.q[k]||'').trim().toLowerCase();return !q||s.join(' ').toLowerCase().includes(q)};
const V={},AFTER={},A={};
/* butang Editor (lihat nota EDAPP di atas). Mesti selepas `const A` */
A.edGo=el=>{const u=(el&&el.dataset.u)||EDAPP;if(!edStandalone()){window.open(u,'_blank','noopener');return}
  modal(`<h2>Buka app Editor</h2><p class="meta" style="margin:0 0 4px">iPhone tak benarkan Studio buka app lain. Tekan ikon <b>Editor</b> (hijau) di Home Screen. Semua video kau ada di situ.</p>
    <div class="btns" style="justify-content:space-between;margin-top:14px"><button class="btn" data-act="edCopy">${IC.copy}Copy link</button><button class="btn solid tab" data-act="closeModal">Okay</button></div>`,TAB.editor.c)};
A.edCopy=()=>copyText(EDAPP,'Link app Editor dicopy');
