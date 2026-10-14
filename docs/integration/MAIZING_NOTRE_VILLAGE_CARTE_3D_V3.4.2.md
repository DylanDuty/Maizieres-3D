# MAIZ’ING — raccordement de la carte 3D à « Notre Village → Carte du village » (V3.4.2)

> **Statut : préparation.** Ce document décrit comment raccorder la carte au jeu. **Aucune intégration n’a été faite ni testée dans MAIZ’ING** : le dépôt du jeu n’a pas été modifié et aucun résultat de test d’intégration n’est revendiqué ici.

## 1. Place de la carte dans le jeu

D’après la Bible `MLGU_ARCHITECTURE_MENUS_V1.2_2026-10-03`, le chemin est :

`Menu principal → Notre Village → Carte du village`

La rubrique **Notre Village** comporte quatre autres sections, que la carte ne remplace pas : `Album souvenirs`, `Carnet d’histoire`, `Lieux & patrimoine`, `La vie du village`. La carte est une **section parmi cinq**, pas le cœur du jeu.

## 2. Mode de distribution

| Option | Avantages | Inconvénients | Recommandation |
|---|---|---|---|
| **URL publique versionnée**, ouverte dans une `iframe` sur bureau et en plein écran sur téléphone | La carte reste un projet indépendant : rendu, données et versions séparés du jeu. Pas de duplication des POI ni du cadastre. Mise à jour de la carte sans republier le jeu. | Il faut un hébergement public stable. Les gestes tactiles sont à arbitrer dans l’iframe (§ 6). Le contexte WebGL vient en plus de celui du jeu. | **Recommandée** |
| Module interne au jeu (import des sources Three.js) | Une seule application, un seul chargement | Couplage fort : dépendances, version de Three.js, cycle de publication communs. Les données gelées seraient copiées dans le jeu. | Seulement si l’iframe est refusée par la plateforme du jeu |
| Lien externe (nouvel onglet) | Le plus simple | On sort du jeu ; le retour à « Notre Village » n’est pas garanti | Solution de repli |

**Ne jamais utiliser un artefact Claude comme URL de production.** Le lien `claude.ai/…/artifact/…` est **privé** : il sert aux essais, pas au public.

**Publication réelle recommandée : GitHub Pages du dépôt `Maizieres-3D`.** Ce qui existe déjà :

- un flux `.github/workflows/pages.yml`, qui construit avec `pnpm build` et `BASE_PATH` fourni par Pages ;
- un `vite.config.js` en `base: process.env.BASE_PATH || './'` ;
- le chargement de toutes les données par `import.meta.env.BASE_URL`.

**À faire avant la mise en production.**

- **Branche publiée.** Le flux ne publie aujourd’hui que d’anciennes branches (`opus/v1.4`, `opus/v2.0-…`). Il faut choisir la branche de production (après validation de l’utilisateur) et l’ajouter au déclencheur, ou passer par `workflow_dispatch`.
- **Tests d’accès public :**
  - page d’accueil, données `data/*.json` et fichiers `.bin`, avec le chemin de base `/Maizieres-3D/` ;
  - rechargement d’une URL avec paramètres ;
  - absence de ressource en `404`.
- **Choisir l’URL d’entrée du jeu**, par exemple `…/Maizieres-3D/?visual=premium-v34&v25quality=balanced`. La vue par défaut sans paramètre reste aujourd’hui l’ancienne interface V2. Il faut donc toujours passer `visual=premium-v34`, ou changer la vue par défaut dans une version dédiée.

## 3. En-têtes, intégration en iframe et sécurité

- **Hébergement du jeu.** Il doit autoriser le cadre (`frame-src` ou `child-src` incluant l’origine de la carte dans sa propre CSP).
- **Hébergement de la carte.** Il doit autoriser l’origine du jeu à l’encadrer : `frame-ancestors` en en-tête HTTP.
  - GitHub Pages ne permet pas de définir d’en-têtes. La carte y est donc encadrable par n’importe quel site. C’est acceptable pour une carte publique sans données personnelles.
  - Si l’on veut restreindre, il faut un hébergement qui pose `Content-Security-Policy: frame-ancestors <origine du jeu>`. Une balise `<meta>` ne suffit pas pour `frame-ancestors`.
