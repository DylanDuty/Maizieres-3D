import * as THREE from 'three';

// V2.5 Poussey prototype — road overlay inside the box: a soft shoulder, a textured asphalt (or earth) ribbon draped on
// the relief, a dashed axis on the D20. Alignments and widths are the frozen V1.8 values; only the drawing changes.
const PAVED=new Set(['route_principale','route_secondaire','voie_locale','voie_de_desserte']);
class Strip{constructor(){this.p=[];this.c=[];this.uv=[];}
 quad(a,b,c,d,col,uvs){for(const [v,k] of [[a,0],[b,1],[c,2],[a,0],[c,2],[d,3]]){this.p.push(v[0],v[1],v[2]);this.c.push(col.r,col.g,col.b);this.uv.push(uvs[k][0],uvs[k][1]);}}
 mesh(mat,name,parent,shadow=true){if(!this.p.length)return null;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(this.uv,2));g.computeVertexNormals();const m=new THREE.Mesh(g,mat);m.name=name;m.receiveShadow=shadow;m.castShadow=false;parent.add(m);return m;}}
export function buildRoadsV25(parent,{v2,box,heightAt,materials:M}){
 const inBox=(x,z)=>x>=box.minX-30&&x<=box.maxX+30&&z>=box.minZ-30&&z<=box.maxZ+30;
 const shoulder=new Strip(),asphalt=new Strip(),earth=new Strip(),dash=new Strip();const C=new THREE.Color();
 function ribbon(strip,p,width,lift,col,uvScale,maxStep=4){const pts=[];for(let i=0;i<p.length;i+=3){const q=[p[i],p[i+1],p[i+2]];if(pts.length){const a=pts.at(-1),len=Math.hypot(q[0]-a[0],q[1]-a[1]),k=Math.ceil(len/maxStep);for(let j=1;j<k;j++)pts.push([a[0]+(q[0]-a[0])*j/k,a[1]+(q[1]-a[1])*j/k,a[2]+(q[2]-a[2])*j/k]);}pts.push(q);}
  const runs=[];let run=[];for(const q of pts){if(inBox(q[0],q[1]))run.push(q);else{if(run.length>1)runs.push(run);run=[];}}if(run.length>1)runs.push(run);
  for(const r of runs){let travel=0;const E=r.map((q,i)=>{const a=r[Math.max(0,i-1)],b=r[Math.min(r.length-1,i+1)];let dx=b[0]-a[0],dz=b[1]-a[1];const L=Math.hypot(dx,dz)||1;dx/=L;dz/=L;if(i)travel+=Math.hypot(q[0]-r[i-1][0],q[1]-r[i-1][1]);
    const e=[-1,1].map(s=>{const x=q[0]-dz*s*width/2,z=q[1]+dx*s*width/2;return [x,Math.max(q[2],heightAt(x,z),heightAt(q[0],q[1]))+lift,z];});e.t=travel;return e;});
   for(let i=1;i<E.length;i++){const a=E[i-1],b=E[i];strip.quad(a[0],a[1],b[1],b[0],col,[[a.t/uvScale,0],[a.t/uvScale,1],[b.t/uvScale,1],[b.t/uvScale,0]]);}}}
 let count=0;
 for(const r of v2.data.roads){if(!r.p.some((v,i)=>i%3===0&&inBox(v,r.p[i+1])))continue;count++;const paved=PAVED.has(r.c),w=Math.max(paved?3:1.4,r.w||3),main=r.c==='route_principale'||r.r==='D20';
  if(paved){ribbon(shoulder,r.p,w+2.6,.30,C.set(r.c==='voie_de_desserte'?'#b9b39a':'#aea78c'),1);ribbon(asphalt,r.p,w+(main?.6:0),.36,C.set('#ffffff'),1);if(main)ribbon(dash,r.p,.14,.40,C.set('#ffffff'),1);}
  else ribbon(earth,r.p,w+.6,.34,C.set('#ffffff'),1);}
 const group=new THREE.Group();group.name='v25-roads';
 shoulder.mesh(M.shoulder,'v25-shoulders',group);asphalt.mesh(M.asphalt,'v25-asphalt',group);earth.mesh(M.earth,'v25-paths',group);const dm=dash.mesh(M.dash,'v25-dashes',group,false);if(dm)dm.renderOrder=2;
 parent.add(group);return {group,count};
}
