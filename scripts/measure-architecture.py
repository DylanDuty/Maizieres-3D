#!/usr/bin/env python3
"""V2.3 — mesures architecturales de chaque empreinte bâtie (lecture seule des empreintes).

Pour chacune des 2 596 empreintes (référentiel V1.6.2, réintégrations V2.0.1, relevés manuels V2.2) :
  * forme dérivée de l'empreinte gelée (surface, rectangle minimal, allongement, compacité, famille L/T/U) ;
  * LiDAR HD MNH 0,5 m (IGN, 2025) : hauteur du point haut, hauteur à l'égout, pentes et orientations des pans,
    d'où type de toiture, orientation du faîtage et pente ;
  * BD ORTHO 0,5 m (IGN, avril 2025) : famille de couleur de la toiture.
Aucune géométrie n'est écrite : le résultat est un tableau de mesures par identifiant.

Dépendances : numpy, scipy, pillow, pyproj, shapely (≥ 2). Dalles : npm run data:architecture-fetch.
Sortie : data-sources/architecture/roof-measurements-v2.3.json
"""
import json, math, hashlib, sys
import numpy as np
from scipy import ndimage
from PIL import Image
from pyproj import Transformer
import shapely
from shapely.geometry import Polygon, MultiPolygon, shape

ROOT = '.'
D = 'data-sources/architecture'
OUT = f'{D}/roof-measurements-v2.3.json'
FILES = [('reference_v1.6.2', 'public/data/buildings.geojson'),
         ('reintegrated_v2.0.1', 'public/data/buildings-additions-v2.0.1.geojson'),
         ('manual_orthophoto_v2.2', 'public/data/buildings-manual-v2.2.geojson')]
T = Transformer.from_crs('EPSG:4326', 'EPSG:2154', always_xy=True)
manifest = json.load(open(f'{D}/sources-manifest.json'))
TILES = {(t['x'], t['y']): t for t in manifest['tiles']}
PIX = 0.5
_cache = {}


def tile_arrays(x, y):
    """MNH (float32) and ortho (uint8 RGB) of one kilometre tile; pixel (r, c) centre = (x*1000 + c/2, y*1000 - r/2)."""
    if (x, y) not in _cache:
        t = TILES.get((x, y))
        if t is None:
            _cache[(x, y)] = None
        else:
            for f, key in ((t['mnh']['file'], 'mnhSha256'), (t['ortho']['file'], 'orthoSha256')):
                if hashlib.sha256(open(f, 'rb').read()).hexdigest() != t[key]:
                    sys.exit('SHA-256 différent du manifeste : ' + f)
            _cache[(x, y)] = (np.array(Image.open(t['mnh']['file']), dtype=np.float32),
                              np.array(Image.open(t['ortho']['file']).convert('RGB'), dtype=np.uint8))
    return _cache[(x, y)]


def window(e0, n1, cols, rows):
    """Mosaic window whose top-left pixel centre is (e0, n1) on the 0,5 m grid (e0, n1 multiples of 0,5)."""
    h = np.full((rows, cols), np.nan, np.float32)
    rgb = np.zeros((rows, cols, 3), np.uint8)
    E = e0 + np.arange(cols) * PIX
    N = n1 - np.arange(rows) * PIX
    tx = np.floor(E / 1000).astype(int)
    ty = np.ceil(N / 1000).astype(int)
    for x in np.unique(tx):
        for y in np.unique(ty):
            arr = tile_arrays(int(x), int(y))
            if arr is None:
                continue
            cm = tx == x
            rm = ty == y
            if not cm.any() or not rm.any():
                continue
            cc = np.round((E[cm] - x * 1000) / PIX).astype(int)
            rr = np.round((y * 1000 - N[rm]) / PIX).astype(int)
            ok_c = (cc >= 0) & (cc < 2000)
            ok_r = (rr >= 0) & (rr < 2000)
            ci = np.where(cm)[0][ok_c]
            ri = np.where(rm)[0][ok_r]
            h[np.ix_(ri, ci)] = arr[0][np.ix_(rr[ok_r], cc[ok_c])]
            rgb[np.ix_(ri, ci)] = arr[1][np.ix_(rr[ok_r], cc[ok_c])]
    return h, rgb, E, N


