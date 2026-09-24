import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {projection,polygons,bounds,area,insidePoly} from '../src/geo.js';
import {clipRing} from '../src/geometry.js';
import {buildBuildings} from '../src/buildings.js';
import {createCatalogue,featureAtFace,segmentDistance} from '../src/cartography.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const data=read('public/data/maizieres.geojson'),enrichment=read('public/data/building-enrichment.json'),zones=read('public/data/named-zones.geojson'),project=projection(data.metadata.origin),b=bounds(polygons(read('public/data/commune.geojson'),project).flat(2));
const extent={minX:b.minX-150,maxX:b.maxX+150,minZ:b.minZ-150,maxZ:b.maxZ+150},items=[];
for(const f of data.features.filter(f=>f.properties.building))for(const raw of polygons(f,project)){const bb=bounds(raw[0]),x=(bb.minX+bb.maxX)/2,z=(bb.minZ+bb.maxZ)/2;if(x<extent.minX||x>extent.maxX||z<extent.minZ||z>extent.maxZ)continue;const poly=raw.map(r=>clipRing(r,extent)).filter(r=>r.length>=3);if(poly.length)items.push({poly,t:f.properties,id:f.id});}
for(const f of data.features)if(f.geometry.type==='Point'&&['school','townhall','community_centre'].includes(f.properties.amenity)){const p=project(f.geometry.coordinates),building=items.find(b=>insidePoly(p,b.poly));if(building)building.t={...building.t,amenity:f.properties.amenity,name:f.properties.name};}
const catalog=createCatalogue(data,enrichment,project,extent,items,zones);
for(const name of ['Rue Pasteur','Poussey','Église Saint-Denis','Zone Industrielle la Glacière'])assert(catalog.records.some(r=>r.name===name),name);
assert.equal(zones.features.length,5);
for(const f of data.features.filter(f=>f.properties.highway&&!f.properties.name&&!f.properties.ref))assert(!catalog.byId.has(f.id),'Voie sans nom inventée');
for(const r of catalog.records.filter(r=>r.type==='line'))for(const id of r.sourceIds){const f=data.features.find(f=>f.id===id);assert.equal(r.name,f.properties.name?.trim()||f.properties.ref);}
assert.equal(segmentDistance([5,4],[0,0],[10,0]),4);assert.equal(segmentDistance([3,4],[0,0],[0,0]),5);
const scene=new THREE.Scene(),built=buildBuildings(scene,items,enrichment);scene.updateMatrixWorld(true);
for(const mesh of built.pickMeshes){const ranges=mesh.userData.featureRanges;let end=0;for(const r of ranges){assert.equal(r.start,end);assert.equal(featureAtFace(ranges,r.start),r.id);assert.equal(featureAtFace(ranges,r.end-1),r.id);end=r.end;}assert.equal(end,mesh.geometry.getAttribute('position').count/3);assert.equal(featureAtFace(ranges,end),null);}
const church=catalog.byId.get('way/588791993');assert(church&&church.type==='building');
const ray=new THREE.Raycaster(new THREE.Vector3(church.position[0],100,church.position[2]),new THREE.Vector3(0,-1,0));const hit=ray.intersectObjects(built.pickMeshes,false)[0];assert(hit);assert.equal(featureAtFace(hit.object.userData.featureRanges,hit.faceIndex),church.id);
const audit={result:'OK',stats:catalog.stats,batchedPickingMeshes:built.pickMeshes.length,churchRaycast:'OK',faceRanges:'complete, without gaps',names:'source names or refs only; existing equipment types retained',namedZones:zones.features.map(f=>({id:f.id,name:f.properties.name}))};
fs.writeFileSync('data-sources/interaction-audit.json',JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(audit,null,2));
