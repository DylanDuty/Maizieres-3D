import * as THREE from 'three';
import {insidePoly,area} from '../geo.js';
import {fnv,range} from '../v25/procedural-houses.js';

// V3.2 village architecture (style 'v32'). Everything here is read from the frozen footprint and the V2.3.1 profile
// (class, documented roof type and colour family, IGN wall material, contact with a neighbour); nothing is random:
// a choice inside a family uses the FNV hash of the building id, so a house keeps its look from one load to the next.
// Footprints, heights, documented roof types and colour families are never changed.

const dot=(q,v)=>q[0]*v[0]+q[1]*v[1];
const hashOf=(id,salt='')=>fnv(id+salt)/4294967296;

// ---- Roofs over L, T and U footprints: one gabled wing per rectangle of the footprint ----
// V2.3–V3.1 drew a single gable over the minimum rectangle of the footprint: on an L the ridge ran over the empty corner and
// the wing got a long catslide. Here a near-rectilinear footprint (in the frame of the documented or footprint ridge) is cut
// into at most four rectangles; each one carries a gable with the same pitch, the narrower wing runs into the wider one up
// to its ridge (valleys), a wider wing runs through a narrower one. Roof = max of the wing gables, still split along its
// creases so that every roof piece stays planar. The documented rise is the ridge of the main wing: the total height
// (LiDAR or IGN) is unchanged; a narrower wing has a lower ridge.
export function wingRoofV32(p,poly,{arch=null,overhang=.5}={}){
 if(poly.length!==1||!p.arch||p.arch.shape!=='gabled'||p.roofHeight<=.3)return null;
 const ring=poly[0],U=p.arch.across,V=p.arch.along,n=ring.length;if(n<6)return null;
 const P=ring.map(q=>[dot(q,U),dot(q,V)]);
 // Edges ≥ 0,6 m must be parallel to the frame (± 9°); their positions give the cuts of the rectilinear partition.
 let per=0,off=0;const ca=[],cb=[];
 for(let i=0;i<n;i++){const [a0,b0]=P[i],[a1,b1]=P[(i+1)%n],L=Math.hypot(a1-a0,b1-b0);per+=L;if(L<.6)continue;const ang=Math.atan2(Math.abs(b1-b0),Math.abs(a1-a0));
  if(ang<.16)cb.push([(b0+b1)/2,L]);else if(ang>Math.PI/2-.16)ca.push([(a0+a1)/2,L]);else off+=L;}
 if(off>.08*per)return null;
 const cluster=list=>{list.sort((x,y)=>x[0]-y[0]);const out=[];for(const [v,w] of list){const last=out[out.length-1];if(last&&v-last.v<1.1){last.v=(last.v*last.w+v*w)/(last.w+w);last.w+=w;}else out.push({v,w});}return out.map(o=>o.v);};
 const AC=cluster(ca),BC=cluster(cb);if(AC.length<2||BC.length<2||AC.length>7||BC.length>7)return null;
 const na=AC.length-1,nb=BC.length-1,filled=new Uint8Array(na*nb);let cells=0,cellArea=0;
 for(let i=0;i<na;i++)for(let j=0;j<nb;j++){const am=(AC[i]+AC[i+1])/2,bm=(BC[j]+BC[j+1])/2,q=[U[0]*am+V[0]*bm,U[1]*am+V[1]*bm];if(insidePoly(q,poly)){filled[i*nb+j]=1;cells++;cellArea+=(AC[i+1]-AC[i])*(BC[j+1]-BC[j]);}}
 if(cells===na*nb)return null;// a plain rectangle: the standard roof
 const fa=area(ring);if(Math.abs(cellArea/fa-1)>.1)return null;
 // Greedy partition: the largest full rectangle of cells first.
 const used=new Uint8Array(na*nb),rects=[];
 for(let guard=0;guard<6;guard++){let best=null;
  for(let i0=0;i0<na;i0++)for(let j0=0;j0<nb;j0++){if(!filled[i0*nb+j0]||used[i0*nb+j0])continue;
   for(let i1=i0;i1<na;i1++){let ok=true;for(let j1=j0;j1<nb;j1++){for(let i=i0;i<=i1&&ok;i++)if(!filled[i*nb+j1]||used[i*nb+j1])ok=false;if(!ok)break;
     const ar=(AC[i1+1]-AC[i0])*(BC[j1+1]-BC[j0]);if(!best||ar>best.ar)best={i0,i1,j0,j1,ar};}
    if(!filled[i1*nb+j0]||used[i1*nb+j0])break;}}
  if(!best)break;for(let i=best.i0;i<=best.i1;i++)for(let j=best.j0;j<=best.j1;j++)used[i*nb+j]=1;
  rects.push({lo:[AC[best.i0],BC[best.j0]],hi:[AC[best.i1+1],BC[best.j1+1]]});if(rects.length>4)return null;}
 if(rects.length<2||used.some((u,k)=>filled[k]&&!u))return null;
 if(rects.some(r=>Math.min(r.hi[0]-r.lo[0],r.hi[1]-r.lo[1])<1.6))return null;// sliver: keep the standard roof
 const touch=(r,o,ax)=>{const other=1-ax,ov=Math.min(r.hi[other],o.hi[other])-Math.max(r.lo[other],o.lo[other]);if(ov<1)return 0;return Math.abs(r.lo[ax]-o.hi[ax])<.05?-1:Math.abs(r.hi[ax]-o.lo[ax])<.05?1:0;};
 // k = coordinate across which the gable varies (0 = A, 1 = B); the ridge runs along the other one.
 const main=rects[0],wa=main.hi[0]-main.lo[0],wb=main.hi[1]-main.lo[1];main.k=wb>=wa*.9?0:1;
 for(const r of rects.slice(1)){let k=null;for(const o of rects){if(o===r||o.k==null)continue;for(const ax of [0,1])if(touch(r,o,ax)){const depth=r.hi[ax]-r.lo[ax],width=r.hi[1-ax]-r.lo[1-ax];k=width>depth*1.6?ax:1-ax;}if(k!=null)break;}
  r.k=k??((r.hi[1]-r.lo[1])>=(r.hi[0]-r.lo[0])?0:1);}
 for(const r of rects){r.mid=(r.lo[r.k]+r.hi[r.k])/2;r.half=(r.hi[r.k]-r.lo[r.k])/2;}
 // Pitch: the documented slope when it is the source of the rise, otherwise the documented rise over the main wing.
 const measured=arch&&arch.totalHeightM!=null&&arch.wallHeightM!=null&&['measured','official'].includes(arch.totalHeightStatus)&&['measured','official'].includes(arch.wallHeightStatus);
 let s=!measured&&arch?.roof?.slopeDeg?Math.tan(arch.roof.slopeDeg*Math.PI/180):p.roofHeight/main.half;s=Math.min(s,1.3,p.roofHeight/Math.max(.5,Math.max(...rects.map(r=>r.half))));
 // Extent of each gable along its ridge: own rectangle, a free end overshoots by the overhang, an end against another
 // wing runs to that wing's ridge (wider or equal wing across it) or through it (narrower or parallel wing).
 const m=overhang+.45,lines=[];
 for(const r of rects){const ax=1-r.k;r.dlo=r.lo[ax]-m;r.dhi=r.hi[ax]+m;
  for(const o of rects){if(o===r)continue;const side=touch(r,o,ax);if(!side)continue;
   const stop=o.k===ax&&o.half>=r.half-.05;// a wider (or equal) wing across this one: up to its ridge
   if(side<0)r.dlo=Math.min(r.dlo,stop?o.mid:o.lo[ax]-m);else r.dhi=Math.max(r.dhi,stop?o.mid:o.hi[ax]+m);}}
 const axisOf=k=>k===0?U:V;
 for(const r of rects)lines.push({n:axisOf(r.k),c:r.mid});
 for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const r=rects[i],o=rects[j];
  if(r.k!==o.k){const ar=axisOf(r.k),ao=axisOf(o.k);for(const si of [1,-1])for(const so of [1,-1])lines.push({n:[si*ar[0]-so*ao[0],si*ar[1]-so*ao[1]],c:r.half-o.half+si*r.mid-so*o.mid});}
  else{const a=axisOf(r.k),[x1,h1,x2,h2]=r.mid<o.mid?[r.mid,r.half,o.mid,o.half]:[o.mid,o.half,r.mid,r.half];lines.push({n:a,c:(x1+x2+h1-h2)/2});}}
 const coord=(q,k)=>k===0?dot(q,U):dot(q,V);
 const h=q=>{let best=-Infinity;for(const r of rects){const y=coord(q,1-r.k);if(y<r.dlo-1e-6||y>r.dhi+1e-6)continue;const g=s*(r.half-Math.abs(coord(q,r.k)-r.mid));if(g>best)best=g;}
  if(best>-Infinity)return best;for(const r of rects){const y=coord(q,1-r.k),d=Math.max(r.dlo-y,y-r.dhi,0);if(d<2.5){const g=s*(r.half-Math.abs(coord(q,r.k)-r.mid));if(g>best)best=g;}}return best>-Infinity?best:0;};
 // Ridge segments over the whole extent (extensions included): the cap keeps only the part that is the visible top.
 const ridges=rects.map(r=>({at:t=>{const a=r.k===0?r.mid:t,b=r.k===0?t:r.mid;return [U[0]*a+V[0]*b,U[1]*a+V[1]*b];},s0:r.dlo,s1:r.dhi,height:s*r.half,dir:axisOf(1-r.k)}));
 return {h,lines,ridges,wings:rects.length,pitch:s};
}

