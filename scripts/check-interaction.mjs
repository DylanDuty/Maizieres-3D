import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {projection,polygons,bounds,area,insidePoly} from '../src/geo.js';
import {clipRing} from '../src/geometry.js';
import {buildBuildings} from '../src/buildings.js';
import {createCatalogue,featureAtFace,segmentDistance} from '../src/cartography.js';
import {describe,KIND_LABELS} from '../src/selection.js';
import {buildingItems} from '../src/building-source.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const data=read('public/data/maizieres.geojson'),enrichment=read('public/data/building-enrichment.json'),zones=read('public/data/named-zones.geojson'),bible=read('public/data/bible-annotations.json'),project=projection(data.metadata.origin),b=bounds(polygons(read('public/data/commune.geojson'),project).flat(2));
const extent={minX:b.minX-150,maxX:b.maxX+150,minZ:b.minZ-150,maxZ:b.maxZ+150},items=[];
items.push(...buildingItems(read('public/data/buildings.geojson'),project,extent).items);
for(const f of data.features)if(f.geometry.type==='Point'&&['school','townhall','community_centre'].includes(f.properties.amenity)){const p=project(f.geometry.coordinates),building=items.find(b=>insidePoly(p,b.poly));if(building)building.t={...building.t,amenity:f.properties.amenity,name:f.properties.name};}
const catalog=createCatalogue(data,enrichment,project,extent,items,zones,bible);
for(const name of ['Rue Pasteur','Poussey','Église Saint-Denis','Zone Industrielle la Glacière'])assert(catalog.records.some(r=>r.name===name),name);
assert.equal(zones.features.length,5);
for(const f of data.features.filter(f=>f.properties.highway&&!f.properties.name&&!f.properties.ref))assert(!catalog.byId.has(f.id),'Voie sans nom inventée');
for(const r of catalog.records.filter(r=>r.type==='line'))for(const id of r.sourceIds){const f=data.features.find(f=>f.id===id);assert.equal(r.name,f.properties.name?.trim()||f.properties.ref);}
assert.equal(segmentDistance([5,4],[0,0],[10,0]),4);assert.equal(segmentDistance([3,4],[0,0],[0,0]),5);
const scene=new THREE.Scene(),built=buildBuildings(scene,items,enrichment);scene.updateMatrixWorld(true);
for(const mesh of built.pickMeshes){const ranges=mesh.userData.featureRanges;let end=0;for(const r of ranges){assert.equal(r.start,end);assert.equal(featureAtFace(ranges,r.start),r.id);assert.equal(featureAtFace(ranges,r.end-1),r.id);end=r.end;}assert.equal(end,mesh.geometry.getAttribute('position').count/3);assert.equal(featureAtFace(ranges,end),null);}
const church=catalog.records.find(r=>r.type==='building'&&r.name==='Église Saint-Denis');assert(church&&church.type==='building');
const ray=new THREE.Raycaster(new THREE.Vector3(church.position[0],100,church.position[2]),new THREE.Vector3(0,-1,0));const hit=ray.intersectObjects(built.pickMeshes,false)[0];assert(hit);assert.equal(featureAtFace(hit.object.userData.featureRanges,hit.faceIndex),church.id);
// V1.4: every building can be described, but an unnamed one only gets a type label, never a name.
const osmNames=new Set([...data.features.map(f=>f.properties.name).filter(Boolean),'Mairie','École primaire','Salle communale']),labels=new Set(['Bâtiment',...Object.values(KIND_LABELS)]);
let generic=0;for(const [id,info] of built.info){if(catalog.byId.has(id))continue;generic++;const d=describe({id,type:'building',generic:true,info,name:info.light&&info.kind!=='canopy'?KIND_LABELS.light:info.knownUsage?KIND_LABELS[info.kind]||'Bâtiment':'Bâtiment',kind:'Bâtiment sans nom connu',source:'Empreinte OpenStreetMap'});assert(labels.has(d.title),'Titre générique inattendu');assert(!d.facts.some(f=>/«/.test(f)));}
// Bible landmark: exactly one junction, placed on both named OSM ways; quotes displayed verbatim.
const gue=catalog.byId.get('bible01:gue-de-la-chapelle');assert(gue&&gue.type==='point','Repère Bible 01 introuvable');
for(const n of ['Avenue du Général de Gaulle','Rue de la Chapelle']){const r=catalog.records.find(r=>r.id==='road:'+n);assert(r.lines.some(l=>l.some((p,i)=>i&&segmentDistance([gue.position[0],gue.position[2]],l[i-1],p)<.5)),'Repère hors de '+n);}
const street=describe(catalog.byId.get('road:Rue Basse de Poussay'));assert.equal(street.title,'Rue Basse de Poussay','Le nom OSM doit rester affiché');assert(street.facts.some(f=>f.includes('Rue Basse-de-Poussey')),'Variante Bible non signalée');
for(const r of catalog.records)if(r.bible&&!r.id.startsWith('bible'))assert(osmNames.has(r.name)||zones.features.some(f=>f.properties.name===r.name)||enrichment.landmarks.some(l=>l.name===r.name),'Nom annoté hors sources : '+r.name);
const audit={result:'OK',genericBuildings:generic,bibleLandmark:{id:gue.id,position:gue.position.map(v=>+v.toFixed(1))},stats:catalog.stats,batchedPickingMeshes:built.pickMeshes.length,churchRaycast:'OK',faceRanges:'complete, without gaps',names:'source names or refs only; existing equipment types retained',namedZones:zones.features.map(f=>({id:f.id,name:f.properties.name}))};
fs.writeFileSync('data-sources/interaction-audit.json',JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(audit,null,2));
