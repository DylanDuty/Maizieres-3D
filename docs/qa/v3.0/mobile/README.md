# QA V3.0 — mobile

Chromium headless, écran tactile émulé, `deviceScaleFactor` 2, preset PERFORMANCE (rendu à 1 pixel CSS par pixel, comme sur téléphone). V2.9.2 : `?visual=cartoon-v291` ; V3.0 : `?visual=premium-v30`. Mêmes sept cadrages pour les deux versions ; « Église » et « La Glacière » sont touchés à l'écran (étiquette rapide ouverte).

- `v292-portrait-*`, `v30-portrait-*` : 390 × 844 ; planches côte à côte `planche-portrait-*`.
- `v292-paysage-*`, `v30-paysage-*` : 844 × 390 ; planches l'une sous l'autre `planche-paysage-*`.

| Cadrage | Portrait : appels / triangles (V2.9.2 → V3.0) | Paysage : appels / triangles (V2.9.2 → V3.0) | Toucher |
|---|---|---|---|
| 01 centre (église touchée) | 78 / 2 250 523 → 81 / 2 268 006 | 101 / 2 923 685 → 103 / 2 924 268 | Église Saint-Denis, dans les deux versions |
| 02 lisière de bois | 50 / 2 233 531 → 53 / 2 234 034 | 64 / 2 688 295 → 67 / 2 688 798 | — |
| 03 frange village | 69 / 2 228 121 → 71 / 2 228 524 | 106 / 2 928 047 → 107 / 2 928 230 | — |
| 04 champs | 58 / 2 294 039 → 61 / 2 294 462 | 92 / 3 127 539 → 94 / 3 127 462 | — |
| 05 Poussey | 59 / 2 395 959 → 62 / 2 396 382 | 85 / 3 172 075 → 87 / 3 172 398 | — |
| 06 La Glacière (zone touchée) | 47 / 1 768 629 → 50 / 1 768 872 | 74 / 2 516 399 → 77 / 2 517 062 | Zone industrielle La Glacière, dans les deux versions |
| 07 rivière | 54 / 2 270 027 → 57 / 2 270 450 | 90 / 3 261 817 → 92 / 3 262 140 | — |

Les deux ou trois appels de plus sont les passes SMAA, désormais actives en PERFORMANCE. Triangles : + 0,02 % (+ 0,8 % sur le centre, tirage des familles d'arbres de jardin). 2 596 / 2 596 bâtiments, 0 enfoui, console vide dans les quatre séries.

Lecture : la lisière de bois (`02`) montre l'escalier de 8 m en V2.9.2 et la vraie limite en V3.0, en portrait comme en paysage ; les bords de champs et la frange de village (`03`, `04`) sont lisses, sans crénelage au pixel près malgré le rendu à 1 pixel CSS.
