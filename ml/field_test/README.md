# Field Testing — Real-World Model Evaluation

These folders are for testing the trained models on **external images** (your own
photos, web images, partner field photos) — images that did NOT come from the
training datasets. This is the true measure of production readiness; the
98-100% in-dataset test accuracy does **not** predict field performance.

## Layout

One folder per crop, with a subfolder per disease class (names match the model):

```
ml/field_test/
  corn/     Blight/  Common Rust/  Gray Leaf Spot/  Healthy/
  soybean/  Healthy/  Powdery Mildew/  Sudden Death Syndrome/  Yellow Mosaic/
  wheat/    Healthy/  Leaf Rust/  Powdery Mildew/  Stripe (Yellow) Rust/
  rice/     Bacterial Leaf Blight/  Brown Spot/  Healthy/  Rice Blast/
```

## How to use

1. Drop external images into the subfolder matching their **true** disease.
   Aim for ~15-30 images per class to get a meaningful read.
   (Don't know the true label? Put loose images directly in the crop folder —
   the tester will just predict, without scoring.)

2. Run the evaluator:

   ```bash
   # labeled eval -> confusion matrix + real-world accuracy + confidence report
   .conda-py311/bin/python -m ml.scripts.test_external --crop corn --path ml/field_test/corn

   # test the mobile model instead of the full keras model
   .conda-py311/bin/python -m ml.scripts.test_external --crop rice --path ml/field_test/rice --backend tflite

   # single image
   .conda-py311/bin/python -m ml.scripts.test_external --crop wheat --path /path/to/photo.jpg
   ```

## Reading the result

- **External accuracy ≈ in-dataset accuracy** → generalizes well, close to production-ready.
- **External accuracy << in-dataset accuracy** → domain shift or shortcut learning;
  collect more field images and retrain/augment.
- **High accuracy but low mean confidence** → shaky; lean on the confidence
  threshold (currently 0.70) and show the top-2 predictions in the app.
- Watch **soybean** specifically: its Healthy images came from a different source
  than its disease images, so confidently calling a diseased real leaf "Healthy"
  would confirm source leakage — the fix is healthy images from the same source.

Images placed here are gitignored (see ml/field_test/.gitignore) so test photos
don't bloat the repo.
