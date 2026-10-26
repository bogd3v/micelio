FROM node:22.23-slim@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d AS builder

ARG GIT_COMMIT_SHA=unknown
ARG GIT_COMMIT_DATE=unknown

WORKDIR /build

COPY package*.json ./
# The root postinstall (nuxt prepare) needs nuxt.config.ts: without it Nuxt
# loads its defaults, devtools included. Dependency scripts run in npm rebuild.
RUN npm ci --ignore-scripts

COPY . .
# The themes the site pins (themes.lock.json) are installed before the build; Nuxt compiles their slots. docs/operate/themes.md
RUN npm rebuild && npm run theme:pull -- --frozen && npm run build

# Builder image (ghcr.io/bogd3v/micelio-builder): generates a static site at run time and serves it.
# Declared before the production stage, which must stay last (the default target). docs/operate/static-site.md
FROM node:22.23-slim@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d AS static

ARG GIT_COMMIT_SHA=unknown
ARG GIT_COMMIT_DATE=unknown

LABEL org.opencontainers.image.title="Micelio builder"
LABEL org.opencontainers.image.description="Generates and serves a Micelio static site (nuxt generate plus Pagefind)"
LABEL org.opencontainers.image.source="https://github.com/bogd3v/micelio"
LABEL org.opencontainers.image.revision="${GIT_COMMIT_SHA}"
LABEL org.opencontainers.image.created="${GIT_COMMIT_DATE}"

# Non-root: the node user (uid 1000) owns the source tree, where Nuxt writes .nuxt, .output and node_modules/.cache
RUN mkdir /app /out && chown node:node /app /out
WORKDIR /app
USER node

COPY --chown=node:node package*.json ./
RUN npm ci --ignore-scripts

COPY --chown=node:node . .
RUN npm rebuild && npm run theme:pull -- --frozen

COPY --chown=node:node --chmod=755 scripts/docker/builder-entrypoint.sh /usr/local/bin/micelio-builder
ENV NUXT_TELEMETRY_DISABLED=1 \
    OUT_DIR=/out \
    PORT=8080

VOLUME /out
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/micelio-builder"]
CMD ["generate"]

FROM gcr.io/distroless/nodejs22-debian12:latest@sha256:8a3e96fe3345b5d83ecec2066e7c498139a02a6d1214e4f6c39f9ce359f3f5bc

LABEL org.opencontainers.image.title="Micelio"
LABEL org.opencontainers.image.description="Micelio site engine: Nuxt frontend"
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
