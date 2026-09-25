# Vérification V1.10 — occupation du sol, végétation et hydrographie Unreal, 25 septembre 2026

Branche `opus/v1.10-landcover`, à partir de `44f853f`. Le bâti, le terrain, la voirie, le ferroviaire et l’origine Unreal sont inchangés (vérifié par SHA-256). Détail complet : `docs/referentiel-occupation-sol.md`.

| Mesure | Valeur |
|---|---|
| Parcelles agricoles (RPG 2024) | **560** dans l’emprise, **2 438,20 ha** ; **334** dans la commune, **1 235,74 ha** |
| Par type (ha emprise / commune) | terre arable 329 : 2 180,96 / 1 075,20 · jachère 119 : 114,97 / 89,92 · prairie permanente 39 : 100,43 / 46,05 · prairie temporaire 17 : 33,34 / 20,13 · culture permanente 3 : 1,98 / 0 · autre 53 : 6,52 / 4,43 |
| Cultures documentées | 560 sur 560, année de culture **2024** (historique 2023 : 460, 2022 : 439 ; jamais présenté comme permanent) |
| Bois et forêts | **253** polygones, **1 092,91 ha** (450,22 ha dans la commune) : peupleraies 614,82 ha, forêt fermée de feuillus 445,07 ha |
| Haies | **378** haies DSB, **28,221 km** (12,287 km dans la commune), 237 A / 141 B ; 265 haies polygonales sans linéaire (10,18 ha) séparées |
| Arbres documentés | 2 (OSM, B) ; aucun arbre tiré de l’orthophoto |
| Hydrographie linéaire | **228** tronçons, **64,721 km** (23,952 km dans la commune) ; **136 nommés** / 92 sans nom ; 168 BCAE |
| Surfaces en eau | **85**, **72,21 ha** (16,88 ha dans la commune) ; aucune nommée |
| Surfaces artificialisées | **78** : 43 surfaces (11,30 ha), 35 périmètres fonctionnels (561,6 ha) ; 8 compléments OSM en confiance C |
| Relations eau × voirie / rail | 80 : 27 ponts routiers V1.8, 45 buses probables, 2 pont ferroviaire V1.9, **6 ouvrages non documentés** |
| Doublons / sans provenance | 0 / 0 |
| Recouvrements RPG × bois / eau | 45 : 38 de moins de 0,2 ha (bandes de contour), 7 revus à l’orthophoto, **2 ouverts** |
| Non classé dans la commune | 259,7 ha (191 ha hors périmètres) ; 51 zones de plus de 1 ha, surtout des jardins ; **2 ouvertes** |
| Simplification 0,5 m | écart de surface ≤ 0,32 % par couche, ≤ 2 % par objet ; source conservée pour 49 petits objets |
| Incohérences ouvertes | **19** |

## Contrôles

- `npm run check:all` : **10 contrôles OK**. Ce sont `check`, `check:enrichment`, `check:presentation`, `check:interaction`, `check:bible`, `check:buildings`, `check:terrain`, `check:roads`, `check:rail` et `check:landcover`.
- `check:landcover` vérifie :
  - SHA-256 du bâti (2 494 bâtiments, dont 2 265 dans la commune), des fichiers du terrain V1.7, de la voirie V1.8 et du ferroviaire V1.9 ;
  - `UNREAL_ORIGIN` ;
  - SHA-256 des 17 instantanés et emprise de requête ;
  - géométrie source de chaque objet identique à l’instantané ;
  - provenance et confiance partout ; OSM jamais en confiance A ;
  - culture datée (2024) et historique séparé ;
  - chaque haie adossée à un linéaire DSB ;
  - noms d’eau issus de sources officielles uniquement ;
  - conversions Unreal exactes (51 670 sommets de polygones, toutes les splines), points dans l’emprise ;
  - niveau d’eau jamais au-dessus du terrain, pas de profondeur ;
  - perte de simplification ≤ 2 % ;
  - 0 doublon, recouvrements de 0,2 ha et plus revus, décompte des incohérences.
- `pnpm build` réussi. Dans Chromium, les modes normal, `provenance`, `validation`, `terrain`, `roads`, `rail` et `landcover` chargent **2 494 bâtiments, sans rejet**. Le rendu normal est identique au pixel près à V1.9 (18 appels de dessin, 559 942 triangles). **Console sans erreur ni avertissement.**

## Limites

- Aucune source officielle d’arbres isolés ou d’alignements. Overpass et l’API OSM sont toujours refusés.
- Le RPG ne couvre que les surfaces déclarées. Les jardins et friches restent non classés.
- La culture est celle de 2024.
- « Canal de Poussey » et « rivière du Moulin » sont absents des sources officielles.

# Vérification V1.9 — référentiel ferroviaire et splines Unreal, 24 septembre 2026

Branche `opus/v1.9-rail`, à partir de `52f3984`. Le bâti, le terrain, la voirie et l’origine Unreal sont inchangés (vérifié par SHA-256). Détail complet : `docs/referentiel-ferroviaire.md`.

| Mesure | Valeur |
|---|---|
| Voies physiques (segments) | **25** (splines Unreal : 25, 1 639 points) ; 40 axes officiels BD TOPO |
| Longueur ferroviaire (voies physiques) | **24,9 km**, dont **15,1 km dans la commune** (axes BD TOPO : 18,6 km) |
| Voies principales | 2 voies (V1, V2, ligne 1000 Paris-Est – Mulhouse) et 1 communication : 12,5 km, dont 7,6 km dans la commune |
| Voies de service | 22 (4 voies de garage, 18 embranchements) : 12,4 km, dont 7,5 km dans la commune |
| Voies inactives ou déposées | aucune documentée ; 1 ancienne emprise sans voie (OSM, 3,7 km) en couche historique séparée |
| Statut | active 3, service 19, unknown 3 ; **statut connu sur 96,5 % des km** |
| Aiguillages (embranchements topologiques) | 28, dont 14 dans la commune ; 16 heurtoirs probables ; 4 limites d’emprise |
| Intersections topologiques | 48 nœuds ; 3 croisements sans connexion (à vérifier) ; 0 doublon |
| Passages à niveau | 4 : n° 70, 71, 73 (rue du Général-Leclerc), 74 ; rail et route au même Z |
| Ponts ferroviaires | 1 (18,5 m sur un écoulement boisé, tablier de 75,9 à 76,0 m) |
| Autres ouvrages | 1 passage supérieur (pont routier de la rue de l’Orme) ; 21 croisements de niveau route × voies de service |
| Segments orphelins | 1 fragment (2 voies, 0,83 km, zone floutée) |
| Altitude fiable | **99,6 %** de la longueur ; 0,3 % portée par ouvrage ; aucune pente aberrante (max 4 ‰ ligne principale, 14 ‰ service) |
| Incohérences ouvertes | **8** : 3 statuts inconnus, 1 orphelin, 1 voie presque connectée, 3 croisements sans connexion |

## Contrôles

- `npm run check:all` : **9 contrôles OK**. Ce sont `check`, `check:enrichment`, `check:presentation`, `check:interaction`, `check:bible`, `check:buildings`, `check:terrain`, `check:roads` et `check:rail`.
- `check:rail` vérifie :
  - SHA-256 du bâti (2 494 bâtiments, dont 2 265 dans la commune), des fichiers du terrain V1.7, de la voirie V1.8 (`roads.geojson`, `road-splines.json`, rapport) ;
  - `UNREAL_ORIGIN` ;
  - 40 axes BD TOPO à l’identique ;
  - chaque voie à moins de 10 cm de sa source ;
  - toute voie OSM `railway=rail` présente, aucun élément historique dans le réseau ;
  - conversion Unreal exacte, 25 m au plus entre points ;
  - profil à moins de 1 m du MNT hors ouvrage, pentes plausibles ;
  - PN complets et au niveau de la route ;
  - tablier de pont à plus de 1 m au-dessus du terrain sous l’ouvrage.
- `pnpm build` réussi. Dans Chromium, les modes normal, `validation`, `terrain`, `roads` et `rail` chargent **2 494 bâtiments, sans rejet**. Le rendu normal est inchangé (18 appels de dessin, 559 942 triangles). **Console sans erreur ni avertissement.**

