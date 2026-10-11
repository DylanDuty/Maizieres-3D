// V2.9.2 check:road-names — every clickable street carries its official name, on the tronçons the map draws.
// 1. the runtime projection is the register (same roads, names, tronçons); each drawn tronçon belongs to one road at most;
// 2. a tronçon with a BAN odonym (not an addressing lieu-dit) is in the road of that odonym;
// 3. every BAN street of the commune with a drawn tronçon is clickable and searchable;
// 4. explicit name transitions: D20 (D 20 → Rue Joliot-Curie → Rue Pasteur → Place Saint-Denis), D619 (Avenue du Général de
//    Gaulle in the commune, Rue Pierre Sémard in Romilly-sur-Seine), D116 through the centre;
// 5. names that contradict the BAN or are not names are gone from the view (Poussay, Chemin de la Pie, « 1000 », « 2 »…);
//    « canal de Poussey » appears nowhere in the view;
// 6. streets of neighbouring communes are clickable with their commune and are not searchable; level crossings and bridges
//    point to the right roads;
// 7. click on several portions of every street of the commune (25 %, 50 %, 75 % of each of its tronçons, in world space):
//    the street itself is the nearest clickable line, never its neighbour (junction points within 1 m excepted).
import fs from 'node:fs';import assert from 'node:assert/strict';
import {loadRuntimeCatalogue} from './runtime-catalogue.mjs';
import {norm} from './roads-screening.mjs';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),ok=m=>console.log('PASS '+m);
const REG=read('docs/freeze/MLGU_ROADS_CANONICAL_V1.json'),RT=read('src/content/roads-runtime-v292.json'),DEC=read('docs/freeze/roads-decisions-v2.9.2.json');
const REF=read('public/data/roads.geojson').features,SCENE=read('public/data/v2-scene.json'),VOIES=read('data-sources/roads/bdtopo-voie-nommee.geojson').features.map(f=>f.properties);
const short=id=>id.replace(/^TRONROUT0+/,'T'),drawn=new Set(SCENE.roads.map(r=>short(r.id.replace(/^spline:/,''))));
// 1
assert.equal(RT.roads.length,REG.roads.length);const owner=new Map();
for(const [i,r] of REG.roads.entries()){const t=RT.roads[i];assert.equal(t.id,r.road_id);assert.equal(t.name,r.canonical_name);assert.deepEqual(t.s,r.segments.map(short));assert.equal(t.searchable,r.searchable);
 for(const s of t.s){assert(drawn.has(s),'tronçon non dessiné : '+s);assert(!owner.has(s),`tronçon dans deux voies : ${s}`);owner.set(s,r);}}
ok(`1. projection = registre : ${REG.roads.length} voies, ${owner.size} tronçons dessinés nommés, aucun dans deux voies`);
// 2
const ADDR=new Set(DEC.addressingLocalities);let checked=0;
for(const f of REF){const p=f.properties,s=short(p.id);if(!drawn.has(s))continue;const streets=(p.nameBan||[]).filter(n=>!ADDR.has(n));if(!streets.length)continue;checked++;
 const r=owner.get(s);assert(r,'tronçon à odonyme BAN sans voie : '+p.id);assert(streets.some(n=>norm(n)===norm(r.canonical_name)||(DEC.display[n]&&DEC.display[n]===r.canonical_name)||r.aliases.includes(n)),`odonyme BAN ≠ nom affiché : ${p.id} ${streets} / ${r.canonical_name}`);}
ok(`2. ${checked} tronçons à odonyme BAN : chacun porte son odonyme`);
// 3
const R=loadRuntimeCatalogue(),lines=R.catalogue.records.filter(r=>r.type==='line'&&r.canonical);
// a BAN voie without type (type_voie empty) is a lieu-dit used for addressing: it may name a way (Le Chemin de la Guide) but
// is not required to; every typed voie (rue, avenue, place, chemin, impasse, voie…) must be clickable.
const streets10220=VOIES.filter(v=>v.insee_commune==='10220'&&v.nom_voie_ban&&v.type_voie&&!ADDR.has(v.nom_voie_ban));const missing=[];
for(const v of streets10220){const r=REG.roads.find(r=>r.official_ref.ban_voie.includes(v.identifiant_voie_ban));if(!r){missing.push(v.nom_voie_ban);continue;}
 const rec=lines.find(l=>l.id===r.road_id);assert(rec,'voie BAN non cliquable : '+v.nom_voie_ban);
 // a square that is also a certified place is searched through the place (same name), not twice
 if(r.insee==='10220')assert(rec.searchable!==false||R.catalogue.records.some(x=>x.poi&&norm(x.name)===norm(rec.name)),'voie BAN non cherchable : '+v.nom_voie_ban);}
