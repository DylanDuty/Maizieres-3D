# QA V3.0 — interface (clics, fiches, recherche, vues rapides, zoom)

Chromium headless, SwiftShader, `?visual=premium-v30&v25quality=performance`, sur trois gabarits : bureau 1280 × 800, téléphone portrait 390 × 844 et paysage 844 × 390 (écran tactile émulé). Résultats détaillés : `v30-interface.json`.

| Scénario | Bureau | Portrait | Paysage |
|---|---|---|---|
| Clic sur la rue Joliot-Curie | étiquette « Route D 20 · Rue Joliot-Curie » | idem | idem |
| Clic sur un bâtiment, puis « Détails » | fiche « Maison », panneau ouvert | idem (feuille basse) | idem |
| Échap, puis Échap | panneau fermé, puis sélection effacée | idem | idem |
| Clic sur l'étiquette du château d'eau | « Château d'eau de Poussey » | idem | idem |
| Clic dans le vide | sélection effacée | idem | idem |
| Rue, puis « Détails » | panneau « Rue Joliot-Curie » | idem | idem |
| Vue rapide La Glacière, clic sur un hall | « Bâtiment industriel » | idem | idem |
| Église Saint-Denis, puis « Détails » | panneau « Église Saint-Denis » | idem | idem |
| Recherche tapée « Salle polyvalente », Entrée | fiche Salle polyvalente (3 rue des Écoles) | idem | idem |
| Recherche tapée « Rue Pasteur », ↓, Entrée | fiche Rue Pasteur (D 20) | idem | idem |
| Vues rapides centre-bourg, Poussey, Les Granges, La Glacière | `view-*.jpg` | idem | idem |
| Molette au maximum sur le centre | `zoom-max.jpg` | idem | idem |
| Console | vide | vide | vide |

**Recherche : défaut corrigé.** Choisir un résultat avec la touche Entrée levait `TypeError: Cannot read properties of undefined (reading '0')` dans `selection.select`, et aucune fiche ne s'ouvrait. Ce défaut existait au moins depuis la V2.9.1 et touche aussi la V2.9.2 (`v292-recherche-zoom.json`) ; le clic sur un résultat, lui, fonctionnait. Cause : l'index de recherche renvoie des entrées `{r, k}` et la touche Entrée transmettait l'entrée au lieu de l'enregistrement `r`. Corrigé dans `src/v2-ui.js` (une ligne), hors des fichiers du gel sémantique.

**Zoom maximal.** La limite de 420 m est souple depuis la V2.7.1 : la caméra peut descendre jusqu'à 302 m sous le doigt, puis revient de 16 % par image. Sous SwiftShader (environ 2 s par image), la distance relevée 2,5 s après la molette est donc transitoire (337 à 361 m). Mesurée après une longue attente, elle remonte à 416–418 m en 60 s et tend vers 420 m, exactement comme en V2.9.2 (`v292-recherche-zoom.json` : 321 → 405 → 418 m ; V3.0 : 321 → 399 → 416 m).
