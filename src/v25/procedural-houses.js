import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {bounds,area,insidePoly} from '../geo.js';
import {shapeRings} from '../geometry.js';
import {buildingProfile} from '../building-profile.js';
import {applyArchitecture,roofSurface,splitByLines,edgeCuts} from '../architecture.js';

// V2.5 Poussey prototype — procedural stylised houses on the frozen footprints.
// From the V2.3.1 profile (class, heights, roof type, ridge, colour family) and a deterministic seed (FNV-1a of the
// buildingId) each building gets: textured walls with a plinth, a roof slab with overhang and fascia, a ridge cap,
// instanced windows / shutters / doors / garage doors, an occasional chimney. Everything below is an artistic detail,
// never a documented fact; footprint, orientation, documented heights, roof type and colour family are respected.
const fnv=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const mulberry=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
const RES=c=>/^RES_|^HERITAGE|^PUBLIC/.test(c||'');
// Facade families (artistic palettes): render tints, wood tints, steel tints, shutter colours, door colours.
export const FACADES={render:['#efe6d3','#f4efe4','#e7dcc7','#ece2cb','#ead9c3','#e5dfd4','#f1e9d9','#e3d7bf'],annex:['#e2dccb','#d9d3c3','#dedbd1','#e6dfcf'],wood:['#8f7153','#7f6549','#a1835f','#6f5a44'],steel:['#d7d9d5','#cdd2cf','#dbd5c8','#c9cccb'],
 shutter:['#6d8fa8','#7e9b7a','#b9c7c9','#9a5c4e','#c9b58f','#5f7f8f','#ece7da','#8fa38b','#5a6e86'],door:['#5b4a3c','#6f5240','#3f4f5a','#7a6a58','#4a5a4c']};
const dot=(q,v)=>q[0]*v[0]+q[1]*v[1];const UP=[0,1,0],DOWN=[0,-1,0];
// Outward horizontal normal of the edge a→b of a polygon (tested against the polygon interior).
const outward=(a,b,poly)=>{const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1;let nx=-dz/L,nz=dx/L;if(insidePoly([(a[0]+b[0])/2+nx*.25,(a[1]+b[1])/2+nz*.25],poly)){nx=-nx;nz=-nz;}return [nx,0,nz];};
const range=(poly,v)=>{let min=Infinity,max=-Infinity;for(const r of poly)for(const q of r){const d=dot(q,v);if(d<min)min=d;if(d>max)max=d;}return {min,max};};
const signedArea=r=>{let a=0;for(let i=0,j=r.length-1;i<r.length;j=i++)a+=r[j][0]*r[i][1]-r[i][0]*r[j][1];return a/2;};
// Offsets a ring outward (holes inward) by d metres, with mitred corners clamped to a bevel. Decorative overhang only.
function offsetRing(ring,d,hole=false){const n=ring.length,sgn=(signedArea(ring)>0?1:-1)*(hole?-1:1);
 const lines=[];for(let i=0;i<n;i++){const a=ring[i],b=ring[(i+1)%n],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1,nx=dz/L*sgn*d,nz=-dx/L*sgn*d;lines.push({a:[a[0]+nx,a[1]+nz],b:[b[0]+nx,b[1]+nz]});}
 const out=[];for(let i=0;i<n;i++){const p=lines[(i-1+n)%n],q=lines[i],d1=[p.b[0]-p.a[0],p.b[1]-p.a[1]],d2=[q.b[0]-q.a[0],q.b[1]-q.a[1]],den=d1[0]*d2[1]-d1[1]*d2[0];
  if(Math.abs(den)<1e-9){out.push(q.a);continue;}const t=((q.a[0]-p.a[0])*d2[1]-(q.a[1]-p.a[1])*d2[0])/den,m=[p.a[0]+d1[0]*t,p.a[1]+d1[1]*t];
  if(Math.hypot(m[0]-ring[i][0],m[1]-ring[i][1])>2.6*d){out.push(p.b,q.a);}else out.push(m);}
 return out;}
