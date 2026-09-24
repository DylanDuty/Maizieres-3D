# Vérification V1.6.1 — validation officielle, 24 septembre 2026

## Accès

`data.geopf.fr` et `rnb-api.beta.gouv.fr` : accessibles. `cadastre.data.gouv.fr` : accessible par intermittence, mais le fichier Etalab est servi par `cadastre.s3.rbx.io.cloud.ovh.net`, **refusé (403)**. Le cadastre actuel utilisé est donc le Parcellaire Express (PCI DGFiP) de la Géoplateforme IGN.

## V1.6 provisoire → V1.6.1 officielle

| Indicateur | V1.6 provisoire | V1.6.1 officielle |
|---|---:|---:|
| Bâtiments affichés | 2 491 | **2 543** |
| Dans la commune | 2 259 | **2 299** |
| Référence cadastrale | OSM 2013–2018 (substitut) | PCI Express actuel : 2 070 dans la zone, 1 844 dans la commune |
| Ajoutés depuis le cadastre actuel | 0 | 77 (58 dans la commune ; 2 avec RNB actif) |
| Jumeaux décalés cadastre ↔ référentiel (ni ajoutés, ni supprimés) | — | 25 |
| Supprimés (absents BD TOPO + cadastre actuel + RNB) | 0 | 25 (18 dans la commune), journalisés |
| Géométries corrigées | 0 | 0 |
| Listes RNB corrigées | 0 | 268 |
| Changements de classe documentés | — | 335 (C→B 119, B→A 104, A→B 112) |
| Confiance A / B / C | 1 992 / 337 / 162 | **1 984 / 466 / 93** |
| Dans la commune A / B / C | 1 853 / 275 / 131 | 1 849 / 384 / 66 |
| Incertains (C + contours différents) | 128 | 237 (179 dans la commune) : 93 C et 144 B à contour différent du cadastre |

## RNB vérifié par l’API

| Mesure | Valeur |
|---|---:|
| Identifiants vérifiés | 2 316 (2 027 valides, 158 inactifs, 130 spatialement incohérents, 1 démoli) |
| Identifiants ajoutés par lien exact RNB → BD TOPO | 22 |
| Bâtiments avec au moins un RNB valide | 2 016 / 2 543 (79,3 %) |
| Dans la commune | 1 839 / 2 299 (80,0 %) |
| Bâtiments à plusieurs RNB valides | 32 (49 avant vérification) |
| Bâtiments RNB actifs de la commune hors de toute empreinte | 19 |

Le taux RNB baisse par rapport à la V1.6 (2 260 identifiants fournis par l’IGN), car les identifiants retirés ou attribués à un voisin sont maintenant écartés.

## Contrôles

- `npm run check:all` réussit (six contrôles).
- `check:buildings` : les 2 329 bâtiments IGN sont toujours présents avec leur géométrie d’origine. Chaque OSM seul absent est justifié dans le journal de suppression. Aucun ajout cadastral ne recouvre à plus de 10 % un bâtiment existant. Le fichier est complet pour un import sans Three.js.
- `pnpm build` réussi. Build servi dans Chromium : **2 543 bâtiments générés, exactement le nombre du référentiel**, aucun rejet, 18 appels de dessin, 562 823 triangles. `?diagnostic=validation` affiche A 1 984, B 320, B à contour différent 144, C OSM 18, ajouts cadastraux 77. **Console sans erreur ni avertissement.**

## Secteurs restant douteux

- Classes C et contours différents :
  - avenue du Général-de-Gaulle (14) ;
  - rue de la Chefferie (14) ;
  - rue Joliot-Curie (12) ;
  - rue du Général-Leclerc (8) ;
  - rue Jean-Monnet (7) ;
  - 6 chacun : rues Georges-Clemenceau, Achille-Flaubert, de l’Essy, Jules-Ferry, du Stade, des Lombards, Basse-de-Poussey.
- Chemin La Fin de Maizière : l’extension de l’abri n’est qu’en partie cadastrée (54 m² sur 554).
- 19 bâtiments RNB sans empreinte : `rnbOnly` dans `data-sources/building-validation.json`.

---

# Vérification V1.6 — validation du bâti, 24 septembre 2026

Branche `opus/v1.6-building-validation`. Rapport complet : `data-sources/building-validation.json`.

## Réponse à la question « avons-nous toutes les constructions connues des référentiels publics ? »

**Pas encore démontrable** : le cadastre Etalab actuel et l’API RNB sont restés inaccessibles (403 réseau). Avec les sources disponibles localement :

