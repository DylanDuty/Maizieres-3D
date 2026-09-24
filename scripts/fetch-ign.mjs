import fs from 'node:fs/promises';
const bbox=[3.75,48.476,3.83,48.533];
await fs.mkdir('data-sources/ign',{recursive:true});
for(const layer of ['batiment','zone_de_vegetation','zone_d_activite_ou_d_interet']){
 const file=`data-sources/ign/${layer}.geojson`;try{await fs.access(file);console.log(layer,'déjà téléchargé');continue;}catch{}
 const features=[];let expected=Infinity;const requests=[];
 while(features.length<expected){
  const params=new URLSearchParams({service:'WFS',version:'2.0.0',request:'GetFeature',typeNames:`BDTOPO_V3:${layer}`,outputFormat:'application/json',srsName:'urn:ogc:def:crs:OGC:1.3:CRS84',bbox:[...bbox,'urn:ogc:def:crs:OGC:1.3:CRS84'].join(','),count:'5000',startIndex:String(features.length)});
  const url='https://data.geopf.fr/wfs/ows?'+params;console.log('IGN :',layer,'index',features.length);
  const r=await fetch(url,{signal:AbortSignal.timeout(90000)}),text=await r.text();if(!r.ok||!text.trimStart().startsWith('{'))throw Error(`${layer} : réponse WFS invalide (${r.status})`);
  const data=JSON.parse(text);if(!data.features?.length){if(Number(data.numberMatched)===0&&features.length===0){expected=0;break;}throw Error(`${layer} : pagination interrompue ; aucun instantané partiel enregistré`);}
  features.push(...data.features);requests.push(url);expected=Number(data.numberMatched)||features.length;
  if(features.length>12000)throw Error('Emprise inattendue');
 }
 if(features.length){await fs.writeFile(file,JSON.stringify({type:'FeatureCollection',metadata:{source:'IGN BD TOPO / Géoplateforme WFS',retrievedAt:new Date().toISOString(),bbox,requests,license:'Licence Ouverte 2.0'},features}));console.log(layer,features.length,'objets');}
}
