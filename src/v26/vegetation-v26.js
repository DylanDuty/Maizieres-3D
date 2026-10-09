import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {random} from '../geo.js';
import {waterProximity,HEDGE_WATER_MARGIN} from '../hydro-display.js';

// V2.6 Poussey diorama — soft illustrated vegetation. Crowns are a few large overlapping blobs with smoothed normals
// (they shade like painted volumes, not like polygon potatoes), a vertical colour gradient (sunlit yellow-green on top,
// cool blue-green underneath) and a per-lobe variation. Placement rules are the V2.5 ones (frozen woods, village
// gardens, stream banks, DSB hedges, raster mask off footprints / roads / rail / water); woods share hues by cluster so
// they read as masses, gardens get fruit trees, a few blossoms and flower beds. Decorative, never surveyed.
const inRing=(x,z,r)=>{let c=false;for(let i=0,j=r.length-2;i<r.length;j=i,i+=2)if((r[i+1]>z)!==(r[j+1]>z)&&x<(r[j]-r[i])*(z-r[i+1])/(r[j+1]-r[i+1])+r[i])c=!c;return c;};
const inPoly=(x,z,p)=>inRing(x,z,p[0])&&!p.slice(1).some(h=>inRing(x,z,h));
const h12=(x,y)=>{const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);};

function blob(r,[x,y,z],squash,seed,detail){const g=new THREE.IcosahedronGeometry(1,detail),p=g.getAttribute('position'),v=new THREE.Vector3(),n=[];
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).normalize();const d=1+.07*(h12(v.x*2.1+seed,v.y*1.7+v.z*2.3)-.5);n.push(v.x,v.y*squash*.8,v.z);v.multiplyScalar(r*d);v.y*=squash;p.setXYZ(i,v.x+x,v.y+y,v.z+z);}
 g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.userData.centre=[x,y,z];return g;}
function crown(spec,seed,detail,{top=[1.06,1.02,.84],bottom=[.5,.6,.64]}={}){const parts=spec.map(([r,x,y,z,s],i)=>blob(r,[x,y,z],s,seed+i*1.3,detail)),per=parts[0].getAttribute('position').count,g=mergeGeometries(parts);
 const p=g.getAttribute('position'),nrm=g.getAttribute('normal'),v=new THREE.Vector3(),w=new THREE.Vector3();let yMin=Infinity,yMax=-Infinity;for(let i=0;i<p.count;i++){yMin=Math.min(yMin,p.getY(i));yMax=Math.max(yMax,p.getY(i));}
 const cy=(yMin+yMax)/2,col=[];
 for(let i=0;i<p.count;i++){const lobe=Math.floor(i/per),k=.93+.14*h12(seed+lobe*3.1,lobe*1.7);v.fromBufferAttribute(p,i);w.set(v.x,(v.y-cy)*.8,v.z).normalize();
  const nx=nrm.getX(i),ny=nrm.getY(i),nz=nrm.getZ(i);w.set(nx+w.x*.9,ny+w.y*.9,nz+w.z*.9).normalize();nrm.setXYZ(i,w.x,w.y,w.z);
  const t=THREE.MathUtils.clamp((v.y-yMin)/(yMax-yMin),0,1),e=t*t*(3-2*t);col.push((bottom[0]+(top[0]-bottom[0])*e)*k,(bottom[1]+(top[1]-bottom[1])*e)*k,(bottom[2]+(top[2]-bottom[2])*e)*k);}
 g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));return g;}
function trunkGeo(){const parts=[new THREE.CylinderGeometry(.05,.085,.55,7,1).translate(0,.275,0)];for(const [a,s] of [[.45,1],[-.6,-1]]){const b=new THREE.CylinderGeometry(.022,.04,.3,5,1);b.translate(0,.15,0);b.rotateZ(a*s*.9);b.translate(0,.42,0);parts.push(b);}
 const g=mergeGeometries(parts),n=g.getAttribute('position').count,col=[];for(let i=0;i<n;i++)col.push(1,1,1);g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));return g;}
