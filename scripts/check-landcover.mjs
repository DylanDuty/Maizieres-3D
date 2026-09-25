// V1.10 land-cover check: frozen references untouched (buildings, terrain, roads, rail, UNREAL_ORIGIN), every object traced to an
// immutable snapshot with its source geometry kept exactly, crops dated (never permanent), names only from official data,
// hedges only from the official DSB lines, Unreal conversions exact, simplified shapes derived and never replacing the source.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {TERRAIN_GRID as G,UNREAL_ORIGIN as O,toL93,toUnreal} from './terrain-frame.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),D='data-sources/landcover';
// 1. Frozen references: buildings V1.6.2, terrain V1.7, roads V1.8, rail V1.9, common Unreal origin.
const FROZEN={'public/data/buildings.geojson':'809f3af371719e2d3adfaa6e55a9d56235e4618e28e8a36595c85d501a4f3095',
 'public/data/roads.geojson':'e14c17b94cbe7a126516351add558b5860773c3e2803c04012a0221fe740194e','unreal/roads/road-splines.json':'0e461f899067eb4912964035bbd564070ab66fe415122ae5d2324dfe6414aadc',
 'data-sources/roads/roads-report.json':'4aa95211d90efc6b2a063bd95de649410b16828b3767c52955617b2e4e4376c6','public/data/rail.geojson':'ebc2298e50aabc2b1f692a05db7a48f2010b05b737c95cf3e01acef3a47b5103',
 'unreal/rail/rail-splines.json':'7a082376a4e871749ee7959f10e7daf5bd0d3aef5ffda90706dd0837c01eb73e','data-sources/rail/rail-report.json':'2b753c07a6b07e7059691f24c8a97d23bb1929ee7da6fcce55fbd4a9133866ab',
 'public/data/rail-land.geojson':'9e167248c204015fa941065ef6e098bfeafb8df0ca68420d6aea1bf6027bdce5','public/data/rail-diagnostic.json':'8cf29f353baa95736424232617a91a178edbf04a7d7e44192d8fd38847124a84'};
for(const [f,h] of Object.entries(FROZEN))assert.equal(sha(fs.readFileSync(f)),h,'Référentiel gelé modifié : '+f);
const b=read('public/data/buildings.geojson');assert.equal(b.features.length,2494);assert.equal(b.features.filter(f=>f.properties.inCommune).length,2265);
const tref=read('unreal/terrain/terrain-reference.json');for(const f of tref.files.filter(f=>f.inGit))assert.equal(sha(fs.readFileSync(f.file)),f.sha256,'Terrain V1.7 modifié : '+f.file);
assert.deepEqual([O.E,O.N,O.H],[758278,6823571,0],'UNREAL_ORIGIN modifiée');assert.deepEqual(toUnreal([758279,6823570,1]),[100,100,100]);
// 2. Snapshots: immutable, hashed in the report, fetched over the frozen terrain extent.
const rep=read(`${D}/landcover-report.json`),snap={};
for(const [name,s] of Object.entries(rep.sources)){const raw=fs.readFileSync(`${D}/${name}.geojson`);assert.equal(sha(raw),s.sha256,'Instantané modifié : '+name);snap[name]=JSON.parse(raw);assert(snap[name].metadata.retrievedAt&&snap[name].metadata.source);
 if(!name.includes('codes-cultures'))assert(snap[name].metadata.request.includes([G.west,G.south,G.east,G.north].join(',')),'Emprise de requête : '+name);}
