# QA V2.9.2 — captures Chromium

Chaque scénario est joué par le même script sur la V2.9.1 (`v291-*`, commit `9ab6d20`) et sur la V2.9.2 (`v292-*`). Le fichier `*.json` de chaque dossier donne, pour chaque clic ou recherche, la fiche rapide obtenue (titre, catégorie, adresse, identifiant sélectionné), l'audit des bâtiments et la console.

Chromium headless, SwiftShader, 1280 × 800 sauf mention. Vue normale V2 pour `salle-vs-associations`, `public-facilities`, `roads` et `toponymy` ; mode `?visual=cartoon-v291&v25quality=performance` pour `search`, `click` et `mobile`.

| Dossier | Contenu |
|---|---|
| `salle-vs-associations/` | vue d'ensemble ; clic sur la salle (…149569), sur la Maison des associations (…2006956400), sur l'ancienne maison V1.11 (…149656) ; recherche et fiche de chacun ; listes « salle » et « associations » ; preuve orthophoto `salle-ortho.jpg` |
| `public-facilities/` | clics sur la mairie, l'annexe de 31 m² (…149545), l'ancienne association V2.9 (…149537), l'école, le CPI, l'église, le vestiaire du stade, l'ancienne pharmacie, le Leclerc de Romilly ; listes « mairie », « CPI », « pharmacie » |
| `poi/` | arbitrages bâtiment par bâtiment sur l'orthophoto IGN 0,5 m (rouge : association héritée, jaune : bâtiment RNB de l'adresse, vert : retenu) ; planches `planche-arbitrages-*.jpg` |
| `roads/` | clics sur la D20 Joliot-Curie, la Place Saint-Denis, la Rue Pasteur, la Rue Basse de Poussey, la D619 Avenue du Général de Gaulle (deux portions), la Rue Pierre Sémard à Romilly, l'ex-« Chemin de la Pie », la Rue du Pot Bancelin, la ligne ferroviaire, la Rue des Écoles ; listes « Joliot », « Rue Basse », « Leclerc », « 1000 » |
| `toponymy/` | vue de la commune, Poussey, Les Granges, centre-bourg et le Craon ; listes « Poussey », « Granges », « Craon », « Le Puy » |
| `search/` | 17 listes de recherche (équipements, secteurs, rues, négatives) |
| `click/` | priorité de sélection : étiquette, bâtiment, sol d'une zone d'équipement (église, stade), champ, rue, ligne ferroviaire |
| `mobile/` | 390 × 844 et 844 × 390 : salle, Maison des associations, mairie, école, CPI, Poussey, Les Granges, Rue Pasteur, recherche, toucher sur les deux bâtiments ; V2.9.1 en portrait pour comparaison |
