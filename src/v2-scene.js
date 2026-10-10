import * as THREE from 'three';
import {Batch} from './geometry.js';
import {random} from './geo.js';
import {waterMaterial,ballastMaterial,terrainMaterial,crownGeometry,toon} from './art.js';

// V2.0 normal view: the frozen references assembled on the real relief (presentation only).
// - terrain V1.7 (10 m working grid) textured with the land cover V1.10 (parcels, woods, hedges, water, surfaces) drawn in a canvas;
// - roads V1.8 and rail V1.9 as ribbons following their own profiles (bridges stay above the ground);
// - hedges, level crossings, landmarks and click records from the POI V1.11 / V1.11.1.
// V2.4 (visual redesign): painted parcels with declared-crop tints and discreet furrows, woods as clumped canopy, water as
// a draped surface with readable banks, a road hierarchy (main road wider, kerbs, centre dashes, bridge parapets), ballast
// with shader-drawn ties, rounded instanced hedges, painted hillshade on the terrain. Nothing here changes a geometry:
// colours, widths and lifts are display choices only.
export const V2_COLORS={
 base:'#d7dbbb',village:'#d9d9c1',
 terre_arable:'#e4d49c',prairie_permanente:'#9fc27a',prairie_temporaire:'#b4d08b',jachere:'#d4c994',culture_permanente:'#c9a99c',autre_surface_agricole:'#d6d2b8',parcelEdge:'#ad9d72',
 peupleraie:'#86b069',foret_fermee_feuillus:'#5a8b4b',foret_ouverte:'#7ea463',bois:'#67944f',lande_ligneuse:'#9fb072',hedge:'#5f8f4a',hedgeSide:'#6f9c55',
 water:'#699fb8',waterBed:'#5a8a9f',waterLine:'#5f9fc0',waterIntermittent:'#8fbdd0',bank:'#7d9a76',
 parking:'#bdbab0',sport:'#9cc47f',cimetiere:'#bcc6a2',reservoir:'#9cc0d0',pv:'#a3afbd',activity:'#e1dbc8',activityEdge:'#b2a079',pvStripe:'#6b7888',skirt:'#c9bd9b',apron:'#d9dfcc',rail_land:'#c8beaf',
 route_principale:'#6d7177',route_secondaire:'#7a7e84',voie_locale:'#8f928f',voie_de_desserte:'#a3a49e',voie_pietonne:'#c7c0ac',chemin_carrossable:'#c1ae89',chemin_rural:'#b49a75',sentier:'#c6b48f',roadEdge:'#e2dbc6',roadEdgeMinor:'#d6d0bd',dash:'#ece6d3',bridgeDeck:'#8a8e93',parapet:'#b8b4a9',
 ballast:'#a79b8c',track:'#4a4d52',trackService:'#6b625a',level:'#d8d3c8',levelPost:'#e8e4dc',bridge:'#8c8f94'};
export const ROAD_LABELS={route_principale:'Route principale',route_secondaire:'Route secondaire',voie_locale:'Rue locale',voie_de_desserte:'Desserte',voie_pietonne:'Voie piétonne',chemin_carrossable:'Chemin empierré',chemin_rural:'Chemin de terre',sentier:'Sentier'};
const PAVED=new Set(['route_principale','route_secondaire','voie_locale','voie_de_desserte']);
export const LANDUSE_LABELS={terre_arable:'Terre arable',prairie_permanente:'Prairie permanente',prairie_temporaire:'Prairie temporaire',jachere:'Jachère',culture_permanente:'Culture permanente',autre_surface_agricole:'Autre surface agricole',
 peupleraie:'Peupleraie',foret_fermee_feuillus:'Forêt fermée de feuillus',foret_ouverte:'Forêt ouverte',bois:'Petit bois',lande_ligneuse:'Lande ligneuse'};