assert.equal(Object.keys(snap).length,17);
// 3. Reference: every object has provenance and confidence, and keeps its source geometry exactly (a line cut by the extent
// into several parts keeps the id of its source with a #n suffix).
const R=read('public/data/landcover.geojson'),F=R.features,osm=read('public/data/maizieres.geojson'),hydro=read('data-sources/rail/bdtopo-troncon-hydrographique.geojson');
const byKey=(fc,k)=>new Map(fc.features.map(f=>[String(k(f)),f]));
const SRC={rpg:byKey(snap['rpg-2024-parcelles'],f=>'rpg2024:'+f.properties.id_parcel),osm:byKey(osm,f=>f.id),hydro:byKey(hydro,f=>f.properties.cleabs)};
for(const n of Object.keys(snap).filter(n=>n.startsWith('bdtopo-')))for(const f of snap[n].features)SRC[f.properties.cleabs]=f;
const LAYERS=['agriculture','woodland','hedge','hedge_polygon','tree','water_line','water_polygon','artificial'];
const count={};for(const f of F){const p=f.properties;assert(LAYERS.includes(p.layer),'Couche : '+f.id);count[p.layer]=(count[p.layer]||0)+1;
 assert(p.provenance&&/^[ABC]/.test(p.confidence),'Provenance ou confiance manquante : '+f.id);assert.equal(p.id,f.id);
 const src=f.id.startsWith('rpg2024:')?SRC.rpg.get(f.id):/^(way|relation|node)\//.test(f.id)?SRC.osm.get(f.id):p.layer==='water_line'?SRC.hydro.get(f.id.replace(/#\d+$/,'')):SRC[f.id.replace(/#\d+$/,'')];
 assert(src,'Objet sans source : '+f.id);if(p.layer!=='tree')assert.deepEqual(f.geometry,src.geometry,'Géométrie source modifiée : '+f.id);
 if(/^(way|relation|node)\//.test(f.id))assert(/^[BC]/.test(p.confidence),'OSM présenté comme officiel : '+f.id);}
assert.equal(new Set(F.map(f=>f.id)).size,F.length,'Identifiants non uniques');
// 4. Agriculture: crop dated and sourced, never a permanent attribute; landuse from the RPG category.
const agri=F.filter(f=>f.properties.layer==='agriculture').map(f=>f.properties);
const USE=['terre_arable','prairie_permanente','prairie_temporaire','culture_permanente','jachere','autre_surface_agricole'];
for(const p of agri){assert(USE.includes(p.landuse_type));assert.equal(p.crop_year,2024);assert(p.crop_source.includes('RPG 2024'));assert(p.cropNote.includes('non permanente'));
 assert.deepEqual(p.cropHistory.map(h=>h.year),[2023,2022],'Historique mal daté : '+p.id);}
assert.equal(agri.length,rep.agriculture.parcels);
// 5. Hedges: only official DSB lines (no parcel edge turned into a hedge); hedge polygons stay separate.
const dsb=byKey(snap['bdtopo-haie'],f=>f.properties.cleabs),H=read('unreal/landcover/hedge-splines.json');
for(const f of F.filter(f=>f.properties.layer==='hedge'))assert(dsb.has(f.id.replace(/#\d+$/,'')),'Haie sans linéaire DSB : '+f.id);
assert(H.hedges.length<=dsb.size);assert.equal(H.hedges.length,count.hedge);
// 6. Names: water names only from official hydrography, never from the image.
for(const f of F.filter(f=>/^water/.test(f.properties.layer)&&f.properties.name))assert(/BD TOPO|BCAE/.test(f.properties.nameSource),'Nom sans source officielle : '+f.id);
assert(!F.some(f=>/canal de Poussey|rivière du Moulin/i.test(f.properties.name||'')),'Nom local attribué sans source');
// 7. Unreal files: frozen origin, exact conversions, points inside the terrain, simplified shape derived (source rings kept).
const onGrid=(E,N)=>E>=G.west-1&&E<=G.east+1&&N>=G.south-1&&N<=G.north+1;let polyPts=0;
for(const [file,L,key] of [['agricultural-polygons','agriculture','objects'],['woodland-polygons','woodland','objects'],['woodland-polygons','hedge_polygon','hedgePolygons'],['water-polygons','water_polygon','objects'],['artificial-surfaces','artificial','objects']]){
 const U=read(`unreal/landcover/${file}.json`);assert.deepEqual(U.metadata.unrealOrigin,O);assert.equal(U[key].length,count[L],'Nombre d’objets Unreal : '+file+' '+L);
 for(const o of U[key]){assert(o.provenance&&o.confidence&&o.geometry&&o.ringsUnrealSimplified);assert.notDeepEqual(o.ringsUnreal,undefined);
  o.ringsL93.forEach((p,i)=>p.forEach((r,j)=>r.forEach(([E,N],k)=>{const u=toUnreal([E,N,0]),v=o.ringsUnreal[i][j][k];assert(Math.abs(u[0]-v[0])<=1.01&&Math.abs(u[1]-v[1])<=1.01,'Conversion Unreal : '+o.id);assert(onGrid(E,N));polyPts++;})));}}
const W=read('unreal/landcover/water-lines.json');assert.deepEqual(W.metadata.unrealOrigin,O);assert.equal(W.lines.length,count.water_line);
for(const s of [...H.hedges,...W.lines]){assert.equal(s.points.length,s.pointsL93.length);s.pointsL93.forEach(([E,N,Z],i)=>{const u=toUnreal([E,N,Z]);assert(s.points[i].every((v,k)=>Math.abs(v-u[k])<=1.01),'Conversion Unreal : '+s.id);assert(onGrid(E,N));});}
for(const w of W.lines){w.pointsL93.forEach(([,,z],i)=>assert(z<=w.zTerrain[i]+.01,'Surface d’eau au-dessus du terrain : '+w.id));assert(!('depth' in w),'Profondeur inventée');}
// 8. Simplification: derived only, tolerance documented, measured loss ≤ 2 % per object; the diagnostic file carries the simplified shapes.
const S=rep.quality.simplification;for(const [k,v] of Object.entries(S.polygons))if(k!=='keptSource'){assert.equal(v.maxVertexDeviationM,.5);assert(v.maxRelAreaDiff<=.02,'Perte de simplification : '+k);}
for(const v of Object.values(S.lines))assert(v.maxDeviationM<=v.toleranceM+1e-9);
const diag=read('public/data/landcover-diagnostic.json');assert.equal(diag.tolerance,.5);assert.equal(diag.polygons.length,F.filter(f=>/Polygon/.test(f.geometry.type)).length);
// 9. Quality: no duplicate, no object without provenance, every open issue listed and counted.
const q=rep.quality;assert.equal(q.duplicates.length,0,'Doublons');assert.equal(q.withoutProvenance,0);
const oi=rep.openIssues;assert.equal(oi.count,oi.overlapsToCheck.length+oi.duplicates.length+oi.relationsOpen.length+oi.uncertainC.length+oi.observations.filter(o=>o.open).length+oi.gapsOpen.length);
for(const o of q.overlaps.filter(o=>o.areaM2>=2000))assert(o.review,'Chevauchement ≥ 0,2 ha non revu : '+o.a+' '+o.b);
// 10. Totals consistent with the report.
assert.equal(count.woodland,rep.woodland.polygons);assert.equal(count.hedge,rep.hedges.count);assert.equal(count.water_line,rep.water.lines);assert.equal(count.artificial,rep.artificial.surfaces);
console.log(JSON.stringify({result:'OK',snapshots:Object.keys(snap).length,objects:count,parcelsHa:rep.agriculture.ha,woodHa:rep.woodland.ha,hedgesKm:rep.hedges.lengthKm,waterKm:rep.water.lengthKm,waterHa:rep.water.polygonsHa,polygonPointsChecked:polyPts,openIssues:oi.count,frozen:'bâti 2494/2265, terrain V1.7, voirie V1.8, ferroviaire V1.9, UNREAL_ORIGIN inchangés'},null,1));
