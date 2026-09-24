# Référentiel bâti — format intermédiaire (V1.5, validation officielle V1.6.1)

Fichier : `public/data/buildings.geojson`, produit par `npm run data:buildings` (`scripts/build-buildings.mjs`) à partir des instantanés locaux. Il est la **source de vérité des bâtiments** de la carte Three.js et le point de départ prévu pour un export Unreal : aucune recherche documentaire n’est à refaire pour générer les volumes.

## Principe

1. **Géométrie principale : IGN BD TOPO** (`data-sources/ign/batiment.geojson`, couche `BDTOPO_V3:batiment`, Licence Ouverte 2.0). Tous les bâtiments dont le centre de l’emprise est dans la zone affichée (commune + 150 m) sont repris tels quels, géométrie incluse, sans filtre de taille, de nature ou d’attribut.
2. **Complément : OpenStreetMap** (`public/data/maizieres.geojson`, ODbL). Une empreinte OSM est ajoutée seulement si moins de 10 % de sa surface est recouverte par la BD TOPO. Entre 10 et 50 %, elle n’est pas dupliquée ; sa surface non couverte est listée pour revue (`osmPartialReview` du rapport).
3. **Sémantique OSM** (nom, enseigne, `amenity`, `building`, `wall`…) transmise au bâtiment IGN quand l’intersection couvre au moins 50 % de l’un ou l’autre polygone. Plusieurs noms OSM dans une même empreinte IGN sont tous conservés (`osm.names`).
4. Rapprochement par intersection exacte des polygones triangulés (trous compris) ; aucune fusion par simple proximité.

## Coordonnées

- `geometry` : GeoJSON en WGS84 (CRS84), longitude, latitude, et altitude IGN en troisième valeur quand la BD TOPO la fournit. Polygon et MultiPolygon, anneaux intérieurs conservés.
- Projection locale de la carte (métadonnées `localProjection`) : `x = (lon − lon0) × π/180 × R × cos(lat0)`, `z = −(lat − lat0) × π/180 × R`, R = 6 371 008,8 m, origine `3.7890245, 48.5097657`. x vers l’est, z vers le sud, en mètres. Unreal peut reprendre cette formule (x → X, z → −Y ou Y selon la convention choisie) ou reprojeter depuis WGS84.

## Propriétés d’un bâtiment

| Champ | Contenu |
|---|---|
| `id` | Identifiant stable : `cleabs` IGN (`BATIMENT…`) ou way OSM (`way/…`) |
| `source` | `IGN BD TOPO` ou `OpenStreetMap` : origine de la géométrie |
| `provenance` | `ign+osm` (couvert ≥ 50 % par OSM), `ign+osm-partiel` (10–50 %), `ign` (absent d’OSM), `osm` (absent de la BD TOPO) |
| `inCommune` | Centre de l’emprise dans le contour communal |
| `areaM2`, `parts`, `holes` | Surface calculée, nombre de parties, nombre de trous |
| `rnb` | Identifiant(s) du Référentiel national des bâtiments fourni(s) par l’IGN |
| `ign` | Attributs IGN bruts : nature, usages, construction légère, état, hauteur, étages, logements, matériaux, altitudes sol/toit, précisions, méthodes, dates |
| `osm` | `ids` recouvrants, `donor` (principal), `names`, `coverage`, `tags` sémantiques |
| `derived` | Valeurs prêtes pour un moteur : hauteur de mur, hausse de toit (règle V1.1), étages, matériaux de toit, usage, construction légère |
| `landmark` | Repère IGN (mairie, école, pompiers, salle) situé dans ce seul bâtiment |

Les champs absents valent `null`. **Un bâtiment sans attribut reste présent.** Les formes de toit, orientations de faîtage, couleurs et détails de façade ne figurent pas dans ce fichier : ce sont des choix de rendu (voir `src/building-profile.js`), à refaire dans Unreal.

## Validation officielle (V1.6.1)

`npm run data:validation-sources` télécharge les sources de contrôle :
- **cadastre actuel** : l’export Etalab, ou à défaut le **Parcellaire Express (PCI DGFiP)** de la Géoplateforme IGN, dans `data-sources/cadastre/` ;
- **RNB** : tous les bâtiments de la commune, plus une vérification individuelle des identifiants du référentiel, dans `data-sources/rnb/`.

`npm run data:buildings` reconstruit puis valide. Sans ces sources, la validation s’arrête : aucun substitut historique n’est utilisé.

Effets sur le référentiel :
- **Ajouts** `provenance: cadastre` : empreintes du cadastre actuel absentes de la BD TOPO et d’OSM, hors jumeaux décalés. `source` vaut le nom de la diffusion cadastrale, `cadastre.type` indique en dur, construction légère ou FI.
- **Suppressions** : empreintes OSM seules absentes de la BD TOPO, du cadastre actuel et du RNB, retirées et journalisées avec leur géométrie dans `data-sources/building-removed.json`.
- **RNB** : `rnb` ne contient plus que les identifiants vérifiés par l’API (existants, actifs, construits, spatialement cohérents) ; `rnbSource` garde l’original de la BD TOPO.

Bloc `validation` de chaque bâtiment :

| Champ | Contenu |
|---|---|
| `confidence` | `A` : BD TOPO et cadastre actuel concordent sans contradiction ; `B` : une source officielle, contour différent, contradiction, ou ajout cadastre + RNB ; `C` : non confirmé par une seconde source officielle |
| `status` | Statut lisible |
| `cadastre` | Référence, correspondance (`présent`, `partiel`, `absent`, `décalé`), IoU, couverture |
| `rnb` | `ids` vérifiés, `original`, `checks` par identifiant (verdict, statut, point dans l’empreinte, recouvrement, lien BD TOPO), `added`, `corrected` |
| `previousConfidence` | Classe V1.6 provisoire |
| `evidence` | Preuves (cadastre, RNB, dates IGN, jumeau décalé…) |

Rapports : `data-sources/building-validation.json` (détail : réexamen V1.6, historique des classes, empreintes partielles, ajouts, suppressions, jumeaux, RNB sans empreinte) et `officialValidation` dans `data-sources/building-reference-report.json`.

## Contrôles

- `npm run check:buildings` : chaque bâtiment IGN de la zone est présent une seule fois avec sa géométrie d’origine ; chaque empreinte OSM seule (< 10 %) est présente et aucune autre ; pas d’identifiant dupliqué ; SHA-256 des sources identiques à ceux des métadonnées.
- `npm run check:enrichment` : tous les bâtiments du référentiel (2 543 en V1.6.1) sont rendus, aucun rejet.
- `npm run check:buildings` vérifie aussi les suppressions (journal et preuves obligatoires) et l’absence de doublon des ajouts cadastraux.
- Rapport chiffré : `data-sources/building-reference-report.json`. Audit de l’état V1.4 : `data-sources/building-audit.json` (`npm run audit:buildings`). Densité par rue : `data-sources/street-density.json`.
