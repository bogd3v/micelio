# ADR-0025: Credit the translators of an article by their fediverse actors

**Status:** Proposed
**Date:** 2026-11-18
**Deciders:** Micelio maintainer

Approved by the maintainer on 2026-11-18, who took the recommendations of the plan of bogd3v/micelio-plugin-fediverse#32. The record moves no code.

## Context

Since bogd3v/micelio-plugin-fediverse#27 an article federates as one object whose `contentMap` and `nameMap` hold each published locale that has a title and a slug (`toLocale` in `server/src/services/articles.ts` of the plugin drops one that lacks either). Nothing says who translated each locale. bogd3v/micelio-plugin-fediverse#32 proposes [FEP-22cd](https://w3id.org/fep/22cd), which adds a `translations` property to such an object, with one `Translation` per translated language.

What constrains the decision:

- FEP-22cd is a `DRAFT`, received on 2026-09-16. Its text has not changed since revision [`6d0d6559`](https://codeberg.org/fediverse/fep/src/commit/6d0d6559054baeb7b71a5f2bdc14fc4c09b66f39/fep/22cd/fep-22cd.md), the one `@fedify/vocab` 2.4.4 targets. `@micelio/strapi-plugin-fediverse` pins Fedify 2.4.4.
- A `Translation` requires `inLanguage`, `translator` and `translationOfWork`. `translator` is one or more **actors**. Whether it may be a plain name is one of the FEP's open questions.
- A language with no `Translation` "is directly authored, not translated".
- A publisher "MUST NOT list a human translator alone for unreviewed machine output".
- Micelio has one actor per site and none per author ([`docs/api.md`](../api.md), "Fediverse creator"). `api::article.article` has one `author` relation for the whole document, and `api::author.author` has no fediverse identity.
- The `updated` of the federated object is the latest change of **any** locale (`withLocales` in `server/src/services/articles.ts` of the plugin), because a translation's change is a change of the object.

The credits are stored data and a field of the content API, so they are a contract of section 6 of the [engineering standard](../engineering-standard.md). They also publish the identity of people to other servers, which cannot be taken back once delivered. The decision spans `micelio-cms` and `@micelio/strapi-plugin-fediverse`, so it is recorded here (section 12).

## Decision

### 1. Where the credits live

`api::article.article` in `micelio-cms` gains `translationCredits`: a repeatable, localised and optional component `shared.translation-credit`, at most 10 per locale. Each locale of an article has its own credits, and they are saved and published with that locale.

### 2. Who can be credited

The component has one attribute, `actorUrl`: a required string of at most 255 characters that matches `^https://\S+$`. A credit is always an actor. A translator with no fediverse account cannot be credited, and no plain name is stored.

The type of the actor says what kind of translator it is, so the component has no "kind" field. Unreviewed machine output credits the actor of the software and not a person alone; the description of the field in the admin says so, and following it is the editor's responsibility.

### 3. How an actor URL is checked

By its syntax only: an absolute `https:` URL, and the plugin also leaves out one that carries credentials. Neither the CMS nor the plugin requests a credited URL, whether at save, at publish or at federation. The value is published as the editor wrote it, so the editor gives the actor id and not the profile page. The plugin's documentation says how to find the id (`npx @fedify/cli lookup`).

### 4. What is federated

`@micelio/strapi-plugin-fediverse` adds `translations` to the `Article` and `Note` shapes when `contentMap` has two or more locales. A locale of `contentMap` with at least one usable credit gets one `Translation` with:

- `inLanguage`: the locale, the same value as its key in `contentMap`.
- `translator`: the credited actor URLs.
- `translationOfWork`: the `id` of the object.
- `url`: the frontend address of that locale.

A locale with no usable credit gets no entry, and neither does a published locale that is not in `contentMap`, because FEP-22cd requires `inLanguage` to match a key of the language maps. Any locale can carry a credit, the default locale included, because the default locale of a site is not always the language an article was written in. The `id`, `url`, `attributedTo`, `published`, `updated`, `contentMap` and `nameMap` of the object do not change, and a translator is never added to `attributedTo`. An object with no usable credit is the object of today. Withdrawing a locale removes its `contentMap` entry and its `Translation` in the same `Update`.

The attribute is optional for a host: the plugin reads it only when `api::article.article` has it.

### 5. `sourceUpdated` is not published

No `Translation` carries `sourceUpdated` or `isBasedOn`. The field states that a human reviewed the translation against the source, and Micelio records no such review. FEP-22cd also compares it with the object's `updated`, which moves whenever any locale changes, so a value stamped once would make the other translations look stale as soon as one of them is published. Its absence is valid: consumers "MUST NOT infer freshness or staleness". Publishing it takes a record of its own.

### 6. Classification of a credited actor URL

A credited actor URL is **Public** in the levels of `docs/security/data.md` of `micelio-cms`: it is published content, sent to other servers with the article. It names a person, so an editor adds it only with that person's agreement.

This differs from the rows of that document that classify as Personal the `actorId` of followers and of likes and boosts, and the name of a comment author. Those values are collected from the activity of people, who did not choose to publish them. An editor publishes this one on purpose, with the person's agreement, as part of the article. `data.md` gains a row that states this and the reason. The plugin stores no copy of the value.

### 7. The revision of the FEP, and what happens if it changes

The implementation follows revision `6d0d6559`. FEP-22cd is a draft, so the wire format can change. The stored data does not depend on it: `translationCredits` holds actor URLs, whatever the FEP calls them.

- A change to the wire format changes the plugin's serialiser and the Fedify version it pins. It needs no migration of stored data and no change to the content API.
- If the FEP comes to accept plain names, section 2 is revisited in a new record.
- If the FEP is withdrawn, the plugin stops sending `translations`. An `Update` without the property removes it from the servers that kept it, and the credits stay stored.

## Options considered

### A. A localised, repeatable component on the article (chosen)

Credits are per locale by construction and follow the precedent of `coverCredit`. They publish with the article, so they reach the fediverse in the `Update` the plugin already sends. The site archive of the core carries components with the article.

### B. A plain field on the article

The smallest change. One string cannot hold several translators without inventing a format, and the admin could not validate each one.

### C. The author of the locale

Reuses an existing type, but `author` is one relation for all locales and has no actor URL. It would also merge what FEP-22cd keeps apart: who wrote the original and who translated one language.

### D. A content type of the plugin, edited in the article's panel

Leaves the contract of `micelio-cms` alone. It is not tied to draft and publish, so it needs its own path to send a change, and it adds a route, a permission and an export section. The frontend could not read it.

### E. A name with an optional actor URL

Credits translators who have no fediverse account. It would store a credit that can never be federated, since FEP-22cd takes actors only, and the editor would see a credit the fediverse never receives. Starting strict also keeps the way open: relaxing a required attribute later is easier than tightening an optional one over stored data.

### F. Resolve a handle or a profile URL when saving

Easier for the editor, and it stores the canonical id. It makes the CMS request addresses an editor typed, which is a new outbound surface, and it makes a save depend on another server.

## Trade-offs

- A translator with no fediverse account gets no credit. A language translated by such a person, left uncredited by the editor, or whose only URL is refused gets no `Translation`, and FEP-22cd reads it as "directly authored, not translated": the wire states it was written by `attributedTo`. Chosen option A has this effect as much as E would have had.
- An editor can paste a profile page instead of an actor id. It passes the check and is published as written, and a consumer may then fail to resolve the actor. This is worth revisiting if editors get it wrong in practice.
- A credit is the claim of the publishing site. FEP-22cd neither provides nor requires verification of it.
- Servers that ignore FEP-22cd show no credit, and the site does not show it either until the frontend reads the field. Showing it needs a display name, which section 2 does not store.
- Translations carry no statement of freshness until `sourceUpdated` has its own record.
- The wire format follows a draft, with one known implementation besides Fedify's own vocabulary.

## Consequences

- `micelio-cms`: the component, the attribute, the generated types, `docs/FEDIVERSE.md` and `docs/security/data.md`. It is not breaking, so it raises `z` (standard, section 7, "Before 1.0.0").
- `@micelio/strapi-plugin-fediverse`: `translations` on both shapes, its suites and its documents. It is not breaking, so it raises `z`. The two changes do not depend on each other.
- The credits reach a site when `micelio-cms` raises the plugin it installs, after the plugin's release.
- The frontend's queries do not populate `translationCredits`, so no response it reads changes.
- The epic and the issues of this work are planned from bogd3v/micelio-plugin-fediverse#32 once this record exists.