- **Attributs conseillés :**
  ```html
  <iframe src="…" title="Carte du village" allow="fullscreen" loading="lazy" referrerpolicy="no-referrer">
  ```
  Pas d’`allow-same-origin` superflu si un `sandbox` est utilisé. La carte a besoin de `allow-scripts`.
- **Messages entre le jeu et la carte : aucun aujourd’hui.** S’il en faut (§ 7), vérifier `event.origin` des deux côtés contre une liste blanche, utiliser un schéma versionné et ne jamais envoyer de données avec `postMessage(…, '*')`.

## 4. Bureau et téléphone

| Écran | Comportement recommandé |
|---|---|
| Bureau | La carte occupe la zone de contenu de la section « Carte du village », dans une iframe d’au moins 900 × 560 px. Bouton « Agrandir » (plein écran de l’iframe). |
| Téléphone (portrait ou paysage) | Pas d’iframe dans une page qui défile. La section affiche une vignette et un bouton « Ouvrir la carte », qui ouvre la carte **en plein écran** (iframe plein écran ou vue dédiée), avec un bouton « Retour à Notre Village » toujours visible, hors de la zone de la carte. |

**Retour.** Le bouton « Retour à Notre Village » appartient au **jeu**, pas à la carte : la carte ne connaît pas la navigation du jeu. Le jeu conserve son propre état, et la carte ne le modifie pas.

## 5. Chargement, erreurs et lenteur

La carte apporte son propre écran de chargement V3.4.1 :

- « Découvrir Maizières » ;
- un message honnête si l’attente se prolonge ;
- « Impossible de préparer la carte. » avec Réessayer, si WebGL manque ou si une ressource fait défaut.

Le jeu n’a pas à le reproduire. Il suffit d’afficher la vignette de la section tant que l’iframe n’est pas ouverte.

## 6. Gestes et défilement

- Sur le canevas de la carte, `touch-action: none` : un doigt déplace la carte, deux doigts la tournent ou l’inclinent, le pincement zoome (V3.3.1). Dans une page du jeu qui défile, la carte capterait donc le défilement : c’est la raison du plein écran sur téléphone (§ 4).
- Sur bureau, la molette zoome la carte quand le pointeur est dessus. La page du jeu ne doit pas défiler sous l’iframe pendant ce temps : prévoir une zone de contenu sans défilement, ou un délai d’activation au clic.

## 7. Paramètres : contrat minimal

**Existant, stable** (lu par `src/main.js`) :

| Paramètre | Valeurs | Effet |
|---|---|---|
| `visual` | `premium-v34` (recommandé), `premium-v33`, `premium-v32`… | mode de rendu et interface premium |
| `v25quality` | `beauty`, `balanced`, `performance` | préset de qualité |
| `cam` | `x,y,z,tx,ty,tz` (mètres, repère local) | caméra et cible |
| `fxaa` | `0` | anticrénelage désactivé |

**Proposé, non implémenté.** À valider avant tout développement :

| Paramètre | Valeurs | Effet |
|---|---|---|
| `place` | identifiant du registre des lieux, ex. `poi:mairie` | ouvrir la carte centrée sur un lieu et le sélectionner (utile depuis « Lieux & patrimoine ») |
| `zone` | `bourg`, `poussey`, `les-granges`, `glaciere` | cadrage initial sur un secteur |

**Événements éventuels, de la carte vers le jeu.** Non implémentés. Par exemple `{type:'mlgu-map/ready', version:'3.4.2'}` et `{type:'mlgu-map/selected', placeId}`, envoyés à l’origine du jeu uniquement.