## Limites

- API OSM et SNCF Réseau open data refusées par le proxy : pas de nœuds OSM (aiguillages, heurtoirs), pas de classement des PN ni de profil en long officiel.
- Embranchements sud de La Station en zone floutée par l’IGN.
- Ballast, plateforme et caténaire non documentés.

---

# Vérification V1.8 — référentiel voirie et splines Unreal, 24 septembre 2026

Branche `opus/v1.8-roads`, à partir de `2081b47`. Le bâti, le terrain et l’origine Unreal ne sont pas modifiés. Détail complet : `docs/referentiel-voirie.md`.

## Statistiques

Deux périmètres : l’emprise du terrain V1.7 (commune + environ 530 m de marge) et la commune seule.

| Mesure | Emprise terrain | Commune |
|---|---:|---:|
| Tronçons actifs | 1 656 (BD TOPO 1 549, dont 1 049 enrichis par OSM ; compléments OSM 107) | 776 |
| Splines Unreal | 1 585 (51 003 points) | — |
| Longueur totale | **250,4 km** | **107,6 km** |
| Route principale | 8,9 km | 4,7 km |
| Route secondaire | 22,9 km | 13,2 km |
| Voie locale / résidentielle | 35,4 km | 17,2 km |
| Voie de desserte / accès | 15,9 km | 8,2 km |
| Voie piétonne | 0,2 km | 0 km |
| Chemin carrossable (empierré) | 52,8 km | 23,1 km |
| Chemin rural (terre) | 91,7 km | 33,9 km |
| Sentier | 22,5 km | 7,3 km |
| Voies nommées | 535 tronçons, 51,9 km, 128 noms | 312 tronçons, 31,3 km, 88 noms |
| Voies non nommées | 1 121 tronçons, 198,5 km | 464 tronçons, 76,4 km |
| Largeur connue (BD TOPO) | 800 tronçons (48 %), 77,8 km (31 %) ; **93 % des km revêtus** | 41,5 km sur 43,3 km revêtus |
| Largeur estimée par catégorie | 856 tronçons (52 %), 172,6 km : surtout chemins et sentiers | — |
| Largeur mesurée | 0 | 0 |
| Chemins (carrossables et ruraux) | 554, 144,6 km | 217, 57,0 km |
| À ne pas goudronner dans Unreal (chemins et sentiers) | 167,1 km | — |
| Intersections (carrefours et embranchements) | 958 (144 carrefours, 814 embranchements, 55 nœuds de giratoire) | 448 |
| Impasses | 164 | 82 |
| Fragments orphelins | 1 (0,35 km, parking de La Belle Idée, hors commune) | 0 |
| Voies presque connectées / doublons / croisements sans nœud | 0 / 0 / 0 (21 croisements d’allées de parking reçoivent un nœud) | — |

**Ponts et ouvrages à traiter à part dans Unreal :**
- 30 tabliers de pont (32 tronçons BD TOPO), dont 10 dans la commune ;
- 3 ouvrages hydrauliques non répertoriés, repérés par le profil et confirmés sur l’orthophoto ;
- 4 passages à niveau (n° 70, 71, 73 rue du Général-Leclerc, 74) ;
- 15 croisements avec des voies de service ferroviaires (La Station) ;
- 1 pont routier au-dessus de la voie ferrée (rue de l’Orme).

**Trottoirs** : aucune donnée fiable, donc aucun trottoir créé. 54,2 km de voies urbaines sont marqués « à déterminer ».

## Incohérences restant ouvertes : 23

- 1 fragment orphelin : boucle de parking d’un restaurant de La Belle Idée, dont le raccord à la voirie n’existe ni dans OSM ni dans la BD TOPO.
- 2 sites d’anomalie de profil à vérifier sur place (4 détections) :
  - creux sous le chemin de la Croix des Fourches, près d’une éolienne ;
  - bosse de 1,3 m sur un chemin de la centrale photovoltaïque.
- 18 compléments OSM impossibles à confirmer :
  - 16 non vérifiables (couvert forestier, peupleraie, orthophoto floutée) ;
  - 2 douteux.
- 1 désaccord de structure : un tronçon est un pont dans OSM mais pas dans la BD TOPO (passerelle piétonne probable). Les 10 autres désaccords sont des ponts BD TOPO dont la voie OSM principale ne porte pas l’étiquette de pont : sans conséquence.
- BIBLE_01 : « Chemin à Leroy » et « Chemin Noir » sont absents des données. Deux graphies diffèrent de la Bible (Bout des Ruelles, Pot Bancelin).

## Contrôles

- `npm run check:all` réussit, soit **huit contrôles** : les six du bâti, `check:terrain` et `check:roads`.
- `check:roads` vérifie :
  - bâti gelé intact (SHA-256, 2 494 bâtiments dont 2 265 dans la commune) et terrain V1.7 intact ;
  - `UNREAL_ORIGIN` inchangée ;
  - chaque tronçon BD TOPO présent avec sa géométrie exacte, et ses largeurs officielles et ponts reportés ;
  - compléments OSM à moins de 10 cm de leur voie source ;
  - chaque nom issu d’une source ;
  - aucun chemin présenté comme route revêtue ;
  - `inferred` égal à la table de la catégorie ;
  - chaque tronçon actif dans une seule spline ;
  - points à 5 m au plus d’intervalle, conversion Unreal exacte ;
  - Z des points au sol égal au terrain V1.7 à 1 cm près, sauf les `zOverride` documentés ;
  - exclusions justifiées.
- `pnpm build` réussi. Dans Chromium :
  - rendu normal, `?diagnostic=validation`, `?diagnostic=terrain` et `?diagnostic=roads` : **2 494 bâtiments, aucun rejet** ;
  - rendu normal inchangé (18 appels de dessin, 559 942 triangles) ;
  - **console sans erreur ni avertissement**.

---

# Vérification V1.7 — référentiel terrain et heightmap Unreal, 24 septembre 2026

Branche `opus/v1.7-terrain`, à partir de `b1d4c27` (bâti gelé). Aucune empreinte de bâtiment n’a été modifiée. Détail complet : `docs/referentiel-terrain.md`.

| Mesure | Valeur |
|---|---|
| Source IGN retenue | LiDAR HD **MNT** (sol nu), 56 dalles. Vols de février et octobre 2025, édition du 19/05/2026. Téléchargées le 24/09/2026 depuis `data.geopf.fr` |
| Résolution native | 0,5 m |
| Résolution de travail | 1 m pour Unreal et le GeoTIFF (échantillons source exacts) ; 10 m pour le contrôle Three.js |
| Système | EPSG:2154 Lambert-93, altitudes NGF-IGN69 (EPSG:5720) |
| Superficie couverte | 41,81 km² : la commune plus 529 à 553 m de marge |
| Dimensions X / Y | 6 096 m × 6 858 m (E 755 390–761 486, N 6 819 514–6 826 372) |
| Altitude min / max | **71,10 m / 103,65 m** ; amplitude 32,54 m |
| Nombre de cellules | 41 819 323 nœuds à 1 m ; 167 251 381 cellules source à 0,5 m |
| Cellules NoData | **0** (source et grille) ; aucune valeur aberrante |
| Origine locale Unreal | `UNREAL_ORIGIN` = E 758 278, N 6 823 571, H 0 NGF-IGN69 ; Unreal X = (E − E0) × 100, Y = −(N − N0) × 100, Z = H × 100 (cm) |
| Heightmap Unreal | PNG 16 bits, **6 097 × 6 859** : 24 × 27 composants de 2 × 2 sections de 127 quads, échelle 100 / 100 / 100 |
| Perte 0,5 m → 1 m | écart quadratique moyen 2,2 cm ; 99 % sous 8,5 cm ; maximum 3,65 m (vanne du bras mort) |
| Quantification 16 bits | 7,8 mm par pas ; erreur maximale 3,9 mm |
| Grille Three.js 10 m | écart quadratique moyen 10,8 cm par rapport au 1 m ; maximum 1,76 m |

