// V2.3 architectural profiles (public/data/building-architecture-v2.3.json) on the frozen footprints. Only the elevation
// changes: footprint, position and orientation of the building stay exactly those of the V2.2 scene.
// V2.4: the profiles drive the default map (?architecture=0 restores the V2.2 flat rendering); ?diagnostic=architecture
// keeps the confidence colouring. Roofs are the minimum of planes over the footprint (gable, hip, shed, flat), split along their creases.

import * as THREE from 'three';
// Diagnostic colours by overall confidence (development aid, not an art choice).
export const ARCH_COLORS={A:'#2f9e5a',B:'#e9a23b',C:'#2f6fe0',unknown:'#c0359b'};
export const ARCH_LABELS={A:'A · source officielle ou mesure LiDAR claire',B:'B · déduction solide',C:'C · estimation typologique',unknown:'inconnu · aucune base suffisante'};
// Stylised roof palettes per observed colour family (never a survey of the exact colour). V2.4: softer, film-like tones;
// an unknown family gets a neutral taupe that reads as « not documented » rather than a random tile.
const FAMILY={red_orange:['#c46d4c','#bd6446','#c87756','#b76a4f','#cb8160'],brown:['#8b6652','#7f5c4a','#957159','#876453'],dark_gray:['#61656a','#5a5e63','#6a6e72','#625f63'],light_gray:['#a7abab','#b2b4b1','#9ea3a5'],blue_gray:['#6f8797','#78909c','#687f8c'],white:['#e1dfd7','#d9d8d0','#d5d3cb'],mixed:['#95796a','#8b7d72','#9a8575'],unknown:['#9c8c7d','#948679','#a39282']};
// Lambert-93 grid north vs the local lon/lat frame: meridian convergence n·(λ − 3°) ≈ 0,57° at Maizières.
const CONVERGENCE=.7256*(3.789-3);
const rad=d=>d*Math.PI/180;
// Unit vector in the local frame (x = east, z = south) for a Lambert-93 bearing (clockwise from grid north).
const dir=bearing=>{const a=rad(bearing+CONVERGENCE);return [Math.sin(a),-Math.cos(a)];};
const range=(poly,v)=>{let min=Infinity,max=-Infinity;for(const r of poly)for(const q of r){const d=q[0]*v[0]+q[1]*v[1];if(d<min)min=d;if(d>max)max=d;}return {min,max};};

// Returns the render profile adjusted by the documented attributes; unknown attributes keep the V2.2 value.
export function applyArchitecture(p,e,poly){
 const out={...p};const roof=e.roof||{};
 if(e.wallHeightM!=null)out.wallHeight=e.wallHeightM;
 if(e.visibleStoreys)out.windowFloors=Math.max(1,Math.min(e.visibleStoreys,Math.floor((out.wallHeight-.2)/2.2)||1));
 let type=roof.type;
 if(e.buildingClass==='WATER_TOWER'&&e.totalHeightM){out.wallHeight=e.totalHeightM;type='flat';}
 const shape={gable:'gabled',complex:'gabled',industrial:'gabled',hip:'hip',shed:'shed',flat:'flat'}[type]||(p.roofShape==='flat'?'flat':'gabled');
 out.roofShape=shape;
 // Slope axis: perpendicular to the measured ridge, or the measured uphill direction of a mono-pitch roof.
 let across=p.axis.axis;
 if(shape==='shed'&&roof.uphillAzimuthDeg!=null)across=dir(roof.uphillAzimuthDeg);
 else if(roof.ridgeOrientationDeg!=null)across=dir(roof.ridgeOrientationDeg+90);
 const a=range(poly,across),along=[-across[1],across[0]],b=range(poly,along);
 out.arch={across,along,a,b,shape,type:type||'unknown',cls:e.buildingClass};
 const half=Math.max(.1,(a.max-a.min)/2),span=a.max-a.min;
 let rise=p.roofHeight;
 if(shape==='flat')rise=0;
 else if(e.totalHeightM!=null&&e.wallHeightM!=null&&['measured','official'].includes(e.totalHeightStatus)&&['measured','official'].includes(e.wallHeightStatus)&&e.totalHeightM>e.wallHeightM+.2)rise=e.totalHeightM-e.wallHeightM;
 else if(roof.slopeDeg)rise=Math.tan(rad(roof.slopeDeg))*(shape==='shed'?span:half);
 out.roofHeight=Math.max(0,Math.min(rise,12,shape==='shed'?span:span*1.2));
 const family=FAMILY[roof.colorFamily]||FAMILY.unknown;out.roofColor=family[(p.seed>>>5)%family.length];
 // Large flat roofs (halls, warehouses) read lighter: a dark slab from above kills the volume.
 if(shape==='flat'&&p.size>400)out.roofColor=new THREE.Color(out.roofColor).offsetHSL(0,0,.09).getStyle();
 // Membrane and metal roofs read flatter and cooler; glass (greenhouses) pale.
 if(roof.material==='membrane'&&roof.colorFamily==='unknown')out.roofColor='#8f9394';
 if(roof.material==='glass')out.roofColor='#cfdde0';
 return out;
}

