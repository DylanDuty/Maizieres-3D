import * as THREE from 'three';
import {Batch,strip} from './geometry.js';
import {insidePoly,area,bounds} from './geo.js';
import {segmentDistance,featureAtFace} from './cartography.js';
import {architectureFacts} from './architecture.js';

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
  // V2.2: buildings surveyed by hand on the orthophoto say so, with their observed category (never a sourced usage).
  if(i.manual)facts.push(`Relevé manuel sur orthophoto IGN 2025 (V2.2, non officiel) : ${i.manual.category}`,`Précision : ${i.manual.uncertainty}`);
  else if(!i.knownUsage&&!i.light)facts.push(`Type estimé d’après l’empreinte : ${KIND_LABELS[i.kind]?.toLowerCase()||'bâtiment'}`);
  if(i.usage)facts.push(`Usage : ${i.usage.toLowerCase()} (IGN BD TOPO)`);
  if(i.light)facts.push('Construction légère (cadastre / IGN)');
  if(i.floors)facts.push(`${i.floors} niveau${i.floors>1?'x':''} (IGN BD TOPO)`);
  if(i.validation)facts.push(`Confiance ${i.validation.confidence} : ${i.validation.status}`);
  if(i.rnb)facts.push(`Identifiant RNB : ${i.rnb}`);
  if(i.architecture)facts.push(...architectureFacts(i.architecture));
  else facts.push(`Hauteur des murs : ${metres(i.wallHeight)} (${i.heightSource==='IGN BD TOPO'?'IGN BD TOPO':i.heightSource==='OSM'?'OpenStreetMap':'estimée'})`);
 }
 for(const f of r.facts||[])facts.push(f);
 if(r.bible&&!r.source.startsWith('Bible'))sources.push('Bibles documentaires');
 return {eyebrow:r.kind,title:r.name,facts,quotes,source:sources.join(' · ')+(b.method?'. '+b.method:'')};
}

