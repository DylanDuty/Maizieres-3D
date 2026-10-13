import * as THREE from 'three';
import {area} from '../geo.js';
import {fnv,Tri} from '../v25/procedural-houses.js';
import {variantV32,facadeV32} from '../v32/architecture-v32.js';

// V3.3 inhabited ground (style 'v33'): an interpreted plot for each house, never a cadastre.
// The public data has no parcel boundary (the cadastre extract holds buildings only): every plot below is a rendering
// rule, derived from the frozen footprints, the V2.3.1 classes, the street network and the land cover, and it is the
// same at every load (FNV hash of the building id, no random draw). A plot is a rectangle aligned on the nearest street
// (front toward it, sides perpendicular), shared with the neighbours by a power diagram (the bisector between two houses
// moves toward the smaller one), clipped by fields, woods and water when it is painted. Inside: a court or a drive on the
// street side, a lawn with mowing bands, a terrace behind pavilions, a vegetable patch at the back of deep rural plots.
// Limits: a hedge, a low wall or a discreet fence, chosen by the position of the limit and the family of the house.
// Public buildings get a forecourt, activity buildings an asphalt yard toward their road and a hard apron, farms a gravel yard.

const h01=(s)=>fnv(s)/4294967296;
const CIVIC_CLS=new Set(['PUBLIC','HERITAGE','RELIGIOUS']);
const ACTIVITY_CLS=new Set(['INDUSTRIAL','COMMERCIAL','HANGAR','SILO_TANK']);
const ROADS=new Set(['voie_locale','voie_de_desserte','route_secondaire','route_principale','chemin_carrossable','chemin_rural']);
const STREETS=new Set(['voie_locale','voie_de_desserte','route_secondaire','route_principale']);
const CIVIC_POI=['poi:mairie','poi:ecole-primaire','poi:salle-polyvalente','poi:eglise-saint-denis','poi:cpi','poi:maison-des-associations'];
const OLD=new Set(['maison-ancienne','mitoyen','maison-rurale']);

// ---- small geometry helpers ----
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
function inFlat(x,z,r){let c=false;for(let i=0,j=r.length-2;i<r.length;j=i,i+=2){const xi=r[i],zi=r[i+1],xj=r[j],zj=r[j+1];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)c=!c;}return c;}
const inFlatPoly=(x,z,p)=>{if(!inFlat(x,z,p[0]))return false;for(let k=1;k<p.length;k++)if(inFlat(x,z,p[k]))return false;return true;};
// Spatial grid over flat-ring polygons ({r:[[ring…]]} objects): which object contains a point.
function polyIndex(objs,cell=120){const grid=new Map(),list=[];
 for(const o of objs)for(const p of o.r){let b=[Infinity,Infinity,-Infinity,-Infinity];for(let i=0;i<p[0].length;i+=2){b[0]=Math.min(b[0],p[0][i]);b[1]=Math.min(b[1],p[0][i+1]);b[2]=Math.max(b[2],p[0][i]);b[3]=Math.max(b[3],p[0][i+1]);}
  const e={o,p,b};list.push(e);for(let x=Math.floor(b[0]/cell);x<=Math.floor(b[2]/cell);x++)for(let z=Math.floor(b[1]/cell);z<=Math.floor(b[3]/cell);z++){const k=x+','+z;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(e);}}
 return (x,z)=>{const l=grid.get(Math.floor(x/cell)+','+Math.floor(z/cell));if(!l)return null;for(const e of l)if(x>=e.b[0]&&x<=e.b[2]&&z>=e.b[1]&&z<=e.b[3]&&inFlatPoly(x,z,e.p))return e.o;return null;};}
// Street segments: nearest point, direction and width.
function roadIndex(roads,cell=40){const grid=new Map(),segs=[];
 for(const r of roads){if(!ROADS.has(r.c))continue;const p=r.p,w=r.w||4;for(let i=3;i<p.length;i+=3){const s={ax:p[i-3],az:p[i-2],bx:p[i],bz:p[i+1],w,c:r.c,street:STREETS.has(r.c)};segs.push(s);
  const x0=Math.floor(Math.min(s.ax,s.bx)/cell),x1=Math.floor(Math.max(s.ax,s.bx)/cell),z0=Math.floor(Math.min(s.az,s.bz)/cell),z1=Math.floor(Math.max(s.az,s.bz)/cell);
  for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const k=x+','+z;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(s);}}}
 const near=(x,z,maxD,streetOnly=false)=>{let best=null;const R=Math.ceil(maxD/cell),cx=Math.floor(x/cell),cz=Math.floor(z/cell),seen=new Set();
  for(let i=-R;i<=R;i++)for(let j=-R;j<=R;j++){const l=grid.get((cx+i)+','+(cz+j));if(!l)continue;for(const s of l){if(seen.has(s)||streetOnly&&!s.street)continue;seen.add(s);
   const dx=s.bx-s.ax,dz=s.bz-s.az,L2=dx*dx+dz*dz||1;let t=((x-s.ax)*dx+(z-s.az)*dz)/L2;t=Math.max(0,Math.min(1,t));const qx=s.ax+dx*t,qz=s.az+dz*t,d=Math.hypot(x-qx,z-qz);
   if(d<=maxD&&(!best||d<best.d)){const L=Math.sqrt(L2);best={d,qx,qz,dir:[dx/L,dz/L],w:s.w,c:s.c,street:s.street};}}}return best;};
 return {near,segs};}
