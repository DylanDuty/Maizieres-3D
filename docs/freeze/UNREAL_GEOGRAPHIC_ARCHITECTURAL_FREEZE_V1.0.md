# Unreal Freeze V1.0 — Géographie V2.2 + Architecture V2.3.1

Ce document est **la référence** pour l'import Unreal Engine de Maizières-la-Grande-Paroisse (INSEE 10220).
« Importe le Freeze V1 » signifie : importer les fichiers listés dans `docs/freeze/UNREAL_FREEZE_MANIFEST_V1.0.json`, dans l'ordre de `unreal/freeze-v1/README.md`, et vérifier leurs SHA-256 avant l'import.

| | |
|---|---|
| Version du gel | 1.0 |
| Commit du gel géographique (V2.2) | `309e65ed52cfc0947bb8cd66117b7ff84ceb028a` |
| Commit de base architecture (V2.3) | `4c609ee17fdbc682883baafc87cbfaeade0cd22c` |
| Commit du gel final (V2.3.1) | `finalFreezeCommit` dans le manifeste |
| Manifeste | `docs/freeze/UNREAL_FREEZE_MANIFEST_V1.0.json` (SHA-256 de 52 fichiers canoniques) |
| Contrôle | `npm run check:architecture-stats` (et `npm run check:all`) |

## 1. Géographie (gelée depuis V2.2)

Les **42 fichiers géographiques** listés dans `data-sources/architecture/frozen-geography-v2.2-sha256.json` sont identiques octet pour octet au commit V2.2. `check:architecture-stats` le vérifie à chaque exécution contre `git show 309e65e:<fichier>`.

| Couche | Fichiers canoniques | Contenu |
|---|---|---|
| Bâtiments officiels | `public/data/buildings.geojson` | 2 494 empreintes (BD TOPO, cadastre, OSM), référentiel V1.6.2 |
| Bâtiments réintégrés | `public/data/buildings-additions-v2.0.1.geojson` | 90 empreintes publiques réintégrées en V2.0.1 (preuve orthophoto) |
| Relevés manuels | `public/data/buildings-manual-v2.2.geojson` | 12 relevés sur orthophoto IGN, **non officiels**, couche séparée |
| Provenance | `unreal/buildings/buildings-provenance-v2.2.json` | classe, position `unrealCm` et socle `baseZ` des 2 596 bâtiments |
| Terrain | `unreal/terrain/maizieres-mnt-lidarhd-1m-lamb93-ign69.tif`, `maizieres-heightmap-6097x6859.png`, `terrain-reference.json` | MNT LiDAR HD IGN 1 m, Lambert-93 / NGF-IGN69 |
| Routes et chemins | `unreal/roads/road-splines.json`, `public/data/roads.geojson` | splines 3D |
| Rail | `unreal/rail/rail-splines.json`, `public/data/rail*.geojson` | |
| Hydrographie et occupation du sol | `unreal/landcover/*.json`, `public/data/landcover.geojson` | eau, bois, haies, surfaces agricoles et artificielles |
| POI | `unreal/poi/poi.json`, `landmarks.json`, `areas.json` | POI, landmarks V1.11, zones |
| Origine | `scripts/terrain-frame.mjs`, `unreal/terrain/terrain-reference.json` | voir ci-dessous |

- **Population** : 2 596 bâtiments, dont 2 362 dans la commune. Ce sont 2 494 officiels, 90 réintégrés V2.0.1 et 12 relevés manuels V2.2.
- **Origine Unreal** : E0 = 758 278, N0 = 6 823 571, H0 = 0. Le système est Lambert-93 (EPSG:2154), avec l'altitude en NGF-IGN69.
  - Conversion : `X = (E − E0) × 100`, `Y = −(N − N0) × 100`, `Z = H × 100`.
  - Unités : cm. Axes : X vers l'est, Y vers le sud, Z vers le haut.
- Les exceptions géographiques constatées sont listées dans `docs/audit/GEOGRAPHIC_FREEZE_EXCEPTIONS.md`. Aucune n'a été corrigée : ce sont des constats pour une passe future.

## 2. Architecture (V2.3.1)

La version V2.3.1 fournit **2 596 / 2 596 profils** dans `public/data/building-architecture-v2.3.json`, avec leur version compacte pour Unreal dans `unreal/architecture/building-architecture.json`.
La V2.3.1 n'a relancé **aucun** enrichissement. Elle corrige seulement des incohérences internes démontrées ; voir `docs/audit/V2.3.1_ARCHITECTURE_FREEZE_QA.md`.

### Statistiques finales

Chaque ventilation porte sur les 2 596 bâtiments. `check:architecture-stats` recalcule chacune depuis les données.

**Hauteur**, meilleur statut entre la hauteur à l'égout et le point haut :

| Statut | Nombre |
|---|---:|
| officielle | 1 831 |
| mesurée | 546 |
| dérivée | 0 |
| estimée | 89 |
| inconnue | 130 |

**Toit** (type) :

| Confiance | Nombre |
|---|---:|
| A | 990 |
| B | 809 |
| C | 176 |
| inconnue | 621 |

**Faîtage** :

| Confiance | Nombre |
|---|---:|
| A | 887 |
| B | 272 |
| C | 504 |
| inconnue | 639 |
| sans objet (toit plat ou cuve cylindrique) | 294 |

**Niveaux** :

| Statut | Nombre |
|---|---:|
| connus : officiels (994) ou dérivés d'une hauteur officielle ou mesurée (1 104) | 2 098 |
| estimés | 85 |
| inconnus | 413 |

**Matériau de toiture** :

