// V3.4 — preparation of the real cadastral parcels (offline, reproducible). npm run build:cadastre-v34
// Input : data-sources/cadastre-parcelles-v34 (PCI Vecteur pages as received, CRS84) + existing frozen layers, read only.
// Output: public/data/cadastre-parcels-v3.4.json (render copy), docs/freeze/MLGU_CADASTRAL_PARCELS_V1.json (registry),
//         docs/audit/V3.4_CADASTRAL_ANOMALIES.csv, data-sources/cadastre-parcelles-v34/build-report.json.
// Frames: source CRS84 (lon, lat) → Lambert-93 (proj4, scripts/terrain-frame.mjs) for metric checks and areas, and → the
// engine's local frame (src/geo.js projection: x east, z south, metres, origin 3.7890245 / 48.5097657), the frame of every
// other layer. No smoothing, no displacement: the render copy only rounds the local coordinates to the centimetre.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import pc from 'polygon-clipping';
import {projection} from '../../src/geo.js';
import {toL93} from '../terrain-frame.mjs';

const DIR='data-sources/cadastre-parcelles-v34';
// --out <dir>: writes the four outputs under <dir> (same relative paths) — used by check:cadastre-freeze to prove determinism
const OUT=process.argv[2]==='--out'?process.argv[3]:'.',out=p=>`${OUT}/${p}`;
const J=async f=>JSON.parse(await fs.readFile(f,'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=await J(`${DIR}/source-manifest.json`),src=manifest.canonical;
const scene=await J('public/data/v2-scene.json'),ORIGIN=scene.metadata.origin,project=projection(ORIGIN);
const r2=v=>Math.round(v*100)/100;

// ---------- 1. read the pages exactly as received ----------
const raw=[];for(const pg of src.pages){const b=gunzipSync(await fs.readFile(pg.file));if(sha(b)!==pg.sha256)throw Error('SHA différent : '+pg.file);raw.push(...JSON.parse(b.toString('utf8')).features);}
raw.sort((a,b)=>a.properties.gid-b.properties.gid);

// ---------- 2. geometry checks (Lambert-93, metres) ----------
const ringArea=r=>{let s=0;for(let i=0,j=r.length-1;i<r.length;j=i++)s+=(r[j][0]-r[i][0])*(r[j][1]+r[i][1]);return s/2;};// >0 clockwise in x-right/y-up
const inRing=(p,r)=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
const segX=(a,b,c,d)=>{const o=(p,q,r)=>Math.sign((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]));return o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0;};
const selfX=r=>{const n=r.length-1;let k=0;for(let i=0;i<n;i++)for(let j=i+2;j<n;j++){if(i===0&&j===n-1)continue;if(segX(r[i],r[i+1],r[j],r[j+1]))k++;}return k;};
const anomalies=[],P=[];
for(const f of raw){const pr=f.properties,g=f.geometry,polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
 const a={notes:[]};if(!polys.length){anomalies.push({id:pr.idu,type:'géométrie absente'});continue;}
 let open=0,dup=0,short=0,sx=0,holesOut=0;const l93=polys.map(poly=>poly.map(ring=>{if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])open++;
  const out=[];for(const q of ring){const e=toL93(q);if(out.length&&out.at(-1)[0]===e[0]&&out.at(-1)[1]===e[1]){dup++;continue;}out.push(e);}
  if(out[0][0]!==out.at(-1)[0]||out[0][1]!==out.at(-1)[1])out.push(out[0]);if(out.length<4)short++;return out;}));
 for(const poly of l93){sx+=selfX(poly[0]);for(const h of poly.slice(1))if(!inRing(h[0],poly[0]))holesOut++;}
 const area=l93.reduce((s,poly)=>s+Math.abs(ringArea(poly[0]))-poly.slice(1).reduce((t,h)=>t+Math.abs(ringArea(h)),0),0);
 const local=polys.map(poly=>poly.map(ring=>{const out=[];for(const q of ring){const p=project(q).map(r2);if(out.length&&out.at(-1)[0]===p[0]&&out.at(-1)[1]===p[1])continue;out.push(p);}if(out[0][0]!==out.at(-1)[0]||out[0][1]!==out.at(-1)[1])out.push(out[0]);return out;}));
 P.push({id:pr.idu,gid:pr.gid,section:pr.section,feuille:pr.feuille,numero:pr.numero,comAbs:pr.com_abs,contenance:pr.contenance,area,l93,local,parts:polys.length,holes:polys.reduce((s,p)=>s+p.length-1,0),open,dup,short,selfX:sx,holesOut});}