def to_l93(geom):
    def ring(r):
        xs, ys = T.transform([q[0] for q in r], [q[1] for q in r])
        return list(zip(xs, ys))
    polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
    out = [Polygon(ring(p[0]), [ring(h) for h in p[1:]]) for p in polys]
    g = MultiPolygon(out) if len(out) > 1 else out[0]
    return g if g.is_valid else shapely.make_valid(g)


def obb(g):
    """Minimum rotated rectangle: length, width, bearing of the long side (deg, 0-180, clockwise from grid north)."""
    r = g.minimum_rotated_rectangle
    c = list(r.exterior.coords)
    best = None
    for i in range(4):
        dx, dy = c[i + 1][0] - c[i][0], c[i + 1][1] - c[i][1]
        l = math.hypot(dx, dy)
        if best is None or l > best[0]:
            best = (l, dx, dy)
    l, dx, dy = best
    w = r.area / l if l else 0
    bearing = (math.degrees(math.atan2(dx, dy)) + 360) % 180
    return l, w, bearing, r


def footprint_family(g, length, width):
    if isinstance(g, MultiPolygon) and len(g.geoms) > 1:
        return 'complex', 0
    p = g if isinstance(g, Polygon) else g.geoms[0]
    rect = p.area / max(1e-6, length * width)
    s = p.simplify(0.6, preserve_topology=True)
    pts = list(s.exterior.coords)[:-1]
    # drop vertices creating edges shorter than 1.2 m (digitising noise)
    clean = []
    for q in pts:
        if clean and math.dist(q, clean[-1]) < 1.2:
            continue
        clean.append(q)
    if len(clean) > 3 and math.dist(clean[0], clean[-1]) < 1.2:
        clean.pop()
    n = len(clean)
    if n < 3:
        return 'irregular', 0
    ccw = Polygon(clean).exterior.is_ccw
    reflex = []
    for i in range(n):
        a, b, c = clean[i - 1], clean[i], clean[(i + 1) % n]
        cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
        la, lb = math.dist(a, b), math.dist(b, c)
        if la < 1e-6 or lb < 1e-6:
            continue
        s_ = cross / (la * lb)
        if (s_ < -0.35 if ccw else s_ > 0.35):
            reflex.append(i)
    k = len(reflex)
    if k == 0:
        if rect >= 0.85:
            return ('elongated' if length / max(width, 1e-6) >= 2.5 else 'rectangle'), 0
        return 'irregular', 0
    if k == 1:
        return 'L', 1
    if k == 2:
        d = (reflex[1] - reflex[0]) % n
        d = min(d, n - d)
        if d == 1:
            return 'U', 2
        if d == 3:
            return 'T', 2
        return 'complex', 2
    return 'complex', k


def circ_stats(theta, w):
    w = w / max(w.sum(), 1e-9)
    r1 = abs((w * np.exp(1j * theta)).sum())
    z2 = (w * np.exp(2j * theta)).sum()
    r2 = abs(z2)
    r4 = abs((w * np.exp(4j * theta)).sum())
    return r1, r2, r4, np.angle(z2) / 2


def rgb_family(rgb):
    """Per-pixel colour family on the orthophoto (vegetation and deep shadow excluded)."""
    f = rgb.astype(np.float32) / 255
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    mx, mn = f.max(-1), f.min(-1)
    v = mx
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    d = np.maximum(mx - mn, 1e-6)
    hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    exg = 2 * g - r - b
    veg = (exg > 0.06) & (hue > 60) & (hue < 170) & (s > 0.12)
    shadow = v < 0.16
    fam = np.full(r.shape, 'unknown', object)
    grey = s < 0.14
    fam[grey & (v >= 0.78)] = 'white'
    fam[grey & (v >= 0.45) & (v < 0.78)] = 'light_gray'
    fam[grey & (v < 0.45)] = 'dark_gray'
    warm = ~grey & ((hue < 45) | (hue >= 330))
    # The 2025 mosaic is slightly hazy: terracotta tiles read at saturation ≈ 0.25–0.35.
    fam[warm & (s >= 0.22) & (v >= 0.5)] = 'red_orange'
    fam[warm & ~((s >= 0.22) & (v >= 0.5))] = 'brown'
    cool = ~grey & (hue >= 170) & (hue < 270)
    fam[cool] = 'blue_gray'
    beige = ~grey & (hue >= 45) & (hue < 60)
    fam[beige & (v >= 0.6)] = 'light_gray'
    fam[beige & (v < 0.6)] = 'brown'
    fam[veg] = 'vegetation'
    fam[shadow] = 'shadow'
    return fam, veg


