/* ---------- THREADS: tulisan + outline subjek + doodle atas gambar (27 Nov 2026, Mira) ----------
   Semua dilukis dalam phone dengan canvas, 0 token. Unit reka = lebar gambar 300 (tinggi ikut nisbah).
   Outline perlukan topeng subjek dari Mac mini (job `subjek`, Apple Vision); tanpa topeng = tulisan + doodle sahaja.
   Lakaran yang Mira lulus: https://claude.ai/artifact/6nScSykqaGbsQEjas5etqk (4 gaya, tanpa anak panah). */
const TD_P=30;
const TD_COL=[['Pink','#ff7fae'],['Kuning','#ffd45c'],['Biru','#8fc4f5'],['Hijau','#9ed6a4'],['Ungu','#c7a8ff'],['Putih','#ffffff']];
const TD_STY={pink:{l:'Outline',c:0},dot:{l:'Bertitik',c:1},nota:{l:'Nota',c:0},pastel:{l:'Pastel',c:2}};
const TD_FONT={pink:"400 SZpx Chewy,'Arial Rounded MT Bold',sans-serif",dot:"700 SZpx Fredoka,'Arial Rounded MT Bold',sans-serif",
  nota:"400 SZpx 'Patrick Hand','Comic Sans MS',cursive",pastel:"400 SZpx 'Gochi Hand','Comic Sans MS',cursive"};
const TD_SZ={pink:[36,19],dot:[36,17],nota:[29,16],pastel:[24,19]};
const TD_SH={star:'M0-10 2.9-3.1 10-3.1 4.3 1.2 6.2 8.1 0 4-6.2 8.1-4.3 1.2-10-3.1-2.9-3.1Z',spark:'M0-10C1-3 3-1 10 0 3 1 1 3 0 10-1 3-3 1-10 0-3-1-1-3 0-10Z',
  heart:'M0 8C-12-1-7-10 0-4 7-10 12-1 0 8Z',squig:'M-14 0q3.5-9 7 0t7 0 7 0 7 0',cloud:'M-10 5a4.5 4.5 0 0 1 1-9 6.5 6.5 0 0 1 12-1 4.8 4.8 0 0 1 6 10Z',
  tri:'M0-8 8 6-8 6Z',burst:'M-6-2-11-7M0-4 0-11M6-2 11-7'};
let tdFontsP=null;
function tdFonts(){if(!tdFontsP){const fs=Object.values(TD_FONT).map(f=>f.replace('SZ','24'));
  tdFontsP=document.fonts&&document.fonts.load?Promise.all(fs.map(f=>document.fonts.load(f,'Setup baru').catch(()=>{}))).then(()=>true):Promise.resolve(true)}return tdFontsP}
function tdRng(s){let a=(s|0)+0x9e3779b9;return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}
function tdShade(hex,f){const n=parseInt(hex.slice(1),16);const c=v=>Math.max(0,Math.min(255,Math.round(v*f)));return 'rgb('+c(n>>16)+','+c(n>>8&255)+','+c(n&255)+')'}

/* Topeng (putih = subjek) -> medan jarak dalam unit reka, dengan jidar TD_P supaya outline di tepi gambar keluar dari bingkai. */
function tdField(mask,Hd){const W=300,H=Hd,GW=W+2*TD_P,GH=H+2*TD_P,c=document.createElement('canvas');c.width=W;c.height=H;
  const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(mask,0,0,W,H);const px=x.getImageData(0,0,W,H).data;
  const D=new Float32Array(GW*GH),cl=(v,m)=>v<0?0:v>m?m:v;let n=0;
  for(let y=0;y<GH;y++)for(let i=0;i<GW;i++){const on=px[(cl(y-TD_P,H-1)*W+cl(i-TD_P,W-1))*4]>127;D[y*GW+i]=on?0:1e6;if(on)n++}
  const g=(i,y)=>i<0||y<0||i>=GW||y>=GH?1e6:D[y*GW+i];
  for(let y=0;y<GH;y++)for(let i=0;i<GW;i++){const k=y*GW+i;D[k]=Math.min(D[k],g(i-1,y)+3,g(i,y-1)+3,g(i-1,y-1)+4,g(i+1,y-1)+4)}
  for(let y=GH-1;y>=0;y--)for(let i=GW-1;i>=0;i--){const k=y*GW+i;D[k]=Math.min(D[k],g(i+1,y)+3,g(i,y+1)+3,g(i+1,y+1)+4,g(i-1,y+1)+4)}
  return {GW,GH,D,H,share:n/(GW*GH),c:{}}}
