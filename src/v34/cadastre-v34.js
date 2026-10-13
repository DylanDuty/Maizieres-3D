// V3.4 — the real cadastral parcels on the ground of premium-v34 (public/data/cadastre-parcels-v3.4.json, built offline by
// scripts/cadastre-v34/build-cadastre.mjs from the PCI Vecteur of INSEE 10220).
// Four layers are kept apart: the parcel outline is real (PCI); the building footprints stay the frozen ones; the ground
// tones are a stylisation guided by the buildings and the land cover; no hedge, wall or fence is drawn from a parcel limit.
// Everything is painted into the existing ground textures (no mesh per parcel, no per-frame work).
// FNV-1a of the parcel id → [0, 1): the tone of a parcel never depends on loading order
const _h=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0)/4294967296;};

const KIND={r:'res',c:'civic',f:'farm',a:'activity',x:'annex',y:'yard',g:'field',w:'wood',h:'water',o:'open'};
// built fabric (limits are drawn between these); a « yard » (unbuilt parcel of an activity site) keeps the site's ground
const BUILT=new Set(['res','civic','farm','activity','annex','yard']);

export async function loadCadastreV34({base='/',items=[],diagnostic=false}){
 const j=await fetch(`${base}data/cadastre-parcels-v3.4.json`).then(r=>{if(!r.ok)throw Error('cadastre '+r.status);return r.json();});
 const V=j.v,ring=idx=>{const out=new Array(idx.length*2+2);idx.forEach((i,k)=>{out[2*k]=V[2*i];out[2*k+1]=V[2*i+1];});out[idx.length*2]=V[2*idx[0]];out[idx.length*2+1]=V[2*idx[0]+1];return out;};
 const parcels=j.p.map((p,i)=>{const rings=p.r.map(poly=>poly.map(ring));let b=[Infinity,Infinity,-Infinity,-Infinity];for(const poly of rings){const r=poly[0];for(let k=0;k<r.length;k+=2){b[0]=Math.min(b[0],r[k]);b[1]=Math.min(b[1],r[k+1]);b[2]=Math.max(b[2],r[k]);b[3]=Math.max(b[3],r[k+1]);}}
  // main axis of the outline (longest edge): only steers the mowing stripes, an artistic touch
  let best=0,ang=0;const r=rings[0][0];for(let k=2;k<r.length;k+=2){const dx=r[k]-r[k-2],dz=r[k+1]-r[k-1],L=Math.hypot(dx,dz);if(L>best){best=L;ang=Math.atan2(dz,dx);}}
  return {i,id:p.id,kind:KIND[p.k]||'open',area:p.a,main:p.m||[],rings,b,ang,tone:_h(p.id)};});
 // building footprints by feature id (multi-part items share the id before '#')
 const foot=new Map();for(const it of items){const fid=it.featureId||it.id.split('#')[0];if(!it.poly?.[0])continue;if(!foot.has(fid))foot.set(fid,[]);foot.get(fid).push(it.poly);}
 // m: the main buildings of the parcel's own family (build-cadastre.mjs) — the domestic band surrounds them only
 for(const p of parcels)p.feet=p.main.flatMap(id=>foot.get(id)||[]);
 // deduplicated limits, classed once by the kinds on both sides
 const e=j.e,edges=[],count={garden:0,front:0,fringe:0,none:0};
 for(let k=0;k<e.length;k+=4){const a=e[k],bq=e[k+1],p=parcels[e[k+2]],q=e[k+3]>=0?parcels[e[k+3]]:null,kp=p.kind,kq=q?q.kind:'road';
  const bp=BUILT.has(kp),bq2=BUILT.has(kq);let cls='none';
  if(bp&&bq2)cls='garden';else if((bp&&kq==='road')||(bq2&&kp==='road'))cls='front';else if((bp&&kq==='open')||(bq2&&kp==='open'))cls='garden';else if(bp||bq2)cls='fringe';
  count[cls]++;edges.push({x0:V[2*a],z0:V[2*a+1],x1:V[2*bq],z1:V[2*bq+1],cls,p:e[k+2],q:e[k+3]});}
 for(const s of edges){s.b=[Math.min(s.x0,s.x1),Math.min(s.z0,s.z1),Math.max(s.x0,s.x1),Math.max(s.z0,s.z1)];}
 // point → parcel (vegetation keeps its free garden trees off the non-cadastred public domain: streets, river beds)
 const G=50,grid=new Map();parcels.forEach(p=>{for(let x=Math.floor(p.b[0]/G);x<=Math.floor(p.b[2]/G);x++)for(let z=Math.floor(p.b[1]/G);z<=Math.floor(p.b[3]/G);z++){const k=x+','+z;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(p);}});
 const inFlat=(x,z,r)=>{let c=false;for(let i=0,j=r.length-2;i<r.length;j=i,i+=2){const xi=r[i],zi=r[i+1],xj=r[j],zj=r[j+1];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)c=!c;}return c;};
 const parcelAt=(x,z)=>{for(const p of grid.get(Math.floor(x/G)+','+Math.floor(z/G))||[]){if(x<p.b[0]||x>p.b[2]||z<p.b[1]||z>p.b[3])continue;for(const poly of p.rings)if(inFlat(x,z,poly[0])&&!poly.slice(1).some(h=>inFlat(x,z,h)))return p;}return null;};
 const relation=j.bl||{};
 const byKind={};for(const p of parcels)byKind[p.kind]=(byKind[p.kind]||0)+1;
 return {parcels,edges,parcelAt,outside:(x,z)=>!parcelAt(x,z),relation,diagnostic,metadata:j.metadata,
  stats:{parcels:parcels.length,edges:edges.length,edgesDrawn:count.garden+count.front+count.fringe,edgesByClass:count,byKind,source:j.metadata.source.layerTitle,edition:j.metadata.source.edition}};
}

