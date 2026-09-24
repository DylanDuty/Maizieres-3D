import {shapeRings} from './geometry.js';
import * as THREE from 'three';
import {area,insidePoly} from './geo.js';
// Saint-Denis only. Source: Sauvegarde de l'Art Français, plan + elevation, and municipal notice.
// OSM outline is never altered. Internal part boundaries and unsurveyed heights are approximate.
export function saintDenis(poly,profile,walls,roofs,details){
 const axis=profile.axis;let u=[axis.axis[1],-axis.axis[0]];if(u[0]<0)u=u.map(n=>-n);const v=[-u[1],u[0]];
 const dp=(p,a)=>p[0]*a[0]+p[1]*a[1],us=poly[0].map(p=>dp(p,u)),vs=poly[0].map(p=>dp(p,v));
 const u0=Math.min(...us),u1=Math.max(...us),v0=Math.min(...vs),v1=Math.max(...vs),du=u1-u0,dv=v1-v0;
 const local=p=>[(dp(p,u)-u0)/du,(dp(p,v)-v0)/dv];const world=(a,b)=>[u[0]*(u0+a*du)+v[0]*(v0+b*dv),u[1]*(u0+a*du)+v[1]*(v0+b*dv)];
 const base=.35,eave=profile.wallHeight,roofColor='#5d6670',wallColor='#dfd6c1';
 function height(p){const [s,t]=local(p);if(s<.36)return base+eave*.74+4*Math.max(0,1-Math.abs(t-.52)/.47);
  if(s>.91)return base+eave+4*Math.max(0,Math.min(1-Math.abs(t-.5)/.55,(1-s)/.09));
  const sections=[.36,.55,.74,.91];let i=0;while(i<2&&s>sections[i+1])i++;const mid=(sections[i]+sections[i+1])/2;let rise=4.3*Math.max(0,1-Math.abs(s-mid)/((sections[i+1]-sections[i])/2));if(i===0&&t>.57)rise*=.4;return base+eave+rise;
 }
 function tri(a,b,c,depth=0){const ab=Math.hypot(a[0]-b[0],a[1]-b[1]),bc=Math.hypot(b[0]-c[0],b[1]-c[1]),ca=Math.hypot(c[0]-a[0],c[1]-a[1]);if(depth<13&&Math.max(ab,bc,ca)>1.2){if(ab>=bc&&ab>=ca){const m=[(a[0]+b[0])/2,(a[1]+b[1])/2];tri(a,m,c,depth+1);tri(m,b,c,depth+1);}else if(bc>=ca){const m=[(b[0]+c[0])/2,(b[1]+c[1])/2];tri(a,b,m,depth+1);tri(a,m,c,depth+1);}else{const m=[(c[0]+a[0])/2,(c[1]+a[1])/2];tri(a,b,m,depth+1);tri(m,b,c,depth+1);}}else roofs.tri(...[a,b,c].map(p=>[p[0],height(p),p[1]]),roofColor);}

 const rings=shapeRings(poly),flat=rings.flat();for(const t of THREE.ShapeUtils.triangulateShape(rings[0],rings.slice(1)))tri(...t.map(i=>[flat[i].x,flat[i].y]));
 for(const ring of poly)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(len/.6));for(let j=0;j<n;j++){const p=[a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n],q=[a[0]+(b[0]-a[0])*(j+1)/n,a[1]+(b[1]-a[1])*(j+1)/n];walls.quad([p[0],base,p[1]],[q[0],base,q[1]],[q[0],height(q),q[1]],[p[0],height(p),p[1]],wallColor);}}
 // Square bell tower at the first crossing: stone base, dark timber belfry, short hip and pointed spire.
 const corners=[[.425,.36],[.55,.36],[.55,.63],[.425,.63]].map(p=>world(...p)),center=world(.4875,.495);
 if(corners.every(p=>insidePoly(p,poly))){const bottom=eave+2,stoneTop=eave+4,belfry=eave+8.4,shoulder=eave+10.2,tip=eave+15.5;const upper=corners.map(p=>[center[0]+(p[0]-center[0])*.28,center[1]+(p[1]-center[1])*.28]);for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4],c=upper[(i+1)%4],d=upper[i];details.quad([a[0],bottom,a[1]],[b[0],bottom,b[1]],[b[0],stoneTop,b[1]],[a[0],stoneTop,a[1]],wallColor);details.quad([a[0],stoneTop,a[1]],[b[0],stoneTop,b[1]],[b[0],belfry,b[1]],[a[0],belfry,a[1]],'#555c61');details.quad([a[0],belfry,a[1]],[b[0],belfry,b[1]],[c[0],shoulder,c[1]],[d[0],shoulder,d[1]],roofColor);details.tri([d[0],shoulder,d[1]],[c[0],shoulder,c[1]],[center[0],tip,center[1]],roofColor);}}
 // The small north stair turret is explicitly documented. Its top is clipped to the unchanged OSM outline.
 const anchor=world(.34,.12),radius=1.3,top=eave+2.2;const ring=[];for(let i=0;i<12;i++)ring.push([anchor[0]+Math.cos(i*Math.PI/6)*radius,anchor[1]+Math.sin(i*Math.PI/6)*radius]);if(ring.every(p=>insidePoly(p,poly)))for(let i=0;i<12;i++){const a=ring[i],b=ring[(i+1)%12];details.quad([a[0],eave*.7,a[1]],[b[0],eave*.7,b[1]],[b[0],top,b[1]],[a[0],top,a[1]],wallColor);details.tri([a[0],top,a[1]],[b[0],top,b[1]],[anchor[0],top+3,anchor[1]],roofColor);}
 return {maxHeight:eave+15.5};
}
