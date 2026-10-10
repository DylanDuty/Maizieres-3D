import * as THREE from 'three';
import {random} from '../geo.js';
import {waterProximity,HEDGE_WATER_MARGIN} from '../hydro-display.js';
import {ARCHETYPES,crown,trunkGeo,BUSH_PALETTE} from '../v26/vegetation-v26.js';

// V2.7 — vegetation for the whole commune in the V2.6 language, with a budget. Woods are a canopy mass (an 8 m lumpy
// surface per frozen polygon, cluster hues, a skirt down to the wood floor) plus a few edge and emergent trees for the
// silhouette; poplar plantations keep their rows with holes; villages get garden trees, blossoms, shrubs and flower beds;
// stream banks get riparian trees; DSB hedges become chains of soft blobs that never cover water. Every instance is
// sorted into 1,5 km tiles (frustum culling) and uses the near (detail 1) or far (detail 0) crown. Decorative only.
const inRing=(x,z,r)=>{let c=false;for(let i=0,j=r.length-2;i<r.length;j=i,i+=2)if((r[i+1]>z)!==(r[j+1]>z)&&x<(r[j]-r[i])*(z-r[i+1])/(r[j+1]-r[i+1])+r[i])c=!c;return c;};
const inPoly=(x,z,p)=>inRing(x,z,p[0])&&!p.slice(1).some(h=>inRing(x,z,h));
const h12=(x,y)=>{const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);};
const vnoise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);const a=h12(ix,iy),b=h12(ix+1,iy),c=h12(ix,iy+1),d=h12(ix+1,iy+1);return (a+(b-a)*sx)+((c+(d-c)*sx)-(a+(b-a)*sx))*sy;};
const CANOPY=['#86bb62','#79b25a','#6daa58','#93c46a','#63a060','#80b566'];
const TILE=1500;

