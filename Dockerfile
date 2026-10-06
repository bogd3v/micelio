FROM node:22.23-slim AS builder

ARG GIT_COMMIT_SHA=unknown
ARG GIT_COMMIT_DATE=unknown

WORKDIR /build

COPY package*.json ./
# The root postinstall (nuxt prepare) needs nuxt.config.ts: without it Nuxt
# loads its defaults, devtools included. Dependency scripts run in npm rebuild.
RUN npm ci --ignore-scripts

COPY . .
RUN npm rebuild && npm run build

FROM gcr.io/distroless/nodejs22-debian12

LABEL org.opencontainers.image.title="Micelio"
LABEL org.opencontainers.image.description="Micelio blog engine: Nuxt frontend"
LABEL org.opencontainers.image.source="https://github.com/bogd3v/micelio"
LABEL org.opencontainers.image.revision="${GIT_COMMIT_SHA}"
LABEL org.opencontainers.image.created="${GIT_COMMIT_DATE}"

WORKDIR /app

COPY --from=builder --chown=65532:65532 /build/.output /app/.output

ENV NODE_ENV=production \
    PORT=8080 \
    NITRO_PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://localhost:8080').then(r => r.status < 500 ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"]

USER 65532

ENTRYPOINT ["/nodejs/bin/node", ".output/server/index.mjs"]
