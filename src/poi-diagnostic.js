import * as THREE from 'three';
import {Batch,material,strip} from './geometry.js';

// V1.11 ?diagnostic=poi: the reference of identifiable places drawn for QA only. Colour = temporal status (current shown on the map,
// current still to confirm, uncertain, historical), height = confidence (A tall, B medium, C short), gold ring = Unreal landmark
// (size by priority), flat disc = lieu-dit / sector point, outlines = documented limits. No permanent label is added.
export const POI_COLORS={current:'#2a9d8f',toConfirm:'#8d99ae',uncertain:'#f4a261',historical:'#7b2cbf',landmark:'#ffd166',official:'#1d3557',approximate:'#6c9bd2'};
const HEIGHT={A:22,B:14,C:7};
const STATUS_LABELS={actuel:'actuel',ancien:'ancien (fermé / remplacé)',historique:'historique',disparu:'disparu',incertain:'incertain'};
const cls=p=>p.coh==='historical'?'historical':p.coh==='uncertain'?'uncertain':p.display?'current':'toConfirm';
export async function buildPoiDiagnostic(scene,project,base){
 const d=await fetch(`${base}data/poi.json`).then(r=>r.json());
 const group=new THREE.Group();group.name='poi-diagnostic';scene.add(group);
 const stats={pois:d.pois.length,current:0,toConfirm:0,uncertain:0,historical:0,lieux:0,landmarks:{1:0,2:0,3:0},areas:d.areas.length,A:0,B:0,C:0};
 // Instanced markers: one mesh per marker kind, colour and scale per instance.
 const pins=d.pois.filter(p=>!['lieu_dit','secteur'].includes(p.category)),discs=d.pois.filter(p=>['lieu_dit','secteur'].includes(p.category));
 const place=(geo,list,scaleOf)=>{const mesh=new THREE.InstancedMesh(geo,new THREE.MeshBasicMaterial({vertexColors:false}),list.length),m=new THREE.Matrix4(),c=new THREE.Color();
  list.forEach((p,i)=>{const [x,z]=project(p.lonlat),[sx,sy]=scaleOf(p);m.makeScale(sx,sy,sx).setPosition(x,sy/2+.5,z);mesh.setMatrixAt(i,m);mesh.setColorAt(i,c.set(POI_COLORS[cls(p)]));});
  mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;group.add(mesh);return mesh;};
 if(pins.length)place(new THREE.CylinderGeometry(1,1,1,12),pins,p=>[3.2,HEIGHT[p.conf]]);
 if(discs.length)place(new THREE.CylinderGeometry(1,1,1,24),discs,p=>[p.category==='secteur'?16:9,1.2]);
 for(const p of d.pois){stats[cls(p)]++;stats[p.conf]++;if(['lieu_dit','secteur'].includes(p.category))stats.lieux++;if(p.landmark)stats.landmarks[p.landmark]++;}
 // Landmark rings and area outlines in one batch.
 const batch=new Batch(material());
 for(const p of d.pois.filter(p=>p.landmark)){const [x,z]=project(p.lonlat),r=[0,26,19,13][p.landmark],ring=[];for(let i=0;i<=48;i++)ring.push([x+Math.cos(i*Math.PI/24)*r,z+Math.sin(i*Math.PI/24)*r]);strip(batch,ring,3.2,1.4,POI_COLORS.landmark);}
 for(const a of d.areas)for(const poly of a.rings)for(const ring of poly)strip(batch,ring.map(project),a.geometryKind==='officielle'?3:2,1.1,a.geometryKind==='officielle'?POI_COLORS.official:POI_COLORS.approximate);
 const mesh=batch.mesh(group,false);if(mesh)mesh.name='poi-diagnostic-lines';
 // Click records: every place with its type, status, provenance and confidence; buildings of a place select the place.
 function extend(catalogue,buildingInfo){let buildingsLinked=0;
  for(const p of d.pois){const [x,z]=project(p.lonlat),kind=`${p.type.replace(/_/g,' ')} · ${STATUS_LABELS[p.status]}${p.display?'':' (non affiché sur la carte actuelle)'} · confiance ${p.conf}${p.landmark?' · landmark P'+p.landmark:''}`;
   const r={id:p.id,name:p.name,kind,type:'point',position:[x,['lieu_dit','secteur'].includes(p.category)?2:HEIGHT[p.conf]+1,z],major:false,source:`Sources : ${p.source}. Position : ${p.positionSource} (${p.geometryKind})${p.address?'. Adresse : '+p.address:''}`,bible:p.refs.length?{notes:p.refs}:undefined};
   catalogue.records.push(r);catalogue.byId.set(r.id,r);
   const polys=p.building_ids.map(id=>buildingInfo.get(id)?.poly).filter(Boolean);
   if(polys.length){const b={...r,id:p.building_ids[0],type:'building',memberIds:p.building_ids.filter(id=>buildingInfo.has(id)),polys};for(const id of b.memberIds){catalogue.byId.set(id,b);buildingsLinked++;}}}
  for(const a of d.areas){const polys=a.rings.map(poly=>poly.map(r=>r.map(project))),r={id:a.id,name:a.name,kind:`zone · ${a.type.replace(/_/g,' ')} · limite ${a.geometryKind}`,type:'zone',polys,position:[0,0,0],source:'Limite : '+a.geometryKind};catalogue.records.push(r);catalogue.byId.set(r.id,r);}
  return buildingsLinked;}
 return {group,stats,extend};
}
