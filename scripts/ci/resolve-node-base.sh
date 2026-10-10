#!/usr/bin/env bash
# Resolves where CI pulls the Dockerfile's Node base image from: a copy in GHCR (scripts/ci/mirror-image.sh), so builds do not depend on
# Docker Hub's pull rate limit. Prints `build-context=<ref>=docker-image://<mirror>` (the form `build-contexts` takes) on stdout, or
# `build-context=` when the copy is unavailable, in which case the build falls back to Docker Hub.
# Environment: MIRROR_REGISTRY (default ghcr.io), MIRROR_OWNER (lowercase owner), SOURCE_URL (repository URL for the package link).
set -uo pipefail

dockerfile="${1:-Dockerfile}"
here="$(dirname "${BASH_SOURCE[0]}")"

# `FROM node:22.23-slim AS builder`: both stages use the same tag, and the first one decides
ref="$(sed -n 's/^FROM \(node:[^ ]*\).*/\1/p' "${dockerfile}" | head -n 1)"
if [ -z "${ref}" ]; then
  echo "::warning::resolve-node-base: no 'FROM node:' line in ${dockerfile}; building from Docker Hub" >&2
  echo "build-context="
  exit 0
fi

pulled="$("${here}/mirror-image.sh" "${ref}")"
if [ "${pulled}" = "${ref}" ]; then
  echo "build-context="
else
  echo "build-context=${ref}=docker-image://${pulled}"
fi
