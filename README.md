# CropIntel

CropIntel is a crop leaf-disease classifier (corn, soybean, wheat, rice, tomato) using EfficientNetB0 → TensorFlow Lite, served behind a Next.js UI. The repository includes a small FastAPI inference service (ml/serve) and a Next.js frontend (app/). The project supports two primary run modes: Docker Compose (recommended) and local development (FastAPI + Next.js).

This README is written for other developers: how the code is organized, how to run & debug locally, how models are managed and deployed, CI expectations, and where to look when things break.

Table of contents
- Overview
- Architecture & key files
- Quick start (Docker)
- Local development (no Docker)
- API contract (endpoints & payloads)
- Models & model bundle workflow
- Testing & CI
- Debugging & logs
- Environment variables
- Deployment options
- Contributing
- Troubleshooting
- License & contacts

## Overview
CropIntel provides:
- Browser UI (Next.js, app/) that uploads images to /api/predict.
- Firebase Authentication for email/password accounts and Firestore farm management.
- A lightweight inference service (FastAPI in ml/serve) that hosts per-crop TFLite models.
- Optional outbreak mapping using Google Maps (client-side).
- Single-container production deployment via docker-compose.prod.yml which runs both web + inference.

## Architecture & key files
- app/ — Next.js UI (React + Tailwind). API routes live here (app/api/*).
  - app/page.tsx — main UI page and image upload flow.
  - app/login, app/signup, app/onboarding, app/farms — Firebase Auth and farm management pages.
  - app/layout.tsx — global layout, fonts, footer.
  - app/api/predict/* or app/api/predict/route.ts — Next.js API route which forwards to the inference service.
- src/lib/firebase.ts — Firebase client initialization.
- src/lib/auth.ts, src/lib/farms.ts, src/lib/types.ts — Auth, Firestore farm/diagnosis actions, and shared TypeScript types.
- ml/
  - ml/serve/inference_app.py — FastAPI inference server (loads TFLite models).
  - ml/inference/ — inference helpers and predictor code.
  - ml/scripts — model packaging, fetching, and test scripts.
  - ml/requirements-inference.txt — runtime requirements for inference server.
- docker-compose.prod.yml — single container setup used in production (web + Python service).
- docker/ — Dockerfiles and helpers.
- docs/DEPLOYMENT.md — deployment notes (external).
- tests/ — pytest for Python + test harness for web where applicable.
- README.md — this file.

## Quick start (Docker) — recommended
- Build & run (single command, will fetch models automatically on first run):
  ```bash
  docker compose -f docker-compose.prod.yml up -d --build
  ```
- Check health:
  ```bash
  curl -fsS http://localhost:3050/api/health
  ```
- Open UI:
  ```
  http://localhost:3050
  ```

## Local development (no Docker)
Use this for code iteration / debugging the frontend or inference service separately.

1) Fetch models (once; saved to ml/models/ and gitignored)
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r ml/requirements-inference.txt
export CROPINTEL_MODELS_URL='https://github.com/rakshithj09/CropIntel/releases/download/v1/cropintel-models-mobile.zip'
python3 -m ml.scripts.fetch_models
```

2) Start the FastAPI inference service (terminal A)
```bash
python3 -m uvicorn ml.serve.inference_app:app --host 127.0.0.1 --port 8000
# inference service serves inference endpoints. Must be reachable from web API.
```

3) Start the Next.js frontend (terminal B)
```bash
npm install
npm run dev    # defaults: next dev -H 0.0.0.0 -p 3050
# use PORT or CLI to change port: npm run dev -- -p 3051
```

4) Firebase setup for Auth and Firestore
- Create a Firebase project.
- Enable Authentication -> Sign-in method -> Email/Password.
- Create a Firestore database.
- Add a Web app in Firebase project settings and copy the client config values into `.env.local`.
- Firestore collections are created by app actions automatically; do not create them manually.

Required Firebase environment values:
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

Firestore collections written by the app:
- `users/{userId}` for user profile records.
- `farms/{farmId}` for farm records and generated join codes.
- `farmMembers/{farmId_userId}` for owner/member access.
- `diagnoses/{diagnosisId}` for completed disease detections.

## API contract (what the frontend expects)
- POST /api/predict (Next.js API route)
  - Form data: image file under `image`, `crop` string
  - Returns (JSON):
    {
      "disease": "label",
      "confidence": 0.87,            // 0..1 or percent depending on code
      "is_healthy": false,
      "meets_threshold": true,
      "all_predictions": [ { label, confidence }, ... ]
    }
- Next.js /api/predict typically proxies this request to the inference service at INFERENCE_URL (default: http://127.0.0.1:8000). See app/api/predict/route.ts for exact proxy logic.

## Models & model bundle workflow
- Models shipped as a model bundle zip (cropintel-models-mobile.zip) in the GitHub release.
- ml/scripts/fetch_models downloads and unpacks models into ml/models/
- To retrain:
  - See ml/training/ for training scripts and ml/scripts/promote_model.py for the promotion pipeline.
  - Packaging: python3 -m ml.scripts.package_models --tflite-only -o cropintel-models-mobile.zip
  - Upload to GitHub Releases (gh CLI): gh release upload v1 cropintel-models-mobile.zip -R <owner/repo> --clobber
- The inference server caches models; to force a reload delete the `.cropintel-fetch-ok` marker in ml/models/ (or restart the container).

## Testing & CI
- Python tests: run pytest from repo root (ensure .venv with ml deps is active):
  ```bash
  pytest -q
  ```
- Frontend tests: (if present) run npm test
- CI (see .github/workflows/ci.yml) runs:
  - Python linters/tests for ml/
  - TypeScript checks for app/
  - Integration tests where possible
- Add tests for any new model preprocessing or inference behavior.

## Debugging & logs
- Docker Compose logs: docker compose -f docker-compose.prod.yml logs -f
- To debug failing /api/predict calls:
  1) Check the Next.js server log for the route invocation.
  2) Check the inference service logs (uvicorn) for errors.
  3) If you see ECONNREFUSED 127.0.0.1:8000 in a hosted environment (Vercel), remember that the FastAPI service is not running on Vercel. Deploy inference separately or remove the proxy.
- Steps to reproduce common issues:
  - Port conflicts: EADDRINUSE — use lsof -i :3050 or npx kill-port 3050
  - Missing models: check ml/models/ and the .cropintel-fetch-ok marker.

## Environment variables
- NEXT_PUBLIC_FIREBASE_API_KEY — Firebase Web API key.
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN — Firebase Auth domain.
- NEXT_PUBLIC_FIREBASE_PROJECT_ID — Firebase project ID used by Auth and Firestore.
- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET — Firebase storage bucket value from the web app config.
- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID — Firebase sender ID from the web app config.
- NEXT_PUBLIC_FIREBASE_APP_ID — Firebase web app ID.
- NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — optional, used by outbreak map (client-side).
- CROPINTEL_MODELS_URL — override default model bundle URL.
- CROPINTEL_ADMIN_TOKEN — admin token to guard /admin/reload (if enabled).
- NEXT_DEV_ALLOWED_ORIGINS — helper for phone-on-same-wifi dev UX.
- PORT / NEXT_PUBLIC_* — standard Next.js env variables.

## Deployment options
- Single-host: docker compose (docker-compose.prod.yml) runs both web + inference in one container.
- Cloud:
  - Deploy inference to a service (Cloud Run, Railway, Render, Fly) and point Next.js API proxy to that public URL.
  - Host Next.js on Vercel, Netlify, or Cloud Run. If hosted separately, update API proxy configuration to the deployed inference URL.
  - When deploying on GCP you may optionally enable: Maps JavaScript API (for outbreak map), Cloud Run, Cloud Storage for models, Secret Manager for tokens.

## CI/CD recommendations
- Publish models via GitHub Releases and use ml/scripts/fetch_models in deployments to fetch the current model bundle at startup.
- Add a Canary env that points to a "canary" model bundle for testing new models before promoting to v1.

## Contributing & workflow
- Feature branching with descriptive names: feat/<feature>, fix/<bug>
- Run local linters and tests before pushing.
- Update ml/scripts/package_models and ml/scripts/fetch_models as necessary if model format changes.
- When adding or changing labels/disease names, update:
  - ml/inference label maps
  - app/lib/crops.ts and app/lib/stateDiseaseMap.ts (regional priors / whitelists)
  - tests to reflect label changes

## Security notes
- Keep private API tokens out of the repo. Use environment variables or a secrets manager for production.
- Restrict Google Maps API key by HTTP referrer when using it in the browser.
- The repository includes a simple admin token mechanism; rotate CROPINTEL_ADMIN_TOKEN if used.

## Troubleshooting (quick)
- Docker: if `docker` CLI missing install Docker Desktop (macOS/Windows) or Docker Engine (Linux). On macOS if brew fails with "No developer tools installed" run:
  ```bash
  xcode-select --install
  ```
- Port already in use:
  ```bash
  lsof -nP -iTCP:3050 -sTCP:LISTEN
  kill -9 <PID>
  ```
  or npx kill-port 3050
- ECONNREFUSED 127.0.0.1:8000 on hosted platforms: the frontend is trying to proxy a local inference service. Deploy inference publicly or run it where your front-end can reach it.

## Useful commands summary
- Build & run (prod):
  ```bash
  docker compose -f docker-compose.prod.yml up -d --build
  ```
- Dev (inference + web):
  ```bash
  python3 -m uvicorn ml.serve.inference_app:app --host 127.0.0.1 --port 8000
  npm run dev
  ```
- Fetch models:
  ```bash
  python3 -m ml.scripts.fetch_models
  ```
- Kill port (quick):
  ```bash
  npx kill-port 3050
  ```

## Where to look in the code for common changes
- Add/adjust labels or crops: /app/lib/crops.ts and /app/lib/stateDiseaseMap.ts
- Change inference behavior: /ml/inference or /ml/serve/inference_app.py
- API route proxy behavior: app/api/predict/route.ts (or pages/api/predict.js)
- Map UI: app/components/USOutbreakMap.tsx
- Styles & layout: app/globals.css and app/page.tsx

## License
- MIT (see repository root LICENSE)

## Contacts
- Repo: https://github.com/rakshithj09/CropIntel
- If you add new maintainers, update this README and the repo settings.

## Acknowledgements
- Model & UI inspiration and open source tooling used: TensorFlow Lite, EfficientNet, Next.js, FastAPI, Leaflet/Google Maps.

...end of developer README...