// ---------- 3. projection control: our CRS84 → L93 against the L93 copy served by the IGN ----------
let proj={n:0,maxM:0,meanM:0};
if(manifest.l93Control){const ctl=JSON.parse(gunzipSync(await fs.readFile(manifest.l93Control.file)).toString('utf8')).features;const byId=new Map(raw.map(f=>[f.properties.idu,f]));let sum=0;
 for(const f of ctl){const o=byId.get(f.properties.idu);if(!o)continue;const A=f.geometry.coordinates.flat(2),B=o.geometry.coordinates.flat(2);if(A.length!==B.length)continue;
  for(let i=0;i<A.length;i++){const e=toL93(B[i]),d=Math.hypot(e[0]-A[i][0],e[1]-A[i][1]);proj.maxM=Math.max(proj.maxM,d);sum+=d;proj.n++;}}
 proj.meanM=proj.n?sum/proj.n:0;}

// ---------- 4. overlaps between parcels, coverage of the commune ----------
const bbox=r=>{let b=[Infinity,Infinity,-Infinity,-Infinity];for(const q of r){b[0]=Math.min(b[0],q[0]);b[1]=Math.min(b[1],q[1]);b[2]=Math.max(b[2],q[0]);b[3]=Math.max(b[3],q[1]);}return b;};
const mpArea=mp=>mp.reduce((s,poly)=>s+Math.abs(ringArea(poly[0]))-poly.slice(1).reduce((t,h)=>t+Math.abs(ringArea(h)),0),0);
for(const p of P){p.bb=bbox(p.local.flatMap(poly=>poly[0]));p.bbL=bbox(p.l93.flatMap(poly=>poly[0]));}
const grid=(items,key,cell)=>{const g=new Map();items.forEach((it,i)=>{const b=key(it);for(let x=Math.floor(b[0]/cell);x<=Math.floor(b[2]/cell);x++)for(let z=Math.floor(b[1]/cell);z<=Math.floor(b[3]/cell);z++){const k=x+','+z;if(!g.has(k))g.set(k,[]);g.get(k).push(i);}});
 return b=>{const s=new Set();for(let x=Math.floor(b[0]/cell);x<=Math.floor(b[2]/cell);x++)for(let z=Math.floor(b[1]/cell);z<=Math.floor(b[3]/cell);z++)for(const i of g.get(x+','+z)||[])s.add(i);return [...s];};};
