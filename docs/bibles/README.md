# Bibles documentaires — Maizières : La-Grande-Uchronie

Archive canonique des six Bibles du projet. Les fichiers de chaque dossier `source/` sont les originaux fournis, copiés octet pour octet (UTF-8, noms d'origine conservés).

| Bible | Sujet | Version canonique | Fichier | SHA-256 |
|---|---|---|---|---|
| 01 | Cartographie | V1.1 | [`BIBLE_01_CARTOGRAPHIE/source/MAIZIERES_LA_GRANDE_UCHRONIE_BIBLE_01_CARTOGRAPHIE_FINAL_V1.1.md`](BIBLE_01_CARTOGRAPHIE/source/MAIZIERES_LA_GRANDE_UCHRONIE_BIBLE_01_CARTOGRAPHIE_FINAL_V1.1.md) | `049252e30276ede27a2e047910c88e33cf08e314c89a8e6c23c6391927af3b55` |
| 02 | Histoire | V1.1 | [`BIBLE_02_HISTOIRE/source/MAIZIERES_LA_GRANDE_UCHRONIE_BIBLE_02_HISTOIRE_V1.1.md`](BIBLE_02_HISTOIRE/source/MAIZIERES_LA_GRANDE_UCHRONIE_BIBLE_02_HISTOIRE_V1.1.md) | `2249658f165528f4ddd012ebcc4f43d3597043452c3c7831386a6c608c7bdb19` |
| 03 | Patrimoine | V1.0 | [`BIBLE_03_PATRIMOINE/source/MAIZIERES_LA_GRANDE_UCHRONIE_BIBLE_03_PATRIMOINE_V1.0.md`](BIBLE_03_PATRIMOINE/source/MAIZIERES_LA_GRANDE_UCHRONIE_BIBLE_03_PATRIMOINE_V1.0.md) | `99d812d0d1b5c7d71198da9e44130d4bbe22cc40c8864940e3aae4e0d4fc0d95` |
| 04 | Vie locale | V1.0 | [`BIBLE_04_VIE_LOCALE/source/MAIZIERES_LA_GRANDE_UCHRONIE_BIBLE_04_VIE_LOCALE_V1.0.md`](BIBLE_04_VIE_LOCALE/source/MAIZIERES_LA_GRANDE_UCHRONIE_BIBLE_04_VIE_LOCALE_V1.0.md) | `83fd01208272cc705649f985ab974ee154183518401d8a9160066203c5816a7f` |
| 05 | Associations & commerces | V1.2 finale auditée | [`BIBLE_05_ASSOCIATIONS_COMMERCES/source/MAIZIERES_LA_GRANDE_UCHRONIE_BIBLE_05_ASSOCIATIONS_COMMERCES_V1.2_FINAL_AUDITEE_CLOTURE_2026-09-09.md`](BIBLE_05_ASSOCIATIONS_COMMERCES/source/MAIZIERES_LA_GRANDE_UCHRONIE_BIBLE_05_ASSOCIATIONS_COMMERCES_V1.2_FINAL_AUDITEE_CLOTURE_2026-09-09.md) | `f372730c468a53ecbce45abc32304264dc3d47f6146ed69553eb72314502e3c1` |
| 06 | Mémoire locale | V1.0 finale | [`BIBLE_06_MEMOIRE_LOCALE/source/MAIZIERES_LA_GRANDE_UCHRONIE_BIBLE_06_MEMOIRE_LOCALE_V1.0_FINAL_CLOTURE_2026-09-09.md`](BIBLE_06_MEMOIRE_LOCALE/source/MAIZIERES_LA_GRANDE_UCHRONIE_BIBLE_06_MEMOIRE_LOCALE_V1.0_FINAL_CLOTURE_2026-09-09.md) | `0106cf0cb076d008ece99fb938b0a15b3eafabb466e02856469b711dc6cc570a` |

Contrôle d'intégrité, depuis ce dossier :

```sh
sha256sum */source/*.md
```

Les six empreintes doivent correspondre exactement au tableau.

## Règles d'utilisation

- Les Bibles sont des sources documentaires, pas du code applicatif.
- Elles ne doivent jamais être modifiées automatiquement pour satisfaire le comportement de la carte.
- Toute donnée utilisée dans Maizières 3D doit conserver sa provenance (Bible, section, niveau de confiance).
- Une donnée historique ne doit pas être présentée comme actuelle sans vérification.
- Une information incertaine doit rester qualifiée comme telle.
- En cas de contradiction entre Bibles, ne pas inventer de réconciliation.
- Les données géographiques structurées OSM/IGN restent prioritaires pour les coordonnées exactes lorsqu'elles sont plus précises.
- Les Bibles servent notamment à compléter les noms locaux, lieux-dits, patrimoine, bâtiments remarquables, équipements, commerces et mémoire locale.

## Quelle Bible consulter

Ne charger que la ou les Bibles pertinentes pour la tâche, pas les six systématiquement.

| Bible | À consulter pour |
|---|---|
| 01 — Cartographie | rues, ruelles, chemins, lieux-dits, secteurs, organisation spatiale, toponymie |
| 02 — Histoire | chronologie, personnages, événements, évolution historique |
| 03 — Patrimoine | église, bâtiments remarquables, patrimoine disparu ou conservé, éléments architecturaux documentés |
| 04 — Vie locale | équipements, services, usages locaux, organisation de la commune |
| 05 — Associations & commerces | associations, commerces, entreprises, activités locales |
| 06 — Mémoire locale | témoignages, souvenirs, traditions, anecdotes, mémoire collective documentée |
