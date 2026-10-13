// V3.4 check:cadastre-building-links — the building ↔ parcel relations of the registry are recomputed from the geometry
// (area of intersection, not the centroid): one / several / no parcel, peripheral buildings, main buildings, and no parcel
// invented for a building.
import fs from 'node:fs';import assert from 'node:assert/strict';import pc from 'polygon-clipping';
import {projection} from '../../src/geo.js';
const ok=m=>console.log('PASS '+m),read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const R=read('public/data/cadastre-parcels-v3.4.json'),G=read('docs/freeze/MLGU_CADASTRAL_PARCELS_V1.json'),scene=read('public/data/v2-scene.json'),project=projection(scene.metadata.origin);
const V=R.v,parcels=R.p.map(p=>p.r.map(poly=>poly.map(r=>{const q=r.map(i=>[V[2*i],V[2*i+1]]);q.push(q[0]);return q;})));
const area=mp=>mp.reduce((s,poly)=>s+poly.reduce((t,r,k)=>{let a=0;for(let i=0,j=r.length-1;i<r.length;j=i++)a+=(r[j][0]-r[i][0])*(r[j][1]+r[i][1]);return t+(k?-1:1)*Math.abs(a/2);},0),0);
const bbox=mp=>{const f=mp.flatMap(p=>p[0]);return [Math.min(...f.map(q=>q[0])),Math.min(...f.map(q=>q[1])),Math.max(...f.map(q=>q[0])),Math.max(...f.map(q=>q[1]))];};
const pb=parcels.map(bbox),grid=new Map();pb.forEach((b,i)=>{for(let x=Math.floor(b[0]/100);x<=Math.floor(b[2]/100);x++)for(let z=Math.floor(b[1]/100);z<=Math.floor(b[3]/100);z++){const k=x+','+z;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);}});
const B=[];for(const f of ['public/data/buildings.geojson','public/data/buildings-additions-v2.0.1.geojson','public/data/buildings-manual-v2.2.geojson'])for(const ft of read(f).features){const g=ft.geometry;B.push({id:ft.properties.id,inCommune:ft.properties.inCommune!==false,mp:(g.type==='Polygon'?[g.coordinates]:g.coordinates).map(p=>p.map(r=>r.map(q=>project(q))))});}
// 1
assert.equal(B.length,2596);assert.equal(new Set(B.map(b=>b.id)).size,2596);
const rel={},main=new Map();let unique=0,multiple=0,none=0,straddle=0,overflow=0;
for(const b of B){const bb=bbox(b.mp),A=area(b.mp),cand=new Set();for(let x=Math.floor(bb[0]/100);x<=Math.floor(bb[2]/100);x++)for(let z=Math.floor(bb[1]/100);z<=Math.floor(bb[3]/100);z++)for(const i of grid.get(x+','+z)||[])cand.add(i);
 const sh=[];for(const i of cand){const p=pb[i];if(p[0]>bb[2]||p[2]<bb[0]||p[1]>bb[3]||p[3]<bb[1])continue;let a=0;try{a=area(pc.intersection(b.mp,parcels[i]));}catch{}if(a>0)sh.push([i,a/A]);}
 sh.sort((u,v)=>v[1]-u[1]);const linked=sh.filter(s=>s[1]>=.05);
 if(!linked.length){none++;rel[b.id]='n';}else if(linked.length===1)unique++;else{multiple++;if(linked[1][1]<.2){overflow++;rel[b.id]='d';}else{straddle++;rel[b.id]='c';}}
 if(linked.length&&linked[0][1]>=.5)main.set(b.id,R.p[linked[0][0]].id);}
const st=G.stats.buildings;assert.deepEqual([unique,multiple,none,overflow,straddle],[st.unique,st.multiple,st.none,st.multipleOverflow,st.multipleStraddle]);
assert.deepEqual(rel,R.bl);
ok(`1. relations recalculées par aire d’intersection (seuil 5 % de l’empreinte) : ${unique} bâtiments dans une seule parcelle, ${multiple} sur plusieurs (${overflow} débords < 20 %, ${straddle} à cheval), ${none} sans parcelle`);
// 2
const reg=new Map(G.buildings.map(b=>[b.id,b]));for(const [id,r] of Object.entries(rel))assert.equal(reg.get(id)?.relation,r==='n'?'aucune':'multiple');
const noneIn=B.filter(b=>rel[b.id]==='n'&&b.inCommune).length;assert.equal(noneIn,st.noneInCommune);
ok(`2. registre conforme ; sans parcelle : ${none-noneIn} bâtiments hors de la commune (périphériques) et ${noneIn} dans la commune, conservés sans parcelle inventée`);
// 3
for(const p of G.parcels)for(const id of p.main_building_ids)assert.equal(main.get(id),p.parcel_id,'bâtiment principal incohérent '+id);
const multi=G.parcels.filter(p=>p.main_building_ids.length>1).length;assert.equal(multi,st.parcelsWithSeveralMainBuildings);
ok(`3. bâtiments principaux (≥ 50 % de l’empreinte) cohérents ; ${multi} parcelles portent plusieurs bâtiments, sans découpage du terrain entre eux`);
// 4
assert.equal(R.p.length,G.parcels.length);assert.ok(R.p.every((p,i)=>p.id===G.parcels[i].parcel_id));
ok(`4. aucune parcelle créée pour un bâtiment : ${R.p.length} parcelles, toutes issues du PCI, dans l’ordre du registre`);
