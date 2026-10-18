#!/usr/bin/env bash
# Mirrors a Docker Hub official image (`node:22.23-slim@sha256:…`, `postgres:18-alpine`) to GHCR, so CI does not depend on Docker Hub's pull rate limit.
# Prints the reference to pull on stdout: `<registry>/<owner>/<name>:<tag>` when the copy exists or could be made, the original `<ref>` when it
# could not (the caller then pulls from Docker Hub, with a warning on stderr). Copies the multi-architecture image once per reference,
# with the workflow's own token. The copy carries a source annotation, so its index digest differs from Docker Hub's: a `@sha256:` in the
# reference is therefore checked against the platform manifests of the copy, and a copy that does not match is replaced.
# Usage: mirror-image.sh <ref>. Environment: MIRROR_REGISTRY (default ghcr.io), MIRROR_OWNER (lowercase owner), SOURCE_URL (package link).
set -uo pipefail

ref="${1:?usage: mirror-image.sh <ref>}"
registry="${MIRROR_REGISTRY:-ghcr.io}"
owner="${MIRROR_OWNER:?MIRROR_OWNER is required}"
mirror="${registry}/${owner}/${ref%@*}"
source="docker.io/library/${ref}"
platforms='{{range .Manifest.Manifests}}{{.Digest}} {{end}}'

# True when the copy exists and, for a digest-pinned reference, holds the same platform images as the source
mirror_matches() {
  docker buildx imagetools inspect "${mirror}" > /dev/null 2>&1 || return 1
  [ "${ref}" = "${ref%@*}" ] && return 0
  [ "$(docker buildx imagetools inspect "${mirror}" --format "${platforms}" 2>/dev/null)" = "$(docker buildx imagetools inspect "${source}" --format "${platforms}" 2>/dev/null)" ]
}

if ! mirror_matches; then
  echo "mirror-image: copying ${source} to ${mirror}" >&2
  annotation=()
  if [ -n "${SOURCE_URL:-}" ]; then
    annotation=(--annotation "index:org.opencontainers.image.source=${SOURCE_URL}")
  fi
  if ! docker buildx imagetools create --tag "${mirror}" "${annotation[@]}" "${source}" >&2; then
    echo "::warning::mirror-image: could not copy ${ref} to ${mirror}; pulling from Docker Hub" >&2
  fi
fi

if mirror_matches; then
  echo "${mirror}"
else
  echo "${ref}"
fi
