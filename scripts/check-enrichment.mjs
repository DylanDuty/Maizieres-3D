import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {projection,polygons,bounds,area} from '../src/geo.js';
import {Batch,clipRing} from '../src/geometry.js';
import {prepareShape,intersectionArea} from './spatial-match.mjs';
import {buildingProfile} from '../src/building-profile.js';
import {buildBuildings} from '../src/buildings.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const hashes={'maizieres.geojson':'ddc94faec8033d224ba06ada9d0f5c0802af21327ca4a0a106414355477ea991','commune.geojson':'bd7d8cc25cb9ac694b2eb930ede0c6a027d0afc2329f22551c4def483a952c6f'};
for(const [file,expected] of Object.entries(hashes))assert.equal(createHash('sha256').update(fs.readFileSync('public/data/'+file)).digest('hex'),expected,'Géographie source modifiée : '+file);
const square=[[0,0],[10,0],[10,10],[0,10],[0,0]],hole=[[3,3],[7,3],[7,7],[3,7],[3,3]],poly=[square,hole];
const shape=prepareShape([poly]);assert.equal(shape.area,84);assert(Math.abs(intersectionArea(shape,prepareShape([[square]]))-84)<1e-6);
assert.equal(intersectionArea(shape,prepareShape([[hole]])),0,'Un trou ne doit pas compter dans le rapprochement');
const batch=new Batch(null);batch.polygon(poly,0,'#ffffff');let renderedArea=0;for(let i=0;i<batch.p.length;i+=9)renderedArea+=area([[batch.p[i],batch.p[i+2]],[batch.p[i+3],batch.p[i+5]],[batch.p[i+6],batch.p[i+8]]]);assert.equal(renderedArea,84,'Régression de triangulation des cours intérieures');
const profile=buildingProfile({building:'yes'},[square],{wallHeight:6,roofHeight:2,floors:2},'test');assert.equal(profile.wallHeight,6);assert.equal(profile.roofHeight,2);assert.equal(profile.roofDirectionSource,'inferred from footprint');
const data=read('public/data/maizieres.geojson'),enrichment=read('public/data/building-enrichment.json'),project=projection(data.metadata.origin),b=bounds(polygons(read('public/data/commune.geojson'),project).flat(2));
const extent={minX:b.minX-150,maxX:b.maxX+150,minZ:b.minZ-150,maxZ:b.maxZ+150},items=[];
for(const f of data.features.filter(f=>f.properties.building))for(const raw of polygons(f,project)){const bb=bounds(raw[0]),x=(bb.minX+bb.maxX)/2,z=(bb.minZ+bb.maxZ)/2;if(x<extent.minX||x>extent.maxX||z<extent.minZ||z>extent.maxZ)continue;const poly=raw.map(r=>clipRing(r,extent)).filter(r=>r.length>=3);if(poly.length)items.push({poly,t:f.properties,id:f.id});}
const ids=new Set(items.map(i=>i.id));let matched=0;
for(const [id,e] of Object.entries(enrichment.buildings)){assert(ids.has(id));if(!e.ignId)continue;matched++;assert(e.match.iou>=.5&&e.match.osmCoverage>=.65&&e.match.iou-e.match.runnerUpIou>=.149);if(e.wallHeight)assert(e.wallHeight>0&&e.wallHeight<80&&e.heightAccuracy>0&&e.heightAccuracy<=5);if(e.roofHeight)assert(e.roofHeight>=.6&&e.roofHeight<=9);}
assert.equal(matched,enrichment.metadata.stats.matched);
const scene=new THREE.Scene(),result=buildBuildings(scene,items,enrichment);assert.equal(result.count,1968);let maxY=0,vertices=0;
scene.traverse(o=>{const positions=o.geometry?.getAttribute('position');if(!positions)return;for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);assert([x,y,z].every(Number.isFinite));assert(x>=extent.minX-.1&&x<=extent.maxX+.1&&z>=extent.minZ-.1&&z<=extent.maxZ+.1);assert(y>=0&&y<90);maxY=Math.max(maxY,y);vertices++;}});
console.log(JSON.stringify({result:'OK',sourceHashes:'unchanged',courtyardAreaM2:renderedArea,matched,buildings:result.count,stats:result.stats,maxHeightM:+maxY.toFixed(2),buildingTriangles:vertices/3},null,2));
