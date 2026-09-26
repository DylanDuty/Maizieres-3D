// V2.2 final building freeze check: frozen reference and V2.0.1 additions untouched, the separate manual orthophoto layer traced
// case by case (16 V2.0.1 cases + new findings), unique ids, valid and non-overlapping geometry, every id rendered in the Three.js
// scene (same modules as the browser) without burial, and the Unreal provenance table consistent with the three layers.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import ClipperLib from 'clipper-lib';
import {toL93,toUnreal} from './terrain-frame.mjs';
import {projection,polygons,bounds} from '../src/geo.js';
import {buildingItems} from '../src/building-source.js';
import {buildBuildings} from '../src/buildings.js';
import {displayBase} from '../src/building-elevation.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex'),ok=m=>console.log('PASS '+m);
const REF='public/data/buildings.geojson',ADD='public/data/buildings-additions-v2.0.1.geojson',MAN='public/data/buildings-manual-v2.2.geojson',D='data-sources/buildings-manual-v2.2';
const ref=read(REF),add=read(ADD),man=read(MAN),dec=read(`${D}/decisions.json`),v201=read('data-sources/buildings-audit-v2.0.1/decisions.json');
// 1. Frozen layers: reference V1.6.2 and V2.0.1 additions (with their elevations) are byte-identical to V2.1.
assert.equal(sha(REF),'809f3af371719e2d3adfaa6e55a9d56235e4618e28e8a36595c85d501a4f3095','Référentiel V1.6.2 modifié');
assert.equal(sha(ADD),'0f5a75916f782bf8fc6dcabf25107fd13c796492b3305d6fa28f401de8845af4','Réintégrations V2.0.1 modifiées');
assert.equal(sha('public/data/buildings-additions-elevation-v2.0.1.json'),'042232eba8b798f1949ab665adbfca56a01b03b9b6edd279053a864530d952fb');
assert.equal(ref.features.length,2494);assert.equal(add.features.length,90);
ok('1. référentiel V1.6.2 (2 494) et réintégrations V2.0.1 (90) inchangés, octet pour octet');
// 2. Each of the 16 V2.0.1 cases is decided exactly once; manual features only for « ajout_manuel ».
const ids16=v201.missing_buildings_without_geometry.map(m=>m.id);assert.equal(ids16.length,16);
assert.deepEqual(dec.cases.map(c=>c.id).sort(),[...ids16].sort(),'Les 16 cas doivent être arbitrés un par un');
for(const c of dec.cases){assert(['ajout_manuel','ajout_source_publique','deja_au_referentiel','non_modelise'].includes(c.decision));if(c.decision!=='ajout_manuel')assert(c.reason&&c.observation,'Justification manquante : '+c.id);}
const manualCases=[...dec.cases,...dec.newFindings].filter(c=>c.decision==='ajout_manuel').map(c=>c.id);
const origin=man.features.map(f=>f.properties.originalMissingId);assert.equal(new Set(origin).size,origin.length,'originalMissingId en double');assert.deepEqual([...origin].sort(),[...manualCases].sort());
ok(`2. 16 cas arbitrés (${['ajout_manuel','deja_au_referentiel','non_modelise'].map(k=>k+' '+dec.cases.filter(c=>c.decision===k).length).join(', ')}) + ${dec.newFindings.length} nouveau(x) constat(s) ; chaque originalMissingId traité une seule fois`);
// 3. Manual layer: mandatory metadata, evidence, provenance, never mixed with official sources, height never presented as official.
const REQ=['id','source','provenance','confidence','inCommune','observation','sector','originalMissingId','auditVersion','manualGeometry','evidence','geometryMethod','reviewStatus'];
for(const f of man.features){const p=f.properties;for(const k of REQ)assert(p[k]!==undefined&&p[k]!==null&&p[k]!=='','Champ manquant '+k+' : '+p.id);
 assert.equal(p.source,'BD ORTHO IGN avril 2025 - relevé manuel V2.2');assert.equal(p.provenance,'orthophoto_manual_v2.2');assert.equal(p.auditVersion,'2.2');assert.equal(p.manualGeometry,true);
 assert(Array.isArray(p.evidence)&&p.evidence.length>=2&&p.evidence[0].startsWith('BD ORTHO IGN'),'Preuve manquante : '+p.id);assert(['A','B','C'].includes(p.confidence));
 assert.equal(p.height.status,'unknown');assert.equal(p.derived.wallHeight,null);assert(p.id.startsWith('manual-v2.2:'));}
