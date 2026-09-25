import * as THREE from 'three';
import {V2_COLORS,LANDUSE_LABELS} from './v2-scene.js';

// V2.0 interface around the assembled scene: click records, discreet landmark labels, search, quick views, legend, performance HUD.
// Places without geometry are never drawn; a point place stays a point.
const CATEGORY={equipement_public:'Équipement public',equipement_sportif:'Équipement sportif',sante:'Santé',commerce_entreprise:'Commerce / entreprise',patrimoine:'Patrimoine',lieu_dit:'Lieu-dit',secteur:'Secteur',
 zone_activite:'Zone d’activité',repere_local:'Repère',infrastructure:'Infrastructure',autre:'Lieu'};
const STATUS={actuel:'actuel',ancien:'ancien (fermé ou remplacé)',historique:'historique',disparu:'disparu',incertain:'à vérifier'};
const CONFIDENCE={A:'élevée (source officielle)',B:'moyenne',C:'faible (à confirmer)'};
export const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[’'`\-]/g,' ').replace(/\s+/g,' ').trim();
const ringsOf=p=>p.map(r=>{const out=[];for(let i=0;i<r.length;i+=2)out.push([r[i],r[i+1]]);return out;});

export function extendCatalogue(catalogue,v2,project,buildingInfo,{technical=false}={}){
 const {heightAt}=v2;let pois=0,zones=0,buildingsLinked=0;
 // Lift existing records (OSM streets, named buildings, BD TOPO zones) onto the relief.
 for(const r of catalogue.records)if(r.position&&r.type!=='building')r.position=[r.position[0],r.position[1]+heightAt(r.position[0],r.position[2]),r.position[2]];
 for(const p of v2.poi){if(!technical&&!(p.display||p.landmark||(['secteur','lieu_dit'].includes(p.category)&&p.coh==='current')))continue;
  const [x,z]=project(p.lonlat),facts=[`Statut : ${STATUS[p.status]||p.status}`,`Fiabilité : ${CONFIDENCE[p.conf]||p.conf}`];if(p.address)facts.push(`Adresse : ${p.address}`);if(p.landmark&&technical)facts.push(`Landmark Unreal priorité ${p.landmark}`);
  const r={id:p.id,name:p.name,kind:CATEGORY[p.category]||'Lieu',type:'point',position:[x,heightAt(x,z)+(['secteur','lieu_dit'].includes(p.category)?4:12),z],major:false,facts,
   source:technical?`Sources : ${p.source}. Position : ${p.positionSource} (${p.geometryKind})`:'',bible:p.refs.length?{notes:p.refs}:undefined,poi:p};
  catalogue.records.push(r);catalogue.byId.set(r.id,r);pois++;
  const polys=p.building_ids.map(id=>buildingInfo.get(id)?.poly).filter(Boolean);
  if(polys.length){const b={...r,id:p.building_ids[0],type:'building',memberIds:p.building_ids.filter(id=>buildingInfo.has(id)),polys};for(const id of b.memberIds){catalogue.byId.set(id,b);buildingsLinked++;}}}
 // Land-cover zones (parcels, woods, water, surfaces): clickable on the ground, not searchable.
 const add=(o,name,kind,facts)=>{const polys=o.r.map(ringsOf).filter(p=>p.length&&p[0].length>=3);if(!polys.length)return;const r={id:'lc:'+o.id,name,kind,type:'zone',polys,position:[0,0,0],source:technical?'Occupation du sol V1.10 : '+o.id:'',facts,searchable:false};catalogue.records.push(r);catalogue.byId.set(r.id,r);zones++;};
 for(const a of v2.data.agriculture)add(a,LANDUSE_LABELS[a.t]||'Parcelle agricole','Parcelle agricole (RPG)',[`Culture déclarée en ${a.year} : ${a.crop||'non renseignée'}`,`Surface : ${a.ha.toLocaleString('fr-FR')} ha`,'La culture change d’une année à l’autre']);
 for(const a of v2.data.woodland)add(a,LANDUSE_LABELS[a.t]||'Bois','Boisement',[`Surface : ${a.ha.toLocaleString('fr-FR')} ha`]);
 for(const a of v2.data.water)add(a,a.name||'Surface en eau','Eau',[a.t]);
 for(const a of v2.data.artificial.filter(a=>a.kind==='surface'))add(a,a.name||({parking:'Parking',terrain_de_sport:'Terrain de sport',cimetiere:'Cimetière',reservoir:'Réservoir',emprise_ferroviaire:'Aire de triage'}[a.t]||'Surface aménagée'),'Surface aménagée',[]);
 return {pois,zones,buildingsLinked};
}

// Default labels: sectors and landmarks only (P1 visible from afar, P2 when closer); every other place stays clickable.
export function v2Labels(v2,project){
 const items=[],at=(id,style,{major=false,local=false,lift=22}={})=>{const p=id.startsWith('name:')?v2.poi.find(q=>q.name===id.slice(5)&&['secteur','lieu_dit'].includes(q.category)):v2.poiById.get(id);if(!p)return;const [x,z]=project(p.lonlat);items.push({id,name:p.name.replace(/ de Maizières-la-Grande-Paroisse$/,''),position:[x,v2.heightAt(x,z)+lift,z],major,local,style});};
 at('poi:bourg','',{major:true,lift:40});at('poi:poussey','',{major:true,lift:30});at('poi:les-granges','',{major:true,lift:30});
 at('poi:parc-aerodrome','place',{lift:12});at('poi:glaciere','place',{lift:12});at('name:le Craon','place',{local:true,lift:8});
 for(const p of v2.poi.filter(p=>p.landmark===1))at(p.id,'landmark',{lift:26});
 for(const p of v2.poi.filter(p=>p.landmark===2))at(p.id,'landmark minor',{local:true,lift:20});
 return items;
}

// Ground picking by ray marching on the displayed terrain (cheap; no raycast on the 650 000 terrain triangles).
export function groundPicker(heightAt){const p=new THREE.Vector3();return ray=>{let prev=0;for(let t=5;t<30000;t+=Math.max(4,t*.01)){ray.at(t,p);if(p.y<=heightAt(p.x,p.z)){let a=prev,b=t;for(let i=0;i<20;i++){const m=(a+b)/2;ray.at(m,p);if(p.y<=heightAt(p.x,p.z))b=m;else a=m;}return ray.at(b,p).clone();}prev=t;}return null;};}

export function installSearch(catalogue,onPick){
 const box=document.createElement('div');box.id='search';box.innerHTML='<input type="search" placeholder="Rechercher une rue, un lieu…" aria-label="Rechercher un lieu documenté" autocomplete="off"><ul role="listbox" hidden></ul>';document.body.appendChild(box);
 const input=box.querySelector('input'),list=box.querySelector('ul');
 const rank=r=>r.poi?(r.poi.landmark?0:['secteur','lieu_dit'].includes(r.poi.category)?1:2):r.type==='line'?1.5:3;
 const seen=new Map();for(const r of catalogue.records){if(r.searchable===false||!r.name||r.generic)continue;const k=norm(r.name);const prev=seen.get(k);if(!prev||rank(r)<rank(prev))seen.set(k,r);}
 const index=[...seen.values()].map(r=>({r,k:norm(r.name)}));
 let results=[],active=-1;
 const show=()=>{list.replaceChildren(...results.map((o,i)=>{const li=document.createElement('li');li.role='option';li.setAttribute('aria-selected',String(i===active));li.innerHTML='<b></b><span></span>';li.querySelector('b').textContent=o.r.name;li.querySelector('span').textContent=o.r.type==='line'?'Rue / voie':o.r.kind;li.addEventListener('mousedown',e=>{e.preventDefault();pick(o.r);});return li;}));list.hidden=!results.length;};
 const pick=r=>{input.value=r.name;results=[];show();input.blur();onPick(r);};
 input.addEventListener('input',()=>{const q=norm(input.value);active=-1;if(q.length<2){results=[];show();return;}const words=q.split(' ');
  results=index.filter(o=>words.every(w=>o.k.includes(w))).sort((a,b)=>(a.k.startsWith(q)?0:1)-(b.k.startsWith(q)?0:1)||rank(a.r)-rank(b.r)||a.k.length-b.k.length).slice(0,8);show();});
 input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){active=Math.min(results.length-1,active+1);show();e.preventDefault();}else if(e.key==='ArrowUp'){active=Math.max(0,active-1);show();e.preventDefault();}else if(e.key==='Enter'&&results.length){pick(results[Math.max(0,active)]);e.preventDefault();}else if(e.key==='Escape'){results=[];show();}});
 input.addEventListener('blur',()=>setTimeout(()=>{results=[];show();},150));
 return {index:index.length,search:q=>{input.value=q;input.dispatchEvent(new Event('input'));return results.map(o=>o.r.name);},pick};
}

