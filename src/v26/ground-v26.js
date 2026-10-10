import * as THREE from 'three';
import {random} from '../geo.js';
import {cropTint} from '../v2-scene.js';
import {toon} from './toon-materials.js';

// V2.6 Poussey diorama — illustrated ground: a 5 m patch draped on the displayed relief (+6 cm), painted like a
// storybook map. Soft pastel parcels keyed to the declared crop (hue kept, saturation and lightness harmonised), gentle
// furrow stripes, meadow mottling, village lawns with light patches and a few flower dots, dark-green wood floor, a pale
// grass strip at parcel borders, a clear turquoise bed under the stream. Pure drawing; altitudes unchanged.
// V2.7 reuses the painter (paintGround) on the whole-commune terrain.
const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967296;};
const clamp=THREE.MathUtils.clamp;
const pastel=(hex,sMin,sMax,lMin,lMax,dl=0)=>{const c=new THREE.Color(hex),h={};c.getHSL(h);return c.setHSL(h.h,clamp(h.s,sMin,sMax),clamp(h.l+dl,lMin,lMax)).getStyle();};
const shade=(hex,l)=>new THREE.Color(hex).offsetHSL(0,0,l).getStyle();
// Spring palette for the declared crops (late May): young cereals in fresh green, barley and hemp paler, rapeseed in
// bloom, beet and potato rows in bluish green, lucerne and grass meadows, fallow in pale straw. Keyed on the RPG label.
const SPRING=[[/colza|moutarde/i,['#e4dc7e','#e9e18a']],[/bl[ée]|avoine|seigle|triticale|épeautre/i,['#b9d08a','#c3d690','#aec982']],[/orge/i,['#cfdc96','#d8e09c']],[/chanvre|lin|pois|f[èe]ve|lentille|soja/i,['#c4d79e','#cedba4']],[/ma[iï]s|sorgho|tournesol/i,['#d3d49c','#dbd8a2']],[/betterave|pomme de terre|l[ée]gume|oignon|carotte|chou/i,['#a9cf96','#b5d49c']],[/luzerne|tr[èe]fle|fourrag|prairie|gramin/i,['#aed38c','#a4cc84']],[/jach|gel|friche/i,['#d8d3a4','#dcd5a9']],[/vigne|verger|fruit/i,['#cbb9a4']]];
const springTint=(a,k)=>{if(a.t==='terre_arable'&&a.crop){const hit=SPRING.find(([re])=>re.test(a.crop));if(hit)return hit[1][Math.floor(k*hit[1].length)%hit[1].length];}return {jachere:'#d7d2a3',autre_surface_agricole:'#cdd7a0',culture_permanente:'#cbb9a4'}[a.t]||cropTint(a);};

