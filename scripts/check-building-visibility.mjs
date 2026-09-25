// V2.0.1 building visibility check: every footprint of the reference (frozen V1.6.2) and of the V2.0.1 complement is really generated in the
// Three.js scene (same code as the browser: building-source.js, buildings.js, building-elevation.js on the V2 display terrain), by id,
// with a roof covering its footprint, in the terrain altitude range and never entirely under the displayed relief.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import ClipperLib from 'clipper-lib';
import {toL93} from './terrain-frame.mjs';
import {projection,polygons,bounds,area} from '../src/geo.js';
import {buildingItems} from '../src/building-source.js';
import {buildBuildings} from '../src/buildings.js';
import {displayBase} from '../src/building-elevation.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex'),ok=m=>console.log('PASS '+m);
const D='data-sources/buildings-audit-v2.0.1',ref=read('public/data/buildings.geojson'),add=read('public/data/buildings-additions-v2.0.1.geojson');
const refElev=read('public/data/building-terrain-elevation.json'),addElev=read('public/data/buildings-additions-elevation-v2.0.1.json'),dec=read(`${D}/decisions.json`),review=read(`${D}/review.json`),report=read(`${D}/build-report.json`);
// 1. Frozen reference untouched; the complement is built from the current decisions and sources.
assert.equal(sha('public/data/buildings.geojson'),'809f3af371719e2d3adfaa6e55a9d56235e4618e28e8a36595c85d501a4f3095','Référentiel bâti V1.6.2 modifié');
assert.equal(ref.features.length,2494);assert.equal(ref.features.filter(f=>f.properties.inCommune).length,2265);
assert.equal(add.metadata.reference.sha256,sha('public/data/buildings.geojson'));assert.equal(add.metadata.sources.decisionsSha256,sha(`${D}/decisions.json`),'Compléments à régénérer (npm run data:missing-buildings)');
assert.equal(add.metadata.count,add.features.length);assert.equal(add.metadata.total,ref.features.length+add.features.length);
ok(`1. référentiel V1.6.2 intact (2 494 / 2 265) ; complément V2.0.1 : ${add.features.length} bâtiments issus des décisions actuelles`);
// 2. Every reintegration is traced: public source, orthophoto evidence, audited components; never drawn by hand.
const compByK=new Map(review.components.map(c=>[c.k,c]));
for(const f of add.features){const p=f.properties;assert(['cadastre','osm'].includes(p.provenance),'Source non publique : '+p.id);assert.equal(p.validation.confidence,'B');
 assert(p.validation.evidence.some(e=>e.startsWith('BD ORTHO IGN 20 cm')),'Preuve orthophoto absente : '+p.id);assert(p.audit.components.length&&p.audit.components.every(k=>compByK.get(k)?.verdict==='bâti visible'),'Décision non tracée : '+p.id);
 assert(dec.reintegrate.some(d=>d.sourceId===p.audit.sourceId));}
