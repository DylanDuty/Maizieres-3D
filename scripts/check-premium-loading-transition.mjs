// V3.4.1 check:premium-loading-transition — premium loading / quality-change screen: bootstrap before the first paint,
// first opening vs quality change, honest states (ready after a presented frame, failure with a working retry), no legacy
// control row in premium modes, historic modes untouched. Runs without a browser: the bootstrap and the controller are
// executed against a minimal DOM stand-in; the browser behaviour itself is covered by the Chromium QA (docs/qa/v3.4.1-loading).
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const ok=m=>console.log('PASS '+m);
const html=fs.readFileSync('index.html','utf8'),main=fs.readFileSync('src/main.js','utf8'),ui=fs.readFileSync('src/v32/ui-v32.js','utf8');
const M=await import('../src/ui/loading-transition.js');

// ---- minimal DOM stand-in ----
class El{constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.parentElement=null;this.attrs={};this.dataset={};this.style={};this.listeners={};this._text='';this.hidden=false;
  const set=new Set();this.classList={add:(...c)=>c.forEach(x=>set.add(x)),remove:(...c)=>c.forEach(x=>set.delete(x)),contains:c=>set.has(c),toggle:c=>set.has(c)?(set.delete(c),false):(set.add(c),true),get size(){return set.size;}};this._set=set;}
 set className(v){this._set.clear();String(v).split(/\s+/).filter(Boolean).forEach(c=>this._set.add(c));}get className(){return [...this._set].join(' ');}
 set id(v){this.attrs.id=v;}get id(){return this.attrs.id||'';}
 setAttribute(k,v){this.attrs[k]=String(v);if(k==='class')this.className=v;}getAttribute(k){return k in this.attrs?this.attrs[k]:null;}removeAttribute(k){delete this.attrs[k];}hasAttribute(k){return k in this.attrs;}
 append(...n){for(const c of n){c.parentElement?.children.splice(c.parentElement.children.indexOf(c),1);c.parentElement=this;this.children.push(c);}}appendChild(c){this.append(c);return c;}prepend(c){this.append(c);this.children.unshift(this.children.pop());}
 remove(){if(this.parentElement){this.parentElement.children.splice(this.parentElement.children.indexOf(this),1);this.parentElement=null;}}
 get isConnected(){let n=this;while(n.parentElement)n=n.parentElement;return n===this.ownerDocument.documentElement;}
 set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
 set innerHTML(v){this.children=[];this._text='';for(const [,t] of String(v).matchAll(/<(\w+)[^>]*>/g))if(!/^\//.test(t))this.append(this.ownerDocument.createElement(t));}
 matches(s){if(s.startsWith('.'))return this.classList.contains(s.slice(1));if(s.startsWith('#'))return this.id===s.slice(1);return this.tagName===s.toUpperCase();}
 querySelectorAll(s){const out=[];const walk=n=>{for(const c of n.children){if(c.matches(s))out.push(c);walk(c);}};walk(this);return out;}querySelector(s){return this.querySelectorAll(s)[0]||null;}
 addEventListener(t,f){(this.listeners[t]??=[]).push(f);}removeEventListener(t,f){this.listeners[t]=(this.listeners[t]||[]).filter(x=>x!==f);}dispatch(t,e={}){for(const f of [...(this.listeners[t]||[])])f({type:t,target:this,...e});}
 focus(){this.ownerDocument.activeElement=this;}click(){this.dispatch('click');}}
function makeDoc(){const doc={activeElement:null,listeners:{}};doc.createElement=t=>new El(t,doc);doc.documentElement=new El('html',doc);doc.head=doc.createElement('head');doc.body=doc.createElement('body');doc.documentElement.append(doc.head,doc.body);
 doc.getElementById=id=>doc.documentElement.querySelector('#'+id);doc.querySelector=s=>doc.documentElement.querySelector(s);doc.addEventListener=(t,f)=>{(doc.listeners[t]??=[]).push(f);};return doc;}
// #loading exactly as index.html writes it
function loadingOf(doc){const L=doc.createElement('div');L.id='loading';L.setAttribute('role','status');L.setAttribute('aria-live','polite');
 const legacy=[doc.createElement('div'),doc.createElement('strong'),doc.createElement('span')];legacy[0].className='spinner';legacy[1].textContent='Le village prend forme';
 const snap=doc.createElement('div');snap.className='tx-snap';const c=doc.createElement('div');c.className='tx-content';
 // static texts taken from the markup of index.html
 for(const k of ['tx-brand','tx-title','tx-sub','tx-line','tx-note']){const e=doc.createElement(k==='tx-line'?'div':'p');e.className=k;e.textContent=(html.match(new RegExp(`class="${k}"[^>]*>([^<]*)<`))||[])[1]||'';c.append(e);}
 L.append(...legacy,snap,c);doc.body.append(L);return L;}
const storage=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),_m:m};};
// the two inline scripts of index.html
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);assert.equal(scripts.length,2,'deux scripts en ligne attendus (amorçage, textes)');
function runBoot({query,store=storage(),now=Date.now()}){const doc=makeDoc();const L=loadingOf(doc);
 const win={sessionStorage:store,location:{search:query,reload(){win.reloaded=(win.reloaded||0)+1;}},URLSearchParams,Date:{now:()=>now},JSON};win.window=win;win.document=doc;
 const ctx=vm.createContext(win);vm.runInContext(scripts[0],ctx);vm.runInContext(scripts[1],ctx);return {doc,L,boot:win.__MLGU_BOOT__,store,win};}