| Indicateur | Zone affichée | Commune |
|---|---:|---:|
| Total IGN BD TOPO | 2 329 | 2 128 |
| Total OSM | 2 022 | 1 817 |
| Total cadastre de référence (DGFiP 2013–2018 importé dans OSM, substitut) | 1 981 | 1 777 |
| Cadastre de référence présent dans le référentiel (couverture ≥ 50 %) | 1 728 | — |
| Cadastre de référence absent du référentiel | 0 | 0 |
| Bâtiments avec identifiant RNB (fourni par l’IGN, non vérifié) | 2 260 (90,7 %) | 2 080 (92,1 %) |
| **Total du référentiel final** | **2 491** | **2 259** |
| Ajoutés grâce au cadastre | 0 (cadastre actuel non accessible) | 0 |
| Supprimés après preuve de disparition ou d’erreur | 0 | 0 |
| Géométries corrigées | 0 | 0 |
| Litigieux : OSM seuls | 101 | 83 |
| Litigieux : contours partiels > 25 m² ou tracé récent | 27 | 21 |
| Sans correspondance : IGN absents du cadastre de référence | 200 | 173 |
| Sans correspondance : OSM absents de la BD TOPO | 162 | 131 |
| Différences géométriques non résolues | 96 empreintes, 3 027 m² non couverts (26 > 25 m²) | — |
| Confiance A / B / C | 1 992 / 337 / 162 | 1 853 / 275 / 131 |
| Bâtiments récents probables : IGN seuls saisis depuis 2019 / apparition fichiers fonciers ≥ 2015 | 49 / 6 | — |

Lecture :
- Tout le cadastre 2013–2018 disponible localement est dans le référentiel : aucun bâtiment cadastral n’y manque.
- Les incertitudes restantes vont dans l’autre sens : des constructions du cadastre ancien absentes de la BD TOPO récente (démolies ou omises) et des contours divergents.
- Les 173 bâtiments IGN absents du cadastre de 2018 (commune) sont probablement plus récents (82 d’origine cadastrale à l’IGN) ou non cadastrés.
- Seul le cadastre actuel pourra le confirmer.

## Contrôles et navigateur

`npm run check:all` réussit (six contrôles). `check:buildings` vérifie en plus, pour les 2 491 bâtiments et sans Three.js :
- géométrie Polygon/MultiPolygon, identifiant stable, source, provenance ;
- bloc de validation complet (confiance, statut, preuves) ;
- attributs IGN et hauteurs dérivées pour les bâtiments IGN ;
- métadonnées de projection et de validation.

Aucune géométrie IGN modifiée.

`pnpm build` réussi. Build servi dans Chromium : la carte affiche 2 491 bâtiments (18 appels de dessin, 560 099 triangles, comme en V1.5). Les modes `?diagnostic=provenance` et `?diagnostic=validation` fonctionnent avec leur légende. Fiche, modes Fluide et Élevée, noms, format portrait, clavier et Échap vérifiés. **Console sans erreur ni avertissement.**

## Secteurs restant à vérifier

- Vers la rue de l’Essy : trois bâtiments du cadastre 2018 (218 à 351 m²), isolés, absents de la BD TOPO ;
- Poussey : rue Joliot-Curie (sept cas litigieux, dont un abri de 336 m²), rue du Château, rue du Lavoir ;
- Avenue du Général-de-Gaulle (dix cas), rue Georges-Clemenceau (six) et rue de la Chefferie (six) : contours divergents et abris légers ;
- Chemin La Fin de Maizière : abri de 716 m², dont 554 m² absents de la BD TOPO ;
- Rue du Docteur-Sollier, rue des Baudets, rue Maurice-Renault, rue de l’Orme : cas isolés.

---

# Vérification V1.5 — exhaustivité du bâti, 24 septembre 2026

Branche `opus/v1.5-buildings`, partie de `opus/v1.4`. Source de vérité des bâtiments : `public/data/buildings.geojson` (voir `docs/referentiel-bati.md`).

## Couverture par source (commune = centre d’emprise dans le contour communal)

| Mesure | Commune | Zone affichée (commune + 150 m) |
|---|---:|---:|
| Bâtiments OSM (instantané du 31/05/2026) | 1 817 | 2 022 |
| Bâtiments IGN BD TOPO (instantané du 10/09/2026) | 2 128 | 2 329 |
| Bâtiments cadastre | non disponible (réseau refusé) | — |
| Correspondances OSM ↔ IGN un pour un (IoU ≥ 50 %) | 754 | 799 |
| IGN couverts ≥ 50 % par OSM | 1 900 | 2 044 |
| IGN couverts 10–50 % par OSM | 94 | 125 |
| **IGN sans équivalent OSM** (< 10 %) | **134** (10 560 m²) | 160 |
| OSM couverts ≥ 50 % par IGN | 1 606 | 1 764 |
| OSM couverts 10–50 % par IGN | 80 | 96 |
| **OSM sans équivalent IGN** (< 10 %) | **131** (3 975 m²) | 162 |
| Un OSM recouvrant plusieurs IGN (mitoyens dessinés d’un bloc) | 236 | 245 |
| Un IGN recouvrant plusieurs OSM | 72 | 81 |

## Avant / après

| Étape | V1.4 | V1.5 |
|---|---:|---:|
| Bâtiments rendus, zone affichée | 1 968 | **2 491** |
| Bâtiments rendus, commune | 1 793 | **2 259** |
| Après fusion (référentiel) | — | 2 491 = 2 329 IGN + 162 OSM seuls |
| Rejetés au traitement | 54, non comptés | 0 |
| Rejetés au rendu | 0 | 0 |
| Géométries invalides | non contrôlé | 0 |

