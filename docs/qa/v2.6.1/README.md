# QA visuelle V2.6.1 — finalisation artistique Poussey et interface au clic

Captures directes du renderer (Chromium headless, rastérisation logicielle SwiftShader), sans retouche. Le point sélectionné reste visible sur toutes les captures de clic.

- `compare/ux-*` : V2.6 (`9369e66`, gauche) / V2.6.1 (droite), même cadrage, après un clic sur une route (rue Joliot-Curie), un bâtiment et le POI « Château d'eau de Poussey », sur desktop 1280 × 800 et sur smartphone 390 × 844. Preset PERFORMANCE (le clic ne dépend pas du preset).
- `compare/art-*` : V2.6 / V2.6.1 en BEAUTÉ, même cadrage : vue générale, oblique, maisons (jardins), vis-A (grands bâtiments), ruisseau, vue basse.
- `v261/` : captures V2.6.1 BEAUTÉ des dix cadrages de la V2.6 (`docs/qa/v2.6-poussey/README.md` pour les paramètres), plus `diorama-oblique` et `diorama-houses` (`?diorama=1`).
- `ux/` : V2.6.1 desktop : route sélectionnée, bâtiment sélectionné, fiche rapide (bâtiment), fiche détaillée (bâtiment et route), POI sélectionné.
- `mobile/` : V2.6.1 smartphone portrait et paysage : route sélectionnée, bâtiment sélectionné, carte rapide compacte, fiche détaillée ouverte volontairement, POI.

`HUMAN_ART_DIRECTION_APPROVED = false`
