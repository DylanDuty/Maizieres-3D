# Notes V1.11.1 — audit ciblé des bâtiments récents, 25 septembre 2026

- **Constat** : aucun bâtiment ne manquait vraiment. Les lieux sans bâtiment de V1.11 venaient de positions d’adresse éloignées du bâtiment :
  - points BAN « segment » posés sur la chaussée ;
  - point BAN « entrée » posé sur le mur ;
  - point BAN du 97 rue Joliot-Curie en plein champ.
- **Méthode** : RNB par adresse, puis BAN PLUS, puis empreinte à 0,1 m de l’entrée. Chaque décision est contrôlée sur l’orthophoto d’avril 2025. Aucun bâtiment n’est modifié ni ajouté.
- **Pour Unreal** : `building_position` donne le centre du bâtiment associé quand le point du lieu n’est pas sur lui. `building_geometry_missing` marque les 11 lieux sans adresse ou sans lien officiel, à relever avant tout placement.

# Notes V1.11 — POI, patrimoine et toponymie Unreal, 25 septembre 2026

Branche `opus/v1.11-poi-toponymy`, à partir de `a2ee6d2`. Pas de modèle 3D, pas d’étiquettes permanentes ajoutées, pas de modification du bâti ni des référentiels gelés.

## Audit

- **Projet** :
  - catalogue de clics (OSM, BD TOPO zones nommées) ;
  - annotations Bible des rues ;
  - landmarks d’enrichissement.
- **Sources officielles ajoutées** (Géoplateforme) :
  - BAN et BAN PLUS (liens adresse – bâtiment) ;
  - BD TOPO : toponymie, lieux-dits, zones d’habitation, constructions ponctuelles ;
  - servitudes GPU : aucune AC1.
- **Bibles** : 506 extraits de lieux, 60 entrées de toponymie et 12 renommages, établis par lecture assistée. Toutes les citations sont exactes et vérifiées automatiquement.

## Choix

- **Statut** :
  - les Bibles descriptives (01, 03, 04, 05) décident ;
  - pour BIBLE_02, « historique » signifie « non établi aujourd’hui », jamais « fermé » ;
  - BIBLE_06 n’apporte que du contexte : un souvenir seul ne crée pas de lieu.
- **Affichage actuel** : statut actuel, position fiable et preuve suffisante. OSM seul ne suffit jamais. Un commerce doit avoir une preuve depuis 2023, figurer à la BIBLE_01 §11, ou être corroboré par OSM.
- **Géométrie** :
  - bâtiment, adresse BAN, objet BD TOPO, carrefour V1.8, ouvrage V1.9 ou point de toponymie ;
  - sinon aucune géométrie ;
  - jamais de polygone dessiné autour d’un nom.
- **Toponymie** :
  - la BAN est la forme officielle ;
  - les variantes et les conflits sont documentés, jamais corrigés ;
  - aucun appariement entre points cardinaux ;
  - Lechère et Les Léchères restent distincts.
- **Landmarks** : liste explicite P1 à P3 pour le futur travail Unreal. Le moulin de Poussey et la demeure de Poussey ne sont pas retenus (disparu, ou existence à vérifier).

## Suite possible

- Relever sur place : Croix des Ormes, Croix des Granges, Maison des Papillons, demeure de Poussey.
- Reconfirmer les 22 commerces sans preuve récente.
- Arbitrer les adresses divergentes (école, Baguette des Granges, Carrosserie Serbource).
- Intégrer la couche POI au mode normal quand l’affichage des étiquettes sera arbitré.

# Notes V1.10 — occupation du sol, végétation et hydrographie Unreal, 25 septembre 2026

Branche `opus/v1.10-landcover`, à partir de `44f853f`. Pas de rendu artistique, pas d’arbres, de cultures, d’herbe, de matériaux, de rivière ni de PCG, pas d’import Unreal.

## Audit

- **Dans le projet** :
  - OSM (landuse, natural, waterway, parkings) ;
  - tronçons hydrographiques BD TOPO (instantané V1.9) ;
  - la végétation stylisée du rendu (décor, non réutilisée).
- **Sources officielles ajoutées** (WFS Géoplateforme, 17 instantanés) :
  - RPG 2024, 2023, 2022 et codes de cultures ;
  - BD TOPO : zones de végétation, haies DSB, surfaces et objets hydrographiques, zones d’activité, sport, cimetières, réservoirs, équipements de transport ;
  - BD Forêt V2 ;
  - cours d’eau BCAE.
- Les produits RPG contenant un identifiant d’exploitant ne sont pas téléchargés.
- La couche BCAE est servie en Lambert-93 malgré la sortie GeoJSON. Le CRS est enregistré dans l’instantané et respecté.

## Choix

- **Agriculture** :
  - `landuse_type` vient de la catégorie RPG ; `crop_*` est la culture 2024 déclarée, datée et sourcée ;
  - l’historique 2023-2022 est à part ;
  - les terres non déclarées ne sont pas complétées.
- **Bois** : BD TOPO, avec l’attribut BD Forêt. La proximité d’un cours d’eau est signalée, sans conclure à une ripisylve.
- **Haies** :
  - seuls les linéaires DSB sont des haies ; la confiance A exige un polygone « Haie » concordant ;
  - les polygones sans linéaire sont gardés à part ;
  - aucun bord de parcelle n’est promu en haie.
- **Eau** :
  - noms BD TOPO uniquement ;
  - niveau approximatif tiré du MNT, jamais de profondeur ;
  - croisements classés sans modifier V1.8 ni V1.9.
- **Artificialisé** : surfaces distinctes des périmètres fonctionnels. OSM seulement en complément non couvert, en confiance C.
- **Orthophoto** : planches de contrôle seulement (`landcover-review-v1.10.json`), aucune géométrie tirée de l’image.
- **Simplification** : dérivée, 0,5 m, perte mesurée. La source est conservée quand la perte dépasse 2 %.

## Suite possible

- Arbitrer à la main les 2 recouvrements et les 2 zones non classées ouverts.
- Documenter les 6 ouvrages hydrauliques manquants auprès du gestionnaire de voirie.
- Mettre à jour la culture à chaque nouveau millésime RPG.

# Notes V1.9 — référentiel ferroviaire et splines Unreal, 24 septembre 2026

