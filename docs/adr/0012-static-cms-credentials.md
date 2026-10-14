# ADR-0012: Accept static credentials towards the CMS, with a rotation policy

**Status:** Accepted
**Date:** 2026-10-14
**Deciders:** BogDev maintainer

## Context

The frontend authenticates to the CMS with two static secrets: an API token (`NUXT_STRAPI_API_TOKEN`), created in `micelio-cms` with `lifespan: null`, and a forwarder secret (`NUXT_STRAPI_FORWARDER_SECRET`) that lets the CMS rate limit by the visitor's address. ASVS 5.0.0 V13.2.1 asks for backend calls without long-lived static credentials ([mapping](../security/asvs.md)); it is a level 2 requirement in a chapter whose target is level 1.

What the CMS and the platform offer:

- Strapi API tokens are either unlimited or expire after 7, 30 or 90 days. Nothing renews them: an expired token answers 401 and the site stops showing content.
- Strapi has no short-lived service credentials, mutual TLS or OAuth client credentials for API tokens.
- The CMS can create a token from an environment variable and replace its key at boot (`ensureEnvToken`, `micelio-cms` `src/migrations/api-tokens.ts`), so a rotation does not need the admin panel.

## Decision

The frontend keeps both secrets static. The risk is accepted under these controls, which are the conditions of this record:

1. **Least privilege.** The API token is Custom with the permissions listed in [security.md](../security.md#permissions-of-the-api-token) and nothing else; a static build uses a separate find-only token.
2. **Never exposed.** The secrets live in the environment of the server process, never reach the browser, a log, an image layer or the repository ([keys.md](../security/keys.md)).
3. **Encrypted in transit.** In production the boot refuses plain `http://` towards a non-private host ([ADR 0011](0011-refuse-plain-http-upstreams.md)).
4. **Rotation.** At least every 90 days, at once after exposure and when someone who held a secret leaves, by the procedure in [Lifetime and rotation of the CMS credentials](../security.md#lifetime-and-rotation-of-the-cms-credentials).
5. **No expiry on the token.** A token with a `lifespan` is not used, because a lapse is an outage and rotation is owned by the operator.

The record is reviewed when the CMS can issue a credential that renews itself or has a short life. Then the token's `lifespan` is set and this record is superseded.

## Options considered

- **A `lifespan` on the token (7, 30 or 90 days).** Bounds the exposure, but the site goes down when the date passes unless someone rotates in time, and the operator already has a schedule with the same cost and no cliff. Revisit if rotation is automated.
- **Automatic rotation by a job.** Needs a credential able to create tokens in the CMS, which is more powerful than the one being protected, and a new moving part for every site.
- **mTLS or OAuth client credentials.** Not offered by Strapi's API tokens; building it means a proxy or a plugin to maintain in each site.
- **Leave it open without a decision.** The requirement stays a gap with no reasoning for the next reviewer.

## Trade-offs

A leaked token works until someone rotates it: the exposure window is as long as it takes to notice, not 90 days. The detection is the log lines of `auth.failure` and `cms.*` and the CMS's own audit, not the credential. Rotation is a manual task of the operator.

## Consequences

- V13.2.1 in `docs/security/asvs.md` is Met as an accepted risk and names this record.
- `docs/security.md` and `docs/security/keys.md` keep the policy and the procedure; this record holds only the decision.
- Nothing changes in code, in the operator interface or in `micelio-cms`.
