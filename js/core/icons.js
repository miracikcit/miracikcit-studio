/* ---------- tabs, colours, icons ---------- */
const P=d=>`<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const IC={
 home:P('<path d="M4 11l8-6.5 8 6.5"/><path d="M6 10v9h12v-9"/>'),
 ideas:P('<path d="M9 17h6"/><path d="M10 20h4"/><path d="M12 3.5a6 6 0 0 0-3.6 10.8c.6.5.9 1.1.9 1.7h5.4c0-.6.3-1.2.9-1.7A6 6 0 0 0 12 3.5z"/>'),
 toshoot:P('<rect x="3" y="7" width="18" height="12" rx="3"/><path d="M8.5 7l1.2-2.5h4.6L15.5 7"/><circle cx="12" cy="13" r="3.2"/>'),
 shot:P('<circle cx="12" cy="12" r="8.5"/><path d="M8 12.2l2.8 2.8L16 9.5"/>'),
 toedit:P('<circle cx="6.5" cy="7" r="2.5"/><circle cx="6.5" cy="17" r="2.5"/><path d="M8.6 8.4L20 17"/><path d="M8.6 15.6L20 7"/>'),
 ready:P('<path d="M4 20l16-8L4 4l2.5 8L4 20z"/><path d="M6.5 12H13"/>'),
 published:P('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10.5 9.5v5l4-2.5-4-2.5z"/>'),
 links:P('<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>'),
 jobs:P('<rect x="3" y="7.5" width="18" height="12" rx="3"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5"/><path d="M3 13h18"/>'),
 editor:P('<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M3 9h18"/><path d="M8 4.5V9M16 4.5V9"/><path d="M8 14h8"/>'),
 footage:P('<ellipse cx="12" cy="6.5" rx="7.5" ry="3"/><path d="M4.5 6.5v11c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-11"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>'),
 inspiration:P('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>'),
 transcribe:P('<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>'),
 mediakit:P('<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20V3.5z"/><path d="M14 3.5v4h4"/><path d="M10 12h5M10 15.5h5"/>'),
 plus:P('<path d="M12 5v14M5 12h14"/>'),trash:P('<path d="M5 7h14"/><path d="M9 7V5h6v2"/><path d="M7 7l1 13h8l1-13"/>'),copy:P('<rect x="8" y="8" width="11" height="12" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/>'),
 check:P('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),chev:P('<path d="M6 9l6 6 6-6"/>'),mic:P('<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><path d="M12 18v2.5"/>'),
 up:P('<path d="M12 16V5"/><path d="M7.5 9.5L12 5l4.5 4.5"/><path d="M5 19.5h14"/>'),search:P('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>'),back:P('<path d="M15 6l-6 6 6 6"/>'),next:P('<path d="M9 6l6 6-6 6"/>'),
 broll:P('<rect x="6" y="3.5" width="12" height="17" rx="3"/><path d="M10.5 9.5v5l4-2.5-4-2.5z"/><path d="M3 9l-1.5 3L3 15M21 9l1.5 3L21 15"/>'),
 edit:P('<path d="M4 20l1-4L16.5 4.5l3 3L8 19l-4 1z"/>'),caption:P('<path d="M5 6h14M5 10h14M5 14h8"/><path d="M14.5 17.5l2 2 4-4"/>'),dl:P('<path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>'),ext:P('<path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4"/><path d="M14 4h6v6"/><path d="M20 4l-8.5 8.5"/>'),x:P('<path d="M6 6l12 12M18 6L6 18"/>')
};
const TABS_=[
 ['home','Home','#9A4F5D'],['ideas','Ideas','#C29A3C'],['links','Products','#5A8FB5'],['to-shoot','To Shoot','#CF8A55'],['shot','Shot','#C2666A'],['to-edit','To Edit','#8676BE'],
 ['ready','Ready to Publish','#8A6A52'],['published','Published','#6B5548'],['caption','Caption','#B0704F'],['jobs','Jobs','#A8763E'],
 ['editor','Editor','#9C6396'],['footage','Footage','#9A8C7A'],['broll','B-Roll Picker','#B0704F'],['inspiration','Inspiration','#CF7A9A'],['transcribe','Transcribe','#8C6A4F'],['media-kit','Media Kit','#B0937B']
].map(([k,l,c])=>({k,l,c,ic:IC[k.replace('-','')]}));
const TAB=Object.fromEntries(TABS_.map(t=>[t.k,t]));
const STAGE_TAB={ideas:'ideas',toshoot:'to-shoot',shot:'shot',toedit:'to-edit',ready:'ready',published:'published'};
const FCOL={21:'#9A4F5D',22:'#5A8FB5',23:'#A8763E',24:'#CF8A55',25:'#8676BE',26:'#6B5548',27:'#CF7A9A',28:'#9C6396',31:'#9A8C7A',32:'#3F6FB5',41:'#8C8179',42:'#7A6558'};
const FOLDERS=['21. EDIT SHOP','22. EDIT VLOG','23. EDIT HOTEL VLOG','24. EDIT COOK','25. EDIT TALK','26. EDIT UNBOXING FACELESS','27. EDIT SIMPLE VIRAL','28. EDIT + VO','31. ENHANCE SHOP','32. ENHANCE VLOG','41. TUNGGU VO','42. EDITED TO SPLIT'];
const ACCOUNTS=['miracikcit','miracikcitjuga','bondamiracikcit'];
const ACC_COL={miracikcit:'#9A4F5D',miracikcitjuga:'#5A7FA8',bondamiracikcit:'#B98A2E'};
const accSel=(attrs,val,ph)=>`<select class="inp acc" style="--ac:${ACC_COL[val]||'transparent'}" ${attrs}><option value="">${ph||'Pilih akaun'}</option>${ACCOUNTS.concat(val&&!ACCOUNTS.includes(val)?[val]:[]).map(a=>`<option ${val===a?'selected':''}>${esc(a)}</option>`).join('')}</select>`;
const accPill=a=>a?`<span class="pill" style="--pc:${ACC_COL[a]||'#999'}">${esc(a)}</span>`:'';
const JOB_STATUS=['Baru','Dalam proses','Draf dihantar','Siap post','Bayaran diterima'];
const FTAGS=['b-roll','unboxing','before/after','produk','tangan','transformation','talking head'];
const DAY=864e5;

