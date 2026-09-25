// V2.0 visible scene: assembles the frozen references (terrain V1.7, roads V1.8, rail V1.9, land cover V1.10, POI V1.11/V1.11.1)
// into one compact file for Three.js, in the local frame of src/geo.js (x east, z south, metres) with y = altitude NGF − yReference.
// Presentation only: no reference is rebuilt or corrected; geometry is converted, simplified for display (documented tolerance)
// and every object keeps the identifier of its source. Output: public/data/v2-scene.json.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fromL93} from './terrain-frame.mjs';
import {fromArrayBuffer} from 'geotiff';
import {projection} from '../src/geo.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const origin=read('public/data/maizieres.geojson').metadata.origin,project=projection(origin),terrain=read('public/data/terrain-threejs.json'),yRef=terrain.yReference;
const d1=v=>Math.round(v*10)/10,c2=v=>Math.round(v*100)/100;
const xz=q=>project(fromL93([q[0],q[1]])).map(d1);
// Douglas-Peucker in the display frame; the altitude is part of the distance for 3D lines so bridge profiles are kept.
function simplify(pts,tol,dim=2){if(pts.length<3)return pts;const keep=new Uint8Array(pts.length);keep[0]=keep[pts.length-1]=1;const stack=[[0,pts.length-1]];
 const dist=(p,a,b)=>{const n=dim;let ab=0,ap=0;for(let k=0;k<n;k++){ab+=(b[k]-a[k])**2;ap+=(p[k]-a[k])*(b[k]-a[k]);}const t=ab?Math.max(0,Math.min(1,ap/ab)):0;let d=0;for(let k=0;k<n;k++)d+=(p[k]-a[k]-t*(b[k]-a[k]))**2;return Math.sqrt(d);};
 while(stack.length){const [i,j]=stack.pop();let m=0,idx=-1;for(let k=i+1;k<j;k++){const dd=dist(pts[k],pts[i],pts[j]);if(dd>m){m=dd;idx=k;}}if(m>tol){keep[idx]=1;stack.push([i,idx],[idx,j]);}}
 return pts.filter((_,i)=>keep[i]);}
const line3=(ptsL93,tol=.15)=>simplify(ptsL93.map(q=>[...xz(q),c2(q[2]-yRef)]),tol,3).flat();
const ring2=(r,tol)=>simplify(r.map(xz),tol).flat();

