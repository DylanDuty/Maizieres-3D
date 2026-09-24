// V1.8: writes data-sources/roads/roads-review-v1.8.json, the orthophoto review (BD ORTHO IGN 20 cm, April 2025) of the
// road reference: every OSM complement, every profile anomaly, the remaining orphan. The orthophoto is only evidence of
// existence or type; no geometry is drawn from it. Applied by scripts/build-roads.mjs.
import fs from 'node:fs';
const R=JSON.parse(fs.readFileSync('public/data/roads.geojson','utf8')).features.filter(f=>f.properties.provenance==='osm');
const V=(verdict,observation,extra={})=>({verdict,action:'conserver',observation,...extra});
// Individual verdicts (default by category below).
const special={
 'way/132363788#1':V('doublon décalé','parallèle à 5–10 m d’un chemin BD TOPO visible ; aucun second chemin sur l’orthophoto',{action:'exclure'}),
 'way/132363788#2':V('doublon décalé','parallèle à 5–10 m d’un chemin BD TOPO visible ; aucun second chemin sur l’orthophoto',{action:'exclure'}),
 'way/132008281#1':V('non vérifiable','trace à peine perceptible dans une prairie'),'way/132360758#1':V('non vérifiable','sous couvert forestier'),'way/132360758#2':V('non vérifiable','sous couvert forestier'),
 'way/150930761#1':V('non vérifiable','sous couvert forestier'),'way/150930763#1':V('non vérifiable','peupleraie, aucune trace nette'),'way/150930765#1':V('non vérifiable','sous couvert forestier, le long d’un bras d’eau'),
 'way/150930765#2':V('non vérifiable','peupleraie, aucune trace nette'),'way/150930765#3':V('non vérifiable','sous couvert forestier'),'way/150933055#1':V('non vérifiable','sous couvert forestier, parallèle à un chemin BD TOPO'),
 'way/348422458#1':V('non vérifiable','lisière boisée au bord d’un cours d’eau'),'way/348422458#2':V('non vérifiable','lisière boisée au bord d’un cours d’eau'),'way/395351636#1':V('non vérifiable','Chemin d’Outre Seine sous couvert forestier'),
 'way/234826898#1':V('non vérifiable','sous couvert forestier'),'way/602208310#1':V('non vérifiable','orthophoto floutée (zone à diffusion restreinte)'),'way/602208311#1':V('non vérifiable','orthophoto floutée (zone à diffusion restreinte)'),
 'way/602208311#2':V('non vérifiable','orthophoto floutée (zone à diffusion restreinte)'),'way/1442206467#1':V('douteux','trace herbeuse entre voies ferrées, usage non établi'),'way/1442625861#1':V('douteux','tracé posé sur la toiture d’un hangar : quai couvert ou décalage'),
 'way/1037082233#1':V('visible','piste gravillonnée vers les vestiaires du stade'),'way/150938389#1':V('visible','voie d’accès revêtue de la zone d’activité'),'way/150926831#1':V('visible','voie revêtue longeant la zone commerciale'),
 'way/588789530#1':V('visible','bande enherbée circulable entre deux parcelles'),'way/1513669510#1':V('visible','piste en terre visible')};