// ---- painting (ground canvases of the V3.0 painter) ----
// Domestic tones, close to the V3.0/V3.3 lawns, four per family chosen by the parcel id: neighbours differ by a shade,
// never by a hue. Small built parcels take the tone whole; on large ones only a band around the main buildings does
// (the rest keeps the meadow, field or wood that the land cover paints) — a large parcel is not a garden.
// Gardens a touch fresher than the village lawn (#a8c487) so that a plot reads against the public verge; unbuilt parcels
// of the village (≤ 6 000 m², neither field nor wood) in a drier, unmown grass.
export const CADASTRE_V34={res:['#9fc07c','#98ba76','#a5c483','#93b672'],civic:['#a0c27f'],farm:['#b1c38b','#adc088'],annex:['#a6c385','#a1bf80'],open:['#b2c58d','#adc189'],
 garden:'#6a8a55',front:'#7d9766',fringe:'#7a9463',shade:'#6e8c58',place:'#d6cdbc'};
const RULE={res:{whole:2500,band:18,alpha:.9},civic:{whole:6000,band:25,alpha:.92},farm:{whole:0,band:20,alpha:.7},annex:{whole:1500,band:0,alpha:.6},open:{whole:6000,band:0,alpha:.55}};
const ringPath=(ctx,X,Z,r)=>{for(let i=0;i<r.length;i+=2)i?ctx.lineTo(X(r[i]),Z(r[i+1])):ctx.moveTo(X(r[i]),Z(r[i+1]));ctx.closePath();};
const polyPath=(ctx,X,Z,p)=>{ctx.beginPath();for(const poly of p.rings)for(const r of poly)ringPath(ctx,X,Z,r);};
// the area that carries the domestic tone: the parcel itself, or the band around its main buildings, clipped to it
function toneArea(ctx,X,Z,sx,p,rule,fillStyle,strokeStyle){polyPath(ctx,X,Z,p);
 if(rule.whole&&p.area<=rule.whole){ctx.fillStyle=fillStyle;ctx.fill('evenodd');return true;}
 if(!rule.band||!p.feet.length)return false;
 ctx.save();ctx.clip('evenodd');ctx.beginPath();for(const poly of p.feet)for(const r of poly){r.forEach((q,i)=>i?ctx.lineTo(X(q[0]),Z(q[1])):ctx.moveTo(X(q[0]),Z(q[1])));ctx.closePath();}
 ctx.lineJoin='round';ctx.lineWidth=2*rule.band*sx;ctx.strokeStyle=strokeStyle;ctx.fillStyle=fillStyle;ctx.stroke();ctx.fill();ctx.restore();return true;}

