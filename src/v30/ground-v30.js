import * as THREE from 'three';
import {cropTint} from '../v2-scene.js';
import {toon} from '../v26/toon-materials.js';

// V3.0 premium ground. The V2.7–V2.9.2 ground was one 4096 px canvas for the whole extent (about 1,5 m per texel, 3 m in
// PERFORMANCE) and a 3 m class map read texel by texel: at the 420 m zoom a texel covers several screen pixels, so every
// land-cover limit read as a soft staircase and the furrow / meadow / wood-floor patterns stopped on 3 m steps.
// Here, without moving a single limit:
// - the canvas holds flat colours only (no random speckle, no stripe): micro-variation is drawn by the shader in world space;
// - limits get vector-drawn soft transitions (a pale grass verge between parcels, a herbaceous fringe along wood edges, a
//   feathered lawn fringe around the village, a grassy bank along the water), drawn at the canvas resolution;
// - a detail canvas (0,5–0,7 m per texel) is repainted around the viewed area when the camera rests, and blended into the
//   global one: at close range the limits are drawn at the precision of the vector data instead of the global texel;
// - the class map is read with four taps and bilinear weights (soft class transitions instead of 3 m steps);
// - the texture lookup is displaced by a world-space noise of about ±0,3 m: limits read as drawn, not rasterised.
// The geometry of the terrain and every frozen polygon are read, never written.
const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967296;};
const clamp=THREE.MathUtils.clamp;
const soft=(hex,sMin,sMax,lMin,lMax,dl=0)=>{const c=new THREE.Color(hex),h={};c.getHSL(h);return c.setHSL(h.h,clamp(h.s*.92,sMin,sMax),clamp(h.l+dl,lMin,lMax)).getStyle();};
const shade=(hex,l,s=0)=>new THREE.Color(hex).offsetHSL(0,s,l).getStyle();
// Early-summer crops, matured: wheat and barley in soft ochre / green-gold, rapeseed in muted yellow, root crops in cool green,
// hemp and pulses in sage, maize in pale ochre, fallow in warm beige. Keyed on the declared RPG crop (hue only).
const CROPS=[[/colza|moutarde/i,['#d6c76c','#dacb76']],[/bl[ée]|avoine|seigle|triticale|épeautre/i,['#cbb370','#c8b97a','#b8bc7a']],[/orge/i,['#cfbf7e','#c3c185']],[/chanvre|lin|pois|f[èe]ve|lentille|soja/i,['#abbf88','#b4c38e']],[/ma[iï]s|sorgho|tournesol/i,['#c7bc88','#bfb88c']],[/betterave|pomme de terre|l[ée]gume|oignon|carotte|chou/i,['#9bb983','#a4be88']],[/luzerne|tr[èe]fle|fourrag|prairie|gramin/i,['#9bbb7b','#93b576']],[/jach|gel|friche|non exploit/i,['#ccb98f','#d1be95']],[/vigne|verger|fruit/i,['#c0ad94']]];
const cropColor=(a,k)=>{if(a.t==='terre_arable'&&a.crop){const hit=CROPS.find(([re])=>re.test(a.crop));if(hit)return hit[1][Math.floor(k*hit[1].length)%hit[1].length];}return {jachere:'#cdbb92',autre_surface_agricole:'#bcc490',culture_permanente:'#c0ad94'}[a.t]||cropTint(a);};
const MEADOW=a=>['prairie_permanente','prairie_temporaire'].includes(a.t);
export const GROUND_V30={base:'#b4c497',lawn:'#a8c487',verge:'#bccb98',meadow:'#97b673',wood:'#6b9156',poplar:'#86a565',hedge:'#6c9558',yard:'#d1ccbf',sport:'#a3c288',parking:'#c2beb5',surface:'#cbc6ba',bank:'#b3c592',bed:'#7a9f98',bedSeasonal:'#8fb0a8',fringe:'#7f9f62'};