// ---- Lean-to annexes: a shed, garage or annex of undocumented roof glued to another building ----
// The roof falls away from the neighbour it leans on (the edge whose outside is occupied), at about 17°.
export function leanToV32(p,poly,id,occupied){if(!occupied||poly.length!==1)return null;const ring=poly[0];let best=null;
 for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<1.6)continue;let nx=-(b[1]-a[1])/L,nz=(b[0]-a[0])/L;const mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;if(insidePoly([mx+nx*.3,mz+nz*.3],poly)){nx=-nx;nz=-nz;}
  let hit=0;for(const f of [.25,.5,.75]){const x=a[0]+(b[0]-a[0])*f+nx*.6,z=a[1]+(b[1]-a[1])*f+nz*.6;if(occupied(x,z,id))hit++;}if(hit>=2&&(!best||L>best.L))best={L,n:[nx,nz]};}
 if(!best)return null;const across=best.n,along=[-across[1],across[0]],a=range(poly,across),b=range(poly,along),span=a.max-a.min;if(span<1.2)return null;
 return {arch:{...p.arch,across,along,a,b,shape:'shed',type:'shed'},roofHeight:Math.max(.45,Math.min(1.7,span*.3))};}

// Compact undocumented house (ratio < 1,3, nearly rectangular): four slopes, the usual roof of a square pavilion.
export function compactHipV32(arch){const s=arch?.shape;return !!s&&s.ratio<1.3&&s.rectangularity>.86&&s.areaM2<170;}