// Height of the roof above the wall top at q, and the crease lines {n, c} (n·q = c) along which planes meet.
export function roofSurface(p){const {across,along,a,b,shape}=p.arch,rise=p.roofHeight,mid=(a.min+a.max)/2,half=Math.max(.1,(a.max-a.min)/2),midB=(b.min+b.max)/2,halfL=Math.max(.1,(b.max-b.min)/2);
 const A=q=>q[0]*across[0]+q[1]*across[1],B=q=>q[0]*along[0]+q[1]*along[1];
 if(shape==='flat'||rise<=0)return {h:()=>0,lines:[],ridge:null};
 if(shape==='shed')return {h:q=>rise*Math.max(0,Math.min(1,(A(q)-a.min)/Math.max(.1,a.max-a.min))),lines:[],ridge:null};
 // Ridge segment in the local frame: the line A = mid, over the whole length (gable) or the central part (hip).
 const ridge={at:s=>[across[0]*mid+along[0]*s,across[1]*mid+along[1]*s],s0:b.min,s1:b.max};
 if(shape==='hip'){const s=rise/half,c=halfL-half;
  // Hip creases |b'| − |a'| = halfL − half, written as four straight lines in the local frame.
  const lines=[{n:across,c:mid}];for(const [sa,sb] of [[1,1],[1,-1],[-1,1],[-1,-1]]){const n=[sb*along[0]-sa*across[0],sb*along[1]-sa*across[1]];lines.push({n,c:sb*midB-sa*mid+c});}
  return {h:q=>s*Math.max(0,Math.min(half-Math.abs(A(q)-mid),halfL-Math.abs(B(q)-midB))),lines,ridge:{...ridge,s0:midB-Math.max(0,c),s1:midB+Math.max(0,c)}};}
 return {h:q=>rise*Math.max(0,1-Math.abs(A(q)-mid)/half),lines:[{n:across,c:mid}],ridge};
}

// Splits a convex polygon along a line (keeps both halves) — pieces stay planar under a min-of-planes roof.
function cut(points,n,c,side){const out=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],da=a[0]*n[0]+a[1]*n[1]-c,db=b[0]*n[0]+b[1]*n[1]-c;if(da*side>=-1e-6)out.push(a);if(da*db<0){const t=da/(da-db);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}return out;}
export function splitByLines(points,lines){let pieces=[points];for(const {n,c} of lines){const next=[];for(const pg of pieces)for(const side of [-1,1]){const q=cut(pg,n,c,side);if(q.length>=3)next.push(q);}pieces=next;}return pieces;}
// Parameters t ∈ ]0,1[ where the segment a → b crosses a crease line.
export function edgeCuts(a,b,lines){const ts=[];for(const {n,c} of lines){const da=a[0]*n[0]+a[1]*n[1]-c,db=b[0]*n[0]+b[1]*n[1]-c;if(da*db<0)ts.push(da/(da-db));}return ts.sort((x,y)=>x-y);}

