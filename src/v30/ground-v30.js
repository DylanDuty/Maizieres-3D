import * as THREE from 'three';
import {paintParcelsV33,paintParcelLimitsV33,paintParcelFieldV33,paintActivityV33} from '../v33/parcels-v33.js';
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
// - the class maps (class weights, cultivation direction) are read with hardware bilinear filtering: two taps give soft class
//   transitions instead of 3 m steps;
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
export function paintGroundV30(ctx,{P,box,w,h,v31=false,big=null,small=null,parcels=null}){
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
 // V3.1: industrial and commercial yards in a lighter, more neutral warm concrete at 70 % (less khaki), joined to the fields by a 4 m verge;
 // the shader adds a slow wear. Other perimeters keep the V3.0 yard.
 for(const {o} of P.artificial.filter(e=>over(e.b)&&e.o.kind==='perimetre'&&!/eolien|photovolt/.test(e.o.t))){const ind=v31&&/industri|commerc/.test(o.t);fill(o,ind?'#d2cdc1':G.yard,ind?.7:.62);if(ind)band(o,G.verge,4,.3);}
 // V3.3: interpreted plots (lawns, courts, drives, terraces, vegetable patches), civic forecourts, activity aprons and farm
 // yards, street verges; fields, woods and water are painted over them.
 if(parcels)paintParcelsV33(ctx,{Pc:parcels,X,Z,sx,over,m,detail:m<.8});
 for(const {o} of agri){const k=hash(o.id),meadow=MEADOW(o),tint=meadow?soft(G.meadow,.28,.44,.53,.63,(k-.5)*.05):soft(cropColor(o,k),.28,.5,.56,.7,(k-.5)*.05);fill(o,tint);}
 // Parcel limits: a pale grass verge, 2,5 m, feathered (field margins), never a dark line.
 for(const {o} of agri)band(o,G.verge,2.6,.5);
 // Village fringe: the lawn spills softly over the limit (gardens into fields), 6 m feathered.
 for(const {o} of vil)band(o,G.lawn,6,.36,4);
 if(parcels)paintParcelLimitsV33(ctx,{Pc:parcels,X,Z,sx,over});
 for(const {o} of P.artificial.filter(e=>over(e.b)&&e.o.kind==='surface'))fill(o,o.t==='parking'?(v31?'#b6b3ab':G.parking):o.t==='terrain_de_sport'?G.sport:G.surface);
 if(parcels)paintActivityV33(ctx,{P,X,Z,sx,over,detail:m<.8});
 // Woods: floor, then a herbaceous fringe across the edge (darker, greener, 7 m feathered) — the canopy mass covers the
 // inside exactly, so the visible part is the fringe on the field side: the wood ends in a soft shade, not a cut.
 for(const {o} of woods)fill(o,o.t==='peupleraie'?G.poplar:G.wood);
 for(const {o} of woods)band(o,G.fringe,7.5,.42,4);
 for(const {o} of P.hedgePolygons.filter(e=>over(e.b))){fill(o,G.hedge);band(o,G.fringe,4,.3,3);}
 for(const {o} of P.hedges.filter(e=>over(e.b))){line(o.p,3,G.fringe,Math.min(7,(o.w||2.4)+3),.28);line(o.p,3,G.hedge,Math.min(5,o.w||2.4),.9);}
 // V3.1: soft contact shade at the foot of large volumes (halls, farms, public buildings over 250 m²): 7 m feathered, the
 // footprint itself covers the inside. A ground occlusion cue, not a surface.
 if(big){ctx.strokeStyle='#6f6a60';ctx.lineJoin='round';for(const {o} of big.filter(e=>over(e.b)))for(const [wm,al] of [[7,.05],[4.5,.07],[2.4,.09]]){ctx.globalAlpha=al;ctx.lineWidth=Math.max(.6,wm*sx);ctx.beginPath();for(const r of o.poly){r.forEach((q,i)=>i?ctx.lineTo(X(q[0]),Z(q[1])):ctx.moveTo(X(q[0]),Z(q[1])));ctx.closePath();}ctx.stroke();}ctx.globalAlpha=1;}
 // V3.2: the same cue, narrower and lighter, at the foot of houses and annexes (20–250 m²): a 3 m feathered seat.
 if(small){ctx.strokeStyle='#6f6a60';ctx.lineJoin='round';const vis=small.filter(e=>over(e.b));for(const [wm,al] of [[3.2,.05],[1.7,.06],[.8,.07]]){ctx.globalAlpha=al;ctx.lineWidth=Math.max(.6,wm*sx);ctx.beginPath();for(const {o} of vis)for(const r of o.poly){r.forEach((q,i)=>i?ctx.lineTo(X(q[0]),Z(q[1])):ctx.moveTo(X(q[0]),Z(q[1])));ctx.closePath();}ctx.stroke();}ctx.globalAlpha=1;}
 // Water last (V2.1 rule): a grassy bank, then a natural blue-green bed under the animated surface.
 for(const {o} of P.water.filter(e=>over(e.b))){band(o,G.bank,5,.75);fill(o,G.bed);}
 for(const {o} of P.waterLines.filter(e=>over(e.b))){line(o.p,2,G.bank,o.w+4.5,.55);line(o.p,2,G.bank,o.w+2.4,.8);line(o.p,2,o.perm?G.bed:G.bedSeasonal,o.w);}
 return m;
}
// Class maps (no colour), read with hardware bilinear filtering (two taps give smooth class weights):
// A = class weights (R arable, G meadow, B lawn); B = cultivation direction of arable parcels (doubled angle, length
// .3–1 from a per-parcel random) in RG, zero vector elsewhere, wood floor in B.
export function paintFieldV30(ctxA,ctxB,{P,box,w,h,parcels=null}){
 const W=box.maxX-box.minX,D=box.maxZ-box.minZ,sx=w/W,sz=h/D,X=x=>(x-box.minX)*sx,Z=z=>(z-box.minZ)*sz;
 const over=b=>b[2]>=box.minX-20&&b[0]<=box.maxX+20&&b[3]>=box.minZ-20&&b[1]<=box.maxZ+20;
 const path=(ctx,rings)=>{ctx.beginPath();for(const r of rings){for(let i=0;i<r.length;i+=2)i?ctx.lineTo(X(r[i]),Z(r[i+1])):ctx.moveTo(X(r[i]),Z(r[i+1]));ctx.closePath();}};
 const dir=(ang,k)=>{const mm=.3+.7*k;return `rgb(${Math.round((Math.cos(2*ang)*mm*.5+.5)*255)},${Math.round((Math.sin(2*ang)*mm*.5+.5)*255)},0)`;};
 ctxA.globalAlpha=ctxB.globalAlpha=1;ctxA.fillStyle='rgb(0,0,0)';ctxA.fillRect(0,0,w,h);ctxB.fillStyle='rgb(128,128,0)';ctxB.fillRect(0,0,w,h);
 const fillAll=(o,a,b)=>{ctxA.fillStyle=a;ctxB.fillStyle=b;for(const p of o.r){path(ctxA,p);ctxA.fill('evenodd');path(ctxB,p);ctxB.fill('evenodd');}};
 for(const {o} of P.village.filter(e=>over(e.b)))fillAll(o,'rgb(0,0,255)','rgb(128,128,0)');
 if(parcels)paintParcelFieldV33(ctxA,ctxB,{Pc:parcels,X,Z,over});
 for(const {o} of P.agriculture.filter(e=>over(e.b))){const ring=o.r[0]?.[0];if(!ring||ring.length<6)continue;let best=0,ang=0;for(let i=2;i<ring.length;i+=2){const dx=ring[i]-ring[i-2],dz=ring[i+1]-ring[i-1],L=Math.hypot(dx,dz);if(L>best){best=L;ang=Math.atan2(dz,dx);}}
  if(MEADOW(o))fillAll(o,'rgb(0,255,0)','rgb(128,128,0)');else fillAll(o,'rgb(255,0,0)',dir(ang,hash(o.id+'k')));}
 for(const {o} of P.woodland.filter(e=>over(e.b)))fillAll(o,'rgb(0,0,0)','rgb(128,128,255)');
}
// Ground shader (after <color_fragment>): global + detail colour, smooth class weights, world-space patterns.
const GROUND_V30_DECL=`uniform sampler2D tGlobal,tGlobalFieldA,tGlobalFieldB,tDetail,tDetailFieldA,tDetailFieldB;uniform vec4 uBox,uDet;
struct FieldS{vec4 w;vec2 dir;float k;};
FieldS sampleField(sampler2D ta,sampler2D tb,vec2 uv){FieldS s;vec3 a=texture2D(ta,uv).rgb,b=texture2D(tb,uv).rgb;s.w=vec4(a,b.b);
 vec2 fv=b.rg*2.-1.;float lv=length(fv);float an=atan(fv.y,fv.x)*.5;s.dir=vec2(cos(an),sin(an));s.k=clamp((lv/max(a.r,.05)-.3)/.7,0.,1.);return s;}`;
