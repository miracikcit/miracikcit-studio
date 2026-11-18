/* ---------- TO SHOOT ---------- */
V['to-shoot']=()=>{const list=byStage('toshoot').sort((a,b)=>String(a.shootDate||'9').localeCompare(String(b.shootDate||'9')));
  return head('Nota untuk prepare shoot')+`<div class="list">${list.map(it=>{const left=it.shootDate?Math.ceil((new Date(it.shootDate+'T00:00:00')-Date.now())/DAY):null;const col=left===null?'var(--muted)':left>7?'var(--ok)':left>=0?'var(--warn)':'var(--bad)';
    return `<div class="card glass"><div class="rowh"><div><h3>${esc(it.title||'Nota')}</h3><div class="meta">${esc([it.brand,it.noteAt?'nota '+fmtD(it.noteAt):''].filter(Boolean).join(' · '))}</div></div>
     ${left!==null?`<span class="pill" style="--pc:${col}">${left>0?left+' hari lagi':left===0?'Hari ni':'Lewat '+(-left)+' hari'}</span>`:''}</div>
    <div class="row2" style="margin-top:12px"><label class="f"><span>Anggaran tarikh shoot</span><input type="date" class="inp" id="sd-${it.id}" data-col="items" data-id="${it.id}" data-f="shootDate" value="${esc(it.shootDate||'')}"></label>
     <label class="f"><span>Akaun nak post</span>${accSel(`id="ac-${it.id}" data-col="items" data-id="${it.id}" data-f="account"`,it.account||'')}</label></div>
    <div class="btns"><button class="btn sm" data-act="nota" data-id="${it.id}">Nota</button><button class="btn sm solid tab" data-act="toShot" data-id="${it.id}">${IC.check}Dah shoot</button><button class="btn icon sm bad" data-act="delItem" data-id="${it.id}" aria-label="Padam">${IC.trash}</button></div></div>`}).join('')||`<div class="empty">Tiada nota menunggu. Generate nota dari tab Ideas.</div>`}</div>`};
A.toShot=el=>moveItem(get('items',el.dataset.id),'shot',{shotAt:ymd(new Date())});

