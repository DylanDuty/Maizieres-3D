import * as THREE from 'three';
import {area,bounds} from '../src/geo.js';
export function triangulate(poly){const rings=poly.map(r=>r.slice(0,-1).map(p=>new THREE.Vector2(...p)));const pts=rings.flat();return THREE.ShapeUtils.triangulateShape(rings[0],rings.slice(1)).map(t=>t.map(i=>[pts[i].x,pts[i].y]));}
const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
function clipTriangle(subject,clip){let out=subject;const sign=cross(clip[0],clip[1],clip[2])>=0?1:-1;for(let i=0;i<3;i++){const a=clip[i],b=clip[(i+1)%3],input=out;out=[];for(let j=0;j<input.length;j++){const p=input[j],q=input[(j+1)%input.length],dp=cross(a,b,p)*sign,dq=cross(a,b,q)*sign;if(dp>=-1e-8)out.push(p);if((dp>0&&dq<0)||(dp<0&&dq>0)){const t=dp/(dp-dq);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}}if(out.length<3)return [];}return out;}
export function intersects(a,b){return a.minX<=b.maxX&&a.maxX>=b.minX&&a.minZ<=b.maxZ&&a.maxZ>=b.minZ;}
export function prepareShape(polys){const triangles=polys.flatMap(triangulate).map(p=>({p,b:bounds(p)}));return {polys,triangles,area:triangles.reduce((s,t)=>s+area(t.p),0),b:bounds(polys.flat(2))};}
export function intersectionArea(a,b){if(!intersects(a.b,b.b))return 0;let sum=0;for(const ta of a.triangles)for(const tb of b.triangles)if(intersects(ta.b,tb.b))sum+=area(clipTriangle(ta.p,tb.p));return sum;}
