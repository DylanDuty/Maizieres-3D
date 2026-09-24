// Heuristic gap finder (no cadastre available): building frontage density along named streets of the commune.
// Low density flags a street for review; it does not prove missing buildings (fields, walls, woods also line streets).
import fs from 'node:fs';
import {projection,polygons,lines,bounds,insidePoly,area} from '../src/geo.js';
import {segmentDistance} from '../src/cartography.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const osm=read('public/data/maizieres.geojson'),ref=read('public/data/buildings.geojson'),commune=read('public/data/commune.geojson'),project=projection(osm.metadata.origin),border=polygons(commune,project);
const main=ref.features.map(f=>{const p=polygons(f,project)[0],b=bounds(p[0]);return {c:[(b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2],a:area(p[0]),light:f.properties.ign?.lightConstruction||f.properties.osm?.tags?.wall==='no',prov:f.properties.provenance};}).filter(b=>b.a>=40&&!b.light);
const streets=new Map();for(const f of osm.features)if(['residential','unclassified','tertiary','living_street','secondary','primary'].includes(f.properties.highway)&&f.properties.name)for(const l of lines(f,project)){const s=streets.get(f.properties.name)||{name:f.properties.name,lines:[],length:0};s.lines.push(l);for(let i=1;i<l.length;i++)s.length+=Math.hypot(l[i][0]-l[i-1][0],l[i][1]-l[i-1][1]);streets.set(f.properties.name,s);}
const out=[];for(const s of streets.values()){const mid=s.lines[0][Math.floor(s.lines[0].length/2)];if(!border.some(p=>insidePoly(mid,p)))continue;
 const near=main.filter(b=>s.lines.some(l=>l.some((p,i)=>i&&segmentDistance(b.c,l[i-1],p)<35)));
 out.push({street:s.name,lengthM:Math.round(s.length),mainBuildings:near.length,per100m:+(near.length/s.length*100).toFixed(2),recoveredInV15:near.filter(b=>b.prov==='ign').length});}
out.sort((a,b)=>a.per100m-b.per100m);
fs.writeFileSync('data-sources/street-density.json',JSON.stringify({note:'Bâtiments principaux (≥ 40 m², hors constructions légères) à moins de 35 m de l’axe, référentiel V1.5. Indicateur de revue, pas une preuve de manque.',streets:out},null,1)+'\n');
console.log(JSON.stringify(out.filter(s=>s.lengthM>=120).slice(0,15)));