Rejets V1.4 (reconstitués par `npm run audit:buildings`) :
- 23 empreintes OSM de moins de 3 m² (filtre de surface). En V1.5, 12 sont représentées par un bâtiment IGN, 6 sont gardées comme bâtiments OSM seuls, et 5 ne sont pas reprises : ce sont des fragments recouverts à 10–50 % par un bâtiment IGN ;
- 31 contours ronds ou très finement dessinés (silos, cuves), écartés par le calcul d’axe de toit. 30 sont hors commune, dans la zone de contexte ; 13 sont représentés par l’IGN, 1 gardé côté OSM, 17 recouverts partiellement par l’IGN.

Ce qui n’entre pas dans le référentiel, sans être rejeté :
- 160 bâtiments IGN dont le centre est hors de la zone affichée ;
- 1 860 empreintes OSM déjà représentées par l’IGN : 1 764 à au moins 50 %, 96 à 10–50 %.

Référentiel V1.5 : 2 260 identifiants RNB, 1 829 hauteurs IGN utilisables, 2 027 bâtiments IGN enrichis par la sémantique OSM, 4 repères IGN rattachés. Aucun bâtiment en plusieurs parties, 1 anneau intérieur.

## Contrôles

`npm run check:all` réussit (six contrôles : `check`, `check:enrichment`, `check:presentation`, `check:interaction`, `check:bible` et le nouveau `check:buildings`).

- `check:buildings` : les 2 329 bâtiments IGN de la zone sont présents une seule fois, avec leur géométrie d’origine octet pour octet. Les 162 OSM seuls sont présents, sans doublon sur un bâtiment IGN. Les SHA-256 des sources correspondent.
- `check:enrichment` : 2 491 bâtiments rendus sur 2 491, 0 rejet ; les SHA-256 des fichiers OSM et contour communal sont inchangés.
- `check:interaction` : église retrouvée par lancer de rayon, 2 465 bâtiments sans nom décrits sans nom inventé, 23 fiches de bâtiments nommés, contre 26 en V1.4. Les 14 noms de bâtiments OSM restent tous affichés : un bâtiment OSM découpé en plusieurs empreintes IGN forme une seule fiche (centre E.Leclerc, Sport E. Leclerc), et les enseignes partageant une même empreinte IGN sont affichées ensemble (« Gémo · Gitem », « La Grande Récré · GiFi »).
- `check:presentation` : 129 hausses de toiture bornées dans le rendu (journal `data-sources/roof-render-adjustments.json`), hauteurs IGN de murs inchangées.

Build `pnpm build` réussi : application 54,53 Ko, Three.js 530,05 Ko, CSS 7,44 Ko. Données chargées : +3,2 Mo avec `buildings.geojson`.

## Vérification dans le navigateur

Carte lancée (dev, puis build servi) : vue globale, centre, Saint-Denis, Poussey, Les Granges, rue des Sages et stade, Belle Idée, zone industrielle. Captures en mode normal et `?diagnostic=provenance`. Les bâtiments IGN seuls (rouge) sont dispersés : aucun quartier entier ne manquait dans les deux sources. Les rangées mitoyennes apparaissent maintenant maison par maison. Bâtiment récupéré cliqué (équipement sportif IGN de 2024 près du stade) : fiche « Empreinte IGN BD TOPO », usage sportif. Modes Fluide et Élevée, masquage des noms, format portrait, clavier et Échap vérifiés. **Aucune erreur ni avertissement en console.**

## Performances

| Vue initiale, Fluide, 1280 × 800 | V1.4 | V1.5 |
|---|---:|---:|
| Bâtiments | 1 968 | 2 491 |
| Triangles | 532 717 | 560 099 (+5,1 %) |
| Triangles des bâtiments | 162 509 | 189 901 |
| Appels de dessin | 18 | 18 |
| Parcours benchmark, moyenne par image (SwiftShader) | ≈ 408 ms | 399,6 ms |

Pas de nouveau matériau ni d’appel de dessin : les bâtiments restent regroupés en quatre lots, seules les ombres des murs et toits sont calculées. Chargement du build observé : 1,9 s.

## Zones et points encore douteux

- **Bâtiments OSM seuls de plus de 80 m² (8 dans la commune)**, rendus en bleu : quatre sont à Poussey (deux rue Joliot-Curie, un rue du Lavoir, un rue du Château), un rue du Docteur-Sollier et trois vers la rue de l’Essy (à environ 300 m). La plupart sont des constructions légères (`wall=no`). À vérifier : démolis ou absents de la BD TOPO ?
- **Empreintes OSM partiellement couvertes** : 26 ont plus de 25 m² non couverts, surtout vers le chemin La Fin de Maizière (jusqu’à 554 m²), rue Joliot-Curie, rue Georges-Clemenceau et avenue du Général-de-Gaulle.
- **Parc de l’Aérodrome et chemin de la Guide** : les moins bâtis le long des rues (0,2 à 0,7 bâtiment principal par 100 m). Plausible, à confirmer sur imagerie.
- **Constructions récentes** absentes des deux sources : impossibles à détecter sans cadastre ni imagerie récente.

---

# Vérification V1.4 — 24 septembre 2026

Branche `opus/v1.4`, partie de `main` (V1.3, `676a312`) avec le commit documentaire des Bibles repris par cherry-pick.

## Audit visuel de la V1.3 (avant développement)

V1.3 lancée dans Chromium et parcourue : vue globale, centre, Saint-Denis, Poussey, Les Granges, rue proche, zone industrielle, campagne, voie ferrée, clics.

