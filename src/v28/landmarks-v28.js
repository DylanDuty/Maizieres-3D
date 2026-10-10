import * as THREE from 'three';
import {isChurch} from '../building-source.js';
import {UP,DOWN,outward,box} from '../v25/procedural-houses.js';
import {insidePoly,bounds,area} from '../geo.js';
import {shapeRings} from '../geometry.js';

// V2.8 — landmarks drawn from documented references, in the diorama language (flat colours, explicit facings, no
// texture). Each model is a stylised interpretation of what the written sources describe (plan, heights, materials,
// distinctive volumes), never a survey: the frozen footprints, positions and documented heights are read, not changed.
//
// Sources used for the shapes (see docs/audit/V2.8_LANDMARKS_WEB_REFERENCES_ART_DIRECTION.md):
// - Saint-Denis: Sauvegarde de l'Art Français (nave + bell-tower base late 11th / early 12th c., classical upper tower
//   ending in a small timber spire, 16th-c. stair tower with a pepper-pot roof against the north buttress between nave
//   and transept, double transept, five-sided apse), Fondation du patrimoine (tiles on the roman nave, slates on the
//   gothic apse and double transept), BIBLE_03 (nave higher than the aisles, three gables north, two south, buttresses,
//   modillion cornice).
// - War memorial: base des monuments aux morts (univ. Lille): obelisk on a pedestal, limestone, poilu medallion framed by
//   palm fronds, Croix de Guerre, 1914-18 and 1939-45.
// - Mairie: old postcard « La Mairie — Les Écoles » (BIBLE_03): brick-and-stone facade, vertical composition, arched
//   ground-floor bays, central balcony.
// - Water towers: no visual reference found; documented total heights only (silhouette kept generic).
const C=h=>new THREE.Color(h);
const PAL={
 stone:C('#e9dfc9'),stoneLight:C('#f3ecdb'),cornice:C('#f6efe2'),tile:C('#bf6d4e'),slate:C('#7d8da3'),slateDark:C('#6b7b91'),
 belfry:C('#5c6673'),glass:C('#3a434f'),frame:C('#efe7d4'),door:C('#5a4636'),
 concrete:C('#e4ded1'),concreteLight:C('#eee9dd'),band:C('#b9c7d3'),cap:C('#7d92a8'),mark:C('#8c96a0'),
 memStone:C('#e9e1cf'),memDark:C('#d2c8b4'),bronze:C('#6d5a3b'),bronzeLight:C('#8a7449'),
 brick:C('#b7704f'),brickStone:C('#ecdfc6'),fire:C('#c4463c')};
const norm=(a,b,c)=>{const nx=(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),ny=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),nz=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),L=Math.hypot(nx,ny,nz)||1;return [nx/L,ny/L,nz/L];};
const centroid2=r=>{let x=0,z=0;for(const q of r){x+=q[0];z+=q[1];}return [x/r.length,z/r.length];};

// Flat panel on the outside of an edge (a,b): centre at `u` metres along the edge, size w × h, pushed out by `depth`.
function facePanel(t,a,b,n,u,y,w,h,depth,col){const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1,ux=dx/L,uz=dz/L;
 const x0=a[0]+ux*(u-w/2)+n[0]*depth,z0=a[1]+uz*(u-w/2)+n[2]*depth,x1=a[0]+ux*(u+w/2)+n[0]*depth,z1=a[1]+uz*(u+w/2)+n[2]*depth;
 t.quad([x0,y-h/2,z0],[x1,y-h/2,z1],[x1,y+h/2,z1],[x0,y+h/2,z0],col,null,n);}
// Pointed top (lancet) or round top (fan) above a panel.
function lancetTop(t,a,b,n,u,yTop,w,depth,col){const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1,ux=dx/L,uz=dz/L;
 const P=(k,y)=>[a[0]+ux*(u+k)+n[0]*depth,y,a[1]+uz*(u+k)+n[2]*depth];t.tri(P(-w/2,yTop),P(w/2,yTop),P(0,yTop+w*.65),col,null,n);}