// V3.3: the field record also keeps the length of the direction vector (plot lawns carry their mowing direction).
const GROUND_V33_DECL=GROUND_V30_DECL.replace('struct FieldS{vec4 w;vec2 dir;float k;};','struct FieldS{vec4 w;vec2 dir;float k;float l;};').replace('s.k=clamp(','s.l=lv;s.k=clamp(');
// lite (PERFORMANCE): same colours, limits and furrows; no secondary noise (meadow, lawn and wood-floor variation, grain
// octave, large-scale tint), about V2.9.1's per-pixel cost.
const groundChunk=(lite,v31=false,v33=false)=>`vec2 wp=vWorld.xz;
 vec2 ug=(wp-uBox.xy)/uBox.zw;vec2 ud=(wp-uDet.xy)/uDet.z;float edgeD=max(abs(ud.x-.5),abs(ud.y-.5));float inD=uDet.w*(1.-smoothstep(.41,.49,edgeD));
 vec3 cg=texture2D(tGlobal,ug).rgb;vec3 cd=texture2D(tDetail,clamp(ud,0.,1.)).rgb;diffuseColor.rgb*=mix(cg,cd,inD);
 FieldS fs;if(inD>.5)fs=sampleField(tDetailFieldA,tDetailFieldB,clamp(ud,0.,1.));else fs=sampleField(tGlobalFieldA,tGlobalFieldB,ug);
 float fw=fwidth(wp.x)+fwidth(wp.y);float near=1.-smoothstep(.35,1.6,fw);float mult=1.;
 if(fs.w.x>.01){vec2 fdir=fs.dir;float t=dot(wp,vec2(-fdir.y,fdir.x)),along=dot(wp,fdir),fk=fs.k;
  float sb=t/(5.5+fk*3.5);float band=.5+.5*sin(6.2832*sb${lite?'':'+vnoise(vec2(along*.004,fk*7.))*2.'});float pb=1.+.07*(band-.5)*(1.-smoothstep(.25,.6,fwidth(sb)));
  float sf=t/(1.7+fk*.6);float fur=abs(fract(sf)-.5)*2.;pb*=1.-.075*(smoothstep(.55,.95,fur)-.4)*(1.-smoothstep(.2,.5,fwidth(sf)))*mix(.45,1.,near);
  float tl=t/(24.+fk*4.);float td=abs(fract(tl)-.5)*2.;float lw=max(.035,fwidth(tl)*1.2);pb*=1.-.07*(1.-smoothstep(1.-lw*2.,1.-lw,td))*(1.-smoothstep(.12,.35,fwidth(tl)))${lite?'*.8':'*(.6+.4*vnoise(vec2(along*.01,fk*3.)))'};
  pb*=.965+.06*vnoise(vec2(along*.012,t*.03)+fk*9.)${lite?'':'+.025*vnoise(wp*.22)'};
  mult=mix(mult,pb,fs.w.x);}${lite?'':`
 if(fs.w.y>.01){float pm=.95+.09*vnoise(wp*.07+3.);pm*=1.-.05*smoothstep(.62,.82,vnoise(wp*.31+3.))*(.4+.6*near);mult=mix(mult,pm,fs.w.y);}
 if(fs.w.z>.01){float pl=.975+.07*vnoise(wp*.045);pl*=1.-.04*smoothstep(.66,.84,vnoise(wp*.12+5.));${v33?`
  if(fs.l>.3){float sm=dot(wp,vec2(-fs.dir.y,fs.dir.x))/1.8;pl*=1.+.045*(smoothstep(.25,.75,abs(fract(sm)-.5)*2.)-.5)*(1.-smoothstep(.2,.55,fwidth(sm)));}`:''}mult=mix(mult,pl,fs.w.z);}
 if(fs.w.w>.01){float pw=.9+.12*vnoise(wp*.13);mult=mix(mult,pw,fs.w.w);}${v31?`
 float ow=clamp(1.-fs.w.x-fs.w.y-fs.w.z-fs.w.w,0.,1.);if(ow>.01){float pu=.955+.09*vnoise(wp*.045+7.)+.04*vnoise(wp*.21+2.)*(.5+.5*near);mult=mix(mult,pu,ow);}`:''}`}
 diffuseColor.rgb*=mult;if(near>.01){float gr=${lite?'vnoise(wp*.6)':'vnoise(wp*.6)*.5+vnoise(wp*2.4)*.5'};diffuseColor.rgb*=1.+(gr-.5)*.05*near;}${lite?'':`
 float big=vnoise(wp*.006+2.);diffuseColor.rgb*=mix(vec3(.985,1.,1.015),vec3(1.02,1.005,.975),big);`}`;