// ---- Roof colours by documented family (BD ORTHO 2025): natural tones, no plastic grey ----
// V3.0–V3.1 brought both grey families to the same pale blue-grey (HSL lightness 0,46–0,58 set in linear space, about
// #a8b3bf on screen): the documented difference between dark grey (anthracite tiles, slate) and light grey (fibre cement,
// aged concrete) was lost and the villages read pale. These are sRGB tones, mid-dark for dark grey, never black.
const ROOF32={red_orange:['#c8805f','#c07a5c','#cc8a66','#bd7a60','#d09070'],brown:['#ad876f','#a48069','#b38e75','#9e7c68'],
 dark_gray:['#7f8489','#7a7f85','#858a8e','#7d8185'],light_gray:['#b5b6b1','#bbbbb5','#afb2b1'],blue_gray:['#7d8fa0','#8597a7','#788896'],
 white:['#dedcd5','#d8d7d0'],mixed:['#a48b7b','#9c8779','#aa9282'],unknown:['#a6978a','#9e9184']};
// Older types (storey house, several volumes, farm, heritage) a touch darker and warmer; single-storey pavilions cleaner.
const AGE={RES_R1_GABLE:-.022,RES_R1_HIP:-.018,RES_COMPLEX:-.026,RES_R2_PLUS:-.012,HERITAGE:-.03,FARM:-.03,RES_PLAIN_PIED_GABLE:.012,RES_PLAIN_PIED_HIP:.014};
export function roofColorV32(arch,cls,id){const fam=ROOF32[arch?.roof?.colorFamily]||ROOF32.unknown,c=new THREE.Color(fam[Math.floor(hashOf(id,'r')*fam.length)%fam.length]);
 const age=AGE[cls]||0;c.offsetHSL(age<0?.004:0,age<0?-.02:0,age+(hashOf(id,'l')-.5)*.035);return c;}

// ---- Facades: a mature palette chosen by documented wall material, else by building type ----
export const FACADE32={creme:['#ede4d0','#e9dfca','#efe7d6'],blanc:['#ecebe3','#e8e6dd','#efede6'],pierre:['#e1d6c0','#dbcfb8','#e5dbc7'],
 beige:['#e6d7be','#e1d1b7','#e9dbc4'],gris:['#dcd7cd','#d6d2c8','#e0dbd1'],brique:['#c99e86','#c2977f','#cda58e'],sombre:['#cdbfa8','#c7b9a3']};
const BY_CLASS={RES_PLAIN_PIED_GABLE:[['blanc',3],['creme',3],['gris',2],['beige',1.5]],RES_PLAIN_PIED_HIP:[['blanc',3],['creme',2.5],['gris',2.5],['beige',1]],
 RES_R1_GABLE:[['creme',3],['pierre',2.5],['beige',2],['blanc',1.5],['sombre',.25]],RES_R1_HIP:[['creme',3],['blanc',2],['beige',2],['pierre',1.5]],
 RES_COMPLEX:[['creme',3],['pierre',3],['beige',2],['blanc',1],['sombre',.3]],RES_R2_PLUS:[['blanc',3],['gris',2],['creme',2]],RES_FLAT:[['blanc',3],['gris',3],['creme',1]],
 HERITAGE:[['pierre',4],['beige',1]],PUBLIC:[['pierre',2],['creme',2],['beige',1]]};
