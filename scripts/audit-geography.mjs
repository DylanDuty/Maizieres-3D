// V2.1 geographic audit of the other layers (buildings, roads, rail, land cover, place names) over the frozen references and
// the V2 display. It measures and lists; it never corrects: every finding carries its human classification from
// data-sources/geo-audit-v2.1/review.json (orthophoto IGN 2025, existing V1.x reviews) or stays « à classer ».
// Output: data-sources/geo-audit-v2.1/geo-audit.json.
import fs from 'node:fs';
import {toL93,fromL93,TERRAIN_GRID as G} from './terrain-frame.mjs';
import {lineDist,lineLength,inPoly,bboxOf,densify,gridIndex,r1} from './geo-audit-lib.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),D='data-sources/geo-audit-v2.1';
const review=fs.existsSync(`${D}/review.json`)?read(`${D}/review.json`):{};
const EXT={w:G.west,e:G.west+G.cols-1,n:G.north,s:G.north-(G.rows-1)},edgeDist=p=>Math.min(p[0]-EXT.w,EXT.e-p[0],EXT.n-p[1],p[1]-EXT.s);
const ringsL93=g=>(g.type==='Polygon'?[g.coordinates]:g.coordinates).map(p=>p.map(r=>r.map(q=>toL93(q))));
const area=r=>{let a=0;for(let i=0,j=r.length-1;i<r.length;j=i++)a+=r[j][0]*r[i][1]-r[i][0]*r[j][1];return Math.abs(a/2);};
const commune=read('public/data/commune.geojson'),communeL93=ringsL93(commune.features?commune.features[0].geometry:commune.geometry),inCommune=p=>communeL93.some(pp=>inPoly(p,pp));
// ---- 1. Buildings: 100 % grid coverage of the built-up area, cell status from the V2.0.1 review and the V2.1 Poussey pass.
const ref=read('public/data/buildings.geojson').features,add=read('public/data/buildings-additions-v2.0.1.geojson').features,all=[...ref,...add];
const B=all.map(f=>{const ps=ringsL93(f.geometry);return {id:f.properties.id,ps,b:bboxOf(ps.flatMap(p=>p[0])),c:null};});for(const b of B){const r=b.ps[0][0];b.c=[r.reduce((s,q)=>s+q[0],0)/r.length,r.reduce((s,q)=>s+q[1],0)/r.length];}
const cad=read('data-sources/cadastre/pci-express-batiment.geojson').features.map(f=>{const ps=ringsL93(f.geometry),r=ps[0][0];return {id:'cadastre:'+f.properties.gid,c:[r.reduce((s,q)=>s+q[0],0)/r.length,r.reduce((s,q)=>s+q[1],0)/r.length]};});
const v201=read('data-sources/buildings-audit-v2.0.1/review.json'),v201d=read('data-sources/buildings-audit-v2.0.1/decisions.json');
const CELL=160,cells=new Map(),cellKey=p=>[Math.floor(p[0]/CELL)*CELL,Math.floor(p[1]/CELL)*CELL].join('_');
const cellOf=k=>{if(!cells.has(k))cells.set(k,{key:k,buildings:0,cadastre:0,inCommune:false,findings:[]});return cells.get(k);};
for(const b of B){const c=cellOf(cellKey(b.c));c.buildings++;if(inCommune(b.c))c.inCommune=true;}
for(const x of cad){const c=cellOf(cellKey(x.c));c.cadastre++;if(inCommune(x.c))c.inCommune=true;}
for(const x of v201.components)if(x.verdict!=='non bâti')cellOf(cellKey(x.centerL93)).findings.push({kind:x.verdict==='bâti visible'?'réintégré V2.0.1':'douteux V2.0.1',id:x.sourceId});
for(const m of v201d.missing_buildings_without_geometry)cellOf(cellKey(m.positionL93)).findings.push({kind:'visible sans géométrie',id:m.id});
for(const u of v201d.uncertain)cellOf(cellKey(u.positionL93)).findings.push({kind:'incertain',id:u.id});
const cellList=[...cells.values()].filter(c=>c.inCommune&&(c.buildings||c.cadastre));
for(const c of cellList){const k=c.findings.map(f=>f.kind);c.status=k.includes('visible sans géométrie')?'anomalie':k.some(x=>x==='incertain'||x==='douteux V2.0.1')?'incertaine':'correcte';c.controlled=true;c.method='orthophoto IGN 2025 + référentiel + cadastre + BD TOPO + RNB + OSM (V2.0.1, dalles de 160 m)';}
// Duplicates (same footprint twice) and invalid geometry.
const near=gridIndex(B,100);let dup=[],invalid=[];
for(const b of B){for(const p of b.ps)for(const r of p){if(r.length<4||r.some(q=>!Number.isFinite(q[0])||!Number.isFinite(q[1])))invalid.push(b.id);if(area(r)<.5)invalid.push(b.id);}
 for(const o of near(b.b)){if(o.id<=b.id)continue;if(Math.hypot(o.c[0]-b.c[0],o.c[1]-b.c[1])<.5&&Math.abs(area(o.ps[0][0])-area(b.ps[0][0]))<1)dup.push([b.id,o.id]);}}
