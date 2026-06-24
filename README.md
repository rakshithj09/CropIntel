---
title: CropIntel
emoji: 🌾
colorFrom: green
colorTo: blue
sdk: docker
app_port: 3050
pinned: false
---

<!-- The YAML block above configures the Hugging Face Space (Docker SDK,
     public port 3050). Required by HF; ignored by GitHub. See docs/DEPLOYMENT.md. -->

# CropIntel

Crop leaf-disease classifier for 5 crops (corn, soybean, wheat, rice, tomato),
EfficientNetB0 → TensorFlow Lite, served behind a Next.js UI. One Docker
container runs the web app and a persistent Python inference service together.

## Quick start (run the whole thing)

You do **not** need Kaggle, training, or any model files — the trained models
(~38 MB) are fetched automatically from the GitHub Release on first start.

```bash
git clone https://github.com/rakshithj09/CropIntel.git
cd CropIntel
docker compose -f docker-compose.prod.yml up -d --build
curl -fsS http://localhost:3050/api/health    # {"web":"ok","inference":{"ready":true,...}}
```

Open [http://localhost:3050](http://localhost:3050). That's it.

Optional environment (drop a `.env` next to the compose file):

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...               # only for the outbreak map
CROPINTEL_ADMIN_TOKEN=$(openssl rand -hex 16)     # only to guard POST /admin/reload
CROPINTEL_MODELS_URL=...                           # override the default v1 model bundle
```

For a real domain + TLS, monitoring, and model promotion/rollback, see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Local development (no Docker)

The web app forwards predictions to the inference service, so run both:

```bash
# 1) fetch models once (into ml/models/, gitignored)
pip install -r ml/requirements-inference.txt
export CROPINTEL_MODELS_URL='https://github.com/rakshithj09/CropIntel/releases/download/v1/cropintel-models-mobile.zip'
python3 -m ml.scripts.fetch_models

# 2) start the inference service (terminal A)
python3 -m uvicorn ml.serve.inference_app:app --host 127.0.0.1 --port 8000

# 3) start the web app (terminal B)
npm install && npm run dev
```

Open [http://localhost:3050](http://localhost:3050). The UI calls `/api/predict`,
which forwards to the inference service at `INFERENCE_URL` (default
`http://127.0.0.1:8000`).

For Vercel, add this server-side environment variable:

```bash
INFERENCE_URL=https://jaithrap-cropintel.hf.space/api
```

## Train it yourself (needs Kaggle data)

See [ml/README.md](ml/README.md) for the Kaggle API setup and training scripts
(`pip install -r ml/requirements.txt`). Models are gated on an **external**
(out-of-distribution) eval before promotion — see
`ml/scripts/test_external.py` and `ml/scripts/promote_model.py`.

## Maintainer: ship updated models

After training/promoting, repackage and replace the release bundle:

```bash
python3 -m ml.scripts.package_models --tflite-only -o cropintel-models-mobile.zip
gh release upload v1 cropintel-models-mobile.zip -R rakshithj09/CropIntel --clobber
# on a running server: rm ml/models/.cropintel-fetch-ok && docker compose -f docker-compose.prod.yml restart
```

## Project layout

- `app/` — Next.js UI + `/api/predict` (forwards to the inference service) + `/api/health`
- `ml/serve/inference_app.py` — FastAPI inference service (loads every crop model once)
- `ml/` — training (`training/`), predictors (`inference/`), config, scripts
- `docker-compose.prod.yml`, `docker/`, `docs/DEPLOYMENT.md` — production deploy
- `tests/` — pytest suite (`.github/workflows/ci.yml` runs web + Python checks)

## Troubleshooting: port 3050 already in use

If you see "Error: listen EADDRINUSE: address already in use 0.0.0.0:3050" when running npm run dev, either stop the process using port 3050 or start the dev server on another port.

Options:

1) Find and kill the process (macOS / Linux)
```bash
# show process listening on port 3050
lsof -nP -iTCP:3050 -sTCP:LISTEN

# kill by PID (replace <PID> with the number from the previous command)
kill -9 <PID>
```

2) One‑liner to kill the port (cross‑platform via npx)
```bash
npx kill-port 3050
```

3) Start the dev server on a different port
```bash
# pass a different port to next
npm run dev -- -p 3051

# or set PORT env then run
PORT=3051 npm run dev
```

After freeing the port or choosing another port, re-run:
```bash
npm run dev
```

## License

See repository.
