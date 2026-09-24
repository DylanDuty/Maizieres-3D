import * as THREE from 'three';
import {Batch,material,shapeRings} from './geometry.js';
import {bounds,area,insidePoly} from './geo.js';
import {buildingProfile} from './building-profile.js';
import {saintDenis} from './church.js';
function split(points,axis,mid,side){const out=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],da=a[0]*axis[0]+a[1]*axis[1]-mid,db=b[0]*axis[0]+b[1]*axis[1]-mid;if(da*side>=-.00001)out.push(a);if(da*db<0){const t=da/(da-db);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}return out;}
export function buildBuildings(scene,items,enrichment={buildings:{}}){
 const walls=new Batch(material()),roofs=new Batch(material()),windows=new Batch(material({roughness:.65})),details=new Batch(material());
 const batches=[walls,roofs,windows,details],ranges=batches.map(()=>[]),pickMeshes=[];
 let count=0;const landmarks=[],stats={ignWallHeights:0,ignRoofHeights:0,knownFloors:0,knownRoofMaterials:0,roofHeightClamps:0,categories:{}};
 for(const {poly,t,id} of items){if(area(poly[0])<3||area(poly[0])>100000)continue;const extra=enrichment.buildings[id]||{},p=buildingProfile(t,poly,extra,id);if(!p)continue;
  const starts=batches.map(b=>b.p.length/9);
  const bb=bounds(poly[0]),base=.35,axis=p.axis,mid=(axis.min+axis.max)/2,half=Math.max(.1,(axis.max-axis.min)/2);
  const top=q=>base+p.wallHeight+p.roofHeight*Math.max(0,1-Math.abs(q[0]*axis.axis[0]+q[1]*axis.axis[1]-mid)/half);
  const roofColor=new THREE.Color(p.roofColor).offsetHSL(0,0,p.shade*.5),wallColor=new THREE.Color(p.wallColor).offsetHSL(0,0,p.shade*.4);
  let maxHeight=p.wallHeight+p.roofHeight;
  if(id==='way/588791993'){maxHeight=saintDenis(poly,p,walls,roofs,details).maxHeight;}
  else {
   for(const r of poly)for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],da=a[0]*axis.axis[0]+a[1]*axis.axis[1]-mid,db=b[0]*axis.axis[0]+b[1]*axis.axis[1]-mid,edge=[a];if(da*db<0){const f=da/(da-db);edge.push([a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])]);}edge.push(b);for(let j=1;j<edge.length;j++){const c=edge[j-1],d=edge[j];if(p.kind!=='canopy')walls.quad([c[0],base,c[1]],[d[0],base,d[1]],[d[0],top(d),d[1]],[c[0],top(c),c[1]],wallColor);if(p.kind!=='canopy')details.quad([c[0],top(c)-.16,c[1]],[d[0],top(d)-.16,d[1]],[d[0],top(d)+.015,d[1]],[c[0],top(c)+.015,c[1]],new THREE.Color(p.roofColor).multiplyScalar(.68));}
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<3||['annex','garage','silo','greenhouse','canopy'].includes(p.kind))continue;
    const nx=-dz/len*.04,nz=dx/len*.04,spacing=p.bulk?8:3.6;
    for(let floor=0;floor<(p.bulk?1:p.windowFloors);floor++)for(let d=2;d<len-1;d+=spacing){const x=a[0]+dx*d/len,z=a[1]+dz*d/len,wx=dx/len*(p.bulk?.7:.43),wz=dz/len*(p.bulk?.7:.43),y=base+(p.bulk?Math.min(3,p.wallHeight-1.2):1+floor*2.6);if(y+1>base+p.wallHeight)continue;for(const side of [insidePoly([x+nx,z+nz],poly)?-1:1])windows.quad([x-wx+nx*side,y,z-wz+nz*side],[x+wx+nx*side,y,z+wz+nz*side],[x+wx+nx*side,y+1,z+wz+nz*side],[x-wx+nx*side,y+1,z-wz+nz*side],'#66736f');}
   }
   if(p.kind==='canopy'){const center=[(bb.minX+bb.maxX)/2,(bb.minZ+bb.maxZ)/2];for(const q of poly[0].filter((_,i)=>i%2===0)){const x=q[0]*.94+center[0]*.06,z=q[1]*.94+center[1]*.06,r=.17,foot=[[x-r,z-r],[x+r,z-r],[x+r,z+r],[x-r,z+r]];if(foot.every(v=>insidePoly(v,poly)))for(let j=0;j<4;j++){const a=foot[j],b=foot[(j+1)%4];details.quad([a[0],base,a[1]],[b[0],base,b[1]],[b[0],base+p.wallHeight,b[1]],[a[0],base+p.wallHeight,a[1]],wallColor);}}}
   const rings=shapeRings(poly),flat=rings.flat();for(const tri of THREE.ShapeUtils.triangulateShape(rings[0],rings.slice(1))){const points=tri.map(i=>[flat[i].x,flat[i].y]);for(const side of [-1,1]){const polygon=split(points,axis.axis,mid,side);for(let i=1;i<polygon.length-1;i++)roofs.tri(...[polygon[0],polygon[i],polygon[i+1]].map(q=>[q[0],top(q),q[1]]),roofColor);}}
  }
  batches.forEach((b,i)=>{const end=b.p.length/9;if(end>starts[i])ranges[i].push({start:starts[i],end,id});});
  if(p.kind==='church'||p.kind==='public'){const name=extra.landmark?.name||t.name||(t.amenity==='townhall'?'Mairie':t.amenity==='school'?'École primaire':null);if(name)landmarks.push({name,position:[(bb.minX+bb.maxX)/2,maxHeight+4,(bb.minZ+bb.maxZ)/2],id});}
  if(p.heightSource==='IGN BD TOPO')stats.ignWallHeights++;if(p.roofHeightSource==='IGN statistical roof maximum')stats.ignRoofHeights++;if(p.roofHeightClamped)stats.roofHeightClamps++;if(extra.floors)stats.knownFloors++;if(p.materialSource==='IGN cadastral declaration')stats.knownRoofMaterials++;stats.categories[p.kind]=(stats.categories[p.kind]||0)+1;count++;
 }
 for(let i=0;i<walls.p.length;i+=3)if(walls.p[i+1]<.5){walls.c[i]*=.82;walls.c[i+1]*=.82;walls.c[i+2]*=.82;}
 for(const [i,batch] of batches.entries()){const mesh=batch.mesh(scene,i!==2);if(mesh){mesh.receiveShadow=false;mesh.userData.featureRanges=ranges[i];pickMeshes.push(mesh);}}return {count,landmarks,stats,pickMeshes};
}
