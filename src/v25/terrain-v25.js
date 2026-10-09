import * as THREE from 'three';
import {random} from '../geo.js';
import {cropTint,V2_COLORS} from '../v2-scene.js';
import {extend} from './procedural-materials.js';

// V2.5 Poussey prototype — local ground patch: a 5 m grid draped on the displayed relief (+6 cm, over the V2.4 terrain),
// painted at ~0,6 m/px (fields with declared-crop tints and furrows, meadows, village lawns and garden beds, wood
// floor, water bed, hedge lines) and finished with a fine grass grain in the shader. Pure drawing; altitudes unchanged.
const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967296;};
const shade=(hex,l,s=0)=>new THREE.Color(hex).offsetHSL(0,s,l).getStyle();
export function buildTerrainV25(parent,{v2,box,heightAt,T,envMap,size=2048}){
 const {data:d}=v2,W=box.maxX-box.minX,D=box.maxZ-box.minZ,step=5,cols=Math.round(W/step)+1,rows=Math.round(D/step)+1;
 const pos=new Float32Array(cols*rows*3),uv=new Float32Array(cols*rows*2),index=[];
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const k=r*cols+c,x=box.minX+c*step,z=box.minZ+r*step;pos[k*3]=x;pos[k*3+1]=heightAt(x,z)+.06;pos[k*3+2]=z;uv[k*2]=c/(cols-1);uv[k*2+1]=r/(rows-1);}
 for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){const a=r*cols+c,b=a+1,e=a+cols,f=e+1;index.push(a,e,b,b,e,f);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();
 const canvas=document.createElement('canvas'),w=size,h=Math.round(size*D/W);canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d'),sx=w/W,rng=random(2025);
 const X=x=>(x-box.minX)*sx,Z=z=>(z-box.minZ)*sx;
 const path=rings=>{ctx.beginPath();for(const r of rings){for(let i=0;i<r.length;i+=2)i?ctx.lineTo(X(r[i]),Z(r[i+1])):ctx.moveTo(X(r[i]),Z(r[i+1]));ctx.closePath();}};
 const fill=(o,color,alpha=1)=>{ctx.globalAlpha=alpha;ctx.fillStyle=color;for(const p of o.r){path(p);ctx.fill('evenodd');}ctx.globalAlpha=1;};
 const outline=(o,color,widthM,alpha=1)=>{ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=Math.max(.8,widthM*sx);for(const p of o.r){path(p);ctx.stroke();}ctx.globalAlpha=1;};
 const line=(p,stride,color,widthM)=>{ctx.strokeStyle=color;ctx.lineWidth=Math.max(.8,widthM*sx);ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();for(let i=0;i<p.length;i+=stride)i?ctx.lineTo(X(p[i]),Z(p[i+1])):ctx.moveTo(X(p[i]),Z(p[i+1]));ctx.stroke();};
 const bb=o=>{let b=[Infinity,Infinity,-Infinity,-Infinity];for(const p of o.r)for(const r of p)for(let i=0;i<r.length;i+=2)b=[Math.min(b[0],r[i]),Math.min(b[1],r[i+1]),Math.max(b[2],r[i]),Math.max(b[3],r[i+1])];return b;};
 const near=o=>{const b=bb(o);return b[2]>=box.minX&&b[0]<=box.maxX&&b[3]>=box.minZ&&b[1]<=box.maxZ;};
 const bearing=o=>{let best=0,bl=0;for(const r of o.r[0])for(let i=2;i<r.length;i+=2){const dx=r[i]-r[i-2],dz=r[i+1]-r[i-1],l=dx*dx+dz*dz;if(l>bl){bl=l;best=Math.atan2(dz,dx);}}return best;};
 const speckle=(o,colors,perHa,radiusM,alpha=.45)=>{const b=bb(o),x0=Math.max(b[0],box.minX),x1=Math.min(b[2],box.maxX),z0=Math.max(b[1],box.minZ),z1=Math.min(b[3],box.maxZ),count=Math.min(12000,Math.round((x1-x0)*(z1-z0)/1e4*perHa));if(count<=0)return;ctx.save();path(o.r.flat());ctx.clip('evenodd');ctx.globalAlpha=alpha;
  for(const [k,color] of colors.entries()){ctx.fillStyle=color;ctx.beginPath();for(let i=k;i<count;i+=colors.length){const x=X(x0+rng()*(x1-x0)),z=Z(z0+rng()*(z1-z0)),r=Math.max(.7,radiusM*(.5+rng())*sx);ctx.moveTo(x+r,z);ctx.arc(x,z,r,0,6.283);}ctx.fill();}ctx.globalAlpha=1;ctx.restore();};
 const stripes=(o,color,spacingM,alpha,widthM)=>{const b=bb(o),a=bearing(o),cx=(b[0]+b[2])/2,cz=(b[1]+b[3])/2,R=Math.hypot(b[2]-b[0],b[3]-b[1])/2;ctx.save();path(o.r.flat());ctx.clip('evenodd');ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=Math.max(.8,widthM*sx);ctx.beginPath();
  const ux=Math.cos(a),uz=Math.sin(a),vx=-uz,vz=ux;for(let s=-R;s<=R;s+=spacingM){ctx.moveTo(X(cx+vx*s-ux*R),Z(cz+vz*s-uz*R));ctx.lineTo(X(cx+vx*s+ux*R),Z(cz+vz*s+uz*R));}ctx.stroke();ctx.restore();ctx.globalAlpha=1;};
 ctx.fillStyle='#c3cf98';ctx.fillRect(0,0,w,h);
 // Village ground: lawns with soft mottling and abstract garden beds (ambiance only, no surveyed layout).
 for(const v of d.village.filter(near)){fill(v,'#a9c37b');speckle(v,['#96b667','#bfd08f','#8aab5e','#b4c47e'],90,4.5,.45);speckle(v,['#7a9f53','#6c9150','#d2cf94'],9,2.8,.5);speckle(v,['#c9c48c','#bcb77e'],4,5,.35);}
 for(const a of d.artificial.filter(a=>a.kind==='perimetre'&&near(a)&&!/eolien|photovolt/.test(a.t)))fill(a,'#dcd7c2',.6);
 for(const a of d.agriculture.filter(near)){const k=hash(a.id),tint=shade(cropTint(a),(k-.5)*.06,.06+(k-.5)*.04);fill(a,tint);
  if(['prairie_permanente','prairie_temporaire'].includes(a.t)){speckle(a,['#c9df9d','#8fb46a','#a9c97d'],90,1.6,.45);}
  else{stripes(a,'#5f4e30',1.7+k*.9,.09,.55);stripes(a,'#fff5d0',1.7+k*.9,.07,.45);speckle(a,[shade(tint,.08),shade(tint,-.07)],40,1.4,.35);}}
 for(const a of d.agriculture.filter(near))outline(a,'#a8976b',.7,.5);
 for(const a of d.artificial.filter(a=>a.kind==='surface'&&near(a)))fill(a,a.t==='parking'?'#b9b6ac':a.t==='terrain_de_sport'?'#9cc47f':'#c6c0b2');
 for(const a of d.woodland.filter(near)){const base=V2_COLORS[a.t]||V2_COLORS.bois;fill(a,shade(base,-.06));speckle(a,[shade(base,.06),shade(base,-.1),'#4e6b3b'],120,1.6,.5);}
 for(const a of d.hedgePolygons.filter(near))fill(a,'#5d8a47');
 for(const hd of d.hedges)line(hd.p,3,'#5a8646',Math.min(5,hd.w||2.4));
 // Water last (V2.1 rule): bed and bank under the animated surface.
 for(const a of d.water.filter(near)){outline(a,'#6f8a6a',2.6,.6);fill(a,'#4f6f7c');}
 for(const l of d.waterLines){if(l.perm)line(l.p,2,'#6b8767',l.w+2.6);line(l.p,2,l.perm?'#4e6e7b':'#7fa3ae',l.w);}
 const texture=new THREE.CanvasTexture(canvas);texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
 const mat=extend(new THREE.MeshStandardMaterial({map:texture,roughness:1,metalness:0}),'v25-ground',`
 float g=vnoise(vWorld.xz*.55)*.5+vnoise(vWorld.xz*2.3)*.5;float far=clamp(1.-fwidth(vWorld.x)*.35,0.,1.);
 diffuseColor.rgb*=1.+(g-.5)*.22*far;diffuseColor.rgb*=.96+.08*vnoise(vWorld.xz*.05);`);
 mat.envMap=envMap;mat.envMapIntensity=.25;
 const mesh=new THREE.Mesh(g,mat);mesh.name='v25-ground';mesh.receiveShadow=true;mesh.castShadow=false;parent.add(mesh);
 return {mesh,texture:{width:w,height:h,metresPerPixel:+(W/w).toFixed(2)},vertices:cols*rows};
}
