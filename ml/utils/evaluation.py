"""
Evaluation utilities for model performance assessment.
"""
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (
    accuracy_score, precision_recall_fscore_support,
    confusion_matrix, classification_report
)
from pathlib import Path
import json
from typing import Dict, List, Tuple

from ml.config import MODELS_DIR


def evaluate_model(
    model,
    X_test: np.ndarray,
    y_test: np.ndarray,
    class_names: List[str],
    crop: str,
    version: str
) -> Dict:
    """
    Evaluate model performance on test set.
    
    Args:
        model: Trained Keras model
        X_test: Test images
        y_test: Test labels (integer indices)
        class_names: List of class names
        crop: Crop name
        version: Model version
        
    Returns:
        Dictionary with evaluation metrics
    """
    # Predictions
    y_pred_proba = model.predict(X_test, verbose=0)
    y_pred = np.argmax(y_pred_proba, axis=1)
    
    # Metrics
    accuracy = accuracy_score(y_test, y_pred)
    precision, recall, f1, support = precision_recall_fscore_support(
        y_test, y_pred, average='weighted', zero_division=0
    )
    
    # Per-class metrics
    per_class_metrics = precision_recall_fscore_support(
        y_test, y_pred, average=None, zero_division=0
    )
    
    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred)
    
    # Classification report
    report = classification_report(
        y_test, y_pred,
        target_names=class_names,
        output_dict=True,
        zero_division=0
    )
    
    metrics = {
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "f1_score": float(f1),
        "per_class": {
            class_names[i]: {
                "precision": float(per_class_metrics[0][i]),
                "recall": float(per_class_metrics[1][i]),
                "f1_score": float(per_class_metrics[2][i]),
                "support": int(per_class_metrics[3][i])
            }
            for i in range(len(class_names))
        },
        "confusion_matrix": cm.tolist(),
        "classification_report": report
    }
    
    # External eval (out-of-training-distribution) results, if present.
    # Written by `python -m ml.scripts.test_external --crop <crop> --save-json`;
    # the promotion gate reads metrics.json, so surface the headline numbers here.
    metrics["external_accuracy"] = None
    external = load_external_eval(crop, version)
    if external is not None:
        metrics["external_accuracy"] = external.get("external_accuracy")
        metrics["external_gate_passed"] = external.get("gate", {}).get("passed")

    # Save metrics
    model_dir = MODELS_DIR / crop / version
    model_dir.mkdir(parents=True, exist_ok=True)

    with open(model_dir / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    # Plot confusion matrix
    plot_confusion_matrix(cm, class_names, crop, version)

    return metrics


def load_external_eval(crop: str, version: str) -> Dict | None:
    """Load external_eval.json for a model version, or None if absent/unreadable."""
    path = MODELS_DIR / crop / version / "external_eval.json"
    if not path.exists():
        return None
    try:
        with open(path) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def update_metrics_with_external(crop: str, version: str) -> bool:
    """Fold external_eval.json results into an existing metrics.json.

    Returns True if metrics.json was updated. Used after running test_external
    --save-json on an already-trained version (evaluate_model only runs at
    training time).
    """
    model_dir = MODELS_DIR / crop / version
    metrics_path = model_dir / "metrics.json"
    external = load_external_eval(crop, version)
    if external is None or not metrics_path.exists():
        return False
    with open(metrics_path) as f:
        metrics = json.load(f)
    metrics["external_accuracy"] = external.get("external_accuracy")
    metrics["external_gate_passed"] = external.get("gate", {}).get("passed")
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    return True


def plot_confusion_matrix(
    cm: np.ndarray,
    class_names: List[str],
    crop: str,
    version: str
):
    """Plot and save confusion matrix."""
    plt.figure(figsize=(10, 8))
    sns.heatmap(
        cm,
        annot=True,
        fmt='d',
        cmap='Blues',
        xticklabels=class_names,
        yticklabels=class_names
    )
    plt.title(f'Confusion Matrix - {crop.capitalize()} Disease Classification')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    plt.tight_layout()
    
    model_dir = MODELS_DIR / crop / version
    plt.savefig(model_dir / "confusion_matrix.png", dpi=300, bbox_inches='tight')
    plt.close()
