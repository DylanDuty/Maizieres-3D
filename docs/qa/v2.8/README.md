# QA visuelle V2.8 — landmarks par références web

Captures directes du renderer (Chromium headless, rastérisation logicielle SwiftShader), sans retouche, mode `?visual=cartoon-v28` (alias de `cartoon-v27`). Toutes les vues respectent la limite de zoom V2.7.1 (distance ≥ 420 m, site ≥ 25°) ; les captures de landmarks et d'église sont prises en facteur d'échelle 2 puis recadrées au centre, ce qui équivaut à un grossissement ×2 de ce que l'utilisateur voit à la distance minimale.

- `landmarks/` : les 16 landmarks (11 POI et 5 bâtiments `auto:`), `before-*` en V2.7.1 (commit `4d47e00`) et `after-*` en V2.8, même cadrage (centre du POI ou des empreintes liées, azimut 35°, site 36°, 420 m sauf grands sites).
- `eglise/` : église Saint-Denis V2.8 sous six angles (azimuts 20°, 110°, 200°, 290°, vue basse 26°, vue plongeante 80°) à 420 m, BEAUTÉ, plus la planche.
- `secteurs/` : BEAUTÉ 1280 × 800 : vue générale, oblique générale, centre-bourg (vue basse et nord), Poussey, Les Granges, La Glacière.
- `mobile/` : 390 × 844 et 844 × 390, PERFORMANCE : centre-bourg (église touchée), Poussey, château d'eau de Poussey touché, La Glacière, monument aux morts, Les Granges, ruisseau.
- `ux/` : test de clic (route, bâtiment, Détails, POI, industriel, landmark par recherche) sur desktop, portrait et paysage.
