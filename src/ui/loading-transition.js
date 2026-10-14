// V3.4.1 — loading and quality-change transition of the premium interface (premium-v32 / v33 / v34, diagnostic cadastre-v34).
// The screen itself is drawn before the first paint by the bootstrap in index.html (window.__MLGU_BOOT__); this module drives
// it afterwards: ready() when a real frame of the final view has been presented, fail() on a detected error (never an
// endless animation), and the hand-off of a quality change across the reload (sessionStorage, consumed once, expires fast).
// The progress line is indeterminate on purpose: the build is not measured, so no percentage is shown.

export const QUALITY_NAMES={beauty:'Beauté',balanced:'Équilibré',performance:'Performance'};
export const TRANSITION_TEXT={
 brand:'MAIZIÈRES 3D',
 first:{title:'Découvrir Maizières',sub:'Préparation de la carte…'},
 quality:{title:'Préparation du rendu',sub:q=>`Passage en mode ${QUALITY_NAMES[q]||QUALITY_NAMES.balanced}`,note:'La carte reprend au même endroit.'},
 slow:'Le rendu prend un peu plus de temps que prévu…',
 error:{title:'Impossible de préparer la carte.',retry:'Réessayer',details:'Détails techniques'},
 lost:'L’affichage 3D a été interrompu.'};
export const HANDOFF_KEY='mlgu-transition',SNAPSHOT_KEY='mlgu-transition-snapshot',HANDOFF_TTL=60000,SLOW_AFTER=20000;

const store=()=>{try{return window.sessionStorage;}catch{return null;}};

// Scaled-down copy of the WebGL canvas, to be called right after a draw in the same task (the drawing buffer is still valid).
// 480 px wide, JPEG: a few tens of kilobytes, a few milliseconds; null if the browser refuses.
export function snapshotOf(canvas,width=480){
 try{const w=Math.min(width,canvas.width),h=Math.max(1,Math.round(canvas.height*w/canvas.width)),c=document.createElement('canvas');c.width=w;c.height=h;
  c.getContext('2d').drawImage(canvas,0,0,w,h);return c.toDataURL('image/jpeg',.72);}catch{return null;}
}

