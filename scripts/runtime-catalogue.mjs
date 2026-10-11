// V2.9.2 — the catalogue of the normal map view, rebuilt in Node: the load-time catalogue (scripts/base-catalogue.mjs),
// the POI layer corrected by the canonical register (src/places-canonical.js applyPlaceCorrections), the POI records added
// with the same interactive rule as src/v2-ui.js extendCatalogue, then the register governance (applyRegisters). Used by the
// semantic checks so that they test the code the map runs.
import fs from 'node:fs';
import {loadBaseCatalogue} from './base-catalogue.mjs';
import {applyPlaceCorrections,applyRegisters} from '../src/places-canonical.js';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
export const interactivePoi=(p,technical=false)=>technical||!p.hidden&&!!(p.display||p.landmark||(['secteur','lieu_dit'].includes(p.category)&&p.coh==='current'));
export function loadRuntimeCatalogue({technical=false}={}){
 const base=loadBaseCatalogue(),{catalogue,project,itemById}=base;
 const PR=read('src/content/places-runtime-v292.json'),RR=read('src/content/roads-runtime-v292.json'),scene=read('public/data/v2-scene.json');
 const poi=read('public/data/poi.json');const corrections=applyPlaceCorrections(poi.pois,PR);
 for(const p of poi.pois){if(!interactivePoi(p,technical))continue;const [x,z]=project(p.lonlat);
  const r={id:p.id,name:p.name,type:'point',position:[x,0,z],poi:p,searchAliases:PR.aliases?.[p.id]};catalogue.records.push(r);catalogue.byId.set(r.id,r);
  const ids=p.building_ids.filter(id=>itemById.has(id));if(ids.length){const b={...r,id:ids[0],type:'building',memberIds:ids};for(const id of ids)catalogue.byId.set(id,b);}}
 const stats=applyRegisters(catalogue,{data:{roads:scene.roads},heightAt:()=>0},technical,{places:PR,roads:RR});
 return {...base,poi,corrections,stats,PR,RR,scene};
}
