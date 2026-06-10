"""
ONNX Runtime predictor for pretrained HuggingFace plant-disease models.

Integrates with the same interface as TFLitePredictor and KerasPredictor.
Selected automatically when the best available model version contains
model.onnx (i.e. a pretrained_v1_* directory) and no Keras/TFLite weights.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Optional

import numpy as np
from PIL import Image

from ml.config import MODELS_DIR, CONFIDENCE_THRESHOLD, CROPS
from ml.inference.tflite_predictor import _iter_usable_versions, _version_rank


class OnnxPredictor:
    """ONNX Runtime predictor for CropIntel pretrained models."""

    def __init__(self, crop: str, version: Optional[str] = None):
        if crop not in CROPS:
            raise ValueError(f"Unknown crop: {crop}")

        self.crop = crop
        self.model_dir = MODELS_DIR / crop

        # Version selection (same ranking logic as TFLitePredictor)
        if version:
            self.version = version
        else:
            versions = sorted(
                _iter_usable_versions(self.model_dir),
                key=lambda n: _version_rank(self.model_dir, n),
            )
            if not versions:
                raise ValueError(f"No trained models found for {crop}")
            self.version = versions[-1]

        vdir = self.model_dir / self.version
        onnx_path = vdir / "model.onnx"
        if not onnx_path.exists():
            raise FileNotFoundError(f"ONNX model not found: {onnx_path}")

        import onnxruntime as ort  # imported here to avoid hard dep at module level
        self._session = ort.InferenceSession(
            str(onnx_path), providers=["CPUExecutionProvider"]
        )
        self._input_name = self._session.get_inputs()[0].name

        # Load label map
        lm_path = vdir / "label_map.json"
        if not lm_path.exists():
            raise FileNotFoundError(f"label_map.json not found in {vdir}")
        lm = json.loads(lm_path.read_text())
        self.class_names: list[str] = [lm[str(i)] for i in range(len(lm))]

        # Image size from metadata (default 224×224)
        meta_path = vdir / "metadata.json"
        if meta_path.exists():
            meta = json.loads(meta_path.read_text())
            self.image_size: tuple[int, int] = tuple(meta.get("image_size", [224, 224]))
        else:
            self.image_size = (224, 224)

    # ------------------------------------------------------------------
    # Preprocessing
    # ------------------------------------------------------------------

    def preprocess_image(self, image: Image.Image) -> np.ndarray:
        """Resize to model input size and convert to float32 [0, 1] NHWC."""
        img = image.convert("RGB").resize(self.image_size)
        arr = np.array(img, dtype=np.float32) / 255.0
        return arr[np.newaxis]  # (1, H, W, 3)

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------

    def predict(self, image: Image.Image) -> Dict[str, float]:
        """
        Run inference on a PIL image.

        Returns:
            Dict mapping class name → confidence (float, 0-1).
        """
        pixel_values = self.preprocess_image(image)
        probs = self._session.run(None, {self._input_name: pixel_values})[0][0]
        return {cls: float(p) for cls, p in zip(self.class_names, probs)}

    def predict_top(self, image: Image.Image) -> tuple[str, float, Dict[str, float]]:
        """
        Predict the top class.

        Returns:
            (predicted_class, confidence, all_predictions_dict)
        """
        all_preds = self.predict(image)
        top_class = max(all_preds, key=all_preds.get)
        confidence = all_preds[top_class]
        return top_class, confidence, all_preds

    def predict_with_threshold(
        self, image: Image.Image
    ) -> Dict[str, object]:
        """
        Predict with confidence threshold applied.

        Returns dict compatible with the CropIntel API route format.
        """
        top_class, confidence, all_preds = self.predict_top(image)
        return {
            "predicted_class": top_class if confidence >= CONFIDENCE_THRESHOLD else "Unknown",
            "confidence": confidence,
            "all_predictions": all_preds,
            "threshold": CONFIDENCE_THRESHOLD,
            "model_version": self.version,
        }
