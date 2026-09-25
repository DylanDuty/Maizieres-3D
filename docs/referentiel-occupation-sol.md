# Référentiel occupation du sol, végétation et hydrographie — Unreal (V1.10)

Le bâti (V1.6.2), le terrain (V1.7), la voirie (V1.8), le ferroviaire (V1.9) et `UNREAL_ORIGIN` sont gelés et seulement lus ; `check:landcover` vérifie leurs SHA-256. Les chiffres viennent de `data-sources/landcover/landcover-report.json`. Emprise : terrain V1.7 (E 755390–761486, N 6819514–6826372, Lambert-93) ; les valeurs « commune » portent sur la partie dans la limite communale (2 038,24 ha).

## 1. Sources

Instantanés immuables dans `data-sources/landcover/` (Géoplateforme WFS `data.geopf.fr`, téléchargés le 25/09/2026, requête BBOX = emprise du terrain, SHA-256 dans le rapport). `npm run data:landcover-fetch` ne remplace jamais un instantané existant.

| Source | Organisme | Millésime | Précision | Rôle |
|---|---|---|---|---|
| RPG 2024 `parcelles_graphiques` (575) + `codes_cultures` (147) | ASP / IGN | campagne PAC 2024 (dernière publiée) | dessin déclaratif des exploitants sur orthophoto | **parcelles agricoles** et culture principale déclarée 2024 |
| RPG 2023 et 2022 `parcelles_graphiques` (572, 573) | ASP / IGN | 2023, 2022 | idem | **historique** des cultures seulement |
| BD TOPO `zone_de_vegetation` (717) | IGN | BD TOPO V3 courante | métrique à décamétrique | bois, forêts, peupleraies, landes ; polygones « Haie » |
| BD TOPO `haie` (395 linéaires) | IGN / Dispositif national de suivi des bocages (DSB) | BD TOPO V3 courante | métrique | **haies linéaires** |
| BD Forêt V2 `formation_vegetale` (187) | IGN | V2 | 0,5 ha minimum | type de formation (TFV) et essence, attribut seulement |
| BD TOPO `troncon_hydrographique` (234, instantané V1.9 relu), `cours_d_eau` (31), `surface_hydrographique` (85), `plan_d_eau` (7), `detail_hydrographique` (4) | IGN | BD TOPO V3 courante | métrique | **axes et surfaces en eau**, noms officiels |
| Cours d’eau BCAE (172) | DDT / MASA, diffusion IGN | millésime le plus récent (2026) | métrique | contrôle : cours d’eau de la conditionnalité PAC |
| BD TOPO `zone_d_activite_ou_d_interet` (34), `terrain_de_sport` (6), `cimetiere` (2), `reservoir` (22), `equipement_de_transport` (14) | IGN | BD TOPO V3 courante | métrique | surfaces et périmètres artificialisés |
| OpenStreetMap (instantané du projet, 31/05/2026) | contributeurs OSM | 2026 | variable | **complément** seulement (confiance B ou C), jamais pris pour officiel |
| Terrain V1.7 (LiDAR HD MNT 1 m) | IGN | 2021-2022 | 0,1 à 0,5 m | Z des haies, niveau d’eau approximatif, pentes |
| Voirie V1.8, ferroviaire V1.9 | projet | gelés | — | croisements eau × route / rail |
| BIBLE_01 (§ hydrographie, lieux) et BIBLE_04 | projet | — | — | noms locaux et contexte ; aucun nom n’est attribué sans source officielle |
| BD ORTHO IGN 20 cm (avril 2025) | IGN | 2025 | 0,2 m | **contrôle visuel uniquement** ; aucune géométrie n’en est tirée |

Non disponibles : aucune couche officielle d’arbres isolés ou d’alignements d’arbres n’est accessible (ni BD TOPO, ni données communales) ; Overpass et l’API OSM restent refusés par le proxy. Aucune donnée plus grossière (Corine Land Cover, OSO) n’est utilisée à la place d’une source précise.

## 2. Modèle et règles

