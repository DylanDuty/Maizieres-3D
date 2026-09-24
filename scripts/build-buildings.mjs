// V1.5 building reference: IGN BD TOPO footprints are the primary geometry; OSM adds semantics and fills
// the buildings IGN does not have. Output: public/data/buildings.geojson (runtime + future Unreal export)
// and data-sources/building-reference-report.json (coverage statistics).
// Rule: a real building with only a footprint is kept; no size or attribute filter removes anything.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {projection,polygons,bounds,insidePoly} from '../src/geo.js';
import {prepareShape,intersectionArea,intersects} from './spatial-match.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^﻿/,''));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const OSM='public/data/maizieres.geojson',IGN='data-sources/ign/batiment.geojson',COMMUNE='public/data/commune.geojson',ZAI='data-sources/ign/zone_d_activite_ou_d_interet.geojson';
const osm=read(OSM),ign=read(IGN),commune=read(COMMUNE),zai=read(ZAI),project=projection(osm.metadata.origin);
const border=polygons(commune,project),bb=bounds(border.flat(2)),extent={minX:bb.minX-150,maxX:bb.maxX+150,minZ:bb.minZ-150,maxZ:bb.maxZ+150};
const centreOf=poly=>{const b=bounds(poly[0]);return [(b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2];};
const inCommune=c=>border.some(p=>insidePoly(c,p)),inExtent=c=>c[0]>=extent.minX&&c[0]<=extent.maxX&&c[1]>=extent.minZ&&c[1]<=extent.maxZ;
const rejected=[];
// Geometry validation: only non-finite or empty geometries are rejected, and each rejection is recorded.
function prepare(f,id,source){
 const polys=polygons(f,project);
 if(!polys.length){rejected.push({id,source,reason:'géométrie non surfacique ('+f.geometry?.type+')'});return null;}
 if(polys.some(p=>p.some(r=>r.some(q=>!q.every(Number.isFinite))))){rejected.push({id,source,reason:'coordonnées non finies'});return null;}
 if(polys.some(p=>p[0].length<4)){rejected.push({id,source,reason:'anneau extérieur de moins de 3 sommets'});return null;}
 const s=prepareShape(polys);if(!(s.area>0)){rejected.push({id,source,reason:'surface nulle après triangulation'});return null;}
 return {f,id,source,polys,...s,c:centreOf(polys[0]),parts:polys.length,holes:polys.reduce((n,p)=>n+p.length-1,0)};
}
const osmB=osm.features.filter(f=>f.properties.building).map(f=>prepare(f,f.id,'osm')).filter(Boolean);
const ignB=ign.features.map(f=>prepare(f,f.properties.cleabs,'ign')).filter(Boolean);
function index(list,size=80){const g=new Map();for(const o of list)for(let x=Math.floor(o.b.minX/size);x<=Math.floor(o.b.maxX/size);x++)for(let z=Math.floor(o.b.minZ/size);z<=Math.floor(o.b.maxZ/size);z++){const k=x+','+z;if(!g.has(k))g.set(k,[]);g.get(k).push(o);}
 return o=>{const out=new Set();for(let x=Math.floor(o.b.minX/size);x<=Math.floor(o.b.maxX/size);x++)for(let z=Math.floor(o.b.minZ/size);z<=Math.floor(o.b.maxZ/size);z++)for(const c of g.get(x+','+z)||[])if(intersects(o.b,c.b))out.add(c);return [...out];};}
const nearIgn=index(ignB);
for(const i of ignB)i.links=[];
for(const o of osmB){o.links=[];for(const i of nearIgn(o)){const a=intersectionArea(o,i);if(a>.01){o.links.push({i,a});i.links.push({o,a});}}o.coverage=o.links.reduce((s,l)=>s+l.a,0)/o.area;}
for(const i of ignB)i.coverage=i.links.reduce((s,l)=>s+l.a,0)/i.area;

// OSM semantics kept on the unified building (never geometry).
const KEEP=['building','name','amenity','shop','wall','building:levels','height','roof:shape','roof:material','roof:height','roof:direction','religion','denomination','man_made','brand','operator','historic','tourism','office','craft','leisure'];
const tagsOf=f=>Object.fromEntries(KEEP.filter(k=>f.properties[k]!=null).map(k=>[k,f.properties[k]]));
// Same derivation as the V1.1 enrichment, now for every IGN building.
function derived(p,areaM2){
 const accuracy=Number(p.precision_altimetrique),wallHeight=p.hauteur>0&&p.hauteur<80&&accuracy>0&&accuracy<=5?p.hauteur:null;
 const rise=wallHeight&&p.altitude_maximale_toit!=null&&p.altitude_minimale_sol!=null?p.altitude_maximale_toit-p.altitude_minimale_sol-wallHeight:null;
 const roofHeight=rise!=null&&rise>=.6&&rise<=9&&areaM2>=25&&!p.construction_legere?Math.round(rise*10)/10:null;
 const floors=p.nombre_d_etages>0&&p.nombre_d_etages<15?p.nombre_d_etages:null;
 const roofMaterials=[...new Set(String(p.materiaux_de_la_toiture||'').split('').filter(c=>'1234'.includes(c)))].map(c=>({'1':'tile','2':'slate','3':'metal','4':'concrete'}[c]));
 return {wallHeight,roofHeight,floors,roofMaterials,roofMaterialCode:p.materiaux_de_la_toiture||null,wallMaterialCode:p.materiaux_des_murs||null,usage:p.usage_1,nature:p.nature,lightConstruction:p.construction_legere,heightAccuracy:Number.isFinite(accuracy)?accuracy:null};
}
const COVERED=.5,ABSENT=.1;
const features=[],skipped={outsideExtent:{ign:0,osm:0},osmRepresentedByIgn:0,osmPartialOverlap:0};
for(const i of ignB){if(!inExtent(i.c)){skipped.outsideExtent.ign++;continue;}
 const p=i.f.properties;
 // Semantic donor: the OSM footprint sharing the most area, if the overlap is meaningful for either shape.
 const strong=i.links.filter(l=>l.a>=COVERED*i.area||l.a>=COVERED*l.o.area).sort((a,b)=>b.a-a.a);
 const donor=strong[0]?.o;
 const osmPart=strong.length?{ids:strong.map(l=>l.o.id),donor:donor.id,names:[...new Set(strong.map(l=>l.o.f.properties.name).filter(Boolean))],coverage:+i.coverage.toFixed(3),tags:tagsOf(donor.f)}:null;
 const provenance=i.coverage>=COVERED?'ign+osm':i.coverage>=ABSENT?'ign+osm-partiel':'ign';
 features.push({type:'Feature',id:i.id,geometry:i.f.geometry,properties:{id:i.id,source:'IGN BD TOPO',provenance,inCommune:inCommune(i.c),areaM2:+i.area.toFixed(2),parts:i.parts,holes:i.holes,rnb:p.identifiants_rnb||null,
  ign:{cleabs:p.cleabs,nature:p.nature,usage1:p.usage_1,usage2:p.usage_2,lightConstruction:p.construction_legere,state:p.etat_de_l_objet,height:p.hauteur,floors:p.nombre_d_etages,dwellings:p.nombre_de_logements,wallMaterials:p.materiaux_des_murs,roofMaterials:p.materiaux_de_la_toiture,groundMin:p.altitude_minimale_sol,groundMax:p.altitude_maximale_sol,roofMin:p.altitude_minimale_toit,roofMax:p.altitude_maximale_toit,planimetricAccuracy:p.precision_planimetrique,altimetricAccuracy:p.precision_altimetrique,planimetricMethod:p.methode_d_acquisition_planimetrique,altimetricMethod:p.methode_d_acquisition_altimetrique,origin:p.origine_du_batiment,created:p.date_creation,modified:p.date_modification},
  osm:osmPart,derived:derived(p,i.area)}});
}
for(const o of osmB){if(!inExtent(o.c)){skipped.outsideExtent.osm++;continue;}
 if(o.coverage>=ABSENT){if(o.coverage>=COVERED)skipped.osmRepresentedByIgn++;else skipped.osmPartialOverlap++;continue;}
 // OSM-only footprint (IGN coverage < 10 %): kept as a complementary building, clearly flagged.
 features.push({type:'Feature',id:o.id,geometry:o.f.geometry,properties:{id:o.id,source:'OpenStreetMap',provenance:'osm',inCommune:inCommune(o.c),areaM2:+o.area.toFixed(2),parts:o.parts,holes:o.holes,rnb:null,ign:null,
  osm:{ids:[o.id],donor:o.id,coverage:+o.coverage.toFixed(3),tags:tagsOf(o.f),sourceTag:o.f.properties.source||null},derived:null}});
}
// IGN points of interest located inside exactly one reference building.
for(const z of zai.features){const p=z.properties;if(p.insee_commune!=='10220'||p.etat_de_l_objet!=='En service'||!['Mairie','Enseignement primaire','Caserne de pompiers','Salle de spectacle ou conférence'].includes(p.nature))continue;
 const c=centreOf(polygons(z,project)[0]),name=p.toponyme||({'Caserne de pompiers':'Centre de secours','Salle de spectacle ou conférence':'Salle polyvalente'}[p.nature]);
 const hits=features.filter(f=>polygons(f,project).some(poly=>insidePoly(c,poly)));if(hits.length===1)hits[0].properties.landmark={name,kind:p.nature,source:p.cleabs};}

const count=(list,f)=>list.filter(f).length,F=features.map(f=>f.properties);
const stats={
 sources:{osm:{inExtent:count(osmB,o=>inExtent(o.c)),inCommune:count(osmB,o=>inCommune(o.c)),total:osmB.length},ign:{inExtent:count(ignB,i=>inExtent(i.c)),inCommune:count(ignB,i=>inCommune(i.c)),total:ignB.length,underConstruction:count(ignB,i=>i.f.properties.etat_de_l_objet!=='En service'&&inExtent(i.c))},cadastre:'non disponible (réseau)'},
 matching:{oneToOne:count(osmB,o=>inExtent(o.c)&&o.links.length===1&&o.links[0].i.links.length===1&&o.links[0].a/(o.area+o.links[0].i.area-o.links[0].a)>=.5),
  ignCoveredByOsm:count(ignB,i=>inExtent(i.c)&&i.coverage>=COVERED),ignPartial:count(ignB,i=>inExtent(i.c)&&i.coverage>=ABSENT&&i.coverage<COVERED),ignWithoutOsm:count(ignB,i=>inExtent(i.c)&&i.coverage<ABSENT),
  osmCoveredByIgn:count(osmB,o=>inExtent(o.c)&&o.coverage>=COVERED),osmPartial:count(osmB,o=>inExtent(o.c)&&o.coverage>=ABSENT&&o.coverage<COVERED),osmWithoutIgn:count(osmB,o=>inExtent(o.c)&&o.coverage<ABSENT),
  ignWithOsmSemantics:count(F,p=>p.source==='IGN BD TOPO'&&p.osm),inCommune:{ignWithoutOsm:count(ignB,i=>inCommune(i.c)&&i.coverage<ABSENT),osmWithoutIgn:count(osmB,o=>inCommune(o.c)&&o.coverage<ABSENT)}},
 reference:{total:features.length,inCommune:count(F,p=>p.inCommune),byProvenance:F.reduce((m,p)=>(m[p.provenance]=(m[p.provenance]||0)+1,m),{}),withRnb:count(F,p=>p.rnb),withIgnHeight:count(F,p=>p.derived?.wallHeight),multiPart:count(F,p=>p.parts>1),withHoles:count(F,p=>p.holes>0),landmarks:count(F,p=>p.landmark)},
 notIncluded:{...skipped,rejectedGeometries:rejected.length},
 // OSM footprints only partly covered by IGN (10–50 %): not duplicated, but their uncovered area is listed for review.
 osmPartialReview:osmB.filter(o=>inExtent(o.c)&&o.coverage>=ABSENT&&o.coverage<COVERED).map(o=>({id:o.id,areaM2:+o.area.toFixed(1),uncoveredM2:+((1-o.coverage)*o.area).toFixed(1),inCommune:inCommune(o.c),position:o.c.map(v=>+v.toFixed(1))})).sort((a,b)=>b.uncoveredM2-a.uncoveredM2),
 rejected};
const metadata={name:'Référentiel bâti de Maizières-la-Grande-Paroisse',version:'1.5',generatedBy:'scripts/build-buildings.mjs',crs:'WGS84 (CRS84) longitude, latitude, altitude IGN éventuelle en 3e coordonnée',
 localProjection:{origin:osm.metadata.origin,formula:'x = (lon − lon0) × π/180 × R × cos(lat0) ; z = −(lat − lat0) × π/180 × R ; R = 6 371 008,8 m ; x vers l’est, z vers le sud, en mètres',extent},
 primary:'IGN BD TOPO (BDTOPO_V3:batiment), Licence Ouverte 2.0',complement:'OpenStreetMap (ODbL) : sémantique, et empreintes absentes de l’IGN (couverture IGN < 10 %)',
 matching:'Intersection exacte des polygones triangulés. Sémantique OSM transmise si l’intersection couvre ≥ 50 % du bâtiment IGN ou du bâtiment OSM.',
 sources:{osm:{file:OSM,sha256:hash(OSM),snapshot:osm.metadata.osmTimestamp},ign:{file:IGN,sha256:hash(IGN),retrievedAt:ign.metadata.retrievedAt},commune:{file:COMMUNE,sha256:hash(COMMUNE)}},
 fields:{id:'Identifiant stable : cleabs IGN ou way OSM',source:'Source de la géométrie',provenance:'ign+osm | ign+osm-partiel | ign | osm',rnb:'Identifiant(s) RNB fournis par l’IGN',ign:'Attributs IGN bruts',osm:'Identifiants OSM recouvrants et étiquettes sémantiques du principal',derived:'Hauteur de mur, hausse de toit, étages, matériaux, dérivés des attributs IGN (règles V1.1)',landmark:'Repère IGN (zone d’activité) situé dans ce seul bâtiment'},stats:{reference:stats.reference,matching:stats.matching}};
fs.writeFileSync('public/data/buildings.geojson',JSON.stringify({type:'FeatureCollection',metadata,features}));
fs.writeFileSync('data-sources/building-reference-report.json',JSON.stringify(stats,null,1)+'\n');
const {rejected:r,osmPartialReview:pr,...summary}=stats;summary.osmPartialReview={count:pr.length,uncoveredOver25m2:pr.filter(x=>x.uncoveredM2>25).length,uncoveredTotalM2:Math.round(pr.reduce((s,x)=>s+x.uncoveredM2,0)),top:pr.slice(0,8)};console.log(JSON.stringify(summary,null,1));
