// V2.9 — editorial content of the place cards. Deterministic, auditable text: every sentence comes from the local
// Bibles (docs/bibles) or from a web page whose extract is quoted in docs/audit/V2.9_JRPG_HYDRO_IMMERSIVE_UI.md.
// Tone: warm, local, precise; established facts affirmed, local memory introduced as such, nothing invented. Levels:
// A = enriched (this file), B = standard (name, category, address from the POI layer), C = minimal (roads, buildings).
// Proof levels of the Bibles stay internal; the UI shows the sources in a closed accordion only.

export const CATEGORY_LABELS={eglise:'Église',monument:'Monument',mairie:'Mairie',ecole:'École',chateau_eau:'Château d’eau',salle:'Salle communale',presbytere:'Ancien presbytère',secours:'Sapeurs-pompiers',stade:'Stade',site_industriel:'Site industriel',hameau:'Hameau',zone_activite:'Zone d’activité',cimetiere:'Cimetière',pont:'Pont',carrefour:'Carrefour',lieu_dit:'Lieu-dit',restaurant:'Restaurant',commerce:'Commerce',boulangerie:'Boulangerie',antenne:'Antenne',transformateur:'Transformateur',passage_a_niveau:'Passage à niveau',equipement_sportif:'Équipement sportif',sante:'Santé',gare:'Gare',parc:'Parc',mare:'Mare',croix:'Croix',ferme:'Ferme',ecole_maternelle:'École maternelle',bibliotheque:'Bibliothèque',poste:'Poste',pharmacie:'Pharmacie',medecin:'Médecin',coiffeur:'Coiffeur',garage:'Garage',bar:'Bar',hotel:'Hôtel',entreprise:'Entreprise',cooperative:'Coopérative',silo:'Silos',usine:'Usine',depot:'Dépôt',parking:'Parking',square:'Square',aire_de_jeux:'Aire de jeux',terrain_sport:'Terrain de sport',gymnase:'Gymnase',cabinet:'Cabinet'};
export const CATEGORY_GROUP_LABELS={patrimoine:'Patrimoine',equipement_public:'Équipement public',commerce_entreprise:'Commerce et entreprise',zone_activite:'Zone d’activité',equipement_sportif:'Sport',infrastructure:'Infrastructure',lieu_dit:'Lieu-dit',secteur:'Hameau / secteur',repere_local:'Repère local',sante:'Santé'};

const B=(n,sec)=>({label:`Bible ${n} §${sec}`});
const W=(label,url)=>({label,url});