- **Géométrie source** (`public/data/landcover.geojson`, champ `geometry`) : identique à l’instantané, jamais modifiée. Un linéaire coupé par la limite de l’emprise garde l’identifiant de sa source avec un suffixe `#n`.
- **Géométrie Unreal** : partie dans l’emprise (découpée si besoin) en Lambert-93 pleine précision (`ringsL93`, `pointsL93`) et en centimètres Unreal (`ringsUnreal`, `points`). `X = (E − 758278) × 100`, `Y = −(N − 6823571) × 100`, `Z = altitude × 100`.
- **Version simplifiée** (`ringsUnrealSimplified`, `public/data/landcover-diagnostic.json`) : dérivée par Douglas-Peucker à **0,5 m**. Perte mesurée : écart de surface ≤ 0,32 % par couche, ≤ 2 % par objet. Si la simplification déplace plus de 2 % de la surface d’un objet (49 petits objets), la géométrie source est gardée pour lui. La simplification ne remplace jamais la source.
- **Chaque objet** porte : identifiant stable (celui de la source), provenance, confiance (A officiel, B officiel à contrôler ou OSM corroboré, C complément OSM seul), surface ou longueur totale et dans la commune.
- **Pas de procédural** : ni arbre, ni forêt, ni culture, ni herbe, ni matériau, ni rivière, ni PCG. Les objets sont des zones et des splines pour une génération future.

## 3. Agriculture (RPG 2024)

- **560 parcelles** dans l’emprise, soit **2 438,20 ha**. Dans la commune : **334 parcelles, 1 235,74 ha**. Toutes ont une culture déclarée 2024.
- Surface déclarée / surface géométrique : rapport médian 1,00.

| `landuse_type` (d’après la catégorie RPG TA/PP/CP et le groupe de culture) | Parcelles | ha | ha commune |
|---|---|---|---|
| terre_arable | 329 | 2 180,96 | 1 075,20 |
| jachere | 119 | 114,97 | 89,92 |
| prairie_permanente | 39 | 100,43 | 46,05 |
| prairie_temporaire | 17 | 33,34 | 20,13 |
| culture_permanente | 3 | 1,98 | 0 |
| autre_surface_agricole (SNE, bandes tampons, bordures) | 53 | 6,52 | 4,43 |

- Principales cultures déclarées **en 2024** : blé tendre d’hiver 708,87 ha, colza 266,31 ha, orge de printemps 259,60 ha, orge d’hiver 255,84 ha, betterave 226,13 ha, chanvre 141,13 ha, luzerne 140,46 ha.
- `crop_type`, `crop_code`, `crop_group`, `crop_year = 2024`, `crop_source = RPG 2024`. **La culture est celle d’une campagne**, jamais une caractéristique permanente (`cropNote`). `landuse_type` est la catégorie d’usage, plus stable.
- `cropHistory` : culture 2023 et 2022 de la parcelle correspondante (recouvrement IoU > 0,5). Retrouvée pour 460 parcelles en 2023 et 439 en 2022. Culture identique trois ans de suite : 88 parcelles.
- Les terres non déclarées au RPG (jardins, friches, terres de non-exploitants) ne sont **pas** inventées : elles restent non classées.

## 4. Bois et haies

- **Bois et forêts** (BD TOPO `zone_de_vegetation`, confiance A) : **253 polygones, 1 092,91 ha** (450,22 ha dans la commune).

| Type | Polygones | ha | ha commune |
|---|---|---|---|
| peupleraie | 68 | 614,82 | 286,97 |
| foret_fermee_feuillus | 86 | 445,07 | 149,15 |
| lande_ligneuse | 7 | 19,80 | 10,17 |
| bois (0,05 à 5 ha) | 89 | 8,33 | 3,93 |
| foret_ouverte | 3 | 4,89 | 0 |

- Attribut BD Forêt V2 (TFV, essence) joint quand il couvre au moins 30 % du polygone : 253 sur 253.
- `nearWatercourse` (160 polygones) signale seulement la proximité d’un cours d’eau (≤ 20 m). Ce n’est **pas** une classification « ripisylve », qu’aucune source ne documente ici.
- **Haies linéaires** (BD TOPO `haie`, DSB) : **378 haies, 28,221 km** (12,287 km dans la commune). Confiance A pour 237 (portées par un polygone BD TOPO « Haie » sur au moins la moitié de leur longueur), B pour 141. Largeur dérivée (surface du polygone / longueur, `widthSource` « dérivée ») pour 262. Hauteur quand la BD TOPO la donne.
- **Haies polygonales sans linéaire** (couche `hedge_polygon`, B) : 265 polygones, 10,18 ha, surtout des bosquets de jardin en village (revue orthophoto). Ils ne sont **jamais** convertis en haies linéaires.
- Aucun bord de parcelle n’est transformé en haie : toute haie correspond à un linéaire DSB (`check:landcover`).
- **Arbres documentés** : 2 (OSM `natural=tree`, confiance B). Aucun arbre ni alignement n’est digitalisé sur l’orthophoto.

