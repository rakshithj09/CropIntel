# CropIntel Production Deployment (single VPS)

One Docker container runs both the Next.js web app and the Python inference
service (supervisord manages the two processes). Models are fetched once at
container start from a release zip. Right-sized for a single server — no
Kubernetes, no Redis, no external model registry.

## Architecture

```
internet ── Caddy (TLS, :443) ── Next.js (:3050, public)
                                    │  POST /api/predict  ──►  FastAPI inference
                                    │  GET  /api/health   ──►  service (127.0.0.1:8000,
                                    │                          never exposed)
                                    └─ models: ml/models/<crop>/<version>/model.tflite
                                       audit log: data/predictions.jsonl
```

- `app/api/predict/route.ts` validates + rate-limits, then forwards the upload
  to the inference service (`ml/serve/inference_app.py`), which keeps all crop
  models loaded in memory (TFLite, ~9 MB per crop).
- `GET /api/health` aggregates web liveness + per-crop model readiness — point
  the compose healthcheck and your uptime monitor at it.

## Prerequisites

- VPS with 2 vCPU / 4 GB RAM (TFLite backend; Keras would need ~4× more)
- Docker + compose plugin
- A domain pointed at the VPS (for TLS)

## First deploy

```bash
git clone <repo> /opt/cropintel && cd /opt/cropintel

# .env — models bundle + optional secrets
cat > .env <<'EOF'
CROPINTEL_MODELS_URL=https://github.com/rakshithj09/CropIntel/releases/download/v1/cropintel-models-mobile.zip
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
CROPINTEL_ADMIN_TOKEN=<random string>   # protects POST /admin/reload
EOF

docker compose -f docker-compose.prod.yml up -d --build
curl -fsS http://localhost:3050/api/health   # expect {"web":"ok","inference":{"ready":true,...}}
```

The models zip is produced by:
```bash
python -m ml.scripts.package_models --tflite-only -o cropintel-models-mobile.zip
```
and uploaded to a GitHub Release (or any direct-download URL).

### Reverse proxy (TLS)

Caddy on the host is the simplest option:

```
# /etc/caddy/Caddyfile
yourdomain.example {
    reverse_proxy 127.0.0.1:3050
}
```

Caddy sets `X-Forwarded-For` automatically. The in-memory rate limiter keys on
the client IP — behind any proxy that does NOT set `X-Forwarded-For`, all
clients share one bucket. Verify your proxy sets it.

## Updating

| What changed | Do |
|---|---|
| Code | `git pull && docker compose -f docker-compose.prod.yml up -d --build` |
| Models (new bundle) | update `CROPINTEL_MODELS_URL`, then `rm ml/models/.cropintel-fetch-ok && docker compose -f docker-compose.prod.yml restart` |
| Models (promote a version already on disk) | see below |

**Gotcha:** `ml/models/.cropintel-fetch-ok` is a sentinel that suppresses
re-downloading the models bundle on every container start. A new bundle URL is
silently ignored until you delete this file.

## Model promotion / rollback

Versions live in `ml/models/<crop>/v1_YYYYMMDD_HHMMSS/`. The serving version is
pinned by `ml/models/<crop>/production.json`; without it, the latest complete
version serves (legacy behavior).

```bash
# status of every crop (serving version, test + external accuracy)
python -m ml.scripts.promote_model --status

# promote (gated on metrics.json accuracy + a passing external_eval.json)
python -m ml.scripts.promote_model --crop rice --version v1_20260612_103000

# instant rollback to the previous pointer
python -m ml.scripts.promote_model --crop rice --rollback

# apply without restarting the container
curl -X POST -H "X-Admin-Token: $CROPINTEL_ADMIN_TOKEN" localhost:8000/admin/reload
```

The promotion gate requires an external evaluation (out-of-training-distribution
images), produced with:

```bash
python -m ml.scripts.test_external --crop rice --path ml/field_test/rice --save-json
```

Never promote on in-dataset test accuracy alone — the rice and soybean models
both scored 100% in-dataset while failing badly on external images (shortcut
learning). The honest number is external accuracy.

## Monitoring & logs

- **Uptime**: point an external pinger (UptimeRobot / healthchecks.io free tier)
  at `https://yourdomain.example/api/health` every minute. An on-box monitor
  cannot alert you when the box itself dies.
- **Process restarts**: `restart: unless-stopped` + supervisord auto-restart
  handle crashes; the compose healthcheck flags a wedged container.
- **Process logs**: `docker compose -f docker-compose.prod.yml logs -f`
  (json-file driver rotates at 20 MB × 5 files).
- **Prediction audit log**: `data/predictions.jsonl` — one line per request
  (crop, model version, disease, confidence, entropy, verification status,
  image quality, latency, image sha256; no image bytes). Use it for drift
  analysis: a rising `not_in_catalog`/`unknown` rate for a crop means the field
  distribution is moving away from training.

  Rotate it with host logrotate — `/etc/logrotate.d/cropintel`:
  ```
  /opt/cropintel/data/predictions.jsonl {
      size 50M
      rotate 10
      copytruncate
      compress
      missingok
  }
  ```

## Backups

```bash
# nightly at 03:00 — models + pointers + audit log, keep 7
0 3 * * * /opt/cropintel/scripts/ops/backup.sh /opt/cropintel /var/backups/cropintel
```

Models are also re-fetchable from the release zip, so this is cheap insurance,
not a disaster-recovery plan. Add an `rclone copy` of `/var/backups/cropintel`
to object storage if you want offsite copies.

## Troubleshooting

| Symptom | Check |
|---|---|
| `/api/health` 503 | `curl localhost:8000/readyz` inside the container — shows per-crop load errors |
| "Model not ready" for one crop | that crop has no complete version dir; fetch models or train |
| Predictions slow / queueing | the service is single-worker by design (TFLite interpreters are not thread-safe); sustained load beyond ~10 req/s needs a second look |
| New models bundle ignored | delete `ml/models/.cropintel-fetch-ok` and restart |
| Rate limiting all users together | proxy not setting `X-Forwarded-For` |
