# V2.3 — Exceptions au gel géographique (constats, aucune correction)

> Généré par `scripts/build-architecture.mjs`. La V2.3 ne modifie **aucune** empreinte, position ni coordonnée :
> les cas ci-dessous sont seulement documentés pour une future passe géographique.

## 1. Site masqué dans les données IGN

- 75 empreintes du référentiel V1.6.2 (identifiants BD TOPO anciens `BATIMENT00000000093586…` / `…93587…`) se trouvent sur un site dont l’**orthophoto est servie en mosaïque** et dont le **LiDAR HD est interpolé** (bandes) : emprise approximative 22.7 ha, Lambert-93 759566.6 – 6822511.2 – 760683.4 – 6822825.8 (entre la voie ferrée et la RD619, à l’est de la zone d’activités).
- Aucune mesure architecturale n’y est possible : type de toit, hauteurs et couleurs restent `unknown` (classe BD TOPO conservée).
- Les empreintes elles-mêmes datent de la BD TOPO (saisie ancienne) et **ne peuvent pas être vérifiées** sur les sources 2025 ; elles restent telles quelles.

## 2. Empreintes sans élévation sur le LiDAR HD 2025

67 empreintes (hors végétation dense et hors objets trop petits pour le LiDAR) ne portent **aucune élévation** mesurable sur le MNH LiDAR HD 2025 (vols de février et d’octobre 2025).
Causes possibles, **non tranchées** : bâtiment démoli, surface au sol (terrasse, cour, piscine), contour décalé, construction postérieure au vol.
Les relevés manuels V2.2 concernés (dont `vis-A`, `vis-H1`, `vis-H2`) sont signalés ici : leur toit plat observé sur l’orthophoto est conservé dans le profil, mais aucune hauteur n’est mesurée ; une vérification sur place est recommandée.