// 1. bootstrap placed before anything else can paint, and only for the premium modes
const iBoot=html.indexOf('<script>'),iStyle=html.indexOf('<style>'),iModule=html.indexOf('type="module"'),iNav=html.indexOf('<nav'),iLoading=html.indexOf('id="loading"');
assert.ok(iBoot>0&&iBoot<html.indexOf('</head>')&&iStyle<html.indexOf('</head>'),'amorçage et style critique dans <head>');assert.ok(iBoot<iNav&&iBoot<iModule&&iStyle<iNav,'amorçage avant la barre historique et le module');
assert.ok(html.indexOf('<script>',iLoading)>iLoading&&html.indexOf('<script>',iLoading)<html.indexOf('<div class="compass"'),'textes posés juste après #loading');
for(const rule of ['html.mlgu-ui nav','html.mlgu-ui #quality','html.mlgu-ui footer .help','html.tx-active body>*:not(#loading):not(#map){visibility:hidden'])assert.ok(html.includes(rule),'règle critique absente : '+rule);
for(const [q,premium] of [['?visual=premium-v34',true],['?visual=premium-v33&v25quality=performance',true],['?visual=premium-v32',true],['?diagnostic=cadastre-v34&v33=1',true],['?visual=premium-v31',false],['?visual=cartoon-v291',false],['',false],['?diagnostic=poi',false],['?visual=premium-v35',false]]){
 const {doc,L,boot}=runBoot({query:q});assert.equal(boot.premium,premium,q);assert.equal(doc.documentElement.classList.contains('mlgu-ui'),premium,q);assert.equal(L.classList.contains('tx'),premium,q);assert.equal(doc.body.classList.contains('ui-v32'),premium,q);}
ok('1. amorçage dans <head>, avant la barre historique et le module : modes premium-v32 / v33 / v34 et diagnostic cadastral seulement ; barre, bouton « Qualité : Fluide » et pied de page souris masqués dès le premier affichage ; modes historiques intacts');

