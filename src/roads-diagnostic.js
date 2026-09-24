import {Batch,material,strip} from './geometry.js';
import {lines} from './geo.js';

// V1.8 ?diagnostic=roads: the technical road reference (public/data/roads.geojson) drawn at its documented width over the
// map. Colour = category; bridges in red; inferred widths are drawn lighter than official ones. Nothing else changes.
export const ROAD_COLORS={route_principale:'#c0392b',route_secondaire:'#e67e22',voie_locale:'#f1c40f',voie_de_desserte:'#9b59b6',voie_pietonne:'#ecf0f1',chemin_carrossable:'#a0763c',chemin_rural:'#6e5433',sentier:'#2e8b57',pont:'#ff0033'};
export async function buildRoadsDiagnostic(scene,project,base){
 const fc=await fetch(`${base}data/roads.geojson`).then(r=>r.json()),batch=new Batch(material()),stats={troncons:0,km:{},official:0,inferred:0,bridges:0};
 for(const f of fc.features){const p=f.properties;if(p.excluded||p.state!=='En service')continue;stats.troncons++;
  const color=p.structure==='pont'?ROAD_COLORS.pont:ROAD_COLORS[p.category],y=p.structure==='pont'?1.1:.7;if(p.structure==='pont')stats.bridges++;
  stats[p.widthSource==='official'?'official':'inferred']++;stats.km[p.category]=(stats.km[p.category]||0)+p.lengthM/1000;
  for(const l of lines(f,project))strip(batch,l,p.width,y,p.widthSource==='official'?color:mix(color));}
 const mesh=batch.mesh(scene,false);if(mesh)mesh.name='roads-diagnostic';return {mesh,stats,metadata:fc.metadata};
}
// Lighter tone for widths estimated from the category (never a measurement).
function mix(hex){const n=parseInt(hex.slice(1),16),c=[n>>16,(n>>8)&255,n&255].map(v=>Math.round(v+(255-v)*.55));return '#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');}