// Paints the illustrated land cover of `box` into a w × h canvas context (x → u, z → v). Shared by V2.6 and V2.7.
export function paintGround(ctx,{d,box,w,h,seed=2026,style='v26'}){
 const W=box.maxX-box.minX,D=box.maxZ-box.minZ,sx=w/W,sz=h/D,rng=random(seed);
 const X=x=>(x-box.minX)*sx,Z=z=>(z-box.minZ)*sz;
 const path=rings=>{ctx.beginPath();for(const r of rings){for(let i=0;i<r.length;i+=2)i?ctx.lineTo(X(r[i]),Z(r[i+1])):ctx.moveTo(X(r[i]),Z(r[i+1]));ctx.closePath();}};
 const fill=(o,color,alpha=1)=>{ctx.globalAlpha=alpha;ctx.fillStyle=color;for(const p of o.r){path(p);ctx.fill('evenodd');}ctx.globalAlpha=1;};
 const outline=(o,color,widthM,alpha=1)=>{ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineJoin='round';ctx.lineWidth=Math.max(.8,widthM*sx);for(const p of o.r){path(p);ctx.stroke();}ctx.globalAlpha=1;};
 const line=(p,stride,color,widthM)=>{ctx.strokeStyle=color;ctx.lineWidth=Math.max(.8,widthM*sx);ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();for(let i=0;i<p.length;i+=stride)i?ctx.lineTo(X(p[i]),Z(p[i+1])):ctx.moveTo(X(p[i]),Z(p[i+1]));ctx.stroke();};
 const bb=o=>{let b=[Infinity,Infinity,-Infinity,-Infinity];for(const p of o.r)for(const r of p)for(let i=0;i<r.length;i+=2)b=[Math.min(b[0],r[i]),Math.min(b[1],r[i+1]),Math.max(b[2],r[i]),Math.max(b[3],r[i+1])];return b;};
 const near=o=>{const b=bb(o);return b[2]>=box.minX&&b[0]<=box.maxX&&b[3]>=box.minZ&&b[1]<=box.maxZ;};
 const bearing=o=>{let best=0,bl=0;for(const r of o.r[0])for(let i=2;i<r.length;i+=2){const dx=r[i]-r[i-2],dz=r[i+1]-r[i-1],l=dx*dx+dz*dz;if(l>bl){bl=l;best=Math.atan2(dz,dx);}}return best;};
 const speckle=(o,colors,perHa,radiusM,alpha=.45)=>{const b=bb(o),x0=Math.max(b[0],box.minX),x1=Math.min(b[2],box.maxX),z0=Math.max(b[1],box.minZ),z1=Math.min(b[3],box.maxZ),count=Math.min(9000,Math.round((x1-x0)*(z1-z0)/1e4*perHa));if(count<=0)return;ctx.save();path(o.r.flat());ctx.clip('evenodd');ctx.globalAlpha=alpha;
  for(const [k,color] of colors.entries()){ctx.fillStyle=color;ctx.beginPath();for(let i=k;i<count;i+=colors.length){const x=X(x0+rng()*(x1-x0)),z=Z(z0+rng()*(z1-z0)),r=Math.max(.7,radiusM*(.5+rng())*sx);ctx.moveTo(x+r,z);ctx.arc(x,z,r,0,6.283);}ctx.fill();}ctx.globalAlpha=1;ctx.restore();};
 const stripes=(o,color,spacingM,alpha,widthM)=>{const b=bb(o),a=bearing(o),cx=(b[0]+b[2])/2,cz=(b[1]+b[3])/2,R=Math.hypot(b[2]-b[0],b[3]-b[1])/2;if(spacingM*sx<1.6)return;ctx.save();path(o.r.flat());ctx.clip('evenodd');ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=Math.max(.8,widthM*sx);ctx.beginPath();
  const ux=Math.cos(a),uz=Math.sin(a),vx=-uz,vz=ux;for(let s=-R;s<=R;s+=spacingM){ctx.moveTo(X(cx+vx*s-ux*R),Z(cz+vz*s-uz*R));ctx.lineTo(X(cx+vx*s+ux*R),Z(cz+vz*s+uz*R));}ctx.stroke();ctx.restore();ctx.globalAlpha=1;};
 ctx.fillStyle='#bcd392';ctx.fillRect(0,0,w,h);
 // Village: soft lawns, lighter mown patches, a few flower dots.
 for(const v of d.village.filter(near)){fill(v,style==='v291'?'#a6da7f':'#a9d07f');speckle(v,['#b4d788','#a0c97a','#bcdb90'],60,3.5,.32);speckle(v,['#f1e3a2','#f3cbd0','#f7f0d8'],5,.9,.75);}
 for(const a of d.artificial.filter(a=>a.kind==='perimetre'&&near(a)&&!/eolien|photovolt/.test(a.t)))fill(a,style==='v291'?'#dcdcd4':'#e3dfd0',style==='v291'?.6:.55);
 const rich=style==='v291';for(const a of d.agriculture.filter(near)){const k=hash(a.id),meadow=['prairie_permanente','prairie_temporaire'].includes(a.t);const tint=meadow?(rich?pastel('#9fcd78',.4,.56,.6,.68,(k-.5)*.06):pastel('#a7cf82',.3,.45,.66,.72,(k-.5)*.05)):(rich?pastel(springTint(a,k),.38,.64,.62,.77,(k-.5)*.06):pastel(springTint(a,k),.28,.5,.68,.8,(k-.5)*.04));fill(a,tint);
  if(meadow)speckle(a,['#c3e09b','#99c278'],70,2,.4);else{stripes(a,shade(tint,-.09),2.2+k*1.1,.14,.5);speckle(a,[shade(tint,.05),shade(tint,-.04)],25,1.6,.3);}}
 for(const a of d.agriculture.filter(near))outline(a,'#9cbd72',1.1,.75);
 // V2.9: the fields become a graphic surface. Arable parcels get faint furrows along their longest edge (a cultivation
 // direction, not a declared crop), meadows a soft speckle; both low-contrast so the parcels keep their pastel reading.
 if(style==='v29'){for(const a of d.agriculture.filter(near)){const ring=a.r[0]?.[0];if(!ring||ring.length<8)continue;let best=0,ux=1,uz=0;for(let i=2;i<ring.length;i+=2){const dx=ring[i]-ring[i-2],dz=ring[i+1]-ring[i-1],L=Math.hypot(dx,dz);if(L>best){best=L;ux=dx/L;uz=dz/L;}}
   const meadow=['prairie_permanente','prairie_temporaire'].includes(a.t);ctx.save();ctx.beginPath();for(const p of a.r){path(p);}ctx.clip('evenodd');
   let bx0=Infinity,bx1=-Infinity,bz0=Infinity,bz1=-Infinity;for(let i=0;i<ring.length;i+=2){bx0=Math.min(bx0,ring[i]);bx1=Math.max(bx1,ring[i]);bz0=Math.min(bz0,ring[i+1]);bz1=Math.max(bz1,ring[i+1]);}
   const cx=(bx0+bx1)/2,cz=(bz0+bz1)/2,R=Math.hypot(bx1-bx0,bz1-bz0)/2,k=hash(a.id+'f');
   if(meadow){ctx.fillStyle='#8fb86a';ctx.globalAlpha=.16;const n=Math.min(400,Math.round((bx1-bx0)*(bz1-bz0)/900));for(let i=0;i<n;i++){const x=bx0+hash(a.id+i)*(bx1-bx0),z=bz0+hash(a.id+'z'+i)*(bz1-bz0);ctx.beginPath();ctx.arc(X(x),Z(z),Math.max(.6,1.4*sx),0,6.283);ctx.fill();}}
   else{ctx.strokeStyle=k<.5?'#8fa65c':'#b9b47a';ctx.globalAlpha=.13;ctx.lineWidth=Math.max(.8,1.3*sx);const gap=6.5+k*3;for(let t=-R;t<=R;t+=gap){const px=cx-uz*t,pz=cz+ux*t;ctx.beginPath();ctx.moveTo(X(px-ux*R),Z(pz-uz*R));ctx.lineTo(X(px+ux*R),Z(pz+uz*R));ctx.stroke();}}
   ctx.restore();ctx.globalAlpha=1;}}
 for(const a of d.artificial.filter(a=>a.kind==='surface'&&near(a)))fill(a,a.t==='parking'?'#c3c0b8':a.t==='terrain_de_sport'?'#a5d08a':'#cec9bd');
 for(const a of d.woodland.filter(near)){const base=a.t==='peupleraie'?'#8fb56a':'#73a35e';fill(a,base);speckle(a,[shade(base,.06),shade(base,-.07)],90,1.8,.45);}
 for(const a of d.hedgePolygons.filter(near))fill(a,'#6ea35b');
 for(const hd of d.hedges)line(hd.p,3,'#6a9f58',Math.min(5,hd.w||2.4));
 // Water last (V2.1 rule): a pale grass bank and a clear turquoise bed under the animated surface.
 for(const a of d.water.filter(near)){outline(a,'#b9d59a',3,.8);fill(a,'#8fc9d8');}
 for(const l of d.waterLines){line(l.p,2,'#b9d59a',l.w+3.2);line(l.p,2,l.perm?'#8fc9d8':'#a9d2dc',l.w);}
}
// V2.9.1 — field data map for the ground shader (no colour): per pixel, the cultivation direction of the parcel
// (doubled angle, so a direction and its opposite are the same), a per-parcel random in the vector length, and a class
// in blue: 0 none, 1 arable, 2 meadow, 3 village lawn, 4 wood floor. The shader draws the furrows, bands and grain in
// world space at full resolution from it; the painted canvas keeps the colours.
export function paintFieldData(ctx,{d,box,w,h}){
 const W=box.maxX-box.minX,D=box.maxZ-box.minZ,sx=w/W,sz=h/D,X=x=>(x-box.minX)*sx,Z=z=>(z-box.minZ)*sz;
 const path=rings=>{ctx.beginPath();for(const r of rings){for(let i=0;i<r.length;i+=2)i?ctx.lineTo(X(r[i]),Z(r[i+1])):ctx.moveTo(X(r[i]),Z(r[i+1]));ctx.closePath();}};
 const code=(cls,ang,k)=>{const m=.3+.7*k,r=Math.round((Math.cos(2*ang)*m*.5+.5)*255),g=Math.round((Math.sin(2*ang)*m*.5+.5)*255);return `rgb(${r},${g},${Math.round(cls/4*255)})`;};
 ctx.fillStyle='rgb(128,128,0)';ctx.fillRect(0,0,w,h);
 const fillAll=(o,c)=>{ctx.fillStyle=c;for(const p of o.r){path(p);ctx.fill('evenodd');}};
 for(const v of d.village)fillAll(v,code(3,0,hash(v.id||'v')));
 for(const a of d.agriculture){const ring=a.r[0]?.[0];if(!ring||ring.length<6)continue;let best=0,ang=0;for(let i=2;i<ring.length;i+=2){const dx=ring[i]-ring[i-2],dz=ring[i+1]-ring[i-1],L=Math.hypot(dx,dz);if(L>best){best=L;ang=Math.atan2(dz,dx);}}
  fillAll(a,code(['prairie_permanente','prairie_temporaire'].includes(a.t)?2:1,ang,hash(a.id+'k')));}
 for(const a of d.woodland)fillAll(a,code(4,0,hash(a.id||'w')));
}
export const FIELD_SHADER=`vec4 fd=texture2D(tField,vUvM);float cls=floor(fd.b*4.+.5);vec2 fv=fd.rg*2.-1.;float fang=atan(fv.y,fv.x)*.5,fk=clamp((length(fv)-.3)/.7,0.,1.);vec2 fdir=vec2(cos(fang),sin(fang));
 if(cls==1.){float t=dot(vWorld.xz,vec2(-fdir.y,fdir.x)),along=dot(vWorld.xz,fdir);
  float sb=t/(5.5+fk*3.5);float fb=fwidth(sb);float band=.5+.5*sin(6.2832*sb);diffuseColor.rgb*=1.+.075*(band-.5)*(1.-smoothstep(.25,.6,fb));
  float sf=t/(1.7+fk*.6);float ff=fwidth(sf);float fur=abs(fract(sf)-.5)*2.;diffuseColor.rgb*=1.-.07*(smoothstep(.5,.95,fur)-.4)*(1.-smoothstep(.2,.5,ff));
  float tl=t/(24.+fk*4.);float tw=fwidth(tl);float td=abs(fract(tl)-.5)*2.;float lw=max(.035,tw*1.2);diffuseColor.rgb*=1.-.1*(1.-smoothstep(1.-lw*2.,1.-lw,td))*(1.-smoothstep(.12,.35,tw));
  diffuseColor.rgb*=.95+.09*vnoise(vec2(along*.012,t*.03)+fk*9.)+.035*vnoise(vWorld.xz*.22);
  diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.06,1.02,.88),.55*smoothstep(.55,.85,vnoise(vWorld.xz*.008+fk*4.)));}
 else if(cls==2.){diffuseColor.rgb*=.93+.09*vnoise(vWorld.xz*.07+fk*5.)+.06*vnoise(vWorld.xz*.55);diffuseColor.rgb*=1.-.08*smoothstep(.6,.8,vnoise(vWorld.xz*.31+3.));diffuseColor.rgb*=vec3(.98,1.01,.97);}
 else if(cls==3.){diffuseColor.rgb*=.97+.1*vnoise(vWorld.xz*.04);diffuseColor.rgb*=1.-.07*smoothstep(.66,.84,vnoise(vWorld.xz*.12+5.));diffuseColor.rgb*=.97+.06*vnoise(vWorld.xz*.9);}
 else if(cls==4.){diffuseColor.rgb*=.88+.14*vnoise(vWorld.xz*.13);}`;
