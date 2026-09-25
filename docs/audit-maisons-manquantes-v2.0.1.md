# V2.0.1 — Audit visuel des maisons manquantes

Branche `opus/v2.0.1-missing-buildings`, à partir de `opus/v2.0-threejs-complete` (`e18a491`).

La V2.0 publiée montrait encore des maisons absentes. Les 2 494 bâtiments du référentiel ne sont donc plus tenus pour exhaustifs. L’audit reprend toute la zone bâtie. Il cherche d’abord une erreur de rendu, puis une empreinte oubliée dans une source publique.

## 1. Rendu Three.js (d’abord le rendu)

Le rendu V2.0 a été contrôlé bâtiment par bâtiment. Le contrôle rejoue les modules du navigateur (`building-source.js`, `buildings.js`) sous Node.

| Contrôle | Résultat V2.0 |
|---|---|
| Identifiants de `buildings.geojson` générés dans la scène | 2 494 / 2 494 ; aucun rejet, hors emprise, `MultiPolygon` perdu ni rejet de découpe |
| Triangulation des toits | toit ≥ 90 % de l’emprise pour chaque bâtiment |
| Matériaux | double face, opaques, pas de transparence ni d’élimination des faces cachées |
| Altitude | **défaut réel** : 124 bâtiments enfouis sur plus du quart de la hauteur des murs, dont 23 sur plus de la moitié |

**Cause du défaut d’altitude.** Le socle venait de `baseZ`, le minimum du relief LiDAR 0,5 m sous l’emprise. Le relief affiché est une grille de 10 m lissée : sur les pentes et les talus, il passe jusqu’à 1,5 m (3,9 m pour une fosse) au-dessus de ce minimum. Les petites maisons et les annexes y paraissaient à moitié enterrées, ou disparaissaient derrière le relief en vue rasante. Ailleurs, le socle flottait jusqu’à 0,35 m au-dessus du sol.

**Correction** (`src/building-elevation.js`, présentation seulement) :

- le socle affiché suit le point le plus bas du relief affiché le long du contour, dans la limite de ± 4 m autour de `baseZ` ;
- les murs descendent 10 cm sous ce point.

Au total, 319 socles sont recalés : 293 remontés, 26 abaissés. `baseZ` reste la valeur de référence pour Unreal ; `building-terrain-elevation.json` n’est pas modifié.

## 2. Sources : ce qui manquait vraiment

**Méthode.**

- **Couverture.** Toute la zone bâtie de la commune, en 195 dalles de 160 m sur la BD ORTHO IGN 20 cm (avril 2025). Cela couvre notamment le centre-bourg, Les Granges, Poussey, les rues citées dans la demande, le Parc de l’Aérodrome, La Glacière et toutes les autres rues résidentielles.
- **Empreintes comparées au référentiel gelé V1.6.2 :**
  - le Parcellaire Express actuel (2 258 objets, identique au service le 25/09/2026) ;
  - la BD TOPO (2 489, idem) ;
  - OSM ;
  - les formes et points du RNB ;
  - les 25 retraits V1.6.1 et les 49 retraits V1.6.2.
- **Parties examinées.** Chaque partie d’empreinte publique non couverte par le référentiel, de 15 m² ou plus, a été examinée sur l’orthophoto : 464 parties. Les parties sont extraites après une ouverture morphologique de 1,2 m, qui écarte les simples écarts de tracé.
- **Points examinés en plus :**
  - 24 points repérés à l’œil sur les dalles ;
  - 20 adresses BAN (type entrée, bâtiment ou parcelle) et 23 formes ou points RNB situés hors du bâti du référentiel.

| Verdict | Parties d’empreinte |
|---|---|
| Bâti visible → réintégré | 108 parties examinées, soit 98 décisions. 90 bâtiments sont retenus ; 8 sont hors de l’emprise du référentiel (commune + 150 m), sur la commune voisine INSEE 10323 |
| Non bâti (sol, pelouse, parking, ombre, silo démoli, écart de tracé) | 193 |
| Douteux (terrasse, véranda, auvent, zone floutée de l’orthophoto, végétation) : rien n’est ajouté | 163 |

**Réintégrations** : 90 bâtiments, sans aucun tracé manuel.

- **Parcellaire Express : 79.** Ce sont surtout des annexes, garages et appentis accolés que la BD TOPO fond ou omet. S’y ajoute une maison entière à toiture sombre, rue du Général-Leclerc. La géométrie est la différence exacte entre l’empreinte cadastrale et le référentiel ; une ouverture de 0,5 m (Clipper) supprime les fines lamelles.
- **OSM : 11**, dont **6 retraits V1.6.1 annulés** : des abris absents de la BD TOPO, du cadastre et du RNB, mais visibles sur l’orthophoto 2025.
- **Retraits V1.6.2 : aucun annulé.** Sur les 49 retraits, 46 sont confirmés non bâtis ; 3, situés entre des silos, restent non tranchés.
- **Adresses BAN et points RNB isolés** : terrains nus, lots non bâtis (impasse des Sages, rue des Jacquets), champs. Aucune maison n’y manque.