export const TEXTURE_SIZE={'very-fluid':2048,fluid:3072,high:4096};
// Tint of an arable parcel from the crop declared in the RPG (a documented value, shown on the click card; it changes
// every year). Families only, never a texture of the real crop.
const CROP_TINTS=[[/bl[ée]|orge|avoine|seigle|triticale|épeautre|c[ée]r[ée]ale/i,'#e2cf92'],[/ma[iï]s|sorgho/i,'#cfd38a'],[/tournesol|colza|moutarde/i,'#e6d27e'],[/betterave|pomme de terre|l[ée]gume|oignon|carotte|chou/i,'#c3cf86'],[/luzerne|tr[èe]fle|fourrag|prairie|gramin/i,'#b6cc86'],[/jach|gel|friche/i,'#d6ca98'],[/lin|chanvre|pois|f[èe]ve|lentille|soja/i,'#d8d49a'],[/vigne|verger|fruit/i,'#c9a99c']];
export const cropTint=(a)=>{if(a.t!=='terre_arable'||!a.crop)return V2_COLORS[a.t]||V2_COLORS.autre_surface_agricole;const hit=CROP_TINTS.find(([re])=>re.test(a.crop));return hit?hit[1]:V2_COLORS.terre_arable;};
const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967296;};
const shade=(hex,l,s=0)=>new THREE.Color(hex).offsetHSL(0,s,l).getStyle();

