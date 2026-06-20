"""Version resolution + production pointer — pure filesystem logic, no TF."""
import json

from ml.inference.versions import (
    _is_complete_model_version,
    resolve_version,
    read_production_pointer,
)


def _make_version(crop_dir, name, complete=True):
    vd = crop_dir / name
    vd.mkdir(parents=True)
    if complete:
        (vd / "model.tflite").touch()
        (vd / "metadata.json").write_text("{}")
        (vd / "metrics.json").write_text("{}")
    return vd


def test_incomplete_version_rejected(tmp_path):
    _make_version(tmp_path, "v1_20260101_000000", complete=False)
    assert not _is_complete_model_version(tmp_path, "v1_20260101_000000")
    assert resolve_version(tmp_path) is None


def test_latest_complete_version_wins(tmp_path):
    _make_version(tmp_path, "v1_20260101_000000")
    _make_version(tmp_path, "v1_20260201_000000")
    _make_version(tmp_path, "v1_20260301_000000", complete=False)  # aborted run
    assert resolve_version(tmp_path) == "v1_20260201_000000"


def test_production_pointer_pins_version(tmp_path):
    _make_version(tmp_path, "v1_20260101_000000")
    _make_version(tmp_path, "v1_20260201_000000")
    (tmp_path / "production.json").write_text(
        json.dumps({"version": "v1_20260101_000000", "previous": None})
    )
    assert resolve_version(tmp_path) == "v1_20260101_000000"


def test_bad_pointer_falls_back_to_latest(tmp_path):
    _make_version(tmp_path, "v1_20260101_000000")
    (tmp_path / "production.json").write_text(
        json.dumps({"version": "v9_does_not_exist"})
    )
    assert resolve_version(tmp_path) == "v1_20260101_000000"


def test_corrupt_pointer_ignored(tmp_path):
    _make_version(tmp_path, "v1_20260101_000000")
    (tmp_path / "production.json").write_text("{not json")
    assert read_production_pointer(tmp_path) is None
    assert resolve_version(tmp_path) == "v1_20260101_000000"
