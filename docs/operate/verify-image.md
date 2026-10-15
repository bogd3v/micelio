# Verify the images

Every image that CI publishes from `main` (`ghcr.io/bogd3v/micelio` and `ghcr.io/bogd3v/micelio-builder`) carries two things you can check before you run it: a signed build provenance attestation and a software bill of materials (SBOM). Neither changes the image contents or its tags.

## What is attached

| Item | What it tells you | Made by |
| --- | --- | --- |
| Provenance attestation | This repository's workflow built this exact digest, from this commit | `actions/attest-build-provenance`, signed with Sigstore |
| SBOM (SPDX) | The packages inside the image | BuildKit (`sbom: true`), stored as an attestation of the same image |
| BuildKit provenance | The build inputs and steps (SLSA, `mode=max`) | BuildKit (`provenance: mode=max`) |

The builder image is built once per platform and merged into one manifest. The signed attestation is attached to the merged manifest, the digest you pull, and the SBOM of each platform is stored beside it.

## Verify the provenance

Needs the [GitHub CLI](https://cli.github.com/) and a login to GHCR if the package is private.

```bash
gh attestation verify oci://ghcr.io/bogd3v/micelio:<tag> \
  --repo bogd3v/micelio \
  --signer-workflow bogd3v/micelio/.github/workflows/deploy.yml \
  --source-ref refs/heads/main
```

For the builder image replace `micelio` with `micelio-builder` in the image name. `<tag>` is the short commit SHA tag (`abc1234`), `edge`, a release version (`X.Y.Z`) or `latest`. Images published before the attestation existed carry none, so the command fails on them. The command exits 0 and prints the workflow and commit that built the digest when the attestation is valid. Any other exit code means do not run the image.

## Print the bill of materials

```bash
docker buildx imagetools inspect ghcr.io/bogd3v/micelio:<tag> --format '{{ json .SBOM }}'
```

The output wraps an SPDX JSON document under an `SPDX` key (one per platform for the builder image). Pipe it to `jq '.SPDX.packages[].name'` for a list of package names.

## Notes

- Verify the tag you deploy. `latest` and `edge` move; the digest in the output is what was checked.
- A registry listing shows extra `unknown/unknown` entries next to the image. Those are the attestation manifests, not other platforms.
- Release tags (`X.Y.Z`, `X.Y`, `latest`) are copies of the commit image by manifest, so they share its digest and its attestations.