def measure(bid, layer, g, neighbours=None):
    length, width, bearing, rect = obb(g)
    fam, reflex = footprint_family(g, length, width)
    area = g.area
    out = {'id': bid, 'layer': layer,
           'shape': {'areaM2': round(area, 1), 'lengthM': round(length, 1), 'widthM': round(width, 1),
                     'ratio': round(length / max(width, 0.1), 2), 'bearingDeg': round(bearing, 1),
                     'rectangularity': round(area / max(length * width, 1e-6), 3),
                     'compactness': round(4 * math.pi * area / max(g.length ** 2, 1e-6), 3),
                     'family': fam, 'reflexVertices': reflex}}
    minx, miny, maxx, maxy = g.bounds
    e0 = math.floor(minx / PIX) * PIX - 2
    n1 = math.ceil(maxy / PIX) * PIX + 2
    cols = int(round((math.ceil(maxx / PIX) * PIX + 2 - e0) / PIX)) + 1
    rows = int(round((n1 - (math.floor(miny / PIX) * PIX - 2)) / PIX)) + 1
    h, rgb, E, N = window(e0, n1, cols, rows)
    EE, NN = np.meshgrid(E, N)
    inside = shapely.contains_xy(g, EE, NN)
    erode = 0.75 if min(length, width) >= 5 else 0.4
    core_g = g.buffer(-erode)
    core = shapely.contains_xy(core_g, EE, NN) if not core_g.is_empty else inside.copy()
    if core.sum() < 6:
        core = inside.copy()
    valid = core & np.isfinite(h)
    lid = {'pixels': int(inside.sum()), 'corePixels': int(core.sum()), 'validPixels': int(valid.sum())}
    out['lidar'] = lid
    colfam, veg = rgb_family(rgb)
    # Edge contrast: a real roof stands as a step on its outline (inner band high, outer band low); the interpolated
    # stripes of a masked LiDAR area run continuously across the outline.
    ib = g.buffer(-0.4).difference(g.buffer(-1.6))
    ob = g.buffer(2.6).difference(g.buffer(1.0))
    if neighbours is not None and not neighbours.is_empty:
        ob = ob.difference(neighbours.buffer(1.0))  # adjoining footprints are not "outside ground"
    inn = shapely.contains_xy(ib, EE, NN) & np.isfinite(h)
    outb = shapely.contains_xy(ob, EE, NN) & np.isfinite(h)
    if inn.sum() >= 3 and outb.sum() >= 3:
        out['edgeContrastM'] = round(float(np.median(h[inn]) - np.median(h[outb])), 2)
    # Regulatory masking (sensitive site): IGN serves a mosaic of flat squares on the orthophoto (and interpolated
    # stripes on the LiDAR). Real roofs keep a texture (median 5 × 5 standard deviation usually ≥ 3 grey levels);
    # the mosaic stays near 1. Texture alone also catches a few smooth sheet roofs, so the masked zone is decided
    # afterwards, spatially (see masked_zone()).
    fr = rgb.astype(np.float32)
    mu = ndimage.uniform_filter(fr, (5, 5, 1))
    mu2 = ndimage.uniform_filter(fr * fr, (5, 5, 1))
    sd = np.sqrt(np.maximum(mu2 - mu * mu, 0)).max(-1)
    tex = float(np.median(sd[core])) if core.sum() else 0.0
    out['orthoTexture'] = round(tex, 2)
    # colour of the roof on the orthophoto (vegetation / shadow excluded)
    cf = colfam[core & ~veg]
    cf = cf[(cf != 'shadow') & (cf != 'vegetation')]
    col = {'pixels': int(cf.size)}
    if cf.size >= 6:
        vals, cnt = np.unique(cf, return_counts=True)
        order = np.argsort(-cnt)
        col['families'] = {str(vals[i]): round(float(cnt[i] / cf.size), 3) for i in order[:4]}
        med = np.median(rgb[core & ~veg].reshape(-1, 3), axis=0)
        col['medianRGB'] = [int(v) for v in med]
    out['color'] = col
    if valid.sum() < 4:
        lid['status'] = 'hors couverture'
        return out
    hv = h[valid]
    elevated = valid & (h > 1.2) & ~veg
    lid['elevatedFraction'] = round(float((valid & (h > 1.2)).sum() / valid.sum()), 3)
    lid['vegetationFraction'] = round(float((valid & veg).sum() / valid.sum()), 3)
    if elevated.sum() < max(4, 0.25 * valid.sum()):
        lid['status'] = 'non détecté'  # nothing standing in the footprint on the 2025 LiDAR
        # why: dense canopy hides the roof, footprint below the LiDAR resolution, or genuinely nothing standing
        # (demolished, ground-level surface such as a pool or terrace, offset outline, built after the flight)
        lid['reason'] = ('sous végétation' if lid['vegetationFraction'] >= 0.5 else
                         'trop petit pour le LiDAR' if area < 12 or core.sum() < 20 else 'aucune élévation mesurée')
        lid['p95'] = round(float(np.percentile(hv, 95)), 2)
        return out
    he = h[elevated]
    top = float(np.percentile(he, 98))
    lid.update({'status': 'mesuré', 'topM': round(top, 2), 'p90M': round(float(np.percentile(he, 90)), 2),
                'medianM': round(float(np.median(he)), 2), 'p10M': round(float(np.percentile(he, 10)), 2),
                'p05M': round(float(np.percentile(he, 5)), 2)})
    # Lower volume inside the same footprint (garage / extension attached under one outline).
    low = elevated & (h < 0.6 * top) & (h > 1.5)
    lid['lowVolumeFraction'] = round(float(low.sum() / elevated.sum()), 3)
    # Gradients on the 0,5 m grid; only pixels whose 3 × 3 neighbourhood is roof (no wall, no tree edge).
    hz = np.where(elevated, h, np.nan)
    gy, gx = np.gradient(hz, PIX)
    gy = -gy  # row index grows southwards
    ok = elevated.copy()
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            ok &= np.roll(np.roll(elevated, dr, 0), dc, 1)
    ok &= np.isfinite(gx) & np.isfinite(gy)
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))
    ok &= slope < 65
    n_ok = int(ok.sum())
    if n_ok < 8:
        # small roofs: the full 3 × 3 test leaves too few pixels; accept any elevated pixel with a finite gradient
        # (edge pixels included, hence a lower confidence downstream)
        gy, gx = np.gradient(np.where(np.isfinite(h), h, 0), PIX)
        gy = -gy
        slope = np.degrees(np.arctan(np.hypot(gx, gy)))
        ok = elevated & (slope < 65)
        n_ok = int(ok.sum())
        lid['lowSample'] = True
    lid['roofPixels'] = n_ok
    if n_ok < 8:
        lid['roofStatus'] = 'trop peu de pixels de toit'
    else:
        s = slope[ok]
        flat = s < 7
        lid['flatFraction'] = round(float(flat.mean()), 3)
        pit = ok & (slope >= 10)
        lid['pitchedFraction'] = round(float(pit.sum() / n_ok), 3)
        spread = float(np.percentile(he, 90) - np.percentile(he, 10))
        lid['heightSpreadM'] = round(spread, 2)
        if pit.sum() >= 6:
            aspect = np.arctan2(gx[pit], gy[pit])  # downslope azimuth is aspect + pi; we only need axes
            w = np.ones(pit.sum())
            r1, r2, r4, ax2 = circ_stats(aspect, w)
            lid['aspectR1'] = round(float(r1), 3)
            lid['aspectR2'] = round(float(r2), 3)
            lid['aspectR4'] = round(float(r4), 3)
            fall = (math.degrees(ax2) + 360) % 180  # axis of the dominant slope direction (0-180)
            ridge = (fall + 90) % 180
            lid['slopeAxisDeg'] = round(fall, 1)
            # mean uphill azimuth (only meaningful for a single dominant plane: mono-pente)
            lid['uphillAzimuthDeg'] = round((math.degrees(np.angle(np.exp(1j * aspect).mean())) + 360) % 360, 1)
            lid['ridgeDeg'] = round(ridge, 1)
            # share of pitched pixels sloping along the ridge axis (hip / half-hip end faces)
            dev = np.abs(((np.degrees(aspect) - ridge + 90) % 180) - 90)
            lid['endFaceFraction'] = round(float((dev < 30).mean()), 3)
            lid['mainFaceFraction'] = round(float((dev > 60).mean()), 3)
            main = dev > 60
            lid['slopeDeg'] = round(float(np.median(slope[pit][main])) if main.sum() >= 4 else float(np.median(slope[pit])), 1)
            # ridge coverage: the two main faces must both exist for a gable/hip
            sgn = np.cos(aspect - ax2)
            lid['faceBalance'] = round(float(min((sgn > 0.5).mean(), (sgn < -0.5).mean()) / max((abs(sgn) > 0.5).mean(), 1e-6)), 3)
        # eave height ~ lower roof percentile; ridge ~ top
        lid['eaveM'] = round(float(np.percentile(h[ok], 5)), 2)
    return out