Branche `opus/v1.9-rail`, à partir de `52f3984`. Ni rendu, ni rails 3D, ni traverses, ni caténaire, ni signalisation, ni import Unreal.

## Audit

- **OSM (projet)** :
  - 25 voies `railway=rail`, une par voie physique : ligne 1000 voies 1 et 2 avec références SNCF Réseau, communication J1357, voies de garage 1 à 3, voie 4, embranchements ;
  - 1 `railway=abandoned` ;
  - 4 `landuse=railway` ;
  - aucun nœud (l’instantané ne garde que les *ways*).
- **BD TOPO** :
  - 40 tronçons (6 principaux à 2 voies, 34 de service), tous « En service », non électrifiés, dont 1 pont ;
  - 4 PN ;
  - « Aire de triage » ;
  - « Arrêt de Fret de Châtres » (hors commune).
- **BIBLE_01 et BIBLE_03** :
  - ligne Paris–Bâle / Paris–Troyes (1848) ;
  - PN de la rue du Général-Leclerc (SNCF Réseau 2025) ;
  - ancienne gare (1857-1859, bâtiment voyageurs détruit), TIPRY ;
  - pont de la rue de l’Orme reconstruit pour l’électrification (fin 2025) ;
  - « La Station » : lieu-dit d’adressage sans lien prouvé avec la gare.
- **Services refusés** : Overpass, API OSM, SNCF open data.

## Choix

- **Deux niveaux** : l’axe documentaire officiel (BD TOPO, jamais dédoublé) et la voie physique (OSM, validée par la BD TOPO). Deux axes BD TOPO décalés sont rattachés, après contrôle orthophoto, aux voies OSM qui suivent les rails visibles.
- **Statut** : uniquement d’après les sources (BD TOPO « En service » + OSM `railway=rail`). L’orthophoto confirme seulement l’existence (confiance B). La zone floutée donne `unknown`.
- **Profils** : MNT lissé. Ouvrages franchis en ligne droite entre appuis. Raccords aux aiguillages alignés. Rail calé sur la route aux PN.
- **Historique** : ancienne emprise OSM, gare et TIPRY sont dans une couche séparée, sans géométrie inventée.
- **Emprise** : seulement les polygones déclarés (OSM, BD TOPO), dans `rail-land.geojson`, sans estimation.

## Nouveaux fichiers et commandes

| Élément | Rôle |
|---|---|
| `scripts/fetch-rail.mjs` (`npm run data:rail-fetch`) | couches BD TOPO complémentaires |
| `scripts/build-rail.mjs` (`npm run data:rail`) | référentiel, topologie, profils, PN, ouvrages, splines, rapport |
| `scripts/check-rail.mjs` (`npm run check:rail`) | contrôle, inclus dans `check:all` |
| `data-sources/rail/rail-review-v1.9.json` | revue orthophoto (existence, axes BD TOPO décalés, croisements) |
| `public/data/rail.geojson`, `rail-land.geojson`, `rail-diagnostic.json` | référentiel, emprise, données du mode `?diagnostic=rail` |
| `unreal/rail/rail-splines.json` | splines Unreal |
| `data-sources/rail/rail-report.json` | rapport machine |

---

# Notes V1.8 — référentiel voirie et splines Unreal, 24 septembre 2026

Branche `opus/v1.8-roads`, à partir de `2081b47`. Ni graphisme, ni matériau, ni végétation, ni voie ferrée détaillée, ni génération Unreal.

## Audit des données présentes

| Source | Constat |
|---|---|
| OSM (projet) | 531 voies, dont 107 nommées. Aucune largeur, aucun trottoir. Revêtement sur 88 voies, sens sur 71, 10 ponts |
| BD TOPO (bâti, landscape V1.5) | aucune couche routière jusque-là. `troncon_de_route` téléchargée : 1 550 tronçons, largeur de chaussée sur 800 |
| BIBLE_01 | 65 voies (§ 4.1), 18 libellés d’adressage (§ 5), 20 noms anciens (§ 6), connexions confirmées (§ 7), gare et passage à niveau (§ 12) |
| Services | Géoplateforme accessible (WFS BD TOPO, WMS orthophoto). API Overpass refusée par le proxy : non nécessaire |

## Choix

- **Géométrie.** BD TOPO d’abord : officielle, topologique, attributs de largeur, de sens et de pont. OSM sert à la sémantique, et à compléter seulement là où la BD TOPO n’a rien à moins de 8 m. Les compléments sont surtout des allées de parking, des cours d’activité et des chemins.
- **Largeur.** `widthSource` distingue `official`, `osm`, `inferred` et `measured`. Les estimations par catégorie ne remplacent jamais une valeur documentée et restent identifiées comme telles.
- **Chemins.** Les catégories `chemin_carrossable`, `chemin_rural` et `sentier` correspondent à des `unrealType` non goudronnés (`gravel-track`, `dirt-track`, `footpath`).
- **Altitude.**
  - Terrain V1.7, sauf sur les ponts (tablier entre culées, un seul tablier par pont multi-tronçons).
  - Sauf aussi sur les ouvrages non répertoriés confirmés sur l’orthophoto (corde entre appuis, `zOverride`).
  - Les ruptures relevées en V1.7 sont expliquées : pont ferroviaire sur un fossé boisé ; pont de la rue du Pont de Clairvaux sur la rivière du Moulin.
- **Origine.** `UNREAL_ORIGIN` gelée, sans autre origine.
- **Orthophoto.** Utilisée comme preuve uniquement. Elle a permis d’exclure 2 doublons décalés et de confirmer 89 compléments et 5 ouvrages. Aucun tracé n’en est tiré.
- **Trottoirs.** Aucun n’est fabriqué. Les secteurs à déterminer sont marqués.

## Nouveaux scripts

| Commande | Rôle |
|---|---|
| `npm run data:roads-fetch` | instantanés BD TOPO (tronçons, voies ferrées, points du réseau, ouvrages, voies nommées) |
| `npm run data:roads` | `build-roads.mjs` : référentiel, topologie, altitude, splines, rapport |
| `npm run data:roads-review` | régénère le fichier de revue orthophoto |
| `npm run check:roads` | contrôle, inclus dans `check:all` |

Mode de contrôle `?diagnostic=roads` : `src/roads-diagnostic.js`.

