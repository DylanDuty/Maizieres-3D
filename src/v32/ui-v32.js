import {LEGEND_ITEMS} from '../v2-ui.js';

// V3.2 interface (?visual=premium-v32): the map first. Three entries in a small floating dock (Explorer, Qualité,
// Informations) plus the search field; every other control lives in a panel that opens on demand. Quality is chosen
// directly in a three-option picker (no cycling), a permanent discreet line states that the map is a stylised,
// non-contractual interpretation and opens the Informations panel. Keyboard: Tab order follows the screen, Échap closes
// the open panel and gives the focus back to its button, « / » focuses the search.

const svg=(d,extra='')=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${extra}>${d}</svg>`;
export const ICONS={
 search:svg('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'),
 explore:svg('<circle cx="12" cy="12" r="8.5"/><path d="m14.8 9.2-1.9 4.7-3.7 1.9 1.9-4.7z"/>'),
 quality:svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
 info:svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.1"/>'),
 close:svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
 check:svg('<path d="m5.5 12.5 4 4 9-9"/>'),
 home:svg('<path d="M4.5 11 12 4.5l7.5 6.5"/><path d="M6.5 9.5V19h11V9.5"/>'),
 pin:svg('<path d="M12 20.5s-6-5.4-6-10a6 6 0 0 1 12 0c0 4.6-6 10-6 10z"/><circle cx="12" cy="10.5" r="2"/>')};
const QUALITY_TEXT={beauty:['Beauté','Qualité maximale'],balanced:['Équilibré','Recommandé'],performance:['Performance','Plus fluide']};
export const MENTION_LONG='Une interprétation 3D stylisée de Maizières-la-Grande-Paroisse · représentation non contractuelle';
export const MENTION_SHORT='Interprétation 3D stylisée · non contractuelle';
const el=(tag,props={},html='')=>{const e=Object.assign(document.createElement(tag),props);if(html)e.innerHTML=html;return e;};

// views: [{name, …}] with onView(view); quality: current preset key; go(key): applies a preset (reload with the camera kept);
// names: {get():bool, toggle()}.
export function installUiV32({views,onView,quality,go,names,dataDate='',interpretation='',sources=''}){
 document.body.classList.add('ui-v32');
 // The old control row (cycling quality button, light, labels, recentre) leaves the page: its functions are in the panels.
 document.querySelector('nav')?.setAttribute('hidden','');document.querySelector('#quality')?.remove();
 const search=document.querySelector('#search');if(search&&!search.querySelector('.search-icon')){search.prepend(el('span',{className:'search-icon'},ICONS.search));const input=search.querySelector('input');input.placeholder='Rechercher un lieu, une rue…';}

 // ---- Dock ----
 const dock=el('div',{id:'dock'});dock.setAttribute('role','toolbar');dock.setAttribute('aria-label','Commandes de la carte');
 const [qName]=QUALITY_TEXT[quality]||QUALITY_TEXT.balanced;
 const bExplore=el('button',{type:'button',id:'dock-explore'},`${ICONS.explore}<span class="dock-label">Explorer</span>`);
 const bQuality=el('button',{type:'button',id:'dock-quality'},`${ICONS.quality}<span class="dock-label">Qualité</span><span class="dock-mode" aria-hidden="true">${qName}</span>`);
 const bInfo=el('button',{type:'button',id:'dock-info'},`${ICONS.info}<span class="dock-label">Informations</span>`);
 bQuality.setAttribute('aria-label',`Qualité d’affichage : ${qName}`);
 for(const [b,p] of [[bExplore,'panel-explore'],[bQuality,'panel-quality'],[bInfo,'panel-info']]){b.setAttribute('aria-expanded','false');b.setAttribute('aria-controls',p);dock.append(b);}
 document.body.append(dock);

 // ---- Quality picker: three options visible at once, one tap = applied ----
 const pq=el('div',{id:'panel-quality',className:'pop'});pq.hidden=true;pq.setAttribute('role','dialog');pq.setAttribute('aria-label','Qualité d’affichage');
 pq.append(el('p',{className:'pop-title'},'Qualité d’affichage'));
 const group=el('div',{className:'q-options'});group.setAttribute('role','radiogroup');group.setAttribute('aria-label','Qualité d’affichage');
 const opts=Object.entries(QUALITY_TEXT).map(([key,[name,sub]])=>{const b=el('button',{type:'button',className:'q-option'},`<span class="q-text"><b>${name}</b><span>${sub}</span></span><span class="q-check">${ICONS.check}</span>`);
  b.dataset.q=key;b.setAttribute('role','radio');b.setAttribute('aria-checked',String(key===quality));b.addEventListener('click',()=>{if(key===quality){closeAll(true);return;}for(const o of opts)o.setAttribute('aria-checked',String(o===b));b.classList.add('pending');closeAll(false);go(key);});group.append(b);return b;});
 group.addEventListener('keydown',e=>{const i=opts.indexOf(document.activeElement);if(i<0)return;const k=e.key==='ArrowDown'||e.key==='ArrowRight'?1:e.key==='ArrowUp'||e.key==='ArrowLeft'?-1:0;if(k){opts[(i+k+opts.length)%opts.length].focus();e.preventDefault();}});
 pq.append(group,el('p',{className:'pop-note'},'La carte se recharge au même endroit.'));

 // ---- Explorer: quick views, place names, legend ----
 const pe=el('div',{id:'panel-explore',className:'pop'});pe.hidden=true;pe.setAttribute('role','dialog');pe.setAttribute('aria-label','Explorer la carte');
 pe.append(el('p',{className:'pop-title'},'Aller à'));
 const grid=el('div',{className:'views-grid'});
 for(const v of views){const b=el('button',{type:'button',className:'view-chip'+(v.reset?' home':'')},`${v.reset?ICONS.home:ICONS.pin}<span>${v.name}</span>`);b.addEventListener('click',()=>{onView(v);closeAll(false);});grid.append(b);}
 const sw=el('button',{type:'button',className:'switch',id:'names-switch'},'<span class="switch-track"><span class="switch-knob"></span></span>');sw.setAttribute('role','switch');sw.setAttribute('aria-checked',String(names.get()));sw.setAttribute('aria-labelledby','names-switch-label');
 sw.addEventListener('click',()=>{names.toggle();sw.setAttribute('aria-checked',String(names.get()));});
 const row=el('div',{className:'switch-row'});row.append(el('span',{id:'names-switch-label'},'Noms des lieux'),sw);
 const legend=el('details',{className:'legend-v32'});legend.append(el('summary',{},'Légende'));const ul=el('ul');
 for(const [t,c] of LEGEND_ITEMS){const li=el('li',{},'<i></i><span></span>');li.querySelector('i').style.background=c;li.querySelector('span').textContent=t;ul.append(li);}legend.append(ul);
 pe.append(grid,el('hr'),row,legend);

 // ---- Informations ----
 const pi=el('aside',{id:'panel-info'});pi.hidden=true;pi.setAttribute('role','dialog');pi.setAttribute('aria-labelledby','info-title');
 pi.innerHTML=`<button type="button" class="panel-close" aria-label="Fermer les informations">${ICONS.close}</button>
  <p class="kicker">Informations</p><h2 id="info-title">À propos de la carte</h2>
  <p>Cette carte est une interprétation 3D stylisée de Maizières-la-Grande-Paroisse, créée à partir de données géographiques et documentaires réelles.</p>
  <p>Certains bâtiments, matériaux, détails paysagers et éléments visuels sont simplifiés ou interprétés pour les besoins de la représentation.</p>
  <p>Elle ne constitue pas une représentation contractuelle ni un relevé architectural de précision.</p>
  ${interpretation?`<p>${interpretation}</p>`:''}
  <h3>Naviguer</h3>
  <ul class="info-list"><li><b>Cliquer</b> ou toucher un lieu pour l’identifier</li><li><b>Souris</b> : glisser pour tourner, clic droit pour déplacer, molette pour zoomer</li><li><b>Écran tactile</b> : un doigt pour déplacer, deux doigts pour tourner ou incliner, pincement pour zoomer</li><li><b>/</b> pour rechercher, <b>Échap</b> pour fermer</li></ul>
  <details class="info-sources"><summary>Sources et projet</summary><ul class="info-list">
   <li>Fond de carte : contributeurs <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> (ODbL)</li>
   <li>Bâti, relief, occupation du sol : IGN (<a href="https://geoservices.ign.fr/bdtopo" target="_blank" rel="noreferrer">BD TOPO</a>, BD ORTHO, LiDAR HD), RPG, cadastre</li>
   <li>Toponymie et lieux : sources publiques et documentation locale</li>
   ${sources}
   <li>${dataDate||'Données locales'}</li></ul>
   <p class="info-small">Maquette Maizières 3D, projet indépendant ; rendu Three.js.</p></details>`;
 pi.querySelector('.panel-close').addEventListener('click',()=>closeAll(true));
 // Keyboard order: map, search, dock and its panels, then the map labels and the footer.
 const header=document.querySelector('header');if(header)header.after(...[search,dock,pq,pe,pi].filter(Boolean));else document.body.append(pq,pe,pi);

 // ---- Non-contractual mention (permanent, discreet) ----
 const footer=document.querySelector('footer'),help=footer?.querySelector('.help');
 const mention=el('button',{type:'button',id:'mention'},`<span class="m-long">${MENTION_LONG}</span><span class="m-short">${MENTION_SHORT}</span>`);
 mention.setAttribute('aria-label',MENTION_LONG+' — ouvrir les informations');mention.addEventListener('click',()=>toggle('panel-info',mention));
 if(help)help.replaceWith(mention);else footer?.prepend(mention);

 // ---- Panel logic: one panel at a time, placed above its button, closed by Échap / outside click / choice ----
 const panels={'panel-explore':[pe,bExplore],'panel-quality':[pq,bQuality],'panel-info':[pi,bInfo]};let open=null,opener=null;
 function place(p,b){if(p===pi)return;const phone=matchMedia('(max-width:600px)').matches;if(phone){p.style.left='';p.style.bottom='';return;}
  const r=b.getBoundingClientRect(),d=dock.getBoundingClientRect();p.style.bottom=`${innerHeight-d.top+10}px`;p.style.maxHeight=`${Math.max(160,d.top-18)}px`;const w=p.offsetWidth;p.style.left=`${Math.max(12,Math.min(innerWidth-w-12,r.left+r.width/2-w/2))}px`;}
 function closeAll(refocus){if(!open)return;const [p,b]=panels[open];p.hidden=true;p.classList.remove('in');b.setAttribute('aria-expanded','false');document.body.dataset.panel='';const back=opener||b;open=null;opener=null;if(refocus)back.focus({preventScroll:true});}
 function toggle(id,from){if(open===id){closeAll(true);return;}closeAll(false);const [p,b]=panels[id];p.hidden=false;place(p,b);void p.offsetWidth;p.classList.add('in');b.setAttribute('aria-expanded','true');open=id;opener=from||b;document.body.dataset.panel=id;
  const first=id==='panel-quality'?opts.find(o=>o.getAttribute('aria-checked')==='true'):p.querySelector('button,summary,a');first?.focus({preventScroll:true});}
 bExplore.addEventListener('click',()=>toggle('panel-explore'));bQuality.addEventListener('click',()=>toggle('panel-quality'));bInfo.addEventListener('click',()=>toggle('panel-info'));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open){closeAll(true);e.stopImmediatePropagation();return;}
  if(e.key==='/'&&!/input|textarea/i.test(document.activeElement?.tagName||'')){const i=document.querySelector('#search input');if(i){i.focus();e.preventDefault();}}},true);
 document.addEventListener('pointerdown',e=>{if(!open)return;const [p,b]=panels[open];if(p.contains(e.target)||b.contains(e.target)||mention.contains(e.target))return;closeAll(false);},true);
 addEventListener('resize',()=>{if(open){const [p,b]=panels[open];place(p,b);}});
 return {open:id=>toggle(id),close:()=>closeAll(false),state:()=>open};
}
