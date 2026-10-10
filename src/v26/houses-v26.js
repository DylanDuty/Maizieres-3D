import * as THREE from 'three';
import {insidePoly,bounds,area} from '../geo.js';
import {shapeRings} from '../geometry.js';
import {buildingProfile} from '../building-profile.js';
import {applyArchitecture,roofSurface,splitByLines,edgeCuts} from '../architecture.js';
import {fnv,mulberry,RES,outward,range,offsetRing,roofFn,Tri,groupedMesh,box,isLongest,UP,DOWN} from '../v25/procedural-houses.js';

// V2.6 Poussey diorama — illustrated houses on the frozen footprints. Same geometry rules as V2.5 (profile-driven roof
// type, ridge, heights, overhang, fascia, soffit, chimney) but a storybook language: flat pastel walls, roofs in a
// harmonised family of the documented colour, a few large openings drawn as flat panels (frame, pane, shutters, door),
// one material per surface family and no texture. Decorative only; footprints, heights and roof types are the data.
export const PALETTE={
 wall:['#f7f0e1','#f3e7d0','#f0e1c8','#f5dec4','#efd8cb','#ebdec2','#e8e8d2','#f2ecdd','#f4e3d2','#f2dcd3','#e9e7d0'],
 annex:['#e9e2ce','#e3dccb','#ece5d4','#dfd9c8'],wood:['#b48c66','#a7805b','#c09b72','#9a785c'],steel:['#dcded7','#d2d8d5','#e2dccd','#cbd1cd'],
 shutter:['#6f94ae','#7fa27d','#a9bdc1','#b86c5c','#d4bf93','#5d8294','#e9e3d0','#8ca688'],door:['#6c584b','#7d604b','#4e5d68','#8b7863','#5b6b5d'],
 glass:'#cfe5ee',frame:'#fbf8f1',fascia:'#f6f0e4',cap:'#4f4c49',civic:['#ede4d0','#e7ddc7','#f1e9d9','#e3d9c3']};
const clamp=THREE.MathUtils.clamp;
// V2.6.1 big-building variants (hangar, farm, industrial, commercial, silo / technical, large flat): a warmer or cooler
// family of tints, a darker base band and panel joints (shader), a ribbed sheet roof, a skylight strip on the ridge, a
// high window band or a sign band. Footprint, height, roof type and documented colour family are untouched; a grey
// documented roof is only nudged toward the variant's tint.
export const BIG={
 HANGAR:{walls:['#d2bf9a','#c6b494','#b6c0b8','#cbb192'],roofs:['#b9c3c9','#c9b9a6','#aab6a8','#c88a72'],panels:true,sheet:true,skylight:true,band:false},
 FARM:{walls:['#d9c6a3','#cdb99a','#cfbc9e'],roofs:['#c88a72','#bb7560','#c9b9a6'],panels:true,sheet:true,skylight:false,band:false},
 INDUSTRIAL:{walls:['#bcc7cf','#c5cdd2','#b4bfc6','#cdc4b1','#c0cac0','#d3c7ae'],roofs:['#9ea9b1','#a6b0b6','#b3a996','#9fb0a4','#a8b4bd'],panels:true,sheet:true,skylight:true,band:true},
 COMMERCIAL:{walls:['#e6d5bb','#eadfc7','#e2d3b9','#d9d6c6','#e8dcc9'],roofs:['#aba397','#b3ab9e','#9fa7ab'],panels:false,sheet:false,skylight:false,band:true,sign:'#c96b5b'},
 SILO_TANK:{walls:['#d8dbd9','#d2d9dc'],roofs:['#a2abb0'],panels:true,sheet:true,skylight:false,band:false},
 FLAT:{walls:['#dcd6c9','#d5d2c7','#e2d8c8'],roofs:['#b8b2a5'],panels:true,sheet:false,skylight:false,band:true}};
// Harmonised family of a documented colour: hue kept, saturation and lightness brought into the diorama range.
// V2.6.1: a documented grey family becomes a soft blue-slate grey (still grey, no longer dull); other hues keep their tint.
export function harmonise(hex,{sMin=.46,sMax=.66,lMin=.4,lMax=.52}={}){const c=new THREE.Color(hex),h={};c.getHSL(h);if(h.s<.12)return c.setHSL(.58,.14,clamp(h.l*1.1,Math.max(lMin,.46),Math.max(lMax,.58)));return c.setHSL(h.h,clamp(h.s*1.15,sMin,sMax),clamp(h.l*1.06,lMin,lMax));}

