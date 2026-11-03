#!/bin/sh
# Entrypoint of the builder image (Dockerfile, target `static`). Configuration comes from NUXT_* env vars only.
# docs/operate/static-site.md, "Builder image"
set -eu

OUT="${OUT_DIR:-/out}"

case "${1:-}" in
  generate)
    mode="${NUXT_PUBLIC_SITE_MODE:-static}"
    case "$mode" in
      static | landing) ;;
      *)
        echo "micelio-builder: NUXT_PUBLIC_SITE_MODE=\"$mode\" cannot be generated; use static or landing (dynamic sites run the micelio image)." >&2
        exit 2
        ;;
    esac
    if [ -z "${NUXT_PUBLIC_STRAPI_URL:-}" ] || [ -z "${NUXT_STRAPI_API_TOKEN:-}" ]; then
      echo "micelio-builder: NUXT_PUBLIC_STRAPI_URL and NUXT_STRAPI_API_TOKEN (the CMS build token) are required." >&2
      exit 2
    fi
    if [ ! -w "$OUT" ]; then
      echo "micelio-builder: $OUT is not writable by uid $(id -u); mount a volume that uid owns (docs/operate/static-site.md)." >&2
      exit 2
    fi
    # The theme the site settings name is resolved first (modules/theme/static-theme.ts); a theme that cannot be used fails the generation here,
    # and nothing below runs, so the volume keeps the site generated last time
    if ! NUXT_PUBLIC_SITE_MODE="$mode" npm run generate; then
      echo "micelio-builder: the generation failed; $OUT keeps the site it held before. The reason is the first error above (\"Static theme: ...\" when the theme the site settings name cannot be used)." >&2
      exit 1
    fi
    # Empty the volume first so pages removed in the CMS do not linger
    find "$OUT" -mindepth 1 -delete
    cp -a .output/public/. "$OUT"/
    echo "micelio-builder: site written to $OUT"
    ;;
  serve)
    PORT="${PORT:-8080}" HOST="${HOST:-0.0.0.0}" COMPRESS="${COMPRESS:-1}" exec node scripts/static-serve.mjs "$OUT"
    ;;
  *)
    echo "usage: generate | serve" >&2
    exit 64
    ;;
esac
