# QA V3.2 — interface

1280 × 800, `?visual=premium-v32`, sauf mention. Animations figées par `prefers-reduced-motion` pour la capture (voir `../README.md`).

| Fichier | État |
|---|---|
| `v32-01-ecran-sans-panneau.jpg` | mode immersif : marque discrète, recherche, barre basse à trois entrées, boussole, mention, crédits |
| `v32-02-selecteur-qualite.jpg` | sélecteur ouvert : trois choix visibles en même temps, actif coché |
| `v32-03-explorer.jpg` | Explorer : vues rapides, noms des lieux (interrupteur), légende repliable |
| `v32-04-informations.jpg` | panneau « À propos de la carte » |
| `v32-05-recherche-resultats.jpg` | recherche saisie (« mairie ») et résultat |
| `v32-06-fiche-lieu.jpg` | fiche rapide après sélection |
| `v32-07-fiche-details.jpg` | fiche détaillée (panneau latéral droit) |
| `v32-08-*-actif.jpg` | écran avec le mode actif dans la barre : Beauté, Équilibré, Performance |
| `v32-09-selecteur-*.jpg` | sélecteur ouvert dans chacun des trois modes |
| `v32-10-mention-basse.jpg` | bas d'écran agrandi 2× : mention et crédits |
| `avant-apres-*.jpg` | V3.1 à gauche, V3.2 à droite : écran, recherche, fiche, détails, mobile portrait, mobile paysage |

Test fonctionnel (Chromium, trois gabarits) : un clic sur Qualité ouvre le sélecteur ; un clic sur Beauté, Équilibré ou Performance recharge la carte dans ce mode au même endroit (`?cam=`) et ferme le sélecteur ; le mode actif est coché et affiché dans la barre ; reprendre le mode actif ferme sans recharger ; le retour arrière du navigateur rend le mode précédent. Aucun bouton cyclique ne subsiste en V3.2.