| Statut | Nombre |
|---|---:|
| connu : officiel (744), dérivé (144) ou estimé (422) | 1 310 |
| inconnu | 1 286 |

**Couleur de toiture** :

| Statut | Nombre |
|---|---:|
| connue | 2 483 |
| inconnue | 113 |

**Confiance globale** :

| Confiance | Nombre |
|---|---:|
| A | 708 |
| B | 1 087 |
| C | 672 |
| inconnue | 129 |

**Classes** (somme 2 596) :

| Classe | Nombre | % |
|---|---:|---:|
| `SHED` | 497 | 19,1 % |
| `ANNEX` | 409 | 15,8 % |
| `RES_PLAIN_PIED_GABLE` | 369 | 14,2 % |
| `RES_COMPLEX` | 305 | 11,7 % |
| `GARAGE` | 238 | 9,2 % |
| `RES_R1_GABLE` | 202 | 7,8 % |
| `INDUSTRIAL` | 120 | 4,6 % |
| `COMMERCIAL` | 75 | 2,9 % |
| `SILO_TANK` | 72 | 2,8 % |
| `HANGAR` | 70 | 2,7 % |
| `RES_R1_HIP` | 46 | 1,8 % |
| `RES_FLAT` | 45 | 1,7 % |
| `RES_PLAIN_PIED_HIP` | 45 | 1,7 % |
| `FARM` | 33 | 1,3 % |
| `RES_R2_PLUS` | 24 | 0,9 % |
| `PUBLIC` | 16 | 0,6 % |
| `OTHER` | 15 | 0,6 % |
| `GREENHOUSE` | 5 | 0,2 % |
| `UNKNOWN` | 4 | 0,2 % |
| `HERITAGE` | 3 | 0,1 % |
| `WATER_TOWER` | 2 | 0,1 % |
| `RELIGIOUS` | 1 | 0,04 % |

### Cas particuliers

La liste lisible par machine est dans `unreal/freeze-v1/architecture-exceptions.json`.

- **4 `UNKNOWN`** : `manual-v2.2:vis-A`, `vis-F`, `vis-H1` et `vis-H2`. Ce sont des relevés manuels dont aucune source ne donne l'usage. Ils restent `UNKNOWN`, parce qu'attribuer une classe reviendrait à inventer un usage.
- **75 bâtiments de la zone masquée** : l'orthophoto IGN y est servie en mosaïque et le LiDAR est interpolé.
  - Aucun attribut n'y est observé : toit, couleur, matériau, faîtage et hauteurs mesurées sont `unknown`, et la confiance globale aussi.
  - La classe vient de la BD TOPO ou de la typologie.
  - Unreal leur applique un archétype neutre.
- **12 relevés manuels V2.2** : provenance `orthophoto_manual_v2.2`, couche séparée et désactivable (`?manual=0` rend 2 584 bâtiments). Ils ne sont **jamais** des géométries officielles.
  - `vis-A` et `vis-H1` : toit plat (confiance B) et hauteur inconnue ; aucune élévation LiDAR 2025.
  - `vis-U2` : habitation par observation visuelle ; aucune source d'usage officielle n'existe.
- **16 landmarks**, dont 4 `unique_model` : `poi:eglise-saint-denis`, `poi:chateau-eau-poussey`, `poi:chateau-eau-granges` et `poi:monument-aux-morts`. Les autres sont 10 `procedural_custom` et 2 `procedural` ; le détail est dans `unreal/architecture/landmark-architecture.json`.

### Limites

- **Couverture** : 621 types de toit restent inconnus, faute de pixels LiDAR suffisants (petits objets, végétation, zone masquée). Il en va de même pour 639 faîtages applicables, 130 hauteurs et 1 286 matériaux.
- **Couleurs** : ce sont des **familles** lues sur l'orthophoto à 0,5 m, et non des relevés de teinte exacte.
- **Niveaux** : la BD TOPO compte les combles aménagés dans ses niveaux. Les niveaux lisibles en façade sont `visibleStoreys`.
- **Zone masquée** : ses empreintes datent d'une saisie BD TOPO ancienne et ne peuvent pas être vérifiées sur les sources 2025.

## 3. Règles Unreal

**Unreal peut modifier** :
- le style visuel, les shaders et les matériaux stylisés ;
- les détails non documentés : menuiseries, cheminées, lucarnes non relevées, teinte d'enduit ;
- la variation procédurale autorisée par l'archétype, avec `variationSeed` comme graine ;
- la végétation, les props, l'éclairage et l'ambiance.

**Unreal ne peut PAS modifier sans nouvelle preuve** :
- l'empreinte d'un bâtiment, ses XY et son socle ;
- le tracé routier, les cours d'eau et le terrain de référence ;
- l'origine ;
- l'identité d'un bâtiment et la provenance d'une donnée ;
- une hauteur `official` ou `measured`, un type de toit de confiance A ou B, ou un faîtage mesuré.

**Une valeur `unknown` reste `unknown`.**
- Unreal peut appliquer un archétype neutre à un bâtiment inconnu, mais ce choix visuel ne devient jamais une vérité documentaire. Un archétype attribué ne rend pas un bâtiment « fidèle ».
- `not_applicable` (faîtage d'un toit plat ou d'une cuve) n'est pas un inconnu : il ne faut jamais y ajouter de faîtage.

## 4. État

La valeur de `READY_FOR_UNREAL_FREEZE` est donnée par `readyForUnreal` dans le manifeste. Le rapport `docs/audit/V2.3.1_ARCHITECTURE_FREEZE_QA.md` en donne les conditions et leur vérification.