**Rues concernées** (adresse BAN la plus proche) :

| Rue ou secteur | Réintégrations |
|---|---|
| Rue du Général-Leclerc | 11 |
| Rue Maurice-Renault | 8 |
| Avenue du Général-de-Gaulle | 6 |
| Rue Achille-Flaubert | 5 |
| Voie aux Vaches | 4 |
| Rue Jean-Monnet | 4 |
| Rue de la Chefferie | 4 |
| Rue Victor-Hugo | 3 |
| Rue du Maréchal-de-Lattre-de-Tassigny | 3 |
| Rue de l’Essy | 3 |
| Rue des Baudets | 3 |
| Rue des Lombards, rue Georges-Clemenceau, rue Joliot-Curie, rue de la République, rue Pasteur, rue du Docteur-Sollier | 2 chacune |
| 16 autres rues (dont rue Basse de Poussey, rue de l’Orme, rue des Écoles, Prés de Poussey, rue de la Zone Industrielle) | 1 chacune |
| Hors adresse (zones d’activité, jardins) | 8 |

## 3. Visibles sans géométrie publique (`missing_buildings_without_geometry`)

Seize constructions sont nettement visibles sur l’orthophoto 2025, mais n’ont d’empreinte dans aucune source : BD TOPO, cadastre, OSM ni RNB. Elles sont listées dans `data-sources/buildings-audit-v2.0.1/decisions.json` avec leur position approximative (Lambert-93 et WGS84), leur description et la preuve. **Aucune empreinte n’est inventée.**

| Id | Construction | Adresse la plus proche |
|---|---|---|
| vis-A | bâtiment à toiture brune | rue Joliot-Curie (Poussey) |
| vis-D1, vis-D2 | serre, annexe | rue du Général-Leclerc |
| vis-F | long bâtiment gris-bleu (≈ 40 × 10 m) | rue Maurice-Renault |
| vis-H1, vis-H2 | deux bâtiments (toit plat blanc, toit gris) | rue du Pot-Bancelin |
| vis-I | bâtiment allongé à toiture brune | chemin de la Guide |
| vis-K, vis-T | bâtiment à toit plat, abri | rue Georges-Clemenceau |
| vis-P1, vis-P2 | bâtiment sombre, annexe | rue de la Chefferie |
| vis-Q | abri | avenue du Général-de-Gaulle |
| vis-R1, vis-R2 | hangar léger, abri | sans adresse proche (ouest de l’avenue du Général-de-Gaulle) |
| vis-U2 | maison à toiture brune | rue du Maréchal-de-Lattre-de-Tassigny |
| vis-U3 | garage | rue Albert-Benoist |

Six autres points restent incertains : tente, serre ou manège, piscine couverte, abris à côté d’empreintes décalées. Les petits abris de jardin de moins de 15 m² ne sont pas tous inventoriés.

## 4. Total

| | Bâtiments | Dans la commune |
|---|---|---|
| Référentiel gelé V1.6.2 (`public/data/buildings.geojson`, inchangé) | 2 494 | 2 265 |
| Réintégrés V2.0.1 (`public/data/buildings-additions-v2.0.1.geojson`) | 90 | 85 |
| **Total affiché** | **2 584** | **2 350** |

L’altitude des réintégrations (`public/data/buildings-additions-elevation-v2.0.1.json`) est calculée comme en V1.7 sur la grille 1 m gelée. Terrain, voirie, rail, occupation du sol, POI et origine Unreal ne sont pas touchés.

## 5. Contrôles et diagnostic

- `npm run check:building-visibility` (8 contrôles) :
  - le nombre d’empreintes (2 584) est égal au nombre d’identifiants présents dans le graphe de scène Three.js : les identifiants sont comparés un à un, pas seulement le compteur ;
  - aucun bâtiment n’est sous le relief affiché, aucun socle n’est hors plage Z ;
  - aucun chevauchement entre réintégrations et référentiel ;
  - chaque réintégration est tracée jusqu’à sa décision.
- `npm run check:all` : 13 contrôles.
- `?diagnostic=buildings-audit` affiche :
  - le référentiel en gris ;
  - le socle recalé en bleu ;
  - les réintégrations en vert ;
  - les cas incertains (repères orange) et les constructions visibles sans empreinte (repères magenta) ;
  - le décompte des identifiants présents dans la scène.
- Régénération : `npm run data:missing-buildings`.
- Captures, dont les planches orthophoto des réintégrations : `docs/qa/v2.0.1/`.