// Spatial index of the footprints: occupied(x, z, selfId) says whether a point lies inside another building. V2.7 uses it
// to skip openings on facades glued to a neighbour (dense centre) so no panel pokes through a lower roof next door.
export function footprintIndex(items,cell=25){const grid=new Map(),key=(x,z)=>`${Math.floor(x/cell)},${Math.floor(z/cell)}`;
 for(const it of items){const b=bounds(it.poly[0]);for(let x=Math.floor(b.minX/cell);x<=Math.floor(b.maxX/cell);x++)for(let z=Math.floor(b.minZ/cell);z<=Math.floor(b.maxZ/cell);z++){const k=`${x},${z}`;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(it);}}
 return (x,z,selfId)=>{const list=grid.get(key(x,z));if(!list)return false;for(const it of list)if(it.id!==selfId&&insidePoly([x,z],it.poly))return true;return false;};}
// V2.7: `special(ctx)` may draw a building itself (church); `occupied` filters openings against the neighbours.
export function buildHousesV26({items,enrichment={buildings:{}},architecture,elevation=()=>0,materials:M,special=null,occupied=null}){
 const walls=[new Tri(),new Tri()],roofs=[new Tri(),new Tri(),new Tri()],details=new Tri();const wallRanges=[],roofRanges=[],detailRanges=[];
 const C=new THREE.Color(),stats={buildings:0,variants:new Set(),windows:0,doors:0,garageDoors:0,shutters:0,chimneys:0,byClass:{},bigVariants:new Set()};
 const glass=new THREE.Color(PALETTE.glass),frame=new THREE.Color(PALETTE.frame),capCol=new THREE.Color(PALETTE.cap);
 for(const item of items){const {poly,t,id}=item,extra=item.extra||enrichment.buildings[id]||{};let p=buildingProfile(t,poly,extra,id);if(!p)continue;
  const arch=architecture?.get(item.featureId||id.split('#')[0])||null;if(arch)p=applyArchitecture(p,arch,poly);
  if(!p.arch){const across=p.axis.axis,along=[-across[1],across[0]];p.arch={across,along,a:{min:p.axis.min,max:p.axis.max},b:range(poly,along),shape:p.roofShape==='flat'?'flat':'gabled'};}
  const cls=arch?.buildingClass||'UNKNOWN',rng=mulberry(fnv(id)),pick=l=>l[Math.floor(rng()*l.length)];
  const dy=elevation(item)||0,base=dy+.35,eaveY=base+p.wallHeight;
  const res=RES(cls),garage=cls==='GARAGE',annex=['ANNEX','UNKNOWN','OTHER'].includes(cls),shed=cls==='SHED',green=cls==='GREENHOUSE',hall=['HANGAR','FARM','INDUSTRIAL','COMMERCIAL','SILO_TANK'].includes(cls),civic=['PUBLIC','HERITAGE','RELIGIOUS'].includes(cls),r2=cls==='RES_R2_PLUS';
  const big=BIG[cls]||(p.arch.shape==='flat'&&p.size>200&&!res&&!garage&&!shed?BIG.FLAT:null);if(big)stats.bigVariants.add(BIG[cls]?cls:'FLAT');
  const facade=big?pick(big.walls):civic?pick(PALETTE.civic):green?'#dcebe6':res?pick(PALETTE.wall):garage||annex?pick(PALETTE.annex):shed?pick(PALETTE.wood):hall?pick(PALETTE.steel):'#e4ded2';
  const shutters=res&&!civic&&rng()<.7?pick(PALETTE.shutter):null,doorCol=new THREE.Color(pick(PALETTE.door)),variant=`${facade}-${shutters||'n'}-${Math.round(rng()*2)}`;stats.variants.add(variant);
  const wW=civic?1.3:1.35+rng()*.25,wH=civic?1.95:1.45+rng()*.2,spacing=civic?3.6:4+rng()*1.1,storey=civic?3.4:2.8;
  const overhang=p.arch.shape==='flat'?0:res?(p.size<30?.3:.5):hall?.4:shed||green?.22:.32,thk=res?.24:.18;
  const tiled=p.arch.shape!=='flat'&&!(arch?.roof.material==='slate_like'||arch?.roof.material==='metal'||shed||hall);const roofPart=tiled?0:big?.sheet&&p.arch.shape!=='flat'?2:1,wallPart=big?.panels?1:0;
  const wallCol=C.set(facade).clone().offsetHSL(0,0,(rng()-.5)*.03);
  let roofCol=green?new THREE.Color('#dfeef0'):p.arch.shape==='flat'?new THREE.Color('#b9b3a6'):harmonise(p.roofColor,shed||hall?{sMin:.1,sMax:.3,lMin:.5,lMax:.66}:{});
  if(big){const h={};roofCol.getHSL(h);const tint=new THREE.Color(pick(big.roofs));roofCol=h.s<.12||p.arch.shape==='flat'?tint.lerp(roofCol,.35):roofCol.lerp(tint,.25);}
  const fasciaCol=new THREE.Color(PALETTE.fascia),soffitCol=fasciaCol.clone().multiplyScalar(.86);
  const h=roofFn(p),model=roofSurface(p),lines=model.lines,top=q=>eaveY+h(q);
  const w0=walls[wallPart].n,r0=roofs[roofPart].n,d0=details.n;
  if(cls==='WATER_TOWER'){waterTowerV26(poly,base,arch?.totalHeightM||p.wallHeight,details,C);}
  else if(special&&special({item,p,cls,base,eaveY,walls:walls[wallPart],roofs:roofs[roofPart],details,wallCol,roofCol})){}
  else{
   for(const [ri,r] of poly.entries())for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],pts=[a,...edgeCuts(a,b,lines).map(f=>[a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])]),b];let u=0;
    for(let j=1;j<pts.length;j++){const c=pts[j-1],d=pts[j],L=Math.hypot(d[0]-c[0],d[1]-c[1]),tc=top(c)-thk+.06,td=top(d)-thk+.06;if(p.kind!=='canopy')walls[wallPart].quad([c[0],base,c[1]],[d[0],base,d[1]],[d[0],td,d[1]],[c[0],tc,c[1]],wallCol,[[u,0],[u+L,0],[u+L,td-base],[u,tc-base]],outward(a,b,poly));u+=L;}
    if(ri===0)panels(a,b,poly,p,{res,garage,hall,big,civic,r2,id,occupied,base,eaveY,thk,wW,wH,spacing,storey,shutters,doorCol,rng,details,stats,top,glass,frame,wallCol});}
   const outer=poly.map((r,k)=>overhang?offsetRing(r,overhang,k>0):r),rings=shapeRings(outer),flat=rings.flat();
   const uvOf=q=>[dot(q,p.arch.along),dot(q,p.arch.across)];
   for(const tri of THREE.ShapeUtils.triangulateShape(rings[0],rings.slice(1))){const pts=tri.map(i=>[flat[i].x,flat[i].y]);for(const piece of splitByLines(pts,lines))for(let i=1;i<piece.length-1;i++){const v=[piece[0],piece[i],piece[i+1]];roofs[roofPart].tri(...v.map(q=>[q[0],top(q),q[1]]),roofCol,v.map(uvOf),UP);}}
   if(p.arch.shape==='flat'){for(const r of poly)for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];details.quad([a[0],eaveY-.02,a[1]],[b[0],eaveY-.02,b[1]],[b[0],eaveY+.4,b[1]],[a[0],eaveY+.4,a[1]],wallCol.clone().multiplyScalar(.94),null,outward(a,b,poly));}
    const inner=poly.map((r,k)=>offsetRing(r,-.25,k>0));for(const [k,r] of poly.entries())for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],c=inner[k][(i+1)%r.length],d=inner[k][i];if(!c||!d)continue;details.quad([a[0],eaveY+.4,a[1]],[b[0],eaveY+.4,b[1]],[c[0],eaveY+.4,c[1]],[d[0],eaveY+.4,d[1]],fasciaCol,null,UP);}}
   else for(const [k,r] of outer.entries()){const orig=poly[k];for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length],pts=[a,...edgeCuts(a,b,lines).map(f=>[a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1])]),b];
     const fo=outward(a,b,outer);for(let j=1;j<pts.length;j++){const c=pts[j-1],d=pts[j];details.quad([c[0],top(c)-thk,c[1]],[d[0],top(d)-thk,d[1]],[d[0],top(d),d[1]],[c[0],top(c),c[1]],fasciaCol,null,fo);}
     if(r.length===orig.length){const oa=orig[i],ob=orig[(i+1)%orig.length];details.quad([a[0],top(a)-thk,a[1]],[b[0],top(b)-thk,b[1]],[ob[0],top(ob)-thk,ob[1]],[oa[0],top(oa)-thk,oa[1]],soffitCol,null,DOWN);}}}
   // Ridge cap (lighter, like a painted highlight) and a cosy chimney on the larger pitched houses.
   if(model.ridge&&p.roofHeight>.4&&p.arch.shape!=='shed'){const {at,s0,s1}=model.ridge,{along}=p.arch,n=Math.max(2,Math.ceil((s1-s0)/1)),runs=[];let run=[];
    for(let k=0;k<=n;k++){const q=at(s0+(s1-s0)*k/n);if(insidePoly(q,poly)&&h(q)>=p.roofHeight-.08)run.push(q);else{if(run.length>1)runs.push(run);run=[];}}if(run.length>1)runs.push(run);
    const cap=roofCol.clone().offsetHSL(0,-.05,.1);for(const r of runs)for(let k=1;k<r.length;k++){const a=r[k-1],b=r[k],o=[along[0]*.22,along[1]*.22],ya=top(a)+.1,yb=top(b)+.1;details.quad([a[0]-o[1],ya,a[1]+o[0]],[b[0]-o[1],yb,b[1]+o[0]],[b[0]+o[1],yb,b[1]-o[0]],[a[0]+o[1],ya,a[1]-o[0]],cap,null,UP);}
    // Big buildings: a pale skylight strip along the ridge (a stylised cue, not a surveyed opening).
    if(big?.skylight&&p.size>120){const sky=new THREE.Color('#dfeef3');for(const r of runs)for(let k=1;k<r.length;k++){const a=r[k-1],b=r[k],o=[along[0]*.7,along[1]*.7],ya=top(a)+.16,yb=top(b)+.16;details.quad([a[0]-o[1],ya,a[1]+o[0]],[b[0]-o[1],yb,b[1]+o[0]],[b[0]+o[1],yb,b[1]-o[0]],[a[0]+o[1],ya,a[1]-o[0]],sky,null,UP);}}
    if(res&&['gable','hip'].includes(p.arch.type)&&p.size>55&&rng()<.7){const q=at(s0+(s1-s0)*(.3+rng()*.4)),o=[p.arch.across[0]*.9,p.arch.across[1]*.9],c=[q[0]+o[0]*(rng()<.5?1:-1),q[1]+o[1]*(rng()<.5?1:-1)];if(insidePoly(c,poly)){box(details,c,.62,.62,top(c)-.6,top(c)+1.25,wallCol.clone().multiplyScalar(.9),p.arch.along);box(details,c,.76,.76,top(c)+1.25,top(c)+1.42,capCol,p.arch.along);stats.chimneys++;}}}
  }
  if(walls[wallPart].n>w0)wallRanges.push({part:wallPart,start:w0,end:walls[wallPart].n,id});if(roofs[roofPart].n>r0)roofRanges.push({part:roofPart,start:r0,end:roofs[roofPart].n,id});if(details.n>d0)detailRanges.push({part:0,start:d0,end:details.n,id});
  stats.buildings++;stats.byClass[cls]=(stats.byClass[cls]||0)+1;
 }
 const group=new THREE.Group();group.name='v26-houses';
 const wallMesh=groupedMesh(walls,[M.wall,M.wallPanels],wallRanges,'v26-walls'),roofMesh=groupedMesh(roofs,[M.roofTile,M.roofPlain,M.roofSheet],roofRanges,'v26-roofs'),detailMesh=groupedMesh([details],[M.detail],detailRanges,'v26-details');
 for(const m of [wallMesh,roofMesh,detailMesh])if(m)group.add(m);
 stats.variants=stats.variants.size;stats.bigVariants=[...stats.bigVariants];
 return {group,pickMeshes:[wallMesh,roofMesh,detailMesh].filter(Boolean),stats};
}
const dot=(q,v)=>q[0]*v[0]+q[1]*v[1];

