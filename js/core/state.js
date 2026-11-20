/* ---------- state ---------- */
const COLS=['items','jobs','editor','footage','inspo','products','boards','readymeta','pubmeta','published','invoices','workprojects','captions','broll','gaya','vo','brm','brd'];
const S={settings:null,sync:{folders:null,topost:null,toedit:null,toeditmarks:null},styles:null};COLS.forEach(c=>S[c]=[]);
const ui={view:'home',q:{},draft:{type:'text',title:'',text:''}};
let DB=null,ASSETS=null,SAMPLE=null,DICT=null,MCP=null,mode='loading',renderPending=false;

