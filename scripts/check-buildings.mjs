// Completeness check of the unified building reference (public/data/buildings.geojson).
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {projection,polygons,bounds} from '../src/geo.js';
import {prepareShape,intersectionArea,intersects} from './spatial-match.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const ref=read('public/data/buildings.geojson'),osm=read('public/data/maizieres.geojson'),ign=read('data-sources/ign/batiment.geojson'),commune=read('public/data/commune.geojson');
for(const s of Object.values(ref.metadata.sources))assert.equal(createHash('sha256').update(fs.readFileSync(s.file)).digest('hex'),s.sha256,'Source modifiée depuis la génération : '+s.file);
const project=projection(osm.metadata.origin),b=bounds(polygons(commune,project).flat(2)),e={minX:b.minX-150,maxX:b.maxX+150,minZ:b.minZ-150,maxZ:b.maxZ+150};
const centre=f=>{const bb=bounds(polygons(f,project)[0][0]);return [(bb.minX+bb.maxX)/2,(bb.minZ+bb.maxZ)/2];},inExtent=c=>c[0]>=e.minX&&c[0]<=e.maxX&&c[1]>=e.minZ&&c[1]<=e.maxZ;
const ids=ref.features.map(f=>f.properties.id);
const removedLog=fs.existsSync('data-sources/building-removed.json')?read('data-sources/building-removed.json'):{features:[]},removed=new Set(removedLog.features.map(f=>f.id));assert.equal(new Set(ids).size,ids.length,'Identifiants dupliqués');
for(const f of ref.features){assert(polygons(f,project).length>0,'Géométrie vide '+f.id);assert(polygons(f,project).flat(2).flat().every(Number.isFinite),'Coordonnée non finie '+f.id);}
// 1. Every IGN building of the display extent is present, exactly once, with its own geometry.
const ignRef=new Map(ref.features.filter(f=>f.properties.source==='IGN BD TOPO').map(f=>[f.id,f]));
const ignExpected=ign.features.filter(f=>inExtent(centre(f)));
assert.equal(ignRef.size,ignExpected.length,'Nombre de bâtiments IGN');
for(const f of ignExpected){const r=ignRef.get(f.properties.cleabs);assert(r,'Bâtiment IGN manquant : '+f.properties.cleabs);assert.deepEqual(r.geometry,f.geometry,'Géométrie IGN modifiée : '+f.properties.cleabs);}
// 2. OSM footprints: kept only where IGN has (almost) nothing, never duplicated over an IGN building.
const ignShapes=ignExpected.map(f=>prepareShape(polygons(f,project)));
const osmRef=new Set(ref.features.filter(f=>f.properties.source==='OpenStreetMap').map(f=>f.id));let osmKept=0,osmRepresented=0;
for(const f of osm.features.filter(f=>f.properties.building&&inExtent(centre(f)))){const s=prepareShape(polygons(f,project));const covered=ignShapes.filter(i=>intersects(s.b,i.b)).reduce((a,i)=>a+intersectionArea(s,i),0)/s.area;
 if(covered<.1){assert(osmRef.has(f.id)||removed.has(f.id),'Bâtiment OSM seul absent sans preuve de suppression : '+f.id);if(osmRef.has(f.id))osmKept++;}else{assert(!osmRef.has(f.id),'Doublon OSM sur IGN : '+f.id);osmRepresented++;}}
assert.equal(osmKept,osmRef.size);
// V1.6.1: removals are only OSM-only footprints logged with their evidence; cadastral additions never overlap the reference.
for(const f of removedLog.features){assert(f.properties.source==='OpenStreetMap'&&f.properties.removal?.reason&&f.properties.removal.evidence?.length,'Suppression sans preuve : '+f.id);assert(!ids.includes(f.id));}
const cadAdded=ref.features.filter(f=>f.properties.provenance==='cadastre');for(const f of cadAdded){const s=prepareShape(polygons(f,project));const cov=ref.features.filter(g=>g.properties.provenance!=='cadastre').map(g=>prepareShape(polygons(g,project))).filter(g=>intersects(s.b,g.b)).reduce((a,g)=>a+intersectionArea(s,g),0)/s.area;assert(cov<.1,'Ajout cadastral en doublon : '+f.id);}
// V1.6: Unreal-readiness without Three.js — every feature carries the fields an importer needs.
const levels={};for(const f of ref.features){const p=f.properties;assert(p.id&&p.source&&p.provenance,'Champs d’identité manquants : '+f.id);assert(['Polygon','MultiPolygon'].includes(f.geometry.type));
 assert(p.validation&&['A','B','C'].includes(p.validation.confidence)&&p.validation.status&&p.validation.evidence?.length,'Validation manquante : '+f.id);levels[p.validation.confidence]=(levels[p.validation.confidence]||0)+1;
 if(p.source==='IGN BD TOPO')assert(p.derived&&'wallHeight' in p.derived&&'roofHeight' in p.derived&&p.ign.nature,'Attributs IGN manquants : '+f.id);}
assert(ref.metadata.localProjection&&ref.metadata.validation,'Métadonnées de projection ou de validation absentes');
const byProv=ref.features.reduce((m,f)=>(m[f.properties.provenance]=(m[f.properties.provenance]||0)+1,m),{});
console.log(JSON.stringify({result:'OK',reference:ref.features.length,inCommune:ref.features.filter(f=>f.properties.inCommune).length,ignInExtent:ignExpected.length,osmOnlyKept:osmKept,removedWithEvidence:removed.size,addedFromCadastre:cadAdded.length,osmRepresentedByIgn:osmRepresented,byProvenance:byProv,confidence:levels,duplicates:0},null,2));
