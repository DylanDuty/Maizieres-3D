import * as THREE from 'three';
import {Tri} from '../v25/procedural-houses.js';
import {insidePoly} from '../geo.js';

// V2.9 — visual continuity of the watercourses (renderer only, the frozen hydro layer is read as is).
// The V2.4 ribbons stop with a flat cut at every segment end; under the V2.7 canopy masses a stream entering a wood
// looked as if it ended. Here each line becomes a draped ribbon with round joints, round caps at every end, and a
// gentle taper over the last metres of a *true* dead end (an end that touches no other line and lies in no water
// surface): true ends read as intentional, junctions stay continuous. No point is added to the data: the taper only
// narrows the ribbon that already exists. Intermittent lines keep their width but take a slightly lighter edge.
const CAP_SEGMENTS=7,TAPER_LENGTH=14,JOIN_TOLERANCE=1.6;
export function buildHydroV29(parent,{v2,heightAt,material}){
 const d=v2.data,lines=d.waterLines,surfaces=d.water;
 const pts=l=>{const p=[];for(let i=0;i<l.p.length;i+=2)p.push([l.p[i],l.p[i+1]]);return p;};
 const all=lines.map(pts);
 // Dead-end test: no vertex of another line within the tolerance, not inside a water surface.
 const ringsOf=s=>s.r.map(r=>{const out=[];for(let i=0;i<r[0].length;i+=2)out.push([r[0][i],r[0][i+1]]);return [out];});
 const surfaceRings=surfaces.flatMap(ringsOf);
 const touches=(q,self)=>{for(let k=0;k<all.length;k++){if(k===self)continue;for(const s of all[k])if(Math.hypot(s[0]-q[0],s[1]-q[1])<JOIN_TOLERANCE)return true;}return surfaceRings.some(r=>insidePoly(q,r));};
 const tri=new Tri();const col=new THREE.Color('#ffffff');let ends=0,tapered=0,capped=0,km=0;
 const lift=(x,z)=>heightAt(x,z)+.24;
 for(let k=0;k<lines.length;k++){const l=lines[k];let p=all[k];if(p.length<2)continue;
  // Densify (max 6 m) so the drape follows the relief.
  const dense=[p[0]];for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/6);for(let j=1;j<=n;j++)dense.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);}
  p=dense;const w=Math.max(1.4,l.w||3);
  const deadA=!touches(p[0],k),deadB=!touches(p[p.length-1],k);ends+=2;if(deadA)tapered++;if(deadB)tapered++;
  // Cumulative distance from each end for the taper.
  const cum=[0];for(let i=1;i<p.length;i++)cum.push(cum[i-1]+Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]));const total=cum[cum.length-1];km+=total/1000;
  const widthAt=i=>{let f=1;if(deadA)f=Math.min(f,.35+.65*Math.min(1,cum[i]/TAPER_LENGTH));if(deadB)f=Math.min(f,.35+.65*Math.min(1,(total-cum[i])/TAPER_LENGTH));return w*f;};
  const edges=p.map((q,i)=>{const a=p[Math.max(0,i-1)],b=p[Math.min(p.length-1,i+1)];let dx=b[0]-a[0],dz=b[1]-a[1];const L=Math.hypot(dx,dz)||1;dx/=L;dz/=L;const hw=widthAt(i)/2;
   const left=[q[0]-dz*hw,0,q[1]+dx*hw],right=[q[0]+dz*hw,0,q[1]-dx*hw];const y=Math.max(lift(q[0],q[1]),lift(left[0],left[2]),lift(right[0],right[2]));left[1]=y;right[1]=y;return {left,right,t:cum[i],dir:[dx,dz],y,q,hw};});
  for(let i=1;i<edges.length;i++){const a=edges[i-1],b=edges[i];tri.quad(a.left,a.right,b.right,b.left,col,[[a.t,0],[a.t,1],[b.t,1],[b.t,0]],[0,1,0]);}
  // Round caps: a half disc at each end (the uv keeps the side coordinate so the foam edge wraps around).
  const cap=(e,sign)=>{const c=[e.q[0],e.y,e.q[1]],r=e.hw;for(let s=0;s<CAP_SEGMENTS;s++){const a0=Math.PI*s/CAP_SEGMENTS,a1=Math.PI*(s+1)/CAP_SEGMENTS;const P=ang=>{const ca=Math.cos(ang),sa=Math.sin(ang);return [e.q[0]+(-e.dir[1]*ca+e.dir[0]*sa*sign)*r,e.y,e.q[1]+(e.dir[0]*ca+e.dir[1]*sa*sign)*r];};
   tri.tri(c,P(a0),P(a1),col,[[e.t,.5],[e.t+sign*r*.5,.5+Math.cos(a0)*.5],[e.t+sign*r*.5,.5+Math.cos(a1)*.5]],[0,1,0]);}capped++;};
  cap(edges[0],-1);cap(edges[edges.length-1],1);}
 const g=tri.geometry();const mesh=new THREE.Mesh(g,material);mesh.name='v29-water-lines';mesh.renderOrder=1;mesh.receiveShadow=true;mesh.frustumCulled=true;parent.add(mesh);
 return {mesh,stats:{lines:lines.length,km:Math.round(km*10)/10,ends,taperedEnds:tapered,caps:capped,triangles:tri.n}};
}
