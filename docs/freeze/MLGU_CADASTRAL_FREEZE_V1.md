# MLGU — Gel cadastral V1 (V3.4)

**Doctrine.** La V3.4 **ajoute** une couche géographique officielle, les parcelles du plan cadastral de la commune 10220, sans modifier aucune donnée gelée auparavant :

- les **42 fichiers géographiques** du gel V2.2 restent identiques octet pour octet (référence `309e65e`) ;
- les **52 fichiers** du Freeze Unreal V1 gardent leurs hachages ;
- le **gel sémantique V2.9.2** (registres, décisions, projections, anomalies) est inchangé ;
- la nouvelle couche a son propre manifeste, `MLGU_CADASTRAL_FREEZE_MANIFEST_V1.json` : elle n’est ajoutée à aucun ancien manifeste ;
- `unreal/` n’est pas modifié ; l’export de la couche vers Unreal sera une décision ultérieure.

## Contenu gelé

| Fichier | Rôle |
|---|---|
| `data-sources/cadastre-parcelles-v34/pci-express-parcelle-10220-page-0*.json.gz` | 6 réponses WFS telles que reçues (PCI Vecteur, édition 2026-06-01) |
| `data-sources/cadastre-parcelles-v34/source-manifest.json` | source, service, filtre, édition, licence, SHA-256 des octets reçus, tentative Etalab |
| `data-sources/cadastre-parcelles-v34/wfs-capabilities-parcelle.xml` | déclaration du service (« PCI Vecteur : Parcelles ; Édition 2026-06-01 ») |
| `data-sources/cadastre-parcelles-v34/pci-express-parcelle-10220-l93-control.json.gz` | 300 parcelles servies en Lambert-93, contrôle de projection |
| `data-sources/cadastre-parcelles-v34/etalab-attempt.log`, `etalab-2026-09-01-index-10220.html` | preuve de la tentative Etalab et de l’édition plus récente listée |
| `data-sources/cadastre-parcelles-v34/build-report.json` | statistiques mesurées de la préparation |
| `public/data/cadastre-parcels-v3.4.json` | copie de rendu : sommets partagés au centimètre, parcelles, limites dédupliquées, catégories de style |
| `docs/freeze/MLGU_CADASTRAL_PARCELS_V1.json` | registre : référence, contenance, surface, catégorie, secteur, occupation du sol, bâtiments liés géométriquement, anomalies |
| `docs/audit/V3.4_CADASTRAL_ANOMALIES.csv` | anomalies et décisions |

Le code du pipeline (`scripts/cadastre-v34/fetch-*.mjs`, `build-cadastre.mjs`) et les deux fichiers de projection qu’il utilise (`src/geo.js`, `scripts/terrain-frame.mjs`) sont gelés avec la couche.

## Contrôles

| Commande | Ce qu’elle garantit |
|---|---|
| `check:cadastre-source` | source, édition et licence ; SHA-256 des réponses ; pagination complète ; commune 10220 seule ; aucun attribut de propriétaire |
| `check:cadastre-geometry` | mêmes parcelles et identifiants que la source ; trous et parties conservés ; écart à la source reprojetée ≤ 7,1 mm (arrondi seul) ; projection Lambert-93 contrôlée ; limites uniques ; emprise et couverture |
| `check:cadastre-building-links` | relations bâtiment / parcelle recalculées par aire d’intersection et identiques au registre ; aucune parcelle inventée |
| `check:cadastre-v33-replacement` | aucun terrain, limite, haie, muret, clôture ni arbre du générateur V3.3 dans le rendu V3.4 |
| `check:cadastre-freeze` | fichiers et code identiques au manifeste ; reconstruction déterministe ; anciens gels intacts |

Les cinq contrôles font partie de `check:all`.

## Changer la couche

Pour une nouvelle édition du cadastre :

1. supprimer `data-sources/cadastre-parcelles-v34/` puis lancer `npm run fetch:cadastre-v34` ;
2. lancer `npm run build:cadastre-v34` ;
3. relire les anomalies ;
4. ouvrir un **gel cadastral V2** : nouveau manifeste et nouveau document. Ne jamais réécrire celui-ci.
