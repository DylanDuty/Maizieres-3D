// Builds public/data/bible-annotations.json from the immutable Bible sources in docs/bibles/.
// Every displayed text is an exact excerpt ("quote") of a Bible file; npm run check:bible verifies it.
// Nothing here moves a geometry: annotations attach to existing OSM/IGN names, and the only derived
// point is the junction of two named OSM ways explicitly given by BIBLE 01.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const SOURCES={
 '01':'docs/bibles/BIBLE_01_CARTOGRAPHIE/source/MAIZIERES_LA_GRANDE_UCHRONIE_BIBLE_01_CARTOGRAPHIE_FINAL_V1.1.md',
 '03':'docs/bibles/BIBLE_03_PATRIMOINE/source/MAIZIERES_LA_GRANDE_UCHRONIE_BIBLE_03_PATRIMOINE_V1.0.md'
};
const text=Object.fromEntries(Object.entries(SOURCES).map(([k,p])=>[k,fs.readFileSync(p,'utf8')]));
export const normalize=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[’'`-]/g,' ').replace(/\b(le|la|les|l|du|de|des|d)\b/g,' ').replace(/\s+/g,' ').trim();
const q=(bible,section,quote)=>({bible,section,quote});

// 1. Street reference list of BIBLE 01 §4.1 (bullet lines, optional bold and comment).
const list=text['01'].split('## 4.1')[1].split('## 4.2')[0].split('\n').filter(l=>l.startsWith('- ')).map(l=>l.slice(2).replace(/\*\*/g,'').split(' — ')[0].trim());
const data=JSON.parse(fs.readFileSync('public/data/maizieres.geojson','utf8'));
const osmStreets=[...new Set(data.features.filter(f=>f.properties.highway&&f.properties.name).map(f=>f.properties.name.trim()))];
const streets={};
for(const name of osmStreets){const hit=list.find(b=>normalize(b)===normalize(name));if(hit)streets[name]={listed:q('01','4.1',hit)};}
// Documented spelling differences: both forms are shown, none is corrected.
const variants={'Rue Basse de Poussay':'Rue Basse-de-Poussey','Rue des Cotterets':'Rue des Cottrets','Rue Patris':'Rue Patris-de-Breuil','Rue du Pont Bancelin':'Rue du Pot-Bancelin'};
for(const [osm,bible] of Object.entries(variants))if(osmStreets.includes(osm))streets[osm]={...streets[osm],variant:q('01','4.1',bible)};
const sectors={
 Poussey:{quote:"Le contrôle visuel permet de lire Poussey comme un réseau cohérent organisé autour de la D20 / Rue Joliot-Curie",names:['Rue du Lavoir','Rue des Bédouins','Rue des Tabellions','Rue des Lombards','Rue des Billouts','Rue Basse de Poussay','Rue Louis Joly','Rue du Château','Rue du Docteur Calmette','Rue du Calvaire','Rue Joliot Curie']},
 'Les Granges':{quote:"**Rue Achille-Flaubert**, **Rue des Aulnes** et **Rue des Baudets** structurent la partie nord-ouest du tissu des Granges",names:['Rue Achille Flaubert','Rue des Aulnes','Rue des Baudets']}
};
for(const [sector,{quote,names}] of Object.entries(sectors))for(const n of names)if(osmStreets.includes(n))streets[n]={...streets[n],sector:{name:sector,...q('01','7.13',quote)}};
const notes={
 'Rue Joliot Curie':[q('01','7.3','La D20 constitue ainsi la **colonne vertébrale est-ouest de Poussey**')],
 'Rue Pasteur':[q('01','7.13','**Rue Pasteur** croise le corridor D116 au nord du noyau central')],
 'Rue du Calvaire':[q('01','7.4','classé au domaine public et dénommé Rue du Calvaire en 2023')],
 'Rue des Jacquets':[q('01','7.5','Prolongée de **74 m** en 2023')],
 'Rue du Général Leclerc':[q('01','12.3','La géographie converge fortement vers l\'ancien corridor de la Gare correspondant aujourd\'hui **principalement au corridor de la Rue du Général-Leclerc**'),q('01','12.3','La délibération officielle de changement de nom n\'a pas été retrouvée')],
 'Rue Ambroise Paré':[q('01','12.4','**Correction importante : Rue Ambroise-Paré ≠ ancienne Rue de la Gare dans son ensemble.**')],
 'Avenue du Général de Gaulle':[q('01','20','L\'actuel correspondant principal est la **D619 / Avenue du Général-de-Gaulle** dans le tissu bâti.')],
 'Rue des Bédouins':[q('01','14.4','ancien café Joly / Café des Bédouins'),q('01','14.4','fermeture en 2000.')],
 'Rue des Sages':[q('01','9.4','implanté sur l\'ancien terrain de football')],
 'Rue Maurice Renault':[q('01','9.1','forte correspondance spatiale avec la boucle de la rue Maurice-Renault.'),q('01','9.1','surnommé par Michel Bourcier le **« rond des tricoteuses »**')],
 'Rue des Billouts':[q('01','4.2','La forme `Billiouts` existe dans plusieurs annuaires privés et doit être conservée comme alias de recherche.')],
 'Placette Léopoldine Deschamps':[q('01','4.1','**Placette Léopoldine-Deschamps** — forme municipale privilégiée ; « Place » existe dans certaines bases')],
 'Place Adrien Quinet':[q('01','4.1','Place / Placette Adrien-Quinet — forme exacte à harmoniser')],
 'Ruelle à Rosez':[q('01','6','**Ruelle à Rosez** — **B+ comme libellé cartographique localisé**')],
 'Rue du Pont de Clairvaux':[q('01','14.4','immersion dans la rivière du Moulin vers le Pont de Clairvaux'),q('01','17.1','Pierré — repère au Pont de Clairvaux')],
 'Voie aux Vaches':[q('01','7.10','Vestiaires / stade documentés à l\'angle :')],
 'Rue du Docteur Sollier':[q('01','7.13','**Rue du Docteur-Sollier** longe le nord des Granges, au sud immédiat de la voie ferrée')],
 'Rue de la Chapelle':[q('01','7.13','**Rue de la Chapelle** descend du cœur des Granges vers la D619'),q('01','14.1','chapelle située à proximité de l\'actuel n°6 Rue de la Chapelle')],
 'Rue Victor Hugo':[q('01','7.8','**Avenue du Général-de-Gaulle ↔ Rue Victor-Hugo**.')],
 "Rue de l'Orme":[q('01','7.7','Axe entre la RD619 et le secteur du pont ferroviaire')],
 'Rue des Écoles':[q('01','11.1','Mairie : **6 rue des Écoles**'),q('01','11.1','Salle polyvalente : **3 rue des Écoles**')],
 'Rue Jules Ferry':[q('01','11.1','Maison / Salle des Associations : **2 rue Jules-Ferry**'),q('01','11.1','Accueil de loisirs Les Galopins : **1 rue Jules-Ferry**')],
 'Ruelle des Granges':[q('01','4.1','**Ruelle des Granges** — confirmée visuellement entre l\'avenue du Général-de-Gaulle et le réseau de chemins des Granges')],
 'Chemin de la Pie':[q('01','4.1','**Chemin de la Pie** — confirmé visuellement dans le secteur des Granges ; statut administratif fin à recouper')]
};
for(const [n,list] of Object.entries(notes))if(osmStreets.includes(n))streets[n]={...streets[n],notes:list};

// 2. Named places: OSM locality names matched to the lieux-dits table of BIBLE 01 §16.
const table=text['01'].split('# 16.')[1].split('# 17.')[0].split('\n').filter(l=>/^\| [^-T]/.test(l)).map(l=>l.split('|').slice(1,4).map(c=>c.trim()));
const osmPlaces=[...new Set(data.features.filter(f=>f.properties.place&&f.properties.name).map(f=>f.properties.name))];
const places={};
for(const [rawName,type,confidence] of table){const name=rawName.replace(/\*\*/g,'');for(const osm of osmPlaces)if(normalize(osm)===normalize(name))places[osm]={bibleName:name,type:q('01','16',`| ${rawName} | ${type} | ${confidence} |`),typeText:type,confidence};}
const hamlets={
 Poussey:[q('01','8.3','ancienne baronnie ;'),q('01','8.3','secteur bas et humide ;')],
 'Les Granges':[q('01','8.2','hameau historique au sud-ouest ;'),q('01','8.2','traversé par la grande route Paris–Belfort / RN19 ;'),q('01','8.2','ancien relais de Poste aux Chevaux à partir de 1740 ;')],
 'La Cave':[q('01','15','**F — La Cave**')],
 'Le Village':[q('01','7.13','le lieu-dit **Le Village** occupe le cœur du tissu central au nord des écoles.')],
 'La Station':[q('01','19.3','`La Station` existe comme lieu-dit dans des bases d\'adressage, mais rien ne prouve aujourd\'hui qu\'il s\'agisse :')],
 'La Belle Idee':[q('01','10.2','centre commercial ouvert en **2005** ;'),q('01','10.2','implanté sur le secteur de l\'ancienne base militaire / ancien aérodrome ;')]
};
for(const [n,list] of Object.entries(hamlets))if(osmPlaces.includes(n))places[n]={...places[n],notes:list};

// 3. Named equipment and zones (IGN/OSM names), Bible context only.
const named={
 'Église Saint-Denis':[q('03','3','localisation : **Place Saint-Denis**, centre ancien de Maizières ;'),q('03','3','de la **fin du XIe siècle et du début du XIIe siècle**.'),q('03','3','statut 2026 : `EXISTANT — EN RESTAURATION`.')],
 'Mairie de Maizières-la-Grande-Paroisse':[q('03','5','**6 rue des Écoles**.'),q('03','5','façade en brique et pierre ;'),q('03','5','balcon central ;')],
 'Mairie':[q('03','5','**6 rue des Écoles**.'),q('03','5','façade en brique et pierre ;')],
 'Salle polyvalente':[q('01','11.1','Salle polyvalente : **3 rue des Écoles**')],
 'Salle Polyvalente':[q('01','11.1','Salle polyvalente : **3 rue des Écoles**')],
 'Institut Médico-Éducatif Verger Fleuri':[q('01','11.2','IME Le Verger Fleuri : **21 bis rue Achille-Flaubert**.')],
 'Zone Industrielle la Glacière':[q('01','10.1','Zone Industrielle créée en **1970** ;'),q('01','10.1','distincte de La Belle Idée et du Parc de l\'Aérodrome ;')],
 "Parc de l'Aérodrome":[q('01','10.3','créé en **2012** ;'),q('01','10.3','face à La Belle Idée ;')],
 'Stade de Maizières-la-Grande-Paroisse':[q('01','7.10','Vestiaires / stade documentés à l\'angle :')],
 'École Élémentaire Publique Maizières-la-Grande-Paroisse':[q('03','5','L\'école primaire actuelle est officiellement située :')],
 'École primaire':[q('03','5','L\'école primaire actuelle est officiellement située :')]
};

// 4. Landmark located by BIBLE 01 as a junction of two existing named ways.
const landmarks=[{id:'bible01:gue-de-la-chapelle',name:'Gué de la Chapelle',kind:'Site historique transformé',junction:['Avenue du Général de Gaulle','Rue de la Chapelle'],
 location:q('01','14.1','Localisation : **angle RD619 / D160 vers Pars-lès-Romilly**.'),
 notes:[q('01','14.1','ancienne mare / abreuvoir surnommée « Mare aux Canards » ;'),q('01','14.1','ancienne chapelle fondée en 1356 ;'),q('01','14.1','ancien relais de Poste aux Chevaux à moins de 100 m ;')],
 method:'Point calculé à l\'intersection des tracés OSM de l\'avenue du Général-de-Gaulle (D 619) et de la rue de la Chapelle, carrefour où la D 160 (rue Victor-Hugo) part vers le sud.'}];

for(const k of Object.keys(named))named[k]={notes:named[k]};
const out={metadata:{note:'Annotations documentaires. Chaque texte affiché est une citation exacte d\'une Bible ; aucune géométrie source n\'est modifiée.',sources:Object.fromEntries(Object.entries(SOURCES).map(([k,p])=>[k,{path:p,sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex')}]))},streets,places,named,landmarks};
fs.writeFileSync('public/data/bible-annotations.json',JSON.stringify(out,null,1)+'\n');
console.log(JSON.stringify({streets:Object.keys(streets).length,listedStreets:Object.values(streets).filter(s=>s.listed).length,variants:Object.keys(variants).length,places:Object.keys(places).length,named:Object.keys(named).length,landmarks:landmarks.length,osmStreets:osmStreets.length}));