## 8. Mentions, licences et attributions à conserver

Elles sont déjà affichées par la carte et ne doivent pas être masquées par le jeu :

- **Mention permanente :** « Une interprétation 3D stylisée de Maizières-la-Grande-Paroisse · représentation non contractuelle ».
- **Panneau Informations, avec les sources :**
  - OpenStreetMap (ODbL) ;
  - IGN BD TOPO, BD ORTHO, LiDAR HD ;
  - RPG ;
  - plan cadastral DGFiP (PCI, Licence Ouverte 2.0) ;
  - Base Adresse Nationale, BAN PLUS (IGN) et RNB (Licence Ouverte 2.0) pour les adresses V3.4.2.
- **Le cadastre** ne constitue pas un bornage juridique.

## 9. Performance quand le jeu est ouvert

- **Chargement différé.** Ne créer l’iframe qu’à l’ouverture de la section (`loading="lazy"` ou création au clic). La carte pèse quelques dizaines de mégaoctets de données au premier chargement, mises en cache ensuite.
- **Pause hors écran.** Le navigateur suspend les animations (`requestAnimationFrame`) d’un onglet ou d’une iframe masquée.
- **Libération de la mémoire.** À la fermeture de la carte, retirer l’iframe du document pour rendre la mémoire GPU, plutôt que de la masquer.
- **Préset initial.** Sur téléphone, commencer en `balanced` ou `performance`. Le sélecteur Qualité reste disponible dans la carte.

## 10. Check-list de recette « Notre Village »

À exécuter **une fois le jeu effectivement connecté** ; aucune case n’est cochée à ce jour.

- [ ] La section « Carte du village » apparaît sous « Notre Village », à côté des quatre autres sections, sans les remplacer.
- [ ] URL publique (pas d’artefact privé) ; chemin de base correct ; aucune ressource en 404.
- [ ] Bureau : iframe affichée, chargement V3.4.1 visible, carte utilisable, molette sans défilement parasite.
- [ ] Téléphone portrait et paysage : ouverture en plein écran, gestes à un et deux doigts, bouton « Retour à Notre Village ».
- [ ] Retour au jeu : état du jeu conservé.
- [ ] WebGL absent : message « Impossible de préparer la carte. », le jeu reste utilisable.
- [ ] Mentions et sources visibles dans la carte.
- [ ] Mémoire : ouverture et fermeture répétées sans croissance continue.
- [ ] Clic sur une maison : adresse vérifiée ou mention honnête ; clic sur un lieu : sa fiche.

## 11. Travaux restant côté MAIZ’ING

| Tâche | Responsable | Prérequis |
|---|---|---|
| Valider le principe iframe + plein écran sur téléphone | utilisateur | ce document |
| Choisir et publier l’URL de production (GitHub Pages ou hébergement du jeu) | dépôt carte | validation utilisateur |
| Ajouter la section « Carte du village » au menu Notre Village | dépôt jeu | URL publique |
| Vignette, bouton « Ouvrir la carte », bouton « Retour à Notre Village » | dépôt jeu | maquette de la section |
| CSP du jeu (`frame-src`) | dépôt jeu | URL publique |
| (Option) paramètres `place` / `zone` et événements | dépôt carte puis jeu | contrat validé (§ 7) |
| Recette § 10 | les deux | intégration effective |

## 12. Placement de principe (texte, sans illustration)

```
┌─ Notre Village ──────────────────────────────────────────────┐
│ [Album souvenirs] [Carnet d’histoire] [Lieux & patrimoine]   │
│ [La vie du village] [Carte du village ●]                     │
├──────────────────────────────────────────────────────────────┤
│  Carte du village                        [Agrandir] [Retour]  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  iframe : carte 3D (chargement V3.4.1, puis la carte)   │  │
│  └────────────────────────────────────────────────────────┘  │
│  Interprétation 3D stylisée · non contractuelle              │
└──────────────────────────────────────────────────────────────┘
```
