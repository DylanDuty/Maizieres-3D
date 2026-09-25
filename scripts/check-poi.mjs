// V1.11 POI and toponymy check: frozen references untouched (buildings, terrain, roads, rail, land cover, UNREAL_ORIGIN, Bibles),
// every Bible text an exact quote, every place traced to its sources, historical places never shown as current, links to existing
// buildings and roads, exact Unreal conversions, polygons only where a limit exists, official street forms kept.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {TERRAIN_GRID as G,UNREAL_ORIGIN as O,toUnreal} from './terrain-frame.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),D='data-sources/poi';
// 1. Frozen references: buildings V1.6.2, terrain V1.7, roads V1.8, rail V1.9, land cover V1.10, common Unreal origin.
const FROZEN={'public/data/buildings.geojson':'809f3af371719e2d3adfaa6e55a9d56235e4618e28e8a36595c85d501a4f3095',
 'public/data/roads.geojson':'e14c17b94cbe7a126516351add558b5860773c3e2803c04012a0221fe740194e','unreal/roads/road-splines.json':'0e461f899067eb4912964035bbd564070ab66fe415122ae5d2324dfe6414aadc',
 'data-sources/roads/roads-report.json':'4aa95211d90efc6b2a063bd95de649410b16828b3767c52955617b2e4e4376c6','public/data/rail.geojson':'ebc2298e50aabc2b1f692a05db7a48f2010b05b737c95cf3e01acef3a47b5103',
 'unreal/rail/rail-splines.json':'7a082376a4e871749ee7959f10e7daf5bd0d3aef5ffda90706dd0837c01eb73e','data-sources/rail/rail-report.json':'2b753c07a6b07e7059691f24c8a97d23bb1929ee7da6fcce55fbd4a9133866ab',
 'public/data/rail-land.geojson':'9e167248c204015fa941065ef6e098bfeafb8df0ca68420d6aea1bf6027bdce5','public/data/rail-diagnostic.json':'8cf29f353baa95736424232617a91a178edbf04a7d7e44192d8fd38847124a84',
 'public/data/landcover.geojson':'67076773d34ca3255a1d542a2890a3d4353700fbaca931b878ea1360b277fac4','public/data/landcover-diagnostic.json':'268b2534170cb237b76ecbb6558fc728736e3d12baaa12aeaae012051193ff10',
 'unreal/landcover/agricultural-polygons.json':'998e2f877c237ec543f55b8ca61c4605087cf3a21a75702952bce29418324a9b','unreal/landcover/artificial-surfaces.json':'539e61368f5cb8cc55c23b55a80718a68de919d7cee606961ff2bb53df79689d',
 'unreal/landcover/hedge-splines.json':'9950a1745a1323d711f64c1ade9596c955915c66e4e876146106af9749747a1d','unreal/landcover/water-lines.json':'5f0931467a8719120fd993efb2a787e556f62ebc75f78f5400e8ce73b19534c7',
 'unreal/landcover/water-polygons.json':'573982fb5c1aea012ee1c2294af83712b3b2d65fa3cf2849a4bd5a767df16001','unreal/landcover/woodland-polygons.json':'0bddb0e46e70566b35dc9a46fa6ae982fe0dd2570fd41f87a18075d81e6694f3',
 'data-sources/landcover/landcover-report.json':'8e4a894f4b687d23cc0e3aed227f968142113da157fb2669ddeb34dea3542374'};