Fichiers produits :
- `unreal/terrain/maizieres-mnt-lidarhd-1m-lamb93-ign69.tif` (83,5 Mo) ;
- `unreal/terrain/maizieres-heightmap-6097x6859.png` (29,4 Mo) ;
- `.r16` (83,6 Mo, régénéré, hors Git) ;
- `unreal/terrain/terrain-reference.json` ;
- `public/data/terrain-threejs.bin` + `.json` (0,7 Mo) ;
- `public/data/building-terrain-elevation.json` (0,7 Mo) ;
- dalles sources (896 Mo) hors Git, avec leur manifeste SHA-256 versionné.

## Contrôles

- `npm run check:all` réussit, soit **sept contrôles** : les six existants et `check:terrain`.
- `check:terrain` :
  - fichiers conformes à leur SHA-256 ;
  - 56 dalles sur 56 vérifiées ;
  - GeoTIFF et heightmap relus (erreur maximale 3,9 mm) ;
  - origine et transformations exactes ;
  - `buildings.geojson` identique au gel V1.6.2 ;
  - 2 494 bâtiments, chacun avec une altitude de socle.
- GDAL 3.10 (rasterio) relit le GeoTIFF : EPSG:2154, emprise exacte, échantillons identiques aux dalles source. Le PNG est lu en 16 bits.
- Raccords de dalles et de missions : sans marche (rapport au plus 1,27). 66 anomalies locales de plus de 1 m, toutes des ouvrages ou talus réels.
- Contrôle visuel sur l’ombrage :
  - voie ferrée OSM exactement sur son remblai ;
  - bâtiments sur leurs emprises ;
  - limite communale le long des anciens méandres de la Seine ;
  - aucun décalage de projection.
- `pnpm build` réussi. Dans Chromium :
  - rendu normal et `?diagnostic=validation` : **2 494 bâtiments, aucun rejet**, 18 appels de dessin, 559 942 triangles, exactement comme en V1.6.2 ;
  - `?diagnostic=terrain` : 2 494 bâtiments posés à leur socle, relief de 327 570 sommets, 0 NoData ;
  - **console sans erreur ni avertissement** dans les trois modes.

## Zones douteuses

- **Ponts** : absents du MNT sol nu. La voie ferrée présente 4 ruptures, et la rue du Pont de Clairvaux une pente de 58 %. Ils sont à modéliser à part dans Unreal.
- **167 bâtiments de la commune** ont plus de 1,5 m de dénivelé sous leur emprise (rampes, talus, cours en contrebas). Le socle recommandé est le minimum, pour qu’aucun côté ne flotte.
- **Plans d’eau** (Seine, bras morts) : surface interpolée par l’IGN, pas une bathymétrie.

---

# Vérification V1.6.2 — gel du référentiel bâti pour Unreal, 24 septembre 2026

## Accès

- `cadastre.s3.rbx.io.cloud.ovh.net` : **toujours refusé**. Le proxy de sortie répond 403 au CONNECT (politique d’organisation). `cadastre.data.gouv.fr` coupe lui-même la connexion. L’export Etalab n’a donc pas pu être téléchargé : **aucune différence Parcellaire Express ↔ Etalab n’a pu être établie**, et rien n’a été reconstruit.
- `data.geopf.fr` : accessible. En plus du WFS, j’ai utilisé la **BD ORTHO IGN 20 cm** du service WMS (vol des 28–29 avril 2025) comme témoin d’existence.
- RNB : instantané du 24/09/2026 réutilisé tel quel.

## V1.6.1 → V1.6.2

| Indicateur | V1.6.1 | V1.6.2 (gel) |
|---|---:|---:|
| Bâtiments du référentiel | 2 543 | **2 494** |
| Dans la commune | 2 299 | **2 265** |
| Ajouts du cadastre actuel conservés | 77 (58 dans la commune) | 56 (49), dont 45 visibles sur l’orthophoto |
| Ajouts cadastraux écartés | — | 21 (9 dans la commune) : 18 non bâtis, 3 artefacts de moins de 1 m de large |
| Empreintes OSM seules | 137 | 109 : 28 retirées (25 dans la commune), non bâties sur l’orthophoto |
| Extensions cadastrales intégrées à l’empreinte | 0 | 3 (commune) |
| RNB associés après revue individuelle | — | 2 |
| Nouveaux bâtiments découverts parmi les 19 RNB | — | 0 |
| RNB actifs de la commune sans empreinte | 19 (non analysés) | 22, tous analysés ; 2 restent non résolus |
| Confiance A / B / C | 1 984 / 466 / 93 | **1 994 / 475 / 25** |
| Dans la commune A / B / C | 1 849 / 384 / 66 | **1 858 / 395 / 12** |
| Bâtiments avec au moins un RNB vérifié | 2 016 (79,3 %) | 2 017 / 2 494 (80,9 %) |
| Dans la commune | 1 839 (80,0 %) | 1 840 / 2 265 (81,2 %) |
| Changements de classe depuis la V1.6.1 | — | 55 : C→B 45 (ajouts visibles), B→A 10 (3 extensions intégrées, 7 extensions démenties) |

Aucune suppression sans preuve : les 74 entrées de `data-sources/building-removed.json` portent chacune leur géométrie, leur version, leur motif et leurs preuves.

## Cas réellement non résolus : 42 (34 dans la commune)

| Groupe | Total | Commune |
|---|---:|---:|
| RNB sans empreinte : `58Y4QCN7YBR4` (abri et serre de jardin visibles, sans empreinte officielle) et `MEJK7RK7Q4B1` (zone sombre ambiguë, 51 rue Joliot-Curie) | 2 | 2 |
| Extensions cadastrales douteuses (auvents, marquises, stockage) | 6 | 3 |
| Ajouts cadastraux non vérifiables (arbres, ombre, taille) | 11 | 6 |
| Empreintes OSM seules non vérifiables | 23 | 23 |

À part, 134 bâtiments B (104 dans la commune) ont un contour différent du cadastre actuel. Leur existence est sûre, seul le tracé varie. Leur géométrie BD TOPO n’est pas modifiée.

## Contrôles

- `npm run check:all` réussit (six contrôles).
- `check:buildings` :
  - les 2 329 bâtiments IGN de la zone sont présents ;
  - 3 géométries sont enrichies d’une extension cadastrale ; elles contiennent toute l’empreinte BD TOPO d’origine, conservée dans `geometryEnrichment.ignGeometry` ;
  - toutes les autres géométries IGN sont inchangées ;
  - chaque OSM seul absent figure au journal ;
  - aucun ajout cadastral ne recouvre le référentiel ;
  - aucun doublon.
- `npm run audit:density` a été relancé sur le référentiel gelé.
- `pnpm build` réussit. Dans Chromium :
  - **2 494 bâtiments générés, exactement le nombre du référentiel**, aucun rejet ;
  - 18 appels de dessin, 559 942 triangles ;
  - `?diagnostic=validation` affiche A 1 994, B 295, B à contour différent 134, C OSM 15, ajouts cadastraux 56 ;
  - **console sans erreur ni avertissement**.

---

# Vérification V1.6.1 — validation officielle, 24 septembre 2026

## Accès

`data.geopf.fr` et `rnb-api.beta.gouv.fr` : accessibles. `cadastre.data.gouv.fr` : accessible par intermittence, mais le fichier Etalab est servi par `cadastre.s3.rbx.io.cloud.ovh.net`, **refusé (403)**. Le cadastre actuel utilisé est donc le Parcellaire Express (PCI DGFiP) de la Géoplateforme IGN.

## V1.6 provisoire → V1.6.1 officielle