const G=['#8fc46a','#7fb95e','#70ad5b','#9dcd70','#66a262','#88bc6a'],P=['#a6c661','#b3ce69','#95bd5b'],F=['#92c66c','#a3cd72','#82ba66'],B=['#70a65e','#7bb065','#669b5c','#86b76e'];
// Archetypes in a unit frame (height 1): blobs [radius, x, y, z, squash]; trunk fraction; palette.
export const ARCHETYPES={
 round:{lobes:[[.36,0,.66,0,.92],[.28,.22,.58,.08,.9],[.28,-.2,.6,-.1,.9],[.25,.02,.82,-.04,.86]],trunk:.4,palette:G},
 broad:{lobes:[[.34,0,.6,0,.72],[.31,.3,.56,.04,.7],[.31,-.29,.57,-.05,.7],[.27,.03,.74,.1,.72]],trunk:.4,palette:G},
 tall:{lobes:[[.25,0,.5,0,1.15],[.25,.02,.68,.03,1.15],[.21,-.02,.86,-.02,1.1]],trunk:.3,palette:G},
 poplar:{lobes:[[.17,0,.4,0,1.6],[.18,.01,.62,0,1.6],[.15,-.01,.84,.01,1.5]],trunk:.2,palette:P},
 fruit:{lobes:[[.33,0,.58,0,.84],[.25,.22,.54,.12,.82],[.25,-.2,.56,-.12,.82]],trunk:.38,palette:F},
 blossom:{lobes:[[.33,0,.58,0,.84],[.25,.22,.54,.12,.82],[.25,-.2,.56,-.12,.82]],trunk:.38,palette:['#f6dde4','#fbe9ec','#f4d2da','#fcf2ef'],gradient:{top:[1.02,1,1],bottom:[.78,.72,.8]}},
 bush:{lobes:[[.42,0,.4,0,.6],[.36,.4,.38,.1,.58],[.36,-.38,.39,-.08,.58],[.3,.08,.5,.3,.6],[.3,-.1,.48,-.3,.6]],trunk:0,palette:B},
 flowers:{lobes:[[.42,0,.4,0,.55],[.34,.38,.38,.1,.55],[.34,-.36,.39,-.08,.55]],trunk:0,palette:['#f3dca6','#f6c9cb','#ece3ab','#f9e6ec','#d9e3a0'],gradient:{top:[1.04,1.02,1],bottom:[.7,.74,.66]}}};

