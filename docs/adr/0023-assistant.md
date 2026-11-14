# ADR-0023: An assistant that writes contract content through an external model

**Status:** Proposed
**Date:** 2026-11-13
**Deciders:** Micelio maintainer

Approved in principle by the maintainer on 2026-11-13 (AI before 1.0, a third-party API, the gateway of OpenCode first, a free conversation bounded in its answers), with the designs 18 to 24 of the page "Site structure and AI (design only)" of the private artifact "Micelio plugin admin". The designs are context, not part of the decision: design 21 draws the settings inside the plugin core and shows names that this record supersedes (the sibling plugin and its permission). The record moves no code and creates no repository (bogd3v/micelio#919).

## Context

Tools that generate a site from a description set the expectation that a first draft takes minutes. Micelio asks an editor to compose by hand.

What those tools generate is code or free markup. The block contract refuses that ([ADR-0018](0018-blocks-as-a-contract.md)), because it cannot be checked for weight, accessibility or third parties before it ships. Micelio has the opposite shape: a closed catalogue of blocks, a closed vocabulary of options and a save path that validates both ([ADR-0018](0018-blocks-as-a-contract.md), [ADR-0021](0021-icons-in-the-block-contract.md), [ADR-0022](0022-page-composition.md)), over themes that cannot load a third party ([ADR-0005](0005-theme-contract.md)). A model that can only produce that content cannot break the guarantee of the theme contract: whatever it says, the result is a draft inside the contract.

The cost is new. Content leaves the node, a secret (the provider's key) lives on the server, and usage costs money. Until now what a Micelio node sends to other hosts is published content (the fediverse plugin federates an article once it is published), packages it fetches (themes from the registry) and the services the operator named (the CMS, Umami, the mail server). It has never sent unpublished drafts or what an editor is typing to a third party. The assistant does.

## Decision

### 1. Contract content only

The assistant produces:

- site settings within what the active theme allows;
- pages as sequences of catalogue blocks;
- text for the fields of a block.

It never produces themes, CSS, markup, scripts or images. Everything it produces is applied as a draft through the ordinary save routes, with the editor's permissions, and is published only by the editorial workflow ([ADR-0017](0017-distribution-plugins-multisite-editorial.md), section 5). The assistant has no way to publish, and no permission the editor lacks.

*Why:* this is what makes the contract's guarantees survive. Anything outside it could not be checked before it ships.

### 2. Three kinds of answer

Every answer of the model is one of three kinds, and the answer's JSON Schema (section 5) admits no other.

- **`change`.** A patch limited to the scope the request names (a site setting, a page, a block, a field). Anything outside that scope is discarded and reported.
- **`question`.** Up to three a proposal, rendered by the admin as form fields. A fact the model lacks (a price, an address, a name) is a question or a marked placeholder, never an invention. A page that still has a placeholder cannot be published.
- **`answer`.** Plain text, 600 characters at most, never rendered as HTML and never applied. A suggestion inside it is a button that sends a new request, and that request produces a `change`.

The text answer is part of the first release.

*Why:* a free conversation is what an editor expects, and what makes the assistant useful for questions the catalogue does not answer. Bounding it to 600 characters of inert text keeps it from becoming a second channel for content: the only way to change anything is a `change`, which is validated.

### 3. A sibling plugin, off by default

The assistant is `@micelio/strapi-plugin-assistant`, a sibling of the plugin core, built on the extension points the core offers a sibling plugin ([ADR-0017](0017-distribution-plugins-multisite-editorial.md), sections 1, 5 and 6). It is off until an operator turns it on, per installation and per site. It has a permission of its own, granted to publishers by default.

*Why:* a site that never asks for it must carry no code path, no secret and no outbound call for it. A separate plugin keeps the core free of a provider, and lets the assistant's version move on its own.

### 4. One adapter

There is one adapter: an OpenAI-compatible chat completion with streaming. The base URL, the key and the allowed models come from the server's configuration, never from the database or the admin. A key an editor can read or change in the admin is a key anyone with that role can lose.

- HTTPS only, except a host the private-network rule of [ADR-0011](0011-refuse-plain-http-upstreams.md) accepts (a loopback or private address, `localhost`, a dotless service name, `.internal`, `.local`, `.localhost`). That exception is how a self-hosted model enters.
- A model is used only if it is on the allow-list with the retention and training terms the operator recorded for it, and the date of that record.

*Why:* one wire format covers the first provider, its competitors and a self-hosted server, without a plugin per vendor. The allow-list is what turns a provider's changing terms into a decision a person made on a date.

### 5. What leaves the node

A request carries:

- the instructions (section 10);
- the answer's JSON Schema, generated from the catalogue and the options of the installed themes;
- what the editor typed;
- the conversation, trimmed to a budget;
- the part in scope: existing content only for the block or the page in scope.

It never carries keys, accounts, subscribers, comments, media or other sites.

The call is made by the CMS server. The published site makes no request to the provider, so the zero-third-party guarantee of the theme contract ([ADR-0005](0005-theme-contract.md)) is unchanged: a visitor's browser, a theme and a static export never reach the provider. The guarantee was about what the published site loads, and that does not change. What changes is that an operator who turns the assistant on has a node that sends unpublished content to a third party (see Trade-offs).

Before the first request, the admin states what is sent, to whom and under which recorded terms (section 4).

### 6. Nothing is trusted, either way

- What the editor types is data, never an instruction to the server.
- Each part of an answer is checked with the validators a save uses. A part that fails is asked for once more, then dropped and reported.
- The model has no tools, no key and no route to the CMS.
- A change shown in the builder is a suggestion drawn by the frontend ([ADR-0019](0019-visual-editing-protocol.md)): it is not saved, autosaved or sent to review until the editor accepts it, and accepting it is an ordinary edit.

*Why:* the model can be wrong, can be fed hostile text (a pasted page, a name) and can be replaced by the operator at any time. The guarantee must hold for all three, so it sits in the checks and not in the model.

### 7. Limits

These are configuration defaults, not constants:

| Limit | Default |
| --- | --- |
| A request | 60 seconds |
| Pages in a proposal | 5 |
| A description | 2,000 characters |
| A conversation | 20 turns |
| A failed part | one retry |
| Concurrency | one request at a time per site |

*Why:* each bounds a cost (time, tokens, money) or an abuse (a loop, a flood) the operator cannot otherwise see.

### 8. Spending

There is a cap per site and per month, and a cap for the installation. The default cap of a new site is zero, so turning the assistant on for a site spends nothing until someone sets a figure.

The estimate is checked before anything is sent. At the cap the request is refused with a problem detail ([ADR-0015](0015-problem-details.md)). Spend is counted from the usage the provider reports. Where it reports none while streaming, the server counts characters and says the figure is an estimate.

### 9. What is kept

- A proposal and its conversation are a temporary record of one editor, deleted when applied, discarded or after 24 hours.
- One log line per request, without the text.
- An entry (the editorial record of [ADR-0017](0017-distribution-plugins-multisite-editorial.md), section 5) records that a field's text came from an accepted suggestion.
- The conformance report of a site ([`docs/operate/accessibility-report.md`](../operate/accessibility-report.md) is its accessibility part) says whether the assistant is on.

*Why:* the text of a conversation is the most sensitive thing the feature holds; it lives as briefly as it is useful.

### 10. Versioning

The instructions are versioned with the plugin and are not editable per site. The answer's schema follows the block contract, so it moves with it ([ADR-0018](0018-blocks-as-a-contract.md)). Changing what leaves the node (section 5) is a major of the plugin and needs a new record.

*Why:* instructions editable per site would make the guarantee of sections 1 and 6 depend on an operator's prompt, and the instructions would no longer be reviewed with the code. What leaves the node is what the operator accepted terms for; widening it silently would void that acceptance, so it is a breaking change of the plugin and a decision of its own.

### 11. Left out

- Themes, CSS, markup and images.
- Publishing without review.
- Acting on its own.
- Tools.
- Answers grounded in documentation (a later record, with Engram).
- Translating a whole site in one request.
- Anything on the published site.

*Why:* themes, CSS, markup and images are what Option C rejects. Publishing without review and acting on its own would remove the person that sections 1 and 6 rely on. Tools are Option F. Answers grounded in documentation need a retrieval source (Engram) that this record does not decide, and send more content out. Translating a whole site in one request breaks the limits of section 7 (a page count, a description size, 60 seconds) and cannot be checked part by part. Anything on the published site would end the guarantee of section 5.

## To verify before the first implementation issue

The record leaves these open on purpose, for the first provider (the gateway of OpenCode). They are verified with a real key, and the result is written back to this record as an amendment.

1. Whether a JSON Schema is enforced, or only JSON is returned. If it is only JSON, the validation of section 6 carries the whole load and the retry budget of section 7 may need to grow.
2. How usage is reported while streaming (section 8).
3. Its rate limits, per key and per model.
4. Its base URL.
5. The retention and training terms of each model considered.

What the provider's documentation said on 2026-11-13, which is a claim to confirm and not a fact this record relies on:

- Zero retention and no training by default, with exceptions: requests through the OpenAI and Anthropic APIs are kept 30 days, and some free models keep data and may train.
- Hosting in the United States and the European Union.
- Free-tier chat models only from the provider's own client.
- A monthly budget per workspace.

## Options considered

### A. Bounded content through a server-side adapter (chosen)

Sections 1 to 11. The model fills a closed catalogue; the CMS server calls the provider; the save path validates. It keeps the contract's guarantees, keeps the key on the server and keeps the published site free of third parties.

### B. No AI

Nothing changes: no draft leaves the node and the editor composes by hand. It costs nothing and risks nothing. It was rejected because the expectation of a first draft in minutes is the main thing the contract's closed catalogue is bad at, and a catalogue the editor does not have to learn by hand is a cheaper way in. It stays the state of every site that does not turn the assistant on.

### C. The model writes a theme or free markup, and admission checks it

The expectation of other tools. Rejected: it reopens what [ADR-0018](0018-blocks-as-a-contract.md) closed. Admission checks a package once, with a test run; it cannot check, in an editor's session and in seconds, the weight, accessibility and third parties of whatever a model produced for one request.

### D. The browser calls the provider with the editor's key

The key never reaches Micelio's server. Rejected: the editor's browser would send the content, the content's limits and spend would not be enforced anywhere the operator controls, the key would sit in a browser, and the CSP of the admin would have to open to the provider. Section 8 could not hold.

### E. Self-hosted models only

No content leaves the operator's infrastructure. Rejected as the only path: a small site cannot run a model of the quality the feature needs. It is not lost: section 4 admits a private host, so a self-hosted model is one allow-list entry.

### F. A tool-using agent with access to the CMS

The model calls the save routes itself. Rejected: it gives a model that reads hostile text a route to the CMS, a key and the ability to act without a person looking, which sections 1 and 6 exist to prevent.

### G. Inside the plugin core

Simpler to ship: one package. Rejected: every installation would carry a provider's code path and configuration whether it uses them or not, and the assistant's pace (providers and models change monthly) would be tied to the core's contract versions ([ADR-0017](0017-distribution-plugins-multisite-editorial.md), section 6).

## Trade-offs

- **A node that turns this on sends unpublished content to a third party.** Federation sends only what is published; this sends drafts and what the editor typed. The operator accepts the provider's terms for the models on the allow-list, and the admin says so before the first request. A node that leaves it off is exactly as before.
- **The text answer cannot be checked by the catalogue and can be wrong.** It is inert (section 2), but an editor can read it and believe it. That is the price of a free conversation.
- **Cost is only partly predictable.** The cap and the estimate bound it; the provider's reported usage, or an estimate where it reports none, decides the figure.
- **Quality depends on a model Micelio does not control.** A provider can change a model, its terms or its price. The allow-list and the date of the recorded terms make the change visible; they do not prevent it.
- **One more package to keep compatible** with the core, with the block contract and with the visual editing protocol.
- **The zero-third-party guarantee stays,** because the call is server-side and the published site makes none (section 5).

## Consequences

- The record is `Proposed`. The maintainer sets it to `Accepted` after reading it, and opens the plugin's repository and its milestone then. Until then no implementation issue starts.
- The first follow-up issue verifies the five points of "To verify before the first implementation issue" with a real key, before any other, and amends this record with the result.
- The follow-up issues, by proposed title:
  - the plugin's repository (`@micelio/strapi-plugin-assistant`, from the plugin template, off by default);
  - the adapter (OpenAI-compatible chat completion with streaming, the allow-list and the HTTPS rule);
  - the validation pipeline (the answer's schema from the catalogue and the themes, the validators of a save, the retry and the report);
  - the temporary record and the log (a proposal and its conversation for 24 hours, one line per request, the entry of an accepted suggestion);
  - the caps (per site, per month, the installation, the estimate and the problem detail);
  - the suggestion state in the builder and the visual editing protocol (a change drawn and not saved until accepted, [ADR-0019](0019-visual-editing-protocol.md));
  - the admin screens (start, review, refine, request, settings; designs 19 to 24);
  - the operator documentation (the variables, the allow-list, the recorded terms, the caps, and what leaves the node).
- `docs/security.md` and `docs/operate/` gain the documentation of the key, the allow-list and what leaves the node with the first implementation, not with this record.
- The standard's section on security and privacy is not changed; the feature falls under it as any outbound call does.