// Sutherland–Hodgman clip keeping a·x + b·z ≤ c; `labels[k]` names the edge from vertex k to k+1, the new edge is `lab`.
function clipLab(poly,labels,a,b,c,lab){const out=[],ol=[],n=poly.length;
 for(let i=0;i<n;i++){const P=poly[i],Q=poly[(i+1)%n],L=labels[i],dp=a*P[0]+b*P[1]-c,dq=a*Q[0]+b*Q[1]-c;
  if(dp<=0){out.push(P);ol.push(L);if(dq>0){const t=dp/(dp-dq);out.push([P[0]+(Q[0]-P[0])*t,P[1]+(Q[1]-P[1])*t]);ol.push(lab);}}
  else if(dq<=0){const t=dp/(dp-dq);out.push([P[0]+(Q[0]-P[0])*t,P[1]+(Q[1]-P[1])*t]);ol.push(L);}}
 return [out,ol];}
const clip=(poly,a,b,c)=>clipLab(poly,poly.map(()=>0),a,b,c,0)[0];
const rectFT=(c,f,t,f0,f1,t0,t1)=>[[c[0]+f[0]*f1+t[0]*t1,c[1]+f[1]*f1+t[1]*t1],[c[0]+f[0]*f1+t[0]*t0,c[1]+f[1]*f1+t[1]*t0],[c[0]+f[0]*f0+t[0]*t0,c[1]+f[1]*f0+t[1]*t0],[c[0]+f[0]*f0+t[0]*t1,c[1]+f[1]*f0+t[1]*t1]];
// Keep the part of `poly` where f·(x−c) lies in [f0, f1] and t·(x−c) in [t0, t1].
function band(poly,c,f,t,f0,f1,t0=-1e9,t1=1e9){let p=poly;const fc=dot(f,c),tc=dot(t,c);
 p=clip(p,f[0],f[1],fc+f1);p=clip(p,-f[0],-f[1],-(fc+f0));p=clip(p,t[0],t[1],tc+t1);p=clip(p,-t[0],-t[1],-(tc+t0));return p.length>=3?p:null;}

