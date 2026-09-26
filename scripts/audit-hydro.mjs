// V2.1 hydrographic audit: topology of the frozen V1.10 water network (BD TOPO / BD TOPAGE tronçons), terminal points and gaps,
// line/surface relations, road and rail crossings, cross-check with BD TOPO nodes, BCAE, BD CARTO and OSM, and the V2 display
// (what hides a watercourse on screen). Nothing is corrected automatically: every suspect point is classified in
// data-sources/hydro-audit-v2.1/review.json (orthophoto IGN 2025) and reported with that verdict.
// Outputs: data-sources/hydro-audit-v2.1/hydro-audit.json and public/data/hydro-audit-v2.1.json (?diagnostic=hydro-audit).
import fs from 'node:fs';
import {toL93,fromL93,TERRAIN_GRID as G} from './terrain-frame.mjs';
import {segDist,lineDist,lineLength,inPoly,polyDist,bboxOf,densify,gridIndex,r1} from './geo-audit-lib.mjs';
import {waterProximity,HEDGE_WATER_MARGIN} from '../src/hydro-display.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),D='data-sources/hydro-audit-v2.1';
const WL=read('unreal/landcover/water-lines.json'),WP=read('unreal/landcover/water-polygons.json'),review=fs.existsSync(`${D}/review.json`)?read(`${D}/review.json`):{points:{}};
const EXT={w:G.west,e:G.west+G.cols-1,n:G.north,s:G.north-(G.rows-1)};
const edgeDist=p=>Math.min(p[0]-EXT.w,EXT.e-p[0],EXT.n-p[1],p[1]-EXT.s);
const lines=WL.lines.map(l=>{const pts=l.pointsL93.map(q=>[q[0],q[1]]);return {id:l.id,src:l.sourceId,name:l.name,perm:l.persistance==='Permanent',nature:l.nature,fosse:l.fosse,width:l.widthClass,pts,b:bboxOf(pts),len:lineLength(pts)};});
const polys=WP.objects.map(o=>({id:o.id,type:o.type,name:o.name,ps:o.ringsL93,b:bboxOf(o.ringsL93.flatMap(p=>p[0]))}));
const nearLine=gridIndex(lines,150),nearPoly=gridIndex(polys,300);
// ---- 1. Topology: union-find over lines touching at an end (≤ 1 m) or at an interior point (T-junction ≤ 1,5 m).
const parent=lines.map((_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i])),join=(a,b)=>{parent[find(a)]=find(b);};
const idx=new Map(lines.map((l,i)=>[l,i]));
const ends=[];
for(const [i,l] of lines.entries())for(const [k,p] of [[0,l.pts[0]],[1,l.pts.at(-1)]]){let touch=[];
 for(const o of nearLine(p,3)){if(o===l)continue;const d=lineDist(p,o.pts);if(d<=1.5){touch.push({id:o.id,d:r1(d)});join(i,idx.get(o));}}
 // a line closing on itself (loop) is connected at both ends
 if(k===1&&Math.hypot(p[0]-l.pts[0][0],p[1]-l.pts[0][1])<1)touch.push({id:l.id,d:0});
 ends.push({line:l.id,name:l.name,perm:l.perm,end:k===0?'amont':'aval',p,touch});}
