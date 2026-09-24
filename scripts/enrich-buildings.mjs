import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {projection,polygons,insidePoly} from '../src/geo.js';
import {prepareShape,intersectionArea,intersects} from './spatial-match.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const osm=read('public/data/maizieres.geojson'),ign=read('data-sources/ign/batiment.geojson'),project=projection(osm.metadata.origin);
const sources=ign.features.filter(f=>f.properties.etat_de_l_objet==='En service').map(f=>({...prepareShape(polygons(f,project)),f})).filter(x=>x.area>0);
const buildings={},audit=[],stats={sourceBuildings:sources.length,osmBuildings:0,matched:0,wallHeights:0,roofHeights:0,floors:0,roofMaterials:0,usage:0,ambiguous:0};
const grid=new Map(),size=80;
for(const b of sources)for(let x=Math.floor(b.b.minX/size);x<=Math.floor(b.b.maxX/size);x++)for(let z=Math.floor(b.b.minZ/size);z<=Math.floor(b.b.maxZ/size);z++){const k=x+','+z;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(b);}
for(const f of osm.features.filter(f=>f.properties.building)){
 const shape=prepareShape(polygons(f,project));if(!shape.area)continue;stats.osmBuildings++;
 const candidates=new Set();for(let x=Math.floor(shape.b.minX/size);x<=Math.floor(shape.b.maxX/size);x++)for(let z=Math.floor(shape.b.minZ/size);z<=Math.floor(shape.b.maxZ/size);z++)for(const b of grid.get(x+','+z)||[])candidates.add(b);
 const scores=[...candidates].filter(b=>intersects(shape.b,b.b)).map(b=>{const overlap=intersectionArea(shape,b);return {b,coverage:overlap/shape.area,iou:overlap/(shape.area+b.area-overlap)};}).sort((a,b)=>b.iou-a.iou);
 const best=scores[0],second=scores[1]?.iou||0;
 if(!best||best.coverage<.65||best.iou<.5){audit.push({osm:f.id,status:'unmatched',bestIou:best?.iou||0});continue;}
 if(best.iou-second<.15){stats.ambiguous++;audit.push({osm:f.id,status:'ambiguous'});continue;}
 const p=best.b.f.properties;
 const quality=Number(p.precision_altimetrique),wallHeight=p.hauteur>0&&p.hauteur<80&&quality>0&&quality<=5?p.hauteur:null;
 // The roof maximum is a MNS-derived statistical altitude, not a roof plane survey.
 const rise=wallHeight&&p.altitude_maximale_toit!=null&&p.altitude_minimale_sol!=null?p.altitude_maximale_toit-p.altitude_minimale_sol-wallHeight:null;
 const roofHeight=rise!=null&&rise>=.6&&rise<=9&&shape.area>=25&&!p.construction_legere?Math.round(rise*10)/10:null;
 const floors=p.nombre_d_etages>0&&p.nombre_d_etages<15?p.nombre_d_etages:null;
 const roofMaterials=[...new Set(String(p.materiaux_de_la_toiture||'').split('').filter(c=>'1234'.includes(c)))].map(c=>({'1':'tile','2':'slate','3':'metal','4':'concrete'}[c]));
 const entry={ignId:p.cleabs,match:{iou:+best.iou.toFixed(3),osmCoverage:+best.coverage.toFixed(3),runnerUpIou:+second.toFixed(3)},wallHeight,roofHeight,floors,roofMaterials,roofMaterialCode:p.materiaux_de_la_toiture||null,wallMaterialCode:p.materiaux_des_murs||null,usage:p.usage_1,nature:p.nature,lightConstruction:p.construction_legere,heightMethod:p.methode_d_acquisition_altimetrique,heightAccuracy:quality,modifiedAt:p.date_modification,sourceAltitudes:{ground:p.altitude_minimale_sol,roofMin:p.altitude_minimale_toit,roofMax:p.altitude_maximale_toit}};
 buildings[f.id]=entry;stats.matched++;if(wallHeight)stats.wallHeights++;if(roofHeight)stats.roofHeights++;if(floors)stats.floors++;if(roofMaterials.length)stats.roofMaterials++;if(p.usage_1&&p.usage_1!=='Indifférencié')stats.usage++;
}
const zones=read('data-sources/ign/zone_d_activite_ou_d_interet.geojson');
const landmarks=[];
for(const f of zones.features){const p=f.properties;if(p.insee_commune!=='10220'||p.etat_de_l_objet!=='En service')continue;const poly=polygons(f,project),s=prepareShape(poly);const center=[(s.b.minX+s.b.maxX)/2,(s.b.minZ+s.b.maxZ)/2];
 const name=p.toponyme||({'Caserne de pompiers':'Centre de secours','Salle de spectacle ou conférence':'Salle polyvalente'}[p.nature]);if(!name)continue;
 landmarks.push({id:p.cleabs,name,kind:p.nature,position:[center[0],12,center[1]],precision:p.precision_planimetrique,fictitiousGeometry:p.fictif,source:'IGN BD TOPO'});
 // These small ZAI polygons sometimes just encode a geocoded point; never use them as building geometry.
 if(['Mairie','Enseignement primaire','Caserne de pompiers','Salle de spectacle ou conférence'].includes(p.nature)){
   const contained=osm.features.filter(o=>o.properties.building&&polygons(o,project).some(poly=>insidePoly(center,poly)));
   if(contained.length===1){const id=contained[0].id;buildings[id]??={};buildings[id].landmark={name,kind:p.nature,source:p.cleabs,precision:p.precision_planimetrique};}
 }
}
const vegetation=read('data-sources/ign/zone_de_vegetation.geojson');
const landscape={type:'FeatureCollection',metadata:{source:'IGN BD TOPO',retrievedAt:vegetation.metadata.retrievedAt,license:'Licence Ouverte 2.0'},features:vegetation.features.filter(f=>['Haie','Peupleraie','Bois'].includes(f.properties.nature)).map(f=>({type:'Feature',id:f.properties.cleabs,geometry:f.geometry,properties:{nature:f.properties.nature,precision:f.properties.precision_planimetrique,modifiedAt:f.properties.date_modification}}))};
fs.writeFileSync('public/data/ign-landscape.geojson',JSON.stringify(landscape));
const output={metadata:{source:'IGN BD TOPO / Géoplateforme',retrievedAt:ign.metadata.retrievedAt,license:'Licence Ouverte 2.0',osmSHA256:hash('public/data/maizieres.geojson'),boundarySHA256:hash('public/data/commune.geojson'),matching:'Intersection exacte des polygones triangulés ; couverture OSM ≥ 65 %, IoU ≥ 50 %, écart au second candidat ≥ 15 points',heightDefinition:'Hauteur IGN au bord du toit ; hausse de toit = altitude_maximale_toit - altitude_minimale_sol - hauteur, si cohérente. Le maximum est statistique.',stats},buildings,landmarks};
fs.writeFileSync('public/data/building-enrichment.json',JSON.stringify(output));
fs.writeFileSync('data-sources/matching-audit.json',JSON.stringify({stats,unmatched:audit},null,2));
console.log(JSON.stringify(stats,null,2));console.log('Landscape',landscape.features.length,'landmarks',landmarks.length);console.log('Church',buildings['way/588791993']);
