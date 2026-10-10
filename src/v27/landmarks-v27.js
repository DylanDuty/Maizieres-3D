import * as THREE from 'three';
import {saintDenis} from '../church.js';
import {isChurch} from '../building-source.js';
import {UP,DOWN} from '../v25/procedural-houses.js';

// V2.7 — the four unique models in the diorama language. Water towers are drawn by the houses module (silhouette on the
// documented total height); the church reuses the documented Saint-Denis model (plan + elevation of the Sauvegarde de
// l'Art Français, OSM outline untouched) through an adapter that gives each face an explicit facing and the V2.6 palette;
// the war memorial is a small stone obelisk at its documented position (no footprint in the data). Nothing is surveyed
// beyond what the sources say: these are recognisable silhouettes, not architectural reproductions.
const RECOLOUR={'#5d6670':'#7b8ea6','#dfd6c1':'#ece4d1','#555c61':'#55606c'};
const centroid=poly=>{let x=0,z=0,n=0;for(const q of poly[0]){x+=q[0];z+=q[1];n++;}return [x/n,z/n];};
// Adapter: Batch-like quad/tri calls (hex colour) → Tri calls (THREE.Color, explicit facing), lifted by dy.
function adapter(tri,c,dy){const col=new THREE.Color();
 const facing=(a,b,q)=>{const nx=(b[1]-a[1])*(q[2]-a[2])-(b[2]-a[2])*(q[1]-a[1]),ny=(b[2]-a[2])*(q[0]-a[0])-(b[0]-a[0])*(q[2]-a[2]),nz=(b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]),L=Math.hypot(nx,ny,nz)||1;
  if(Math.abs(ny/L)>.85)return ny>0?UP:DOWN;const mx=(a[0]+b[0]+q[0])/3-c[0],mz=(a[2]+b[2]+q[2])/3-c[1];return [mx,0,mz];};
 const lift=v=>[v[0],v[1]+dy,v[2]];const colour=h=>col.set(RECOLOUR[h]||h).clone();
 return {tri:(a,b,q,color)=>{a=lift(a);b=lift(b);q=lift(q);tri.tri(a,b,q,colour(Array.isArray(color)?color[0]:color),null,facing(a,b,q));},
  quad:(a,b,q,d,color)=>{a=lift(a);b=lift(b);q=lift(q);d=lift(d);tri.quad(a,b,q,d,colour(Array.isArray(color)?color[0]:color),null,facing(a,b,q));}};}

// Hook for buildHousesV26: returns true when it drew the building itself.
export function specialBuildingsV27(elevation){
 return ({item,p,walls,roofs,details})=>{if(!isChurch(item))return false;const dy=elevation(item)||0,c=centroid(item.poly);
  saintDenis(item.poly,p,adapter(walls,c,dy),adapter(roofs,c,dy),adapter(details,c,dy));return true;};
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