const near=grid(P,p=>p.bbL,100),ov=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
let overlapPairs=0,overlapArea=0,maxOverlap=0;const overlapList=[];
P.forEach((p,i)=>{for(const j of near(p.bbL)){if(j<=i||!ov(p.bbL,P[j].bbL))continue;let x;try{x=pc.intersection(p.l93,P[j].l93);}catch{continue;}const a=mpArea(x);if(a>.01){overlapPairs++;overlapArea+=a;maxOverlap=Math.max(maxOverlap,a);if(a>=1)overlapList.push([p.id,P[j].id,a]);}}});
const communeGeo=await J('public/data/commune.geojson'),cg=communeGeo.geometry||communeGeo.features[0].geometry;
const communeL93=(cg.type==='Polygon'?[cg.coordinates]:cg.coordinates).map(poly=>poly.map(r=>r.map(toL93)));
let U=P.map(p=>p.l93);while(U.length>1){const n=[];for(let i=0;i<U.length;i+=8)n.push(pc.union(...U.slice(i,i+8)));U=n;}const union=U[0];
const unionArea=mpArea(union),communeArea=mpArea(communeL93),inside=mpArea(pc.intersection(union,communeL93));
const coverage={communeContour:'public/data/commune.geojson (geo.api.gouv.fr, contour)',communeAreaHa:communeArea/1e4,parcelsUnionHa:unionArea/1e4,parcelsInsideContourHa:inside/1e4,
 parcelsOutsideContourHa:(unionArea-inside)/1e4,notCadastredInsideHa:(communeArea-inside)/1e4,coverageOfContour:inside/communeArea,sumGraphicHa:P.reduce((s,p)=>s+p.area,0)/1e4,sumContenanceHa:P.reduce((s,p)=>s+(p.contenance||0),0)/1e4};

// ---------- 5. buildings ↔ parcels (local frame, area of intersection) ----------
const bfiles=['public/data/buildings.geojson','public/data/buildings-additions-v2.0.1.geojson','public/data/buildings-manual-v2.2.geojson'];
const B=[];for(const f of bfiles)for(const ft of (await J(f)).features){const g=ft.geometry,polys=(g.type==='Polygon'?[g.coordinates]:g.coordinates).map(poly=>poly.map(r=>r.map(q=>project(q))));
 B.push({id:ft.properties.id,inCommune:ft.properties.inCommune!==false,layer:f.includes('manual')?'manuel V2.2':f.includes('additions')?'ajout V2.0.1':'référentiel V1.6.2',local:polys,area:mpArea(polys),bb:bbox(polys.flatMap(p=>p[0]))});}
const nearL=grid(P,p=>p.bb,100),LINK=.05;
for(const b of B){b.links=[];for(const i of nearL(b.bb)){if(!ov(b.bb,P[i].bb))continue;let x;try{x=pc.intersection(b.local,P[i].local);}catch{continue;}const a=mpArea(x);if(a>0)b.links.push({i,share:a/b.area});}
 b.links.sort((u,v)=>v.share-u.share);b.covered=b.links.reduce((s,l)=>s+l.share,0);b.linked=b.links.filter(l=>l.share>=LINK);
 b.kind=b.linked.length===0?'aucune':b.linked.length===1?'unique':'multiple';
 // a second parcel under 20 % of the footprint reads as an overflow (the cadastre / BD TOPO shift is about 1 m), above as a real straddle
 b.sub=b.kind!=='multiple'?null:b.linked[1].share<.2?'débord mineur':'à cheval';}
// cadastre ↔ BD TOPO offset, measured on the cadastral buildings of the same producer (PCI batiment, same snapshot box)
const pciB=(await J('data-sources/cadastre/pci-express-batiment.geojson')).features.map(f=>{const g=f.geometry,polys=(g.type==='Polygon'?[g.coordinates]:g.coordinates).map(poly=>poly.map(r=>r.map(q=>project(q))));return {local:polys,bb:bbox(polys.flatMap(p=>p[0])),area:mpArea(polys)};});
const nearPci=grid(pciB,o=>o.bb,60),centroid=mp=>{let A=0,x=0,z=0;for(const poly of mp)for(const [k,r] of poly.entries()){const s=k?-1:1;for(let i=0,j=r.length-1;i<r.length;j=i++){const f=r[j][0]*r[i][1]-r[i][0]*r[j][1];A+=s*f;x+=s*(r[j][0]+r[i][0])*f;z+=s*(r[j][1]+r[i][1])*f;}}return [x/(3*A),z/(3*A)];};
const offsets=[];for(const b of B.filter(b=>b.layer==='référentiel V1.6.2'&&b.area>=40)){let best=null;for(const i of nearPci(b.bb)){const o=pciB[i];if(!ov(b.bb,o.bb))continue;let x;try{x=pc.intersection(b.local,o.local);}catch{continue;}const a=mpArea(x),iou=a/(b.area+o.area-a);if(iou>.6&&(!best||iou>best.iou))best={iou,o};}
 if(best){const c1=centroid(b.local),c2=centroid(best.o.local);offsets.push([c2[0]-c1[0],c2[1]-c1[1]]);}}