| Gravité | Défaut observé | Traitement V1.4 |
|---|---|---|
| CRITIQUE | 462 bâtiments `wall=no` rendus comme des toits flottants sur poteaux, très visibles près du bourg | Abris légers fermés ou hangars (voir NOTES) |
| CRITIQUE | Campagne : immenses aplats agricoles (polygones Corine Land Cover) à bandes identiques, sans parcelles | Mosaïque de parcelles décorative |
| CRITIQUE | Clic sur une maison sans nom : désélection silencieuse ; la carte n’invite pas à explorer | Fiche pour tout bâtiment, sans nom inventé |
| IMPORTANT | Surbrillance sans test de profondeur : un voile jaune recouvre les maisons | Coques et contours testés en profondeur |
| IMPORTANT | Ombres vert-noir, en blocs de plus de 4 m par texel de près | Ombres claires, recadrées sur la vue |
| IMPORTANT | Rues : bande de 10 px seulement ; un repère proche capte le clic | Tolérance selon la largeur visible ; priorité à la rue |
| IMPORTANT | Maisons identiques (même beige, toits orange uniformes) ; aspect extrusion OSM | Palettes par famille, volets, portes, cheminées |
| IMPORTANT | Bois : sphères éparses sur un aplat vert | Sol de canopée, arbres de bois plus grands |
| SECONDAIRE | Étiquettes en boîtes blanches partout (aspect SIG) | Toponymes peints, pastilles |
| SECONDAIRE | Bord de maquette en boîte, ciel uni | Horizon brumeux, ciel dégradé |
| SECONDAIRE | Zone industrielle grise et plate | Bardages et toitures nuancés |

## Contrôles automatiques

`npm run check:all` réussit : `check`, `check:enrichment`, `check:presentation`, `check:interaction` et le nouveau `check:bible`. Build Vite réussi : JavaScript applicatif 52,20 Ko, Three.js 530,05 Ko, CSS 7,12 Ko avant compression (avertissement habituel sur la taille du lot Three.js). Aucune dépendance ajoutée.

- Les quatre fichiers de données V1.1 et `named-zones.geojson` sont inchangés (SHA-256). Toujours 1 968 bâtiments, 533 portions routières, 25 ferroviaires, 332 haies IGN et 10 460 traverses. 976 hauteurs de murs IGN, 662 étages, 510 matériaux, 75 toitures bornées dans le rendu (journal inchangé). 615 hausses de toiture IGN utilisées au lieu de 614 : un ancien abri plat redevient un toit à deux pans.
- `check:bible` : SHA-256 des six Bibles identiques au tableau de `docs/bibles/README.md`, 172 citations retrouvées mot pour mot, rues et lieux annotés présents dans OSM.
- `check:interaction` (étendu) : noms de voies conformes aux sources, aucune voie anonyme nommée, 1 942 bâtiments sans nom décrits seulement par un type, repère du Gué de la Chapelle posé sur les deux tracés OSM, écart de graphie Bible signalé sans renommer la rue OSM.

## Objets cliquables et noms

| Catégorie | V1.3 | V1.4 |
|---|---:|---:|
| Groupes de voies nommées (nom ou référence) | 81 | 81 (144 tronçons sources) |
| Voies sans nom ni référence, non nommées | 387 | 387 |
| Bâtiments nommés | 26 | 26 |
| Bâtiments cliquables sans nom (fiche type + provenance) | 0 | 1 942 |
| Zones nommées | 10 | 10 |
| Repères ponctuels | 124 | 125 (+ Gué de la Chapelle, Bible 01) |
| Objets avec extraits des Bibles | 0 | 114 |

Couverture des noms de rues : les 73 noms OSM de voies sont affichés. 56 figurent aussi dans le référentiel de la Bible 01 (§4.1) et quatre y ont une graphie différente, signalée sans être tranchée. Les autres (Rue Jacqueline Auriol, Rue Robert Galley, Rue Thierry Moussin, Rue Pierre Sémard, Avenue Georges Pompidou…) restent sous leur seul nom OSM. Les noms de la Bible sans tracé OSM ne sont pas placés.

Essais de clic dans le navigateur (build servi) :

| Cas | Résultat |
|---|---|
| Rue Pasteur, vue proche, 14 px à côté de l’axe | Rue Pasteur |
| Avenue du Général-de-Gaulle, vue de toute la commune, 8 px | Avenue du Général de Gaulle |
| Rue Joliot-Curie et rue du Lavoir (Poussey), 9–10 px | rue correcte |
| Rue Maurice-Renault, 12 px | Rue Maurice Renault |
| Rue Pasteur, vue moyenne, 10 px sur une maison riveraine | Maison (bâtiment visible prioritaire, comportement voulu) |
| Saint-Denis (volume), mairie, Gué de la Chapelle | nom, extraits des Bibles, provenance |
| Maison ordinaire | « Maison », usage, niveaux et hauteur IGN, « Bâtiment sans nom connu » |
| Clic dans un champ, Échap, bouton × | désélection et suppression de la surbrillance |

## Vérifications manuelles