// 2. first opening vs quality change, hand-off consumed once, never on an ordinary visit
const q34='?visual=premium-v34&v25quality=beauty&cam=1,2,3,4,5,6';
let r=runBoot({query:q34});assert.equal(r.boot.kind,'first');assert.equal(r.L.querySelector('.tx-title').textContent,'Découvrir Maizières');assert.equal(r.L.querySelector('.tx-sub').textContent,'Préparation de la carte…');
const st=storage();st.setItem(M.HANDOFF_KEY,JSON.stringify({kind:'quality',target:'beauty',cam:'1,2,3,4,5,6',view:{names:false},t:Date.now()}));st.setItem(M.SNAPSHOT_KEY,'data:image/jpeg;base64,AAAA');
r=runBoot({query:q34,store:st});assert.equal(r.boot.kind,'quality');assert.equal(r.L.querySelector('.tx-title').textContent,'Préparation du rendu');assert.equal(r.L.querySelector('.tx-sub').textContent,'Passage en mode Beauté');
assert.equal(r.L.querySelector('.tx-note').textContent,'La carte reprend au même endroit.');assert.ok(r.L.classList.contains('tx-has-snap'));assert.deepEqual(r.boot.view,{names:false});assert.equal(st._m.size,0,'transmission consommée');
r=runBoot({query:q34,store:st});assert.equal(r.boot.kind,'first','une seule consommation');
for(const [label,h,q] of [['autre préset',{target:'performance',cam:'1,2,3,4,5,6'},q34],['autre caméra',{target:'beauty',cam:'9,9,9,9,9,9'},q34],['expirée',{target:'beauty',cam:'1,2,3,4,5,6',t:Date.now()-M.HANDOFF_TTL-1},q34],['mode historique',{target:'beauty',cam:'1,2,3,4,5,6'},'?visual=premium-v31&v25quality=beauty&cam=1,2,3,4,5,6']]){
 const s=storage();s.setItem(M.HANDOFF_KEY,JSON.stringify({kind:'quality',t:Date.now(),...h}));const b=runBoot({query:q,store:s}).boot;assert.notEqual(b.kind,'quality',label);}
for(const [k,name] of Object.entries(M.QUALITY_NAMES)){const s=storage();s.setItem(M.HANDOFF_KEY,JSON.stringify({kind:'quality',target:k,cam:null,t:Date.now()}));const x=runBoot({query:`?visual=premium-v34&v25quality=${k}`,store:s});assert.equal(x.L.querySelector('.tx-sub').textContent,`Passage en mode ${name}`);assert.equal(M.TRANSITION_TEXT.quality.sub(k),`Passage en mode ${name}`);}
// snapshot: only a JPEG data URL is ever put in the style
const s2=storage();s2.setItem(M.HANDOFF_KEY,JSON.stringify({kind:'quality',target:'beauty',cam:null,t:Date.now()}));s2.setItem(M.SNAPSHOT_KEY,'javascript:alert(1)');assert.ok(!runBoot({query:'?visual=premium-v34&v25quality=beauty',store:s2}).L.classList.contains('tx-has-snap'));
// the same texts in the bootstrap and in the module
for(const t of [M.TRANSITION_TEXT.brand,M.TRANSITION_TEXT.first.title,M.TRANSITION_TEXT.first.sub,M.TRANSITION_TEXT.quality.title,M.TRANSITION_TEXT.quality.note,M.TRANSITION_TEXT.error.title,M.TRANSITION_TEXT.error.retry,...Object.values(M.QUALITY_NAMES)])assert.ok(html.includes(t),'texte absent de index.html : '+t);
const premiumMarkup=html.slice(html.indexOf('class="tx-content"'),html.indexOf('</div></div>',html.indexOf('class="tx-content"')));assert.ok(!/Fluide|spinner/.test(premiumMarkup)&&!/Fluide/.test(JSON.stringify(M.TRANSITION_TEXT))&&!/Fluide/.test(scripts.join('')),'« Fluide » ou spinner dans l’écran premium');
ok('2. première ouverture « Découvrir Maizières » ; changement « Préparation du rendu · Passage en mode Beauté / Équilibré / Performance » ; transmission consommée une fois, refusée si préset, caméra ou mode diffèrent ou après 60 s ; aucun « Fluide »');