assert(!ref.features.some(f=>f.properties.provenance==='orthophoto_manual_v2.2')&&!add.features.some(f=>f.properties.provenance==='orthophoto_manual_v2.2'));
ok(`3. couche manuelle séparée : ${man.features.length} objets, métadonnées complètes, preuves orthophoto, hauteur « unknown » (jamais officielle)`);
// 4. Ids unique over the 3 layers, geometry valid (closed ring, no self-intersection, area), no significant overlap.
const all=[...ref.features,...add.features,...man.features],ids=all.map(f=>f.properties.id);assert.equal(new Set(ids).size,ids.length,'Identifiant en double');
const {Clipper,ClipType,PolyType,PolyFillType}=ClipperLib,O=[758000,6823000];
const paths=f=>(f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates).flatMap(p=>p.map((r,k)=>{const q=r.slice(0,-1).map(c=>{const [E,N]=toL93(c);return {X:Math.round((E-O[0])*1000),Y:Math.round((N-O[1])*1000)};});if(Clipper.Orientation(q)!==(k===0))q.reverse();return q;}));
const cross=(a,b,c,d)=>{const o=(p,q,r)=>Math.sign((q.X-p.X)*(r.Y-p.Y)-(q.Y-p.Y)*(r.X-p.X));return o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0;};
for(const f of man.features){const r=f.geometry.coordinates[0];assert.deepEqual(r[0],r.at(-1));const q=paths(f)[0];assert(Math.abs(Clipper.Area(q))/1e6>=5,'Surface trop petite : '+f.properties.id);
 for(let i=0;i<q.length;i++)for(let j=i+2;j<q.length;j++){if(i===0&&j===q.length-1)continue;assert(!cross(q[i],q[(i+1)%q.length],q[j],q[(j+1)%q.length]),'Polygone auto-intersecté : '+f.properties.id);}}
