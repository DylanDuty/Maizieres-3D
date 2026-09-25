// V1.11 reference of identifiable places (POI), sectors / lieux-dits and toponymy of Maizières-la-Grande-Paroisse.
// Built from local snapshots only (npm run data:poi): BAN, BAN PLUS address-building links, BD TOPO (zones d'activité,
// toponymie, lieux-dits, zones d'habitation, constructions ponctuelles), OSM project snapshot, and the curated Bible
// extract data-sources/poi/bible-places-v1.11.json (every text is an exact quote, verified here and by check:poi).
// Frozen references (buildings V1.6.2, terrain V1.7, roads V1.8, rail V1.9, land cover V1.10, UNREAL_ORIGIN) are read only.
// Rule: a historical or remembered place is never presented as current; a name without a reliable location gets no geometry.
// Outputs: public/data/poi.json, unreal/poi/poi.json, unreal/poi/areas.json, unreal/poi/landmarks.json,
// data-sources/poi/poi-report.json.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fromArrayBuffer} from 'geotiff';
import {TERRAIN_GRID as G,UNREAL_ORIGIN as O,toL93,fromL93,toUnreal} from './terrain-frame.mjs';
import {polygons,lines,insidePoly} from '../src/geo.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),r2=v=>Math.round(v*100)/100;
const D='data-sources/poi',J=n=>read(`${D}/${n}.geojson`);

// ---------- Frozen references ----------
const tb=fs.readFileSync('unreal/terrain/maizieres-mnt-lidarhd-1m-lamb93-ign69.tif'),[grid]=await (await (await fromArrayBuffer(tb.buffer.slice(tb.byteOffset,tb.byteOffset+tb.length))).getImage()).readRasters();
const terrainZ=(E,N)=>{const i=E-G.west,j=G.north-N,i0=Math.floor(i),j0=Math.floor(j);if(i0<0||j0<0||i0>=G.cols-1||j0>=G.rows-1)return NaN;const fx=i-i0,fy=j-j0,k=j0*G.cols+i0;return (grid[k]*(1-fx)+grid[k+1]*fx)*(1-fy)+(grid[k+G.cols]*(1-fx)+grid[k+G.cols+1]*fx)*fy;};
const inExtent=([E,N])=>E>=G.west&&E<=G.east&&N>=G.south&&N<=G.north;
const commune=read('public/data/commune.geojson'),communePolys=(commune.features||[commune]).flatMap(f=>polygons(f,toL93));
const inCommune=p=>communePolys.some(poly=>insidePoly(p,poly));
const ringArea=r=>{let a=0;for(let i=0,j=r.length-1;i<r.length;j=i++)a+=(r[j][0]*r[i][1]-r[i][0]*r[j][1]);return a/2;};
const centroid=poly=>{const r=poly[0];let a=0,x=0,y=0;for(let i=0,j=r.length-1;i<r.length;j=i++){const c=r[j][0]*r[i][1]-r[i][0]*r[j][1];a+=c;x+=(r[j][0]+r[i][0])*c;y+=(r[j][1]+r[i][1])*c;}return a?[x/(3*a),y/(3*a)]:r[0];};
const mpCentroid=mp=>{const big=mp.reduce((m,p)=>Math.abs(ringArea(p[0]))>Math.abs(ringArea(m[0]))?p:m,mp[0]);const c=centroid(big);return insidePoly(c,big)?c:big[0][0];};
const mpArea=mp=>mp.reduce((s,p)=>s+Math.abs(ringArea(p[0]))-p.slice(1).reduce((h,r)=>h+Math.abs(ringArea(r)),0),0);

// Text normalisation for name comparison (accents, case, hyphens, apostrophes, articles, common abbreviations).
export const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[’'`\-_.,]/g,' ').replace(/\b(le|la|les|l|du|de|des|d|au|aux|a|en|sur)\b/g,' ').replace(/\s+/g,' ').trim();
const ABBR={r:'rue',av:'avenue',ave:'avenue',bd:'boulevard',che:'chemin',chem:'chemin',imp:'impasse',pl:'place',rte:'route',all:'allee',sq:'square',st:'saint',ste:'sainte',gal:'general',dr:'docteur',zi:'zone industrielle'};
export const normStreet=s=>norm(s).split(' ').map(w=>ABBR[w]||w).join(' ');
const nameKey=s=>norm(String(s).replace(/\([^)]*\)/g,' ').split(/ \/ | — /)[0]).replace(/^lotissement /,'');
// Same name with small spelling differences: same number of words, each differing word ≤ 2 edits and never a cardinal point.
const CARD=new Set(['nord','sud','est','ouest']);
const similar=(a,b)=>{if(a===b)return 0;if(a.replace(/ /g,'')===b.replace(/ /g,''))return 1;const A=a.split(' '),B=b.split(' ');if(A.length!==B.length||a.length<8)return 99;let t=0;for(let i=0;i<A.length;i++){if(A[i]===B[i])continue;if(CARD.has(A[i])||CARD.has(B[i]))return 99;const d=lev(A[i],B[i]);if(d>2)return 99;t+=d;}return t<=2?t:99;};
const lev=(a,b)=>{const m=a.length,n=b.length,d=Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);for(let j=1;j<=n;j++)d[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n];};

// ---------- Buildings V1.6.2 (read only) ----------
const buildings=read('public/data/buildings.geojson').features.map(f=>{const mp=polygons(f,toL93);return {id:f.id,f,mp,c:mpCentroid(mp),area:mpArea(mp),inCommune:f.properties.inCommune,osmIds:f.properties.osm?.ids||[],osmNames:f.properties.osm?.names||[],usage:f.properties.ign?.usage1||null,nature:f.properties.ign?.nature||null};});
const buildingById=new Map(buildings.map(b=>[b.id,b]));
const buildingAt=p=>buildings.filter(b=>Math.hypot(b.c[0]-p[0],b.c[1]-p[1])<150&&b.mp.some(poly=>insidePoly(p,poly)));
const buildingsByOsm=id=>buildings.filter(b=>b.osmIds.includes(id));
const elev=read('public/data/building-terrain-elevation.json');

// ---------- Roads V1.8 (read only): road_id = nearest named segment of the addressed street ----------
const roads=read('public/data/roads.geojson').features.map(f=>({id:f.id,p:f.properties,ls:lines(f,toL93),names:[f.properties.name,...(f.properties.nameBan||[]),f.properties.nameOsm,f.properties.nameBible].filter(Boolean).map(normStreet)}));
const segDist=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy,t=L?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
const roadDist=(p,r)=>Math.min(...r.ls.flatMap(l=>l.slice(1).map((q,i)=>segDist(p,l[i],q))));
function roadFor(p,street){const key=street?normStreet(street):null;let best=null;
 for(const r of roads){if(key&&!r.names.includes(key))continue;const d=roadDist(p,r);if(d<(key?250:25)&&(!best||d<best.d))best={id:r.id,name:r.p.name,d:r2(d),by:key?'rue de l’adresse':'segment le plus proche (< 25 m)'};}
 return best;}

// ---------- BAN (addresses of the commune) and BAN PLUS address → building links ----------
const ban=J('ban-adresses').features.filter(f=>f.properties.code_insee==='10220').map(f=>({id:f.properties.id,num:f.properties.numero,rep:f.properties.rep||'',street:f.properties.nom_voie,key:normStreet(f.properties.nom_voie),p:[+f.properties.x,+f.properties.y],pos:f.properties.type_position}));
const banLinks=new Map();for(const f of J('banplus-lien-adresse-bati').features){const {id_adr,id_bat,type_lien}=f.properties;if(!banLinks.has(id_adr))banLinks.set(id_adr,[]);banLinks.get(id_adr).push({id_bat,type_lien});}
// "15 rue Pasteur" → BAN address; the number and the street must both match (no interpolation, no guess).
function geocode(address){if(!address)return null;const m=String(address).match(/^\s*(\d+)\s*(bis|ter)?\s*,?\s*(.+?)\s*(\d{5}.*)?$/i);if(!m)return null;
 const key=normStreet(m[3].replace(/\b(maizieres la grande paroisse)\b/i,'')),hit=ban.find(a=>a.num===m[1]&&a.key===key&&(!m[2]||a.rep.toLowerCase()===m[2].toLowerCase()));return hit||null;}
function buildingForAddress(a){const links=(banLinks.get(a.id)||[]).filter(l=>buildingById.has(l.id_bat));if(links.length){const bs=links.map(l=>buildingById.get(l.id_bat)).sort((x,y)=>y.area-x.area);return {ids:bs.map(b=>b.id),by:'BAN PLUS lien adresse – bâtiment ('+[...new Set(links.map(l=>l.type_lien))].join(', ')+')'};}
 const inside=buildingAt(a.p);return inside.length?{ids:inside.map(b=>b.id),by:'point BAN dans l’empreinte'}:null;}

