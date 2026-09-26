# Maizières-la-Grande-Paroisse en 3D

Prototype local Three.js de la commune de l’Aube, code INSEE **10220**. Empreintes, voirie, voies ferrées et occupation du sol proviennent d’OpenStreetMap. Le contour communal provient de l’API Découpage administratif française.

**Version 2.3** : enrichissement architectural préparatoire à Unreal. La géographie V2.2 est strictement inchangée.

- **Un profil par bâtiment** (2 596), dans `public/data/building-architecture-v2.3.json` :
  - classe (archétype Unreal) ;
  - hauteurs à l'égout et au point haut ;
  - niveaux déclarés et niveaux lisibles ;
  - type de toit, orientation du faîtage, pente ;
  - famille de couleur et matériau ;
  - forme de l'empreinte, annexes ;
  - confiance et trace de chaque attribut.
- **Sources mesurées** :
  - **LiDAR HD IGN 2025 (MNH, 0,5 m)** pour les toits et les hauteurs ;
  - BD ORTHO avril 2025 pour les couleurs ;
  - BD TOPO pour les hauteurs officielles.
  - Aucune donnée Google.
- **Ce qui n'est pas connu reste `unknown`.** Les estimations sont marquées `estimated`.
- **Aperçu** : `?architecture=1`. Diagnostic de confiance : `?diagnostic=architecture` (A vert, B orange, C bleu, inconnu magenta). La carte par défaut n'est pas modifiée.
- **Unreal** : `unreal/architecture/` contient les bâtiments, les archétypes et les landmarks ; guide dans `docs/unreal/ARCHITECTURE_IMPORT_GUIDE.md`.
- **Contrôle** : `npm run check:architecture`.
- **Rapports** : `docs/audit/V2.3_ARCHITECTURAL_ENRICHMENT.md`, et les constats géographiques non corrigés dans `docs/audit/GEOGRAPHIC_FREEZE_EXCEPTIONS.md`.

**Version 2.2** : corrections finales du bâti avant le gel pour Unreal (`READY_FOR_UNREAL_GEOGRAPHIC_FREEZE = true`).

- **Les 16 constructions sans géométrie publique sont arbitrées** :
  - 11 sont relevées à la main sur l’orthophoto IGN 2025, dont la maison vis-U2, le bâtiment vis-A à Poussey et le long bâtiment vis-F ;
  - 2 étaient déjà au référentiel ;
  - 3 restent non modélisées, car ambiguës.
- **Un abri double** a été trouvé en contrôlant l’un de ces cas, et ajouté.
- **Couche manuelle** : ces 12 objets sont dans une couche séparée et non officielle, `public/data/buildings-manual-v2.2.geojson`. On la désactive avec `?manual=0`.
- **Total** : 2 596 empreintes, dont 2 362 dans la commune.
- **Unreal** : `unreal/buildings/buildings-provenance-v2.2.json` distingue les empreintes officielles, les réintégrations V2.0.1 et les relevés manuels V2.2.
- **Contrôle** : `npm run check:final-building-freeze`.
- **Rapport** : `docs/audit/V2.2_FINAL_BUILDING_FREEZE.md`.

**Version 2.1** : audit géographique final, non encore validé. La validation visuelle par l’utilisateur, notamment à Poussey, reste nécessaire.

- **Rupture de rivière à Poussey** : la rivière semblait s’arrêter puis reprendre. C’était un défaut de rendu : les haies de berge (DSB) étaient peintes par-dessus le Ruisseau des Moulins de Poussey, et des murs de haie 3D étaient posés sur son lit. L’eau est maintenant dessinée en dernier, et aucune haie 3D n’est élevée sur un cours d’eau.
- **Audit des autres couches** : bâti, voirie, rail, occupation du sol et toponymie ont été audités, sans autre correction.
- **Outils** : `npm run check:geographic-integrity`, diagnostic `?diagnostic=hydro-audit`.
- **Rapport** : `docs/audit/V2.1_FINAL_GEOGRAPHIC_AUDIT.md`.

**Version 2.0.1** : audit visuel des maisons manquantes, sur toute la zone bâtie comparée à l’orthophoto IGN 2025, au cadastre, à la BD TOPO, au RNB et à OSM.

