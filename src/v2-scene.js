import * as THREE from 'three';
import {Batch} from './geometry.js';

// V2.0 normal view: the frozen references assembled on the real relief (presentation only).
// - terrain V1.7 (10 m working grid) textured with the land cover V1.10 (parcels, woods, hedges, water, surfaces) drawn in a canvas;
// - roads V1.8 and rail V1.9 as ribbons following their own profiles (bridges stay above the ground);
// - hedges as low walls, level crossings, landmarks and click records from the POI V1.11 / V1.11.1.
// Nothing here changes a geometry: colours, widths and lifts are display choices only.
export const V2_COLORS={
 base:'#dde3c3',village:'#dcdfc2',
 terre_arable:'#eadba0',prairie_permanente:'#a8cb7a',prairie_temporaire:'#c4da8c',jachere:'#d3c68f',culture_permanente:'#cfa9a0',autre_surface_agricole:'#dcd6bb',parcelEdge:'#b8a877',
 peupleraie:'#93bb6c',foret_fermee_feuillus:'#5d8e4d',foret_ouverte:'#86ad68',bois:'#6d9a56',lande_ligneuse:'#a6b577',hedge:'#6a9a50',hedgeSide:'#7aa65e',
 water:'#7fb9d5',waterLine:'#5ea6cb',waterIntermittent:'#9ac6da',
 parking:'#c3c1b9',sport:'#9dc67f',cimetiere:'#bcc6a2',reservoir:'#9cc0d0',pv:'#a3afbd',activity:'#e3d9c3',activityEdge:'#a99570',pvStripe:'#6b7888',skirt:'#b9b298',rail_land:'#c8beaf',
 route_principale:'#7d8187',route_secondaire:'#8f9398',voie_locale:'#a4a7ab',voie_de_desserte:'#b5b6b6',voie_pietonne:'#cfc9bb',chemin_carrossable:'#cdbd97',chemin_rural:'#b89e74',sentier:'#d9c9a3',roadEdge:'#ece6d3',
 ballast:'#9a8f82',track:'#4f4a45',level:'#d83b2d',bridge:'#8c8f94',apron:'#d2d8bf'};
export const ROAD_LABELS={route_principale:'Route principale',route_secondaire:'Route secondaire',voie_locale:'Rue locale',voie_de_desserte:'Desserte',voie_pietonne:'Voie piétonne',chemin_carrossable:'Chemin empierré',chemin_rural:'Chemin de terre',sentier:'Sentier'};
const PAVED=new Set(['route_principale','route_secondaire','voie_locale','voie_de_desserte']);
export const LANDUSE_LABELS={terre_arable:'Terre arable',prairie_permanente:'Prairie permanente',prairie_temporaire:'Prairie temporaire',jachere:'Jachère',culture_permanente:'Culture permanente',autre_surface_agricole:'Autre surface agricole',
 peupleraie:'Peupleraie',foret_fermee_feuillus:'Forêt fermée de feuillus',foret_ouverte:'Forêt ouverte',bois:'Petit bois',lande_ligneuse:'Lande ligneuse'};
export const TEXTURE_SIZE={'very-fluid':2048,fluid:3072,high:4096};

