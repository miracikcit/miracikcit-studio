/* ---------- shell ---------- */
function go(v){location.hash=v}
function route(){let h=location.hash.slice(1);if(h==='gaya')h='editor';if(h==='lab')h='media-kit';if(h==='inspire')h='inspiration';if(h==='products')h='links';if(h==='b-roll')h='broll';ui.view=TAB[h]?h:'home';render(true);window.scrollTo(0,0)}
window.addEventListener('hashchange',route);
function render(force){
  const ae=document.activeElement;
  if(!force&&ae&&ae.closest&&ae.closest('#main')&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)&&ae.type!=='checkbox'){renderPending=true;return}
  renderPending=false;const t=TAB[ui.view];
  $('#nav').innerHTML=TABS_.map(v=>`<a href="#${v.k}" class="${ui.view===v.k?'on':''}" style="--c:${v.c}"${ui.view===v.k?' aria-current="page"':''}>${v.ic}<span>${v.l.replace('Ready to Publish','Ready')}</span></a>`).join('');
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

