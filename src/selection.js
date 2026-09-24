import * as THREE from 'three';
import {Batch,strip} from './geometry.js';
import {insidePoly,area} from './geo.js';
import {segmentDistance,featureAtFace} from './cartography.js';

export function installSelection({scene,camera,canvas,catalogue,meshes,invalidate}){
 const raycaster=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),ground=new THREE.Vector3(),projected=new THREE.Vector3();
 const panel=document.querySelector('#selection'),title=document.querySelector('#selection-title'),kind=document.querySelector('#selection-kind'),note=document.querySelector('#selection-note');
 const highlightMaterial=new THREE.MeshBasicMaterial({color:'#f4c969',transparent:true,opacity:.38,side:THREE.DoubleSide,depthTest:false,depthWrite:false});
 let highlight=null,selected=null,start=null;const pointers=new Set();
 const toScreen=p=>{projected.set(...p).project(camera);return projected.z>-1&&projected.z<1?[(projected.x*.5+.5)*canvas.clientWidth,(-projected.y*.5+.5)*canvas.clientHeight]:null;};
 function clearHighlight(){if(highlight){scene.remove(highlight);highlight.geometry.dispose();highlight=null;}}
 function select(r){clearHighlight();selected=r||null;panel.hidden=!r;
  canvas.dataset.selection=r?JSON.stringify({id:r.id,name:r.name,type:r.type,source:r.source}):'';
  for(const el of document.querySelectorAll('.map-label[aria-pressed]'))el.setAttribute('aria-pressed',String(!!r&&el.dataset.feature===r.id));
  if(!r){invalidate();return;}
  title.textContent=r.name;kind.textContent=r.kind;note.textContent=r.type==='point'?'Repère localisé · '+r.source:r.source;
  const batch=new Batch(highlightMaterial);
  if(r.type==='line')for(const line of r.lines)strip(batch,line,Math.max(7,r.width+3),.7,'#ffffff');
  else if(r.polys)for(const poly of r.polys)batch.polygon(poly,1,'#ffffff');
  else{const p=r.position,ring=[];for(let i=0;i<=32;i++)ring.push([p[0]+Math.cos(i*Math.PI/16)*22,p[2]+Math.sin(i*Math.PI/16)*22]);strip(batch,ring,3,1,'#ffffff');}
  highlight=batch.mesh(scene);if(highlight){highlight.renderOrder=10;highlight.receiveShadow=false;}
  invalidate();
 }
 function pick(x,y){const time=performance.now();raycaster.setFromCamera(new THREE.Vector2(x/canvas.clientWidth*2-1,1-y/canvas.clientHeight*2),camera);
  // One raycast on click only; ranges identify existing batched building triangles.
  const hit=raycaster.intersectObjects(meshes,false)[0];
  if(hit){const id=featureAtFace(hit.object.userData.featureRanges,hit.faceIndex);const known=catalogue.byId.get(id);canvas.dataset.pickMs=(performance.now()-time).toFixed(2);select(known);return;}
  const p=[x,y];let nearest=null,best=Infinity;
  for(const r of catalogue.records.filter(r=>r.type==='point')){const s=toScreen(r.position);if(!s)continue;const d=Math.hypot(s[0]-x,s[1]-y);if(d<22&&d<best){best=d;nearest=r;}}
  if(nearest){select(nearest);canvas.dataset.pickMs=(performance.now()-time).toFixed(2);return;}
  for(const r of catalogue.records.filter(r=>r.type==='line'))for(const line of r.lines)for(let i=1;i<line.length;i++){const a=toScreen([line[i-1][0],.3,line[i-1][1]]),b=toScreen([line[i][0],.3,line[i][1]]);if(!a||!b)continue;const d=segmentDistance(p,a,b);if(d<10&&d<best){best=d;nearest=r;}}
  if(!nearest&&raycaster.ray.intersectPlane(plane,ground)){
   const candidates=catalogue.records.filter(r=>r.type==='zone'&&r.polys.some(poly=>insidePoly([ground.x,ground.z],poly)));
   candidates.sort((a,b)=>area(a.polys[0][0])-area(b.polys[0][0]));nearest=candidates[0];
  }
  select(nearest);canvas.dataset.pickMs=(performance.now()-time).toFixed(2);
 }
 canvas.addEventListener('pointerdown',e=>{pointers.add(e.pointerId);if(pointers.size>1){start=null;return;}if(e.button===0)start={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};});
 canvas.addEventListener('pointermove',e=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>6)start.moved=true;});
 canvas.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);if(!start||e.pointerId!==start.id)return;const click=!start.moved&&e.button===0;start=null;if(click){const rect=canvas.getBoundingClientRect();pick(e.clientX-rect.left,e.clientY-rect.top);}});
 canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);start=null;});
 canvas.addEventListener('wheel',()=>{start=null;},{passive:true});
 document.querySelector('#selection-close').addEventListener('click',()=>{select(null);canvas.focus({preventScroll:true});});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')select(null);});
 function bindLabel(el,item){let r=catalogue.byId.get(item.id);if(!r){const candidates=catalogue.records.filter(r=>r.name===item.name);r=candidates.sort((a,b)=>Math.hypot(a.position[0]-item.position[0],a.position[2]-item.position[2])-Math.hypot(b.position[0]-item.position[0],b.position[2]-item.position[2]))[0];}if(!r)return;
  el.dataset.feature=r.id;el.setAttribute('aria-label','Afficher '+r.name);el.setAttribute('aria-pressed','false');el.addEventListener('click',()=>select(r));
 }
 return {select,bindLabel,get selected(){return selected;}};
}
