# Read the logs of a site

**Kind:** reference. Goal: know what the frontend logs, in which format, where the lines go and who keeps them. The rules for what a line may hold are in [security.md](../security.md#logs); the tests that enforce them are named there.

## Format

The frontend writes one JSON object per line to the standard error (`server/utils/log.ts`). It keeps no log file and has no other destination.

| Field | Holds |
| --- | --- |
| `time` | UTC, ISO 8601, from the process clock |
| `level` | `info`, `warn` or `error` |
| `event` | A stable dotted name (`auth.failure`, `cms.search`). Alert on this field, never on `message` |
| `message` | Fixed text |
| `route` | The path of the request, without its query. Absent outside a request |
| `requestId` | A random id drawn per request, never read from a header. Absent outside a request |
| `visitor` | The first 12 hex characters of an HMAC-SHA256 of the visitor's address, with a key drawn at random when the process starts. It groups the lines of one visitor, it changes on a restart and it is not shared between instances. Absent outside a request |
| `cause` | What went wrong, as a fixed word or an error name and code. Never a password, email address, token, address or query |

Nitro and Nuxt still print their own free-text `[request error]` report, over several lines and with the URL and its query, when an error nobody handled reaches them. The `server.unhandled` line is the structured record of the same error; a collector should expect both.

## What is logged

| Group | Events | Level |
| --- | --- | --- |
| Sign-ins | `auth.login.success`, `auth.register.success`, `auth.password-reset.success`, `auth.confirm-email.success`, `auth.password-change.success`, `auth.account-delete.success`, `auth.logout`, `auth.forgot-password.requested`, `auth.resend-confirmation.requested` | `info` |
| Refusals | `auth.failure`, `authz.origin-refused`, `authz.draft-refused`, `limit.rate`, `input.refused` | `warn` |
| Failures of what the site calls | `cms.*` (the CMS), `analytics.proxy` (Umami), `newsletter.welcome-email` (mail), `theme.*` | `error` or `warn` |
| Boot checks | `config.*`: a missing or unusable setting (see [configure.md](configure.md)) | `error` or `warn` |
| Unexpected errors | `server.unhandled` | `error` |

[security.md](../security.md#security-events) lists each security event with the moment it is written and the values `cause` takes. A malformed path parameter, a malformed `relation` or `documentIds` value, a draft the CMS answers 404 and an expired session on `GET /api/auth/me` are not logged on purpose.

## Where the lines go

The container's standard error. What happens next is your platform's: collecting, sampling, access control, shipping and retention are not done by Micelio. A flood of refused requests writes a line per request, so sample at the collector if that matters.

## Retention

Micelio sets none. Choose it in your platform and write it down, bearing in mind that a `visitor` hash is personal data for as long as the line exists. A short period (days to a few weeks) is enough to investigate a sign-in or abuse report.

## Who may read them

Whoever can read your platform's logs. Lines hold no secret, but they show which routes were refused and how often, so give access to the people who run the site.
