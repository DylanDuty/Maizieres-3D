// V2.0 check: the visible scene is an assembly of the frozen references (nothing rebuilt), its display files are faithful to them,
// the display terrain covers every object, places without geometry stay points, and the normal view keeps its performance budget.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {UNREAL_ORIGIN as O,toUnreal,fromL93} from './terrain-frame.mjs';
import {projection} from '../src/geo.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
const ok=m=>console.log('PASS '+m);
// 1. Frozen references: buildings V1.6.2, terrain V1.7, roads V1.8, rail V1.9, land cover V1.10, POI V1.11 + V1.11.1, Unreal origin.
const FROZEN={'public/data/buildings.geojson':'809f3af371719e2d3adfaa6e55a9d56235e4618e28e8a36595c85d501a4f3095',
 'public/data/roads.geojson':'e14c17b94cbe7a126516351add558b5860773c3e2803c04012a0221fe740194e','unreal/roads/road-splines.json':'0e461f899067eb4912964035bbd564070ab66fe415122ae5d2324dfe6414aadc',
 'data-sources/roads/roads-report.json':'4aa95211d90efc6b2a063bd95de649410b16828b3767c52955617b2e4e4376c6','public/data/rail.geojson':'ebc2298e50aabc2b1f692a05db7a48f2010b05b737c95cf3e01acef3a47b5103',
 'unreal/rail/rail-splines.json':'7a082376a4e871749ee7959f10e7daf5bd0d3aef5ffda90706dd0837c01eb73e','data-sources/rail/rail-report.json':'2b753c07a6b07e7059691f24c8a97d23bb1929ee7da6fcce55fbd4a9133866ab',
 'public/data/rail-land.geojson':'9e167248c204015fa941065ef6e098bfeafb8df0ca68420d6aea1bf6027bdce5','public/data/rail-diagnostic.json':'8cf29f353baa95736424232617a91a178edbf04a7d7e44192d8fd38847124a84',
 'public/data/landcover.geojson':'67076773d34ca3255a1d542a2890a3d4353700fbaca931b878ea1360b277fac4','public/data/landcover-diagnostic.json':'268b2534170cb237b76ecbb6558fc728736e3d12baaa12aeaae012051193ff10',
 'unreal/landcover/agricultural-polygons.json':'998e2f877c237ec543f55b8ca61c4605087cf3a21a75702952bce29418324a9b','unreal/landcover/artificial-surfaces.json':'539e61368f5cb8cc55c23b55a80718a68de919d7cee606961ff2bb53df79689d',
 'unreal/landcover/hedge-splines.json':'9950a1745a1323d711f64c1ade9596c955915c66e4e876146106af9749747a1d','unreal/landcover/water-lines.json':'5f0931467a8719120fd993efb2a787e556f62ebc75f78f5400e8ce73b19534c7',
 'unreal/landcover/water-polygons.json':'573982fb5c1aea012ee1c2294af83712b3b2d65fa3cf2849a4bd5a767df16001','unreal/landcover/woodland-polygons.json':'0bddb0e46e70566b35dc9a46fa6ae982fe0dd2570fd41f87a18075d81e6694f3',
 'data-sources/landcover/landcover-report.json':'8e4a894f4b687d23cc0e3aed227f968142113da157fb2669ddeb34dea3542374',
 // POI outputs as frozen by V1.11.1 (commit 79c50d9).
 'unreal/poi/poi.json':'a597c022657851698978707bfad95161da5ca2d060ce23207c68f1c53898036f','unreal/poi/areas.json':'64c4fa95ed4c24e897b53f923842274acfba972443608a2debf1c3324d368a91',
 'unreal/poi/landmarks.json':'35bdac01189706d4aa0a9484e19644201fda44ccbf83621685cf4d00d1584f8c','public/data/poi.json':'02522aa7e0574810057526a2bae2e08f25ad74a2d0704821bec6637357283611',
 'data-sources/poi/poi-report.json':'b50a02e3496c35bdc1eacfe372884a23525376e431b07b113d452d5a128f8ff2'};
