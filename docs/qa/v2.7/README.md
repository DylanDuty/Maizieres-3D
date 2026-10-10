# QA visuelle V2.7 — généralisation du diorama dessin animé à toute Maizières

Captures directes du renderer (Chromium headless, rastérisation logicielle SwiftShader), sans retouche. Mode `?visual=cartoon-v27`.

- `art/` : BEAUTÉ, cadrages fixes : vue générale, oblique générale, centre-bourg, Poussey, Les Granges, La Glacière, secteur gare et rail, champs, bois, ruisseau des Moulins de Poussey, rue du centre en vue basse ; plus les trois presets sur la vue oblique et `diorama=1`.
- `landmarks/` : une vue par landmark (16), centrée sur le POI ou sur les empreintes des bâtiments liés.
- `ux/` : desktop 1280 × 800 : route sélectionnée (rue Joliot-Curie), bâtiment résidentiel, bâtiment industriel (La Glacière), POI (château d'eau de Poussey), landmark (église Saint-Denis), étiquette rapide, fiche détaillée.
- `mobile/` : 390 × 844 et 844 × 390 : route, bâtiment, carte rapide compacte, fiche détaillée, POI.
- `compare/` : V2.4 (défaut) / V2.7 sur les mêmes cadrages de secteur.

| Cadrage | Centre (x, z) | Distance | Azimut | Site |
|---|---|---|---|---|
| Vue générale | 200, 150 | 4 200 m | 20° | 52° |
| Oblique générale | 0, 300 | 2 200 m | 25° | 40° |
| Centre-bourg | −140, 60 | 560 m | 25° | 38° |
| Poussey | 1300, −250 | 430 m | 22° | 40° |
| Les Granges | POI `poi:les-granges` | 620 m | 20° | 40° |
| La Glacière | POI `poi:glaciere` | 760 m | 30° | 38° |
| Gare et rail | centre des voies de service | 900 m | 110° | 36° |
| Champs | −1500, 1800 | 1 200 m | 40° | 42° |
| Bois (forêt fermée de feuillus, 60 ha) | −1287, −201 | 900 m | 160° | 38° |
| Ruisseau | 1320, −395 | 170 m | 15° | 24° |
| Rue du centre | −140, 60 | 180 m | 120° | 18° |

`HUMAN_ART_DIRECTION_APPROVED = true` (direction V2.6.1 validée pour généralisation). `V2_7_FULL_CARTOON_READY` : voir le rapport.
