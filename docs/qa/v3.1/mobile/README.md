# QA V3.1 — mobile

Chromium headless, écran tactile émulé, `deviceScaleFactor` 2, preset PERFORMANCE, 390 × 844 et 844 × 390, sept cadrages identiques. Trois séries par format : V3.0 (`?visual=premium-v30`, FXAA), V3.1 avec FXAA (`?visual=premium-v31&fxaa=1`, réglage par défaut retenu) et V3.1 sans FXAA (`&fxaa=0`). Planches : `planche-portrait-*` (côte à côte) et `planche-paysage-*` (l'une sous l'autre), dans l'ordre V3.0, V3.1 FXAA, V3.1 sans FXAA.

`planche-fxaa-on-off-telephone.jpg` : lisière, église et La Glacière en portrait, FXAA à gauche, sans FXAA à droite, en pixels réels. Sans FXAA, la lisière, la silhouette de l'église, les acrotères et l'anneau de sélection sont en escalier.

| Cadrage | Portrait : appels / triangles (V3.0 = V3.1 FXAA ; sans FXAA : − 1 appel) | Paysage | Toucher |
|---|---|---|---|
| 01 centre (église touchée) | 79 / 2 268 004 | 101 / 2 924 266 | Église Saint-Denis |
| 02 lisière de bois | 51 / 2 234 032 | 65 / 2 688 796 | — |
| 03 frange village | 69 / 2 228 522 | 105 / 2 928 228 | — |
| 04 champs | 59 / 2 294 460 | 92 / 3 127 460 | — |
| 05 Poussey | 60 / 2 396 380 | 85 / 3 172 396 | — |
| 06 La Glacière (zone touchée) | 48 / 1 768 870 | 75 / 2 517 060 | Zone industrielle La Glacière |
| 07 rivière | 55 / 2 270 448 | 90 / 3 262 138 | — |

2 596 / 2 596 bâtiments, 0 enfoui, console vide dans les six séries ; étiquettes rapides correctes après toucher.