for(const [f,h] of Object.entries(FROZEN))assert.equal(sha(fs.readFileSync(f)),h,'Référentiel gelé modifié : '+f);
const tref=read('unreal/terrain/terrain-reference.json');for(const f of tref.files.filter(f=>f.inGit))assert.equal(sha(fs.readFileSync(f.file)),f.sha256,'Terrain V1.7 modifié : '+f.file);
assert.deepEqual([O.E,O.N,O.H],[758278,6823571,0],'UNREAL_ORIGIN modifiée');assert.deepEqual(toUnreal([758279,6823570,1]),[100,100,100]);
ok(`1. ${Object.keys(FROZEN).length} référentiels gelés + ${tref.files.filter(f=>f.inGit).length} fichiers terrain V1.7 identiques, origine Unreal E0 758278 / N0 6823571`);
// 2. Bibles identical to the canonical archive.
const readme=fs.readFileSync('docs/bibles/README.md','utf8');let bibles=0;
for(const dir of fs.readdirSync('docs/bibles').filter(d=>d.startsWith('BIBLE_'))){const f=`docs/bibles/${dir}/source/`+fs.readdirSync(`docs/bibles/${dir}/source`)[0];assert(readme.includes(sha(fs.readFileSync(f))),'Bible modifiée : '+f);bibles++;}
assert(bibles>=6);ok(`2. ${bibles} Bibles identiques à l’archive`);
// 3. Buildings: 2 494 (2 265 in the commune), each with its V1.7 terrain elevation, all over the V2 display terrain.
const buildings=read('public/data/buildings.geojson').features,be=read('public/data/building-terrain-elevation.json'),S=read('public/data/v2-scene.json'),T=read('public/data/v2-terrain.json');
assert.equal(buildings.length,2494);assert.equal(buildings.filter(f=>f.properties.inCommune).length,2265);assert.equal(be.metadata.buildingsSha256,FROZEN['public/data/buildings.geojson']);
const project=projection(S.metadata.origin),X1=T.x0+(T.cols-1)*T.step,Z1=T.z0+(T.rows-1)*T.step,onGrid=([x,z])=>x>T.x0&&x<X1&&z>T.z0&&z<Z1;
for(const f of buildings){const b=be.buildings[f.properties.id];assert(b&&Number.isFinite(b.baseZ),'Altitude manquante : '+f.properties.id);assert(onGrid(project(fromL93(b.centroidL93))),'Bâtiment hors du terrain affiché : '+f.properties.id);}
ok('3. 2 494 bâtiments (2 265 dans la commune), altitude V1.7 pour chacun, tous sur le terrain affiché');
// 4. Display terrain: derived from the frozen V1.7 GeoTIFF, complete (no NoData), faithful to the 1 m grid, same yReference.
const bin=fs.readFileSync('public/data/v2-terrain.bin'),u=new Uint16Array(bin.buffer,bin.byteOffset,bin.length/2),old=read('public/data/terrain-threejs.json');
assert.equal(u.length,T.cols*T.rows);assert.equal(T.noData,0);assert(!u.includes(65535),'NoData dans le terrain V2');assert.equal(T.sourceSha256,tref.files.find(f=>f.file.endsWith('.tif')).sha256);
assert.equal(T.yReference,old.yReference);assert.equal(T.step,10);assert(T.vsGrid1m.rmse<.2&&T.vsGrid1m.max<2,'Terrain V2 trop éloigné de la grille 1 m');
let mn=Infinity,mx=-Infinity;for(const v of u){mn=Math.min(mn,v);mx=Math.max(mx,v);}const zmin=T.zBase+mn/100,zmax=T.zBase+mx/100;assert(zmin>60&&zmax<130,'Altitudes incohérentes');
assert(T.x0<=old.x0&&T.z0<=old.z0&&X1>=old.x0+(old.cols-1)*old.step&&Z1>=old.z0+(old.rows-1)*old.step,'Le terrain V2 doit couvrir la grille commune V1.7');
ok(`4. terrain affiché ${T.cols}×${T.rows} au pas de 10 m, sans NoData, ${zmin.toFixed(1)}–${zmax.toFixed(1)} m NGF, RMSE ${T.vsGrid1m.rmse} m / max ${T.vsGrid1m.max} m vs 1 m`);
// 5. Scene file built from the current frozen sources (hashes recorded at build time).
for(const [f,h] of Object.entries(S.metadata.sources))assert.equal(sha(fs.readFileSync(f)),h,'v2-scene.json à régénérer (source modifiée) : '+f);
assert.equal(S.metadata.yReference,T.yReference);assert.deepEqual(S.metadata.origin,read('public/data/maizieres.geojson').metadata.origin);
ok(`5. v2-scene.json issu des ${Object.keys(S.metadata.sources).length} sources gelées actuelles`);
// 6. Roads V1.8: every spline, 7 categories, reference widths, corrected (bridge) profiles kept within the display tolerance.
const RS=read('unreal/roads/road-splines.json');assert.equal(S.roads.length,RS.splines.length);assert.equal(S.roads.length,1585);
const cats=new Set(S.roads.map(r=>r.c)),refCats=Object.keys(read('data-sources/roads/roads-report.json').totals.countByCategory);assert.deepEqual([...cats].sort(),[...refCats].sort(),'Classes de voies V1.8');
// The 167 km of paths (chemin carrossable, chemin rural, sentier) never get the paved edge strip.
const PATHS=['chemin_carrossable','chemin_rural','sentier'],paved=(fs.readFileSync('src/v2-scene.js','utf8').match(/const PAVED=new Set\((\[[^\]]*\])\)/)||[])[1];
assert(paved&&PATHS.every(c=>!paved.includes(`'${c}'`)),'Chemins et sentiers jamais revêtus');
const segDist=(p,a,b)=>{let ab=0,ap=0;for(let k=0;k<3;k++){ab+=(b[k]-a[k])**2;ap+=(p[k]-a[k])*(b[k]-a[k]);}const t=ab?Math.max(0,Math.min(1,ap/ab)):0;let d=0;for(let k=0;k<3;k++)d+=(p[k]-a[k]-t*(b[k]-a[k]))**2;return Math.sqrt(d);};
let worst=0;const byId=new Map(RS.splines.map(s=>[s.id,s]));
for(const r of S.roads){const s=byId.get(r.id);assert(s,'Voie inconnue : '+r.id);assert.equal(r.w,s.width);assert.equal(r.c,s.category);assert.equal(r.b,s.structure&&s.structure!=='sol'?1:0);
 const q=[];for(let i=0;i<r.p.length;i+=3)q.push([r.p[i],r.p[i+1],r.p[i+2]]);
 for(const p of s.pointsL93){const [x,z]=project(fromL93([p[0],p[1]])),pt=[x,z,p[2]-S.metadata.yReference];let d=Infinity;for(let i=1;i<q.length;i++)d=Math.min(d,segDist(pt,q[i-1],q[i]));worst=Math.max(worst,d);}}