| Indicateur | V1.6 provisoire | V1.6.1 officielle |
|---|---:|---:|
| Bâtiments affichés | 2 491 | **2 543** |
| Dans la commune | 2 259 | **2 299** |
| Référence cadastrale | OSM 2013–2018 (substitut) | PCI Express actuel : 2 070 dans la zone, 1 844 dans la commune |
| Ajoutés depuis le cadastre actuel | 0 | 77 (58 dans la commune ; 2 avec RNB actif) |
| Jumeaux décalés cadastre ↔ référentiel (ni ajoutés, ni supprimés) | — | 25 |
| Supprimés (absents BD TOPO + cadastre actuel + RNB) | 0 | 25 (18 dans la commune), journalisés |
| Géométries corrigées | 0 | 0 |
| Listes RNB corrigées | 0 | 268 |
| Changements de classe documentés | — | 335 (C→B 119, B→A 104, A→B 112) |
| Confiance A / B / C | 1 992 / 337 / 162 | **1 984 / 466 / 93** |
| Dans la commune A / B / C | 1 853 / 275 / 131 | 1 849 / 384 / 66 |
| Incertains (C + contours différents) | 128 | 237 (179 dans la commune) : 93 C et 144 B à contour différent du cadastre |

## RNB vérifié par l’API

| Mesure | Valeur |
|---|---:|
| Identifiants vérifiés | 2 316 (2 027 valides, 158 inactifs, 130 spatialement incohérents, 1 démoli) |
| Identifiants ajoutés par lien exact RNB → BD TOPO | 22 |
| Bâtiments avec au moins un RNB valide | 2 016 / 2 543 (79,3 %) |
| Dans la commune | 1 839 / 2 299 (80,0 %) |
| Bâtiments à plusieurs RNB valides | 32 (49 avant vérification) |
| Bâtiments RNB actifs de la commune hors de toute empreinte | 19 |

Le taux RNB baisse par rapport à la V1.6 (2 260 identifiants fournis par l’IGN), car les identifiants retirés ou attribués à un voisin sont maintenant écartés.

## Contrôles

- `npm run check:all` réussit (six contrôles).
- `check:buildings` : les 2 329 bâtiments IGN sont toujours présents avec leur géométrie d’origine. Chaque OSM seul absent est justifié dans le journal de suppression. Aucun ajout cadastral ne recouvre à plus de 10 % un bâtiment existant. Le fichier est complet pour un import sans Three.js.
- `pnpm build` réussi. Build servi dans Chromium : **2 543 bâtiments générés, exactement le nombre du référentiel**, aucun rejet, 18 appels de dessin, 562 823 triangles. `?diagnostic=validation` affiche A 1 984, B 320, B à contour différent 144, C OSM 18, ajouts cadastraux 77. **Console sans erreur ni avertissement.**

## Secteurs restant douteux

- Classes C et contours différents :
  - avenue du Général-de-Gaulle (14) ;
  - rue de la Chefferie (14) ;
  - rue Joliot-Curie (12) ;
  - rue du Général-Leclerc (8) ;
  - rue Jean-Monnet (7) ;
  - 6 chacun : rues Georges-Clemenceau, Achille-Flaubert, de l’Essy, Jules-Ferry, du Stade, des Lombards, Basse-de-Poussey.
- Chemin La Fin de Maizière : l’extension de l’abri n’est qu’en partie cadastrée (54 m² sur 554).
- 19 bâtiments RNB sans empreinte : `rnbOnly` dans `data-sources/building-validation.json`.

---

# Vérification V1.6 — validation du bâti, 24 septembre 2026

Branche `opus/v1.6-building-validation`. Rapport complet : `data-sources/building-validation.json`.

## Réponse à la question « avons-nous toutes les constructions connues des référentiels publics ? »

**Pas encore démontrable** : le cadastre Etalab actuel et l’API RNB sont restés inaccessibles (403 réseau). Avec les sources disponibles localement :

| Indicateur | Zone affichée | Commune |
|---|---:|---:|
| Total IGN BD TOPO | 2 329 | 2 128 |
| Total OSM | 2 022 | 1 817 |
| Total cadastre de référence (DGFiP 2013–2018 importé dans OSM, substitut) | 1 981 | 1 777 |
| Cadastre de référence présent dans le référentiel (couverture ≥ 50 %) | 1 728 | — |
| Cadastre de référence absent du référentiel | 0 | 0 |
| Bâtiments avec identifiant RNB (fourni par l’IGN, non vérifié) | 2 260 (90,7 %) | 2 080 (92,1 %) |
| **Total du référentiel final** | **2 491** | **2 259** |
| Ajoutés grâce au cadastre | 0 (cadastre actuel non accessible) | 0 |
| Supprimés après preuve de disparition ou d’erreur | 0 | 0 |
| Géométries corrigées | 0 | 0 |
| Litigieux : OSM seuls | 101 | 83 |
| Litigieux : contours partiels > 25 m² ou tracé récent | 27 | 21 |
| Sans correspondance : IGN absents du cadastre de référence | 200 | 173 |
| Sans correspondance : OSM absents de la BD TOPO | 162 | 131 |
| Différences géométriques non résolues | 96 empreintes, 3 027 m² non couverts (26 > 25 m²) | — |
| Confiance A / B / C | 1 992 / 337 / 162 | 1 853 / 275 / 131 |
| Bâtiments récents probables : IGN seuls saisis depuis 2019 / apparition fichiers fonciers ≥ 2015 | 49 / 6 | — |

Lecture :
- Tout le cadastre 2013–2018 disponible localement est dans le référentiel : aucun bâtiment cadastral n’y manque.
- Les incertitudes restantes vont dans l’autre sens : des constructions du cadastre ancien absentes de la BD TOPO récente (démolies ou omises) et des contours divergents.
- Les 173 bâtiments IGN absents du cadastre de 2018 (commune) sont probablement plus récents (82 d’origine cadastrale à l’IGN) ou non cadastrés.
- Seul le cadastre actuel pourra le confirmer.

## Contrôles et navigateur

`npm run check:all` réussit (six contrôles). `check:buildings` vérifie en plus, pour les 2 491 bâtiments et sans Three.js :
- géométrie Polygon/MultiPolygon, identifiant stable, source, provenance ;
- bloc de validation complet (confiance, statut, preuves) ;
- attributs IGN et hauteurs dérivées pour les bâtiments IGN ;
- métadonnées de projection et de validation.

Aucune géométrie IGN modifiée.

`pnpm build` réussi. Build servi dans Chromium : la carte affiche 2 491 bâtiments (18 appels de dessin, 560 099 triangles, comme en V1.5). Les modes `?diagnostic=provenance` et `?diagnostic=validation` fonctionnent avec leur légende. Fiche, modes Fluide et Élevée, noms, format portrait, clavier et Échap vérifiés. **Console sans erreur ni avertissement.**

## Secteurs restant à vérifier

- Vers la rue de l’Essy : trois bâtiments du cadastre 2018 (218 à 351 m²), isolés, absents de la BD TOPO ;
- Poussey : rue Joliot-Curie (sept cas litigieux, dont un abri de 336 m²), rue du Château, rue du Lavoir ;
- Avenue du Général-de-Gaulle (dix cas), rue Georges-Clemenceau (six) et rue de la Chefferie (six) : contours divergents et abris légers ;
- Chemin La Fin de Maizière : abri de 716 m², dont 554 m² absents de la BD TOPO ;
- Rue du Docteur-Sollier, rue des Baudets, rue Maurice-Renault, rue de l’Orme : cas isolés.

---

# Vérification V1.5 — exhaustivité du bâti, 24 septembre 2026

Branche `opus/v1.5-buildings`, partie de `opus/v1.4`. Source de vérité des bâtiments : `public/data/buildings.geojson` (voir `docs/referentiel-bati.md`).

## Couverture par source (commune = centre d’emprise dans le contour communal)

| Mesure | Commune | Zone affichée (commune + 150 m) |
|---|---:|---:|
| Bâtiments OSM (instantané du 31/05/2026) | 1 817 | 2 022 |
| Bâtiments IGN BD TOPO (instantané du 10/09/2026) | 2 128 | 2 329 |
| Bâtiments cadastre | non disponible (réseau refusé) | — |
| Correspondances OSM ↔ IGN un pour un (IoU ≥ 50 %) | 754 | 799 |
| IGN couverts ≥ 50 % par OSM | 1 900 | 2 044 |
| IGN couverts 10–50 % par OSM | 94 | 125 |
| **IGN sans équivalent OSM** (< 10 %) | **134** (10 560 m²) | 160 |
| OSM couverts ≥ 50 % par IGN | 1 606 | 1 764 |
| OSM couverts 10–50 % par IGN | 80 | 96 |
| **OSM sans équivalent IGN** (< 10 %) | **131** (3 975 m²) | 162 |
| Un OSM recouvrant plusieurs IGN (mitoyens dessinés d’un bloc) | 236 | 245 |
| Un IGN recouvrant plusieurs OSM | 72 | 81 |