export function createLoadingTransition({root=document.querySelector('#loading'),boot=window.__MLGU_BOOT__||{},doc=document,raf=f=>requestAnimationFrame(f),now=()=>performance.now()}={}){
 const html=doc.documentElement,body=doc.body;
 let state=root&&root.isConnected?'loading':'idle',slowTimer=0,kind=boot.kind||'first',target=boot.target||null,leaveTimer=0;
 const q=s=>root.querySelector(s);
 const setText=(sel,text)=>{const e=q(sel);if(e)e.textContent=text||'';};
 function render(){
  root.dataset.kind=kind;setText('.tx-brand',TRANSITION_TEXT.brand);
  if(kind==='quality'){setText('.tx-title',TRANSITION_TEXT.quality.title);setText('.tx-sub',TRANSITION_TEXT.quality.sub(target));setText('.tx-note',TRANSITION_TEXT.quality.note);}
  else{setText('.tx-title',TRANSITION_TEXT.first.title);setText('.tx-sub',TRANSITION_TEXT.first.sub);setText('.tx-note','');}
 }
 function armSlow(since=now()){clearTimeout(slowTimer);slowTimer=setTimeout(()=>{if(state!=='loading')return;root.classList.add('tx-slow');setText('.tx-note',TRANSITION_TEXT.slow);},Math.max(0,SLOW_AFTER-(now()-since)));}
 function show(){clearTimeout(leaveTimer);if(!root.isConnected)body.append(root);root.hidden=false;root.classList.remove('tx-leave','tx-failed','tx-slow','tx-live');root.removeAttribute('aria-busy');html.classList.add('tx-active');}
 // kind: 'first' (opening of the page) or 'quality' (change of preset, targetQuality: beauty | balanced | performance).
 function start({kind:k='first',targetQuality=null}={}){
  if(state==='loading'&&k===kind&&targetQuality===target)return false;// a second click on the same change does nothing
  kind=k;target=targetQuality;q('.tx-error')?.remove();show();render();root.setAttribute('aria-busy','true');state='loading';armSlow();
  // In the page, until the picture of the next frame is taken: the live map under the same veil.
  root.classList.toggle('tx-live',k==='quality');return true;}
 // Steps actually reached (data, scene, render): kept as an attribute for tests, not shown as a fake progress.
 function setPhase(phase){if(state==='loading')root.dataset.phase=phase;}
 // Closes the screen once the frame of the final view has been presented: two animation frames after the call (the render
 // loop draws in the first one, the browser presents it before the second), then a short fade. Resolves when done.
 function ready(){
  if(state!=='loading')return Promise.resolve(false);state='leaving';clearTimeout(slowTimer);
  return new Promise(resolve=>raf(()=>raf(()=>{
   if(state!=='leaving'){resolve(false);return;}
   root.classList.add('tx-leave');root.removeAttribute('aria-busy');html.classList.remove('tx-active');
   const done=()=>{clearTimeout(leaveTimer);root.removeEventListener('transitionend',done);if(state!=='leaving')return;root.remove();root.classList.remove('tx-leave');state='ready';resolve(true);};
   root.addEventListener('transitionend',done);leaveTimer=setTimeout(done,600);})));}
 // Detected failure: the line stops, the message is announced, the retry button reloads for real (a failed quality change
 // retries the same preset).
 function fail(error,{title=TRANSITION_TEXT.error.title}={}){
  clearTimeout(slowTimer);if(state==='failed')return;show();state='failed';root.classList.add('tx-failed');
  setText('.tx-title',title);setText('.tx-sub','');setText('.tx-note','');q('.tx-error')?.remove();
  const box=doc.createElement('div');box.className='tx-error';box.setAttribute('role','alert');
  const retry=Object.assign(doc.createElement('button'),{type:'button',className:'tx-retry',textContent:TRANSITION_TEXT.error.retry});
  retry.addEventListener('click',()=>{if(kind==='quality'&&target)handoff({target,cam:boot.cam||null});location.reload();});
  box.append(retry);
  const message=error?.message||String(error||'');if(message){const d=doc.createElement('details');d.innerHTML='<summary></summary><p></p>';d.querySelector('summary').textContent=TRANSITION_TEXT.error.details;d.querySelector('p').textContent=message;box.append(d);}
  root.querySelector('.tx-content').append(box);retry.focus({preventScroll:true});}
 // Back to nothing on screen (tests, page restored from the back-forward cache).
 function reset(){clearTimeout(slowTimer);clearTimeout(leaveTimer);q('.tx-error')?.remove();root.classList.remove('tx-leave','tx-failed','tx-slow');root.removeAttribute('aria-busy');html.classList.remove('tx-active');root.remove();state='idle';}
 // Quality change: what the next page needs to show the right screen at its first paint and to restore the view.
 function handoff({target:t,cam=null,snapshot=null,view=null}){
  const s=store();if(!s)return false;
  try{s.setItem(HANDOFF_KEY,JSON.stringify({kind:'quality',target:t,cam,view,t:Date.now()}));if(snapshot)s.setItem(SNAPSHOT_KEY,snapshot);else s.removeItem(SNAPSHOT_KEY);return true;}catch{try{s.removeItem(SNAPSHOT_KEY);}catch{}return false;}}
 // Background of the in-page screen during a quality change (the same picture the next page shows at its first paint).
 function setSnapshot(url){const layer=q('.tx-snap');if(layer&&url){layer.style.backgroundImage=`url("${url}")`;root.classList.add('tx-has-snap');}}
 if(state==='loading'){render();root.setAttribute('aria-busy','true');armSlow(0);}
 return {start,setPhase,ready,fail,reset,handoff,setSnapshot,get state(){return state;},get kind(){return kind;},get target(){return target;}};
}
