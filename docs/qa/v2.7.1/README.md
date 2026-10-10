# QA visuelle V2.7.1 — zoom maximal et audit du rendu

Captures directes du renderer (Chromium headless, rastérisation logicielle SwiftShader), sans retouche, mode `?visual=cartoon-v27`. Toutes les vues sont prises sous les nouvelles limites de caméra (distance ≥ 420 m, site ≥ 25°), donc telles qu'un utilisateur peut les atteindre.

- `eglise/` : église Saint-Denis avant / après correction, six angles (azimuts 20°, 110°, 200°, 290°, vue basse 25°, vue plongeante 80°) à 420 m, BEAUTÉ.
- `zoom/` : capture de référence fournie par l'utilisateur (réduite) et le même cadrage rendu à la distance minimale de 420 m (390 × 844), pour comparer le niveau de zoom.
- `audit/` : BEAUTÉ desktop 1280 × 800 : vue oblique générale, centre-bourg (nord et vue basse), Poussey, Les Granges, La Glacière (avant / après réparation du bandeau des toits plats), rail, ruisseau et haies, rue résidentielle, bois, mairie, école, monument aux morts, châteaux d'eau, salle polyvalente, stade, silos.
- `mobile/` : 390 × 844 et 844 × 390 : centre-bourg avec l'église touchée, Poussey, château d'eau de Poussey touché, La Glacière, monument aux morts, Les Granges, ruisseau.
- `ux/` : test de clic (route, bâtiment, fiche Détails, POI, industriel, landmark par recherche) sur desktop, téléphone portrait et paysage.

| Cadrage | Centre (x, z) | Distance | Azimut | Site |
|---|---|---|---|---|
| Oblique générale | 0, 300 | 2 200 m | 25° | 40° |
| Centre-bourg nord | POI `poi:eglise-saint-denis` | 420 m | 200° | 40° |
| Centre-bourg vue basse | POI `poi:eglise-saint-denis` | 420 m | 20° | 26° |
| Poussey | 1300, −250 | 450 m | 22° | 40° |
| Les Granges | POI `poi:les-granges` | 450 m | 20° | 40° |
| La Glacière | POI `poi:glaciere` | 520 m | 30° | 38° |
| La Glacière vue basse | POI `poi:glaciere` | 420 m | 300° | 27° |
| Gare et rail | centre des voies | 600 m | 110° | 36° |
| Ruisseau | 1320, −395 | 420 m | 15° | 28° |
| Rue résidentielle | −140, 60 | 420 m | 120° | 30° |
| Bois | −1287, −201 | 900 m | 160° | 38° |
| Landmarks | POI | 420 m | 30° | 36° |
