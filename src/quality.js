export function qualitySettings(mode='fluid',device={}){
 const reduced=(device.cores!=null&&device.cores<=4)||(device.memory!=null&&device.memory<=4);
 return {mode,pixelRatio:mode==='high'?Math.min(Math.max(device.dpr||1,1.25),1.5):Math.min(device.dpr||1,reduced?1:1.25),shadowSize:mode==='high'?2048:1024};
}
