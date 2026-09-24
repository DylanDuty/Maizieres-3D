# Notes V1.3 — 24 septembre 2026

Cette passe continue directement la V1.2. Aucun changement des coordonnées sources, de la projection, des empreintes OSM, de la voirie, du rail, du contour communal ou des enrichissements IGN. Les quatre fichiers de référence sont vérifiés par SHA-256.

## Direction artistique

Matériaux Three.js Toon et rampe partagée de quatre texels, lumière chaude, façades avec assise légèrement assombrie et rives de toiture marquées. Les fenêtres sont dessinées seulement du côté extérieur. Les arbres ont un feuillage arrondi à trois lobes, normales lissées, teintes et proportions variées. Leur nombre passe de 3 800 à 3 200 pour compenser les couronnes plus travaillées ; les points d’arbres OSM restent prioritaires. Les grands aplats agricoles portent des bandes larges orientées selon une arête du polygone. Ni texture haute résolution, ni post-traitement, ni dépendance ajoutée.

Ces choix sont artistiques : couleurs exactes des façades, fenêtres, essences et arbres procéduraux, motifs et cultures des champs ne sont pas des relevés du réel. La scène reste un diorama stylisé ; le ressenti « film d’animation » et la reconnaissance par un habitant nécessitent un retour utilisateur.

## Informations réelles et estimées

Les 1 217 associations IGN, dont 976 hauteurs de murs utilisées, 614 hausses de toiture dérivées, 662 nombres d’étages et 510 matériaux uniques utilisés, sont conservées. Les formes et directions de faîtages ordinaires restent principalement déduites des empreintes. Les limites de plausibilité déjà appliquées en V1.2 ne modifient pas les valeurs sources. Le modèle particulier de Saint-Denis est conservé.

Les noms et références proviennent des tags OSM, des repères IGN existants et des types d’équipements publics déjà reconnus. Le fichier local named-zones.geojson ajoute les cinq polygones IGN nommés, non fictifs et en service de la mairie, Saint-Denis, Seveal, du stade et de la Glacière. Sources complètes déjà présentes dans data-sources/ign ; aucune nouvelle infrastructure ni API à l’exécution. Licence Ouverte 2.0 pour IGN, ODbL pour OSM.

Poussey et les lieux-dits OSM ponctuels sont sélectionnables par leur étiquette ou près de leur position. Leur halo indique un repère, jamais une limite de quartier. Les zones à contour connu utilisent leur polygone source. Les rues de même nom sont regroupées pour surligner tous leurs tronçons. Les références routières sont utilisées quand le nom manque. Aucune déduction de nom à partir d’une rue voisine.

## Interaction et coût

Recherche au clic uniquement : rayon sur les quatre lots existants de bâtiments, puis proximité écran des points et lignes, puis test dans les zones. Tolérance de 10 pixels autour des axes routiers et 22 autour des points ; les bâtiments visibles ont priorité pour éviter de sélectionner une rue à travers une maison. Dans les vues éloignées, zoomer facilite la distinction entre bâtiments et chaussées. Un déplacement de plus de 6 pixels ou un geste à plusieurs doigts annule le clic. La géométrie de surbrillance précédente est libérée à chaque sélection. Le panneau affiche systématiquement la source.

Le rendu à la demande, les géométries regroupées, l’instanciation, les ombres limitées et le mode Fluide par défaut sont conservés. Les noms des lieux sont des boutons accessibles au clavier.

---

# V1.2 — présentation et performances — 15 septembre 2026

La V1.2 conserve **octet pour octet les quatre fichiers de données V1.1** : OSM, contour communal, enrichissement des bâtiments et végétation IGN. Les coordonnées, empreintes, 1 968 bâtiments, routes, voie ferrée et 332 haies IGN affichées sont conservés. Les sections V1.1 ci-dessous restent la référence de provenance ; les réglages de rendu suivants les remplacent.