function roundTop(t,a,b,n,u,yTop,w,depth,col,segments=6){const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1,ux=dx/L,uz=dz/L,r=w/2;
 const P=(k,y)=>[a[0]+ux*(u+k)+n[0]*depth,y,a[1]+uz*(u+k)+n[2]*depth];const c=P(0,yTop);
 for(let i=0;i<segments;i++){const a0=Math.PI*i/segments,a1=Math.PI*(i+1)/segments;t.tri(c,P(Math.cos(a0)*r,yTop+Math.sin(a0)*r),P(Math.cos(a1)*r,yTop+Math.sin(a1)*r),col,null,n);}}
const edgeNormal=(a,b,poly)=>outward(a,b,poly);
function disc(t,a,b,n,u,y,r,depth,col,k=10){const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1,ux=dx/L,uz=dz/L;const P=(kx,ky)=>[a[0]+ux*(u+kx)+n[0]*depth,y+ky,a[1]+uz*(u+kx)+n[2]*depth];const c=P(0,0);
 for(let i=0;i<k;i++){const a0=i/k*6.2832,a1=(i+1)/k*6.2832;t.tri(c,P(Math.cos(a0)*r,Math.sin(a0)*r),P(Math.cos(a1)*r,Math.sin(a1)*r),col,null,n);}}

