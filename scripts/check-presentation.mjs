
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildingProfile,plausibleRoofHeight} from '../src/building-profile.js';
import {qualitySettings} from '../src/quality.js';
import {projection,polygons} from '../src/geo.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
for(const [file,hash] of Object.entries(read('data-sources/v1.1-data-hashes.json')))assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash,'Source V1.1 modifiée : '+file);
assert.equal(plausibleRoofHeight(2.5,8,1,3),2.5,'Une toiture plausible doit rester identique');
assert(plausibleRoofHeight(9,4,1,3)<9,'La toiture aberrante doit être bornée');
assert.equal(qualitySettings('fluid',{dpr:2,cores:2,memory:8}).pixelRatio,1);
assert.equal(qualitySettings('fluid',{dpr:2,cores:8,memory:8}).pixelRatio,1.25);
assert.equal(qualitySettings('high',{dpr:2}).pixelRatio,1.5);
// V1.5: the journal follows the unified building reference actually rendered.
const data=read('public/data/maizieres.geojson'),project=projection(data.metadata.origin),adjustments=[];
for(const f of read('public/data/buildings.geojson').features)for(const poly of polygons(f,project)){
 const pr=f.properties,e=pr.derived?{...pr.derived,ignId:pr.ign?.cleabs||null}:{},t=pr.osm?.tags||{},p=buildingProfile(t,poly,e,pr.id);assert(p,'Profil impossible : '+pr.id);
 if(e.wallHeight&&!t.height)assert.equal(p.wallHeight,e.wallHeight,'Hauteur IGN de mur modifiée');
 if(p.roofHeightClamped)adjustments.push({id:pr.id,osmId:pr.osm?.donor||null,widthM:+(p.axis.max-p.axis.min).toFixed(2),sourceRoofHeight:p.sourceRoofHeight,renderedRoofHeight:+p.roofHeight.toFixed(2),floors:e.floors,wallHeight:p.wallHeight});
}
fs.writeFileSync('data-sources/roof-render-adjustments.json',JSON.stringify({note:'Limites de plausibilité appliquées au rendu uniquement ; valeurs IGN sources inchangées.',adjustments},null,2));
console.log(JSON.stringify({result:'OK',allV11Data:'unchanged',clampedRoofs:adjustments.length,qualityModes:'OK'},null,2));