## Rendu

Palette de façades crème et pierre claire, toits terre cuite douce, ardoise ou métal selon les familles déjà identifiées. Couleurs artistiques, pas un relevé des façades. Champs en blé, verts et terre douce avec motifs de 128 × 128 pixels ; ciel bleu clair, DirectionalLight chaude (2,15) et HemisphereLight (1,55).

Les matériaux Lambert partagés remplacent les matériaux physiques Standard. Pas de post-traitement, nouvelle texture lourde ou dépendance supplémentaire. La silhouette de Saint-Denis et ses proportions V1.1 sont conservées ; aucun nouveau monument ou détail architectural inventé.

## Végétation et voie ferrée

**3 800 arbres au lieu de 10 000**. Les points d’arbres OSM sont traités en premier, puis les jardins et bois proches. Les arbres procéduraux sont espacés davantage en périphérie : pas de 42 m près du bourg/Poussey, 60 m à distance intermédiaire, 83 m au loin et 62 m pour les broussailles. Les masses boisées conservent leurs contours même là où leurs arbres sont moins nombreux. Ces règles ne décrivent pas les positions réelles des arbres.

Feuillages arrondis de 64 triangles, cinq couleurs, trois largeurs et silhouette élancée des peupliers ; troncs ouverts de dix triangles. Deux InstancedMesh, sans ombres portées ou reçues. Les haies IGN restent des volumes simples aux contours conservés.

Les **10 460 traverses** restent instanciées, avec les mêmes dimensions horizontales et positions ; chacune est une surface de deux triangles, sans ombre. Les rails et leur tracé restent identiques.

## Toitures : contrôle de plausibilité

Les hauteurs de murs IGN ne changent pas. Le filtre concerne seulement les hausses de toiture dérivées de l’IGN ; il laisse les valeurs explicites OSM et les valeurs déjà dans l’enveloppe inchangées.

La hausse est limitée à 9 m, à 0,85 fois la largeur perpendiculaire au faîtage (0,5 pour les grands types industriels/agricoles/commerciaux), avec limite minimale de 1,2 m. Lorsque les données existent, s’ajoutent les limites hauteur de mur + 1 m et étages × 2,65 m + 1 m, chacune avec minimum de 3,2 m.

**75 toits** sont bornés uniquement dans le rendu. Les valeurs sources restent intactes ; chaque cas est recensé dans `data-sources/roof-render-adjustments.json`. Ces seuils sont heuristiques, pas une preuve d’erreur : certaines formes atypiques réelles peuvent les dépasser. Formes ordinaires et orientations des faîtages restent estimées comme en V1.1.

## Modes de qualité

| Réglage | Fluide — défaut | Élevée — choix manuel |
|---|---|---|
| Ratio de pixels | DPR natif plafonné à 1,25 ; plafond 1 si ≤ 4 cœurs logiques ou ≤ 4 Go déclarés | Entre 1,25 et 1,5 |
| Carte d’ombres | 1024 × 1024, BasicShadowMap | 2048 × 2048, PCFSoftShadowMap |
| Objets projetant une ombre | Bâtiments | Bâtiments |
| Réception des ombres | Sol/surfaces ; bâtiments exclus pour éviter les bandes d’auto-ombrage | Identique |
| Arbres | 3 800, sans ombres | Identique |
| MSAA | Désactivé | Désactivé ; résolution supérieure |

La détection des machines modestes est une heuristique prudente, pas un test GPU. Élevée permet un léger suréchantillonnage même à DPR natif 1. Aucun mode élevé automatique ni préférence persistée. Le changement de qualité peut entraîner une courte pause : matériaux et carte d’ombres sont mis à jour une fois. Les ombres restent ensuite statiques.

OrbitControls, caméra et cadrage initial conservés ; amortissement 0,13, rotation 0,75, zoom 0,8. Rendu à la demande et frustum culling Three.js conservés. Les étiquettes sont triées une seule fois. Pas de streaming, nouveaux secteurs ni LOD complexe.