// ---------------------------------------------------------------------------------------------------------------------
// Église Saint-Denis
export function churchV28(item,p,{walls,roofs,details},dy){
 const poly=item.poly,ring=poly[0];
 const axis=p.axis;let u=[axis.axis[1],-axis.axis[0]];if(u[0]<0)u=u.map(n=>-n);const v=[-u[1],u[0]];
 const dp=(q,a)=>q[0]*a[0]+q[1]*a[1],us=ring.map(q=>dp(q,u)),vs=ring.map(q=>dp(q,v));
 const u0=Math.min(...us),u1=Math.max(...us),v0=Math.min(...vs),v1=Math.max(...vs),du=u1-u0,dv=v1-v0;
 const local=q=>[(dp(q,u)-u0)/du,(dp(q,v)-v0)/dv];const world=(a,b)=>[u[0]*(u0+a*du)+v[0]*(v0+b*dv),u[1]*(u0+a*du)+v[1]*(v0+b*dv)];
 const base=dy+.35,E=p.wallHeight;
 const S0=.36,S1=.91;// nave | double transept | choir and apse (plan proportions of the V2.4 documented model)
 const extent=(lo,hi)=>{let a=1,b=0;for(const q of ring){const [s,t]=local(q);if(s>=lo&&s<=hi){a=Math.min(a,t);b=Math.max(b,t);}}return b>a?[(a+b)/2,(b-a)/2]:[.5,.5];};
 const [tc,hw]=extent(0,.3),[tcA,hwA]=extent(S1+.02,1);
 const aisleEave=E*.58,aisleTop=E*.8,naveEave=E*1.04,naveRidge=E*1.52;
 // Height field above the base (metres): aisles as lean-tos, clerestory step, nave gable; transverse gables of the
 // double transept (the first south section lower: roman transept vestige); hip toward the five-sided apse.
 function h(s,t){
  if(s<S0){const q=Math.abs(t-tc)/hw;if(q>.56)return aisleEave+(aisleTop-aisleEave)*Math.max(0,(1-q))/.44;if(q>.53)return aisleTop+(naveEave-aisleTop)*(.56-q)/.03;return naveEave+(naveRidge-naveEave)*(1-q/.53);}
  if(s<=S1){const sec=[S0,.55,.74,S1];let i=0;while(i<2&&s>sec[i+1])i++;const mid=(sec[i]+sec[i+1])/2,half=(sec[i+1]-sec[i])/2;let rise=E*.52*Math.max(0,1-Math.abs(s-mid)/half);if(i===0&&t>tc+hw*.15)rise*=.55;return E+rise;}
  return E+E*.48*Math.max(0,Math.min(1-Math.abs(t-tcA)/Math.max(hwA,.2),(1-s)/(1-S1)));}
 const top=q=>base+h(...local(q));
 // Roof: fine triangulation of the plan, colour by zone and slope (steep clerestory faces take the wall colour).
 const rings=shapeRings(poly),flat=rings.flat();
 const emit=(a,b,c)=>{const A=[a[0],top(a),a[1]],B=[b[0],top(b),b[1]],Cc=[c[0],top(c),c[1]];const n=norm(A,B,Cc);const steep=Math.abs(n[1])<.5;const s=(local(a)[0]+local(b)[0]+local(c)[0])/3;
  roofs.tri(A,B,Cc,steep?PAL.stone:s<S0?PAL.tile:PAL.slate,null,UP);};
 function tri(a,b,c,depth=0){const ab=Math.hypot(a[0]-b[0],a[1]-b[1]),bc=Math.hypot(b[0]-c[0],b[1]-c[1]),ca=Math.hypot(c[0]-a[0],c[1]-a[1]);
  if(depth<14&&Math.max(ab,bc,ca)>1){if(ab>=bc&&ab>=ca){const m=[(a[0]+b[0])/2,(a[1]+b[1])/2];tri(a,m,c,depth+1);tri(m,b,c,depth+1);}else if(bc>=ca){const m=[(b[0]+c[0])/2,(b[1]+c[1])/2];tri(a,b,m,depth+1);tri(a,m,c,depth+1);}else{const m=[(c[0]+a[0])/2,(c[1]+a[1])/2];tri(a,b,m,depth+1);tri(m,b,c,depth+1);}}else emit(a,b,c);}
 for(const t of THREE.ShapeUtils.triangulateShape(rings[0],rings.slice(1)))tri(...t.map(i=>[flat[i].x,flat[i].y]));
 // Walls up to the roof edge, with a pale cornice band under the horizontal eaves (the documented modillion cornice).
 let roofTris=0;
 for(const r of poly)for(let i=1;i<r.length;i++){const a=r[i-1],b=r[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.05)continue;const n=edgeNormal(a,b,poly),nseg=Math.max(1,Math.ceil(len/.6));
  for(let j=0;j<nseg;j++){const q0=[a[0]+(b[0]-a[0])*j/nseg,a[1]+(b[1]-a[1])*j/nseg],q1=[a[0]+(b[0]-a[0])*(j+1)/nseg,a[1]+(b[1]-a[1])*(j+1)/nseg],y0=top(q0),y1=top(q1),L=len/nseg;
   walls.quad([q0[0],base,q0[1]],[q1[0],base,q1[1]],[q1[0],y1,q1[1]],[q0[0],y0,q0[1]],PAL.stone,[[0,0],[L,0],[L,y1-base],[0,y0-base]],n);
   if(Math.abs(y1-y0)/L<.25&&y0>base+4)details.quad([q0[0]+n[0]*.1,y0-.42,q0[1]+n[2]*.1],[q1[0]+n[0]*.1,y1-.42,q1[1]+n[2]*.1],[q1[0]+n[0]*.1,y1,q1[1]+n[2]*.1],[q0[0]+n[0]*.1,y0,q0[1]+n[2]*.1],PAL.cornice,null,n);}}
 // Openings: round-arched aisle windows on the nave, one lancet per transept gable, lancets on the apse panels,
 // west portal under an oculus. Flat painted panels, a few per wall, never a count taken from the sources.
 for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<2.4)continue;const n=edgeNormal(a,b,poly),mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],[s,t]=local(mid);
  const nv=n[0]*v[0]+n[2]*v[1],nu=n[0]*u[0]+n[2]*u[1];const eave=Math.min(top(a),top(b));
  if(s<S0&&Math.abs(nv)>.8&&len>=3.2&&eave>base+4.2){for(let x=2;x<len-1.6;x+=4.2){facePanel(details,a,b,n,x,base+3.0,1.06,1.5,.03,PAL.frame);facePanel(details,a,b,n,x,base+3.0,.9,1.4,.05,PAL.glass);roundTop(details,a,b,n,x,base+3.75,1.06,.03,PAL.frame);roundTop(details,a,b,n,x,base+3.75,.9,.05,PAL.glass,5);}}
  else if(s>=S0&&s<=S1&&Math.abs(nv)>.8&&len>=4.2){const w=1.5,y=base+5.1;facePanel(details,a,b,n,len/2,y,w+.16,3.4,.03,PAL.frame);facePanel(details,a,b,n,len/2,y,w,3.3,.05,PAL.glass);lancetTop(details,a,b,n,len/2,y+1.7,w+.16,.03,PAL.frame);lancetTop(details,a,b,n,len/2,y+1.65,w,.05,PAL.glass);}
  else if(s>S1&&len>=2.6&&nu>-.3){const w=1.1,y=base+5.0;facePanel(details,a,b,n,len/2,y,w+.14,3.0,.03,PAL.frame);facePanel(details,a,b,n,len/2,y,w,2.9,.05,PAL.glass);lancetTop(details,a,b,n,len/2,y+1.5,w+.14,.03,PAL.frame);lancetTop(details,a,b,n,len/2,y+1.45,w,.05,PAL.glass);}
  else if(s<.06&&nu<-.8&&len>=6){const [ta]=[local(a)[1]],tb=local(b)[1],lo=Math.min(ta,tb),hi=Math.max(ta,tb);if(tc>lo&&tc<hi){const uc=len*(tc-ta)/(tb-ta);facePanel(details,a,b,n,uc,base+1.7,2.5,3.4,.03,PAL.frame);facePanel(details,a,b,n,uc,base+1.68,2.2,3.3,.05,PAL.door);roundTop(details,a,b,n,uc,base+3.4,2.5,.03,PAL.frame);roundTop(details,a,b,n,uc,base+3.35,2.2,.05,PAL.door);
   const yo=base+naveEave+1.3;disc(details,a,b,n,uc,yo,.85,.03,PAL.frame);disc(details,a,b,n,uc,yo,.7,.05,PAL.glass);}}}
 // Square bell tower at the first crossing: stone body, dark belfry with pale louvres, short hip and a small slate spire
 // up to the documented total height (20,1 m above the base).
 const total=Math.max(p.wallHeight+9,(item.extra&&item.extra.totalHeightM)||20.1);
 const corners=[[.425,.36],[.55,.36],[.55,.63],[.425,.63]].map(q=>world(...q)),centre=world(.4875,.495);
 if(corners.every(q=>insidePoly(q,poly))){const yStone=base+E*.9,stoneTop=base+E+3.7,belfryTop=base+E+6.9,shoulder=base+E+8.1,tip=base+total;const upper=corners.map(q=>[centre[0]+(q[0]-centre[0])*.3,centre[1]+(q[1]-centre[1])*.3]);
  for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4],c=upper[(i+1)%4],d=upper[i],n=[(a[0]+b[0])/2-centre[0],0,(a[1]+b[1])/2-centre[1]];
   details.quad([a[0],yStone,a[1]],[b[0],yStone,b[1]],[b[0],stoneTop,b[1]],[a[0],stoneTop,a[1]],PAL.stone,null,n);
   details.quad([a[0],stoneTop,a[1]],[b[0],stoneTop,b[1]],[b[0],belfryTop,b[1]],[a[0],belfryTop,a[1]],PAL.belfry,null,n);
   // two pale louvre slits per face
   const L=Math.hypot(b[0]-a[0],b[1]-a[1]),nn=[n[0],0,n[2]];const nl=Math.hypot(nn[0],nn[2])||1;nn[0]/=nl;nn[2]/=nl;for(const k of [.36,.64])facePanel(details,a,b,nn,L*k,(stoneTop+belfryTop)/2,.5,2.2,.04,PAL.stoneLight);
   details.quad([a[0],belfryTop,a[1]],[b[0],belfryTop,b[1]],[c[0],shoulder,c[1]],[d[0],shoulder,d[1]],PAL.slate,null,n);
   details.tri([d[0],shoulder,d[1]],[c[0],shoulder,c[1]],[centre[0],tip,centre[1]],PAL.slateDark,null,n);}
  // thin cornice ring between stone and belfry
  for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4],n=[(a[0]+b[0])/2-centre[0],0,(a[1]+b[1])/2-centre[1]],o=.12,ox=n[0]/(Math.hypot(n[0],n[2])||1)*o,oz=n[2]/(Math.hypot(n[0],n[2])||1)*o;details.quad([a[0]+ox,stoneTop-.3,a[1]+oz],[b[0]+ox,stoneTop-.3,b[1]+oz],[b[0]+ox,stoneTop,b[1]+oz],[a[0]+ox,stoneTop,a[1]+oz],PAL.cornice,null,n);}}
 // Round stair turret with a pepper-pot roof against the north buttress between nave and transept (documented).
 const anchor=world(.34,.12);let radius=1.3;let ring12=null;for(const rr of [1.3,1.0,.8]){const cand=[];for(let i=0;i<12;i++)cand.push([anchor[0]+Math.cos(i*Math.PI/6)*rr,anchor[1]+Math.sin(i*Math.PI/6)*rr]);if(cand.every(q=>insidePoly(q,poly))){ring12=cand;radius=rr;break;}}
 if(ring12){const y0=base+E*.55,y1=base+E+2.6,y2=base+E+5.4;for(let i=0;i<12;i++){const a=ring12[i],b=ring12[(i+1)%12],n=[(a[0]+b[0])/2-anchor[0],0,(a[1]+b[1])/2-anchor[1]];details.quad([a[0],y0,a[1]],[b[0],y0,b[1]],[b[0],y1,b[1]],[a[0],y1,a[1]],PAL.stone,null,n);details.tri([a[0],y1,a[1]],[b[0],y1,b[1]],[anchor[0],y2,anchor[1]],PAL.slate,null,n);}}
 return {maxHeight:total,roofTris};
}

