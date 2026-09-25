// V1.10 land cover reference (current state): agriculture, woodland, hedges, documented trees, hydrography, artificial
// surfaces, over the frozen V1.7 terrain extent. Built from local snapshots only (npm run data:landcover).
// Frozen references (buildings V1.6.2, terrain V1.7, roads V1.8, rail V1.9, UNREAL_ORIGIN) are read only.
// Source geometry is never altered: reference = source geometry; Unreal files add clipped (extent) and simplified derivatives.
// Outputs: public/data/landcover.geojson, public/data/landcover-diagnostic.json, unreal/landcover/*.json,
// data-sources/landcover/landcover-report.json.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import polygonClipping from 'polygon-clipping';
import {fromArrayBuffer} from 'geotiff';
import {TERRAIN_GRID as G,UNREAL_ORIGIN as O,toL93,fromL93,toUnreal} from './terrain-frame.mjs';
import {polygons,insidePoly} from '../src/geo.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),r1=v=>Math.round(v*10)/10,r2=v=>Math.round(v*100)/100,r3=v=>Math.round(v*1000)/1000;
const D='data-sources/landcover',J=n=>read(`${D}/${n}.geojson`);
const REVIEW=`${D}/landcover-review-v1.10.json`,REV=fs.existsSync(REVIEW)?read(REVIEW):{};

// ---------- Terrain (frozen V1.7) ----------
const tb=fs.readFileSync('unreal/terrain/maizieres-mnt-lidarhd-1m-lamb93-ign69.tif'),[grid]=await (await (await fromArrayBuffer(tb.buffer.slice(tb.byteOffset,tb.byteOffset+tb.length))).getImage()).readRasters();
const terrainZ=(E,N)=>{const i=E-G.west,j=G.north-N,i0=Math.floor(i),j0=Math.floor(j);if(i0<0||j0<0||i0>=G.cols-1||j0>=G.rows-1)return NaN;const fx=i-i0,fy=j-j0,k=j0*G.cols+i0;return (grid[k]*(1-fx)+grid[k+1]*fx)*(1-fy)+(grid[k+G.cols]*(1-fx)+grid[k+G.cols+1]*fx)*fy;};

// ---------- Geometry helpers (Lambert-93) ----------
const EXT=[[[G.west,G.south],[G.east,G.south],[G.east,G.north],[G.west,G.north],[G.west,G.south]]];
const ringArea=r=>{let a=0;for(let i=0,j=r.length-1;i<r.length;j=i++)a+=(r[j][0]*r[i][1]-r[i][0]*r[j][1]);return Math.abs(a/2);};
const mpArea=mp=>mp.reduce((s,p)=>s+ringArea(p[0])-p.slice(1).reduce((h,r)=>h+ringArea(r),0),0);
const close=r=>{const a=r[0],b=r.at(-1);return a[0]===b[0]&&a[1]===b[1]?r:[...r,a];};
const polysL93=f=>polygons(f,toL93).map(p=>p.map(close));
const safe=(op,...a)=>{try{return op(...a);}catch{return null;}};
const inter=(a,b)=>safe(polygonClipping.intersection,a,b)||[];
const bboxOf=mp=>{let b=[1e12,1e12,-1e12,-1e12];for(const p of mp)for(const [x,y] of p[0])b=[Math.min(b[0],x),Math.min(b[1],y),Math.max(b[2],x),Math.max(b[3],y)];return b;};
const bbHit=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const len=l=>{let s=0;for(let i=1;i<l.length;i++)s+=Math.hypot(l[i][0]-l[i-1][0],l[i][1]-l[i-1][1]);return s;};
function densify(l,step){const out=[l[0]];for(let i=1;i<l.length;i++){const a=l[i-1],b=l[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(L/step));for(let k=1;k<=n;k++)out.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}return out;}
function segDist(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy;let t=L?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L:0;t=Math.max(0,Math.min(1,t));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
const lineDist=(p,l)=>{let m=Infinity;for(let i=1;i<l.length;i++)m=Math.min(m,segDist(p,l[i-1],l[i]));return m;};
function segCross(a,b,c,d){const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]],den=r[0]*s[1]-r[1]*s[0];if(Math.abs(den)<1e-12)return null;const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den,u=((c[0]-a[0])*r[1]-(c[1]-a[1])*r[0])/den;return t>=0&&t<=1&&u>=0&&u<=1?[a[0]+t*r[0],a[1]+t*r[1]]:null;}
function crossings(l1,l2){const out=[];for(let i=1;i<l1.length;i++)for(let j=1;j<l2.length;j++){const x=segCross(l1[i-1],l1[i],l2[j-1],l2[j]);if(x&&!out.some(o=>Math.hypot(o[0]-x[0],o[1]-x[1])<1))out.push(x);}return out;}
const inExt=([E,N])=>E>=G.west&&E<=G.east&&N>=G.south&&N<=G.north;
function clipLine(l){const d=densify(l,1),runs=[];let cur=null;for(const p of d){if(inExt(p)){if(!cur){cur=[];runs.push(cur);}cur.push(p);}else cur=null;}return runs.filter(r=>r.length>=2).map(r=>simplifyLine(r,.01));}
function simplifyLine(pts,tol){if(pts.length<3)return pts;let idx=0,dm=0;for(let i=1;i<pts.length-1;i++){const d=segDist(pts[i],pts[0],pts.at(-1));if(d>dm){dm=d;idx=i;}}return dm>tol?simplifyLine(pts.slice(0,idx+1),tol).slice(0,-1).concat(simplifyLine(pts.slice(idx),tol)):[pts[0],pts.at(-1)];}
const simplifyRing=(r,tol)=>{const s=simplifyLine(r.slice(0,-1).concat([r[0]]),tol);return s.length>=4?s:r;};
const simplifyMP=(mp,tol)=>mp.map(p=>p.map(r=>simplifyRing(r,tol))).filter(p=>p[0].length>=4);

// ---------- Commune ----------
const commune=read('public/data/commune.geojson'),communeMP=polysL93(commune.features?commune.features[0]:commune),communeArea=mpArea(communeMP);
const inCommune=p=>communeMP.some(poly=>insidePoly(p,poly));

// ---------- Generic polygon object ----------
const objects=[];
function addPoly(layer,id,f,props){const src=polysL93(f);if(!src.length)return null;const bb=bboxOf(src);if(!bbHit(bb,[G.west,G.south,G.east,G.north]))return null;
 const clipped=bbHit(bb,[G.west,G.south,G.east,G.north])&&(bb[0]<G.west||bb[1]<G.south||bb[2]>G.east||bb[3]>G.north)?inter(src,EXT):src;if(!clipped.length)return null;
 const inC=inter(clipped,communeMP),o={layer,id,geometry:f.geometry,mp:clipped,clipped:clipped!==src,bb:bboxOf(clipped),areaM2:mpArea(clipped),areaSourceM2:mpArea(src),areaInCommuneM2:mpArea(inC),...props};objects.push(o);return o;}