// ---- plots ----
// items: building items ({id, poly, featureId}); architecture: Map id → V2.3.1 profile; v2: scene data; poiIds: civic POI → building ids.
export function buildParcelsV33({items,architecture,enrichment={buildings:{}},v2,heightAt,poiAt=()=>null,performance=false}){
 const d=v2.data,R=roadIndex(d.roads),field=polyIndex([...d.agriculture,...d.woodland]),water=polyIndex(d.water);
 const civicIds=new Set();for(const id of CIVIC_POI){const p=v2.poiById?.get(id);for(const b of p?.building_ids||[])civicIds.add(b);}
 const seeds=[],activity=[],minor=[],farmYards=[];
 for(const it of items){const ring=it.poly?.[0];if(!ring||ring.length<3)continue;const fid=it.featureId||it.id.split('#')[0],arch=architecture?.get(fid)||null,cls=arch?.buildingClass||'UNKNOWN',A=area(ring);
  let cx=0,cz=0;for(const q of ring){cx+=q[0];cz+=q[1];}cx/=ring.length;cz/=ring.length;
  const civic=civicIds.has(fid)||civicIds.has(it.id)||CIVIC_CLS.has(cls)&&A>=60;
  const kind=civic?'civic':/^RES_/.test(cls)&&A>=30?'res':cls==='FARM'?'farm':ACTIVITY_CLS.has(cls)&&A>=150?'activity':'minor';
  const o={id:it.id,ring,poly:it.poly,c:[cx,cz],A,cls,kind,arch};
  if(kind==='activity')activity.push(o);else if(kind==='minor')minor.push(o);else seeds.push(o);
  if(kind==='farm'||cls==='HANGAR'&&A<1500)farmYards.push(o);}
 // seed grid
 const SG=60,sgrid=new Map();seeds.forEach((s,i)=>{s.i=i;const k=Math.floor(s.c[0]/SG)+','+Math.floor(s.c[1]/SG);if(!sgrid.has(k))sgrid.set(k,[]);sgrid.get(k).push(s);});
 const around=(c,r)=>{const out=[],R_=Math.ceil(r/SG),cx=Math.floor(c[0]/SG),cz=Math.floor(c[1]/SG);for(let i=-R_;i<=R_;i++)for(let j=-R_;j<=R_;j++)for(const s of sgrid.get((cx+i)+','+(cz+j))||[])if(Math.hypot(s.c[0]-c[0],s.c[1]-c[1])<=r)out.push(s);return out;};
 const lots=[],stats={lots:0,res:0,civic:0,farm:0,withRoad:0,courts:0,drives:0,terraces:0,potagers:0,hedgeM:0,wallM:0,fenceM:0,fieldEdges:0,trees:0};
 for(const s of seeds){const h=k=>h01(s.id+k);
  const fam=s.kind==='res'?variantV32(s.cls,s.arch,facadeV32(s.cls,enrichment.buildings?.[s.id]||{},s.id).family):s.kind;
  const road=R.near(s.c[0],s.c[1],s.kind==='farm'?70:55);let f,t;
  if(road){t=road.dir;f=[-t[1],t[0]];if(dot(f,[road.qx-s.c[0],road.qz-s.c[1]])<0)f=[-f[0],-f[1]];}
  else{let best=null;for(let i=0;i<s.ring.length;i++){const a=s.ring[i],b=s.ring[(i+1)%s.ring.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!best||L>best.L)best={L,u:[(b[0]-a[0])/(L||1),(b[1]-a[1])/(L||1)]};}t=best.u;f=[-t[1],t[0]];}
  let fmin=Infinity,fmax=-Infinity,tmin=Infinity,tmax=-Infinity;for(const q of s.ring){const v=[q[0]-s.c[0],q[1]-s.c[1]],a=dot(v,f),b=dot(v,t);fmin=Math.min(fmin,a);fmax=Math.max(fmax,a);tmin=Math.min(tmin,b);tmax=Math.max(tmax,b);}
  const roadF=road?dot(f,[road.qx-s.c[0],road.qz-s.c[1]])-road.w/2-1.3:null;
  const F=road?Math.max(fmax+.3,roadF):fmax+6,front=F-fmax;
  const back=s.kind==='civic'?8+6*h('b'):s.kind==='farm'?18+12*h('b'):OLD.has(fam)?14+10*h('b'):fam==='grand-residentiel'?9+5*h('b'):10+8*h('b');
  const side=s.kind==='civic'?5+4*h('s'):s.kind==='farm'?8+6*h('s'):fam==='mitoyen'?1.5+2*h('s'):4+5*h('s');
  let B=fmin-back;const L0=tmin-side,L1=tmax+side;
  // the back of the plot stops at the first field, wood or water met behind the house (three lines of sight), 4 m at least
  {let hit=B;for(const tt of [L0+1.5,(tmin+tmax)/2,L1-1.5])for(let a=fmin-1;a>B;a-=1){const x=s.c[0]+f[0]*a+t[0]*tt,zz=s.c[1]+f[1]*a+t[1]*tt;if(field(x,zz)||water(x,zz)){hit=Math.max(hit,a+.5);break;}}B=Math.min(fmin-4,hit);}
  let poly=rectFT(s.c,f,t,B,F,L0,L1),labels=['front','side','back','side'];
  // power diagram: x stays on this side when |x−ci|² − wi ≤ |x−cj|² − wj (w = squared half-size of the footprint)
  const wi=s.A/4;
  for(const o of around(s.c,75)){if(o===s)continue;const wj=o.A/4,a=2*(o.c[0]-s.c[0]),b=2*(o.c[1]-s.c[1]),c=(o.c[0]**2+o.c[1]**2)-(s.c[0]**2+s.c[1]**2)-wj+wi;[poly,labels]=clipLab(poly,labels,a,b,c,'n:'+o.i);if(poly.length<3)break;}
  if(poly.length<3)continue;
  const lot={s,fam,f,t,F,B,L0,L1,fmin,fmax,tmin,tmax,front,road:!!road,street:road?.street||false,poly,labels,h,tone:h('tone'),zones:[],edges:[],trees:[]};
  stats.lots++;stats[s.kind]++;if(road)stats.withRoad++;
  // ---- zones ----
  const z=(kind,p)=>{if(p&&p.length>=3)lot.zones.push({kind,p});};
  if(s.kind==='farm'){z('yard',poly);}
  else if(s.kind==='civic'){z('forecourt',band(poly,s.c,f,t,fmax-.5,F+1));z('apron',null);}
  else{
   if(front>=2&&(OLD.has(fam)||front<5&&h('c')<.5)){z('court',band(poly,s.c,f,t,fmax-.3,F+.5));stats.courts++;}
   else if(front>=2.5){// drive: toward an annex on the street side if there is one, else beside the house where there is room
    let td=null;for(const m of minor){const v=[m.c[0]-s.c[0],m.c[1]-s.c[1]],a=dot(v,f),b=dot(v,t);if(Math.abs(a)<front+8&&b>L0&&b<L1&&a>fmin-2&&Math.hypot(v[0],v[1])<30){td=b;break;}}
    if(td==null)td=L1-tmax>4.2?tmax+2:tmin-L0>4.2?tmin-2:(tmin+tmax)/2;
    const stop=td>tmax||td<tmin?fmin+(fmax-fmin)*.35:fmax-.3;z('drive',band(poly,s.c,f,t,stop,F+.8,td-1.5,td+1.5));lot.drive=[td-1.7,td+1.7];stats.drives++;}
   if(['pavillon-compact','pavillon-allonge','maison-etage','grand-residentiel'].includes(fam)&&fmin-B>8){const w=(tmax-tmin)*.6,tc=(tmin+tmax)/2;z('terrace',band(poly,s.c,f,t,fmin-3,fmin+.2,tc-w/2,tc+w/2));stats.terraces++;}
   const depth=fmin-B;if(depth>=15&&(OLD.has(fam)?h('p')<.75:h('p')<.3)){const W=(L1-L0)*.45,left=h('pl')<.5,dp=Math.min(9,depth*.38);z('potager',band(poly,s.c,f,t,B+1.5,B+1.5+dp,left?L0+1:L1-1-W,left?L0+1+W:L1-1));lot.potager=true;stats.potagers++;}}
  // ---- trees: an orchard at the back of deep rural plots, one fruit tree behind a pavilion (not in PERFORMANCE, which
  // keeps the V3.2 garden trees: see onHard) ----
  if(s.kind!=='civic'&&!performance){const depth=fmin-B;
   if((OLD.has(fam)||s.kind==='farm')&&depth>=18){const n=Math.min(5,Math.floor(depth/7));for(let k=0;k<n;k++){const a=fmin-5-k*(depth-6)/Math.max(1,n),b=(h('t'+k)-.5)*(L1-L0)*.6+(L0+L1)/2;lot.trees.push({x:s.c[0]+f[0]*a+t[0]*b,z:s.c[1]+f[1]*a+t[1]*b,type:'fruit',h:3.8+h('th'+k)*2});}}
   else if(depth>=12&&h('t')<.55){const a=B+3.5,b=h('tb')<.5?L0+3:L1-3;lot.trees.push({x:s.c[0]+f[0]*a+t[0]*b,z:s.c[1]+f[1]*a+t[1]*b,type:h('tt')<.6?'fruit':'round',h:4+h('th')*2.5});}}
  lots.push(lot);}
 // ---- limits: classify each edge (front, shared side or back, outer side or back, garden / field edge) ----
 const outside=(lot,a,b,dist)=>{const m=[(a[0]+b[0])/2,(a[1]+b[1])/2],e=[b[0]-a[0],b[1]-a[1]],L=Math.hypot(e[0],e[1])||1;let n=[e[1]/L,-e[0]/L];const ctr=lot.poly.reduce((s,q)=>[s[0]+q[0]/lot.poly.length,s[1]+q[1]/lot.poly.length],[0,0]);if(dot(n,[m[0]-ctr[0],m[1]-ctr[1]])<0)n=[-n[0],-n[1]];return {m,n,p:[m[0]+n[0]*dist,m[1]+n[1]*dist],L};};
 for(const lot of lots){const P=lot.poly,s=lot.s;
  for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length],lab=lot.labels[i],o=outside(lot,a,b,2.5);if(o.L<1.2)continue;
   if(field(o.m[0],o.m[1])||water(o.m[0],o.m[1]))continue;// the edge lies in a field, a wood or water: painted over
   const e=[(b[0]-a[0])/o.L,(b[1]-a[1])/o.L],across=Math.abs(dot(e,lot.f))>.7,key=s.id+':'+i;let kind,shared=false;
   if(typeof lab==='string'&&lab.startsWith('n:')){const j=+lab.slice(2);if(j<s.i)continue;shared=true;const r=h01(key+'k');kind=across?(r<.32?'hedge':'fence'):(r<.5?'hedge':'fence');}
   else if(lab==='front'){if(!lot.road||lot.front<1)continue;const r=h01(key+'k');kind=s.kind==='civic'?'wall':s.kind==='farm'?null:OLD.has(lot.fam)?(r<.55?'wall':r<.75?'hedge':null):(r<.3?'hedge':r<.65?'fence':null);}
   else{const fieldSide=!!field(o.p[0],o.p[1]);const r=h01(key+'k');
    // an outer limit with no neighbour: a field edge gets its hedge or rough band, otherwise a discreet fence or nothing
    if(fieldSide){kind=r<.6?'fieldhedge':'fieldband';stats.fieldEdges++;}else kind=s.kind==='farm'?null:(r<.4?'fence':null);}
   if(!kind)continue;lot.edges.push({a,b,kind,n:o.n,front:lab==='front',shared});
   const len=o.L;if(kind==='hedge'||kind==='fieldhedge')stats.hedgeM+=len;else if(kind==='wall')stats.wallM+=len;else if(kind==='fence')stats.fenceM+=len;}
  stats.trees+=lot.trees.length;}
 // ---- activity aprons, farm yards, civic places, monument ----
 const flatArea=r=>{let s=0;for(let i=0;i<r.length;i+=2){const j=(i+2)%r.length;s+=r[i]*r[j+1]-r[j]*r[i+1];}return Math.abs(s)/2;};
 const places=d.artificial.filter(a=>a.kind==='perimetre'&&a.t==='equipement_public'&&a.name&&flatArea(a.r[0][0])>300);
 const memorial=poiAt('poi:monument-aux-morts');
 for(const lot of lots){let b=[Infinity,Infinity,-Infinity,-Infinity];for(const q of lot.poly){b[0]=Math.min(b[0],q[0]);b[1]=Math.min(b[1],q[1]);b[2]=Math.max(b[2],q[0]);b[3]=Math.max(b[3],q[1]);}lot.b=b;}
 const bbOf=r=>{let b=[Infinity,Infinity,-Infinity,-Infinity];for(const q of r){b[0]=Math.min(b[0],q[0]);b[1]=Math.min(b[1],q[1]);b[2]=Math.max(b[2],q[0]);b[3]=Math.max(b[3],q[1]);}return b;};
 // activity yards: an asphalt yard between the hall and its access road (only when the road is at most 45 m away; 4 m wider
 // than the hall on each side), stopped at the first field or water met on the way (three lines of sight)
 stats.yards=0;for(const a of activity){const road=R.near(a.c[0],a.c[1],a.A>2000?110:70);if(!road)continue;const t=road.dir;let f=[-t[1],t[0]];if(dot(f,[road.qx-a.c[0],road.qz-a.c[1]])<0)f=[-f[0],-f[1]];
  let fmax=-Infinity,tmin=Infinity,tmax=-Infinity;for(const q of a.ring){const v=[q[0]-a.c[0],q[1]-a.c[1]];fmax=Math.max(fmax,dot(v,f));tmin=Math.min(tmin,dot(v,t));tmax=Math.max(tmax,dot(v,t));}
  let F=dot(f,[road.qx-a.c[0],road.qz-a.c[1]])-road.w/2-.5;if(F-fmax>45)continue;
  for(const tt of [tmin,(tmin+tmax)/2,tmax])for(let k=fmax+1;k<F;k+=1){const x=a.c[0]+f[0]*k+t[0]*tt,zz=a.c[1]+f[1]*k+t[1]*tt;if(field(x,zz)||water(x,zz)){F=Math.min(F,k-.5);break;}}
  if(F-fmax>=3){a.yard=rectFT(a.c,f,t,fmax-2,F,tmin-4,tmax+4);stats.yards++;}}
 for(const a of activity)a.b=bbOf(a.yard?[...a.ring,...a.yard]:a.ring);for(const a of farmYards)a.b=bbOf(a.ring);
 stats.activity=activity.length;stats.farmYards=farmYards.length;stats.places=places.length;
 // point-in-plot test (vegetation keeps its free garden trees outside the plots only)
 const LG=50,lgrid=new Map();for(const lot of lots)for(let x=Math.floor(lot.b[0]/LG);x<=Math.floor(lot.b[2]/LG);x++)for(let z=Math.floor(lot.b[1]/LG);z<=Math.floor(lot.b[3]/LG);z++){const k=x+','+z;if(!lgrid.has(k))lgrid.set(k,[]);lgrid.get(k).push(lot);}
 const inPolyXZ=(x,z,p)=>{let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const [xi,zi]=p[i],[xj,zj]=p[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)c=!c;}return c;};
 const lotAt=(x,z)=>{for(const lot of lgrid.get(Math.floor(x/LG)+','+Math.floor(z/LG))||[])if(x>=lot.b[0]&&x<=lot.b[2]&&z>=lot.b[1]&&z<=lot.b[3]&&inPolyXZ(x,z,lot.poly))return lot;return null;};
 const inLot=(x,z)=>!!lotAt(x,z);
 // on a hard or worked surface of a plot (court, drive, terrace, forecourt, vegetable patch): PERFORMANCE keeps its free
 // garden trees everywhere else
 const onHard=(x,z)=>{const lot=lotAt(x,z);if(!lot)return false;for(const zn of lot.zones)if(zn.kind!=='yard'&&inPolyXZ(x,z,zn.p))return true;return false;};
 return {lots,activity,farmYards,places,memorial,inLot,onHard,streets:R.segs.filter(s=>s.street),stats,field,water,roads:R};
}

