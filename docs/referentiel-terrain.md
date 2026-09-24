# Référentiel terrain — altimétrie officielle et préparation Unreal (V1.7)

Ce document suffit pour reconstruire le terrain et son import dans Unreal Engine 5.8 sans refaire de recherche. Toutes les valeurs chiffrées viennent de `unreal/terrain/terrain-reference.json`, qui fait foi.

## 1. Source retenue

**IGN LiDAR HD — MNT (modèle numérique de terrain, sol nu), 0,5 m.** Le MNS n’est pas utilisé : il inclut bâtiments et végétation. Le MNH non plus.

| Élément | Valeur |
|---|---|
| Produit | LiDAR HD MNT, dalles de 1 km × 1 km, 2 000 × 2 000 pixels, float32, NoData −9999 |
| Résolution native | 0,5 m. Centres de pixels sur les mètres entiers et demi-mètres |
| Missions | `24LHDMF` : 42 dalles, vols des 14 et 19 février 2025. `25LHDZIRomilly` : 14 dalles, vol du 18 octobre 2025 (bourg est, ZI la Glacière) |
| Édition IGN | 19 mai 2026. Classement automatique `IGN_AUTO_V5` |
| Planimétrie | EPSG:2154, RGF93 v1 / Lambert-93 |
| Altimétrie | NGF-IGN69 (EPSG:5720), en mètres |
| Index des dalles | WFS `https://data.geopf.fr/wfs/ows`, couche `IGNF_LIDAR-HD_METADONNEE:metadata`, champ `url_mnt` |
| Téléchargement | WMS-R `https://data.geopf.fr/wms-r`, couche `IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.LAMB93`, `FORMAT=image/geotiff`, BBOX d’une dalle, 2 000 × 2 000 |
| Date de téléchargement | 24 septembre 2026. Deux téléchargements successifs donnent des octets identiques |
| Licence | Licence Ouverte Etalab 2.0 — © IGN |

### Produits comparés

| Produit IGN | Nature | Résolution | Décision |
|---|---|---|---|
| **LiDAR HD MNT** | sol nu, LiDAR 2025 | 0,5 m | **retenu** |
| RGE ALTI (`ELEVATION.ELEVATIONGRIDCOVERAGE.HIGHRES`) | sol nu, sources anciennes et mixtes | 1 m annoncé | écarté |
| BD ALTI | sol nu | 25 m | trop grossier |
| LiDAR HD MNS / MNH | surface avec sursol, ou hauteur du sursol | 0,5 m | exclus : ce n’est pas un terrain |

Sur 5 fenêtres de 400 × 400 m, le RGE ALTI est en moyenne 6 à 14 cm plus bas que le LiDAR HD. L’écart quadratique moyen va de 0,23 à 0,32 m, avec jusqu’à 4 m aux talus. 68 % de ses pixels valent exactement leur voisin : sa résolution effective est plus grossière que 1 m (`npm run audit:terrain-sources`, résultat dans `data-sources/terrain/source-comparison.json`).

## 2. Donnée source immuable

- `data-sources/terrain/lidar-hd-mnt/` : les 56 dalles officielles, **octet pour octet** (896 Mo). Ce dossier est **hors Git**, à cause de sa taille.
- `data-sources/terrain/lidar-hd-mnt-manifest.json` (versionné) contient, pour chaque dalle :
  - nom, URL exacte et BBOX ;
  - taille et **SHA-256** ;
  - mission, dates d’acquisition et d’édition, capteur.
- `data-sources/terrain/lidar-hd-metadata.json` (versionné) : la réponse brute de l’index WFS pour ces dalles.
- `npm run data:terrain-fetch` retélécharge les dalles manquantes et vérifie chaque SHA-256. Une dalle locale modifiée, ou une dalle que l’IGN servirait différemment (nouvelle édition), arrête le pipeline. Rien n’est jamais écrasé.
- Le GeoTIFF 1 m versionné (§ 5) conserve à l’identique un échantillon source sur quatre. Les valeurs réellement utilisées restent donc dans le dépôt, même sans les dalles.

## 3. Emprise

