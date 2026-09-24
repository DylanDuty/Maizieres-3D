// Opt-in QA only: identical camera path for before/after comparisons, no persistent animation.
export async function benchmark({camera,controls,draw,canvas,reset}){
 const frame=()=>new Promise(requestAnimationFrame),times=[];let previous;
 const position=camera.position.clone(),target=controls.target.clone(),damping=controls.enableDamping;
 controls.enableDamping=false;
 canvas.dataset.benchmark='running';
 for(let i=0;i<105;i++){
  const now=await frame();if(i>15)times.push(now-previous);previous=now;
  const phase=i/104*Math.PI*2,zoom=1-.24*Math.sin(phase*.5),angle=.28*Math.sin(phase);
  const x=position.x-target.x,z=position.z-target.z;
  controls.target.copy(target);controls.target.x+=90*Math.sin(phase);
  camera.position.set(controls.target.x+(x*Math.cos(angle)+z*Math.sin(angle))*zoom,position.y*zoom,controls.target.z+(-x*Math.sin(angle)+z*Math.cos(angle))*zoom);
  draw();
 }
 const sorted=[...times].sort((a,b)=>a-b),mean=times.reduce((a,b)=>a+b,0)/times.length;
 canvas.dataset.benchmark=JSON.stringify({frames:times.length,meanMs:+mean.toFixed(2),fps:+(1000/mean).toFixed(1),medianMs:+sorted[Math.floor(sorted.length*.5)].toFixed(2),p95Ms:+sorted[Math.floor(sorted.length*.95)].toFixed(2),visibility:document.visibilityState,viewport:[innerWidth,innerHeight],drawingBuffer:[canvas.width,canvas.height]});
 controls.enableDamping=damping;reset();
}
