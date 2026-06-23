# CropIntel: Next.js + Python inference (no Kaggle needed if CROPINTEL_MODELS_URL is set)
FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY ml/requirements-inference.txt ml/
RUN pip install --no-cache-dir -r ml/requirements-inference.txt supervisor

COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so the
# Maps key must be present during `npm run build` (not just at runtime). Passed
# as a build arg — empty by default, which simply disables the outbreak map.
# On Hugging Face Spaces, set it as a build-time Variable; with compose, see the
# build.args block in docker-compose.prod.yml.
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

RUN npm run build

RUN chmod +x docker/entrypoint.sh

# Some hosts (e.g. Hugging Face Spaces) run the container as a non-root UID 1000.
# The image is built as root, so make the dirs written at runtime — model fetch,
# prediction audit log, and the Next.js server cache — writable by any user.
RUN mkdir -p ml/models data \
    && chmod -R 777 ml/models data .next

ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

EXPOSE 3050

ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["supervisord", "-c", "/app/docker/supervisord.conf"]
