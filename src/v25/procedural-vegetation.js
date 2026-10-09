import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {random} from '../geo.js';
import {waterProximity,HEDGE_WATER_MARGIN} from '../hydro-display.js';

// V2.5 Poussey prototype — composed procedural trees and organic hedges, instanced per archetype.
// Seven archetypes (round, wide, slender, garden, poplar, small, bush); each crown is several displaced lobes merged with
// a branched trunk. Placement inside the prototype box only: woods (frozen polygons), village gardens, stream banks,
// DSB hedge lines; a raster mask keeps every plant off footprints, roads, rail and water. Decorative, never surveyed.
const inRing=(x,z,r)=>{let c=false;for(let i=0,j=r.length-2;i<r.length;j=i,i+=2)if((r[i+1]>z)!==(r[j+1]>z)&&x<(r[j]-r[i])*(z-r[i+1])/(r[j+1]-r[i+1])+r[i])c=!c;return c;};
const inPoly=(x,z,p)=>inRing(x,z,p[0])&&!p.slice(1).some(h=>inRing(x,z,h));
const h12=(x,y)=>{const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);};

// Lobe: an icosahedron displaced by a low-frequency noise, flattened; vertex colour darkens toward the base.
function lobe(r,[x,y,z],flatten,seed,detail=1){const g=new THREE.IcosahedronGeometry(1,detail),p=g.getAttribute('position'),v=new THREE.Vector3(),col=[];
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).normalize();const d=1+.16*(h12(v.x*3+seed,v.y*3+v.z*2)-.5)+.08*Math.sin(v.x*5+seed)*Math.cos(v.z*4);v.multiplyScalar(r*d);v.y*=flatten;p.setXYZ(i,v.x+x,v.y+y,v.z+z);const t=THREE.MathUtils.clamp((v.y/(r*flatten)+1)/2,0,1);const l=.62+.4*t;col.push(l,l*1.02,l*.9);}
 g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();return g;}
function crown(spec,seed,detail){return mergeGeometries(spec.map(([r,x,y,z,f],i)=>lobe(r,[x,y,z],f,seed+i*1.7,detail)));}
function trunkGeo(){const parts=[new THREE.CylinderGeometry(.045,.075,.55,6,1).translate(0,.275,0)];for(const [a,s] of [[.4,1],[-.6,-1]]){const b=new THREE.CylinderGeometry(.02,.035,.3,5,1);b.translate(0,.15,0);b.rotateZ(a*s*.9);b.translate(.0,.42,0);parts.push(b);}const g=mergeGeometries(parts);const n=g.getAttribute('position').count,col=[];for(let i=0;i<n;i++)col.push(.42,.3,.2);g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));return g;}
// Archetypes in a unit frame (height 1): crown lobes [radius, x, y, z, flatten]; trunk fraction; colour palette.
export const ARCHETYPES={
 round:{lobes:[[.34,0,.68,0,.9],[.26,.2,.6,.1,.9],[.25,-.2,.62,-.08,.9],[.24,.03,.84,-.06,.85],[.22,-.05,.56,.2,.9]],trunk:.42,palette:['#6a9a4a','#74a452','#5e9044','#7fab59','#669447']},
 wide:{lobes:[[.3,0,.62,0,.78],[.3,.3,.56,.05,.75],[.3,-.28,.58,-.05,.75],[.26,.02,.76,.12,.8],[.26,.06,.74,-.16,.8]],trunk:.4,palette:['#6b9b4c','#7aa557','#5f8f44','#86b062']},
 slender:{lobes:[[.2,0,.5,0,1.1],[.2,.02,.68,.03,1.1],[.17,-.03,.86,-.02,1.1],[.14,.01,.98,0,1]],trunk:.3,palette:['#6e9d4f','#78a657','#64944a']},
 garden:{lobes:[[.3,0,.6,0,.85],[.22,.22,.56,.14,.85],[.22,-.2,.58,-.12,.85],[.2,.0,.78,.0,.8]],trunk:.4,palette:['#7aa858','#86b363','#9ba94e','#73a053','#a09c4c']},
 poplar:{lobes:[[.17,0,.42,0,1.5],[.18,.02,.64,0,1.5],[.15,-.01,.84,.01,1.5]],trunk:.22,palette:['#7aa44c','#86ad55','#6f9a45']},
 small:{lobes:[[.3,0,.6,0,.8],[.22,.18,.55,.1,.8],[.22,-.16,.58,-.1,.8]],trunk:.38,palette:['#7cab5a','#8fb665','#6f9f50']},
 bush:{lobes:[[.42,0,.42,0,.62],[.36,.42,.4,.1,.6],[.36,-.4,.4,-.08,.6],[.3,.1,.52,.3,.6],[.3,-.12,.5,-.3,.6]],trunk:0,palette:['#5c8c48','#689a52','#558343','#6fa05a','#4f7f3f']}};

