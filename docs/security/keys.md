# Keys, secrets and algorithms

**Kind:** reference. What the frontend holds as a secret, who may hold it, how long it lives and which algorithms it uses. Answers ASVS 5.0.0 V11.1.1 and V11.1.2 ([mapping](asvs.md)). Rotation steps for the CMS credentials are in [Lifetime and rotation of the CMS credentials](../security.md#lifetime-and-rotation-of-the-cms-credentials); the CMS holds its own keys (`JWT_SECRET`, `ADMIN_JWT_SECRET`, `APP_KEYS`, the token salt), which `micelio-cms` documents.

## Policy

- **Owner.** The site operator owns every secret below. The project owns none: the repository and the images carry no secret, and `.env.example` holds names only.
- **Where a secret lives.** In the environment of the process that uses it (a Compose file, the hosting platform's secret store, a GitHub secret). Never in the repository, a fixture, a log, an image layer, a build argument or an issue (standard, section 5). A secret is read as `NUXT_*`; the plain name is ignored.
- **Who may hold it.** The operator and the running service. A person holds a secret only while setting or rotating it, and the build token is the only one a CI job may hold ([Static site publishing tokens](../security.md#static-site-publishing-tokens)).
- **Strength.** Random values from a CSPRNG, at least 32 characters (the forwarder secret refuses to boot with less). Nothing is derived from a password.
- **Lifetime.** No expiry on operator-set secrets, because nothing renews them; rotation instead: at least every 90 days, at once after exposure, and when someone who held one leaves.
- **Lifecycle.** Generate, set on both sides, restart (CMS first), delete the old value where the CMS lets you; a secret nobody uses is deleted. A secret that was printed or committed is treated as exposed.
- **Review.** The inventory below is reviewed with every change that adds, removes or changes a secret or an algorithm, in the same pull request.

## Inventory of secrets

| Secret | Set in | Holds | Lifetime | Used by |
| --- | --- | --- | --- | --- |
| `NUXT_STRAPI_API_TOKEN` | Frontend environment | Custom CMS token, the permissions of `docs/security.md` | No expiry, rotated | Every server call to the CMS (`strapiFetch`) |
| Build token (`STRAPI_BUILD_TOKEN`, CMS `BUILD_API_TOKEN`) | GitHub secret, CMS environment | Find-only CMS token | No expiry, rotated | Static build, as `NUXT_STRAPI_API_TOKEN` in the generate step only |
| `NUXT_STRAPI_FORWARDER_SECRET` | Frontend environment and `RATE_LIMIT_FORWARDER_SECRET` in the CMS | Shared secret, at least 32 characters | No expiry, rotated on both sides | Tells the CMS the visitor's address (`X-Micelio-Forwarder-Secret`) |
| `NUXT_SMTP_USER`, `NUXT_SMTP_PASS` | Frontend environment | SMTP account | Per provider, rotated with it | Confirmation emails |
| Session cookie `__Host-micelio_session` | The visitor's browser | JWT issued and signed by the CMS | 7 days | `httpOnly`, `secure`, `sameSite=lax`; never readable by page JavaScript (ADR 0003) |
| `REBUILD_HOOK_TOKEN`, `CLOUDFLARE_API_TOKEN` | CMS environment, GitHub secret | Dispatch and deployment tokens | Per GitHub and Cloudflare; rotated before they expire | Static publishing only |
| Process nonce and log key | Generated at start, in memory | 256 random bits each (`INTERNAL_NONCE`, `VISITOR_KEY`) | One process | Marks SSR-internal calls; keys the visitor hash in logs |

Not secrets, and so not in this table: the CSP hashes, the unsubscribe and confirmation tokens (random per subscriber and stored in the CMS), and the theme and font integrity hashes.

## Inventory of algorithms

| Use | Algorithm | Where |
| --- | --- | --- |
| Content Security Policy hashes of inline scripts | SHA-256 (base64) | `server/plugins/contentSecurityPolicy.ts`, `modules/static-routes.ts` |
| File names and cache keys of build output (islands, display fonts, Pyodide assets, media) | SHA-256, truncated where it is only a name | `modules/islands.ts`, `modules/theme/display-fonts.ts`, `modules/lib/pyodide-assets.ts`, `modules/static-routes.ts` |
| Visitor hash in logs | HMAC-SHA-256 with a per-process random key, truncated to 12 hex characters | `server/lib/log.ts` |
| Newsletter confirmation and unsubscribe tokens, SSR nonce, log key | 32 bytes from `randomBytes` (CSPRNG) | `server/utils/subscribers.ts`, `server/utils/rateLimit.ts`, `server/utils/log.ts` |
| Request ids, guest comment ids | UUID v4 (`randomUUID`), identifiers only, never a credential | `server/utils/log.ts`, `server/api/comments/index.post.ts` |
| Forwarder and nonce comparison | `timingSafeEqual` | `server/lib/clientIp.ts` |
| Transport | TLS from Node or the operator's proxy; certificates are verified (no `rejectUnauthorized: false`) | ADR 0011, `app/helpers/email.ts` |
| Password hashing, JWT signing | None here: done by the CMS (users-permissions) | `micelio-cms` |

No MD5, SHA-1 or home-made cryptography is used. The frontend holds no certificate or private key: TLS terminates at the operator's proxy.
