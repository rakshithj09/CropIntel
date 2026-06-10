#!/usr/bin/env python3
"""
Download pretrained HuggingFace plant-disease models, export to ONNX,
and create CropIntel-format model directories for corn, wheat, and rice.

Sources
-------
- LishaV01/agriculture-crop-disease-detection  (ViT, 20-class, 95.4 % accuracy)
  Used for: corn, wheat, rice
- sbaner24/vit-base-patch16-224-Soybean_11-46   (ViT, 5-class, 93 % accuracy)
  SKIPPED: model id2label contains only numeric placeholders (0-4);
           class-to-disease mapping is unknown.

Usage
-----
    python -m ml.scripts.download_pretrained_models [--test] [--crops corn wheat rice]
"""
import argparse
import json
import os
import sys
import traceback
from datetime import datetime
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForImageClassification

from ml.config import MODELS_DIR

# ---------------------------------------------------------------------------
# Class mappings  (source model index → CropIntel label)
# ---------------------------------------------------------------------------
# Full id2label from LishaV01 config.json:
#   0  Corn___Common_Rust        1  Corn___Gray_Leaf_Spot
#   2  Corn___Healthy            3  Invalid
#   4  Potato___Early_Blight     5  Potato___Healthy
#   6  Potato___Late_Blight      7  Rice___Brown_Spot
#   8  Rice___Healthy            9  Rice___Leaf_Blast
#  10  Wheat___Brown_Rust       11  Wheat___Healthy
#  12  Wheat___Yellow_Rust      13  Rice_Bacterial Blight Disease
#  14  Rice_Blast Disease       15  Rice_Brown Spot Disease
#  16  Rice_False Smut Disease  17  sugarcane_Bacterial Blight
#  18  sugarcane_Healthy        19  sugarcane_Red Rot

CROPS_CONFIG = [
    {
        "crop": "corn",
        "repo": "LishaV01/agriculture-crop-disease-detection",
        # source has no Blight class → 3-class model
        "class_map": {
            0: "Common Rust",
            1: "Gray Leaf Spot",
            2: "Healthy",
        },
        "note": (
            "3-class model (source model has no Corn Blight class). "
            "Source: LishaV01/agriculture-crop-disease-detection, reported accuracy 0.954."
        ),
    },
    {
        "crop": "wheat",
        "repo": "LishaV01/agriculture-crop-disease-detection",
        # source has no Powdery Mildew → 3-class model
        "class_map": {
            10: "Leaf Rust",
            11: "Healthy",
            12: "Stripe (Yellow) Rust",
        },
        "note": (
            "3-class model (source model has no Powdery Mildew class). "
            "Source: LishaV01/agriculture-crop-disease-detection, reported accuracy 0.954."
        ),
    },
    {
        "crop": "rice",
        "repo": "LishaV01/agriculture-crop-disease-detection",
        # Use the more descriptive label set (indices 13-15) + Healthy from index 8
        "class_map": {
            8:  "Healthy",
            13: "Bacterial Leaf Blight",
            14: "Rice Blast",
            15: "Brown Spot",
        },
        "note": (
            "4-class model using indices 8,13,14,15 from the source model. "
            "Source: LishaV01/agriculture-crop-disease-detection, reported accuracy 0.954."
        ),
    },
]

