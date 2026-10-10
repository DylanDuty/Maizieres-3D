# QA V2.9.1 — landmarks audités, mairie corrigée, passe qualité JRPG

Captures directes du renderer (Chromium headless, SwiftShader), sans retouche. « V2.9 » = `?visual=cartoon-v29` au commit `aca65c3`, servi depuis un arbre de travail séparé. « V2.9.1 » = `?visual=cartoon-v291`. Les cadrages sont identiques, à coordonnées fixes : la vue « mairie » vise un point fixe entre l'ancienne et la nouvelle ancre, pour ne pas avantager la V2.9.1. Les vues respectent la limite de zoom V2.7.1 (≥ 420 m, site ≥ 25°).

- `art/` : 16 cadrages BEAUTÉ 1280 × 800 : vue générale, oblique, centre-bourg, Poussey, Les Granges, La Glacière, champs, bois, rivière, zone pavillonnaire, église, châteaux d'eau de Poussey et des Granges, gare et rail, mairie, silos. Fichiers `v29-*`, `v291-*` et planches `compare-*` (V2.9 à gauche, V2.9.1 à droite). `hd-*` : 1920 × 1080, même cadrage, V2.9 et V2.9.1.
- `landmarks/` : pour les 16 landmarks, la planche orthophoto IGN 2025 (`ortho-NN-*` : association validée en vert, association V2.9 en rouge quand elle change, ancres) et le rendu V2.9.1 (`v291-NN-*`). La table d'audit est dans le rapport, section 5, et dans `src/content/landmark-audit-v291.json`.
- `mairie/` : diagnostic sur orthophoto (candidats, point BAN « segment », point OSM `townhall`, zone BD TOPO), associations V2.9 / V2.9.1, puis pour chaque version : vue du centre avec l'étiquette, clic sur le vrai bâtiment de la mairie, clic sur l'ancienne annexe, clic sur la caserne, recherche et fiche rapide, fiche « Détails ».
- `mobile/` : 390 × 844 et 844 × 390, PERFORMANCE : sept cadrages V2.9 / V2.9.1 avec touchers, et la mairie touchée en V2.9.1.
- `cards/` : fiches V2.9.1 (église, monument, mairie, Poussey, route, bâtiment) sur desktop, portrait et paysage, et test de clic `ux-*`.

Orthophoto : BD ORTHO IGN 0,5 m, prise de vue 2025, Licence Ouverte Etalab 2.0. Elle sert ici de preuve d'audit, jamais d'asset de rendu.