Build servi par `vite preview` et observé dans Chromium : vue globale, centre-bourg, Saint-Denis, Poussey, Les Granges, voie ferrée, zone industrielle, campagne, rues nommées, bâtiments nommés et génériques, zones, lieux-dits. Recentrer, Noms des lieux (masquer / afficher), zoom et déplacement au clavier, `R`. Mode Élevée (ratio 1,25, ombres 2048 PCF) puis retour en Fluide. Redimensionnement en format portrait 420 × 820 puis retour. **Aucune erreur ni aucun avertissement en console.** Le premier rendu après passage en Élevée prend environ 0,3 s (compilation des matériaux et nouvelle carte d’ombres).

Aucune régression géographique constatée : positions, empreintes, tracés, haies et bois se superposent à la V1.3 dans les mêmes vues.

## Performances et réglages

| Mesure (vue initiale, 1280 × 800, Fluide, ratio 1) | V1.3 | V1.4 |
|---|---:|---:|
| Triangles | 513 337 | 532 717 (+3,8 %) |
| Appels de dessin sans sélection | 15 | 18 |
| Triangles des bâtiments | 118 585 | 162 509 |
| Arbres (instanciés, sans ombre) | 3 200 | 2 900 |
| Parcours benchmark, moyenne / image (3 essais) | 411,0 · 408,6 · 406,7 ms | 409,5 · 401,7 · 412,9 ms |
| Médiane / P95 | 383 / 800 ms | 383 / 784–817 ms |

Mesures alternées V1.3 / V1.4 (moyennes 408,8 et 408,0 ms, écart dans le bruit de mesure), même session, même parcours `?benchmark=1` (89 intervalles), sans autre charge. Navigateur : ANGLE / SwiftShader, rendu logiciel, 4 cœurs déclarés. Ces chiffres comparent les deux versions dans le même environnement ; ils ne mesurent pas un GPU. **La cible 30–60 FPS sur un PC avec accélération graphique n’est pas certifiée ici.** Une première version V1.4 à 3 200 arbres et trois quads par fenêtre coûtait environ 5 % de plus : les volets ont été fusionnés en un seul quad derrière la vitre, le nombre d’arbres ramené à 2 900 (le sol de canopée compense visuellement) et les disques de carrefour réduits à huit côtés.

Trois appels de dessin supplémentaires : sol des bois (shader de canopée), peupliers instanciés, sol d’horizon. Une sélection ajoute un à trois appels, libérés à la désélection. Le rendu reste à la demande. Les ombres ne sont recalculées que lorsque la vue change nettement ; seuls les bâtiments projettent une ombre. Fluide reste le mode par défaut, sans MSAA ni post-traitement.

Chargement observé du build : environ 1,0 s dans cet environnement.

## Réel et artistique

**Réel (sources inchangées)** : coordonnées, empreintes, hauteurs et étages IGN, usages, matériaux déclarés, voirie, rail, cours d’eau, haies et bois IGN, noms OSM et IGN, extraits des Bibles.

**Artistique** : parcelles, couleurs et sillons des champs ; marbrure des prés et canopée des bois ; couleurs des façades et des toits (sauf la teinte brique et pierre de la mairie, décrite par la Bible 03) ; volets, portes, cheminées ; position et forme des arbres procéduraux ; sol d’horizon hors emprise ; ciel. Formes et orientations des toits ordinaires restent estimées comme en V1.3.

## Limites restantes

- Performance non validée sur GPU grand public : essai à faire sur la machine cible (`?benchmark=1`).
- Reconnaissance par un habitant et ressenti « dessin animé » non vérifiés par un essai utilisateur.
- Les champs décoratifs peuvent suggérer à tort des cultures ou un parcellaire : c’est documenté ici et dans NOTES, mais pas dans l’interface.
- Au-delà de l’emprise des données, le sol brumeux marque une coupure franche, adoucie seulement par la brume.
- « Salle Polyvalente » (point OSM) et « Salle polyvalente » (zone IGN) restent deux repères distincts, non réconciliés.
- Les constructions légères fermées peuvent être en réalité des hangars ouverts : la donnée ne le dit pas.
- Pas de relief ; ponts et passages dénivelés non reconstruits.
- Aucun survol (pas de raycast au mouvement), pour préserver la fluidité : la découverte se fait au clic.

---

# Vérification V1.3 — 24 septembre 2026 (historique)

## Contrôles et conservation

Les quatre contrôles passent : check, check:enrichment, check:presentation et check:interaction. Build Vite réussi (18 modules). JavaScript applicatif 38,17 Ko, Three.js 511,32 Ko, CSS 4,76 Ko avant compression. Avertissement non bloquant de taille du lot Three.js ; aucune dépendance ajoutée.

Les quatre fichiers de données de référence sont inchangés par SHA-256. Toujours 1 968 bâtiments affichés, 533 portions routières, 25 ferroviaires, 332 haies IGN et 10 460 traverses. Les 976 hauteurs de murs IGN, 614 hausses de toiture dérivées, 662 étages connus et 510 matériaux uniques sont conservés. Aucune reconstruction des empreintes.

## Objets cliquables et noms

