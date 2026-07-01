# Wrong-crop gate & field-change: production hardening

This documents the current heuristic, what a 57-image cross-crop sweep showed,
and the two model-based upgrades that take both features to production grade.

## 1. Current state (shipped)

**Wrong-crop gate** (`ml/serve/inference_app.py::_cross_crop_check`): when the
selected crop's result is unsure, the image is scored against the other in-memory
crop models and the request is blocked (with a suggested crop) if a different
crop fits clearly better. Confident, in-catalog results skip the pass.

Thresholds were tuned from `scripts/cross_crop_sweep.py` (57 images, all 5 crops,
each scored by all 5 models):

| Thresholds (STRONG/MARGIN/OTHER_MIN) | False-reject | Catch | False-accept |
|---|---|---|---|
| 0.85 / 0.15 / 0.75 (initial) | 5.6% | 78.5% | 31 |
| **0.85 / 0.12 / 0.80 (deployed)** | **2.8%** | **78.5%** | 31 |

**Field-change comparison** (`lib/healthComparison.ts`): continuous expected
health over the model's full probability distribution (replaced 4 fixed
severity buckets). Detects healthy↔diseased shifts and uncertain/borderline
moves; cannot measure spread of a confidently-identical disease.

## 2. What the sweep proved about the ceiling

The heuristic compares five **disease** classifiers' confidences. That caps out
at ~78% catch / ~3% false-reject because:

- The lone false-reject is a rice leaf the **rice model itself** scores 50% on
  (already "no clear match") while corn scores 85%.
- False-accepts concentrate on out-of-crop overconfidence, worst among the
  grasses and the weak rice model: rice→corn 5/7 slip, wheat→soybean 4/8,
  rice→{others} ~3/7.

Disease models are simply not calibrated for "is this even my crop?".

## 3. Upgrade A — dedicated crop-ID classifier (the real gate)

A single 5-class "which crop is this leaf?" model. Crops are far more visually
separable than diseases within a crop, so expect >>95% accuracy from a small
model. It replaces "compare five disease models" with one reliable signal, which
should eliminate the rice false-rejects and most cross-crop false-accepts.

**Data:** already on disk — every `ml/data/<crop>/**` image is implicitly
labeled by its crop. No new collection needed. Hold out by source/folder to
avoid the framing shortcut documented in the soybean/rice notes.

**Train (needs a TF environment — not runnable in the Py3.14 repo venv):**
```
python scripts/train_crop_id.py --epochs 8 --out ml/models/crop_id
```
Scaffold provided in `scripts/train_crop_id.py` (EfficientNetB0, in-model
rescaling, TFLite export — mirrors the per-crop pipeline).

**Serve:** load `crop_id` alongside the disease models; in `/predict`, run it
first. If `argmax(crop_id) != selected_crop` with margin ≥ τ, block and suggest
`argmax`. Keep the current heuristic as a fallback when the classifier is
absent. Re-run `scripts/cross_crop_sweep.py` to set τ and confirm
false-reject ≈ 0.

## 4. Upgrade B — severity / leaf-coverage model (real spread detection)

The field-change comparison can't quantify worsening of a confirmed disease
because the classifier outputs identity, not severity. A pixel-color
"% leaf affected" heuristic was prototyped and rejected — too crop-dependent
(healthy soybean read 53% "damaged").

**Right approach:** a severity regressor/segmenter (e.g. lesion-area
segmentation, or an ordinal severity head) trained on **severity-labeled** data
(PlantVillage severity subsets, or in-house annotation). Output a 0–100
affected-area per check; the comparison then trends the delta of a real
measurement instead of a label. This is a genuine data+training project, not a
config change.

## 5. Reproduce / re-tune

```
# against the live (rate-limited) space:
python scripts/cross_crop_sweep.py --url https://jaithrap-cropintel.hf.space --pace 3.3 --out sweep.json
# against a local service:
python scripts/cross_crop_sweep.py --url http://127.0.0.1:8000 --out sweep.json
# re-analyze only:
python scripts/cross_crop_sweep.py --analyze sweep.json
```
