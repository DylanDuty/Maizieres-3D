// Baseline audit of the V1.4 state (before the V1.5 unified reference).
// Building coverage audit: OSM vs IGN BD TOPO, commune vs display extent, and losses in the V1.4 pipeline.
// Read-only on sources; writes data-sources/building-audit.json.
import fs from 'node:fs';
import {projection,polygons,lines,bounds,insidePoly,area} from '../src/geo.js';
import {clipRing} from '../src/geometry.js';
import {prepareShape,intersectionArea,intersects} from './spatial-match.mjs';
import {buildingProfile} from '../src/building-profile.js';
import {segmentDistance} from '../src/cartography.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^﻿/,''));
const osm=read('public/data/maizieres.geojson'),ign=read('data-sources/ign/batiment.geojson'),commune=read('public/data/commune.geojson'),enrichment=read('public/data/building-enrichment.json');
const project=projection(osm.metadata.origin),border=polygons(commune,project),b=bounds(border.flat(2));
const extent={minX:b.minX-150,maxX:b.maxX+150,minZ:b.minZ-150,maxZ:b.maxZ+150};
const center=poly=>{const bb=bounds(poly[0]);return [(bb.minX+bb.maxX)/2,(bb.minZ+bb.maxZ)/2];};
const inCommune=c=>border.some(p=>insidePoly(c,p)),inExtent=c=>c[0]>=extent.minX&&c[0]<=extent.maxX&&c[1]>=extent.minZ&&c[1]<=extent.maxZ;
const shapeOf=f=>{const s=prepareShape(polygons(f,project));s.c=center(polygons(f,project)[0]);return s;};

const osmB=osm.features.filter(f=>f.properties.building).map(f=>({f,id:f.id,...shapeOf(f)}));
const ignB=ign.features.map(f=>({f,id:f.properties.cleabs,...shapeOf(f)}));
function index(list,size=80){const g=new Map();for(const o of list)for(let x=Math.floor(o.b.minX/size);x<=Math.floor(o.b.maxX/size);x++)for(let z=Math.floor(o.b.minZ/size);z<=Math.floor(o.b.maxZ/size);z++){const k=x+','+z;if(!g.has(k))g.set(k,[]);g.get(k).push(o);}
 return o=>{const out=new Set();for(let x=Math.floor(o.b.minX/size);x<=Math.floor(o.b.maxX/size);x++)for(let z=Math.floor(o.b.minZ/size);z<=Math.floor(o.b.maxZ/size);z++)for(const c of g.get(x+','+z)||[])if(intersects(o.b,c.b))out.add(c);return [...out];};}
const nearIgn=index(ignB),nearOsm=index(osmB);
// Pairwise overlaps (exact triangle clipping), both directions.
for(const o of osmB){o.links=[];for(const i of nearIgn(o)){const a=intersectionArea(o,i);if(a>.01){o.links.push({i,a});}}o.covered=o.links.reduce((s,l)=>s+l.a,0)/o.area;}
for(const i of ignB){i.links=[];for(const o of nearOsm(i)){const l=o.links.find(l=>l.i===i);if(l)i.links.push({o,a:l.a});}i.covered=i.links.reduce((s,l)=>s+l.a,0)/i.area;}
const cls=v=>v>=.5?'covered':v>=.1?'partial':'absent';

// V1.4 pipeline replay for OSM buildings (landscape.js + buildings.js filters).
const pipeline={osmFeatures:osmB.length,centreOutsideExtent:0,clippedEmpty:0,areaBelow3:0,areaAbove100000:0,noProfile:0,rendered:0};
for(const o of osmB){if(!inExtent(o.c)){pipeline.centreOutsideExtent++;continue;}const poly=polygons(o.f,project)[0].map(r=>clipRing(r,extent)).filter(r=>r.length>=3);if(!poly.length){pipeline.clippedEmpty++;continue;}
 const a=area(poly[0]);if(a<3){pipeline.areaBelow3++;o.dropped='area<3';continue;}if(a>100000){pipeline.areaAbove100000++;continue;}// V1.4 roofAxis ignored edges < 1 m and returned null for finely digitised round outlines (silos, tanks).
 if(!poly[0].some((q,k)=>k&&Math.hypot(q[0]-poly[0][k-1][0],q[1]-poly[0][k-1][1])>=1)||!buildingProfile(o.f.properties,poly,enrichment.buildings[o.id]||{},o.id)){pipeline.noProfile++;o.dropped='no profile';continue;}pipeline.rendered++;o.rendered=true;}

const scope=(list,where)=>list.filter(x=>where==='commune'?inCommune(x.c):inExtent(x.c));
function summary(where){const I=scope(ignB,where),O=scope(osmB,where);const count=(l,f)=>l.filter(f).length;
 return {ign:{total:I.length,enService:count(I,i=>i.f.properties.etat_de_l_objet==='En service'),coveredByOsm:count(I,i=>cls(i.covered)==='covered'),partiallyCovered:count(I,i=>cls(i.covered)==='partial'),absentFromOsm:count(I,i=>cls(i.covered)==='absent'),absentAreaM2:Math.round(I.filter(i=>cls(i.covered)==='absent').reduce((s,i)=>s+i.area,0)),lightConstruction:count(I,i=>i.f.properties.construction_legere)},
  osm:{total:O.length,rendered:count(O,o=>o.rendered),coveredByIgn:count(O,o=>cls(o.covered)==='covered'),partiallyCovered:count(O,o=>cls(o.covered)==='partial'),absentFromIgn:count(O,o=>cls(o.covered)==='absent'),absentAreaM2:Math.round(O.filter(o=>cls(o.covered)==='absent').reduce((s,o)=>s+o.area,0))},
  oneToOne:count(O,o=>o.links.length===1&&o.links[0].i.links.length===1&&o.links[0].a/(o.area+o.links[0].i.area-o.links[0].a)>=.5),
  osmSplitIgnMerged:count(I,i=>i.links.filter(l=>l.a/l.o.area>.5).length>1),ignSplitOsmMerged:count(O,o=>o.links.filter(l=>l.a/l.i.area>.5).length>1)};}