const box=ps=>{let b=[1e15,1e15,-1e15,-1e15];for(const r of ps)for(const q of r)b=[Math.min(b[0],q.X),Math.min(b[1],q.Y),Math.max(b[2],q.X),Math.max(b[3],q.Y)];return b;};
const inter=(a,b)=>{const c=new Clipper(),out=[];c.AddPaths(a,PolyType.ptSubject,true);c.AddPaths(b,PolyType.ptClip,true);c.Execute(ClipType.ctIntersection,out,PolyFillType.pftNonZero,PolyFillType.pftNonZero);return out.reduce((s,p)=>s+Math.abs(Clipper.Area(p)),0)/1e6;};
const P=all.map(f=>{const p=paths(f);return {id:f.properties.id,p,b:box(p)};}),M=P.slice(ref.features.length+add.features.length);let worst=0;
for(const [i,a] of M.entries())for(const o of P){if(o===a||M.indexOf(o)>-1&&M.indexOf(o)<=i)continue;if(a.b[0]<=o.b[2]&&a.b[2]>=o.b[0]&&a.b[1]<=o.b[3]&&a.b[3]>=o.b[1])worst=Math.max(worst,inter(a.p,o.p));}
assert(worst<.5,'Chevauchement significatif : '+worst.toFixed(2)+' m²');
ok(`4. ${ids.length} identifiants uniques, géométries manuelles valides, chevauchement max avec l’existant ${worst.toFixed(2)} m²`);
// 5. No loss: the 2 584 V2.1 ids are all still there; total and commune counts.
const inC=all.filter(f=>f.properties.inCommune).length;assert.equal(ids.length,2584+man.features.length);assert.equal(inC,2350+man.features.filter(f=>f.properties.inCommune).length);
ok(`5. aucune perte des 2 584 empreintes V2.1 ; total ${ids.length} (dont ${inC} dans la commune), ajouts V2.2 comptés à part : ${man.features.length}`);
// 6. Three.js: same modules as the browser, V2 display terrain; every id rendered, none buried, none out of range.
const elev={...read('public/data/building-terrain-elevation.json').buildings,...read('public/data/buildings-additions-elevation-v2.0.1.json').buildings,...read('public/data/buildings-manual-elevation-v2.2.json').buildings};
for(const id of ids)assert(Number.isFinite(elev[id]?.baseZ)&&elev[id].baseZ>60&&elev[id].baseZ<130,'Altitude absente : '+id);
const osm=read('public/data/maizieres.geojson'),commune=read('public/data/commune.geojson'),enr=read('public/data/building-enrichment.json'),project=projection(osm.metadata.origin);
const bb=bounds(polygons(commune,project).flat(2)),extent={minX:bb.minX-150,maxX:bb.maxX+150,minZ:bb.minZ-150,maxZ:bb.maxZ+150};
const T=read('public/data/v2-terrain.json'),bin=fs.readFileSync('public/data/v2-terrain.bin'),u=new Uint16Array(bin.buffer,bin.byteOffset,bin.length/2),alt=(c,r)=>T.zBase+u[r*T.cols+c]/100;
const heightAt=(x,z)=>{const fx=(x-T.x0)/T.step,fz=(z-T.z0)/T.step,c=Math.floor(fx),r=Math.floor(fz);if(c<0||r<0||c>=T.cols-1||r>=T.rows-1)return NaN;const a=fx-c,w=fz-r;return (alt(c,r)*(1-a)+alt(c+1,r)*a)*(1-w)+(alt(c,r+1)*(1-a)+alt(c+1,r+1)*a)*w-T.yReference;};
const items=buildingItems({...ref,features:all},project,extent),display=new Map();for(const it of items.items)display.set(it.id,displayBase(it.poly,elev[it.featureId].baseZ-T.yReference,heightAt));
const scene=new THREE.Scene(),out=buildBuildings(scene,items.items,enr,{elevation:it=>display.get(it.id).base-.45});assert.equal(out.rejected.length,0);
const inScene=new Set();scene.traverse(o=>{if(o.isMesh)for(const r of o.userData.featureRanges||[])if(r.end>r.start)inScene.add(r.id.split('#')[0]);});
assert.deepEqual(ids.filter(id=>!inScene.has(id)),[],'Absents de la scène');
const buried=items.items.filter(it=>{const d=display.get(it.id);return d.base+out.info.get(it.id).maxHeight<d.terrainMax+.5||d.base<d.terrainMin-.5||d.base>d.terrainMax+.5;}).map(it=>it.id);
assert.deepEqual(buried,[],'Enfoui ou hors plage');
ok(`6. Three.js : ${inScene.size} / ${ids.length} identifiants présents dans le graphe de scène, 0 rejet, 0 enfoui ni hors plage (dont les ${man.features.length} relevés manuels)`);
// 7. Unreal: provenance table keeps the three classes apart and matches the geometry files and elevations.
const U=read('unreal/buildings/buildings-provenance-v2.2.json');
assert.deepEqual(U.metadata.counts,{'official_v1.6.2':2494,'reintegrated_v2.0.1':90,'manual_orthophoto_v2.2':man.features.length});assert.equal(U.buildings.length,ids.length);
assert.deepEqual(U.buildings.map(b=>b.id).sort(),[...ids].sort());
for(const b of U.buildings.filter(b=>b.class==='manual_orthophoto_v2.2')){const e=elev[b.id];const exp=toUnreal([e.centroidL93[0],e.centroidL93[1],e.baseZ]);assert(b.unrealCm.every((v,k)=>Math.abs(v-exp[k])<=2),'unrealCm incohérent : '+b.id);assert.equal(b.heightStatus,'unknown');}
assert(U.buildings.every(b=>['measured','unknown'].includes(b.heightStatus)));
ok(`7. Unreal : table de provenance cohérente (${Object.entries(U.metadata.counts).map(([k,v])=>k+' '+v).join(', ')}), statut de hauteur mesurée / inconnue`);
// 8. Browser wiring: the manual layer is loaded separately, can be switched off, and has its own diagnostic colour.
const main=fs.readFileSync('src/main.js','utf8'),bj=fs.readFileSync('src/buildings.js','utf8');
for(const s of ['buildings-manual-v2.2.geojson','buildings-manual-elevation-v2.2.json',"params.get('manual')!=='0'","'manuel-v2.2'"])assert(main.includes(s),'main.js : '+s);assert(bj.includes("'manuel-v2.2':"));
ok('8. couche manuelle chargée à part (désactivable par ?manual=0) et colorée à part dans ?diagnostic=buildings-audit');
console.log(`check:final-building-freeze — 8 contrôles PASS · ${ids.length} empreintes (${inC} dans la commune) dont ${man.features.length} relevés manuels V2.2`);