- 81 groupes de voies identifiés par nom ou référence ; 144 objets routiers sources (107 avec nom et 37 avec référence seule), auxquels s’ajoute la ligne ferroviaire nommée.
- 26 bâtiments identifiés, 10 zones polygonales nommées et 124 repères ponctuels. Le catalogue couvre la commune et le contexte conservé autour.
- Noms OSM, repères IGN, types d’équipements publics existants ; cinq contours nommés issus des zones d’activité et d’intérêt IGN locales.
- 387 objets routiers sources sans nom ni référence restent non nommés, dont chemins et dessertes. Les bâtiments ordinaires sans identité et les secteurs sans nom fiable ne reçoivent aucun nom inventé.
- Poussey et les autres lieux-dits ponctuels utilisent un halo de localisation ; aucun contour de quartier n’est inventé.

Le clic interroge les quatre lots de bâtiments existants, puis les points à moins de 22 pixels, les axes routiers à moins de 10 pixels et enfin les polygones de zones. Les bâtiments visibles sont prioritaires : au loin, une maison devant une rue peut intercepter le clic, il faut alors zoomer ou cliquer sur une portion dégagée. Cliquer sur un espace sans objet identifié, fermer le panneau ou Échap désélectionne. Une rotation ou un déplacement dépassant 6 pixels annule le clic ; les gestes multiples aussi. Le calcul de sélection est effectué seulement au clic, sans boucle de survol.

Le test automatisé vérifie les noms des voies contre leurs sources, l’absence de noms inventés pour les voies anonymes, la couverture sans trou ni chevauchement des indices de triangles, et un vrai lancer de rayon sur Saint-Denis. Résultats dans data-sources/interaction-audit.json.

## Vérification visuelle et navigateur

Projet lancé puis build de production servi localement. Vues d’ensemble et rapprochée du centre examinées : champs à larges bandes, couronnes arrondies, volumes, toitures et silhouette de l’église. La correction importante a élargi les motifs agricoles trop serrés et rendu les boutons d’étiquettes accessibles (suppression du aria-hidden hérité).

Sélections vérifiées dans le navigateur : Poussey, clic direct sur le volume de Saint-Denis, mairie, Rue Pasteur sur une portion de chaussée dégagée, zone IGN de la Glacière. Nom et provenance observés. Fermeture, Échap, clic vide, zoom clavier et recentrage vérifiés. Une sélection de zone passe à 17 appels de dessin, puis revient à 15 après désélection. Mode Élevée vérifié (ratio 1,25 et ombres 2048), puis retour à Fluide. Masquage et réaffichage des noms vérifiés. Aucun avertissement ou erreur applicatif capturé, y compris après le changement de qualité. Une pause de compilation a temporairement retardé une action du navigateur de contrôle.

Le style est maintenant un diorama toon léger ; la reconnaissance par un habitant et l’appréciation du rendu « film d’animation » ne sont pas certifiées par un test utilisateur. La géométrie réelle reste prioritaire.

## Performances avant / après

| Mesure | V1.2 | V1.3 |
|---|---:|---:|
| Triangles, vue initiale | 508 573 | 513 337 (+0,94 %) |
| Appels de dessin sans sélection | 15 | 15 |
| Arbres | 3 800 | 3 200 |
| Moyenne parcours, 639 × 686 | 731,29 ms | 168,11 ms |
| Cadence moyenne | 1,4 FPS | 5,9 FPS |
| Médiane | 1 000,7 ms | 166,4 ms |
| P95 | 1 000,8 ms | 199,2 ms |

Parcours identique de 105 images, 89 intervalles après échauffement, mode Fluide, ratio 1, page visible. V1.2 mesurée avant la passe ; V1.3 build final le 24 septembre. Navigateur ANGLE / Microsoft Basic Render Driver, 2 cœurs logiques, 8 Go déclarés. Les intervalles mesurent aussi l’ordonnancement du navigateur ; le palier autour d’une seconde de la V1.2 suggère une limitation supplémentaire. Ne pas attribuer tout l’écart au code ni présenter ces chiffres comme une mesure GPU isolée. Le coût géométrique reste proche. La cible de 30–60 FPS n’est pas atteinte ici et reste à vérifier sur GPU accéléré.

Préparation du build observée : 2,79 s. Calcul ponctuel de clic observé autour de 39 ms dans cet environnement. Les ombres restent 1024² en Fluide, 2048² filtrées en Élevée ; ratio adaptatif, pas de MSAA, pas d’ombres des arbres, rendu à la demande au repos. Le changement de qualité peut demander une compilation et figer temporairement ce navigateur logiciel.

## Livraison

maizieres-3d-v1.3.zip contient code, scripts, sources OSM/IGN locales, données préparées, référence, README, NOTES, QA et build dist. Sans node_modules, caches ou anciennes archives. Les versions précédentes ci-dessous sont conservées comme historique, pas comme description de la V1.3.

---

# Vérification V1.2 — finalisation du 15 septembre 2026

## Conservation et contrôles

