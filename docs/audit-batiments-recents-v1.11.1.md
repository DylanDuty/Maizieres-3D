# Audit ciblé des bâtiments récents sans association (V1.11.1)

## Portée

Cet audit ne reprend pas les 2 494 bâtiments. Il examine seulement les lieux actuels de V1.11 restés sans bâtiment associé et qui désignent manifestement un bâtiment ou un local. Sont exclus les lieux-dits, les zones, les terrains de sport, les ouvrages, les antennes, les croix et le cimetière.

- Les bâtiments existants ne sont pas modifiés ; seule l’association lieu → `building_id` change.
- Rapport machine : `data-sources/buildings-audit-v1.11.1/recent-buildings-audit.json`.
- Décisions : `data-sources/buildings-audit-v1.11.1/decisions.json`.

## Sources

- Référentiel bâti gelé V1.6.2.
- BAN et BAN PLUS (liens adresse – bâtiment), instantanés V1.11.
- **RNB** :
  - instantané du 24/09/2026 ;
  - requêtes API par boîte de ± 150 m autour des 6 emplacements, le 25/09/2026.
- **BD TOPO bâtiment** et **Parcellaire Express bâtiment** : fraîchement extraits sur les mêmes boîtes.
- Orthophoto IGN d’avril 2025 : contrôle visuel uniquement.

Reproduction : `npm run data:recent-buildings-fetch` (instantanés manquants seulement), `npm run data:poi` puis `npm run audit:recent-buildings`.

## Résultat

- **20 cas examinés** : 10 avec position, 10 sans position. Aucun n’avait de bâtiment associé au départ.
- **9 associations corrigées**. Le bâtiment existait déjà dans le référentiel dans tous les cas :

| Lieu | Adresse | Bâtiment associé | Preuve | Écart du point BAN |
|---|---|---|---|---|
| AMITR, UPREN, Interface 10, GEIQ Sud Champagne | 2 av. Philippe-Séguin | BATIMENT0000002006956399 | RNB C5WQ3RJ4FPEP porte cette adresse | point BAN sur la chaussée, à 133 m du centre du bâtiment |
| Action | 9 bd Antoine-de-Saint-Exupéry | BATIMENT0000002006956391 (bâtiment commercial multi-cellules) | RNB XX2T6M3PFBBH (cellule du bâtiment) | 60 m |
| Maison médicale Michel-Bourcier | 31 av. du Général-de-Gaulle | BATIMENT0000002477590538 (BD TOPO du 24/06/2024) | point BAN « entrée » à 0,1 m de la façade ; RNB PAV65ZVZXWQB | 10 m |
| Luc-Pierre Rafanot (maçonnerie) | 97 rue Joliot-Curie | BATIMENT0000000301151981 | RNB ANW52GK2J8D3 porte cette adresse | **248 m** : le point BAN (segment) est en plein champ, l’adresse est imprécise |
| Stade (vestiaires) | angle rue du Stade / Voie aux Vaches | BATIMENT0000000325110358 (usage sportif) | BIBLE_01 §7.10, BAN 1 rue du Stade + BAN PLUS, RNB V68HEYWMFD2M | 91 m (le lieu est ancré au centre du terrain) |
| Village Seniors | 1 à 16 rue des Sages | BATIMENT0000002006956376, …386, …388 | BAN PLUS, RNB 2F3ZTW1SKYH9, 2VZFK9Y9DVNY, 9XXBS36YFBG2 | 37 m |

Pour chacun, l’orthophoto montre le bâtiment. Quand le point du lieu n’est pas sur le bâtiment, `building_position` donne le centre de l’empreinte associée (L93 et Unreal) pour le placement dans Unreal ; le point du lieu lui-même n’est pas déplacé.

- **Bâtiments réellement manquants : 0.** Aucune empreinte BD TOPO ou cadastrale actuelle désignant un de ces lieux n’est absente du référentiel. Les seules empreintes absentes des boîtes de contrôle sont des constructions de 8 et 13 m², sans rapport avec les lieux.
- **Bâtiments ajoutés : 0.** Le total reste **2 494 bâtiments, dont 2 265 dans la commune** ; le référentiel V1.6.2 n’est pas amendé.
- **Visibles sans géométrie publique fiable : 0.**
- **Lieux imprécis : 11**, avec `building_geometry_missing = true` et la raison :
  - Optique de l’Aérodrome / Krys : « 6 av. Philippe-Séguin » n’a ni lien BAN PLUS ni bâtiment RNB, et le point BAN est sur la chaussée. La « cellule A2 d’un bâtiment A » de la BIBLE_05 ne désigne pas un bâtiment officiel sans deviner.
  - 10 lieux sans adresse exploitable :
    - « 53 rue de l’Orme », absent de la BAN et du RNB (Maizières Automobiles / Aub’Récup Auto) ;
    - La Halle / PEGASE (bâtiment A1) ;
    - Centre de Contrôle et de Sécurité, Aub’Pneus, SICAM, Aub’Transport, Usine Atlantem (ZI La Glacière sans numéro) ;
    - Restaurant Le Relais ;
    - salle des fêtes ;
    - Maison des Papillons.

## Pour Unreal

- Les 9 lieux corrigés ont un `building_id` : l’enseigne ou le repère se pose sur ce bâtiment, à la position `building_position` quand elle est donnée.
- Les 11 lieux imprécis (`building_geometry_missing`) ne sont pas placés sur un bâtiment. Rien n’est dessiné à la main ; il faut d’abord une adresse BAN, un identifiant RNB ou un relevé sur place.
