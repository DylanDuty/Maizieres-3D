import * as THREE from 'three';
import {saintDenis} from '../church.js';
import {isChurch} from '../building-source.js';
import {UP,DOWN,outward} from '../v25/procedural-houses.js';

// V2.7 — the four unique models in the diorama language. Water towers are drawn by the houses module (silhouette on the
// documented total height); the church reuses the documented Saint-Denis model (plan + elevation of the Sauvegarde de
// l'Art Français, OSM outline untouched) through an adapter that gives each face an explicit facing and the V2.6 palette;
// the war memorial is a small stone obelisk at its documented position (no footprint in the data). Nothing is surveyed
// beyond what the sources say: these are recognisable silhouettes, not architectural reproductions.
const RECOLOUR={'#5d6670':'#7b8ea6','#dfd6c1':'#ece4d1','#555c61':'#55606c'};
const normal=(a,b,q)=>{const nx=(b[1]-a[1])*(q[2]-a[2])-(b[2]-a[2])*(q[1]-a[1]),ny=(b[2]-a[2])*(q[0]-a[0])-(b[0]-a[0])*(q[2]-a[2]),nz=(b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]),L=Math.hypot(nx,ny,nz)||1;return [nx/L,ny/L,nz/L];};
// Adapter: Batch-like quad/tri calls (hex colour, V2.4 draws them double-sided) → Tri calls (THREE.Color, single-sided)
// lifted by dy. The V2.4 winding is arbitrary, so every face gets an explicit facing from its context (`facingOf`), and
// walls get metres-above-base uvs so the toon base band stays at the foot of the wall. V2.7.1: the first version used
// "away from the plan centroid" for every steep face, which culled half of the roof humps, the spire and the tower.
function adapter(tri,dy,facingOf,uvOf=null){const col=new THREE.Color();const lift=v=>[v[0],v[1]+dy,v[2]];const colour=h=>col.set(RECOLOUR[Array.isArray(h)?h[0]:h]||(Array.isArray(h)?h[0]:h)).clone();
 return {tri:(a,b,q,color)=>{a=lift(a);b=lift(b);q=lift(q);tri.tri(a,b,q,colour(color),null,facingOf(a,b,q));},
  quad:(a,b,q,d,color)=>{a=lift(a);b=lift(b);q=lift(q);d=lift(d);tri.quad(a,b,q,d,colour(color),uvOf?uvOf(a,b,q,d):null,facingOf(a,b,q));}};}
// Details (tower, belfry, hip, spire, stair turret) are buffered: their centres are only known when the model returns.
function deferred(){const calls=[];return {api:{tri:(...a)=>calls.push(['tri',a]),quad:(...a)=>calls.push(['quad',a])},
 flush(tri,dy,centres){const cs=centres.filter(Boolean);const ad=adapter(tri,dy,(a,b,q)=>{const n=normal(a,b,q);if(Math.abs(n[1])>.85)return UP;const mx=(a[0]+b[0]+q[0])/3,mz=(a[2]+b[2]+q[2])/3;let best=null,bd=Infinity;for(const c of cs){const d=Math.hypot(mx-c[0],mz-c[1]);if(d<bd){bd=d;best=c;}}return best?[mx-best[0],0,mz-best[1]]:[n[0],0,n[2]];});for(const [k,a] of calls)ad[k](...a);return calls.length;}};}

// Hook for buildHousesV26: returns true when it drew the building itself.
export function specialBuildingsV27(elevation){
 return ({item,p,walls,roofs,details})=>{if(!isChurch(item))return false;const dy=elevation(item)||0,poly=item.poly;
  // Walls: quads whose first edge runs along the OSM outline → face away from the outline, uv.y = metres above the foot.
  const wallAd=adapter(walls,dy,(a,b)=>outward([a[0],a[2]],[b[0],b[2]],poly),(a,b,q,d)=>{const L=Math.hypot(b[0]-a[0],b[2]-a[2]);return [[0,0],[L,0],[L,q[1]-a[1]],[0,d[1]-a[1]]];});
  // Roof: a height field over the plan, every triangle faces up (the nave humps are steeper than 45°).
  const roofAd=adapter(roofs,dy,()=>UP);
  const det=deferred();const r=saintDenis(poly,p,wallAd,roofAd,det.api);det.flush(details,dy,[r.towerCentre,r.turretAnchor]);return true;};
}

// War memorial: square base, tapered shaft, pyramidion. Position from the landmark list (documented POI), height 6 m.
export function warMemorial(details,poiAt,heightAt){
 const at=poiAt&&poiAt('poi:monument-aux-morts');if(!at)return null;const l={name:'Monument aux morts'};
 const [x,z]=at,y0=heightAt(x,z),stone=new THREE.Color('#e9e1cf'),dark=stone.clone().multiplyScalar(.9);
 const box=(hw,y1,y2,col)=>{const c=[[x-hw,z-hw],[x+hw,z-hw],[x+hw,z+hw],[x-hw,z+hw]];for(let i=0;i<4;i++){const a=c[i],b=c[(i+1)%4];details.quad([a[0],y1,a[1]],[b[0],y1,b[1]],[b[0],y2,b[1]],[a[0],y2,a[1]],col,null,[(a[0]+b[0])/2-x,0,(a[1]+b[1])/2-z]);}details.quad(...[3,2,1,0].map(i=>[c[i][0],y2,c[i][1]]),col.clone().multiplyScalar(1.04),null,UP);};
 const taper=(h0,h1,y1,y2,col)=>{const c0=[[-h0,-h0],[h0,-h0],[h0,h0],[-h0,h0]],c1=[[-h1,-h1],[h1,-h1],[h1,h1],[-h1,h1]];for(let i=0;i<4;i++){const a=c0[i],b=c0[(i+1)%4],e=c1[(i+1)%4],f=c1[i];details.quad([x+a[0],y1,z+a[1]],[x+b[0],y1,z+b[1]],[x+e[0],y2,z+e[1]],[x+f[0],y2,z+f[1]],col,null,[(a[0]+b[0])/2,0,(a[1]+b[1])/2]);}};
 box(1.4,y0,y0+.5,dark);box(1.0,y0+.5,y0+1.3,stone);taper(.55,.4,y0+1.3,y0+5.4,stone);
 const tip=[x,y0+6.1,z],c=[[-.4,-.4],[.4,-.4],[.4,.4],[-.4,.4]];for(let i=0;i<4;i++){const a=c[i],b=c[(i+1)%4];details.tri([x+a[0],y0+5.4,z+a[1]],[x+b[0],y0+5.4,z+b[1]],tip,dark,null,[(a[0]+b[0])/2,.3,(a[1]+b[1])/2]);}
 return {name:l.name,position:[x,y0,z],height:6.1};
}
