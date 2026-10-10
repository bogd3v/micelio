#!/usr/bin/env bash
# Mirrors a Docker Hub official image (`node:22.23-slim`, `postgres:18-alpine`) to GHCR, so CI does not depend on Docker Hub's pull rate limit.
# Prints the reference to pull on stdout: `<registry>/<owner>/<ref>` when the copy exists or could be made, the original `<ref>` when it
# could not (the caller then pulls from Docker Hub, with a warning on stderr). Copies the multi-architecture image once per reference,
# with the workflow's own token.
# Usage: mirror-image.sh <ref>. Environment: MIRROR_REGISTRY (default ghcr.io), MIRROR_OWNER (lowercase owner), SOURCE_URL (package link).
set -uo pipefail

ref="${1:?usage: mirror-image.sh <ref>}"
registry="${MIRROR_REGISTRY:-ghcr.io}"
owner="${MIRROR_OWNER:?MIRROR_OWNER is required}"
mirror="${registry}/${owner}/${ref}"

if ! docker buildx imagetools inspect "${mirror}" > /dev/null 2>&1; then
  echo "mirror-image: copying docker.io/library/${ref} to ${mirror}" >&2
  annotation=()
  if [ -n "${SOURCE_URL:-}" ]; then
    annotation=(--annotation "index:org.opencontainers.image.source=${SOURCE_URL}")
  fi
  if ! docker buildx imagetools create --tag "${mirror}" "${annotation[@]}" "docker.io/library/${ref}" >&2; then
    echo "::warning::mirror-image: could not copy ${ref} to ${mirror}; pulling from Docker Hub" >&2
  fi
fi

if docker buildx imagetools inspect "${mirror}" > /dev/null 2>&1; then
  echo "${mirror}"
else
  echo "${ref}"
fi