const byCat={voie_de_desserte:'allée ou voie de desserte revêtue visible (parking, cour, zone d’activité)',voie_locale:'voie revêtue visible',voie_pietonne:'cheminement piéton revêtu visible',sentier:'cheminement piéton visible (parvis, parc de La Belle Idée)',chemin_rural:'chemin visible'};
const osmComplements={};for(const f of R)osmComplements[f.id]=special[f.id]||V('visible',byCat[f.properties.category]||'visible');
// Profile anomalies: key = road@E,N (rounded Lambert-93) as written by build-roads.mjs.
const A=(kind,observation,extra={})=>({kind,observation,open:false,...extra});
const anomalies={
 'TRONROUT0000000009478797@758174,6825221':A('ouvrage hydraulique non répertorié','parapets visibles : l’ouvrage se prolonge au-delà du tronçon pont BD TOPO voisin (8,8 m)',{structure:true}),
 'TRONROUT0000000009480017@755742,6824163':A('ouvrage hydraulique non répertorié','le chemin franchit un ruisseau boisé : ponceau probable',{structure:true}),
 'TRONROUT0000000009481869@755461,6823860':A('ouvrage hydraulique non répertorié','exutoire d’étang sous le chemin : ponceau',{structure:true}),
 'TRONROUT0000000009481869@755469,6823866':A('ouvrage hydraulique non répertorié','exutoire d’étang sous le chemin : ponceau',{structure:true}),
 'TRONROUT0000000009481869@755477,6823872':A('ouvrage hydraulique non répertorié','exutoire d’étang sous le chemin : ponceau',{structure:true}),
 'TRONROUT0000000328328303@757950,6826148':A('relief réel','piste de motocross / carrière : buttes réelles'),'TRONROUT0000000328328306@758112,6826073':A('relief réel','piste de motocross / carrière : buttes réelles'),
 'TRONROUT0000002206426516@757997,6826070':A('relief réel','piste de motocross : buttes réelles'),'TRONROUT0000002206426516@757978,6826075':A('relief réel','piste de motocross : buttes réelles'),
 'TRONROUT0000002206426523@757899,6826108':A('relief réel','piste de motocross : buttes réelles'),'TRONROUT0000002206584849@758056,6826066':A('relief réel','piste de motocross : buttes réelles'),
 'TRONROUT0000002206986541@760847,6824678':A('relief réel','berge de la Seine'),
 'TRONROUT0000000348956755@759955,6820646':A('à vérifier','creux étroit sous le chemin de la Croix des Fourches près d’une éolienne : fossé, tranchée ou buse ?',{open:true}),
 'TRONROUT0000000348956755@759958,6820655':A('à vérifier','creux étroit sous le chemin de la Croix des Fourches près d’une éolienne : fossé, tranchée ou buse ?',{open:true}),
 'TRONROUT0000000348956755@759961,6820664':A('à vérifier','creux étroit sous le chemin de la Croix des Fourches près d’une éolienne : fossé, tranchée ou buse ?',{open:true}),
 'TRONROUT0000002344919067@756565,6822418':A('à vérifier','bosse de 1,3 m sur un chemin de la centrale photovoltaïque, rien de visible',{open:true})};
const orphans={'way/1068921271':{observation:'boucle de parking d’un restaurant de La Belle Idée : raccord réel à la voirie visible mais absent d’OSM et de la BD TOPO',open:true}};
const notes=['Pont ferroviaire BD TOPO de 19 m (757 017–757 035 / 6 823 152) : aucune route dessous ; franchissement boisé d’un fossé. Il explique la rupture du profil ferroviaire signalée en V1.7 ; la voirie n’est pas concernée.',
 'Rue du Pont de Clairvaux : pont BD TOPO de 21,7 m sur la rivière du Moulin (TRONROUT0000000009479965) ; la pente de 58 % relevée en V1.7 sur le MNT est le creux du lit sous le pont. Le tablier est interpolé (77,28 → 77,46 m).',
 'Rue de l’Orme : pont routier de 25,8 m au-dessus de la voie ferrée (BIBLE_01 § 12.6), tablier 86,3 m, 5,3 m au-dessus du MNT.',
 'Tronçon BD TOPO TRONROUT0000002203222908 : OSM le marque comme pont, la BD TOPO non ; passerelle piétonne sur un fossé visible, à confirmer.'];
fs.writeFileSync('data-sources/roads/roads-review-v1.8.json',JSON.stringify({note:'Revue V1.8 sur la BD ORTHO IGN 20 cm (vol des 28–29 avril 2025) : l’orthophoto ne sert qu’à constater l’existence, le type ou l’anomalie ; aucune géométrie n’en est tirée.',osmComplements,anomalies,orphans,notes},null,1)+'\n');
const t={};for(const v of Object.values(osmComplements))t[v.verdict]=(t[v.verdict]||0)+1;console.log(Object.keys(osmComplements).length,t);