// ---- painting (ground canvas, V3.0 painter) ----
// Lawn tones by family (sRGB, close to the V3.0 lawn): pavilions a cleaner green, old houses a warmer one, a few plots a
// touch drier. Hard surfaces: gravel courts in warm beige, drives in gravel or asphalt, stone forecourts, asphalt aprons.
const LAWN={pav:['#a3c282','#9fbf7f','#a7c486','#9cbc7c'],old:['#a4c080','#abc285','#a0bd7d','#aec38a'],civic:['#a2c283'],farm:['#b1c38b']};
export const PARCEL_COLORS={court:'#d2c9b5',court2:'#cdc3ad',drive:'#cfc7b4',drive2:'#bcb8ae',terrace:'#ddd6c8',potager:'#b9a481',potagerRow:'#a48d69',forecourt:'#d9d1c1',place:'#d6cdbc',
 yard:'#cbbf9f',apron:'#a09f9b',kerb:'#d2cdc1',apronBand:'#c7c2b6',hedge:'#6a9358',hedgeShade:'#55704a',fence:'#e4dfd2',fenceShade:'#6f7a5d',wall:'#d4cab6',band:'#bec68f',verge:'#bccb96'};
export function paintParcelsV33(ctx,{Pc,X,Z,sx,over,m,detail}){const C=PARCEL_COLORS;
 const path=pts=>{ctx.beginPath();pts.forEach((q,i)=>i?ctx.lineTo(X(q[0]),Z(q[1])):ctx.moveTo(X(q[0]),Z(q[1])));ctx.closePath();};
 const fill=(pts,col,al=1)=>{ctx.globalAlpha=al;ctx.fillStyle=col;path(pts);ctx.fill();};
 const seg=(a,b,col,wm,al)=>{ctx.globalAlpha=al;ctx.strokeStyle=col;ctx.lineWidth=Math.max(.6,wm*sx);ctx.beginPath();ctx.moveTo(X(a[0]),Z(a[1]));ctx.lineTo(X(b[0]),Z(b[1]));ctx.stroke();};
 const ringStroke=(r,col,wm,al)=>{ctx.globalAlpha=al;ctx.strokeStyle=col;ctx.lineWidth=Math.max(.6,wm*sx);ctx.beginPath();r.forEach((q,i)=>i?ctx.lineTo(X(q[0]),Z(q[1])):ctx.moveTo(X(q[0]),Z(q[1])));ctx.closePath();ctx.stroke();};
 ctx.lineJoin='round';ctx.lineCap='round';
 // street verges: a slightly fresher grass strip on both sides of the village streets
 for(const s of Pc.streets){if(!over([Math.min(s.ax,s.bx),Math.min(s.az,s.bz),Math.max(s.ax,s.bx),Math.max(s.az,s.bz)]))continue;seg([s.ax,s.az],[s.bx,s.bz],C.verge,s.w+3.4,.5);}
 // activity sites: the asphalt yard toward the access road with a light kerb, a narrower asphalt apron all around the hall
 // (6 m over 2 000 m², 4 m below) and a lighter concrete band at the foot of the walls
 for(const a of Pc.activity){if(!over(a.b))continue;
  if(a.yard){fill(a.yard,C.apron,.9);ctx.globalAlpha=.75;ctx.strokeStyle=C.kerb;ctx.lineWidth=Math.max(.6,.6*sx);path(a.yard);ctx.stroke();}
  ctx.lineJoin='miter';ringStroke(a.ring,C.apron,a.A>2000?12:8,.9);ringStroke(a.ring,C.apronBand,4.5,.92);ctx.lineJoin='round';}
 // farm yards: gravel and beaten earth around farm buildings
 for(const a of Pc.farmYards){if(!over(a.b))continue;ringStroke(a.ring,C.yard,12,.55);ringStroke(a.ring,C.yard,6,.6);}
 // plots
 for(const lot of Pc.lots){if(!over(lot.b))continue;const k=lot.s.kind,list=k==='civic'?LAWN.civic:k==='farm'?LAWN.farm:OLD.has(lot.fam)?LAWN.old:LAWN.pav;
  fill(lot.poly,list[Math.floor(lot.tone*list.length)%list.length],.92);
  if(k!=='farm'){ctx.save();path(lot.poly);ctx.clip();ctx.globalAlpha=.3;ctx.strokeStyle='#8fae70';ctx.lineWidth=Math.max(.6,2.6*sx);path(lot.poly);ctx.stroke();ctx.restore();}
  for(const zn of lot.zones){if(zn.kind==='court')fill(zn.p,lot.tone<.5?C.court:C.court2,.92);else if(zn.kind==='drive')fill(zn.p,lot.h('dc')<.65?C.drive:C.drive2,.95);
   else if(zn.kind==='terrace')fill(zn.p,C.terrace,.9);else if(zn.kind==='forecourt')fill(zn.p,C.forecourt,.95);else if(zn.kind==='yard')fill(zn.p,C.yard,.5);
   else if(zn.kind==='potager'){fill(zn.p,C.potager,.88);if(detail){// rows across the patch, 0,9 m apart (only where a row is wider than a pixel)
     ctx.save();path(zn.p);ctx.clip();const f=lot.f,t=lot.t,c=lot.s.c;for(let a=lot.B;a<lot.fmin;a+=.9){const p0=[c[0]+f[0]*a+t[0]*(lot.L0-2),c[1]+f[1]*a+t[1]*(lot.L0-2)],p1=[c[0]+f[0]*a+t[0]*(lot.L1+2),c[1]+f[1]*a+t[1]*(lot.L1+2)];seg(p0,p1,C.potagerRow,.3,.45);}ctx.restore();}}}
  // civic: stone apron around the building
  if(k==='civic'){ctx.lineJoin='miter';ringStroke(lot.s.ring,C.forecourt,9,.95);ctx.lineJoin='round';}}
 // data places (Place de la Mairie, Église Saint-Denis): paved, with a faint stone grid near the camera
 for(const pl of Pc.places)for(const p of pl.r){const r=[];for(let i=0;i<p[0].length;i+=2)r.push([p[0][i],p[0][i+1]]);const b=[Math.min(...r.map(q=>q[0])),Math.min(...r.map(q=>q[1])),Math.max(...r.map(q=>q[0])),Math.max(...r.map(q=>q[1]))];if(!over(b))continue;
  fill(r,C.place,.95);if(detail){ctx.save();path(r);ctx.clip();ctx.globalAlpha=.12;ctx.strokeStyle='#8f8676';ctx.lineWidth=Math.max(.5,.12*sx);ctx.beginPath();for(let x=Math.floor(b[0]/1.6)*1.6;x<b[2];x+=1.6){ctx.moveTo(X(x),Z(b[1]));ctx.lineTo(X(x),Z(b[3]));}for(let z=Math.floor(b[1]/1.6)*1.6;z<b[3];z+=1.6){ctx.moveTo(X(b[0]),Z(z));ctx.lineTo(X(b[2]),Z(z));}ctx.stroke();ctx.restore();}}
 if(Pc.memorial){const [x,z]=Pc.memorial;if(over([x-8,z-8,x+8,z+8])){ctx.globalAlpha=.95;ctx.fillStyle=C.place;ctx.beginPath();ctx.arc(X(x),Z(z),6*sx,0,6.2832);ctx.fill();ctx.globalAlpha=.9;ctx.fillStyle='#a3c283';ctx.beginPath();ctx.arc(X(x),Z(z),3.4*sx,0,6.2832);ctx.fill();}}
 ctx.globalAlpha=1;}
