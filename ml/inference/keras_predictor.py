"""
Keras model predictor for crop disease classification.
Alternative to TFLite for better accuracy.
"""
import numpy as np
from pathlib import Path
from typing import Dict, Optional
import json
import tensorflow as tf
from PIL import Image

from ml.config import MODELS_DIR, CONFIDENCE_THRESHOLD, CROPS
from ml.inference.tflite_predictor import _iter_usable_versions, _version_rank


class KerasPredictor:
    """Keras model predictor for crop disease classification."""
    
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
        
        # Find model version — same completeness ranking as TFLitePredictor
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
        
        # Load model
        keras_path = self.model_dir / self.version / "checkpoint.keras"
        if not keras_path.exists():
            raise FileNotFoundError(f"Keras model not found: {keras_path}")
        
        self.model = tf.keras.models.load_model(keras_path)
        
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
    
    def preprocess_image(self, image: Image.Image) -> np.ndarray:
        """
        Preprocess image for inference.
        The Keras model includes the preprocessing layer, so inputs stay in [0, 1].
        
        Args:
            image: PIL Image
            
        Returns:
            Preprocessed image array in [0, 1] range
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
            Dictionary with prediction results
        """
        # Preprocess
        img_array = self.preprocess_image(image)
        
        # Make prediction
        predictions = self.model.predict(img_array, verbose=0)
        probabilities = predictions[0]
        
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
