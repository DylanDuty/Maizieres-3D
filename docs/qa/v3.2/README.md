# QA V3.2 — villages premium et interface

Mode `?visual=premium-v32` (V3.2) comparé à `?visual=premium-v31` (V3.1, base `119ada9`). Chromium headless, SwiftShader, JPEG uniquement. Rapport : `docs/audit/V3.2_PREMIUM_VILLAGE_INTERFACE_EXPERIENCE.md`.

| Dossier | Contenu |
|---|---|
| `compare/` | les 10 cadrages de référence de la V3.1, V3.1 à gauche, V3.2 à droite, BEAUTÉ, 1280 × 800 |
| `architecture/` | vue générale, centre, Poussey, Les Granges, zone pavillonnaire, fermes, bâtiments anciens, La Glacière ; détails agrandis 2× |
| `poussey/` | quatre cadrages du hameau (quatre azimuts), 420 m |
| `centre/` | quatre cadrages du centre-bourg (église, mairie), 420 m |
| `les-granges/` | quatre cadrages de Les Granges, 420 m |
| `interface/` | états de l'interface V3.2 (écran, sélecteur Qualité, Explorer, Informations, recherche, fiche, modes actifs, mention) et planches avant / après V3.1 |
| `mobile/` | 390 × 844 et 844 × 390, PERFORMANCE : V3.2 (écran, qualité, explorer, informations, recherche, fiche, détails) et V3.1 |
| `hd/` | 1920 × 1080, BEAUTÉ, V3.1 et V3.2 |

Toutes les vues sont prises à la distance minimale de la caméra (420 m) sauf la vue générale et l'oblique. Les captures d'interface émulent `prefers-reduced-motion: reduce` : en SwiftShader une image prend plusieurs secondes, et les fondus de 160 à 220 ms seraient sinon saisis en cours.
