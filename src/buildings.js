import * as THREE from 'three';
import {Batch,material,shapeRings} from './geometry.js';
import {bounds,area,insidePoly} from './geo.js';
import {buildingProfile} from './building-profile.js';
import {saintDenis} from './church.js';
import {isChurch} from './building-source.js';
import {applyArchitecture,roofSurface,splitByLines,edgeCuts,ARCH_COLORS} from './architecture.js';
function split(points,axis,mid,side){const out=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],da=a[0]*axis[0]+a[1]*axis[1]-mid,db=b[0]*axis[0]+b[1]*axis[1]-mid;if(da*side>=-.00001)out.push(a);if(da*db<0){const t=da/(da-db);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}return out;}
// Diagnostic colours by provenance (?diagnostic=provenance): development aid, not an art choice.
export const PROVENANCE_COLORS={'ign+osm':'#b9bfc6','ign+osm-partiel':'#e9a23b','ign':'#e0301e','osm':'#2f6fe0','cadastre':'#1f9e5a'};
// ?diagnostic=validation: V1.6 confidence levels and unresolved contours.
export const VALIDATION_COLORS={A:'#b9bfc6',B:'#e9a23b','B-contour':'#9b4fd1',C:'#2f6fe0',cadastre:'#1f9e5a'};
// V2.0.1 ?diagnostic=buildings-audit: reference building, reintegrated footprint, display base corrected; markers for the rest.
export const AUDIT_COLORS={normal:'#c9c4b8',reintegre:'#2f9e5a','manuel-v2.2':'#e8132b','rendu-corrige':'#2f6fe0',incertain:'#e9a23b','sans-empreinte':'#c0359b'};
export const diagnosticKey=(item,mode)=>mode==='buildings-audit'?item.auditStatus||'normal':mode==='validation'?(item.provenance==='cadastre'?'cadastre':item.validation?.confidence==='B'&&/contour divergent|contour différent|extension cadastrale/.test(item.validation.status)?'B-contour':item.validation?.confidence||'C'):item.provenance;
const RES=k=>/^RES_|^HERITAGE|^PUBLIC/.test(k||'');
export function buildBuildings(scene,items,enrichment={buildings:{}},options={}){
 const walls=new Batch(material()),roofs=new Batch(material()),windows=new Batch(material({roughness:.65})),details=new Batch(material());
 const batches=[walls,roofs,windows,details],ranges=batches.map(()=>[]),pickMeshes=[];
 let count=0;const lifts=[],rejected=[],info=new Map(),landmarks=[],stats={ignWallHeights:0,ignRoofHeights:0,knownFloors:0,knownRoofMaterials:0,roofHeightClamps:0,categories:{}};
 for(const item of items){const {poly,t,id}=item;if(area(poly[0])>100000){rejected.push({id,reason:'surface > 100 000 m²'});continue;}const extra=item.extra||enrichment.buildings[id]||{};let p=buildingProfile(t,poly,extra,id);if(!p){rejected.push({id,reason:'profil impossible'});continue;}
  // V2.3 / V2.4: documented elevation (roof type, ridge, heights, colour family) on the unchanged footprint.
  const arch=options.architecture?.get(item.featureId||id.split('#')[0])||null;if(arch)p=applyArchitecture(p,arch,poly);
  if(options.diagnostic){p.wallColor=options.diagnostic==='architecture'?ARCH_COLORS[arch?.confidenceOverall||'unknown']:(options.diagnostic==='buildings-audit'?AUDIT_COLORS:options.diagnostic==='validation'?VALIDATION_COLORS:PROVENANCE_COLORS)[diagnosticKey(item,options.diagnostic)]||'#999';p.roofColor=new THREE.Color(p.wallColor).multiplyScalar(.8).getStyle();p.shade=0;}
  // V2.5: options.render(item) === false keeps the profile and the click record but draws nothing (another renderer takes over).
  const drawn=options.render?options.render(item)!==false:true;
  const starts=batches.map(b=>b.p.length/9);
  const bb=bounds(poly[0]),base=.35,axis=p.axis,mid=(axis.min+axis.max)/2,half=Math.max(.1,(axis.max-axis.min)/2);
  const top=q=>base+p.wallHeight+p.roofHeight*Math.max(0,1-Math.abs(q[0]*axis.axis[0]+q[1]*axis.axis[1]-mid)/half);
  const roofColor=new THREE.Color(p.roofColor).offsetHSL(0,0,p.shade*.5),wallColor=new THREE.Color(p.wallColor).offsetHSL(0,0,p.shade*.4);
  // V2.4: facades darken towards the ground (painted contact shadow), the eave band outlines the roof edge.
  const wallBase=wallColor.clone().multiplyScalar(options.diagnostic?1:.8),edgeColor=roofColor.clone().multiplyScalar(.66),ridgeColor=roofColor.clone().multiplyScalar(.78);
  const shutter=p.shutterColor,doorColor=new THREE.Color(p.shutterColor).multiplyScalar(.72),chimney=new THREE.Color(p.wallColor).multiplyScalar(.86);let door=false;
  let maxHeight=p.wallHeight+p.roofHeight;
  const house=['house','public','farm'].includes(p.kind)||RES(arch?.buildingClass);
  // Facade openings: windows (and painted shutters / a door on houses), never surveyed, only a scale cue.
  const facade=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<3||['annex','garage','silo','greenhouse','canopy','light','hangar'].includes(p.kind)||/^(GARAGE|ANNEX|SHED|GREENHOUSE|SILO_TANK|WATER_TOWER)$/.test(arch?.buildingClass||''))return;
   const ux=dx/len,uz=dz/len,spacing=p.bulk?8:3.6,side=insidePoly([(a[0]+b[0])/2-uz*.2,(a[1]+b[1])/2+ux*.2],poly)?-1:1,nx=-uz*.05*side,nz=ux*.05*side;
   const face=(u0,u1,y0,y1,color,depth=1)=>windows.quad([a[0]+ux*u0+nx*depth,y0,a[1]+uz*u0+nz*depth],[a[0]+ux*u1+nx*depth,y0,a[1]+uz*u1+nz*depth],[a[0]+ux*u1+nx*depth,y1,a[1]+uz*u1+nz*depth],[a[0]+ux*u0+nx*depth,y1,a[1]+uz*u0+nz*depth],color);
   for(let floor=0;floor<(p.bulk?1:p.windowFloors);floor++)for(let d=2;d<len-1;d+=spacing){const w=p.bulk?.7:.43,y=base+(p.bulk?Math.min(3,p.wallHeight-1.2):1+floor*2.6),h=p.bulk?1:1.15;if(y+h>base+p.wallHeight-.1)continue;if(house&&len>=5)face(d-w-.46,d+w+.46,y-.02,y+h+.02,shutter,.6);face(d-w,d+w,y,y+h,p.bulk?'#8fa3ad':'#5b6f7d');}
   if(house&&!door&&len>=6&&p.wallHeight>=2.6){const d=Math.min(len-1.6,2+spacing*Math.max(0,Math.floor((len-4)/spacing/2))+spacing/2);face(d-.5,d+.5,base,base+2.1,doorColor,1.3);door=true;}};
  // One chimney on ordinary pitched houses, near the ridge and inside the footprint (rise given by `roofTop`).
  const addChimney=(roofTop,across,along)=>{const c=[(bb.minX+bb.maxX)/2,(bb.minZ+bb.maxZ)/2],k=mid-(c[0]*across[0]+c[1]*across[1]),off=((p.seed>>>9)%2?1:-1)*Math.min(3,Math.sqrt(p.size)*.22),q=[c[0]+across[0]*k+along[0]*off,c[1]+across[1]*k+along[1]*off],r=.42;
   const foot=[[-r,-r],[r,-r],[r,r],[-r,r]].map(([i,j])=>[q[0]+across[0]*i+along[0]*j,q[1]+across[1]*i+along[1]*j]);
   if(foot.every(v=>insidePoly(v,poly))){const y0=roofTop(q)-.8,y1=roofTop(q)+1.05;for(let j=0;j<4;j++){const u=foot[j],v=foot[(j+1)%4];details.quad([u[0],y0,u[1]],[v[0],y0,v[1]],[v[0],y1,v[1]],[u[0],y1,u[1]],chimney);}details.quad(...[0,1,2,3].map(j=>[foot[j][0],y1,foot[j][1]]).reverse(),'#5f5a55');}};
  if(!drawn){maxHeight=p.wallHeight+p.roofHeight;}
  else if(isChurch(item)){maxHeight=saintDenis(poly,p,walls,roofs,details).maxHeight;}
  else if(arch){
   // Generic min-of-planes roof: walls follow the roof edge, every surface is split along the creases.
   const model=roofSurface(p),topA=q=>base+p.wallHeight+model.h(q);maxHeight=p.wallHeight+p.roofHeight;
   for(const r of poly)for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],pts=[a,...edgeCuts(a,b,model.lines).map(f=>[a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])]),b];
    for(let j=1;j<pts.length;j++){const c=pts[j-1],d=pts[j];if(p.kind!=='canopy'){walls.quad([c[0],base,c[1]],[d[0],base,d[1]],[d[0],topA(d),d[1]],[c[0],topA(c),c[1]],[wallBase,wallBase,wallColor,wallColor]);details.quad([c[0],topA(c)-.16,c[1]],[d[0],topA(d)-.16,d[1]],[d[0],topA(d)+.015,d[1]],[c[0],topA(c)+.015,c[1]],edgeColor);}}
    facade(a,b);
   }
   // Ridge line (V2.4): a thin darker strip along the measured ridge where the roof actually reaches its top.
   if(model.ridge&&p.roofHeight>.4&&!options.diagnostic){const {at,s0,s1}=model.ridge,{along}=p.arch,n=Math.max(2,Math.ceil((s1-s0)/1)),runs=[];let run=[];
    for(let k=0;k<=n;k++){const q=at(s0+(s1-s0)*k/n);if(insidePoly(q,poly)&&model.h(q)>=p.roofHeight-.08)run.push(q);else{if(run.length>1)runs.push(run);run=[];}}if(run.length>1)runs.push(run);
    for(const r of runs){const w=.16;for(let k=1;k<r.length;k++){const a=r[k-1],b=r[k],o=[along[0]*w,along[1]*w];details.quad([a[0]-o[1],topA(a)+.07,a[1]+o[0]],[b[0]-o[1],topA(b)+.07,b[1]+o[0]],[b[0]+o[1],topA(b)+.07,b[1]-o[0]],[a[0]+o[1],topA(a)+.07,a[1]-o[0]],ridgeColor);}}
    if(RES(arch.buildingClass)&&['gable','hip'].includes(p.arch.type)&&p.size>55)addChimney(topA,p.arch.across,p.arch.along);}
   const rings=shapeRings(poly),flat=rings.flat();for(const tri of THREE.ShapeUtils.triangulateShape(rings[0],rings.slice(1))){const points=tri.map(i=>[flat[i].x,flat[i].y]);for(const piece of splitByLines(points,model.lines))for(let i=1;i<piece.length-1;i++)roofs.tri(...[piece[0],piece[i],piece[i+1]].map(q=>[q[0],topA(q),q[1]]),roofColor);}
  }
  else {
   for(const r of poly)for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],da=a[0]*axis.axis[0]+a[1]*axis.axis[1]-mid,db=b[0]*axis.axis[0]+b[1]*axis.axis[1]-mid,edge=[a];if(da*db<0){const f=da/(da-db);edge.push([a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])]);}edge.push(b);for(let j=1;j<edge.length;j++){const c=edge[j-1],d=edge[j];if(p.kind!=='canopy'){walls.quad([c[0],base,c[1]],[d[0],base,d[1]],[d[0],top(d),d[1]],[c[0],top(c),c[1]],[wallBase,wallBase,wallColor,wallColor]);details.quad([c[0],top(c)-.16,c[1]],[d[0],top(d)-.16,d[1]],[d[0],top(d)+.015,d[1]],[c[0],top(c)+.015,c[1]],edgeColor);}}
    facade(a,b);
   }
   if(p.kind==='house'&&p.roofShape==='gabled'&&p.size>55)addChimney(top,axis.axis,[-axis.axis[1],axis.axis[0]]);
   if(p.kind==='canopy'){const center=[(bb.minX+bb.maxX)/2,(bb.minZ+bb.maxZ)/2];for(const q of poly[0].filter((_,i)=>i%2===0)){const x=q[0]*.94+center[0]*.06,z=q[1]*.94+center[1]*.06,r=.17,foot=[[x-r,z-r],[x+r,z-r],[x+r,z+r],[x-r,z+r]];if(foot.every(v=>insidePoly(v,poly)))for(let j=0;j<4;j++){const a=foot[j],b=foot[(j+1)%4];details.quad([a[0],base,a[1]],[b[0],base,b[1]],[b[0],base+p.wallHeight,b[1]],[a[0],base+p.wallHeight,a[1]],wallColor);}}}
   const rings=shapeRings(poly),flat=rings.flat();for(const tri of THREE.ShapeUtils.triangulateShape(rings[0],rings.slice(1))){const points=tri.map(i=>[flat[i].x,flat[i].y]);for(const side of [-1,1]){const polygon=split(points,axis.axis,mid,side);for(let i=1;i<polygon.length-1;i++)roofs.tri(...[polygon[0],polygon[i],polygon[i+1]].map(q=>[q[0],top(q),q[1]]),roofColor);}}
  }
  batches.forEach((b,i)=>{const end=b.p.length/9;if(end>starts[i])ranges[i].push({start:starts[i],end,id});});
  // V1.7 ?diagnostic=terrain: the whole building is lifted to its terrain base altitude (footprint unchanged).
  const dy=options.elevation?.(item)||0;if(dy)lifts.push({starts,ends:batches.map(b=>b.p.length/9),dy});
  info.set(id,{architecture:arch,manual:item.provenance==='orthophoto_manual_v2.2'?item.manualInfo||{}:null,validation:item.validation||null,source:item.source||'OpenStreetMap',provenance:item.provenance||null,rnb:item.rnb||null,osmIds:t['@osm']||[id],kind:p.kind,knownUsage:p.knownUsage,usage:extra.usage&&extra.usage!=='Indifférencié'?extra.usage:null,floors:extra.floors||Number.parseInt(t['building:levels'])||null,wallHeight:p.wallHeight,heightSource:p.heightSource,maxHeight,light:t.wall==='no'||extra.lightConstruction===true,ign:!!extra.ignId,poly});
  if(p.kind==='church'||p.kind==='public'){const name=extra.landmark?.name||t.name||(t.amenity==='townhall'?'Mairie':t.amenity==='school'?'École primaire':null);if(name)landmarks.push({name,position:[(bb.minX+bb.maxX)/2,maxHeight+4+dy,(bb.minZ+bb.maxZ)/2],id});}
  if(p.heightSource==='IGN BD TOPO')stats.ignWallHeights++;if(p.roofHeightSource==='IGN statistical roof maximum')stats.ignRoofHeights++;if(p.roofHeightClamped)stats.roofHeightClamps++;if(extra.floors)stats.knownFloors++;if(p.materialSource==='IGN cadastral declaration')stats.knownRoofMaterials++;stats.categories[p.kind]=(stats.categories[p.kind]||0)+1;count++;
 }
 for(const {starts,ends,dy} of lifts)batches.forEach((b,i)=>{for(let k=starts[i]*9+1;k<ends[i]*9;k+=3)b.p[k]+=dy;});
 for(const [i,batch] of batches.entries()){const mesh=batch.mesh(scene,i!==2);if(mesh){mesh.receiveShadow=i<2;mesh.name=['buildings-walls','buildings-roofs','buildings-windows','buildings-details'][i];mesh.userData.featureRanges=ranges[i];pickMeshes.push(mesh);}}return {count,landmarks,stats:{...stats,rejected:rejected.length},rejected,pickMeshes,info};
}