- Rectangle Lambert-93 centré sur l’emprise de la commune (755 919,08 – 760 956,30 E ; 6 820 066,55 – 6 825 820,30 N). Marges : 529 m à l’ouest, 530 m à l’est, 553 m au sud, 552 m au nord.
- **Nœuds** : E de 755 390 à 761 486, N de 6 819 514 à 6 826 372, tous les mètres entiers.
- **Taille** : 6 096 × 6 858 m, soit 41,81 km². La grille 1 m compte 6 097 × 6 859 = 41 819 323 nœuds.
- **Pourquoi cette marge** : au moins 500 m autour de la commune (la zone affichée par Three.js n’a que 150 m). Depuis le bourg, le bord du terrain est ainsi à au moins 2,7 km. La taille exacte est ensuite arrondie à 254 × k + 1 nœuds pour qu’un Landscape Unreal tombe **exactement à 1 m, sans rééchantillonnage ni découpe**. Cela donne 24 × 27 composants.
- `scripts/build-terrain.mjs` recalcule ces constantes à partir de `public/data/commune.geojson` et s’arrête si elles diffèrent de `scripts/terrain-frame.mjs`.

## 4. Systèmes de coordonnées et transformations

| Couche | Système |
|---|---|
| GeoJSON du projet (bâtiments, OSM, commune) | CRS84 / WGS84, longitude-latitude |
| Terrain | EPSG:2154 Lambert-93 et NGF-IGN69 |
| Three.js | repère local de `src/geo.js` : équirectangulaire, x est, z sud, origine 3.7890245, 48.5097657 |
| Unreal | centimètres, X est, Y sud, Z haut |

Transformations réellement effectuées :
1. **Dalles → grille** : aucune transformation. On garde les échantillons 0,5 m dont le centre tombe sur un mètre entier. Chaque nœud 1 m est donc une valeur source exacte ; il n’y a ni moyenne ni interpolation.
2. **GeoJSON → Lambert-93** : proj4, CRS84 → EPSG:2154. RGF93 v1 et WGS84 sont confondus (écart inférieur au mètre). Il n’y a qu’**une seule** transformation, définie dans `scripts/terrain-frame.mjs`.
3. **Lambert-93 → Unreal** : une translation et un facteur 100 (voir § 6). Pas de rotation, pas de reprojection.
4. **Three.js** (contrôle seulement) : repère local → longitude-latitude (inverse exacte de `geo.js`) → Lambert-93, puis interpolation bilinéaire sur la grille 1 m. Unreal ne doit pas utiliser ce repère : sa projection équirectangulaire s’écarte légèrement de Lambert-93.

## 5. Fichiers produits (`npm run data:terrain`)

| Fichier | Contenu | Poids | Git |
|---|---|---:|---|
| `unreal/terrain/maizieres-mnt-lidarhd-1m-lamb93-ign69.tif` | GeoTIFF technique float32, 6 097 × 6 859, deflate avec prédicteur flottant, EPSG:2154 et clé verticale 5720, NoData −9999. Pixel-is-area : coin 755 389,5 / 6 826 372,5, pas de 1 m | 83,5 Mo | oui |
| `unreal/terrain/maizieres-heightmap-6097x6859.png` | **heightmap Unreal**, PNG 16 bits gris | 29,4 Mo | oui |
| `unreal/terrain/maizieres-heightmap-6097x6859.r16` | même heightmap en RAW 16 bits little-endian | 83,6 Mo | non (régénéré) |
| `unreal/terrain/terrain-reference.json` | toutes les métadonnées : source, emprise, statistiques, contrôles, paramètres Unreal, SHA-256 des sorties | 28 ko | oui |
| `public/data/terrain-threejs.bin` + `.json` | grille de travail 10 m pour Three.js, 537 × 610, Uint16 en cm au-dessus de 71 m | 0,7 Mo | oui |
| `public/data/building-terrain-elevation.json` | altitude du terrain sous chacun des 2 494 bâtiments | 0,7 Mo | oui |

Trois niveaux sont conservés séparément : la source 0,5 m (dalles), la version Unreal 1 m (GeoTIFF et PNG), et la version de travail Three.js 10 m. La réduction pour Three.js ne remplace jamais les deux autres.

**Statistiques** :
- altitude **71,10 m** à **103,65 m** NGF-IGN69, amplitude 32,54 m, moyenne 81,26 m ;
- **0 NoData**, que ce soit dans la source 0,5 m (167 251 381 cellules) ou dans la grille 1 m ;
- aucune valeur aberrante.

## 6. Origine commune Unreal : `UNREAL_ORIGIN`

