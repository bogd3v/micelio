#!/usr/bin/env bash
# Mirrors a Docker Hub official image (`node:22.23-slim@sha256:…`, `postgres:18-alpine`) to GHCR, so CI does not depend on Docker Hub's pull rate limit.
# Prints the reference to pull on stdout: `<registry>/<owner>/<name>:<tag>` when the copy exists or could be made, the original `<ref>` when it
# could not (the caller then pulls from Docker Hub, with a warning on stderr). Copies the multi-architecture image once per reference,
# with the workflow's own token. A reference with a digest is copied from that digest to `<tag>-<digest hex>`, a tag that is never moved, so
# checking the copy needs GHCR only and Docker Hub is contacted just when the copy is made.
# Usage: mirror-image.sh <ref>. Environment: MIRROR_REGISTRY (default ghcr.io), MIRROR_OWNER (lowercase owner), SOURCE_URL (package link).
set -uo pipefail

ref="${1:?usage: mirror-image.sh <ref>}"
registry="${MIRROR_REGISTRY:-ghcr.io}"
owner="${MIRROR_OWNER:?MIRROR_OWNER is required}"
name="${ref%@*}"
if [ "${name}" != "${ref}" ]; then
  name="${name}-${ref#*@sha256:}"
fi
mirror="${registry}/${owner}/${name}"
source="docker.io/library/${ref}"

if ! docker buildx imagetools inspect "${mirror}" > /dev/null 2>&1; then
  echo "mirror-image: copying ${source} to ${mirror}" >&2
  annotation=()
  if [ -n "${SOURCE_URL:-}" ]; then
    annotation=(--annotation "index:org.opencontainers.image.source=${SOURCE_URL}")
  fi
  if ! docker buildx imagetools create --tag "${mirror}" "${annotation[@]}" "${source}" >&2; then
    echo "::warning::mirror-image: could not copy ${ref} to ${mirror}; pulling from Docker Hub" >&2
  fi
fi

if docker buildx imagetools inspect "${mirror}" > /dev/null 2>&1; then
  echo "${mirror}"
else
  echo "${ref}"
fi