const q=(arr,p)=>{const s=[...arr].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(p*(s.length-1)))];};
const offs=offsets.map(o=>Math.hypot(o[0],o[1]));
const offset={method:'centroïde de l’empreinte BD TOPO (référentiel V1.6.2, ≥ 40 m²) contre le bâtiment cadastral PCI de même producteur que les parcelles, appariés par IoU > 0,6',pairs:offsets.length,
 medianDx:q(offsets.map(o=>o[0]),.5),medianDz:q(offsets.map(o=>o[1]),.5),p50:q(offs,.5),p90:q(offs,.9),p99:q(offs,.99),max:Math.max(...offs)};

// ---------- 6. parcel kind (for the render style only — never a land-use claim) ----------
const arch=new Map((await J('public/data/building-architecture-v2.3.json')).buildings.map(a=>[a.buildingId,a.buildingClass]));
const poi=await J('public/data/poi.json'),CIVIC_POI=['poi:mairie','poi:ecole-primaire','poi:salle-polyvalente','poi:eglise-saint-denis','poi:cpi','poi:maison-des-associations'];
const civicIds=new Set(CIVIC_POI.flatMap(id=>poi.pois.find(p=>p.id===id)?.building_ids||[]));
const classOf=id=>{const c=arch.get(id.split('#')[0])||'UNKNOWN';if(civicIds.has(id)||['PUBLIC','HERITAGE','RELIGIOUS'].includes(c))return 'civic';if(/^RES_/.test(c))return 'res';if(c==='FARM')return 'farm';if(['INDUSTRIAL','COMMERCIAL','HANGAR','SILO_TANK'].includes(c))return 'activity';return 'annex';};
for(const p of P){p.buildings=[];p.main=[];}
for(const b of B){for(const l of b.linked)P[l.i].buildings.push({id:b.id,share:+l.share.toFixed(3)});if(b.linked.length&&b.linked[0].share>=.5)P[b.linked[0].i].main.push(b.id);}
const flatPolys=list=>list.flatMap(o=>o.r.map(poly=>poly.map(fr=>{const r=[];for(let i=0;i<fr.length;i+=2)r.push([fr[i],fr[i+1]]);return r;})));
const LC={agri:flatPolys(scene.agriculture),wood:flatPolys(scene.woodland),water:flatPolys(scene.water),village:flatPolys(scene.village),
 ind:flatPolys(scene.artificial.filter(a=>a.kind==='perimetre'&&/industri|commerc|technique/.test(a.t)))};
const lcNear=Object.fromEntries(Object.entries(LC).map(([k,v])=>[k,grid(v,poly=>bbox(poly[0]),200)]));
for(const p of P){p.lc={};for(const [k,polys] of Object.entries(LC)){let a=0;for(const i of lcNear[k](p.bb)){const poly=polys[i];if(!ov(p.bb,bbox(poly[0])))continue;try{a+=mpArea(pc.intersection(p.local,[poly]));}catch{}}p.lc[k]=+Math.min(1,a/Math.max(1e-9,mpArea(p.local))).toFixed(3);}
 const cls=new Set(p.main.map(classOf));p.kind=cls.has('civic')?'civic':cls.has('res')?'res':cls.has('farm')?'farm':cls.has('activity')?'activity':cls.has('annex')?'annex':p.lc.water>=.5?'water':p.lc.wood>=.5?'wood':p.lc.agri>=.5?'field':'open';
 // a parcel of an activity site (half in an industrial / commercial / technical perimeter) with activity buildings stays a site,
 // even with a dwelling on it (caretaker's house)
 if(p.lc.ind>=.5&&cls.has('activity'))p.kind='activity';
 // the domestic band of the render only surrounds the buildings of the parcel's own family (houses and annexes of a home,
 // the farm buildings of a farm), never a hall
 const fam={res:['res','annex'],civic:['civic','annex'],farm:['farm','annex','res']}[p.kind];p.band=fam?p.main.filter(id=>fam.includes(classOf(id))):[];
 // inside an industrial, commercial or technical perimeter, an unbuilt or annex-only parcel is a yard of the site, not a garden
 if((p.kind==='open'||p.kind==='annex')&&p.lc.ind>=.5)p.kind='yard';}