- `npm run check` et `npm run check:enrichment` réussis pendant la passe ; `npm run check:presentation` réussi de nouveau le 15 septembre.
- Les quatre fichiers de données V1.1 sont inchangés par SHA-256, y compris les deux enrichissements IGN. Les empreintes de référence proviennent du ZIP V1.1 et figurent dans `data-sources/v1.1-data-hashes.json`.
- 1 968 bâtiments, 533 portions de voirie, 25 portions ferroviaires, 332 haies IGN affichées et 10 460 traverses conservés.
- Toujours 976 hauteurs de murs IGN, 614 hausses de toiture dérivées, 662 nombres d’étages et 510 matériaux uniques utilisés dans le rendu. Les 75 hausses bornées conservent leur valeur source ; journal dans `data-sources/roof-render-adjustments.json`. Aucune hauteur de mur IGN modifiée.
- La régression de triangulation des cours reste couverte par le contrôle V1.1.

## Build et vues contrôlées

Build Vite final réussi : 15 modules, JavaScript applicatif **29,93 Ko**, Three.js **510,34 Ko**, CSS **3,67 Ko** avant compression. Avertissement non bloquant sur le lot Three.js supérieur à 500 Ko. Aucune dépendance supplémentaire. Le build compilé a été relancé et contrôlé le 15 septembre.

Vues d’ensemble du bourg, de Poussey, de la voie ferrée, des champs et des secteurs industriels ; vue rapprochée de Saint-Denis et des maisons. Les volumes et repères géographiques sont conservés ; couleurs plus marquées, feuillages arrondis et silhouette spécifique de l’église visibles. Les bandes d’auto-ombrage observées pendant la passe ont été corrigées en supprimant la réception des ombres sur les bâtiments ; correction contrôlée en vue rapprochée.

Zoom et déplacement clavier, parcours de caméra en rotation/déplacement/zoom, bouton de qualité et retour à la vue initiale contrôlés. Masquage et réaffichage des noms contrôlés. Aucun message d’erreur ou avertissement applicatif capturé dans la session finale. La reconnaissance immédiate par un habitant n’a pas fait l’objet d’un test utilisateur.

## Charge graphique et réglages

| Indicateur | V1.1 | V1.2 Fluide | V1.2 Élevée |
|---|---:|---:|---:|
| Triangles, vue initiale | 1 011 973 | 508 573 | 508 573 |
| Appels de dessin | 15 | 15 | 15 |
| Arbres | 10 000 | 3 800 | 3 800 |
| Traverses | 10 460 volumes | 10 460 surfaces | Identique |
| Ratio maximal de pixels | 1,75 | 1,25 ; 1 sur matériel modeste déclaré | 1,5, minimum 1,25 |
| Carte d’ombres | 2048² | 1024² | 2048² |
| Filtrage des ombres | PCFSoft | Basic | PCFSoft |
| Ombres des arbres | Oui | Non | Non |
| MSAA | Oui | Non | Non |

**49,7 % de triangles en moins et 62 % d’arbres en moins**, sans hausse des appels de dessin. Seuls les bâtiments projettent encore des ombres ; les petits objets répétitifs n’en projettent pas. Le sol reçoit les ombres, les bâtiments et arbres n’en reçoivent pas. Ombres recalculées au démarrage et au changement de qualité, puis figées. Pas de boucle de rendu continue au repos.

Le mode Fluide est toujours le défaut. Il plafonne à 1 le ratio si le navigateur déclare au plus quatre cœurs logiques ou 4 Go ; autrement plafond 1,25, sans dépasser le DPR natif. Élevée utilise un ratio entre 1,25 et 1,5 et n’ajoute pas d’arbres. La sélection peut entraîner une pause ponctuelle de compilation des matériaux et recalcul des ombres.

## Mesures de navigation et limites

Parcours reproductible dans `src/benchmark.js` : 105 images, dont 89 intervalles après échauffement ; même trajectoire, fenêtre de **1025 × 890**, page visible. Les chiffres ci-dessous mesurent les intervalles requestAnimationFrame et incluent les attentes du navigateur ; ce ne sont pas des temps GPU isolés.

| Version / date | Ratio effectif | Moyenne par image | Médiane | P95 | Cadence moyenne |
|---|---:|---:|---:|---:|---:|
| V1.1 — 11 septembre | 1 | 992,19 ms | 848,9 ms | 2230,2 ms | 1,0 FPS |
| V1.2 Fluide finale — 15 septembre | 1 | 313,95 ms | 283 ms | 516 ms | 3,2 FPS |
| V1.2 Élevée finale — 15 septembre | 1,25 | 989,96 ms | 1000,7 ms | 1000,8 ms | 1,0 FPS |

Le gain mesuré en Fluide est d’environ **3,2 fois**, avec la prudence qu’imposent deux sessions à des dates différentes. Le navigateur expose **ANGLE / Microsoft Basic Render Driver**, deux cœurs logiques et 8 Go déclarés. Il ne s’agit pas d’une validation sur GPU grand public accéléré. **La cible de 30–60 FPS n’est pas atteinte dans ce contexte et n’est pas certifiée sur la machine cible.**

Le parcours Élevée final présente une cadence proche d’une seconde par image. Cette régularité peut aussi refléter une limitation de l’ordonnancement du navigateur de contrôle ; il est impossible d’isoler ici le seul coût du mode Élevée. Une mesure antérieure du 11 septembre, avant la dernière correction d’auto-ombrage, donnait environ 2 FPS dans ce mode. Ces variations renforcent la nécessité d’un essai avec accélération graphique réelle.