// Where are IGN buildings missing from OSM? Nearest named street and nearest OSM place name.
const streets=osm.features.filter(f=>f.properties.highway&&f.properties.name).flatMap(f=>lines(f,project).map(l=>({l,name:f.properties.name})));
const places=osm.features.filter(f=>f.properties.place&&f.properties.name&&f.geometry.type==='Point').map(f=>({p:project(f.geometry.coordinates),name:f.properties.name}));
function nearestStreet(c){let best=null,d=Infinity;for(const s of streets)for(let k=1;k<s.l.length;k++){const x=segmentDistance(c,s.l[k-1],s.l[k]);if(x<d){d=x;best=s.name;}}return {name:best,distance:Math.round(d)};}
const missing=scope(ignB,'commune').filter(i=>cls(i.covered)==='absent');
const byStreet={};for(const i of missing){const s=nearestStreet(i.c),key=s.distance<60?s.name:'(à plus de 60 m d’une rue nommée)';byStreet[key]??={count:0,areaM2:0,houses:0};byStreet[key].count++;byStreet[key].areaM2+=Math.round(i.area);if(i.area>=40&&!i.f.properties.construction_legere&&i.f.properties.nature==='Indifférenciée')byStreet[key].houses++;}
const sizes={'<20 m²':0,'20–40 m²':0,'40–80 m²':0,'80–200 m²':0,'≥200 m²':0};for(const i of missing){const a=i.area;sizes[a<20?'<20 m²':a<40?'20–40 m²':a<80?'40–80 m²':a<200?'80–200 m²':'≥200 m²']++;}
const dates={};for(const i of missing){const y=(i.f.properties.date_creation||'').slice(0,4)||'?';dates[y]=(dates[y]||0)+1;}
const osmOnly=scope(osmB,'commune').filter(o=>cls(o.covered)==='absent'),osmOnlySizes={'<20 m²':0,'20–40 m²':0,'40–80 m²':0,'≥80 m²':0};for(const o of osmOnly){const a=o.area;osmOnlySizes[a<20?'<20 m²':a<40?'20–40 m²':a<80?'40–80 m²':'≥80 m²']++;}

const report={generatedAt:new Date().toISOString(),sources:{osm:{file:'public/data/maizieres.geojson',snapshot:osm.metadata.osmTimestamp,note:'Empreintes issues pour l’essentiel de l’import cadastral DGFiP (tag source « cadastre-dgi-fr … Mise à jour : 2013 »)',buildingSourceTags:Object.entries(osmB.reduce((m,o)=>{const s=String(o.f.properties.source||'(aucune)');const k=/2013/.test(s)?'cadastre 2013':/cadastre/i.test(s)?'cadastre (autre date)':s;m[k]=(m[k]||0)+1;return m;},{})).sort((a,b)=>b[1]-a[1]).slice(0,6)},
  ign:{file:'data-sources/ign/batiment.geojson',retrievedAt:ign.metadata.retrievedAt,bbox:ign.metadata.bbox,note:'Requête WFS BDTOPO_V3:batiment, 2 489 objets < limite 5 000 : réponse complète pour la boîte'},cadastre:'Non disponible localement ; téléchargement refusé par la politique réseau de l’environnement (cadastre.data.gouv.fr, data.geopf.fr, rnb-api.beta.gouv.fr)'},
 thresholds:{covered:'≥ 50 % de la surface recouverte par l’autre source',partial:'10–50 %',absent:'< 10 %',oneToOne:'couple unique et IoU ≥ 50 %'},
 commune:summary('commune'),displayExtent:summary('extent'),v14Pipeline:pipeline,
 ignAbsentFromOsmInCommune:{bySize:sizes,byCreationYear:Object.fromEntries(Object.entries(dates).sort()),byNearestStreet:Object.fromEntries(Object.entries(byStreet).sort((a,b)=>b[1].count-a[1].count)),list:missing.map(i=>({id:i.id,rnb:i.f.properties.identifiants_rnb,areaM2:+i.area.toFixed(1),nature:i.f.properties.nature,usage:i.f.properties.usage_1,light:i.f.properties.construction_legere,created:i.f.properties.date_creation?.slice(0,10),position:i.c.map(v=>+v.toFixed(1))}))},
 osmAbsentFromIgnInCommune:{bySize:osmOnlySizes,list:osmOnly.map(o=>({id:o.id,areaM2:+o.area.toFixed(1),building:o.f.properties.building,wall:o.f.properties.wall||null,name:o.f.properties.name||null,position:o.c.map(v=>+v.toFixed(1))}))}};
fs.writeFileSync('data-sources/building-audit.json',JSON.stringify(report,null,1)+'\n');
const {ignAbsentFromOsmInCommune:m,osmAbsentFromIgnInCommune:n,...head}=report;
console.log(JSON.stringify({...head,ignAbsentFromOsm:{bySize:m.bySize,byCreationYear:m.byCreationYear,topStreets:Object.entries(m.byNearestStreet).slice(0,15)},osmAbsentFromIgn:n.bySize},null,1));