export function installViews(views,onView){
 const bar=document.createElement('div');bar.id='views';bar.setAttribute('aria-label','Vues rapides');
 for(const v of views){const b=document.createElement('button');b.type='button';b.textContent=v.name;b.addEventListener('click',()=>onView(v));bar.appendChild(b);}document.body.appendChild(bar);return bar;
}

export function installLegend(){
 const items=[['Bâti','#d9cbb4'],['Route','#8f9398'],['Chemin empierré','#cdbd97'],['Chemin de terre / sentier','#b89e74'],['Voie ferrée','#4f4a45'],['Terre arable','#eadba0'],['Prairie','#a8cb7a'],['Jachère','#d3c68f'],
  ['Bois','#5d8e4d'],['Peupleraie','#93bb6c'],['Haie','#557f43'],['Eau','#7fb9d5'],['Zone d’activité','#e3d9c3'],['Photovoltaïque','#a3afbd']];
 const box=document.createElement('aside');box.id='legend';box.innerHTML='<button type="button" aria-expanded="false">Légende</button><ul hidden></ul>';
 box.querySelector('ul').replaceChildren(...items.map(([t,c])=>{const li=document.createElement('li');li.innerHTML='<i></i><span></span>';li.querySelector('i').style.background=c;li.querySelector('span').textContent=t;return li;}));
 const button=box.querySelector('button'),list=box.querySelector('ul');button.addEventListener('click',()=>{list.hidden=!list.hidden;button.setAttribute('aria-expanded',String(!list.hidden));button.textContent=list.hidden?'Légende':'Légende ×';});
 document.body.appendChild(box);return box;
}

// Technical HUD (?perf or ?diagnostic=v2): continuous rendering only while shown.
export function installPerfHud(renderer,objects,draw){
 const hud=document.createElement('pre');hud.id='perf-hud';document.body.appendChild(hud);let frames=0,last=performance.now(),fps=0;
 const loop=now=>{draw();frames++;if(now-last>500){fps=frames*1000/(now-last);frames=0;last=now;const i=renderer.info,mem=performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576)+' Mo JS':'n/d';
  hud.textContent=`FPS ${fps.toFixed(1)}\nAppels ${i.render.calls} · triangles ${(i.render.triangles/1000).toFixed(0)} k\nGéométries ${i.memory.geometries} · textures ${i.memory.textures}\nMémoire ${mem}\n${objects}`;hud.dataset.fps=fps.toFixed(1);}requestAnimationFrame(loop);};
 requestAnimationFrame(loop);return hud;
}
