import * as THREE from 'three';

// Touch gestures on the map, as in map applications: one finger moves the map; two fingers turn it (twisting the
// fingers, or dragging both sideways), tilt it (dragging both up or down) and zoom (pinch). The mouse keeps its
// bindings (left button turns, right button moves, wheel zooms).
// OrbitControls handles one-finger pan and two-finger pinch / drag (TOUCH.DOLLY_ROTATE); the twist is added here: the
// change of angle between the two fingers turns the camera around the target by the same angle, so the map follows
// the fingers.
export function installTouchGestures(controls,camera,element){
 controls.touches={ONE:THREE.TOUCH.PAN,TWO:THREE.TOUCH.DOLLY_ROTATE};
 const touches=new Map(),up=new THREE.Vector3(0,1,0),offset=new THREE.Vector3();let previous=null;
 const angle=()=>{const [a,b]=[...touches.values()];return Math.atan2(b.y-a.y,b.x-a.x);};
 const reset=()=>{previous=touches.size===2?angle():null;};
 element.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});reset();});
 element.addEventListener('pointermove',e=>{const t=touches.get(e.pointerId);if(!t)return;t.x=e.clientX;t.y=e.clientY;
  if(previous===null||touches.size!==2||!controls.enabled)return;const a=angle();let d=a-previous;d=Math.atan2(Math.sin(d),Math.cos(d));previous=a;
  if(Math.abs(d)<1e-4)return;offset.copy(camera.position).sub(controls.target).applyAxisAngle(up,d);camera.position.copy(controls.target).add(offset);controls.update();});
 const end=e=>{if(touches.delete(e.pointerId))reset();};
 element.addEventListener('pointerup',end);element.addEventListener('pointercancel',end);
}
