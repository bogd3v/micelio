# ADR-0011: Refuse plain http towards the CMS and Umami outside a private network

**Status:** Proposed
**Date:** 2026-10-14
**Deciders:** BogDev maintainer

## Context

The server calls the CMS (`NUXT_PUBLIC_STRAPI_URL`) with a static API token, forwards the visitors' JWTs and passwords, and calls Umami (`NUXT_UMAMI_URL`) with the analytics payload. Nothing checked the scheme of these URLs, except that the forwarder secret already refuses a CMS that is neither `https` nor on a private network (`isSafeForwardTarget`). A mistyped `http://cms.example.org` therefore sent every secret in the clear. ASVS 5.0.0 V12.3.1 and V12.3.3 ask for an encrypted protocol on every connection, with no fallback ([ASVS mapping](../security/asvs.md)).

Plain `http` between containers of one host or one private network (`http://strapi:1337`, `http://umami:3000`) is how the documented examples and the demo Compose files are set up, and TLS there is the operator's call.

## Decision

In production the server stops the boot, naming the variable, when `NUXT_PUBLIC_STRAPI_URL` or `NUXT_UMAMI_URL` is `http://` and its host is not private. "Private" is the rule the forwarder secret already uses: a loopback or private address, `localhost`, a dotless service name, `.internal`, `.local` or `.localhost`. `https` is always accepted. Development is not checked.

There is no variable to switch the check off: a public host that must be reached over `http` is the case the check exists to stop, and a private one is already accepted.

## Options considered

- **Accepted risk only.** No code, a documented risk for private networks. Leaves the mistyped public `http://` that sends the token across the internet.
- **Refuse every `http://`.** Breaks the documented container setup and the demo Compose files for no gain on a private network.
- **A warning instead of a refusal.** Operators do not read boot logs until something breaks; the standard asks a missing required value to stop the boot (section 5).
- **An escape variable.** One more name in the operator interface that defeats the control.

## Trade-offs

A site that today reaches its CMS or Umami over `http` through a public name stops booting after the upgrade. The fix is an `https` URL, or the private address or service name the container can reach.

## Consequences

- Changes the operator interface (standard section 6): the title carries `!` and the release notes' **Upgrade notes** say who is affected and what to do. Before 1.0.0 it raises MINOR `y` (section 7).
- The static build (`generate`) runs the same plugin and applies the same rule.
- `docs/operate/configure.md`, `docs/security.md` and `docs/security/asvs.md` describe it.