// Short card lines for the selection panel.
const STATUS={official:'officiel',measured:'mesuré',orthophoto:'orthophoto',derived:'dérivé',estimated:'estimé',unknown:'inconnu',not_applicable:'sans objet'};
const ROOF={gable:'deux pans',hip:'quatre pans',flat:'plat',shed:'mono-pente',half_hip:'demi-croupe',complex:'complexe / plusieurs volumes',industrial:'industriel faible pente',unknown:'inconnu'};
const COLOR={red_orange:'terre cuite rouge-orangé',brown:'brun',dark_gray:'gris foncé',light_gray:'gris clair',blue_gray:'gris-bleu',white:'blanc / très clair',mixed:'mixte',unknown:'inconnue'};
const MAT={tile:'tuile',slate_like:'ardoise ou aspect ardoise',metal:'métal',membrane:'étanchéité / membrane',fiber_cement:'fibrociment',glass:'verre',unknown:'inconnu'};
const h=(v,st)=>v==null?'inconnue':`${v.toLocaleString('fr-FR',{maximumFractionDigits:1})} m (${STATUS[st]})`;
const FOOT={rectangle:'rectangulaire',elongated:'allongée',L:'en L',T:'en T',U:'en U',irregular:'irrégulière',complex:'complexe'};
export const CLASS_LABELS={RES_PLAIN_PIED_GABLE:'maison de plain-pied, toit à deux pans',RES_PLAIN_PIED_HIP:'maison de plain-pied, toit à quatre pans',RES_R1_GABLE:'maison à étage, toit à deux pans',RES_R1_HIP:'maison à étage, toit à quatre pans',RES_R2_PLUS:'immeuble ou maison à deux étages ou plus',RES_FLAT:'habitation à toit plat',RES_COMPLEX:'habitation à plusieurs volumes',GARAGE:'garage',ANNEX:'dépendance',SHED:'abri',GREENHOUSE:'serre',FARM:'bâtiment agricole',HANGAR:'hangar',INDUSTRIAL:'bâtiment industriel',COMMERCIAL:'commerce / activité',PUBLIC:'équipement public',HERITAGE:'bâtiment ancien remarquable',RELIGIOUS:'édifice religieux',WATER_TOWER:'château d’eau',SILO_TANK:'silo / cuve',OTHER:'autre',UNKNOWN:'usage non établi'};
export function architectureFacts(e){if(!e)return [];const r=e.roof;
 return [`Profil architectural V2.3 : ${CLASS_LABELS[e.buildingClass]||e.buildingClass} (classe ${e.buildingClassConfidence==='unknown'?'inconnue':e.buildingClassConfidence}) · confiance globale ${e.confidenceOverall==='unknown'?'inconnue':e.confidenceOverall}`,
  `Toiture : ${ROOF[r.type]}${r.type==='unknown'?'':` (${r.confidence}, ${STATUS[r.typeStatus]||r.typeStatus})`}${r.ridgeOrientationDeg!=null?` · faîtage ${r.ridgeOrientationDeg}° (${r.ridgeOrientationConfidence})`:r.ridgeOrientationStatus==='not_applicable'?' · sans faîtage':''}${r.slopeDeg?` · pente ${r.slopeDeg}°`:''}`,
  `Couleur de toit : ${COLOR[r.colorFamily]}${r.colorFamily==='unknown'?'':` (${r.colorConfidence})`} · matériau : ${MAT[r.material]}${r.material==='unknown'?'':` (${r.materialConfidence}, ${STATUS[r.materialStatus]||r.materialStatus})`}`,
  `Hauteur à l’égout ${h(e.wallHeightM,e.wallHeightStatus)} · point haut ${h(e.totalHeightM,e.totalHeightStatus)}`,
  `Niveaux : ${e.levels==null?'inconnus':`${e.levels} (${STATUS[e.levelsStatus]})`}${e.visibleStoreys?` · ${e.visibleStoreys} lisible${e.visibleStoreys>1?'s':''} en façade`:''} · empreinte ${FOOT[e.shape.footprintFamily]||e.shape.footprintFamily}`,
  ...(e.notes?[`Note : ${e.notes}`]:[]),`Sources : ${e.sources.join(' ; ')}`];}