const tdIn=(F,x,y,r)=>{if(!F)return false;const i=Math.round(x)+TD_P,j=Math.round(y)+TD_P;return i>=0&&j>=0&&i<F.GW&&j<F.GH&&F.D[j*F.GW+i]<=r*3};
/* Garis keliling subjek pada jarak r (Moore trace + licinkan). Pulang Path2D, disimpan dalam F.c. */
function tdContour(F,r){if(F.c[r])return F.c[r];const {GW,GH,D}=F,inn=(i,y)=>i>=0&&y>=0&&i<GW&&y<GH&&D[y*GW+i]<=r*3;let s=null;
  for(let y=0;y<GH&&!s;y++)for(let i=0;i<GW;i++)if(inn(i,y)){s=[i,y];break}
  if(!s)return F.c[r]=new Path2D();
  const dirs=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];let cur=s,dir=0;const pts=[];
  for(let n=0;n<30000;n++){pts.push(cur);let mv=false;const st=(dir+6)%8;
    for(let k=0;k<8;k++){const nd=(st+k)%8,nx=cur[0]+dirs[nd][0],ny=cur[1]+dirs[nd][1];if(inn(nx,ny)){cur=[nx,ny];dir=nd;mv=true;break}}
    if(!mv||(cur[0]===s[0]&&cur[1]===s[1]&&n>2))break}
  let q=pts.filter((_,i)=>i%3===0).map(p=>[p[0]-TD_P,p[1]-TD_P]);if(q.length<4)return F.c[r]=new Path2D();
  for(let pass=0;pass<3;pass++){const m=q.length;q=q.map((p,i)=>{let ax=0,ay=0;for(let k=-2;k<=2;k++){const t=q[(i+k+m)%m];ax+=t[0];ay+=t[1]}return [ax/5,ay/5]})}
  const m=q.length,mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2],f=v=>v.toFixed(1);let p0=mid(q[m-1],q[0]),out='M'+f(p0[0])+' '+f(p0[1]);
  for(let i=0;i<m;i++){const e=mid(q[i],q[(i+1)%m]);out+='Q'+f(q[i][0])+' '+f(q[i][1])+' '+f(e[0])+' '+f(e[1])}
  return F.c[r]=new Path2D(out+'Z')}

/* Teks: baris pertama = tajuk, baris lain = label (maks 6). Buang tanda bullet. */
function tdItems(text){const ls=String(text||'').split(/\n+/).map(s=>s.replace(/^\s*(?:[-•*–]+|\d+[.)])\s*/,'').trim()).filter(Boolean).slice(0,7);
  const cut=(s,n)=>{if(s.length<=n)return s;const c=s.slice(0,n+1);const k=c.lastIndexOf(' ');return (k>n*0.5?c.slice(0,k):s.slice(0,n)).replace(/[,.;:]+$/,'')};
  return ls.map((s,i)=>({t:cut(s,i?30:26),title:!i}))}
function tdWrap(s,n){const out=[];let cur='';s.split(/\s+/).forEach(w=>{if(cur&&(cur+' '+w).length>n){out.push(cur);cur=w}else cur=cur?cur+' '+w:w});if(cur)out.push(cur);return out.slice(0,3)}
/* Susun kotak teks: elak subjek, elak sesama sendiri; kedudukan yang Mira seret (deco.pos) kekal. */
function tdLayout(x,F,Hd,deco,items){const rnd=tdRng((deco.seed||1)*7919),[st,sl]=TD_SZ[deco.style],boxes=[];
  const hit=(a,b,pad)=>a.x<b.x+b.w+pad&&b.x<a.x+a.w+pad&&a.y<b.y+b.h+pad&&b.y<a.y+a.h+pad;
  const over=b=>{let n=0;for(let i=0;i<=4;i++)for(let j=0;j<=3;j++)if(tdIn(F,b.x-3+(b.w+6)*i/4,b.y-3+(b.h+6)*j/3,deco.style==='pastel'?22:17))n++;return n};
  items.forEach((it,idx)=>{let sz=it.title?st:sl,txt=deco.style==='nota'?it.t.toUpperCase():it.t,lines,w;
    for(let tries=0;tries<4;tries++){x.font=TD_FONT[deco.style].replace('SZ',sz);lines=tdWrap(txt,it.title?12:14);w=Math.max(...lines.map(l=>x.measureText(l).width))+(deco.style==='nota'?lines[0].length:0);if(w<=270)break;sz*=.86}
    const pad=it.title&&deco.style==='pastel'?10:4,b={w:w+pad*2,h:lines.length*sz*1.08+pad*2,lines,sz,title:it.title,rot:((idx%2?1:-1)*(it.title?5:3)+(rnd()-.5)*3)*Math.PI/180,pad};
    const man=deco.pos&&deco.pos[idx];
    if(man){b.x=Math.max(-b.w/2,Math.min(300-b.w/2,man.x-b.w/2));b.y=Math.max(-b.h/2,Math.min(Hd-b.h/2,man.y-b.h/2))}
    else{let best=null,bs=1e9;
      for(let y=8;y<=Hd-b.h-8;y+=8)for(let xx=8;xx<=300-b.w-8;xx+=8){const c={x:xx,y,w:b.w,h:b.h};if(boxes.some(o=>hit(c,o,8)))continue;
        const ov=over(c);let sc=ov*400+rnd()*(it.title?26:34);
        if(it.title)sc+=y*.9+xx*.25;else{let md=1e9;boxes.forEach(o=>{md=Math.min(md,Math.hypot(o.x+o.w/2-xx-b.w/2,o.y+o.h/2-y-b.h/2))});sc-=Math.min(md,170)*.8;sc+=Math.abs(xx+b.w/2-150)<40?18:0}
        if(sc<bs){bs=sc;best=c}}
      if(!best)best={x:8,y:8+idx*(sl*1.6)};b.x=best.x;b.y=best.y}
    boxes.push(b)});
  return boxes}