// Roof height above the eave level at q (unclamped: the slope continues over the overhang).
function roofFn(p){const {across,along,a,b,shape}=p.arch,rise=p.roofHeight,mid=(a.min+a.max)/2,half=Math.max(.1,(a.max-a.min)/2),midB=(b.min+b.max)/2,halfL=Math.max(.1,(b.max-b.min)/2);
 if(shape==='flat'||rise<=0)return ()=>0;
 if(shape==='shed')return q=>rise*((dot(q,across)-a.min)/Math.max(.1,a.max-a.min));
 if(shape==='hip')return q=>rise/half*Math.min(half-Math.abs(dot(q,across)-mid),halfL-Math.abs(dot(q,along)-midB));
 return q=>rise*(1-Math.abs(dot(q,across)-mid)/half);}

class Tri{constructor(){this.p=[];this.c=[];this.uv=[];this.n=0;}
 tri(a,b,c,col,uvs,facing){if(facing){const nx=(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),ny=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),nz=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(nx*facing[0]+ny*facing[1]+nz*facing[2]<0){[b,c]=[c,b];if(uvs)uvs=[uvs[0],uvs[2],uvs[1]];}}
  for(const [i,v] of [a,b,c].entries()){this.p.push(v[0],v[1],v[2]);this.c.push(col.r,col.g,col.b);const u=uvs?uvs[i]:[v[0],v[2]];this.uv.push(u[0],u[1]);}this.n++;}
 quad(a,b,c,d,col,uvs,facing){this.tri(a,b,c,col,uvs&&[uvs[0],uvs[1],uvs[2]],facing);this.tri(a,c,d,col,uvs&&[uvs[0],uvs[2],uvs[3]],facing);}
 geometry(){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(this.uv,2));g.computeVertexNormals();return g;}}
// Several triangle lists → one mesh with material groups; feature ranges in global face indices for picking.
function groupedMesh(parts,materials,ranges,name){const live=parts.map((t,i)=>[t,i]).filter(([t])=>t.n);if(!live.length)return null;
 const geos=live.map(([t])=>t.geometry()),g=mergeGeometries(geos,true);let off=0;const map=new Map();for(const [k,[t,i]] of live.entries()){g.groups[k].materialIndex=i;map.set(i,off);off+=t.n;}
 const out=[];for(const r of ranges){const o=map.get(r.part);if(o!=null)out.push({start:r.start+o,end:r.end+o,id:r.id});}out.sort((x,y)=>x.start-y.start);
 const m=new THREE.Mesh(g,materials);m.name=name;m.castShadow=true;m.receiveShadow=true;m.userData.featureRanges=out;return m;}