Chargement/préparation observé du build final Fluide : environ 2,15 s ; V1.1 : environ 4,36 s lors du parcours de référence. Valeurs locales sensibles à la charge et au cache. Les soumissions JavaScript très courtes au repos ne doivent pas être interprétées comme une cadence de navigation.

Pour reproduire : lancer le projet et ouvrir `/?benchmark=1`, ou `/?benchmark=1&quality=high`, puis lire `canvas[data-benchmark]`. Le parcours se termine seul et recentre la scène.

## Livraison

ZIP complet avec code, scripts, données locales, sources IGN, journal des toitures, référence fournie, README, NOTES, QA et build `dist/`. Exclusion de `node_modules`, des caches, photographies de recherche et anciennes archives. Documentation V1.1 conservée ci-dessous pour comparaison.

---


# Vérification de la version 1.1 — 11 septembre 2026

## Conservation et données

- `npm run check` réussi : INSEE 10220, origine dans la commune, axes est/nord corrects, coordonnées finies et emprise cohérente. Présence de Poussey, Saint-Denis et de la D 619 vérifiée.
- `npm run check:enrichment` réussi : empreintes SHA-256 des deux fichiers géographiques d’origine inchangées ; 1 217 associations respectant les seuils ; hauteurs bornées ; géométries de bâtiments finies et dans l’emprise.
- Régression de triangulation corrigée et vérifiée : carré de 100 m² avec cour de 16 m² → 84 m² rendus et intersectés, aucun remplissage du trou. Avant correction, le rendu produisait 148 m². Les coordonnées sources restent inchangées.
- Toujours 2 022 empreintes sources et 1 968 volumes affichés ; les objets de moins de 3 m² restent omis.
- Le fichier préparé contient 977 hauteurs de murs IGN, 615 hausses de toiture dérivées, 662 nombres d’étages et 522 déclarations de matériaux. Dans la scène : 976 hauteurs de murs, 614 hausses de toiture, 662 nombres d’étages, 510 matériaux uniques. Petites empreintes omises et matériaux mixtes expliquent les écarts.
- 533 portions routières après découpage, 25 portions ferroviaires, 10 460 traverses ; 332 polygones de haies IGN ; 10 000 arbres. La limite de végétation est maintenue.

## Build et navigateur

- Build Vite de production réussi : 13 modules ; JavaScript applicatif 26,57 Ko, Three.js 510,43 Ko, CSS 3,10 Ko (avant gzip). Avertissement de taille du lot Three.js supérieur à 500 Ko, sans échec.
- Données utilisées à l’exécution : 3 010 927 octets, environ 3,01 Mo. Les 4,52 Mo de sources IGN brutes restent hors des fichiers chargés par l’application.
- Version de développement et build servi par `vite preview` lancés et contrôlés dans le navigateur local.
- Contrôle visuel : bourg, branche de Poussey, lotissement circulaire, ligne ferroviaire, grands volumes industriels au sud-est, bois et haies. Vue rapprochée du centre et de Saint-Denis : volumes présents, pignons et clocher spécifiques visibles, maisons et abris différenciés.
- Zoom et déplacement au clavier, masquage/réaffichage des noms, puis recentrage vérifiés sur le build. Le glisser/rotation repose sur les OrbitControls existants, déjà contrôlés dans la V1.
- Aucun défaut visuel majeur constaté dans ces vues. La précision des toitures individuelles n’est pas validée par comparaison exhaustive au village.
- Une ancienne erreur de connexion du rechargement Vite (WebSocket) a été capturée après interruption du serveur de développement ; elle ne concerne pas le rendu de production. Aucun autre message d’erreur applicatif n’a été observé lors du contrôle.

## Performance

- Même vue de départ : **15 appels de dessin**, **1 011 973 triangles**, contre 970 962 auparavant, soit **+4,2 %**. Le regroupement des géométries reste en place.
- Durées de soumission observées : **1,5 à 2,4 ms** sur plusieurs images stabilisées, puis **223,6 ms** après une séquence de navigation et recentrage. La variabilité du navigateur de contrôle reste importante, comme dans la V1. Ce compteur mesure la soumission côté JavaScript, pas le temps GPU ni une cadence garantie ; la fluidité doit être appréciée sur la machine cible.
- Préparation locale observée : environ **4,0 s** en développement et **10,3 s** au premier chargement du build dans le navigateur de contrôle. Cette variabilité inclut la charge de l’environnement ; ce n’est pas une mesure reproductible de téléchargement ni une promesse de temps de démarrage.
- Rendu à la demande et ombres statiques conservés. Aucune animation permanente, texture haute résolution ni dépendance supplémentaire. Aucun objectif de 60 images/s n’est certifié.

## Limites de validation

Les données IGN ne sont pas toutes mesurées directement : méthodes d’acquisition et précisions sont conservées par objet. Les hausses de toiture sont statistiques. Orientations et formes des toits ordinaires restent déduites des empreintes ; le clocher et les parties de l’église ont des proportions estimées. Terrain plat, façades simplifiées, végétation distribuée de façon procédurale. Voir NOTES.md pour les sources et conventions détaillées.

Le ZIP complet fournit code, scripts, données préparées, sources IGN, référence et build. Il exclut `node_modules`, les caches, les photographies de recherche et les anciennes archives.

