// V1.8 road check: frozen references untouched, no invented geometry or name, documented vs inferred widths kept apart,
// Unreal splines consistent with the common origin and the frozen terrain.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fromArrayBuffer} from 'geotiff';
import {TERRAIN_GRID as G,UNREAL_ORIGIN as O,toL93,toUnreal} from './terrain-frame.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
// 1. Frozen references: buildings (V1.6.2), terrain (V1.7) and the common Unreal origin.
const FROZEN_BUILDINGS_SHA='809f3af371719e2d3adfaa6e55a9d56235e4618e28e8a36595c85d501a4f3095';
const braw=fs.readFileSync('public/data/buildings.geojson'),b=JSON.parse(braw);assert.equal(sha(braw),FROZEN_BUILDINGS_SHA,'Référentiel bâti modifié');
assert.equal(b.features.length,2494);assert.equal(b.features.filter(f=>f.properties.inCommune).length,2265);
const tref=read('unreal/terrain/terrain-reference.json');for(const f of tref.files.filter(f=>f.inGit))assert.equal(sha(fs.readFileSync(f.file)),f.sha256,'Terrain V1.7 modifié : '+f.file);
assert.deepEqual([O.E,O.N,O.H],[758278,6823571,0],'UNREAL_ORIGIN modifiée');assert.deepEqual(toUnreal([758279,6823570,1]),[100,100,100]);
// 2. Road reference: every BD TOPO troncon kept with its exact geometry; OSM complements lie on their OSM way.
const R=read('public/data/roads.geojson'),bd=read('data-sources/roads/bdtopo-troncon-de-route.geojson'),osm=read('public/data/maizieres.geojson');
assert.equal(sha(fs.readFileSync('data-sources/roads/bdtopo-troncon-de-route.geojson')),R.metadata.sources.bdtopo.sha256,'Instantané BD TOPO modifié');
const ids=R.features.map(f=>f.id);assert.equal(new Set(ids).size,ids.length,'Identifiants dupliqués');const byId=new Map(R.features.map(f=>[f.id,f]));
for(const f of bd.features){const r=byId.get(f.properties.cleabs);assert(r,'Tronçon BD TOPO manquant : '+f.properties.cleabs);assert.deepEqual(r.geometry,f.geometry,'Géométrie BD TOPO modifiée : '+f.properties.cleabs);
 assert.equal(r.properties.structure,f.properties.position_par_rapport_au_sol==='1'?'pont':f.properties.position_par_rapport_au_sol==='-1'?'souterrain':'sol');
 if(f.properties.largeur_de_chaussee>0){assert.equal(r.properties.widthSource,'official');assert.equal(r.properties.width,+f.properties.largeur_de_chaussee);}}
const osmWay=new Map(osm.features.filter(f=>f.properties.highway).map(f=>[f.id,f.geometry.coordinates.map(c=>toL93(c))]));
const onLine=(p,l)=>{let m=Infinity;for(let i=1;i<l.length;i++){const a=l[i-1],c=l[i],dx=c[0]-a[0],dy=c[1]-a[1],L=dx*dx+dy*dy,t=Math.max(0,Math.min(1,L?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L:0));m=Math.min(m,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy));}return m;};
const CATS=Object.keys(R.metadata.categories),INF=R.metadata.inferredWidths;let osmFeatures=0;
for(const f of R.features){const p=f.properties;assert(CATS.includes(p.category),'Catégorie : '+f.id);assert(['measured','official','osm','inferred'].includes(p.widthSource));assert(p.width>0);
 assert.equal(p.widthInferred,INF[p.category]);if(p.widthSource==='inferred')assert.equal(p.width,INF[p.category]);if(p.widthSource!=='official')assert.equal(p.widthOfficial,null);
 if(['chemin_carrossable','chemin_rural','sentier'].includes(p.category))assert(!p.paved&&p.unrealType!=='paved','Chemin présenté comme route revêtue : '+f.id);
 // Names only from sources: BAN / BD TOPO collaborative / OSM.
 if(p.name)assert([...p.nameBan,...p.nameCollaboratif,p.nameOsm].includes(p.name),'Nom sans source : '+f.id);
 if(p.provenance==='osm'){osmFeatures++;const l=osmWay.get(p.osmIds[0]);assert(l,'Voie OSM source absente : '+f.id);for(const c of f.geometry.coordinates)assert(onLine(toL93(c),l)<.1,'Géométrie OSM inventée : '+f.id);}}
