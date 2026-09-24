# Référentiel voirie — tracé, largeurs, topologie, altitude et splines Unreal (V1.8)

Le référentiel bâti (V1.6.2) et le terrain (V1.7) sont gelés et seulement lus. L’origine Unreal commune est inchangée. Toutes les valeurs chiffrées viennent de `data-sources/roads/roads-report.json`.

## 1. Sources

| Source | Contenu | Utilisation |
|---|---|---|
| **IGN BD TOPO V3** `troncon_de_route` (WFS `data.geopf.fr`, 24/09/2026) | 1 550 tronçons sur l’emprise du terrain V1.7 : réseau topologique, nature, importance, largeur de chaussée, sens, position (pont), noms BAN, numéros de route, précision 2,5–10 m | **géométrie principale**, conservée à l’identique |
| BD TOPO `troncon_de_voie_ferree`, `point_du_reseau`, `construction_lineaire`, `voie_nommee` | voies ferrées, passages à niveau (n° 70, 71, 73, 74), ouvrages « Pont », noms de voies | ponts, passages à niveau, contrôle des noms |
| OpenStreetMap (instantané du projet, 31/05/2026) | 531 voies `highway` | sémantique (revêtement, sens, service, pont), noms, et **compléments** absents de la BD TOPO |
| Terrain V1.7 (GeoTIFF LiDAR HD 1 m) | altitude NGF-IGN69 | Z le long des axes |
| BIBLE_01 Cartographie (§ 4 à 7, 12) | odonymes, graphies, connexions confirmées | contrôle des noms (`nameBible`) |
| BD ORTHO IGN 20 cm (vol d’avril 2025) | preuve visuelle | QA seulement : existence, type, ouvrages. **Aucune géométrie n’en est tirée** |

Services consultés mais non utilisés :
- l’API Overpass (OSM) : refusée par le proxy ; l’instantané local du projet suffit ;
- `non_communication` (BD TOPO) : aucun objet dans l’emprise.

Toutes les couches sont stockées dans `data-sources/roads/` (`npm run data:roads-fetch`, jamais écrasées). Leur SHA-256 est vérifié par `check:roads`.

## 2. Construction (`npm run data:roads`, environ 7 s)

1. **BD TOPO d’abord.** Chaque tronçon est gardé avec sa géométrie exacte, sans filtre.
2. **Sémantique OSM transférée.** Pour chaque tronçon, on retient la voie OSM la plus proche (moins de 8 m) sur au moins 50 % de sa longueur : 1 049 tronçons en bénéficient.
3. **Compléments OSM.** On garde les parties de voies OSM situées à plus de 8 m de toute BD TOPO et longues d’au moins 15 m.
   - Leur géométrie reste la géométrie OSM : elle est seulement coupée là où elle rejoint la BD TOPO et simplifiée à 5 cm près.
   - Soit 109 parties, dont 107 conservées.
   - La revue orthophoto en exclut 2, des doublons décalés d’un chemin BD TOPO (`roads-review-v1.8.json`).
4. **Classification** (catégories, `unrealType`) :

| Catégorie | Règle (BD TOPO, sinon OSM) | Largeur estimée | Unreal |
|---|---|---:|---|
| `route_principale` | importance 1–2 (D619) | 7 m | `paved` |
| `route_secondaire` | importance 3–4 (D116, D160, D20…) | 6 m | `paved` |
| `voie_locale` | route revêtue, importance 5–6 | 5 m | `paved` |
| `voie_de_desserte` | `highway=service` (parking, cour, accès) ; `serviceType` garde le type OSM | 4 m | `paved` |
| `voie_pietonne` | `highway=pedestrian` | 3 m | `paved-pedestrian` |
| `chemin_carrossable` | « Route empierrée » | 3 m | `gravel-track` : **ne pas goudronner** |
| `chemin_rural` | « Chemin » | 2,5 m | `dirt-track` : **ne pas goudronner** |
| `sentier` | « Sentier » ou chemin physiquement inaccessible | 1,5 m | `footpath` : **pas de chaussée** |

5. **Largeur.**
   - `width` vaut `widthOfficial` (BD TOPO `largeur_de_chaussee`), sinon `widthOsm` (tag `width`, absent ici), sinon `widthInferred` (tableau ci-dessus).
   - `widthSource` = `measured | official | osm | inferred`. Aucune largeur n’est `measured` pour l’instant.
   - **Une largeur `inferred` n’est jamais une mesure.** Les trois valeurs sont conservées séparément : une meilleure largeur remplacera la valeur sans toucher à la géométrie.
6. **Noms.**
   - `name` est pris dans l’ordre : OSM quand il concorde avec la BAN, sinon BAN (via la BD TOPO), sinon OSM, sinon le nom collaboratif BD TOPO.
   - Chaque forme reste disponible : `nameBan`, `nameCollaboratif`, `nameOsm`. `nameBible` donne la graphie de BIBLE_01 si elle correspond.
   - Aucun nom n’est inventé : `check:roads` vérifie que chaque `name` provient d’une source.
