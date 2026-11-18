/* ---------- modal ---------- */
function modal(html,color){const m=$('#modal');m.style.setProperty('--c',color||TAB[ui.view].c);m.innerHTML=html;$('#scrim').hidden=false;m.scrollTop=0}
function closeModal(){$('#scrim').hidden=true;$('#modal').innerHTML=''}
$('#scrim').addEventListener('click',e=>{if(e.target.id==='scrim')closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
let confirmYes=null;
function confirmBox(msg,yes,label){confirmYes=yes;modal(`<h2>${esc(msg)}</h2><div class="btns" style="justify-content:flex-end"><button class="btn" data-act="closeModal">Batal</button><button class="btn solid bad" data-act="confirmYes">${esc(label||'Ya, padam')}</button></div>`)}
A.closeModal=closeModal;A.confirmYes=()=>{const f=confirmYes;confirmYes=null;closeModal();f&&f()};