export function paintCadastreV34(ctx,{C,P,X,Z,sx,over,detail}){
 for(const p of C.parcels){const rule=RULE[p.kind];if(!rule||!over(p.b))continue;const list=CADASTRE_V34[p.kind],col=list[Math.floor(p.tone*list.length)%list.length];
  ctx.globalAlpha=rule.alpha;toneArea(ctx,X,Z,sx,p,rule,col,col);}
 ctx.globalAlpha=1;
 // named public places of the data (equipement_public perimeters over 300 m², e.g. Place de la Mairie): paved
 const area=r=>{let s=0;for(let i=0;i<r.length;i+=2){const j=(i+2)%r.length;s+=r[i]*r[j+1]-r[j]*r[i+1];}return Math.abs(s)/2;};
 for(const {o,b} of P.artificial){if(!over(b)||o.kind!=='perimetre'||o.t!=='equipement_public'||!o.name||area(o.r[0][0])<=300)continue;
  ctx.globalAlpha=.95;ctx.fillStyle=CADASTRE_V34.place;for(const poly of o.r){ctx.beginPath();for(const r of poly)ringPath(ctx,X,Z,r);ctx.fill('evenodd');}
  if(detail){ctx.save();for(const poly of o.r){ctx.beginPath();for(const r of poly)ringPath(ctx,X,Z,r);}ctx.clip('evenodd');ctx.globalAlpha=.12;ctx.strokeStyle='#8f8676';ctx.lineWidth=Math.max(.5,.12*sx);ctx.beginPath();
   for(let x=Math.floor(b[0]/1.6)*1.6;x<b[2];x+=1.6){ctx.moveTo(X(x),Z(b[1]));ctx.lineTo(X(x),Z(b[3]));}for(let z=Math.floor(b[1]/1.6)*1.6;z<b[3];z+=1.6){ctx.moveTo(X(b[0]),Z(z));ctx.lineTo(X(b[2]),Z(z));}ctx.stroke();ctx.restore();}}
 ctx.globalAlpha=1;}

// Limits: one stroke per class (a single path, so a limit is never darkened twice), drawn after the fields. Fine and soft,
// a shade of the lawn: between gardens, at the front of built parcels on the street, at the village fringe. None between
// fields, woods or along country roads — no cadastral grid over the countryside.
// Each class: a soft shade 1,2 m wide, then a fine core (0,36–0,42 m), the same path stroked twice — one soft line, not two.
export function paintCadastreLimitsV34(ctx,{C,X,Z,sx,over,detail}){
 ctx.lineCap='round';ctx.lineJoin='round';
 const pathOf=cls=>{ctx.beginPath();for(const s of C.edges){if(s.cls!==cls||!over(s.b))continue;ctx.moveTo(X(s.x0),Z(s.z0));ctx.lineTo(X(s.x1),Z(s.z1));}};
 for(const [cls,w,a,ag,sh] of [['fringe',.4,.4,.16,.1],['front',.36,.45,.16,.1],['garden',.42,.55,.22,.12]]){pathOf(cls);
  ctx.globalAlpha=detail?sh:sh*.4;ctx.strokeStyle=CADASTRE_V34.shade;ctx.lineWidth=Math.max(.6,1.2*sx);ctx.stroke();
  ctx.globalAlpha=detail?a:ag;ctx.strokeStyle=CADASTRE_V34[cls];ctx.lineWidth=Math.max(.6,w*sx);ctx.stroke();}
 ctx.globalAlpha=1;}

// Field map: the toned areas are « lawn » (mowing stripes along the parcel axis, an artistic touch, not a survey).
// Unbuilt village parcels are « meadow » (the shader's unmown grass), the others « lawn ».
export function paintCadastreFieldV34(ctxA,ctxB,{C,X,Z,sx,over}){
 for(const p of C.parcels){const rule=RULE[p.kind];if(!rule||p.kind==='farm'||!over(p.b))continue;const a2=2*p.ang,dir=p.kind==='annex'||p.kind==='open'?'rgb(128,128,0)':`rgb(${Math.round((Math.cos(a2)*.5+.5)*255)},${Math.round((Math.sin(a2)*.5+.5)*255)},0)`,cls=p.kind==='open'?'rgb(0,255,0)':'rgb(0,0,255)';
  toneArea(ctxA,X,Z,sx,p,rule,cls,cls);toneArea(ctxB,X,Z,sx,p,rule,dir,dir);}}