## 5. Hydrographie

- **Axes** (BD TOPO `troncon_hydrographique`) : **228 tronçons, 64,721 km** (23,952 km dans la commune).
  - 101 permanents, 127 intermittents ; aucun souterrain ; aucun tronçon marqué « fossé » dans la BD TOPO.
  - 168 correspondent à un cours d’eau BCAE (≥ 50 % de la longueur à 5 m au plus).
  - **136 nommés** (50,2 km), 92 sans nom. Le nom vient uniquement de la BD TOPO (`cpx_toponyme_de_cours_d_eau`).
- Noms officiels présents : la Seine, Bras de la Seine, Ruisseau et Bras des Moulins de Poussey, Canal des Moulins, Noue de Ferloup (et son bras), Bras 01 et 02 / Cours d’eau 01 des Menus Prés, Fossé 03 des Epinettes, Noue des Barces, Noue des Fourchus, Bras et Canal des Moulins de Sauvage, et d’autres (22 noms).
- **« Canal de Poussey » et « rivière du Moulin »** (noms locaux de la Bible) n’existent dans aucune source officielle : aucun tronçon ne reçoit ces noms.
- **Surfaces en eau** : **85 polygones, 72,21 ha** (16,88 ha dans la commune).
  - 84 BD TOPO `surface_hydrographique`, dont 7 plans d’eau de gravière (14,54 ha), 17 écoulements naturels (lit de la Seine et des bras, 45,29 ha), 24 retenues, 6 mares, 30 bassins et réservoirs.
  - 1 complément OSM (bras de rivière, 2,41 ha, B).
  - Aucune surface n’a de nom propre dans les liens BD TOPO : aucun n’est attribué.
- **Z de l’eau** : `zSurfaceApprox` = MNT sol nu (l’IGN interpole les surfaces en eau) rendu non croissant vers l’aval pour les axes ; 10ᵉ centile du MNT pour les surfaces. C’est un **niveau approximatif** : aucune profondeur ni aucun fond n’est connu ou inventé. Pente moyenne (`slopePermil`) par tronçon.

## 6. Surfaces artificialisées

- 78 objets, en deux genres :
  - **surfaces** (43, 11,30 ha) : emprises minérales ou d’équipement (parkings, terrains de sport, cimetières, réservoirs, aire de triage) ;
  - **périmètres fonctionnels** (35, dont 34 BD TOPO pour 560,53 ha et 1 OSM) : zones d’activité ou d’intérêt, qui contiennent aussi bâtiments, voirie et espaces verts. Ce ne sont pas des surfaces imperméabilisées.
- Classes :
  - zone industrielle : 4, 199,59 ha (97,42 ha dans la commune). Ce sont la Zone Industrielle la Glacière, le **Parc de l’Aérodrome** (zone d’activités, 67 ha dans la commune), le dépôt d’hydrocarbures Seveal et une coopérative ;
  - centrale photovoltaïque : 3, 46,26 ha (15,26 ha dans la commune), confirmées à l’orthophoto ;
  - enceinte militaire : 30,89 ha ;
  - périmètres de parcs éoliens : 258,84 ha, dont 3,43 ha dans la commune ;
  - équipements publics et sportifs, aire d’accueil, parkings (11, 5,19 ha), terrains de sport, cimetières, réservoirs, emprise ferroviaire (aire de triage).
- La fonction d’un secteur n’est donnée que si la BD TOPO la documente (`natureDetail`). Les `landuse` OSM ne sont repris qu’en complément non couvert par la BD TOPO, en confiance C (8 objets). Aucun polygone OSM n’est pris pour vérité officielle.

## 7. Relations avec la voirie V1.8 et le ferroviaire V1.9 (sans les modifier)

