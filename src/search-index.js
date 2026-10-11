// Search index of the map (V2.0, V2.9.2): one entry per normalised name; a certified place is also found by its documented
// variants (searchAliases). Pure functions: used by the search box (src/v2-ui.js) and by scripts/check-search-targets.mjs.
export const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[’'`\-]/g,' ').replace(/\s+/g,' ').trim();
export const rank=r=>r.poi?(r.poi.landmark?0:['secteur','lieu_dit'].includes(r.poi.category)?1:2):r.type==='line'?1.5:3;
export function buildSearchIndex(records){const seen=new Map();
 for(const r of records){if(r.searchable===false||!r.name||r.generic)continue;for(const name of [r.name,...(r.searchAliases||[])]){const k=norm(name);const prev=seen.get(k);if(!prev||rank(r)<rank(prev.r))seen.set(k,{r,k});}}
 return [...seen.values()];}
export function searchIndex(index,query,limit=8){const q=norm(query);if(q.length<2)return [];const words=q.split(' ');
 const hits=index.filter(o=>words.every(w=>o.k.includes(w))).sort((a,b)=>(a.k.startsWith(q)?0:1)-(b.k.startsWith(q)?0:1)||rank(a.r)-rank(b.r)||a.k.length-b.k.length);
 return hits.filter((o,i)=>hits.findIndex(h=>h.r===o.r)===i).slice(0,limit);}