// ---------- 7. sectors (nearest named place within 900 m) ----------
const SECT=[['centre-bourg','poi:centre-bourg'],['Poussey','poi:poussey'],['Les Granges','poi:les-granges'],['La Glacière','poi:glaciere']].map(([n,id])=>({n,c:project(poi.pois.find(p=>p.id===id).lonlat)}));
const sectorOf=c=>{let best=null;for(const s of SECT){const d=Math.hypot(c[0]-s.c[0],c[1]-s.c[1]);if(d<900&&(!best||d<best.d))best={n:s.n,d};}return best?.n||'campagne';};
for(const p of P)p.sector=sectorOf([(p.bb[0]+p.bb[2])/2,(p.bb[1]+p.bb[3])/2]);

// ---------- 8. limit topology: shared vertex table, T-junctions split, edges deduplicated ----------
const V=[],vkey=new Map(),vid=q=>{const k=Math.round(q[0]*100)+','+Math.round(q[1]*100);let i=vkey.get(k);if(i===undefined){i=V.length;vkey.set(k,i);V.push([Math.round(q[0]*100)/100,Math.round(q[1]*100)/100]);}return i;};
for(const p of P)p.rings=p.local.map(poly=>poly.map(r=>{const out=[];for(const q of r.slice(0,-1)){const i=vid(q);if(out.at(-1)!==i)out.push(i);}if(out.length>1&&out[0]===out.at(-1))out.pop();return out;}));
const vgrid=new Map();V.forEach((q,i)=>{const k=Math.floor(q[0]/20)+','+Math.floor(q[1]/20);if(!vgrid.has(k))vgrid.set(k,[]);vgrid.get(k).push(i);});
const onSeg=(a,b)=>{const A=V[a],Bv=V[b],L=Math.hypot(Bv[0]-A[0],Bv[1]-A[1]);if(L<.05)return [];const ux=(Bv[0]-A[0])/L,uz=(Bv[1]-A[1])/L,hits=[];
 for(let x=Math.floor(Math.min(A[0],Bv[0])/20);x<=Math.floor(Math.max(A[0],Bv[0])/20);x++)for(let z=Math.floor(Math.min(A[1],Bv[1])/20);z<=Math.floor(Math.max(A[1],Bv[1])/20);z++)for(const i of vgrid.get(x+','+z)||[]){if(i===a||i===b)continue;const dx=V[i][0]-A[0],dz=V[i][1]-A[1],t=dx*ux+dz*uz;if(t<=.02||t>=L-.02)continue;if(Math.abs(dx*uz-dz*ux)<=.02)hits.push([t,i]);}
 return hits.sort((u,v)=>u[0]-v[0]).map(h=>h[1]);};
const E=new Map();let tSplits=0;
P.forEach((p,pi)=>{for(const poly of p.rings)for(const r of poly)for(let k=0;k<r.length;k++){const a=r[k],b=r[(k+1)%r.length],mid=onSeg(a,b);tSplits+=mid.length;const chain=[a,...mid,b];
 for(let m=0;m<chain.length-1;m++){const u=chain[m],v=chain[m+1];if(u===v)continue;const key=u<v?u+'-'+v:v+'-'+u;let e=E.get(key);if(!e){e={a:Math.min(u,v),b:Math.max(u,v),p:[]};E.set(key,e);}if(!e.p.includes(pi))e.p.push(pi);}}});