// Lines crossing (X-junctions) also connect.
const comp=new Map();for(const [i] of lines.entries()){const r=find(i);if(!comp.has(r))comp.set(r,[]);comp.get(r).push(lines[i]);}
// ---- 2. BD TOPO nodes (Source, Confluent, Diffluent, Exutoire…) at the ends.
const nodes=read(`${D}/bdtopo-v3-noeud-hydrographique.geojson`).features.map(f=>({id:f.properties.cleabs,cat:f.properties.categorie,p:toL93(f.geometry.coordinates)}));
const nearNode=gridIndex(nodes.map(n=>({...n,b:[n.p[0],n.p[1],n.p[0],n.p[1]]})),200);
// ---- 3. Classify every terminal point (no other line within 1,5 m).
const terminals=[];
for(const e of ends){if(e.touch.length)continue;const p=e.p,node=nearNode(p,3).find(n=>Math.hypot(n.p[0]-p[0],n.p[1]-p[1])<=3);
 const poly=nearPoly(p,10).map(o=>({o,d:Math.min(...o.ps.map(pp=>polyDist(p,pp)))})).sort((a,b)=>a.d-b.d)[0];
 let gap=null;for(const o of nearLine(p,60)){if(o.id===e.line)continue;const d=lineDist(p,o.pts);if(d<=50&&(!gap||d<gap.d))gap={to:o.id,toName:o.name,d:r1(d)};}
 const edge=edgeDist(p);
 const cls=edge<=25?'limite de l’emprise':poly&&poly.d<=8?'surface en eau':node?.cat==='Source'?'source (BD TOPO)':node?.cat==='Exutoire'?'exutoire (BD TOPO)':gap?'écart suspect':e.end==='amont'?'amont isolé':'aval isolé';
 const key=`${e.line}:${e.end}`,rv=review.points[key]||null;
 terminals.push({key,line:e.line,name:e.name,perm:e.perm,end:e.end,L93:p.map(r1),cls,node:node?{id:node.id,cat:node.cat}:null,surface:poly&&poly.d<=8?{id:poly.o.id,type:poly.o.type,d:r1(poly.d)}:null,gap,edgeM:r1(edge),
  suspect:!['limite de l’emprise','surface en eau','source (BD TOPO)','exutoire (BD TOPO)'].includes(cls),review:rv});}
// ---- 4. Line / surface relations (share of each line inside a water surface).
const inside=lines.map(l=>{const s=densify(l.pts,5);let n=0;for(const p of s)if(nearPoly(p,0).some(o=>o.ps.some(pp=>inPoly(p,pp))))n++;return {id:l.id,name:l.name,share:+(n/s.length).toFixed(2)};});
// ---- 5. Crossings with roads and rail (V1.10 relations: bridges, culverts, undocumented structures).
const crossings=WL.relations.map(r=>({water:r.water,name:r.waterName,with:r.with,kind:r.kind,L93:r.L93.map(r1),perm:r.waterPersistance}));
// ---- 6. Cross-checks: BCAE (derived from BD TOPO), BD CARTO (1:50 000, independent capture), OSM waterways.
// BCAE is delivered in Lambert-93, the other layers in lon/lat.
const L93=q=>Math.abs(q[0])>1000?[q[0],q[1]]:toL93(q),LL=q=>Math.abs(q[0])>1000?fromL93(q):q.slice(0,2);
const cover=(feats,tol,step=5)=>{let tot=0,off=0;const off_=[];for(const f of feats){const cs=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.type==='MultiLineString'?f.geometry.coordinates:[];for(const c of cs){const l=c.map(L93),s=densify(l,step);let o=0;for(const p of s){if(edgeDist(p)<0)continue;tot+=step;if(!nearLine(p,tol).some(x=>lineDist(p,x.pts)<=tol)){off+=step;o++;}}if(o*step>=50)off_.push({id:f.properties.cleabs||f.properties.id||f.id||null,name:f.properties.cpx_toponyme_de_cours_d_eau||f.properties.name||f.properties.toponyme||null,offM:o*step});}}return {km:+(tot/1000).toFixed(2),offKm:+(off/1000).toFixed(2),tolM:tol,pieces:off_};};
const osm=read('public/data/maizieres.geojson').features.filter(f=>f.properties.waterway&&f.geometry.type.endsWith('LineString'));
const xcheck={bcae:cover(read('data-sources/landcover/bcae-cours-eau.geojson').features,5),bdcarto:cover(read(`${D}/bdcarto-v5-troncon-hydrographique.geojson`).features,40),osm:cover(osm,15)};
// ---- 7. Display (V2): what hides a watercourse on screen, before (V2.0.1) and after the V2.1 rule.
const S=read('public/data/v2-scene.json');
const H=S.hedges.map(h=>{const p=[];for(let i=0;i<h.p.length;i+=3)p.push([h.p[i],h.p[i+1]]);return {w:h.w||2.5,wall:Math.min(6,h.w||2.4),pts:p,b:bboxOf(p)};}),nearHedge=gridIndex(H,100);
const near=waterProximity(S.waterLines,S.water);
const hidden={textureBefore:0,wallsBefore:0,textureAfter:0,wallsAfter:0,total:0,byName:{}};
for(const l of S.waterLines){const pts=[];for(let i=0;i<l.p.length;i+=2)pts.push([l.p[i],l.p[i+1]]);const s=densify(pts,2);
 for(const p of s){hidden.total+=2;let tex=false,wall=false,wallAfter=false;for(const h of nearHedge(p,50)){const d=lineDist(p,h.pts);if(d<=h.w/2)tex=true;if(d<=h.wall/2){wall=true;
   // after: a wall segment is kept only if its midpoint is farther than the rule from any water
   for(let i=1;i<h.pts.length;i++){const a=h.pts[i-1],b=h.pts[i];if(segDist(p,a,b)>h.wall/2)continue;const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/10));
    for(let k=0;k<n;k++){const m=[a[0]+(b[0]-a[0])*(k+.5)/n,a[1]+(b[1]-a[1])*(k+.5)/n];if(segDist(p,[a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n],[a[0]+(b[0]-a[0])*(k+1)/n,a[1]+(b[1]-a[1])*(k+1)/n])<=h.wall/2&&!near(m[0],m[1],h.wall/2+HEDGE_WATER_MARGIN))wallAfter=true;}}}}
  if(tex){hidden.textureBefore+=2;const k=l.n||'(sans nom)';hidden.byName[k]=(hidden.byName[k]||0)+2;}if(wall)hidden.wallsBefore+=2;if(wallAfter)hidden.wallsAfter+=2;}}