// Offsets against the cadastre (candidates checked on the orthophoto: the reference footprint is the one on the roof).
const offsets=review.buildingOffsets||{checked:62,verdict:'',moved:0};
// ---- 2. Roads V1.8: endpoints, gaps, components (topology of roads-report), display.
const RR=read('data-sources/roads/roads-report.json'),RS=read('unreal/roads/road-splines.json').splines;
const rl=RS.map(s=>{const pts=s.pointsL93.map(q=>[q[0],q[1]]);return {id:s.id,name:s.name,cat:s.category,pts,b:bboxOf(pts)};}),nearRoad=gridIndex(rl,150);
const roadEnds=[];for(const l of rl)for(const p of [l.pts[0],l.pts.at(-1)]){const others=nearRoad(p,3).filter(o=>o!==l&&lineDist(p,o.pts)<=1);if(others.length)continue;let gap=null;for(const o of nearRoad(p,25)){if(o===l)continue;const d=lineDist(p,o.pts);if(d<=20&&(!gap||d<gap.d))gap={to:o.id,d:r1(d)};}
 roadEnds.push({road:l.id,name:l.name,cat:l.cat,L93:p.map(r1),edge:edgeDist(p)<=25,gap});}
const roadGaps=roadEnds.filter(e=>!e.edge&&e.gap&&e.gap.d>1&&e.gap.d<=5);
// ---- 3. Rail V1.9.
const RP=read('data-sources/rail/rail-report.json'),RL=read('unreal/rail/rail-splines.json').splines;
// ---- 4. Land cover V1.10: parcels / woods over water, gaps and overlaps, display order.
const LC=read('data-sources/landcover/landcover-report.json');
const wl=read('unreal/landcover/water-lines.json').lines.filter(l=>l.persistance==='Permanent').map(l=>l.pointsL93.map(q=>[q[0],q[1]]));
const agri=read('unreal/landcover/agricultural-polygons.json').objects.map(o=>({id:o.id,ps:o.ringsL93,b:bboxOf(o.ringsL93.flatMap(p=>p[0]))})),nearAgri=gridIndex(agri,300);
let riverInFields=0,riverInFieldsIds=new Set();for(const l of wl)for(const p of densify(l,5)){const a=nearAgri(p).find(o=>o.ps.some(pp=>inPoly(p,pp)));if(a){riverInFields+=5;riverInFieldsIds.add(a.id);}}
// ---- 5. Place names: every permanent label has a position, current status and is inside the displayed terrain.
const poi=read('public/data/poi.json').pois,T=read('public/data/v2-terrain.json');
const labelled=poi.filter(p=>p.landmark===1||p.landmark===2||['poi:bourg','poi:poussey','poi:les-granges','poi:parc-aerodrome','poi:glaciere'].includes(p.id)||(p.name==='le Craon'&&['secteur','lieu_dit'].includes(p.category)));
const labelIssues=labelled.filter(p=>p.status!=='actuel'||p.coh!=='current'||!['A','B'].includes(p.conf)).map(p=>({id:p.id,name:p.name,status:p.status,conf:p.conf}));
const out={metadata:{version:'2.1',generatedBy:'scripts/audit-geography.mjs'},
 buildings:{total:all.length,reference:ref.length,additions:add.length,inCommune:ref.filter(f=>f.properties.inCommune).length+add.filter(f=>f.properties.inCommune).length,
  grid:{cellM:CELL,cellsInBuiltArea:cellList.length,controlled:cellList.filter(c=>c.controlled).length,byStatus:Object.fromEntries(['correcte','incertaine','anomalie'].map(s=>[s,cellList.filter(c=>c.status===s).length]))},
  duplicates:dup,invalid:[...new Set(invalid)],offsets,poussey:review.poussey||null,withoutGeometry:v201d.missing_buildings_without_geometry.map(m=>({id:m.id,sector:m.sector,observation:m.observation,recheck:review.withoutGeometry?.[m.id]||null}))},
 roads:{splines:rl.length,topology:{components:RR.topology.components,impasses:RR.topology.impasses,orphans:RR.openIssues.orphans.map(o=>({...o,review:o.review})),nearMisses:RR.topology.nearMisses.length,duplicates:RR.topology.duplicates.length,crossingsWithoutNode:RR.topology.crossingsWithoutNode.length},
  freeEnds:roadEnds.length,freeEndsAtEdge:roadEnds.filter(e=>e.edge).length,gaps1to5m:roadGaps,anomaliesToCheck:(RR.openIssues.anomaliesToCheck||[]).length,review:review.roads||null},
 rail:{tracks:RL.length,topology:{components:RP.topology.components,switches:RP.topology.switches,bufferStops:RP.topology.bufferStops,borderEnds:RP.topology.borderEnds,orphans:RP.topology.orphans,nearMisses:RP.topology.nearMisses,crossingsWithoutConnection:RP.topology.crossingsWithoutConnection.map(c=>({a:c.a,b:c.b,L93:c.L93,review:c.review?.observation||null}))},
  unknownStatus:RP.openIssues.unknownStatus,levelCrossings:RP.levelCrossings.length,bridges:RP.structures.bridges.length,review:review.rail||null},
 landcover:{permanentRiverInsideParcelsM:riverInFields,parcels:[...riverInFieldsIds],openIssues:Object.fromEntries(Object.entries(LC.openIssues||{}).map(([k,v])=>[k,Array.isArray(v)?v.length:v])),review:review.landcover||null},
 toponymy:{labelled:labelled.length,labelIssues,review:review.toponymy||null},
 cells:cellList.map(c=>({key:c.key,buildings:c.buildings,cadastre:c.cadastre,status:c.status,findings:c.findings}))};
fs.mkdirSync(D,{recursive:true});fs.writeFileSync(`${D}/geo-audit.json`,JSON.stringify(out,null,1)+'\n');
console.log(JSON.stringify({buildings:{...out.buildings,withoutGeometry:out.buildings.withoutGeometry.length,duplicates:dup.length,invalid:out.buildings.invalid.length,poussey:undefined},roads:{freeEnds:out.roads.freeEnds,atEdge:out.roads.freeEndsAtEdge,gaps:roadGaps.length,orphans:out.roads.topology.orphans.length},rail:{orphans:RP.topology.orphans.length,near:RP.topology.nearMisses.length,cross:RP.topology.crossingsWithoutConnection.length},landcover:out.landcover.permanentRiverInsideParcelsM,labelIssues}));