const weighted=(list,t)=>{const tot=list.reduce((a,[,w])=>a+w,0);let x=t*tot;for(const [k,w] of list){x-=w;if(x<=0)return k;}return list[0][0];};
export function facadeV32(cls,extra,id){const codes=[...new Set(String(extra?.wallMaterialCode||'').replace(/[09]/g,'').split('').filter(Boolean))];let fam=null;
 if(codes.length===1)fam={'1':'pierre','2':'pierre','3':weighted([['creme',2],['blanc',2],['gris',1]],hashOf(id,'f')),'4':'brique','5':weighted([['creme',2],['blanc',1],['gris',2]],hashOf(id,'f'))}[codes[0]]||null;
 else if(codes.length>1)fam=codes.includes('4')?'beige':codes.includes('1')||codes.includes('2')?'pierre':null;
 fam??=weighted(BY_CLASS[cls]||[['creme',2],['blanc',2],['beige',1]],hashOf(id,'f'));
 const list=FACADE32[fam];return {family:fam,color:list[Math.floor(hashOf(id,'c')*list.length)%list.length]};}
// Gable variant read by the wall shader: 0 = rendered gable a shade lighter, 1 = stone or brick gable a shade warmer and darker.
export const gableVariantV32=fam=>fam==='pierre'||fam==='brique'||fam==='sombre'?1:0;

// ---- Building families (for overhang, ridge and the QA count), all from the classification ----
// pavillon compact / allongé (single storey, footprint ratio), maison à étage, maison ancienne (heritage, or a storey house of
// several volumes in stone, brick or a dark render), maison mitoyenne (glued to a neighbour that is not its garage or
// annex), maison rurale (several volumes), grand résidentiel (two storeys and more, large flat-roofed housing), ferme,
// dépendance (annex, garage, shed).
export function variantV32(cls,arch,fam){const s=arch?.shape||{};
 if(cls==='FARM')return 'ferme';if(['ANNEX','GARAGE','SHED'].includes(cls))return 'dependance';
 if(cls==='RES_R2_PLUS'||cls==='RES_FLAT'&&s.areaM2>150)return 'grand-residentiel';
 if(cls==='HERITAGE'||['pierre','brique','sombre'].includes(fam)&&/R1|COMPLEX/.test(cls))return 'maison-ancienne';
 if(!/^RES_/.test(cls))return null;
 if(s.touchingFootprints>0&&s.attachedGarage==='no'&&s.annex!=='yes'&&/R1|COMPLEX|PLAIN/.test(cls))return 'mitoyen';
 if(cls==='RES_COMPLEX')return 'maison-rurale';
 if(/PLAIN_PIED/.test(cls))return s.ratio>=1.45?'pavillon-allonge':'pavillon-compact';
 if(/R1/.test(cls))return 'maison-etage';return 'habitation';}
// Overhang (m) and ridge cap tone by family: old and terraced houses have a short eave and a mortared ridge (darker),
// pavilions a wider eave and a light ridge tile.
export const EAVE_V32={'maison-ancienne':.3,mitoyen:.28,'maison-rurale':.38,'pavillon-compact':.5,'pavillon-allonge':.5,'maison-etage':.45,'grand-residentiel':.4};
export const RIDGE_V32=v=>['maison-ancienne','mitoyen','maison-rurale','ferme'].includes(v)?[-.03,-.05]:[-.05,.08];

// ---- Chimneys: only on the houses that would have one, on the ridge ----
// Storey houses, houses of several volumes, tall houses and heritage buildings with a pitched roof over 70 m², and the larger
// single-storey houses (over 110 m²). Position on the main ridge at a third of its length, toward the end given by the id
// hash (no presence lottery: the rule decides, the hash only picks the end).
export function chimneyV32(cls,p){if(!['gable','hip','complex'].includes(p.arch.type)&&p.arch.shape!=='gabled'&&p.arch.shape!=='hip')return false;
 if(p.arch.shape==='flat'||p.arch.shape==='shed')return false;
 return ['RES_R1_GABLE','RES_R1_HIP','RES_COMPLEX','RES_R2_PLUS','HERITAGE'].includes(cls)&&p.size>70||['RES_PLAIN_PIED_GABLE','RES_PLAIN_PIED_HIP'].includes(cls)&&p.size>110;}
export const chimneyEndV32=id=>hashOf(id,'ch')<.5?.3:.7;