assert.equal(missing.length,0,'voies BAN de la commune absentes du registre : '+missing.join(', '));
ok(`3. ${streets10220.length} voies BAN typées de la commune : toutes cliquables et cherchables`);
// 4
const seq=k=>REG.transitions[k][0].map(s=>s.name);
const d20=seq('D 20');for(const n of ['Rue Joliot-Curie','Rue Pasteur','Place Saint-Denis'])assert(d20.includes(n),'D20 : '+n+' absent de la séquence');
assert(d20.indexOf('Rue Joliot-Curie')<d20.indexOf('Rue Pasteur')&&d20.indexOf('Rue Pasteur')<d20.indexOf('Place Saint-Denis'),'D20 : ordre des noms');
const d619=REG.roads.filter(r=>r.official_ref.route.includes('D619')||r.official_ref.route.includes('D 619'));
assert(d619.some(r=>r.canonical_name==='Avenue du Général de Gaulle'&&r.insee==='10220'));assert(d619.some(r=>r.canonical_name==='Rue Pierre Sémard'&&r.insee==='10323'));
assert(!REG.roads.some(r=>r.canonical_name==='Rue Pierre Sémard'&&r.insee==='10220'),'Rue Pierre Sémard dans la commune');
const d116=seq('D 116');for(const n of ['Rue de la Paix','Rue de la République','Rue du Général Leclerc','Rue Georges Pompidou'])assert(d116.includes(n),'D116 : '+n);
ok(`4. transitions : D20 ${d20.join(' → ')} ; D619 Avenue du Général de Gaulle (commune) / Rue Pierre Sémard (Romilly-sur-Seine) ; D116 ${d116.join(' → ')}`);
// 5
const shown=R.catalogue.records.filter(r=>r.type==='line').map(r=>r.name);
for(const bad of ['Rue Basse de Poussay','Chemin de la Pie','Placette Léopoldine Deschamps','Avenue du Maréchal de Lattre de Tassigny','Rue du Pont Bancelin','Rue Patris','Rue des Cotterets','1','2','3','4','1000'])assert(!shown.includes(bad),'nom fautif encore affiché : '+bad);
const view=JSON.stringify(R.catalogue.records.map(r=>[r.name,r.searchAliases]))+fs.readFileSync('src/content/place-stories-v29.js','utf8')+JSON.stringify(RT)+JSON.stringify(read('src/content/places-runtime-v292.json'));
assert(!/canal de poussey/i.test(view),'« canal de Poussey » affiché');
ok(`5. ${shown.length} voies cliquables (dont ${shown.filter(n=>/Voie ferrée|Ligne/.test(n)).length} ferroviaires) : aucun nom contredisant la BAN, aucun numéro pris pour un nom ; « canal de Poussey » absent de la vue`);
// 6
for(const l of lines.filter(l=>REG.roads.find(r=>r.road_id===l.id).insee!=='10220')){assert(l.commune,'voie hors commune sans commune : '+l.name);assert.equal(l.searchable,false,'voie hors commune cherchable : '+l.name);}
const pn=REG.rail.levelCrossings;assert.deepEqual(pn.map(p=>p.number),[70,71,73,74]);for(const p of pn.filter(p=>p.in_commune))assert(p.interactive,'PN de la commune non interactif : '+p.id);
assert.equal(pn.find(p=>p.number===71).road,'Rue du Pot Bancelin');assert.equal(pn.find(p=>p.number===73).road,'Rue du Général Leclerc');
const br=Object.fromEntries(REG.bridges.places.map(b=>[b.id,b]));assert.equal(br['poi:pont-de-clairvaux'].bridges[0].road,'Rue du Pont de Clairvaux');assert.deepEqual(br['poi:pont-rue-de-l-orme'].bridges[0].crosses,['voie ferrée']);assert.deepEqual(br['poi:pont-seine'].bridges[0].crosses,['La Seine']);
ok(`6. ${lines.filter(l=>l.commune).length} voies des communes voisines : commune affichée, hors recherche ; PN 71, 73, 74 interactifs (PN 70 hors commune) ; ponts de Clairvaux, de la rue de l’Orme et sur la Seine rattachés à leur voie et à l’obstacle franchi`);
// 7
const segDist=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
const lineDist=(p,r)=>{let b=Infinity;for(const l of r.lines)for(let i=1;i<l.length;i++)b=Math.min(b,segDist(p,l[i-1],l[i]));return b;};
const at=(l,f)=>{let tot=0;for(let i=1;i<l.length;i++)tot+=Math.hypot(l[i][0]-l[i-1][0],l[i][1]-l[i-1][1]);let goal=tot*f;for(let i=1;i<l.length;i++){const s=Math.hypot(l[i][0]-l[i-1][0],l[i][1]-l[i-1][1]);if(goal<=s){const k=s?goal/s:0;return [l[i-1][0]+(l[i][0]-l[i-1][0])*k,l[i-1][1]+(l[i][1]-l[i-1][1])*k];}goal-=s;}return l.at(-1);};
const allLines=R.catalogue.records.filter(r=>r.type==='line');let clicks=0,junction=0;const wrong=[];
for(const r of lines.filter(l=>!l.commune))for(const l of r.lines)for(const f of [.25,.5,.75]){const p=at(l,f);const best=allLines.map(o=>[lineDist(p,o),o]).sort((a,b)=>a[0]-b[0]);clicks++;
 if(best[0][1]===r)continue;const own=best.find(([,o])=>o===r)[0];if(own-best[0][0]<1){junction++;continue;}wrong.push(`${r.name} → ${best[0][1].name}`);}
assert.equal(wrong.length,0,'clic sur une portion qui sélectionne la voie voisine : '+wrong.slice(0,10).join(', '));
ok(`7. ${clicks} clics simulés (25, 50, 75 % de chaque tronçon des ${lines.filter(l=>!l.commune).length} voies de la commune) : la voie elle-même, jamais sa voisine (${junction} points de carrefour à moins de 1 m)`);