---

# Notes V1.7 — référentiel terrain et heightmap Unreal, 24 septembre 2026

Branche `opus/v1.7-terrain`, à partir de `b1d4c27`. Mission limitée au relief et à l’altimétrie : ni routes, ni végétation, ni graphisme, ni niveau Unreal.

## Choix

- **Source.** Le LiDAR HD MNT 0,5 m (2025) est la donnée IGN la plus précise et la plus récente, et elle couvre toute la zone. Le RGE ALTI 1 m s’en écarte de 0,23 à 0,32 m en écart quadratique moyen, et sa résolution effective est plus grossière que 1 m (68 % de pixels répétés). Le MNS et le MNH sont exclus, car ils incluent le sursol.
- **Stockage.** Les dalles officielles (896 Mo) restent hors Git. Le manifeste versionné garde l’URL et le SHA-256 de chaque dalle ; le téléchargement est reproductible (octets identiques) et toute différence arrête le pipeline. Le GeoTIFF 1 m versionné conserve à l’identique les échantillons utilisés.
- **Emprise.** La commune plus au moins 500 m de marge, dimensionnée à 254 × k + 1 nœuds. Le Landscape Unreal tombe ainsi à exactement 1 m, sans rééchantillonnage : 6 097 × 6 859.
- **Grille 1 m.** Un échantillon source sur deux dans chaque direction, sur les mètres entiers de Lambert-93. Aucune moyenne, aucune interpolation.
- **Repère.** Lambert-93 et NGF-IGN69. Une seule transformation (proj4, CRS84 → EPSG:2154), dans `scripts/terrain-frame.mjs`.
- **Origine commune Unreal.** `UNREAL_ORIGIN` (E 758 278, N 6 823 571, H 0) est l’origine historique du projet projetée et arrondie au mètre. Elle vaudra pour toutes les couches futures.
- **Encodage des hauteurs Unreal.** Échelle Z = 100 : 1 m réel = 1 m Unreal. Hauteur de référence 87 m, 128 pas par mètre, position de l’acteur Z = 8 700 cm.
- **Bâtiments.** Fichier dérivé séparé ; `buildings.geojson` n’est pas touché. Le socle recommandé est le minimum du terrain sous l’emprise et le long du contour.
- **Three.js.** Relief visible uniquement avec `?diagnostic=terrain`. `buildBuildings` accepte une option `elevation` qui relève chaque bâtiment d’un bloc, sans toucher son empreinte. Le rendu normal est inchangé.

## Nouveaux scripts

| Commande | Rôle |
|---|---|
| `npm run data:terrain-fetch` | index WFS, téléchargement et vérification SHA-256 des dalles |
| `npm run data:terrain` | fetch, puis `build-terrain.mjs` : mosaïque, grille, contrôles, GeoTIFF, PNG et RAW 16 bits, grille Three.js, altitudes des bâtiments, `terrain-reference.json` |
| `npm run check:terrain` | contrôle des sorties, inclus dans `check:all` |
| `npm run audit:terrain-sources` | comparaison avec le RGE ALTI (réseau) |

Modules : `scripts/terrain-frame.mjs` (emprise, origine, transformations) et `scripts/raster-io.mjs` (GeoTIFF deflate avec prédicteur, PNG 16 bits). Dépendances ajoutées : `geotiff`, `proj4`.

---

# Notes V1.6.2 — gel du référentiel bâti pour Unreal, 24 septembre 2026

Branche `opus/v1.6-building-validation`, à partir de `0402261` (V1.6.1). Dernière passe de validation du bâti avant le gel pour Unreal Engine. Aucun graphisme modifié.

## Méthode

- **Revue individuelle** de chaque cas douteux, soit 260 cas, sur la BD ORTHO IGN 20 cm (vol des 28–29 avril 2025) : 24 bâtiments RNB, 22 extensions, 77 ajouts cadastraux et 137 empreintes OSM seules. Pour chacun, les empreintes BD TOPO, cadastre actuel, OSM et RNB sont superposées à l’image.
- L’orthophoto sert **uniquement à constater** qu’un bâti existe ou non. Elle ne sert jamais à dessiner une empreinte.
- Les verdicts sont consignés, avec leur observation, dans `data-sources/building-review-v1.6.2.json`. `scripts/validate-buildings.mjs` les applique : `npm run data:buildings` reste reproductible.
- Les classes V1.6.1 sont figées dans `data-sources/building-validation-v1.6.1.json`. Chaque changement est tracé dans `v162.confidenceChangesSinceV161`.
- Export Etalab : `cadastre.s3.rbx.io.cloud.ovh.net` est toujours refusé (403). Rien n’est comparé ni reconstruit.

## Les 19 RNB sans empreinte

| Catégorie | RNB | Décision |
|---|---|---|
| Bâtiment déjà présent mais mal associé | `7H6KRN7T9WKX` (identifiant cité par la BD TOPO elle-même, point à 0,1 m hors de l’empreinte), `K5QGP46TYCQR` (39 rue du Général-Leclerc, seul bâti de l’adresse, point à 0,4 m) | **associés** à BATIMENT0000000301149753 et BATIMENT0000002330331325 |
| Plusieurs bâtiments regroupés | `E3SG5A58GGM9` (construction légère englobée dans BATIMENT0000002330331325) | non associé : pas de second identifiant sur la même empreinte |
| Adresse ou position RNB imprécise | `XA57BZ86GTFS`, `RT96NCTKV9AM`, `K14J6VEAG7V8`, `Q289NCVCWVSZ` (château d’eau), `AMMKT8XZRXAA` (doublon décalé de 18 m), `58Y4QCN7YBR4`, `MEJK7RK7Q4B1` | aucun bâti au point, ou bâti déjà présent avec son propre RNB |
| Objet démoli ou incohérent | `X3H3MTQBQ5G1`, `9Y9PM47JK2TF`, `HFMTQATEXE98`, `A58K5AW4BFNY`, `ET3MKN6N15C5`, `6GNAKD2FS8D8` (dalle), `77N2Q9DKBVSD` (voie ferrée), `AXQ4DCT3XS93`, `CSYV3PG9NPC2` | rien à ajouter |
| Bâtiment réellement manquant | aucun | — |

