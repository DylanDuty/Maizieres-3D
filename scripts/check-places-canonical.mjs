// V2.9.2 check:places-canonical — the canonical register of places is complete, coherent with its runtime projection and
// governs every named record of the normal view.
// 1. the register covers the 367 records of the full POI layer, with the fields of the brief and an audit status;
// 2. every interactive record of the web layer has a display status (PASS / PASS_WITH_LIMITATION / HIDDEN_*);
// 3. the runtime projection is exactly the difference between the register and the frozen layer (associations, anchors,
//    addresses, hidden records);
// 4. Salle polyvalente and Maison des associations: two ids, two buildings, two anchors, two cards, both shown;
// 5. no displayed place outside the commune; the 28 lieux-dits of neighbouring communes are hidden;
// 6. every named record built at load time (OSM, BD TOPO, Bible) is governed: alias, hidden or unnamed, none left to review.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {loadRuntimeCatalogue,interactivePoi} from './runtime-catalogue.mjs';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),ok=m=>console.log('PASS '+m);
const REG=read('docs/freeze/MLGU_PLACES_CANONICAL_V1.json'),RT=read('src/content/places-runtime-v292.json'),FULL=read('unreal/poi/poi.json').pois,WEB=read('public/data/poi.json').pois;
const E=new Map(REG.places.map(e=>[e.id,e]));
// 1
assert.equal(REG.places.length,FULL.length,'registre incomplet');for(const p of FULL)assert(E.has(p.id),'lieu absent du registre : '+p.id);
const FIELDS=['id','canonical_name','aliases','category','current_or_historic','valid_from','valid_to','address','anchor','building_ids','road_ids','source_priority','validation_method','audit_status','notes'];
for(const e of REG.places){for(const f of FIELDS)assert(f in e,`champ ${f} absent : ${e.id}`);assert(['PASS','REVIEW','BLOCKED'].includes(e.audit_status),'statut d’audit invalide : '+e.id);
 for(const f of ['lonlat','method','confidence'])assert(f in e.anchor,`anchor.${f} absent : ${e.id}`);}
ok(`1. registre : ${REG.places.length} lieux, champs complets, statut d’audit (${['PASS','REVIEW','BLOCKED'].map(s=>s+' '+REG.places.filter(e=>e.audit_status===s).length).join(', ')})`);
// 2
const DISPLAY=['PASS','PASS_WITH_LIMITATION','HIDDEN_PENDING_REVIEW','HIDDEN_OUT_OF_COMMUNE'];const web=structuredClone(WEB);
const inter=web.filter(p=>interactivePoi(p));for(const p of inter)assert(DISPLAY.includes(E.get(p.id)?.display_status),'lieu interactif sans statut d’affichage : '+p.id);
const blocked=REG.places.filter(e=>e.audit_status==='BLOCKED'&&['PASS','PASS_WITH_LIMITATION'].includes(e.display_status));assert.equal(blocked.length,0,'lieu BLOCKED affiché : '+blocked.map(e=>e.id));
const review=REG.places.filter(e=>e.audit_status==='REVIEW'&&['PASS','PASS_WITH_LIMITATION'].includes(e.display_status));assert.equal(review.length,0,'lieu REVIEW affiché : '+review.map(e=>e.id));
ok(`2. ${inter.length} lieux interactifs de la couche web : tous ont un statut d’affichage ; aucun lieu REVIEW ou BLOCKED affiché`);
// 3
const webById=new Map(WEB.map(p=>[p.id,p]));let n=0;
for(const e of REG.places){const w=webById.get(e.id);if(!w)continue;const o=RT.places[e.id]||{};
 const exp={};if(JSON.stringify(e.building_ids)!==JSON.stringify(w.building_ids))exp.building_ids=e.building_ids;if(e.anchor.lonlat&&JSON.stringify(e.anchor.lonlat)!==JSON.stringify(w.lonlat))exp.lonlat=e.anchor.lonlat;
 if(e.address.full&&e.address.full!==w.address&&e.address.source==='décision V2.9.2')exp.address=e.address.full;if(e.display_status.startsWith('HIDDEN'))exp.hidden=e.display_status;
 for(const k of ['building_ids','lonlat','address','hidden'])assert.deepEqual(o[k],exp[k],`projection ≠ registre (${k}) : ${e.id}`);if(Object.keys(exp).length)n++;}
