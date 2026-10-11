# QA V3.0 — contours d'environnement

Chaque planche montre en haut la V2.9.2 (`?visual=cartoon-v291`) et la V3.0 (`?visual=premium-v30`), BEAUTÉ, 1280 × 800, même caméra (distance 420 m, azimut 25°, élévation 42°, zoom maximal de la carte), centrée sur une limite réelle choisie dans les polygones gelés. En bas, le rectangle blanc central (320 × 200 pixels) est agrandi deux fois **au plus proche voisin** : ce sont les pixels réels, sans lissage d'agrandissement. Chromium headless, SwiftShader.

| Planche | Limite (coordonnées locales, m) | Commentaire |
|---|---|---|
| `bois-1.jpg` | bois / prairie (−284, −1 683), bandes boisées étroites | V2.9.2 : bandes en dents de scie de 8 m. V3.0 : chaque bande suit son polygone, bords nets sans marche ; les trouées entre bandes sont celles de la donnée. |
| `bois-2.jpg` | bois / culture (1 466, −1 786), clairière cultivée | V2.9.2 : la clairière est un escalier de 8 m. V3.0 : contour droit du polygone, lisière éclairée et ourlet sombre au sol. |
| `bois-3.jpg` | bois / prairie (−953, −2 348), ruisseau sous couvert | V2.9.2 : marches régulières bien visibles dans l'agrandissement. V3.0 : lisière courbe continue ; le corridor du ruisseau sous la canopée (V2.9) est conservé. |
| `bois-4.jpg` | bois / prairie (−598, −2 298) | Même correction : plus de crénelage de 8 m ; profil de lisière irrégulier (26 à 46 % de la hauteur) au lieu d'un gradin constant. |
| `bois-5.jpg` | bois / culture (−1 128, −865), chemin en lisière | V2.9.2 : la canopée en escalier mord sur le chemin. V3.0 : la masse s'arrête sur la limite, le chemin de terre reste continu. |
| `champs-1.jpg` | blé tendre d'hiver / orge d'hiver (1 610, 313) | V2.9.2 : liseré vert crénelé au pixel et rayures fortes. V3.0 : accotement pâle continu, sillons fins discrets. Les deux céréales ont des teintes voisines : la limite se lit moins qu'avant. |
| `champs-2.jpg` | betterave / orge d'hiver (−272, 1 457), chemin | V2.9.2 : bordure verte en marches le long du chemin. V3.0 : chemin et bords lisses, deux teintes de culture distinctes. |
| `champs-3.jpg` | surface non exploitée / chanvre (260, −788), lisière proche | V2.9.2 : lisière en escalier et motifs arrêtés en marches. V3.0 : lisière et bords de parcelle lisses. |
| `champs-4.jpg` | chanvre / blé tendre d'hiver (136, 799) | V3.0 : plus de crénelage ; sauge et ocre doux au lieu de vert-jaune saturé. |
| `champs-5.jpg` | surface non exploitée / jachère (−11, −1 231), rivière et bois voisins | V3.0 : bords lisses, berge herbeuse, eau bleu-gris au lieu de blanc-cyan ; lisière du bois voisin sur sa vraie limite. |
| `prairie-culture-1.jpg` | prairie / culture (−1 407, −639) | V2.9.2 : déjà assez doux à cette distance, mais liseré vert légèrement crénelé. V3.0 : fondu de classe propre ; la prairie perd son moucheté peint (variation par shader seulement). |
| `prairie-culture-2.jpg` | prairie / culture (−639, −329) | V3.0 : transition lisse, sans marche ; lisière du bois voisin corrigée. |
| `prairie-culture-3.jpg` | prairie / culture (340, 1 220) | V3.0 : limite lisse, prairie et céréale bien distinctes. Les petits rectangles visibles dans la prairie sont des objets de la donnée, présents dans les deux versions. |
| `riviere-1.jpg` | Bras de la Noue de Ferloup (1 805, −1 005) | Ruisseaux sous la canopée toujours visibles (corridor V2.9). V3.0 : eau bleu-vert, berge fondue ; le ruban se lit moins fort qu'en blanc-cyan mais reste continu. |
| `riviere-2.jpg` | Ruisseau des Moulins de Poussey (618, −688) | V2.9.2 : ripisylve en escalier. V3.0 : bois sur ses limites réelles, ruban d'eau continu, transition douce vers le village. |
| `riviere-3.jpg` | la Seine (−942, −1 889) | V3.0 : rive nette et naturelle ; les bandes boisées à droite ne sont plus en dents de scie. Quelques éclats clairs sur l'eau (reflets animés). |
| `frange-1.jpg` | village / culture (616, −289) | V2.9.2 : bord dur entre pelouse et champ. V3.0 : la pelouse déborde en fondu de 6 m ; une limite de parcelle se lit comme un accotement pâle. |
| `frange-2.jpg` | village / culture (−365, 91) | V3.0 : jardins et champs se fondent sans flou global ; maisons et haie inchangées. |
| `frange-3.jpg` | village / culture (268, −754), lisière | V2.9.2 : lisière en escalier derrière les maisons. V3.0 : lisière continue, frange de jardin douce. |

Revue structurée par catégorie : rapport `docs/audit/V3.0_PREMIUM_ENVIRONMENT_ART_PASS.md`, § 20.