// ---------------------------------------------------------------------------------------------------------------------
// Water towers: slender shaft, flared corolla, cylindrical tank with a groove, low cone and finial, a ladder stripe.
// Documented total height and footprint only (no photograph found): a recognisable silhouette, not a survey.
export function waterTowerV28(poly,base,totalH,t){
 const bb=bounds(poly[0]),cx=(bb.minX+bb.maxX)/2,cz=(bb.minZ+bb.maxZ)/2,r=Math.sqrt(area(poly[0])/Math.PI),n=32;
 const ring=(rad,y)=>Array.from({length:n},(_,i)=>[cx+Math.cos(i/n*6.2832)*rad,y,cz+Math.sin(i/n*6.2832)*rad]);
 const seg=(r0,y0,r1,y1,col)=>{const A=ring(r0,y0),B=ring(r1,y1);for(let i=0;i<n;i++){const j=(i+1)%n;t.quad(A[i],A[j],B[j],B[i],col,null,[(A[i][0]+A[j][0])/2-cx,0,(A[i][2]+A[j][2])/2-cz]);}};
 const H=totalH,shaftR=r*.82,tankR=r*1.95;
 const yCor0=base+H*.6,yCor1=base+H*.72,yTank1=base+H*.93,yRoof=base+H*.985;
 seg(shaftR*1.06,base,shaftR,base+1.2,PAL.mark);// plinth
 seg(shaftR,base+1.2,shaftR,yCor0,PAL.concrete);
 seg(shaftR,yCor0,tankR,yCor1,PAL.concreteLight);// corolla
 seg(tankR,yCor1,tankR,yCor1+.5,PAL.band);// groove / band
 seg(tankR,yCor1+.5,tankR,yTank1,PAL.concreteLight);
 seg(tankR,yTank1,tankR*1.04,yTank1+.35,PAL.band);// rim
 seg(tankR*1.04,yTank1+.35,r*.3,yRoof,PAL.cap);// low cone
 seg(r*.3,yRoof,r*.22,base+H,PAL.cap);// finial
 const topR=ring(r*.22,base+H);for(let i=0;i<n;i++)t.tri(topR[i],[cx,base+H,cz],topR[(i+1)%n],PAL.cap,null,UP);
 // ladder stripe on the south side of the shaft
 const sx=cx,sz=cz+shaftR;t.quad([sx-.25,base+1.4,sz+.03],[sx+.25,base+1.4,sz+.03],[sx+.25,yCor0-.2,sz+.03],[sx-.25,yCor0-.2,sz+.03],PAL.mark,null,[0,0,1]);
 return {radius:r,tankRadius:tankR,height:H};
}