// ---------- POI records ----------
// status: actuel | ancien | historique | disparu | incertain ; current_or_historical: current | historical | uncertain.
// geometryKind: officielle (géométrie d'une base officielle), documentaire (position déduite d'une adresse ou d'un texte
// documenté), approximative (position d'un point de toponymie ± précision), ponctuelle (un point seulement, sans limite).
const CURRENT={actuel:'current',ancien:'historical',historique:'historical',disparu:'historical',incertain:'uncertain'};
const pois=[],byKey=new Map();
function mk(o){const r={id:o.id,name:o.name,type:o.type,category:o.category,status:o.status,current_or_historical:CURRENT[o.status],
  displayCurrent:false,geometryKind:o.geometryKind||null,anchor:o.anchor||null,positionSource:o.positionSource||null,precisionM:o.precisionM??null,
  building_id:null,building_ids:[],buildingLink:null,road_id:null,roadLink:null,address:o.address||null,ban_id:o.ban_id||null,
  sources:o.sources||[],confidence:o.confidence,inCommune:null,variants:o.variants||[],notes:o.notes||[],contents:o.contents||[],
  visual_priority:o.visual_priority||3,unreal_asset_priority:null,landmark_priority:null,landmarkReason:null,areaId:o.areaId||null};
 pois.push(r);if(o.key)byKey.set(o.key,r);return r;}
const src=(source,ref,extra={})=>({source,ref,...extra});

// BD TOPO zones d'activité ou d'intérêt (snapshot V1.10 relu) : equipment and activity perimeters of the commune.
const ZA_TYPE={Mairie:['mairie','equipement_public'],'Enseignement primaire':['ecole','equipement_public'],'Culte chrétien':['eglise','patrimoine'],Stade:['stade','equipement_sportif'],'Autre équipement sportif':['equipement_sportif','equipement_sportif'],
 'Salle de spectacle ou conférence':['salle','equipement_public'],'Caserne de pompiers':['secours','equipement_public'],Monument:['monument','patrimoine'],'Espace public':['espace_public','equipement_public'],
 "Structure d'accueil pour personnes handicapées":['etablissement_medico_social','equipement_public'],"Aire d'accueil des gens du voyage":['aire_accueil','equipement_public'],'Station de pompage':['station_pompage','infrastructure'],
 'Zone industrielle':['zone_activite','zone_activite'],'Divers industriel':['site_industriel','commerce_entreprise'],'Divers commercial':['zone_activite','zone_activite'],'Centrale électrique':['centrale_electrique','infrastructure'],
 'Enceinte militaire':['enceinte_militaire','infrastructure'],'Musée':['musee','equipement_public'],'Sports mécaniques':['equipement_sportif','equipement_sportif']};
const communeArea=(mp)=>{let a=0;for(const poly of mp)for(let k=0;k<poly[0].length;k+=Math.max(1,Math.floor(poly[0].length/40)))if(inCommune(poly[0][k]))a++;return a;};
const zones=read('data-sources/landcover/bdtopo-zone-d-activite.geojson').features.map(f=>({f,p:f.properties,mp:polygons(f,toL93)}));
const areas=[];
// A perimeter whose centre falls outside the terrain extent is anchored on its vertex inside the commune closest to that centre.
const anchorInside=(mp,c)=>{if(inExtent(c))return [c,null];const v=mp.flatMap(p=>p[0]).filter(q=>inExtent(q)&&inCommune(q)).sort((a,b)=>Math.hypot(a[0]-c[0],a[1]-c[1])-Math.hypot(b[0]-c[0],b[1]-c[1]))[0];return v?[v,'sommet du périmètre dans la commune (centre hors emprise du terrain)']:[c,null];};
for(const z of zones){const p=z.p,[type,category]=ZA_TYPE[p.nature]||['autre','equipement_public'],[c,cNote]=anchorInside(z.mp,mpCentroid(z.mp)),touches=p.insee_commune==='10220'||inCommune(c)||(!p.fictif&&communeArea(z.mp)>0);if(!touches)continue;
 const name=p.toponyme||(p.nature_detaillee||p.nature),perimeter=!p.fictif&&mpArea(z.mp)>2000;
 const r=mk({key:'bdtopo:'+p.cleabs,id:'poi:bdtopo:'+p.cleabs,name,type,category,status:p.etat_de_l_objet==='En service'?'actuel':'incertain',geometryKind:p.fictif?'ponctuelle':'officielle',anchor:c,precisionM:p.precision_planimetrique,
  positionSource:p.fictif?'BD TOPO zone d’activité (géométrie fictive : point)':'BD TOPO zone d’activité ('+(cNote||'centre du périmètre')+')',confidence:p.statut_du_toponyme==='Validé'||!p.toponyme?'A':'A',
  sources:[src('BD TOPO zone_d_activite_ou_d_interet',p.cleabs,{nature:p.nature,natureDetaillee:p.nature_detaillee,toponymeStatut:p.statut_du_toponyme,identifiantsSources:p.identifiants_sources||null,adressePostale:p.adresse_postale||null})],
  notes:p.toponyme?[]:['sans toponyme BD TOPO : nom = nature']});
 if(perimeter){const a={id:'area:bdtopo:'+p.cleabs,name,type:category==='zone_activite'?'zone_activite':type,geometryKind:'officielle',source:'BD TOPO zone_d_activite_ou_d_interet '+p.cleabs,confidence:'A',mp:z.mp,poiId:r.id};areas.push(a);r.areaId=a.id;}}

// BD TOPO constructions ponctuelles (clocher, antennes, éoliennes…) inside the commune.
for(const f of J('bdtopo-construction-ponctuelle').features){const p=f.properties,q=toL93(f.geometry.coordinates);if(!inCommune(q))continue;
 const T={Clocher:['clocher','patrimoine'],Antenne:['antenne','infrastructure'],Eolienne:['eolienne','infrastructure'],Transformateur:['transformateur','infrastructure']}[p.nature]||['construction','infrastructure'];
 mk({key:'bdtopo:'+p.cleabs,id:'poi:bdtopo:'+p.cleabs,name:p.toponyme||p.nature_detaillee||p.nature,type:T[0],category:T[1],status:p.etat_de_l_objet==='En service'?'actuel':'incertain',geometryKind:'officielle',anchor:q,precisionM:p.precision_planimetrique,positionSource:'BD TOPO construction ponctuelle',confidence:'A',sources:[src('BD TOPO construction_ponctuelle',p.cleabs,{nature:p.nature})],visual_priority:T[0]==='clocher'?1:3});}

// OSM (project snapshot 31/05/2026): named or typed amenities, shops, leisure, places. OSM is a complement: B at best.
const osm=read('public/data/maizieres.geojson');
const OSM_TYPE=t=>t.amenity==='townhall'?['mairie','equipement_public']:t.amenity==='school'?['ecole','equipement_public']:t.amenity==='community_centre'?['salle','equipement_public']:t.amenity==='place_of_worship'?['eglise','patrimoine']
 :t.amenity==='pharmacy'?['pharmacie','sante']:t.amenity==='post_office'?['poste','equipement_public']:/restaurant|fast_food|bar|cafe/.test(t.amenity||'')?['restaurant_cafe','commerce_entreprise']:t.amenity==='fuel'?['station_service','commerce_entreprise']
 :t.shop?['commerce','commerce_entreprise']:t.leisure==='pitch'||t.leisure==='sports_centre'?['equipement_sportif','equipement_sportif']:t.leisure==='park'?['parc','equipement_public']:t.power==='plant'?['centrale_electrique','infrastructure']
 :t.landuse==='military'?['enceinte_militaire','infrastructure']:t.landuse==='commercial'||t.landuse==='industrial'?['zone_activite','zone_activite']:t.building==='industrial'?['site_industriel','commerce_entreprise']:t.building==='retail'?['commerce','commerce_entreprise']:null;
for(const f of osm.features){const t=f.properties;if(t.highway||t.railway||t.waterway||t.natural||/parking|recycling|charging_station|car_wash/.test(t.amenity||'')||t.leisure==='swimming_pool'||t.man_made==='storage_tank')continue;
 if(t.place){if(!t.name)continue;const q=f.geometry.type==='Point'?toL93(f.geometry.coordinates):mpCentroid(polygons(f,toL93));if(!inCommune(q))continue;
  const [type,category]=t.place==='village'?['village','secteur']:t.place==='hamlet'?['hameau','secteur']:t.place==='isolated_dwelling'?['ecart','lieu_dit']:['lieu_dit','lieu_dit'];
  mk({key:'osm:'+f.id,id:'poi:osm:'+f.id,name:t.name,type,category,status:'actuel',geometryKind:'ponctuelle',anchor:q,positionSource:'OSM place='+t.place+' (point)',confidence:'B',sources:[src('OSM',f.id,{place:t.place})]});continue;}
 const T=OSM_TYPE(t);if(!T||(!t.name&&!['townhall','school'].includes(t.amenity)))continue;let q,mp=null;
 if(f.geometry.type==='Point')q=toL93(f.geometry.coordinates);else{mp=polygons(f,toL93);if(!mp.length)continue;q=mpCentroid(mp);}
 if(!inCommune(q)&&!(mp&&communeArea(mp)>0))continue;
 mk({key:'osm:'+f.id,id:'poi:osm:'+f.id,name:t.name||null,type:T[0],category:T[1],status:'incertain',geometryKind:mp?'ponctuelle':'ponctuelle',anchor:q,positionSource:mp?'OSM (centre du polygone)':'OSM (point)',confidence:'C',address:t['addr:street']?[t['addr:housenumber'],t['addr:street']].filter(Boolean).join(' '):null,
  sources:[src('OSM',f.id,{tags:Object.fromEntries(Object.entries(t).filter(([k])=>/^(amenity|shop|leisure|sport|landuse|power|building|name|brand|operator|healthcare|religion|addr:.*)$/.test(k)))})],
  notes:['OSM seul : présence actuelle à confirmer par une source officielle ou une Bible']});}