const edges=[...E.values()],edgeStats={edges:edges.length,shared:edges.filter(e=>e.p.length===2).length,single:edges.filter(e=>e.p.length===1).length,more:edges.filter(e=>e.p.length>2).length,tJunctionSplits:tSplits,vertices:V.length,roundingMaxM:Math.SQRT2*.005};

// ---------- 9. anomalies ----------
const csv=[];const add=(id,sector,type,gap,cmp,decision,why)=>csv.push([id,sector,type,gap,cmp,decision,why]);
for(const p of P){if(p.holes)add(p.id,p.sector,'parcelle trouée',`${p.holes} trou(s)`,'—','conservé','anneaux intérieurs du PCI respectés à l’import et au rendu');
 if(p.open)add(p.id,p.sector,'anneau non fermé',`${p.open} anneau(x)`,'—','fermé dans la copie dérivée','ajout du premier sommet en fin d’anneau');
 if(p.dup)add(p.id,p.sector,'sommets consécutifs en double',`${p.dup}`,'—','supprimés dans la copie dérivée','sans effet sur le contour');
 if(p.selfX)add(p.id,p.sector,'auto-intersection',`${p.selfX} croisement(s)`,'—','conservé, signalé','le contour source n’est pas réparé à l’œil');
 if(p.holesOut)add(p.id,p.sector,'trou hors de l’anneau extérieur',`${p.holesOut}`,'—','conservé, signalé','géométrie source');
 const d=p.contenance?p.area-p.contenance:0;if(p.contenance&&Math.abs(d)>Math.max(100,.1*p.contenance))add(p.id,p.sector,'surface graphique ≠ contenance fiscale',`${d>0?'+':''}${Math.round(d)} m² (${Math.round(100*d/p.contenance)} %)`,'contenance DGFiP','conservé','la contenance est une donnée fiscale ; le contour graphique est seul utilisé pour le rendu');}
for(const [a,b,ar] of overlapList)add(`${a}+${b}`,P.find(p=>p.id===a).sector,'chevauchement entre parcelles',`${ar.toFixed(1)} m²`,'parcelle voisine','conservé, signalé','pas de retouche du cadastre source');
for(const b of B){const sec=sectorOf([(b.bb[0]+b.bb[2])/2,(b.bb[1]+b.bb[3])/2]);
 if(b.kind==='multiple')add(b.linked.map(l=>P[l.i].id).join('+'),sec,b.sub==='à cheval'?'bâtiment à cheval sur plusieurs parcelles':'bâtiment débordant sur une parcelle voisine (< 20 %)',`${b.id} : `+b.linked.map(l=>Math.round(100*l.share)+' %').join(' / '),'empreinte BD TOPO / '+b.layer,'aucune attribution arbitraire',b.sub==='à cheval'?'relation géométrique multiple conservée dans le registre':'relation multiple conservée ; débord compatible avec le décalage cadastre / BD TOPO');
 else if(b.kind==='aucune'&&b.inCommune)add('',sec,'bâtiment de la commune sans parcelle',`${b.id} : ${Math.round(100*b.covered)} % de l’empreinte couverts`,'empreinte BD TOPO / '+b.layer,'bâtiment conservé, aucune parcelle inventée','emprise non cadastrée ou décalage des sources');}
add('(commune)','toutes','décalage cadastre / BD TOPO',`médiane ${offset.p50.toFixed(2)} m, 90 % ≤ ${offset.p90.toFixed(2)} m (${offset.pairs} paires)`,'bâti PCI (même producteur) / empreintes BD TOPO','aucun déplacement','les géométries gelées et le cadastre source restent à leur place ; décalage documenté');
add('(commune)','toutes','emprise hors du contour communal geo.api.gouv.fr',`${coverage.parcelsOutsideContourHa.toFixed(2)} ha`,'contour public/data/commune.geojson','conservé','le contour communal du projet est une généralisation ; les parcelles PCI font foi pour leur commune');