const bboxOf=o=>{let b=[Infinity,Infinity,-Infinity,-Infinity];for(const p of o.r)for(const r of p)for(let i=0;i<r.length;i+=2){if(r[i]<b[0])b[0]=r[i];if(r[i+1]<b[1])b[1]=r[i+1];if(r[i]>b[2])b[2]=r[i];if(r[i+1]>b[3])b[3]=r[i+1];}return b;};
const lineBox=(p,stride)=>{let b=[Infinity,Infinity,-Infinity,-Infinity];for(let i=0;i<p.length;i+=stride){if(p[i]<b[0])b[0]=p[i];if(p[i+1]<b[1])b[1]=p[i+1];if(p[i]>b[2])b[2]=p[i];if(p[i+1]>b[3])b[3]=p[i+1];}return b;};
// Bounding boxes computed once (the detail window repaints only what it overlaps).
export function prepareGroundData(d){const tag=(list,f)=>list.map(o=>({o,b:f(o)}));
 return {village:tag(d.village,bboxOf),artificial:tag(d.artificial,bboxOf),agriculture:tag(d.agriculture,bboxOf),woodland:tag(d.woodland,bboxOf),hedgePolygons:tag(d.hedgePolygons,bboxOf),
  hedges:tag(d.hedges,o=>lineBox(o.p,3)),water:tag(d.water,bboxOf),waterLines:tag(d.waterLines,o=>lineBox(o.p,2))};}

