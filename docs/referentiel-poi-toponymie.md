# Référentiel des lieux, du patrimoine et de la toponymie — Unreal (V1.11)

Le bâti (V1.6.2), le terrain (V1.7), la voirie (V1.8), le ferroviaire (V1.9), l’occupation du sol (V1.10), `UNREAL_ORIGIN` et les six Bibles sont gelés et seulement lus ; `check:poi` vérifie leurs SHA-256. Les chiffres viennent de `data-sources/poi/poi-report.json`.

**Règle absolue** : une information historique n’est jamais présentée comme actuelle. Un lieu n’apparaît sur la carte actuelle (`displayCurrent`) que s’il remplit trois conditions :
- son statut est `actuel` ;
- sa position est fiable ;
- sa preuve est suffisante, c’est-à-dire :
  - une source officielle ;
  - ou une Bible datée d’au moins 2023 ;
  - ou la liste des repères de la BIBLE_01 §11 ;
  - ou une Bible corroborée par OSM.

OSM seul ne suffit jamais.

## 1. Sources

| Source | Organisme | Date | Rôle |
|---|---|---|---|
| **BAN** `BAN.DATA.GOUV:ban` (1 397 adresses dans l’emprise, 1 099 dans la commune) | BAN / commune | instantané du 25/09/2026 | positions d’adresse, **forme officielle des noms de voies** |
| **BAN PLUS** `lien_adresse_bati` (2 420 liens) | IGN | 25/09/2026 | lien adresse → bâtiment BD TOPO (donc référentiel V1.6.2) |
| **BD TOPO** : toponymie (131), lieux-dits non habités (56), zones d’habitation (22), constructions ponctuelles (17) | IGN | 25/09/2026 | lieux-dits, quartiers, points de toponymie (ponts, PN), clocher |
| BD TOPO zones d’activité (34), réservoirs, cimetières, terrains de sport | IGN | instantanés V1.10, relus | équipements, périmètres, châteaux d’eau |
| Servitudes d’utilité publique (Géoportail de l’urbanisme) : générateurs et assiettes | État / GPU | 25/09/2026 | recherche de monuments historiques : **aucune servitude AC1** dans l’emprise (seulement PPRi, voies d’eau, lignes électriques I4, T1) |
| OSM (instantané du projet, 31/05/2026) | contributeurs | 2026 | complément ; corrobore, ne crée jamais un lieu actuel seul |
| Voirie V1.8, ferroviaire V1.9, occupation du sol V1.10 | projet | gelés | `road_id`, carrefours, pont de la Seine, pont de la rue de l’Orme, PN, hydronymes |
| **BIBLE_01** (cartographie), **BIBLE_03** (patrimoine), **BIBLE_04** (vie locale), **BIBLE_05** (associations et commerces) | projet | V1.0 à V1.2 | lieux, statuts, adresses, noms locaux |
| BIBLE_02 (histoire) | projet | V1.1 | distinguer historique et actuel (dates, disparitions) |
| BIBLE_06 (mémoire locale) | projet | V1.0 | **contexte uniquement** : un souvenir ne crée jamais un lieu |

Services inaccessibles (refusés par le proxy) : api-adresse / adresse.data.gouv.fr (la BAN est prise sur la Géoplateforme), Mérimée / POP (culture.gouv.fr), annuaire de l’éducation, recherche-entreprises (SIRENE).

Bibles :
- `data-sources/poi/bible-places-v1.11.json` rassemble 506 extraits de lieux, 60 entrées de toponymie et 12 renommages, établis par lecture assistée ;
- chacun porte une **citation exacte** d’une ligne de la Bible (1 036 citations vérifiées par `build-poi` et `check:poi`) ;
- `poi-curation-v1.11.json` regroupe 70 lieux clés : il fusionne les sources, fixe l’ancrage et le rang de landmark, et ne dessine aucune géométrie.

## 2. Modèle

Chaque lieu (`unreal/poi/poi.json`) porte :
- identification : `id` stable, `name`, `type`, `category` ;
- statut :
  - `status` : actuel, ancien, historique, disparu ou incertain ;
  - `current_or_historical` : current, historical ou uncertain ;
  - `displayCurrent` ;
- position :
  - `geometry` : point WGS84 ou `null` ;
  - `geometryKind` et `positionSource` ;
  - `L93` et `unreal_position` en cm, origine gelée : X = (E − 758278) × 100, Y = −(N − 6823571) × 100, Z = altitude du terrain × 100 ;
  - `orientation` : `null` (aucune orientation documentée) ;
