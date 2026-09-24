// V1.7 terrain frame, shared by the terrain scripts. Everything here is documented in docs/referentiel-terrain.md.
// Lambert-93 (EPSG:2154, RGF93 v1) is the metric reference; altitudes are NGF-IGN69 (EPSG:5720), in metres.
import proj4 from 'proj4';
export const LAMB93='+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs';
proj4.defs('EPSG:2154',LAMB93);
// WGS84 / CRS84 longitude-latitude (the project's GeoJSON) ↔ Lambert-93. RGF93 v1 and WGS84 are taken as identical (sub-metre).
export const toL93=lonlat=>proj4('EPSG:4326','EPSG:2154',[lonlat[0],lonlat[1]]);
export const fromL93=en=>proj4('EPSG:2154','EPSG:4326',[en[0],en[1]]);
// Terrain grid: nodes at whole Lambert-93 metres. Extent = commune bounding box centred, margin ≥ 500 m on every side,
// sized 254·k + 1 nodes per axis so that an Unreal Landscape (127 quads/section, 2×2 sections/component) fits at exactly 1 m.
export const QUADS_PER_COMPONENT=254,MIN_MARGIN_M=500;
export const TERRAIN_GRID={crs:'EPSG:2154',vertical:'NGF-IGN69 (EPSG:5720)',west:755390,north:6826372,step:1,cols:6097,rows:6859};
TERRAIN_GRID.east=TERRAIN_GRID.west+(TERRAIN_GRID.cols-1)*TERRAIN_GRID.step;TERRAIN_GRID.south=TERRAIN_GRID.north-(TERRAIN_GRID.rows-1)*TERRAIN_GRID.step;
// Common origin of every Maizières layer in Unreal (buildings, roads, railway, vegetation, POI): the project origin
// (3.7890245, 48.5097657) projected to Lambert-93 and rounded to the metre, so that it lies on a terrain node.
export const UNREAL_ORIGIN={crs:'EPSG:2154',E:758278,N:6823571,H:0,verticalDatum:'NGF-IGN69',sourceLonLat:[3.7890245,48.5097657]};
// Real (Lambert-93 metres, NGF-IGN69 metres) → Unreal (centimetres, X east, Y south, Z up; left-handed, no mirroring).
export const toUnreal=([E,N,H])=>[(E-UNREAL_ORIGIN.E)*100,-(N-UNREAL_ORIGIN.N)*100,(H-UNREAL_ORIGIN.H)*100];
export const fromUnreal=([X,Y,Z])=>[UNREAL_ORIGIN.E+X/100,UNREAL_ORIGIN.N-Y/100,UNREAL_ORIGIN.H+Z/100];
// LiDAR HD MNT tiles: 1 km, 0.5 m pixels, pixel centres on whole and half metres. Tile "XXXX-YYYY" = west km, north km.
export const tileName=(x,y)=>`LHD_FXX_${String(x).padStart(4,'0')}_${y}_MNT_0M50_LAMB93_IGN69.tif`;
export function neededTiles(g=TERRAIN_GRID){const out=[];for(let y=Math.ceil(g.north/1000);y>=Math.ceil(g.south/1000);y--)for(let x=Math.floor(g.west/1000);x<=Math.floor(g.east/1000);x++)out.push({x,y,name:tileName(x,y)});return out;}
export const TILE_DIR='data-sources/terrain/lidar-hd-mnt',MANIFEST='data-sources/terrain/lidar-hd-mnt-manifest.json';
