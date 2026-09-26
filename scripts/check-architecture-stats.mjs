// V2.3.1 check:architecture-stats — the published statistics are recomputed from the 2 596 profiles and every
// breakdown adds up to the corpus; the documented exceptions (4 UNKNOWN, 75 masked, 12 manual V2.2), the landmarks
// and the freeze manifest agree with the data; the 42 frozen geography files have not drifted.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const A=read('public/data/building-architecture-v2.3.json'),B=A.buildings,N=2596,S=A.metadata.stats;
const X=read('unreal/freeze-v1/architecture-exceptions.json'),L=read('unreal/architecture/landmark-architecture.json'),M=read('docs/freeze/UNREAL_FREEZE_MANIFEST_V1.0.json');
const frozen=read('data-sources/architecture/frozen-geography-v2.2-sha256.json');
const prov=read('unreal/buildings/buildings-provenance-v2.2.json').buildings;
const ok=m=>console.log('PASS '+m);
const tally=f=>B.reduce((a,e)=>{const k=f(e);a[k]=(a[k]||0)+1;return a;},{});
const sum=o=>Object.values(o).reduce((a,b)=>a+b,0);
const same=(a,b,what)=>{for(const k of new Set([...Object.keys(a),...Object.keys(b)]))assert.equal(a[k]||0,b[k]||0,`${what} : ${k} publié ${b[k]} ≠ recalculé ${a[k]}`);};

// 1. Population
assert.equal(B.length,N,'profils');assert.equal(new Set(B.map(e=>e.buildingId)).size,N,'identifiants en double');
assert.equal(prov.length,N);assert.deepEqual(new Set(prov.map(p=>p.id)),new Set(B.map(e=>e.buildingId)),'profils ≠ table de provenance V2.2');
const inCommune=prov.filter(p=>p.inCommune).length;assert.equal(inCommune,2362,'bâtiments dans la commune');
ok(`1. ${N} profils architecture, ${N} identifiants uniques, identiques à la table V2.2 (${inCommune} dans la commune)`);

// 2. Classes
const cls=tally(e=>e.buildingClass);assert.equal(sum(cls),N);same(cls,S.byClass,'classes');
ok(`2. classes : ${Object.keys(cls).length} classes, somme ${sum(cls)} = ${N}, identiques aux statistiques publiées`);

// 3. Roofs
const rc=tally(e=>e.roof.confidence),rt=tally(e=>e.roof.type);assert.equal(sum(rc),N);assert.equal(sum(rt),N);same(rc,S.byRoofConfidence,'confiance de toit');same(rt,S.byRoofType,'type de toit');
assert.equal(rc.unknown,rt.unknown,'toit inconnu : type et confiance divergent');
ok(`3. toits : A ${rc.A} + B ${rc.B} + C ${rc.C} + inconnu ${rc.unknown} = ${sum(rc)} ; types, somme ${sum(rt)}`);

// 4. Ridges: unknown and not_applicable never mixed
const rg=tally(e=>e.roof.ridgeOrientationConfidence);assert.equal(sum(rg),N);
for(const k of ['A','B','C','unknown','not_applicable'])assert.equal(rg[k]||0,S.ridge[k],'faîtage '+k);
for(const e of B){const r=e.roof,na=r.ridgeOrientationStatus==='not_applicable';assert.equal(na,r.type==='flat'||/cylindrique/.test(e.notes),'faîtage sans objet mal attribué : '+e.buildingId);if(na)assert.equal(r.ridgeOrientationDeg,null);}
assert.equal(S.ridge.applicable,N-rg.not_applicable);
ok(`4. faîtages : A ${rg.A} + B ${rg.B} + C ${rg.C} + inconnu ${rg.unknown} + sans objet ${rg.not_applicable} = ${sum(rg)} (applicables ${S.ridge.applicable})`);