// ---------- 1. Agriculture: RPG 2024 (+ 2023 / 2022 crop history) ----------
const codes=new Map(J('rpg-2024-codes-cultures').features.map(f=>[f.properties.code,f.properties.libelle]));
const GROUPS={1:'Blé tendre',2:'Maïs grain et ensilage',3:'Orge',4:'Autres céréales',5:'Colza',6:'Tournesol',7:'Autres oléagineux',8:'Protéagineux',9:'Plantes à fibres',11:'Gel (surfaces gelées sans production)',14:'Riz',15:'Légumineuses à grains',16:'Fourrage',17:'Estives et landes',18:'Prairies permanentes',19:'Prairies temporaires',20:'Vergers',21:'Vignes',22:'Fruits à coque',23:'Oliviers',24:'Autres cultures industrielles',25:'Légumes ou fleurs',26:'Canne à sucre',28:'Divers'};
function landuseType(p){const c=p.code_cultu,g=+p.code_group,cat=p.cat_cult_p;if(cat==='PP')return 'prairie_permanente';if(cat==='CP')return 'culture_permanente';
 if(g===11||/^J/.test(c))return 'jachere';if(g===19)return 'prairie_temporaire';if(cat==='TA')return 'terre_arable';return 'autre_surface_agricole';}
const hist={};for(const y of [2023,2022]){hist[y]=J(`rpg-${y}-parcelles`).features.map(f=>{const mp=polysL93(f);return {p:f.properties,mp,bb:bboxOf(mp),a:mpArea(mp)};});}
for(const f of J('rpg-2024-parcelles').features){const p=f.properties;const o=addPoly('agriculture','rpg2024:'+p.id_parcel,f,{landuse_type:landuseType(p),crop_code:p.code_cultu,crop_type:codes.get(p.code_cultu)||null,crop_group:GROUPS[+p.code_group]||p.code_group,crop_year:2024,crop_source:'RPG 2024 (ASP / IGN), culture principale déclarée',
  rpgCategory:p.cat_cult_p,declaredAreaHa:p.surf_parc,secondaryCrops:[p.culture_d1,p.culture_d2].filter(Boolean),provenance:'RPG 2024',confidence:'A'});
 if(!o)continue;o.cropHistory=[];for(const y of [2023,2022]){let best=null;for(const h of hist[y]){if(!bbHit(h.bb,o.bb))continue;const x=mpArea(inter(o.mp,h.mp));const iou=x/(o.areaM2+h.a-x);if(iou>.5&&(!best||iou>best.iou))best={iou,h};}
  o.cropHistory.push(best?{year:y,crop_code:best.h.p.code_cultu,crop_type:codes.get(best.h.p.code_cultu)||null,iou:r2(best.iou)}:{year:y,crop_code:null,note:'aucune parcelle correspondante (IoU > 0,5)'});}}

// ---------- 2. Woodland: BD TOPO zone de végétation (+ BD Forêt V2 attributes) ----------
const WOOD={'Bois':'bois','Forêt fermée de feuillus':'foret_fermee_feuillus','Peupleraie':'peupleraie','Forêt ouverte':'foret_ouverte','Lande ligneuse':'lande_ligneuse'};
const bdf=J('bdforet-v2-formation-vegetale').features.map(f=>({p:f.properties,mp:polysL93(f)})).map(x=>({...x,bb:bboxOf(x.mp)}));
const zv=J('bdtopo-zone-de-vegetation').features;
for(const f of zv.filter(f=>WOOD[f.properties.nature])){const p=f.properties;const o=addPoly('woodland',p.cleabs,f,{type:WOOD[p.nature],nature:p.nature,provenance:'BD TOPO zone de végétation',confidence:'A',precisionM:p.precision_planimetrique,sourceModified:String(p.date_modification||'').slice(0,10)});
 if(!o)continue;const tally=new Map();for(const b of bdf){if(!bbHit(b.bb,o.bb))continue;const x=mpArea(inter(o.mp,b.mp));if(x>0)tally.set(b.p.tfv+'|'+b.p.essence,(tally.get(b.p.tfv+'|'+b.p.essence)||0)+x);}
 const top=[...tally].sort((a,b)=>b[1]-a[1])[0];o.bdforet=top&&top[1]/o.areaM2>=.3?{tfv:top[0].split('|')[0],essence:top[0].split('|')[1],share:r2(top[1]/o.areaM2),source:'BD Forêt V2 (IGN)'}:null;}

// ---------- 3. Hedges: BD TOPO haie (linear, DSB) + BD TOPO "Haie" polygons ----------
const hedgePolys=zv.filter(f=>f.properties.nature==='Haie').map(f=>({f,p:f.properties,mp:polysL93(f)})).map(x=>({...x,bb:bboxOf(x.mp),a:mpArea(x.mp)}));
const hedges=[];
for(const f of J('bdtopo-haie').features){const l0=f.geometry.coordinates.map(c=>toL93(c));for(const [k,l] of clipLine(l0).entries()){const d=densify(l,2);const inside=new Map();
 for(const p of d)for(const h of hedgePolys){if(p[0]<h.bb[0]-1||p[0]>h.bb[2]+1||p[1]<h.bb[1]-1||p[1]>h.bb[3]+1)continue;if(h.mp.some(poly=>insidePoly(p,poly))){inside.set(h,(inside.get(h)||0)+1);break;}}
 const share=[...inside.values()].reduce((s,v)=>s+v,0)/d.length,polys=[...inside.keys()],L=len(l);
 const width=polys.length?r1(polys.reduce((s,h)=>s+h.a,0)/Math.max(L,polys.reduce((s,h)=>s+Math.sqrt(h.a),0))):null;
 hedges.push({id:f.properties.cleabs+(k?'#'+(k+1):''),source:f.properties.cleabs,l,lengthM:L,inCommuneShare:d.filter(inCommune).length/d.length,polygonShare:share,polygons:polys.map(h=>h.p.cleabs),
  widthM:polys.length?width:null,widthSource:polys.length?'dérivée : surface des polygones BD TOPO « Haie » / longueur (approximation)':null,heightM:f.properties.hauteur,provenance:'BD TOPO haie (DSB)',
  sourceModified:String(f.properties.date_modification||'').slice(0,10),confidence:share>=.5?'A (linéaire DSB + polygone BD TOPO « Haie »)':'B (linéaire DSB seul)',geometry:f.geometry,clipped:k>0||l0.length!==l.length});}}