- Aucune empreinte officielle ne décrit un bâtiment réel absent du référentiel : **0 bâtiment ajouté**.
- 5 autres RNB perdent leur empreinte parce que l’empreinte qui les portait est retirée : 2 sur `cadastre:39818200`, 3 sur des OSM non bâtis. Ils sont analysés de la même façon : démolis.
- **Restent 22 RNB actifs sans empreinte**, tous expliqués.
- **2 ne sont pas résolus** :
  - `58Y4QCN7YBR4` : abri et serre de jardin visibles, mais absents de toute source officielle ;
  - `MEJK7RK7Q4B1` : ombre ou abri, impossible à trancher.

## Les 22 extensions cadastrales

- **3 intégrées**, visibles sur l’orthophoto :
  - BATIMENT0000000009359079 : annexe sud ;
  - BATIMENT0000000301151768 : aile couverte de panneaux solaires ;
  - BATIMENT0000000301149220 : rangée de garages entière.
- Pour ces 3 bâtiments, l’empreinte finale est l’union de la BD TOPO et du polygone cadastral. L’empreinte BD TOPO d’origine reste dans `geometryEnrichment.ignGeometry`, et les hauteurs sont celles de la partie BD TOPO.
- **9 décalages** cadastre/BD TOPO, sans extension réelle.
- **4 parties cadastrales non bâties** : pelouse, jardin, dalle.
- **6 douteuses** (auvents, marquises, stockage) : géométrie non modifiée, classe B conservée.

## Les ajouts cadastraux et les OSM seuls

- **Ajouts du cadastre actuel (77)** :
  - 45 visibles : ils passent de C à B ;
  - 11 non vérifiables : conservés ;
  - **21 écartés**, dont 9 dans la commune : 9 « abris » sur des places de parking où stationnent des voitures, 3 cuves disparues, 6 dalles, cours ou pelouses, et 3 bandes de moins de 1 m de large.
  - Le cadastre actuel conserve des bâtiments démolis : sa seule présence ne prouve pas l’existence.
- **OSM seuls (137)** :
  - 86 visibles ;
  - 23 non vérifiables : conservés ;
  - **28 retirés**, non bâtis en 2025 (pelouses, friches, cours, anciens bassins). Pour 25 d’entre eux, le cadastre actuel est pourtant « présent ».
- Tous les retraits sont journalisés avec leur géométrie dans `data-sources/building-removed.json` (champ `removal.version`).

## Résultat

- 2 543 → **2 494** bâtiments ; dans la commune, 2 299 → **2 265**.
- Confiance A / B / C : **1 994 / 475 / 25** ; dans la commune, 1 858 / 395 / 12.
- **42 cas réellement non résolus** (34 dans la commune) : 2 RNB, 6 extensions douteuses, 11 ajouts et 23 OSM non vérifiables.

## Les 2 265 bâtiments de la commune sont-ils le meilleur référentiel possible ?

Oui, avec les sources publiques accessibles aujourd’hui :
- chaque bâtiment BD TOPO est présent ;
- chaque bâtiment du cadastre actuel est soit retrouvé, soit jumeau décalé, soit ajouté, soit écarté avec la preuve de l’orthophoto 2025 ;
- chaque bâtiment RNB actif de la commune est soit dans une empreinte, soit expliqué ;
- chaque empreinte qui ne vient que d’OSM a été contrôlée.

Ce n’est pas une exhaustivité absolue :
- l’export Etalab reste à comparer dès que son hôte sera autorisé. Il vient du même plan DGFiP que le Parcellaire Express, mais l’écart n’est pas mesuré ;
- de petits abris de jardin visibles sur l’orthophoto n’existent dans aucune source officielle et ne peuvent pas être ajoutés sans empreinte ;
- 34 cas restent non résolus dans la commune ;
- 104 contours diffèrent du cadastre : c’est une question de précision du tracé, pas d’existence.

---

# Notes V1.6.1 — validation officielle cadastre et RNB, 24 septembre 2026

Branche `opus/v1.6-building-validation`, à partir de `0543e8f` (V1.6 provisoire). Aucun travail graphique, sauf la légende du mode diagnostic.

## Accès réseau constaté

| Service | Résultat |
|---|---|
| `data.geopf.fr` | accessible (WFS Géoplateforme) |
| `rnb-api.beta.gouv.fr` | accessible |
| `cadastre.data.gouv.fr` | répond, avec des coupures intermittentes. Le fichier Etalab redirige vers `cadastre.s3.rbx.io.cloud.ovh.net` (millésime 2026-06-01), **refusé (403)** par la politique réseau |

Le cadastre Etalab n’a donc pas pu être téléchargé. Le **cadastre actuel** vient d’une autre diffusion officielle du même plan cadastral DGFiP : le **Parcellaire Express (PCI)** publié par l’IGN sur `data.geopf.fr` (couche `CADASTRALPARCELS.PARCELLAIRE_EXPRESS:batiment`). Ce n’est pas un substitut historique. Aucun substitut OSM 2013–2018 n’est plus utilisé : sans cadastre actuel ni RNB, `validate-buildings.mjs` s’arrête.

Instantanés conservés, avec requêtes et date du 24/09/2026 :
- `data-sources/cadastre/pci-express-batiment.geojson` : 2 070 bâtiments dans la zone affichée, dont 1 844 dans la commune ;
- `data-sources/rnb/rnb-10220.json` : 1 895 bâtiments RNB de la commune et 333 identifiants du référentiel vérifiés un par un.

Pipeline : `npm run data:validation-sources` (Node passe par le proxy grâce à `NODE_USE_ENV_PROXY=1` ; repli PCI si Etalab est inaccessible), puis `npm run data:buildings`.

## Règles de décision