// BD TOPO lieux-dits non habités and zones d'habitation of the commune (toponymy of places).
for(const f of J('bdtopo-lieu-dit-non-habite').features){const p=f.properties;const q=toL93(f.geometry.coordinates);if(!inExtent(q))continue;
 mk({key:'bdtopo:'+p.cleabs,id:'poi:bdtopo:'+p.cleabs,name:p.toponyme,type:'lieu_dit',category:'lieu_dit',status:'actuel',geometryKind:'approximative',anchor:q,precisionM:p.precision_planimetrique,positionSource:'BD TOPO lieu-dit non habité (point de toponyme, ± '+p.precision_planimetrique+' m)',confidence:p.statut_du_toponyme==='Validé'?'A':'B',
  sources:[src('BD TOPO lieu_dit_non_habite',p.cleabs,{nature:p.nature,toponymeStatut:p.statut_du_toponyme,identifiantVoieBan:p.identifiant_voie_ban||null})]});}
for(const f of J('bdtopo-zone-d-habitation').features){const p=f.properties;if(p.insee_commune!=='10220')continue;const mp=polygons(f,toL93),q=mpCentroid(mp);
 const type=p.nature==='Quartier'?'quartier':p.toponyme==='Maizières-la-Grande-Paroisse'?'bourg':'lieu_dit_habite',category=p.nature==='Quartier'||type==='bourg'?'secteur':'lieu_dit';
 const r=mk({key:'bdtopo:'+p.cleabs,id:'poi:bdtopo:'+p.cleabs,name:p.toponyme,type,category,status:p.etat_de_l_objet==='En service'?'actuel':'incertain',geometryKind:p.fictif?'ponctuelle':'officielle',anchor:q,precisionM:p.precision_planimetrique,
  positionSource:p.fictif?'BD TOPO zone d’habitation fictive (point du toponyme ; aucune limite officielle)':'BD TOPO zone d’habitation (limite officielle de la zone bâtie)',confidence:p.statut_du_toponyme==='Validé'?'A':'B',
  sources:[src('BD TOPO zone_d_habitation',p.cleabs,{nature:p.nature,fictif:p.fictif,toponymeStatut:p.statut_du_toponyme})],visual_priority:category==='secteur'?1:3});
 if(!p.fictif){const a={id:'area:bdtopo:'+p.cleabs,name:p.toponyme,type:'zone_batie',geometryKind:'officielle',source:'BD TOPO zone_d_habitation '+p.cleabs,confidence:'A',mp,poiId:r.id};areas.push(a);r.areaId=a.id;}}

// ---------- Toponymy: streets (BAN, BD TOPO voie nommée, OSM, BIBLE_01 §4.1) ----------
// Official form = BAN (commune source). Nothing is renamed: every graphie is kept with its source; differences are reported.
const BIBLE_FILES={'01':'docs/bibles/BIBLE_01_CARTOGRAPHIE/source/MAIZIERES_LA_GRANDE_UCHRONIE_BIBLE_01_CARTOGRAPHIE_FINAL_V1.1.md','02':'docs/bibles/BIBLE_02_HISTOIRE/source/MAIZIERES_LA_GRANDE_UCHRONIE_BIBLE_02_HISTOIRE_V1.1.md',
 '03':'docs/bibles/BIBLE_03_PATRIMOINE/source/MAIZIERES_LA_GRANDE_UCHRONIE_BIBLE_03_PATRIMOINE_V1.0.md','04':'docs/bibles/BIBLE_04_VIE_LOCALE/source/MAIZIERES_LA_GRANDE_UCHRONIE_BIBLE_04_VIE_LOCALE_V1.0.md',
 '05':'docs/bibles/BIBLE_05_ASSOCIATIONS_COMMERCES/source/MAIZIERES_LA_GRANDE_UCHRONIE_BIBLE_05_ASSOCIATIONS_COMMERCES_V1.2_FINAL_AUDITEE_CLOTURE_2026-09-09.md','06':'docs/bibles/BIBLE_06_MEMOIRE_LOCALE/source/MAIZIERES_LA_GRANDE_UCHRONIE_BIBLE_06_MEMOIRE_LOCALE_V1.0_FINAL_CLOTURE_2026-09-09.md'};
const bibleText=Object.fromEntries(Object.entries(BIBLE_FILES).map(([k,p])=>[k,fs.readFileSync(p,'utf8')]));
const streetForms=new Map();const addForm=(name,source)=>{if(!name)return;const k=normStreet(name);if(!streetForms.has(k))streetForms.set(k,{key:k,forms:new Map()});const e=streetForms.get(k).forms;if(!e.has(name))e.set(name,new Set());e.get(name).add(source);};
for(const a of ban)addForm(a.street,'BAN');
for(const f of read('data-sources/roads/bdtopo-voie-nommee.geojson').features)if(f.properties.insee_commune==='10220')addForm(f.properties.nom_voie_ban,'BD TOPO voie nommée');
for(const f of osm.features){const t=f.properties;if(t.highway&&t.name&&lines(f,toL93).some(l=>l.some(inCommune)))addForm(t.name,'OSM');}
const bibleStreets=bibleText['01'].split('## 4.1')[1].split('## 4.2')[0].split('\n').filter(l=>l.startsWith('- ')).map(l=>l.slice(2).replace(/\*\*/g,'').split(' — ')[0].trim());
for(const n of bibleStreets)addForm(n,'BIBLE_01 §4.1');
const streetToponymy=[...streetForms.values()].map(e=>{const forms=[...e.forms].map(([name,s])=>({name,sources:[...s].sort()})),all=new Set(forms.flatMap(f=>f.sources));
 const official=forms.find(f=>f.sources.includes('BAN'))?.name||forms.find(f=>f.sources.includes('BD TOPO voie nommée'))?.name||null;
 return {key:e.key,official,forms,sources:[...all].sort(),status:official?(forms.length>1?'variante_typographique':'officiel'):all.has('BIBLE_01 §4.1')?(all.size===1?'bible_seule':'bible_et_osm_hors_ban'):'osm_seul'};});
// Near-identical keys (≤ 2 edits, same first word): spelling variants to report, never merged automatically.
const conflicts=[];const keys=streetToponymy.map(s=>s.key);
for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){const a=keys[i],b=keys[j];if(a.split(' ')[0]!==b.split(' ')[0]||Math.abs(a.length-b.length)>3)continue;const d=lev(a,b);if(d>0&&d<=2){const A=streetToponymy[i],B=streetToponymy[j];conflicts.push({kind:'variante_orthographique',a:{forms:A.forms},b:{forms:B.forms},editDistance:d,official:A.official||B.official||null});A.status=B.status='conflit_graphie';}}
// A form that is the word-prefix of an official one ("Rue Patris" / "Rue Patris de Breuil") is a truncated form, reported as a conflict.
for(const A of streetToponymy)if(!A.official)for(const B of streetToponymy)if(B.official&&B!==A&&B.key.startsWith(A.key+' ')){conflicts.push({kind:'forme_tronquee',a:{forms:A.forms},b:{forms:B.forms},official:B.official});A.status='conflit_graphie';}

