"""
Data loading and preprocessing utilities for crop disease datasets.
"""
import os
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Tuple, List, Dict, Optional
from PIL import Image, ImageEnhance
import tensorflow as tf
from sklearn.model_selection import train_test_split

from ml.config import (
    DATA_DIR,
    CROPS,
    TRAINING_CONFIG,
    SOYBEAN_EXTRA_HEALTHY_IMAGE_DIRS,
)


class CropDatasetLoader:
    """Loads and preprocesses crop disease datasets."""
    
    def __init__(self, crop: str):
        """
        Initialize dataset loader for a specific crop.
        
        Args:
            crop: Crop name (corn, soybean, wheat, rice)
        """
        if crop not in CROPS:
            raise ValueError(f"Unknown crop: {crop}. Available: {list(CROPS.keys())}")
        
        self.crop = crop
        self.config = CROPS[crop]
        self.data_dir = DATA_DIR / crop
        # Check if data is in a subdirectory (common with Kaggle downloads)
        if (self.data_dir / "data").exists():
            self.data_dir = self.data_dir / "data"
        # Check for rice-specific subdirectory
        elif crop == "rice" and (self.data_dir / "Rice_Leaf_AUG").exists():
            self.data_dir = self.data_dir / "Rice_Leaf_AUG"
        # Many Kaggle datasets ship a train/valid/test split — the class folders
        # live under train/. Descend into it when present (e.g. wheat/data/train/).
        # Safe for corn (data/ holds class folders, no train/) and rice
        # (Rice_Leaf_AUG/ holds class folders, no train/).
        if (self.data_dir / "train").is_dir():
            self.data_dir = self.data_dir / "train"
        self.image_size = self.config["image_size"]
        self.diseases = self.config["diseases"]
        self.corrupt_count = 0  # number of unreadable/corrupt images skipped (item 5)
        # Authoritative integer-label → name mapping, set in load_dataset() from the
        # SORTED unique labels actually used for training (NOT config order). Display
        # helpers use this so printed class names match the trained labels.
        self.class_names = None
    
    def _label_name(self, idx: int) -> str:
        """Name for an integer label using the authoritative sorted mapping."""
        idx = int(idx)
        if self.class_names is not None and idx < len(self.class_names):
            return self.class_names[idx]
        if idx < len(self.diseases):
            return self.diseases[idx]
        return "?"

    def _candidate_folder_names_for_disease(self, disease: str) -> List[str]:
        """Directory names to try under a data root for this config disease label."""
        possible_names = [
            disease,
            disease.lower(),
            disease.replace(" ", "_"),
            disease.replace(" ", "-"),
        ]
        if self.crop == "rice":
            if disease == "Rice Blast":
                possible_names.insert(0, "Leaf Blast")
            elif disease == "Healthy":
                possible_names.insert(0, "Healthy Rice Leaf")
        if self.crop == "soybean":
            if disease == "Powdery Mildew":
                # dataset folders may use snake_case or old config name
                possible_names.insert(0, "powdery_mildew")
                possible_names.insert(1, "powdery mildew")
            elif disease == "Sudden Death Syndrome":
                # old config had a typo; keep both spellings for compatibility
                possible_names.insert(0, "Sudden Death Syndrone")
                possible_names.insert(1, "sudden death syndrome")
                possible_names.insert(2, "sudden_death_syndrome")
            elif disease == "Yellow Mosaic":
                possible_names.insert(0, "yellow_mosaic")
                possible_names.insert(1, "Yellow Mosaic Virus")
            elif disease == "Healthy":
                # NOTE: do NOT map "crestamento" here — it is Portuguese for leaf
                # scorch (a DISEASE), not healthy. Real healthy soybean images come
                # from supplemental/healthy. Mapping it poisoned the Healthy class.
                possible_names.insert(0, "healthy")
                possible_names.insert(1, "Healthy Leaf")
        if self.crop == "wheat":
            if disease == "Leaf Rust":
                possible_names.insert(0, "Brown Rust")
            elif disease == "Stem Rust":
                possible_names.insert(0, "Black Rust")
            elif disease == "Stripe (Yellow) Rust":
                possible_names.insert(0, "Yellow Rust")
                possible_names.insert(1, "Stripe Rust")
            elif disease == "Powdery Mildew":
                possible_names.insert(0, "Mildew")
        return possible_names
    
    def _resolve_class_folder(self, root: Path, disease: str) -> Optional[Path]:
        if not root.is_dir():
            return None
        for name in self._candidate_folder_names_for_disease(disease):
            folder_path = root / name
            if folder_path.exists() and folder_path.is_dir():
                return folder_path
        return None
    
    def _append_images_from_folder(
        self,
        folder_path: Path,
        disease_label: str,
        images: list,
        labels: list,
        class_names: list,
    ) -> int:
        """Load all images from folder_path into parallel lists; returns count added.

        Corrupted/unreadable images are skipped and counted in self.corrupt_count
        so the caller can report how many were dropped per crop (item 5).
        """
        image_files = self._get_image_files(folder_path)
        if not image_files:
            return 0
        print(f"Found {len(image_files)} images in {folder_path}")
        added = 0
        for img_path in image_files:
            try:
                img = Image.open(img_path)
                img.load()  # force full decode so truncated files raise here
                img = img.convert("RGB")
                img = img.resize(self.image_size)
                img_array = np.array(img, dtype=np.float32) / 255.0
                if img_array.shape != (self.image_size[1], self.image_size[0], 3):
                    raise ValueError(f"unexpected shape {img_array.shape}")
                images.append(img_array)
                labels.append(disease_label)
                class_names.append(disease_label)
                added += 1
            except Exception as e:
                self.corrupt_count += 1
                print(f"  [SKIP corrupt] {img_path}: {e}")
                continue
        return added
    
    def _random_augment_image(self, img: np.ndarray) -> np.ndarray:
        """Apply random aggressive augmentation to a [0,1] float32 H×W×3 image."""
        pil_img = Image.fromarray((img * 255).astype(np.uint8), mode='RGB')
        if np.random.random() > 0.5:
            pil_img = pil_img.transpose(Image.FLIP_LEFT_RIGHT)
        if np.random.random() > 0.5:
            pil_img = pil_img.transpose(Image.FLIP_TOP_BOTTOM)
        angle = float(np.random.uniform(-45, 45))
        pil_img = pil_img.rotate(angle, resample=Image.BILINEAR, fillcolor=(128, 128, 128))
        pil_img = ImageEnhance.Brightness(pil_img).enhance(float(np.random.uniform(0.7, 1.3)))
        w, h = pil_img.size
        zoom = float(np.random.uniform(0.85, 1.0))
        new_w, new_h = max(1, int(w * zoom)), max(1, int(h * zoom))
        left = int(np.random.randint(0, max(1, w - new_w + 1)))
        top = int(np.random.randint(0, max(1, h - new_h + 1)))
        pil_img = pil_img.crop((left, top, left + new_w, top + new_h))
        pil_img = pil_img.resize((w, h), Image.BILINEAR)
        return np.array(pil_img, dtype=np.float32) / 255.0

    def _cap_dominant_class(
        self, X: np.ndarray, y: np.ndarray, max_multiplier: float = 10.0
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Cap any class whose count exceeds max_multiplier × the SMALLEST class count.

        Item 2: cap at 10× the smallest class so no single class can dominate the
        (uniform, stratified) val set. Class weights (balanced, clipped to 5.0)
        handle the remaining skew via weighted loss.

        Called before train/val split so the cap applies uniformly to all splits.
        Uses a boolean mask applied simultaneously to X and y — no index separation,
        so image-label pairing is structurally preserved.
        """
        unique, counts = np.unique(y, return_counts=True)
        if len(unique) < 2:
            return X, y
        smallest = int(np.min(counts))
        cap = int(smallest * max_multiplier)
        rng = np.random.default_rng(seed=42)
        keep_mask = np.zeros(len(y), dtype=bool)
        modified = False
        for label, count in zip(unique, counts):
            cls_idx = np.where(y == label)[0]
            if int(count) > cap:
                chosen = rng.choice(cls_idx, size=cap, replace=False)
                keep_mask[chosen] = True
                print(f"  [CAP] class {int(label)} ({self._label_name(label)}): "
                      f"{int(count)} → {cap}  ({max_multiplier}× smallest={smallest})")
                modified = True
            else:
                keep_mask[cls_idx] = True
        if not modified:
            print(f"  No capping needed (largest {int(np.max(counts))} ≤ {cap} = {max_multiplier}× smallest {smallest}).")
            return X, y
        X_out, y_out = X[keep_mask], y[keep_mask]
        assert len(X_out) == len(y_out), (
            f"BUG _cap_dominant_class: X({len(X_out)}) != y({len(y_out)})")
        return X_out, y_out

    def _oversample_minority_classes(
        self, X: np.ndarray, y: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Augment minority classes up to the max class count (training set only).

        Oversampling targets the second-largest class count (to avoid amplifying the
        dominant class while still giving minority classes adequate representation).
        Image-label pairs are kept as Python tuples throughout augmentation and
        only unzipped into separate arrays at the very end.  A single permutation
        index array is applied to both X and y simultaneously, making it
        structurally impossible for images and labels to become misaligned.
        """
        assert len(X) == len(y), f"Input mismatch: X={len(X)}, y={len(y)}"
        unique, counts = np.unique(y, return_counts=True)
        max_count = int(np.max(counts))
        min_count = int(np.min(counts))

        def _verify_pairing(Xa, ya, tag):
            """Item 1: assert coupling and print 5 (index, label, class_name, image_shape)."""
            assert len(Xa) == len(ya), (
                f"BUG {tag}: X({len(Xa)}) != y({len(ya)}) — image/label decoupled!")
            print(f"\n  [VERIFY {tag}] len(X)={len(Xa)} len(y)={len(ya)} — coupled ✓")
            for i in range(min(5, len(ya))):
                cname = self._label_name(ya[i])
                print(f"    sample[{i}] label={int(ya[i])} ({cname}) "
                      f"image_shape={Xa[i].shape} mean={float(Xa[i].mean()):.3f}")

        # Skip oversampling when imbalance is mild — class weights handle it.
        # Oversampling a minority class by >100% creates distribution shift:
        # augmented synthetic images differ from the natural val distribution.
        if max_count / min_count <= 2.5:
            print(f"  No oversampling needed (imbalance ratio {max_count/min_count:.1f}× ≤ 2.5×).")
            _verify_pairing(X, y, "AFTER (no-op)")
            return X, y

        # Target = median class count, but never create more than 100% synthetic
        # copies of any class (cap at 2× original count to limit distribution shift).
        target = int(min(np.median(counts), min_count * 2))

        _verify_pairing(X, y, "BEFORE")

        # ── Build augmented pairs — image and label always together ─────────
        new_pairs: List[Tuple[np.ndarray, int]] = []
        for label, count in zip(unique, counts):
            if int(count) >= target:
                continue
            needed = target - int(count)
            cls_indices = np.where(y == label)[0]
            lbl_int = int(label)
            print(f"  Oversampling class {lbl_int} ({self._label_name(lbl_int)}): "
                  f"{int(count)} → {int(count) + needed} (+{needed} augmented)")
            chosen = np.random.choice(cls_indices, size=needed, replace=True)
            for src_idx in chosen:
                aug_img = self._random_augment_image(X[src_idx])
                new_pairs.append((aug_img, lbl_int))  # kept as a tuple — never separates

        if not new_pairs:
            print("  No oversampling needed (all classes at/above median).")
            return X, y

        # ── Unzip — guaranteed parallel because we unzip the same list ──────
        new_imgs, new_lbls = zip(*new_pairs)
        new_X = np.array(new_imgs, dtype=np.float32)
        new_y = np.array(new_lbls, dtype=y.dtype)
        assert len(new_X) == len(new_y) == len(new_pairs), "BUG: unzip length mismatch"

        # ── Concatenate original + augmented ────────────────────────────────
        X_out = np.concatenate([X, new_X], axis=0)
        y_out = np.concatenate([y, new_y], axis=0)
        assert len(X_out) == len(y_out), (
            f"BUG after concat: X_out({len(X_out)}) != y_out({len(y_out)})")

        # ── Shuffle: ONE permutation index applied to BOTH arrays ───────────
        rng = np.random.default_rng()          # independent RNG, not global state
        shuffle_idx = rng.permutation(len(X_out))   # returns new array (not in-place)
        X_out = X_out[shuffle_idx]
        y_out = y_out[shuffle_idx]
        assert len(X_out) == len(y_out), (
            f"BUG after shuffle: X_out({len(X_out)}) != y_out({len(y_out)})")

        # ── AFTER: show 5 sample (index, label, image_shape) pairs ──────────
        _verify_pairing(X_out, y_out, "AFTER")

        # ── Verify final class distribution ─────────────────────────────────
        out_unique, out_counts = np.unique(y_out, return_counts=True)
        print("\n  [VERIFY-DIST] Class distribution after oversampling:")
        for lbl, cnt in zip(out_unique, out_counts):
            print(f"    class {int(lbl)} ({self._label_name(lbl)}): {int(cnt)}")
        print(f"  Training set: {len(X)} → {len(X_out)} images (+{len(new_pairs)} augmented)")
        return X_out, y_out

    def _get_image_files(self, folder_path: Path) -> List[Path]:
        """Collect image files from a folder recursively (case-insensitive extensions)."""
        return (
            list(folder_path.rglob("*.jpg")) + list(folder_path.rglob("*.JPG")) +
            list(folder_path.rglob("*.jpeg")) + list(folder_path.rglob("*.JPEG")) +
            list(folder_path.rglob("*.png")) + list(folder_path.rglob("*.PNG"))
        )
        
    def load_dataset(self) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """
        Load images and labels from the dataset directory.
        
        Returns:
            Tuple of (images, labels, class_names)
        """
        images = []
        labels = []
        class_names = []
        self.corrupt_count = 0

        disease_folders: Dict[str, Path] = {}
        for disease in self.diseases:
            folder_path = self._resolve_class_folder(self.data_dir, disease)
            if folder_path is not None:
                disease_folders[disease] = folder_path

        if not disease_folders:
            raise ValueError(f"No disease folders found in {self.data_dir}")

        # Item 4: verify folder-name → label mapping (config uses spaces; some
        # dataset folders use underscores/hyphens/case variants).
        print(f"\n  [FOLDER MAP] {self.crop}: config disease label → resolved folder")
        for disease in self.diseases:
            resolved = disease_folders.get(disease)
            status = str(resolved.name) if resolved is not None else "*** NOT FOUND ***"
            print(f"    '{disease}'  →  {status}")
        missing = [d for d in self.diseases if d not in disease_folders]
        if missing:
            print(f"    [WARN] no base folder for: {missing} (may come from supplemental)")

        for disease, folder_path in disease_folders.items():
            n = self._append_images_from_folder(folder_path, disease, images, labels, class_names)
            if n == 0:
                print(f"Warning: No images loaded from {folder_path}")
        
        supplemental_root = DATA_DIR / self.crop / "supplemental"
        if supplemental_root.is_dir():
            sup_added = 0
            for disease in self.diseases:
                sup_folder = self._resolve_class_folder(supplemental_root, disease)
                if sup_folder is None:
                    continue
                n = self._append_images_from_folder(
                    sup_folder, disease, images, labels, class_names
                )
                sup_added += n
            if sup_added:
                print(
                    f"Merged {sup_added} supplemental images from {supplemental_root}"
                )
        
        # Optional: include extra healthy soybean images (Mendeley "Soybean Healthy", etc.).
        # Runs even when the Kaggle layout has no in-repo Healthy folder — those images
        # still map to label "Healthy".
        # Drop-in under ml/data:
        # - ml/data/soybean_mendeley/Healthy
        # - ml/data/soybean_healthy/Healthy
        # - ml/data/soybean_extra/Healthy
        # Plus SOYBEAN_EXTRA_HEALTHY_IMAGE_DIRS in ml/config.py (default ~/.../Soybean Healthy).
        if self.crop == "soybean" and "Healthy" in self.diseases:
            extra_roots = [
                DATA_DIR / "soybean_mendeley",
                DATA_DIR / "soybean_healthy",
                DATA_DIR / "soybean_extra",
            ]
            extra_added = 0
            for root in extra_roots:
                if not root.exists() or not root.is_dir():
                    continue
                healthy_candidates = [
                    p for p in root.iterdir()
                    if p.is_dir() and "healthy" in p.name.lower()
                ]
                for healthy_dir in healthy_candidates:
                    extra_files = self._get_image_files(healthy_dir)
                    if not extra_files:
                        continue
                    print(f"Including {len(extra_files)} extra soybean healthy images from {healthy_dir}")
                    for img_path in extra_files:
                        try:
                            img = Image.open(img_path).convert("RGB")
                            img = img.resize(self.image_size)
                            img_array = np.array(img, dtype=np.float32) / 255.0
                            images.append(img_array)
                            labels.append("Healthy")
                            class_names.append("Healthy")
                            extra_added += 1
                        except Exception as e:
                            print(f"Error loading {img_path}: {e}")
                            continue
            # Explicit healthy folders (env CROPINTEL_SOYBEAN_HEALTHY_DIRS and/or default ~/.../Soybean Healthy)
            for healthy_dir in SOYBEAN_EXTRA_HEALTHY_IMAGE_DIRS:
                if not healthy_dir.is_dir():
                    continue
                extra_files = self._get_image_files(healthy_dir)
                if not extra_files:
                    continue
                print(
                    f"Including {len(extra_files)} extra soybean healthy images from {healthy_dir}"
                )
                for img_path in extra_files:
                    try:
                        img = Image.open(img_path).convert("RGB")
                        img = img.resize(self.image_size)
                        img_array = np.array(img, dtype=np.float32) / 255.0
                        images.append(img_array)
                        labels.append("Healthy")
                        class_names.append("Healthy")
                        extra_added += 1
                    except Exception as e:
                        print(f"Error loading {img_path}: {e}")
                        continue
            if extra_added > 0:
                print(f"Total supplemental healthy soybean images: {extra_added}")
        
        if not images:
            raise ValueError(f"No images loaded from {self.data_dir}")
        
        # Convert to numpy arrays
        images = np.array(images, dtype=np.float32)
        
        # Create label mapping
        unique_diseases = sorted(list(set(labels)))
        disease_to_idx = {disease: idx for idx, disease in enumerate(unique_diseases)}
        label_indices = np.array([disease_to_idx[label] for label in labels])
        # Authoritative name list for integer labels (used by display helpers).
        self.class_names = unique_diseases
        
        # Shuffle data to prevent class ordering bias (all Healthy first, etc.)
        # This is critical to prevent the model from learning class order instead of features
        indices = np.arange(len(images))
        np.random.seed(42)  # For reproducibility
        np.random.shuffle(indices)
        images = images[indices]
        label_indices = label_indices[indices]
        
        print(f"Loaded {len(images)} images for {self.crop}")
        if self.corrupt_count:
            print(f"  [CORRUPT] skipped {self.corrupt_count} unreadable/corrupt images for {self.crop}")
        print(f"Diseases: {unique_diseases}")
        print(f"Class distribution: {pd.Series([unique_diseases[idx] for idx in label_indices]).value_counts().to_dict()}")

        return images, label_indices, unique_diseases
    
    def create_data_generators(
        self, 
        images: np.ndarray, 
        labels: np.ndarray,
        augment: bool = True
    ) -> Tuple[tf.keras.preprocessing.image.ImageDataGenerator, 
               tf.keras.preprocessing.image.ImageDataGenerator, np.ndarray]:
        """
        Create data generators for training and validation.
        
        Args:
            images: Image array
            labels: Label array
            augment: Whether to use data augmentation
            
        Returns:
            Tuple of (train_generator, val_generator, y_train_labels)
        """
        # Cap dominant class at 2× next-largest BEFORE splitting so the cap
        # is reflected uniformly across train / val / test sets.
        print("\nCapping dominant classes (max 2× next-largest) before split...")
        images, labels = self._cap_dominant_class(images, labels)
        print(f"Dataset after capping: {len(images)} images")

        # Split data. Fall back to non-stratified splits when a class is too small
        # for sklearn's stratified split requirements.
        label_counts = np.bincount(labels.astype(int))
        can_stratify_first_split = np.all(label_counts[label_counts > 0] >= 2)
        X_train, X_temp, y_train, y_temp = train_test_split(
            images, labels,
            test_size=TRAINING_CONFIG["test_split"] + TRAINING_CONFIG["validation_split"],
            stratify=labels if can_stratify_first_split else None,
            random_state=42
        )
        
        val_size = TRAINING_CONFIG["validation_split"] / (
            TRAINING_CONFIG["test_split"] + TRAINING_CONFIG["validation_split"]
        )
        temp_label_counts = np.bincount(y_temp.astype(int))
        can_stratify_second_split = np.all(temp_label_counts[temp_label_counts > 0] >= 2)
        X_val, X_test, y_val, y_test = train_test_split(
            X_temp, y_temp,
            test_size=1 - val_size,
            stratify=y_temp if can_stratify_second_split else None,
            random_state=42
        )
        
        # Save test set for later evaluation
        self.X_test = X_test
        self.y_test = y_test

        # Item 3: print per-class distribution for train/val/test and flag any
        # class whose val share exceeds 40% of that class's total (skewed split).
        num_classes_full = len(np.unique(labels))
        print("\n  [SPLIT DIST] per-class counts (train / val / test) and val-share:")
        tr = np.bincount(y_train.astype(int), minlength=num_classes_full)
        vl = np.bincount(y_val.astype(int), minlength=num_classes_full)
        te = np.bincount(y_test.astype(int), minlength=num_classes_full)
        for c in range(num_classes_full):
            total_c = tr[c] + vl[c] + te[c]
            val_share = (vl[c] / total_c) if total_c else 0.0
            flag = "  <<< VAL >40% — SKEWED SPLIT!" if val_share > 0.40 else ""
            print(f"    class {c}: train={tr[c]:5d}  val={vl[c]:5d}  test={te[c]:5d}  "
                  f"val_share={val_share:.1%}{flag}")

        # Oversample minority classes in training set only (no leakage into val/test)
        print("\nOversampling minority classes in training set...")
        X_train, y_train = self._oversample_minority_classes(X_train, y_train)
        print(f"Training set after oversampling: {len(X_train)} images\n")

        # Save training labels for class weight calculation
        self.y_train = y_train
        
        # Data augmentation for training.
        # CRITICAL: brightness_range is DELIBERATELY OMITTED. ImageDataGenerator's
        # apply_brightness_shift round-trips through PIL and destroys [0,1] float
        # images — it returns an all-zero (black) batch, which silently pinned every
        # prior training run to majority-class collapse. Verified via
        # ml/scripts/diagnose_pipeline.py. All other transforms preserve [0,1].
        if augment and TRAINING_CONFIG["augmentation"]:
            train_datagen = tf.keras.preprocessing.image.ImageDataGenerator(
                rotation_range=30,
                width_shift_range=0.2,
                height_shift_range=0.2,
                shear_range=0.2,
                zoom_range=0.3,
                horizontal_flip=True,
                vertical_flip=True,
                fill_mode='nearest'
            )
        else:
            train_datagen = tf.keras.preprocessing.image.ImageDataGenerator()
        
        # No augmentation for validation
        val_datagen = tf.keras.preprocessing.image.ImageDataGenerator()
        
        # Use total classes from the full dataset, not just the training split.
        # If a rare class lands entirely in val/test, np.unique(y_train) would be
        # smaller than the model's output size and cause a shape mismatch.
        num_classes = len(np.unique(labels))
        y_train_cat = tf.keras.utils.to_categorical(y_train, num_classes=num_classes)
        y_val_cat = tf.keras.utils.to_categorical(y_val, num_classes=num_classes)
        
        train_generator = train_datagen.flow(
            X_train, y_train_cat,
            batch_size=TRAINING_CONFIG["batch_size"],
            shuffle=True
        )

        val_generator = val_datagen.flow(
            X_val, y_val_cat,
            batch_size=TRAINING_CONFIG["batch_size"],
            shuffle=False
        )

        # Safety net: confirm augmentation did NOT zero/destroy the batch (guards
        # against the brightness_range class of bug ever returning).
        probe_x, probe_y = train_generator[0]
        train_generator.reset()
        bmin, bmax, bmean = float(probe_x.min()), float(probe_x.max()), float(probe_x.mean())
        print(f"  [AUG CHECK] train batch range=[{bmin:.4f},{bmax:.4f}] mean={bmean:.4f}")
        if bmax <= 1e-6:
            raise RuntimeError(
                "Augmented training batch is all-zero — augmentation is destroying "
                "images (see brightness_range bug). Aborting before wasting a run.")
        if bmax > 2.0:
            raise RuntimeError(
                f"Augmented training batch exceeds [0,1] (max={bmax:.2f}); "
                "an augmentation is rescaling to [0,255] and will break preprocessing.")

        return train_generator, val_generator, y_train
    
    def get_test_set(self) -> Tuple[np.ndarray, np.ndarray]:
        """Get the held-out test set."""
        if not hasattr(self, 'X_test'):
            raise ValueError("Test set not created. Call create_data_generators first.")
        return self.X_test, self.y_test
