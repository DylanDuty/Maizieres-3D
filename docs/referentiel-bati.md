# Référentiel bâti — format intermédiaire (V1.5, validé en V1.6)

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

## Validation (V1.6)

`npm run data:buildings` enchaîne `build-buildings.mjs` puis `validate-buildings.mjs`. Ce second script ajoute à chaque bâtiment un bloc `validation`, sans toucher à la géométrie :

| Champ | Contenu |
|---|---|
| `confidence` | `A` : IGN confirmé par le cadastre (couverture ≥ 50 %) ; `B` : une source officielle, ou contour divergent ; `C` : OSM ou cadastre ancien absent de la BD TOPO |
| `status` | Statut lisible (validé, source unique, construction légère absente de la BD TOPO, contour divergent…) |
| `cadastre` | Référence utilisée (cadastre Etalab, ou substitut OSM 2013–2018), correspondance, IoU, couverture |
| `rnb` | Identifiants RNB et, quand l’API a été consultée, leur statut |
| `apparitionYear`, `recent` | Année d’apparition des fichiers fonciers (BD TOPO) ; indicateur de construction probablement récente |
| `evidence` | Preuves textuelles (origine IGN, dates, appariement fichiers fonciers…) |

Sources de contrôle : `npm run data:validation-sources` télécharge le cadastre Etalab et le RNB (INSEE 10220) dans `data-sources/cadastre/` et `data-sources/rnb/`. Présents, ils remplacent automatiquement le substitut cadastral et les bâtiments cadastraux absents sont ajoutés (`provenance: cadastre`). Au 24 septembre 2026, le réseau de l’environnement refusait ces hôtes : la validation utilise donc le substitut, signalé dans `metadata.validation`.

## Contrôles

- `npm run check:buildings` : chaque bâtiment IGN de la zone est présent une seule fois avec sa géométrie d’origine ; chaque empreinte OSM seule (< 10 %) est présente et aucune autre ; pas d’identifiant dupliqué ; SHA-256 des sources identiques à ceux des métadonnées.
- `npm run check:enrichment` : les 2 491 bâtiments sont rendus, aucun rejet.
- Rapport chiffré : `data-sources/building-reference-report.json`. Audit de l’état V1.4 : `data-sources/building-audit.json` (`npm run audit:buildings`). Densité par rue : `data-sources/street-density.json`.