- liens : `building_id` / `building_ids` (empreintes V1.6.2, non modifiées), `road_id` (V1.8), `address`, `ban_id` ;
- provenance : `source`, `sources` avec citations, `confidence` A, B ou C ;
- `variants`, `conflicts`, `contents` (patrimoine mobilier de l’église) ;
- Unreal : `visual_priority`, `unreal_asset_priority = landmark`, `landmark_priority`.

Natures de géométrie :

| `geometryKind` | Sens | Lieux |
|---|---|---|
| officielle | géométrie d’une base officielle (empreinte, périmètre BD TOPO) | 24 |
| documentaire | adresse BAN, carrefour ou tronçon V1.8 documentés | 90 |
| approximative | point approché (proximité documentée, lieu-dit ± 20 à 30 m, limite OSM) | 60 |
| ponctuelle | point seulement, sans limite (toponyme, quartier BD TOPO « fictif ») | 76 |
| sans géométrie | nom documenté sans position fiable | 117 |

Liens aux bâtiments :
- 81 lieux sont reliés à 114 bâtiments du référentiel ;
- le lien vient :
  - du lien officiel BAN PLUS, en priorité ;
  - sinon d’un périmètre BD TOPO de moins de 2 ha ;
  - sinon d’un point situé dans l’empreinte ;
- aucune empreinte n’est modifiée.
- Adresses sans empreinte : la maison médicale (31 av. du Général-de-Gaulle, 2023-2024) et plusieurs cellules du Parc de l’Aérodrome n’ont pas d’empreinte à leur adresse BAN. Ce sont probablement des bâtiments récents ; c’est signalé, et le référentiel bâti n’est pas modifié.

## 3. Chiffres

- **367 lieux** :
  - 222 dans la commune, 28 hors commune (lieux-dits BD TOPO de l’emprise), 117 sans géométrie ;
  - **226 actuels, 95 historiques** (ancien 54, historique 28, disparu 13), **46 incertains** ;
  - **128 affichés sur la carte actuelle**.
- **Équipements publics** : 24, dont 13 actuels :
  - mairie, école, accueil de loisirs Les Galopins, Maison des Associations, salle polyvalente ;
  - CPI, cimetière, IME, square AFN, aire d’accueil, Village Seniors ;
  - MAM et captage Sainte-Amandine, tous deux sans position.
- **Équipements sportifs** : 7, dont 6 actuels :
  - stade, boulodrome couvert ;
  - terrains de football, de tennis et de basket (BD TOPO) ;
  - terrain de tir à l’arc (sans position).
- **Santé** : 7, dont 4 actuels : pharmacie Sasportès, maison médicale, cabinet paramédical, AMITR.
- **Commerces et entreprises** : 122. **36 actuels**, dont **13 affichés** :
  - À Vos Couverts, Au Point, La Baguette des Granges, Le Bistrot à Tattoo, Tabac-presse – Point Poste ;
  - Nord Poêle du Romillon, Brocante Éric Gras ;
  - Cash Express, BUT, Wok Xu, McDonald’s (Parc de l’Aérodrome) ;
  - Carrosserie Serbource, dépôt Sévéal.

  Les 22 autres commerces actuels ont une dernière preuve antérieure à 2023, ou non datée, sans corroboration : ils restent en confiance C, à reconfirmer, non affichés. 86 commerces sont anciens, disparus ou incertains.
- **Patrimoine** : 26, dont 4 actuels (église Saint-Denis, monument aux morts, Croix des Granges, Croix des Ormes). À cela s’ajoutent 18 éléments de patrimoine mobilier rattachés à l’église (cloches, statues, vitraux, dont 2 disparus). Les 22 autres sont historiques, disparus ou incertains.
- **Lieux-dits** : 131, dont 90 dans la commune. BD TOPO et OSM sont fusionnés quand le nom concorde. 28 lieux-dits OSM seuls, issus du cadastre, restent en confiance B, non affichés.
- **Secteurs** : Maizières (zone bâtie officielle), centre-bourg, Poussey, Les Granges, Le Craon, lotissements du Soleil Levant, du Petit Village et du Clos des Roy.
- **Zones** (`unreal/poi/areas.json`) : 149.
  - 11 polygones : 10 officiels BD TOPO (zone bâtie de Maizières, ZI La Glacière, Parc de l’Aérodrome, La Belle Idée, stade, enceinte militaire, Sévéal, centrale photovoltaïque, parc éolien, aire d’accueil) et 1 approximatif (Aéromia, OSM).
  - 123 points et 15 noms sans position.
  - **Aucun polygone n’est dessiné autour d’un nom** : Poussey, Les Granges et le centre-bourg restent des points.