function tdScatter(F,Hd,boxes,seed,n){const rnd=tdRng(seed*104729+13),out=[];
  for(let k=0;k<700&&out.length<n;k++){const x=10+rnd()*280,y=10+rnd()*(Hd-20);
    if(tdIn(F,x,y,15))continue;if(boxes.some(b=>x>b.x-12&&x<b.x+b.w+12&&y>b.y-12&&y<b.y+b.h+12))continue;if(out.some(o=>Math.hypot(o.x-x,o.y-y)<38))continue;
    out.push({x,y,s:.7+rnd()*.7,r:(rnd()-.5)*50,k:rnd()})}
  return out}
function tdShape(x,k,d,fill,stroke,lw,s2){x.save();x.translate(d.x,d.y);x.rotate(d.r*Math.PI/180);const s=d.s*(s2||1);x.scale(s,s);x.lineCap='round';x.lineJoin='round';
  const arc=(cx,cy,r)=>{x.beginPath();x.arc(cx,cy,r,0,6.2832)};
  if(k==='dot'){arc(0,0,3);x.fillStyle=fill||stroke;x.fill()}
  else if(k==='ring'){arc(0,0,5);x.strokeStyle=stroke||fill;x.lineWidth=(lw||2.2)/s;x.stroke()}
  else if(k==='flower'){x.fillStyle=fill;[[0,-5.5],[5.2,-1.7],[3.2,4.4],[-3.2,4.4],[-5.2,-1.7]].forEach(p=>{arc(p[0],p[1],3.6);x.fill()});arc(0,0,2.5);x.fillStyle=stroke||'#fff';x.fill()}
  else if(k==='bee'){x.fillStyle='#fff';x.fill(new Path2D('M-3-6C-10-15-1-17 0-9 3-16 11-13 3-6Z'));x.beginPath();x.ellipse(0,0,11,7.5,0,0,6.2832);x.fillStyle='#ffd23f';x.fill();
    x.strokeStyle='#1d1a16';x.lineWidth=2.4;x.lineCap='butt';x.stroke(new Path2D('M-5-6.6v13.2M0-7.5v15M5-6.6v13.2'))}
  else{const p=new Path2D(TD_SH[k]);if(fill)(x.fillStyle=fill,x.fill(p));if(stroke){x.strokeStyle=stroke;x.lineWidth=(lw||2)/s;x.stroke(p)}}
  x.restore()}