// ---------- 10. outputs ----------
const stats={parcels:{raw:raw.length,imported:P.length,multiPart:P.filter(p=>p.parts>1).length,withHoles:P.filter(p=>p.holes).length,holes:P.reduce((s,p)=>s+p.holes,0),
  open:P.reduce((s,p)=>s+p.open,0),duplicateVertices:P.reduce((s,p)=>s+p.dup,0),tooShort:P.reduce((s,p)=>s+p.short,0),selfIntersecting:P.filter(p=>p.selfX).length,duplicateIds:raw.length-new Set(raw.map(f=>f.properties.idu)).size,
  sections:new Set(P.map(p=>p.section)).size,under5m2:P.filter(p=>p.area<5).length,areaM2:{total:Math.round(P.reduce((s,p)=>s+p.area,0)),median:Math.round(q(P.map(p=>p.area),.5)),p10:Math.round(q(P.map(p=>p.area),.1)),p90:Math.round(q(P.map(p=>p.area),.9)),min:+Math.min(...P.map(p=>p.area)).toFixed(1),max:Math.round(Math.max(...P.map(p=>p.area)))},
  byKind:Object.fromEntries(['res','civic','farm','activity','annex','yard','field','wood','water','open'].map(k=>[k,P.filter(p=>p.kind===k).length])),bySector:Object.fromEntries([...SECT.map(s=>s.n),'campagne'].map(n=>[n,P.filter(p=>p.sector===n).length]))},
 overlaps:{pairs:overlapPairs,areaM2:+overlapArea.toFixed(2),maxM2:+maxOverlap.toFixed(2),pairsOver1m2:overlapList.length},coverage,projection:{control:'300 parcelles servies en EPSG:2154 par le même WFS',comparedVertices:proj.n,maxDeviationM:proj.maxM,meanDeviationM:proj.meanM},
 buildings:{total:B.length,inCommune:B.filter(b=>b.inCommune).length,linkThreshold:LINK,unique:B.filter(b=>b.kind==='unique').length,multiple:B.filter(b=>b.kind==='multiple').length,multipleOverflow:B.filter(b=>b.sub==='débord mineur').length,multipleStraddle:B.filter(b=>b.sub==='à cheval').length,none:B.filter(b=>b.kind==='aucune').length,
  noneInCommune:B.filter(b=>b.kind==='aucune'&&b.inCommune).length,uniqueInCommune:B.filter(b=>b.kind==='unique'&&b.inCommune).length,multipleInCommune:B.filter(b=>b.kind==='multiple'&&b.inCommune).length,
  parcelsWithSeveralMainBuildings:P.filter(p=>p.main.length>1).length,parcelsWithBuildings:P.filter(p=>p.buildings.length).length},offset,topology:edgeStats,anomalies:csv.length};
const meta={version:'3.4',generatedBy:'scripts/cadastre-v34/build-cadastre.mjs',source:{name:src.source,service:src.service,layerTitle:src.layerTitle,edition:src.edition,filter:src.filter,retrievedAt:manifest.retrievedAt,
  pages:src.pages.map(p=>({file:p.file,sha256:p.sha256})),license:src.license,attribution:src.attribution,etalab:manifest.attempts},
 frame:'repère local de src/geo.js (x est, z sud, m), origine '+ORIGIN.join(', ')+' ; projection identique à celle des empreintes de bâtiments',rounding:'sommets arrondis au centimètre (écart ≤ 0,71 cm) ; aucun lissage, aucune simplification',
 caution:'Le plan cadastral est un document fiscal : il ne fixe pas les limites juridiques des propriétés (bornage) et peut présenter des écarts avec l’orthophoto et le bâti IGN.'};
