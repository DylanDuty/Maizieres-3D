import * as THREE from 'three';
import {crownGeometry,toon} from './art.js';
import {random} from './geo.js';

// V2.4 vegetation of the assembled view: instanced stylised trees inside the frozen woodland polygons (BD TOPO / IGN
// V1.10), sparse garden trees inside the built-up area, both kept off buildings, roads, rail and water by a raster mask.
// Positions are decorative (density by distance to the village, deterministic seed); no tree is a surveyed object.
// Four instanced meshes in total: wood crowns, garden crowns, poplars, trunks. Nothing here moves a geometry.
export const TREE_BUDGET={'very-fluid':4500,fluid:11000,high:14000};
const inRing=(x,z,r)=>{let c=false;for(let i=0,j=r.length-2;i<r.length;j=i,i+=2)if((r[i+1]>z)!==(r[j+1]>z)&&x<(r[j]-r[i])*(z-r[i+1])/(r[j+1]-r[i+1])+r[i])c=!c;return c;};
const inPoly=(x,z,p)=>inRing(x,z,p[0])&&!p.slice(1).some(h=>inRing(x,z,h));
const CENTRES=[[0,0],[1150,-300],[-300,850]];const nearVillage=(x,z)=>Math.min(...CENTRES.map(([a,b])=>Math.hypot(x-a,z-b)));