// 5. Heights: one best status per building, five statuses adding up to the corpus
const RANK=['official','measured','derived','estimated','unknown'],best=e=>RANK[Math.min(RANK.indexOf(e.wallHeightStatus),RANK.indexOf(e.totalHeightStatus))];
for(const e of B){assert(RANK.includes(e.wallHeightStatus)&&RANK.includes(e.totalHeightStatus),'statut de hauteur hors liste : '+e.buildingId);}
const hb=tally(best);assert.equal(sum(hb),N);same(hb,S.heightBest,'hauteur (meilleur statut)');
same(tally(e=>e.wallHeightStatus),S.wallHeight,'hauteur à l’égout');same(tally(e=>e.totalHeightStatus),S.totalHeight,'point haut');
assert.equal(S.heightOfficialOrMeasured,(hb.official||0)+(hb.measured||0));assert.equal(S.heightUnknown,hb.unknown||0);assert.equal(S.heightEstimated,hb.estimated||0);
assert.equal(S.importantUnknowns.height,hb.unknown||0,'« hauteur inconnue » : une seule définition');
const towers=B.filter(e=>e.buildingClass==='WATER_TOWER');assert.equal(towers.length,2);for(const t of towers){assert.equal(t.totalHeightStatus,'official');assert.equal(best(t),'official');}
ok(`5. hauteurs : officielle ${hb.official||0} + mesurée ${hb.measured||0} + dérivée ${hb.derived||0} + estimée ${hb.estimated||0} + inconnue ${hb.unknown||0} = ${sum(hb)} (2 châteaux d’eau comptés en « officielle »)`);

// 6. Levels, material, colour, overall
const lv=tally(e=>e.levelsStatus);assert.equal(sum(lv),N);
assert.equal(S.levelsSummary.known,(lv.official||0)+(lv.derived||0));assert.equal(S.levelsSummary.estimated,lv.estimated||0);assert.equal(S.levelsSummary.unknown,lv.unknown||0);
for(const e of B)if(e.levelsStatus==='derived')assert(['official','measured'].includes(e.wallHeightStatus),'niveaux dérivés sans hauteur mesurée / officielle : '+e.buildingId);
const mat=tally(e=>e.roof.material==='unknown'?'unknown':'known'),col=tally(e=>e.roof.colorFamily==='unknown'?'unknown':'known'),ov=tally(e=>e.confidenceOverall);
assert.equal(mat.known,S.materialKnown);assert.equal(sum(mat),N);assert.equal(col.known,S.colorKnown);assert.equal(sum(col),N);same(ov,S.overall,'confiance globale');assert.equal(sum(ov),N);
ok(`6. niveaux connus ${S.levelsSummary.known} + estimés ${lv.estimated||0} + inconnus ${lv.unknown||0} ; matériau ${mat.known} + ${mat.unknown} ; couleur ${col.known} + ${col.unknown} ; confiance globale A ${ov.A} + B ${ov.B} + C ${ov.C} + inconnue ${ov.unknown} — toutes = ${N}`);

