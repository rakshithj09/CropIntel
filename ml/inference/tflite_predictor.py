"""
TensorFlow Lite inference module for production use.
"""
import numpy as np
from pathlib import Path
from typing import Dict, Tuple, Optional
import json
import tensorflow as tf
from PIL import Image

from ml.config import MODELS_DIR, CONFIDENCE_THRESHOLD, CROPS


def _is_complete_model_version(crop_dir: Path, version_name: str) -> bool:
    """Weights + class names; skips empty dirs and runs stopped before metadata export."""
    vd = crop_dir / version_name
    if not vd.is_dir():
        return False
    has_weights = (
        (vd / "model.tflite").exists()
        or (vd / "checkpoint.keras").exists()
        or (vd / "model.onnx").exists()
    )
    has_labels = (vd / "metadata.json").exists() or (vd / "label_map.json").exists()
    return has_weights and has_labels


def _version_rank(crop_dir: Path, version_name: str) -> tuple:
    """
    Prefer fully finished exports (TFLite + evaluated metrics), then lexical version id
    (timestamp suffix) so incomplete re-runs do not beat a good checkpoint.
    ONNX pretrained models rank below trained TFLite/Keras models but above incomplete runs.
    """
    vd = crop_dir / version_name
    has_tflite  = (vd / "model.tflite").exists()
    has_metrics = (vd / "metrics.json").exists()
    has_onnx    = (vd / "model.onnx").exists()
    # (has_tflite, has_metrics, has_onnx, version_name)
    # Fully trained TFLite+metrics > trained TFLite > pretrained ONNX > bare checkpoint
    return (has_tflite and has_metrics, has_tflite, has_onnx, version_name)


def _iter_usable_versions(crop_dir: Path) -> list[str]:
    if not crop_dir.is_dir():
        return []
    return [
        d.name
        for d in crop_dir.iterdir()
        if d.is_dir() and _is_complete_model_version(crop_dir, d.name)
    ]


class TFLitePredictor:
    """TensorFlow Lite model predictor for crop disease classification."""
    
    def __init__(self, crop: str, version: Optional[str] = None):
        """
        Initialize predictor for a specific crop.
        
        Args:
            crop: Crop name (corn, soybean, wheat, rice)
            version: Model version (defaults to latest)
        """
        if crop not in CROPS:
            raise ValueError(f"Unknown crop: {crop}")
        
        self.crop = crop
        self.model_dir = MODELS_DIR / crop
        
        # Find model version
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
        
        # Prefer Keras model for better accuracy, fallback to TFLite
        tflite_path = self.model_dir / self.version / "model.tflite"
        keras_path = self.model_dir / self.version / "checkpoint.keras"
        
        if keras_path.exists():
            # Use Keras model (more accurate, includes preprocessing layer)
            self.model = tf.keras.models.load_model(keras_path)
            self.use_keras = True
        elif tflite_path.exists():
            # Fallback to TFLite model
            self.interpreter = tf.lite.Interpreter(model_path=str(tflite_path))
            self.interpreter.allocate_tensors()
            self.use_keras = False
        else:
            raise FileNotFoundError(f"Neither Keras nor TFLite model found for {self.version}")
        
        # Load metadata
        metadata_path = self.model_dir / self.version / "metadata.json"
        if metadata_path.exists():
            with open(metadata_path, 'r') as f:
                self.metadata = json.load(f)
        else:
            # Fallback: load from label_map.json
            label_map_path = self.model_dir / self.version / "label_map.json"
            if label_map_path.exists():
                with open(label_map_path, 'r') as f:
                    label_map = json.load(f)
                self.metadata = {
                    "class_names": [label_map[str(i)] for i in range(len(label_map))],
                    "input_shape": list(CROPS[crop]["image_size"]) + [3]
                }
            else:
                raise FileNotFoundError(f"Metadata not found for {crop} model")
        
        self.class_names = self.metadata["class_names"]
        self.input_shape = tuple(self.metadata["input_shape"])
        
        # Get input/output details (only for TFLite)
        if not self.use_keras:
            self.input_details = self.interpreter.get_input_details()
            self.output_details = self.interpreter.get_output_details()
    
    def preprocess_image(self, image: Image.Image) -> np.ndarray:
        """
        Preprocess image for inference.
        Both Keras and TFLite exports include the same in-model rescaling layer,
        so inputs should stay normalized to [0, 1].
        
        Args:
            image: PIL Image
            
        Returns:
            Preprocessed image array
        """
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize to model input size
        image = image.resize(self.input_shape[:2])
        
        # Convert to array and normalize to [0, 1].
        img_array = np.array(image, dtype=np.float32) / 255.0
        
        # Expand dimensions for batch
        img_array = np.expand_dims(img_array, axis=0)
        
        return img_array
    
    def predict(self, image: Image.Image) -> Dict:
        """
        Predict disease from image.
        
        Args:
            image: PIL Image
            
        Returns:
            Dictionary with prediction results:
            {
                "disease": str,
                "confidence": float,
                "is_healthy": bool,
                "all_predictions": List[Dict]
            }
        """
        # Preprocess
        img_array = self.preprocess_image(image)
        
        if self.use_keras:
            # Use Keras model
            predictions = self.model.predict(img_array, verbose=0)
            probabilities = predictions[0]
        else:
            # Use TFLite model
            # Convert to appropriate dtype
            input_dtype = self.input_details[0]['dtype']
            img_array = img_array.astype(input_dtype)
            
            # Set input tensor
            self.interpreter.set_tensor(self.input_details[0]['index'], img_array)
            
            # Run inference
            self.interpreter.invoke()
            
            # Get output
            output_data = self.interpreter.get_tensor(self.output_details[0]['index'])
            probabilities = output_data[0]
        
        # Get prediction
        predicted_idx = int(np.argmax(probabilities))
        confidence = float(probabilities[predicted_idx])
        disease = self.class_names[predicted_idx]
        
        # Check if healthy
        is_healthy = disease.lower() == "healthy"
        
        # Get all predictions sorted by confidence
        all_predictions = [
            {
                "disease": self.class_names[i],
                "confidence": float(probabilities[i])
            }
            for i in range(len(self.class_names))
        ]
        all_predictions.sort(key=lambda x: x["confidence"], reverse=True)
        
        result = {
            "disease": disease,
            "confidence": confidence,
            "is_healthy": is_healthy,
            "meets_threshold": confidence >= CONFIDENCE_THRESHOLD,
            "all_predictions": all_predictions
        }
        
        return result
    
    def predict_from_path(self, image_path: Path) -> Dict:
        """
        Predict disease from image file path.
        
        Args:
            image_path: Path to image file
            
        Returns:
            Dictionary with prediction results
        """
        image = Image.open(image_path)
        return self.predict(image)
    
    def predict_from_array(self, image_array: np.ndarray) -> Dict:
        """
        Predict disease from numpy array.
        
        Args:
            image_array: Image array (H, W, C) normalized to [0, 1]
            
        Returns:
            Dictionary with prediction results
        """
        # Convert array to PIL Image
        if image_array.max() <= 1.0:
            image_array = (image_array * 255).astype(np.uint8)
        
        image = Image.fromarray(image_array)
        return self.predict(image)


def get_latest_model_version(crop: str) -> Optional[str]:
    """Best usable model version for a crop (prefers evaluated + TFLite export)."""
    model_dir = MODELS_DIR / crop
    versions = sorted(
        _iter_usable_versions(model_dir),
        key=lambda n: _version_rank(model_dir, n),
    )
    return versions[-1] if versions else None