// Openings as flat painted panels on the facade: a pale frame, a sky-coloured pane, shutters, a door with its frame.
function panels(a,b,poly,p,o){const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<3.4||p.kind==='canopy')return;
 const ux=dx/len,uz=dz/len;let nx=-uz,nz=ux;if(insidePoly([(a[0]+b[0])/2+nx*.3,(a[1]+b[1])/2+nz*.3],poly)){nx=-nx;nz=-nz;}const N=[nx,0,nz];
 if(o.occupied&&o.occupied((a[0]+b[0])/2+nx*.5,(a[1]+b[1])/2+nz*.5,o.id))return;
 const panel=(u,y,w,h,depth,col)=>{const x0=a[0]+ux*(u-w/2)+nx*depth,z0=a[1]+uz*(u-w/2)+nz*depth,x1=a[0]+ux*(u+w/2)+nx*depth,z1=a[1]+uz*(u+w/2)+nz*depth;o.details.quad([x0,y-h/2,z0],[x1,y-h/2,z1],[x1,y+h/2,z1],[x0,y+h/2,z0],col,null,N);};
 const eave=Math.min(o.top(a),o.top(b))-o.thk,longest=isLongest(a,b,poly);
 if(o.garage){if(longest&&len>=3.6&&o.eaveY-o.base>=2.2){panel(len/2,o.base+1.1,Math.min(2.6,len-.9)+.16,2.2,.02,o.frame);panel(len/2,o.base+1.08,Math.min(2.6,len-.9),2.05,.04,new THREE.Color('#e2ded3'));o.stats.garageDoors++;}return;}
 if(o.hall||o.big){const B=o.big||{};if(longest&&len>=6){const w=Math.min(4.2,len*.4),h=Math.min(3.4,o.eaveY-o.base-.6);panel(len/2,o.base+h/2+.1,w+.16,h+.12,.02,o.frame);panel(len/2,o.base+h/2+.1,w,h,.04,new THREE.Color('#cdd2cf'));o.stats.garageDoors++;
   if(B.sign)panel(len/2,Math.min(eave-.75,o.base+h+1.1),Math.min(len*.6,9),.55,.03,new THREE.Color(B.sign));}
  if(B.band){if(len>=8&&eave-o.base>=4){panel(len/2,eave-1.45,len-2.4,.95,.03,o.glass);o.stats.windows++;}}
  else for(let u=3;u<len-3;u+=6)if(eave-o.base>3.2){panel(u,eave-1.5,1.4,.9,.03,o.glass);o.stats.windows++;}return;}
 if(!o.res)return;
 const floors=Math.max(1,Math.min(o.r2?3:2,Math.floor((eave-o.base-.9)/o.storey)));
 let doorU=-1;if(longest&&len>=5.5&&eave-o.base>=2.5){doorU=1.4+o.rng()*(len-2.8);panel(doorU,o.base+1.12,1.16,2.24,.02,o.frame);panel(doorU,o.base+1.1,1,2.1,.04,o.doorCol);o.stats.doors++;}
 for(let f=0;f<floors;f++){const y=o.base+1.05+f*o.storey+o.wH/2;if(y+o.wH/2>eave-.3)continue;let count=0;
  for(let u=1.6+o.rng()*.5;u<len-1.5&&count<4;u+=o.spacing){if(doorU>=0&&f===0&&Math.abs(u-doorU)<o.wW/2+1)continue;
   panel(u,y,o.wW+.18,o.wH+.18,.02,o.frame);panel(u,y,o.wW,o.wH,.04,o.glass);panel(u,y+o.wH*.02,o.wW*.08,o.wH*.9,.05,o.frame);o.stats.windows++;count++;
   if(o.shutters){const s=new THREE.Color(o.shutters);panel(u-o.wW/2-.33,y,.46,o.wH+.08,.03,s);panel(u+o.wW/2+.33,y,.46,o.wH+.08,.03,s);o.stats.shutters+=2;}}}}