// V2.0: heightAt / ground place picking and highlights on the real relief; technical=false hides the source line (visitor view).
// V2.6.1: two-level card. A click shows a small frosted label floating next to the object (the map stays the subject);
// the full card opens only on « Détails », as a narrow side panel (desktop) or a bottom sheet (phone).
export function installSelection({scene,camera,canvas,catalogue,meshes,buildingInfo,invalidate,target=()=>new THREE.Vector3(),heightAt=null,ground=null,technical=true}){
 const raycaster=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),groundPoint=new THREE.Vector3(),projected=new THREE.Vector3(),right=new THREE.Vector3();
 const panel=document.querySelector('#selection'),title=document.querySelector('#selection-title'),kind=document.querySelector('#selection-kind'),facts=document.querySelector('#selection-facts'),quotes=document.querySelector('#selection-quotes'),note=document.querySelector('#selection-note');
 // Quick label and its pointer, created here so index.html stays a plain skeleton.
 const quick=document.createElement('div');quick.id='quick';quick.hidden=true;quick.setAttribute('role','status');
 quick.innerHTML='<p id="quick-kind"></p><p id="quick-title"></p><div class="quick-actions"><button type="button" id="quick-details" aria-expanded="false" aria-controls="selection">Détails</button><button type="button" id="quick-close" aria-label="Fermer la sélection">×</button></div>';
 const link=document.createElementNS('http://www.w3.org/2000/svg','svg');link.id='quick-link';link.setAttribute('aria-hidden','true');link.hidden=true;link.innerHTML='<line x1="0" y1="0" x2="0" y2="0"/><circle cx="0" cy="0" r="3.5"/>';
 document.body.append(link,quick);
 const quickKind=quick.querySelector('#quick-kind'),quickTitle=quick.querySelector('#quick-title'),detailsButton=quick.querySelector('#quick-details'),linkLine=link.querySelector('line'),linkDot=link.querySelector('circle');
 const phone=matchMedia('(max-width:850px)');
 // Soft, cartoon-friendly highlight: a warm translucent shell on buildings, a pale bright ribbon on roads, a thin cream outline.
 const common={transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:false};
 const fillMaterial=new THREE.MeshBasicMaterial({...common,color:'#fff0bf',opacity:.28}),lineMaterial=new THREE.MeshBasicMaterial({...common,color:'#ffdc92',opacity:.72}),shellMaterial=new THREE.MeshBasicMaterial({...common,color:'#fff3cc',opacity:.34});
 let highlight=null,selected=null,anchor=null,start=null;const pointers=new Set();
 const toScreen=p=>{projected.set(...p).project(camera);return projected.z>-1&&projected.z<1?[(projected.x*.5+.5)*canvas.clientWidth,(-projected.y*.5+.5)*canvas.clientHeight]:null;};
 const lift=(x,z)=>heightAt?heightAt(x,z):0;
 // On the relief, flat highlight geometry is densified then lifted onto the displayed terrain.
 const densify=(pts,max=8)=>{if(!heightAt)return pts;const out=[pts[0]];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],k=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/max);for(let j=1;j<=k;j++)out.push([a[0]+(b[0]-a[0])*j/k,a[1]+(b[1]-a[1])*j/k]);}return out;};
 function drape(object){if(!heightAt)return;object.traverse(o=>{if(!o.isMesh||o.userData.noDrape)return;const p=o.geometry.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+heightAt(p.getX(i),p.getZ(i)));p.needsUpdate=true;o.geometry.computeBoundingSphere();});}
 function clearHighlight(){if(highlight){scene.remove(highlight);highlight.traverse(o=>o.geometry?.dispose());highlight=null;}}
 function outline(group,poly,y,width){const batch=new Batch(lineMaterial);for(const ring of poly)strip(batch,densify([...ring,ring[0]]),width,y,'#ffffff');const m=batch.mesh(group);if(m)m.receiveShadow=false;}
 function buildingShell(group,id){
  // Copy the selected building's own triangles from the shared batches, slightly inflated.
  const info=buildingInfo.get(id);if(!info)return;const b=bounds(info.poly[0]),c=[(b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2],radius=Math.max(2,Math.hypot(b.maxX-b.minX,b.maxZ-b.minZ)/2),k=1+.4/radius,out=[];
  for(const mesh of meshes){const pos=mesh.geometry.getAttribute('position');for(const r of mesh.userData.featureRanges)if(r.id===id)for(let v=r.start*3;v<r.end*3;v++)out.push(c[0]+(pos.getX(v)-c[0])*k,pos.getY(v)*1.01+.05,c[1]+(pos.getZ(v)-c[1])*k);}
  if(!out.length)return;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(out,3));const m=new THREE.Mesh(g,shellMaterial);m.renderOrder=10;m.userData.noDrape=true;group.add(m);outline(group,info.poly,.45,1.1);
 }
 function render(r){
  const d=describe(r);
  // V2.3: named buildings (landmarks, POI) also show their architectural profile in the preview modes.
  if(r.type==='building'&&!r.generic){const e=buildingInfo.get(r.id)?.architecture;if(e)d.facts.push(...architectureFacts(e));}kind.textContent=d.eyebrow;title.textContent=d.title;note.textContent=d.source;note.hidden=!technical;
  // V2.4: the architectural profile is a titled group on the card; unknown values stay written as unknown.
  const out=[];for(const t of d.facts){if(/^Profil architectural/.test(t)){out.push(Object.assign(document.createElement('li'),{textContent:'Architecture (profil V2.3.1)',className:'sub'}));out.push(Object.assign(document.createElement('li'),{textContent:t.replace(/^Profil architectural V2\.3 : /,''),className:'arch'}));}else out.push(Object.assign(document.createElement('li'),{textContent:t,className:/^(Toiture|Couleur de toit|Hauteur à l’égout|Niveaux|Note|Sources) ?:/.test(t)?'arch':''}));}
  facts.replaceChildren(...out);facts.hidden=!d.facts.length;
  quotes.replaceChildren(...d.quotes.slice(0,3).map(q=>{const el=document.createElement('blockquote');el.textContent=`« ${q.text} »`;el.append(Object.assign(document.createElement('cite'),{textContent:q.cite}));return el;}));quotes.hidden=!d.quotes.length;
  // Quick label: the name, and a short category (a building without a name shows its family only once).
  quickTitle.textContent=d.title;quickKind.textContent=r.generic?'Bâtiment':d.eyebrow;quickKind.hidden=!quickKind.textContent||quickKind.textContent===d.title;
 }
 // Default anchor of the label: where the object is, a little above it, on the displayed relief.
 function anchorOf(r){const p=r.position||[0,0,0];
  if(r.type==='building'){const info=buildingInfo.get(r.id);const h=info?.wallHeight||6;return [p[0],lift(p[0],p[2])+h+1.5,p[2]];}
  if(r.type==='line'){const line=r.lines?.[0]||[];const q=line[Math.floor(line.length/2)]||[p[0],p[2]];return [q[0],lift(q[0],q[1])+1.2,q[1]];}
  return [p[0],lift(p[0],p[2])+(r.type==='point'?4:1.5),p[2]];}
 // Places the quick label next to the anchor, pushed away from the screen centre so it never sits on the object,
 // clamped inside the viewport; a thin pointer joins it to the anchor. On a phone the label is a compact bottom bar.
 function place(){if(quick.hidden||!anchor)return;const s=toScreen(anchor);
  if(!s){quick.style.visibility='hidden';link.hidden=true;return;}quick.style.visibility='';link.hidden=false;
  linkDot.setAttribute('cx',s[0]);linkDot.setAttribute('cy',s[1]);
  if(phone.matches){quick.style.left='';quick.style.top='';linkLine.setAttribute('x1',s[0]);linkLine.setAttribute('y1',s[1]);linkLine.setAttribute('x2',s[0]);linkLine.setAttribute('y2',s[1]);return;}
  const W=canvas.clientWidth,H=canvas.clientHeight,w=quick.offsetWidth,h=quick.offsetHeight;
  let dx=s[0]-W/2,dy=s[1]-H/2;const L=Math.hypot(dx,dy);if(L<60){dx=.72;dy=-.69;}else{dx/=L;dy/=L;}
  const D=58,cx=s[0]+dx*(D+w/2),cy=s[1]+dy*(D+h/2);
  const x=Math.min(Math.max(14,cx-w/2),W-w-14),y=Math.min(Math.max(96,cy-h/2),H-h-56);
  quick.style.left=x+'px';quick.style.top=y+'px';
  const px=Math.min(Math.max(s[0],x),x+w),py=Math.min(Math.max(s[1],y),y+h);
  linkLine.setAttribute('x1',s[0]);linkLine.setAttribute('y1',s[1]);linkLine.setAttribute('x2',px);linkLine.setAttribute('y2',py);
 }
 function openDetails(){if(!selected)return;panel.hidden=false;detailsButton.setAttribute('aria-expanded','true');quick.classList.add('with-details');if(phone.matches)quick.hidden=true;canvas.dataset.details='1';}
 function closeDetails(){panel.hidden=true;detailsButton.setAttribute('aria-expanded','false');quick.classList.remove('with-details');if(selected){quick.hidden=false;place();}canvas.dataset.details='';}
 function select(r,at=null){clearHighlight();selected=r||null;anchor=r?(at||anchorOf(r)):null;panel.hidden=true;detailsButton.setAttribute('aria-expanded','false');quick.classList.remove('with-details');canvas.dataset.details='';
  canvas.dataset.selection=r?JSON.stringify({id:r.id,name:r.name,type:r.type,generic:!!r.generic,source:r.source,bible:!!r.bible}):'';
  for(const el of document.querySelectorAll('.map-label[aria-pressed]'))el.setAttribute('aria-pressed',String(!!r&&el.dataset.feature===r.id));
  quick.hidden=!r;link.hidden=!r;
  if(!r){invalidate();return;}
  render(r);quick.style.animation='none';void quick.offsetWidth;quick.style.animation='';place();
  const group=new THREE.Group();group.renderOrder=10;
  // Highlight thickness follows the viewing distance so a street stays visible from the whole-commune view.
  const scale=Math.max(1,camera.position.distanceTo(target())/260);
  if(r.type==='line'){const batch=new Batch(lineMaterial);for(const line of r.lines)strip(batch,densify(line),Math.max(3.6,r.width+1.4)*Math.min(scale,5),.4,'#ffffff');batch.mesh(group);}
  else if(r.type==='building'){for(const id of r.memberIds||[r.id])buildingShell(group,id);if(!group.children.length)for(const poly of r.polys)outline(group,poly,.45,1.1);}
  else if(r.polys){const batch=new Batch(fillMaterial);for(const poly of r.polys){if(!heightAt)batch.polygon(poly,.6,'#ffffff');outline(group,poly,.7,heightAt?2.6:2);}batch.mesh(group);}
  else{const p=r.position,lift0=heightAt?-heightAt(p[0],p[2]):0,ring=[];for(let i=0;i<=40;i++)ring.push([p[0]+Math.cos(i*Math.PI/20)*22*Math.min(scale,4),p[2]+Math.sin(i*Math.PI/20)*22*Math.min(scale,4)]);const batch=new Batch(lineMaterial);strip(batch,ring,2.4*Math.min(scale,4),1+(heightAt?heightAt(p[0],p[2])+lift0+.6:0),'#ffffff');batch.mesh(group);const fill=new Batch(fillMaterial);fill.polygon([ring.slice(0,-1)],.9+(heightAt?.6:0),'#ffffff');fill.mesh(group);}
  drape(group);
  group.traverse(o=>{if(o.isMesh){o.receiveShadow=false;o.castShadow=false;o.renderOrder=10;}});
  highlight=group;scene.add(group);invalidate();
 }
 // Screen-space road search with a tolerance that grows with the road's visible width.
 function nearestRoad(x,y){let best=null,bestD=Infinity,bestPoint=null;const p=[x,y];
  for(const r of catalogue.records)if(r.type==='line')for(const line of r.lines)for(let i=1;i<line.length;i++){const ya=lift(line[i-1][0],line[i-1][1])+.3,yb=lift(line[i][0],line[i][1])+.3,a=toScreen([line[i-1][0],ya,line[i-1][1]]),b=toScreen([line[i][0],yb,line[i][1]]);if(!a||!b)continue;const d=segmentDistance(p,a,b);if(d<bestD){bestD=d;best=r;bestPoint=line[i];}}
  if(!best)return null;right.setFromMatrixColumn(camera.matrixWorld,0);const yp=lift(bestPoint[0],bestPoint[1])+.3,a=toScreen([bestPoint[0],yp,bestPoint[1]]),b=toScreen([bestPoint[0]+right.x*best.width,yp,bestPoint[1]+right.z*best.width]);const widthPx=a&&b?Math.hypot(a[0]-b[0],a[1]-b[1]):0;
  return {record:best,distance:bestD,tolerance:Math.max(16,widthPx/2+8),at:[bestPoint[0],yp+.9,bestPoint[1]]};
 }
 function nearestPoint(x,y){let best=null,bestD=Infinity;for(const r of catalogue.records)if(r.type==='point'){const s=toScreen(r.position);if(!s)continue;const d=Math.hypot(s[0]-x,s[1]-y);if(d<bestD){bestD=d;best=r;}}return best&&{record:best,distance:bestD};}
 function pick(x,y){const time=performance.now();raycaster.setFromCamera(new THREE.Vector2(x/canvas.clientWidth*2-1,1-y/canvas.clientHeight*2),camera);
  const done=(r,at=null)=>{select(r,at);canvas.dataset.pickMs=(performance.now()-time).toFixed(2);};
  const hit=raycaster.intersectObjects(meshes,false)[0],hitId=hit?featureAtFace(hit.object.userData.featureRanges,hit.faceIndex):null,hitAt=hit?[hit.point.x,hit.point.y+.6,hit.point.z]:null;
  if(hitId&&catalogue.byId.get(hitId))return done(catalogue.byId.get(hitId),hitAt);
  // Priority: a point clicked almost exactly, then a street within its widened band, then a nearby point.
  const point=nearestPoint(x,y),road=nearestRoad(x,y);
  if(point&&point.distance<(hitId?8:10))return done(point.record);
  if(road&&road.distance<(hitId?5:road.tolerance))return done(road.record,road.at);
  if(point&&point.distance<(hitId?12:24))return done(point.record);
  if(hitId&&buildingInfo.has(hitId)){const info=buildingInfo.get(hitId),b=bounds(info.poly[0]);const light=info.light&&info.kind!=='canopy';
   return done({id:hitId,type:'building',generic:true,info,name:light?KIND_LABELS.light:info.knownUsage?KIND_LABELS[info.kind]||'Bâtiment':'Bâtiment',kind:'Bâtiment sans nom connu',polys:[info.poly],position:[(b.minX+b.maxX)/2,0,(b.minZ+b.maxZ)/2],source:info.source==='IGN BD TOPO'?'Empreinte IGN BD TOPO'+(info.osmIds.length?' · sémantique OpenStreetMap':''):info.provenance==='cadastre'?'Empreinte du cadastre actuel ('+info.source+')':'Empreinte OpenStreetMap seule (absente de la BD TOPO)'},hitAt);}
  const hitGround=ground?(typeof ground==='function'?ground(raycaster.ray):raycaster.intersectObject(ground,false)[0]?.point):null;
  if(hitGround?groundPoint.copy(hitGround):raycaster.ray.intersectPlane(plane,groundPoint)){const candidates=catalogue.records.filter(r=>r.type==='zone'&&r.polys.some(poly=>insidePoly([groundPoint.x,groundPoint.z],poly)));candidates.sort((a,b)=>area(a.polys[0][0])-area(b.polys[0][0]));
   // A click in the open closes an existing selection; from nothing, it names the place (lieu-dit, zone).
   if(candidates[0]&&(!selected||selected===candidates[0]))return done(candidates[0],[groundPoint.x,groundPoint.y+1.5,groundPoint.z]);}
  done(null);
 }
 canvas.addEventListener('pointerdown',e=>{pointers.add(e.pointerId);if(pointers.size>1){start=null;return;}if(e.button===0)start={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};});
 canvas.addEventListener('pointermove',e=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>6)start.moved=true;});
 canvas.addEventListener('pointerup',e=>{pointers.delete(e.pointerId);if(!start||e.pointerId!==start.id)return;const click=!start.moved&&e.button===0;start=null;if(click){const rect=canvas.getBoundingClientRect();pick(e.clientX-rect.left,e.clientY-rect.top);}});
 canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);start=null;});
 canvas.addEventListener('wheel',()=>{start=null;},{passive:true});
 document.querySelector('#selection-close').addEventListener('click',()=>{closeDetails();canvas.focus({preventScroll:true});});
 quick.querySelector('#quick-close').addEventListener('click',()=>{select(null);canvas.focus({preventScroll:true});});
 detailsButton.addEventListener('click',()=>{panel.hidden?openDetails():closeDetails();});
 document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(!panel.hidden)closeDetails();else select(null);});
 addEventListener('resize',place);phone.addEventListener?.('change',place);
 function bindLabel(el,item){let r=catalogue.byId.get(item.id);if(!r){const candidates=catalogue.records.filter(r=>r.name===item.name);r=candidates.sort((a,b)=>Math.hypot(a.position[0]-item.position[0],a.position[2]-item.position[2])-Math.hypot(b.position[0]-item.position[0],b.position[2]-item.position[2]))[0];}if(!r)return;
  el.dataset.feature=r.id;el.setAttribute('aria-label','Afficher '+r.name);el.setAttribute('aria-pressed','false');el.addEventListener('click',()=>select(r));
 }
 return {select,bindLabel,pick,openDetails,closeDetails,tick:place,get selected(){return selected;},get detailsOpen(){return !panel.hidden;}};
}
