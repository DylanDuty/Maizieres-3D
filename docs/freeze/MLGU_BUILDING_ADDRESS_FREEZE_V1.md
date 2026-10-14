# MLGU — Gel des adresses de bâtiments V1 (V3.4.2)

**Doctrine.** La V3.4.2 **ajoute** le registre des adresses des bâtiments et l’audit spatial des rues, sans modifier aucune donnée gelée :

- les 42 fichiers géographiques V2.2, identiques au commit `309e65e` ;
- les 52 fichiers du Freeze V1 ;
- le gel sémantique V2.9.2 (registres des lieux et des voies, décisions) ;
- le gel cadastral V1 (V3.4).

**Aucune géométrie** (bâtiment, route, parcelle) n’a été déplacée pour faire correspondre une adresse. Le nouveau registre a son propre manifeste, `MLGU_BUILDING_ADDRESS_FREEZE_MANIFEST_V1.json`. `unreal/` n’est pas modifié.

## Contenu gelé

| Fichier | Rôle |
|---|---|
| `data-sources/addresses-v342/*.json.gz` | réponses BAN, BAN PLUS et RNB, telles que reçues |
| `data-sources/addresses-v342/source-manifest.json` | sources, éditions, SHA-256, tentative d’export BAN national |
| `data-sources/addresses-v342/wfs-capabilities-*.xml` | déclarations des services (éditions BAN et BAN PLUS) |
| `data-sources/addresses-v342/build-report.json`, `roads-audit-report.json` | statistiques mesurées |
| `public/data/building-addresses-v3.4.2.json` | index chargé par la carte : statut de chaque bâtiment, numéros pour VERIFIED / MULTIPLE seulement |
| `docs/freeze/MLGU_BUILDING_ADDRESSES_V1.json` | registre : un bâtiment par ligne, statut, adresses, preuves, candidats, notes |
| `docs/audit/V3.4.2_ADDRESS_LINK_ANOMALIES.csv` | anomalies et décisions |
| `docs/audit/V3.4.2_ROADS_SPATIAL_AUDIT.csv` | audit spatial des 111 voies |

Le code est gelé avec le registre : `scripts/addresses-v342/fetch-addresses.mjs`, `build-addresses.mjs`, `scripts/roads-v342/audit-roads.mjs`, `src/addresses-v342.js` et `src/geo.js`.

## Contrôles

| Commande | Ce qu’elle garantit |
|---|---|
| `check:building-address-source` | sources, éditions, SHA-256, pagination complète, aucune donnée personnelle |
| `check:building-address-links` | reconstruction identique ; 2 596 bâtiments, un statut chacun ; règles (lieux protégés, une adresse sur un seul bâtiment, deux preuves, adresses multiples conservées) ; tests négatifs ; références indépendantes |
| `check:building-address-ui` | texte affiché pour chaque statut, lieux préservés, câblage de la sélection |
| `check:roads-spatial-v342` | audit reproductible, voies contrôlées une à une, règles et altérations détectées |
| `check:building-address-freeze` | fichiers et code identiques au manifeste ; anciens gels intacts |
| `check:notre-village-handoff` | carte relocalisable, guide de raccordement honnête |

## Changer le registre

1. Supprimer `data-sources/addresses-v342/`, puis lancer `npm run fetch:addresses-v342`.
2. Lancer `npm run build:addresses-v342`.
3. Relire les anomalies et l’audit routier.
4. Ouvrir un **gel d’adresses V2** : nouveau manifeste, nouveau document. Ne jamais réécrire celui-ci.