export function buildHouses({items,enrichment={buildings:{}},architecture,elevation=()=>0,materials:M,T}){
 const walls=[new Tri(),new Tri(),new Tri(),new Tri()],wallMats=[M.render,M.wood,M.metal,M.concrete];
 const roofs=[new Tri(),new Tri(),new Tri(),new Tri()],roofMats=[M.tile,M.slate,M.sheet,M.membrane];
 const details=new Tri();const wallRanges=[],roofRanges=[],detailRanges=[];
 const win=[],shut=[],doors=[],garages=[];const C=new THREE.Color();const stats={buildings:0,variants:new Set(),windows:0,chimneys:0,byClass:{}};
 for(const item of items){const {poly,t,id}=item,extra=item.extra||enrichment.buildings[id]||{};let p=buildingProfile(t,poly,extra,id);if(!p)continue;
  const arch=architecture?.get(item.featureId||id.split('#')[0])||null;if(arch)p=applyArchitecture(p,arch,poly);
  if(!p.arch){const across=p.axis.axis,along=[-across[1],across[0]];p.arch={across,along,a:{min:p.axis.min,max:p.axis.max},b:range(poly,along),shape:p.roofShape==='flat'?'flat':'gabled'};}
  const cls=arch?.buildingClass||'UNKNOWN',rng=mulberry(fnv(id)),pick=l=>l[Math.floor(rng()*l.length)];
  const dy=elevation(item)||0,base=dy+.35,eaveY=base+p.wallHeight;
  const res=RES(cls),garage=cls==='GARAGE',annex=['ANNEX','UNKNOWN','OTHER'].includes(cls),shed=cls==='SHED'||cls==='GREENHOUSE',hall=['HANGAR','FARM','INDUSTRIAL','COMMERCIAL','SILO_TANK'].includes(cls);
  // Variant: facade family, shutters, openings rhythm, chimney, overhang. Deterministic per id.
  const wallPart=shed?1:hall?2:cls==='WATER_TOWER'?3:0;
  const facade=res?pick(FACADES.render):garage||annex?pick(FACADES.annex):shed?pick(FACADES.wood):hall?pick(FACADES.steel):'#d9d5cc';
  const shutters=res&&rng()<.72?pick(FACADES.shutter):null,doorCol=pick(FACADES.door),variant=`${wallPart}-${facade}-${shutters?'s':'n'}-${Math.round(rng()*2)}`;stats.variants.add(variant);
  const wW=1.0+rng()*.3,wH=1.15+rng()*.25,spacing=3.3+rng()*1.2,storey=2.75;
  const overhang=p.arch.shape==='flat'?0:res?.45:hall?.35:shed?.22:.3,thk=res?.22:.16,roofPart=p.arch.shape==='flat'?3:(arch?.roof.material==='slate_like'?1:arch?.roof.material==='metal'||shed||hall?2:0);
  const wallCol=C.set(facade).clone().offsetHSL(0,.03,(rng()-.5)*.05),roofCol=new THREE.Color(p.roofColor).offsetHSL(0,.09,roofPart===2?.1:.04),fasciaCol=res?new THREE.Color('#ebe5d9'):roofCol.clone().multiplyScalar(.75);
  const h=roofFn(p),model=roofSurface(p),lines=model.lines,top=q=>eaveY+h(q);
  const w0=walls[wallPart].n,r0=roofs[roofPart].n,d0=details.n;
  if(cls==='WATER_TOWER'){waterTower(poly,base,arch?.totalHeightM||p.wallHeight,details,C);}
  else{
   // Walls: one quad per edge piece (split at the creases), uv = (metres along, metres above the base).
   for(const [ri,r] of poly.entries())for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],pts=[a,...edgeCuts(a,b,lines).map(f=>[a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])]),b];let u=0;
    for(let j=1;j<pts.length;j++){const c=pts[j-1],d=pts[j],L=Math.hypot(d[0]-c[0],d[1]-c[1]),tc=top(c)-thk+.06,td=top(d)-thk+.06;if(p.kind!=='canopy')walls[wallPart].quad([c[0],base,c[1]],[d[0],base,d[1]],[d[0],td,d[1]],[c[0],tc,c[1]],wallCol,[[u,0],[u+L,0],[u+L,td-base],[u,tc-base]],outward(a,b,poly));u+=L;}
    if(ri===0)openings(a,b,poly,p,{res,garage,hall,base,eaveY,thk,wW,wH,spacing,storey,shutters,doorCol,rng,win,shut,doors,garages,stats,top});}
   // Roof slab over the buffered footprint: top surface (split at the creases), fascia band, soffit back to the wall.
   const outer=poly.map((r,k)=>overhang?offsetRing(r,overhang,k>0):r),rings=shapeRings(outer),flat=rings.flat();
   const uvOf=q=>[dot(q,p.arch.along),dot(q,p.arch.across)];
   for(const tri of THREE.ShapeUtils.triangulateShape(rings[0],rings.slice(1))){const pts=tri.map(i=>[flat[i].x,flat[i].y]);for(const piece of splitByLines(pts,lines))for(let i=1;i<piece.length-1;i++){const v=[piece[0],piece[i],piece[i+1]];roofs[roofPart].tri(...v.map(q=>[q[0],top(q),q[1]]),roofCol,v.map(uvOf),UP);}}
   if(p.arch.shape==='flat'){// Parapet: outer band, cap, inner band.
    for(const r of poly)for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];details.quad([a[0],eaveY-.02,a[1]],[b[0],eaveY-.02,b[1]],[b[0],eaveY+.38,b[1]],[a[0],eaveY+.38,a[1]],wallCol.clone().multiplyScalar(.92),null,outward(a,b,poly));}
    const inner=poly.map((r,k)=>offsetRing(r,-.25,k>0));for(const [k,r] of poly.entries())for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],c=inner[k][(i+1)%r.length],d=inner[k][i];if(!c||!d)continue;details.quad([a[0],eaveY+.38,a[1]],[b[0],eaveY+.38,b[1]],[c[0],eaveY+.38,c[1]],[d[0],eaveY+.38,d[1]],fasciaCol.clone().multiplyScalar(.9),null,UP);}}
   else for(const [k,r] of outer.entries()){const orig=poly[k];for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],pts=[a,...edgeCuts(a,b,lines).map(f=>[a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])]),b];
     const fo=outward(a,b,outer);for(let j=1;j<pts.length;j++){const c=pts[j-1],d=pts[j];details.quad([c[0],top(c)-thk,c[1]],[d[0],top(d)-thk,d[1]],[d[0],top(d),d[1]],[c[0],top(c),c[1]],fasciaCol,null,fo);}
     // Soffit between the buffered edge and the matching wall edge (same index when no bevel was inserted).
     if(r.length===orig.length){const oa=orig[i],ob=orig[(i+1)%orig.length];details.quad([a[0],top(a)-thk,a[1]],[b[0],top(b)-thk,b[1]],[ob[0],top(ob)-thk,ob[1]],[oa[0],top(oa)-thk,oa[1]],fasciaCol.clone().multiplyScalar(.8),null,DOWN);}}}
   // Ridge cap and chimney.
   if(model.ridge&&p.roofHeight>.4&&p.arch.shape!=='shed'){const {at,s0,s1}=model.ridge,{along}=p.arch,n=Math.max(2,Math.ceil((s1-s0)/1)),runs=[];let run=[];
    for(let k=0;k<=n;k++){const q=at(s0+(s1-s0)*k/n);if(insidePoly(q,poly)&&h(q)>=p.roofHeight-.08)run.push(q);else{if(run.length>1)runs.push(run);run=[];}}if(run.length>1)runs.push(run);
    const cap=roofCol.clone().multiplyScalar(.72);for(const r of runs)for(let k=1;k<r.length;k++){const a=r[k-1],b=r[k],o=[along[0]*.2,along[1]*.2],ya=top(a)+.1,yb=top(b)+.1;details.quad([a[0]-o[1],ya,a[1]+o[0]],[b[0]-o[1],yb,b[1]+o[0]],[b[0]+o[1],yb,b[1]-o[0]],[a[0]+o[1],ya,a[1]-o[0]],cap,null,UP);}
    if(res&&['gable','hip'].includes(p.arch.type)&&p.size>55&&rng()<.65){const q=at(s0+(s1-s0)*(.3+rng()*.4)),o=[p.arch.across[0]*.9,p.arch.across[1]*.9],c=[q[0]+o[0]*(rng()<.5?1:-1),q[1]+o[1]*(rng()<.5?1:-1)];if(insidePoly(c,poly)){box(details,c,.55,.55,top(c)-.6,top(c)+1.15,wallCol.clone().multiplyScalar(.86),p.arch.along);box(details,c,.68,.68,top(c)+1.15,top(c)+1.3,new THREE.Color('#5a5552'),p.arch.along);stats.chimneys++;}}}
  }
  if(walls[wallPart].n>w0)wallRanges.push({part:wallPart,start:w0,end:walls[wallPart].n,id});if(roofs[roofPart].n>r0)roofRanges.push({part:roofPart,start:r0,end:roofs[roofPart].n,id});if(details.n>d0)detailRanges.push({part:0,start:d0,end:details.n,id});
  stats.buildings++;stats.byClass[cls]=(stats.byClass[cls]||0)+1;
 }
 const group=new THREE.Group();group.name='v25-houses';
 const wallMesh=groupedMesh(walls,wallMats,wallRanges,'v25-walls'),roofMesh=groupedMesh(roofs,roofMats,roofRanges,'v25-roofs'),detailMesh=groupedMesh([details],[M.detail],detailRanges,'v25-details');
 for(const m of [wallMesh,roofMesh,detailMesh])if(m)group.add(m);
 // Openings as instanced meshes: window frame + glass, shutters, doors, garage doors.
 const frameGeo=mergeGeometries([new THREE.BoxGeometry(1,.07,.07).translate(0,.5,0),new THREE.BoxGeometry(1,.07,.07).translate(0,-.5,0),new THREE.BoxGeometry(.07,1,.07).translate(.5,0,0),new THREE.BoxGeometry(.07,1,.07).translate(-.5,0,0),new THREE.BoxGeometry(1,.06,.05).translate(0,.02,0)]);
 const inst=(geo,mat,list,name,shadow=false)=>{const m=new THREE.InstancedMesh(geo,mat,Math.max(1,list.length));m.count=list.length;list.forEach((o,i)=>{m.setMatrixAt(i,o.m);if(o.c)m.setColorAt(i,o.c);});m.castShadow=shadow;m.receiveShadow=true;m.name=name;group.add(m);return m;};
 inst(frameGeo,M.frame,win,'v25-window-frames');inst(new THREE.PlaneGeometry(.86,.86),M.glass,win.map(o=>({m:o.m.clone().multiply(new THREE.Matrix4().makeTranslation(0,0,-.015))})),'v25-window-glass');
 inst(new THREE.BoxGeometry(1,1,.04),M.shutter,shut,'v25-shutters',true);inst(new THREE.BoxGeometry(1,1,.07),M.door,doors,'v25-doors');inst(new THREE.BoxGeometry(1,1,.06),M.garage,garages,'v25-garage-doors');
 stats.variants=stats.variants.size;stats.windows=win.length;stats.shutters=shut.length;stats.doors=doors.length;stats.garageDoors=garages.length;
 return {group,pickMeshes:[wallMesh,roofMesh,detailMesh].filter(Boolean),stats};
}