export const GROUND_GRAIN=`float gr=vnoise(vWorld.xz*.6)*.5+vnoise(vWorld.xz*2.4)*.5;float far=clamp(1.-fwidth(vWorld.x)*.4,0.,1.);diffuseColor.rgb*=1.+(gr-.5)*.09*far;`;

export function buildGroundV26(parent,{v2,box,heightAt,size=2048}){
 const {data:d}=v2,W=box.maxX-box.minX,D=box.maxZ-box.minZ,step=5,cols=Math.round(W/step)+1,rows=Math.round(D/step)+1;
 const pos=new Float32Array(cols*rows*3),uv=new Float32Array(cols*rows*2),index=[];
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const k=r*cols+c,x=box.minX+c*step,z=box.minZ+r*step;pos[k*3]=x;pos[k*3+1]=heightAt(x,z)+.06;pos[k*3+2]=z;uv[k*2]=c/(cols-1);uv[k*2+1]=r/(rows-1);}
 for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){const a=r*cols+c,b=a+1,e=a+cols,f=e+1;index.push(a,e,b,b,e,f);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();
 const canvas=document.createElement('canvas'),w=size,h=Math.round(size*D/W);canvas.width=w;canvas.height=h;
 paintGround(canvas.getContext('2d'),{d,box,w,h});
 const texture=new THREE.CanvasTexture(canvas);texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
 const mat=toon(new THREE.MeshLambertMaterial({map:texture}),'ground',GROUND_GRAIN);
 const mesh=new THREE.Mesh(g,mat);mesh.name='v26-ground';mesh.receiveShadow=true;mesh.castShadow=false;parent.add(mesh);
 return {mesh,texture:{width:w,height:h,metresPerPixel:+(W/w).toFixed(2)},vertices:cols*rows};
}
