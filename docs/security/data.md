# Data classification and protection

**Kind:** reference. The data the frontend handles, the three protection levels it sorts them into, and what each level requires. Answers ASVS 5.0.0 V14.1.1 and V14.1.2 ([mapping](asvs.md)); the controls are described in [security.md](../security.md), the secrets themselves in [keys.md](keys.md), and what the visitor is told is the privacy page (`app/pages/privacy.vue`).

The frontend stores nothing of its own. Accounts, comments and subscribers live in the CMS; the frontend passes them through, keeps a few counters in memory and writes logs.

## Levels

| Level | What it is | Requirements |
| --- | --- | --- |
| **Restricted** | A credential or a one-use secret: whoever holds it can act as someone | Never in a log, an error message or a URL the visitor shares; in a cookie only as `httpOnly`, `secure`, `__Host-`; responses with `private, no-store`; sent only over TLS or a private network (ADR 0011); pages that read it send `Referrer-Policy: no-referrer` and take it out of the address bar; the endpoints that accept it are rate limited |
| **Personal** | Data about an identifiable person | Collected at the minimum; held by the CMS, not by the frontend; in a log only as the per-process visitor hash, never raw; leaves the server only to the CMS, the mail provider of the newsletter and Umami (the visitor's address, through the first-party proxy, never the query string, `Referer` or cookies); never in a response to another visitor (comment authors' emails are not returned) |
| **Public** | Published content, and preferences that stay in the browser | Served as is, after sanitising what comes from content; browser preferences never sent to the server |

## What is handled

| Data | Level | Enters through | Held by | Notes |
| --- | --- | --- | --- | --- |
| Passwords | Restricted | Sign-in, sign-up, reset and change forms | The CMS (hashed there) | Bounded, validated and forwarded; never stored or logged by the frontend |
| Session JWT | Restricted | The CMS, at sign-in | The visitor's cookie `__Host-micelio_session` | `httpOnly`, never readable by page JavaScript (ADR 0003) |
| Password-reset code, confirmation and unsubscribe tokens | Restricted | An emailed link | The CMS keeps the SHA-256 of the newsletter tokens; the visitor's email holds the tokens | The page takes them out of the address bar; the server looks a subscriber up by the hash, so the token is not in the CMS request. Rows stored before hashing keep the token in the clear until they are used |
| API token, build token, forwarder secret, SMTP password | Restricted | The operator's environment | The process | [keys.md](keys.md) |
| Email addresses (accounts, subscribers, guest comments) | Personal | Forms | The CMS | Lowercased and validated; the rate limiter holds an address in memory for the length of a window, with up to 10,000 keys, lost on restart |
| Names and profile fields, comment text | Personal | Account and comment forms | The CMS | Comment responses hide the email and the author id is set by the server |
| Visitor IP address | Personal | The connection or `NUXT_TRUST_PROXY` headers | Memory (rate limit keys), Umami (through the proxy), the CMS rate limits (through the forwarder secret) | Logs hold a 12-character HMAC-SHA-256 under a key that changes at every start, not the address |
| Newsletter language | Personal | The subscribe form | The CMS | |
| Published articles, pages, categories, site settings | Public | The CMS | The CMS | Rich text is sanitised on the server |
| Theme mode, privacy notice dismissed, articles read | Public | The browser | `localStorage` of the visitor | Never sent to the server |

## Where a level's requirement is enforced

| Requirement | Control | Where |
| --- | --- | --- |
| Not in logs | Fixed `cause` words, `upstreamLogMessage`, hashed visitor | [security.md, Logs](../security.md#logs) |
| Not cached | `private, no-store` on account, drafts, newsletter and their APIs | [security.md](../security.md) and `nuxt.config.ts` route rules |
| Cookie flags | `httpOnly`, `secure`, `sameSite=lax`, `__Host-` | `server/utils/auth.ts` |
| Encrypted in transit | Boot refuses `http://` to a non-private CMS or Umami | ADR 0011 |
| Not sent to third parties | Pages make no third-party request; the analytics proxy drops `Referer` and cookies | ADR 0002 |
| Rate limited | Auth, comments, newsletter, search | [security.md, Client IP and rate limits](../security.md#client-ip-and-rate-limits) |
| Retention | None in the frontend. Logs are kept as long as the operator's platform keeps them | [operate/logging.md](../operate/logging.md#retention) |

## Known exceptions

- **Email in a CMS query.** The server looks a subscriber up by email in the query string of its request to the CMS (`findSubscriber`, `server/utils/subscribers.ts`), because Strapi's REST API filters only through the URL. The email is Personal, not Restricted, and it goes only to the CMS, so the level allows it; it can appear in the CMS's and its proxy's access logs, which is why those logs fall under the retention the operator chooses. It is why V14.2.1 stays open.
- **Subscribers stored before tokens were hashed.** Until their link is used, their token is in the clear in the CMS, and a lookup that finds no hash sends the token as it is. A confirmation re-stores the unsubscribe token as a hash; an unsubscribe deletes the row.