// Limits, painted after the fields (so that a garden edge on a field shows its rough-grass band on the field side).
export function paintParcelLimitsV33(ctx,{Pc,X,Z,sx,over}){const C=PARCEL_COLORS;
 const seg=(a,b,col,wm,al,off=null)=>{const o=off?[off[0],off[1]]:[0,0];ctx.globalAlpha=al;ctx.strokeStyle=col;ctx.lineWidth=Math.max(.6,wm*sx);ctx.beginPath();ctx.moveTo(X(a[0]+o[0]),Z(a[1]+o[1]));ctx.lineTo(X(b[0]+o[0]),Z(b[1]+o[1]));ctx.stroke();};
 ctx.lineCap='round';
 for(const lot of Pc.lots){if(!over(lot.b))continue;for(const e of lot.edges){const n=e.n,ins=[-n[0]*.5,-n[1]*.5];
  if(e.kind==='fieldband'||e.kind==='fieldhedge')seg(e.a,e.b,C.band,4,.42,[n[0]*2,n[1]*2]);
  if(e.kind==='hedge'||e.kind==='fieldhedge'){seg(e.a,e.b,C.hedgeShade,e.kind==='fieldhedge'?3:1.6,.2,ins);seg(e.a,e.b,C.hedge,e.kind==='fieldhedge'?1.4:.7,.85,ins);}
  else if(e.kind==='wall'){seg(e.a,e.b,C.fenceShade,1.2,.22,ins);seg(e.a,e.b,C.wall,.5,.95,ins);}
  else if(e.kind==='fence'){seg(e.a,e.b,C.fenceShade,.8,.22,[ins[0]*1.6,ins[1]*1.6]);seg(e.a,e.b,C.fence,.35,.75,ins);}}}
 ctx.globalAlpha=1;}