// Windows (per storey), one door on the longest facade of a house, a garage door on the longest facade of a garage.
function openings(a,b,poly,p,o){const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<3.2||p.kind==='canopy')return;
 const ux=dx/len,uz=dz/len;let nx=-uz,nz=ux;if(insidePoly([(a[0]+b[0])/2+nx*.3,(a[1]+b[1])/2+nz*.3],poly)){nx=-nx;nz=-nz;}
 const rotY=Math.atan2(nx,nz),place=(u,y,w,h,depth,list,col)=>{const m=new THREE.Matrix4(),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),rotY);m.compose(new THREE.Vector3(a[0]+ux*u+nx*depth,y,a[1]+uz*u+nz*depth),q,new THREE.Vector3(w,h,1));list.push({m,c:col?new THREE.Color(col):null});};
 const eave=Math.min(o.top(a),o.top(b))-o.thk,longest=isLongest(a,b,poly);
 if(o.garage){if(longest&&len>=3.6&&o.eaveY-o.base>=2.2)place(len/2,o.base+1.05,Math.min(2.5,len-.9),2.05,.03,o.garages,'#d9d6cf');return;}
 if(o.hall){if(longest&&len>=6)place(len/2,o.base+1.7,Math.min(4,len*.4),Math.min(3.4,o.eaveY-o.base-.6),.03,o.garages,'#c9ccc9');for(let u=2.5;u<len-2.5;u+=6)if(o.eaveY-o.base>3)place(u,o.base+2.4,1.2,.8,.03,o.win);return;}
 if(!o.res)return;
 const floors=Math.max(1,Math.min(3,Math.floor((eave-o.base-.9)/o.storey)+0));
 let doorU=-1;if(longest&&len>=5.5&&eave-o.base>=2.5){doorU=1.3+o.rng()*(len-2.6);place(doorU,o.base+1.05,1,2.1,.04,o.doors,o.doorCol);}
 for(let f=0;f<floors;f++){const y=o.base+1.0+f*o.storey+o.wH/2;if(y+o.wH/2>eave-.25)continue;
  for(let u=1.4+(o.rng()*.6);u<len-1.3;u+=o.spacing){if(doorU>=0&&f===0&&Math.abs(u-doorU)<o.wW/2+.9)continue;place(u,y,o.wW,o.wH,.035,o.win);o.stats.windows++;
   if(o.shutters){place(u-o.wW/2-.26,y,.44,o.wH,.025,o.shut,o.shutters);place(u+o.wW/2+.26,y,.44,o.wH,.025,o.shut,o.shutters);}}}}
