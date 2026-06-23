# CropIntel FastAPI Backend Deployment

The disease detection backend already exists at `ml/serve/inference_app.py`.
Deploy it separately from Vercel and keep the frontend `INFERENCE_URL` pointing
at the deployed backend.

## Backend Image

Use `Dockerfile.backend` for the standalone FastAPI service:

```bash
docker build -f Dockerfile.backend -t cropintel-backend .
docker run --rm -p 8000:8000 \
  -e PORT=8000 \
  -e CROPINTEL_CORS_ORIGINS=https://YOUR_VERCEL_APP.vercel.app \
  cropintel-backend
```

The container starts:

```bash
python -m uvicorn ml.serve.inference_app:app --host 0.0.0.0 --port ${PORT:-8000}
```

That is the required binding for Cloud Run, Render, and most container hosts.

## Model Files

The backend will not serve predictions without trained models. The deployment
supports two model paths:

1. Build from a local checkout that already contains `ml/models`. The backend
   Docker context does not exclude `ml/models`, so the image includes the local
   TFLite model files copied by `COPY ml /app/ml`.
2. Build from Git and set `CROPINTEL_MODELS_URL` to a direct `.zip` download of
   the model bundle. On container start, `docker/backend-entrypoint.sh` downloads
   and installs the models before starting FastAPI.

The entrypoint runs `python -m ml.scripts.verify_models` and fails startup if any
configured crop is missing a usable `model.tflite` or `checkpoint.keras`.

## Required Backend Environment

```bash
PORT=8000
CROPINTEL_BACKEND=tflite
CROPINTEL_CORS_ORIGINS=https://YOUR_VERCEL_APP.vercel.app
```

Optional:

```bash
CROPINTEL_MODELS_URL=https://YOUR_MODEL_BUNDLE_URL/cropintel-models-mobile.zip
CROPINTEL_ADMIN_TOKEN=replace-with-random-secret
CROPINTEL_PREDICTION_LOG=/app/data/predictions.jsonl
```

For multiple frontend origins, use a comma-separated list:

```bash
CROPINTEL_CORS_ORIGINS=https://YOUR_VERCEL_APP.vercel.app,https://www.example.com
```

## Google Cloud Run

From a checkout with `ml/models` present:

```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/cropintel-backend \
  --file Dockerfile.backend

gcloud run deploy cropintel-backend \
  --image gcr.io/PROJECT_ID/cropintel-backend \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 60 \
  --set-env-vars CROPINTEL_BACKEND=tflite,CROPINTEL_CORS_ORIGINS=https://YOUR_VERCEL_APP.vercel.app
```

If Cloud Build builds from Git where `ml/models` is absent, add:

```bash
--set-env-vars CROPINTEL_MODELS_URL=https://YOUR_MODEL_BUNDLE_URL/cropintel-models-mobile.zip,CROPINTEL_BACKEND=tflite,CROPINTEL_CORS_ORIGINS=https://YOUR_VERCEL_APP.vercel.app
```

After deploy, copy the Cloud Run service URL, for example:

```text
https://cropintel-backend-xxxxx-uc.a.run.app
```

Health check:

```bash
curl https://cropintel-backend-xxxxx-uc.a.run.app/readyz
```

## Render

Create a new Web Service:

- Environment: Docker
- Dockerfile path: `Dockerfile.backend`
- Health check path: `/readyz`
- Instance size: use at least 2 GB RAM for the TensorFlow/TFLite runtime

Set environment variables:

```bash
CROPINTEL_BACKEND=tflite
CROPINTEL_CORS_ORIGINS=https://YOUR_VERCEL_APP.vercel.app
CROPINTEL_MODELS_URL=https://YOUR_MODEL_BUNDLE_URL/cropintel-models-mobile.zip
```

Render sets `PORT` automatically. The backend Dockerfile reads it at startup.

## Vercel Frontend

In Vercel, set this environment variable for Production, Preview, and
Development as needed:

```bash
INFERENCE_URL=https://YOUR_DEPLOYED_BACKEND_URL
```

Do not include a trailing path. The Next.js routes append the backend endpoints:

- `app/api/predict/route.ts` forwards to `${INFERENCE_URL}/predict`
- `app/api/health/route.ts` checks `${INFERENCE_URL}/readyz`

Local development still works without `INFERENCE_URL`; it falls back to
`http://127.0.0.1:8000` only when `NODE_ENV` is not `production`.

Expected production flow:

```text
Vercel frontend -> /api/predict -> deployed FastAPI backend -> disease model prediction
```
