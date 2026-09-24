import fs from 'node:fs';
import assert from 'node:assert/strict';
import {projection,polygons,lines,bounds,insidePoly,area} from '../src/geo.js';
import {clipLine,clipRing} from '../src/geometry.js';
const data=JSON.parse(fs.readFileSync('public/data/maizieres.geojson'));
const boundary=JSON.parse(fs.readFileSync('public/data/commune.geojson'));
assert.equal(boundary.properties.code,'10220');assert.equal(data.metadata.insee,'10220');
const project=projection(data.metadata.origin),border=polygons(boundary,project);
assert(border.some(poly=>insidePoly([0,0],poly)),'Origine hors commune');
const b=bounds(border.flat(2)),extent={minX:b.minX-150,maxX:b.maxX+150,minZ:b.minZ-150,maxZ:b.maxZ+150};
assert(extent.maxX-extent.minX<7000&&extent.maxZ-extent.minZ<7000);
let count=0,inCommune=0,maxArea=0,roads=0,rail=0;
const allowed=p=>p.every(Number.isFinite)&&p[0]>=extent.minX-.01&&p[0]<=extent.maxX+.01&&p[1]>=extent.minZ-.01&&p[1]<=extent.maxZ+.01;
for(const f of data.features){for(const poly of polygons(f,project)){for(const r of poly){const clipped=clipRing(r,extent);assert(clipped.every(allowed),'Polygone hors emprise');}if(f.properties.building){const a=area(poly[0]);assert(a>0&&a<100000,'Empreinte aberrante');maxArea=Math.max(maxArea,a);count++;const bb=bounds(poly[0]),center=[(bb.minX+bb.maxX)/2,(bb.minZ+bb.maxZ)/2];if(border.some(p=>insidePoly(center,p)))inCommune++;}}
for(const l of lines(f,project)){const clipped=clipLine(l,extent);assert(clipped.flat().every(allowed),'Ligne hors emprise');if(f.properties.highway)roads++;if(f.properties.railway==='rail')rail++;}}
assert(count>1000&&roads>300&&rail>5,'Données essentielles manquantes');
assert(data.features.some(f=>f.properties.name==='Poussey'&&f.properties.place==='hamlet'));
assert(data.features.some(f=>f.properties.name==='Église Saint-Denis'));
assert(data.features.some(f=>f.properties.ref==='D 619'));
assert(project([data.metadata.origin[0]+.001,data.metadata.origin[1]])[0]>70,'Est inversé');
assert(project([data.metadata.origin[0],data.metadata.origin[1]+.001])[1]<-110,'Nord inversé');
console.log(JSON.stringify({result:'OK',buildings:count,inCommune,contextBuildings:count-inCommune,roads,rail,maxBuildingAreaM2:Math.round(maxArea),extent,osmTimestamp:data.metadata.osmTimestamp},null,2));
