# Référentiel ferroviaire — état actuel, ouvrages, PN et splines Unreal (V1.9)

Le bâti (V1.6.2), le terrain (V1.7), la voirie (V1.8) et `UNREAL_ORIGIN` sont gelés et seulement lus ; `check:rail` vérifie leurs SHA-256. Les chiffres viennent de `data-sources/rail/rail-report.json`.

## 1. Sources

| Source | Contenu | Rôle |
|---|---|---|
| **IGN BD TOPO** `troncon_de_voie_ferree` (instantané V1.8 du 24/09/2026) | 40 axes officiels : 6 « Voie ferrée principale » (2 voies, une seule ligne), 34 « Voie de service » (1 voie) ; état « En service », non électrifiés, écartement « Normale », 1 tronçon « au-dessus du sol » (pont) ; précision 2,5 m | axes officiels, statut, pont, validation des voies |
| **OpenStreetMap** (instantané du projet, 31/05/2026) | 25 voies `railway=rail`, **une par voie physique** : voies 1 et 2 de la ligne 1000 Paris-Est – Mulhouse-Ville (SNCF Réseau, `usage=main`, V1/V2, 150 km/h, gabarit TSI GB1), communication J1357, 4 voies de garage, 18 embranchements ; `gauge=1435` ; `construction:electrified=contact_line` 25 kV 50 Hz ; 1 `railway=abandoned` ; 4 polygones `landuse=railway` | **géométrie des voies individuelles** et topologie (nœuds partagés aux aiguillages) |
| BD TOPO `point_du_reseau`, `construction_lineaire`, `equipement_de_transport`, `troncon_hydrographique`, `voie_ferree_nommee` | PN n° 70, 71, 73, 74 ; ouvrages ; « Aire de triage » ; « Arrêt de Fret de Châtres » ; cours d’eau | PN, ouvrages, emprise |
| Terrain V1.7 (LiDAR HD 1 m) | altitude | profils |
| Voirie V1.8 | routes, ponts routiers, PN | croisements route × rail |
| BIBLE_01 (§ 3, 7.7, 12, 19.3) et BIBLE_03 (§ 6) | ligne Paris–Bâle / Paris–Troyes, PN Général-Leclerc, ancienne gare (BV détruit), TIPRY, pont de la rue de l’Orme, « La Station » | contexte, historique, noms |
| BD ORTHO IGN 20 cm (avril 2025) | image | **contrôle seulement** : existence, connexions. Aucune voie n’en est tirée |

Sources inaccessibles (refusées par le proxy) :
- API Overpass et `api.openstreetmap.org` : l’instantané du projet ne contient que des *ways*. Les nœuds OSM (aiguillages `railway=switch`, heurtoirs, `railway=level_crossing`) ne sont pas disponibles.
- SNCF Réseau open data (`data.sncf.com`, `ressources.data.sncf.com`) : ni classement des PN, ni appareils de voie officiels, ni profils en long.

## 2. Modèle

- **Axe documentaire** (`public/data/rail.geojson`, `layer: "axis"`) : les 40 axes BD TOPO à l’identique. La ligne principale y est **une seule ligne à 2 voies**, jamais dédoublée.
- **Voie physique** (`layer: "track"`, 25 entités) : l’axe de chaque voie, pris dans OSM, seule source qui cartographie les voies une par une.
  - Chaque voie OSM est comparée à l’axe BD TOPO. Voies principales : 1,1 m (V1) et 2,6 m (V2) en médiane de l’axe double, ce qui est cohérent avec un entraxe de 3,5 à 4,1 m (médiane 3,73 m). Voies de service : 0,3 à 1,8 m en médiane.
  - Deux axes BD TOPO de service (`…9310459`, `…9310465`), décalés et en biais, sont représentés par les voies OSM `way/174931207` et `way/174931211` : les rails visibles sur l’orthophoto les suivent (`rail-review-v1.9.json`). Aucune voie n’est dupliquée.
  - Les voies coupées par la limite de l’emprise du terrain sont tronquées à cette limite ; les voies 1 et 2 de la ligne principale sont concernées.
- **Géométrie visuelle** (rails, traverses, ballast, caténaire) : **non générée**. Les splines portent les attributs nécessaires (§ 6).
- **Couche historique** (`historic` dans le rapport et `rail-diagnostic.json`), jamais mélangée au réseau :
  - ancienne emprise OSM `way/775992125` (3,7 km, cadastre 2011) ;
  - ancienne gare (bâtiment voyageurs et quais, 1857-1859, « Fermée — BV détruit ») : sans géométrie, située seulement « près du PN 73 » d’après la Bible ;
  - réseau TIPRY : itinéraire sans géométrie.
- **Emprise** (`public/data/rail-land.geojson`) : 4 polygones OSM `landuse=railway` (déclaratifs, `official: false`), l’« Aire de triage » BD TOPO (dans la commune) et l’« Arrêt de Fret de Châtres » (point fictif, hors commune). Aucun ballast, plateforme ni talus n’est estimé : aucune donnée ne les décrit.