// Water tower: shaft, widened tank and conical cap on the documented total height (a silhouette, not a survey).
function waterTowerV26(poly,base,totalH,t,C){const bb=bounds(poly[0]),cx=(bb.minX+bb.maxX)/2,cz=(bb.minZ+bb.maxZ)/2,r=Math.sqrt(area(poly[0])/Math.PI),n=28,ring=(rad,y)=>Array.from({length:n},(_,i)=>[cx+Math.cos(i/n*6.2832)*rad,y,cz+Math.sin(i/n*6.2832)*rad]);
 const shaft=C.set('#e9e2d3').clone(),tank=C.set('#f3ecdc').clone(),cap=C.set('#7d92a8').clone(),band=C.set('#c9d6df').clone();
 const seg=(r0,y0,r1,y1,col)=>{const A=ring(r0,y0),B=ring(r1,y1);for(let i=0;i<n;i++){const j=(i+1)%n;t.quad(A[i],A[j],B[j],B[i],col,[[i*r0*.22,0],[(i+1)*r0*.22,0],[(i+1)*r1*.22,y1-y0],[i*r1*.22,y1-y0]],[(A[i][0]+A[j][0])/2-cx,0,(A[i][2]+A[j][2])/2-cz]);}};
 const sh=base+totalH*.7,tankTop=base+totalH*.92,tip=base+totalH;
 seg(r*.98,base,r*.9,sh,shaft);seg(r*.9,sh,r*1.75,sh+1.2,tank);seg(r*1.75,sh+1.2,r*1.75,sh+1.9,band);seg(r*1.75,sh+1.9,r*1.75,tankTop,tank);seg(r*1.75,tankTop,r*1.6,tankTop+.3,cap);
 const top=ring(r*1.6,tankTop+.3);for(let i=0;i<n;i++)t.tri(top[i],[cx,tip,cz],top[(i+1)%n],cap,null,UP);}