## Contrôles et mesures

`npm run check:presentation` compare les quatre fichiers de données aux SHA-256 extraits du ZIP V1.1, vérifie les hauteurs de murs et les règles de qualité/toiture, puis produit le journal des limites de toiture. Les contrôles V1.1 sont conservés.

Le parcours QA activé uniquement par `?benchmark=1` effectue 105 images de rotation, déplacement et zoom, ignore l’échauffement et mesure 89 intervalles requestAnimationFrame. Résultat dans `canvas[data-benchmark]`, puis retour au cadrage initial. Ajouter `&quality=high` pour Élevée. Il n’existe aucune animation continue au lancement normal.

Le navigateur utilisé le 11 septembre exposait **Microsoft Basic Render Driver**, avec deux cœurs logiques déclarés. Les résultats montrent un allègement mais ne valident pas la cible 30–60 FPS sur un PC doté d’un GPU accéléré. Voir QA.md pour les mesures et leurs limites. La reconnaissance immédiate par un habitant reste à confirmer par un essai utilisateur.

---

# Documentation V1.1 conservée


# Notes — version 1.1, 11 septembre 2026

Cette passe enrichit le projet existant avec la BD TOPO IGN. Elle conserve Three.js, les coordonnées, les empreintes OSM, les axes routiers et ferroviaires ainsi que le contour communal. La fidélité planimétrique prime sur le détail esthétique.

## Géographie conservée

Origine : **3.7890245, 48.5097657**. Projection locale équirectangulaire en mètres, X vers l’est, Z vers le sud. Le rectangle du contour communal avec marge de 150 m couvre environ **5,35 × 6,08 km**. Il contient du contexte voisin, notamment vers Romilly-sur-Seine. Parmi 2 022 empreintes sources, 1 817 centres de boîtes englobantes se trouvent dans la commune et 205 dans le contexte. La scène affiche toujours **1 968 volumes** ; les objets de moins de 3 m² sont omis.

Les deux fichiers géographiques d’origine sont inchangés, vérifiés par SHA-256. Aucun bâtiment IGN supplémentaire n’a été inséré, déplacé ou redessiné. Les associations enrichissent seulement les attributs. Les surfaces sont toujours découpées à l’emprise d’affichage. Une erreur démontrée de triangulation des anneaux fermés avec trous a été corrigée : elle affectait le rendu des cours, pas les données sources.

L’instantané OSM annonce le **31 mai 2026, 22:37:44 UTC**, téléchargement le 10 septembre 2026. Le contour administratif conserve la résolution de l’API française ; ce n’est pas une limite foncière arpentée. Aucun de ces jeux ne garantit l’état actuel de chaque construction.

## Audit des données publiques

- **BD TOPO / Géoplateforme WFS** : solution retenue, directement exploitable en GeoJSON. Instantanés locaux de 2 489 bâtiments (2 488 en service), 569 zones de végétation et 28 zones d’activité ou d’intérêt, dans la boîte [3.75, 48.476, 3.83, 48.533]. Dates et requêtes complètes dans chaque fichier de `data-sources/ign/`. Licence Ouverte 2.0.
- **LiDAR HD** : pourrait préciser les toits, mais aucun nuage de points ni raster n’a été traité. La requête WFS de dalles MNH essayée n’était pas reconnue ; les capacités consultées exposaient des métadonnées LiDAR. Cela ne démontre pas une absence de couverture locale. Les attributs BD TOPO offraient un gain immédiat sans chaîne supplémentaire de téléchargement et traitement.
- **Cadastre ouvert** : empreintes 2D utiles, mais pas de plans de toiture et hauteurs directement exploitables pour cette passe. Les empreintes OSM n’ont pas été remplacées. Certains matériaux et nombres d’étages de la BD TOPO proviennent de déclarations cadastrales, et non d’observations de façade.
- **Patrimoine et commune** : documentation de Saint-Denis utilisée pour sa silhouette ; repères publics issus des points OSM et zones d’intérêt IGN. Aucune architecture de mairie ou d’école n’est inventée.