- **E = 758 278 m, N = 6 823 571 m (Lambert-93), H = 0 m NGF-IGN69.**
- C’est l’origine historique du projet (3.7890245, 48.5097657) projetée en Lambert-93 et arrondie au mètre, à 2 cm près. Elle tombe sur un nœud du terrain, où l’altitude vaut 77,24 m.
- Elle sert d’origine à **toutes** les couches Unreal futures : bâtiments, routes, voie ferrée, végétation, POI. Elle est définie une seule fois dans `scripts/terrain-frame.mjs` (`UNREAL_ORIGIN`, `toUnreal`, `fromUnreal`).

```
Réel → Unreal (cm) : X = (E − 758278) × 100 ; Y = −(N − 6823571) × 100 ; Z = (H − 0) × 100
Unreal → réel      : E = 758278 + X / 100 ; N = 6823571 − Y / 100 ; H = Z / 100
```

- X pointe vers l’est et Y vers le sud : le repère gauche d’Unreal ne miroite donc pas la carte.
- Z = altitude NGF × 100. Le sol du bourg est vers Z ≈ 7 700 cm.
- Avec les Large World Coordinates d’UE5, ces valeurs, qui restent sous quelques centaines de milliers de cm, ne posent aucun problème de précision.

## 7. Import dans Unreal Engine 5.8

Landscape Mode → New Landscape → Import from File :
- **Heightmap** : `maizieres-heightmap-6097x6859.png`, ou le `.r16` après `npm run data:terrain`.
- **Section Size** : 127 × 127 quads. **Sections per Component** : 2 × 2. **Number of Components** : 24 × 27. **Overall Resolution** : 6 097 × 6 859. Unreal ne doit proposer aucun redimensionnement.
- **Scale** : X = 100, Y = 100, **Z = 100**. Cela donne 1 m entre sommets et 1 m réel = 1 m Unreal, **sans exagération**.
- **Location saisie dans l’outil** : X = 16 000, Y = 62 800, Z = 8 700 cm. L’outil centre le paysage sur cette valeur.
- **Position finale de l’acteur Landscape** (sommet 0, 0 = coin nord-ouest) : X = −288 800, Y = −280 100, Z = 8 700 cm. Vérifier après import.
- **Encodage des hauteurs** : `valeur = round(32768 + (altitude − 87) × 128)`, et inversement `altitude = 87 + (valeur − 32768) / 128`.
  - Côté Unreal : `Z(cm) = 8700 + (valeur − 32768) / 128 × 100`.
  - Pas de quantification : 1/128 m = 7,8 mm. Erreur maximale 3,9 mm, erreur quadratique moyenne 2,3 mm.
- **Orientation** : ligne 0 = nord, colonne 0 = ouest. Le sommet (i, j) correspond à E = 755 390 + i et N = 6 826 372 − j.
- **Vérification** : le sommet de l’origine (i = 2 888, j = 2 801) doit être en X = 0, Y = 0, Z ≈ 7 724 cm.
- Avec World Partition, laisser Unreal créer les Landscape Streaming Proxies. La géométrie ne change pas.
- **Pourquoi 1 m et pas 0,5 m** : un Landscape de 12 193 × 13 717 dépasserait largement la taille recommandée (8 129) et imposerait plusieurs paysages. La grille 1 m garde les échantillons exacts.
- **Perte de la réduction 0,5 m → 1 m**, mesurée sur les 125 419 104 échantillons écartés :
  - écart quadratique moyen 2,2 cm, moyenne 1,4 cm, 95 % sous 4,6 cm, 99 % sous 8,5 cm ;
  - maximum 3,65 m, sur un ouvrage hydraulique du bras mort au nord (757 819 / 6 825 244).
  - Une version 0,5 m reste possible depuis les dalles sources.

## 8. Altitude des bâtiments (`public/data/building-terrain-elevation.json`)

- Une entrée par identifiant stable de `buildings.geojson`. Le référentiel bâti gelé (SHA-256 `809f3af3…`) n’est pas modifié.
- Pour chaque bâtiment, calculé sur la mosaïque 0,5 m :
  - cellules dont le centre est dans l’emprise ;
  - contour échantillonné tous les 0,5 m.
- Champs :
  - `baseZ` : **altitude recommandée du socle** (minimum intérieur et contour), pour qu’aucun côté ne flotte ;
  - `medianZ`, `minZ`, `maxZ`, `drop` (dénivelé sous l’emprise) ;
  - `interiorMedianZ`, `perimeterMinZ`, `perimeterMaxZ` ;
  - `centroidL93` ;
  - `unrealCm` : centre et `baseZ` en centimètres Unreal.