- **Métriques** : intersection exacte, couverture dans les deux sens, IoU, surface, distance entre centres. Aucune fusion de géométries.
- **Jumeaux décalés** : une empreinte cadastrale sans recouvrement, mais avec à proximité un bâtiment du référentiel de surface voisine (rapport 0,6–1,67, distance ≤ max(6 m ; 1,5 × √surface)) qui n’a pas lui-même d’équivalent cadastral, est considérée comme le même objet numérisé ailleurs. Cela concerne 25 cas : ils ne sont ni ajoutés ni supprimés.
- **Ajout** : empreinte du cadastre actuel qui recouvre moins de 10 % du référentiel et n’a pas de jumeau décalé. Confiance B si un point RNB actif est dans l’empreinte, C sinon.
- **Suppression** : empreinte OSM seule, absente de la BD TOPO, du cadastre actuel (ni recouvrement, ni jumeau décalé) et sans point RNB actif. Trois sources officielles concordent sur l’absence. Chaque cas est journalisé avec sa géométrie et ses preuves dans `data-sources/building-removed.json`.
- **RNB** : pour chaque identifiant, l’existence, l’état (actif, statut) et la cohérence spatiale (point dans l’empreinte ou recouvrement de forme ≥ 50 %). Seuls les identifiants valides sont gardés dans `rnb` ; l’original de la BD TOPO reste dans `rnbSource`. Un identifiant n’est ajouté que si un bâtiment RNB actif cite exactement l’objet BD TOPO dans ses `ext_ids` et reste spatialement cohérent. Aucune association par simple proximité.
- **Confiance** :
  - A : BD TOPO et cadastre actuel concordent (couverture ≥ 50 %), sans contradiction. Un statut RNB « démoli » ou une extension cadastrale absente de la BD TOPO empêche le A.
  - B : une seule source officielle, un contour différent, une contradiction, ou un ajout cadastral confirmé par le RNB.
  - C : empreinte non confirmée par une seconde source officielle.
- Classes V1.6 provisoires conservées dans `data-sources/building-validation-v1.6.json`. Chaque changement de classe est tracé avec sa raison (`confidenceHistory`).

## Résultats

- Référentiel : **2 491 → 2 543** bâtiments (+77 ajoutés depuis le cadastre, −25 supprimés) ; dans la commune, **2 259 → 2 299** (+58, −18).
- Ajouts (commune) : 32 de moins de 20 m², 15 de 20 à 40 m², 11 de plus de 40 m², dont 7 « Bâtiment FI ». Seuls 2 sont confirmés par le RNB.
- Suppressions (commune) : 18 empreintes OSM de 5 à 45 m², issues du cadastre 2013–2018 et absentes des trois sources actuelles.
- Confiance finale : A 1 984, B 466, C 93 ; dans la commune, A 1 849, B 384, C 66.
- Changements de classe : 119 C→B (OSM seuls confirmés par le cadastre actuel), 104 B→A, 112 A→B (contour différent du cadastre actuel ou extension cadastrale manquante).
- RNB : 2 316 identifiants vérifiés.
  - 2 027 valides, 158 inactifs (identifiants retirés), 130 spatialement incohérents (identifiant d’un bâtiment voisin attribué par l’IGN à de petites annexes), 1 démoli.
  - 22 identifiants ajoutés par lien exact BD TOPO.
  - 268 bâtiments ont une liste RNB corrigée.
  - 2 016 bâtiments portent au moins un identifiant vérifié (79,3 %), dont 1 839 sur 2 299 dans la commune (80,0 %).
  - Plusieurs identifiants valides : 32 bâtiments, contre 49 avant vérification. Ce sont des empreintes IGN englobant plusieurs bâtiments RNB, conservées telles quelles.
- Réexamen V1.6 :
  - 101 OSM seuls litigieux : 74 confirmés par le cadastre actuel (B), 12 restent C, 15 supprimés ;
  - 173 IGN de la commune absents du cadastre 2018 : 73 validés A (présents au cadastre actuel), 11 contours différents, 89 absents du cadastre actuel mais présents à la BD TOPO (B) ;
  - 26 empreintes avec plus de 25 m² non couverts : 22 dont l’emprise supplémentaire figure au cadastre actuel (extension absente de la BD TOPO, **géométrie non résolue** : la BD TOPO reste la géométrie de référence), 4 sans confirmation cadastrale.
- 154 bâtiments IGN présents au cadastre actuel n’avaient pas d’équivalent dans le cadastre 2013–2018 importé dans OSM : ce sont probablement des constructions apparues depuis.

## Restent douteux

- 19 bâtiments RNB actifs de la commune sans empreinte dans le référentiel (point et forme hors de tout bâtiment) : listés dans `rnbOnly`, non ajoutés faute de géométrie officielle concordante.
- 22 extensions cadastrales absentes de la géométrie BD TOPO. Au chemin La Fin de Maizière, seuls 54 des 554 m² de l’abri OSM figurent au cadastre actuel.
- Secteurs les plus concernés par les classes C et les contours différents :
  - avenue du Général-de-Gaulle (14) ;
  - rue de la Chefferie (14) ;
  - rue Joliot-Curie (12) ;
  - rue du Général-Leclerc (8) ;
  - rue Jean-Monnet (7) ;
  - 6 chacun : rues Georges-Clemenceau, Achille-Flaubert, de l’Essy, Jules-Ferry, du Stade, des Lombards, Basse-de-Poussey.

Les huit grands bâtiments OSM seuls signalés en V1.6 (rue de l’Essy, Joliot-Curie, Château, Lavoir, Docteur-Sollier) figurent tous au cadastre actuel : ils passent en B.

---

# Notes V1.6 — validation du bâti, 24 septembre 2026

Branche `opus/v1.6-building-validation`, issue de `opus/v1.5-buildings` (`cbdcd97`). Aucun travail esthétique.

## Accès aux sources officielles : toujours refusé

Pendant cette passe, la politique réseau de l’environnement a encore renvoyé **403** pour `cadastre.data.gouv.fr`, `data.geopf.fr` et `rnb-api.beta.gouv.fr`. Les deux environnements disponibles sont en accès « trusted network ». Le cadastre Etalab et l’API RNB n’ont donc **pas pu être consultés**. Le pipeline est prêt :

- `npm run data:validation-sources` télécharge le cadastre Etalab (couche bâtiments, INSEE 10220) dans `data-sources/cadastre/` et le RNB dans `data-sources/rnb/`, avec URL, date et licence. Les instantanés existants ne sont jamais écrasés.
- `npm run data:buildings` reconstruit le référentiel et le valide. Si ces fichiers existent, la validation compare avec le **vrai cadastre**, ajoute les bâtiments cadastraux absents (source « Cadastre Etalab », provenance `cadastre`) et vérifie chaque identifiant RNB et son statut dans l’API.

## Validation réalisée avec les sources locales

