# QA V3.1 — interface (clics, fiches, recherche, vues rapides, zoom)

Chromium headless, SwiftShader, `?visual=premium-v31&v25quality=performance` (FXAA par défaut), bureau 1280 × 800, téléphone portrait 390 × 844 et paysage 844 × 390 (écran tactile émulé). Résultats détaillés : `v31-interface.json`.

| Scénario | Bureau | Portrait | Paysage |
|---|---|---|---|
| Clic sur la rue Joliot-Curie | « Route D 20 · Rue Joliot-Curie » | idem | idem |
| Clic sur un bâtiment, puis « Détails » | fiche « Maison », panneau ouvert | idem (feuille basse) | idem |
| Échap, puis Échap | panneau fermé, puis sélection effacée | idem | idem |
| Clic sur l'étiquette du château d'eau | « Château d'eau de Poussey » | idem | idem |
| Clic dans le vide | sélection effacée | idem | idem |
| Rue, puis « Détails » | panneau « Rue Joliot-Curie » | idem | idem |
| Vue rapide La Glacière, clic sur un hall | « Bâtiment industriel » | idem | idem |
| Église Saint-Denis, puis « Détails » | panneau « Église Saint-Denis » | idem | idem |
| Recherche « Salle polyvalente », Entrée | fiche Salle polyvalente | idem | idem |
| Recherche « Rue Pasteur », ↓, Entrée | fiche Rue Pasteur | idem | idem |
| Vues rapides centre-bourg, Poussey, Les Granges, La Glacière | `view-*.jpg` | idem | idem |
| Molette au maximum sur le centre | `zoom-max.jpg` (transitoire, voir ci-dessous) | idem | idem |
| Console | vide | vide | vide |

Zoom maximal : la limite souple de 420 m (V2.7.1) est inchangée. Sous SwiftShader, la distance lue 2,5 s après la molette est transitoire (337 à 361 m) ; après une longue attente, elle revient vers 420 m comme en V3.0 et V2.9.2 (voir le rapport, § 12).
