// V2.9.1 landmark positioning check. It does not prove a geographic position (that is the job of the audit and its
// sources, docs/audit/V2.9.1_LANDMARK_POSITION_AND_JRPG_QUALITY.md): it locks the validated associations so they cannot
// regress silently.
// 1. the audit reference lists the 16 landmarks of unreal/architecture/landmark-architecture.json, once each;
// 2. every landmark has an explicit association (building ids, or a documented point-only object) and every id exists
//    among the 2 596 footprints;
// 3. address documented when known (or an explicit note), at least one source with organism and reference, a status;
// 4. canonical register (V2.9.2, replaces the V2.9.1 errata): each corrected record still holds its documented "from" value
//    in the frozen POI layer, and applying the register projection gives exactly the audited association and anchor;
// 5. after the register, the anchor of each building landmark lies in, or close to, its own footprints, and no building is
//    claimed by two landmark POIs (a later record would steal the click of an earlier one);
// 6. frozen files untouched: the register lives in docs/freeze and src/content, public/data/poi.json and unreal/ keep their Freeze V1 hashes.
import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {applyPlaceCorrections} from '../src/places-canonical.js';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),ok=m=>console.log('PASS '+m);
const AUDIT=read('src/content/landmark-audit-v291.json'),RUNTIME=read('src/content/places-runtime-v292.json'),LA=read('unreal/architecture/landmark-architecture.json').landmarks;
const POI=read('public/data/poi.json'),UP=read('unreal/poi/poi.json').pois;
const feats=[...read('public/data/buildings.geojson').features,...read('public/data/buildings-additions-v2.0.1.geojson').features,...read('public/data/buildings-manual-v2.2.geojson').features];
const fp=new Map(feats.map(f=>[f.properties.id||f.id,f]));assert.equal(fp.size,2596,'référentiel bâti : 2 596 empreintes attendues');
const ringsOf=g=>g.type==='Polygon'?[g.coordinates[0]]:g.coordinates.map(p=>p[0]);
const inside=([x,y],r)=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [x1,y1]=r[i],[x2,y2]=r[j];if((y1>y)!==(y2>y)&&x<(x2-x1)*(y-y1)/(y2-y1)+x1)c=!c;}return c;};
const M=111320*Math.cos(48.5097657*Math.PI/180),dist=(a,b)=>Math.hypot((a[0]-b[0])*M,(a[1]-b[1])*110540);
const nearest=(pt,ids)=>Math.min(...ids.flatMap(id=>ringsOf(fp.get(id).geometry).map(r=>inside(pt,r)?0:Math.min(...r.map(q=>dist(pt,q)))))) ;

// 1
const L=AUDIT.landmarks,ids=L.map(l=>l.id);
assert.equal(L.length,16,'16 landmarks attendus');assert.equal(new Set(ids).size,16,'identifiant de landmark en double');
for(const l of LA)assert(ids.includes(l.id),'landmark absent de la référence d’audit : '+l.id);
ok('1. 16 landmarks présents, uniques, identiques à la liste architecturale');
// 2
for(const l of L){assert(Array.isArray(l.buildingIds),'association non explicite : '+l.id);
 if(!l.buildingIds.length)assert(l.pointOnly===true&&l.anchor?.lonlat,'landmark orphelin sans empreinte ni objet ponctuel documenté : '+l.id);
 for(const id of l.buildingIds)assert(fp.has(id),'bâtiment associé inexistant : '+l.id+' → '+id);}
ok(`2. associations explicites : ${L.reduce((s,l)=>s+l.buildingIds.length,0)} empreintes existantes, ${L.filter(l=>l.pointOnly).length} objet ponctuel documenté, aucun orphelin`);
// 3
for(const l of L){assert(l.address||l.addressNote,'adresse ni documentée ni expliquée : '+l.id);assert(l.status,'statut d’audit manquant : '+l.id);
 assert(l.sources?.length&&l.sources.every(s=>s.organism&&s.ref&&s.info),'source incomplète : '+l.id);}
ok(`3. adresses documentées (${L.filter(l=>l.address).length} connues, ${L.filter(l=>!l.address).length} notes explicites), sources et statut pour les 16`);
// 4
const pois=structuredClone(POI.pois),byId=new Map(pois.map(p=>[p.id,p]));const corrected=L.filter(l=>l.correction);
for(const l of corrected){const p=byId.get(l.poiId);assert.deepEqual(p.building_ids,l.correction.building_ids.from,'donnée gelée inattendue (association) : '+l.id);
 assert.deepEqual(p.lonlat,l.correction.lonlat.from,'donnée gelée inattendue (ancre) : '+l.id);assert(RUNTIME.places[l.poiId],'correction absente du registre canonique : '+l.id);}
const report=applyPlaceCorrections(pois,RUNTIME);assert.equal(report.missing.length,0,'registre : POI inconnus '+report.missing.join(', '));
for(const l of L.filter(l=>l.poiId)){const p=byId.get(l.poiId);assert(p,'POI absent : '+l.poiId);
 assert.deepEqual(p.building_ids,l.buildingIds,'association ≠ référence d’audit : '+l.id);assert.deepEqual(p.lonlat,l.anchor.lonlat,'ancre ≠ référence d’audit : '+l.id);
 if(l.address)assert.equal(p.address,l.address,'adresse ≠ référence d’audit : '+l.id);}
ok(`4. registre canonique : ${corrected.length} landmarks corrigés (${corrected.map(l=>l.poiId).join(', ')}) depuis leur valeur gelée ; les 11 POI landmarks = référence d’audit`);
// 5
const owner=new Map();for(const p of pois.filter(p=>p.landmark||L.some(l=>l.poiId===p.id)))for(const id of p.building_ids){assert(!owner.has(id)||owner.get(id)===p.id,`bâtiment ${id} revendiqué par ${owner.get(id)} et ${p.id}`);owner.set(id,p.id);}
const far=[];for(const l of L.filter(l=>l.poiId&&l.buildingIds.length)){const d=nearest(l.anchor.lonlat,l.buildingIds);if(d>100)far.push(l.id+' '+Math.round(d)+' m');}
assert.equal(far.length,0,'ancre éloignée de ses empreintes : '+far.join(', '));
for(const id of ['poi:mairie','poi:salle-polyvalente','poi:ecole-primaire','poi:eglise-saint-denis','poi:cpi'])assert.equal(nearest(byId.get(id).lonlat,byId.get(id).building_ids),0,'ancre hors de son bâtiment : '+id);
ok(`5. aucune empreinte revendiquée par deux landmarks (${owner.size} empreintes) ; mairie, salle polyvalente, école, église et caserne ancrées dans leur bâtiment`);
// 6
const frozen=read('data-sources/architecture/frozen-geography-v2.2-sha256.json').files;
for(const f of ['public/data/poi.json','unreal/poi/poi.json','unreal/poi/landmarks.json'])assert.equal(sha(f),frozen[f],'fichier POI gelé modifié : '+f);
const stale=corrected.filter(l=>{const u=UP.find(p=>p.id===l.poiId);return u&&JSON.stringify(u.building_ids)!==JSON.stringify(l.buildingIds);}).map(l=>l.poiId);
ok(`6. fichiers POI gelés intacts (hachages V2.2) ; corrections hors données gelées${stale.length?` — export Unreal à migrer (docs/freeze/unreal-semantic-migration-v2.9.2.json) : ${stale.join(', ')}`:''}`);
