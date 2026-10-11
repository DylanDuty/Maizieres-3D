// V2.9.2 check:poi-building-links — associations place ↔ building in the normal view.
// 1. every building id of a displayed place exists among the 2 596 footprints;
// 2. no footprint is claimed by two displayed places (a later record would take the click of the other);
// 3. a building-linked displayed place has its anchor in, or near (≤ 60 m), its footprints; the civic places in their own;
// 4. a BAN « segment » position is never the only evidence of a building: no displayed place keeps a building association
//    flagged BAN_SEGMENT_BUILDING by the screening without an audited decision;
// 5. the footprints wrongly associated before V2.9.2 are free: …149656 and …149537 (old salle / mairie), …2006956400 only
//    the Maison des associations, …149545 (31 m² annex) has no name, the closed pharmacy building has no name;
// 6. the click on each certified building opens its place, in the map's own catalogue;
// 7. semantic conflicts of the brief: the mairie and the CPI never open the school, no building of the communal parcel
//    D2377 opens the school unless it is a school building, Salle polyvalente ≠ Maison des associations.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {loadRuntimeCatalogue} from './runtime-catalogue.mjs';
import {insidePoly} from '../src/geo.js';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),ok=m=>console.log('PASS '+m);
const REG=read('docs/freeze/MLGU_PLACES_CANONICAL_V1.json'),DEC=read('docs/freeze/places-decisions-v2.9.2.json'),R=loadRuntimeCatalogue();
assert.equal(R.items.length>=2596,true);const fp=new Map(R.items.map(i=>[i.id,i]));
const shown=REG.places.filter(e=>['PASS','PASS_WITH_LIMITATION'].includes(e.display_status));
// 1
let links=0;for(const e of shown)for(const id of e.building_ids){assert(fp.has(id),`bâtiment inexistant : ${e.id} → ${id}`);links++;}
ok(`1. ${links} associations de ${shown.filter(e=>e.building_ids.length).length} lieux affichés : toutes vers des empreintes existantes`);
// 2
const owner=new Map();for(const e of shown)for(const id of e.building_ids){assert(!owner.has(id),`${id} revendiqué par ${owner.get(id)} et ${e.id}`);owner.set(id,e.id);}
ok(`2. aucune empreinte revendiquée par deux lieux affichés (${owner.size} empreintes)`);
// 3
const dist=(p,ids)=>Math.min(...ids.map(id=>{const poly=fp.get(id).poly;if(insidePoly(p,poly))return 0;let b=Infinity;for(const r of poly)for(const q of r)b=Math.min(b,Math.hypot(q[0]-p[0],q[1]-p[1]));return b;}));
const far=[],areaAnchored=[];for(const e of shown.filter(e=>e.building_ids.length&&e.anchor.lonlat)){const d=dist(R.project(e.anchor.lonlat),e.building_ids);if(d>60){if(DEC[e.id]?.anchor_far_ok)areaAnchored.push(`${e.id} ${Math.round(d)} m`);else far.push(`${e.id} ${Math.round(d)} m`);}}
assert.equal(far.length,0,'ancre éloignée de ses empreintes : '+far.join(', '));
const CIVIC=['poi:mairie','poi:salle-polyvalente','poi:maison-des-associations','poi:ecole-primaire','poi:eglise-saint-denis','poi:cpi'];
for(const id of CIVIC){const e=REG.places.find(e=>e.id===id);assert.equal(dist(R.project(e.anchor.lonlat),e.building_ids),0,'ancre hors de son bâtiment : '+id);}
ok(`3. ancres des lieux liés à un bâtiment à moins de 60 m de leurs empreintes (exception documentée : ${areaAnchored.join(', ')||'aucune'}) ; mairie, salle polyvalente, Maison des associations, école, église, caserne ancrées dans leur bâtiment`);
// 4
const flagged=shown.filter(e=>e.flags?.includes('BAN_SEGMENT_BUILDING')&&e.building_ids.length&&!DEC[e.id]);assert.equal(flagged.length,0,'association reposant sur un point BAN « segment » : '+flagged.map(e=>e.id));
ok(`4. aucune association affichée ne repose sur un seul point BAN « segment » (${REG.places.filter(e=>e.flags?.includes('BAN_SEGMENT_BUILDING')).length} cas criblés, tous tranchés ou non affichés)`);
// 5
const byId=R.catalogue.byId;
for(const id of ['BATIMENT0000000301149656','BATIMENT0000000301149537','BATIMENT0000000301149545','BATIMENT0000000301149603'])assert(!byId.get(id),'empreinte encore nommée : '+id+' '+byId.get(id)?.name);
assert.equal(owner.get('BATIMENT0000002006956400'),'poi:maison-des-associations');
ok('5. …149656 et …149537 libres, …2006956400 à la seule Maison des associations, annexe …149545 et ancienne pharmacie …149603 sans nom');
// 6
let clicks=0;for(const [id,pid] of owner){const r=byId.get(id);assert.equal(r?.poi?.id,pid,`clic sur ${id} : ${r?.poi?.id||r?.name} au lieu de ${pid}`);clicks++;}
ok(`6. clic simulé sur les ${clicks} empreintes certifiées : chacune ouvre son lieu`);
// 7
const open=id=>byId.get(id)?.poi?.id||null;
assert.equal(open('BATIMENT0000000301149547'),'poi:mairie','mairie → '+open('BATIMENT0000000301149547'));assert.equal(open('BATIMENT0000000301149810'),'poi:cpi','CPI → '+open('BATIMENT0000000301149810'));
const school=REG.places.find(e=>e.id==='poi:ecole-primaire').building_ids;
const parcel=['BATIMENT0000000301149547','BATIMENT0000000301149544','BATIMENT0000000301149527','BATIMENT0000000301149424','BATIMENT0000000301149543','BATIMENT0000000301149803','BATIMENT0000000301149810','BATIMENT0000000301149528','BATIMENT0000000301149545','BATIMENT0000000301149549','BATIMENT0000000301149548','BATIMENT0000000301149546'];
for(const id of parcel)if(!school.includes(id))assert.notEqual(open(id),'poi:ecole-primaire','bâtiment de la parcelle D2377 capturé par l’école : '+id);
assert.notEqual(open('BATIMENT0000000301149569'),open('BATIMENT0000002006956400'));
ok(`7. conflits : mairie → Mairie, CPI → CPI, ${parcel.length-school.length} bâtiments de la parcelle communale D2377 hors école non capturés par l’école, salle polyvalente ≠ Maison des associations`);
