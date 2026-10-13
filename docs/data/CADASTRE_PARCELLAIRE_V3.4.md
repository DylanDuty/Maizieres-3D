# Parcellaire cadastral V3.4 — provenance, méthode, limites

Couche ajoutée en V3.4 : les **parcelles du plan cadastral** de Maizières-la-Grande-Paroisse (INSEE 10220). Elle remplace, dans le mode `premium-v34`, les terrains interprétés de la V3.3.

## 1. Source

| Élément | Valeur |
|---|---|
| Producteur | DGFiP, plan cadastral informatisé (PCI Vecteur) |
| Diffusion utilisée | IGN, Parcellaire Express (PCI) : service WFS de la Géoplateforme, couche `CADASTRALPARCELS.PARCELLAIRE_EXPRESS:parcelle` |
| Titre et édition déclarés par le service | « PCI Vecteur : Parcelles ; Édition 2026-06-01 » (`data-sources/cadastre-parcelles-v34/wfs-capabilities-parcelle.xml`) |
| Filtre | `code_insee='10220'`, tri par `gid`, 6 pages de 1 000 |
| Système de coordonnées | CRS84 (longitude, latitude, WGS84) |
| Téléchargement | 13 octobre 2026 (`source-manifest.json`, champ `retrievedAt`) |
| Volume | 5 456 parcelles, `numberMatched = 5456` |
| Licence | Licence Ouverte / Open Licence 2.0 (Etalab) |
| Attribution | IGN — Parcellaire Express (PCI), d’après le plan cadastral DGFiP |
| Intégrité | SHA-256 des octets de chaque réponse, telle que reçue (`source-manifest.json`, `check:cadastre-source`) |

**Tentative Etalab.** L’export communal Etalab (`cadastre.data.gouv.fr`) a été tenté en premier. Son index est consultable par intermittence ; il liste l’édition **2026-09-01**, plus récente, et le fichier `cadastre-10220-parcelles.json.gz`. Le téléchargement redirige vers un stockage objet (`cadastre.s3.rbx.io.cloud.ovh.net`) que la politique réseau de l’environnement d’exécution refuse (403). Le journal brut est conservé (`etalab-attempt.log`, `etalab-2026-09-01-index-10220.html`).

La source canonique est donc le PCI Vecteur de l’édition 2026-06-01, diffusé par l’IGN. Une seule source et une seule édition sont utilisées : aucun mélange par parcelle. L’édition Etalab 2026-09-01 pourra être importée par `npm run fetch:cadastre-v34` dans un environnement qui autorise cet hôte ; le pipeline la préfère automatiquement.

**Contre-vérification.**

- **Projection** : 300 parcelles ont été redemandées au même service directement en Lambert-93 (EPSG:2154). La conversion du projet (proj4, `scripts/terrain-frame.mjs`) s’en écarte de 5,2 mm au plus, sur 2 890 sommets.
- **Calage sur le bâti** : il est mesuré sur la couche `batiment` du même producteur (`data-sources/cadastre/pci-express-batiment.geojson`, déjà au dépôt).

## 2. Ce qui n’est pas importé

- Aucune donnée de propriétaire, aucune matrice, aucune valeur foncière. Les attributs conservés sont la référence cadastrale (identifiant `idu`, section, feuille, numéro, contenance) et les codes communaux. `check:cadastre-source` refuse tout autre attribut.
- Les références cadastrales ne sont **pas affichées** dans l’interface publique ; elles n’apparaissent que dans le registre et le diagnostic technique.

## 3. Méthode (`scripts/cadastre-v34/`)

| Étape | Script | Résultat |
|---|---|---|
| Acquisition | `fetch-parcels.mjs`, `fetch-l93-control.mjs` (`npm run fetch:cadastre-v34`) | pages brutes compressées, manifeste source, capacités, échantillon Lambert-93 |
| Préparation | `build-cadastre.mjs` (`npm run build:cadastre-v34`) | copie de rendu, registre, anomalies, rapport de construction |
| Gel | `build-freeze.mjs` | `docs/freeze/MLGU_CADASTRAL_FREEZE_MANIFEST_V1.json` |
| Contrôles | `check-*.mjs` | `check:cadastre-source`, `-geometry`, `-building-links`, `-v33-replacement`, `-freeze` |

**Repères.**

- Les mesures métriques (surfaces, validité, chevauchements, couverture) sont faites en **Lambert-93**.
- Le rendu est dans le **repère local du moteur** (`src/geo.js` : x vers l’est, z vers le sud, en mètres, origine 3,7890245 / 48,5097657). C’est la même projection que les empreintes de bâtiments ; les couches V2 y sont amenées par le même chemin.
- Les coordonnées ne sont ni lissées ni simplifiées. La copie de rendu arrondit les sommets au centimètre : l’écart maximal mesuré est de 7,0 mm (`check:cadastre-geometry`).