export const STORIES={
 'poi:eglise-saint-denis':{
  summary:'Au cœur du village, Saint-Denis superpose neuf siècles : une nef romane de la fin du XIe siècle, un double transept et un chevet gothiques ajoutés après 1508, et une grande restauration engagée depuis 2024.',
  facts:['Nef et base du clocher : fin XIe – début XIIe siècle ; transept double et chevet à pans coupés : début XVIe siècle.','La nef romane est couverte de tuiles, l’abside et le double transept d’ardoises.','Le chœur s’est effondré pendant l’hiver 1798-1799 et a été relevé en 1817 grâce à Jean-Louis Bayle, propriétaire du domaine de Poussey.','Deux cloches rythment encore le village, fondues en 1809 et 1858.'],
  block:{title:'Aujourd’hui',text:'Une restauration globale est en cours : transept et chœur d’abord, clocher et beffroi ensuite. La Sauvegarde de l’Art Français et la Fondation du patrimoine accompagnent le chantier, et la souscription ouverte en mai 2024 reste active.'},
  sources:[B('03','3'),B('02','182'),B('04','10'),W('Sauvegarde de l’Art Français — Maizières-la-Grande-Paroisse, église Saint-Denis','https://www.sauvegardeartfrancais.fr/projets/maizieres-la-grande-paroisse-eglise-saint-denis/'),W('Fondation du patrimoine — Église Saint-Denis de Maizières-la-Grande-Paroisse','https://www.fondation-patrimoine.org/les-projets/leglise-saint-denis-de-maizieres-la-grande-paroisse/100115'),W('Inventaire général Grand Est — Église paroissiale Saint-Denis','https://inventaire-chalons.grandest.fr/gertrude-diffusion/dossier/eglise-paroissiale-saint-denis/883996e8-8155-423d-aa33-86236e007113')]},
 'poi:monument-aux-morts':{
  summary:'Un obélisque de calcaire sur son piédestal, orné d’un médaillon de bronze à tête de poilu encadré de palmes, rappelle les Maiziérons tombés en 1914-1918 et 1939-1945.',
  facts:['Trente noms de la Première Guerre mondiale y sont gravés, répartis par année.','Croix de Guerre, palme et décor de laurier complètent le monument.','Le médaillon est attribué au sculpteur René Bertrand-Boutée.'],
  block:{title:'Mémoire locale',text:'Le monument est le principal élément du patrimoine civique du XXe siècle à Maizières ; il reste le point de rendez-vous des commémorations communales.'},
  sources:[B('03','5'),B('02','54'),W('Monuments aux morts — université de Lille : Maizières-la-Grande-Paroisse','https://monumentsmorts.univ-lille.fr/monument/36245/maizieres-la-grande-paroisse-rueroute/')]},
 'poi:mairie':{
  summary:'La mairie occupe toujours le bâtiment de brique et de pierre que montrent les cartes postales anciennes « La Mairie — Les Écoles », avec ses baies cintrées et son balcon central.',
  facts:['Adresse : 6 rue des Écoles.','Sur les vues anciennes, un bâtiment scolaire plus bas s’adossait à droite de la mairie.','La commune a agrandi et rénové la mairie au cours des deux dernières décennies.'],
  block:{title:'Transformation du lieu',text:'Les écoles ont quitté le bâtiment pour le secteur Jules-Ferry ; la mairie, elle, n’a jamais changé d’adresse, et sa façade reste reconnaissable au premier regard.'},
  sources:[B('01','11.1'),B('03','5'),B('04','13'),W('Commune — horaires et contacts de la mairie','https://www.maiziereslagrandeparoisse.fr/horaires-et-contacts-de-la-mairie'),W('Geneanet — carte postale « La Mairie — Les Écoles »','https://www.geneanet.org/cartes-postales/view/7951564')]},
 'poi:ecole-primaire':{
  summary:'L’école primaire publique de Maizières est installée rue Jules-Ferry, à deux pas de la mairie, dans le secteur qui a repris la relève des anciennes écoles accolées à l’hôtel de ville.',
  facts:['Adresse : 3 rue Jules-Ferry.','Une école maternelle enregistrée au 8 rue Jules-Ferry a fermé administrativement le 31 août 2001.','Les écoles de la commune dépendent de l’Inspection académique de l’Aube.'],
  block:{title:'Un peu d’histoire',text:'Les cartes postales anciennes montrent les écoles contre la mairie ; les dates de construction des bâtiments actuels ne sont pas documentées dans les sources ouvertes.'},
  sources:[B('01','11.1'),B('03','5'),B('04','41'),W('Commune — éducation, enfance, jeunesse','https://www.maiziereslagrandeparoisse.fr/education-enfance-jeunesse')]},
 'poi:chateau-eau-poussey':{
  summary:'Le château d’eau de Poussey domine le hameau et marque de loin la limite nord-est du village ; il alimente un réseau aujourd’hui géré en régie publique.',
  facts:['Attesté par la commune, date de mise en service inconnue.','Le service de l’eau est assuré par la Régie du SDDEA depuis 2006, après la Lyonnaise des Eaux.','Hauteur documentée : 25,3 m.'],
  block:{title:'Mémoire locale',text:'La mémoire locale rappelle que la Croix des Ormes, liée aux inhumations de 1814, a été déplacée d’une centaine de mètres lors de l’aménagement des abords du château d’eau.'},
  sources:[B('01','11.4'),B('04','62'),B('06','124'),W('SDDEA — Maizières-la-Grande-Paroisse','https://www.sddea.fr/events/maizieres-la-grande-paroisse/')]},
 'poi:chateau-eau-granges':{
  summary:'Second château d’eau de la commune, celui des Granges se dresse au sud-ouest, entre le hameau et la voie ferrée.',
  facts:['Hauteur documentée : 27,6 m.','Le service de l’eau est assuré par la Régie du SDDEA.'],
  block:null,
  sources:[B('01','11.4'),W('Eaufrance — service d’eau de la commune 10220','https://services.eaufrance.fr/commune/10220/2022')]},
 'poi:salle-polyvalente':{
  summary:'La salle polyvalente, 3 rue des Écoles, est née de l’ancienne salle de gymnastique et de patronage de L’Étoile ; elle reste le lieu des fêtes, des concerts et des grands rendez-vous du village.',
  facts:['Adresse : 3 rue des Écoles ; gérée par l’association L’Étoile.','Travaux d’accessibilité et d’isolation décidés en 2019.','Le 14 septembre 2025, la Little World Geek Convention y a rassemblé plus de 500 visiteurs.'],
  block:{title:'Mémoire locale',text:'Le bâtiment a eu plusieurs vies sociales : salle de gymnastique, salle de patronage, puis salle des fêtes d’où partaient les défilés vers le stade.'},
  sources:[B('01','11.1'),B('05','9'),B('06','303'),B('06','317'),W('Commune — services','https://www.maiziereslagrandeparoisse.fr/services'),W('Commune — L’Étoile','https://www.maiziereslagrandeparoisse.fr/letoile')]},
 'poi:presbytere-ancien':{
  summary:'Le 15 rue Pasteur a été le dernier presbytère de la paroisse ; vendu par le diocèse de Troyes en 2017, il est aujourd’hui une maison privée.',
  facts:['Vendu à un particulier avant le 21 septembre 2017.','La paroisse est désormais desservie depuis Romilly-sur-Seine.'],
  block:{title:'À savoir',text:'La recherche historique rapporte que Jean-Louis Bayle avait restauré le presbytère de Maizières avant 1829, sans que l’on puisse affirmer qu’il s’agit du même bâtiment.'},
  sources:[B('03','3')]},
 'poi:cpi':{
  summary:'Le Centre de Première Intervention prolonge une tradition ancienne de sapeurs-pompiers volontaires, photographiés dès 1906 et encore au début des années 1960.',
  facts:['Une dizaine de sapeurs-pompiers volontaires.','Une « Photo souvenir des sapeurs-pompiers de Maizières-la-Grande-Paroisse en 1906 » est conservée par la commune.'],
  block:{title:'Un peu d’histoire',text:'La compagnie des années 1960 est connue par une photographie légendée où figurent plusieurs familles du village.'},
  sources:[B('01','11.4'),B('04','47'),B('02','94'),B('06','54')]},
 'poi:stade':{
  summary:'Le stade et ses vestiaires occupent l’angle de la rue du Stade et de la Voie aux Vaches ; c’est le terrain des sections sportives de L’Étoile.',
  facts:['Vestiaires à l’angle rue du Stade / Voie aux Vaches.','Les défilés partaient autrefois de la salle des fêtes vers le stade.'],
  block:null,
  sources:[B('01','7.10'),B('06','40'),W('Commune — L’Étoile','https://www.maiziereslagrandeparoisse.fr/letoile')]},
 'poi:seveal':{
  summary:'En zone industrielle de La Glacière, le site Sévéal est un entrepôt de stockage lié au monde agricole.',
  facts:['Activité enregistrée : entreposage et stockage non frigorifique.','Convention collective des coopératives céréalières, de meunerie et d’alimentation animale.'],
  block:null,
  sources:[W('Annuaire des entreprises — établissement Sévéal','https://annuaire-entreprises.data.gouv.fr/etablissement/75780368900087'),W('Kompass — Seveal, Maizières-la-Grande-Paroisse','https://fr.kompass.com/c/seveal/fr4851333/')]},
 'poi:poussey':{
  summary:'Hameau historique au nord-est du village, Poussey tire son nom, selon la tradition, des terres basses et humides qui l’entourent ; ce fut aussi le siège d’une baronnie.',
  facts:['La baronnie de Poussey a son historien : l’abbé Defer, en 1889.','Jean-Louis Bayle, propriétaire du domaine, finance la restauration du chœur de l’église en 1817.','Le château de Poussey a disparu entre la fin du XVIIe et le XVIIIe siècle.','Le hameau a été récemment rénové.'],
  block:{title:'Mémoire locale',text:'La mémoire locale évoque un nom lié à la mare, au marais et aux terrains bas : une lecture cohérente avec le ruisseau des Moulins qui longe le hameau.'},
  sources:[B('01','8.3'),B('02','1.2'),B('02','3.4'),B('02','182')]},
 'poi:les-granges':{
  summary:'Au sud-ouest, Les Granges doivent leur nom aux granges dîmières des établissements religieux ; en 1740, le hameau devient Poste aux Chevaux sur la route de Nogent à Troyes.',
  facts:['Les granges recevaient les dîmes en nature du prieuré Saint-Georges et de l’abbaye du Paraclet.','Poste aux Chevaux établie en 1740 sur l’axe Paris–Bâle.','Nœud de circulation avant l’arrivée du chemin de fer.'],
  block:{title:'Un peu d’histoire',text:'La chapelle des Granges, fondée en 1356, a laissé son nom au Gué de la Chapelle tout proche.'},
  sources:[B('01','8.2'),B('02','3.5'),B('02','33'),B('02','7')]},
 'poi:parc-aerodrome':{
  summary:'Face à la zone commerciale de La Belle Idée, le Parc de l’Aérodrome s’est développé à partir de 2012 sur le secteur de l’ancienne base aérienne.',
  facts:['Axes principaux : boulevard Antoine-de-Saint-Exupéry et avenue Philippe-Seguin.','Parc intercommunal Aéromia partagé avec Romilly-sur-Seine.'],
  block:{title:'Transformation du lieu',text:'Terrain d’aviation avant 1940, le site est devenu l’une des portes économiques de la commune, avec La Glacière.'},
  sources:[B('01','10.3'),B('02','182'),B('02','69.1'),B('05','87.2')]},
 'poi:glaciere':{
  summary:'Créée en 1970 à la sortie de Maizières vers Troyes, la zone industrielle de La Glacière a donné au village une fonction économique nouvelle, au point de figurer sur le blason communal.',
  facts:['Création officielle en 1970.','Au voisinage de la RD619.'],
  block:null,
  sources:[B('01','10.1'),B('04','21'),B('02','97')]},
 'poi:cimetiere':{
  summary:'Le cimetière actuel a remplacé celui qui entourait l’église ; en 1848 puis en 1862, la terre et les ossements de l’ancien enclos y ont été transférés.',
  facts:['Abandon du cimetière paroissial autour de l’église avant 1818.','Les travaux de 1848 et 1862 ont employé des ouvriers bonnetiers sans travail.'],
  block:null,
  sources:[B('03','3'),B('02','394')]},
 'poi:pont-seine':{
  summary:'Un premier pont de bois franchit la Seine en 1848 et met fin au bac de la Ferme du Passage ; son tablier métallique date de 1886.',
  facts:['1848 : premier tablier en bois.','1886 : tablier métallique.','L’aspect actuel est déjà celui connu au début du XXe siècle.'],
  block:null,
  sources:[B('01','14.2'),B('02','38.2'),B('03','6')]},
 'poi:gue-de-la-chapelle':{
  summary:'À l’angle de la RD619 et de la route de Pars-lès-Romilly, le Gué de la Chapelle garde le souvenir d’une chapelle fondée en 1356 et d’une mare qui formait le gué.',
  facts:['Chapelle fondée en 1356 par Humbert Étienne des Granges.','Un établissement Quinet y tenait café et salle dite « Casino ».'],
  block:null,
  sources:[B('01','14.1'),B('02','7'),B('03','6'),B('05','578')]}
};

export const storyFor=id=>STORIES[id]||null;
export const categoryLabel=(type,group)=>CATEGORY_LABELS[type]||CATEGORY_GROUP_LABELS[group]||null;
