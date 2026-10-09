# QA visuelle V2.5 — prototype artistique Poussey

Captures directes du renderer (Chromium headless 1280 × 800, rastérisation logicielle SwiftShader), sans retouche. Même cadrage, même caméra, dans les deux versions.

- `compare/` : 11 planches V2.4 (gauche) / V2.5 prototype au préréglage BEAUTÉ (droite).
- `v24/` : captures V2.4 (`?` sans paramètre, profils V2.3.1 par défaut).
- `v25/` : captures V2.5 (`?visual=poussey-v25&v25quality=beauty`).

| N° | Cadrage | Centre (x, z) | Distance | Azimut | Site |
|---|---|---|---|---|---|
| 01 | Poussey — vue générale | 1180, −280 | 900 m | 12° | 46° |
| 02 | Poussey — ouest | 800, −300 | 420 m | 20° | 42° |
| 03 | Poussey — centre | 1300, −250 | 420 m | 20° | 42° |
| 04 | Poussey — est | 1560, −220 | 420 m | 20° | 42° |
| 05 | Poussey — maisons | 1350, −262 | 170 m | 28° | 30° |
| 06 | Poussey — D20 | 1250, −262 | 260 m | 250° | 24° |
| 07 | Poussey — ruisseau | 1320, −395 | 150 m | 15° | 18° |
| 08 | Poussey — château d'eau | 1322, −214 | 200 m | 215° | 18° |
| 09 | Poussey — vis-A | 1356, −215 | 120 m | 40° | 26° |
| 10 | Poussey — vue basse cinématique | 1300, −262 | 230 m | 118° | 16° |
| 11 | Poussey — rue, point de vue bas | 1340, −262 | 130 m | 32° | 13° |

Les cadrages 01, 05, 07, 08, 10 et 11 correspondent aux presets de caméra `V25_Poussey_Wide`, `Houses`, `River`, `WaterTower`, `Cinematic` et `StreetHigh` du prototype. En vue générale, le fond hors de la boîte Poussey reste en rendu V2.4 : c'est voulu, le prototype n'est pas généralisé.

`HUMAN_ART_DIRECTION_APPROVED = false`