// 3. Unreal splines: each active troncon in exactly one spline, points = toUnreal(pointsL93), Z = frozen terrain (bridges: interpolated deck).
const U=read('unreal/roads/road-splines.json'),tb=fs.readFileSync('unreal/terrain/maizieres-mnt-lidarhd-1m-lamb93-ign69.tif'),[grid]=await (await (await fromArrayBuffer(tb.buffer.slice(tb.byteOffset,tb.byteOffset+tb.length))).getImage()).readRasters();
const tz=(E,N)=>{const i=E-G.west,j=G.north-N,i0=Math.floor(i),j0=Math.floor(j),fx=i-i0,fy=j-j0,k=j0*G.cols+i0;return (grid[k]*(1-fx)+grid[k+1]*fx)*(1-fy)+(grid[k+G.cols]*(1-fx)+grid[k+G.cols+1]*fx)*fy;};
assert.deepEqual(U.metadata.unrealOrigin,O);const seen=new Map();let pts=0,ground=0;
for(const s of U.splines){assert.equal(s.points.length,s.pointsL93.length);assert(s.points.length>=2);for(const t of s.troncons){if(s.id.includes('~'))continue;assert(!seen.has(t),'Tronçon dans deux splines : '+t);seen.set(t,s.id);}
 for(let i=0;i<s.points.length;i++){const [E,N,Z]=s.pointsL93[i],u=toUnreal([E,N,Z]);assert(s.points[i].every((v,k)=>Math.abs(v-u[k])<=1),'Conversion Unreal : '+s.id);assert(E>=G.west&&E<=G.east&&N>=G.south&&N<=G.north);pts++;
  if(i)assert(Math.hypot(E-s.pointsL93[i-1][0],N-s.pointsL93[i-1][1])<=5.02,'Espacement > 5 m : '+s.id);
  if(s.structure==='sol'&&!s.zOverride.includes(i)){assert(Math.abs(Z-tz(E,N))<=.011,'Z ≠ terrain V1.7 : '+s.id);ground++;}else if(s.structure==='sol')assert(s.hiddenStructures.length,'zOverride sans ouvrage documenté : '+s.id);else assert(Z>=tref.stats.min-1&&Z<=tref.stats.max+15);}}
for(const f of R.features.filter(f=>f.properties.excluded))assert(f.properties.provenance==='osm'&&f.properties.excluded.observation,'Exclusion sans preuve : '+f.id);
const active=R.features.filter(f=>!f.properties.excluded&&f.properties.state==='En service'&&!(f.properties.clipped&&!U.splines.some(s=>s.troncons.includes(f.id))));
for(const f of active)assert(seen.has(f.id),'Tronçon sans spline : '+f.id);
for(const br of U.structures.bridges)assert(U.splines.some(s=>s.troncons.includes(br.road)&&s.structure==='pont'));
// 4. Report consistent with the reference.
const rep=read('data-sources/roads/roads-report.json');assert.equal(rep.totals.splines,U.splines.length);assert.equal(rep.frozen.buildingsSha256,FROZEN_BUILDINGS_SHA);assert(rep.bible.checked>70);
console.log(JSON.stringify({result:'OK',troncons:R.features.length,bdtopo:bd.features.length,osmComplements:osmFeatures,splines:U.splines.length,splinePoints:pts,groundPointsOnTerrain:ground,bridges:U.structures.bridges.length,levelCrossings:U.structures.levelCrossings.filter(p=>p.matched).length,buildings:'2494 / 2265 inchangés',terrain:'V1.7 inchangé',unrealOrigin:'E 758278 / N 6823571 / H 0'},null,2));
