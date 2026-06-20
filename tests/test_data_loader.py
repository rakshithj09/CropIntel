"""Regression guards for the brightness_range bug class.

ImageDataGenerator(brightness_range=...) round-trips [0,1] float images through
PIL and returns all-black batches — it silently collapsed every early training
run. These tests pin the invariants: no brightness_range in the train
generator, and augmentation preserves non-zero [0,1] output.
"""
import numpy as np
import pytest

tf = pytest.importorskip("tensorflow")

from ml.utils.data_loader import CropDatasetLoader  # noqa: E402


def test_train_generator_source_has_no_brightness_range():
    import inspect
    from ml.utils import data_loader
    src = inspect.getsource(data_loader.CropDatasetLoader.create_data_generators)
    for line in src.splitlines():
        stripped = line.strip()
        if stripped.startswith("#") or "OMITTED" in stripped:
            continue
        assert "brightness_range=" not in stripped, (
            "brightness_range reintroduced into create_data_generators — it "
            "destroys [0,1] float batches (all-black images). See data_loader.py "
            "comments and ml/scripts/diagnose_pipeline.py."
        )


def test_random_augment_preserves_unit_range():
    loader = CropDatasetLoader.__new__(CropDatasetLoader)  # no dataset needed
    rng = np.random.default_rng(0)
    img = rng.uniform(0.2, 0.9, (224, 224, 3)).astype(np.float32)
    np.random.seed(1)
    out = loader._random_augment_image(img)
    assert out.dtype == np.float32
    assert out.shape == img.shape
    assert out.min() >= 0.0 and out.max() <= 1.0
    # the bug signature was an all-zero output
    assert out.max() > 1e-6
    assert out.mean() > 0.05


def test_imagedatagen_flow_does_not_zero_batches():
    """End-to-end probe mirroring the in-pipeline AUG CHECK."""
    datagen = tf.keras.preprocessing.image.ImageDataGenerator(
        rotation_range=30,
        width_shift_range=0.2,
        height_shift_range=0.2,
        shear_range=0.2,
        zoom_range=0.3,
        horizontal_flip=True,
        vertical_flip=True,
        fill_mode="nearest",
    )
    rng = np.random.default_rng(3)
    X = rng.uniform(0.2, 0.9, (8, 64, 64, 3)).astype(np.float32)
    y = np.eye(2, dtype=np.float32)[rng.integers(0, 2, 8)]
    batch_x, _ = next(iter(datagen.flow(X, y, batch_size=8, shuffle=False)))
    assert batch_x.max() > 1e-6, "augmented batch is all-zero (brightness bug class)"
    assert batch_x.max() <= 2.0, "augmentation rescaled beyond [0,1]"