- **Rendu** : les 2 494 bâtiments étaient bien présents dans la scène, mais 124 étaient en partie enterrés par le relief affiché. Leur socle suit maintenant ce relief.
- **Réintégrations** : 90 bâtiments (annexes, garages, abris et une maison), repris du cadastre ou d’OSM, dont 6 retraits V1.6.1 annulés.
- **Total affiché** : 2 584 bâtiments, dont 2 350 dans la commune. Le référentiel gelé V1.6.2 est inchangé ; les réintégrations sont dans `public/data/buildings-additions-v2.0.1.geojson`.
- **Sans géométrie publique** : 16 constructions visibles sont seulement listées, jamais dessinées.

Contrôle : `npm run check:building-visibility`. Diagnostic : `?diagnostic=buildings-audit`. Détail : `docs/audit-maisons-manquantes-v2.0.1.md`.

**Version 2.0** : première vue normale complète et visible, sans paramètre. Elle assemble tous les référentiels gelés sur le relief LiDAR réel :

- **2 494 bâtiments**, posés à leur altitude ;
- voirie V1.8 en 8 catégories (les chemins ne sont jamais présentés comme revêtus) ;
- ferroviaire V1.9 ;
- 560 parcelles, 253 bois, 378 haies, l’eau et les surfaces artificielles de V1.10 ;
- lieux et landmarks V1.11.

Nouveautés d’interface :

- recherche, vues rapides et légende repliable ;
- trois modes de qualité : Très fluide, **Fluide** (défaut) et Élevée ;
- HUD technique avec `?perf` ou `?diagnostic=v2`.

Données d’affichage : `npm run data:v2`. Contrôle : `npm run check:v2` (`check:all` en enchaîne 12). Détail et limites : `docs/V2.0-TECHNIQUE-VISIBLE.md`. En ligne : https://dylanduty.github.io/Maizieres-3D/.

**Version 1.5** : la carte devient une référence géographique. **Les bâtiments viennent du référentiel unifié `public/data/buildings.geojson`** : IGN BD TOPO comme géométrie principale, OSM comme complément et sémantique. On passe ainsi à 2 491 bâtiments dans la zone affichée (2 259 dans la commune), au lieu de 1 968. Format documenté dans `docs/referentiel-bati.md` pour un futur export Unreal. Régénération : `npm run data:buildings`. Couverture et audit : `npm run audit:buildings`, `npm run check:buildings`, et `?diagnostic=provenance` pour colorer les bâtiments selon leur source.

**Version 1.4** : direction artistique « village dans un film d’animation ». Mosaïque de champs peinte, ciel et horizon brumeux, maisons aux volets colorés, constructions légères rendues comme des abris fermés, arbres en nuage, ombres claires qui suivent la vue. Toutes les rues nommées sont cliquables avec une zone de clic élargie, et tous les bâtiments ont une fiche (sans nom inventé). Extraits des Bibles documentaires 01 et 03 dans les fiches, repère du Gué de la Chapelle. Coordonnées, empreintes et enrichissements IGN inchangés.

Le bouton **Qualité** alterne entre **Fluide** (défaut : ratio de pixels limité à 1–1,25 et ombres 1024) et **Élevée** (ratio 1,25–1,5 et ombres 2048 filtrées). Les deux modes conservent les mêmes données et 2 900 arbres. La cible 30–60 FPS reste à vérifier sur un GPU accéléré.

Ce qui est réel et ce qui est artistique est détaillé dans `NOTES.md` ; mesures et limites dans `QA.md`. Les Bibles sont archivées, avec leurs SHA-256, dans `docs/bibles/`.

**Données héritées de la V1.1** : 1 217 bâtiments associés à la BD TOPO IGN pour enrichir hauteurs, étages, usages et matériaux, sans modifier les empreintes. Haies et bois IGN ajoutés, silhouette spécifique de Saint-Denis. Les toitures ordinaires et leurs orientations restent estimées : voir `NOTES.md` pour la provenance et `QA.md` pour les contrôles.

## Lancer

Prérequis : **Node.js 22.12+ avec npm**, navigateur récent avec WebGL 2 activé.

Dans ce dossier :

```sh
npm install
npm run dev
```

Ouvrir **http://127.0.0.1:5173/**. Le serveur utilise un port fixe : arrêter l’autre application si ce port est déjà occupé. Le projet fonctionne aussi avec pnpm ; son fichier de verrouillage est fourni.