// Hedge polygons without a DSB line: kept as polygons (no spline invented).
for(const h of hedgePolys){const cov=hedges.some(x=>x.polygons.includes(h.p.cleabs));if(cov)continue;addPoly('hedge_polygon',h.p.cleabs,h.f,{type:'haie (polygone BD TOPO sans linéaire DSB)',nature:'Haie',provenance:'BD TOPO zone de végétation',confidence:'B',sourceModified:String(h.p.date_modification||'').slice(0,10)});}

// ---------- 4. Documented trees (no official layer; OSM natural=tree only) ----------
const osm=read('public/data/maizieres.geojson');
const trees=osm.features.filter(f=>f.properties.natural==='tree'&&f.geometry.type==='Point').map(f=>{const p=toL93(f.geometry.coordinates);return {id:f.id,L93:p,tags:f.properties,provenance:'OSM natural=tree',confidence:'B',inCommune:inCommune(p)};}).filter(t=>inExt(t.L93));

// ---------- 5. Hydrography ----------
const coursDeau=new Map(J('bdtopo-cours-d-eau').features.map(f=>[f.properties.cleabs,f.properties.toponyme]));
const bcaeFC=J('bcae-cours-eau'),bcaeNative=/2154/.test(bcaeFC.metadata.crs);
const bcae=bcaeFC.features.flatMap(f=>(f.geometry.type==='MultiLineString'?f.geometry.coordinates:[f.geometry.coordinates]).map(l=>l.map(c=>bcaeNative?[c[0],c[1]]:toL93(c))));
const osmWater=osm.features.filter(f=>f.properties.waterway&&/LineString/.test(f.geometry.type)).flatMap(f=>(f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.coordinates).map(l=>({f,l:l.map(c=>toL93(c))})));
const troncons=read('data-sources/rail/bdtopo-troncon-hydrographique.geojson').features;
const waterLines=[];
for(const f of troncons){const p=f.properties,l0=f.geometry.coordinates.map(c=>toL93(c));for(const [k,l] of clipLine(l0).entries()){const d=densify(l,5),name=p.cpx_toponyme_de_cours_d_eau||null;
 const bc=d.filter(q=>bcae.some(b=>lineDist(q,b)<=5)).length/d.length,om=osmWater.map(o=>({o,s:d.filter(q=>lineDist(q,o.l)<=10).length/d.length})).sort((a,b)=>b.s-a.s)[0];
 // Approximate water level along the flow: terrain (bare-earth, IGN-interpolated on water) forced non-increasing downstream.
 const down=p.sens_de_l_ecoulement==='Sens inverse'?d.slice().reverse():d,zt=down.map(q=>terrainZ(...q));const zs=[];let m=Infinity;for(const z of zt){m=Math.min(m,Number.isFinite(z)?z:m);zs.push(m);}
 const zSurf=p.sens_de_l_ecoulement==='Sens inverse'?zs.slice().reverse():zs,zTer=p.sens_de_l_ecoulement==='Sens inverse'?zt.slice().reverse():zt,L=len(l);
 waterLines.push({id:p.cleabs+(k?'#'+(k+1):''),source:p.cleabs,l,d,lengthM:L,name,nameSource:name?'BD TOPO (cours d’eau)':null,nature:p.nature,fosse:p.fosse,persistance:p.persistance,position:p.position_par_rapport_au_sol==='-1'?'souterrain':p.position_par_rapport_au_sol==='1'?'au-dessus du sol':'sol',
  flow:p.sens_de_l_ecoulement,widthClass:p.classe_de_largeur||null,navigable:p.navigabilite,origin:p.origine,bcae:bc>=.5,osmWaterway:om&&om.s>=.5?{id:om.o.f.id,waterway:om.o.f.properties.waterway,name:om.o.f.properties.name||null}:null,
  inCommuneShare:d.filter(inCommune).length/d.length,precisionM:p.precision_planimetrique,zTerrain:zTer,zSurfaceApprox:zSurf,slopePermil:L>0?r2((Math.max(...zs.filter(Number.isFinite))-Math.min(...zs.filter(Number.isFinite)))/L*1000):null,
  provenance:'BD TOPO tronçon hydrographique',confidence:'A',geometry:f.geometry,clipped:k>0||clipLine(l0).length>1});}}
// Water surfaces: BD TOPO surface hydrographique (names through the linked cours d'eau), OSM water not covered by BD TOPO.
const planDeau=new Map(J('bdtopo-plan-d-eau').features.map(f=>[f.properties.cleabs,f.properties]));
for(const f of J('bdtopo-surface-hydrographique').features){const p=f.properties,links=String(p.liens_vers_cours_d_eau||'').split('/').filter(Boolean),name=links.map(c=>coursDeau.get(c)).find(Boolean)||null,pl=String(p.liens_vers_plan_d_eau||'').split('/').filter(Boolean).map(c=>planDeau.get(c)).find(Boolean);
 addPoly('water_polygon',p.cleabs,f,{type:p.nature,name,nameSource:name?'BD TOPO (cours d’eau lié)':pl?.toponyme?'BD TOPO (plan d’eau lié)':null,persistance:p.persistance,planDeau:pl?{nature:pl.nature,toponyme:pl.toponyme||null}:null,provenance:'BD TOPO surface hydrographique',confidence:'A',precisionM:p.precision_planimetrique});}
const bdWater=objects.filter(o=>o.layer==='water_polygon');
for(const f of osm.features.filter(f=>(f.properties.natural==='water'||f.properties.water)&&/Polygon/.test(f.geometry.type))){const mp=polysL93(f),a=mpArea(mp),bb=bboxOf(mp);let cov=0;for(const w of bdWater)if(bbHit(bb,w.bb))cov+=mpArea(inter(mp,w.mp));
 if(cov/a<.5)addPoly('water_polygon',f.id,f,{type:'eau (OSM '+(f.properties.water||f.properties.natural)+')',name:f.properties.name||null,nameSource:f.properties.name?'OSM':null,provenance:'OSM (complément)',confidence:'B',bdtopoCoverage:r2(cov/a)});}
for(const o of objects.filter(o=>o.layer==='water_polygon')){const zs=[];const [x0,y0,x1,y1]=o.bb;for(let x=x0;x<=x1;x+=2)for(let y=y0;y<=y1;y+=2)if(o.mp.some(poly=>insidePoly([x,y],poly))){const z=terrainZ(x,y);if(Number.isFinite(z))zs.push(z);}
 zs.sort((a,b)=>a-b);o.zSurfaceApprox=zs.length?r2(zs[Math.floor(zs.length*.1)]):null;o.zNote='10e centile du MNT dans la surface (niveau approximatif, pas de bathymétrie)';}