## Avant / après

| Étape | V1.4 | V1.5 |
|---|---:|---:|
| Bâtiments rendus, zone affichée | 1 968 | **2 491** |
| Bâtiments rendus, commune | 1 793 | **2 259** |
| Après fusion (référentiel) | — | 2 491 = 2 329 IGN + 162 OSM seuls |
| Rejetés au traitement | 54, non comptés | 0 |
| Rejetés au rendu | 0 | 0 |
| Géométries invalides | non contrôlé | 0 |

Rejets V1.4 (reconstitués par `npm run audit:buildings`) :
- 23 empreintes OSM de moins de 3 m² (filtre de surface). En V1.5, 12 sont représentées par un bâtiment IGN, 6 sont gardées comme bâtiments OSM seuls, et 5 ne sont pas reprises : ce sont des fragments recouverts à 10–50 % par un bâtiment IGN ;
- 31 contours ronds ou très finement dessinés (silos, cuves), écartés par le calcul d’axe de toit. 30 sont hors commune, dans la zone de contexte ; 13 sont représentés par l’IGN, 1 gardé côté OSM, 17 recouverts partiellement par l’IGN.

Ce qui n’entre pas dans le référentiel, sans être rejeté :
- 160 bâtiments IGN dont le centre est hors de la zone affichée ;
- 1 860 empreintes OSM déjà représentées par l’IGN : 1 764 à au moins 50 %, 96 à 10–50 %.

Référentiel V1.5 : 2 260 identifiants RNB, 1 829 hauteurs IGN utilisables, 2 027 bâtiments IGN enrichis par la sémantique OSM, 4 repères IGN rattachés. Aucun bâtiment en plusieurs parties, 1 anneau intérieur.

## Contrôles

`npm run check:all` réussit (six contrôles : `check`, `check:enrichment`, `check:presentation`, `check:interaction`, `check:bible` et le nouveau `check:buildings`).

- `check:buildings` : les 2 329 bâtiments IGN de la zone sont présents une seule fois, avec leur géométrie d’origine octet pour octet. Les 162 OSM seuls sont présents, sans doublon sur un bâtiment IGN. Les SHA-256 des sources correspondent.
- `check:enrichment` : 2 491 bâtiments rendus sur 2 491, 0 rejet ; les SHA-256 des fichiers OSM et contour communal sont inchangés.
- `check:interaction` : église retrouvée par lancer de rayon, 2 465 bâtiments sans nom décrits sans nom inventé, 23 fiches de bâtiments nommés, contre 26 en V1.4. Les 14 noms de bâtiments OSM restent tous affichés : un bâtiment OSM découpé en plusieurs empreintes IGN forme une seule fiche (centre E.Leclerc, Sport E. Leclerc), et les enseignes partageant une même empreinte IGN sont affichées ensemble (« Gémo · Gitem », « La Grande Récré · GiFi »).
- `check:presentation` : 129 hausses de toiture bornées dans le rendu (journal `data-sources/roof-render-adjustments.json`), hauteurs IGN de murs inchangées.

Build `pnpm build` réussi : application 54,53 Ko, Three.js 530,05 Ko, CSS 7,44 Ko. Données chargées : +3,2 Mo avec `buildings.geojson`.

## Vérification dans le navigateur

Carte lancée (dev, puis build servi) : vue globale, centre, Saint-Denis, Poussey, Les Granges, rue des Sages et stade, Belle Idée, zone industrielle. Captures en mode normal et `?diagnostic=provenance`. Les bâtiments IGN seuls (rouge) sont dispersés : aucun quartier entier ne manquait dans les deux sources. Les rangées mitoyennes apparaissent maintenant maison par maison. Bâtiment récupéré cliqué (équipement sportif IGN de 2024 près du stade) : fiche « Empreinte IGN BD TOPO », usage sportif. Modes Fluide et Élevée, masquage des noms, format portrait, clavier et Échap vérifiés. **Aucune erreur ni avertissement en console.**

## Performances

| Vue initiale, Fluide, 1280 × 800 | V1.4 | V1.5 |
|---|---:|---:|
| Bâtiments | 1 968 | 2 491 |
| Triangles | 532 717 | 560 099 (+5,1 %) |
| Triangles des bâtiments | 162 509 | 189 901 |
| Appels de dessin | 18 | 18 |
| Parcours benchmark, moyenne par image (SwiftShader) | ≈ 408 ms | 399,6 ms |

Pas de nouveau matériau ni d’appel de dessin : les bâtiments restent regroupés en quatre lots, seules les ombres des murs et toits sont calculées. Chargement du build observé : 1,9 s.

## Zones et points encore douteux

- **Bâtiments OSM seuls de plus de 80 m² (8 dans la commune)**, rendus en bleu : quatre sont à Poussey (deux rue Joliot-Curie, un rue du Lavoir, un rue du Château), un rue du Docteur-Sollier et trois vers la rue de l’Essy (à environ 300 m). La plupart sont des constructions légères (`wall=no`). À vérifier : démolis ou absents de la BD TOPO ?
- **Empreintes OSM partiellement couvertes** : 26 ont plus de 25 m² non couverts, surtout vers le chemin La Fin de Maizière (jusqu’à 554 m²), rue Joliot-Curie, rue Georges-Clemenceau et avenue du Général-de-Gaulle.
- **Parc de l’Aérodrome et chemin de la Guide** : les moins bâtis le long des rues (0,2 à 0,7 bâtiment principal par 100 m). Plausible, à confirmer sur imagerie.
- **Constructions récentes** absentes des deux sources : impossibles à détecter sans cadastre ni imagerie récente.

---

# Vérification V1.4 — 24 septembre 2026

Branche `opus/v1.4`, partie de `main` (V1.3, `676a312`) avec le commit documentaire des Bibles repris par cherry-pick.

## Audit visuel de la V1.3 (avant développement)

V1.3 lancée dans Chromium et parcourue : vue globale, centre, Saint-Denis, Poussey, Les Granges, rue proche, zone industrielle, campagne, voie ferrée, clics.

| Gravité | Défaut observé | Traitement V1.4 |
|---|---|---|
| CRITIQUE | 462 bâtiments `wall=no` rendus comme des toits flottants sur poteaux, très visibles près du bourg | Abris légers fermés ou hangars (voir NOTES) |
| CRITIQUE | Campagne : immenses aplats agricoles (polygones Corine Land Cover) à bandes identiques, sans parcelles | Mosaïque de parcelles décorative |
| CRITIQUE | Clic sur une maison sans nom : désélection silencieuse ; la carte n’invite pas à explorer | Fiche pour tout bâtiment, sans nom inventé |
| IMPORTANT | Surbrillance sans test de profondeur : un voile jaune recouvre les maisons | Coques et contours testés en profondeur |
| IMPORTANT | Ombres vert-noir, en blocs de plus de 4 m par texel de près | Ombres claires, recadrées sur la vue |
| IMPORTANT | Rues : bande de 10 px seulement ; un repère proche capte le clic | Tolérance selon la largeur visible ; priorité à la rue |
| IMPORTANT | Maisons identiques (même beige, toits orange uniformes) ; aspect extrusion OSM | Palettes par famille, volets, portes, cheminées |
| IMPORTANT | Bois : sphères éparses sur un aplat vert | Sol de canopée, arbres de bois plus grands |
| SECONDAIRE | Étiquettes en boîtes blanches partout (aspect SIG) | Toponymes peints, pastilles |
| SECONDAIRE | Bord de maquette en boîte, ciel uni | Horizon brumeux, ciel dégradé |
| SECONDAIRE | Zone industrielle grise et plate | Bardages et toitures nuancés |