// Activity sites, painted after the data surfaces: parking bays (lines 2,6 m apart along the long side of each car park over
// 800 m², near the camera only) and an implicit site fence along industrial and commercial perimeters over 5 000 m².
export function paintActivityV33(ctx,{P,X,Z,sx,over,detail,fence=true}){const toRing=p=>{const r=[];for(let i=0;i<p.length;i+=2)r.push([p[i],p[i+1]]);return r;};
 const flatArea=r=>{let s=0;for(let i=0,j=r.length-1;i<r.length;j=i++)s+=(r[j][0]-r[i][0])*(r[j][1]+r[i][1]);return Math.abs(s)/2;};
 ctx.lineCap='butt';
 for(const {o,b} of P.artificial){if(!over(b))continue;
  if(detail&&o.kind==='surface'&&o.t==='parking')for(const p of o.r){const r=toRing(p[0]);if(flatArea(r)<800)continue;let best=null;for(let i=0;i<r.length;i++){const a=r[i],c=r[(i+1)%r.length],L=Math.hypot(c[0]-a[0],c[1]-a[1]);if(!best||L>best.L)best={L,u:[(c[0]-a[0])/L,(c[1]-a[1])/L]};}
   const u=best.u,n=[-u[1],u[0]],pr=r.map(q=>q[0]*u[0]+q[1]*u[1]),pn=r.map(q=>q[0]*n[0]+q[1]*n[1]),a0=Math.min(...pr),a1=Math.max(...pr),n0=Math.min(...pn),n1=Math.max(...pn);
   ctx.save();ctx.beginPath();r.forEach((q,i)=>i?ctx.lineTo(X(q[0]),Z(q[1])):ctx.moveTo(X(q[0]),Z(q[1])));ctx.closePath();ctx.clip();ctx.globalAlpha=.42;ctx.strokeStyle='#ebe8e0';ctx.lineWidth=Math.max(.5,.14*sx);ctx.beginPath();
   // rows of bays 5 m deep on both sides of a 6 m aisle, repeated every 16 m across the car park
   for(let w=n0+1;w<n1-1;w+=16)for(const off of [0,11])for(let a=a0+1;a<a1-1;a+=2.6){const p0=[u[0]*a+n[0]*(w+off),u[1]*a+n[1]*(w+off)],p1=[u[0]*a+n[0]*(w+off+5),u[1]*a+n[1]*(w+off+5)];ctx.moveTo(X(p0[0]),Z(p0[1]));ctx.lineTo(X(p1[0]),Z(p1[1]));}
   ctx.stroke();ctx.restore();}
  if(fence&&o.kind==='perimetre'&&/industri|commerc|technique/.test(o.t))for(const p of o.r){const r=toRing(p[0]);if(flatArea(r)<5000)continue;ctx.lineJoin='round';
   ctx.globalAlpha=.3;ctx.strokeStyle='#c2c7a6';ctx.lineWidth=Math.max(.6,3*sx);ctx.beginPath();r.forEach((q,i)=>i?ctx.lineTo(X(q[0]),Z(q[1])):ctx.moveTo(X(q[0]),Z(q[1])));ctx.closePath();ctx.stroke();
   ctx.globalAlpha=.5;ctx.strokeStyle='#6f716c';ctx.lineWidth=Math.max(.5,.3*sx);ctx.stroke();}}
 ctx.globalAlpha=1;ctx.lineCap='round';}

