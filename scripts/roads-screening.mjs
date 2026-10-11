// V2.9.2 — measures every clickable street of the map (OSM ways grouped by name, src/cartography.js) against the official
// road network: BD TOPO tronçons (BAN odonym left/right, road number, INSEE commune) and BD TOPO voies nommées (BAN list).
// A street is sampled every 8 m; each sample takes the nearest BD TOPO tronçon within 12 m. Frozen files are read only.
import fs from 'node:fs';
import {loadBaseCatalogue} from './base-catalogue.mjs';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
export const norm=s=>(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[’'`-]/g,' ').replace(/\bbd\b/g,'boulevard').replace(/\bav\b/g,'avenue').replace(/\bmal\b/g,'marechal').replace(/\bgal\b/g,'general').replace(/\br\b/g,'rue').replace(/\bst\b/g,'saint').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
export function loadRoadSources(){
 const base=loadBaseCatalogue(),{project}=base;
 const tr=read('data-sources/roads/bdtopo-troncon-de-route.geojson').features.map(f=>{const p=f.properties,c=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.coordinates;return {id:p.cleabs,nature:p.nature,num:p.cpx_numero,ban:[p.nom_voie_ban_gauche,p.nom_voie_ban_droite].filter(Boolean),banId:[p.identifiant_voie_ban_gauche,p.identifiant_voie_ban_droite].filter(Boolean),collab:[p.nom_collaboratif_gauche,p.nom_collaboratif_droite].filter(Boolean),insee:[p.insee_commune_gauche,p.insee_commune_droite].filter(Boolean),fictif:p.fictif,sol:p.position_par_rapport_au_sol,lines:c.map(l=>l.map(q=>project(q)))};});
 const voies=read('data-sources/roads/bdtopo-voie-nommee.geojson').features.map(f=>f.properties);
 const ban=read('data-sources/poi/ban-adresses.geojson').features.map(f=>f.properties).filter(p=>p.code_insee==='10220');
 return {...base,tr,voies,ban};
}
// grid index over tronçon segments
function index(tr){const cell=40,g=new Map();tr.forEach((t,ti)=>t.lines.forEach(l=>{for(let i=1;i<l.length;i++){const a=l[i-1],b=l[i];const x0=Math.floor(Math.min(a[0],b[0])/cell),x1=Math.floor(Math.max(a[0],b[0])/cell),z0=Math.floor(Math.min(a[1],b[1])/cell),z1=Math.floor(Math.max(a[1],b[1])/cell);for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const k=x+','+z;if(!g.has(k))g.set(k,[]);g.get(k).push([ti,a,b]);}}}));return {cell,g};}
const segD=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
export function nearestTroncon(I,p,max=12){const {cell,g}=I;let best=null,bd=max;const cx=Math.floor(p[0]/cell),cz=Math.floor(p[1]/cell);for(let x=cx-1;x<=cx+1;x++)for(let z=cz-1;z<=cz+1;z++)for(const [ti,a,b] of g.get(x+','+z)||[]){const d=segD(p,a,b);if(d<bd){bd=d;best=ti;}}return best==null?null:{ti:best,d:bd};}
export function sample(lines,step=8){const out=[];for(const l of lines)for(let i=1;i<l.length;i++){const a=l[i-1],b=l[i],n=Math.max(1,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/step));for(let k=0;k<n;k++)out.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}return out;}
export function screenRoads(S){
 const I=index(S.tr),lines=S.catalogue.records.filter(r=>r.type==='line');
 return lines.map(r=>{const pts=sample(r.lines),ban={},num={},insee={},nat={},unmatched=[];let matched=0;
  for(const p of pts){const n=nearestTroncon(I,p);if(!n){unmatched.push(p);continue;}matched++;const t=S.tr[n.ti];
   for(const b of new Set(t.ban))ban[b]=(ban[b]||0)+1;if(t.num)num[t.num]=(num[t.num]||0)+1;for(const c of new Set(t.insee))insee[c]=(insee[c]||0)+1;nat[t.nature]=(nat[t.nature]||0)+1;}
  const share=o=>Object.entries(o).map(([k,v])=>[k,+(v/pts.length).toFixed(2)]).sort((a,b)=>b[1]-a[1]);
  const len=pts.length*8;
  return {id:r.id,name:r.name,kind:r.id.startsWith('rail:')?'rail':'road',refs:r.refs,osmIds:r.sourceIds,lengthM:Math.round(len),samples:pts.length,coverage:+(matched/pts.length).toFixed(2),ban:share(ban),numbers:share(num),insee:share(insee),nature:share(nat),position:r.position};});
}