import {waterProximity,HEDGE_WATER_MARGIN} from './hydro-display.js';
export async function buildV2Scene(scene,{relief,base,quality,exclude=null}){
 const [d,poi]=await Promise.all([fetch(`${base}data/v2-scene.json`).then(r=>r.json()),fetch(`${base}data/poi.json`).then(r=>r.json())]);
 const {meta}=relief,{cols,rows,step,x0,z0}=meta,W=(cols-1)*step,D=(rows-1)*step;
 let minY=Infinity;for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const v=relief.alt(c,r);if(v===v)minY=Math.min(minY,v-meta.yReference);}
 const edgeY=minY-2;
 // Height of the displayed terrain (bilinear on the working grid) in scene units.
 const onGrid=(x,z)=>x>=x0+1&&x<=x0+W-1&&z>=z0+1&&z<=z0+D-1;
 const heightAt=(x,z)=>{const v=relief.sample(x,z);return v===v?v-meta.yReference:edgeY;};
 const group=new THREE.Group();group.name='v2-scene';scene.add(group);

 // ---------- Terrain with the draped land-cover texture ----------
 const pos=new Float32Array(cols*rows*3),uv=new Float32Array(cols*rows*2),col=new Float32Array(cols*rows*3);
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const k=r*cols+c,v=relief.alt(c,r);pos[k*3]=x0+c*step;pos[k*3+1]=v===v?v-meta.yReference:edgeY;pos[k*3+2]=z0+r*step;uv[k*2]=c/(cols-1);uv[k*2+1]=r/(rows-1);}
 const index=new Uint32Array((cols-1)*(rows-1)*6);let n=0;for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){const a=r*cols+c,b=a+1,e=a+cols,f=e+1;index.set([a,e,b,b,e,f],n);n+=6;}
 // Painted hillshade (V2.4): a low raking light from the north-west stored as vertex colour. Pure shading, the relief is
 // the real one (no exaggeration, no altitude change). Hollows (below the 70 m mean) are very slightly darker.
 const L=new THREE.Vector3(-.55,.5,-.62).normalize(),nrm=new THREE.Vector3();
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const k=r*cols+c,y=(cc,rr)=>pos[(Math.min(rows-1,Math.max(0,rr))*cols+Math.min(cols-1,Math.max(0,cc)))*3+1];
  nrm.set(y(c-1,r)-y(c+1,r),2*step,y(c,r-1)-y(c,r+1)).normalize();const dot=nrm.dot(L);
  const mean=(y(c-3,r)+y(c+3,r)+y(c,r-3)+y(c,r+3))/4,hollow=THREE.MathUtils.clamp((mean-pos[k*3+1])/3,0,1);
  const s=THREE.MathUtils.clamp(.9+.22*(dot-.45),.84,1.08)*(1-.05*hollow);col[k*3]=s;col[k*3+1]=s;col[k*3+2]=s;}
 const terrainGeo=new THREE.BufferGeometry();terrainGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));terrainGeo.setAttribute('uv',new THREE.BufferAttribute(uv,2));terrainGeo.setAttribute('color',new THREE.BufferAttribute(col,3));terrainGeo.setIndex(new THREE.BufferAttribute(index,1));terrainGeo.computeVertexNormals();
 const canvas=document.createElement('canvas'),texture=new THREE.CanvasTexture(canvas);texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
 const terrainMat=terrainMaterial(texture);
 const terrainMesh=new THREE.Mesh(terrainGeo,terrainMat);terrainMesh.name='v2-terrain';terrainMesh.receiveShadow=true;group.add(terrainMesh);
 // Skirt around the grid down to a hazy apron, so the extent reads as a clean block instead of a floating sheet.
 const skirt=new Batch(new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
 const border=[];for(let c=0;c<cols;c++)border.push([c,0]);for(let r=1;r<rows;r++)border.push([cols-1,r]);for(let c=cols-2;c>=0;c--)border.push([c,rows-1]);for(let r=rows-2;r>=0;r--)border.push([0,r]);
 for(let i=1;i<border.length;i++){const [c1,r1]=border[i-1],[c2,r2]=border[i],a=[x0+c1*step,pos[(r1*cols+c1)*3+1],z0+r1*step],b=[x0+c2*step,pos[(r2*cols+c2)*3+1],z0+r2*step];skirt.quad([a[0],edgeY-1,a[2]],[b[0],edgeY-1,b[2]],b,a,[V2_COLORS.apron,V2_COLORS.apron,V2_COLORS.skirt,V2_COLORS.skirt]);}
 skirt.mesh(group,false);
 const apron=new THREE.Mesh(new THREE.PlaneGeometry(60000,60000).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:V2_COLORS.apron}));apron.position.set(x0+W/2,edgeY-1.2,z0+D/2);apron.name='v2-apron';group.add(apron);

 function drawTexture(size){
  const w=size,h=Math.round(size*D/W);canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');const sx=w/W,sz=h/D,rng=random(2024);
  const X=x=>(x-x0)*sx,Z=z=>(z-z0)*sz;
  const path=rings=>{ctx.beginPath();for(const r of rings){for(let i=0;i<r.length;i+=2)i?ctx.lineTo(X(r[i]),Z(r[i+1])):ctx.moveTo(X(r[i]),Z(r[i+1]));ctx.closePath();}};
  const fill=(o,color,alpha=1)=>{ctx.globalAlpha=alpha;ctx.fillStyle=color;for(const p of o.r){path(p);ctx.fill('evenodd');}ctx.globalAlpha=1;};
  const outline=(o,color,widthM,alpha=1)=>{ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=Math.max(.8,widthM*sx);for(const p of o.r){path(p);ctx.stroke();}ctx.globalAlpha=1;};
  const line=(p,color,widthM,dash)=>{ctx.strokeStyle=color;ctx.lineWidth=Math.max(.8,widthM*sx);ctx.setLineDash(dash?dash.map(v=>v*sx):[]);ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();for(let i=0;i<p.length;i+=2)i?ctx.lineTo(X(p[i]),Z(p[i+1])):ctx.moveTo(X(p[i]),Z(p[i+1]));ctx.stroke();ctx.setLineDash([]);};
  const line3=(p,color,widthM)=>{ctx.strokeStyle=color;ctx.lineWidth=Math.max(.8,widthM*sx);ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();for(let i=0;i<p.length;i+=3)i?ctx.lineTo(X(p[i]),Z(p[i+1])):ctx.moveTo(X(p[i]),Z(p[i+1]));ctx.stroke();};
  const box=o=>{let b=[Infinity,Infinity,-Infinity,-Infinity];for(const p of o.r)for(const r of p)for(let i=0;i<r.length;i+=2)b=[Math.min(b[0],r[i]),Math.min(b[1],r[i+1]),Math.max(b[2],r[i]),Math.max(b[3],r[i+1])];return b;};
  // Main direction of a parcel (its longest edge): furrows and parcel stripes follow it.
  const bearing=o=>{let best=0,bl=0;for(const r of o.r[0])for(let i=2;i<r.length;i+=2){const dx=r[i]-r[i-2],dz=r[i+1]-r[i-1],l=dx*dx+dz*dz;if(l>bl){bl=l;best=Math.atan2(dz,dx);}}return best;};
  // Soft speckle inside a polygon: clumps of lighter / darker tone (woods, meadows). Decorative only.
  // One clipped fill per colour (not per dot): a clip re-rasterised at every fill is what made the first draft crawl.
  const speckle=(o,colors,perHa,radiusM)=>{const b=box(o),area=(b[2]-b[0])*(b[3]-b[1])/1e4,count=Math.min(4000,Math.round(area*perHa));if(!count)return;ctx.save();path(o.r.flat());ctx.clip('evenodd');ctx.globalAlpha=.5;
   for(const [k,color] of colors.entries()){ctx.fillStyle=color;ctx.beginPath();for(let i=k;i<count;i+=colors.length){const x=X(b[0]+rng()*(b[2]-b[0])),z=Z(b[1]+rng()*(b[3]-b[1])),r=Math.max(.6,radiusM*(.6+rng()*.8)*sx);ctx.moveTo(x+r,z);ctx.arc(x,z,r,0,6.283);}ctx.fill();}ctx.globalAlpha=1;ctx.restore();};
  const stripes=(o,color,spacingM,alpha,widthM=1.2)=>{const b=box(o),a=bearing(o),cx=(b[0]+b[2])/2,cz=(b[1]+b[3])/2,R=Math.hypot(b[2]-b[0],b[3]-b[1])/2;if(spacingM*sx<2.2)return;ctx.save();path(o.r.flat());ctx.clip('evenodd');ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=Math.max(.8,widthM*sx);ctx.beginPath();
   const ux=Math.cos(a),uz=Math.sin(a),vx=-uz,vz=ux;for(let s=-R;s<=R;s+=spacingM){ctx.moveTo(X(cx+vx*s-ux*R),Z(cz+vz*s-uz*R));ctx.lineTo(X(cx+vx*s+ux*R),Z(cz+vz*s+uz*R));}ctx.stroke();ctx.restore();ctx.globalAlpha=1;};
  ctx.fillStyle=V2_COLORS.base;ctx.fillRect(0,0,w,h);
  for(const v of d.village){fill(v,V2_COLORS.village);speckle(v,['#cdd6a8','#dcd9bf','#c3cf9c'],9,4.5);}
  // Functional perimeters first (they also contain fields), very light; then parcels, surfaces, woods, water.
  for(const a of d.artificial.filter(a=>a.kind==='perimetre'&&a.t!=='parc_eolien_perimetre'&&a.t!=='centrale_photovoltaique'))fill(a,V2_COLORS.activity,.75);
  for(const a of d.agriculture){const k=hash(a.id),tint=shade(cropTint(a),(k-.5)*.07,(k-.5)*.04);fill(a,tint);
   if(['prairie_permanente','prairie_temporaire'].includes(a.t))speckle(a,['#c6dc99','#93b76e'],14,3);
   else if(a.t==='terre_arable'||a.t==='jachere')stripes(a,'#6a5a3a',6+k*4,.07,1);}
  for(const a of d.agriculture)outline(a,V2_COLORS.parcelEdge,.8,.45);
  // Photovoltaic parks: light blue-grey with panel rows (pattern), not a dark slab.
  const tile=document.createElement('canvas');tile.width=tile.height=8;const tc=tile.getContext('2d');tc.fillStyle=V2_COLORS.pv;tc.fillRect(0,0,8,8);tc.fillStyle=V2_COLORS.pvStripe;tc.fillRect(0,0,8,Math.max(2,Math.round(2.5*sz)));
  for(const a of d.artificial.filter(a=>a.t==='centrale_photovoltaique')){ctx.fillStyle=ctx.createPattern(tile,'repeat');for(const p of a.r){path(p);ctx.fill('evenodd');}}
  for(const a of d.artificial.filter(a=>a.kind==='surface'))fill(a,a.t==='parking'?V2_COLORS.parking:a.t==='terrain_de_sport'?V2_COLORS.sport:a.t==='cimetiere'?V2_COLORS.cimetiere:a.t==='reservoir'?V2_COLORS.reservoir:V2_COLORS.rail_land);
  for(const a of d.artificial.filter(a=>a.kind==='perimetre'&&['zone_industrielle','zone_commerciale','centrale_photovoltaique','enceinte_militaire'].includes(a.t)))outline(a,V2_COLORS.activityEdge,2,.5);
  for(const a of d.woodland){const base=V2_COLORS[a.t]||V2_COLORS.bois;fill(a,base);speckle(a,[shade(base,.09),shade(base,-.08),shade(base,.05,.05)],a.t==='peupleraie'?40:60,a.t==='peupleraie'?2.4:3.4);}
  for(const a of d.woodland)outline(a,'#45703a',1,.4);
  for(const a of d.hedgePolygons)fill(a,V2_COLORS.hedge);
  for(const hd of d.hedges)line3(hd.p,V2_COLORS.hedge,hd.w||2.5);
  // V2.1: water last, so that riparian hedges (DSB bands up to 98 m wide) never paint over a watercourse.
  // V2.4: the texture carries the darker water bed and a soft bank; the visible surface is the draped mesh above.
  for(const a of d.water)outline(a,V2_COLORS.bank,3,.55);
  for(const a of d.water)fill(a,V2_COLORS.waterBed);
  for(const l of d.waterLines){if(l.perm)line(l.p,V2_COLORS.bank,l.w+3.2);line(l.p,l.perm?V2_COLORS.waterBed:V2_COLORS.waterIntermittent,l.w,l.perm?null:[6,4]);}
  texture.needsUpdate=true;return {width:w,height:h,metresPerPixel:+(W/w).toFixed(2)};
 }
 let textureInfo=drawTexture(TEXTURE_SIZE[quality.mode]||3072);

 // ---------- Ribbons draped on the terrain (roads, rail, water) ----------
 // Each edge vertex takes the higher of the source profile and the displayed terrain, plus a small lift; bridges keep their profile.
 // uv.x is the distance along the ribbon, uv.y the side (0..1): shader materials (ballast ties, water banks) use them.
 function ribbon(batch,p,width,lift,color,{bridge=false,maxStep=8,parapet=0}={}){
  const pts=[];for(let i=0;i<p.length;i+=3){const q=[p[i],p[i+1],p[i+2]];if(pts.length){const a=pts.at(-1),len=Math.hypot(q[0]-a[0],q[1]-a[1]),k=Math.ceil(len/maxStep);for(let j=1;j<k;j++)pts.push([a[0]+(q[0]-a[0])*j/k,a[1]+(q[1]-a[1])*j/k,a[2]+(q[2]-a[2])*j/k]);}pts.push(q);}
  // Only the parts over the displayed terrain are drawn (the V1.8 / V1.9 layers reach the corners of the extent).
  const runs=[];let run=[];for(const q of pts){if(onGrid(q[0],q[1]))run.push(q);else{if(run.length>1)runs.push(run);run=[];}}if(run.length>1)runs.push(run);
  if(runs.length!==1||runs[0].length!==pts.length){let n=0;for(const r of runs)n+=ribbonRun(batch,r,width,lift,color,bridge,parapet);return n;}
  return ribbonRun(batch,pts,width,lift,color,bridge,parapet);
 }
 function ribbonRun(batch,pts,width,lift,color,bridge,parapet){
  let travel=0;const edges=pts.map((q,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];let dx=b[0]-a[0],dz=b[1]-a[1];const L=Math.hypot(dx,dz)||1;dx/=L;dz/=L;if(i)travel+=Math.hypot(q[0]-pts[i-1][0],q[1]-pts[i-1][1]);
   const e=[-1,1].map(s=>{const x=q[0]-dz*s*width/2,z=q[1]+dx*s*width/2;return [x,(bridge?q[2]:Math.max(q[2],heightAt(x,z),heightAt(q[0],q[1])))+lift,z];});e.t=travel;return e;});
  for(let i=1;i<edges.length;i++){const a=edges[i-1],b=edges[i];batch.quad(a[0],a[1],b[1],b[0],color,[[a.t,0],[a.t,1],[b.t,1],[b.t,0]]);
   if(parapet)for(const s of [0,1]){const u=a[s],v=b[s];batch.quad(u,v,[v[0],v[1]+parapet,v[2]],[u[0],u[1]+parapet,u[2]],[V2_COLORS.parapet,V2_COLORS.parapet,shade(V2_COLORS.parapet,.08),shade(V2_COLORS.parapet,.08)]);}}
  return pts.length;
 }
 const roadBatch=new Batch(new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}));
 const dashBatch=new Batch(dashMaterial());
 const roadStats={};let roadKm=0;
 const order=['sentier','chemin_rural','chemin_carrossable','voie_pietonne','voie_de_desserte','voie_locale','route_secondaire','route_principale'];
 // Visual hierarchy (V2.4): the main road reads a little wider with a light kerb and a dashed centre line, local streets
 // thinner with a softer kerb, paths earthy without any kerb. Alignments and reference widths come from the frozen V1.8 layer.
 for(const cat of order)for(const r of d.roads.filter(r=>r.c===cat)){const paved=PAVED.has(cat),main=cat==='route_principale',w=Math.max(paved?3:1.2,r.w||3)+(main?.8:0),lift=.25+order.indexOf(cat)*.012,bridge=!!r.b;
  const color=bridge&&paved?V2_COLORS.bridgeDeck:V2_COLORS[cat]||'#999';
  if(paved)ribbon(roadBatch,r.p,w+(main?1.8:cat==='route_secondaire'?1.5:1.1),lift,main||cat==='route_secondaire'?V2_COLORS.roadEdge:V2_COLORS.roadEdgeMinor,{bridge});
  ribbon(roadBatch,r.p,w,lift+.03,color,{bridge,parapet:bridge&&paved?.9:0});
  if(main)ribbon(dashBatch,r.p,.22,lift+.06,V2_COLORS.dash,{bridge});
  let L=0;for(let i=3;i<r.p.length;i+=3)L+=Math.hypot(r.p[i]-r.p[i-3],r.p[i+1]-r.p[i-2]);roadKm+=L/1000;roadStats[cat]=(roadStats[cat]||0)+L/1000;}
 const roadMesh=roadBatch.mesh(group,false);if(roadMesh){roadMesh.name='v2-roads';roadMesh.receiveShadow=true;}
 const dashMesh=dashBatch.mesh(group,false);if(dashMesh){dashMesh.name='v2-road-marks';dashMesh.receiveShadow=false;}
 // Rail (V2.4): ballast bed with shader ties, two steel rails, service tracks slightly rustier.
 const ballastBatch=new Batch(ballastMaterial(V2_COLORS.ballast)),railBatch=new Batch(new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}));let railKm=0;
 for(const t of d.rail){const main=t.k==='principal';ribbon(ballastBatch,t.p,main?4.6:3.6,.42,V2_COLORS.ballast,{maxStep:4});
  for(const s of [-.72,.72]){const off=[];for(let i=0;i<t.p.length;i+=3){const a=t.p[Math.max(0,i-3)],b=t.p[Math.min(t.p.length-3,i+3)];let dx=b-a,dz=t.p[Math.min(t.p.length-3,i+3)+1]-t.p[Math.max(0,i-3)+1];const L=Math.hypot(dx,dz)||1;dx/=L;dz/=L;off.push(t.p[i]-dz*s,t.p[i+1]+dx*s,t.p[i+2]);}
   ribbon(railBatch,off,.16,.56,main?V2_COLORS.track:V2_COLORS.trackService,{maxStep:4});}
  for(let i=3;i<t.p.length;i+=3)railKm+=Math.hypot(t.p[i]-t.p[i-3],t.p[i+1]-t.p[i-2])/1000;}
 for(const b of d.railBridges){const p=[b.a[0],b.a[1],b.y+.2,b.b[0],b.b[1],b.y+.2];ribbon(railBatch,p,9,-.35,V2_COLORS.bridge,{bridge:true,parapet:1.1});}
 const ballastMesh=ballastBatch.mesh(group,false);if(ballastMesh){ballastMesh.name='v2-ballast';ballastMesh.receiveShadow=true;}
 const railMesh=railBatch.mesh(group,false);if(railMesh)railMesh.name='v2-rail';
 // Level crossings: a light plank area across the track and two pale posts (stylised, no barrier survey).
 const pnBatch=new Batch(new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}));
 const postGeo=new THREE.CylinderGeometry(.22,.22,3.2,6),pn=new THREE.InstancedMesh(postGeo,new THREE.MeshLambertMaterial({color:V2_COLORS.levelPost}),d.levelCrossings.length*2),m=new THREE.Matrix4();
 d.levelCrossings.forEach((l,i)=>{const [x,z]=l.p,y=Math.max(l.p[2]??-Infinity,heightAt(x,z));const near=d.rail.map(t=>{let best=Infinity,ang=0;for(let k=3;k<t.p.length;k+=3){const ax=t.p[k-3],az=t.p[k-2],bx=t.p[k],bz=t.p[k+1],dx=bx-ax,dz=bz-az,L=dx*dx+dz*dz||1,u=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/L)),dd=Math.hypot(x-ax-u*dx,z-az-u*dz);if(dd<best){best=dd;ang=Math.atan2(dz,dx);}}return {best,ang};}).sort((a,b)=>a.best-b.best)[0];
  const a=near?near.ang:0,ux=Math.cos(a),uz=Math.sin(a),vx=-uz,vz=ux,hw=3.2,hl=4.5,c=[[-hw,-hl],[hw,-hl],[hw,hl],[-hw,hl]].map(([s,t])=>[x+ux*s+vx*t,y+.62,z+uz*s+vz*t]);pnBatch.quad(c[0],c[1],c[2],c[3],V2_COLORS.level);
  for(const [j,t] of [[-1,0],[1,1]]){m.makeTranslation(x+vx*j*(hl+1.4)+ux*(j*hw),y+1.6,z+vz*j*(hl+1.4)+uz*(j*hw));pn.setMatrixAt(i*2+t,m);}});
 pn.name='v2-level-crossings';group.add(pn);const pnMesh=pnBatch.mesh(group,false);if(pnMesh)pnMesh.name='v2-level-planks';

 // ---------- Water surfaces (V2.4): flat sheets for ponds, draped ribbons for watercourses ----------
 const waterBatch=new Batch(waterMaterial(V2_COLORS.water));
 for(const a of d.water){for(const p of a.r){const rings=p.map(r=>{const out=[];for(let i=0;i<r.length;i+=2)out.push([r[i],r[i+1]]);return out;}).filter(r=>r.length>=3);if(!rings.length)continue;
  let lvl=Infinity;for(const r of rings)for(const q of r)if(onGrid(q[0],q[1]))lvl=Math.min(lvl,heightAt(q[0],q[1]));if(!Number.isFinite(lvl))continue;
  const sh=rings.map(r=>r.map(q=>new THREE.Vector2(q[0],q[1])));for(const t of THREE.ShapeUtils.triangulateShape(sh[0],sh.slice(1))){const v=t.map(i=>sh.flat()[i]);waterBatch.tri(...v.map(q=>[q.x,lvl+.3,q.y]),V2_COLORS.water,v.map(()=>[0,.5]));}}}
 const waterMesh=waterBatch.mesh(group,false);if(waterMesh){waterMesh.name='v2-water';waterMesh.receiveShadow=true;}
 // V2.9: the watercourses get their own mesh so a stylised mode can replace them (tapered ends, round caps) while the ponds stay.
 const waterLineBatch=new Batch(waterMaterial(V2_COLORS.water));
 for(const l of d.waterLines){const p=[];for(let i=0;i<l.p.length;i+=2)p.push(l.p[i],l.p[i+1],-1e9);ribbon(waterLineBatch,p,Math.max(1.4,l.w||3),.2,l.perm?V2_COLORS.water:V2_COLORS.waterIntermittent,{maxStep:6});}
 const waterLineMesh=waterLineBatch.mesh(group,false);if(waterLineMesh){waterLineMesh.name='v2-water-lines';waterLineMesh.receiveShadow=true;}

 // ---------- Hedges: rounded instanced bushes along the DSB lines (skipped in "very fluid"; the texture keeps them) ----------
 // V2.1: no 3D hedge over a watercourse or a water surface (see hydro-display.js).
 const nearWater=waterProximity(d.waterLines,d.water),hedgeCuts=[];let hedgeCut=0,hedgeKm=0;const bushes=[];
 for(const h of d.hedges){const p=h.p,H=Math.min(5,h.h||2.4),w=Math.min(6,h.w||2.4);
  const pts=[];for(let i=0;i<p.length;i+=3){const q=[p[i],p[i+1]];if(pts.length){const a=pts.at(-1),len=Math.hypot(q[0]-a[0],q[1]-a[1]);hedgeKm+=len/1000;}pts.push(q);}
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),k=Math.max(1,Math.round(len/5.5)),ang=Math.atan2(b[0]-a[0],b[1]-a[1]);
   for(let j=0;j<k;j++){const f=(j+.5)/k,x=a[0]+(b[0]-a[0])*f,z=a[1]+(b[1]-a[1])*f;if(!onGrid(x,z))continue;if(nearWater(x,z,w/2+HEDGE_WATER_MARGIN)){hedgeCut+=len/k;hedgeCuts.push([a[0]+(b[0]-a[0])*(j/k),a[1]+(b[1]-a[1])*(j/k),a[0]+(b[0]-a[0])*((j+1)/k),a[1]+(b[1]-a[1])*((j+1)/k)]);continue;}
    if(exclude&&exclude(x,z))continue;bushes.push({x,z,ang,w,H,len:len/k});}}}
 const hedgeMesh=new THREE.InstancedMesh(crownGeometry({lobes:3,flatten:.62,seed:2.1,detail:0}),toon({vertexColors:true}),Math.max(1,bushes.length));
 const o3=new THREE.Object3D(),tint=new THREE.Color(),greens=['#5f8f4a','#6a9a52','#588a45','#71a05a'];
 bushes.forEach((b,i)=>{o3.position.set(b.x,heightAt(b.x,b.z)+b.H*.42,b.z);o3.rotation.set(0,b.ang,0);o3.scale.set(Math.max(1.2,b.w*.55),b.H*.6,b.len*.62+.9);o3.updateMatrix();hedgeMesh.setMatrixAt(i,o3.matrix);hedgeMesh.setColorAt(i,tint.set(greens[(i*7)%greens.length]).offsetHSL(0,0,((i*13)%7-3)*.012));});
 hedgeMesh.count=bushes.length;hedgeMesh.name='v2-hedges';hedgeMesh.castShadow=true;hedgeMesh.receiveShadow=false;group.add(hedgeMesh);

 // ---------- Quality ----------
 // Shadows are static (re-fitted when the view changes, never per frame): Fluide and Élevée receive them, Très fluide does not.
 function setQuality(mode){const size=TEXTURE_SIZE[mode]||3072;if(textureInfo.width!==size)textureInfo=drawTexture(size);if(hedgeMesh)hedgeMesh.visible=mode!=='very-fluid';
  const shadows=mode!=='very-fluid';for(const o of [terrainMesh,roadMesh,ballastMesh,waterMesh])if(o)o.receiveShadow=shadows;if(hedgeMesh)hedgeMesh.castShadow=shadows;}
 setQuality(quality.mode);

 // ---------- POI: landmarks, sectors and click records ----------
 const pois=poi.pois,byId=new Map(pois.map(p=>[p.id,p]));
 const stats={terrain:{vertices:cols*rows,triangles:index.length/3,step,texture:textureInfo},roads:{count:d.roads.length,km:+roadKm.toFixed(1),byCategoryKm:Object.fromEntries(Object.entries(roadStats).map(([k,v])=>[k,+v.toFixed(1)]))},
  rail:{tracks:d.rail.length,km:+railKm.toFixed(1),levelCrossings:d.levelCrossings.length,bridges:d.railBridges.length},agriculture:d.agriculture.length,woodland:d.woodland.length,hedges:{count:d.hedges.length,km:+hedgeKm.toFixed(1),bushes:bushes.length,wallsCutOverWaterM:Math.round(hedgeCut),polygons:d.hedgePolygons.length},
  water:{polygons:d.water.length,lines:d.waterLines.length},artificial:d.artificial.length,poi:{records:pois.length,landmarks:pois.filter(p=>p.landmark).length}};
 return {group,data:d,hedgeCuts,poi:pois,poiById:byId,heightAt,onGrid,terrainMesh,apron,stats,setQuality,get texture(){return textureInfo;},bounds:{x0,z0,W,D}};
}

// Dashed centre line of the main road: the dash pattern follows uv.x (distance along the ribbon), faded at distance.
function dashMaterial(){const m=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,transparent:true,depthWrite:false});
 m.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vDuv;').replace('#include <project_vertex>','#include <project_vertex>\nvDuv=uv;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vDuv;').replace('#include <color_fragment>','#include <color_fragment>\nfloat dsh=step(.55,fract(vDuv.x/9.));diffuseColor.a*=dsh*clamp(1.-fwidth(vDuv.x)*2.,0.,1.)*.85;');};
 m.customProgramCacheKey=()=>'v24-dash';return m;}