## 4. Lieux et secteurs clés

| Lieu | Géométrie | Ancrage | Bâtiment |
|---|---|---|---|
| Église Saint-Denis | officielle | empreinte (BD TOPO + OSM église), clocher BD TOPO rattaché | BATIMENT0000000301149566 |
| Mairie, 6 rue des Écoles | documentaire | BAN + BAN PLUS | oui |
| École primaire, 3 rue Jules-Ferry | documentaire | BAN (BD TOPO donne le n° 8, ancienne maternelle : conflit signalé) | 12 bâtiments du groupe scolaire |
| Ancien presbytère, 15 rue Pasteur | documentaire | BAN + BAN PLUS ; **fonction historique** (vendu avant 2017), bâtiment existant | oui |
| Poussey, Les Granges | ponctuelle | BD TOPO quartier « fictif » : pas de limite officielle | — |
| Centre-bourg | ponctuelle | repère à l’église (BIBLE_01 §8.1 : « autour de l’église, de la mairie, des écoles ») | — |
| Parc de l’Aérodrome, La Glacière | officielle | périmètres BD TOPO (le Parc est à cheval sur Romilly) | — |
| Gué de la Chapelle | documentaire | nœud V1.8 RD619 × D160 | — |
| Pont sur la Seine | documentaire | tronçon V1.8 de la D116 en pont | — |
| Pont de la rue de l’Orme | documentaire | passage supérieur V1.9 | — |

## 5. Landmarks Unreal (`unreal/poi/landmarks.json`)

Ce classement sert au futur travail 3D. Il ne modifie pas la carte actuelle et aucun modèle n’est créé.

- **Priorité 1**, indispensable à la reconnaissance : église Saint-Denis, mairie, école primaire.
- **Priorité 2**, importante : monument aux morts, salle polyvalente, château d’eau de Poussey (25,3 m), château d’eau entre le bourg et Les Granges (27,6 m), pont sur la Seine, pont de la rue de l’Orme.
- **Priorité 3**, secondaire : cimetière, stade, centre de première intervention, ancien presbytère, Gué de la Chapelle, PN 73, dépôt Sévéal, Croix des Ormes / Croix de Poussey.
- La Croix des Ormes n’a **pas de position** : elle a été déplacée d’environ 100 m, sur un terrain privé, et reste à relever avant modélisation.
- Non retenus :
  - **moulin de Poussey** : disparu ou ruiné dès le début du XXe siècle, présence actuelle non documentée ;
  - **demeure (château) de Poussey** : existante en partie selon la documentation, mais abandon signalé et contrôle terrain 2026 nécessaire, donc incertaine ;
  - **ancienne gare** : détruite.

## 6. Toponymie

- **Voies** : 94 noms consolidés (BAN, BD TOPO voie nommée, OSM, BIBLE_01 §4.1).
  - La forme officielle est celle de la BAN. Aucune graphie n’est remplacée.
  - 41 voies concordent exactement.
  - 35 ne diffèrent que par la typographie : traits d’union de la Bible, accents absents de la BAN.
  - **5 conflits** :
    - Rue Basse de Poussey / « Poussay » (OSM) ;
    - Rue des Cottrets / « Cotterets » (OSM) ;
    - Rue du Pot Bancelin / « Pont Bancelin » (OSM) ;
    - « Rue Patris » (OSM, forme tronquée) ;
    - « Rue du Pont » (BIBLE_01), à réconcilier avec Rue du Pont-de-Clairvaux.
  - 4 voies OSM absentes de la BAN, 4 présentes dans la Bible et OSM mais pas dans la BAN (Chemin de la Pie, Ruelle des Granges…), 2 dans la Bible seule.
- **Lieux-dits** : 65 variantes documentées, dont 6 orthographiques. Exemples : le Beau Mont / Le Beaumont, le Crot aux Laines / Le Croc aux Laines, Pré Cossa / Le Pré Cossat, le Crot Tonnerre / Le Croc Tonnerre, le Pont Bancelin / Pot Bancelin.
  - Aucun appariement entre points cardinaux (« Est » ≠ « Ouest »).
  - « Lechère » et « Les Léchères » restent distincts, conformément à la BIBLE_01.
