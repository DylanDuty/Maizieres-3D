import * as THREE from 'three';
import {Batch,strip} from './geometry.js';
import {insidePoly,area,bounds} from './geo.js';
import {segmentDistance,featureAtFace} from './cartography.js';

// Visible labels for the building families used by the renderer. They describe a type, never a name.
export const KIND_LABELS={house:'Maison',light:'Construction légère',hangar:'Hangar / grand abri',annex:'Dépendance',garage:'Garage',agricultural:'Bâtiment agricole',farm:'Ferme',industrial:'Bâtiment industriel',commercial:'Commerce / activité',large:'Grand bâtiment',public:'Équipement public',canopy:'Abri ouvert',silo:'Silo',greenhouse:'Serre',church:'Église'};
const clean=s=>s.replace(/\*\*|`/g,'').replace(/\s*[;:]\s*$/,'').replace(/\.$/,'').trim();
const cite=n=>`Bible ${n.bible} §${n.section}`;
const metres=v=>v.toLocaleString('fr-FR',{maximumFractionDigits:1})+' m';

// Card content: short facts first, then Bible excerpts, then provenance. Pure data → text, no DOM.
export function describe(r){
 const facts=[],quotes=[],b=r.bible||{};let sources=[r.source];
 if(r.refs?.length)facts.push(`Route ${r.refs.join(' / ')}`);
 if(b.sector)facts.push(`Secteur : ${b.sector.name} (${cite(b.sector)})`);
 if(b.listed)facts.push(`Nom présent dans le référentiel des voies (${cite(b.listed)})`);
 if(b.variant)facts.push(`Graphie de la Bible 01 : « ${clean(b.variant.quote)} » — écart avec OSM non tranché`);
 if(b.typeText)facts.push(`${clean(b.typeText)} · confiance ${clean(b.confidence)} (Bible 01 §16)`);
 for(const n of b.notes||[])quotes.push({text:clean(n.quote),cite:cite(n)});
 if(r.generic){const i=r.info;
  if(!i.knownUsage&&!i.light)facts.push(`Type estimé d’après l’empreinte : ${KIND_LABELS[i.kind]?.toLowerCase()||'bâtiment'}`);
  if(i.usage)facts.push(`Usage : ${i.usage.toLowerCase()} (IGN BD TOPO)`);
  if(i.light)facts.push('Construction légère (cadastre / IGN)');
  if(i.floors)facts.push(`${i.floors} niveau${i.floors>1?'x':''} (IGN BD TOPO)`);
  if(i.validation)facts.push(`Confiance ${i.validation.confidence} : ${i.validation.status}`);
  if(i.rnb)facts.push(`Identifiant RNB : ${i.rnb}`);
  facts.push(`Hauteur des murs : ${metres(i.wallHeight)} (${i.heightSource==='IGN BD TOPO'?'IGN BD TOPO':i.heightSource==='OSM'?'OpenStreetMap':'estimée'})`);
 }
 if(r.bible&&!r.source.startsWith('Bible'))sources.push('Bibles documentaires');
 return {eyebrow:r.kind,title:r.name,facts,quotes,source:sources.join(' · ')+(b.method?'. '+b.method:'')};
}

export function installSelection({scene,camera,canvas,catalogue,meshes,buildingInfo,invalidate,target=()=>new THREE.Vector3()}){
 const raycaster=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),ground=new THREE.Vector3(),projected=new THREE.Vector3(),right=new THREE.Vector3();
 const panel=document.querySelector('#selection'),title=document.querySelector('#selection-title'),kind=document.querySelector('#selection-kind'),facts=document.querySelector('#selection-facts'),quotes=document.querySelector('#selection-quotes'),note=document.querySelector('#selection-note');
 // Depth-tested highlight: it never paints through houses, and it is disposed at each change.
 const common={transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:false};
 const fillMaterial=new THREE.MeshBasicMaterial({...common,color:'#ffd36b',opacity:.3}),lineMaterial=new THREE.MeshBasicMaterial({...common,color:'#ffb23f',opacity:.92}),shellMaterial=new THREE.MeshBasicMaterial({...common,color:'#ffe08a',opacity:.5});
 let highlight=null,selected=null,start=null;const pointers=new Set();
 const toScreen=p=>{projected.set(...p).project(camera);return projected.z>-1&&projected.z<1?[(projected.x*.5+.5)*canvas.clientWidth,(-projected.y*.5+.5)*canvas.clientHeight]:null;};
 function clearHighlight(){if(highlight){scene.remove(highlight);highlight.traverse(o=>o.geometry?.dispose());highlight=null;}}
 function outline(group,poly,y,width){const batch=new Batch(lineMaterial);for(const ring of poly)strip(batch,[...ring,ring[0]],width,y,'#ffffff');const m=batch.mesh(group);if(m)m.receiveShadow=false;}
 function buildingShell(group,id){
  // Copy the selected building's own triangles from the shared batches, slightly inflated.
  const info=buildingInfo.get(id);if(!info)return;const b=bounds(info.poly[0]),c=[(b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2],radius=Math.max(2,Math.hypot(b.maxX-b.minX,b.maxZ-b.minZ)/2),k=1+.45/radius,out=[];
  for(const mesh of meshes){const pos=mesh.geometry.getAttribute('position');for(const r of mesh.userData.featureRanges)if(r.id===id)for(let v=r.start*3;v<r.end*3;v++)out.push(c[0]+(pos.getX(v)-c[0])*k,pos.getY(v)*1.01+.05,c[1]+(pos.getZ(v)-c[1])*k);}
  if(!out.length)return;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(out,3));const m=new THREE.Mesh(g,shellMaterial);m.renderOrder=10;group.add(m);outline(group,info.poly,.45,1.4);
 }
 function render(r){
  const d=describe(r);kind.textContent=d.eyebrow;title.textContent=d.title;note.textContent=d.source;
  facts.replaceChildren(...d.facts.map(t=>Object.assign(document.createElement('li'),{textContent:t})));facts.hidden=!d.facts.length;
  quotes.replaceChildren(...d.quotes.slice(0,3).map(q=>{const el=document.createElement('blockquote');el.textContent=`« ${q.text} »`;el.append(Object.assign(document.createElement('cite'),{textContent:q.cite}));return el;}));quotes.hidden=!d.quotes.length;
 }
 function select(r){clearHighlight();selected=r||null;panel.hidden=!r;
  canvas.dataset.selection=r?JSON.stringify({id:r.id,name:r.name,type:r.type,generic:!!r.generic,source:r.source,bible:!!r.bible}):'';
  for(const el of document.querySelectorAll('.map-label[aria-pressed]'))el.setAttribute('aria-pressed',String(!!r&&el.dataset.feature===r.id));
  if(!r){invalidate();return;}
  render(r);
  const group=new THREE.Group();group.renderOrder=10;
  // Highlight thickness follows the viewing distance so a street stays visible from the whole-commune view.
  const scale=Math.max(1,camera.position.distanceTo(target())/260);
  if(r.type==='line'){const batch=new Batch(lineMaterial);for(const line of r.lines)strip(batch,line,Math.max(4.5,r.width+2.2)*Math.min(scale,5),.4,'#ffffff');batch.mesh(group);}
  else if(r.type==='building'){for(const id of r.memberIds||[r.id])buildingShell(group,id);if(!group.children.length)for(const poly of r.polys)outline(group,poly,.45,1.4);}
  else if(r.polys){const batch=new Batch(fillMaterial);for(const poly of r.polys){batch.polygon(poly,.6,'#ffffff');outline(group,poly,.7,2.4);}batch.mesh(group);}
  else{const p=r.position,ring=[];for(let i=0;i<=40;i++)ring.push([p[0]+Math.cos(i*Math.PI/20)*24*Math.min(scale,4),p[2]+Math.sin(i*Math.PI/20)*24*Math.min(scale,4)]);const batch=new Batch(lineMaterial);strip(batch,ring,3.2*Math.min(scale,4),1,'#ffffff');batch.mesh(group);const fill=new Batch(fillMaterial);fill.polygon([ring.slice(0,-1)],.9,'#ffffff');fill.mesh(group);}
  group.traverse(o=>{if(o.isMesh){o.receiveShadow=false;o.castShadow=false;o.renderOrder=10;}});
  highlight=group;scene.add(group);invalidate();
 }
 // Screen-space road search with a tolerance that grows with the road's visible width.
 function nearestRoad(x,y){let best=null,bestD=Infinity,bestPoint=null;const p=[x,y];
  for(const r of catalogue.records)if(r.type==='line')for(const line of r.lines)for(let i=1;i<line.length;i++){const a=toScreen([line[i-1][0],.3,line[i-1][1]]),b=toScreen([line[i][0],.3,line[i][1]]);if(!a||!b)continue;const d=segmentDistance(p,a,b);if(d<bestD){bestD=d;best=r;bestPoint=line[i];}}
  if(!best)return null;right.setFromMatrixColumn(camera.matrixWorld,0);const a=toScreen([bestPoint[0],.3,bestPoint[1]]),b=toScreen([bestPoint[0]+right.x*best.width,.3,bestPoint[1]+right.z*best.width]);const widthPx=a&&b?Math.hypot(a[0]-b[0],a[1]-b[1]):0;
  return {record:best,distance:bestD,tolerance:Math.max(16,widthPx/2+8)};
 }
 function nearestPoint(x,y){let best=null,bestD=Infinity;for(const r of catalogue.records)if(r.type==='point'){const s=toScreen(r.position);if(!s)continue;const d=Math.hypot(s[0]-x,s[1]-y);if(d<bestD){bestD=d;best=r;}}return best&&{record:best,distance:bestD};}
 function pick(x,y){const time=performance.now();raycaster.setFromCamera(new THREE.Vector2(x/canvas.clientWidth*2-1,1-y/canvas.clientHeight*2),camera);
  const done=r=>{select(r);canvas.dataset.pickMs=(performance.now()-time).toFixed(2);};
  const hit=raycaster.intersectObjects(meshes,false)[0],hitId=hit?featureAtFace(hit.object.userData.featureRanges,hit.faceIndex):null;
  if(hitId&&catalogue.byId.get(hitId))return done(catalogue.byId.get(hitId));
  // Priority: a point clicked almost exactly, then a street within its widened band, then a nearby point.
  const point=nearestPoint(x,y),road=nearestRoad(x,y);
  if(point&&point.distance<(hitId?8:10))return done(point.record);
  if(road&&road.distance<(hitId?5:road.tolerance))return done(road.record);
  if(point&&point.distance<(hitId?12:24))return done(point.record);
  if(hitId&&buildingInfo.has(hitId)){const info=buildingInfo.get(hitId),b=bounds(info.poly[0]);const light=info.light&&info.kind!=='canopy';
   return done({id:hitId,type:'building',generic:true,info,name:light?KIND_LABELS.light:info.knownUsage?KIND_LABELS[info.kind]||'Bâtiment':'Bâtiment',kind:'Bâtiment sans nom connu',polys:[info.poly],position:[(b.minX+b.maxX)/2,0,(b.minZ+b.maxZ)/2],source:info.source==='IGN BD TOPO'?'Empreinte IGN BD TOPO'+(info.osmIds.length?' · sémantique OpenStreetMap':''):info.provenance==='cadastre'?'Empreinte du cadastre actuel ('+info.source+')':'Empreinte OpenStreetMap seule (absente de la BD TOPO)'});}
  if(raycaster.ray.intersectPlane(plane,ground)){const candidates=catalogue.records.filter(r=>r.type==='zone'&&r.polys.some(poly=>insidePoly([ground.x,ground.z],poly)));candidates.sort((a,b)=>area(a.polys[0][0])-area(b.polys[0][0]));if(candidates[0])return done(candidates[0]);}
  done(null);
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
 return {select,bindLabel,pick,get selected(){return selected;}};
}
