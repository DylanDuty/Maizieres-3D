import * as THREE from 'three';
import {toon} from './art.js';
export function shapeRings(poly){return poly.map(r=>{const points=r.map(p=>new THREE.Vector2(...p));if(points.length>1&&points[0].equals(points.at(-1)))points.pop();return points;});}
export class Batch {
  constructor(material){this.material=material;this.p=[];this.c=[];this.uv=[];}
  tri(a,b,c,color,uvs){const col=new THREE.Color(color);for(const [i,v] of [a,b,c].entries()){this.p.push(...v);this.c.push(col.r,col.g,col.b);this.uv.push(...(uvs?.[i]||[v[0]/10,v[2]/10]));}}
  quad(a,b,c,d,color){this.tri(a,b,c,color);this.tri(a,c,d,color);}
  polygon(poly,y,color){const rings=shapeRings(poly);const flat=rings.flat();for(const t of THREE.ShapeUtils.triangulateShape(rings[0],rings.slice(1)))this.tri(...t.map(i=>[flat[i].x,y,flat[i].y]),color);}
  mesh(parent,shadow=false){if(!this.p.length)return null;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(this.uv,2));g.computeVertexNormals();g.computeBoundingSphere();const m=new THREE.Mesh(g,this.material);m.castShadow=shadow;m.receiveShadow=true;parent.add(m);return m;}
}
export function material(extra={}){const {roughness,metalness,...options}=extra;return toon({vertexColors:true,side:THREE.DoubleSide,...options});}
export function strip(batch,pts,width,y,color,offset=0){
  // A continuous mitered ribbon; capped miters avoid spikes at sharp road bends.
  if(pts.length<2)return;
  const edges=pts.map((p,i)=>{
    const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];let dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1;
    dx/=len;dz/=len;return [[p[0]-dz*(offset+width/2),y,p[1]+dx*(offset+width/2)],[p[0]-dz*(offset-width/2),y,p[1]+dx*(offset-width/2)]];
  });for(let i=1;i<edges.length;i++)batch.quad(edges[i-1][0],edges[i-1][1],edges[i][1],edges[i][0],color);
}
export function sampleLine(pts,spacing,fn){let next=spacing/2,travel=0;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(!len)continue;while(next<=travel+len){const f=(next-travel)/len;fn([a[0]+dx*f,a[1]+dz*f],Math.atan2(dx,dz));next+=spacing;}travel+=len;}}
export function clipRing(ring,e){let out=ring.slice();for(const [axis,value,sign] of [[0,e.minX,1],[0,e.maxX,-1],[1,e.minZ,1],[1,e.maxZ,-1]]){const input=out;out=[];for(let i=0;i<input.length;i++){const a=input[i],b=input[(i+1)%input.length],ia=(a[axis]-value)*sign>=0,ib=(b[axis]-value)*sign>=0;if(ia)out.push(a);if(ia!==ib){const t=(value-a[axis])/(b[axis]-a[axis]);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}}return out;}
export function clipLine(pts,e){const result=[];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],dx=b[0]-a[0],dz=b[1]-a[1];let lo=0,hi=1,ok=true;for(const [p,q] of [[-dx,a[0]-e.minX],[dx,e.maxX-a[0]],[-dz,a[1]-e.minZ],[dz,e.maxZ-a[1]]]){if(p===0){if(q<0)ok=false;}else{const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);}}if(ok&&lo<=hi){const start=[a[0]+lo*dx,a[1]+lo*dz],end=[a[0]+hi*dx,a[1]+hi*dz];const last=result.at(-1);if(last&&Math.hypot(last.at(-1)[0]-start[0],last.at(-1)[1]-start[1])<.01)last.push(end);else result.push([start,end]);}}return result;}