7. **Revêtement.** `surface` vient d’OSM, sinon de la nature BD TOPO, sinon d’une présomption par catégorie. `surfaceSource` indique laquelle.
8. **Sens.** `oneway` = `no` / `forward` / `backward` / `null`, relatif au sens de numérisation de la géométrie. Il vient de BD TOPO `sens_de_circulation`, sinon d’OSM.
9. **Trottoirs.** Aucune donnée fiable : OSM ne cartographie aucun trottoir, seulement 14 passages piétons. Rien n’est fabriqué. Les voies urbaines sont marquées `sidewalk.status = "à déterminer"` (54,2 km, dont 8,8 km dans le centre-bourg, 5,1 km aux Granges et 2,1 km à Poussey). Les chemins et sentiers sont marqués « sans objet ».

## 3. Topologie

- Les nœuds sont les extrémités de tronçons, fusionnées à 5 cm près ; ceux de la BD TOPO sont déjà topologiques.
- **Raccordement des compléments OSM** :
  - une extrémité coupée rejoint la BD TOPO à moins de 9 m ;
  - une extrémité libre rejoint n’importe quelle voie à moins de 3 m ;
  - un raccord au milieu d’un tronçon forme un T, et ce tronçon compte deux fois dans le degré du nœud.
- **Croisements à niveau sans nœud commun** (allées de parking OSM) : un nœud de carrefour est ajouté, sans modifier la géométrie. Il y en a 21, tous dans les parkings de La Belle Idée.
- Types de nœuds : `carrefour` (degré ≥ 4), `embranchement` (3), `continuité`, `changement de nom`, `impasse`, `extrémité de sentier`, `limite d’emprise`. Chaque nœud indique aussi `roundabout` et `levelCrossing`.
- Contrôles effectués :
  - voies presque connectées (moins de 3 m) : 0 ;
  - doublons (plus de 80 % à moins de 1,5 m) : 0 ;
  - croisements sans nœud restants : 0 ;
  - composantes connexes et fragments orphelins.

## 4. Altitude

- Chaque point de spline porte le Z du **terrain V1.7** par interpolation bilinéaire du GeoTIFF 1 m. `check:roads` vérifie l’écart au terrain : au plus 1 cm.
- Pour information, les Z propres de la BD TOPO s’écartent du terrain de −0,25 m en moyenne, avec un écart quadratique moyen de 0,72 m. Ils ne sont pas utilisés.
- **Ponts** (32 tronçons BD TOPO « au-dessus du sol », 30 tabliers) : le MNT n’est pas suivi.
  - Le tablier est interpolé entre les culées. L’altitude d’une culée est le terrain le plus haut à moins de 4 m à l’extérieur de l’extrémité, c’est-à-dire le remblai d’accès.
  - Un pont découpé en plusieurs tronçons forme un seul tablier (`deckMembers`).
  - Chaque pont donne l’ouvrage BD TOPO associé et ce qu’il franchit (Seine, rivière du Moulin, Petite Rivière de Sauvage, voie ferrée…).
  - La revanche maximale au-dessus du MNT atteint 5,3 m au pont de la rue de l’Orme.
- **Ouvrages non répertoriés** (`hiddenStructures`) : le profil de chaque axe au sol est analysé tous les mètres. Tout écart de plus de 1,2 m à la corde sur ±10 m est examiné sur l’orthophoto.
  - 3 tronçons, 5 détections, sont des ponceaux ou un pont plus long que son tronçon BD TOPO.
  - Sur ±12 m, leur Z suit la corde entre les appuis ; les indices concernés sont listés dans `zOverride`. Ce sont les seuls points au sol qui ne suivent pas le MNT.
- **Ruptures signalées en V1.7, réexaminées :**
  - **Voie ferrée** : le pont ferroviaire BD TOPO de 19 m (757 017–757 035 / 6 823 152) franchit un fossé boisé ; aucune route ne passe dessous. La voirie n’est pas concernée.
  - **Rue du Pont de Clairvaux** : la pente de 58 % était le lit de la rivière du Moulin sous un pont BD TOPO de 21,7 m. Ce pont est maintenant un tablier (77,28 → 77,46 m).
  - **Rue de l’Orme** : pont routier de 25,8 m au-dessus de la voie ferrée (BIBLE_01 § 12.6).
- **Passages à niveau** : n° 70 (Chemin rural dit Fin Maizières), n° 71 (rue du Pot Bancelin), n° 73 (rue du Général-Leclerc, conforme à BIBLE_01 § 12.2), n° 74 (chemin empierré). À cela s’ajoutent 15 croisements avec les voies de service ferroviaires de La Station (embranchement industriel).

## 5. Fichiers