// BD TOPO réservoirs (châteaux d'eau only), cimetières and terrains de sport of the commune (V1.10 snapshots, read only).
for(const [file,filter,T,label] of [['bdtopo-reservoir',p=>/Château d'eau/.test(p.nature),p=>['chateau_eau','infrastructure',"Château d'eau"],'BD TOPO réservoir'],['bdtopo-cimetiere',()=>true,p=>['cimetiere','equipement_public','Cimetière'],'BD TOPO cimetière'],
 ['bdtopo-terrain-de-sport',()=>true,p=>['terrain_de_sport','equipement_sportif',p.nature_detaillee||p.nature],'BD TOPO terrain de sport']])
 for(const f of read(`data-sources/landcover/${file}.geojson`).features){const p=f.properties;if(!filter(p))continue;const mp=polygons(f,toL93),q=mpCentroid(mp);if(!inCommune(q))continue;const [type,category,name]=T(p);
  mk({key:'bdtopo:'+p.cleabs,id:'poi:bdtopo:'+p.cleabs,name:p.toponyme||name,type,category,status:p.etat_de_l_objet&&p.etat_de_l_objet!=='En service'?'incertain':'actuel',geometryKind:'officielle',anchor:q,precisionM:p.precision_planimetrique,positionSource:label+' (centre de l’emprise)',confidence:'A',
   sources:[src(label,p.cleabs,{nature:p.nature,natureDetaillee:p.nature_detaillee||null,hauteurM:p.hauteur??null})],visual_priority:type==='chateau_eau'?2:3});}

// BD TOPO named bridges and level crossings (toponymy points) inside the commune: local landmarks.
const topo=new Map(J('bdtopo-toponymie').features.map(f=>[f.properties.cleabs_de_l_objet,f]));
for(const f of topo.values()){const p=f.properties;if(!['Pont','Passage à niveau'].includes(p.nature_de_l_objet))continue;const q=toL93(f.geometry.coordinates);if(!inCommune(q))continue;
 const name=p.graphie_du_toponyme.charAt(0).toUpperCase()+p.graphie_du_toponyme.slice(1);
 mk({key:'bdtopo:'+p.cleabs_de_l_objet,id:'poi:bdtopo:'+p.cleabs_de_l_objet,name,type:p.nature_de_l_objet==='Pont'?'pont':'passage_a_niveau',category:'repere_local',status:'actuel',geometryKind:'ponctuelle',anchor:q,positionSource:'BD TOPO toponymie (point du toponyme)',confidence:p.statut_du_toponyme==='Validé'?'A':'B',
  sources:[src('BD TOPO toponymie',p.cleabs_de_l_objet,{classe:p.classe_de_l_objet,toponymeStatut:p.statut_du_toponyme,sourceDuToponyme:p.source_du_toponyme})]});}

// ---------- Bible extracts (exact quotes) and curation ----------
const EXTRACT=read(`${D}/bible-places-v1.11.json`),CUR=read(`${D}/poi-curation-v1.11.json`);
const extract=new Map(EXTRACT.places.map(p=>[p.id,p]));
for(const e of [...EXTRACT.places,...EXTRACT.toponymy,...EXTRACT.nameHistory])if(!bibleText[e.bible].includes(e.quote)||/\n/.test(e.quote))throw Error('Citation absente de la Bible '+e.bible+' : '+e.id);
const STATUS={actuel:'actuel',actuel_mentionne:'actuel',ancien:'ancien',historique:'historique',disparu:'disparu',incertain:'incertain',souvenir:'historique',ancien_nom:'historique'};
const bsrc=e=>({source:'BIBLE_'+e.bible,ref:e.id,section:e.section,quote:e.quote,bibleStatus:e.status,...(e.lastEvidenceYear?{lastEvidenceYear:e.lastEvidenceYear}:{}),...(e.confidence?{bibleConfidence:e.confidence}:{})});
const used=new Set(),merged=new Set();
// Private homes tied to a named person and memories without a place stay context only (never a map object).
const EXCLUDE=new Map([...['B02-031','B02-045','B06-009','B06-010','B06-012'].map(id=>[id,'habitation privée liée à une personne : contexte seulement']),...['B04-021','B04-022'].map(id=>[id,'mention générique sans lieu précis']),['B04-039','hors commune (Romilly-sur-Seine)'],
 ...['B01-044','B02-022','B06-038'].map(id=>[id,'ligne ferroviaire : référentiel V1.9'])]);
const HYDRO_IDS=new Set(['B02-020']);
const junction=(filterA,filterB)=>{const nodes=r=>[r.p.nodeA,r.p.nodeB];const A=new Set(roads.filter(filterA).flatMap(nodes)),hits=roads.filter(filterB).flatMap(r=>[[r.p.nodeA,r.ls[0][0]],[r.p.nodeB,r.ls.at(-1).at(-1)]]).filter(([n])=>A.has(n));return hits.length?hits[0][1]:null;};
const roadMid=r=>{const l=r.ls.reduce((a,b)=>a.length>b.length?a:b);let L=0;for(let i=1;i<l.length;i++)L+=Math.hypot(l[i][0]-l[i-1][0],l[i][1]-l[i-1][1]);let s=0;for(let i=1;i<l.length;i++){const d=Math.hypot(l[i][0]-l[i-1][0],l[i][1]-l[i-1][1]);if(s+d>=L/2){const t=(L/2-s)/d;return [l[i-1][0]+t*(l[i][0]-l[i-1][0]),l[i-1][1]+t*(l[i][1]-l[i-1][1])];}s+=d;}return l[0];};
const railRep=read('data-sources/rail/rail-report.json');
const curatedById=new Map();
for(const c of CUR.canonical){
 const officials=(c.officialKeys||[]).map(k=>{const r=byKey.get(k);if(!r)throw Error('Objet officiel absent : '+k+' ('+c.key+')');return r;});
 for(const o of officials)merged.add(o);
 const bib=(c.bible||[]).map(id=>{const e=extract.get(id);if(!e)throw Error('Extrait absent : '+id);used.add(id);return e;});
 for(const id of c.contents||[])used.add(id);
 let anchor=null,geometryKind=null,positionSource=null,ban_id=null,buildingIds=null,buildingBy=null,precisionM=null;const a=c.anchor||{by:'none'};
 if(a.by==='building'){const bs=a.ids.map(id=>buildingById.get(id));if(bs.some(b=>!b))throw Error('Bâtiment absent '+c.key);anchor=bs[0].c;geometryKind='officielle';positionSource='centre de l’empreinte du bâtiment (référentiel V1.6.2)';buildingIds=a.ids;buildingBy='bâtiment désigné (même objet OSM / BD TOPO)';}
 else if(a.by==='ban'){const hit=geocode(a.address)||geocode(a.address.replace(/\s(bis|ter)\b/i,''));if(!hit)throw Error('Adresse BAN introuvable : '+a.address);anchor=hit.p;ban_id=hit.id;geometryKind='documentaire';positionSource='adresse BAN '+hit.num+(hit.rep||'')+' '+hit.street+' (position '+hit.pos+')'+(/bis|ter/i.test(a.address)&&!hit.rep?' — indice absent de la BAN, numéro de base':'');
  const bl=buildingForAddress(hit);if(bl){buildingIds=bl.ids;buildingBy=bl.by;}}
 else if(a.by==='official'){const o=officials[0];anchor=o.anchor;geometryKind=o.geometryKind;positionSource=o.positionSource;precisionM=o.precisionM;}
 else if(a.by==='road'||a.by==='roadId'){const cand=a.by==='roadId'?roads.filter(r=>r.id===a.id):roads.filter(r=>r.names.includes(normStreet(a.name)));if(!cand.length)throw Error('Voie absente '+c.key);const r=cand.reduce((x,y)=>x.ls.flat().length>y.ls.flat().length?x:y);anchor=roadMid(r);geometryKind='documentaire';positionSource='milieu du tronçon V1.8 '+r.id+(r.p.name?' ('+r.p.name+')':'');}
 else if(a.by==='routes'){anchor=junction(r=>r.p.routeNumber===a.routes[0],r=>r.p.routeNumber===a.routes[1]);if(!anchor)throw Error('Carrefour absent '+c.key);geometryKind='documentaire';positionSource='nœud V1.8 commun aux routes '+a.routes.join(' et ');}
 else if(a.by==='streets'){anchor=junction(r=>r.names.includes(normStreet(a.names[0])),r=>r.names.includes(normStreet(a.names[1])));if(!anchor)throw Error('Carrefour absent '+c.key);geometryKind='documentaire';positionSource='nœud V1.8 commun à '+a.names.join(' et ');}
 else if(a.by==='toponymie'){const f=topo.get(a.cleabs);anchor=toL93(f.geometry.coordinates);geometryKind='ponctuelle';positionSource='BD TOPO toponymie '+a.cleabs;const o=byKey.get('bdtopo:'+a.cleabs);if(o)merged.add(o);}
 else if(a.by==='rail'){const ov=railRep.structures.overpasses.filter(o=>o.road===a.overpassRoad);anchor=[ov.reduce((s,o)=>s+o.L93[0],0)/ov.length,ov.reduce((s,o)=>s+o.L93[1],0)/ov.length];geometryKind='documentaire';positionSource='passage supérieur du référentiel ferroviaire V1.9 (route '+a.overpassRoad+')';}
 else if(a.by==='poi'){anchor='@'+a.key;geometryKind='ponctuelle';positionSource='repère : '+a.key;}
 if(c.geometryKind&&anchor)geometryKind=c.geometryKind;
 const hasOfficial=officials.some(o=>/^BD TOPO/.test(o.sources[0].source))||a.by==='ban'||a.by==='building'||a.by==='toponymie';
 const r=mk({key:'cur:'+c.key,id:'poi:'+c.key,name:c.name,type:c.type,category:c.category,status:c.status,geometryKind:anchor?geometryKind:null,anchor,positionSource:anchor?positionSource:'aucune position fiable (nom sans géométrie)',precisionM,address:c.address||null,ban_id,
  confidence:hasOfficial?'A':anchor?'B':'B',sources:[...officials.flatMap(o=>o.sources),...bib.map(bsrc)],variants:[...new Set([...(c.variants||[]),...officials.map(o=>o.name).filter(n=>n&&n!==c.name),...bib.map(e=>e.name).filter(n=>n!==c.name)])],
  notes:[...(c.statusNote?[c.statusNote]:[]),...(c.geometryNote?[c.geometryNote]:[]),...(c.notes||[])],contents:(c.contents||[]).map(id=>{const e=extract.get(id);return {name:e.name,status:STATUS[e.status],source:'BIBLE_'+e.bible,ref:id,section:e.section,quote:e.quote};}),visual_priority:c.visual||3,areaId:officials.find(o=>o.areaId)?.areaId||null});
 r.curated=true;r.conflicts=c.conflicts||[];if(buildingIds){r.building_ids=buildingIds;r.buildingLink=buildingBy;}
 if(c.landmark){r.landmark_priority=c.landmark;r.unreal_asset_priority='landmark';r.landmarkReason=c.landmarkReason;}
 for(const o of officials)if(o.areaId){const ar=areas.find(x=>x.id===o.areaId);if(ar)ar.poiId=r.id;}
 curatedById.set(c.key,r);}
for(const r of pois)if(typeof r.anchor==='string'){const t=curatedById.get(r.anchor.slice(1));r.anchor=t.anchor;}

// ---------- Lieux-dits: an OSM locality with the same name as a BD TOPO lieu-dit (≤ 2 edits, < 1,5 km) is the same place ----------
// The BD TOPO object stays the reference; the OSM graphie becomes a documented variant (toponymy), never a correction.
const lieuVariants=[];
{const bd=pois.filter(p=>!merged.has(p)&&!p.curated&&['lieu_dit','secteur'].includes(p.category)&&p.sources[0].source.startsWith('BD TOPO'));
 for(const o of pois.filter(p=>!merged.has(p)&&!p.curated&&['lieu_dit','secteur'].includes(p.category)&&p.sources[0].source==='OSM')){
  const ok=nameKey(o.name),best=bd.map(b=>({b,d:similar(nameKey(b.name),ok),m:Math.hypot(b.anchor[0]-o.anchor[0],b.anchor[1]-o.anchor[1])})).filter(x=>x.d<=2&&x.m<1500).sort((a,b)=>a.d-b.d||a.m-b.m)[0];
  if(!best)continue;merged.add(o);best.b.sources.push(...o.sources);if(o.name!==best.b.name){best.b.variants.push(o.name);lieuVariants.push({official:best.b.name,officialSource:best.b.sources[0].source,variant:o.name,variantSource:'OSM',editDistance:best.d,distanceM:Math.round(best.m),kind:best.d===0?'variante_typographique':'variante_orthographique'});}}}

// ---------- Remaining Bible places: matched to an official object, geocoded by address, or kept without geometry ----------
const BCAT={mairie:['mairie','equipement_public'],ecole:['ecole','equipement_public'],periscolaire_petite_enfance:['petite_enfance','equipement_public'],eglise:['eglise','patrimoine'],chapelle_eglise:['chapelle','patrimoine'],cimetiere:['cimetiere','equipement_public'],
 equipement_public:['equipement','equipement_public'],service:['service','equipement_public'],equipement_culturel:['culture','equipement_public'],association_lieu:['association','equipement_public'],parc_loisirs:['parc','equipement_public'],equipement_sportif:['equipement_sportif','equipement_sportif'],
 sante:['sante','sante'],commerce:['commerce','commerce_entreprise'],commerce_entreprise:['commerce','commerce_entreprise'],commerce_cafe:['commerce','commerce_entreprise'],entreprise:['entreprise','commerce_entreprise'],industrie:['site_industriel','commerce_entreprise'],
 patrimoine:['patrimoine','patrimoine'],monument:['monument','patrimoine'],croix_calvaire:['croix','patrimoine'],chateau:['chateau','patrimoine'],moulin:['moulin','patrimoine'],lavoir:['lavoir','patrimoine'],ferme:['ferme','patrimoine'],
 lieu_dit:['lieu_dit','lieu_dit'],hameau:['hameau','secteur'],secteur:['secteur','secteur'],quartier_lotissement:['lotissement','secteur'],zone_activite:['zone_activite','zone_activite'],repere_local:['repere_local','repere_local'],gue_pont:['pont_gue','repere_local'],
 ferroviaire:['ferroviaire','repere_local'],gare_ferroviaire:['ferroviaire','repere_local'],autre:['autre','autre']};
const hydronyms=[],memoryOnly=[];const groups=new Map();
for(const e of EXTRACT.places){if(used.has(e.id)||EXCLUDE.has(e.id)){if(EXCLUDE.has(e.id))memoryOnly.push({ref:e.id,name:e.name,reason:EXCLUDE.get(e.id)});continue;}
 if(e.category==='hydrographie'||HYDRO_IDS.has(e.id)){hydronyms.push(e);continue;}
 const k=nameKey(e.name);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(e);}
// Explicit attachments from the curation (a Bible entry that documents an existing official object).
for(const [id,target] of Object.entries(CUR.attach||{})){const e=extract.get(id),t=target.startsWith('cur:')?curatedById.get(target.slice(4)):pois.find(p=>!merged.has(p)&&p.name===target.slice(5));if(!e||!t)throw Error('Rattachement impossible '+id);t.sources.push(bsrc(e));if(e.name!==t.name)t.variants.push(e.name);for(const [k,es] of groups){const i=es.indexOf(e);if(i>=0){es.splice(i,1);if(!es.length)groups.delete(k);}}}
// A Bible name identical to a curated place (name or variant) only adds context to it.
const curatedKeys=new Map();for(const r of curatedById.values())for(const n of [r.name,...r.variants])curatedKeys.set(nameKey(n),r);
const localOdonyms=[],oldSections=[];
const officialLieux=pois.filter(p=>!merged.has(p)&&!p.curated&&['lieu_dit','secteur'].includes(p.category)).sort((a,b)=>(a.sources[0].source==='OSM')-(b.sources[0].source==='OSM'));
const RANK={disparu:0,historique:1,ancien:2,incertain:3,actuel:4};
for(const [k,es] of groups){const e0=es.find(e=>e.address)||es.find(e=>!['02','06'].includes(e.bible))||es[0];
 const cur=curatedKeys.get(k);if(cur){cur.sources.push(...es.map(bsrc));continue;}
 // Memory (BIBLE_06) alone never creates a place: it only documents context.
 if(es.every(e=>e.bible==='06'&&e.status==='souvenir')){memoryOnly.push(...es.map(e=>({ref:e.id,name:e.name,reason:'mémoire locale seule (BIBLE_06)'})));continue;}
 // Status: the descriptive Bibles (01, 03, 04, 05) decide; BIBLE_02 / 06 "historique" or "souvenir" means "not established today", never "closed".
 const primary=es.filter(e=>!['02','06'].includes(e.bible)||['actuel_mentionne','disparu','ancien'].includes(e.status)),statuses=[...new Set((primary.length?primary:es).map(e=>STATUS[e.status]))];
 let status=statuses.length===1?statuses[0]:statuses.includes('actuel')&&statuses.some(x=>['disparu','ancien'].includes(x))?'incertain':statuses.includes('actuel')?'actuel':statuses.sort((a,b)=>RANK[a]-RANK[b])[0];
 const conflicts=status==='incertain'&&statuses.length>1?['statuts divergents selon les Bibles : '+es.map(e=>e.id+' '+e.status).join(', ')]:[];
 // BIBLE_05 « service » entries are businesses (garages, contrôle technique…), not public services.
 const [type,category]=e0.bible==='05'&&e0.category==='service'?['service_prive','commerce_entreprise']:BCAT[e0.category]||['autre','autre'],nk=nameKey(e0.name);
 // 1. Same place as an official lieu-dit / sector (same name, or ≤ 2 edits for names of 8+ letters).
 const match=(['lieu_dit','secteur'].includes(category)||e0.category==='lieu_dit')&&!es.some(e=>CUR.noAutoMatch?.[e.id])?(officialLieux.find(p=>nameKey(p.name)===nk)||officialLieux.find(p=>similar(nameKey(p.name),nk)<=2)):null;
 if(match){match.sources.push(...es.map(bsrc));if(match.name!==e0.name){match.variants.push(e0.name);lieuVariants.push({official:match.name,officialSource:match.sources[0].source,variant:e0.name,variantSource:'BIBLE_'+e0.bible+' §'+e0.section,ref:e0.id,editDistance:similar(nameKey(match.name),nk),kind:nameKey(match.name)===nk?'variante_typographique':'variante_orthographique'});}if(status!=='actuel')match.notes.push('BIBLE : '+es.map(e=>e.id+' '+e.status).join(', ')+' (nom ancien ou usage historique ; la position officielle reste)');match.bibleMatched=true;continue;}
 // Street, path and ancient cadastral section names are toponymy, not places.
 if(/^(chemin|voie|rue|ruelle|route)\b/i.test(e0.name)&&!e0.address){localOdonyms.push({name:e0.name,status,refs:es.map(e=>e.id),quote:e0.quote,section:e0.section,bible:e0.bible});continue;}
 if(/^Section [A-H] —/.test(e0.name)){oldSections.push({name:e0.name,refs:es.map(e=>e.id),quote:e0.quote,bible:e0.bible,section:e0.section});continue;}
 // 2. Documented address → BAN position (number and street identical) and building link.
 const hit=e0.address?geocode(e0.address.split(/ \/ |\(/)[0]):null;
 const lastYear=Math.max(0,...es.map(e=>e.lastEvidenceYear||0));
 const r=mk({key:'bible:'+es[0].id,id:'poi:bible:'+es[0].id,name:e0.name,type,category,status,geometryKind:hit?'documentaire':null,anchor:hit?hit.p:null,positionSource:hit?'adresse BAN '+hit.num+(hit.rep||'')+' '+hit.street+' (position '+hit.pos+')':'aucune position fiable (nom sans géométrie)',
  address:e0.address||null,ban_id:hit?.id||null,confidence:status==='actuel'&&category==='commerce_entreprise'&&!(lastYear>=2023||es.some(e=>e.bible==='01'&&/^11/.test(e.section)))?'C':'B',sources:es.map(bsrc),variants:[...new Set(es.map(e=>e.name).filter(n=>n!==e0.name).concat(es.flatMap(e=>e.variants||[])))],
  notes:[...conflicts,...(status==='actuel'&&category==='commerce_entreprise'&&!(lastYear>=2023)&&!es.some(e=>e.bible==='01'&&/^11/.test(e.section))?['présence actuelle à reconfirmer : dernière preuve '+(lastYear||'non datée')]:[]),...(e0.locationHints&&!hit?['indication : '+e0.locationHints]:[])]});
 r.conflicts=conflicts;r.lastEvidenceYear=lastYear||null;
 if(hit){const bl=buildingForAddress(hit);if(bl){r.building_ids=bl.ids;r.buildingLink=bl.by;}}}

// OSM corroboration: an OSM object with the same name (all words of the shorter name in the longer) within 250 m of a documented
// place is the same place; it confirms a current Bible business (C → B) but never creates one on its own.
{const toks=n=>nameKey(n).split(' ').filter(w=>w.length>1);
 for(const o of pois.filter(p=>!merged.has(p)&&p.name&&p.sources.every(s=>s.source==='OSM')&&!['lieu_dit','secteur'].includes(p.category))){
  const ot=toks(o.name);const t=pois.filter(p=>p!==o&&!merged.has(p)&&p.anchor&&!p.sources.every(s=>s.source==='OSM')&&Math.hypot(p.anchor[0]-o.anchor[0],p.anchor[1]-o.anchor[1])<250).find(p=>{const pt=toks(p.name);const [a,b]=pt.length<=ot.length?[pt,ot]:[ot,pt];return a.length&&a.every(w=>b.includes(w));});
  if(!t)continue;merged.add(o);t.sources.push(...o.sources);if(o.name!==t.name)t.variants.push(o.name);
  if(t.status==='actuel'&&t.confidence==='C'){t.confidence='B';t.notes=t.notes.filter(n=>!n.startsWith('présence actuelle à reconfirmer'));t.notes.push('présence actuelle corroborée par OSM (instantané du 31/05/2026, '+o.sources[0].ref+')');}}}

const osmAeromia=osm.features.find(f=>f.id==='way/533981309');
if(osmAeromia){const r=curatedById.get('aeromia');if(r&&!r.areaId){const a={id:'area:osm:way/533981309',name:r.name,type:'zone_activite',geometryKind:'approximative',source:'OSM landuse=commercial way/533981309 (limite non officielle)',confidence:'B',mp:polygons(osmAeromia,toL93),poiId:r.id};areas.push(a);r.areaId=a.id;}}
// ---------- Final POI list: links to buildings and roads, commune, Unreal position, display rule ----------
const final=pois.filter(p=>!merged.has(p));
const zonePolys=new Map(zones.map(z=>['bdtopo:'+z.p.cleabs,z]));
for(const p of final){
 if(p.anchor){p.inCommune=inCommune(p.anchor);
  // Building: explicit / BAN link first; else an official perimeter (< 2 ha) gives the buildings whose centre is inside; else the footprint under the point.
  if(!p.building_ids.length){const z=p.sources.map(s=>zonePolys.get('bdtopo:'+s.ref)).find(Boolean);
   if(z&&!z.p.fictif&&mpArea(z.mp)<20000){const bs=buildings.filter(b=>z.mp.some(poly=>insidePoly(b.c,poly))).sort((a,b)=>b.area-a.area);if(bs.length){p.building_ids=bs.map(b=>b.id);p.buildingLink='bâtiments dont le centre est dans le périmètre BD TOPO';}}
   else if(!['lieu_dit','secteur','zone_activite'].includes(p.category)){const bs=buildingAt(p.anchor);if(bs.length){p.building_ids=bs.map(b=>b.id);p.buildingLink='point dans l’empreinte';}}}
  p.building_id=p.building_ids[0]||null;
  const street=p.address?(p.address.match(/((rue|avenue|boulevard|bd|place|chemin|impasse|route|voie|ruelle|allée|placette)\b[^,;/()]+)/i)||[])[1]:null;
  const rd=!['lieu_dit','secteur','zone_activite'].includes(p.category)?roadFor(p.anchor,street)||(street?roadFor(p.anchor,null):null):null;if(rd){p.road_id=rd.id;p.roadLink=rd;}
  const Z=terrainZ(...p.anchor);p.L93=[r2(p.anchor[0]),r2(p.anchor[1]),r2(Z)];p.unreal_position=toUnreal([p.anchor[0],p.anchor[1],Z]).map(Math.round);p.lonlat=fromL93(p.anchor).map(v=>+v.toFixed(7));}
 else{p.L93=null;p.unreal_position=null;p.lonlat=null;p.inCommune=null;}
 if(p.ban_id&&!p.building_ids.length&&p.status==='actuel')p.notes.push('aucune empreinte du référentiel bâti à cette adresse (bâtiment récent possible) ; référentiel V1.6.2 gelé, non modifié');
 if(p.areaId&&p.inCommune===false){const a=areas.find(x=>x.id===p.areaId);if(a&&communeArea(a.mp)>0){p.inCommune=true;p.notes.push('périmètre à cheval sur la limite communale (point d’ancrage hors commune)');}}
 p.building_exists=p.building_ids.every(id=>buildingById.has(id));
 p.orientation=null;p.orientationNote='aucune orientation documentée (façade ou axe non renseignés par les sources)';
 // Displayed on the current map: current status, a position, and enough evidence (curated or official, or a Bible B source; OSM alone never).
 p.displayCurrent=p.status==='actuel'&&!!p.anchor&&p.confidence!=='C'&&p.inCommune!==false&&!(p.sources.length&&p.sources.every(s=>s.source==='OSM'));
}
// V1.11.1 targeted audit of current places left without a building: decisions backed by BAN / BAN PLUS / RNB / BD TOPO and the
// April 2025 orthophoto. Only the place → building association changes; no building geometry is modified or added.
const AUDIT='data-sources/buildings-audit-v1.11.1/decisions.json';
for(const p of final){p.building_geometry_missing=false;p.buildingAudit=null;p.building_position=null;}
if(fs.existsSync(AUDIT))for(const d of read(AUDIT).decisions){const p=final.find(x=>x.id===d.poi);if(!p)throw Error('Audit V1.11.1 : lieu absent '+d.poi);
 p.buildingAudit={verdict:d.verdict,evidence:d.by,orthophoto:d.ortho,...(d.banNote?{banNote:d.banNote}:{}),...(d.unreal?{unreal:d.unreal}:{})};
 if(d.verdict==='association_corrigee'){for(const id of d.building_ids)if(!buildingById.has(id))throw Error('Audit V1.11.1 : bâtiment absent '+id);
  p.building_ids=d.building_ids;p.building_id=d.building_ids[0];p.buildingLink='audit V1.11.1 : '+d.by;p.building_exists=true;p.notes=p.notes.filter(n=>!n.startsWith('aucune empreinte du référentiel bâti'));
  // For Unreal, the associated building centre is given when the place anchor is not on the building (BAN point on the road, field centre…).
  const b=buildingById.get(p.building_id);if(p.anchor&&!b.mp.some(poly=>insidePoly(p.anchor,poly))){const Z=terrainZ(...b.c);p.building_position={L93:[r2(b.c[0]),r2(b.c[1]),r2(Z)],unreal:toUnreal([b.c[0],b.c[1],Z]).map(Math.round),distanceFromAnchorM:r2(Math.hypot(b.c[0]-p.anchor[0],b.c[1]-p.anchor[1])),note:'centre de l’empreinte du bâtiment associé (référentiel V1.6.2)'};}}
 else if(d.verdict==='poi_imprecis'){if(p.building_ids.length)throw Error('Audit V1.11.1 : lieu déjà associé '+d.poi);p.building_geometry_missing=true;p.building_geometry_missing_reason='lieu ou adresse imprécis : aucun bâtiment désignable sans deviner ('+d.by+')';}
 else throw Error('Audit V1.11.1 : verdict non géré '+d.verdict);}
final.sort((a,b)=>(a.id>b.id)-(a.id<b.id));

// ---------- Areas: sectors, lieux-dits and zones with the nature of their geometry ----------
const finalIds=new Set(final.map(p=>p.id));
const areaOut=[];
for(const a of areas){const poi=final.find(p=>p.areaId===a.id)||final.find(p=>p.id===a.poiId);if(!poi)continue;a.poiId=poi.id;
 areaOut.push({id:a.id,name:poi.name,type:a.type,category:poi.category,geometryKind:a.geometryKind,source:a.source,confidence:a.confidence,poiId:poi.id,status:poi.status,areaM2:Math.round(mpArea(a.mp)),inCommune:communeArea(a.mp)>0,
  ringsL93:a.mp.map(p=>p.map(r=>r.map(q=>[r2(q[0]),r2(q[1])]))),ringsUnreal:a.mp.map(p=>p.map(r=>r.map(q=>toUnreal([q[0],q[1],0]).slice(0,2).map(Math.round)))),rings:a.mp.map(p=>p.map(r=>r.map(q=>fromL93(q).map(v=>+v.toFixed(7)))))});}
// Sectors and lieux-dits without an official limit: a point only (never a drawn polygon).
for(const p of final.filter(p=>['secteur','lieu_dit'].includes(p.category)&&!p.areaId))
 areaOut.push({id:'area:'+p.id.slice(4),name:p.name,type:p.type,category:p.category,geometryKind:p.anchor?(p.geometryKind==='officielle'?'ponctuelle':p.geometryKind):null,source:p.positionSource,confidence:p.confidence,poiId:p.id,status:p.status,areaM2:null,inCommune:p.inCommune,point:p.anchor?{L93:p.L93,unreal:p.unreal_position,lonlat:p.lonlat}:null,
  note:p.anchor?'aucune limite documentée : point seulement':'nom documenté sans position fiable'});

// ---------- Toponymy report ----------
const waterNames=new Set(read('public/data/landcover.geojson').features.filter(f=>f.properties.layer==='water_line'&&f.properties.name).map(f=>norm(f.properties.name)));
const toponymy={
 streets:streetToponymy.map(t=>({official:t.official,status:t.status,forms:t.forms})),
 conflicts:conflicts.map(c=>({kind:c.kind,official:c.official,a:c.a.forms.map(f=>f.name+' ['+f.sources.join(', ')+']'),b:c.b.forms.map(f=>f.name+' ['+f.sources.join(', ')+']')})),
 lieuDitVariants:lieuVariants,
 bible:EXTRACT.toponymy.map(t=>({id:t.id,name:t.name,variants:t.variants,kind:t.kind,preferredOfficialForm:t.preferredOfficialForm||null,bible:t.bible,section:t.section,quote:t.quote,notes:t.notes||null})),
 nameHistory:EXTRACT.nameHistory.map(n=>({id:n.id,currentName:n.currentName,oldNames:n.oldNames,bible:n.bible,section:n.section,quote:n.quote})),
 hydronyms:hydronyms.map(e=>({ref:e.id,name:e.name,status:STATUS[e.status],inOfficialHydrography:[e.name,...(e.variants||[])].some(n=>[...waterNames].some(w=>w.includes(nameKey(n))||nameKey(n).includes(w))),quote:e.quote,section:e.section})),
 localNamesWithoutGeometry:final.filter(p=>!p.anchor&&p.status==='actuel').map(p=>({id:p.id,name:p.name,type:p.type,sources:p.sources.map(s=>s.source+' '+(s.ref||''))})),
 localOdonyms:localOdonyms,oldCadastralSections:oldSections,
 rule:'forme officielle = BAN (source commune) ; aucune graphie n’est remplacée automatiquement ; les variantes, anciens noms et noms locaux restent documentés avec leur source'};

// ---------- Outputs ----------
const landmarks=final.filter(p=>p.landmark_priority).sort((a,b)=>a.landmark_priority-b.landmark_priority||a.name.localeCompare(b.name,'fr'));
const notRetained=CUR.canonical.filter(c=>!c.landmark&&/landmark/i.test((c.notes||[]).join(' '))).map(c=>({poiId:'poi:'+c.key,name:c.name,status:c.status,reason:(c.notes||[]).join(' ; ')}));
const META={version:'1.11',generatedBy:'scripts/build-poi.mjs',unrealOrigin:O,units:'Lambert-93 en mètres ; Unreal en centimètres : X = (E − 758278) × 100, Y = −(N − 6823571) × 100, Z = altitude × 100',
 zNote:'Z = terrain V1.7 (sol nu) au point d’ancrage ; aucun Z de toit ou d’étage',
 statusValues:{actuel:'présence actuelle documentée',ancien:'a existé, fermé / déplacé / remplacé',historique:'lieu ou fonction du passé',disparu:'détruit ou disparu',incertain:'à vérifier'},
 geometryKinds:{officielle:'géométrie d’une base officielle (empreinte, périmètre, objet BD TOPO)',documentaire:'position déduite d’une adresse BAN, d’un carrefour ou d’un tronçon documentés',approximative:'point approché (proximité documentée, tronçon d’une voie, limite OSM)',ponctuelle:'point seulement, sans limite (toponyme)'},
 rule:'une information historique n’est jamais présentée comme actuelle ; displayCurrent = statut actuel, position fiable et preuve suffisante (jamais OSM seul)'};
const fullPoi=p=>({id:p.id,name:p.name,type:p.type,category:p.category,status:p.status,current_or_historical:p.current_or_historical,displayCurrent:p.displayCurrent,confidence:p.confidence,
 geometry:p.lonlat?{type:'Point',coordinates:p.lonlat}:null,geometryKind:p.geometryKind,positionSource:p.positionSource,precisionM:p.precisionM,L93:p.L93,unreal_position:p.unreal_position,orientation:p.orientation,orientationNote:p.orientationNote,
 building_id:p.building_id,building_ids:p.building_ids,buildingLink:p.buildingLink,building_geometry_missing:p.building_geometry_missing,building_geometry_missing_reason:p.building_geometry_missing_reason||null,building_position:p.building_position,buildingAudit:p.buildingAudit,road_id:p.road_id,roadLink:p.roadLink,address:p.address,ban_id:p.ban_id,inCommune:p.inCommune,areaId:p.areaId,
 visual_priority:p.visual_priority,unreal_asset_priority:p.unreal_asset_priority,landmark_priority:p.landmark_priority,landmarkReason:p.landmarkReason,
 variants:[...new Set(p.variants)],notes:p.notes,conflicts:p.conflicts||[],contents:p.contents,lastEvidenceYear:p.lastEvidenceYear??null,source:[...new Set(p.sources.map(s=>s.source))].join(' + '),sources:p.sources});
fs.mkdirSync('unreal/poi',{recursive:true});
fs.writeFileSync('unreal/poi/poi.json',JSON.stringify({metadata:{...META,layer:'poi',note:'lieux identifiables : unreal_position = point d’ancrage au sol ; building_ids = empreintes du référentiel bâti V1.6.2 (non modifiées) ; aucun modèle 3D n’est créé'},pois:final.map(fullPoi)})+'\n');
fs.writeFileSync('unreal/poi/areas.json',JSON.stringify({metadata:{...META,layer:'areas',note:'secteurs, lieux-dits et zones : polygone seulement si une limite officielle (ou OSM, approximative) existe ; sinon un point, jamais un polygone dessiné autour d’un nom'},areas:areaOut.map(({rings,...a})=>a)})+'\n');
fs.writeFileSync('unreal/poi/landmarks.json',JSON.stringify({metadata:{...META,layer:'landmarks',note:'éléments à traiter spécifiquement dans Unreal (futur travail 3D) ; priorité 1 indispensable à la reconnaissance, 2 importante, 3 secondaire ; ce classement ne modifie pas la carte actuelle'},
 landmarks:landmarks.map(p=>({poiId:p.id,name:p.name,priority:p.landmark_priority,reason:p.landmarkReason,type:p.type,status:p.status,confidence:p.confidence,building_ids:p.building_ids,unreal_position:p.unreal_position,L93:p.L93,geometryKind:p.geometryKind,positionNote:p.anchor?null:'position à relever avant modélisation'})),notRetained})+'\n');
// Three.js: compact layer for labels, clicks and ?diagnostic=poi.
fs.writeFileSync('public/data/poi.json',JSON.stringify({metadata:{version:'1.11',generatedBy:'scripts/build-poi.mjs',note:'couche de lieux pour l’interaction Three.js ; provenance et confiance visibles en mode diagnostic'},
 pois:final.filter(p=>p.lonlat).map(p=>({id:p.id,name:p.name,type:p.type,category:p.category,status:p.status,coh:p.current_or_historical,display:p.displayCurrent,conf:p.confidence,lonlat:p.lonlat,geometryKind:p.geometryKind,building_ids:p.building_ids,...(p.building_geometry_missing?{building_geometry_missing:true}:{}),road_id:p.road_id,address:p.address,landmark:p.landmark_priority,visual:p.visual_priority,
  source:[...new Set(p.sources.map(s=>s.source))].join(' + '),positionSource:p.positionSource,refs:p.sources.filter(s=>s.source.startsWith('BIBLE')).slice(0,3).map(s=>({bible:s.source.slice(6),section:s.section,quote:s.quote}))})),
 areas:areaOut.filter(a=>a.rings).map(a=>({id:a.id,name:a.name,type:a.type,geometryKind:a.geometryKind,poiId:a.poiId,rings:a.rings}))})+'\n');

// ---------- Report ----------
const count=(list,k)=>list.reduce((m,p)=>{const v=k(p);m[v]=(m[v]||0)+1;return m;},{});
const inC=final.filter(p=>p.inCommune!==false);
const report={generatedAt:new Date().toISOString(),
 frozen:{buildingsSha256:sha(fs.readFileSync('public/data/buildings.geojson')),roadsSha256:sha(fs.readFileSync('public/data/roads.geojson')),railSha256:sha(fs.readFileSync('public/data/rail.geojson')),landcoverSha256:sha(fs.readFileSync('public/data/landcover.geojson')),terrainGeoTiffSha256:sha(tb),unrealOrigin:O},
 sources:Object.fromEntries(fs.readdirSync(D).filter(f=>f.endsWith('.geojson')).map(f=>{const j=read(`${D}/${f}`);return [f.replace('.geojson',''),{source:j.metadata.source,typename:j.metadata.typename,retrievedAt:j.metadata.retrievedAt,features:j.features.length,sha256:sha(fs.readFileSync(`${D}/${f}`))}];})),
 reusedReadOnly:{bdtopoZonesActivite:'data-sources/landcover/bdtopo-zone-d-activite.geojson',bdtopoReservoir:'data-sources/landcover/bdtopo-reservoir.geojson',bdtopoCimetiere:'data-sources/landcover/bdtopo-cimetiere.geojson',bdtopoTerrainDeSport:'data-sources/landcover/bdtopo-terrain-de-sport.geojson',bdtopoVoieNommee:'data-sources/roads/bdtopo-voie-nommee.geojson',osm:'public/data/maizieres.geojson',buildings:'public/data/buildings.geojson',roads:'public/data/roads.geojson',rail:'data-sources/rail/rail-report.json'},
 bible:{extracts:{file:`${D}/bible-places-v1.11.json`,sha256:sha(fs.readFileSync(`${D}/bible-places-v1.11.json`)),places:EXTRACT.places.length,toponymy:EXTRACT.toponymy.length,nameHistory:EXTRACT.nameHistory.length,quotesVerified:EXTRACT.places.length+EXTRACT.toponymy.length+EXTRACT.nameHistory.length},
  curation:{file:`${D}/poi-curation-v1.11.json`,sha256:sha(fs.readFileSync(`${D}/poi-curation-v1.11.json`)),canonical:CUR.canonical.length},bibleSha256:Object.fromEntries(Object.entries(BIBLE_FILES).map(([k,p])=>[k,sha(fs.readFileSync(p))])),
  memoryOnlyNotMapped:memoryOnly.length,hydronymsToToponymy:hydronyms.length,churchContents:final.find(p=>p.id==='poi:eglise-saint-denis').contents.length},
 totals:{poi:final.length,inCommune:final.filter(p=>p.inCommune===true).length,outsideCommune:final.filter(p=>p.inCommune===false).length,withoutGeometry:final.filter(p=>!p.anchor).length,
  current:final.filter(p=>p.current_or_historical==='current').length,historical:final.filter(p=>p.current_or_historical==='historical').length,uncertain:final.filter(p=>p.current_or_historical==='uncertain').length,displayedCurrent:final.filter(p=>p.displayCurrent).length,
  byStatus:count(final,p=>p.status),byCategory:count(final,p=>p.category),byCategoryCurrent:count(final.filter(p=>p.status==='actuel'),p=>p.category),byGeometryKind:count(final,p=>p.geometryKind||'sans géométrie'),byConfidence:count(final,p=>p.confidence),
  withBuilding:final.filter(p=>p.building_ids.length).length,buildingAuditV1111:{associationsCorrigees:final.filter(p=>p.buildingAudit?.verdict==='association_corrigee').length,buildingGeometryMissing:final.filter(p=>p.building_geometry_missing).length,decisions:fs.existsSync(AUDIT)?sha(fs.readFileSync(AUDIT)):null},buildingsLinked:new Set(final.flatMap(p=>p.building_ids)).size,withRoad:final.filter(p=>p.road_id).length,
  lieuxDits:final.filter(p=>p.category==='lieu_dit').length,lieuxDitsInCommune:final.filter(p=>p.category==='lieu_dit'&&p.inCommune).length,secteurs:final.filter(p=>p.category==='secteur').length,
  equipementsPublics:final.filter(p=>p.category==='equipement_public').length,equipementsPublicsActuels:final.filter(p=>p.category==='equipement_public'&&p.status==='actuel').length,
  commercesEntreprisesActuels:final.filter(p=>p.category==='commerce_entreprise'&&p.status==='actuel').length,commercesEntreprisesAffiches:final.filter(p=>p.category==='commerce_entreprise'&&p.displayCurrent).length,commercesEntreprisesNonActuels:final.filter(p=>p.category==='commerce_entreprise'&&p.status!=='actuel').length,
  patrimoine:final.filter(p=>p.category==='patrimoine').length,patrimoineActuel:final.filter(p=>p.category==='patrimoine'&&p.status==='actuel').length,patrimoineMobilierEglise:final.find(p=>p.id==='poi:eglise-saint-denis').contents.length,
  landmarks:count(landmarks,p=>'P'+p.landmark_priority)},
 areas:{count:areaOut.length,byGeometryKind:count(areaOut,a=>a.geometryKind||'sans géométrie'),polygons:areaOut.filter(a=>a.ringsL93).length},
 toponymy:{streets:toponymy.streets.length,streetStatus:count(toponymy.streets,t=>t.status),conflicts:toponymy.conflicts.length,lieuDitVariants:lieuVariants.length,lieuDitVariantsOrthographic:lieuVariants.filter(v=>v.kind==='variante_orthographique').length,bibleEntries:toponymy.bible.length,bibleByKind:count(toponymy.bible,t=>t.kind),nameHistory:toponymy.nameHistory.length,
  hydronyms:toponymy.hydronyms.length,localOdonyms:localOdonyms.length,oldCadastralSections:oldSections.length,hydronymsAbsentFromOfficial:toponymy.hydronyms.filter(h=>!h.inOfficialHydrography).map(h=>h.name),localNamesWithoutGeometry:toponymy.localNamesWithoutGeometry.length},
 landmarks:landmarks.map(p=>({priority:p.landmark_priority,name:p.name,poiId:p.id,building_ids:p.building_ids,positioned:!!p.anchor})),notRetainedLandmarks:notRetained,
 toponymyDetail:toponymy,
 conflictsAndUncertainties:{poiConflicts:final.filter(p=>p.conflicts?.length).map(p=>({id:p.id,name:p.name,conflicts:p.conflicts})),uncertain:final.filter(p=>p.status==='incertain').map(p=>({id:p.id,name:p.name,source:[...new Set(p.sources.map(s=>s.source))].join(' + ')})),
  osmOnly:final.filter(p=>p.sources.every(s=>s.source==='OSM')).map(p=>({id:p.id,name:p.name,type:p.type})),currentWithoutGeometry:final.filter(p=>!p.anchor&&p.status==='actuel').map(p=>({id:p.id,name:p.name})),
  commerceToReconfirm:final.filter(p=>p.category==='commerce_entreprise'&&p.status==='actuel'&&!p.displayCurrent).map(p=>({id:p.id,name:p.name,lastEvidenceYear:p.lastEvidenceYear}))},
 memoryOnly};
fs.writeFileSync(`${D}/poi-report.json`,JSON.stringify(report,null,1)+'\n');
console.log(JSON.stringify({totals:report.totals,areas:report.areas,toponymy:{...report.toponymy,hydronymsAbsentFromOfficial:undefined},landmarks:report.landmarks.map(l=>'P'+l.priority+' '+l.name+(l.positioned?'':' (sans position)')),conflicts:report.conflictsAndUncertainties.poiConflicts.length,uncertain:report.conflictsAndUncertainties.uncertain.length},null,1));