// 3. controller: no double transition, ready after a presented frame, fail with a working retry, reset
const frames=[];const raf=f=>frames.push(f);const flush=()=>{const f=frames.splice(0);f.forEach(x=>x());return f.length;};
const timers=[];const realSet=globalThis.setTimeout,realClear=globalThis.clearTimeout;globalThis.setTimeout=(f,ms)=>{timers.push({f,ms,on:true});return timers.length;};globalThis.clearTimeout=id=>{if(id&&timers[id-1])timers[id-1].on=false;};
globalThis.location={reload(){globalThis.location.reloads=(globalThis.location.reloads||0)+1;}};globalThis.window={sessionStorage:storage()};
try{
 r=runBoot({query:'?visual=premium-v34&v25quality=balanced'});const doc=r.doc;let clock=0;
 const T=M.createLoadingTransition({root:r.L,boot:r.boot,doc,raf,now:()=>clock});assert.equal(T.state,'loading');assert.equal(T.kind,'first');
 // slow message only after SLOW_AFTER, measured from the navigation start
 const slow=timers.filter(t=>t.on).at(-1);assert.equal(slow.ms,M.SLOW_AFTER);slow.f();assert.ok(r.L.classList.contains('tx-slow'));assert.equal(r.L.querySelector('.tx-note').textContent,M.TRANSITION_TEXT.slow);
 // ready: nothing before two animation frames, then the fade, then the element leaves
 const p=T.ready();assert.equal(T.state,'leaving');assert.ok(r.L.isConnected);assert.equal(flush(),1);assert.ok(r.L.isConnected&&!r.L.classList.contains('tx-leave'),'pas de sortie avant la présentation de l’image');assert.equal(flush(),1);
 assert.ok(r.L.classList.contains('tx-leave'));assert.ok(!doc.documentElement.classList.contains('tx-active'));r.L.dispatch('transitionend');assert.equal(await p,true);assert.equal(T.state,'ready');assert.ok(!r.L.isConnected,'#loading retiré');
 assert.equal(await T.ready(),false,'ready() une seule fois');
 // quality change in the page: the target screen, once
 assert.equal(T.start({kind:'quality',targetQuality:'performance'}),true);assert.ok(r.L.isConnected&&doc.documentElement.classList.contains('tx-active'));assert.equal(r.L.querySelector('.tx-sub').textContent,'Passage en mode Performance');assert.ok(!r.L.classList.contains('tx-slow'),'état lent remis à zéro');
 assert.equal(T.start({kind:'quality',targetQuality:'performance'}),false,'double clic : pas de seconde transition');
 assert.equal(T.handoff({target:'performance',cam:'1,2,3,4,5,6',snapshot:'data:image/jpeg;base64,AA',view:{names:true,sel:null,det:false}}),true);assert.equal(JSON.parse(window.sessionStorage.getItem(M.HANDOFF_KEY)).target,'performance');
 // failure: animation stopped, announced, retry reloads the same preset
 T.fail(Error('ressource manquante'));assert.equal(T.state,'failed');assert.ok(r.L.classList.contains('tx-failed'));const box=r.L.querySelector('.tx-error');assert.equal(box.getAttribute('role'),'alert');assert.equal(r.L.querySelector('.tx-title').textContent,M.TRANSITION_TEXT.error.title);
 const retry=r.L.querySelector('.tx-retry');assert.equal(retry.textContent,'Réessayer');assert.equal(doc.activeElement,retry,'focus sur Réessayer');assert.equal(r.L.querySelectorAll('.tx-retry').length,1);T.fail(Error('encore'));assert.equal(r.L.querySelectorAll('.tx-retry').length,1,'pas de second bouton');
 window.sessionStorage.removeItem(M.HANDOFF_KEY);retry.click();assert.equal(globalThis.location.reloads,1);assert.equal(JSON.parse(window.sessionStorage.getItem(M.HANDOFF_KEY)).target,'performance','réessai du même préset');
 assert.ok(/tx-failed \.tx-line\{display:none\}/.test(html),'ligne arrêtée en échec');
 // reset (back-forward cache): nothing left over the map
 T.reset();assert.equal(T.state,'idle');assert.ok(!r.L.isConnected&&!doc.documentElement.classList.contains('tx-active'));
}finally{globalThis.setTimeout=realSet;globalThis.clearTimeout=realClear;}
ok('3. contrôleur : message lent après 20 s seulement ; sortie après deux images présentées puis fondu ; pas de seconde transition ; échec annoncé (role=alert), animation arrêtée, focus et Réessayer qui recharge le même préset ; reset sans masque résiduel');