// Paints the flat land cover of `box` (any window) into a w × h canvas, with vector soft transitions at the limits.
export function paintGroundV30(ctx,{P,box,w,h}){
 const W=box.maxX-box.minX,D=box.maxZ-box.minZ,sx=w/W,sz=h/D,m=1/sx;
 const X=x=>(x-box.minX)*sx,Z=z=>(z-box.minZ)*sz;
 const over=b=>b[2]>=box.minX-20&&b[0]<=box.maxX+20&&b[3]>=box.minZ-20&&b[1]<=box.maxZ+20;
 const path=rings=>{ctx.beginPath();for(const r of rings){for(let i=0;i<r.length;i+=2)i?ctx.lineTo(X(r[i]),Z(r[i+1])):ctx.moveTo(X(r[i]),Z(r[i+1]));ctx.closePath();}};
 const fill=(o,color,alpha=1)=>{ctx.globalAlpha=alpha;ctx.fillStyle=color;for(const p of o.r){path(p);ctx.fill('evenodd');}ctx.globalAlpha=1;};
 // Soft band: concentric strokes of decreasing width (a cheap vector gradient across the limit, no blur filter).
 const band=(o,color,widthM,alpha,steps=3)=>{ctx.strokeStyle=color;ctx.lineJoin='round';for(let k=0;k<steps;k++){ctx.globalAlpha=alpha/steps*(1+k*.35);ctx.lineWidth=Math.max(.6,widthM*(1-k/steps)*sx);for(const p of o.r){path(p);ctx.stroke();}}ctx.globalAlpha=1;};
 const line=(p,stride,color,widthM,alpha=1)=>{ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=Math.max(.6,widthM*sx);ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();for(let i=0;i<p.length;i+=stride)i?ctx.lineTo(X(p[i]),Z(p[i+1])):ctx.moveTo(X(p[i]),Z(p[i+1]));ctx.stroke();ctx.globalAlpha=1;};
 const G=GROUND_V30;ctx.globalAlpha=1;ctx.fillStyle=G.base;ctx.fillRect(0,0,w,h);
 const vil=P.village.filter(e=>over(e.b)),agri=P.agriculture.filter(e=>over(e.b)),woods=P.woodland.filter(e=>over(e.b));
 for(const {o} of vil)fill(o,G.lawn);
 for(const {o} of P.artificial.filter(e=>over(e.b)&&e.o.kind==='perimetre'&&!/eolien|photovolt/.test(e.o.t)))fill(o,G.yard,.62);
 for(const {o} of agri){const k=hash(o.id),meadow=MEADOW(o),tint=meadow?soft(G.meadow,.28,.44,.53,.63,(k-.5)*.05):soft(cropColor(o,k),.28,.5,.56,.7,(k-.5)*.05);fill(o,tint);}
 // Parcel limits: a pale grass verge, 2,5 m, feathered (field margins), never a dark line.
 for(const {o} of agri)band(o,G.verge,2.6,.5);
 // Village fringe: the lawn spills softly over the limit (gardens into fields), 6 m feathered.
 for(const {o} of vil)band(o,G.lawn,6,.36,4);
 for(const {o} of P.artificial.filter(e=>over(e.b)&&e.o.kind==='surface'))fill(o,o.t==='parking'?G.parking:o.t==='terrain_de_sport'?G.sport:G.surface);
 // Woods: floor, then a herbaceous fringe across the edge (darker, greener, 7 m feathered) — the canopy mass covers the
 // inside exactly, so the visible part is the fringe on the field side: the wood ends in a soft shade, not a cut.
 for(const {o} of woods)fill(o,o.t==='peupleraie'?G.poplar:G.wood);
 for(const {o} of woods)band(o,G.fringe,7.5,.42,4);
 for(const {o} of P.hedgePolygons.filter(e=>over(e.b))){fill(o,G.hedge);band(o,G.fringe,4,.3,3);}
 for(const {o} of P.hedges.filter(e=>over(e.b))){line(o.p,3,G.fringe,Math.min(7,(o.w||2.4)+3),.28);line(o.p,3,G.hedge,Math.min(5,o.w||2.4),.9);}
 // Water last (V2.1 rule): a grassy bank, then a natural blue-green bed under the animated surface.
 for(const {o} of P.water.filter(e=>over(e.b))){band(o,G.bank,5,.75);fill(o,G.bed);}
 for(const {o} of P.waterLines.filter(e=>over(e.b))){line(o.p,2,G.bank,o.w+4.5,.55);line(o.p,2,G.bank,o.w+2.4,.8);line(o.p,2,o.perm?G.bed:G.bedSeasonal,o.w);}
 return m;
}
// Class map (no colour): cultivation direction (doubled angle) and a per-parcel random in RG, class in B
// (0 none, 1 arable, 2 meadow, 3 lawn, 4 wood floor). Same encoding as V2.9.1.
export function paintFieldV30(ctx,{P,box,w,h}){
 const W=box.maxX-box.minX,D=box.maxZ-box.minZ,sx=w/W,sz=h/D,X=x=>(x-box.minX)*sx,Z=z=>(z-box.minZ)*sz;
 const over=b=>b[2]>=box.minX-20&&b[0]<=box.maxX+20&&b[3]>=box.minZ-20&&b[1]<=box.maxZ+20;
 const path=rings=>{ctx.beginPath();for(const r of rings){for(let i=0;i<r.length;i+=2)i?ctx.lineTo(X(r[i]),Z(r[i+1])):ctx.moveTo(X(r[i]),Z(r[i+1]));ctx.closePath();}};
 const code=(cls,ang,k)=>{const mm=.3+.7*k,r=Math.round((Math.cos(2*ang)*mm*.5+.5)*255),g=Math.round((Math.sin(2*ang)*mm*.5+.5)*255);return `rgb(${r},${g},${Math.round(cls/4*255)})`;};
 ctx.globalAlpha=1;ctx.fillStyle='rgb(128,128,0)';ctx.fillRect(0,0,w,h);
 const fillAll=(o,c)=>{ctx.fillStyle=c;for(const p of o.r){path(p);ctx.fill('evenodd');}};
 for(const {o} of P.village.filter(e=>over(e.b)))fillAll(o,code(3,0,hash(o.id||'v')));
 for(const {o} of P.agriculture.filter(e=>over(e.b))){const ring=o.r[0]?.[0];if(!ring||ring.length<6)continue;let best=0,ang=0;for(let i=2;i<ring.length;i+=2){const dx=ring[i]-ring[i-2],dz=ring[i+1]-ring[i-1],L=Math.hypot(dx,dz);if(L>best){best=L;ang=Math.atan2(dz,dx);}}
  fillAll(o,code(MEADOW(o)?2:1,ang,hash(o.id+'k')));}
 for(const {o} of P.woodland.filter(e=>over(e.b)))fillAll(o,code(4,0,hash(o.id||'w')));
}