// ---------------------------------------------------------------------------------------------------------------------
// War memorial: platform, two steps, pedestal with a cornice and a bronze medallion (poilu head with palm fronds), limestone
// obelisk with a bronze palm, pyramidion. 6,6 m: a legible presence at the diorama scale, at the documented POI only.
export function warMemorialV28(details,poiAt,heightAt){
 const at=poiAt&&poiAt('poi:monument-aux-morts');if(!at)return null;
 const [x,z]=at,y0=heightAt(x,z),S=PAL.memStone,D=PAL.memDark;
 const sq=(hw,y1,y2,col,topCol)=>{const c=[[x-hw,z-hw],[x+hw,z-hw],[x+hw,z+hw],[x-hw,z+hw]];for(let i=0;i<4;i++){const a=c[i],b=c[(i+1)%4];details.quad([a[0],y1,a[1]],[b[0],y1,b[1]],[b[0],y2,b[1]],[a[0],y2,a[1]],col,null,[(a[0]+b[0])/2-x,0,(a[1]+b[1])/2-z]);}details.quad(...[3,2,1,0].map(i=>[c[i][0],y2,c[i][1]]),topCol||col.clone().multiplyScalar(1.04),null,UP);};
 const taper=(h0,h1,y1,y2,col)=>{const c0=[[-h0,-h0],[h0,-h0],[h0,h0],[-h0,h0]],c1=[[-h1,-h1],[h1,-h1],[h1,h1],[-h1,h1]];for(let i=0;i<4;i++){const a=c0[i],b=c0[(i+1)%4],e=c1[(i+1)%4],f=c1[i];details.quad([x+a[0],y1,z+a[1]],[x+b[0],y1,z+b[1]],[x+e[0],y2,z+e[1]],[x+f[0],y2,z+f[1]],col,null,[(a[0]+b[0])/2,0,(a[1]+b[1])/2]);}};
 sq(2.9,y0-.05,y0+.1,PAL.memDark.clone().multiplyScalar(1.05));sq(2.2,y0+.1,y0+.26,D);sq(1.7,y0+.26,y0+.42,D);sq(1.35,y0+.42,y0+.58,S);// esplanade, platform and steps
 sq(.78,y0+.58,y0+2.05,S);sq(.9,y0+2.05,y0+2.22,S,S);// pedestal and cornice
 sq(.62,y0+2.22,y0+2.5,S);taper(.52,.36,y0+2.5,y0+5.9,S);// dado and obelisk
 const tip=[x,y0+6.6,z],c=[[-.36,-.36],[.36,-.36],[.36,.36],[-.36,.36]];for(let i=0;i<4;i++){const a=c[i],b=c[(i+1)%4];details.tri([x+a[0],y0+5.9,z+a[1]],[x+b[0],y0+5.9,z+b[1]],tip,D,null,[(a[0]+b[0])/2,.3,(a[1]+b[1])/2]);}
 // bronze medallion on the south face of the pedestal, bronze palm on the obelisk's south face (stylised cues)
 const zf=z+.78+.03,n=[0,0,1];const med=(r,y,col,k)=>{for(let i=0;i<k;i++){const a0=i/k*6.2832,a1=(i+1)/k*6.2832;details.tri([x,y,zf],[x+Math.cos(a0)*r,y+Math.sin(a0)*r,zf],[x+Math.cos(a1)*r,y+Math.sin(a1)*r,zf],col,null,n);}};
 med(.3,y0+1.35,PAL.bronze,10);med(.2,y0+1.35,PAL.bronzeLight,10);
 const zp=z+.5+.03;details.quad([x-.08,y0+2.8,zp],[x+.08,y0+2.8,zp],[x+.14,y0+4.6,zp-.07],[x-.02,y0+4.6,zp-.07],PAL.bronze,null,n);details.quad([x-.02,y0+3.3,zp],[x+.3,y0+3.9,zp-.05],[x+.22,y0+4.3,zp-.06],[x-.02,y0+3.9,zp-.03],PAL.bronzeLight,null,n);
 return {name:'Monument aux morts',position:[x,y0,z],height:6.6};
}

