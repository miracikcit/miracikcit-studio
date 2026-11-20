/* ---------- events ---------- */
document.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el||el.disabled)return;const f=A[el.dataset.act];if(f){if(el.tagName==='A'||el.closest('summary'))e.preventDefault();f(el)}});
document.addEventListener('change',e=>{const el=e.target;
  if(el.classList&&el.classList.contains('acc'))el.style.setProperty('--ac',ACC_COL[el.value]||'transparent');
  if(el.dataset&&el.dataset.sacc){const p=el.dataset.sacc.split('|');sheetAcc(p[0],+p[1],+p[2],el.value);return}
  if(el.dataset&&el.dataset.col){const o=get(el.dataset.col,el.dataset.id);if(!o)return;let v=el.value;if(el.dataset.url&&v.trim()&&!isUrl(v)){toast('Link mesti mula dengan https://');return}
    save(el.dataset.col,Object.assign({},o,{[el.dataset.f]:typeof v==='string'?v.trim():v}),el.tagName!=='SELECT'&&el.type!=='date');if(el.dataset.url)setTimeout(()=>render(true),0)}
  else if(el.dataset&&el.dataset.smpprice!==undefined)smpPriceSave(el.dataset.smpprice,el.value)});
document.addEventListener('input',e=>{const el=e.target;if(!el.dataset)return;
  if(el.dataset.draft)ui.draft[el.dataset.draft]=el.value;
  else if(el.dataset.trlink)ui.trLink=el.value;
  else if(el.dataset.q){const k=el.dataset.q;ui.q[k]=el.value;clearTimeout(el._t);el._t=setTimeout(()=>{render(true);const n=$('#q-'+k);if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length)}},350)}});