Faute d’accès, la validation s’appuie sur deux indices cadastraux déjà présents, **explicitement signalés comme substituts** :

1. **Cadastre DGFiP importé dans OSM** : 1 981 empreintes de la zone affichée portent la source cadastrale (« Mise à jour : 2018 » pour 1 613, 2013 et 2017 pour les autres). C’est une image du cadastre de 2013–2018, pas le cadastre actuel.
2. **Champs cadastraux de la BD TOPO** : `origine_du_batiment` (« Cadastre » pour 2 050 objets), `appariement_fichiers_fonciers` et `date_d_apparition` (fichiers fonciers).

Métriques : intersection exacte des polygones triangulés, couverture dans les deux sens, IoU, surface non couverte et largeur moyenne de la partie non couverte (surface non couverte / périmètre). Aucune fusion par proximité, **aucune géométrie modifiée ni supprimée**.

### Les 96 empreintes OSM partiellement couvertes

Diagnostic individuel dans `data-sources/building-validation.json` (`partialOsm`) :

| Cause probable | Cas | Décision |
|---|---:|---|
| Artefact : décalage de contour (< 5 m² ou largeur < 0,5 m) | 28 | aucune action |
| Écart de contour modéré (< 25 m²), dont 15 constructions légères | 41 | aucune action |
| Emprise cadastrale plus large que l’empreinte IGN | 15 | litigieux |
| Construction légère du cadastre en partie absente de la BD TOPO | 8 | litigieux |
| Découpage différent : l’IGN ne reprend qu’une partie du bâtiment cadastral | 3 | litigieux |
| Tracé OSM plus récent (orthophoto 2025) | 1 | litigieux : extension probable |

Ces 27 cas litigieux (21 dans la commune) marquent les bâtiments IGN concernés comme « contour divergent ». Sans le cadastre actuel ni une imagerie datée, il est impossible de trancher entre extension réelle, annexe démolie et omission IGN. Le plus grand cas est `way/588791854`, un abri léger de 716 m² vers le chemin La Fin de Maizière, dont 554 m² ne sont pas couverts.

### Bâtiments OSM seuls de plus de 80 m² (commune)

| OSM | Surface | Secteur | Statut |
|---|---:|---|---|
| way/588792071 | 351 m² | vers la rue de l’Essy, à 311 m | bâtiment du cadastre 2018 absent de la BD TOPO, IGN le plus proche à 107 m |
| way/588792505 | 328 m² | vers la rue de l’Essy, à 287 m | idem, IGN à 92 m |
| way/588793679 | 218 m² | vers la rue de l’Essy, à 312 m | idem, IGN à 96 m |
| way/588789726 | 336 m² | rue Joliot-Curie (Poussey) | construction légère au cadastre 2018, absente de la BD TOPO |
| way/588792987 | 191 m² | rue du Château | construction légère au cadastre 2018 |
| way/588792356 | 146 m² | rue du Lavoir | construction légère au cadastre 2018 |
| way/588792110 | 124 m² | rue Joliot-Curie | construction légère au cadastre 2018 |
| way/588791966 | 108 m² | rue du Docteur-Sollier | construction légère au cadastre 2018 |

Tous restent **litigieux**. Ils existaient au cadastre de 2018 mais sont absents de la BD TOPO, dont la plupart des objets ont été vérifiés entre 2019 et 2025. La démolition est possible, mais pas prouvée : les huit sont conservés en confiance C. Les trois de la rue de l’Essy, isolés en plaine, sont les plus suspects.

## Niveau de confiance par bâtiment

Chaque bâtiment porte un bloc `validation` : confiance, statut, correspondance cadastrale (IoU, couverture), identifiants RNB, année d’apparition dans les fichiers fonciers et preuves.

- **A** : empreinte IGN recouverte au moins à 50 % par le cadastre de référence, soit 1 992 bâtiments (1 853 dans la commune) ;
- **B** : une seule source officielle ou un contour divergent, soit 337 (275). Cela comprend 200 bâtiments IGN absents du cadastre de 2018 (173 dans la commune), dont 82 d’origine cadastrale à l’IGN, donc probablement plus récents que l’import OSM, 76 saisis sur imagerie aérienne et 15 d’autre origine ;
- **C** : empreinte OSM ou cadastre ancien absente de la BD TOPO, soit 162 (131). 101 sont litigieuses (83 dans la commune) et 61 sont de petites annexes plausibles, sous le seuil de saisie habituel de la BD TOPO.

## RNB

Les identifiants RNB viennent de la BD TOPO (`identifiants_rnb`) : 2 260 bâtiments sur 2 491 (90,7 %), 2 080 sur 2 259 dans la commune (92,1 %), dont 49 porteurs de plusieurs identifiants. **Ils n’ont pas été vérifiés contre l’API RNB** (statut, existence) : aucune correspondance RNB nouvelle n’a été créée par proximité.

## Diagnostic

`?diagnostic=provenance` est conservé. Nouveau : `?diagnostic=validation` affiche en gris la confiance A, en orange B, en violet les contours divergents du cadastre, en bleu C, et en vert les bâtiments ajoutés depuis le cadastre (aucun sans le vrai cadastre). La fiche d’un bâtiment indique aussi sa confiance et son statut.

---

# Notes V1.5 — exhaustivité du bâti, 24 septembre 2026

Branche `opus/v1.5-buildings`, issue de `opus/v1.4`. Changement de priorité : la carte Three.js devient une référence géographique fidèle et exhaustive. Le rendu final sera fait dans Unreal Engine. Aucun travail graphique dans cette passe.

## Diagnostic : d’où venaient les maisons manquantes

Jusqu’à la V1.4, les empreintes venaient uniquement d’OSM. La BD TOPO ne servait qu’à enrichir les hauteurs d’environ 1 200 bâtiments OSM rapprochés. L’audit (`npm run audit:buildings`, `data-sources/building-audit.json`) montre quatre causes, par ordre d’importance :