def masked_zone(res, geoms):
    """Masked site: IGN degrades the orthophoto (mosaic of flat squares) and the LiDAR (interpolated stripes) of a
    sensitive site. A footprint is a candidate when its roof has little texture (median 5 × 5 deviation < 3.5) and the
    LiDAR shows no roof (nothing elevated, or no step on the outline). Candidates within 90 m of each other form
    clusters; a cluster of ≥ 5 containing at least three mosaic-flat roofs (< 2.0) defines the zone (convex hull of the
    cluster). Inside the zone every footprint is left unmeasured, except a textured roof (≥ 5) that stands as a clear
    LiDAR step (≥ 2 m) on its own outline — i.e. a real, unmasked structure at the edge of the zone."""
    from shapely.ops import unary_union
    by = {b['id']: b for b in res}
    def cand(b):
        return b.get('orthoTexture', 99) < 3.5 and (b['lidar'].get('status') != 'mesuré' or b.get('edgeContrastM', 9) < 1.0)
    seeds = [b['id'] for b in res if cand(b)]
    groups, left = [], set(seeds)
    while left:
        stack, grp = [left.pop()], []
        while stack:
            k = stack.pop(); grp.append(k)
            near = [j for j in left if geoms[j].distance(geoms[k]) < 90]
            for j in near:
                left.discard(j); stack.append(j)
        groups.append(grp)
    keep = [g for g in groups if len(g) >= 5 and sum(by[k].get('orthoTexture', 99) < 2.0 for k in g) >= 3]
    zone = unary_union([unary_union([geoms[k] for k in g]).convex_hull for g in keep]) if keep else None
    n = 0
    for b in res:
        if zone is None or not zone.contains(geoms[b['id']].centroid):
            continue
        real = b['lidar'].get('status') == 'mesuré' and b.get('orthoTexture', 0) >= 5 and b.get('edgeContrastM', 0) >= 2.0
        if not real:
            b['lidar'] = {k: v for k, v in b['lidar'].items() if k in ('pixels', 'corePixels', 'validPixels')}
            b['lidar']['status'] = 'zone masquée'
            b.pop('color', None)
            n += 1
    return zone, n