const kindCode={res:'r',civic:'c',farm:'f',activity:'a',annex:'x',yard:'y',field:'g',wood:'w',water:'h',open:'o'};
const render={metadata:{...meta,counts:{parcels:P.length,vertices:V.length,edges:edges.length},stats:{byKind:stats.parcels.byKind,offset:{p50:offset.p50,p90:offset.p90}}},
 v:V.flat(),p:P.map(p=>({id:p.id,k:kindCode[p.kind],a:Math.round(p.area),m:p.band,r:p.rings})),e:edges.flatMap(e=>[e.a,e.b,e.p[0],e.p.length>1?e.p[1]:-1]),
 // relation of the buildings that are not in a single parcel (diagnostic only): d = overflow < 20 %, c = straddle, n = none
 bl:Object.fromEntries(B.filter(b=>b.kind!=='unique').map(b=>[b.id,b.kind==='aucune'?'n':b.sub==='à cheval'?'c':'d']))};
await fs.mkdir(out('public/data'),{recursive:true});await fs.writeFile(out('public/data/cadastre-parcels-v3.4.json'),JSON.stringify(render));
const registry={metadata:{...meta,name:'MLGU_CADASTRAL_PARCELS_V1',linkRule:`bâtiment lié à une parcelle quand l’intersection couvre au moins ${LINK*100} % de son empreinte ; relation géométrique, non juridique`,
  mainRule:'bâtiment principal d’une parcelle : celle-ci porte au moins 50 % de son empreinte',kindRule:'catégorie de rendu déduite du bâti principal (classe V2.3.1, équipements V2.9.2) puis de l’occupation du sol V1.10 (une parcelle non bâtie ou à annexes seules, à 50 % dans un périmètre industriel, commercial ou technique, est une cour de site) ; ce n’est pas une occupation réelle'},stats,
 parcels:P.map(p=>({parcel_id:p.id,section:p.section,feuille:p.feuille,numero:p.numero,com_abs:p.comAbs,contenance_m2:p.contenance,area_m2:+p.area.toFixed(1),kind:p.kind,sector:p.sector,landcover:p.lc,building_ids:p.buildings,main_building_ids:p.main,
  anomalies:[p.holes&&'trou',p.open&&'anneau ouvert',p.dup&&'sommets en double',p.selfX&&'auto-intersection'].filter(Boolean)})),
 buildings:B.filter(b=>b.kind!=='unique').map(b=>({id:b.id,layer:b.layer,inCommune:b.inCommune,relation:b.kind,detail:b.sub,covered:+b.covered.toFixed(3),parcels:b.links.filter(l=>l.share>=.01).map(l=>({parcel_id:P[l.i].id,share:+l.share.toFixed(3)}))}))};
// one parcel / building per line: readable diffs without the weight of a fully indented file
const lines=k=>'[\n'+registry[k].map(o=>JSON.stringify(o)).join(',\n')+'\n]';
await fs.mkdir(out('docs/freeze'),{recursive:true});
await fs.writeFile(out('docs/freeze/MLGU_CADASTRAL_PARCELS_V1.json'),`{"metadata":${JSON.stringify(registry.metadata,null,1)},\n"stats":${JSON.stringify(registry.stats,null,1)},\n"parcels":${lines('parcels')},\n"buildings":${lines('buildings')}}\n`);
const esc=v=>{const s=String(v??'');return /[",;\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
await fs.mkdir(out('docs/audit'),{recursive:true});await fs.writeFile(out('docs/audit/V3.4_CADASTRAL_ANOMALIES.csv'),'parcel_id,secteur,anomalie,ecart,source_comparee,decision,justification\n'+csv.map(r=>r.map(esc).join(',')).join('\n')+'\n');
await fs.mkdir(out(DIR),{recursive:true});await fs.writeFile(out(`${DIR}/build-report.json`),JSON.stringify(stats,null,1)+'\n');
if(OUT==='.')console.log(JSON.stringify(stats,null,1));
