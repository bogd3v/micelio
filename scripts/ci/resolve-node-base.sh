#!/usr/bin/env bash
# Resolves where CI pulls the Dockerfile's Node base image from: a copy in GHCR, so builds do not depend on Docker Hub's pull rate limit.
# Prints `build-context=<ref>=docker-image://<mirror>` (the form `build-contexts` takes) on stdout, or `build-context=` when the copy
# is unavailable, in which case the build falls back to Docker Hub. Copies the image once per tag, with the workflow's own token.
# Environment: MIRROR_REGISTRY (default ghcr.io), MIRROR_OWNER (lowercase owner), SOURCE_URL (repository URL for the package link).
set -uo pipefail

dockerfile="${1:-Dockerfile}"
registry="${MIRROR_REGISTRY:-ghcr.io}"
owner="${MIRROR_OWNER:?MIRROR_OWNER is required}"

# `FROM node:22.23-slim AS builder`: both stages use the same tag, and the first one decides
ref="$(sed -n 's/^FROM \(node:[^ ]*\).*/\1/p' "${dockerfile}" | head -n 1)"
if [ -z "${ref}" ]; then
  echo "::warning::resolve-node-base: no 'FROM node:' line in ${dockerfile}; building from Docker Hub" >&2
  echo "build-context="
  exit 0
fi
mirror="${registry}/${owner}/${ref}"

if ! docker buildx imagetools inspect "${mirror}" > /dev/null 2>&1; then
  echo "resolve-node-base: copying docker.io/library/${ref} to ${mirror}" >&2
  annotation=()
  if [ -n "${SOURCE_URL:-}" ]; then
    annotation=(--annotation "index:org.opencontainers.image.source=${SOURCE_URL}")
  fi
  if ! docker buildx imagetools create --tag "${mirror}" "${annotation[@]}" "docker.io/library/${ref}" >&2; then
    echo "::warning::resolve-node-base: could not copy ${ref} to ${mirror}; building from Docker Hub" >&2
  fi
fi

if docker buildx imagetools inspect "${mirror}" > /dev/null 2>&1; then
  echo "build-context=${ref}=docker-image://${mirror}"
else
  echo "build-context="
fi