- **BIBLE_01 et BIBLE_03** : 60 entrées :
  - 21 odonymes non validés ;
  - 9 corrections ;
  - 8 variantes orthographiques ;
  - 7 anciens noms (dont RN19 → RD619, rue ou avenue de la Gare → corridor du Général-Leclerc) ;
  - 6 conflits de graphie ;
  - 5 anomalies d’adressage ;
  - 4 noms locaux.
- **Renommages** : 12 (BIBLE_02 et BIBLE_06), dont Maizières-sur-Seine → Maizières-la-Grande-Paroisse et le café Joly devenu café des Bédouins puis du Mini-Golf.
- **Hydronymes** : 8. Sont absents de l’hydrographie officielle : canal de Poussey, cours d’eau des Menus Prés, fossé des Épinettes et mare aux Canards (disparue). « Rivière du Moulin » n’existe que dans OSM et la Bible (BD TOPO : Ruisseau / Bras des Moulins de Poussey).
- **Noms sans géométrie** :
  - 27 noms actuels, dont Maison des Papillons, Croix des Granges, Croix des Ormes, salle des fêtes, parking du champ de foire, terrain de tir à l’arc, entreprises de la ZI sans adresse ;
  - 9 odonymes locaux (chemin Noir, chemin à Leroy, chemin du Pot Bancelin…) ;
  - 7 anciennes sections cadastrales.

## 7. Incohérences et incertitudes ouvertes

- Adresses divergentes :
  - école : 3 (Bibles) ou 8 (BD TOPO) rue Jules-Ferry ;
  - Baguette des Granges : 25, 23 bis ou 25 bis ;
  - Carrosserie Serbource : 18 ZI La Glacière ou 10 rue de la Zone Industrielle.
- **OSM obsolète** : la « Pharmacie Saint-Dennis » est encore active dans OSM, alors qu’elle a été transférée au 29 avenue du Général-de-Gaulle en 2022. Elle est gardée comme ancienne, non affichée.
- 46 lieux incertains, dont la demeure de Poussey, les croix de Maizières et de la place Saint-Denis, et des entreprises de la ZI.
- 22 commerces actuels selon une Bible, mais sans preuve depuis 2023.
- 28 lieux-dits OSM seuls.
- Bâtiments récents absents du référentiel gelé (maison médicale, cellules du Parc de l’Aérodrome).
- 23 extraits non cartographiés :
  - 12 souvenirs seuls (BIBLE_06) ;
  - 5 habitations privées liées à une personne ;
  - 2 mentions génériques ;
  - 1 lieu hors commune ;
  - 3 mentions de la ligne ferroviaire, déjà en V1.9.

## 8. Fichiers et diagnostic

| Fichier | Contenu |
|---|---|
| `unreal/poi/poi.json` | 367 lieux (position Unreal, bâtiment, voie, statut, confiance, sources et citations) |
| `unreal/poi/areas.json` | 149 secteurs, lieux-dits et zones (polygone seulement si une limite existe) |
| `unreal/poi/landmarks.json` | 17 landmarks P1/P2/P3 et lieux non retenus |
| `public/data/poi.json` | couche Three.js (250 lieux positionnés, 11 zones) |
| `data-sources/poi/poi-report.json` | rapport machine (sources, chiffres, toponymie complète, incertitudes) |
| `data-sources/poi/bible-places-v1.11.json`, `poi-curation-v1.11.json` | extraits des Bibles (citations exactes) et curation |

- Reproduction : `npm run data:poi-fetch` (instantanés manquants seulement), puis `npm run data:poi`, puis `npm run check:poi`.
- `?diagnostic=poi` affiche :
  - des marqueurs colorés par statut : actuel affiché, actuel à confirmer, incertain, historique ;
  - la confiance par la hauteur du marqueur ;
  - les lieux-dits et secteurs en disques ;
  - les landmarks par un anneau doré dont la taille suit la priorité ;
  - les limites officielles ou approximatives.

  Le clic sur un lieu, une zone ou un bâtiment relié affiche le nom, le type, le statut, la confiance, les sources et les citations. Aucune étiquette permanente n’est ajoutée, et le rendu normal est inchangé.