80 croisements d’un axe hydrographique avec une route ou une voie :
- 27 sous un pont routier V1.8 ;
- 45 buses ou ponceaux probables (petit cours d’eau intermittent sous une voie sans ouvrage répertorié) ;
- 2 sous le pont ferroviaire V1.9 ;
- **6 ouverts** : ouvrage non documenté sur un cours d’eau permanent. Revue orthophoto : route secondaire en remblai (pont ou buse probable, absent de V1.8), chemins sous couvert boisé, chemins carrossables sur fossé (buses probables). V1.8 reste gelée.

## 8. Qualité

- Doublons (IoU > 0,9) : **0**. Objets sans provenance : **0**. Confiance B : 407 objets ou haies, C : 8.
- **Recouvrements RPG × bois / eau** : 45 recouvrements.
  - 38 font moins de 0,2 ha. Ce sont des bandes de contour entre limite RPG déclarative et contour BD TOPO, ou de petites surfaces déclarées (SNE, bandes tampons, jachères) en lisière de bois. Ils sont classés automatiquement comme non ouverts.
  - Les 7 de plus de 0,2 ha ont été revus à l’orthophoto (`landcover-review-v1.10.json`). 5 sont compatibles (jeune peupleraie sur prairie, bande boisée incluse dans une prairie déclarée, bordures).
  - **2 restent ouverts** : un couvert arboré épars de bord de Seine (prairie permanente déclarée × « forêt fermée », 9,4 ha) et un polygone BD TOPO « Bois » qui englobe une cour de ferme.
  - Les deux géométries sources sont toujours conservées.
- **Couverture de la commune** (grille de 2 m) :
  - 259,7 ha ne sont ni parcelle RPG, ni bois, ni haie, ni eau, ni surface artificielle, ni bâtiment, ni voirie. Hors périmètres fonctionnels : 191 ha.
  - 51 zones de plus de 1 ha. La revue des 8 plus grandes montre surtout des jardins, cours et cœurs d’îlots du bourg, de Poussey et des lotissements.
  - **2 restent ouvertes** : une friche non déclarée entre la centrale photovoltaïque et la zone industrielle, et une plantation en rangs en bord de Seine, couverte ni par la BD TOPO ni par le RPG. Aucune géométrie n’a été dessinée à l’œil.
- Chevauchements entre couches (grille de 2 m) : agriculture × bois 17,7 ha, bois × eau 5,2 ha (bois riverains sur le lit BD TOPO), agriculture × eau 0,1 ha.
- **Incohérences ouvertes : 19**. Ce sont 2 recouvrements, 6 croisements sans ouvrage documenté, 8 compléments OSM de confiance C, 2 zones non classées et 1 observation (noms locaux absents des sources officielles).

## 9. Fichiers

| Fichier | Contenu |
|---|---|
| `public/data/landcover.geojson` | référentiel complet (géométrie source, attributs) |
| `public/data/landcover-diagnostic.json` | géométrie simplifiée pour `?diagnostic=landcover` |
| `unreal/landcover/agricultural-polygons.json` | 560 parcelles RPG 2024 |
| `unreal/landcover/woodland-polygons.json` | 253 bois et forêts + `hedgePolygons` (265) |
| `unreal/landcover/hedge-splines.json` | 378 haies (points densifiés à 10 m, Z terrain) + 2 arbres |
| `unreal/landcover/water-lines.json` | 228 axes (points tous les 5 m, `zSurfaceApprox`, `zTerrain`) + 80 relations |
| `unreal/landcover/water-polygons.json` | 85 surfaces en eau |
| `unreal/landcover/artificial-surfaces.json` | 78 surfaces et périmètres |
| `data-sources/landcover/landcover-report.json` | rapport machine (sources, statistiques, qualité, incohérences) |
| `data-sources/landcover/landcover-review-v1.10.json` | revue orthophoto (observations, jamais de géométrie) |

Reproduction : `npm run data:landcover-fetch` (instantanés manquants seulement), `npm run data:landcover`, `npm run check:landcover`.

## 10. Diagnostic Three.js

`?diagnostic=landcover` dessine à plat :
- les terres arables et jachères, les prairies, les bois et peupleraies ;
- les haies DSB et les haies polygonales ;
- les surfaces en eau et les cours d’eau ;
- les surfaces artificialisées (remplies) et les périmètres d’activité (contour) ;
- les objets incertains (C) en rose.

C’est un outil de contrôle, sans travail artistique. Le rendu normal est inchangé.