export function buildVegetationV25(parent,{v2,box,buildings,heightAt,materials:M,detail=1,budget=1}){
 const {data:d}=v2,rng=random(10225),inBox=(x,z)=>x>=box.minX&&x<=box.maxX&&z>=box.minZ&&z<=box.maxZ;
 const W=box.maxX-box.minX,D=box.maxZ-box.minZ,MW=2048,MH=Math.round(MW*D/W),mask=document.createElement('canvas');mask.width=MW;mask.height=MH;const ctx=mask.getContext('2d',{willReadFrequently:true}),sx=MW/W;
 const X=x=>(x-box.minX)*sx,Z=z=>(z-box.minZ)*sx;ctx.fillStyle='#000';ctx.strokeStyle='#000';ctx.lineCap='round';ctx.lineJoin='round';
 const fillRings=rings=>{ctx.beginPath();for(const r of rings){for(let i=0;i<r.length;i+=2)i?ctx.lineTo(X(r[i]),Z(r[i+1])):ctx.moveTo(X(r[i]),Z(r[i+1]));ctx.closePath();}ctx.fill('evenodd');ctx.lineWidth=Math.max(2,2.5*sx);ctx.stroke();};
 const line=(p,stride,widthM)=>{ctx.lineWidth=Math.max(1.5,widthM*sx);ctx.beginPath();for(let i=0;i<p.length;i+=stride)i?ctx.lineTo(X(p[i]),Z(p[i+1])):ctx.moveTo(X(p[i]),Z(p[i+1]));ctx.stroke();};
 for(const b of buildings)fillRings(b.poly.map(r=>r.flat()));
 for(const r of d.roads)line(r.p,3,(r.w||3)+4);for(const t of d.rail)line(t.p,3,9);for(const l of d.waterLines)line(l.p,2,(l.w||3)+3);
 for(const a of [...d.water,...d.artificial.filter(a=>a.kind==='surface')])for(const p of a.r)fillRings(p);
 const px=ctx.getImageData(0,0,MW,MH).data,blocked=(x,z)=>{const i=Math.floor(X(x)),j=Math.floor(Z(z));return i<0||j<0||i>=MW||j>=MH||px[(j*MW+i)*4+3]>0;};
 const bbox=p=>{let b=[Infinity,Infinity,-Infinity,-Infinity];for(const r of p)for(let i=0;i<r.length;i+=2)b=[Math.min(b[0],r[i]),Math.min(b[1],r[i+1]),Math.max(b[2],r[i]),Math.max(b[3],r[i+1])];return b;};
 const list=[],add=(x,z,type,h,prio,tilt=0)=>{if(!inBox(x,z)||blocked(x,z))return;list.push({x,z,type,h,prio,tilt});};
 const choose=w=>{let t=rng()*w.reduce((a,[,v])=>a+v,0);for(const [k,v] of w){t-=v;if(t<=0)return k;}return w[0][0];};
 // Woods inside the box.
 for(const o of d.woodland)for(const p of o.r){const b=bbox(p);if(b[2]<box.minX||b[0]>box.maxX||b[3]<box.minZ||b[1]>box.maxZ)continue;const poplar=o.t==='peupleraie',s=poplar?11:o.t==='lande_ligneuse'?14:9;
  for(let x=Math.max(b[0],box.minX);x<Math.min(b[2],box.maxX);x+=s)for(let z=Math.max(b[1],box.minZ);z<Math.min(b[3],box.maxZ);z+=s){const qx=x+rng()*s,qz=z+rng()*s;if(!inPoly(qx,qz,p))continue;
   if(poplar)add(qx,qz,'poplar',15+rng()*7,2);else if(o.t==='lande_ligneuse')add(qx,qz,'bush',2.5+rng()*2,2);else add(qx,qz,choose([['round',4],['wide',3],['slender',2],['small',1]]),8.5+rng()*6,2);}}
 // Village gardens (built-up zone polygon): garden trees, a few bushes.
 for(const v of d.village)for(const p of v.r){const b=bbox(p);for(let x=Math.max(b[0],box.minX);x<Math.min(b[2],box.maxX);x+=18)for(let z=Math.max(b[1],box.minZ);z<Math.min(b[3],box.maxZ);z+=18){const qx=x+rng()*18,qz=z+rng()*18;if(!inPoly(qx,qz,p))continue;const t=rng();
   if(t<.3)add(qx,qz,choose([['garden',6],['small',3],['round',1]]),4+rng()*4.5,0);else if(t<.42)add(qx,qz,'bush',1+rng()*.9,0);}}
 // Stream banks: riparian trees on both sides.
 for(const l of d.waterLines){const p=l.p,w=(l.w||3)/2;let travel=0;for(let i=2;i<p.length;i+=2){const ax=p[i-2],az=p[i-1],bx=p[i],bz=p[i+1],L=Math.hypot(bx-ax,bz-az)||1,ux=(bx-ax)/L,uz=(bz-az)/L;
  for(let s=travel%9;s<L;s+=9){const side=rng()<.5?-1:1,off=w+3+rng()*7,qx=ax+ux*s-uz*side*off,qz=az+uz*s+ux*side*off;if(rng()<.5)add(qx,qz,choose([['slender',5],['wide',3],['round',2]]),7+rng()*7,1);}travel+=L;}}
 // Hedges: organic runs of bushes along the DSB lines, never over water.
 const nearWater=waterProximity(d.waterLines,d.water),hedges=[];
 for(const hd of d.hedges){const p=hd.p,H=Math.min(4.5,hd.h||2.2),w=Math.min(5,hd.w||2.2);for(let i=3;i<p.length;i+=3){const ax=p[i-3],az=p[i-2],bx=p[i],bz=p[i+1],L=Math.hypot(bx-ax,bz-az),ux=(bx-ax)/(L||1),uz=(bz-az)/(L||1),ang=Math.atan2(ux,uz);
  for(let s=1.5;s<L;s+=3.1){const j=(rng()-.5)*.7,qx=ax+ux*s-uz*j,qz=az+uz*s+ux*j;if(!inBox(qx,qz)||nearWater(qx,qz,w/2+HEDGE_WATER_MARGIN))continue;if(blocked(qx,qz)&&rng()<.7)continue;hedges.push({x:qx,z:qz,ang:ang+(rng()-.5)*.4,sx:w*(.75+rng()*.5)+.6,sy:H*(.8+rng()*.45),sz:3.4+rng()*1.6});}}}
 list.sort((a,b)=>a.prio-b.prio);const keep=Math.round(list.length*budget),trees=list.slice(0,keep);
 const group=new THREE.Group();group.name='v25-vegetation';const o3=new THREE.Object3D(),col=new THREE.Color();const meshes={};let trunkCount=0;
 const trunk=new THREE.InstancedMesh(trunkGeo(),M.trunk,Math.max(1,trees.length));trunk.castShadow=true;trunk.receiveShadow=false;trunk.name='v25-trunks';
 for(const [name,A] of Object.entries(ARCHETYPES)){const mine=trees.filter(t=>t.type===name);const m=new THREE.InstancedMesh(crown(A.lobes,name.length*2.3,name==='poplar'||name==='bush'?Math.min(detail,1):detail),M.leaf,Math.max(1,mine.length));m.count=mine.length;m.castShadow=true;m.receiveShadow=true;m.name='v25-trees-'+name;
  mine.forEach((t,i)=>{const g=heightAt(t.x,t.z),s=t.h;o3.position.set(t.x,g,t.z);o3.rotation.set((rng()-.5)*.05,rng()*6.28,(rng()-.5)*.05);o3.scale.set(s*(.9+rng()*.25),s,s*(.9+rng()*.25));o3.updateMatrix();m.setMatrixAt(i,o3.matrix);m.setColorAt(i,col.set(A.palette[Math.floor(rng()*A.palette.length)]).offsetHSL((rng()-.5)*.02,0,(rng()-.5)*.08));
   if(A.trunk){o3.rotation.set(0,rng()*6.28,0);o3.scale.set(s*.11,s*A.trunk*1.1,s*.11);o3.updateMatrix();trunk.setMatrixAt(trunkCount,o3.matrix);trunk.setColorAt(trunkCount,col.set('#7a5f45').offsetHSL(0,0,(rng()-.5)*.1));trunkCount++;}});
  meshes[name]=m;group.add(m);}
 trunk.count=trunkCount;group.add(trunk);
 const hedgeMesh=new THREE.InstancedMesh(crown(ARCHETYPES.bush.lobes,4.2,Math.min(detail,1)),M.leaf,Math.max(1,hedges.length));hedgeMesh.count=hedges.length;hedgeMesh.castShadow=true;hedgeMesh.receiveShadow=true;hedgeMesh.name='v25-hedges';
 hedges.forEach((h,i)=>{o3.position.set(h.x,heightAt(h.x,h.z)-.1,h.z);o3.rotation.set(0,h.ang,0);o3.scale.set(h.sx,h.sy,h.sz);o3.updateMatrix();hedgeMesh.setMatrixAt(i,o3.matrix);hedgeMesh.setColorAt(i,col.set(ARCHETYPES.bush.palette[i%5]).offsetHSL(0,0,(rng()-.5)*.06));});
 group.add(hedgeMesh);parent.add(group);
 return {group,stats:{trees:trees.length,candidates:list.length,hedgeBushes:hedges.length,archetypes:Object.keys(ARCHETYPES).length,byType:Object.fromEntries(Object.entries(meshes).map(([k,m])=>[k,m.count]))},meshes:{...meshes,trunk,hedges:hedgeMesh}};
}