// 7. Manual V2.2 objects
const manual=B.filter(e=>e.layer==='manual_orthophoto_v2_2'),mf=read('public/data/buildings-manual-v2.2.geojson').features;
assert.equal(manual.length,12);assert.equal(X.manualV22.count,12);assert.equal(mf.length,12);
for(const f of mf){const e=B.find(x=>x.buildingId===f.properties.id);assert(e,'relevé absent : '+f.properties.id);assert.equal(f.properties.provenance,'orthophoto_manual_v2.2');
 assert.equal(e.footprint.geometrySha256,crypto.createHash('sha256').update(JSON.stringify(f.geometry)).digest('hex'),'empreinte modifiée : '+f.properties.id);
 assert(!e.sources.some(s=>/BD TOPO \(référentiel/.test(s)&&/géométrie/.test(s)),'relevé présenté comme géométrie officielle : '+e.buildingId);
 assert(/relevé V2.2 sur orthophoto, observation visuelle/.test(e.trace.class),'classe d’un relevé sans mention de l’observation : '+e.buildingId);}
const byId=new Map(B.map(e=>[e.buildingId,e]));
for(const [k,c] of [['vis-A','brown'],['vis-H1','white']]){const e=byId.get('manual-v2.2:'+k);assert.equal(e.roof.type,'flat',k);assert.equal(e.roof.confidence,'B',k);assert.equal(e.roof.colorFamily,c,k);
 assert.equal(e.wallHeightStatus,'unknown',k);assert.equal(e.totalHeightStatus,'unknown',k);assert.equal(e.lidar.topM,null,k+' : fausse hauteur LiDAR');}
const u2=byId.get('manual-v2.2:vis-U2');assert(u2.buildingClass.startsWith('RES_'));assert.equal(u2.buildingClassConfidence==='A',false,'vis-U2 : usage non officiel ne peut pas être A');
ok('7. 12 relevés V2.2 présents, empreintes identiques, provenance orthophoto_manual_v2.2, jamais officiels ; vis-A et vis-H1 plats (B), hauteur inconnue ; vis-U2 habitation par observation');

// 8. The 4 UNKNOWN and the 75 masked buildings
const unk=B.filter(e=>e.buildingClass==='UNKNOWN').map(e=>e.buildingId).sort();
assert.deepEqual(unk,X.unknownClass.buildings.map(b=>b.id).sort(),'UNKNOWN ≠ liste documentée');assert.equal(unk.length,4);assert.deepEqual(unk,[...M.unknownClassBuildings].sort());
const masked=B.filter(e=>e.lidar.status==='zone masquée');assert.equal(masked.length,75);assert.equal(A.metadata.maskedZone.buildings,75);
assert.deepEqual(masked.map(e=>e.buildingId).sort(),X.maskedZone.buildings.map(b=>b.id).sort(),'bâtiments masqués ≠ annexe');
for(const e of masked){const r=e.roof;for(const s of [r.typeStatus,r.slopeStatus,r.materialStatus,r.colorStatus,e.visibleStoreysStatus])assert(!['measured','orthophoto'].includes(s),'attribut observé en zone masquée : '+e.buildingId);
 assert(!['measured','orthophoto'].includes(e.wallHeightStatus)&&!['measured','orthophoto'].includes(e.totalHeightStatus),'hauteur observée en zone masquée : '+e.buildingId);
 assert.equal(r.type,'unknown');assert.equal(r.colorFamily,'unknown');assert.equal(r.material,'unknown');assert.equal(e.confidenceOverall,'unknown');assert(!['estimated','derived'].includes(e.levelsStatus),'niveaux supposés en zone masquée : '+e.buildingId);}
ok(`8. ${unk.length} UNKNOWN = liste documentée (${unk.join(', ')}) ; ${masked.length} bâtiments masqués identifiés, aucun attribut observé, toit / couleur / matériau inconnus, confiance globale inconnue`);

// 9. Landmarks
assert.equal(L.landmarks.length,16);const uniq=L.landmarks.filter(l=>l.modelingLevel==='unique_model').map(l=>l.id).sort();
assert.deepEqual(uniq,['poi:chateau-eau-granges','poi:chateau-eau-poussey','poi:eglise-saint-denis','poi:monument-aux-morts']);assert.deepEqual([...M.uniqueModelLandmarks].sort(),uniq);
for(const l of L.landmarks)for(const id of l.buildingIds)assert(byId.has(id),'landmark sans bâtiment : '+id);
ok(`9. 16 landmarks, 4 unique_model (${uniq.join(', ')})`);

// 10. Frozen geography and manifest
assert.equal(Object.keys(frozen.files).length,42);
for(const [f,h] of Object.entries(frozen.files)){assert.equal(sha(f),h,'dérive du gel géographique : '+f);
 const v22=crypto.createHash('sha256').update(execFileSync('git',['show',`${M.geographicBaseCommit}:${f}`],{maxBuffer:1<<28})).digest('hex');assert.equal(h,v22,'référence ≠ commit V2.2 : '+f);}
assert.equal(M.geographicBaseCommit,'309e65ed52cfc0947bb8cd66117b7ff84ceb028a');assert.equal(M.buildings,N);assert.equal(M.buildingsInCommune,2362);assert.equal(M.manualBuildingsV22,12);assert.equal(M.architectureProfiles,N);assert.equal(M.geographicFilesFrozen,42);
for(const f of M.files)assert.equal(sha(f.path),f.sha256,'fichier du manifeste modifié : '+f.path);
if(M.finalFreezeCommit){const changed=execFileSync('git',['diff','--name-only',M.finalFreezeCommit,'HEAD'],{encoding:'utf8'}).split('\n').filter(Boolean);
 for(const f of changed)assert(/^docs\/freeze\/|^docs\/audit\/V2\.3\.1_ARCHITECTURE_FREEZE_QA\.md$/.test(f),'fichier modifié après le commit de gel : '+f);}
ok(`10. 42 fichiers géographiques identiques au commit V2.2 (git show 309e65e) ; ${M.files.length} fichiers du manifeste Freeze V1 à jour${M.finalFreezeCommit?` ; commit de gel ${M.finalFreezeCommit.slice(0,7)}`:''}`);
console.log(`check:architecture-stats — 10 contrôles PASS · ${N} profils`);