## 3. Statut

| Statut | Règle | Voies |
|---|---|---:|
| `active` | voie principale, BD TOPO « En service » et OSM `railway=rail` | 3 (V1, V2, communication) |
| `service` | voie de service confirmée par la BD TOPO (confiance A) ou voie OSM visible sur l’orthophoto (confiance B) | 19 (15 A, 4 B) |
| `unknown` | OSM seul, en zone floutée par l’IGN : existence non vérifiable | 3 (0,9 km) |
| `neutralized` / `removed` | aucune documentée | 0 |
| `former_alignment` | couche historique uniquement | 1 |

L’apparence sur l’orthophoto ne sert qu’à confirmer l’existence, jamais à déclarer une voie inactive. Statut connu : **96,5 % des km**.

## 4. La Station

- « La Station » est un lieu-dit d’adressage (BAN) des dessertes au sud du faisceau. BIBLE_01 § 19.3 : rien ne prouve un lien avec l’ancienne gare. Le nom sert seulement à localiser.
- **Faisceau nord**, le long de la ligne : voies de garage 1, 2 et 3 (OSM `ref`), voie 4 et embranchements. BD TOPO et OSM concordent à moins de 1 m et les rails sont visibles.
- **Embranchements sud** vers les silos et la zone d’activité : pour la plupart **en zone floutée par l’IGN** (diffusion restreinte). Leur existence ne peut être vérifiée qu’à travers la BD TOPO.
- Aucune fusion de voies ; les écartements sont ceux des sources ; les connexions sont celles d’OSM (nœuds partagés).
- **21 croisements de niveau** entre la voirie V1.8 et les voies de service (dessertes de La Station, embranchements ouest), listés dans `road-splines`/`rail-splines` → `structures.roadCrossingsOfServiceTracks`. V1.8 en comptait 15 avec les axes BD TOPO ; les voies OSM, plus nombreuses, en donnent 21.

## 5. Topologie

- **Nœuds.** Extrémités de voies fusionnées à 30 cm près. Une extrémité posée sur une autre voie forme un branchement.
- **Aiguillages (branchements) : 28**, dont 14 dans la commune. Ils sont déduits de la topologie OSM ; aucun appareil de voie officiel n’est accessible. Il faut y ajouter :
  - 16 extrémités de voie (heurtoirs probables) ;
  - 4 extrémités coupées par la limite de l’emprise.
- **Croisements sans connexion : 3.** Tous sont au même niveau, donc à vérifier :
  - la communication J1357 traverse la voie 2 pour rejoindre le faisceau sud : traversée ou aiguillages non cartographiés ;
  - 2 croisements de voies de service du faisceau ouest : aiguillages probables sans nœud OSM.
  - Aucun n’est connecté arbitrairement.
- **Fragment orphelin : 1** (`way/174931208` + `way/174931209`, 0,83 km, zone floutée).
- **Voie presque connectée : 1** (`way/174931209`, extrémité à 2,95 m de `way/174931210`).
- **Doublons : 0.**
- **Passage supérieur** : la rue de l’Orme passe au-dessus des deux voies principales. Aucune connexion n’est créée entre des niveaux différents.

## 6. Altitude

Méthode :
1. Terrain V1.7 échantillonné tous les mètres le long de chaque voie.
2. Neutralisation des ouvrages, puis raccord en ligne droite entre les appuis :
   - pont ferroviaire : longueur de l’ouvrage + 4 m ;
   - passage supérieur de la rue de l’Orme (±8 m) : le MNT y peut contenir le bord du tablier routier ;
   - cours d’eau franchis sans pont (±6 m) : aucun dans l’emprise.
3. Lissage robuste (médiane sur 15 m, puis moyenne sur 41 m). Il supprime les micro-irrégularités sans effacer les pentes réelles.
4. **Raccords** : une voie qui rejoint une autre à un aiguillage prend son altitude, avec un fondu sur 30 m.
5. **PN** : le rail est calé sur la chaussée (terrain = Z routier V1.8) au droit de chaque PN, avec un fondu sur 40 m. L’écart rail/route est de 0 aux 4 PN.

Résultats :
- **Pente maximale** : 4 ‰ sur la ligne principale ; 14 ‰ au plus sur les voies de service. **Aucune pente aberrante** (seuils : 12,5 ‰ pour la ligne principale, 20 ‰ pour le service).
- **Altitude fiable** (profil à moins de 0,3 m du MNT hors ouvrage) : **99,6 % de la longueur**. 0,3 % est porté par des ouvrages.

## 7. Passages à niveau (`rail-report.json` → `levelCrossings`)

