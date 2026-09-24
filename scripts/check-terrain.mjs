// V1.7 terrain check: every derived file matches the reference, the Unreal heightmap decodes back to the GeoTIFF within
// its quantisation step, no silent NoData, the frozen building reference is untouched and fully covered.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fromArrayBuffer} from 'geotiff';
import {TERRAIN_GRID as G,UNREAL_ORIGIN as O,TILE_DIR,MANIFEST,toUnreal,fromUnreal,toL93} from './terrain-frame.mjs';
import {readPng16} from './raster-io.mjs';
import {projection,polygons,bounds} from '../src/geo.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
// SHA-256 of public/data/buildings.geojson at the V1.6.2 freeze (commit b1d4c27).
const FROZEN_BUILDINGS_SHA='809f3af371719e2d3adfaa6e55a9d56235e4618e28e8a36595c85d501a4f3095';
const ref=read('unreal/terrain/terrain-reference.json'),L=ref.unrealLandscape;
// 1. Derived files are exactly those described by the reference (the RAW copy is optional: regenerated, not versioned).
for(const f of ref.files){if(!fs.existsSync(f.file)){assert(!f.inGit,'Fichier terrain manquant : '+f.file);continue;}assert.equal(sha(fs.readFileSync(f.file)),f.sha256,'Fichier terrain modifié : '+f.file);}
// 2. Source tiles, when present locally, are the official bytes of the manifest.
const manifest=read(MANIFEST);let tilesChecked=0;for(const t of manifest.tiles){const p=`${TILE_DIR}/${t.name}`;if(fs.existsSync(p)){assert.equal(sha(fs.readFileSync(p)),t.sha256,'Dalle source modifiée : '+t.name);tilesChecked++;}}
assert.equal(manifest.tiles.length,ref.source.tiles);
// 3. GeoTIFF: grid, georeferencing, CRS, statistics, NoData.
const tb=fs.readFileSync('unreal/terrain/maizieres-mnt-lidarhd-1m-lamb93-ign69.tif'),im=await (await fromArrayBuffer(tb.buffer.slice(tb.byteOffset,tb.byteOffset+tb.length))).getImage();
assert.equal(im.getWidth(),G.cols);assert.equal(im.getHeight(),G.rows);assert.deepEqual(im.getBoundingBox(),[G.west-.5,G.south-.5,G.east+.5,G.north+.5]);
const keys=im.getGeoKeys();assert.equal(keys.ProjectedCSTypeGeoKey,2154);assert.equal(keys.VerticalCSTypeGeoKey,5720);
const [z]=await im.readRasters();let mn=Infinity,mx=-Infinity,nd=0;for(const v of z){if(v===-9999){nd++;continue;}if(v<mn)mn=v;if(v>mx)mx=v;}
assert.equal(nd,ref.stats.noData1m,'NoData non déclaré');assert.equal(Math.round(mn*100)/100,ref.stats.min);assert.equal(Math.round(mx*100)/100,ref.stats.max);
// 4. Unreal heightmap: size fits the Landscape layout, and decodes to the GeoTIFF within half a quantisation step.
const hm=readPng16(`unreal/terrain/maizieres-heightmap-${G.cols}x${G.rows}.png`);assert.deepEqual(L.overallResolution,[G.cols,G.rows]);
assert.equal(hm.width,G.cols);assert.equal(hm.height,G.rows);assert.equal((G.cols-1)%254,0);assert.equal((G.rows-1)%254,0);
const zRef=L.location.z/100+O.H,step=L.quantisationStepM;let maxQ=0;for(let k=0;k<z.length;k++){if(z[k]===-9999)continue;const e=Math.abs(zRef+(hm.data[k]-32768)*step-z[k]);if(e>maxQ)maxQ=e;}
assert(maxQ<=step/2+1e-4,'Erreur de quantification '+maxQ);assert.equal(L.scale.z,100,'Échelle Z Unreal : 1 m réel = 1 m Unreal');
// 5. Common origin and Unreal transform: the origin is a terrain node, the landscape corner maps back to the grid corner.
assert(Number.isInteger(O.E-G.west)&&Number.isInteger(G.north-O.N),'Origine hors des nœuds');
assert.deepEqual(fromUnreal([L.location.x,L.location.y,L.location.z]).map(v=>Math.round(v*1000)/1000),[G.west,G.north,zRef]);
for(const p of [[755390.25,6819514.5,61.2],[758278,6823571,0],[761486,6826372,150.37]])assert.deepEqual(fromUnreal(toUnreal(p)).map(v=>Math.round(v*1e6)/1e6),p);
const oL93=toL93(O.sourceLonLat);assert(Math.hypot(oL93[0]-O.E,oL93[1]-O.N)<.05,'Origine Unreal ≠ origine du projet');
// 6. Three.js working grid covers the displayed extent without NoData.
const wm=read('public/data/terrain-threejs.json'),wb=fs.readFileSync('public/data/terrain-threejs.bin');assert.equal(wb.length,wm.cols*wm.rows*2);assert.equal(wm.noData,0,'NoData dans la grille Three.js');
const osm=read('public/data/maizieres.geojson'),commune=read('public/data/commune.geojson'),lb=bounds(polygons(commune.features?commune.features[0]:commune,projection(osm.metadata.origin)).flat(2));
assert(wm.x0<=lb.minX-150&&wm.z0<=lb.minZ-150&&wm.x0+(wm.cols-1)*wm.step>=lb.maxX+150&&wm.z0+(wm.rows-1)*wm.step>=lb.maxZ+150,'Grille Three.js plus petite que la zone affichée');
// 7. Frozen buildings: unchanged file, every building has a terrain altitude, none outside the terrain.
const braw=fs.readFileSync('public/data/buildings.geojson'),buildings=JSON.parse(braw),be=read('public/data/building-terrain-elevation.json');
assert.equal(sha(braw),FROZEN_BUILDINGS_SHA,'Référentiel bâti modifié depuis le gel V1.6.2');assert.equal(be.metadata.buildingsSha256,FROZEN_BUILDINGS_SHA);
assert.equal(buildings.features.length,2494);assert.equal(buildings.features.filter(f=>f.properties.inCommune).length,2265);
for(const f of buildings.features){const b=be.buildings[f.properties.id];assert(b&&!b.noData&&Number.isFinite(b.baseZ),'Altitude manquante : '+f.properties.id);assert(b.baseZ>=ref.stats.min-.01&&b.maxZ<=ref.stats.max+.01);assert(b.baseZ<=b.medianZ&&b.medianZ<=b.maxZ);}
assert.equal(Object.keys(be.buildings).length,2494);
console.log(JSON.stringify({result:'OK',grid:`${G.cols}×${G.rows} nœuds à 1 m`,noData:nd,min:ref.stats.min,max:ref.stats.max,heightmapMaxErrorM:+maxQ.toFixed(4),sourceTilesVerified:tilesChecked+'/'+manifest.tiles.length,threejsGrid:`${wm.cols}×${wm.rows}`,buildingsWithTerrain:Object.keys(be.buildings).length,buildingsInCommune:2265,frozenBuildings:'inchangés'},null,2));
