# QA V3.4.1 — écran de chargement et changement de qualité

Chromium headless, rendu logiciel SwiftShader. Formats :

- téléphone 390 × 844 et 844 × 390, DPR 2, tactile ;
- bureau 1280 × 800 et 1920 × 1080.

**Comment les transitions sont photographiées.** Les écrans sont pris **pendant** la transition :

- le test retarde les requêtes `data/` (2,5 à 24 s selon le scénario), et seulement lui ;
- pour la capture « même page », le test retient le rechargement le temps de la photographier, puis le relâche.

Rien de ce ralentissement n’est livré. Les mesures brutes, échantillonnées toutes les 40 ms, sont dans `mesures/`. Le rapport est `docs/audit/V3.4.1_PREMIUM_LOADING_TRANSITION.md`.

| Fichier | Contenu |
|---|---|
| `01-v34-ancien-loader-mobile.png` | V3.4, premier chargement : cadre blanc, spinner, « Qualité : Fluide », « Noms des lieux », pied de page souris |
| `01b-v34-avant-premier-frame.png` | V3.4 à `DOMContentLoaded` |
| `01c-v34-changement-qualite-mobile.png` | V3.4, nouvelle page après un changement de qualité |
| `02-v341-premier-chargement-mobile.png` | V3.4.1, première ouverture : « Découvrir Maizières » |
| `03a-v341-clic-beaute-meme-page-mobile-immediat.png` | dans la page, 150 ms après le clic : voile sur la carte vivante |
| `03a-v341-clic-beaute-meme-page-mobile.png` | dans la page, image de fond prise |
| `03-v341-changement-vers-beaute-mobile.png` | nouvelle page, premier rendu : même écran, même image |
| `04-v341-changement-vers-equilibre-mobile.png` | vers Équilibré |
| `05-v341-changement-vers-performance-mobile.png` | vers Performance |
| `06-v341-chargement-lent-mobile.png` | message de lenteur (après 20 s) |
| `07-v341-erreur-mobile.png` | ressource manquante : « Impossible de préparer la carte. » et Réessayer |
| `07b-v341-contexte-webgl-perdu.jpg` | contexte WebGL perdu après chargement |
| `07c-v341-sans-webgl.jpg` | WebGL désactivé |
| `08-v341-retour-carte-mobile.png` | la carte après la première ouverture |
| `08b-v341-carte-apres-changement-mobile.jpg` | la carte après trois changements, même cadrage |
| `09-v341-landscape.png` | 844 × 390, changement de qualité |
| `09a-v341-landscape-premier-chargement.png` | 844 × 390, première ouverture |
| `09b-v341-landscape-carte.jpg` | 844 × 390, la carte |
| `09c-v341-rotation-pendant-transition.png` | portrait → paysage pendant la transition |
| `10-v341-desktop-1280.png`, `10-v341-desktop-1920.png` | bureau, changement de qualité |
| `10a-…`, `10b-…` | bureau, première ouverture et carte |
| `11-v341-avant-premier-frame.png` | V3.4.1 à `DOMContentLoaded`, avant toute donnée ni scène : ni ancienne barre, ni « Fluide » |
| `12-v341-reduced-motion.png` | `prefers-reduced-motion: reduce` : ligne fixe, pulsation d’opacité |
| `12b-v341-reduced-motion-carte.jpg` | la carte dans ce mode |

Aucun navigateur mobile réel n’était disponible : tout est mesuré en émulation.