for(const [f,h] of Object.entries(FROZEN))assert.equal(sha(fs.readFileSync(f)),h,'Référentiel gelé modifié : '+f);
const buildings=read('public/data/buildings.geojson').features;assert.equal(buildings.length,2494);assert.equal(buildings.filter(f=>f.properties.inCommune).length,2265);
const tref=read('unreal/terrain/terrain-reference.json');for(const f of tref.files.filter(f=>f.inGit))assert.equal(sha(fs.readFileSync(f.file)),f.sha256,'Terrain V1.7 modifié : '+f.file);
assert.deepEqual([O.E,O.N,O.H],[758278,6823571,0],'UNREAL_ORIGIN modifiée');assert.deepEqual(toUnreal([758279,6823570,1]),[100,100,100]);
// 2. Sources: POI snapshots immutable and hashed; Bibles identical to the canonical archive (docs/bibles/README.md).
const rep=read(`${D}/poi-report.json`);
for(const [name,s] of Object.entries(rep.sources)){const raw=fs.readFileSync(`${D}/${name}.geojson`);assert.equal(sha(raw),s.sha256,'Instantané modifié : '+name);assert(JSON.parse(raw).metadata.request.includes([G.west,G.south,G.east,G.north].join(',')));}
assert.equal(Object.keys(rep.sources).length,9);
const readme=fs.readFileSync('docs/bibles/README.md','utf8'),bibleFile={},bibleText={};
for(const dir of fs.readdirSync('docs/bibles').filter(d=>d.startsWith('BIBLE_'))){const k=dir.slice(6,8),f=`docs/bibles/${dir}/source/`+fs.readdirSync(`docs/bibles/${dir}/source`)[0];bibleFile[k]=f;bibleText[k]=fs.readFileSync(f,'utf8');assert(readme.includes(sha(fs.readFileSync(f))),'Bible modifiée : '+f);assert.equal(rep.bible.bibleSha256[k],sha(fs.readFileSync(f)));}
assert.equal(sha(fs.readFileSync(`${D}/bible-places-v1.11.json`)),rep.bible.extracts.sha256);assert.equal(sha(fs.readFileSync(`${D}/poi-curation-v1.11.json`)),rep.bible.curation.sha256);
// 3. Every Bible text is an exact quote of one line of its Bible (extracts, POI sources, contents, toponymy).
const EX=read(`${D}/bible-places-v1.11.json`);let quotes=0;
const q=(bible,quote,where)=>{assert(quote&&bibleText[bible].includes(quote)&&!/\n/.test(quote),'Citation inexacte ('+where+') : '+String(quote).slice(0,60));quotes++;};
for(const e of [...EX.places,...EX.toponymy,...EX.nameHistory])q(e.bible,e.quote,e.id);
const U=read('unreal/poi/poi.json'),P=U.pois;
for(const p of P){for(const s of p.sources.filter(s=>s.source.startsWith('BIBLE_')))q(s.source.slice(6),s.quote,p.id);for(const c of p.contents)q(c.source.slice(6),c.quote,p.id);}
// 4. Required fields, stable unique ids, provenance and confidence on every place.
const KEYS=['id','name','type','status','current_or_historical','geometry','source','confidence','building_id','road_id','unreal_position'];
assert.equal(new Set(P.map(p=>p.id)).size,P.length,'Identifiants non uniques');
for(const p of P){for(const k of KEYS)assert(k in p,'Champ manquant '+k+' : '+p.id);assert(p.id.startsWith('poi:')&&p.name&&p.type);assert(/^[ABC]$/.test(p.confidence));assert(p.sources.length&&p.source,'Lieu sans source : '+p.id);
 assert(['actuel','ancien','historique','disparu','incertain'].includes(p.status));assert.equal(p.current_or_historical,{actuel:'current',ancien:'historical',historique:'historical',disparu:'historical',incertain:'uncertain'}[p.status]);
 if(!p.geometry){assert.equal(p.unreal_position,null);assert.equal(p.geometryKind,null);assert.equal(p.displayCurrent,false);}else assert(['officielle','documentaire','approximative','ponctuelle'].includes(p.geometryKind),'Nature de géométrie : '+p.id);}
// 5. Historical information is never current: historical / uncertain / OSM-only / C places are not on the current map;
//    a displayed place carries no Bible source saying it closed or disappeared.
for(const p of P){if(p.status!=='actuel')assert.equal(p.displayCurrent,false,'Lieu non actuel affiché : '+p.id);
 if(p.displayCurrent){assert(p.confidence!=='C'&&p.sources.some(s=>s.source!=='OSM'),'Affiché sans preuve suffisante : '+p.id);assert(!p.sources.some(s=>['disparu','ancien'].includes(s.bibleStatus)),'Lieu fermé ou disparu affiché comme actuel : '+p.id);
  if(p.category==='commerce_entreprise'&&!p.sources.some(s=>/^BD TOPO|^BAN/.test(s.source)))assert(p.sources.some(s=>s.lastEvidenceYear>=2023||(s.source==='BIBLE_01'&&/^11/.test(s.section))||s.source==='OSM'),'Commerce affiché sans preuve récente : '+p.id);}}
