# QA visuelle V2.6 — Poussey en diorama illustré

Captures directes du renderer (Chromium headless 1280 × 800, rastérisation logicielle SwiftShader), sans retouche. Même cadrage, même caméra, dans les deux versions.

- `compare/` : 10 planches V2.5 prototype (gauche) / V2.6 diorama (droite), préréglage BEAUTÉ.
- `v25/` : captures V2.5 (`?visual=poussey-v25&v25quality=beauty`).
- `v26/` : captures V2.6 (`?visual=poussey-v26&v25quality=beauty`).
- `mobile/` : V2.6 au préréglage PERFORMANCE sur un gabarit smartphone 390 × 844 (portrait) et 844 × 390 (paysage).

| N° | Cadrage | Centre (x, z) | Distance | Azimut | Site |
|---|---|---|---|---|---|
| 01 | Poussey — vue générale | 1180, −280 | 900 m | 12° | 46° |
| 02 | Poussey — vue oblique | 1300, −250 | 430 m | 22° | 40° |
| 03 | Poussey — ouest | 800, −300 | 420 m | 20° | 42° |
| 04 | Poussey — est | 1560, −220 | 420 m | 20° | 42° |
| 05 | Poussey — maisons | 1350, −262 | 190 m | 30° | 32° |
| 06 | Poussey — D20, voirie et végétation | 1250, −262 | 260 m | 250° | 24° |
| 07 | Poussey — ruisseau | 1320, −395 | 170 m | 15° | 24° |
| 08 | Poussey — château d'eau | 1322, −214 | 210 m | 215° | 22° |
| 09 | Poussey — vis-A | 1356, −215 | 120 m | 40° | 26° |
| 10 | Poussey — vue basse | 1300, −262 | 230 m | 118° | 18° |

Les cadrages 01, 02, 05, 07, 08 et 10 sont les presets de caméra `V26_Poussey_Wide`, `Oblique`, `Houses`, `River`, `WaterTower` et `Street`. En vue générale, le fond hors de la boîte Poussey reste en rendu V2.4 : le diorama n'est pas généralisé.

`HUMAN_ART_DIRECTION_APPROVED = false`
