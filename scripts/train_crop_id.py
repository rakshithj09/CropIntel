"""
Train the crop-ID classifier: "which of the 5 crops is this leaf?"

The durable replacement for the heuristic wrong-crop gate (docs/CROP_ID_GATE.md).
Crops are far more visually separable than diseases within a crop, so a small
transfer-learned model should reach very high accuracy and remove the
cross-crop false-accepts/rejects the heuristic can't.

Data: reuses the existing per-crop image folders — every image under
ml/data/<crop>/** is labeled by <crop>. Sampling is BALANCED (a per-crop cap)
because the raw counts are very skewed (tomato ~35k vs soybean ~3.7k).

Requires the TF env (e.g. the project's .conda-py311). Example:
  .conda-py311/bin/python scripts/train_crop_id.py --per-crop 2000 --epochs 4
"""
import argparse
import glob
import json
import os
import random
from datetime import datetime
from pathlib import Path

import tensorflow as tf

from ml.config import CROPS, MODEL_CONFIG
from ml.utils.model_builder import build_model, unfreeze_model

CROP_NAMES = list(CROPS.keys())  # stable label order: corn, soybean, wheat, rice, tomato
IMG_SIZE = tuple(MODEL_CONFIG["input_shape"][:2])
ROOT = Path(__file__).resolve().parents[1]
EXTS = (".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG")


def balanced_file_list(per_crop: int, seed: int):
    files, labels = [], []
    for idx, crop in enumerate(CROP_NAMES):
        fs = []
        for ext in ("*" + e for e in (".jpg", ".jpeg", ".png")):
            fs += glob.glob(str(ROOT / "ml" / "data" / crop / "**" / ext), recursive=True)
        fs = sorted(set(fs))
        random.Random(seed + idx).shuffle(fs)
        fs = fs[:per_crop]
        files += fs
        labels += [idx] * len(fs)
        print(f"  {crop:8} {len(fs)} images")
    z = list(zip(files, labels))
    random.Random(seed).shuffle(z)
    files, labels = zip(*z)
    return list(files), list(labels)


def make_ds(files, labels, batch, training):
    ds = tf.data.Dataset.from_tensor_slices((list(files), list(labels)))

    def load(path, label):
        img = tf.io.read_file(path)
        img = tf.io.decode_image(img, channels=3, expand_animations=False)
        img = tf.image.resize(img, IMG_SIZE)
        img = tf.cast(img, tf.float32) / 255.0  # model carries its own rescaling
        img.set_shape(IMG_SIZE + (3,))
        return img, label

    ds = ds.map(load, num_parallel_calls=tf.data.AUTOTUNE)
    # A few dataset files have wrong extensions / truncated bytes — skip them
    # rather than crash the whole run.
    ds = ds.ignore_errors()
    if training:
        ds = ds.shuffle(2048)
        aug = tf.keras.Sequential([
            tf.keras.layers.RandomFlip("horizontal"),
            tf.keras.layers.RandomRotation(0.1),
            tf.keras.layers.RandomZoom(0.1),
        ])
        # NB: no brightness aug — it zeroes [0,1] float images (documented bug).
        ds = ds.map(lambda x, y: (aug(x, training=True), y), num_parallel_calls=tf.data.AUTOTUNE)
    return ds.batch(batch).prefetch(tf.data.AUTOTUNE)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-crop", type=int, default=2000)
    ap.add_argument("--epochs", type=int, default=4)
    ap.add_argument("--fine-tune-epochs", type=int, default=0)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--val-split", type=float, default=0.15)
    ap.add_argument("--arch", default="MobileNetV2")
    ap.add_argument("--seed", type=int, default=1337)
    ap.add_argument("--out", default="ml/models/crop_id")
    a = ap.parse_args()

    print("Building balanced file list:")
    files, labels = balanced_file_list(a.per_crop, a.seed)
    n_val = int(len(files) * a.val_split)
    val_f, val_l = files[:n_val], labels[:n_val]
    tr_f, tr_l = files[n_val:], labels[n_val:]
    print(f"train={len(tr_f)} val={len(val_f)}")

    train = make_ds(tr_f, tr_l, a.batch, training=True)
    val = make_ds(val_f, val_l, a.batch, training=False)

    model = build_model(num_classes=len(CROP_NAMES), crop="crop_id", architecture=a.arch)
    model.compile(optimizer="adam",
                  loss=tf.keras.losses.SparseCategoricalCrossentropy(),
                  metrics=["accuracy"])
    model.fit(train, validation_data=val, epochs=a.epochs)

    if a.fine_tune_epochs > 0:
        unfreeze_model(model)  # recompiles with a one-hot loss...
        # ...but our labels are integer — recompile with the sparse loss.
        model.compile(optimizer=tf.keras.optimizers.Adam(1e-4),
                      loss=tf.keras.losses.SparseCategoricalCrossentropy(),
                      metrics=["accuracy"])
        model.fit(train, validation_data=val, epochs=a.fine_tune_epochs)

    version = "v1_" + datetime.now().strftime("%Y%m%d_%H%M%S")
    out = ROOT / a.out / version
    out.mkdir(parents=True, exist_ok=True)
    model.save(out / "checkpoint.keras")
    # TFLite export
    conv = tf.lite.TFLiteConverter.from_keras_model(model)
    conv.optimizations = [tf.lite.Optimize.DEFAULT]
    (out / "model.tflite").write_bytes(conv.convert())
    json.dump({"class_names": CROP_NAMES, "input_shape": list(MODEL_CONFIG["input_shape"])},
              open(out / "metadata.json", "w"), indent=2)
    json.dump({"version": version}, open(ROOT / a.out / "production.json", "w"), indent=2)

    res = model.evaluate(val, return_dict=True)
    print(f"\ncrop-ID saved -> {out}  val_accuracy={res.get('accuracy'):.4f}")


if __name__ == "__main__":
    main()