function isLongest(a,b,poly){const L=Math.hypot(b[0]-a[0],b[1]-a[1]);const r=poly[0];for(let i=0;i<r.length;i++){const c=r[i],d=r[(i+1)%r.length];if(Math.hypot(d[0]-c[0],d[1]-c[1])>L+1e-6)return false;}return true;}
// Axis-aligned (in the roof frame) box between two heights, for chimneys.
function box(t,c,w,d,y0,y1,col,along){const ac=[-along[1],along[0]],corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>[c[0]+ac[0]*i*w/2+along[0]*j*d/2,c[1]+ac[1]*i*w/2+along[1]*j*d/2]);
 for(let i=0;i<4;i++){const u=corners[i],v=corners[(i+1)%4];t.quad([u[0],y0,u[1]],[v[0],y0,v[1]],[v[0],y1,v[1]],[u[0],y1,u[1]],col,null,[(u[0]+v[0])/2-c[0],0,(u[1]+v[1])/2-c[1]]);}t.quad(...[3,2,1,0].map(i=>[corners[i][0],y1,corners[i][1]]),col.clone().multiplyScalar(.9),null,UP);}
// Water tower: shaft, widened tank and conical cap on the documented total height (a silhouette, not a survey).
function waterTower(poly,base,totalH,t,C){const bb=bounds(poly[0]),cx=(bb.minX+bb.maxX)/2,cz=(bb.minZ+bb.maxZ)/2,r=Math.sqrt(area(poly[0])/Math.PI),n=28,ring=(rad,y)=>Array.from({length:n},(_,i)=>[cx+Math.cos(i/n*6.2832)*rad,y,cz+Math.sin(i/n*6.2832)*rad]);
 const concrete=C.set('#d8d3c7').clone(),tank=C.set('#cfc9bd').clone(),cap=C.set('#8c9094').clone();
 const seg=(r0,y0,r1,y1,col)=>{const A=ring(r0,y0),B=ring(r1,y1);for(let i=0;i<n;i++){const j=(i+1)%n;t.quad(A[i],A[j],B[j],B[i],col,[[i*r0*.22,0],[(i+1)*r0*.22,0],[(i+1)*r1*.22,y1-y0],[i*r1*.22,y1-y0]],[(A[i][0]+A[j][0])/2-cx,0,(A[i][2]+A[j][2])/2-cz]);}};
 const shaft=base+totalH*.7,tankTop=base+totalH*.92,tip=base+totalH;
 seg(r*.98,base,r*.9,shaft,concrete);seg(r*.9,shaft,r*1.75,shaft+1.2,tank);seg(r*1.75,shaft+1.2,r*1.75,tankTop,tank);seg(r*1.75,tankTop,r*1.6,tankTop+.3,cap);
 const top=ring(r*1.6,tankTop+.3);for(let i=0;i<n;i++)t.tri(top[i],[cx,tip,cz],top[(i+1)%n],cap,null,UP);}

// V2.6 reuses the geometry helpers (no behaviour change for the V2.5 mode).
export {fnv,mulberry,RES,outward,range,offsetRing,roofFn,Tri,groupedMesh,box,isLongest,UP,DOWN};