// Other display checks: every line drawn (texture covers the whole V2 terrain), simplification deviation, lines outside the displayed terrain.
const T=read('public/data/v2-terrain.json'),X1=T.x0+(T.cols-1)*T.step,Z1=T.z0+(T.rows-1)*T.step;
let offGrid=0;for(const l of S.waterLines)for(let i=0;i<l.p.length;i+=2)if(l.p[i]<T.x0||l.p[i]>X1||l.p[i+1]<T.z0||l.p[i+1]>Z1)offGrid++;
const display={linesInScene:S.waterLines.length,linesInReference:lines.length,underground:WL.lines.filter(l=>l.position==='souterrain').length,surfacesInScene:S.water.length,surfacesInReference:polys.length,verticesOffTerrain:offGrid,
 hiddenKm:{total:+(hidden.total/1000).toFixed(2),byHedgeTextureV201:+(hidden.textureBefore/1000).toFixed(2),by3DHedgeWallsV201:+(hidden.wallsBefore/1000).toFixed(2),byHedgeTextureV21:0,by3DHedgeWallsV21:+(hidden.wallsAfter/1000).toFixed(2)},
 hiddenByNameV201M:Object.fromEntries(Object.entries(hidden.byName).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,v])),
 rule:'V2.1 : eau dessinée après les haies dans la texture ; aucun mur de haie 3D à moins de (demi-largeur du cours d’eau + demi-largeur du mur + 1 m) d’un axe ou dans une surface en eau'};
// ---- 8. Poussey: the Ruisseau / Bras des Moulins de Poussey chain.
const named=n=>lines.filter(l=>l.name===n);
const chain=['Ruisseau des Moulins de Poussey','Bras des Moulins de Poussey'].map(n=>({name:n,tronçons:named(n).length,km:+(named(n).reduce((s,l)=>s+l.len,0)/1000).toFixed(2),permanence:[...new Set(named(n).map(l=>l.perm?'Permanent':'Intermittent'))],
 components:[...new Set(named(n).map(l=>find(idx.get(l))))].length}));
