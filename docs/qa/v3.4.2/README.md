# QA V3.4.2 — adresses au clic, rues, préparation « Notre Village »

**Conditions.** Chromium headless, rendu logiciel SwiftShader. Clics réels (souris ou tactile) au centre de la carte, la caméra étant placée au-dessus d’un point intérieur du bâtiment visé. Échantillon tiré des registres. Captures en « mouvement réduit » : sous rendu logiciel, l’entrée animée du cartouche (0,18 s) ne démarre pas. Rapport : `docs/audit/V3.4.2_ADRESSES_BATIMENTS_ET_RUES.md`.

| Dossier | Contenu |
|---|---|
| `addresses/` | avant (V3.4.1 : maison → fiche générique et Détails techniques) / après (adresse vérifiée, plusieurs adresses, à confirmer, non renseignée, dépendance) ; mairie inchangée ; rue voisine d’une maison ; `clicks-*.json` : les 55 clics et leur comparaison au registre |
| `roads/` | synthèse de l’audit routier (`roads-audit-summary.md`) ; le détail par voie est dans `docs/audit/V3.4.2_ROADS_SPATIAL_AUDIT.csv` |
| `mobile/` | 390 × 844 et 844 × 390, même caméra ; restauration de la sélection et de l’adresse après un changement de qualité ; `CHECKLIST_ANDROID.md` (vérification manuelle sur l’appareil) |
| `integration-readiness/` | état de préparation « Notre Village → Carte du village » |