assert(worst<.3,'Simplification des voies trop forte : '+worst);
ok(`6. ${S.roads.length} voies V1.8, ${cats.size} catégories (dont ${S.roads.filter(r=>PATHS.includes(r.c)).length} chemins et sentiers non revêtus), largeurs de référence, ${S.roads.filter(r=>r.b).length} voies d’ouvrage, écart d’affichage max ${worst.toFixed(2)} m`);
// 7. Rail V1.9: every track, level crossings and the rail bridge; no sleepers are instanced (display only).
const RL=read('unreal/rail/rail-splines.json'),rrep=read('data-sources/rail/rail-report.json');
assert.equal(S.rail.length,RL.splines.length);assert.equal(S.rail.length,25);assert.equal(S.levelCrossings.length,rrep.levelCrossings.length);assert.equal(S.railBridges.length,rrep.structures.bridges.length);
assert.equal(S.rail.filter(t=>/^voie principale/.test(t.label)).length,2,'2 voies principales attendues');
const v2src=fs.readFileSync('src/v2-scene.js','utf8');assert(!/sleeper|traverse/i.test(v2src.replace(/\/\/.*$/gm,'')),'Aucune traverse ne doit être instanciée');
ok(`7. ${S.rail.length} voies ferrées (2 principales), ${S.levelCrossings.length} passages à niveau, ${S.railBridges.length} pont ferroviaire, pas de traverses`);
// 8. Land cover V1.10: parcels, woods, hedges, water (permanent / intermittent), artificial surfaces, all present.
const LC=f=>read('unreal/landcover/'+f);
assert.equal(S.agriculture.length,LC('agricultural-polygons.json').objects.length);assert.equal(S.agriculture.length,560);
assert.equal(S.woodland.length,LC('woodland-polygons.json').objects.length);assert.equal(S.woodland.length,253);
assert.equal(S.hedges.length,LC('hedge-splines.json').hedges.length);assert.equal(S.hedges.length,378);assert.equal(S.hedgePolygons.length,LC('woodland-polygons.json').hedgePolygons.length);
assert.equal(S.water.length,LC('water-polygons.json').objects.length);assert.equal(S.waterLines.length,LC('water-lines.json').lines.filter(l=>l.position!=='souterrain').length);
assert(S.waterLines.some(l=>l.perm)&&S.waterLines.some(l=>!l.perm),'Eau permanente et intermittente à distinguer');
assert.equal(S.artificial.length,LC('artificial-surfaces.json').objects.length);
for(const k of ['agriculture','woodland','hedgePolygons','water','artificial'])for(const o of S[k])assert(o.r.length&&o.r.every(p=>p.length&&p.every(r=>r.length>=6)),'Polygone vide : '+o.id);
ok(`8. ${S.agriculture.length} parcelles, ${S.woodland.length} bois, ${S.hedges.length} haies + ${S.hedgePolygons.length} polygones, ${S.water.length} surfaces et ${S.waterLines.length} lignes d’eau, ${S.artificial.length} surfaces artificielles`);
// 9. POI: every displayed place has a position; only current landmarks are labelled; no geometry is created for a place.
const P=read('public/data/poi.json').pois;assert(P.every(p=>Array.isArray(p.lonlat)&&p.lonlat.length===2),'Lieu sans position dans poi.json');
const lm=P.filter(p=>p.landmark===1||p.landmark===2);assert.equal(lm.filter(p=>p.landmark===1).length,3);assert(lm.every(p=>p.status==='actuel'&&p.coh==='current'),'Landmark historique affiché comme actuel');
assert(!('poi' in S)&&!('places' in S),'Aucune géométrie de lieu ne doit être créée dans la scène');
ok(`9. ${P.length} lieux positionnés, ${lm.length} landmarks P1/P2 actuels étiquetés, aucune géométrie inventée`);
// 10. Interface: V2 modules wired in the normal view, diagnostics kept, search / quick views / legend, source only in technical mode.
const main=fs.readFileSync('src/main.js','utf8'),ui=fs.readFileSync('src/v2-ui.js','utf8');
for(const s of ["from './v2-scene.js'","from './v2-ui.js'","'v2-terrain'","installSearch(","installViews(","installLegend(","installPerfHud("])assert(main.includes(s),'main.js : '+s);
for(const d of ['provenance','validation','terrain','roads','rail','landcover','poi'])assert(main.includes(`'${d}'`),'Diagnostic perdu : '+d);
assert(/source:technical\?/.test(ui)&&/const v2Mode=!diagnostic/.test(main),'La source ne doit apparaître qu’en mode technique');
for(const v of ['Vue générale','Centre-bourg','Poussey','Les Granges','Ferroviaire','Parc de l’Aérodrome'])assert(main.includes(v),'Vue rapide manquante : '+v);
ok('10. vues V2 branchées, 7 diagnostics conservés, recherche, 6 vues rapides, légende, HUD technique, source réservée au mode diagnostic');
// 11. Quality modes: Fluide by default, Élevée and Très fluide; DPR limits; shadows only in Élevée.
const {qualitySettings,QUALITY_ORDER}=await import('../src/quality.js');assert.deepEqual(QUALITY_ORDER,['very-fluid','fluid','high']);
const q=m=>qualitySettings(m,{dpr:2,cores:8,memory:8});
assert(q('fluid').pixelRatio<=1.25&&q('very-fluid').pixelRatio<=.8&&q('high').pixelRatio<=1.5);
assert(/const shadows=mode==='high'/.test(v2src),'Ombres réservées au mode Élevée');assert(/'very-fluid':2048,fluid:3072,high:4096/.test(v2src));
ok('11. modes Très fluide / Fluide / Élevée, DPR ≤ 0,8 / 1,25 / 1,5, ombres uniquement en Élevée');
// 12. Performance budget of the normal view (files and geometry).
const kb=f=>fs.statSync(f).size/1024,tris=(T.cols-1)*(T.rows-1)*2;
assert(kb('public/data/v2-scene.json')<2048&&kb('public/data/v2-terrain.bin')<1024,'Fichiers V2 trop lourds');assert(tris<900000,'Terrain trop dense');
assert(/InstancedMesh/.test(v2src)&&/CanvasTexture/.test(v2src),'Instanciation / texture drapée attendues');
ok(`12. budget : v2-scene ${Math.round(kb('public/data/v2-scene.json'))} Ko, terrain ${Math.round(kb('public/data/v2-terrain.bin'))} Ko, ${tris.toLocaleString('fr-FR')} triangles de relief`);
console.log('check:v2 — 12 contrôles PASS');