SOYBEAN_SKIP_NOTE = (
    "Soybean model sbaner24/vit-base-patch16-224-Soybean_11-46 was SKIPPED.\n"
    "Reason: id2label contains only numeric placeholders {0:'0',...,4:'4'}.\n"
    "The training dataset folder ordering is unknown, so the mapping\n"
    "[Powdery Mildew, Sudden Death Syndrome, Yellow Mosaic, Healthy, ...]\n"
    "cannot be safely determined without inspecting the original dataset.\n"
    "To use this model, determine the class order from the original training\n"
    "dataset and add a SOYBEAN_CLASS_MAP entry to this script."
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def log(msg: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def export_to_onnx(
    pt_model: torch.nn.Module,
    processor,
    onnx_path: Path,
) -> None:
    """Export a PyTorch HuggingFace model to ONNX with fixed 224×224 input."""
    pt_model.eval()

    # Dummy input: pixel_values in channels-first format (B, C, H, W)
    dummy_img = np.random.randint(0, 256, (224, 224, 3), dtype=np.uint8)
    pil_img = Image.fromarray(dummy_img)
    inputs = processor(images=pil_img, return_tensors="pt")
    pixel_values = inputs["pixel_values"]  # (1, 3, 224, 224)

    onnx_path.parent.mkdir(parents=True, exist_ok=True)
    with torch.no_grad():
        torch.onnx.export(
            pt_model,
            (pixel_values,),
            str(onnx_path),
            input_names=["pixel_values"],
            output_names=["logits"],
            dynamic_axes=None,   # fixed batch=1
            opset_version=14,
            do_constant_folding=True,
        )
    log(f"  ONNX saved: {onnx_path} ({onnx_path.stat().st_size / (1024**2):.1f} MB)")


def build_class_subset_onnx(
    full_onnx_path: Path,
    source_indices: list,
    output_labels: list,
    out_onnx_path: Path,
    image_mean: list,
    image_std: list,
) -> None:
    """
    Post-process the full ONNX model to add:
      1. Input normalization (subtract mean, divide std over the channel dim)
         so the model accepts raw [0,1] float32 (H×W×C channels-last) input.
      2. A class-subset slice + softmax over only the selected source indices.

    The resulting ONNX model:
      - Input:  pixel_values  float32  [1, 224, 224, 3]   (channels-last, [0,1])
      - Output: probabilities float32  [1, N_classes]
    """
    import onnx
    from onnx import helper, TensorProto, numpy_helper

    base = onnx.load(str(full_onnx_path))

    # -----------------------------------------------------------------------
    # Build a small preprocessing + slice graph around the existing model.
    # We append new nodes *before* the existing graph's input and *after*
    # its output rather than modifying existing node names.
    # -----------------------------------------------------------------------
    n_classes = len(source_indices)

    # 1. Transpose NHWC → NCHW
    transpose_node = helper.make_node(
        "Transpose",
        inputs=["input_nhwc"],
        outputs=["input_nchw"],
        perm=[0, 3, 1, 2],
        name="pre_transpose",
    )

    # 2. Channel-wise normalization: (x - mean) / std  using per-channel constants
    mean_data = np.array(image_mean, dtype=np.float32).reshape(1, 3, 1, 1)
    std_data  = np.array(image_std,  dtype=np.float32).reshape(1, 3, 1, 1)
    mean_init = numpy_helper.from_array(mean_data, name="norm_mean")
    std_init  = numpy_helper.from_array(std_data,  name="norm_std")

    sub_node = helper.make_node("Sub",  ["input_nchw",  "norm_mean"], ["sub_out"], name="pre_sub")
    div_node = helper.make_node("Div",  ["sub_out",     "norm_std"],  ["div_out"], name="pre_div")

    # 3. Rename div_out → the name expected by the original model's first input
    orig_input_name  = base.graph.input[0].name
    orig_output_name = base.graph.output[0].name

    identity_node = helper.make_node("Identity", ["div_out"], [orig_input_name], name="pre_identity")

    # 4. Gather the selected logits
    indices_data = np.array(source_indices, dtype=np.int64)
    indices_init = numpy_helper.from_array(indices_data, name="class_indices")
    gather_node  = helper.make_node(
        "Gather",
        inputs=[orig_output_name, "class_indices"],
        outputs=["selected_logits"],
        axis=1,
        name="post_gather",
    )

    # 5. Softmax
    softmax_node = helper.make_node(
        "Softmax",
        inputs=["selected_logits"],
        outputs=["probabilities"],
        axis=1,
        name="post_softmax",
    )

    # Build merged graph
    new_input = helper.make_tensor_value_info("input_nhwc", TensorProto.FLOAT, [1, 224, 224, 3])
    new_output = helper.make_tensor_value_info("probabilities", TensorProto.FLOAT, [1, n_classes])

    new_nodes = (
        [transpose_node, sub_node, div_node, identity_node]
        + list(base.graph.node)
        + [gather_node, softmax_node]
    )
    new_initializers = list(base.graph.initializer) + [mean_init, std_init, indices_init]

    new_graph = helper.make_graph(
        nodes=new_nodes,
        name="cropintel_plant_disease",
        inputs=[new_input],
        outputs=[new_output],
        initializer=new_initializers,
    )

    new_model = helper.make_model(new_graph, opset_imports=base.opset_import)
    new_model.ir_version = base.ir_version

    onnx.checker.check_model(new_model)
    onnx.save(new_model, str(out_onnx_path))
    log(f"  Subset ONNX saved: {out_onnx_path} ({out_onnx_path.stat().st_size / (1024**2):.1f} MB)")


def save_metadata(
    crop: str,
    out_dir: Path,
    source_repo: str,
    label_map: dict,
    note: str,
    image_mean: list,
    image_std: list,
) -> None:
    """Write label_map.json, metadata.json, training_info.json."""
    out_dir.mkdir(parents=True, exist_ok=True)

    (out_dir / "label_map.json").write_text(json.dumps(label_map, indent=2))

    metadata = {
        "crop": crop,
        "version": out_dir.name,
        "source_model": source_repo,
        "num_classes": len(label_map),
        "class_names": list(label_map.values()),
        "image_size": [224, 224],
        "input_dtype": "float32",
        "input_range": [0.0, 1.0],
        "input_layout": "NHWC (channels last)",
        "normalization": f"mean={image_mean} std={image_std} (embedded in model)",
        "model_file": "model.onnx",
        "runtime": "onnxruntime",
        "quantization": "none (float32 ONNX)",
        "note": note,
        "created_at": datetime.now().isoformat(),
    }
    (out_dir / "metadata.json").write_text(json.dumps(metadata, indent=2))

    ti = {
        "crop": crop,
        "version": out_dir.name,
        "model_architecture": "ViT (pretrained HuggingFace)",
        "source_repo": source_repo,
        "num_classes": len(label_map),
        "class_names": list(label_map.values()),
        "fine_tuned": False,
        "from_scratch": False,
        "backbone_weights": "pretrained",
    }
    (out_dir / "training_info.json").write_text(json.dumps(ti, indent=2))
    log(f"  Metadata written to {out_dir}")


def run_test(onnx_path: Path, label_map: dict) -> None:
    """Run a sanity-check prediction on a random image."""
    import onnxruntime as ort

    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    inp_name = sess.get_inputs()[0].name
    dummy = np.random.rand(1, 224, 224, 3).astype(np.float32)
    probs = sess.run(None, {inp_name: dummy})[0][0]
    idx   = int(np.argmax(probs))
    label = label_map.get(str(idx), "?")
    log(f"  Test → {label} ({probs[idx]:.3f})")
    log(f"  All:  { {label_map.get(str(i), str(i)): round(float(p), 3) for i, p in enumerate(probs)} }")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Download and convert pretrained models to ONNX")
    parser.add_argument("--test",  action="store_true", help="Run test prediction after each crop")
    parser.add_argument("--crops", nargs="+", default=None, help="Only process these crops")
    args = parser.parse_args()

    selected = set(args.crops) if args.crops else None

    # Cache downloaded model per repo (corn/wheat/rice share the same source)
    _cache: dict = {}

    # Temp dir for full-model ONNX files (deleted per-repo after subset models are built)
    tmp_dir = ROOT / "ml" / "logs" / "_onnx_tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    for cfg in CROPS_CONFIG:
        crop = cfg["crop"]
        if selected and crop not in selected:
            continue

        log(f"\n{'='*60}")
        log(f"CROP: {crop.upper()}")
        log(f"{'='*60}")

        try:
            repo = cfg["repo"]
            class_map: dict = cfg["class_map"]
            source_indices = list(class_map.keys())
            output_labels  = list(class_map.values())

            # ----------------------------------------------------------------
            # 1. Download / cache HuggingFace model
            # ----------------------------------------------------------------
            if repo not in _cache:
                log(f"  Downloading {repo} ...")
                processor = AutoImageProcessor.from_pretrained(repo)
                pt_model  = AutoModelForImageClassification.from_pretrained(repo)
                pt_model.eval()
                _cache[repo] = (processor, pt_model)
                log("  Download complete.")
            else:
                log(f"  Using cached {repo}")
            processor, pt_model = _cache[repo]

            image_mean = list(getattr(processor, "image_mean", [0.485, 0.456, 0.406]))
            image_std  = list(getattr(processor, "image_std",  [0.229, 0.224, 0.225]))

            # ----------------------------------------------------------------
            # 2. Export full model to ONNX (reuse per repo)
            # ----------------------------------------------------------------
            full_onnx = tmp_dir / f"{repo.replace('/', '_')}_full.onnx"
            if not full_onnx.exists():
                log("  Exporting to ONNX ...")
                export_to_onnx(pt_model, processor, full_onnx)
            else:
                log(f"  Reusing existing full ONNX: {full_onnx.name}")

            # ----------------------------------------------------------------
            # 3. Build crop-specific subset ONNX
            # ----------------------------------------------------------------
            version = f"pretrained_v1_{datetime.now().strftime('%Y%m%d')}"
            out_dir = MODELS_DIR / crop / version
            out_dir.mkdir(parents=True, exist_ok=True)
            subset_onnx = out_dir / "model.onnx"

            log(f"  Building {len(source_indices)}-class subset ONNX → {subset_onnx.name}")
            build_class_subset_onnx(
                full_onnx_path=full_onnx,
                source_indices=source_indices,
                output_labels=output_labels,
                out_onnx_path=subset_onnx,
                image_mean=image_mean,
                image_std=image_std,
            )

            # ----------------------------------------------------------------
            # 4. Write metadata
            # ----------------------------------------------------------------
            label_map = {str(i): lbl for i, lbl in enumerate(output_labels)}
            save_metadata(
                crop=crop,
                out_dir=out_dir,
                source_repo=repo,
                label_map=label_map,
                note=cfg["note"],
                image_mean=image_mean,
                image_std=image_std,
            )

            # ----------------------------------------------------------------
            # 5. Optional test
            # ----------------------------------------------------------------
            if args.test:
                log("  Running test prediction ...")
                run_test(subset_onnx, label_map)

            log(f"  ✓ {crop} model ready at {out_dir}")

        except Exception as e:
            log(f"  ERROR processing {crop}: {e}")
            traceback.print_exc()

    # Clean up temp full-model ONNX files
    for f in tmp_dir.glob("*.onnx"):
        f.unlink()
    if not any(tmp_dir.iterdir()):
        tmp_dir.rmdir()

    # Soybean note
    log(f"\n{'='*60}")
    log("SOYBEAN: SKIPPED")
    log(SOYBEAN_SKIP_NOTE)
    log(f"{'='*60}")

    log("\nAll done. Models saved to ml/models/<crop>/pretrained_v1_<date>/")
    log("Runtime: onnxruntime (see ml/inference/onnx_predictor.py)")


if __name__ == "__main__":
    main()