## Contrôles automatiques

`npm run check:all` réussit : `check`, `check:enrichment`, `check:presentation`, `check:interaction` et le nouveau `check:bible`. Build Vite réussi : JavaScript applicatif 52,20 Ko, Three.js 530,05 Ko, CSS 7,12 Ko avant compression (avertissement habituel sur la taille du lot Three.js). Aucune dépendance ajoutée.

- Les quatre fichiers de données V1.1 et `named-zones.geojson` sont inchangés (SHA-256). Toujours 1 968 bâtiments, 533 portions routières, 25 ferroviaires, 332 haies IGN et 10 460 traverses. 976 hauteurs de murs IGN, 662 étages, 510 matériaux, 75 toitures bornées dans le rendu (journal inchangé). 615 hausses de toiture IGN utilisées au lieu de 614 : un ancien abri plat redevient un toit à deux pans.
- `check:bible` : SHA-256 des six Bibles identiques au tableau de `docs/bibles/README.md`, 172 citations retrouvées mot pour mot, rues et lieux annotés présents dans OSM.
- `check:interaction` (étendu) : noms de voies conformes aux sources, aucune voie anonyme nommée, 1 942 bâtiments sans nom décrits seulement par un type, repère du Gué de la Chapelle posé sur les deux tracés OSM, écart de graphie Bible signalé sans renommer la rue OSM.

## Objets cliquables et noms

| Catégorie | V1.3 | V1.4 |
|---|---:|---:|
| Groupes de voies nommées (nom ou référence) | 81 | 81 (144 tronçons sources) |
| Voies sans nom ni référence, non nommées | 387 | 387 |
| Bâtiments nommés | 26 | 26 |
| Bâtiments cliquables sans nom (fiche type + provenance) | 0 | 1 942 |
| Zones nommées | 10 | 10 |
| Repères ponctuels | 124 | 125 (+ Gué de la Chapelle, Bible 01) |
| Objets avec extraits des Bibles | 0 | 114 |

Couverture des noms de rues : les 73 noms OSM de voies sont affichés. 56 figurent aussi dans le référentiel de la Bible 01 (§4.1) et quatre y ont une graphie différente, signalée sans être tranchée. Les autres (Rue Jacqueline Auriol, Rue Robert Galley, Rue Thierry Moussin, Rue Pierre Sémard, Avenue Georges Pompidou…) restent sous leur seul nom OSM. Les noms de la Bible sans tracé OSM ne sont pas placés.

Essais de clic dans le navigateur (build servi) :

| Cas | Résultat |
|---|---|
| Rue Pasteur, vue proche, 14 px à côté de l’axe | Rue Pasteur |
| Avenue du Général-de-Gaulle, vue de toute la commune, 8 px | Avenue du Général de Gaulle |
| Rue Joliot-Curie et rue du Lavoir (Poussey), 9–10 px | rue correcte |
| Rue Maurice-Renault, 12 px | Rue Maurice Renault |
| Rue Pasteur, vue moyenne, 10 px sur une maison riveraine | Maison (bâtiment visible prioritaire, comportement voulu) |
| Saint-Denis (volume), mairie, Gué de la Chapelle | nom, extraits des Bibles, provenance |
| Maison ordinaire | « Maison », usage, niveaux et hauteur IGN, « Bâtiment sans nom connu » |
| Clic dans un champ, Échap, bouton × | désélection et suppression de la surbrillance |

## Vérifications manuelles

Build servi par `vite preview` et observé dans Chromium : vue globale, centre-bourg, Saint-Denis, Poussey, Les Granges, voie ferrée, zone industrielle, campagne, rues nommées, bâtiments nommés et génériques, zones, lieux-dits. Recentrer, Noms des lieux (masquer / afficher), zoom et déplacement au clavier, `R`. Mode Élevée (ratio 1,25, ombres 2048 PCF) puis retour en Fluide. Redimensionnement en format portrait 420 × 820 puis retour. **Aucune erreur ni aucun avertissement en console.** Le premier rendu après passage en Élevée prend environ 0,3 s (compilation des matériaux et nouvelle carte d’ombres).

Aucune régression géographique constatée : positions, empreintes, tracés, haies et bois se superposent à la V1.3 dans les mêmes vues.

## Performances et réglages

| Mesure (vue initiale, 1280 × 800, Fluide, ratio 1) | V1.3 | V1.4 |
|---|---:|---:|
| Triangles | 513 337 | 532 717 (+3,8 %) |
| Appels de dessin sans sélection | 15 | 18 |
| Triangles des bâtiments | 118 585 | 162 509 |
| Arbres (instanciés, sans ombre) | 3 200 | 2 900 |
| Parcours benchmark, moyenne / image (3 essais) | 411,0 · 408,6 · 406,7 ms | 409,5 · 401,7 · 412,9 ms |
| Médiane / P95 | 383 / 800 ms | 383 / 784–817 ms |

Mesures alternées V1.3 / V1.4 (moyennes 408,8 et 408,0 ms, écart dans le bruit de mesure), même session, même parcours `?benchmark=1` (89 intervalles), sans autre charge. Navigateur : ANGLE / SwiftShader, rendu logiciel, 4 cœurs déclarés. Ces chiffres comparent les deux versions dans le même environnement ; ils ne mesurent pas un GPU. **La cible 30–60 FPS sur un PC avec accélération graphique n’est pas certifiée ici.** Une première version V1.4 à 3 200 arbres et trois quads par fenêtre coûtait environ 5 % de plus : les volets ont été fusionnés en un seul quad derrière la vitre, le nombre d’arbres ramené à 2 900 (le sol de canopée compense visuellement) et les disques de carrefour réduits à huit côtés.

Trois appels de dessin supplémentaires : sol des bois (shader de canopée), peupliers instanciés, sol d’horizon. Une sélection ajoute un à trois appels, libérés à la désélection. Le rendu reste à la demande. Les ombres ne sont recalculées que lorsque la vue change nettement ; seuls les bâtiments projettent une ombre. Fluide reste le mode par défaut, sans MSAA ni post-traitement.

Chargement observé du build : environ 1,0 s dans cet environnement.

## Réel et artistique

**Réel (sources inchangées)** : coordonnées, empreintes, hauteurs et étages IGN, usages, matériaux déclarés, voirie, rail, cours d’eau, haies et bois IGN, noms OSM et IGN, extraits des Bibles.

**Artistique** : parcelles, couleurs et sillons des champs ; marbrure des prés et canopée des bois ; couleurs des façades et des toits (sauf la teinte brique et pierre de la mairie, décrite par la Bible 03) ; volets, portes, cheminées ; position et forme des arbres procéduraux ; sol d’horizon hors emprise ; ciel. Formes et orientations des toits ordinaires restent estimées comme en V1.3.

## Limites restantes

- Performance non validée sur GPU grand public : essai à faire sur la machine cible (`?benchmark=1`).
- Reconnaissance par un habitant et ressenti « dessin animé » non vérifiés par un essai utilisateur.
- Les champs décoratifs peuvent suggérer à tort des cultures ou un parcellaire : c’est documenté ici et dans NOTES, mais pas dans l’interface.
- Au-delà de l’emprise des données, le sol brumeux marque une coupure franche, adoucie seulement par la brume.
- « Salle Polyvalente » (point OSM) et « Salle polyvalente » (zone IGN) restent deux repères distincts, non réconciliés.
- Les constructions légères fermées peuvent être en réalité des hangars ouverts : la donnée ne le dit pas.
- Pas de relief ; ponts et passages dénivelés non reconstruits.
- Aucun survol (pas de raycast au mouvement), pour préserver la fluidité : la découverte se fait au clic.

---

# Vérification V1.3 — 24 septembre 2026 (historique)

## Contrôles et conservation

Les quatre contrôles passent : check, check:enrichment, check:presentation et check:interaction. Build Vite réussi (18 modules). JavaScript applicatif 38,17 Ko, Three.js 511,32 Ko, CSS 4,76 Ko avant compression. Avertissement non bloquant de taille du lot Three.js ; aucune dépendance ajoutée.

