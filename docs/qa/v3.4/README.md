# QA V3.4 — cadastre réel, parcelles et fidélité des terrains

Mode `?visual=premium-v34` (V3.4) comparé à `?visual=premium-v33` (V3.3.1, base `4e6f386`). Diagnostic technique `?diagnostic=cadastre-v34` (avec `&v33=1` : terrains V3.3 en cyan). Chromium headless, SwiftShader, JPEG uniquement. Rapport : `docs/audit/V3.4_CADASTRE_REEL_PARCELLES.md`.

| Dossier | Contenu |
|---|---|
| `cadastre/` | 13 cas sensibles. Chaque planche montre quatre vues, les trois dernières sous la même caméra : **référence** (plan PCI brut et empreintes gelées, vue zénithale, nord en haut, dessiné directement depuis les pages WFS), **V3.3.1**, **diagnostic V3.4**, **rendu premium V3.4**. Cas : centre-bourg, Poussey, Les Granges, rues pavillonnaires, maison en L / T / U, frange village / champ, parcelle à plusieurs bâtiments, bâtiment à cheval, parcelle agricole près d’une maison, mairie – école – CPI, Salle polyvalente et Maison des associations, ferme, La Glacière |
| `compare/` | les dix cadrages de référence, V3.3.1 à gauche, V3.4 à droite, BEAUTÉ, 1280 × 800 |
| `details/` | les mêmes cadrages, sauf la vue générale, recadrés et agrandis 2× |
| `mobile/` | 390 × 844 et 844 × 390, PERFORMANCE, DPR 2 : centre, Poussey, zone pavillonnaire, V3.3.1 / V3.4 ; panneau Informations V3.4 sur téléphone |
| `presets/` | V3.4 en BEAUTÉ, ÉQUILIBRÉ et PERFORMANCE côte à côte, zone pavillonnaire et Poussey, 420 m |

Les cadrages de village sont pris à la distance minimale de la caméra (420 m) ; La Glacière et la zone d’activité à 520 m, la vue générale à 2 200 m. Les cas sensibles sont choisis de façon reproductible dans le registre. Par exemple, la parcelle à plusieurs bâtiments est la parcelle d’habitation qui en porte le plus, et le bâtiment à cheval est la maison à cheval la plus proche du centre.

En BEAUTÉ, le trait des limites paraît un peu plus doux qu’en ÉQUILIBRÉ et en PERFORMANCE : c’est l’effet du rendu en double résolution et du léger flou de bascule propres à ce preset. Une capture prise après 20 s d’attente ne diffère que de 0,34 % des pixels de celle prise après 3 s.