export function buildVegetation(parent,{v2,buildings=[],quality}){
 const {data:d,heightAt,onGrid,bounds:{x0,z0,W,D}}=v2,rng=random(10220);
 // Exclusion mask over the display terrain (≈ 4 m per pixel): built footprints, roads, rail, water, artificial surfaces.
 const MW=1536,MH=Math.round(MW*D/W),mask=document.createElement('canvas');mask.width=MW;mask.height=MH;const ctx=mask.getContext('2d',{willReadFrequently:true}),sx=MW/W;
 const X=x=>(x-x0)*sx,Z=z=>(z-z0)*sx;ctx.fillStyle='#000';ctx.strokeStyle='#000';ctx.lineCap='round';ctx.lineJoin='round';
 const fillRings=rings=>{ctx.beginPath();for(const r of rings){for(let i=0;i<r.length;i+=2)i?ctx.lineTo(X(r[i]),Z(r[i+1])):ctx.moveTo(X(r[i]),Z(r[i+1]));ctx.closePath();}ctx.fill('evenodd');ctx.lineWidth=2;ctx.stroke();};
 const line=(p,stride,widthM)=>{ctx.lineWidth=Math.max(1.5,widthM*sx);ctx.beginPath();for(let i=0;i<p.length;i+=stride)i?ctx.lineTo(X(p[i]),Z(p[i+1])):ctx.moveTo(X(p[i]),Z(p[i+1]));ctx.stroke();};
 for(const b of buildings)fillRings(b.poly.map(r=>r.flat()));
 for(const r of d.roads)line(r.p,3,(r.w||3)+5);
 for(const t of d.rail)line(t.p,3,9);
 for(const l of d.waterLines)line(l.p,2,(l.w||3)+5);
 for(const a of [...d.water,...d.artificial.filter(a=>a.kind==='surface')])for(const p of a.r)fillRings(p);
 const px=ctx.getImageData(0,0,MW,MH).data;
 const blocked=(x,z)=>{const i=Math.floor(X(x)),j=Math.floor(Z(z));return i<0||j<0||i>=MW||j>=MH||px[(j*MW+i)*4+3]>0;};
 const box=p=>{let b=[Infinity,Infinity,-Infinity,-Infinity];for(const r of p)for(let i=0;i<r.length;i+=2)b=[Math.min(b[0],r[i]),Math.min(b[1],r[i+1]),Math.max(b[2],r[i]),Math.max(b[3],r[i+1])];return b;};
 const trees=[];
 const add=(x,z,h,type,priority)=>{if(!onGrid(x,z)||blocked(x,z))return;trees.push({x,z,h,type,priority});};
 // Garden trees in the built-up zone (BD TOPO zone bâtie): few, rounder, close to the eye.
 for(const v of d.village)for(const p of v.r){const b=box(p),s=30;for(let x=b[0];x<b[2];x+=s)for(let z=b[1];z<b[3];z+=s){const qx=x+rng()*s,qz=z+rng()*s;if(rng()>.42||!inPoly(qx,qz,p))continue;add(qx,qz,5+rng()*4.5,rng()<.1?'poplar':'garden',0);}}
 // Woodland: step grows with the distance to the villages; crowns grow with the step so the mass stays closed.
 for(const o of d.woodland)for(const p of o.r){const b=box(p),dist=nearVillage((b[0]+b[2])/2,(b[1]+b[3])/2),open=o.t==='foret_ouverte'||o.t==='lande_ligneuse';
  const poplar=o.t==='peupleraie',bush=o.t==='lande_ligneuse',s=(dist<1200?16:dist<2300?26:42)*(open?1.7:poplar?1.45:1);
  for(let x=b[0];x<b[2];x+=s)for(let z=b[1];z<b[3];z+=s){const qx=x+rng()*s,qz=z+rng()*s;if(!inPoly(qx,qz,p))continue;
   add(qx,qz,bush?3.5+rng()*2:poplar?15+rng()*5:11+rng()*5+s*.1,bush?'bush':poplar?'poplar':'wood',1+dist/1000);}}
 trees.sort((a,b)=>a.priority-b.priority);
 const round=trees.filter(t=>t.type==='wood'||t.type==='bush'),garden=trees.filter(t=>t.type==='garden'),tall=trees.filter(t=>t.type==='poplar');
 const leaf=['#6b9b4b','#75a553','#5f9048','#80ac58','#6a9647','#8bb262'],poplarLeaf=['#7aa44c','#86ad55','#6f9a45'],autumn=['#93a452','#a39c4e'];
 const mk=(geo,n)=>{const m=new THREE.InstancedMesh(geo,toon({vertexColors:true}),Math.max(1,n));m.count=n;m.castShadow=true;m.receiveShadow=false;m.frustumCulled=true;return m;};
 const crowns=mk(crownGeometry({lobes:5,flatten:.82,detail:0}),round.length),gardens=mk(crownGeometry({lobes:5,flatten:.86,detail:1}),garden.length),columns=mk(crownGeometry({lobes:3,flatten:1,seed:1.3,detail:0}),tall.length);
 const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.22,.36,1,5,1,true),toon({color:'#7f6447'}),Math.max(1,trees.length));trunks.castShadow=false;trunks.receiveShadow=false;
 const o3=new THREE.Object3D(),color=new THREE.Color();let ti=0;
 const place=(mesh,list,{radius,lift,flat,palette,trunk})=>list.forEach((t,i)=>{const g=heightAt(t.x,t.z),h=t.h;o3.position.set(t.x,g+h*lift,t.z);o3.rotation.set(0,rng()*6.28,0);o3.scale.set(h*radius*(.9+rng()*.2),h*flat,h*radius*(.9+rng()*.2));o3.updateMatrix();mesh.setMatrixAt(i,o3.matrix);
  mesh.setColorAt(i,color.set(palette[(i*7+Math.floor(t.x))%palette.length]).offsetHSL(0,0,(rng()-.5)*.06));
  if(trunk){o3.rotation.set(0,0,0);o3.position.set(t.x,g+h*trunk*.5,t.z);o3.scale.set(h*.06+.6,h*trunk,h*.06+.6);o3.updateMatrix();trunks.setMatrixAt(ti++,o3.matrix);}});
 place(crowns,round,{radius:.5,lift:.6,flat:.42,palette:leaf,trunk:.45});
 place(gardens,garden,{radius:.46,lift:.62,flat:.42,palette:[...leaf,...autumn],trunk:.45});
 place(columns,tall,{radius:.17,lift:.58,flat:.5,palette:poplarLeaf,trunk:.4});
 trunks.count=ti;
 for(const m of [crowns,gardens,columns,trunks]){m.name='v2-trees';parent.add(m);}
 const total=trees.length;
 // Quality: the instance order is the priority order, so lower budgets keep the trees nearest the villages.
 function setQuality(mode){const budget=TREE_BUDGET[mode]??TREE_BUDGET.fluid,keep=t=>t.priority<=(trees[Math.min(total,budget)-1]?.priority??Infinity);
  crowns.count=round.filter(keep).length;gardens.count=garden.filter(keep).length;columns.count=tall.filter(keep).length;trunks.count=ti;
  const shadows=mode!=='very-fluid';for(const m of [crowns,gardens,columns])m.castShadow=shadows;}
 setQuality(quality.mode);
 return {meshes:[crowns,gardens,columns,trunks],setQuality,stats:{trees:total,woods:round.length,gardens:garden.length,poplars:tall.length,budget:TREE_BUDGET}};
}