Références : [BD TOPO 3.3](https://geoservices.ign.fr/sites/default/files/2024-02/DC_BDTOPO_3-3_0.pdf), [BD TOPO 3.2, altitudes de toiture](https://geoservices.ign.fr/sites/default/files/2022-11/DC_BDTOPO_3-2.pdf), [matériaux cadastraux, Cerema](https://doc-datafoncier.cerema.fr/doc/ff/pb40_pevprincipale/dmatto), [cadastre ouvert](https://cadastre.data.gouv.fr/), [produits LiDAR HD](https://geoservices.ign.fr/sites/default/files/2024-09/DL_LiDAR_HD_1-0.pdf), [Licence Ouverte 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/).

## Rapprochement et provenance des bâtiments

Intersection exacte des polygones triangulés, trous compris. Une association exige une couverture d’au moins 65 % de l’empreinte OSM, une intersection sur union (IoU) d’au moins 50 %, et 15 points d’avance sur le second candidat. **1 217 associations** retenues ; 805 empreintes sans association suffisante. Cela réduit les mauvaises correspondances mais ne constitue pas une validation individuelle.

| Attribut | Dans l’enrichissement | Utilisé dans la scène | Interprétation |
|---|---:|---:|---|
| Hauteur au bord du toit | 977 | 976 | Attribut IGN, parfois interpolé |
| Élévation du toit au-dessus des murs | 615 | 614 | Dérivée d’altitudes IGN, estimation statistique |
| Nombre d’étages | 662 | 662 | Attribut IGN, rez-de-chaussée inclus |
| Matériaux de toiture | 522 | 510 matériaux uniques | Déclarations mixtes conservées sans supposer un matériau dominant |
| Usage renseigné | 797 | Combiné aux tags OSM | Résidentiel, annexe, agricole, industriel, commercial, religieux, sportif |

Les écarts entre fichier et rendu résultent notamment des petites empreintes omises et des matériaux mixtes. Détail par identifiant OSM, identifiant IGN, score, précision et méthode : `public/data/building-enrichment.json`. Associations rejetées : `data-sources/matching-audit.json`.

La **hauteur IGN correspond au bord du toit**, pas au faîtage. Elle est retenue si positive et inférieure à 80 m, avec précision altimétrique positive et au plus 5 m. La hausse du toit est calculée par `altitude_maximale_toit − altitude_minimale_sol − hauteur`, uniquement entre 0,6 et 9 m, pour une surface d’au moins 25 m² et hors construction légère. Le maximum de toit est statistique, souvent issu du 90e percentile du modèle de surface : ce calcul ne relève pas un faîtage exact et peut être affecté par la pente du terrain. Les valeurs incohérentes restent inconnues.

Les tags OSM explicites priment sur les classifications générales IGN. Les abris `wall=no`, `building=roof` ou `carport` sont ouverts avec supports, au lieu de maisons fermées. Dépendances, bâtiments agricoles, industriels et commerciaux ont des fenêtres et matériaux simplifiés adaptés. Silos et serres sont distingués dans les attributs, mais leur enveloppe reste simplifiée.

**Restent estimés** : formes des toits ordinaires, sens des faîtages, hauteurs sans source, hauteur des toits sans altitudes cohérentes, couleurs exactes, fenêtres et portes. Aucun tag `roof:*` n’est renseigné dans l’instantané OSM fourni. Le sens du faîtage découle donc du rectangle orienté de l’empreinte ; les toits sont généralement à deux pans. Les toits plats déduits du matériau béton ou du type d’abri sont une convention visuelle. Les garages non explicitement identifiés ne peuvent pas être distingués avec certitude des dépendances. Le modèle exploite les étages disponibles, sans tirage aléatoire du nombre d’étages.

## Bâtiments remarquables

**Saint-Denis** (`way/588791993`) a un modèle spécifique dans son empreinte OSM : nef occidentale plus basse, volumes orientaux à pignons successifs, chevet polygonal et clocher carré à partie haute sombre. Le clocher est placé à la première croisée ; une petite tourelle d’escalier n’est ajoutée que si elle tient dans l’empreinte. La hauteur IGN de 8,3 m est elle-même interpolée, avec précision déclarée de 2,5 m. Les hauteurs et proportions des parties, notamment le clocher à environ 23,8 m dans la maquette, restent des estimations. Plan et photographies identifient la disposition générale, sans prétention de restitution architecturale exacte.

Sources : [Sauvegarde de l’Art Français, description, plan et photographies](https://www.sauvegardeartfrancais.fr/projets/maizieres-la-grande-paroisse-eglise-saint-denis/), [notice municipale](https://www.maiziereslagrandeparoisse.fr/leglise). Les photographies externes ne sont pas redistribuées dans le ZIP.

**Mairie, écoles, équipements, sites industriels** : les zones d’intérêt IGN ajoutent 11 repères sources dans la commune, avec suppression des doublons proches dans l’affichage. Un repère enrichit un bâtiment seulement si son centre tombe dans une seule empreinte. Certaines zones IGN ont une géométrie fictive de localisation, parfois de précision 20 m : elles ne servent jamais d’empreinte. Les volumes restent ceux des bâtiments existants et de leurs attributs disponibles. Références complémentaires : [éducation, commune](https://www.maiziereslagrandeparoisse.fr/education-enfance-jeunesse), [mairie, annuaire officiel](https://lannuaire.service-public.gouv.fr/grand-est/aube/77d1c287-53e8-4d4f-9feb-b4c96ffb1bff).

## Paysage et rendu

Le complément IGN contient **374 haies, 61 peupleraies et 44 bois** ; **332 polygones de haies** sont visibles après découpage. Contours issus des données, mais hauteur conventionnelle de 1,65 m. Les arbres des bois et peupleraies sont distribués de façon procédurale, avec une silhouette plus haute pour les peupliers. Cela ne représente pas les positions ni tailles réelles de chaque arbre. Les jardins restent procéduraux dans les surfaces résidentielles OSM ; aucun contour parcellaire de jardin n’a été inventé comme donnée réelle.

Les cours agricoles sont traitées en sol de cour, les secteurs industriels et militaires en surfaces d’activité. Champs, espaces verts, parkings et cours d’eau conservent leurs géométries OSM. Cultures, sillons et teintes ne décrivent pas une campagne agricole réelle. Terrain plat ; largeurs routières renseignées ou estimées ; rails suivant les axes réels, avec traverses espacées de 2,2 m pour limiter le coût. Les franchissements dénivelés ne sont pas reconstruits.

Palette renseignée lorsque possible, éclairage existant conservé. Batches Three.js, végétation et traverses instanciées, ombres statiques, rendu à la demande. Une texture agricole de 128 × 128 pixels ; aucune texture haute résolution, image satellite ou génération IA. Les étiquettes s’effacent lorsqu’elles se chevauchent. Aucun appel à une API externe n’est nécessaire pour utiliser la maquette.

## Reproduction

`npm run data:ign` récupère les trois couches et conserve les fichiers déjà présents. Pour un renouvellement volontaire, archiver les instantanés avant de les retirer. `npm run data:enrich` recalcule les associations et les deux fichiers d’enrichissement depuis les sources locales. `npm run check` et `npm run check:enrichment` contrôlent les données et la conservation de la géographie. Une actualisation OSM volontaire impose de réexaminer les SHA-256 de référence du contrôle, puis de recalculer les associations. Les commandes de lancement figurent dans README.md.