/* Lukis hiasan atas kanvas yang gambar asasnya dah ada. Pulang kotak teks (unit reka) untuk seret. */
function tdDraw(cv,deco,F,text){const sty=TD_STY[deco.style];if(!sty)return [];const x=cv.getContext('2d'),u=cv.width/300,Hd=cv.height/u;
  const A=TD_COL[deco.col!=null?deco.col:sty.c][1],white=A==='#ffffff',dk=white?'#3d3a36':tdShade(A,.74),W='#fff',S=deco.style;
  if(F&&Math.abs(F.H-Hd)>2)F=null;
  x.save();x.scale(u,u);x.lineCap='round';x.lineJoin='round';
  const line=(r,col,w,dash)=>{if(!F)return;x.save();x.strokeStyle=col;x.lineWidth=w;if(dash)x.setLineDash(dash);x.stroke(tdContour(F,r));x.restore()};
  if(S==='pink'){line(5,A,6);line(11,white?'#ffd3e2':W,1.6)}
  else if(S==='dot'){line(6,A,6);line(15,white?'#ffd45c':W,4.2,[0.1,8])}
  else if(S==='nota'){line(6,W,1.6);line(10,white?'#ffd9ec':A,1.4)}
  else{line(20,'#b9c9a6',1.8);line(8,A,5)}
  const items=deco.txt===false?[]:tdItems(text),boxes=tdLayout(x,F,Hd,deco,items);
  const n=Math.round(Math.max(7,Math.min(16,Hd/400*12))),dd=tdScatter(F,Hd,boxes,deco.seed||1,n);
  const sets={pink:[['star',A],['spark',W],['heart',A],['squig',0,A,3],['dot',W],['burst',0,A,3],['heart',W],['ring',0,A,2.4],['squig',0,W,2.4],['star',A],['dot',A]],
    dot:[['bee'],['flower',W,'#ffd23f'],['spark',A],['dot',W],['bee'],['flower','#ffb3c1',W],['dot',A],['spark',W]],
    nota:[['cloud',0,'#bfe8ff',1.8],['spark',0,'#fff3b0',1.6],['star',0,white?'#ffd9ec':A,1.6],['heart',0,white?'#ffd9ec':A,1.8],['cloud',0,W,1.8],['burst',0,W,1.8],['squig',0,'#fff3b0',1.8],['spark',0,W,1.5],['star',0,'#bfe8ff',1.6]],
    pastel:[['tri',0,W,2.6],['burst',0,W,2.6],['ring',0,W,2.4],['squig',0,W,2.4],['flower','#dff5c9',W],['spark',W],['tri',W],['dot',A],['flower',W,'#dff5c9']]}[S];
  x.shadowColor='rgba(0,0,0,.28)';x.shadowBlur=3;x.shadowOffsetY=1;
  dd.forEach((d,i)=>{const e=sets[(i+Math.floor(d.k*3))%sets.length];
    if(e[0]==='bee'){x.save();x.strokeStyle=A;x.lineWidth=2;x.setLineDash([4,5]);x.beginPath();x.moveTo(d.x-12,d.y+6);x.quadraticCurveTo(d.x-34,d.y+22,d.x-26,d.y+44);x.stroke();x.restore();d={...d,s:Math.max(1,d.s)}}
    tdShape(x,e[0],d,e[1],e[2],e[3],e[0]==='cloud'?1.4:1)});
  boxes.forEach(b=>{x.save();x.translate(b.x+b.w/2,b.y+b.h/2);x.rotate(b.rot);x.font=TD_FONT[S].replace('SZ',b.sz);x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';
    try{x.letterSpacing=S==='nota'?'1px':'0px'}catch(e){}
    if(S==='pastel'&&b.title){x.shadowColor='rgba(0,0,0,.2)';x.shadowBlur=5;x.shadowOffsetY=2;x.fillStyle='#f6efe0';x.beginPath();
      if(x.roundRect)x.roundRect(-b.w/2,-b.h/2,b.w,b.h,Math.min(18,b.h/2));else x.rect(-b.w/2,-b.h/2,b.w,b.h);x.fill();
      x.beginPath();x.moveTo(-b.w/4,b.h/2-1);x.lineTo(-b.w/4-6,b.h/2+13);x.lineTo(-b.w/4+14,b.h/2-1);x.fill()}
    x.shadowColor='rgba(0,0,0,.3)';x.shadowBlur=4;x.shadowOffsetY=1.5;
    b.lines.forEach((l,i)=>{const y=(i-(b.lines.length-1)/2)*b.sz*1.08;
      if(S==='pink'){x.strokeStyle=white?'#ff5c9a':dk;x.lineWidth=5;x.strokeText(l,0,y);x.shadowColor='transparent';x.fillStyle=W;x.fillText(l,0,y)}
      else if(S==='dot'){if(b.title){x.fillStyle=W;x.strokeStyle=W;x.lineWidth=3;x.strokeText(l,2.5,y+2.5);x.fillText(l,2.5,y+2.5);x.shadowColor='transparent';x.fillStyle=deco.col==null||deco.col===1?'#ff7a8a':dk;x.fillText(l,0,y)}
        else{x.strokeStyle=deco.col==null||deco.col===1?'#f0a000':dk;x.lineWidth=4.5;x.strokeText(l,0,y);x.shadowColor='transparent';x.fillStyle=W;x.fillText(l,0,y)}}
      else if(S==='nota'){x.strokeStyle='rgba(50,34,20,.6)';x.lineWidth=3.5;x.strokeText(l,0,y);x.shadowColor='transparent';x.fillStyle='#fff7e0';x.fillText(l,0,y)}
      else if(b.title){x.shadowColor='transparent';x.fillStyle='#7a4a24';x.fillText(l,0,y)}
      else{x.strokeStyle=white?'#5a7fa8':dk;x.lineWidth=4.5;x.strokeText(l,0,y);x.shadowColor='transparent';x.fillStyle=W;x.fillText(l,0,y)}
      x.shadowColor='rgba(0,0,0,.3)'});
    x.restore()});
  x.restore();return boxes}