// Ground shader (after <color_fragment>): global + detail colour, smooth class weights, world-space patterns.
const GROUND_V30_DECL=`uniform sampler2D tGlobal,tGlobalField,tDetail,tDetailField;uniform vec4 uBox,uDet;uniform vec2 uGTexel,uDTexel;
struct FieldS{vec4 w;vec2 dir;float k;};
FieldS sampleField(sampler2D t,vec2 uv,vec2 texel){vec2 p=uv/texel-.5;vec2 i=floor(p),f=fract(p);FieldS s;s.w=vec4(0.);vec2 v=vec2(0.);float kk=0.;
 for(int y=0;y<2;y++)for(int x=0;x<2;x++){vec2 o=vec2(float(x),float(y));float wt=(x==0?1.-f.x:f.x)*(y==0?1.-f.y:f.y);vec4 fd=texture2D(t,(i+o+.5)*texel);float cls=floor(fd.b*4.+.5);vec2 fv=fd.rg*2.-1.;
  s.w+=wt*vec4(cls==1.?1.:0.,cls==2.?1.:0.,cls==3.?1.:0.,cls==4.?1.:0.);float lv=length(fv);v+=wt*(cls==1.?fv/max(lv,1e-3):vec2(0.));kk+=wt*clamp((lv-.3)/.7,0.,1.);}
 float a=atan(v.y,v.x)*.5;s.dir=vec2(cos(a),sin(a));s.k=kk;return s;}`;
const GROUND_V30_CHUNK=`vec2 wp=vWorld.xz;vec2 warp=(vec2(vnoise(wp*.19),vnoise(wp*.19+11.7))-.5)*.5+(vec2(vnoise(wp*.61+3.),vnoise(wp*.61+8.))-.5)*.16;vec2 wq=wp+warp;
 vec2 ug=(wq-uBox.xy)/uBox.zw;vec2 ud=(wq-uDet.xy)/uDet.z;float edgeD=max(abs(ud.x-.5),abs(ud.y-.5));float inD=uDet.w*(1.-smoothstep(.41,.49,edgeD));
 vec3 cg=texture2D(tGlobal,ug).rgb;vec3 cd=texture2D(tDetail,clamp(ud,0.,1.)).rgb;diffuseColor.rgb*=mix(cg,cd,inD);
 FieldS fs;if(inD>.5)fs=sampleField(tDetailField,clamp(ud,0.,1.),uDTexel);else fs=sampleField(tGlobalField,ug,uGTexel);
 float fw=fwidth(wp.x)+fwidth(wp.y);float near=1.-smoothstep(.35,1.6,fw);float mult=1.;
 if(fs.w.x>.01){vec2 fdir=fs.dir;float t=dot(wp,vec2(-fdir.y,fdir.x)),along=dot(wp,fdir),fk=fs.k;
  float sb=t/(5.5+fk*3.5);float band=.5+.5*sin(6.2832*sb+vnoise(vec2(along*.004,fk*7.))*2.);float pb=1.+.07*(band-.5)*(1.-smoothstep(.25,.6,fwidth(sb)));
  float sf=t/(1.7+fk*.6);float fur=abs(fract(sf)-.5)*2.;pb*=1.-.075*(smoothstep(.55,.95,fur)-.4)*(1.-smoothstep(.2,.5,fwidth(sf)))*mix(.45,1.,near);
  float tl=t/(24.+fk*4.);float td=abs(fract(tl)-.5)*2.;float lw=max(.035,fwidth(tl)*1.2);pb*=1.-.07*(1.-smoothstep(1.-lw*2.,1.-lw,td))*(1.-smoothstep(.12,.35,fwidth(tl)))*(.6+.4*vnoise(vec2(along*.01,fk*3.)));
  pb*=.965+.06*vnoise(vec2(along*.012,t*.03)+fk*9.)+.025*vnoise(wp*.22);
  mult=mix(mult,pb,fs.w.x);}
 if(fs.w.y>.01){float pm=.95+.07*vnoise(wp*.07+3.)+.04*vnoise(wp*.55);pm*=1.-.05*smoothstep(.62,.82,vnoise(wp*.31+3.))*(.4+.6*near);mult=mix(mult,pm,fs.w.y);}
 if(fs.w.z>.01){float pl=.975+.06*vnoise(wp*.045)+.03*vnoise(wp*.9)*near;pl*=1.-.04*smoothstep(.66,.84,vnoise(wp*.12+5.));mult=mix(mult,pl,fs.w.z);}
 if(fs.w.w>.01){float pw=.9+.12*vnoise(wp*.13);mult=mix(mult,pw,fs.w.w);}
 diffuseColor.rgb*=mult;float gr=vnoise(wp*.6)*.5+vnoise(wp*2.4)*.5;diffuseColor.rgb*=1.+(gr-.5)*.05*near;
 float big=vnoise(wp*.0045+2.)*.6+vnoise(wp*.013)*.4;diffuseColor.rgb*=mix(vec3(.985,1.,1.015),vec3(1.02,1.005,.975),big);`;