- **Placement dans Unreal** : poser la base du volume à `baseZ` et prolonger les murs vers le bas quand `drop` est grand.
- Sous un bâtiment, le MNT LiDAR est interpolé par l’IGN à partir du sol autour : c’est normal.
- Dénivelé médian 0,39 m ; 90 % des bâtiments sous 1,19 m. 167 bâtiments de la commune dépassent 1,5 m (talus, fossés, rampes, cours en contrebas). La liste est dans `terrain-reference.json` → `controls.buildingsOnSlope`.

## 9. Contrôles (`npm run check:terrain`, inclus dans `check:all`)

- Chaque fichier dérivé a le SHA-256 déclaré dans la référence. Les dalles présentes localement ont le SHA-256 du manifeste.
- GeoTIFF : taille, emprise, EPSG:2154 et 5720, min/max, NoData. Relu une fois aussi par GDAL 3.10 (rasterio), hors contrôle automatique : échantillons identiques à la source.
- PNG : relu entièrement ; tous les nœuds sont retrouvés à une demi-marche de quantification près (≤ 3,9 mm).
- `UNREAL_ORIGIN` est sur un nœud, les allers-retours réel ↔ Unreal sont exacts, et le coin du Landscape retombe sur le coin de la grille.
- Grille Three.js : couvre la zone affichée, sans NoData.
- `buildings.geojson` a toujours le SHA-256 du gel V1.6.2 : 2 494 bâtiments, dont 2 265 dans la commune, chacun avec une altitude.

Résultats des contrôles de construction (`terrain-reference.json`) :
- **Raccords de dalles** : sur les 13 raccords, le saut moyen au raccord vaut au plus 1,27 fois celui de l’intérieur des dalles, et il n’y a aucune marche brusque. Cela vaut aussi pour la frontière entre les missions de février et d’octobre 2025.
- **Anomalies locales** : 66 nœuds s’écartent de plus de 1 m de leurs voisins. Ce sont des ouvrages ou des talus réels (vanne du bras mort, berges).
- **Pente maximale** : 378 %, sur une berge au nord, hors commune.
- **Secteurs** (fenêtres autour du point de référence) :

| Secteur | Altitude | Pente locale maximale |
|---|---|---:|
| Centre-bourg | 74,7–82,2 m | 146 % (murs, talus) |
| Les Granges | 74,4–80,5 m | 148 % |
| Poussey | 74,4–79,5 m | 113 % |
| ZI la Glacière | 77,4–86,4 m | 176 % |
| Extrémités de la commune | nord 74,3 m, est 76,8 m, ouest 80,8 m, sud 90,7 m | — |

- **Voie ferrée** : profil de 74,0 à 85,5 m sur son remblai. Les 4 ruptures de plus de 1 m tombent sur des ponts ou passages inférieurs, absents du MNT (vérifié sur l’ombrage à 757 037 / 6 823 151).
- **Routes** : pentes ordinaires, au plus 9 %, sauf la rue du Pont de Clairvaux (58 %, pont).
- **Ponts** : le MNT est un sol nu, donc les ponts n’y figurent pas. **Ils devront être modélisés à part dans Unreal.**

## 10. Mode diagnostic Three.js

- `?diagnostic=terrain` affiche la grille de travail 10 m à l’échelle verticale 1:1, avec y = altitude − 77,2 m (altitude du terrain à l’origine commune).
- Teinte hypsométrique, quadrillage de 100 m, courbes tous les 5 m, NoData en magenta (aucun actuellement).
- Les bâtiments sont relevés à leur `baseZ`, sans modification de leur empreinte. Le paysage plat stylisé est masqué dans ce mode seulement.
- Le rendu normal n’utilise pas le relief et reste strictement identique.

## 11. Reconstruire

```
pnpm install
npm run data:terrain      # télécharge ou vérifie les 56 dalles (SHA-256), puis reconstruit tout (~80 s)
npm run check:terrain
npm run audit:terrain-sources   # facultatif : comparaison RGE ALTI (réseau)
```

Dépendances ajoutées : `geotiff` (lecture des dalles), `proj4` (Lambert-93). Les écritures GeoTIFF et PNG 16 bits sont dans `scripts/raster-io.mjs`, sans dépendance.
