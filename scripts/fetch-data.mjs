import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('.cache', { recursive: true });
await mkdir('public/data', { recursive: true });
const boundaryURL = 'https://geo.api.gouv.fr/communes/10220?fields=nom,code,centre,contour&format=geojson&geometry=contour';
const response = await fetch(boundaryURL);
if (!response.ok) throw new Error(`Contour administratif : HTTP ${response.status}`);
const boundary = await response.json();
if (boundary.properties.code !== '10220' || !['Polygon','MultiPolygon'].includes(boundary.geometry.type)) throw new Error('Commune ou contour incorrect');

const coordinates = boundary.geometry.coordinates.flat(boundary.geometry.type === 'Polygon' ? 1 : 2);
const lons = coordinates.map(p=>p[0]), lats=coordinates.map(p=>p[1]);
const bbox=[Math.min(...lats)-.001, Math.min(...lons)-.0015, Math.max(...lats)+.001, Math.max(...lons)+.0015];
console.log('Commune identifiée :',boundary.properties.nom,'10220. Emprise :',bbox);
const query=`[out:json][timeout:120];(nwr[building](${bbox});way[highway](${bbox});way[railway](${bbox});nwr[landuse](${bbox});nwr[natural](${bbox});nwr[waterway](${bbox});nwr[leisure](${bbox});nwr[amenity](${bbox});nwr[place](${bbox});way[barrier=hedge](${bbox}););out body;>;out skel qt;`;
await writeFile('.cache/query.overpass',query);
let osm, endpoint;
for (endpoint of ['https://overpass.private.coffee/api/interpreter','https://overpass-api.de/api/interpreter']) {
  try {
    console.log('Téléchargement OpenStreetMap :',endpoint);
    const r=await fetch(endpoint+'?'+new URLSearchParams({data:query}),{signal:AbortSignal.timeout(180000)});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    osm=await r.json();
    if (osm.remark || !osm.elements?.length) throw new Error(osm.remark || 'Réponse vide');
    break;
  } catch(e) { console.error(e.message); }
}
if (!osm?.elements?.length || osm.remark) throw new Error('Données indisponibles ; le jeu local existant est conservé.');
await writeFile('public/data/commune.geojson', JSON.stringify(boundary));
await writeFile('.cache/osm.json',JSON.stringify(osm));
await writeFile('.cache/source.json',JSON.stringify({boundaryURL,endpoint,bbox,retrievedAt:new Date().toISOString(),osmTimestamp:osm.osm3s?.timestamp_osm_base}));
console.log(osm.elements.length,'objets téléchargés. Exécuter npm run data:prepare.');