Les quatre fichiers de données de référence sont inchangés par SHA-256. Toujours 1 968 bâtiments affichés, 533 portions routières, 25 ferroviaires, 332 haies IGN et 10 460 traverses. Les 976 hauteurs de murs IGN, 614 hausses de toiture dérivées, 662 étages connus et 510 matériaux uniques sont conservés. Aucune reconstruction des empreintes.

## Objets cliquables et noms

- 81 groupes de voies identifiés par nom ou référence ; 144 objets routiers sources (107 avec nom et 37 avec référence seule), auxquels s’ajoute la ligne ferroviaire nommée.
- 26 bâtiments identifiés, 10 zones polygonales nommées et 124 repères ponctuels. Le catalogue couvre la commune et le contexte conservé autour.
- Noms OSM, repères IGN, types d’équipements publics existants ; cinq contours nommés issus des zones d’activité et d’intérêt IGN locales.
- 387 objets routiers sources sans nom ni référence restent non nommés, dont chemins et dessertes. Les bâtiments ordinaires sans identité et les secteurs sans nom fiable ne reçoivent aucun nom inventé.
- Poussey et les autres lieux-dits ponctuels utilisent un halo de localisation ; aucun contour de quartier n’est inventé.

Le clic interroge les quatre lots de bâtiments existants, puis les points à moins de 22 pixels, les axes routiers à moins de 10 pixels et enfin les polygones de zones. Les bâtiments visibles sont prioritaires : au loin, une maison devant une rue peut intercepter le clic, il faut alors zoomer ou cliquer sur une portion dégagée. Cliquer sur un espace sans objet identifié, fermer le panneau ou Échap désélectionne. Une rotation ou un déplacement dépassant 6 pixels annule le clic ; les gestes multiples aussi. Le calcul de sélection est effectué seulement au clic, sans boucle de survol.

Le test automatisé vérifie les noms des voies contre leurs sources, l’absence de noms inventés pour les voies anonymes, la couverture sans trou ni chevauchement des indices de triangles, et un vrai lancer de rayon sur Saint-Denis. Résultats dans data-sources/interaction-audit.json.

## Vérification visuelle et navigateur

Projet lancé puis build de production servi localement. Vues d’ensemble et rapprochée du centre examinées : champs à larges bandes, couronnes arrondies, volumes, toitures et silhouette de l’église. La correction importante a élargi les motifs agricoles trop serrés et rendu les boutons d’étiquettes accessibles (suppression du aria-hidden hérité).

Sélections vérifiées dans le navigateur : Poussey, clic direct sur le volume de Saint-Denis, mairie, Rue Pasteur sur une portion de chaussée dégagée, zone IGN de la Glacière. Nom et provenance observés. Fermeture, Échap, clic vide, zoom clavier et recentrage vérifiés. Une sélection de zone passe à 17 appels de dessin, puis revient à 15 après désélection. Mode Élevée vérifié (ratio 1,25 et ombres 2048), puis retour à Fluide. Masquage et réaffichage des noms vérifiés. Aucun avertissement ou erreur applicatif capturé, y compris après le changement de qualité. Une pause de compilation a temporairement retardé une action du navigateur de contrôle.

Le style est maintenant un diorama toon léger ; la reconnaissance par un habitant et l’appréciation du rendu « film d’animation » ne sont pas certifiées par un test utilisateur. La géométrie réelle reste prioritaire.

## Performances avant / après

| Mesure | V1.2 | V1.3 |
|---|---:|---:|
| Triangles, vue initiale | 508 573 | 513 337 (+0,94 %) |
| Appels de dessin sans sélection | 15 | 15 |
| Arbres | 3 800 | 3 200 |
| Moyenne parcours, 639 × 686 | 731,29 ms | 168,11 ms |
| Cadence moyenne | 1,4 FPS | 5,9 FPS |
| Médiane | 1 000,7 ms | 166,4 ms |
| P95 | 1 000,8 ms | 199,2 ms |

Parcours identique de 105 images, 89 intervalles après échauffement, mode Fluide, ratio 1, page visible. V1.2 mesurée avant la passe ; V1.3 build final le 24 septembre. Navigateur ANGLE / Microsoft Basic Render Driver, 2 cœurs logiques, 8 Go déclarés. Les intervalles mesurent aussi l’ordonnancement du navigateur ; le palier autour d’une seconde de la V1.2 suggère une limitation supplémentaire. Ne pas attribuer tout l’écart au code ni présenter ces chiffres comme une mesure GPU isolée. Le coût géométrique reste proche. La cible de 30–60 FPS n’est pas atteinte ici et reste à vérifier sur GPU accéléré.

Préparation du build observée : 2,79 s. Calcul ponctuel de clic observé autour de 39 ms dans cet environnement. Les ombres restent 1024² en Fluide, 2048² filtrées en Élevée ; ratio adaptatif, pas de MSAA, pas d’ombres des arbres, rendu à la demande au repos. Le changement de qualité peut demander une compilation et figer temporairement ce navigateur logiciel.

## Livraison

maizieres-3d-v1.3.zip contient code, scripts, sources OSM/IGN locales, données préparées, référence, README, NOTES, QA et build dist. Sans node_modules, caches ou anciennes archives. Les versions précédentes ci-dessous sont conservées comme historique, pas comme description de la V1.3.

---

# Vérification V1.2 — finalisation du 15 septembre 2026

## Conservation et contrôles

- `npm run check` et `npm run check:enrichment` réussis pendant la passe ; `npm run check:presentation` réussi de nouveau le 15 septembre.
- Les quatre fichiers de données V1.1 sont inchangés par SHA-256, y compris les deux enrichissements IGN. Les empreintes de référence proviennent du ZIP V1.1 et figurent dans `data-sources/v1.1-data-hashes.json`.
- 1 968 bâtiments, 533 portions de voirie, 25 portions ferroviaires, 332 haies IGN affichées et 10 460 traverses conservés.
- Toujours 976 hauteurs de murs IGN, 614 hausses de toiture dérivées, 662 nombres d’étages et 510 matériaux uniques utilisés dans le rendu. Les 75 hausses bornées conservent leur valeur source ; journal dans `data-sources/roof-render-adjustments.json`. Aucune hauteur de mur IGN modifiée.
- La régression de triangulation des cours reste couverte par le contrôle V1.1.

## Build et vues contrôlées

Build Vite final réussi : 15 modules, JavaScript applicatif **29,93 Ko**, Three.js **510,34 Ko**, CSS **3,67 Ko** avant compression. Avertissement non bloquant sur le lot Three.js supérieur à 500 Ko. Aucune dépendance supplémentaire. Le build compilé a été relancé et contrôlé le 15 septembre.

Vues d’ensemble du bourg, de Poussey, de la voie ferrée, des champs et des secteurs industriels ; vue rapprochée de Saint-Denis et des maisons. Les volumes et repères géographiques sont conservés ; couleurs plus marquées, feuillages arrondis et silhouette spécifique de l’église visibles. Les bandes d’auto-ombrage observées pendant la passe ont été corrigées en supprimant la réception des ombres sur les bâtiments ; correction contrôlée en vue rapprochée.

Zoom et déplacement clavier, parcours de caméra en rotation/déplacement/zoom, bouton de qualité et retour à la vue initiale contrôlés. Masquage et réaffichage des noms contrôlés. Aucun message d’erreur ou avertissement applicatif capturé dans la session finale. La reconnaissance immédiate par un habitant n’a pas fait l’objet d’un test utilisateur.

## Charge graphique et réglages

| Indicateur | V1.1 | V1.2 Fluide | V1.2 Élevée |
|---|---:|---:|---:|
| Triangles, vue initiale | 1 011 973 | 508 573 | 508 573 |
| Appels de dessin | 15 | 15 | 15 |
| Arbres | 10 000 | 3 800 | 3 800 |
| Traverses | 10 460 volumes | 10 460 surfaces | Identique |
| Ratio maximal de pixels | 1,75 | 1,25 ; 1 sur matériel modeste déclaré | 1,5, minimum 1,25 |
| Carte d’ombres | 2048² | 1024² | 2048² |
| Filtrage des ombres | PCFSoft | Basic | PCFSoft |
| Ombres des arbres | Oui | Non | Non |
| MSAA | Oui | Non | Non |