const texOf=(canvas,colour)=>{const t=new THREE.CanvasTexture(canvas);t.flipY=false;t.colorSpace=colour?THREE.SRGBColorSpace:THREE.NoColorSpace;if(colour)t.anisotropy=8;else{t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;}return t;};
const canvasOf=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};

export function buildGroundV30(v2,{size=4096,fieldSize=2048,detail=2048,detailM=1100}){
 const mesh=v2.group.getObjectByName('v2-terrain');if(!mesh)return null;
 const g=mesh.geometry,pos=g.getAttribute('position');let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);if(x<minX)minX=x;if(x>maxX)maxX=x;if(z<minZ)minZ=z;if(z>maxZ)maxZ=z;}
 const box={minX,maxX,minZ,maxZ},W=maxX-minX,D=maxZ-minZ,P=prepareGroundData(v2.data);
 const gc=canvasOf(size,Math.round(size*D/W));paintGroundV30(gc.getContext('2d'),{P,box,w:gc.width,h:gc.height});
 const fc=canvasOf(fieldSize,Math.round(fieldSize*D/W));paintFieldV30(fc.getContext('2d'),{P,box,w:fc.width,h:fc.height});
 const dc=canvasOf(detail,detail),dfc=canvasOf(detail,detail);const dctx=dc.getContext('2d'),dfctx=dfc.getContext('2d');dctx.fillStyle=GROUND_V30.base;dctx.fillRect(0,0,detail,detail);
 const tGlobal=texOf(gc,true),tGlobalField=texOf(fc,false),tDetail=texOf(dc,true),tDetailField=texOf(dfc,false);
 const U={tGlobal:{value:tGlobal},tGlobalField:{value:tGlobalField},tDetail:{value:tDetail},tDetailField:{value:tDetailField},uBox:{value:new THREE.Vector4(minX,minZ,W,D)},uDet:{value:new THREE.Vector4(0,0,detailM,0)},uGTexel:{value:new THREE.Vector2(1/fc.width,1/fc.height)},uDTexel:{value:new THREE.Vector2(1/detail,1/detail)}};
 const old=mesh.material;mesh.material=toon(new THREE.MeshLambertMaterial({vertexColors:true}),'ground-v30',GROUND_V30_CHUNK,U,{decl:GROUND_V30_DECL});old.dispose?.();
 // Detail window: painted around a centre, uploaded once; the shader fades it in over the inner 82 % of the window.
 let centre=null,paints=0,lastMs=0;
 const paint=c=>{const t0=performance.now(),half=detailM/2,b={minX:c[0]-half,maxX:c[0]+half,minZ:c[1]-half,maxZ:c[1]+half};
  paintGroundV30(dctx,{P,box:b,w:detail,h:detail});paintFieldV30(dfctx,{P,box:b,w:detail,h:detail});tDetail.needsUpdate=true;tDetailField.needsUpdate=true;
  U.uDet.value.set(b.minX,b.minZ,detailM,1);centre=c;paints++;lastMs=Math.round(performance.now()-t0);};
 return {mesh,box,texture:{width:gc.width,height:gc.height,metresPerPixel:+(W/gc.width).toFixed(2)},field:{width:fc.width,height:fc.height},detail:{size:detail,metres:detailM,metresPerPixel:+(detailM/detail).toFixed(2)},vertices:pos.count,
  // Called each frame with the viewed point and camera distance; repaints when the view rests away from the window centre.
  update:(target,distance,resting)=>{if(distance>2600){U.uDet.value.w=0;return false;}if(U.uDet.value.w===0&&centre)U.uDet.value.w=1;
   const far=!centre||Math.hypot(target[0]-centre[0],target[1]-centre[1])>detailM*.2;if(far&&(resting||!centre)){paint(target);return true;}return false;},
  stats:()=>({paints,lastPaintMs:lastMs,centre})};
}
