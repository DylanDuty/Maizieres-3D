# MLGU — Gel sémantique V1 (V2.9.2)

Ce gel fige ce que la carte **dit** des lieux et des voies : noms, associations lieu ↔ bâtiment, ancres, statuts d'affichage, enregistrements cherchables. La géométrie n'en fait pas partie. Elle reste couverte par le gel géographique V2.2 (42 fichiers) et par le Freeze V1 Unreal (52 fichiers), qui ne changent pas.

- Version : semantic freeze **V1**, livrée avec la V2.9.2.
- Base : commit `9ab6d20` (V2.9.1), branche `opus/v2.9.2-geographic-semantic-audit`.
- Commit de livraison : celui qui contient ce document (voir `git log`).
- Manifeste : `docs/freeze/MLGU_SEMANTIC_FREEZE_MANIFEST_V1.json`, vérifié par `npm run check:semantic-freeze`.

## 1. Registres

| Registre | Fichier | Contenu |
|---|---|---|
| Lieux | `docs/freeze/MLGU_PLACES_CANONICAL_V1.json` | 367 lieux de la couche POI complète, plus 158 enregistrements nommés hérités, chacun gouverné |
| Voies | `docs/freeze/MLGU_ROADS_CANONICAL_V1.json` | 111 voies nommées sur les 1 585 tronçons dessinés, avec transitions de nom, rail, passages à niveau, ponts, hydronymes et étiquettes de secteur |

Le registre est la source. La carte ne lit que ses **projections d'exécution**, générées par les mêmes scripts :

- `src/content/places-runtime-v292.json` : associations, ancres et adresses corrigées, lieux masqués, gouvernance des enregistrements hérités, variantes cherchables ;
- `src/content/roads-runtime-v292.json` : voies canoniques (tronçons dessinés), rattachement des tracés OSM aux étiquettes, voies ferrées.

Elles sont appliquées par `src/places-canonical.js` (`applyPlaceCorrections`, `applyRegisters`) et par `src/search-index.js`. L'errata V2.9.1 (`src/landmark-errata.js`) est supprimé : il n'y a plus de correctif d'exécution hors registre.

## 2. Décisions

Les choix humains sont dans trois fichiers versionnés ; aucune valeur n'est saisie à la main dans les registres.

- `docs/freeze/places-decisions-v2.9.2.json` : 23 lieux arbitrés (statut, bâtiment, ancre, adresse, limite, anomalies, sources).
- `docs/freeze/roads-decisions-v2.9.2.json` : lieux-dits d'adressage, graphies, 11 noms OSM arbitrés.
- `docs/freeze/catalogue-decisions-v2.9.2.json` : 2 rattachements manuels d'enregistrements hérités.

## 3. Comptes certifiés

| Objet | Compte |
|---|---|
| Lieux du registre | 367 (222 dans la commune, 28 hors commune, 117 sans position communale) |
| Lieux interactifs de la couche web | 185 : 36 PASS, 121 PASS_WITH_LIMITATION, 28 HIDDEN_OUT_OF_COMMUNE, 0 HIDDEN_PENDING_REVIEW |
| Lieux non affichés (niveau 2) | 182 (171 REVIEW, 11 PASS) ; aucun REVIEW ni BLOCKED affiché |
| Enregistrements hérités (OSM, BD TOPO, Bible) | 158 : 113 alias d'un lieu certifié, 42 masqués, 3 bâtiments dénommés |
| Voies nommées | 111 (72 dans la commune, 39 dans les communes voisines) ; 63 PASS, 48 PASS_WITH_LIMITATION |
| Voies BAN typées de la commune | 62 / 62 cliquables et cherchables |
| Tronçons dessinés | 1 585 (560 nommés, 1 024 sans nom ni numéro, non cliquables comme avant) |
| Passages à niveau | 4 (70, 71, 73, 74) ; 71, 73 et 74 interactifs, 70 hors commune |
| Ponts portés par un lieu | 3 (Clairvaux, rue de l'Orme, Seine) |
| Anomalies | 131 : 3 BLOCKER, 30 MAJOR, 95 MINOR, 3 INFO ; 58 corrigées, 70 masquées, 3 acceptées |

## 4. Anomalies acceptées

Trois anomalies MAJOR restent acceptées, avec leur limite affichée dans le registre :

- **Le Bistrot à Tattoo** : adresse BAN « segment » ; bâtiment confirmé par le RNB.
- **Accueil de loisirs Les Galopins** : adresse BAN « segment » ; bâtiment confirmé par le RNB et la Bible 01.
- **Stade** : ancre au centre de l'aire sportive, à 83 m du seul bâtiment associé, le vestiaire.

## 5. Éléments masqués

- **28 lieux-dits des communes voisines**, interactifs jusqu'en V2.9.1.
- **42 enregistrements hérités masqués** : lieux et commerces hors commune (Leclerc, Burger King, Courtepaille, Wafu, Technicentre SNCF, centrale photovoltaïque de Romilly…), lieux-dits OSM voisins, et l'ancienne pharmacie Saint-Denis (OSM la présente comme active, alors qu'elle a déménagé en 2022).
- **3 bâtiments dénommés**, dont le nom hérité désignait un autre lieu :
  - …2006956400 « Salle polyvalente », qui est le bâtiment de la Maison des associations ;
  - …149545 « Mairie », une annexe de 31 m² ;
  - …325110254 « Entrepot BUT ».

La liste complète est dans le manifeste (`hidden`).

## 6. Exports Unreal

Le dossier `unreal/` reste gelé et n'est pas modifié. `docs/freeze/unreal-semantic-migration-v2.9.2.json` liste, champ par champ, ce qu'il faudra appliquer à la prochaine régénération :

- **46 POI** : association, ancre en Lambert-93 et en centimètres Unreal, statut d'affichage ;
- **3 landmarks** : mairie, école, salle polyvalente ;
- **3 entrées de `landmark-architecture.json`** ;
- **266 noms de splines de route**.

Aucune géométrie ne change.

## 7. Règle de modification

Toute modification d'un registre, d'une décision ou d'une projection passe par un **nouveau gel sémantique (V2)**. Ce document ne se corrige pas en place. Procédure :

```
npm run data:places-canonical
npm run data:roads-canonical
npm run data:semantic-freeze
npm run check:all
```

`check:semantic-freeze` échoue tant que le manifeste n'a pas été régénéré. Il échoue aussi si une donnée d'entrée gelée (couches POI, OSM, routes, scène, BD TOPO, BAN) ou le code qui applique les registres a changé.

## 8. Contrôles

`check:places-canonical`, `check:road-names`, `check:poi-building-links`, `check:search-targets`, `check:semantic-freeze`, et `check:landmark-positioning`, adapté au registre. Tous font partie de `npm run check:all`.
