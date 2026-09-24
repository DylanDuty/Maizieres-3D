import fs from 'node:fs';
import osmtogeojson from 'osmtogeojson';
const raw=JSON.parse(fs.readFileSync('.cache/osm.json','utf8').replace(/^\uFEFF/,''));
if(raw.remark) throw Error(raw.remark);
const source=fs.existsSync('.cache/source.json')?JSON.parse(fs.readFileSync('.cache/source.json','utf8')):{};
const boundary=JSON.parse(fs.readFileSync('public/data/commune.geojson','utf8'));
const geo=osmtogeojson(raw,{flatProperties:true});
const features=geo.features.filter(f=>f.geometry && !f.properties?.['@tainted']);
// Centred on the OSM settlement, with a fixed verified fallback inside the commune.
const place=features.find(f=>f.geometry.type==='Point' && f.properties.name==='Maizières-la-Grande-Paroisse');
const origin=place?.geometry.coordinates || [3.785,48.51];
const d={type:'FeatureCollection',metadata:{name:boundary.properties.nom,insee:'10220',origin,retrievedAt:source.retrievedAt||new Date().toISOString(),osmTimestamp:raw.osm3s?.timestamp_osm_base,source:source.endpoint||'https://overpass.private.coffee/api/interpreter',boundarySource:'https://geo.api.gouv.fr/communes/10220?format=geojson&geometry=contour',license:'ODbL 1.0',attribution:'© OpenStreetMap contributors'},features};
fs.writeFileSync('public/data/maizieres.geojson',JSON.stringify(d,(_,v)=>typeof v==='number'?Math.round(v*1e7)/1e7:v));
console.log(JSON.stringify({origin,features:features.length,buildings:features.filter(f=>f.properties.building).length,roads:features.filter(f=>f.properties.highway).length,rail:features.filter(f=>f.properties.railway).length,places:features.filter(f=>f.properties.name&&(f.properties.place||f.properties.amenity||f.properties.leisure)).map(f=>({name:f.properties.name,kind:f.properties.amenity||f.properties.place||f.properties.leisure,geo:f.geometry.type,coord:f.geometry.type==='Point'?f.geometry.coordinates:undefined}))},null,2));