import {waterProximity,HEDGE_WATER_MARGIN} from './hydro-display.js';
export async function buildV2Scene(scene,{relief,base,quality}){
 const [d,poi]=await Promise.all([fetch(`${base}data/v2-scene.json`).then(r=>r.json()),fetch(`${base}data/poi.json`).then(r=>r.json())]);
 const {meta}=relief,{cols,rows,step,x0,z0}=meta,W=(cols-1)*step,D=(rows-1)*step;
 let minY=Infinity;for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const v=relief.alt(c,r);if(v===v)minY=Math.min(minY,v-meta.yReference);}
 const edgeY=minY-2;
 // Height of the displayed terrain (bilinear on the working grid) in scene units.
 const onGrid=(x,z)=>x>=x0+1&&x<=x0+W-1&&z>=z0+1&&z<=z0+D-1;
 const heightAt=(x,z)=>{const v=relief.sample(x,z);return v===v?v-meta.yReference:edgeY;};
 const group=new THREE.Group();group.name='v2-scene';scene.add(group);

 // ---------- Terrain with the draped land-cover texture ----------
 const pos=new Float32Array(cols*rows*3),uv=new Float32Array(cols*rows*2);
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const k=r*cols+c,v=relief.alt(c,r);pos[k*3]=x0+c*step;pos[k*3+1]=v===v?v-meta.yReference:edgeY;pos[k*3+2]=z0+r*step;uv[k*2]=c/(cols-1);uv[k*2+1]=r/(rows-1);}
 const index=new Uint32Array((cols-1)*(rows-1)*6);let n=0;for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){const a=r*cols+c,b=a+1,e=a+cols,f=e+1;index.set([a,e,b,b,e,f],n);n+=6;}
 const terrainGeo=new THREE.BufferGeometry();terrainGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));terrainGeo.setAttribute('uv',new THREE.BufferAttribute(uv,2));terrainGeo.setIndex(new THREE.BufferAttribute(index,1));terrainGeo.computeVertexNormals();
 const canvas=document.createElement('canvas'),texture=new THREE.CanvasTexture(canvas);texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
 const terrainMat=new THREE.MeshLambertMaterial({map:texture});
 const terrainMesh=new THREE.Mesh(terrainGeo,terrainMat);terrainMesh.name='v2-terrain';terrainMesh.receiveShadow=true;group.add(terrainMesh);
 // Skirt around the grid down to a hazy apron, so the extent reads as a clean block instead of a floating sheet.
 const skirt=new Batch(new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
 const border=[];for(let c=0;c<cols;c++)border.push([c,0]);for(let r=1;r<rows;r++)border.push([cols-1,r]);for(let c=cols-2;c>=0;c--)border.push([c,rows-1]);for(let r=rows-2;r>=0;r--)border.push([0,r]);
 for(let i=1;i<border.length;i++){const [c1,r1]=border[i-1],[c2,r2]=border[i],a=[x0+c1*step,pos[(r1*cols+c1)*3+1],z0+r1*step],b=[x0+c2*step,pos[(r2*cols+c2)*3+1],z0+r2*step];skirt.quad([a[0],edgeY-1,a[2]],[b[0],edgeY-1,b[2]],b,a,V2_COLORS.skirt);}
 skirt.mesh(group,false);
 const apron=new THREE.Mesh(new THREE.PlaneGeometry(60000,60000).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial({color:V2_COLORS.apron}));apron.position.set(x0+W/2,edgeY-1.2,z0+D/2);apron.name='v2-apron';group.add(apron);

 function drawTexture(size){
  const w=size,h=Math.round(size*D/W);canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');const sx=w/W,sz=h/D;
  const X=x=>(x-x0)*sx,Z=z=>(z-z0)*sz;
  const path=rings=>{ctx.beginPath();for(const r of rings){for(let i=0;i<r.length;i+=2)i?ctx.lineTo(X(r[i]),Z(r[i+1])):ctx.moveTo(X(r[i]),Z(r[i+1]));ctx.closePath();}};
  const fill=(o,color,alpha=1)=>{ctx.globalAlpha=alpha;ctx.fillStyle=color;for(const p of o.r){path(p);ctx.fill('evenodd');}ctx.globalAlpha=1;};
  const outline=(o,color,widthM,alpha=1)=>{ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=Math.max(.8,widthM*sx);for(const p of o.r){path(p);ctx.stroke();}ctx.globalAlpha=1;};
  const line=(p,color,widthM,dash)=>{ctx.strokeStyle=color;ctx.lineWidth=Math.max(.8,widthM*sx);ctx.setLineDash(dash?dash.map(v=>v*sx):[]);ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();for(let i=0;i<p.length;i+=2)i?ctx.lineTo(X(p[i]),Z(p[i+1])):ctx.moveTo(X(p[i]),Z(p[i+1]));ctx.stroke();ctx.setLineDash([]);};
  const line3=(p,color,widthM)=>{ctx.strokeStyle=color;ctx.lineWidth=Math.max(.8,widthM*sx);ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();for(let i=0;i<p.length;i+=3)i?ctx.lineTo(X(p[i]),Z(p[i+1])):ctx.moveTo(X(p[i]),Z(p[i+1]));ctx.stroke();};
  ctx.fillStyle=V2_COLORS.base;ctx.fillRect(0,0,w,h);
  for(const v of d.village)fill(v,V2_COLORS.village);
  // Functional perimeters first (they also contain fields), very light; then parcels, surfaces, woods, water.
  for(const a of d.artificial.filter(a=>a.kind==='perimetre'&&a.t!=='parc_eolien_perimetre'&&a.t!=='centrale_photovoltaique'))fill(a,V2_COLORS.activity,.8);
  for(const a of d.agriculture)fill(a,V2_COLORS[a.t]||V2_COLORS.autre_surface_agricole);
  for(const a of d.agriculture)outline(a,V2_COLORS.parcelEdge,.9,.8);
  // Photovoltaic parks: light blue-grey with panel rows (pattern), not a dark slab.
  const tile=document.createElement('canvas');tile.width=tile.height=8;const tc=tile.getContext('2d');tc.fillStyle=V2_COLORS.pv;tc.fillRect(0,0,8,8);tc.fillStyle=V2_COLORS.pvStripe;tc.fillRect(0,0,8,Math.max(2,Math.round(2.5*sz)));
  for(const a of d.artificial.filter(a=>a.t==='centrale_photovoltaique')){ctx.fillStyle=ctx.createPattern(tile,'repeat');for(const p of a.r){path(p);ctx.fill('evenodd');}}
  for(const a of d.artificial.filter(a=>a.kind==='surface'))fill(a,a.t==='parking'?V2_COLORS.parking:a.t==='terrain_de_sport'?V2_COLORS.sport:a.t==='cimetiere'?V2_COLORS.cimetiere:a.t==='reservoir'?V2_COLORS.reservoir:V2_COLORS.rail_land);
  for(const a of d.artificial.filter(a=>a.kind==='perimetre'&&['zone_industrielle','zone_commerciale','centrale_photovoltaique','enceinte_militaire'].includes(a.t)))outline(a,V2_COLORS.activityEdge,2,.7);
  for(const a of d.woodland)fill(a,V2_COLORS[a.t]||V2_COLORS.bois);
  for(const a of d.woodland)outline(a,'#4c7a3f',1.2,.5);
  for(const a of d.hedgePolygons)fill(a,V2_COLORS.hedge);
  for(const hd of d.hedges)line3(hd.p,V2_COLORS.hedge,hd.w||2.5);
  // V2.1: water last, so that riparian hedges (DSB bands up to 98 m wide) never paint over a watercourse.
  for(const a of d.water)fill(a,V2_COLORS.water);
  for(const l of d.waterLines)line(l.p,l.perm?V2_COLORS.waterLine:V2_COLORS.waterIntermittent,l.w,l.perm?null:[6,4]);
  texture.needsUpdate=true;return {width:w,height:h,metresPerPixel:+(W/w).toFixed(2)};
 }
 let textureInfo=drawTexture(TEXTURE_SIZE[quality.mode]||3072);

 // ---------- Ribbons draped on the terrain (roads, rail) ----------
 // Each edge vertex takes the higher of the source profile and the displayed terrain, plus a small lift; bridges keep their profile.
 function ribbon(batch,p,width,lift,color,{bridge=false,maxStep=8}={}){
  const pts=[];for(let i=0;i<p.length;i+=3){const q=[p[i],p[i+1],p[i+2]];if(pts.length){const a=pts.at(-1),len=Math.hypot(q[0]-a[0],q[1]-a[1]),k=Math.ceil(len/maxStep);for(let j=1;j<k;j++)pts.push([a[0]+(q[0]-a[0])*j/k,a[1]+(q[1]-a[1])*j/k,a[2]+(q[2]-a[2])*j/k]);}pts.push(q);}
  // Only the parts over the displayed terrain are drawn (the V1.8 / V1.9 layers reach the corners of the extent).
  const runs=[];let run=[];for(const q of pts){if(onGrid(q[0],q[1]))run.push(q);else{if(run.length>1)runs.push(run);run=[];}}if(run.length>1)runs.push(run);
  if(runs.length!==1||runs[0].length!==pts.length){let n=0;for(const r of runs)n+=ribbonRun(batch,r,width,lift,color,bridge);return n;}
  return ribbonRun(batch,pts,width,lift,color,bridge);
 }
 function ribbonRun(batch,pts,width,lift,color,bridge){
  const edges=pts.map((q,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];let dx=b[0]-a[0],dz=b[1]-a[1];const L=Math.hypot(dx,dz)||1;dx/=L;dz/=L;
   return [-1,1].map(s=>{const x=q[0]-dz*s*width/2,z=q[1]+dx*s*width/2;return [x,(bridge?q[2]:Math.max(q[2],heightAt(x,z),heightAt(q[0],q[1])))+lift,z];});});
  for(let i=1;i<edges.length;i++)batch.quad(edges[i-1][0],edges[i-1][1],edges[i][1],edges[i][0],color);return pts.length;
 }
 const roadBatch=new Batch(new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}));
 const roadStats={};let roadKm=0;
 const order=['sentier','chemin_rural','chemin_carrossable','voie_pietonne','voie_de_desserte','voie_locale','route_secondaire','route_principale'];
 for(const cat of order)for(const r of d.roads.filter(r=>r.c===cat)){const paved=PAVED.has(cat),w=Math.max(paved?3:1.2,r.w||3),lift=.25+order.indexOf(cat)*.012;
  if(paved)ribbon(roadBatch,r.p,w+1.4,lift,V2_COLORS.roadEdge,{bridge:!!r.b});
  ribbon(roadBatch,r.p,w,lift+.03,V2_COLORS[cat]||'#999',{bridge:!!r.b});
  let L=0;for(let i=3;i<r.p.length;i+=3)L+=Math.hypot(r.p[i]-r.p[i-3],r.p[i+1]-r.p[i-2]);roadKm+=L/1000;roadStats[cat]=(roadStats[cat]||0)+L/1000;}
 const roadMesh=roadBatch.mesh(group,false);if(roadMesh){roadMesh.name='v2-roads';roadMesh.receiveShadow=true;}
 const railBatch=new Batch(new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}));let railKm=0;
 for(const t of d.rail){ribbon(railBatch,t.p,t.k==='principal'?4.2:3.4,.42,V2_COLORS.ballast);ribbon(railBatch,t.p,1.7,.48,V2_COLORS.track);for(let i=3;i<t.p.length;i+=3)railKm+=Math.hypot(t.p[i]-t.p[i-3],t.p[i+1]-t.p[i-2])/1000;}
 for(const b of d.railBridges){const p=[b.a[0],b.a[1],b.y+.2,b.b[0],b.b[1],b.y+.2];ribbon(railBatch,p,9,-.35,V2_COLORS.bridge,{bridge:true});}
 const railMesh=railBatch.mesh(group,false);if(railMesh)railMesh.name='v2-rail';
 const pnGeo=new THREE.CylinderGeometry(1.1,1.1,5,10),pn=new THREE.InstancedMesh(pnGeo,new THREE.MeshLambertMaterial({color:V2_COLORS.level}),d.levelCrossings.length),m=new THREE.Matrix4();
 d.levelCrossings.forEach((l,i)=>{m.makeTranslation(l.p[0],Math.max(l.p[2],heightAt(l.p[0],l.p[1]))+2.5,l.p[1]);pn.setMatrixAt(i,m);});pn.name='v2-level-crossings';group.add(pn);

 // ---------- Hedges: low walls (skipped in "very fluid"; the texture keeps them) ----------
 const hedgeBatch=new Batch(new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}));let hedgeKm=0;
 // V2.1: no 3D hedge wall over a watercourse or a water surface (see hydro-display.js).
 const nearWater=waterProximity(d.waterLines,d.water),hedgeCuts=[];let hedgeCut=0;
 for(const h of d.hedges){const p=h.p,H=Math.min(5,h.h||2.2),w=Math.min(6,h.w||2.4);
  const pts=[];for(let i=0;i<p.length;i+=3){const q=[p[i],p[i+1]];if(pts.length){const a=pts.at(-1),len=Math.hypot(q[0]-a[0],q[1]-a[1]),k=Math.ceil(len/10);for(let j=1;j<k;j++)pts.push([a[0]+(q[0]-a[0])*j/k,a[1]+(q[1]-a[1])*j/k]);hedgeKm+=len/1000;}pts.push(q);}
  const on=pts.filter(q=>onGrid(q[0],q[1]));if(on.length<pts.length){pts.length=0;pts.push(...on);}if(pts.length<2)continue;
  const edges=pts.map((q,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];let dx=b[0]-a[0],dz=b[1]-a[1];const L=Math.hypot(dx,dz)||1;dx/=L;dz/=L;const g=heightAt(q[0],q[1]);return [-1,1].map(s=>[q[0]-dz*s*w/2,g,q[1]+dx*s*w/2]);});
  for(let i=1;i<edges.length;i++){const m=[(pts[i-1][0]+pts[i][0])/2,(pts[i-1][1]+pts[i][1])/2];if(nearWater(m[0],m[1],w/2+HEDGE_WATER_MARGIN)){hedgeCut+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);hedgeCuts.push([pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1]]);continue;}const [a0,a1]=edges[i-1],[b0,b1]=edges[i],top=v=>[v[0],v[1]+H,v[2]];
   hedgeBatch.quad(top(a0),top(a1),top(b1),top(b0),V2_COLORS.hedge);hedgeBatch.quad(a0,b0,top(b0),top(a0),V2_COLORS.hedgeSide);hedgeBatch.quad(a1,b1,top(b1),top(a1),V2_COLORS.hedgeSide);}}
 const hedgeMesh=hedgeBatch.mesh(group,false);if(hedgeMesh)hedgeMesh.name='v2-hedges';

 // ---------- Quality ----------
 function setQuality(mode){const size=TEXTURE_SIZE[mode]||3072;if(textureInfo.width!==size)textureInfo=drawTexture(size);if(hedgeMesh)hedgeMesh.visible=mode!=='very-fluid';
  const shadows=mode==='high';for(const o of [terrainMesh,roadMesh])if(o)o.receiveShadow=shadows;}
 setQuality(quality.mode);

 // ---------- POI: landmarks, sectors and click records ----------
 const pois=poi.pois,byId=new Map(pois.map(p=>[p.id,p]));
 const stats={terrain:{vertices:cols*rows,triangles:index.length/3,step,texture:textureInfo},roads:{count:d.roads.length,km:+roadKm.toFixed(1),byCategoryKm:Object.fromEntries(Object.entries(roadStats).map(([k,v])=>[k,+v.toFixed(1)]))},
  rail:{tracks:d.rail.length,km:+railKm.toFixed(1),levelCrossings:d.levelCrossings.length,bridges:d.railBridges.length},agriculture:d.agriculture.length,woodland:d.woodland.length,hedges:{count:d.hedges.length,km:+hedgeKm.toFixed(1),wallsCutOverWaterM:Math.round(hedgeCut),polygons:d.hedgePolygons.length},
  water:{polygons:d.water.length,lines:d.waterLines.length},artificial:d.artificial.length,poi:{records:pois.length,landmarks:pois.filter(p=>p.landmark).length}};
 return {group,data:d,hedgeCuts,poi:pois,poiById:byId,heightAt,terrainMesh,stats,setQuality,get texture(){return textureInfo;},bounds:{x0,z0,W,D}};
}