export function buildVegetationV27(parent,{v2,box,buildings,heightAt,materials:M,q}){
 const {data:d}=v2,rng=random(10227),inBox=(x,z)=>x>=box.minX&&x<=box.maxX&&z>=box.minZ&&z<=box.maxZ;
 // Raster mask (about 2 m/px over the commune): footprints, roads, rail, water surfaces and lines are off-limits.
 const W=box.maxX-box.minX,D=box.maxZ-box.minZ,MW=3072,MH=Math.round(MW*D/W),mask=document.createElement('canvas');mask.width=MW;mask.height=MH;const ctx=mask.getContext('2d',{willReadFrequently:true}),sx=MW/W,sz=MH/D;
 const X=x=>(x-box.minX)*sx,Z=z=>(z-box.minZ)*sz;ctx.fillStyle='#000';ctx.strokeStyle='#000';ctx.lineCap='round';ctx.lineJoin='round';
 const fillRings=rings=>{ctx.beginPath();for(const r of rings){for(let i=0;i<r.length;i+=2)i?ctx.lineTo(X(r[i]),Z(r[i+1])):ctx.moveTo(X(r[i]),Z(r[i+1]));ctx.closePath();}ctx.fill('evenodd');ctx.lineWidth=Math.max(1.5,3*sx);ctx.stroke();};
 const line=(p,stride,widthM)=>{ctx.lineWidth=Math.max(1.5,widthM*sx);ctx.beginPath();for(let i=0;i<p.length;i+=stride)i?ctx.lineTo(X(p[i]),Z(p[i+1])):ctx.moveTo(X(p[i]),Z(p[i+1]));ctx.stroke();};
 for(const b of buildings)fillRings(b.poly.map(r=>r.flat()));
 for(const r of d.roads)line(r.p,3,(r.w||3)+4.5);for(const t of d.rail)line(t.p,3,9);for(const l of d.waterLines)line(l.p,2,(l.w||3)+3);
 for(const a of [...d.water,...d.artificial.filter(a=>a.kind==='surface')])for(const p of a.r)fillRings(p);
 const px=ctx.getImageData(0,0,MW,MH).data,blocked=(x,z)=>{const i=Math.floor(X(x)),j=Math.floor(Z(z));return i<0||j<0||i>=MW||j>=MH||px[(j*MW+i)*4+3]>0;};
 // V2.9: riparian corridor raster. Grid vertices of a canopy mass that lie within the corridor of a watercourse are
 // treated as outside the wood, so the stream stays visible under a soft-edged gap instead of vanishing under the mass.
 const corridorW=q?.riparianCorridor??0;let inCorridor=()=>false;
 if(corridorW>0){const cv=document.createElement('canvas');cv.width=MW;cv.height=MH;const cx2=cv.getContext('2d',{willReadFrequently:true});cx2.strokeStyle='#000';cx2.lineCap='round';cx2.lineJoin='round';
  for(const l of d.waterLines){cx2.lineWidth=Math.max(2,((l.w||3)+corridorW)*sx);cx2.beginPath();for(let i=0;i<l.p.length;i+=2)i?cx2.lineTo(X(l.p[i]),Z(l.p[i+1])):cx2.moveTo(X(l.p[i]),Z(l.p[i+1]));cx2.stroke();}
  const cpx=cx2.getImageData(0,0,MW,MH).data;inCorridor=(x,z)=>{const i=Math.floor(X(x)),j=Math.floor(Z(z));return i>=0&&j>=0&&i<MW&&j<MH&&cpx[(j*MW+i)*4+3]>0;};}
 const bbox=p=>{let b=[Infinity,Infinity,-Infinity,-Infinity];for(const r of p)for(let i=0;i<r.length;i+=2)b=[Math.min(b[0],r[i]),Math.min(b[1],r[i+1]),Math.max(b[2],r[i]),Math.max(b[3],r[i+1])];return b;};
 const list=[],add=(x,z,type,h,lod,hue=null,wide=1)=>{if(!inBox(x,z)||blocked(x,z))return;list.push({x,z,type,h,lod,hue,wide});};
 const choose=w=>{let t=rng()*w.reduce((a,[,v])=>a+v,0);for(const [k,v] of w){t-=v;if(t<=0)return k;}return w[0][0];};
 const group=new THREE.Group();group.name='v27-vegetation';
 // ---- Woods: canopy masses ----
 // One indexed, smooth-shaded lumpy surface per polygon: interior vertices at the canopy height (two-scale noise), the
 // first ring inside at 60 %, the first ring outside lifted 20 % (a rounded edge instead of a cliff), the rest on the
 // ground. Vertices and indices are appended to the 1,5 km tile of the polygon's centre.
 const canopy=new Map();let canopyCells=0;
 const addCanopy=(poly,type,hueSeed)=>{const b=bbox(poly),step=8,H=(type==='peupleraie'?11:type==='lande_ligneuse'?3:type==='foret_ouverte'?7:11.5)*(.88+.24*h12(b[0],b[1])),x0=Math.floor(b[0]/step)*step,z0=Math.floor(b[1]/step)*step,cols=Math.ceil((b[2]-x0)/step)+2,rows=Math.ceil((b[3]-z0)/step)+2;
  if(cols*rows>400000)return;const inside=new Uint8Array(cols*rows);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const x=x0+c*step,z=z0+r*step;inside[r*cols+c]=inPoly(x,z,poly)&&!inCorridor(x,z)?1:0;}
  const nb=(c,r)=>{let n=0,t=0;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const cc=c+dc,rr=r+dr;if(cc<0||rr<0||cc>=cols||rr>=rows)continue;t++;n+=inside[rr*cols+cc];}return [n,t];};
  const key=`${Math.floor((b[0]+b[2])/2/TILE)},${Math.floor((b[1]+b[3])/2/TILE)}`;if(!canopy.has(key))canopy.set(key,{p:[],c:[],i:[]});const t=canopy.get(key),base=t.p.length/3,used=new Int32Array(cols*rows).fill(-1);
  // Profile folded inside the polygon: boundary ring 35 %, second ring 75 %, interior 100 %; nothing outside (the
  // painted wood floor shows around the mass instead of a skirt over the fields).
  const factor=new Float32Array(cols*rows);for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const k=r*cols+c;if(!inside[k])continue;const [n,tot]=nb(c,r);factor[k]=n===tot?1:.35;}
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const k=r*cols+c;if(factor[k]!==1)continue;let edge=false;for(let dr=-1;dr<=1&&!edge;dr++)for(let dc=-1;dc<=1;dc++){const cc=c+dc,rr=r+dr;if(cc<0||rr<0||cc>=cols||rr>=rows)continue;if(factor[rr*cols+cc]===.35){edge=true;break;}}if(edge)factor[k]=.75;}
  const vertex=k=>{if(used[k]>=0)return used[k];const c=k%cols,r=Math.floor(k/cols),x=x0+c*step,z=z0+r*step,g=heightAt(x,z),fct=factor[k];
   const y=g+(fct>0?H*fct*(.78+.28*vnoise(x/21+hueSeed,z/21)+.1*vnoise(x/6,z/6)):.1);t.p.push(x,y,z);
   const n1=vnoise(x/70+5,z/70),n2=vnoise(x/160+9,z/160),col=new THREE.Color(CANOPY[0]).lerp(new THREE.Color(CANOPY[4]),n2).lerp(new THREE.Color(CANOPY[3]),n1*.6).multiplyScalar((fct>=1?.9+.2*vnoise(x/9,z/9):fct>=.75?.84:.66)*(type==='peupleraie'?1.06:1));t.c.push(col.r,col.g,col.b);used[k]=base+(t.p.length/3-1-base);return used[k];};
  for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){const a=r*cols+c,bq=a+1,e=a+cols,f=e+1;if(!(factor[a]||factor[bq]||factor[e]||factor[f]))continue;canopyCells++;t.i.push(vertex(a),vertex(e),vertex(bq),vertex(bq),vertex(e),vertex(f));}};
 for(const o of d.woodland)for(const p of o.r){const b=bbox(p);if(b[2]<box.minX||b[0]>box.maxX||b[3]<box.minZ||b[1]>box.maxZ)continue;addCanopy(p,o.t,b[0]*.01);
  const poplar=o.t==='peupleraie',area=(b[2]-b[0])*(b[3]-b[1]);
  if(poplar){const s=q.poplarStep;for(let x=b[0];x<b[2];x+=s)for(let z=b[1];z<b[3];z+=s){if(rng()<.15)continue;const qx=x+rng()*s*.7,qz=z+rng()*s*.7;if(!inPoly(qx,qz,p))continue;add(qx,qz,'poplar',14+rng()*9,0,h12(Math.floor(qx/45),Math.floor(qz/45)),.8+rng()*.5);}}
  else if(o.t!=='lande_ligneuse'){
   // Edge trees along the rings, slightly inside; emergent trees inside.
   if(q.edgeStep)for(const ring of p){let travel=0;for(let i=2;i<ring.length;i+=2){const ax=ring[i-2],az=ring[i-1],bx=ring[i],bz=ring[i+1],L=Math.hypot(bx-ax,bz-az)||1,ux=(bx-ax)/L,uz=(bz-az)/L;
    for(let s=travel%q.edgeStep;s<L;s+=q.edgeStep){const inset=2+rng()*5,qx=ax+ux*s+uz*inset,qz=az+uz*s-ux*inset;const qx2=ax+ux*s-uz*inset,qz2=az+uz*s+ux*inset;const [tx,tz]=inPoly(qx,qz,p)?[qx,qz]:[qx2,qz2];if(!inPoly(tx,tz,p))continue;add(tx,tz,choose([['round',4],['broad',3],['tall',2]]),10+rng()*5,0,h12(Math.floor(tx/45),Math.floor(tz/45)),1.15);}travel+=L;}}
   if(q.emergentStep)for(let k=Math.round(area/(q.emergentStep*q.emergentStep));k>0;k--){const qx=b[0]+rng()*(b[2]-b[0]),qz=b[1]+rng()*(b[3]-b[1]);if(!inPoly(qx,qz,p))continue;add(qx,qz,choose([['round',3],['tall',3],['broad',2]]),13+rng()*5,0,h12(Math.floor(qx/45),Math.floor(qz/45)),1.1);}}}
 // ---- Villages: gardens ----
 const cell=q.gardenCell;for(const v of d.village)for(const p of v.r){const b=bbox(p);for(let x=Math.max(b[0],box.minX);x<Math.min(b[2],box.maxX);x+=cell)for(let z=Math.max(b[1],box.minZ);z<Math.min(b[3],box.maxZ);z+=cell){const qx=x+rng()*cell,qz=z+rng()*cell;if(!inPoly(qx,qz,p))continue;const t=rng();
  if(t<.3)add(qx,qz,choose([['fruit',5],['round',2],['blossom',1.4]]),4.5+rng()*4,q.lod);else if(t<.42)add(qx,qz,'bush',1+rng()*.9,0);else if(t<.52)add(qx,qz,'flowers',.7+rng()*.5,0);}}
 if(q.houseShrubs)for(const b of buildings){const r=b.poly[0];let cx=0,cz=0;for(const pt of r){cx+=pt[0];cz+=pt[1];}cx/=r.length;cz/=r.length;let R=0;for(const pt of r)R=Math.max(R,Math.hypot(pt[0]-cx,pt[1]-cz));if(R>14||rng()<.3)continue;
  for(let k=0,n=1+Math.floor(rng()*3);k<n;k++){const a=rng()*6.283,dd=R+1.6+rng()*3.2,qx=cx+Math.cos(a)*dd,qz=cz+Math.sin(a)*dd,t=rng();add(qx,qz,t<.55?'bush':t<.85?'flowers':'fruit',t<.55?.9+rng()*.8:t<.85?.6+rng()*.4:3.5+rng()*2,0);}}
 // ---- Stream banks ----
 for(const l of d.waterLines){const p=l.p,w=(l.w||3)/2;let travel=0;for(let i=2;i<p.length;i+=2){const ax=p[i-2],az=p[i-1],bx=p[i],bz=p[i+1],L=Math.hypot(bx-ax,bz-az)||1,ux=(bx-ax)/L,uz=(bz-az)/L;
  for(let s=travel%q.riparianStep;s<L;s+=q.riparianStep){const side=rng()<.5?-1:1,off=w+3+rng()*7,qx=ax+ux*s-uz*side*off,qz=az+uz*s+ux*side*off;if(rng()<.5)add(qx,qz,choose([['tall',5],['broad',3],['round',2]]),7.5+rng()*7,0,.8+rng()*.2);}travel+=L;}}
 // ---- Hedges ----
 const nearWater=waterProximity(d.waterLines,d.water),hedges=[];
 for(const hd of d.hedges){const p=hd.p,H=Math.min(4.5,hd.h||2.2),w=Math.min(5,hd.w||2.2);for(let i=3;i<p.length;i+=3){const ax=p[i-3],az=p[i-2],bx=p[i],bz=p[i+1],L=Math.hypot(bx-ax,bz-az),ux=(bx-ax)/(L||1),uz=(bz-az)/(L||1),ang=Math.atan2(ux,uz);
  for(let s=1.2;s<L;s+=q.hedgeStep){const j=(rng()-.5)*.5,qx=ax+ux*s-uz*j,qz=az+uz*s+ux*j;if(!inBox(qx,qz)||nearWater(qx,qz,w/2+HEDGE_WATER_MARGIN))continue;if(blocked(qx,qz)&&rng()<.7)continue;hedges.push({x:qx,z:qz,ang:ang+(rng()-.5)*.3,sx:w*(.85+rng()*.4)+.9+q.hedgeStep*.2,sy:H*(.85+rng()*.35),sz:3.8+rng()*1.4+q.hedgeStep*.3});}}}
 // ---- Build: canopy meshes per tile, instanced crowns per (type, lod, tile) ----
 let canopyTris=0;for(const [key,t] of canopy){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(t.p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(t.c,3));g.setIndex(t.i);g.computeVertexNormals();const m=new THREE.Mesh(g,M.leaf);m.name='v27-canopy-'+key;m.castShadow=true;m.receiveShadow=true;group.add(m);canopyTris+=t.i.length/3;}
 const geos=new Map(),geo=(type,lod)=>{const k=type+lod;if(!geos.has(k)){const A=ARCHETYPES[type];geos.set(k,crown(A.lobes,type.length*2.3,lod,A.gradient));}return geos.get(k);};
 const buckets=new Map();for(const t of list){const k=`${t.type}:${t.lod}:${Math.floor(t.x/TILE)},${Math.floor(t.z/TILE)}`;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(t);}
 const o3=new THREE.Object3D(),col=new THREE.Color();const byType={};let meshes=0,trunks=[];
 for(const [k,mine] of buckets){const [type,lod]=k.split(':'),A=ARCHETYPES[type];const m=new THREE.InstancedMesh(geo(type,+lod),M.leaf,mine.length);m.castShadow=true;m.receiveShadow=true;m.name='v27-trees-'+k;
  mine.forEach((t,i)=>{const g=heightAt(t.x,t.z),s=t.h;o3.position.set(t.x,g,t.z);o3.rotation.set((rng()-.5)*.06,rng()*6.28,(rng()-.5)*.06);o3.scale.set(s*t.wide*(.9+rng()*.25),s,s*t.wide*(.9+rng()*.25));o3.updateMatrix();m.setMatrixAt(i,o3.matrix);
   const ci=t.hue==null?Math.floor(rng()*A.palette.length):Math.floor(t.hue*A.palette.length)%A.palette.length;m.setColorAt(i,col.set(A.palette[ci]).offsetHSL((rng()-.5)*.015,0,(rng()-.5)*.06));
   if(A.trunk)trunks.push({x:t.x,z:t.z,g,s,f:A.trunk,tile:k.split(':')[2]});});
  byType[type]=(byType[type]||0)+mine.length;group.add(m);meshes++;}
 const trunkTiles=new Map();for(const t of trunks){if(!trunkTiles.has(t.tile))trunkTiles.set(t.tile,[]);trunkTiles.get(t.tile).push(t);}
 const trunkG=trunkGeo();for(const [tile,mine] of trunkTiles){const m=new THREE.InstancedMesh(trunkG,M.trunk,mine.length);m.castShadow=true;m.name='v27-trunks-'+tile;mine.forEach((t,i)=>{o3.position.set(t.x,t.g,t.z);o3.rotation.set(0,rng()*6.28,0);o3.scale.set(t.s*.12,t.s*t.f*1.1,t.s*.12);o3.updateMatrix();m.setMatrixAt(i,o3.matrix);m.setColorAt(i,col.set('#8a7059').offsetHSL(0,0,(rng()-.5)*.08));});group.add(m);meshes++;}
 const hedgeTiles=new Map();for(const h of hedges){const k=`${Math.floor(h.x/TILE)},${Math.floor(h.z/TILE)}`;if(!hedgeTiles.has(k))hedgeTiles.set(k,[]);hedgeTiles.get(k).push(h);}
 const hedgeG=crown(ARCHETYPES.bush.lobes,4.2,0);for(const [tile,mine] of hedgeTiles){const m=new THREE.InstancedMesh(hedgeG,M.leaf,mine.length);m.castShadow=true;m.receiveShadow=true;m.name='v27-hedges-'+tile;mine.forEach((h,i)=>{o3.position.set(h.x,heightAt(h.x,h.z)-.1,h.z);o3.rotation.set(0,h.ang,0);o3.scale.set(h.sx,h.sy,h.sz);o3.updateMatrix();m.setMatrixAt(i,o3.matrix);m.setColorAt(i,col.set(BUSH_PALETTE[i%4]).offsetHSL(0,0,(rng()-.5)*.05));});group.add(m);meshes++;}
 parent.add(group);
 return {group,stats:{trees:list.length,byType,hedgeBushes:hedges.length,canopyCells,canopyTriangles:canopyTris,canopyTiles:canopy.size,meshes,families:Object.keys(ARCHETYPES).length,tile:TILE}};
}
