# CropIntel Privacy, Security, and API Protection Review

Review date: 2026-06-26

This report covers the codebase as checked in. It does not claim legal compliance or production certification.

## Issues Found and Fixed

| Area | Severity | Issue | Fix |
| --- | --- | --- | --- |
| Privacy notice | High | The app collected account details, farm details, optional location, crop photos for prediction, diagnosis records, local browser history, Firebase data, Google Maps requests, and prediction audit metadata without a plain-language policy in the product flow. | Added `app/privacy/page.tsx`, linked it from `components/SiteFooter.tsx` and `components/auth/AuthShell.tsx`, and added an explicit signup acknowledgement in `app/signup/page.tsx`. |
| Firestore authorization | Critical | The app had client-side ownership assumptions but no deployable Firestore rules in the repo. | Added `firestore.rules` and root `firebase.json`. Rules restrict user profiles, farms, memberships, and diagnoses to authenticated owners/members. |
| Farm join-code exposure | High | Joining a farm queried `farms` by `joinCode`, which would require broad farm read access in Firestore rules. | Added `farmJoinCodes/{code}` lookup records and changed `src/lib/farms.ts` to read a single join-code document before creating membership. |
| Public expensive prediction API | High | `/api/predict` accepted unauthenticated requests, so anyone could consume inference resources. | Added Firebase ID token verification in `lib/security/firebaseAuth.ts`; `app/api/predict/route.ts` now requires `Authorization: Bearer <Firebase ID token>`, and `components/CropIntelApp.tsx` sends the current user's token. |
| Rate limiting | Medium | Rate limiting was IP-only and hard-coded. | Updated `lib/security/rateLimiter.ts` with environment-configurable IP and authenticated-user limits for prediction requests. |
| Upload validation | High | Server validation trusted MIME type and allowed broader image types than needed. | Restricted uploads to JPEG, PNG, and WebP; added magic-byte checks in `lib/security/validation.ts` and `app/api/predict/route.ts`; aligned client upload controls in `components/ImageUpload.tsx`. |
| Inference service hardening | High | The FastAPI service did not enforce upload size, content type, or image signature by itself. | Added upload size, MIME allowlist, and signature validation in `ml/serve/inference_app.py`. |
| Input validation | Medium | Farm creation accepted raw client values before writing to Firestore. | Added Zod schemas for farm details, state codes, crops, join codes, and display names in `lib/security/validation.ts`; used them in `src/lib/farms.ts` and `src/lib/auth.ts`. |
| XSS | Medium | The standalone ML comparison page used `innerHTML` with model-returned strings. | Escaped dynamic strings and changed preview rendering to DOM element creation in `ml/serve/compare_app.py`. The main Next app did not render user input through unsafe HTML. |
| Secrets in repo workspace | High | A `.env` file with runtime values was present in the workspace. | Removed `.env`; `.gitignore` already excludes `.env` and `.env*.local`. Updated `.env.local.example` with placeholders and rate-limit settings only. |
| Firebase Storage posture | Medium | No storage rules were present, even though Firebase storage config exists. | Added `storage.rules` that deny all paths except authenticated, user-owned image paths under strict size/type limits. The current app does not upload to Firebase Storage. |
| Dependency vulnerabilities | High | `npm audit` initially reported 11 moderate/high findings, including Next.js, glob, minimatch, picomatch, flatted, ajv, js-yaml, brace-expansion, and PostCSS advisories. | Ran `npm audit fix`, upgraded to Next `16.2.9`, ESLint `9.39.4`, and `eslint-config-next` `16.2.9`, migrated middleware to `proxy.ts`, and updated lint config for ESLint 9. Remaining npm audit output is a moderate PostCSS advisory nested inside Next's package. |

## Data Inventory

CropIntel collects or processes:

- Account data: name, email, Firebase Auth credentials, email verification status, creation time.
- Farm data: farm name, address, state, crops, acreage, optional latitude/longitude, owner ID, join code, membership role.
- Location data: optional browser geolocation when the user presses the location button; Google Maps can receive map-related requests when map features load.
- Uploaded crop photos: sent to `/api/predict` and forwarded to the inference service for prediction. The current server flow does not persist original uploaded photos.
- Diagnosis data: user ID, farm ID, crop, disease, confidence score, detection timestamp.
- Local browser history: resized photo data URL, diagnosis result, crop, farm label, timestamp, and model predictions in `localStorage`.
- Prediction audit metadata: timestamp, crop, model version, disease, confidence, quality metrics, latency, and SHA-256 image hash in the inference log.
- API usage metadata: request rate-limit counters in server memory and standard server logs.

## Environment Setup

Copy `.env.local.example` to `.env.local` and fill in values:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_value
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_value
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_value
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_value
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_value
NEXT_PUBLIC_FIREBASE_APP_ID=your_value
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_restricted_browser_key
INFERENCE_URL=http://127.0.0.1:8000
RATE_LIMIT_PREDICT_IP_MAX=20
RATE_LIMIT_PREDICT_IP_WINDOW_MS=60000
RATE_LIMIT_PREDICT_USER_MAX=30
RATE_LIMIT_PREDICT_USER_WINDOW_MS=60000
CROPINTEL_MAX_UPLOAD_BYTES=10485760
```

Deploy Firebase policy from the repo root:

```bash
firebase deploy --only firestore:rules,storage
```

For production, keep `INFERENCE_URL` on localhost, a private network, or another endpoint protected so users cannot bypass the authenticated Next.js route. Do not expose model/token-consuming inference endpoints directly to the public internet.

## Remaining Risks

- The rate limiter is in-memory. It is acceptable for single-process deployments, but multi-instance production needs Redis, Upstash, Memorystore, or another shared store.
- The prediction route validates Firebase ID tokens via Firebase's REST lookup endpoint. For higher assurance and less dependency on a network lookup per request, use Firebase Admin SDK server-side with credentials stored only in a secrets manager.
- Existing Firestore data created before `farmJoinCodes` was added may need migration documents for old join codes.
- Farm edit/delete and diagnosis delete are not implemented product features, so the new rules deny those direct writes. Add validated app flows and matching rule updates before exposing those operations.
- Google Maps browser keys are public by design. Restrict the key by HTTP referrer in Google Cloud Console.
- If the inference service is deployed as a public Hugging Face Space or public Cloud Run service, it must have its own authentication or network restriction. The repo cannot enforce that for an external host.
- Account deletion is documented as an email request. A self-service deletion flow is not implemented in this change.
- `npm audit --audit-level=moderate` still reports 2 moderate findings for `next/node_modules/postcss@8.4.31`. npm's suggested forced fix would install `next@9.3.3`, which is not a safe remediation. Track the next patched Next.js release or vendor guidance and re-run audit before deployment.