// Roads V1.8 (road-splines: corrected profiles, bridges kept above the terrain).
const RS=read('unreal/roads/road-splines.json');
const roads=RS.splines.map(s=>({id:s.id,c:s.category,w:s.width,n:s.name||null,r:s.routeNumber||null,b:s.structure&&s.structure!=='sol'?1:0,p:line3(s.pointsL93)}));
// Rail V1.9: one line per physical track; structure flag per point (bridge deck profile).
const RL=read('unreal/rail/rail-splines.json'),rep=read('data-sources/rail/rail-report.json');
const rail=RL.splines.map(s=>({id:s.id,k:s.network,st:s.status,label:s.kindLabel,ref:s.trackRef||null,p:line3(s.pointsL93,.1)}));
const level=rep.levelCrossings.map(p=>({id:p.id,n:p.number,road:p.roadNames?.join(' / ')||null,p:[...xz(p.L93),c2((p.railZ??p.zTerrain)-yRef)]}));
const bridges=rep.structures.bridges.map(b=>({id:b.id,a:xz(b.startL93),b:xz(b.endL93),y:c2(Math.max(...b.deck.map(d=>d.zStart))-yRef)}));
// Land cover V1.10: polygons for the draped texture (display simplification 1 m) and hedges / water lines.
const poly=(file,key,attrs,tol=1)=>read(`unreal/landcover/${file}`)[key].map(o=>({id:o.id,...attrs(o),r:o.ringsL93.map(p=>p.map(r=>ring2(r,tol)).filter(r=>r.length>=6)).filter(p=>p.length)})).filter(o=>o.r.length);
const agri=poly('agricultural-polygons.json','objects',o=>({t:o.landuse_type,crop:o.crop_type,year:o.crop_year,ha:Math.round(o.areaM2/100)/100}));
const wood=poly('woodland-polygons.json','objects',o=>({t:o.type,ha:Math.round(o.areaM2/100)/100}));
const hedgePoly=poly('woodland-polygons.json','hedgePolygons',()=>({}),.2);
const water=poly('water-polygons.json','objects',o=>({t:o.type,name:o.name||null}));
const artificial=poly('artificial-surfaces.json','objects',o=>({t:o.class,kind:o.kind==='surface'?'surface':'perimetre',name:o.name||null}));
const H=read('unreal/landcover/hedge-splines.json');
const hedges=H.hedges.map(h=>({id:h.id,w:h.widthM||null,h:h.heightM||null,p:line3(h.pointsL93,.3)}));
const WL=read('unreal/landcover/water-lines.json');
const widthOf=c=>/15 et 50/.test(c)?18:/5 et 15/.test(c)?7:/0 et 5/.test(c)?2.5:4;
const waterLines=WL.lines.filter(l=>l.position!=='souterrain').map(l=>({id:l.id,n:l.name||null,w:widthOf(l.widthClass||''),perm:l.persistance==='Permanent'?1:0,p:simplify(l.pointsL93.map(xz),.8).flat()}));
// Built-up area of the village (BD TOPO zone d'habitation, official limit) for a light tint of the texture.
const A=read('unreal/poi/areas.json').areas.filter(a=>a.type==='zone_batie');
const village=A.map(a=>({id:a.id,r:a.ringsL93.map(p=>p.map(r=>ring2(r,2)))}));
// V2 display terrain: 10 m working grid over the whole frozen V1.7 extent (terrain-threejs.* only covers the commune + 150 m), derived
// from the V1.7 GeoTIFF by bilinear sampling, same encoding and same yReference; the V1.7 files are untouched.
const {TERRAIN_GRID:G,toL93}=await import('./terrain-frame.mjs');
const tb=fs.readFileSync('unreal/terrain/maizieres-mnt-lidarhd-1m-lamb93-ign69.tif'),[grid]=await (await (await fromArrayBuffer(tb.buffer.slice(tb.byteOffset,tb.byteOffset+tb.length))).getImage()).readRasters();
const at=(E,N)=>{const i=E-G.west,j=G.north-N,i0=Math.floor(i),j0=Math.floor(j);if(i0<0||j0<0||i0>=G.cols-1||j0>=G.rows-1)return NaN;const fx=i-i0,fy=j-j0,k=j0*G.cols+i0;return (grid[k]*(1-fx)+grid[k+1]*fx)*(1-fy)+(grid[k+G.cols]*(1-fx)+grid[k+G.cols+1]*fx)*fy;};
const k0=6371008.8*Math.PI/180,c0=Math.cos(origin[1]*Math.PI/180),localToL93=([x,z])=>toL93([origin[0]+x/(k0*c0),origin[1]-z/k0]);
const corners=[[G.west,G.north],[G.east,G.north],[G.east,G.south],[G.west,G.south]].map(q=>project(fromL93(q)));
const STEP=10,gx0=Math.ceil((Math.max(corners[0][0],corners[3][0])+1)/STEP)*STEP,gx1=Math.floor((Math.min(corners[1][0],corners[2][0])-1)/STEP)*STEP,gz0=Math.ceil((Math.max(corners[0][1],corners[1][1])+1)/STEP)*STEP,gz1=Math.floor((Math.min(corners[2][1],corners[3][1])-1)/STEP)*STEP;
const tc=(gx1-gx0)/STEP+1,tr=(gz1-gz0)/STEP+1,zBase=terrain.zBase-10,u16=new Uint16Array(tc*tr);let noData=0;
for(let r=0;r<tr;r++)for(let c=0;c<tc;c++){const [E,N]=localToL93([gx0+c*STEP,gz0+r*STEP]),v=at(E,N);if(v!==v){u16[r*tc+c]=65535;noData++;}else u16[r*tc+c]=Math.round((v-zBase)*100);}
let seed=10220;const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};let ss=0,mx=0,sn=0;
for(let s=0;s<100000;s++){const x=gx0+rnd()*(tc-1)*STEP,z=gz0+rnd()*(tr-1)*STEP,c=Math.floor((x-gx0)/STEP),r=Math.floor((z-gz0)/STEP),fx=(x-gx0)/STEP-c,fz=(z-gz0)/STEP-r,g=(a,b)=>u16[b*tc+a]/100+zBase;if(c>=tc-1||r>=tr-1)continue;
 const w=(g(c,r)*(1-fx)+g(c+1,r)*fx)*(1-fz)+(g(c,r+1)*(1-fx)+g(c+1,r+1)*fx)*fz,[E,N]=localToL93([x,z]),v=at(E,N);if(v!==v)continue;const e=w-v;ss+=e*e;sn++;mx=Math.max(mx,Math.abs(e));}