1. **Source** : l’instantané OSM repose surtout sur l’import cadastral (étiquettes `source` « cadastre-dgi-fr »). Dans la commune, il compte 1 817 bâtiments, contre 2 128 pour la BD TOPO. **134 bâtiments IGN n’ont aucun équivalent OSM** (moins de 10 % de leur surface recouverte), soit 10 560 m². Parmi eux, 61 entre 40 et 200 m² : des maisons, et 13 grands bâtiments. D’après leur date de saisie IGN, 43 datent de 2012, 37 de 2006 et 40 de 2019 à 2025, dont le bâtiment sportif de 2024 près du stade. Ils sont dispersés dans tout le bourg, aux Granges et à Poussey : 29 à plus de 60 m d’une rue nommée, 8 le long de l’avenue du Général-de-Gaulle, 7 rue du Général-Leclerc, 5 rue Georges-Clemenceau…
2. **Segmentation** : dans 236 cas, un seul polygone OSM recouvre plusieurs bâtiments IGN. Ce sont surtout des maisons mitoyennes dessinées d’un seul bloc, rendues avec un seul toit : des « maisons » manquaient visuellement dans les rangées. L’inverse (plusieurs OSM pour un IGN) concerne 72 cas.
3. **Traitement V1.4** : 54 empreintes OSM de la zone affichée disparaissaient sans être comptées. 23 mesuraient moins de 3 m² (filtre de surface). 31 étaient rondes ou très finement dessinées (silos, cuves) : `roofAxis` ignorait les côtés de moins de 1 m et le bâtiment était abandonné.
4. **Rendu** : aucune perte. Tout bâtiment accepté par le traitement était dessiné. Le catalogue de clic excluait lui aussi les moins de 3 m².

Filtres géographiques : l’emprise IGN (bbox 3,75–3,83 / 48,476–48,533, 2 489 objets pour une limite de requête de 5 000) couvre toute la zone affichée. Aucune perte par clipping, par MultiPolygon (tous les objets IGN ont une seule partie) ni par trou (un seul trou, correctement triangulé). Aucune géométrie invalide.

## Nouvelle source de vérité

**`public/data/buildings.geojson`**, décrit dans `docs/referentiel-bati.md` :

- **IGN BD TOPO = géométrie principale** : les 2 329 bâtiments de la zone affichée (dont 2 128 dans la commune), géométrie inchangée, sans filtre ;
- **OSM = complément et sémantique** : 162 empreintes absentes de la BD TOPO ajoutées (131 dans la commune, surtout de petits abris de moins de 20 m²). Noms, enseignes et types OSM sont rattachés à 2 027 bâtiments IGN ;
- **2 491 bâtiments au total, dont 2 259 dans la commune**, tous rendus, aucun rejet. 2 260 ont un identifiant RNB, 1 829 une hauteur IGN utilisable.

Cadastre : non disponible localement, et son téléchargement ainsi que ceux de la Géoplateforme IGN et du RNB sont refusés par la politique réseau de l’environnement. Le contrôle croisé cadastral reste à faire. `npm run data:ign` puis `npm run data:buildings` suffiront à rafraîchir le référentiel quand l’accès sera ouvert.

## Changements de traitement

- Plus aucun filtre de surface minimale. Le seul garde-fou (surface supérieure à 100 000 m²) est compté comme rejet ; il n’en existe aucun.
- `roofAxis` retente avec tous les côtés quand aucun ne dépasse 1 m : les silos et cuves ronds sont rendus.
- Toutes les parties d’un MultiPolygon deviennent des objets distincts (`id#n`). Anneaux intérieurs conservés.
- Les rejets éventuels sont listés : `buildBuildings().rejected` et `buildingReference.rejected` dans `data-stats`.
- L’église Saint-Denis est reconnue par sa correspondance OSM (`way/588791993` → `BATIMENT0000000301149566`, nature « Eglise » à l’IGN). Son modèle spécifique est conservé.
- Un nom OSM porté par plusieurs empreintes IGN reste une seule fiche, avec toutes ses parties en surbrillance. Plusieurs enseignes dans un même bâtiment IGN sont toutes affichées (« Gémo · Gitem »).
- La fiche d’un bâtiment indique la géométrie (« Empreinte IGN BD TOPO » ou « Empreinte OpenStreetMap seule ») et l’identifiant RNB.

## Mode diagnostic

`?diagnostic=provenance` colore les bâtiments par provenance, avec une légende : gris IGN et OSM, orange IGN avec OSM partiel, rouge IGN seul, bleu OSM seul. Mode destiné au développement.

## Restent à vérifier

- **96 empreintes OSM partiellement couvertes par l’IGN** (10–50 %), dont 26 avec plus de 25 m² non couverts (3 027 m² au total), listées avec leur position dans `osmPartialReview`. Il peut s’agir d’extensions absentes de la BD TOPO, de démolitions ou de tracés divergents.
- Les **131 bâtiments OSM seuls** de la commune (88 de moins de 20 m²) peuvent être démolis depuis l’import cadastral : ils sont gardés et signalés en bleu.
- Les bâtiments construits après la dernière saisie IGN et absents d’OSM ne peuvent pas être détectés sans cadastre ni imagerie récente.
- Densité par rue (`npm run audit:density`, `data-sources/street-density.json`) : le Parc de l’Aérodrome (boulevard Antoine-de-Saint-Exupéry, avenue Philippe-Séguin) et le chemin de la Guide sont les secteurs les moins bâtis. C’est plausible (zone d’activités créée en 2012, chemin rural), mais à confirmer sur imagerie.

---

# Notes V1.4 — 24 septembre 2026

La V1.4 part de la V1.3 (`main`, commit `676a312`) et des six Bibles documentaires (`docs/bibles/`). Aucun fichier géographique source n’est modifié : OSM, contour communal, enrichissement IGN, végétation IGN et zones nommées gardent leurs SHA-256. Projection, origine, empreintes, voirie, rail, haies, bois, hauteurs, étages, usages, matériaux et modèle de Saint-Denis sont conservés.

## Direction artistique « Maizières dans un dessin animé »

Tout ce qui suit relève du rendu, pas de la donnée.

