# Unreal Freeze V1 — package d'import

Ce dossier est le point d'entrée d'Unreal. Il ne recopie pas les gros fichiers : il **référence les fichiers canoniques** du dépôt.
- Leurs SHA-256 sont dans `docs/freeze/UNREAL_FREEZE_MANIFEST_V1.0.json`. Vérifiez-les avant l'import (`npm run check:architecture-stats`).
- Les règles et les statistiques sont dans `docs/freeze/UNREAL_GEOGRAPHIC_ARCHITECTURAL_FREEZE_V1.0.md`.

## 1. Système de coordonnées

| | |
|---|---|
| Projection | Lambert-93 (EPSG:2154) |
| Altitude | NGF-IGN69 |
| Origine Unreal | E0 = 758 278 m, N0 = 6 823 571 m, H0 = 0 m (point WGS84 3.7890245, 48.5097657) |
| Conversion | `X = (E − E0) × 100`, `Y = −(N − N0) × 100`, `Z = H × 100` |
| Unités | centimètres Unreal |
| Axes | X vers l'est, Y vers le sud, Z vers le haut |
| Code de référence | `scripts/terrain-frame.mjs` (`toUnreal` / `fromUnreal`) |

**Angles** :
- `roofOrientationDeg` et `mainBearingDeg` sont des **axes** de 0 à 180°, comptés dans le sens horaire depuis le nord du quadrillage Lambert-93. Dans Unreal, la direction d'un angle θ est `(sin θ, −cos θ)`.
- `uphillAzimuthDeg` (0–360°) donne le sens de montée d'un toit à un seul pan.

**Hauteurs** : en mètres au-dessus du socle `baseZ` de la table de provenance.

## 2. Ordre d'import recommandé

1. **Terrain** :
   - `unreal/terrain/maizieres-heightmap-6097x6859.png` en Landscape ;
   - `maizieres-mnt-lidarhd-1m-lamb93-ign69.tif` pour la référence ;
   - `terrain-reference.json` pour l'échelle, l'emprise et l'altitude à l'origine.
   - Le `.r16` est hors Git ; il se régénère avec `npm run data:terrain`.
2. **Hydrographie et occupation du sol** : `unreal/landcover/water-polygons.json`, `water-lines.json`, `woodland-polygons.json`, `agricultural-polygons.json`, `artificial-surfaces.json` et `hedge-splines.json`.
3. **Routes et rail** : `unreal/roads/road-splines.json` et `unreal/rail/rail-splines.json`.
4. **Empreintes des bâtiments**, en trois couches distinctes :
   - `public/data/buildings.geojson` : **officiel**, 2 494 empreintes, classe `official_v1.6.2` ;
   - `public/data/buildings-additions-v2.0.1.geojson` : **réintégré V2.0.1**, 90 empreintes publiques ;
   - `public/data/buildings-manual-v2.2.geojson` : **relevé manuel V2.2**, 12 empreintes **non officielles**, sur une couche séparée à pouvoir désactiver.
5. **Socles et positions** : `unreal/buildings/buildings-provenance-v2.2.json` donne `unrealCm` et `baseZ` ; ne jamais les recalculer.
6. **Architecture** :
   - `unreal/architecture/building-architecture.json` : un profil compact par bâtiment ;
   - `building-archetypes.json` : les règles par archétype ;
   - `public/data/building-architecture-v2.3.json` : le profil complet, avec traces et sources, qui fait foi en cas de doute.
7. **Landmarks** : `unreal/architecture/landmark-architecture.json`, avec 4 `unique_model` à remplacer par un modèle dédié.
8. **POI** : `unreal/poi/poi.json`, `landmarks.json` et `areas.json`.
9. **Exceptions** : `unreal/freeze-v1/architecture-exceptions.json` liste les 4 `UNKNOWN`, les 75 bâtiments masqués et les 12 relevés manuels.

## 3. Conventions des données architecturales

- **Statuts** :
  - `official` : attribut IGN BD TOPO ou OSM ;
  - `measured` : LiDAR HD 2025 ;
  - `orthophoto` : observation sur l'orthophoto 2025 ;
  - `derived` : déduit d'une valeur officielle ou mesurée ;
  - `estimated` : valeur typologique ronde, jamais présentée comme une mesure ;
  - `unknown` : aucune base suffisante ;
  - `not_applicable` : faîtage d'un toit plat ou d'une cuve cylindrique.
- **Confiance** : A (officiel ou observation très claire), B (déduction solide), C (estimation), `unknown`.
- **Graine** : `variationSeed` est un FNV-1a 32 bits de l'identifiant ; elle est stable d'une génération à l'autre.
- **Randomisation** : elle ne touche jamais l'empreinte, la position ni l'orientation.
- **Algorithme de construction** (murs, toits, pentes, faîtages) : voir `docs/unreal/ARCHITECTURE_IMPORT_GUIDE.md`.

## 4. Officiel, V2.0.1 et manuel V2.2

| Classe (`layer` / `class`) | Nombre | Géométrie | Usage dans Unreal |
|---|---:|---|---|
| `official_v1_6_2` | 2 494 | IGN BD TOPO, cadastre, OSM | référence |
| `reintegrated_v2_0_1` | 90 | géométrie publique réintégrée | référence |
| `manual_orthophoto_v2_2` | 12 | relevé manuel sur orthophoto, ± 0,5 à 1 m | couche séparée, jamais présentée comme officielle |

## 5. Landmarks

| Id | Niveau | Bâtiment | Hauteur |
|---|---|---|---|
| `poi:eglise-saint-denis` | `unique_model` | `BATIMENT0000000301149566` | égout 8,3 m (officiel), point haut 20,1 m (mesuré LiDAR) |
| `poi:chateau-eau-poussey` | `unique_model` | `way/588791761` | 25,3 m (officiel BD TOPO, réservoir) |
| `poi:chateau-eau-granges` | `unique_model` | `way/588791386` | 27,6 m (officiel BD TOPO, réservoir) |
| `poi:monument-aux-morts` | `unique_model` | aucune empreinte (point V1.11) | inconnue |

Les 12 autres landmarks sont en `procedural_custom` ou `procedural` : mairie, école, salle polyvalente, ancien presbytère, CPI, Sévéal, stade, silos et 4 grands bâtiments d'activité.

## 6. Limitations

- **Attributs inconnus** : 621 types de toit, 130 hauteurs et 1 286 matériaux restent inconnus. Unreal applique alors l'archétype neutre sans le présenter comme un relevé.
- **Zone masquée** : ses 75 bâtiments n'ont aucun attribut observé.
- **Sans élévation** : `vis-A`, `vis-H1` et `vis-H2` n'ont aucune élévation LiDAR 2025, et leur hauteur est inconnue. Il faut les vérifier avant tout rendu final.
- **Couleurs** : ce sont des familles, jamais des textures photographiques. Aucune donnée Google n'est utilisée.
