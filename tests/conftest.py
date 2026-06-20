import sys
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml.inference.versions import _is_complete_model_version  # noqa: E402

MODELS_DIR = ROOT / "ml" / "models"


def has_model(crop: str) -> bool:
    crop_dir = MODELS_DIR / crop
    if not crop_dir.is_dir():
        return False
    return any(
        _is_complete_model_version(crop_dir, d.name)
        for d in crop_dir.iterdir() if d.is_dir()
    )


def crops_with_models() -> list:
    if not MODELS_DIR.is_dir():
        return []
    return [d.name for d in MODELS_DIR.iterdir() if d.is_dir() and has_model(d.name)]


@pytest.fixture
def green_leaf_image() -> Image.Image:
    """Synthetic image that passes all quality checks: green-dominant, sharp, large."""
    rng = np.random.default_rng(42)
    arr = np.zeros((256, 256, 3), dtype=np.uint8)
    arr[:, :, 0] = rng.integers(20, 80, (256, 256))    # red low
    arr[:, :, 1] = rng.integers(120, 220, (256, 256))  # green dominant
    arr[:, :, 2] = rng.integers(20, 80, (256, 256))    # blue low
    return Image.fromarray(arr)


@pytest.fixture
def gray_image() -> Image.Image:
    """No green dominance — fails the plant-content check."""
    rng = np.random.default_rng(7)
    arr = rng.integers(100, 160, (256, 256, 1), dtype=np.uint8)
    return Image.fromarray(np.repeat(arr, 3, axis=2))


@pytest.fixture
def tiny_image() -> Image.Image:
    """Below the 128px minimum."""
    return Image.new("RGB", (64, 64), (40, 180, 40))


@pytest.fixture
def blurry_image() -> Image.Image:
    """Green but uniform — fails the sharpness check."""
    return Image.new("RGB", (256, 256), (40, 180, 40))