- **Lumière** : rampe toon à quatre paliers plus doux, soleil chaud, ciel bleu et sol doré pour l’éclairage ambiant. Les ombres sont plus claires (`shadow.intensity` 0,62) et leur cadrage suit la zone regardée : nettes de près, toute la commune de loin. La carte d’ombres n’est recalculée que lorsque la vue change nettement, jamais à chaque image.
- **Ciel et horizon** : dégradé CSS derrière un canevas transparent, brume à la couleur de l’horizon. Au-delà de l’emprise des données, un sol brumeux uni remplace le bord de boîte. Ce sol n’est pas un relevé : il est volontairement neutre, sans parcelles.
- **Champs** : dans les polygones agricoles OSM, un shader dessine une mosaïque de parcelles (blés, pailles, verts, terres), des lisières plus sombres et des sillons qui s’estompent au loin. **Ces parcelles, leurs couleurs et leurs sillons sont décoratifs** : ils ne décrivent ni les cultures réelles ni le parcellaire cadastral.
- **Sol** : prés et pelouses légèrement marbrés par un bruit à très basse fréquence. Les bois OSM et IGN reçoivent un sol de canopée tacheté, qui évoque des houppiers vus d’en haut. Ce motif ne positionne aucun arbre réel.
- **Bâtiments** : palettes déterministes par famille (maisons crème, blanc cassé, pierre, beige, pêche pâle ; commerces blancs ; industrie gris clair ; fermes pierre ; constructions légères bois). Tuiles en sept teintes de terre cuite, ardoise, bac acier pour les hangars. Les maisons ont des volets peints, une porte et une cheminée près du faîtage. Ces détails sont artistiques : couleurs, volets, portes et cheminées ne sont pas relevés. La façade de la mairie prend une teinte brique et pierre, comme la décrit la Bible 03 (§5).
- **Constructions légères** : en V1.3, les 482 bâtiments OSM `wall=no` étaient rendus comme des toits sur poteaux. Dans l’import cadastral français, ce tag signale une construction légère. La BD TOPO le confirme pour la plupart des cas associés (`construction_legere`). Ces bâtiments sont désormais des abris fermés et bas, en bois, ou des hangars au-delà de 160 m² ou quand l’usage est agricole ou industriel. Seuls `building=roof`, `carport` et la station-service restent des abris ouverts. Une hausse de toiture IGN supplémentaire est utilisée (615 au lieu de 614), car un ancien abri plat redevient un toit à deux pans.
- **Végétation** : houppiers arrondis à bosses (icosaèdre de 80 triangles, normales lissées, ombrage sombre à la base) et silhouette colonnaire pour les peupliers. Six verts accordés au lieu de teintes disparates. Les arbres des bois sont plus grands pour fermer la canopée. 2 900 arbres au maximum au lieu de 3 200 : le sol de canopée compense et le coût revient au niveau de la V1.3. Arbres instanciés, sans ombres ; les points d’arbres OSM restent prioritaires.
- **Routes et rail** : chaussée gris bleuté, accotement crème, marquage plus clair sur les axes principaux, chemins couleur terre. Ballast en deux tons. Tracés inchangés.
- **Étiquettes** : les lieux-dits ressemblent à des toponymes de carte peinte (italique, sans cadre) ; les équipements sont des pastilles discrètes ; le repère Bible est doré.

## Exploration

- **Rues** : la tolérance de clic s’élargit avec la largeur visible de la voie (au moins 16 px, sinon demi-largeur à l’écran + 8 px). Un point n’est prioritaire que s’il est cliqué presque exactement (10 px). Sinon la rue proche l’emporte. La surbrillance suit tous les tronçons du même nom, avec une épaisseur adaptée à la distance.
- **Tous les bâtiments** sont cliquables. Un bâtiment nommé affiche son nom. Un bâtiment sans nom affiche seulement un type (« Maison », « Construction légère », « Bâtiment »…), marqué « type estimé » s’il est déduit de l’empreinte, avec usage, niveaux et hauteur des murs et leur provenance. **Aucun nom n’est attribué.**
- **Surbrillance** testée en profondeur : coque dorée autour des triangles du bâtiment choisi, contours de zone, halo de repère. Elle ne traverse plus les maisons. Clic dans le vide, bouton de fermeture ou Échap : désélection.
- **Fiche** : type, nom source, faits courts, extraits des Bibles entre guillemets avec référence de section, provenance.

## Bibles documentaires

`npm run data:bible` produit `public/data/bible-annotations.json` à partir des Bibles 01 et 03, sans les modifier. Chaque texte affiché est une **citation exacte** ; `npm run check:bible` vérifie les SHA-256 des six Bibles et la présence mot pour mot des 172 citations.

- 56 des 73 noms de voies OSM figurent dans le référentiel des voies de la Bible 01 (§4.1). Quatre écarts de graphie sont affichés sans être tranchés : Rue Basse de Poussay / Rue Basse-de-Poussey, Rue des Cotterets / Rue des Cottrets, Rue Patris / Rue Patris-de-Breuil, Rue du Pont Bancelin / Rue du Pot-Bancelin. Le nom OSM reste le titre.
- Secteurs Poussey et Les Granges (§7.13), notes de voirie (§7, §9, §11, §12, §14, §20) et 37 lieux-dits OSM rapprochés du tableau §16 par normalisation du nom (accents, tirets, articles), avec type et niveau de confiance.
- Onze équipements nommés reçoivent le contexte des Bibles 01 et 03 : Saint-Denis, mairie, salles, IME, Glacière, Parc de l’Aérodrome, stade, écoles.
- **Gué de la Chapelle** : seul repère ajouté. La Bible 01 (§14.1) le situe à « l’angle RD619 / D160 vers Pars-lès-Romilly ». Le point est calculé à l’unique intersection des tracés OSM de l’avenue du Général-de-Gaulle et de la rue de la Chapelle, où part la rue Victor-Hugo (D 160). Il est présenté comme un site historique transformé : mare et chapelle ont disparu.
- Non placés, faute de géométrie fiable : noms de la Bible sans tracé OSM (Chemin du Bout des Ruelles, Rue de la Zone-Industrielle…), adresses (Hôtel des Granges, presbytère), croix, moulin, ancienne gare et passage à niveau (la rue du Général-Leclerc ne touche pas la voie ferrée dans l’instantané OSM).

## Portabilité future

Géométrie source, métadonnées et rendu restent séparés. Les données sont dans `public/data/`, le catalogue cliquable et ses annotations dans `cartography.js` et `bible-annotations.json`, les effets Three.js (shaders, palettes) dans `art.js`. Les identifiants stables (ways OSM, `cleabs` IGN, `bible01:…`) sont conservés. Aucun effet graphique ne porte d’information géographique.

---

# Notes V1.3 — 24 septembre 2026 (historique)

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

