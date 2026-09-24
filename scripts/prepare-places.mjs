import fs from 'node:fs';
const source=JSON.parse(fs.readFileSync('data-sources/ign/zone_d_activite_ou_d_interet.geojson'));
const features=source.features.filter(f=>f.properties.insee_commune==='10220'&&f.properties.etat_de_l_objet==='En service'&&f.properties.fictif===false&&f.properties.toponyme).map(f=>({type:'Feature',id:f.properties.cleabs,geometry:f.geometry,properties:{name:f.properties.toponyme,nature:f.properties.nature,precision:f.properties.precision_planimetrique}}));
fs.writeFileSync('public/data/named-zones.geojson',JSON.stringify({type:'FeatureCollection',metadata:{source:'IGN BD TOPO',license:'Licence Ouverte 2.0',retrievedAt:source.metadata.retrievedAt,note:'Polygones nommés non fictifs uniquement ; sert à la sélection, sans modifier le terrain.'},features}));
console.log(features.length+' zones IGN nommées préparées');