// ?diagnostic=cadastre-v34: the imported outlines in a technical colour (limits towards the non-cadastred public domain in
// blue), the footprints coloured by their geometric relation to the parcels, and on request (&v33=1) the V3.3 plots.
export const DIAG_V34={limit:'#c2185b',publicLimit:'#1565c0',unique:'#2e7d32',overflow:'#f9a825',straddle:'#ef6c00',none:'#c62828',v33:'#00acc1'};
export function paintCadastreDiagV34(ctx,{C,X,Z,sx,over,items,v33}){
 ctx.lineCap='round';ctx.lineJoin='round';
 if(v33){ctx.globalAlpha=.9;ctx.strokeStyle=DIAG_V34.v33;ctx.lineWidth=Math.max(1,.45*sx);ctx.beginPath();for(const lot of v33.lots){if(!over(lot.b))continue;lot.poly.forEach((q,i)=>i?ctx.lineTo(X(q[0]),Z(q[1])):ctx.moveTo(X(q[0]),Z(q[1])));ctx.closePath();}ctx.stroke();}
 for(const [pub,col] of [[false,DIAG_V34.limit],[true,DIAG_V34.publicLimit]]){ctx.globalAlpha=.95;ctx.strokeStyle=col;ctx.lineWidth=Math.max(1,.5*sx);ctx.beginPath();
  for(const s of C.edges){if((s.q<0)!==pub||!over(s.b))continue;ctx.moveTo(X(s.x0),Z(s.z0));ctx.lineTo(X(s.x1),Z(s.z1));}ctx.stroke();}
 const col={d:DIAG_V34.overflow,c:DIAG_V34.straddle,n:DIAG_V34.none};ctx.lineWidth=Math.max(1,2.4*sx);
 for(const it of items){const r=it.poly?.[0];if(!r)continue;let b=[Infinity,Infinity,-Infinity,-Infinity];for(const q of r){b[0]=Math.min(b[0],q[0]);b[1]=Math.min(b[1],q[1]);b[2]=Math.max(b[2],q[0]);b[3]=Math.max(b[3],q[1]);}if(!over(b))continue;
  const rel=C.relation[it.featureId||it.id.split('#')[0]];ctx.globalAlpha=.9;ctx.strokeStyle=ctx.fillStyle=rel?col[rel]:DIAG_V34.unique;ctx.beginPath();r.forEach((q,i)=>i?ctx.lineTo(X(q[0]),Z(q[1])):ctx.moveTo(X(q[0]),Z(q[1])));ctx.closePath();ctx.stroke();}
 ctx.globalAlpha=1;}

// Legend of the diagnostic view (technical, never shown in premium-v34).
export function installCadastreLegendV34(withV33=false){const box=document.createElement('aside');box.id='cadastre-legend';box.setAttribute('aria-label','Légende du diagnostic cadastral');
 const rows=[[DIAG_V34.limit,'Limite de parcelle (PCI, import V3.4)'],[DIAG_V34.publicLimit,'Limite vers le domaine non cadastré (voirie, eau)'],[DIAG_V34.unique,'Bâtiment dans une seule parcelle'],[DIAG_V34.overflow,'Bâtiment débordant (< 20 %) sur une voisine'],
  [DIAG_V34.straddle,'Bâtiment à cheval (≥ 20 %)'],[DIAG_V34.none,'Bâtiment sans parcelle'],...(withV33?[[DIAG_V34.v33,'Terrains interprétés V3.3 (comparaison)']]:[])];
 box.innerHTML='<b>Diagnostic cadastral V3.4</b>'+rows.map(([c,t])=>`<div><i style="background:${c}"></i>${t}</div>`).join('');
 Object.assign(box.style,{position:'fixed',right:'12px',top:'72px',zIndex:30,background:'rgba(250,249,244,.94)',color:'#1f2f27',font:'12px/1.45 system-ui,sans-serif',padding:'10px 12px',borderRadius:'10px',boxShadow:'0 4px 18px rgba(0,0,0,.18)',maxWidth:'270px'});
 for(const i of box.querySelectorAll('i'))Object.assign(i.style,{display:'inline-block',width:'14px',height:'4px',marginRight:'8px',verticalAlign:'middle',borderRadius:'2px'});
 document.body.append(box);}