**49,7 % de triangles en moins et 62 % d’arbres en moins**, sans hausse des appels de dessin. Seuls les bâtiments projettent encore des ombres ; les petits objets répétitifs n’en projettent pas. Le sol reçoit les ombres, les bâtiments et arbres n’en reçoivent pas. Ombres recalculées au démarrage et au changement de qualité, puis figées. Pas de boucle de rendu continue au repos.

Le mode Fluide est toujours le défaut. Il plafonne à 1 le ratio si le navigateur déclare au plus quatre cœurs logiques ou 4 Go ; autrement plafond 1,25, sans dépasser le DPR natif. Élevée utilise un ratio entre 1,25 et 1,5 et n’ajoute pas d’arbres. La sélection peut entraîner une pause ponctuelle de compilation des matériaux et recalcul des ombres.

## Mesures de navigation et limites

Parcours reproductible dans `src/benchmark.js` : 105 images, dont 89 intervalles après échauffement ; même trajectoire, fenêtre de **1025 × 890**, page visible. Les chiffres ci-dessous mesurent les intervalles requestAnimationFrame et incluent les attentes du navigateur ; ce ne sont pas des temps GPU isolés.

| Version / date | Ratio effectif | Moyenne par image | Médiane | P95 | Cadence moyenne |
|---|---:|---:|---:|---:|---:|
| V1.1 — 11 septembre | 1 | 992,19 ms | 848,9 ms | 2230,2 ms | 1,0 FPS |
| V1.2 Fluide finale — 15 septembre | 1 | 313,95 ms | 283 ms | 516 ms | 3,2 FPS |
| V1.2 Élevée finale — 15 septembre | 1,25 | 989,96 ms | 1000,7 ms | 1000,8 ms | 1,0 FPS |

Le gain mesuré en Fluide est d’environ **3,2 fois**, avec la prudence qu’imposent deux sessions à des dates différentes. Le navigateur expose **ANGLE / Microsoft Basic Render Driver**, deux cœurs logiques et 8 Go déclarés. Il ne s’agit pas d’une validation sur GPU grand public accéléré. **La cible de 30–60 FPS n’est pas atteinte dans ce contexte et n’est pas certifiée sur la machine cible.**

Le parcours Élevée final présente une cadence proche d’une seconde par image. Cette régularité peut aussi refléter une limitation de l’ordonnancement du navigateur de contrôle ; il est impossible d’isoler ici le seul coût du mode Élevée. Une mesure antérieure du 11 septembre, avant la dernière correction d’auto-ombrage, donnait environ 2 FPS dans ce mode. Ces variations renforcent la nécessité d’un essai avec accélération graphique réelle.

Chargement/préparation observé du build final Fluide : environ 2,15 s ; V1.1 : environ 4,36 s lors du parcours de référence. Valeurs locales sensibles à la charge et au cache. Les soumissions JavaScript très courtes au repos ne doivent pas être interprétées comme une cadence de navigation.

Pour reproduire : lancer le projet et ouvrir `/?benchmark=1`, ou `/?benchmark=1&quality=high`, puis lire `canvas[data-benchmark]`. Le parcours se termine seul et recentre la scène.

## Livraison

ZIP complet avec code, scripts, données locales, sources IGN, journal des toitures, référence fournie, README, NOTES, QA et build `dist/`. Exclusion de `node_modules`, des caches, photographies de recherche et anciennes archives. Documentation V1.1 conservée ci-dessous pour comparaison.

---


# Vérification de la version 1.1 — 11 septembre 2026

## Conservation et données

- `npm run check` réussi : INSEE 10220, origine dans la commune, axes est/nord corrects, coordonnées finies et emprise cohérente. Présence de Poussey, Saint-Denis et de la D 619 vérifiée.
- `npm run check:enrichment` réussi : empreintes SHA-256 des deux fichiers géographiques d’origine inchangées ; 1 217 associations respectant les seuils ; hauteurs bornées ; géométries de bâtiments finies et dans l’emprise.
- Régression de triangulation corrigée et vérifiée : carré de 100 m² avec cour de 16 m² → 84 m² rendus et intersectés, aucun remplissage du trou. Avant correction, le rendu produisait 148 m². Les coordonnées sources restent inchangées.
- Toujours 2 022 empreintes sources et 1 968 volumes affichés ; les objets de moins de 3 m² restent omis.
- Le fichier préparé contient 977 hauteurs de murs IGN, 615 hausses de toiture dérivées, 662 nombres d’étages et 522 déclarations de matériaux. Dans la scène : 976 hauteurs de murs, 614 hausses de toiture, 662 nombres d’étages, 510 matériaux uniques. Petites empreintes omises et matériaux mixtes expliquent les écarts.
- 533 portions routières après découpage, 25 portions ferroviaires, 10 460 traverses ; 332 polygones de haies IGN ; 10 000 arbres. La limite de végétation est maintenue.

## Build et navigateur

- Build Vite de production réussi : 13 modules ; JavaScript applicatif 26,57 Ko, Three.js 510,43 Ko, CSS 3,10 Ko (avant gzip). Avertissement de taille du lot Three.js supérieur à 500 Ko, sans échec.
- Données utilisées à l’exécution : 3 010 927 octets, environ 3,01 Mo. Les 4,52 Mo de sources IGN brutes restent hors des fichiers chargés par l’application.
- Version de développement et build servi par `vite preview` lancés et contrôlés dans le navigateur local.
- Contrôle visuel : bourg, branche de Poussey, lotissement circulaire, ligne ferroviaire, grands volumes industriels au sud-est, bois et haies. Vue rapprochée du centre et de Saint-Denis : volumes présents, pignons et clocher spécifiques visibles, maisons et abris différenciés.
- Zoom et déplacement au clavier, masquage/réaffichage des noms, puis recentrage vérifiés sur le build. Le glisser/rotation repose sur les OrbitControls existants, déjà contrôlés dans la V1.
- Aucun défaut visuel majeur constaté dans ces vues. La précision des toitures individuelles n’est pas validée par comparaison exhaustive au village.
- Une ancienne erreur de connexion du rechargement Vite (WebSocket) a été capturée après interruption du serveur de développement ; elle ne concerne pas le rendu de production. Aucun autre message d’erreur applicatif n’a été observé lors du contrôle.

## Performance

- Même vue de départ : **15 appels de dessin**, **1 011 973 triangles**, contre 970 962 auparavant, soit **+4,2 %**. Le regroupement des géométries reste en place.
- Durées de soumission observées : **1,5 à 2,4 ms** sur plusieurs images stabilisées, puis **223,6 ms** après une séquence de navigation et recentrage. La variabilité du navigateur de contrôle reste importante, comme dans la V1. Ce compteur mesure la soumission côté JavaScript, pas le temps GPU ni une cadence garantie ; la fluidité doit être appréciée sur la machine cible.
- Préparation locale observée : environ **4,0 s** en développement et **10,3 s** au premier chargement du build dans le navigateur de contrôle. Cette variabilité inclut la charge de l’environnement ; ce n’est pas une mesure reproductible de téléchargement ni une promesse de temps de démarrage.
- Rendu à la demande et ombres statiques conservés. Aucune animation permanente, texture haute résolution ni dépendance supplémentaire. Aucun objectif de 60 images/s n’est certifié.

## Limites de validation

Les données IGN ne sont pas toutes mesurées directement : méthodes d’acquisition et précisions sont conservées par objet. Les hausses de toiture sont statistiques. Orientations et formes des toits ordinaires restent déduites des empreintes ; le clocher et les parties de l’église ont des proportions estimées. Terrain plat, façades simplifiées, végétation distribuée de façon procédurale. Voir NOTES.md pour les sources et conventions détaillées.

Le ZIP complet fournit code, scripts, données préparées, sources IGN, référence et build. Il exclut `node_modules`, les caches, les photographies de recherche et les anciennes archives.