assert.equal(report.fromRemovedV162,0);assert.equal(add.features.filter(f=>f.properties.audit.removedIn==='1.6.1').length,report.fromRemovedV161);
for(const m of dec.missing_buildings_without_geometry){assert(m.evidence.length>=2&&m.positionL93.length===2,'Cas sans géométrie incomplet : '+m.id);assert(!add.features.some(f=>f.properties.id===m.id),'Géométrie inventée : '+m.id);}
ok(`2. ${add.features.length} réintégrations tracées (Parcellaire Express ${report.byProvenance.cadastre}, OSM ${report.byProvenance.osm}, dont ${report.fromRemovedV161} retraits V1.6.1 annulés, 0 retrait V1.6.2) ; ${dec.missing_buildings_without_geometry.length} constructions visibles sans géométrie publique, non dessinées`);
// 3. No reintegrated footprint overlaps the reference or another addition (Clipper, millimetres).
const {Clipper,ClipType,PolyType,PolyFillType}=ClipperLib,O=[758000,6823000];
const paths=f=>(f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates).flatMap(p=>p.map((r,k)=>{const q=r.slice(0,-1).map(c=>{const [E,N]=toL93(c);return {X:Math.round((E-O[0])*1000),Y:Math.round((N-O[1])*1000)};});if(Clipper.Orientation(q)!==(k===0))q.reverse();return q;}));
const box=ps=>{let b=[1e15,1e15,-1e15,-1e15];for(const r of ps)for(const q of r)b=[Math.min(b[0],q.X),Math.min(b[1],q.Y),Math.max(b[2],q.X),Math.max(b[3],q.Y)];return b;};
const inter=(a,b)=>{const c=new Clipper(),out=[];c.AddPaths(a,PolyType.ptSubject,true);c.AddPaths(b,PolyType.ptClip,true);c.Execute(ClipType.ctIntersection,out,PolyFillType.pftNonZero,PolyFillType.pftNonZero);return out.reduce((s,p)=>s+Math.abs(Clipper.Area(p)),0)/1e6;};
const R=ref.features.map(f=>{const p=paths(f);return {id:f.properties.id,p,b:box(p)};}),A=add.features.map(f=>{const p=paths(f);return {id:f.properties.id,p,b:box(p)};});let worst=0;
for(const [i,a] of A.entries())for(const o of [...R,...A.slice(i+1)])if(a.b[0]<=o.b[2]&&a.b[2]>=o.b[0]&&a.b[1]<=o.b[3]&&a.b[3]>=o.b[1])worst=Math.max(worst,inter(a.p,o.p));
assert(worst<.05,'Chevauchement '+worst.toFixed(3)+' m²');
ok(`3. aucun chevauchement entre compléments et référentiel (max ${worst.toFixed(3)} m²)`);
// 4. Terrain elevation for every id (V1.7 method on the frozen 1 m grid for the complement).
const elev={...refElev.buildings,...addElev.buildings},ids=[...ref.features,...add.features].map(f=>f.properties.id);
assert.equal(new Set(ids).size,ids.length,'Identifiant en double');for(const id of ids)assert(Number.isFinite(elev[id]?.baseZ)&&elev[id].baseZ>60&&elev[id].baseZ<130,'Altitude absente ou hors plage : '+id);
assert.equal(addElev.metadata.sourceSha256,read('unreal/terrain/terrain-reference.json').files.find(f=>f.file.endsWith('.tif')).sha256);
ok(`4. altitude de socle pour les ${ids.length} bâtiments (60–130 m NGF)`);
// 5–7. The scene: same modules as the browser, on the V2 display terrain.
const osm=read('public/data/maizieres.geojson'),commune=read('public/data/commune.geojson'),enr=read('public/data/building-enrichment.json'),project=projection(osm.metadata.origin);
const bb=bounds(polygons(commune,project).flat(2)),extent={minX:bb.minX-150,maxX:bb.maxX+150,minZ:bb.minZ-150,maxZ:bb.maxZ+150};
const T=read('public/data/v2-terrain.json'),bin=fs.readFileSync('public/data/v2-terrain.bin'),u=new Uint16Array(bin.buffer,bin.byteOffset,bin.length/2),alt=(c,r)=>T.zBase+u[r*T.cols+c]/100;
const heightAt=(x,z)=>{const fx=(x-T.x0)/T.step,fz=(z-T.z0)/T.step,c=Math.floor(fx),r=Math.floor(fz);if(c<0||r<0||c>=T.cols-1||r>=T.rows-1)return NaN;const a=fx-c,w=fz-r;return (alt(c,r)*(1-a)+alt(c+1,r)*a)*(1-w)+(alt(c,r+1)*(1-a)+alt(c+1,r+1)*a)*w-T.yReference;};
const fc={...ref,features:[...ref.features,...add.features]},items=buildingItems(fc,project,extent),display=new Map();
assert.equal(items.stats.outsideExtent,0);assert.equal(items.stats.emptyAfterClip,0);
for(const it of items.items)display.set(it.id,displayBase(it.poly,elev[it.featureId].baseZ-T.yReference,heightAt));
const scene=new THREE.Scene(),out=buildBuildings(scene,items.items,enr,{elevation:it=>display.get(it.id).base-.45});
assert.equal(out.rejected.length,0,'Bâtiments rejetés : '+out.rejected.map(r=>r.id).join(', '));
const inScene=new Set();scene.traverse(o=>{if(o.isMesh)for(const r of o.userData.featureRanges||[])if(r.end>r.start)inScene.add(r.id.split('#')[0]);});
const missing=ids.filter(id=>!inScene.has(id));assert.equal(missing.length,0,'Absents du graphe de scène : '+missing.slice(0,10).join(', '));assert.equal(inScene.size,ids.length);
ok(`5. ${ids.length} identifiants attendus = ${inScene.size} identifiants présents dans le graphe de scène Three.js (${out.count} parties, 0 rejet)`);
const roof=out.pickMeshes[1],pos=roof.geometry.attributes.position.array,roofArea=new Map();
for(const r of roof.userData.featureRanges){let s=0;for(let t=r.start;t<r.end;t++){const o=t*9;s+=Math.abs((pos[o+3]-pos[o])*(pos[o+8]-pos[o+2])-(pos[o+6]-pos[o])*(pos[o+5]-pos[o+2]))/2;}roofArea.set(r.id,(roofArea.get(r.id)||0)+s);}
const badRoof=items.items.filter(it=>{const A=area(it.poly[0])-it.poly.slice(1).reduce((s,h)=>s+area(h),0);return (roofArea.get(it.id)||0)<.9*A;}).map(it=>it.id);
assert.equal(badRoof.length,0,'Toit incomplet (triangulation) : '+badRoof.slice(0,10).join(', '));
ok(`6. triangulation : toiture ≥ 90 % de l’emprise pour les ${items.items.length} parties`);
let buried=[],range=[],yMin=Infinity,yMax=-Infinity;
for(const it of items.items){const d=display.get(it.id),top=d.base+out.info.get(it.id).maxHeight;if(top<d.terrainMax+.5)buried.push(it.id);if(d.base<d.terrainMin-.5||d.base>d.terrainMax+.5)range.push(it.id);yMin=Math.min(yMin,d.base+T.yReference);yMax=Math.max(yMax,top+T.yReference);}
const corrected=[...display.values()].filter(d=>d.corrected).length;
assert.equal(buried.length,0,'Bâtiments sous le terrain : '+buried.slice(0,10).join(', '));assert.equal(range.length,0,'Socle hors plage : '+range.slice(0,10).join(', '));assert(yMin>60&&yMax<200);
ok(`7. aucun bâtiment sous le relief affiché ni hors plage Z (${yMin.toFixed(1)}–${yMax.toFixed(1)} m NGF) ; ${corrected} socles recalés sur la grille d’affichage`);
// 8. Browser wiring: V2 view and ?diagnostic=buildings-audit load the complement, use the display base and expose the id audit.
const main=fs.readFileSync('src/main.js','utf8');
for(const s of ["from './building-elevation.js'","buildings-additions-v2.0.1.geojson","buildings-additions-elevation-v2.0.1.json","'buildings-audit'","displayBase(","renderedBuildingIds","buildingAudit"])assert(main.includes(s),'main.js : '+s);
ok('8. vue V2 et ?diagnostic=buildings-audit branchées (complément, socle d’affichage, audit des identifiants exposé)');
console.log(`check:building-visibility — 8 contrôles PASS · ${ref.features.length} + ${add.features.length} = ${ids.length} bâtiments (${ref.features.filter(f=>f.properties.inCommune).length+add.metadata.inCommune} dans la commune)`);
