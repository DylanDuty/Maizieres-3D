import * as THREE from 'three';
import {Batch,material,shapeRings} from './geometry.js';
import {bounds,area,insidePoly} from './geo.js';
import {buildingProfile} from './building-profile.js';
import {saintDenis} from './church.js';
import {isChurch} from './building-source.js';
function split(points,axis,mid,side){const out=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],da=a[0]*axis[0]+a[1]*axis[1]-mid,db=b[0]*axis[0]+b[1]*axis[1]-mid;if(da*side>=-.00001)out.push(a);if(da*db<0){const t=da/(da-db);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}return out;}
// Diagnostic colours by provenance (?diagnostic=provenance): development aid, not an art choice.
export const PROVENANCE_COLORS={'ign+osm':'#b9bfc6','ign+osm-partiel':'#e9a23b','ign':'#e0301e','osm':'#2f6fe0'};
export function buildBuildings(scene,items,enrichment={buildings:{}},options={}){
 const walls=new Batch(material()),roofs=new Batch(material()),windows=new Batch(material({roughness:.65})),details=new Batch(material());
 const batches=[walls,roofs,windows,details],ranges=batches.map(()=>[]),pickMeshes=[];
 let count=0;const rejected=[],info=new Map(),landmarks=[],stats={ignWallHeights:0,ignRoofHeights:0,knownFloors:0,knownRoofMaterials:0,roofHeightClamps:0,categories:{}};
 for(const item of items){const {poly,t,id}=item;if(area(poly[0])>100000){rejected.push({id,reason:'surface > 100 000 m²'});continue;}const extra=item.extra||enrichment.buildings[id]||{},p=buildingProfile(t,poly,extra,id);if(!p){rejected.push({id,reason:'profil impossible'});continue;}
  if(options.diagnostic){p.wallColor=PROVENANCE_COLORS[item.provenance]||'#999';p.roofColor=new THREE.Color(p.wallColor).multiplyScalar(.8).getStyle();p.shade=0;}
  const starts=batches.map(b=>b.p.length/9);
  const bb=bounds(poly[0]),base=.35,axis=p.axis,mid=(axis.min+axis.max)/2,half=Math.max(.1,(axis.max-axis.min)/2);
  const top=q=>base+p.wallHeight+p.roofHeight*Math.max(0,1-Math.abs(q[0]*axis.axis[0]+q[1]*axis.axis[1]-mid)/half);
  const roofColor=new THREE.Color(p.roofColor).offsetHSL(0,0,p.shade*.5),wallColor=new THREE.Color(p.wallColor).offsetHSL(0,0,p.shade*.4);
  const shutter=p.shutterColor,doorColor=new THREE.Color(p.shutterColor).multiplyScalar(.72),chimney=new THREE.Color(p.wallColor).multiplyScalar(.86);let door=false;
  let maxHeight=p.wallHeight+p.roofHeight;
  if(isChurch(item)){maxHeight=saintDenis(poly,p,walls,roofs,details).maxHeight;}
  else {
   for(const r of poly)for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],da=a[0]*axis.axis[0]+a[1]*axis.axis[1]-mid,db=b[0]*axis.axis[0]+b[1]*axis.axis[1]-mid,edge=[a];if(da*db<0){const f=da/(da-db);edge.push([a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])]);}edge.push(b);for(let j=1;j<edge.length;j++){const c=edge[j-1],d=edge[j];if(p.kind!=='canopy')walls.quad([c[0],base,c[1]],[d[0],base,d[1]],[d[0],top(d),d[1]],[c[0],top(c),c[1]],wallColor);if(p.kind!=='canopy')details.quad([c[0],top(c)-.16,c[1]],[d[0],top(d)-.16,d[1]],[d[0],top(d)+.015,d[1]],[c[0],top(c)+.015,c[1]],new THREE.Color(p.roofColor).multiplyScalar(.68));}
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<3||['annex','garage','silo','greenhouse','canopy','light','hangar'].includes(p.kind))continue;
    const ux=dx/len,uz=dz/len,spacing=p.bulk?8:3.6,side=insidePoly([(a[0]+b[0])/2-uz*.2,(a[1]+b[1])/2+ux*.2],poly)?-1:1,nx=-uz*.05*side,nz=ux*.05*side;
    // Facade quad helper: offset slightly outside the wall, u along the edge, y vertical.
    const face=(u0,u1,y0,y1,color,depth=1)=>windows.quad([a[0]+ux*u0+nx*depth,y0,a[1]+uz*u0+nz*depth],[a[0]+ux*u1+nx*depth,y0,a[1]+uz*u1+nz*depth],[a[0]+ux*u1+nx*depth,y1,a[1]+uz*u1+nz*depth],[a[0]+ux*u0+nx*depth,y1,a[1]+uz*u0+nz*depth],color);
    const house=['house','public','farm'].includes(p.kind);
    for(let floor=0;floor<(p.bulk?1:p.windowFloors);floor++)for(let d=2;d<len-1;d+=spacing){const w=p.bulk?.7:.43,y=base+(p.bulk?Math.min(3,p.wallHeight-1.2):1+floor*2.6),h=p.bulk?1:1.15;if(y+h>base+p.wallHeight-.1)continue;
     // Painted shutters (artistic, not surveyed): one coloured backing quad, the pane drawn just in front.
     if(house&&len>=5)face(d-w-.46,d+w+.46,y-.02,y+h+.02,shutter,.6);
     face(d-w,d+w,y,y+h,p.bulk?'#8fa3ad':'#5b6f7d');
    }
    if(house&&!door&&len>=6&&p.wallHeight>=2.6){const d=Math.min(len-1.6,2+spacing*Math.max(0,Math.floor((len-4)/spacing/2))+spacing/2);face(d-.5,d+.5,base,base+2.1,doorColor,1.3);door=true;}
   }
   // One chimney on ordinary pitched houses, near the ridge and inside the footprint.
   if(p.kind==='house'&&p.roofShape==='gabled'&&p.size>55){const c=[(bb.minX+bb.maxX)/2,(bb.minZ+bb.maxZ)/2],k=mid-(c[0]*axis.axis[0]+c[1]*axis.axis[1]),ridge=[-axis.axis[1],axis.axis[0]],off=((p.seed>>>9)%2?1:-1)*Math.min(3,Math.sqrt(p.size)*.22),q=[c[0]+axis.axis[0]*k+ridge[0]*off,c[1]+axis.axis[1]*k+ridge[1]*off],r=.42;
    const foot=[[-r,-r],[r,-r],[r,r],[-r,r]].map(([i,j])=>[q[0]+axis.axis[0]*i+ridge[0]*j,q[1]+axis.axis[1]*i+ridge[1]*j]);
    if(foot.every(v=>insidePoly(v,poly))){const y0=top(q)-.8,y1=top(q)+1.05;for(let j=0;j<4;j++){const u=foot[j],v=foot[(j+1)%4];details.quad([u[0],y0,u[1]],[v[0],y0,v[1]],[v[0],y1,v[1]],[u[0],y1,u[1]],chimney);}details.quad(...[0,1,2,3].map(j=>[foot[j][0],y1,foot[j][1]]).reverse(),'#5f5a55');}}
   if(p.kind==='canopy'){const center=[(bb.minX+bb.maxX)/2,(bb.minZ+bb.maxZ)/2];for(const q of poly[0].filter((_,i)=>i%2===0)){const x=q[0]*.94+center[0]*.06,z=q[1]*.94+center[1]*.06,r=.17,foot=[[x-r,z-r],[x+r,z-r],[x+r,z+r],[x-r,z+r]];if(foot.every(v=>insidePoly(v,poly)))for(let j=0;j<4;j++){const a=foot[j],b=foot[(j+1)%4];details.quad([a[0],base,a[1]],[b[0],base,b[1]],[b[0],base+p.wallHeight,b[1]],[a[0],base+p.wallHeight,a[1]],wallColor);}}}
   const rings=shapeRings(poly),flat=rings.flat();for(const tri of THREE.ShapeUtils.triangulateShape(rings[0],rings.slice(1))){const points=tri.map(i=>[flat[i].x,flat[i].y]);for(const side of [-1,1]){const polygon=split(points,axis.axis,mid,side);for(let i=1;i<polygon.length-1;i++)roofs.tri(...[polygon[0],polygon[i],polygon[i+1]].map(q=>[q[0],top(q),q[1]]),roofColor);}}
  }
  batches.forEach((b,i)=>{const end=b.p.length/9;if(end>starts[i])ranges[i].push({start:starts[i],end,id});});
  info.set(id,{source:item.source||'OpenStreetMap',provenance:item.provenance||null,rnb:item.rnb||null,osmIds:t['@osm']||[id],kind:p.kind,knownUsage:p.knownUsage,usage:extra.usage&&extra.usage!=='Indifférencié'?extra.usage:null,floors:extra.floors||Number.parseInt(t['building:levels'])||null,wallHeight:p.wallHeight,heightSource:p.heightSource,maxHeight,light:t.wall==='no'||extra.lightConstruction===true,ign:!!extra.ignId,poly});
  if(p.kind==='church'||p.kind==='public'){const name=extra.landmark?.name||t.name||(t.amenity==='townhall'?'Mairie':t.amenity==='school'?'École primaire':null);if(name)landmarks.push({name,position:[(bb.minX+bb.maxX)/2,maxHeight+4,(bb.minZ+bb.maxZ)/2],id});}
  if(p.heightSource==='IGN BD TOPO')stats.ignWallHeights++;if(p.roofHeightSource==='IGN statistical roof maximum')stats.ignRoofHeights++;if(p.roofHeightClamped)stats.roofHeightClamps++;if(extra.floors)stats.knownFloors++;if(p.materialSource==='IGN cadastral declaration')stats.knownRoofMaterials++;stats.categories[p.kind]=(stats.categories[p.kind]||0)+1;count++;
 }
 for(let i=0;i<walls.p.length;i+=3)if(walls.p[i+1]<.5){walls.c[i]*=.82;walls.c[i+1]*=.82;walls.c[i+2]*=.82;}
 for(const [i,batch] of batches.entries()){const mesh=batch.mesh(scene,i!==2);if(mesh){mesh.receiveShadow=false;mesh.userData.featureRanges=ranges[i];pickMeshes.push(mesh);}}return {count,landmarks,stats:{...stats,rejected:rejected.length},rejected,pickMeshes,info};
}