// Field map (class weights and direction): plot lawns are « lawn » with the plot axis as mowing direction.
export function paintParcelFieldV33(ctxA,ctxB,{Pc,X,Z,over}){
 const path=(ctx,pts)=>{ctx.beginPath();pts.forEach((q,i)=>i?ctx.lineTo(X(q[0]),Z(q[1])):ctx.moveTo(X(q[0]),Z(q[1])));ctx.closePath();};
 for(const lot of Pc.lots){if(!over(lot.b)||lot.s.kind==='farm')continue;const ang=Math.atan2(lot.f[1],lot.f[0]);
  ctxA.fillStyle='rgb(0,0,255)';path(ctxA,lot.poly);ctxA.fill();ctxB.fillStyle=`rgb(${Math.round((Math.cos(2*ang)*.5+.5)*255)},${Math.round((Math.sin(2*ang)*.5+.5)*255)},0)`;path(ctxB,lot.poly);ctxB.fill();
  for(const zn of lot.zones){ctxA.fillStyle='rgb(0,0,0)';ctxB.fillStyle='rgb(128,128,0)';path(ctxA,zn.p);ctxA.fill();path(ctxB,zn.p);ctxB.fill();}}}

// ---- limits as geometry (BEAUTÉ, ÉQUILIBRÉ): clipped hedges and low walls, one mesh ----
// A garden hedge is 1,3–2 m high and 0,8 m wide, a field hedge 2,2–3,4 m and 1,4 m, a low wall 1 m and 0,4 m; pieces of
// about 3 m with a slight irregularity, a gap where a drive crosses the street limit, nothing on a road or a footprint.
export function buildLimitMeshV33(Pc,{heightAt,occupied}){const t=new Tri();let pieces=0;
 const hedgeCols=['#668f55','#6f9759','#5f8a51','#78a060'];
 for(const lot of Pc.lots)for(const [k,e] of lot.edges.entries()){if(!['hedge','fieldhedge','wall'].includes(e.kind))continue;
  const wall=e.kind==='wall',field=e.kind==='fieldhedge',key=lot.s.id+':'+k,H=wall?.95+.2*h01(key+'h'):field?2+1.2*h01(key+'h'):1.1+.5*h01(key+'h'),W=wall?.4:field?1.2:.6;
  const col=new THREE.Color(wall?'#d1c6b1':hedgeCols[Math.floor(h01(key+'c')*hedgeCols.length)]);
  const dx=e.b[0]-e.a[0],dz=e.b[1]-e.a[1],L=Math.hypot(dx,dz),u=[dx/L,dz/L],nIn=[-e.n[0],-e.n[1]],inset=W/2+.15,n=Math.max(1,Math.round(L/3));
  const trim=wall?0:Math.min(.9,L*.1);for(let p=0;p<n;p++){const s0=trim+p/n*(L-2*trim),s1=trim+(p+1)/n*(L-2*trim),sm=(s0+s1)/2;
   if(!wall&&!field&&n>3&&h01(key+'g'+p)<.1)continue;// a gap now and then
   const mx=e.a[0]+u[0]*sm+nIn[0]*inset,mz=e.a[1]+u[1]*sm+nIn[1]*inset;
   if(e.front&&lot.drive){const tv=dot([mx-lot.s.c[0],mz-lot.s.c[1]],lot.t);if(tv>lot.drive[0]-1.5&&tv<lot.drive[1]+1.5)continue;}
   if(occupied&&occupied(mx,mz,null))continue;const rn=Pc.roads.near(mx,mz,8);if(rn&&rn.d<rn.w/2+1.2)continue;
   const P=(s,side,y)=>{const x=e.a[0]+u[0]*s+nIn[0]*(inset+side*W/2),z=e.a[1]+u[1]*s+nIn[1]*(inset+side*W/2);return [x,heightAt(x,z)+y,z];};
   const j0=wall?0:(h01(key+p)-.5)*.3,j1=wall?0:(h01(key+(p+1))-.5)*.3,top0=H+j0,top1=H+j1,dark=col.clone().multiplyScalar(.72),lite=col.clone().multiplyScalar(wall?1.04:1.08);
   const a0=P(s0,-1,-.25),a1=P(s1,-1,-.25),b0=P(s0,1,-.25),b1=P(s1,1,-.25),A0=P(s0,-1,top0),A1=P(s1,-1,top1),B0=P(s0,1,top0),B1=P(s1,1,top1);
   t.quad(A0,A1,B1,B0,lite,null,[0,1,0]);t.quad(a0,a1,A1,A0,dark,null,[-nIn[0],0,-nIn[1]]);t.quad(b1,b0,B0,B1,dark,null,[nIn[0],0,nIn[1]]);
   if(p===0)t.quad(b0,a0,A0,B0,dark,null,[-u[0],0,-u[1]]);if(p===n-1)t.quad(a1,b1,B1,A1,dark,null,[u[0],0,u[1]]);pieces++;}}
 return {tri:t,pieces};}