const texOf=(canvas,colour)=>{const t=new THREE.CanvasTexture(canvas);t.flipY=false;t.colorSpace=colour?THREE.SRGBColorSpace:THREE.NoColorSpace;if(colour)t.anisotropy=8;else{t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearFilter;t.generateMipmaps=false;}return t;};
const canvasOf=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};

export function buildGroundV30(v2,{size=4096,fieldSize=2048,detail=2048,detailM=1100,lite=false,v31=false,v32=false,v33=false,parcels=null,buildings=null}){
 const mesh=v2.group.getObjectByName('v2-terrain');if(!mesh)return null;
 const g=mesh.geometry,pos=g.getAttribute('position');let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);if(x<minX)minX=x;if(x>maxX)maxX=x;if(z<minZ)minZ=z;if(z>maxZ)maxZ=z;}
 const box={minX,maxX,minZ,maxZ},W=maxX-minX,D=maxZ-minZ,P=prepareGroundData(v2.data);
 const area=r=>{let A=0;for(let i=0,j=r.length-1;i<r.length;j=i++)A+=(r[j][0]-r[i][0])*(r[j][1]+r[i][1]);return Math.abs(A)/2;};
 const big=v31&&buildings?buildings.filter(it=>it.poly?.[0]?.length>2&&area(it.poly[0])>250).map(o=>{let b=[Infinity,Infinity,-Infinity,-Infinity];for(const q of o.poly[0]){b[0]=Math.min(b[0],q[0]);b[1]=Math.min(b[1],q[1]);b[2]=Math.max(b[2],q[0]);b[3]=Math.max(b[3],q[1]);}return {o,b};}):null;
 const bb=o=>{let b=[Infinity,Infinity,-Infinity,-Infinity];for(const q of o.poly[0]){b[0]=Math.min(b[0],q[0]);b[1]=Math.min(b[1],q[1]);b[2]=Math.max(b[2],q[0]);b[3]=Math.max(b[3],q[1]);}return {o,b};};
 const small=v32&&buildings?buildings.filter(it=>{if(!(it.poly?.[0]?.length>2))return false;const a=area(it.poly[0]);return a>=20&&a<=250;}).map(bb):null;
 const gc=canvasOf(size,Math.round(size*D/W));paintGroundV30(gc.getContext('2d'),{P,box,w:gc.width,h:gc.height,v31,big,small,parcels});
 const fa=canvasOf(fieldSize,Math.round(fieldSize*D/W)),fb=canvasOf(fa.width,fa.height);paintFieldV30(fa.getContext('2d'),fb.getContext('2d'),{P,box,w:fa.width,h:fa.height,parcels});
 const dc=canvasOf(detail,detail),dfa=canvasOf(detail,detail),dfb=canvasOf(detail,detail);const dctx=dc.getContext('2d'),dfactx=dfa.getContext('2d'),dfbctx=dfb.getContext('2d');dctx.fillStyle=GROUND_V30.base;dctx.fillRect(0,0,detail,detail);
 const tGlobal=texOf(gc,true),tGlobalFieldA=texOf(fa,false),tGlobalFieldB=texOf(fb,false),tDetail=texOf(dc,true),tDetailFieldA=texOf(dfa,false),tDetailFieldB=texOf(dfb,false);
 const U={tGlobal:{value:tGlobal},tGlobalFieldA:{value:tGlobalFieldA},tGlobalFieldB:{value:tGlobalFieldB},tDetail:{value:tDetail},tDetailFieldA:{value:tDetailFieldA},tDetailFieldB:{value:tDetailFieldB},uBox:{value:new THREE.Vector4(minX,minZ,W,D)},uDet:{value:new THREE.Vector4(0,0,detailM,0)}};
 const old=mesh.material;mesh.material=toon(new THREE.MeshLambertMaterial({vertexColors:true}),lite?'ground-v30-lite':v33?'ground-v33':v31?'ground-v31':'ground-v30',groundChunk(lite,v31,v33&&!lite),U,{decl:v33&&!lite?GROUND_V33_DECL:GROUND_V30_DECL});old.dispose?.();
 // Detail window: painted around a centre, uploaded once; the shader fades it in over the inner 82 % of the window.
 let centre=null,paints=0,lastMs=0;
 const paint=c=>{const t0=performance.now(),half=detailM/2,b={minX:c[0]-half,maxX:c[0]+half,minZ:c[1]-half,maxZ:c[1]+half};
  paintGroundV30(dctx,{P,box:b,w:detail,h:detail,v31,big,small,parcels});paintFieldV30(dfactx,dfbctx,{P,box:b,w:detail,h:detail,parcels});tDetail.needsUpdate=true;tDetailFieldA.needsUpdate=true;tDetailFieldB.needsUpdate=true;
  U.uDet.value.set(b.minX,b.minZ,detailM,1);centre=c;paints++;lastMs=Math.round(performance.now()-t0);};
 return {mesh,box,texture:{width:gc.width,height:gc.height,metresPerPixel:+(W/gc.width).toFixed(2)},field:{width:fa.width,height:fa.height},detail:{size:detail,metres:detailM,metresPerPixel:+(detailM/detail).toFixed(2)},vertices:pos.count,
  // Called each frame with the viewed point and camera distance; repaints when the view rests away from the window centre.
  update:(target,distance,resting)=>{if(distance>2600){U.uDet.value.w=0;return false;}if(U.uDet.value.w===0&&centre)U.uDet.value.w=1;
   const far=!centre||Math.hypot(target[0]-centre[0],target[1]-centre[1])>detailM*.2;if(far&&(resting||!centre)){paint(target);return true;}return false;},
  contactVolumes:big?big.length:0,contactHouses:small?small.length:0,
  stats:()=>({paints,lastPaintMs:lastMs,centre})};
}