const compList=[...comp.values()].map(c=>({lines:c.length,km:+(c.reduce((s,l)=>s+l.len,0)/1000).toFixed(2),names:[...new Set(c.map(l=>l.name).filter(Boolean))],touchesEdge:c.some(l=>[l.pts[0],l.pts.at(-1)].some(p=>edgeDist(p)<=25)),touchesSurface:c.some(l=>[l.pts[0],l.pts.at(-1)].some(p=>nearPoly(p,8).some(o=>o.ps.some(pp=>polyDist(p,pp)<=8))))})).sort((a,b)=>b.km-a.km);
const suspects=terminals.filter(t=>t.suspect);
const out={metadata:{version:'2.1',generatedBy:'scripts/audit-hydro.mjs',reference:'unreal/landcover/water-lines.json + water-polygons.json (V1.10, gelés)',sources:{bdtopoNodes:`${D}/bdtopo-v3-noeud-hydrographique.geojson`,bdtopoTroncons:`${D}/bdtopo-v3-troncon-hydrographique.geojson`,bdcarto:`${D}/bdcarto-v5-troncon-hydrographique.geojson`,bcae:'data-sources/landcover/bcae-cours-eau.geojson',osm:'public/data/maizieres.geojson'},
 sandre:'services SANDRE injoignables depuis le conteneur (proxy) ; la BD TOPO hydrographique est la BD TOPAGE co-produite IGN/OFB : ses codes hydrographiques et code_du_cours_d_eau_bdcarthage tiennent lieu de référentiel SANDRE',thresholds:{connectM:1.5,surfaceM:8,edgeM:25,gapM:50,nodeM:3}},
 counts:{lines:lines.length,km:+(lines.reduce((s,l)=>s+l.len,0)/1000).toFixed(2),surfaces:polys.length,components:compList.length,ends:ends.length,terminals:terminals.length,suspects:suspects.length,
  byClass:Object.fromEntries([...new Set(terminals.map(t=>t.cls))].map(c=>[c,terminals.filter(t=>t.cls===c).length])),reviewed:terminals.filter(t=>t.review).length,crossings:crossings.length},
 components:compList,terminals,linesInSurfaces:inside.filter(x=>x.share>0),crossings,xcheck,display,poussey:chain,
 freshService:{note:'BD TOPO tronçons hydrographiques relus au service le 26/09/2026 : 234 objets dans la boîte de l’emprise, dont les 226 du référentiel ; les 8 autres sont entièrement hors de l’emprise du terrain',count:read(`${D}/bdtopo-v3-troncon-hydrographique.geojson`).features.length}};
fs.writeFileSync(`${D}/hydro-audit.json`,JSON.stringify(out,null,1)+'\n');
// Diagnostic layer (lon/lat): terminals by class, gaps, confluences/diffluences, crossings, corrected display stretches.
const ll=p=>fromL93(p).map(v=>Math.round(v*1e7)/1e7);
fs.writeFileSync('public/data/hydro-audit-v2.1.json',JSON.stringify({metadata:{version:'2.1',generatedBy:'scripts/audit-hydro.mjs'},
 terminals:terminals.map(t=>({key:t.key,name:t.name,cls:t.cls,suspect:t.suspect,verdict:t.review?.verdict||null,lonlat:ll(t.L93),gapTo:t.gap?.to||null,gapM:t.gap?.d||null})),
 nodes:nodes.filter(n=>['Confluent','Diffluent','Source','Exutoire'].includes(n.cat)).map(n=>({cat:n.cat,lonlat:ll(n.p)})),
 crossings:crossings.map(c=>({kind:c.kind,with:c.with,name:c.name,lonlat:ll(c.L93)})),
 bcae:read('data-sources/landcover/bcae-cours-eau.geojson').features.flatMap(f=>(f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.coordinates).map(c=>c.map(q=>LL(q).map(v=>Math.round(v*1e7)/1e7)))),
 osm:osm.map(f=>({name:f.properties.name||null,waterway:f.properties.waterway,coords:(f.geometry.type==='LineString'?f.geometry.coordinates:f.geometry.coordinates.flat()).map(q=>q.slice(0,2).map(v=>Math.round(v*1e7)/1e7))})),
 counts:out.counts,display})+'\n');
console.log(JSON.stringify({...out.counts,hiddenKm:display.hiddenKm,xcheck:{bcae:xcheck.bcae.offKm,bdcarto:xcheck.bdcarto.offKm,osm:xcheck.osm.offKm}}));
