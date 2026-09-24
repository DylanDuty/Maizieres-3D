# Vérification V1.3 — 24 septembre 2026

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

