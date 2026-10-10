# QA V2.9 — JRPG art pass, continuité hydro, fiches immersives

Captures directes du renderer (Chromium headless, SwiftShader), sans retouche. « V2.8 » = `?visual=cartoon-v28` (commit `5b0ad49`), « V2.9 » = `?visual=cartoon-v29`, mêmes cadrages, sous la limite de zoom V2.7.1 (≥ 420 m, site ≥ 25°).

- `art/` : `v28-*.jpg`, `v29-*.jpg` (BEAUTÉ, 1200 px) et planches `compare-*.jpg` (V2.8 à gauche, V2.9 à droite) : vue générale, oblique, centre-bourg, Poussey, Les Granges, La Glacière, champs, bois, rivière, zone résidentielle, église, châteaux d'eau, gare et rail ; (mobile : voir `mobile/`).
- `hydro/` : `v28-*`, `v29-*`, `compare-*` (ÉQUILIBRÉ) : Le Craon (ruisseau et bras des Moulins de Poussey sous les peupleraies), Poussey, centre, cinq extrémités de cours d'eau, pont sur la Seine, pont ferroviaire, Seine.
- `cards/` : fiches V2.9 (`desktop-*`, `phone-portrait-*`, `phone-landscape-*`, preset PERFORMANCE) et test de clic `ux-*` (route, bâtiment, Détails, POI, industriel, landmark) : église, monument, mairie, Poussey, route, bâtiment ordinaire ; étiquette rapide, fiche Détails, sources fermées et ouvertes ; desktop, portrait, paysage.
- `mobile/` : 390 × 844 et 844 × 390 (PERFORMANCE) : `v28-*` (captures V2.8 de `docs/qa/v2.8/mobile`), `v29-*`, planches `compare-*`.