// ---------------------------------------------------------------------------------------------------------------------
// Hook for buildHousesV26. Returns true when it drew the building itself, an options object when the standard drawing
// should run with accents (colours mutated in place, arched bays, balcony, doors), false otherwise.
export function specialBuildingsV28(elevation,landmarkOf=()=>null){
 const sets={church:0,waterTower:0,mairie:0,fire:0};
 const hook=ctx=>{const {item,p,cls,base,walls,roofs,details,wallCol,roofCol}=ctx;
  if(isChurch(item)){churchV28(item,p,{walls,roofs,details},elevation(item)||0);sets.church++;return true;}
  if(cls==='WATER_TOWER'){waterTowerV28(item.poly,base,(item.extra&&item.extra.totalHeightM)||ctx.totalHeight||p.wallHeight,details);sets.waterTower++;return true;}
  const kind=landmarkOf(item.featureId||item.id);
  if(kind==='mairie'){wallCol.copy(PAL.brick);roofCol.copy(PAL.slate);sets.mairie++;return {arched:true,balcony:true,storey:2.6,stoneQuoins:PAL.brickStone,windowFrame:PAL.brickStone};}
  if(kind==='fire'){wallCol.copy(C('#e9e2d2'));sets.fire++;const ring=item.poly[0];let best=null,bl=0;for(let i=1;i<ring.length;i++){const L=Math.hypot(ring[i][0]-ring[i-1][0],ring[i][1]-ring[i-1][1]);if(L>bl){bl=L;best=[ring[i-1],ring[i]];}}
   if(best&&bl>=7){const [a,b]=best,n=outward(a,b,item.poly),w=Math.min(3,(bl-1.5)/2),hgt=Math.min(3.2,ctx.eaveY-base-.8);for(const k of [-.5,.5]){const uu=bl/2+k*(w+.5);facePanel(details,a,b,n,uu,base+hgt/2+.05,w+.16,hgt+.12,.03,PAL.frame);facePanel(details,a,b,n,uu,base+hgt/2+.05,w,hgt,.05,PAL.fire);}return {skipGroundLongest:true};}
   return false;}
  return false;};
 hook.stats=sets;return hook;
}

// Map building id → landmark kind from the POI records (building_ids of the mairie and fire-station POIs).
export function landmarkIndex(pois){const map=new Map();for(const poi of pois||[]){const kind=poi.id==='poi:mairie'?'mairie':poi.id==='poi:cpi'?'fire':null;if(!kind)continue;for(const id of poi.building_ids||[])map.set(id,kind);}
 return id=>map.get(id)||null;}
