"""
Cross-crop gate characterization + threshold tuning.

Sends sample leaf images through every crop model (via the running inference
service or a deployed URL) to capture, per image, each crop's top-1 confidence
and not-in-catalog flag. Then simulates the wrong-crop gate over a grid of
thresholds to report false-reject (valid leaf wrongly blocked) and catch
(wrong-crop correctly blocked) rates, and recommends thresholds.

This is how the defaults in ml/serve/inference_app.py were tuned. Re-run it
after retraining any crop model or adding a crop-ID classifier.

Usage:
  python scripts/cross_crop_sweep.py --url http://127.0.0.1:8000 \
      --per-crop 9 --out /tmp/sweep.json
  python scripts/cross_crop_sweep.py --analyze /tmp/sweep.json
"""
import argparse
import io
import json
import os
import time
from itertools import product

import numpy as np
from PIL import Image

CROPS = ["corn", "soybean", "wheat", "rice", "tomato"]
DISEASE_KW = [
    "blight", "rust", "spot", "mold", "blast", "virus", "mildew", "septoria",
    "smut", "fusarium", "mosaic", "pustule", "death", "bacterial",
]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def quality_ok(fp: str) -> bool:
    """Mirror inference_app's image-quality gate so we only probe usable photos."""
    try:
        im = Image.open(fp).convert("RGB")
        w, h = im.size
        if w < 200 or h < 200:
            return False
        a = np.asarray(im, dtype=np.float32)
        r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
        if float(np.mean((g > 40) & (g > r * 1.05) & (g > b * 1.05))) < 0.03:
            return False
        gray = 0.299 * r + 0.587 * g + 0.114 * b
        sv = float(np.var(np.concatenate(
            [np.diff(gray, axis=1).ravel(), np.diff(gray, axis=0).ravel()])))
        return sv >= 25.0
    except Exception:
        return False


def pick_images(crop: str, n_healthy: int, n_diseased: int):
    h, d = [], []
    base = os.path.join(ROOT, "ml", "data", crop)
    for root, _, fs in os.walk(base):
        low = root.lower()
        for f in sorted(fs):
            if not f.lower().endswith((".jpg", ".jpeg", ".png")):
                continue
            fp = os.path.join(root, f)
            if not quality_ok(fp):
                continue
            if "healthy" in low and len(h) < n_healthy:
                h.append(fp)
            elif "healthy" not in low and any(k in low for k in DISEASE_KW) and len(d) < n_diseased:
                d.append(fp)
        if len(h) >= n_healthy and len(d) >= n_diseased:
            break
    return [("healthy", x) for x in h] + [("diseased", x) for x in d]


def predict(url: str, fp: str, crop: str) -> dict:
    import requests  # local import so --analyze works without requests
    with open(fp, "rb") as fh:
        r = requests.post(f"{url}/predict",
                          files={"image": fh}, data={"crop": crop}, timeout=45)
    try:
        d = r.json()
    except Exception:
        return {"err": "noparse"}
    if "disease" not in d:
        return {"err": str(d.get("error", "?"))[:40]}
    return {"disease": d["disease"], "conf": d["confidence"],
            "nic": bool(d.get("not_in_catalog")), "mismatch": bool(d.get("crop_mismatch"))}


def run_sweep(url: str, per_crop: int, out: str, pace: float):
    n_h = max(1, per_crop // 2)
    results = []
    for tc in CROPS:
        for kind, img in pick_images(tc, n_h, per_crop - n_h):
            vec = {sc: predict(url, img, sc) for sc in CROPS
                   for _ in [time.sleep(pace)]}
            results.append({"true_crop": tc, "kind": kind,
                            "img": os.path.basename(img), "vec": vec})
            json.dump(results, open(out, "w"), indent=1)
            print(f"{tc:8} {kind:8} self={vec[tc]}")
    print(f"DONE -> {out}")


def _frac(v):
    return None if v.get("conf") is None else v["conf"] / 100.0


def _gate(sc, snic, others, strong, margin, other_min):
    if sc is None:
        return None
    if sc >= strong and not snic:
        return False
    best = max([o for o in others if o is not None], default=0.0)
    return best >= other_min and (best - sc) >= margin


def _evaluate(data, strong, margin, other_min):
    fr = fr_tot = catch = cross_tot = fa = 0
    for r in data:
        T, v = r["true_crop"], r["vec"]
        if "err" in v.get(T, {}):
            continue
        others = [_frac(v[c]) for c in CROPS if c != T and "err" not in v.get(c, {})]
        g = _gate(_frac(v[T]), v[T].get("nic", False), others, strong, margin, other_min)
        if g is not None:
            fr_tot += 1
            fr += int(g)
        for sx in CROPS:
            if sx == T or "err" in v.get(sx, {}):
                continue
            oth = [_frac(v[c]) for c in CROPS if c != sx and "err" not in v.get(c, {})]
            gg = _gate(_frac(v[sx]), v[sx].get("nic", False), oth, strong, margin, other_min)
            if gg is None:
                continue
            cross_tot += 1
            catch += int(gg)
            fa += int(not gg)
    return dict(fr=fr, fr_tot=fr_tot, fr_rate=fr / fr_tot if fr_tot else 0,
                catch=catch, cross_tot=cross_tot,
                catch_rate=catch / cross_tot if cross_tot else 0, fa=fa)


def analyze(path: str):
    data = json.load(open(path))
    print(f"records: {len(data)}")
    cur = _evaluate(data, 0.85, 0.12, 0.80)
    print(f"\nDEPLOYED (0.85/0.12/0.80): "
          f"false-reject {cur['fr']}/{cur['fr_tot']} ({cur['fr_rate']*100:.1f}%), "
          f"catch {cur['catch']}/{cur['cross_tot']} ({cur['catch_rate']*100:.1f}%), "
          f"false-accept {cur['fa']}")
    best = None
    for strong, margin, other_min in product(
            [0.80, 0.82, 0.85, 0.88, 0.90], [0.10, 0.12, 0.15, 0.18, 0.22, 0.25],
            [0.70, 0.75, 0.80, 0.85]):
        m = _evaluate(data, strong, margin, other_min)
        key = (m["fr_rate"], -m["catch_rate"])
        if best is None or key < best[0]:
            best = (key, (strong, margin, other_min), m)
    (_, p, m) = best
    print(f"\nGRID BEST (min false-reject, then max catch): "
          f"STRONG={p[0]} MARGIN={p[1]} OTHER_MIN={p[2]} -> "
          f"false-reject {m['fr_rate']*100:.1f}%, catch {m['catch_rate']*100:.1f}%")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8000")
    ap.add_argument("--per-crop", type=int, default=9)
    ap.add_argument("--out", default="/tmp/cross_crop_sweep.json")
    ap.add_argument("--pace", type=float, default=0.2,
                    help="seconds between calls (raise to ~3.3 against a rate-limited host)")
    ap.add_argument("--analyze", help="analyze an existing results JSON and exit")
    a = ap.parse_args()
    if a.analyze:
        analyze(a.analyze)
    else:
        run_sweep(a.url, a.per_crop, a.out, a.pace)
        analyze(a.out)
