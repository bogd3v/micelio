# ADR-0015: Errors as RFC 9457 problem details

**Status:** Accepted
**Date:** 2026-10-15
**Deciders:** Micelio maintainer

## Context

The server routes answer errors as Nitro errors, `{ statusCode, statusMessage, message, data? }`. Auth routes put a machine-readable code in `statusMessage` and `data.code`; the other routes put free text in `statusMessage` or `message`, and clients read only the status. A client has to learn where each route keeps its code, and `server/` builds errors in 32 places with no common shape.

Section 4 of the [engineering standard](../engineering-standard.md) ("HTTP APIs") asks an API that Micelio designs to answer errors as problem details ([RFC 9457](https://www.rfc-editor.org/rfc/rfc9457), `application/problem+json`) with a stable, machine-readable `code`. #440 adopts it; #441 generates the OpenAPI document from the same catalog of codes.

Micelio is pre-1.0 and not stable: a `0.y` release may break contracts ([ADR-0010](0010-semantic-versioning.md), section 4). This record still keeps the change additive for one release line, because the rule costs little here.

## Decision

### 1. Format

Every error of `/api/*` is answered as `application/problem+json` with the members `type`, `title`, `status`, `detail` and `code`.

- `type` is always `about:blank` (RFC 9457, section 4.2.1). It never names a deployment's domain, because the core carries no site (principle 2 of the standard). The stable identifier is `code`, and a client branches on `code`, never on `title` or `detail`.
- `title` is the HTTP status phrase, `status` the status code.
- `detail` is for developers: a fixed English text chosen by Micelio. It never holds an upstream message, a URL, a stack or a value the visitor sent.
- `code` is camelCase, like the existing auth codes. The auth codes keep their names and statuses.

### 2. Additive for one release line

The members a client reads today (`statusCode`, `statusMessage`, `message` and `data`, with `data.code`) stay as extension members for at least one more MINOR and are then removed, as section 7 of the standard says. The change is not breaking: it adds members and changes the content type of an error from `application/json` to `application/problem+json`. It ships as a `feat`.

### 3. One helper and one renderer

- `problem(code, options?)` in `server/utils/problem.ts` builds the error from a code. A catalog maps each code to its status, title and detail, so a status and a code cannot disagree.
- One Nitro plugin renders every error of `/api/*` in the format above, including errors nobody handled (answered as 500, `internalError`, a neutral `detail`). HTML pages keep the Nuxt error page.
- What a visitor reads still comes from i18n, keyed by `code`, in both locales.

### 4. Scope

Routes served by the framework outside `/api/*` (feeds, sitemap) keep their text answers until they have a reason to change. Navigation errors thrown by pages and route middleware in `app/` are not HTTP answers and keep `createError` of Nuxt.

## Consequences

- A client learns one shape and one list of codes, which `docs/api.md` holds once.
- #441 can read the catalog instead of each route.
- A new route has to pick a code from the catalog; a new code is a new entry, and a code that is removed or renamed is a breaking change.
- For one release line errors carry both the old and the new members, so responses are slightly larger.

## Alternatives considered

- **`type` as a URN (`urn:micelio:problem:<code>`).** More precise, but a second identifier that must be kept in step with `code`.
- **`type` as a URL under the site's domain.** Rejected: it ties the core to one deployment.
- **Remove the Nitro members at once.** Rejected for now: the client in `app/` still reads them until PR 3 of #440.