**Topologie des limites.**

- Les sommets sont partagés dans une table unique.
- Les jonctions en T (63) sont découpées pour que deux parcelles voisines partagent exactement le même segment.
- Chaque limite n’est stockée qu’une fois : 25 695 limites, dont 16 467 partagées entre deux parcelles et 9 227 vers le domaine non cadastré (voirie, cours d’eau).

**Bâtiments et parcelles.**

- La relation est calculée par **aire d’intersection** entre chacune des 2 596 empreintes gelées et les parcelles, pas par le centroïde.
- Une parcelle est liée à un bâtiment quand elle porte au moins 5 % de son empreinte ; elle en est la parcelle principale à partir de 50 %.
- Cette relation est **géométrique, non juridique**.

**Catégorie de rendu.** Elle sert uniquement au style et ne décrit pas une occupation réelle. Elle est déduite :

- du bâti principal de la parcelle (classes V2.3.1, équipements du référentiel V2.9.2) ;
- à défaut, de l’occupation du sol V1.10 (champ, bois, eau à 50 % ou plus de la surface). Une parcelle non bâtie ou à annexes seules, à 50 % dans un périmètre industriel, commercial ou technique, est une « cour de site » : elle garde le sol du site et ne prend aucune teinte d’herbe.

## 4. Résultats mesurés (`data-sources/cadastre-parcelles-v34/build-report.json`)

| Mesure | Valeur |
|---|---|
| Parcelles brutes / importées | 5 456 / 5 456, aucune multipartie |
| Sections | 20 |
| Surface graphique totale | 1 953,3 ha (contenance fiscale cumulée 1 949,5 ha) |
| Surface médiane | 973 m² (10 % sous 154 m², 10 % au-dessus de 4 755 m²) ; 25 parcelles de moins de 5 m² |
| Trous | 13, dans 10 parcelles, tous conservés |
| Anneaux ouverts, sommets en double, anneaux dégénérés, auto-intersections | 0 |
| Identifiants en double | 0 |
| Chevauchements entre parcelles | 140 paires (8 218 m² au total, 609 m² au plus), dont 110 de plus de 1 m², surtout entre sections de remembrement (Z*) et sections anciennes |
| Couverture du contour communal (geo.api.gouv.fr) | 94,4 % : 1 924,5 ha sur 2 038,2 ha. Il reste 113,7 ha non cadastrés (voirie, eau, domaine public) et 27,9 ha de parcelles au-delà du contour généralisé |
| Bâtiments (2 596) | 1 848 dans une seule parcelle, 515 sur plusieurs (320 débords de moins de 20 %, 195 à cheval), 233 sans parcelle (228 hors de la commune, 5 dans la commune) |
| Parcelles bâties / avec plusieurs bâtiments principaux | 1 359 / 584 |
| Décalage cadastre / BD TOPO (817 paires, IoU > 0,6) | médiane 1,06 m, 90 % ≤ 2,27 m, 99 % ≤ 5,25 m, maximum 9,6 m |
| Catégories de rendu | habitation 849, équipement 8, ferme 13, activité 87, annexe seule 191, cour de site d’activité 87, champ 787, bois 2 375, eau 13, non bâti 1 046 |

Les anomalies parcelle par parcelle sont dans `docs/audit/V3.4_CADASTRAL_ANOMALIES.csv` (707 lignes). Le registre est `docs/freeze/MLGU_CADASTRAL_PARCELS_V1.json`.

## 5. Limites

- **Document fiscal.** Le plan cadastral est un document fiscal : **il ne fixe pas les limites juridiques des propriétés** et ne remplace pas un bornage.
- **Décalages.** Ses tracés peuvent s’écarter de l’orthophoto et du bâti IGN : 1 m en médiane ici. Ni le cadastre ni les empreintes gelées n’ont été déplacés pour les faire coïncider.
- **Ce qu’une limite ne prouve pas.** Une limite parcellaire ne prouve ni une clôture, ni une haie, ni un mur, ni un jardin. La carte n’en dessine aucun à partir d’elle.
- **Couverture.** Seule la commune 10220 est couverte. Les communes voisines visibles en bordure de la maquette n’ont pas de parcelles.
- **Édition.** Il s’agit de l’édition 2026-06-01 ; une édition plus récente existe chez Etalab (2026-09-01), non téléchargeable depuis l’environnement d’exécution (§ 1).