def main():
    from shapely.strtree import STRtree
    from shapely.ops import unary_union
    items = []
    for layer, f in FILES:
        for ft in json.load(open(f))['features']:
            items.append((ft.get('id') or ft['properties']['id'], layer, to_l93(ft['geometry'])))
    geoms = {bid: g for bid, _, g in items}
    ids = [bid for bid, _, _ in items]
    tree = STRtree([g for _, _, g in items])
    res = []
    for bid, layer, g in items:
        near = [ids[i] for i in tree.query(g.buffer(4)) if ids[i] != bid]
        res.append(measure(bid, layer, g, unary_union([geoms[k] for k in near]) if near else None))
    zone, nmasked = masked_zone(res, geoms)
    srcs = {k: hashlib.sha256(open(f, 'rb').read()).hexdigest() for k, f in FILES}
    json.dump({'metadata': {'version': '2.3', 'generatedBy': 'scripts/measure-architecture.py (npm run data:architecture-measure)',
                            'footprintFilesSha256': srcs, 'sourcesManifest': f'{D}/sources-manifest.json',
                            'conventions': {'bearing': 'degrés 0–180 dans le sens horaire depuis le nord du quadrillage Lambert-93 (axe, non orienté)',
                                            'heights': 'mètres au-dessus du sol nu LiDAR (MNH IGN)', 'pixel': 0.5},
                            'count': len(res),
                            'maskedZone': {'note': 'site dont l’orthophoto et le LiDAR IGN sont volontairement dégradés (mosaïque / interpolation) : aucune mesure possible',
                                           'buildings': nmasked,
                                           'boundsL93': [round(v, 1) for v in zone.bounds] if zone is not None else None,
                                           'areaHa': round(zone.area / 1e4, 1) if zone is not None else 0}},
               'buildings': res}, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(len(res), 'mesures ->', OUT)


if __name__ == '__main__':
    main()