export function buildVegetationV26(parent,{v2,box,buildings,heightAt,materials:M,detail=1,budget=1}){
 const {data:d}=v2,rng=random(10226),inBox=(x,z)=>x>=box.minX&&x<=box.maxX&&z>=box.minZ&&z<=box.maxZ;
 const W=box.maxX-box.minX,D=box.maxZ-box.minZ,MW=2048,MH=Math.round(MW*D/W),mask=document.createElement('canvas');mask.width=MW;mask.height=MH;const ctx=mask.getContext('2d',{willReadFrequently:true}),sx=MW/W;
 const X=x=>(x-box.minX)*sx,Z=z=>(z-box.minZ)*sx;ctx.fillStyle='#000';ctx.strokeStyle='#000';ctx.lineCap='round';ctx.lineJoin='round';
 const fillRings=rings=>{ctx.beginPath();for(const r of rings){for(let i=0;i<r.length;i+=2)i?ctx.lineTo(X(r[i]),Z(r[i+1])):ctx.moveTo(X(r[i]),Z(r[i+1]));ctx.closePath();}ctx.fill('evenodd');ctx.lineWidth=Math.max(2,2.8*sx);ctx.stroke();};
 const line=(p,stride,widthM)=>{ctx.lineWidth=Math.max(1.5,widthM*sx);ctx.beginPath();for(let i=0;i<p.length;i+=stride)i?ctx.lineTo(X(p[i]),Z(p[i+1])):ctx.moveTo(X(p[i]),Z(p[i+1]));ctx.stroke();};
 for(const b of buildings)fillRings(b.poly.map(r=>r.flat()));
 for(const r of d.roads)line(r.p,3,(r.w||3)+4.5);for(const t of d.rail)line(t.p,3,9);for(const l of d.waterLines)line(l.p,2,(l.w||3)+3);
 for(const a of [...d.water,...d.artificial.filter(a=>a.kind==='surface')])for(const p of a.r)fillRings(p);
 const px=ctx.getImageData(0,0,MW,MH).data,blocked=(x,z)=>{const i=Math.floor(X(x)),j=Math.floor(Z(z));return i<0||j<0||i>=MW||j>=MH||px[(j*MW+i)*4+3]>0;};
 const bbox=p=>{let b=[Infinity,Infinity,-Infinity,-Infinity];for(const r of p)for(let i=0;i<r.length;i+=2)b=[Math.min(b[0],r[i]),Math.min(b[1],r[i+1]),Math.max(b[2],r[i]),Math.max(b[3],r[i+1])];return b;};
 const list=[],add=(x,z,type,h,prio,hue=null,wide=1)=>{if(!inBox(x,z)||blocked(x,z))return;list.push({x,z,type,h,prio,hue,wide});};
 const choose=w=>{let t=rng()*w.reduce((a,[,v])=>a+v,0);for(const [k,v] of w){t-=v;if(t<=0)return k;}return w[0][0];};
 // Woods: hue shared by 45 m clusters, crowns widened so the canopies merge into masses.
 for(const o of d.woodland)for(const p of o.r){const b=bbox(p);if(b[2]<box.minX||b[0]>box.maxX||b[3]<box.minZ||b[1]>box.maxZ)continue;const poplar=o.t==='peupleraie',s=poplar?10:o.t==='lande_ligneuse'?13:9.5;
  const x0=Math.max(b[0],box.minX),x1=Math.min(b[2],box.maxX),z0=Math.max(b[1],box.minZ),z1=Math.min(b[3],box.maxZ),cells=[];
  if(poplar)for(let x=x0;x<x1;x+=s)for(let z=z0;z<z1;z+=s)cells.push([x+rng()*s*.5,z+rng()*s*.5]);else for(let k=Math.round((x1-x0)*(z1-z0)/(s*s));k>0;k--)cells.push([x0+rng()*(x1-x0),z0+rng()*(z1-z0)]);
  for(const [qx,qz] of cells){if(!inPoly(qx,qz,p))continue;const hue=h12(Math.floor(qx/45),Math.floor(qz/45));
   if(poplar)add(qx,qz,'poplar',15+rng()*7,2,hue);else if(o.t==='lande_ligneuse')add(qx,qz,'bush',2.5+rng()*2,2,hue,1.3);else add(qx,qz,choose([['round',4],['broad',3],['tall',2]]),9+rng()*6,2,hue,1.2);}}
 // Village gardens: fruit trees, a few blossoms, flower beds.
 for(const v of d.village)for(const p of v.r){const b=bbox(p);for(let x=Math.max(b[0],box.minX);x<Math.min(b[2],box.maxX);x+=17)for(let z=Math.max(b[1],box.minZ);z<Math.min(b[3],box.maxZ);z+=17){const qx=x+rng()*17,qz=z+rng()*17;if(!inPoly(qx,qz,p))continue;const t=rng();
   if(t<.3)add(qx,qz,choose([['fruit',5],['round',2],['blossom',1.4]]),4.5+rng()*4,0);else if(t<.4)add(qx,qz,'bush',1+rng()*.9,0);else if(t<.48)add(qx,qz,'flowers',.7+rng()*.5,0);}}
 // Stream banks: riparian trees, taller and bluer.
 for(const l of d.waterLines){const p=l.p,w=(l.w||3)/2;let travel=0;for(let i=2;i<p.length;i+=2){const ax=p[i-2],az=p[i-1],bx=p[i],bz=p[i+1],L=Math.hypot(bx-ax,bz-az)||1,ux=(bx-ax)/L,uz=(bz-az)/L;
  for(let s=travel%9;s<L;s+=9){const side=rng()<.5?-1:1,off=w+3+rng()*7,qx=ax+ux*s-uz*side*off,qz=az+uz*s+ux*side*off;if(rng()<.5)add(qx,qz,choose([['tall',5],['broad',3],['round',2]]),7.5+rng()*7,1,.8+rng()*.2);}travel+=L;}}
 // Hedges: overlapping soft blobs along the DSB lines, never over water.
 const nearWater=waterProximity(d.waterLines,d.water),hedges=[];
 for(const hd of d.hedges){const p=hd.p,H=Math.min(4.5,hd.h||2.2),w=Math.min(5,hd.w||2.2);for(let i=3;i<p.length;i+=3){const ax=p[i-3],az=p[i-2],bx=p[i],bz=p[i+1],L=Math.hypot(bx-ax,bz-az),ux=(bx-ax)/(L||1),uz=(bz-az)/(L||1),ang=Math.atan2(ux,uz);
  for(let s=1.2;s<L;s+=2.5){const j=(rng()-.5)*.5,qx=ax+ux*s-uz*j,qz=az+uz*s+ux*j;if(!inBox(qx,qz)||nearWater(qx,qz,w/2+HEDGE_WATER_MARGIN))continue;if(blocked(qx,qz)&&rng()<.7)continue;hedges.push({x:qx,z:qz,ang:ang+(rng()-.5)*.3,sx:w*(.85+rng()*.4)+.9,sy:H*(.85+rng()*.35),sz:3.8+rng()*1.4});}}}
 list.sort((a,b)=>a.prio-b.prio);const keep=Math.round(list.length*budget),trees=list.slice(0,keep);
 const group=new THREE.Group();group.name='v26-vegetation';const o3=new THREE.Object3D(),col=new THREE.Color();const meshes={};let trunkCount=0;
 const trunk=new THREE.InstancedMesh(trunkGeo(),M.trunk,Math.max(1,trees.length));trunk.castShadow=true;trunk.receiveShadow=false;trunk.name='v26-trunks';
 for(const [name,A] of Object.entries(ARCHETYPES)){const mine=trees.filter(t=>t.type===name);const m=new THREE.InstancedMesh(crown(A.lobes,name.length*2.3,detail,A.gradient),M.leaf,Math.max(1,mine.length));m.count=mine.length;m.castShadow=true;m.receiveShadow=true;m.name='v26-trees-'+name;
  mine.forEach((t,i)=>{const g=heightAt(t.x,t.z),s=t.h;o3.position.set(t.x,g,t.z);o3.rotation.set((rng()-.5)*.06,rng()*6.28,(rng()-.5)*.06);o3.scale.set(s*t.wide*(.9+rng()*.25),s,s*t.wide*(.9+rng()*.25));o3.updateMatrix();m.setMatrixAt(i,o3.matrix);
   const k=t.hue==null?Math.floor(rng()*A.palette.length):Math.floor(t.hue*A.palette.length)%A.palette.length;m.setColorAt(i,col.set(A.palette[k]).offsetHSL((rng()-.5)*.015,0,(rng()-.5)*.06));
   if(A.trunk){o3.rotation.set(0,rng()*6.28,0);o3.scale.set(s*.12,s*A.trunk*1.1,s*.12);o3.updateMatrix();trunk.setMatrixAt(trunkCount,o3.matrix);trunk.setColorAt(trunkCount,col.set('#8a7059').offsetHSL(0,0,(rng()-.5)*.08));trunkCount++;}});
  meshes[name]=m;group.add(m);}
 trunk.count=trunkCount;group.add(trunk);
 const hedgeMesh=new THREE.InstancedMesh(crown(ARCHETYPES.bush.lobes,4.2,Math.min(detail,1)),M.leaf,Math.max(1,hedges.length));hedgeMesh.count=hedges.length;hedgeMesh.castShadow=true;hedgeMesh.receiveShadow=true;hedgeMesh.name='v26-hedges';
 hedges.forEach((h,i)=>{o3.position.set(h.x,heightAt(h.x,h.z)-.1,h.z);o3.rotation.set(0,h.ang,0);o3.scale.set(h.sx,h.sy,h.sz);o3.updateMatrix();hedgeMesh.setMatrixAt(i,o3.matrix);hedgeMesh.setColorAt(i,col.set(B[i%4]).offsetHSL(0,0,(rng()-.5)*.05));});
 group.add(hedgeMesh);parent.add(group);
 return {group,stats:{trees:trees.length,candidates:list.length,hedgeBushes:hedges.length,archetypes:Object.keys(ARCHETYPES).length,byType:Object.fromEntries(Object.entries(meshes).map(([k,m])=>[k,m.count]))},meshes:{...meshes,trunk,hedges:hedgeMesh}};
}
