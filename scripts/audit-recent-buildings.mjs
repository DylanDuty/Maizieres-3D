// V1.11.1 targeted audit: current places that V1.11 left without a building (and that clearly designate a building or a
// premises). For each: address, coordinates, nearest building of the frozen reference, RNB match by address, current BD TOPO
// and Parcellaire Express footprints nearby, official footprints absent from the reference, orthophoto control and verdict.
// Reads the frozen reference and the snapshots of scripts/fetch-recent-buildings-audit.mjs; writes the audit report only.
import fs from 'node:fs';
import polygonClipping from 'polygon-clipping';
import {toL93} from './terrain-frame.mjs';
import {polygons,insidePoly} from '../src/geo.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),D='data-sources/buildings-audit-v1.11.1',r1=v=>Math.round(v*10)/10;
const ringArea=r=>{let a=0;for(let i=0,j=r.length-1;i<r.length;j=i++)a+=(r[j][0]*r[i][1]-r[i][0]*r[j][1]);return Math.abs(a/2);};
const mpA=mp=>mp.reduce((s,p)=>s+ringArea(p[0])-p.slice(1).reduce((h,r)=>h+ringArea(r),0),0);
const seg=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy,t=L?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
const dist=(p,mp)=>mp.some(poly=>insidePoly(p,poly))?0:Math.min(...mp.flatMap(poly=>poly.flatMap(r=>r.slice(1).map((q,i)=>seg(p,r[i],q)))));
const overlap=(a,b)=>{try{return mpA(polygonClipping.intersection(a,b));}catch{return 0;}};
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[’'`\-]/g,' ').replace(/\bbd\b/g,'boulevard').replace(/\bav\b/g,'avenue').replace(/\s+/g,' ').trim();
const ref=read('public/data/buildings.geojson').features.map(f=>({id:f.id,mp:polygons(f,toL93),rnb:String(f.properties.rnb||'').split('/').filter(Boolean),inCommune:f.properties.inCommune}));
const inRef=mp=>ref.filter(r=>overlap(r.mp,mp)>.3*Math.min(mpA(r.mp),mpA(mp))).map(r=>r.id);
const DEC=read(`${D}/decisions.json`).decisions,ZONES=read(`${D}/cases.json`).zones,P=read('unreal/poi/poi.json').pois,V111=new Map(read(`${D}/v1.11-start.json`).pois.map(p=>[p.id,p]));
const ban=new Map(read('data-sources/poi/ban-adresses.geojson').features.map(f=>[f.properties.id,f.properties]));
const links=read('data-sources/poi/banplus-lien-adresse-bati.geojson').features.map(f=>f.properties);
const rnbAll=new Map();for(const b of read('data-sources/rnb/rnb-10220.json').buildings)rnbAll.set(b.rnb_id,{...b,from:'RNB instantané V1.6 (24/09/2026)'});
for(const f of fs.readdirSync(D).filter(f=>f.startsWith('rnb-')))for(const b of read(`${D}/${f}`).buildings)rnbAll.set(b.rnb_id,{...b,from:'RNB API (audit V1.11.1)'});
const addrKey=a=>norm(a.street_number+(a.street_rep||'')+' '+a.street);
const cases=[];
for(const d of DEC){const p=P.find(x=>x.id===d.poi),start=V111.get(d.poi);if(!p||!start)throw Error('Lieu absent '+d.poi);
 const c={poi:p.id,name:p.name,type:p.type,category:p.category,status:p.status,address:p.address,startBuildingIds:start.building_ids,coordinates:p.L93?{L93:p.L93.slice(0,2),lonlat:p.geometry.coordinates}:null};
 const z=ZONES.find(z=>z.pois.includes(p.id));
 if(p.L93){const q=p.L93.slice(0,2),b=p.ban_id&&ban.get(p.ban_id);
  c.ban=b?{id:b.id,label:b.numero+(b.rep||'')+' '+b.nom_voie,position:b.type_position,banPlusLinks:links.filter(l=>l.id_adr===b.id).map(l=>l.id_bat)}:null;
  const near=ref.map(r=>({id:r.id,d:dist(q,r.mp)})).sort((a,b)=>a.d-b.d)[0];c.nearestBuilding={id:near.id,distanceM:r1(near.d)};
  const key=p.address?norm(p.address.replace(/(\d+)\s+(bis|ter)/i,'$1$2')):null;
  c.rnbByAddress=key?[...rnbAll.values()].filter(r=>(r.addresses||[]).some(a=>addrKey(a)===key)).map(r=>{const mp=r.shape&&/Polygon/.test(r.shape.type)?polygons({geometry:r.shape},toL93):null;return {rnb_id:r.rnb_id,status:r.status,source:r.from,referenceBuildings:[...new Set([...ref.filter(x=>x.rnb.includes(r.rnb_id)).map(x=>x.id),...(mp?inRef(mp):[])])],distanceM:mp?r1(dist(q,mp)):null};}):[];
  if(z){const cur=(n,lab)=>read(`${D}/${n}-${z.id}.json`).features.map(f=>({id:f.properties.cleabs||f.id,mp:polygons(f,toL93),p:f.properties})).map(x=>({...x,d:dist(q,x.mp)})).sort((a,b)=>a.d-b.d);
   const bd=cur('bdtopo-batiment'),pci=cur('pci-batiment'),dec=d.building_ids?.[0]?ref.find(r=>r.id===d.building_ids[0]):null;
   const pick=(list,lab)=>{const x=dec?list.find(x=>overlap(x.mp,dec.mp)>.3*Math.min(mpA(x.mp),mpA(dec.mp))):list[0];return x?{id:x.id,source:lab,distanceM:r1(x.d),areaM2:Math.round(mpA(x.mp)),...(x.p.date_creation?{created:x.p.date_creation.slice(0,10),usage:x.p.usage_1,state:x.p.etat_de_l_objet}:{type:x.p.type}),inReference:inRef(x.mp)}:null;};
   c.bdtopoFootprint=pick(bd,'BD TOPO bâtiment (actuel)');c.cadastreFootprint=pick(pci,'Parcellaire Express bâtiment (actuel)');
   if(dec&&!c.bdtopoFootprint)c.bdtopoFootprint={id:dec.id,source:'référentiel V1.6.2 (BD TOPO)',distanceM:r1(dist(q,dec.mp)),note:'bâtiment associé hors de la boîte de contrôle de ± 150 m autour du point BAN'};
   // Official current footprints of the control box absent from the reference (context: none of them designates the place).
   c.officialFootprintsAbsentFromReference=[...bd.map(x=>({...x,src:'BD TOPO'})),...pci.map(x=>({...x,src:'Parcellaire Express'}))].filter(x=>x.d<60&&!inRef(x.mp).length).map(x=>({source:x.src,id:x.id,distanceM:r1(x.d),areaM2:Math.round(mpA(x.mp)),type:x.p.type||x.p.nature||null}));}
 }
 c.orthophoto=d.ortho;c.verdict=d.verdict;c.evidence=d.by;c.finalBuildingIds=p.building_ids;c.building_geometry_missing=!!p.building_geometry_missing;if(p.building_position)c.building_position=p.building_position;
 // Consistency: a corrected association must rest on BAN PLUS, RNB, a footprint ≤ 2 m from the address or a documented building.
 if(d.verdict==='association_corrigee'){const ok=d.building_ids.every(id=>ref.some(r=>r.id===id))&&(c.rnbByAddress?.some(r=>r.referenceBuildings.some(id=>d.building_ids.includes(id)))||c.ban?.banPlusLinks.some(id=>d.building_ids.includes(id))||c.nearestBuilding?.distanceM<=2&&d.building_ids.includes(c.nearestBuilding.id)||/BIBLE|BAN PLUS|RNB/.test(d.by));if(!ok)throw Error('Association non justifiée '+d.poi);}
 cases.push(c);}
const count=v=>cases.filter(c=>c.verdict===v).length;
const report={generatedAt:new Date().toISOString(),scope:'lieux actuels V1.11 sans bâtiment associé désignant manifestement un bâtiment ou un local (hors lieux-dits, zones, terrains, ouvrages, antennes, croix, cimetière)',
 sources:{reference:'public/data/buildings.geojson (gelé V1.6.2)',ban:'data-sources/poi/ban-adresses.geojson, banplus-lien-adresse-bati.geojson',rnb:['data-sources/rnb/rnb-10220.json',...fs.readdirSync(D).filter(f=>f.startsWith('rnb-')).map(f=>`${D}/${f}`)],
  bdtopo:fs.readdirSync(D).filter(f=>f.startsWith('bdtopo-')).map(f=>`${D}/${f}`),cadastre:fs.readdirSync(D).filter(f=>f.startsWith('pci-')).map(f=>`${D}/${f}`),orthophoto:'IGN BD ORTHO (WMS-R ORTHOIMAGERY.ORTHOPHOTOS, avril 2025), contrôle visuel uniquement'},
 totals:{casesExamined:cases.length,withPosition:cases.filter(c=>c.coordinates).length,withoutPosition:cases.filter(c=>!c.coordinates).length,startWithoutBuilding:cases.filter(c=>!c.startBuildingIds.length).length,
  associationsCorrected:count('association_corrigee'),missingOfficialBuildings:count('batiment_officiel_manquant'),buildingsAdded:0,visibleWithoutReliableGeometry:count('sans_geometrie_fiable'),poiImprecise:count('poi_imprecis'),
  stillWithoutBuildingGeometry:cases.filter(c=>c.building_geometry_missing).length,buildings:ref.length,buildingsInCommune:ref.filter(r=>r.inCommune).length},cases};
fs.writeFileSync(`${D}/recent-buildings-audit.json`,JSON.stringify(report,null,1)+'\n');
console.log(JSON.stringify(report.totals,null,1));
for(const c of cases)console.log(c.verdict.padEnd(22),c.name.slice(0,40).padEnd(40),c.coordinates?('proche '+c.nearestBuilding.id+' '+c.nearestBuilding.distanceM+' m'):'sans position',(c.rnbByAddress||[]).map(r=>'RNB '+r.rnb_id+'→'+r.referenceBuildings.join('+')).join(' '));