| Fichier | Contenu |
|---|---|
| `public/data/roads.geojson` | référentiel technique complet : 1 659 tronçons, dont 2 exclus après revue et 1 « en projet », soit 1 656 actifs. Géométrie source en CRS84, toutes les propriétés |
| `unreal/roads/road-splines.json` | format dérivé pour Unreal (§ 6) |
| `data-sources/roads/roads-report.json` | statistiques, topologie, ouvrages, anomalies, contrôle BIBLE_01, incohérences ouvertes |
| `data-sources/roads/roads-review-v1.8.json` | revue orthophoto : compléments OSM, anomalies de profil, orphelin, notes. Régénérable avec `npm run data:roads-review` |
| `data-sources/roads/bdtopo-*.geojson` | instantanés BD TOPO |

## 6. Splines Unreal (`unreal/roads/road-splines.json`)

- **Origine obligatoire, inchangée** : `UNREAL_ORIGIN` = E 758 278, N 6 823 571, H 0 (`scripts/terrain-frame.mjs`).
  - X = (E − 758 278) × 100 ; Y = −(N − 6 823 571) × 100 ; Z = altitude × 100, en centimètres, X vers l’est et Y vers le sud.
  - Aucune autre origine n’est créée.
- **`splines[]`** (1 585) : tronçons chaînés à travers les nœuds de degré 2 quand leurs attributs sont identiques (nom, catégorie, structure, largeur, revêtement, service, sens). Champs :
  - identité : `id`, `troncons` (identifiants BD TOPO ou OSM), `name`, `nameBible`, `routeNumber`, `provenance`, `hierarchy`, `inCommune`, `sector` ;
  - voie : `category`, `unrealType`, `paved`, `surface`, `serviceType`, `width`, `widthSource`, `oneway` ;
  - structure : `structure` (`sol` / `pont`), `bridge`, `hiddenStructures`, `zOverride` ;
  - points : `points` (centimètres Unreal, points espacés de 5 m au plus, sommets d’origine inclus) et `pointsL93` (mêmes points en Lambert-93 et altitude en mètres).
  - Un tronçon coupé par la limite de l’emprise donne plusieurs splines (`~2`, …).
- **`nodes[]`** : carrefours, embranchements, impasses, changements de nom, limites d’emprise, avec leur position Unreal.
- **`structures`** : `bridges` (tabliers), `hiddenStructures` (ponceaux), `railCrossings`, `levelCrossings`.
- **Pour le futur import** :
  - largeur de la route = `width` ;
  - `gravel-track`, `dirt-track` et `footpath` ne doivent pas recevoir de chaussée asphaltée ;
  - les ponts et ouvrages doivent être modélisés à part, les splines donnant le tablier.

## 7. Contrôle BIBLE_01

- 107 odonymes contrôlés (§ 4.1, 5, 6, et les chemins des § 5.1, 7.11 et 7.12) dans les noms géographiques (BAN, BD TOPO, OSM) ; 85 sont trouvés.
- **§ 4.1 : 63 sur 65 trouvés.**
  - `Chemin du Bout des Ruelles` n’existe dans les données que sous la forme « Rue du Bout des Ruelles » (BAN), que la Bible déconseille (§ 4.2).
  - `Rue du Pont` n’apparaît que sous la forme « Rue du Pont de Clairvaux », conformément à la réserve de la Bible.
- **§ 5 : 17 sur 18 trouvés.** `Rue Voie de la Garenne` n’apparaît que sous la forme « La Voie de la Garenne » (BAN, lieu-dit).
- **§ 5.1, 7.11 et 7.12 : 1 sur 4 trouvé.**
  - « Voie de la Garenne » est trouvée (BAN).
  - « Chemin du Pot Bancelin » n’existe que sous la forme « Rue du Pot Bancelin ».
  - **« Chemin à Leroy » et « Chemin Noir » sont absents de toutes les données géographiques.**
- **§ 6 (noms anciens ou non validés) : 4 sur 20 attestés** par une source actuelle, ce qui renforce la Bible :
  - `Impasse des Sages` (BAN, classé C dans la Bible) ;
  - `Grande Rue` (BAN, classé C) ;
  - `Ruelle à Rosez` (OSM) ;
  - `Rue Jean-Baptiste-Petel` (nom collaboratif BD TOPO « R Jean Baptiste Petel »).
  - Les 16 autres sont absents, comme attendu : Rue de la Gare, Avenue de la Gare, Route Nationale 19, Ruelle Apitache, Ruelle du Cimetière, Place du Tartel…
- Le détail par nom figure dans `roads-report.json` → `bible.all`.

## 8. Mode diagnostic Three.js

- `?diagnostic=roads` dessine chaque tronçon à sa largeur `width` :
  - couleur par catégorie, ponts en rouge ;
  - couleur pleine pour une largeur officielle, couleur claire pour une largeur estimée.
- Le rendu normal et les autres modes ne changent pas.
