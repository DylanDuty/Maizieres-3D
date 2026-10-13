# QA V3.3 — parcelles, jardins et micro-paysage

Mode `?visual=premium-v33` (V3.3) comparé à `?visual=premium-v32` (V3.2, base `4428344`). Chromium headless, SwiftShader, JPEG uniquement. Rapport : `docs/audit/V3.3_PARCEL_MICROLANDSCAPE.md`.

| Dossier | Contenu |
|---|---|
| `compare/` | dix cadrages, V3.2 à gauche, V3.3 à droite, BEAUTÉ, 1280 × 800 : vue générale, centre-bourg, Poussey, Les Granges, La Glacière, frange village / champ, zoom résidentiel, bâtiment public (mairie, salle, monument), zone d'activité, bâti ancien |
| `details/` | les mêmes cadrages recadrés et agrandis 2× (sauf la vue générale), pour juger les limites, les cours et les allées sans pixellisation |
| `mobile/` | 390 × 844 et 844 × 390, PERFORMANCE, DPR 2 : centre, Poussey, zone pavillonnaire, V3.2 à gauche, V3.3 à droite ; `informations-v33.jpg` : panneau Informations sur téléphone, avec la phrase propre au mode V3.3 sur les terrains déduits |
| `presets/` | V3.3 en BEAUTÉ, ÉQUILIBRÉ et PERFORMANCE côte à côte, zone pavillonnaire et Poussey, 420 m |

Les cadrages de village sont pris à la distance minimale de la caméra (420 m) ; La Glacière et la zone d'activité à 520 m, la vue générale à 2 200 m. Les captures émulent `prefers-reduced-motion: reduce` : en SwiftShader une image prend plusieurs secondes, et les fondus de l'interface seraient sinon saisis en cours.

Les parcelles sont une **interprétation** : la commune n'a pas de cadastre parcellaire dans les sources du projet (`data-sources/cadastre` ne contient que le bâti). Leur tracé suit des règles déterministes décrites au § 4 du rapport, et la carte reste présentée comme non contractuelle.