fs.writeFileSync('public/data/v2-terrain.bin',Buffer.from(u16.buffer));
fs.writeFileSync('public/data/v2-terrain.json',JSON.stringify({source:'IGN LiDAR HD MNT (grille 1 m du référentiel V1.7, unreal/terrain/maizieres-mnt-lidarhd-1m-lamb93-ign69.tif), rééchantillonnage bilinéaire',sourceSha256:sha('unreal/terrain/maizieres-mnt-lidarhd-1m-lamb93-ign69.tif'),
 frame:'repère local Three.js de src/geo.js (x est, z sud, mètres)',scope:'rectangle inscrit dans l’emprise V1.7 complète (V2.0) ; terrain-threejs.* (commune + 150 m) reste inchangé pour ?diagnostic=terrain',
 x0:gx0,z0:gz0,step:STEP,cols:tc,rows:tr,encoding:terrain.encoding,zBase,noData,yReference:yRef,vsGrid1m:{rmse:Math.round(Math.sqrt(ss/sn)*1000)/1000,max:Math.round(mx*100)/100,samples:sn}},null,1)+'\n');
console.log('terrain V2',tc,tr,'noData',noData,'rmse',Math.sqrt(ss/sn).toFixed(3));
const out={metadata:{version:'2.0',generatedBy:'scripts/build-v2.mjs',frame:'repère local Three.js de src/geo.js (x est, z sud, m) ; y = altitude NGF-IGN69 − yReference',origin,yReference:yRef,
 simplification:{lines3d:'Douglas-Peucker 3D 0,15 m (routes), 0,10 m (rail), 0,30 m (haies)',polygons:'Douglas-Peucker 1 m (texture), 2 m (zone bâtie)',waterLines:'0,8 m'},
 sources:Object.fromEntries(['unreal/roads/road-splines.json','unreal/rail/rail-splines.json','data-sources/rail/rail-report.json','unreal/landcover/agricultural-polygons.json','unreal/landcover/woodland-polygons.json','unreal/landcover/water-polygons.json','unreal/landcover/artificial-surfaces.json','unreal/landcover/hedge-splines.json','unreal/landcover/water-lines.json','unreal/poi/areas.json','public/data/terrain-threejs.json'].map(f=>[f,sha(f)]))},
 roads,rail,levelCrossings:level,railBridges:bridges,agriculture:agri,woodland:wood,hedgePolygons:hedgePoly,water,waterLines,artificial,hedges,village};
fs.writeFileSync('public/data/v2-scene.json',JSON.stringify(out)+'\n');
console.log(JSON.stringify({bytes:fs.statSync('public/data/v2-scene.json').size,roads:roads.length,roadPoints:roads.reduce((s,r)=>s+r.p.length/3,0),rail:rail.length,levelCrossings:level.length,bridges:bridges.length,agriculture:agri.length,woodland:wood.length,hedgePolygons:hedgePoly.length,water:water.length,waterLines:waterLines.length,artificial:artificial.length,hedges:hedges.length,village:village.length}));