// 4. wiring of main.js: camera before the first frame, screen after the interface, one listener of each kind, historic modes unchanged
const iCam=main.indexOf('else if(restoredCam)setView('),iFirst=main.indexOf("tx?.setPhase('render');draw();"),iUi=main.indexOf('const ui=installUiV32('),iReady=main.indexOf('if(tx)await tx.ready();');
assert.ok(iCam>0&&iCam<iFirst,'caméra ?cam= appliquée avant la première image');assert.ok(iUi>0&&iReady>iUi&&iReady>iFirst,'écran fermé après l’interface et la première image');
assert.ok(main.includes('if(!tx)loading.remove();'),'les modes historiques gardent leur écran');assert.ok(!/window\.__MAIZIERES__\.view\(cam\.slice/.test(main),'ancienne restauration tardive de la caméra supprimée');
for(const [ev,n] of [['pageshow',1],['webglcontextlost',1]])assert.equal(main.split(`addEventListener('${ev}'`).length-1,n,'écoute en double : '+ev);
assert.ok(/if\(going\|\|key===v25Quality\)return;going=true;/.test(main),'changement engagé une seule fois');assert.ok(main.includes("q.set('cam',cam)")&&main.includes("q.set('v25quality',key)")&&main.includes("q.set('visual',visualParam)"),'URL : préset, mode et caméra');
assert.ok(main.includes('const q=new URLSearchParams(params)'),'paramètres conservés (fxaa, manual, diagnostic…)');assert.ok(main.includes('if(tx){tx.fail(error);return;}'),'erreur de démarrage');
assert.ok(ui.includes("if(key===quality){closeAll(true);return;}"),'même préset : aucun rechargement');assert.ok(ui.includes('setQuality:key=>'),'sélecteur resynchronisable');
for(const k of ['beauty','balanced','performance'])assert.ok(ui.includes(`${k}:[`)||new RegExp(`${k}:\\[`).test(ui),'préset absent du sélecteur : '+k);
ok('4. main.js : caméra restaurée avant la première image, écran fermé après l’interface ; une écoute pageshow et une webglcontextlost ; changement engagé une fois avec préset, mode, caméra et paramètres conservés ; trois présets directs ; modes historiques inchangés');

// 5. accessibility and motion
assert.ok(/id="loading" role="status" aria-live="polite"/.test(html));assert.ok(/@media\(prefers-reduced-motion:reduce\)\{[^}]*\.tx-content\{animation:none\}[^}]*\.tx-line i\{width:100%;opacity:\.35;animation:tx-pulse/.test(html),'mouvement réduit');
assert.ok(!/@import|fonts\.googleapis|<link[^>]+font/i.test(html),'aucune police externe');assert.ok(!/\b\d{1,3}\s?%<\/|progress/i.test(html.slice(html.indexOf('class="tx-content"'),html.indexOf('</div></div>',html.indexOf('class="tx-content"')))),'aucun pourcentage');
ok('5. role=status, aria-live=polite, erreur en role=alert ; sous prefers-reduced-motion, aucun déplacement (ligne fixe, pulsation d’opacité) ; aucune police externe, aucun pourcentage');
