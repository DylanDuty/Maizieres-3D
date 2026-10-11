# QA V3.1 — FXAA en PERFORMANCE (A / B)

Même navigateur (Chromium headless, SwiftShader), même scène, même caméra, même résolution (1280 × 800), preset PERFORMANCE de la V3.1 : A = `?fxaa=1`, B = `?fxaa=0`. Cadrages : centre (église), lisière de bois, halls de La Glacière.

- `fxaa-on-*.jpg` / `fxaa-off-*.jpg` : images entières.
- `planche-fxaa-on-off-bureau.jpg` : centres agrandis deux fois au plus proche voisin (pixels réels).
- Téléphone : `../mobile/planche-fxaa-on-off-telephone.jpg` et les planches `../mobile/planche-*`.

Lecture : sans FXAA, les bords de toits, la lisière bois / champ, les silhouettes d'arbres, les acrotères de La Glacière et le petit mobilier de rue repassent en escalier au pixel près ; avec FXAA, ils sont lissés, au prix d'un très léger adoucissement des détails fins. La différence est évidente, en particulier sur téléphone, où l'image est rendue à un pixel CSS par pixel puis agrandie. Coût : rapport § 9 et § 10.
