#!/usr/bin/env python3
"""Empirical diagnostics for the CropIntel training pipeline.

Verifies the assumptions our preprocessing + augmentation depend on, instead of
trusting prior notes. Prints hard facts:
  1. Does EfficientNetB0 (TF 2.21) contain a built-in Rescaling/Normalization?
  2. What value range does ImageDataGenerator emit after augmentation
     (brightness_range is the classic [0,1] -> [0,255] offender)?
  3. Real loaded-data value range.
  4. Can a frozen-backbone head overfit a tiny batch (sanity of gradients)?
"""
import os
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import numpy as np
import tensorflow as tf
from tensorflow.keras import applications, layers


def section(title):
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


# ---------------------------------------------------------------------------
section("1. EfficientNetB0 internal preprocessing layers (TF %s)" % tf.__version__)
# ---------------------------------------------------------------------------
eff = applications.EfficientNetB0(include_top=False, weights=None,
                                  input_shape=(224, 224, 3))
preproc_layers = []
for lyr in eff.layers[:6]:
    kind = type(lyr).__name__
    info = ""
    if kind == "Rescaling":
        info = f"scale={lyr.scale} offset={lyr.offset}"
    elif kind == "Normalization":
        info = f"mean={getattr(lyr, 'mean', None)} var={getattr(lyr, 'variance', None)}"
    print(f"  layer[{lyr.name}] = {kind} {info}")
    if kind in ("Rescaling", "Normalization"):
        preproc_layers.append((lyr.name, kind, info))
print(f"\n  -> built-in preprocessing layers found: {preproc_layers or 'NONE'}")

# Probe behaviour: feed known constant images, observe output stats.
for val, desc in [(1.0, "[0,1] max (1.0)"), (255.0, "[0,255] max"), (0.5, "mid 0.5")]:
    probe = np.full((1, 224, 224, 3), val, dtype=np.float32)
    out = eff(probe, training=False).numpy()
    print(f"  input const={val:6.1f} ({desc:16s}) -> backbone out "
          f"min={out.min():.4f} max={out.max():.4f} mean={out.mean():.4f}")

# ---------------------------------------------------------------------------
section("2. ImageDataGenerator output range (augmentation value-range check)")
# ---------------------------------------------------------------------------
# Synthetic [0,1] batch
x = np.random.rand(8, 224, 224, 3).astype(np.float32)
y = tf.keras.utils.to_categorical(np.array([0, 1, 2, 3, 0, 1, 2, 3]), 4)
print(f"  source batch range: min={x.min():.4f} max={x.max():.4f}")

for label, kwargs in [
    ("no-aug", {}),
    ("aug WITHOUT brightness", dict(rotation_range=30, horizontal_flip=True,
                                    zoom_range=0.3, fill_mode="nearest")),
    ("aug WITH brightness_range", dict(rotation_range=30, horizontal_flip=True,
                                       zoom_range=0.3, brightness_range=[0.8, 1.2],
                                       fill_mode="nearest")),
]:
    gen = tf.keras.preprocessing.image.ImageDataGenerator(**kwargs)
    flow = gen.flow(x, y, batch_size=8, shuffle=False)
    bx, _ = next(flow)
    print(f"  {label:28s} -> min={bx.min():8.4f} max={bx.max():8.4f} "
          f"mean={bx.mean():.4f}")

# ---------------------------------------------------------------------------
section("3. Real data value range (first available crop)")
# ---------------------------------------------------------------------------
from ml.config import CROPS  # noqa: E402
from ml.utils.data_loader import CropDatasetLoader  # noqa: E402

for crop in CROPS:
    try:
        loader = CropDatasetLoader(crop)
        imgs, labels, names = loader.load_dataset()
        print(f"  {crop}: {len(imgs)} imgs range=[{imgs.min():.4f},{imgs.max():.4f}] "
              f"classes={names}")
        # label-image coupling spot check: show class of 3 random samples and
        # confirm the label index maps to a sane class name
        rng = np.random.default_rng(0)
        for i in rng.choice(len(imgs), size=3, replace=False):
            print(f"     sample[{i}] label={labels[i]} -> {names[labels[i]]} "
                  f"img_mean={imgs[i].mean():.3f}")
        break
    except Exception as e:
        print(f"  {crop}: load failed ({e})")
        continue

# ---------------------------------------------------------------------------
section("4. Can the head overfit a tiny batch? (gradient sanity)")
# ---------------------------------------------------------------------------
# If a frozen-backbone + head CANNOT drive train accuracy to ~100% on 32 images
# in 30 steps, the features reaching the head are broken (preprocessing) — NOT a
# data or hyperparameter problem.
def build_probe(rescale_scale, rescale_offset):
    inp = tf.keras.Input((224, 224, 3))
    z = layers.Rescaling(rescale_scale, rescale_offset)(inp)
    base = applications.EfficientNetB0(include_top=False, weights="imagenet",
                                       input_shape=(224, 224, 3))
    base.trainable = False
    z = base(z, training=False)
    z = layers.GlobalAveragePooling2D()(z)
    z = layers.Dense(64, activation="relu")(z)
    out = layers.Dense(4, activation="softmax")(z)
    m = tf.keras.Model(inp, out)
    m.compile(optimizer=tf.keras.optimizers.Adam(1e-3),
              loss="categorical_crossentropy", metrics=["accuracy"])
    return m

try:
    loader = CropDatasetLoader(next(iter(CROPS)))
    imgs, labels, names = loader.load_dataset()
    idx = np.arange(len(imgs))[:32]
    bx = imgs[idx]
    by = tf.keras.utils.to_categorical(labels[idx], len(names))
    for scale, offset, desc in [(255.0, 0.0, "Rescaling(255,0) [current]"),
                                (1.0, 0.0, "Rescaling(1,0)=identity [0,1]"),
                                (2.0, -1.0, "Rescaling(2,-1)=[-1,1]")]:
        m = build_probe(scale, offset)
        h = m.fit(bx, by, epochs=30, batch_size=32, verbose=0)
        print(f"  {desc:34s} -> final train_acc={h.history['accuracy'][-1]:.3f} "
              f"loss={h.history['loss'][-1]:.4f}")
except Exception as e:
    print(f"  overfit probe failed: {e}")

print("\nDIAGNOSTIC COMPLETE")