| Bâtiment | Couche | Surface (m²) | Constat LiDAR | Couleur ortho |
|---|---|---:|---|---|
| `BATIMENT0000000300132125` | official_v1_6_2 | 59.4 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | light_gray |
| `BATIMENT0000000300132137` | official_v1_6_2 | 16.9 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | light_gray |
| `BATIMENT0000000301149817` | official_v1_6_2 | 19.6 | élévation > 1,2 m sur 24 % de l’empreinte ; végétation 9 % | light_gray |
| `BATIMENT0000000301148762` | official_v1_6_2 | 123.7 | élévation > 1,2 m sur 4 % de l’empreinte ; végétation 14 % | dark_gray |
| `BATIMENT0000000301148893` | official_v1_6_2 | 47.6 | élévation > 1,2 m sur 8 % de l’empreinte ; végétation 0 % | light_gray |
| `BATIMENT0000000301148978` | official_v1_6_2 | 15.7 | élévation > 1,2 m sur 3 % de l’empreinte ; végétation 0 % | light_gray |
| `BATIMENT0000000301148985` | official_v1_6_2 | 29 | élévation > 1,2 m sur 37 % de l’empreinte ; végétation 41 % | dark_gray |
| `BATIMENT0000000301149007` | official_v1_6_2 | 21.9 | élévation > 1,2 m sur 6 % de l’empreinte ; végétation 0 % | brown |
| `BATIMENT0000000301149221` | official_v1_6_2 | 22.5 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | light_gray |
| `BATIMENT0000000301149587` | official_v1_6_2 | 16.7 | élévation > 1,2 m sur 24 % de l’empreinte ; végétation 0 % | mixed |
| `BATIMENT0000000301149798` | official_v1_6_2 | 29.2 | élévation > 1,2 m sur 8 % de l’empreinte ; végétation 0 % | white |
| `BATIMENT0000000301150030` | official_v1_6_2 | 12.6 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 40 % | blue_gray |
| `BATIMENT0000000301150886` | official_v1_6_2 | 20.6 | élévation > 1,2 m sur 23 % de l’empreinte ; végétation 0 % | light_gray |
| `BATIMENT0000000301150887` | official_v1_6_2 | 20.6 | élévation > 1,2 m sur 5 % de l’empreinte ; végétation 0 % | light_gray |
| `BATIMENT0000000301150888` | official_v1_6_2 | 12.9 | élévation > 1,2 m sur 24 % de l’empreinte ; végétation 0 % | dark_gray |
| `BATIMENT0000000301150889` | official_v1_6_2 | 15.2 | élévation > 1,2 m sur 10 % de l’empreinte ; végétation 0 % | light_gray |
| `BATIMENT0000000301150890` | official_v1_6_2 | 13.1 | élévation > 1,2 m sur 3 % de l’empreinte ; végétation 0 % | dark_gray |
| `BATIMENT0000000301150924` | official_v1_6_2 | 12.9 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | dark_gray |
| `BATIMENT0000000301151918` | official_v1_6_2 | 12.1 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 30 % | dark_gray |
| `BATIMENT0000000301151957` | official_v1_6_2 | 21.8 | élévation > 1,2 m sur 22 % de l’empreinte ; végétation 21 % | dark_gray |
| `BATIMENT0000000335663857` | official_v1_6_2 | 25.8 | élévation > 1,2 m sur 10 % de l’empreinte ; végétation 7 % | dark_gray |
| `BATIMENT0000002330331378` | official_v1_6_2 | 70.3 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 24 % | brown |
| `BATIMENT0000002330331379` | official_v1_6_2 | 33.3 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | light_gray |
| `BATIMENT0000002330331380` | official_v1_6_2 | 33.2 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 15 % | light_gray |
| `BATIMENT0000002494157683` | official_v1_6_2 | 241 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | blue_gray |
| `BATIMENT0000002494156607` | official_v1_6_2 | 211.4 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | light_gray |
| `BATIMENT0000002494156837` | official_v1_6_2 | 174 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | white |
| `BATIMENT0000002494157528` | official_v1_6_2 | 34.8 | élévation > 1,2 m sur 2 % de l’empreinte ; végétation 0 % | white |
| `BATIMENT0000000009355310` | official_v1_6_2 | 60.7 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | light_gray |
| `BATIMENT0000000009358758` | official_v1_6_2 | 212.6 | élévation > 1,2 m sur 15 % de l’empreinte ; végétation 21 % | light_gray |
| `BATIMENT0000000009361091` | official_v1_6_2 | 55.8 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 48 % | dark_gray |
| `way/228577119` | official_v1_6_2 | 13.4 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | light_gray |
| `way/228579174` | official_v1_6_2 | 12.4 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | light_gray |
| `way/549958938` | official_v1_6_2 | 12.7 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | light_gray |
| `way/549958990` | official_v1_6_2 | 14.3 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | white |
| `way/549959091` | official_v1_6_2 | 13.7 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | white |
| `way/549959196` | official_v1_6_2 | 13.3 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | light_gray |
| `way/549959648` | official_v1_6_2 | 13.9 | élévation > 1,2 m sur 5 % de l’empreinte ; végétation 0 % | white |
| `way/549959715` | official_v1_6_2 | 13.1 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | mixed |
| `way/549959803` | official_v1_6_2 | 16 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | brown |
| `way/549959919` | official_v1_6_2 | 13.2 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | white |
| `way/588789726` | official_v1_6_2 | 337 | élévation > 1,2 m sur 17 % de l’empreinte ; végétation 1 % | light_gray |
| `way/588789793` | official_v1_6_2 | 12.4 | élévation > 1,2 m sur 14 % de l’empreinte ; végétation 0 % | light_gray |
| `way/588791915` | official_v1_6_2 | 23.8 | élévation > 1,2 m sur 10 % de l’empreinte ; végétation 8 % | dark_gray |
| `way/588792118` | official_v1_6_2 | 12.8 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | light_gray |
| `way/588792378` | official_v1_6_2 | 57.2 | élévation > 1,2 m sur 18 % de l’empreinte ; végétation 25 % | dark_gray |
| `cadastre:20394549` | official_v1_6_2 | 52.7 | élévation > 1,2 m sur 5 % de l’empreinte ; végétation 0 % | brown |
| `cadastre:20394661` | official_v1_6_2 | 140 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | light_gray |
| `cadastre:23579114` | official_v1_6_2 | 15.7 | élévation > 1,2 m sur 20 % de l’empreinte ; végétation 0 % | mixed |
| `cadastre:39810698` | official_v1_6_2 | 25.8 | élévation > 1,2 m sur 24 % de l’empreinte ; végétation 0 % | brown |
| `cadastre:39823777` | official_v1_6_2 | 22.9 | élévation > 1,2 m sur 12 % de l’empreinte ; végétation 0 % | light_gray |
| `cadastre:39823883` | official_v1_6_2 | 272.4 | élévation > 1,2 m sur 15 % de l’empreinte ; végétation 0 % | light_gray |
| `cadastre:23577103~partie` | reintegrated_v2_0_1 | 59.7 | élévation > 1,2 m sur 5 % de l’empreinte ; végétation 0 % | mixed |
| `cadastre:34631971~partie` | reintegrated_v2_0_1 | 16.6 | élévation > 1,2 m sur 24 % de l’empreinte ; végétation 0 % | brown |
| `cadastre:39362353~partie` | reintegrated_v2_0_1 | 24.4 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | light_gray |
| `cadastre:39362354~partie` | reintegrated_v2_0_1 | 28.5 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | light_gray |
| `cadastre:39362494~partie` | reintegrated_v2_0_1 | 27.2 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | light_gray |
| `cadastre:39808701~partie` | reintegrated_v2_0_1 | 36 | élévation > 1,2 m sur 16 % de l’empreinte ; végétation 0 % | dark_gray |
| `cadastre:39816867~partie` | reintegrated_v2_0_1 | 34.5 | élévation > 1,2 m sur 19 % de l’empreinte ; végétation 0 % | brown |
| `cadastre:39821742~partie` | reintegrated_v2_0_1 | 53.6 | élévation > 1,2 m sur 6 % de l’empreinte ; végétation 0 % | light_gray |
| `cadastre:39821840~partie` | reintegrated_v2_0_1 | 82.7 | élévation > 1,2 m sur 2 % de l’empreinte ; végétation 19 % | light_gray |
| `way/588791987~partie` | reintegrated_v2_0_1 | 23.9 | élévation > 1,2 m sur 7 % de l’empreinte ; végétation 0 % | white |
| `way/588792057` | reintegrated_v2_0_1 | 15.4 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | mixed |
| `way/588792877` | reintegrated_v2_0_1 | 20.1 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 14 % | light_gray |
| `manual-v2.2:vis-A` | manual_orthophoto_v2_2 | 161.9 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | brown |
| `manual-v2.2:vis-H1` | manual_orthophoto_v2_2 | 108 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 0 % | white |
| `manual-v2.2:vis-H2` | manual_orthophoto_v2_2 | 156.8 | élévation > 1,2 m sur 0 % de l’empreinte ; végétation 5 % | light_gray |

## 3. Autres constats

- Château d’eau entre le bourg et Les Granges (`way/588791386`) : le LiDAR 2025 ne mesure que ≈ 12,6 m sur l’empreinte OSM (retours incomplets sur la cuve) ; la hauteur officielle BD TOPO de 27,6 m est retenue. L’empreinte OSM correspond au fût ; la cuve (plus large) est décrite dans `landmark-architecture.json`.
- Les écarts BD TOPO / LiDAR sur la hauteur à l’égout supérieurs à 3 m sont notés bâtiment par bâtiment dans `public/data/building-architecture-v2.3.json` (champ `notes`).
