# Maizières-la-Grande-Paroisse en 3D

Prototype local Three.js de la commune de l’Aube, code INSEE **10220**. Empreintes, voirie, voies ferrées et occupation du sol proviennent d’OpenStreetMap. Le contour communal provient de l’API Découpage administratif française.

**Version 1.3** : ombrage toon à quatre paliers, arbres aux couronnes arrondies et lobées, champs graphiques, liserés de toiture et lumière chaude. Exploration par clic des rues, bâtiments identifiés, zones et lieux-dits. Les coordonnées, empreintes et enrichissements IGN sont conservés.

Le bouton **Qualité** alterne entre **Fluide** (défaut : ratio de pixels limité à 1–1,25 et ombres 1024) et **Élevée** (ratio 1,25–1,5 et ombres 2048 filtrées). Les deux modes conservent les mêmes données et 3 200 arbres. La cible 30–60 FPS reste à vérifier avec un GPU accéléré ; les mesures du navigateur de contrôle ne la certifient pas.


**Données héritées de la V1.1** : 1 217 bâtiments associés à la BD TOPO IGN pour enrichir hauteurs, étages, usages et matériaux, sans modifier les empreintes. Haies et bois IGN ajoutés, silhouette spécifique de Saint-Denis. Les toitures ordinaires et leurs orientations restent estimées : voir `NOTES.md` pour la provenance et `QA.md` pour les contrôles.

## Lancer

Prérequis : **Node.js 22.12+ avec npm**, navigateur récent avec WebGL 2 activé.

Dans ce dossier :

```sh
npm install
npm run dev
```

Ouvrir **http://127.0.0.1:5173/**. Le serveur utilise un port fixe : arrêter l’autre application si ce port est déjà occupé. Le projet fonctionne aussi avec pnpm ; son fichier de verrouillage est fourni.

- Cliquer sur une rue, un bâtiment identifié, une zone ou une étiquette : nom, source et surbrillance.
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

L’archive `maizieres-3d-v1.3.zip` inclut le code, les sources de données, les notes, la référence et le build `dist/`, sans `node_modules` ni cache de travail. Le site compilé peut être servi directement par un serveur HTTP statique.

Contrôle complémentaire : `npm run check:presentation`. Les corrections de toiture appliquées au rendu sont détaillées dans `data-sources/roof-render-adjustments.json` ; les données sources restent intactes.

Contrôle de l’interactivité : `npm run check:interaction`. Reconstruction des cinq zones nommées depuis les sources IGN locales : `npm run data:places`. Ces zones servent uniquement à la sélection ; elles ne remplacent aucune empreinte. Les lieux-dits décrits par un point restent des repères ponctuels, sans contour inventé.
