# V3.4.2 — vérification sur un vrai téléphone Android

L’émulation Chromium (390 × 844 et 844 × 390, tactile, DPR 2) a été utilisée pour toute la QA. Ce qui suit ne peut se vérifier que sur l’appareil.

| # | Geste / action | Attendu | OK ? |
|---|---|---|---|
| 1 | Ouvrir la carte (lien d’essai), attendre la fin de « Découvrir Maizières » | carte affichée, barre premium, aucun ancien bouton | ☐ |
| 2 | Toucher une maison du centre-bourg | barre basse : « Adresse » puis numéro et voie ; la maison reste visible au-dessus de la barre | ☐ |
| 3 | Toucher une maison voisine | la barre change d’adresse, sans ouvrir de fiche « Détails » | ☐ |
| 4 | Toucher une maison des lotissements (place Léopoldine-Deschamps, rue des Sages) | « Plusieurs adresses » et la liste lisible sous le titre | ☐ |
| 5 | Toucher une maison sans adresse sûre | « Adresse à confirmer » ou « Adresse non renseignée », jamais un numéro | ☐ |
| 6 | Toucher la mairie, l’école, la Salle polyvalente, l’église | leur fiche habituelle (nom, catégorie, Détails), pas une adresse de maison | ☐ |
| 7 | Toucher une rue à côté d’une maison | nom de la rue, pas l’adresse de la maison | ☐ |
| 8 | Glisser un doigt, tourner à deux doigts, pincer | la carte bouge ; aucun faux clic ne sélectionne une maison | ☐ |
| 9 | Fermer par la croix, puis toucher le fond | la sélection se ferme ; un toucher sur le fond n’ouvre pas la maison voisine | ☐ |
| 10 | Sélectionner une maison, puis Qualité → Performance | écran « Passage en mode Performance », puis la même maison sélectionnée avec son adresse | ☐ |
| 11 | Tourner le téléphone en paysage avec une adresse affichée | barre basse lisible, ni coupée, ni sous la barre système | ☐ |
| 12 | Retour Android pendant / après un changement de qualité | aucun écran resté par-dessus la carte | ☐ |

Noter le modèle, la version d’Android et le navigateur.
