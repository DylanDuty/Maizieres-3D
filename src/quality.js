// Quality modes. V2.0 adds "very-fluid" for old machines (lower resolution, lighter texture, no hedge walls); shadows only in "high".
export const QUALITY_LABELS={'very-fluid':'Très fluide',fluid:'Fluide',high:'Élevée'};
export const QUALITY_ORDER=['very-fluid','fluid','high'];
export function qualitySettings(mode='fluid',device={}){
 const reduced=(device.cores!=null&&device.cores<=4)||(device.memory!=null&&device.memory<=4);
 const pixelRatio=mode==='high'?Math.min(Math.max(device.dpr||1,1.25),1.5):mode==='very-fluid'?Math.min(device.dpr||1,.8):Math.min(device.dpr||1,reduced?1:1.25);
 return {mode,pixelRatio,shadowSize:mode==='high'?2048:1024};
}