for(const n of ['poi:gare-ancienne','poi:moulin-poussey','poi:chateau-feodal-poussey','poi:chapelle-des-granges','poi:presbytere-ancien','poi:pharmacie-saint-denis-ancienne'])assert.equal(P.find(p=>p.id===n).displayCurrent,false,'Lieu historique affiché : '+n);
// 6. Links: buildings exist in the frozen reference (footprints untouched), roads exist in V1.8.
const bIds=new Set(buildings.map(f=>f.id)),rIds=new Set(read('public/data/roads.geojson').features.map(f=>f.id));
for(const p of P){for(const id of p.building_ids)assert(bIds.has(id),'Bâtiment inexistant : '+id);assert.equal(p.building_id,p.building_ids[0]||null);if(p.road_id)assert(rIds.has(p.road_id),'Voie inexistante : '+p.road_id);}
const church=P.find(p=>p.id==='poi:eglise-saint-denis');assert.equal(church.building_id,'BATIMENT0000000301149566');assert.equal(church.landmark_priority,1);
const pres=P.find(p=>p.id==='poi:presbytere-ancien');assert(pres.building_ids.length&&pres.address==='15 rue Pasteur'&&pres.status==='historique');
// 7. Unreal: frozen origin, exact conversions, positions inside the terrain, plausible ground Z.
for(const f of ['poi','areas','landmarks'])assert.deepEqual(read(`unreal/poi/${f}.json`).metadata.unrealOrigin,O);
for(const p of P.filter(p=>p.geometry)){const [E,N,Z]=p.L93,u=toUnreal([E,N,Z]);assert(p.unreal_position.every((v,k)=>Math.abs(v-u[k])<=1.01),'Conversion Unreal : '+p.id);assert(E>=G.west&&E<=G.east&&N>=G.south&&N<=G.north,'Hors emprise : '+p.id);assert(Z>60&&Z<130,'Z implausible : '+p.id);}
// 8. Areas: a polygon only where an official (or OSM, approximate) limit exists; otherwise a point; never a polygon drawn around a Bible name.
const A=read('unreal/poi/areas.json').areas;
for(const a of A){assert(P.some(p=>p.id===a.poiId),'Zone sans lieu : '+a.id);if(a.ringsL93){assert(['officielle','approximative'].includes(a.geometryKind));assert(/^BD TOPO|^OSM/.test(a.source),'Polygone sans source : '+a.id);
  a.ringsL93.forEach((poly,i)=>poly.forEach((r,j)=>r.forEach(([E,N],k)=>{const u=toUnreal([E,N,0]),v=a.ringsUnreal[i][j][k];assert(Math.abs(u[0]-v[0])<=1.01&&Math.abs(u[1]-v[1])<=1.01);})));}
 else assert(a.point||a.geometryKind===null);}
for(const k of ['poi:poussey','poi:les-granges','poi:centre-bourg'])assert(!A.find(a=>a.poiId===k).ringsL93,'Polygone arbitraire autour de '+k);
// 9. Landmarks: explicit P1 / P2 / P3 list, each flagged for a specific Unreal treatment; P1 positioned on a building.
const L=read('unreal/poi/landmarks.json').landmarks;assert(L.some(l=>l.priority===1)&&L.some(l=>l.priority===2)&&L.some(l=>l.priority===3));
for(const l of L){const p=P.find(x=>x.id===l.poiId);assert.equal(p.unreal_asset_priority,'landmark');assert.equal(p.landmark_priority,l.priority);if(l.priority===1)assert(p.geometry&&p.building_ids.length,'Landmark P1 sans bâtiment : '+p.id);}
assert(!L.some(l=>l.poiId==='poi:moulin-poussey'),'Moulin de Poussey : présence actuelle non documentée');
// 10. Toponymy: every BAN street keeps its official graphie; variants and conflicts documented with their sources.
const T=rep.toponymyDetail,banStreets=new Set(read(`${D}/ban-adresses.geojson`).features.filter(f=>f.properties.code_insee==='10220').map(f=>f.properties.nom_voie));
for(const n of banStreets)assert(T.streets.some(s=>s.official===n||s.forms.some(f=>f.name===n&&f.sources.includes('BAN'))),'Nom BAN absent : '+n);
for(const s of T.streets.filter(s=>s.official))assert(s.forms.some(f=>f.name===s.official&&(f.sources.includes('BAN')||f.sources.includes('BD TOPO voie nommée'))),'Forme officielle remplacée : '+s.official);
assert(T.conflicts.length>0&&T.lieuDitVariants.every(v=>v.official&&v.variant&&v.variantSource));
// 11. Report totals consistent with the files.
assert.equal(rep.totals.poi,P.length);assert.equal(rep.totals.displayedCurrent,P.filter(p=>p.displayCurrent).length);assert.equal(rep.totals.withBuilding,P.filter(p=>p.building_ids.length).length);
const pub=read('public/data/poi.json');assert.equal(pub.pois.length,P.filter(p=>p.geometry).length);assert.equal(pub.areas.length,A.filter(a=>a.ringsL93).length);
console.log(JSON.stringify({result:'OK',poi:P.length,current:rep.totals.current,historical:rep.totals.historical,uncertain:rep.totals.uncertain,displayed:rep.totals.displayedCurrent,withBuilding:rep.totals.withBuilding,quotesVerified:quotes,areas:A.length,landmarks:rep.totals.landmarks,
 frozen:'bâti 2494/2265, terrain V1.7, voirie V1.8, ferroviaire V1.9, occupation du sol V1.10, UNREAL_ORIGIN, Bibles inchangés'},null,1));
