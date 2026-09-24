import * as THREE from 'three';
import {Batch,material,strip} from './geometry.js';
import {lines} from './geo.js';

// V1.9 ?diagnostic=rail: the technical railway reference drawn over the map for QA only. One strip per physical track
// (main line, service, uncertain status), rail bridges, level crossings (markers) and the historic alignment (dashed-looking grey).
export const RAIL_COLORS={principal:'#d62828',service:'#f77f00',unknown:'#8d99ae',bridge:'#ff00aa',level:'#ffd60a',historic:'#6c757d'};
export async function buildRailDiagnostic(scene,project,base){
 const [fc,rep]=await Promise.all([fetch(`${base}data/rail.geojson`).then(r=>r.json()),fetch(`${base}data/rail-diagnostic.json`).then(r=>r.json())]);
 const batch=new Batch(material()),stats={principal:0,service:0,unknown:0,km:{principal:0,service:0,unknown:0}};
 for(const f of fc.features.filter(f=>f.properties.layer==='track')){const p=f.properties,k=p.status==='unknown'?'unknown':p.network;stats[k]++;stats.km[k]+=p.lengthM/1000;
  for(const l of lines(f,project))strip(batch,l,k==='principal'?3.2:2,1.2,RAIL_COLORS[k]);}
 for(const b of rep.bridges)strip(batch,[project(b.start),project(b.end)],7,1.6,RAIL_COLORS.bridge);
 for(const h of rep.historic)for(const l of lines({geometry:h.geometry},project))strip(batch,l,1.5,1.1,RAIL_COLORS.historic);
 const mesh=batch.mesh(scene,false);if(mesh)mesh.name='rail-diagnostic';
 const pnGeo=new THREE.CylinderGeometry(6,6,8,20),pnMat=new THREE.MeshBasicMaterial({color:RAIL_COLORS.level});
 for(const pn of rep.levelCrossings){const m=new THREE.Mesh(pnGeo,pnMat),[x,z]=project(pn.lonlat);m.position.set(x,4,z);m.name='pn-'+pn.id;scene.add(m);}
 return {mesh,stats,levelCrossings:rep.levelCrossings.length,bridges:rep.bridges.length,historic:rep.historic.length};
}