assert.equal(Object.keys(RT.places).length,n,'projection : entrées en trop');
ok(`3. projection d’exécution = registre − couche gelée : ${n} lieux corrigés ou masqués`);
// 4
const salle=E.get('poi:salle-polyvalente'),mda=E.get('poi:maison-des-associations'),R=loadRuntimeCatalogue();
assert.deepEqual(salle.building_ids,['BATIMENT0000000301149569'],'salle polyvalente : bâtiment attendu …149569');assert.deepEqual(mda.building_ids,['BATIMENT0000002006956400'],'Maison des associations : bâtiment attendu …2006956400');
assert(!salle.building_ids.some(id=>mda.building_ids.includes(id)),'bâtiment partagé salle / Maison des associations');
const d=Math.hypot(...R.project(salle.anchor.lonlat).map((v,i)=>v-R.project(mda.anchor.lonlat)[i]));assert(d>30,'ancres trop proches : '+d);
for(const e of [salle,mda])assert(['PASS','PASS_WITH_LIMITATION'].includes(e.display_status),'non affiché : '+e.id);
const ownS=R.catalogue.byId.get('BATIMENT0000000301149569'),ownM=R.catalogue.byId.get('BATIMENT0000002006956400');
assert.equal(ownS?.poi?.id,'poi:salle-polyvalente','clic …149569 ≠ salle polyvalente');assert.equal(ownM?.poi?.id,'poi:maison-des-associations','clic …2006956400 ≠ Maison des associations');
assert(!R.catalogue.records.some(r=>r.name&&/salle polyvalente/i.test(r.name)&&r.id!=='poi:salle-polyvalente'),'second enregistrement « Salle polyvalente »');
ok(`4. salle polyvalente (…149569, ${salle.display_status}) et Maison des associations (…2006956400, ${mda.display_status}) : deux ids, deux bâtiments, ancres à ${Math.round(d)} m, deux fiches, un seul enregistrement « Salle polyvalente »`);
// 5
const shownOut=REG.places.filter(e=>e.in_commune===false&&['PASS','PASS_WITH_LIMITATION'].includes(e.display_status));assert.equal(shownOut.length,0,'lieu hors commune affiché : '+shownOut.map(e=>e.id));
const hidOut=REG.places.filter(e=>e.display_status==='HIDDEN_OUT_OF_COMMUNE');for(const e of hidOut)assert(!R.catalogue.records.some(r=>r.id===e.id),'lieu hors commune encore interactif : '+e.id);
ok(`5. aucun lieu hors commune affiché ; ${hidOut.length} lieux-dits des communes voisines masqués`);
// 6
const governed=REG.catalogueRecords;assert(governed.length>0);assert.equal(governed.filter(c=>c.action==='review').length,0,'enregistrement hérité non gouverné');
for(const c of governed){assert.equal(RT.catalogue[c.record_id]?.a,c.action,'projection catalogue ≠ registre : '+c.record_id);if(c.action==='alias')assert(['PASS','PASS_WITH_LIMITATION'].includes(E.get(c.matched_place)?.display_status),'alias vers un lieu non affiché : '+c.record_id);}
for(const r of R.catalogue.records.filter(r=>r.type!=='line'&&!r.poi))assert(r.alias&&r.type==='zone','enregistrement nommé non certifié encore interactif : '+r.id+' '+r.name);
const leftover=R.catalogue.records.filter(r=>r.type==='building'&&!r.poi);assert.equal(leftover.length,0);
ok(`6. ${governed.length} enregistrements hérités gouvernés : ${['alias','hide','unname'].map(a=>a+' '+governed.filter(c=>c.action===a).length).join(', ')} ; plus aucun lieu nommé interactif hors registre`);