// ---------- 6. Artificial surfaces ----------
function artClass(p){const n=p.nature,d=p.nature_detaillee||'';if(/photovolta/i.test(d))return 'centrale_photovoltaique';if(/éolien/i.test(d))return 'parc_eolien_perimetre';if(/industriel|Zone industrielle/i.test(n))return 'zone_industrielle';if(/commercial/i.test(n))return 'zone_commerciale';
 if(/militaire/i.test(n))return 'enceinte_militaire';if(/Stade|sport|Sports/i.test(n))return 'equipement_sportif';if(/pompage|Station/i.test(n))return 'equipement_technique';if(/Aire d'accueil/i.test(n))return 'aire_accueil';return 'equipement_public';}
for(const f of J('bdtopo-zone-d-activite').features)addPoly('artificial',f.properties.cleabs,f,{class:artClass(f.properties),kind:'périmètre fonctionnel (BD TOPO)',nature:f.properties.nature,natureDetail:f.properties.nature_detaillee,name:f.properties.toponyme||null,provenance:'BD TOPO zone d’activité ou d’intérêt',confidence:'A'});
for(const f of J('bdtopo-terrain-de-sport').features)addPoly('artificial',f.properties.cleabs,f,{class:'terrain_de_sport',kind:'surface',nature:f.properties.nature,natureDetail:f.properties.nature_detaillee,provenance:'BD TOPO terrain de sport',confidence:'A'});
for(const f of J('bdtopo-cimetiere').features)addPoly('artificial',f.properties.cleabs,f,{class:'cimetiere',kind:'surface',nature:'Cimetière',name:f.properties.toponyme||null,provenance:'BD TOPO cimetière',confidence:'A'});
for(const f of J('bdtopo-reservoir').features)addPoly('artificial',f.properties.cleabs,f,{class:'reservoir',kind:'surface',nature:f.properties.nature,provenance:'BD TOPO réservoir',confidence:'A'});
for(const f of J('bdtopo-equipement-de-transport').features.filter(f=>/Parking|triage/.test(f.properties.nature)))addPoly('artificial',f.properties.cleabs,f,{class:f.properties.nature==='Parking'?'parking':'emprise_ferroviaire',kind:'surface',nature:f.properties.nature,provenance:'BD TOPO équipement de transport',confidence:'A'});
// OSM complements: parkings and functional land use polygons not already covered by BD TOPO (≥ 50 %).
const OSM_ART={parking:'parking',industrial:'zone_industrielle',commercial:'zone_commerciale',retail:'zone_commerciale',military:'enceinte_militaire',pitch:'terrain_de_sport',sports_centre:'equipement_sportif',cemetery:'cimetiere',plant:'centrale_electrique'};
const bdArt=objects.filter(o=>o.layer==='artificial');
for(const f of osm.features.filter(f=>/Polygon/.test(f.geometry.type))){const p=f.properties,k=p.amenity==='parking'?'parking':p.landuse&&OSM_ART[p.landuse]?p.landuse:p.leisure&&OSM_ART[p.leisure]?p.leisure:p.power==='plant'?'plant':null;if(!k)continue;
 const mp=polysL93(f),a=mpArea(mp),bb=bboxOf(mp);let cov=0;for(const w of bdArt)if(bbHit(bb,w.bb))cov+=mpArea(inter(mp,w.mp));if(cov/a>=.5)continue;
 addPoly('artificial',f.id,f,{class:OSM_ART[k]+(k==='plant'&&/photovolta/i.test(p.name||'')?'':''),kind:k==='parking'||k==='pitch'?'surface':'périmètre fonctionnel (OSM)',nature:'OSM '+(p.amenity||p.landuse||p.leisure||p.power),name:p.name||null,provenance:'OSM (complément)',confidence:'C',bdtopoCoverage:r2(cov/a)});}

// ---------- 7. Relations with the frozen roads (V1.8) and rail (V1.9) ----------
const roads=read('public/data/roads.geojson').features.filter(f=>!f.properties.excluded&&f.properties.state==='En service').map(f=>({f,p:f.properties,l:f.geometry.coordinates.map(c=>toL93(c))}));
const roadRep=read('data-sources/roads/roads-report.json'),hidden=roadRep.structures.hiddenStructures.flatMap(h=>h.sites.map(s=>({road:h.road,L93:s.L93})));
const tracks=read('public/data/rail.geojson').features.filter(f=>f.properties.layer==='track').map(f=>({f,p:f.properties,l:f.geometry.coordinates.map(c=>toL93(c))}));
const railRep=read('data-sources/rail/rail-report.json');
const relations=[];
for(const w of waterLines){const wb=[Math.min(...w.l.map(p=>p[0])),Math.min(...w.l.map(p=>p[1])),Math.max(...w.l.map(p=>p[0])),Math.max(...w.l.map(p=>p[1]))];
 for(const r of roads){const rb=[Math.min(...r.l.map(p=>p[0])),Math.min(...r.l.map(p=>p[1])),Math.max(...r.l.map(p=>p[0])),Math.max(...r.l.map(p=>p[1]))];if(!bbHit(wb,rb))continue;
  for(const x of crossings(w.l,r.l)){const hs=hidden.find(h=>h.road===r.p.id&&Math.hypot(h.L93[0]-x[0],h.L93[1]-x[1])<25);
   const kind=r.p.structure==='pont'?'pont routier (V1.8)':hs?'ouvrage non répertorié identifié en V1.8 (ponceau)':w.position==='souterrain'?'cours d’eau busé (BD TOPO souterrain)':(w.fosse||w.persistance==='Intermittent')?'buse / ponceau probable (non documenté)':'ouvrage non documenté sur un cours d’eau permanent';
   relations.push({with:'road',water:w.id,waterName:w.name,waterPersistance:w.persistance,road:r.p.id,roadName:r.p.name,roadCategory:r.p.category,L93:x.map(r2),kind,open:kind.startsWith('ouvrage non documenté'),review:REV.relations?.[x.map(r2).join(',')]||null});}}
 for(const t of tracks)for(const x of crossings(w.l,t.l)){const br=railRep.structures.bridges.find(b=>Math.hypot((b.startL93[0]+b.endL93[0])/2-x[0],(b.startL93[1]+b.endL93[1])/2-x[1])<25);
  relations.push({with:'rail',water:w.id,waterName:w.name,waterPersistance:w.persistance,track:t.p.id,trackKind:t.p.kind,L93:x.map(r2),kind:br?'pont ferroviaire (V1.9 '+br.bdtopo+')':'franchissement sans ouvrage documenté',open:!br});}}
// Road bridges of V1.8 that cross no water line (might cross a water polygon or a dry valley).
const roadBridges=roadRep.structures.bridges.map(b=>({road:b.road,name:b.name,crosses:b.crosses,waterLine:relations.some(x=>x.road===b.road)}));

// ---------- 8. QA raster (2 m): coverage, overlaps, gaps inside the commune ----------
const RS=2,RW=Math.ceil((G.east-G.west)/RS),RH=Math.ceil((G.north-G.south)/RS),mask=new Uint16Array(RW*RH);
const BIT={agriculture:1,woodland:2,hedge_polygon:4,water_polygon:8,artificial:16,building:32,road:64,commune:128};
function raster(mp,bit){for(const poly of mp){const rings=poly;const ys=rings[0].map(p=>p[1]),y0=Math.max(G.south,Math.min(...ys)),y1=Math.min(G.north,Math.max(...ys));
 for(let j=Math.floor((G.north-y1)/RS);j<=Math.floor((G.north-y0)/RS);j++){if(j<0||j>=RH)continue;const y=G.north-(j+.5)*RS,xs=[];for(const r of rings)for(let i=0,k=r.length-1;i<r.length;k=i++){const a=r[i],b=r[k];if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
  xs.sort((a,b)=>a-b);for(let q=0;q+1<xs.length;q+=2){const i0=Math.max(0,Math.ceil((xs[q]-G.west)/RS-.5)),i1=Math.min(RW-1,Math.floor((xs[q+1]-G.west)/RS-.5));for(let i=i0;i<=i1;i++)mask[j*RW+i]|=bit;}}}}
raster(communeMP,BIT.commune);
for(const o of objects)if(o.layer!=='artificial'||o.kind==='surface')raster(o.mp,BIT[o.layer]);
const artPerim=objects.filter(o=>o.layer==='artificial'&&o.kind!=='surface');
for(const f of read('public/data/buildings.geojson').features)raster(polysL93(f),BIT.building);
for(const r of roads){const w=r.p.width/2;for(const p of densify(r.l,1)){const i0=Math.floor((p[0]-w-G.west)/RS),i1=Math.floor((p[0]+w-G.west)/RS),j0=Math.floor((G.north-p[1]-w)/RS),j1=Math.floor((G.north-p[1]+w)/RS);for(let j=Math.max(0,j0);j<=Math.min(RH-1,j1);j++)for(let i=Math.max(0,i0);i<=Math.min(RW-1,i1);i++)mask[j*RW+i]|=BIT.road;}}
const ha=n=>r1(n*RS*RS/1e4);let cCells=0,none=0,noneStrict=0;const pair={};const PAIRS=[['agriculture','woodland'],['agriculture','water_polygon'],['woodland','water_polygon'],['agriculture','artificial'],['woodland','artificial'],['agriculture','building'],['woodland','hedge_polygon'],['agriculture','hedge_polygon']];
for(let k=0;k<mask.length;k++){const m=mask[k];if(!(m&BIT.commune))continue;cCells++;if(!(m&127))none++;if(!(m&(1|2|4|8|16)))noneStrict++;for(const [a,b] of PAIRS)if((m&BIT[a])&&(m&BIT[b]))pair[a+'×'+b]=(pair[a+'×'+b]||0)+1;}
// Unclassified cells inside functional perimeters (industrial / commercial areas) are explained by those perimeters.
let noneOutsidePerim=0;{const pm=new Uint8Array(RW*RH);const save=mask.slice();mask.fill(0);for(const o of artPerim)raster(o.mp,1);for(let k=0;k<mask.length;k++)pm[k]=mask[k]&1;mask.set(save);for(let k=0;k<mask.length;k++){const m=mask[k];if((m&BIT.commune)&&!(m&127)&&!pm[k])noneOutsidePerim++;}}
// Unclassified patches (outside functional perimeters) of at least 1 ha: 4-connected components, listed for review.
const gaps=[];{const pm=new Uint8Array(RW*RH);const save=mask.slice();mask.fill(0);for(const o of artPerim)raster(o.mp,1);for(let k=0;k<mask.length;k++)pm[k]=mask[k]&1;mask.set(save);
 const seen=new Uint8Array(RW*RH),isGap=k=>(mask[k]&BIT.commune)&&!(mask[k]&127)&&!pm[k];
 for(let k=0;k<mask.length;k++){if(seen[k]||!isGap(k))continue;const st=[k];seen[k]=1;let n=0,sx=0,sy=0;while(st.length){const c=st.pop();n++;const i=c%RW,j=(c-i)/RW;sx+=i;sy+=j;for(const q of [c-1,c+1,c-RW,c+RW]){if(q<0||q>=mask.length||seen[q]||Math.abs((q%RW)-i)>1)continue;if(isGap(q)){seen[q]=1;st.push(q);}}}
  if(n*RS*RS>=1e4)gaps.push({ha:ha(n),centreL93:[Math.round(G.west+(sx/n+.5)*RS),Math.round(G.north-(sy/n+.5)*RS)]});}}
gaps.sort((a,b)=>b.ha-a.ha);
// Object-level overlaps worth a look: an RPG parcel more than 20 % covered by BD TOPO woodland or water, duplicated polygons.
const overlaps=[],duplicates=[];const agri=objects.filter(o=>o.layer==='agriculture'),wood=objects.filter(o=>o.layer==='woodland'),water=objects.filter(o=>o.layer==='water_polygon');
// Overlaps under 0.2 ha are either contour strips (declarative RPG limits vs BD TOPO outlines) or small declared plots (SNE, buffer strips,
// fallow) at the edge of or inside a wood: kept as they are, not open. Larger overlaps need an explicit review entry.
const EDGE={observation:'chevauchement < 0,2 ha : bande de contour entre limite RPG déclarative et contour BD TOPO, ou petite surface déclarée (SNE, bande tampon, jachère) en lisière ou dans un boisement ; les deux géométries sources sont conservées',open:false,rule:'automatique'};
for(const a of agri)for(const w of [...wood,...water]){if(!bbHit(a.bb,w.bb))continue;const x=mpArea(inter(a.mp,w.mp));if(x/a.areaM2>.2||x/w.areaM2>.5)overlaps.push({a:a.id,b:w.id,bLayer:w.layer,bType:w.type,areaM2:Math.round(x),shareOfParcel:r2(x/a.areaM2),shareOfOther:r2(x/w.areaM2),cropType:a.crop_type,review:REV.overlaps?.[a.id+'|'+w.id]||(x<2000?EDGE:null)});}
for(const L of ['agriculture','woodland','water_polygon','artificial']){const os=objects.filter(o=>o.layer===L);for(let i=0;i<os.length;i++)for(let j=i+1;j<os.length;j++){if(!bbHit(os[i].bb,os[j].bb))continue;const x=mpArea(inter(os[i].mp,os[j].mp));const iou=x/(os[i].areaM2+os[j].areaM2-x);if(iou>.9)duplicates.push({layer:L,a:os[i].id,b:os[j].id,iou:r2(iou)});}}

// ---------- 9. Derived simplified geometry (Unreal / Three.js), loss measured ----------
const TOL=.5;const loss={};
// A simplified shape that moves the area by more than 2 % (small or thin objects) is not used: the source geometry is kept for that object.
for(const o of objects){o.mpSimple=simplifyMP(o.mp,TOL);let a=mpArea(o.mpSimple);if(!o.areaM2||Math.abs(a-o.areaM2)/o.areaM2>.02){o.mpSimple=o.mp;a=o.areaM2;(loss.keptSource||(loss.keptSource=[])).push(o.id);}const L=loss[o.layer]||(loss[o.layer]={objects:0,vertices:0,verticesSimplified:0,areaAbsDiffM2:0,areaM2:0,maxRelAreaDiff:0});
 L.objects++;L.vertices+=o.mp.reduce((s,p)=>s+p.reduce((t,r)=>t+r.length,0),0);L.verticesSimplified+=o.mpSimple.reduce((s,p)=>s+p.reduce((t,r)=>t+r.length,0),0);L.areaAbsDiffM2+=Math.abs(a-o.areaM2);L.areaM2+=o.areaM2;L.maxRelAreaDiff=Math.max(L.maxRelAreaDiff,o.areaM2?Math.abs(a-o.areaM2)/o.areaM2:0);}
for(const L of Object.values(loss)){if(Array.isArray(L))continue;L.areaRelDiff=+(L.areaAbsDiffM2/L.areaM2).toFixed(5);L.maxRelAreaDiff=+L.maxRelAreaDiff.toFixed(4);L.areaAbsDiffM2=Math.round(L.areaAbsDiffM2);L.areaM2=Math.round(L.areaM2);L.maxVertexDeviationM=TOL;}
const lineLoss={};for(const [name,list] of [['hedges',hedges],['water_lines',waterLines]]){let v=0,vs=0,maxDev=0;for(const x of list){x.lSimple=simplifyLine(x.l,TOL);v+=x.l.length;vs+=x.lSimple.length;for(const p of x.l)maxDev=Math.max(maxDev,lineDist(p,x.lSimple));}lineLoss[name]={vertices:v,verticesSimplified:vs,maxDeviationM:r3(maxDev),toleranceM:TOL};}

// ---------- 10. Outputs ----------
const ringsL93=mp=>mp.map(p=>p.map(r=>r.map(q=>[r2(q[0]),r2(q[1])])));
const ringsUE=mp=>mp.map(p=>p.map(r=>r.map(q=>{const u=toUnreal([q[0],q[1],0]);return [Math.round(u[0]),Math.round(u[1])];})));
const common=o=>({id:o.id,provenance:o.provenance,confidence:o.confidence,areaM2:Math.round(o.areaM2),areaInCommuneM2:Math.round(o.areaInCommuneM2),clippedToExtent:o.clipped});
const attrs={agriculture:o=>({landuse_type:o.landuse_type,crop_type:o.crop_type,crop_code:o.crop_code,crop_group:o.crop_group,crop_year:o.crop_year,crop_source:o.crop_source,rpgCategory:o.rpgCategory,declaredAreaHa:o.declaredAreaHa,secondaryCrops:o.secondaryCrops,cropHistory:o.cropHistory,cropNote:'culture déclarée pour une campagne donnée : non permanente'}),
 woodland:o=>({type:o.type,nature:o.nature,bdforet:o.bdforet,nearWatercourse:o.nearWatercourse,precisionM:o.precisionM,sourceModified:o.sourceModified}),hedge_polygon:o=>({type:o.type,nature:o.nature,sourceModified:o.sourceModified}),
 water_polygon:o=>({type:o.type,name:o.name,nameSource:o.nameSource,persistance:o.persistance,planDeau:o.planDeau,zSurfaceApprox:o.zSurfaceApprox,zNote:o.zNote,bdtopoCoverage:o.bdtopoCoverage}),
 artificial:o=>({class:o.class,kind:o.kind,nature:o.nature,natureDetail:o.natureDetail,name:o.name,bdtopoCoverage:o.bdtopoCoverage})};
// Riparian flag (documentary: proximity only, not "ripisylve").
for(const o of wood){let near=false;for(const w of waterLines){if(near)break;const [x0,y0,x1,y1]=o.bb;if(!w.l.some(p=>p[0]>x0-20&&p[0]<x1+20&&p[1]>y0-20&&p[1]<y1+20))continue;for(const p of densify(w.l,5))if(p[0]>x0-20&&p[0]<x1+20&&p[1]>y0-20&&p[1]<y1+20&&(o.mp.some(poly=>insidePoly(p,poly))||o.mp.some(poly=>poly[0].some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<20)))){near=true;break;}}o.nearWatercourse=near;}
const refFeatures=[...objects.map(o=>({type:'Feature',id:o.id,geometry:o.geometry,properties:{layer:o.layer,...common(o),...attrs[o.layer](o)}})),
 ...hedges.map(h=>({type:'Feature',id:h.id,geometry:h.geometry,properties:{layer:'hedge',id:h.id,provenance:h.provenance,confidence:h.confidence,lengthM:r1(h.lengthM),inCommuneShare:r2(h.inCommuneShare),widthM:h.widthM,widthSource:h.widthSource,heightM:h.heightM,matchedPolygons:h.polygons,sourceModified:h.sourceModified,clippedToExtent:h.clipped}})),
 ...waterLines.map(w=>({type:'Feature',id:w.id,geometry:w.geometry,properties:{layer:'water_line',id:w.id,provenance:w.provenance,confidence:w.confidence,name:w.name,nameSource:w.nameSource,nature:w.nature,fosse:w.fosse,persistance:w.persistance,position:w.position,flow:w.flow,widthClass:w.widthClass,bcae:w.bcae,osmWaterway:w.osmWaterway,lengthM:r1(w.lengthM),inCommuneShare:r2(w.inCommuneShare),slopePermil:w.slopePermil,clippedToExtent:w.clipped}})),
 ...trees.map(t=>({type:'Feature',id:t.id,geometry:{type:'Point',coordinates:fromL93(t.L93)},properties:{layer:'tree',id:t.id,provenance:t.provenance,confidence:t.confidence,inCommune:t.inCommune}}))];
fs.writeFileSync('public/data/landcover.geojson',JSON.stringify({type:'FeatureCollection',metadata:{name:'Référentiel occupation du sol, végétation et hydrographie de Maizières-la-Grande-Paroisse',version:'1.10',generatedBy:'scripts/build-landcover.mjs',note:'geometry = géométrie source (non découpée) ; surfaces calculées sur la partie dans l’emprise du terrain V1.7',
 layers:{agriculture:'parcelles RPG 2024',woodland:'bois et forêts BD TOPO',hedge:'haies linéaires BD TOPO (DSB)',hedge_polygon:'haies polygonales BD TOPO sans linéaire',tree:'arbres documentés',water_line:'axes hydrographiques BD TOPO',water_polygon:'surfaces en eau',artificial:'surfaces et périmètres artificialisés'}},features:refFeatures})+'\n');
// Three.js diagnostic (simplified geometry, lon/lat).
const ll=mp=>mp.map(p=>p.map(r=>r.map(q=>fromL93(q).map(v=>+v.toFixed(7)))));
fs.writeFileSync('public/data/landcover-diagnostic.json',JSON.stringify({tolerance:TOL,polygons:objects.map(o=>({id:o.id,layer:o.layer,cls:o.layer==='agriculture'?o.landuse_type:o.layer==='artificial'?o.class:o.type,conf:o.confidence[0],...(o.layer==='artificial'?{kind:o.kind}:{}),rings:ll(o.mpSimple)})),
 lines:[...hedges.map(h=>({id:h.id,layer:'hedge',conf:h.confidence[0],coords:h.lSimple.map(q=>fromL93(q).map(v=>+v.toFixed(7)))})),...waterLines.map(w=>({id:w.id,layer:'water_line',conf:'A',fosse:w.fosse,coords:w.lSimple.map(q=>fromL93(q).map(v=>+v.toFixed(7)))}))]})+'\n');
fs.mkdirSync('unreal/landcover',{recursive:true});
const META={version:'1.10',generatedBy:'scripts/build-landcover.mjs',unrealOrigin:O,units:'Lambert-93 en mètres ; Unreal en centimètres : X = (E − 758278) × 100, Y = −(N − 6823571) × 100, Z = altitude × 100',
 geometryNote:'geometry = géométrie source GeoJSON (CRS84) ; ringsL93 / ringsUnreal = partie dans l’emprise du terrain V1.7 (découpée si besoin), pleine précision ; ringsUnrealSimplified = version dérivée Douglas-Peucker 0,5 m (perte mesurée dans le rapport)',
 generationNote:'aucun matériau, arbre, culture 3D, herbe, rivière ni PCG n’est généré : ces données servent de zones de génération ultérieure'};
const polyOut=(L,extra={})=>({metadata:{...META,layer:L,...extra},objects:objects.filter(o=>o.layer===L||(L==='woodland'&&o.layer==='hedge_polygon'&&false)).map(o=>({...common(o),...attrs[o.layer](o),geometry:o.geometry,ringsL93:ringsL93(o.mp),ringsUnreal:ringsUE(o.mp),ringsUnrealSimplified:ringsUE(o.mpSimple)}))});
fs.writeFileSync('unreal/landcover/agricultural-polygons.json',JSON.stringify(polyOut('agriculture',{note:'crop_* : culture principale déclarée au RPG pour la campagne crop_year, jamais une caractéristique permanente ; landuse_type = catégorie d’usage'}))+'\n');
fs.writeFileSync('unreal/landcover/woodland-polygons.json',JSON.stringify({...polyOut('woodland',{note:'zones de génération procédurale future (bois, forêts, peupleraies) ; hedgePolygons = haies BD TOPO sans linéaire DSB'}),hedgePolygons:polyOut('hedge_polygon').objects})+'\n');
fs.writeFileSync('unreal/landcover/water-polygons.json',JSON.stringify(polyOut('water_polygon',{note:'zSurfaceApprox : niveau approximatif issu du MNT sol nu (l’IGN interpole les surfaces en eau) ; aucune profondeur ni fond connus'}))+'\n');
fs.writeFileSync('unreal/landcover/artificial-surfaces.json',JSON.stringify(polyOut('artificial',{note:'kind = surface (emprise minérale : parking, terrain de sport, réservoir, cimetière) ou périmètre fonctionnel (zone d’activité, qui contient aussi bâtiments, voirie et espaces verts)'}))+'\n');
const splinePts=(l,zs)=>{const pts=l.map((q,i)=>{const z=zs?zs[i]:terrainZ(...q);return {L93:[r2(q[0]),r2(q[1]),r2(z)],ue:toUnreal([q[0],q[1],z]).map(Math.round)};});return {pointsL93:pts.map(p=>p.L93),points:pts.map(p=>p.ue)};};
fs.writeFileSync('unreal/landcover/hedge-splines.json',JSON.stringify({metadata:{...META,layer:'hedge',note:'points = sommets source densifiés à 10 m au plus, Z = terrain V1.7 (pied de haie) ; widthM dérivée et approximative lorsque renseignée'},
 hedges:hedges.map(h=>({id:h.id,sourceId:h.source,provenance:h.provenance,confidence:h.confidence,lengthM:r1(h.lengthM),inCommuneShare:r2(h.inCommuneShare),widthM:h.widthM,widthSource:h.widthSource,heightM:h.heightM,geometry:h.geometry,...splinePts(densify(h.l,10))})),
 trees:trees.map(t=>({id:t.id,provenance:t.provenance,confidence:t.confidence,L93:[r2(t.L93[0]),r2(t.L93[1]),r2(terrainZ(...t.L93))],point:toUnreal([t.L93[0],t.L93[1],terrainZ(...t.L93)]).map(Math.round)}))})+'\n');
fs.writeFileSync('unreal/landcover/water-lines.json',JSON.stringify({metadata:{...META,layer:'water_line',note:'axes hydrographiques ; points tous les 5 m ; zTerrain = MNT sol nu, zSurfaceApprox = MNT rendu non croissant vers l’aval (niveau approximatif) ; aucun fond de rivière connu'},
 lines:waterLines.map(w=>({id:w.id,sourceId:w.source,provenance:w.provenance,confidence:w.confidence,name:w.name,nameSource:w.nameSource,nature:w.nature,fosse:w.fosse,persistance:w.persistance,position:w.position,flow:w.flow,widthClass:w.widthClass,bcae:w.bcae,osmWaterway:w.osmWaterway,lengthM:r1(w.lengthM),slopePermil:w.slopePermil,geometry:w.geometry,
  ...splinePts(w.d,w.zSurfaceApprox),zTerrain:w.zTerrain.map(r2)})),relations})+'\n');

// ---------- 11. Report ----------
const sumHa=list=>r2(list.reduce((s,o)=>s+o.areaM2,0)/1e4),sumHaC=list=>r2(list.reduce((s,o)=>s+o.areaInCommuneM2,0)/1e4),by=(list,k)=>Object.fromEntries([...new Set(list.map(k))].map(v=>[v,{count:list.filter(o=>k(o)===v).length,ha:sumHa(list.filter(o=>k(o)===v)),haInCommune:sumHaC(list.filter(o=>k(o)===v))}]));
const art=objects.filter(o=>o.layer==='artificial'),wp=objects.filter(o=>o.layer==='water_polygon');
const bible=['Seine','Moulins de Poussey','Noue de Ferloup','Menus Prés','Epinettes','canal de Poussey','rivière du Moulin'].map(n=>({bibleName:n,found:[...new Set(waterLines.map(w=>w.name).filter(x=>x&&x.toLowerCase().includes(n.toLowerCase().replace('é','é'))))]}));
const report={generatedAt:new Date().toISOString(),frozen:{buildingsSha256:sha(fs.readFileSync('public/data/buildings.geojson')),terrainGeoTiffSha256:sha(tb),roadsSha256:sha(fs.readFileSync('public/data/roads.geojson')),railSha256:sha(fs.readFileSync('public/data/rail.geojson')),unrealOrigin:O},
 sources:Object.fromEntries(fs.readdirSync(D).filter(f=>f.endsWith('.geojson')).map(f=>{const j=read(`${D}/${f}`);return [f.replace('.geojson',''),{source:j.metadata.source,typename:j.metadata.typename,retrievedAt:j.metadata.retrievedAt,features:j.features.length,sha256:sha(fs.readFileSync(`${D}/${f}`))}];})),
 communeHa:r2(communeArea/1e4),
 agriculture:{parcels:agri.length,parcelsInCommune:agri.filter(o=>o.areaInCommuneM2>0).length,ha:sumHa(agri),haInCommune:sumHaC(agri),byLanduseType:by(agri,o=>o.landuse_type),byCrop:by(agri,o=>o.crop_type||o.crop_code),withDocumentedCrop:agri.filter(o=>o.crop_code).length,cropYear:2024,history:{2023:agri.filter(o=>o.cropHistory[0].crop_code).length,2022:agri.filter(o=>o.cropHistory[1].crop_code).length},
  unchangedCrop3Years:agri.filter(o=>o.cropHistory.every(h=>h.crop_code===o.crop_code)).length,declaredVsGeometricAreaMedianRatio:(()=>{const r=agri.filter(o=>o.declaredAreaHa>0&&!o.clipped).map(o=>o.declaredAreaHa*1e4/o.areaSourceM2).sort((a,b)=>a-b);return r2(r[r.length>>1]);})()},
 woodland:{polygons:wood.length,ha:sumHa(wood),haInCommune:sumHaC(wood),byType:by(wood,o=>o.type),withBdforet:wood.filter(o=>o.bdforet).length,nearWatercourse:wood.filter(o=>o.nearWatercourse).length},
 hedges:{count:hedges.length,lengthKm:r3(hedges.reduce((s,h)=>s+h.lengthM,0)/1000),lengthKmInCommune:r3(hedges.reduce((s,h)=>s+h.lengthM*h.inCommuneShare,0)/1000),byConfidence:hedges.reduce((m,h)=>{const k=h.confidence[0];m[k]=(m[k]||0)+1;return m;},{}),withWidth:hedges.filter(h=>h.widthM).length,
  polygonsWithoutLine:objects.filter(o=>o.layer==='hedge_polygon').length,polygonsWithoutLineHa:sumHa(objects.filter(o=>o.layer==='hedge_polygon'))},
 trees:{count:trees.length,source:'OSM natural=tree ; aucune couche officielle d’arbres ou d’alignements accessible'},
 water:{lines:waterLines.length,lengthKm:r3(waterLines.reduce((s,w)=>s+w.lengthM,0)/1000),lengthKmInCommune:r3(waterLines.reduce((s,w)=>s+w.lengthM*w.inCommuneShare,0)/1000),named:waterLines.filter(w=>w.name).length,unnamed:waterLines.filter(w=>!w.name).length,
  namedKm:r3(waterLines.filter(w=>w.name).reduce((s,w)=>s+w.lengthM,0)/1000),names:[...new Set(waterLines.map(w=>w.name).filter(Boolean))].sort(),byPersistance:by(waterLines.map(w=>({...w,areaM2:0,areaInCommuneM2:0})),w=>w.persistance),bcae:waterLines.filter(w=>w.bcae).length,fosses:waterLines.filter(w=>w.fosse).length,underground:waterLines.filter(w=>w.position==='souterrain').length,
  polygons:wp.length,polygonsHa:sumHa(wp),polygonsHaInCommune:sumHaC(wp),polygonsByType:by(wp,o=>o.type),polygonsNamed:wp.filter(o=>o.name).length,bible},
 artificial:{surfaces:art.length,byClass:by(art,o=>o.class),byKind:by(art,o=>o.kind),osmComplements:art.filter(o=>o.confidence==='C').length},
 relations:{count:relations.length,byKind:relations.reduce((m,r)=>(m[r.with+' : '+r.kind]=(m[r.with+' : '+r.kind]||0)+1,m),{}),open:relations.filter(r=>r.open),roadBridges},
 quality:{duplicates,overlaps,raster:{resolutionM:RS,communeHa:ha(cCells),unclassifiedHa:ha(none),unclassifiedOutsideFunctionalPerimetersHa:ha(noneOutsidePerim),noLandcoverClassHa:ha(noneStrict),note:'non classé = ni parcelle RPG, bois, haie, eau, surface artificielle, bâtiment ni voirie (voirie = largeur V1.8) ; ce sont surtout jardins, cours, friches et terres non déclarées au RPG',
  pairOverlapsHa:Object.fromEntries(Object.entries(pair).map(([k,v])=>[k,ha(v)])),gapsOver1ha:gaps.map(g=>({...g,review:REV.gaps?.[g.centreL93.join(',')]||null}))},withoutProvenance:[...objects,...hedges,...waterLines].filter(o=>!o.provenance).length,uncertain:{B:[...objects,...hedges].filter(o=>o.confidence[0]==='B').length,C:objects.filter(o=>o.confidence[0]==='C').length},
  simplification:{polygons:loss,lines:lineLoss}},notes:REV.notes||[]};
report.openIssues={overlapsToCheck:overlaps.filter(o=>!o.review||o.review.open),duplicates,relationsOpen:relations.filter(r=>r.open),uncertainC:objects.filter(o=>o.confidence[0]==='C').map(o=>({id:o.id,layer:o.layer,class:o.class||o.type})),observations:REV.observations||[],gapsOpen:report.quality.raster.gapsOver1ha.filter(g=>g.review?.open)};
report.openIssues.count=report.openIssues.overlapsToCheck.length+duplicates.length+report.openIssues.relationsOpen.length+report.openIssues.uncertainC.length+(REV.observations||[]).filter(o=>o.open).length+report.openIssues.gapsOpen.length;
fs.writeFileSync(`${D}/landcover-report.json`,JSON.stringify(report,null,1)+'\n');
console.log(JSON.stringify({agriculture:{...report.agriculture,byCrop:undefined},woodland:report.woodland,hedges:report.hedges,trees:report.trees.count,water:{...report.water,byPersistance:undefined},artificial:report.artificial,relations:{count:relations.length,byKind:report.relations.byKind,open:relations.filter(r=>r.open).length},
 quality:{...report.quality,overlaps:overlaps.length},open:report.openIssues.count},null,1));
