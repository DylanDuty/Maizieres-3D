# Guide d'import Unreal — architecture V2.3 / V2.3.1

> Point d'entrée du gel : `unreal/freeze-v1/README.md` (Freeze V1).

Ce guide explique comment Unreal peut **élever** les bâtiments à partir des profils V2.3, **sans jamais déplacer la géographie**.

## 1. Fichiers

| Fichier | Contenu |
|---|---|
| `public/data/buildings.geojson`, `buildings-additions-v2.0.1.geojson`, `buildings-manual-v2.2.geojson` | **Empreintes gelées**, en WGS84, trois couches séparées. Ce sont les seules géométries XY à utiliser. |
| `unreal/buildings/buildings-provenance-v2.2.json` | Position `unrealCm` (centroïde et socle) et classe de provenance de chaque bâtiment (officiel, réintégré V2.0.1, relevé manuel V2.2). |
| `unreal/architecture/building-architecture.json` | Profil compact par bâtiment : archétype, hauteurs, niveaux, toit, couleur, matériau, confiance, graine. |
| `unreal/architecture/building-archetypes.json` | Règles par archétype : plages, variantes, randomisation autorisée et interdite. |
| `unreal/architecture/landmark-architecture.json` | Bâtiments remarquables : silhouette, dimensions, hauteurs, particularités, niveau de modélisation. |
| `public/data/building-architecture-v2.3.json` | Profil complet : trace de chaque attribut, sources, notes. C'est le fichier de référence en cas de doute. |

## 2. Repère

- **Origine Unreal** : E0 = 758 278, N0 = 6 823 571, H0 = 0 (Lambert-93, NGF-IGN69).
- **Conversion** : `X = (E − E0) × 100`, `Y = −(N − N0) × 100`, `Z = altitude × 100`, en cm.
- **Angles** : `roofOrientationDeg` (axe du faîtage) et `mainBearingDeg` (axe du grand côté de l'empreinte) sont en **degrés de 0 à 180, sens horaire depuis le nord du quadrillage Lambert-93**. Ce sont des axes, sans sens.
  - Dans Unreal, avec X vers l'est et Y vers le sud, un axe d'angle θ a pour direction `(sin θ, −cos θ)`.
- **Mono-pente** : `building-architecture-v2.3.json` indique aussi `roof.uphillAzimuthDeg` (0–360), la direction vers laquelle le toit monte.
- **Hauteurs** : en mètres **au-dessus du socle** (`baseZ` de la table V2.2).

## 3. Algorithme recommandé

Pour chaque bâtiment `b` de `building-architecture.json` :

1. **Empreinte.** Lire son polygone dans le GeoJSON de sa couche (`layer`), le convertir en Lambert-93 puis en cm Unreal, et vérifier `footprintSha256`, le SHA-256 du JSON de la géométrie. Si l'empreinte a changé, **arrêter** : ne rien générer sur une empreinte non gelée.
2. **Socle.** Poser le socle à `baseZ`, sans jamais recalculer XY.
3. **Murs.** Extruder l'empreinte jusqu'à `wallHeightM` :
   - statut `official` ou `measured` : la valeur est utilisée telle quelle ;
   - statut `estimated` : valeur typologique ronde, qu'on peut faire varier dans la plage de l'archétype ;
   - statut `unknown` : tirer dans `wallHeightRangeM` de l'archétype avec la graine.
4. **Toiture.**
   - **Type**, selon `roofType` :
     - `gable` : deux pans le long de `roofOrientationDeg` ;
     - `hip` : quatre pans, avec le faîtage selon `roofOrientationDeg` ;
     - `shed` : un pan, qui monte vers `uphillAzimuthDeg` ;
     - `flat` : toit-terrasse, acrotère facultatif ;
     - `complex` : plusieurs volumes. Découper l'empreinte en rectangles (L, T, U) avec un faîtage par aile, le principal selon `roofOrientationDeg` ;
     - `industrial` : double pente faible ou shed industriel ;
     - `unknown` : toit neutre de l'archétype, en respectant l'orientation de `mainBearingDeg`.
   - **Faîtage** : `roofOrientationStatus` vaut `measured`, `unknown` (faîtage non mesuré : suivre `mainBearingDeg`) ou `not_applicable` (toit plat ou cuve cylindrique : **aucun** faîtage à créer). Depuis V2.3.1, ce dernier statut n'est plus confondu avec `unknown`.
   - **Pente** : `roofSlopeDeg` quand le statut est `measured`. Sinon, prendre la plage de l'archétype.
   - **Hauteur du faîtage** : si `totalHeightM` est mesurée, `totalHeightM − wallHeightM` donne directement la hausse de toit.
5. **Couleur et matériau.** Choisir le matériau dessin animé de `roofColorFamily` et `roofMaterialFamily`. Ce sont des familles, jamais une texture photographique.
6. **Variation.** Utiliser `variationSeed`, un FNV-1a 32 bits de l'identifiant, stable d'une génération à l'autre. Elle ne peut toucher **que** les détails listés dans `randomisation` : menuiseries, cheminée, lucarnes non documentées, teinte d'enduit.
7. **Landmarks.** Tout bâtiment de `landmark-architecture.json` en `unique_model` est remplacé par son modèle dédié. `allowProceduralVariation` y vaut `false`. Un landmark en `procedural_custom` garde ses paramètres propres.

## 4. Interdits

- **Géométrie** : ne jamais modifier l'empreinte, la position, l'orientation géographique ni le socle.
- **Hauteurs** : ne jamais remplacer une hauteur `official` ou `measured` par une valeur aléatoire.
- **Toit** : ne jamais changer un type de toit de confiance A ou B.
- **Présentation** : ne jamais présenter une valeur `estimated` comme mesurée. Ne jamais dire qu'un bâtiment est « fidèle » parce qu'un archétype lui a été attribué.
- **Marques** : ne jamais reproduire de logo ni de marque sur les commerces (archétype COMMERCIAL).
- **Zone masquée** : ses 75 bâtiments restent en archétype neutre (voir `docs/audit/GEOGRAPHIC_FREEZE_EXCEPTIONS.md`).
- **Couche manuelle V2.2** : elle reste une couche séparée et désactivable. Trois de ses objets (vis-A, vis-H1, vis-H2) n'ont aucune élévation LiDAR 2025 : leur hauteur est `unknown` et ils doivent être vérifiés avant tout rendu final.

## 5. Régénération

```
npm run data:architecture-fetch    # 22 dalles LiDAR HD MNH + BD ORTHO (363 Mo, hors Git, vérifiées par SHA-256)
npm run data:architecture-measure  # python3 : numpy, scipy, pillow, pyproj, shapely ≥ 2
npm run data:architecture          # profils, fichiers Unreal, landmarks, exceptions
npm run check:architecture
```