| PN | Voie routière | Voies ferrées | Z rail = route | Confiance |
|---|---|---|---:|---|
| n° 70 | La Voie de la Garenne / Chemin rural dit Fin Maizières | V1, V2 | 75,90 m | A (BD TOPO + voirie V1.8 + orthophoto) |
| n° 71 | Rue du Pot Bancelin | V1, V2 | 76,18 m | A |
| n° 73 | **Rue du Général-Leclerc** | V1, V2 | 78,09 m | A (+ BIBLE_01 § 12.2 : PN identifié par SNCF Réseau en 2025) |
| n° 74 | chemin empierré sans nom | V1, V2 | 79,51 m | A |

- Pour chaque PN, le rapport donne aussi : identifiant BD TOPO, position BD TOPO et position recalée sur le croisement (0,1 à 1,2 m d’écart), sources et coordonnées Unreal.
- Type : inconnu (classement SNCF inaccessible). Barrières et signalisation ne sont pas modélisées.

## 8. Ouvrages

| Ouvrage | Début → fin (L93) | Longueur | Tablier | Relation au terrain | Confiance |
|---|---|---:|---|---|---|
| Pont ferroviaire BD TOPO `TRONFERR0000000009310482` sur un écoulement naturel boisé | 757 035 / 6 823 152 → 757 017 / 6 823 154 | 18,5 m | V1 : 75,98 → 76,00 m ; V2 : 75,94 m | terrain jusqu’à 2 m plus bas sous l’ouvrage | A |
| Passage supérieur routier : pont de la rue de l’Orme (V1.8) | 759 372 / 6 822 899 | 25,8 m (tablier routier) | — | voies au sol, à leur profil propre | A (reconstruit en 2025, BIBLE_03 § 6) |
| Passages inférieurs, ponceaux sous voie | aucun trouvé : aucun autre cours d’eau BD TOPO ne coupe les voies dans l’emprise | — | — | — | — |

- Le pont ferroviaire explique la rupture du profil relevée en V1.7. Aucune voie portée n’est plaquée sur le MNT : `check:rail` impose plus de 1 m entre le tablier et le terrain sous l’ouvrage.
- Le LiDAR (2025) peut être antérieur à la fin des travaux du pont de la rue de l’Orme.

## 9. Splines Unreal (`unreal/rail/rail-splines.json`)

- **Origine gelée** : `UNREAL_ORIGIN` E 758 278 / N 6 823 571 / H 0. X = (E − E0) × 100 ; Y = −(N − N0) × 100 ; Z = altitude × 100 (cm).
- **`splines[]`** : 25 splines, une par voie physique, soit **1 639 points**. Points obtenus par Douglas-Peucker 3D (3 cm) sur le profil au mètre, avec 25 m au plus entre deux points. Champs :
  - identité : `id`, `track`, `osmId`, `bdtopoIds`, `provenance`, `confidence` ;
  - voie : `kind`, `kindLabel`, `network`, `trackRef`, `line`, `maxspeed`, `trackCountOnAxis` ;
  - statut : `status`, `statusConfidence`, `statusEvidence` ;
  - technique : `gauge` (1,435 m), `electrification` (`current: no`, `planned: contact_line 25 kV 50 Hz`) ;
  - génération : `surface` (ballast présumé), `generation` (files de rails à ±0,75 m de l’axe, traverses tous les 0,6 m, estimations explicitement marquées) ;
  - ouvrages : `structures`, `pointStructure` (ouvrage porté ou franchi, point par point) ;
  - points : `points` (centimètres Unreal), `pointsL93` (Lambert-93 et altitude), `terrainZ` (MNT brut au même point) ;
  - profil : `zReliableShare`, `maxGradePermil`.
- **`nodes[]`** : aiguillages, heurtoirs, limites d’emprise, avec leur position Unreal.
- **`structures`** : `bridges`, `hydraulic`, `overpasses`, `levelCrossings`, `roadCrossingsOfServiceTracks`.

## 10. Commandes et contrôle

```
npm run data:rail-fetch   # instantanés BD TOPO complémentaires (data-sources/rail/)
npm run data:rail         # build-rail.mjs : référentiel, topologie, profils, PN, ouvrages, splines, rapport (~6 s)
npm run check:rail        # inclus dans check:all (9 contrôles)
```

`?diagnostic=rail` affiche, pour la QA seulement :
- voies principales en rouge, voies de service en orange, statut incertain en gris ;
- pont en rose ;
- PN (cylindres jaunes) ;
- ancienne emprise historique en gris foncé.

## 11. Approximations à connaître

- Les aiguillages sont déduits de la topologie OSM ; leur type (simple, TJD, traversée) est inconnu.
- La géométrie des voies vient d’OSM (tracé sur BD Ortho 2022 ou Bing 2010). Elle est validée par la BD TOPO à 1–3 m près, sans relevé ferroviaire officiel.
- Le profil est celui du MNT lissé : il ne s’agit pas du profil en long SNCF, qui n’est pas accessible.
- Ballast, plateforme, talus, caténaire, signalisation : non documentés ; aucune valeur inventée. Seuls l’écartement et les valeurs types de génération sont indiqués, marqués comme estimations.
- Les embranchements sud de La Station sont invérifiables sur l’orthophoto (zone floutée).
