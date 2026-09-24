// V1.9 railway check: frozen references untouched (buildings, terrain, roads, UNREAL_ORIGIN), no invented track, BD TOPO
// axes kept exactly, OSM tracks on their source geometry, statuses and structures documented, Unreal splines consistent.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {TERRAIN_GRID as G,UNREAL_ORIGIN as O,toL93,toUnreal} from './terrain-frame.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
// 1. Frozen references: buildings V1.6.2, terrain V1.7, roads V1.8, common Unreal origin.
const FROZEN={buildings:'809f3af371719e2d3adfaa6e55a9d56235e4618e28e8a36595c85d501a4f3095',roads:'e14c17b94cbe7a126516351add558b5860773c3e2803c04012a0221fe740194e',roadSplines:'0e461f899067eb4912964035bbd564070ab66fe415122ae5d2324dfe6414aadc',roadReport:'4aa95211d90efc6b2a063bd95de649410b16828b3767c52955617b2e4e4376c6'};
const braw=fs.readFileSync('public/data/buildings.geojson'),b=JSON.parse(braw);assert.equal(sha(braw),FROZEN.buildings,'Référentiel bâti modifié');assert.equal(b.features.length,2494);assert.equal(b.features.filter(f=>f.properties.inCommune).length,2265);
const tref=read('unreal/terrain/terrain-reference.json');for(const f of tref.files.filter(f=>f.inGit))assert.equal(sha(fs.readFileSync(f.file)),f.sha256,'Terrain V1.7 modifié : '+f.file);
assert.equal(sha(fs.readFileSync('public/data/roads.geojson')),FROZEN.roads,'Voirie V1.8 modifiée');assert.equal(sha(fs.readFileSync('unreal/roads/road-splines.json')),FROZEN.roadSplines,'Splines routières V1.8 modifiées');assert.equal(sha(fs.readFileSync('data-sources/roads/roads-report.json')),FROZEN.roadReport);
assert.deepEqual([O.E,O.N,O.H],[758278,6823571,0],'UNREAL_ORIGIN modifiée');assert.deepEqual(toUnreal([758279,6823570,1]),[100,100,100]);
// 2. Reference: every BD TOPO axis kept exactly; every OSM track on its source geometry; no historic element in the current network.
const R=read('public/data/rail.geojson'),bd=read('data-sources/roads/bdtopo-troncon-de-voie-ferree.geojson'),osm=read('public/data/maizieres.geojson');
assert.equal(sha(fs.readFileSync('data-sources/roads/bdtopo-troncon-de-voie-ferree.geojson')),R.metadata.sources.bdtopo.sha256);
const axes=new Map(R.features.filter(f=>f.properties.layer==='axis').map(f=>[f.id,f]));for(const f of bd.features){const a=axes.get(f.properties.cleabs);assert(a,'Axe BD TOPO manquant : '+f.properties.cleabs);assert.deepEqual(a.geometry,f.geometry,'Axe BD TOPO modifié');assert(a.properties.representedBy.length,'Axe sans voie représentée : '+a.id);}
const osmLines=new Map(osm.features.filter(f=>f.properties.railway).map(f=>[f.id,f]));const tracks=R.features.filter(f=>f.properties.layer==='track');
const onLine=(p,l)=>{let m=Infinity;for(let i=1;i<l.length;i++){const a=l[i-1],c=l[i],dx=c[0]-a[0],dy=c[1]-a[1],L=dx*dx+dy*dy,t=Math.max(0,Math.min(1,L?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L:0));m=Math.min(m,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy));}return m;};
const STATUS=Object.keys(R.metadata.statusValues);
for(const t of tracks){const p=t.properties;assert(STATUS.includes(p.status),'Statut : '+t.id);assert(p.statusEvidence.length);assert(!['former_alignment','removed'].includes(p.status),'Élément historique dans le réseau actuel : '+t.id);
 if(p.status==='unknown')assert.equal(p.statusConfidence,null);else assert(p.statusConfidence);
 const src=p.osmId?osmLines.get(p.osmId):bd.features.find(f=>f.properties.cleabs===t.id);assert(src,'Voie sans source : '+t.id);
 if(p.osmId)assert.equal(osmLines.get(p.osmId).properties.railway,'rail');const l=src.geometry.coordinates.map(c=>toL93(c));for(const c of t.geometry.coordinates)assert(onLine(toL93(c),l)<.1,'Tracé inventé : '+t.id);}
for(const [id,f] of osmLines)if(f.properties.railway==='rail')assert(tracks.some(t=>t.properties.osmId===id),'Voie OSM absente : '+id);
// 3. Unreal splines: one per track, exact conversion, ≤ 25 m between points, inside the terrain, Z plausible and tied to the terrain.
const U=read('unreal/rail/rail-splines.json'),rep=read('data-sources/rail/rail-report.json');assert.deepEqual(U.metadata.unrealOrigin,O);assert.equal(U.splines.length,tracks.length);
let pts=0;for(const s of U.splines){assert(tracks.some(t=>t.id===s.track));assert.equal(s.points.length,s.pointsL93.length);assert.equal(s.terrainZ.length,s.points.length);
 for(let i=0;i<s.points.length;i++){const [E,N,Z]=s.pointsL93[i],u=toUnreal([E,N,Z]);assert(s.points[i].every((v,k)=>Math.abs(v-u[k])<=1),'Conversion Unreal : '+s.id);assert(E>=G.west&&E<=G.east&&N>=G.south&&N<=G.north);pts++;
  if(i)assert(Math.hypot(E-s.pointsL93[i-1][0],N-s.pointsL93[i-1][1])<=25.01,'Points trop espacés : '+s.id);
  if(!s.pointStructure[i])assert(Math.abs(Z-s.terrainZ[i])<=1,'Profil détaché du terrain hors ouvrage : '+s.id+' '+i);}
 assert(s.maxGradePermil<=(s.network==='principal'?12.5:20),'Pente ferroviaire aberrante : '+s.id);}
// 4. Level crossings: 4 PN, each with road, tracks, sources; rail and road at the same level.
assert.equal(rep.levelCrossings.length,4);for(const p of rep.levelCrossings){assert(p.road.ids.length&&p.tracks.length&&p.sources.length,'PN incomplet : '+p.id);assert(p.railMinusRoadM<=.05,'Rail et route à des niveaux différents au '+p.id);}
assert(rep.levelCrossings.some(p=>p.number===73&&/Leclerc/.test(p.roadNames.join())),'PN 73 rue du Général-Leclerc');
// 5. Structures: the rail bridge is carried by a deck, never draped on the terrain.
for(const br of rep.structures.bridges){assert(br.deck.length,'Pont sans tablier : '+br.id);for(const d of br.deck)assert(d.zStart-d.minTerrainBelow>1,'Tablier plaqué sur le MNT : '+br.id);}
assert(rep.historic.every(h=>!tracks.some(t=>t.id===h.id)));
console.log(JSON.stringify({result:'OK',tracks:tracks.length,axes:axes.size,splines:U.splines.length,splinePoints:pts,lengthKm:rep.totals.lengthKm,levelCrossings:rep.levelCrossings.length,bridges:rep.structures.bridges.length,statusKnownShareKm:rep.totals.statusKnownShareKm,zReliableShare:rep.totals.zReliableShare,frozen:'bâti 2494/2265, terrain V1.7, voirie V1.8, UNREAL_ORIGIN inchangés'},null,2));
