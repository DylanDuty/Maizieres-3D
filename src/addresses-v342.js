// V3.4.2 — postal address of an ordinary building, read from the frozen registry (public/data/building-addresses-v3.4.2.json).
// Local index loaded once: no network call at click time. Only VERIFIED and MULTIPLE entries carry numbers; a REVIEW entry
// never shows a candidate as if it were certain. Every string goes to the page through textContent only.
export const ADDRESS_STATUS={v:'VERIFIED',m:'MULTIPLE',r:'REVIEW',u:'UNKNOWN',n:'NOT_APPLICABLE'};
export const ADDRESS_TEXT={eyebrow:'Adresse',eyebrowMany:'Adresses',many:'Plusieurs adresses',review:'Adresse à confirmer',unknown:'Adresse non renseignée',none:'Sans adresse propre',building:'Bâtiment'};
export const COMMUNE='Maizières-la-Grande-Paroisse',LIST_MAX=5;

export function createAddressIndex(json){
 if(!json?.b||!Array.isArray(json.streets)||!Array.isArray(json.communes))return null;
 const {streets,communes}=json;
 const line=([number,suffix,s,c])=>({label:`${number}${suffix?' '+suffix:''} ${streets[s]}`,commune:communes[c]});
 // root building of a part (`BATIMENT…#2`) → its own entry
 const get=id=>{const e=json.b[id]??json.b[String(id).split('#')[0]];if(!e)return null;return {status:ADDRESS_STATUS[e[0]]||'UNKNOWN',lines:(e[1]||[]).map(line)};};
 return {get,size:Object.keys(json.b).length,version:json.metadata?.version||null};
}

// What the quick label says for an ordinary building (kind: the visible family label, e.g. « Maison », « Garage »).
export function addressCard(entry,kind){
 if(!entry)return null;
 const communeOf=lines=>{const c=[...new Set(lines.map(l=>l.commune))];return c.length===1?c[0]:null;};
 if(entry.status==='VERIFIED'&&entry.lines.length===1)return {eyebrow:ADDRESS_TEXT.eyebrow,title:entry.lines[0].label,sub:entry.lines[0].commune,list:[],status:entry.status};
 if(entry.status==='MULTIPLE'||(entry.status==='VERIFIED'&&entry.lines.length>1)){const more=entry.lines.length-LIST_MAX;
  return {eyebrow:ADDRESS_TEXT.eyebrowMany,title:ADDRESS_TEXT.many,sub:communeOf(entry.lines),list:more>0?[...entry.lines.slice(0,LIST_MAX-1).map(l=>l.label),`et ${more+1} autres`]:entry.lines.map(l=>l.label),status:'MULTIPLE'};}
 if(entry.status==='REVIEW')return {eyebrow:kind||ADDRESS_TEXT.building,title:ADDRESS_TEXT.review,sub:null,list:[],status:entry.status};
 if(entry.status==='NOT_APPLICABLE')return {eyebrow:kind||ADDRESS_TEXT.building,title:ADDRESS_TEXT.none,sub:null,list:[],status:entry.status};
 return {eyebrow:kind||ADDRESS_TEXT.building,title:ADDRESS_TEXT.unknown,sub:null,list:[],status:'UNKNOWN'};
}