- Cliquer sur une rue, un bâtiment, une zone ou une étiquette : fiche avec nom (s’il existe dans les sources), faits, extraits des Bibles et provenance. La zone de clic d’une rue est plus large que la chaussée.
- Cliquer dans un espace vide, fermer le panneau ou appuyer sur `Échap` : désélection.
- Les voies sans nom ni référence restent sans nom ; aucun nom fictif n’est ajouté.
- Glisser avec le bouton gauche : rotation.
- Molette / pincement : zoom.
- Glisser avec le bouton droit / deux doigts : déplacement.
- « Recentrer la vue » : cadrage initial du bourg et de Poussey.
- « Noms des lieux » : afficher ou masquer les repères.
- Après avoir sélectionné la carte : flèches pour déplacer, `+` / `−` pour zoomer, `R` pour recentrer.

## Version distribuable

```sh
npm run build
npm run preview
```

Le dossier `dist/` contient le site statique et ses données. Le servir avec un serveur HTTP ; un double clic sur `index.html` ne suffit pas. Aucun accès à une API ni téléchargement de texture n’est nécessaire pendant l’utilisation. Une première installation des dépendances nécessite Internet.

## Technologies et données

Three.js, OrbitControls, JavaScript et Vite. Géométries statiques regroupées, arbres et traverses instanciés, textures agricoles procédurales, rendu à la demande.

- [OpenStreetMap — attribution et licence ODbL](https://www.openstreetmap.org/copyright) : `public/data/maizieres.geojson` ; 3 187 objets, dont 2 022 empreintes de bâtiments sur l’emprise et ses abords. Horodatage annoncé par la source : **31 mai 2026 à 22:37:44 UTC**. Téléchargement : **10 septembre 2026**.
- [Contour administratif de la commune](https://geo.api.gouv.fr/communes/10220?format=geojson&geometry=contour) : `public/data/commune.geojson`.
- [IGN BD TOPO / Géoplateforme](https://geoservices.ign.fr/bdtopo), Licence Ouverte 2.0 : instantanés et requêtes dans `data-sources/ign/`, attributs et végétation préparés dans `public/data/`. Les sources complètes sont fournies pour reproduire le rapprochement ; elles ne sont pas chargées par le navigateur.
- [Identification INSEE 10220](https://www.insee.fr/fr/metadonnees/geographie/commune/10220-maizieres-la-grande-paroisse).
- Carte fournie par l’utilisateur : `references/map-mlgp.png`, uniquement pour comparaison visuelle, non affichée ni utilisée comme texture.

Pour renouveler volontairement le relevé : `npm run data:fetch`, puis `npm run data:prepare`, `npm run check` et `npm run build`. Les données déjà fournies permettent de lancer la maquette sans cette étape. Les miroirs Overpass publics peuvent être temporairement indisponibles. Le script conserve l’horodatage renvoyé par la source : téléchargement récent ne signifie pas forcément données récentes.

Les limites et approximations sont décrites dans `NOTES.md`.

Pour recalculer l’enrichissement depuis les sources IGN incluses : `npm run data:enrich`, puis `npm run check:enrichment`. `npm run data:ign` télécharge les sources manquantes sans remplacer les instantanés présents. Aucun de ces traitements n’est nécessaire au lancement normal.

Le dépôt Git exclut `dist/`, `node_modules` et les caches : lancer `npm run build` pour produire le site statique.

Contrôle complémentaire : `npm run check:presentation`. Les corrections de toiture appliquées au rendu sont détaillées dans `data-sources/roof-render-adjustments.json` ; les données sources restent intactes.

Contrôles V1.4 : `npm run check:all` enchaîne les cinq contrôles. `npm run data:bible` régénère les annotations depuis les Bibles, qui ne sont jamais modifiées ; `npm run check:bible` vérifie leurs SHA-256 et chaque citation affichée.

Contrôle de l’interactivité : `npm run check:interaction`. Reconstruction des cinq zones nommées depuis les sources IGN locales : `npm run data:places`. Ces zones servent uniquement à la sélection ; elles ne remplacent aucune empreinte. Les lieux-dits décrits par un point restent des repères ponctuels, sans contour inventé.
