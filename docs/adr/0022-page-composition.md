# ADR-0022: Page composition: reusable blocks and groups

**Status:** Accepted
**Date:** 2026-11-11
**Deciders:** Micelio maintainer

## Context

A page is one ordered sequence of blocks ([ADR-0018](0018-blocks-as-a-contract.md)):
the `sections` dynamic zone of the `page` collection, rendered by `SectionRenderer`,
composed by the builder of [ADR-0017](0017-distribution-plugins-multisite-editorial.md)
and addressed by the visual editing protocol through the catalogue `id` and the position
([ADR-0019](0019-visual-editing-protocol.md)).
Two needs cannot be expressed by that sequence alone.
They were decided with the maintainer on 2026-11-09 (epic bogd3v/micelio#872):

- **A block written once and shown on many pages:**
  a call to action, a newsletter form, an announcement.
  Today an editor copies it, and the copies drift.
- **A band of consecutive blocks that share a surface,**
  so a landing has rhythm (a stats row and a call to action on the same accent surface)
  without the free positioning that ADR-0018 section 5 forbids.

Both change what a page stores.
That is expensive to undo once third-party themes
([ADR-0008](0008-theme-registry.md)) and the content-types cut-over
(milestone "Tipos de contenido al core", [ADR-0017](0017-distribution-plugins-multisite-editorial.md) section 2)
freeze the model, and the builder's third phase builds on it.
So the record comes first and moves no code.

The constraint that shapes the storage is Strapi's:
Strapi does not nest dynamic zones.
A `group` that "contains" blocks therefore cannot be stored as a container.

## Decision

### 1. Reusable blocks: a site-scoped type, referenced from a page

`micelio-plugin-core` owns a content type `reusable-block`
([ADR-0017](0017-distribution-plugins-multisite-editorial.md) section 1):

| Attribute | Meaning |
| --- | --- |
| `site` | Required relation to `site`, as every type of a Micelio plugin ([ADR-0017](0017-distribution-plugins-multisite-editorial.md) section 4) |
| `name` | An internal name, shown only to editors; it is never rendered |
| `blocks` | A dynamic zone holding exactly one block (minimum and maximum of 1) of the catalogue |
| editorial component | The one of [ADR-0017](0017-distribution-plugins-multisite-editorial.md) section 5, so a reusable block has a state, a review and a publication like a page |

A page uses it through a block of the catalogue, `reusable`,
whose `schema` holds one relation to a `reusable-block`.
The `reusable` block has no presentation options of its own;
the block it points to keeps its own.
It is a block like the others: it sits at a position of the sequence,
has an `id` for the protocol, and may carry a `group` key (section 2).

Rules:

- **Per site.** A reusable block belongs to one site and a page references only its own site's.
  The plugin refuses a save of a `reusable` whose target belongs to another site,
  and the content API resolves a reference only inside the site that answers the request.
- **One block, one level.** The block inside a reusable block is never a `reusable`:
  a reference to a reference has no meaning and would need a loop check.
  It carries no `group` key; the reference does.
- **What renders.** The page renders the published version of the target.
  A target that is not published, or has no entry in the page's locale, renders nothing,
  and the builder shows the gap.
- **Republish.** Publishing, republishing or unpublishing a reusable block
  republishes every page that references it. "Republish" here refreshes what the page shows;
  it does not edit the page entries, change their editorial state or fire their hooks,
  which would run the handlers of the fediverse plugin for pages that did not change.
  The plugin handles `afterPublish` (publish and republish) and `afterUnpublish` (unpublish)
  of the reusable block, and both list the referencing pages the same way.
  - *Dynamic mode:* the page route resolves the reference when it renders,
    so no page is edited and the next render of a page shows the change.
    A cached page shows it when its cache revalidates, as for any publish.
    A page route has no ISR rule: `loadPage` (`server/utils/pageSections.ts`) caches
    what `/api/pages/:slug` returns in Nitro's storage for 300 s with stale-while-revalidate,
    so the first request after that may still get the old version and refresh it.
    The home page (`/` and `/es`, which show the `homePage`) also has an ISR rule of 300 s in `nuxt.config.ts`,
    so a reference there can take longer, as the two caches stack.
    ADR-0001 has no purge by the CMS, and this record adds none:
    "immediately" means that no edit of the page is needed, not that the cache is bypassed.
    A purge on publish would be a decision for a later record, with the question of how the CMS reaches the cache of each frontend.
  - *Static mode:* the handlers list the referencing pages
    and the `afterPublish` hook of the build rebuilds those pages, not the site.
    The handlers are idempotent per `documentId` and locale, as the amendment of 2026-10-25 of
    [ADR-0017](0017-distribution-plugins-multisite-editorial.md) requires.
- **Delete.** A reusable block that a page references cannot be deleted;
  the refusal lists the pages, and the editor detaches or replaces them first.
- **A template copies, a reusable references.**
  A template inserts a copy of its blocks, which stays independent of it.
  A reusable block is edited in one place and every page shows the edit.
- **Used on N pages.** Before a save the builder shows how many pages
  (documents of the site, in any locale, draft or published) reference the reusable block.
  An edit that reaches many pages is then a choice, not a surprise.
- **Detach.** The builder offers "detach": the reference becomes a copy.
  The `reusable` block at that position is replaced by a deep copy of the target's block
  (its nested components and media references), keeping the position and the `group` key.
  The copy is a new block with no link to the target, and the target is not touched.
  The reverse (a block becomes a reusable block) is a new reusable block made from a copy,
  not a conversion, and belongs to the builder's issue.
- **Export.** The site export format carries the site's `reusable-block` entries
  before its pages and the references between them,
  by the same key the format uses for other relations,
  resolved to the new ids on import.
  A reference to another site is rejected on import as on save.

### 2. Groups: a key on each block, the sequence stays flat

There is no nesting in storage.
Every block of the catalogue may carry an optional `group` key,
a small component with two attributes:

| Attribute | Meaning |
| --- | --- |
| `groupId` | An opaque string, unique in the page. Blocks that share it form one group (`id` is reserved by Strapi) |
| `tone` | The group's surface, a value of the `tone` option of [ADR-0018](0018-blocks-as-a-contract.md) section 1 (`default`, `raised`, `accent`) |

The sequence stays one flat list in one dynamic zone,
so [ADR-0019](0019-visual-editing-protocol.md) keeps addressing a block by its `id` and position.

Rules:

- **Contiguous.** The members of a group are consecutive in the sequence.
  The save is validated: a `groupId` that appears in two separate runs,
  or two members of one `groupId` with different `tone` values, is refused with the position it names.
  The `tone` is repeated on every member so that moving or deleting a block
  never leaves the group without it; the builder writes them together.
- **One level.** A block has one `group` key, so a group inside a group has no storage.
  A group of one member is valid, so removing a block never makes a save fail.
- **Rendering.** The renderer wraps consecutive blocks that share the key
  in an element with the hook `myc-group` and `data-tone="<tone>"`.
  The wrapper also exists in static and landing builds ([ADR-0006](0006-site-modes.md)):
  it is markup, not JavaScript.
  It takes the surface of the group's `tone` role (`surface`, `surface-raised` or `accent-soft`)
  and the vertical spacing around the band.
- **Members.** A member yields its vertical margin to the group
  and takes the group's `tone`.
  The `tone` the member has of its own is **ignored, not refused**:
  the block keeps the value it stored, with no effect while it is in the group;
  the builder shows it disabled, as set by the group;
  ungrouping or detaching the block restores it as it was;
  and a save never fails because of it.
- **A reference is a member.** A `reusable` block may be a member of a group,
  and the block it points to is the member's content: the group's `tone` wins over the target's.
- **Markers are rejected.** Blocks `group-start` and `group-end` are not part of the catalogue:
  see "Options considered".

### 3. Versioning

Both decisions are MINOR additions, under [ADR-0018](0018-blocks-as-a-contract.md) section 2:

| Change | Version |
| --- | --- |
| The `reusable` block and the optional `group` key of every block | MINOR of the block contract (a new block; a new optional field) |
| The `reusable-block` type, its hooks and its export | MINOR of the plugin core |
| The `myc-group` hook and its `data-tone` values | MINOR of the theme contract: an optional hook with a core default, so installed themes keep validating (`CONTRACT_ADDITIONS` and `docs/themes/contract-changelog.md`) |

[ADR-0019](0019-visual-editing-protocol.md) is unaffected:
blocks are addressed by `id` and position, and the group is not an address.
A `reusable` block is addressed at its own position; opening its target is the builder's interaction.

### 4. What stays out

- **Free positioning:** unchanged from [ADR-0018](0018-blocks-as-a-contract.md) section 5.
  A group shares a surface; it places nothing.
- **Nested groups.** One level only; see section 2.
- **A group that is itself a reusable block.** A reusable block holds exactly one block,
  so a reusable group would need a group inside the reusable block
  (whose `groupId` could collide with the page's, and which breaks "one level" once the page groups the reference)
  or a reusable block that holds several blocks (which turns the type into a second page).
  Deferred, with this question: what is a group's identity when it is reused?
- **`ornament` as an option.** Decided against for now: themes decorate through `tone`.
- **Per-site sharing.** A reusable block shared across sites is not decided here.
  It would break the site key of [ADR-0017](0017-distribution-plugins-multisite-editorial.md) section 4.

## Options considered

### Groups

- **A `group` key on each block (chosen).**
  Flat in storage, valid with Strapi's single dynamic zone, no new address for the protocol,
  and the renderer derives the wrapper.
- **Markers (`group-start` and `group-end`).** Rejected.
  A marker is a block with no content, so it takes a position that the protocol
  of [ADR-0019](0019-visual-editing-protocol.md) must address and has no `static` alternative to declare.
  Markers can be unbalanced (a start without an end), and the save would have to repair or refuse that.
  Moving a block between two markers joins the group silently, and moving a marker detaches its members.
  `start start end end` makes nesting available for free, which contradicts one level.
- **Nested dynamic zones.** Rejected: Strapi does not nest them.
  A component or relation that holds the members instead moves them out of the sequence,
  so every operation (position, move, preview address, export) needs a path, not a position.
- **A second page type** (a "band" or "section group" collection that pages reference). Rejected.
  It splits a page across two owners with two editorial states and two publications,
  duplicates localisation and the export,
  and puts the members of a group outside the sequence that the builder orders.

### Reusable blocks

- **A site-scoped type referenced by a `reusable` block (chosen).**
  Fits the editorial workflow, the site key and the export of ADR-0017 without a new mechanism.
- **A page flagged as "shared"** whose blocks others embed. Rejected:
  a page already means a route, a publication and SEO, none of which a shared band needs,
  and it is the second page type again.
- **Reusing by copying only (templates).** Rejected as the only mechanism:
  the copies drift, which is the need that started this record.
  Templates remain, and copy.
- **A reusable block that holds several blocks.** Rejected for now:
  see "A group that is itself a reusable block" (section 4).
- **The target of a reference stored by position in another page.** Rejected:
  it makes a page's edit change another page, and the reference breaks when the block moves.

### The `tone` of a group member

- **Ignored (chosen, the maintainer's decision of 2026-11-11).**
  The member keeps its stored `tone`, which has no effect while it is in the group.
  Nothing is lost: ungrouping or detaching restores the block as it was, and a save never fails for it.
- **Refused:** a save error for a member that has a `tone` of its own.
  Rejected: to group a block the editor would have to erase its `tone`,
  so grouping destroys data and ungrouping cannot restore it.

## Trade-offs

- Every block gains a field that most blocks never use,
  and the renderer derives the wrapper from neighbours instead of reading a container.
  The cost is a save-time validation (contiguity and equal `tone`) in the plugin
  and a pass over the sequence in `SectionRenderer`.
- Repeating the group's `tone` on each member lets the data disagree with itself;
  the save refuses that and the builder writes the members together.
  The alternative, storing `tone` on the first member only, breaks on a reorder.
- A reusable block makes one edit reach many pages,
  and an unpublish removes the block from all of them.
  The "used on N pages" count and the delete refusal limit the surprise; they do not remove it.
- Republishing referencing pages costs a lookup on each publish of a reusable block,
  and a static rebuild of those pages, in proportion to how many reference it.
- Detach is one-way. The copy no longer follows the reusable block.
- A reference renders nothing while its target is unpublished or missing in the page's locale,
  where a copy would have stayed on the page. Reuse trades that resilience for a single source.
- Group markup is a contract with themes: `myc-group` and `data-tone` become public hooks,
  and a theme may restyle but not remove them.

## Consequences

The follow-up issues are opened under the milestone "Micelio · Catálogo de bloques"
from the plan of bogd3v/micelio#871, after this record is `Accepted`. By title and repository:

- `feat(content): the reusable-block type, its republish hooks and its export` in `micelio-plugin-core`:
  the type of section 1, the same-site and delete rules, `afterPublish` for referencing pages in both site modes,
  and the export.
- `feat(blocks): the reusable block and the group key in the catalogue` in `micelio-plugin-core`:
  both in `contract/blocks.ts`, the generated schema and reference, and the save validation of section 2.
  The frontend's interfaces and response schemas follow the generated schema ([ADR-0018](0018-blocks-as-a-contract.md) "Consequences").
- `feat(renderer): render reusable blocks and groups, with the myc-group hook` in `micelio`:
  `SectionRenderer` resolves the reference and wraps the members;
  the theme contract minor (`CONTRACT_VERSION.minor`, `CONTRACT_ADDITIONS`,
  `docs/themes/contract-changelog.md`), core CSS for the three `data-tone` values, the specimen and `theme:check`.
- `feat(builder): group and reuse interactions` in `micelio-plugin-core`
  (Builder phase 3, epic bogd3v/micelio-plugin-core#62): group and ungroup, "used on N pages", detach,
  the disabled `tone` of a member, and the gap shown for an unpublished target.

The amendments of [ADR-0017](0017-distribution-plugins-multisite-editorial.md) (the new site-scoped type and its hook)
and [ADR-0005](0005-theme-contract.md) section 11 (the `myc-group` hook) are noted in those records.
[ADR-0018](0018-blocks-as-a-contract.md) and [ADR-0019](0019-visual-editing-protocol.md) do not change.
The maintainer sets this record to `Accepted`.

## Amendments

**Amendment (2026-11-23, [bogd3v/micelio#976](https://github.com/bogd3v/micelio/issues/976)):
publishing a reusable block measures the pages that show it, and is refused if one would go over its budget.**
Section 1 ("Republish") has a publish of a reusable block list the pages that show it and nothing more.
The maintainer approved on 2026-11-12 artboard 14 (`Reusable`), state 3, of the canvas "Micelio plugin admin":
publishing a reusable block measures each page that shows it again, and the publish is refused,
naming the page, if one of them would go over its budget.
On 2026-11-23, at gate 3 of bogd3v/micelio-plugin-core#200, that was moved out of #200,
which adds `usedOn`, the list of referencing pages this amendment builds on.
A refusal at publish is a new rule of the editorial workflow (a contract, standard section 6)
and costs one render per page, so the maintainer decided it on 2026-11-23 before any code.
The credential it needs is the amendment of the same date of [ADR-0019](0019-visual-editing-protocol.md),
which also amends the sentences of section 3 and of Consequences above that ADR-0019 is unaffected.
Every other rule of section 1 holds: a reusable block is site-scoped, holds one block and one level,
a page renders its published version, and its republish edits no page entry,
changes no page's editorial state and fires no page hook. The measurement writes nothing to a page either.

- **When.** In the transition that publishes the reusable block (`in_review → published`, `scheduled → published`,
  `published → published`), before it publishes, as a page is measured today, so the admin route,
  the `transitions` service and the scheduler all hold it. Not in `afterPublish`, which runs once the publish is done.
  Unpublishing a reusable block measures nothing, because the pages only get lighter.
- **What is measured.** Each page's published version, in the locale published,
  with its reference resolved to the reusable block's draft, which is the version being published:
  the page as visitors will see it once the block is published.
  Options rejected by the maintainer:
  - *The page's draft.* It measures edits that are not published and refuses the block on them.
  - *Measure after the publish and only warn.* The page goes over its budget with nothing to stop it.
  - *No refusal, only the list.* State 3 of the artboard loses what it was approved for.
- **Which pages.** Those that `usedOn` lists for the block in the locale published
  whose published version, in that locale, references the block,
  and whose type the budget measures (`budgets.contentTypes`, site-scoped, editorial, with a dynamic zone).
  A page that has a draft only is measured at its own publish.
  The "Used on N pages" count of section 1 counts drafts and every locale, so it can be larger than the pages measured.
- **The grant.** One system grant per page measured, minted by the publish path of the reusable block,
  bound to the site, the page's type, `documentId` and locale, and the reusable block's `documentId` and version
  ([ADR-0019](0019-visual-editing-protocol.md), amendment of 2026-11-23).
  Lifetime, single use, header and route are today's. `GET /api/micelio/preview/draft` answers it
  with the page's published version and that reference resolved to the block's draft.
  The weight route accepts it, and every other route refuses it.
- **The refusal.** `pageOverBudget`, with its members of today for the page measured
  and one more, `page` (`uid`, `documentId`, `locale`, `title`), for the first page over its budget.
  A page that cannot be measured gives `previewUnavailable` with `page`.
  "First" is in the order of the list: the refusal names the earliest page of the list that refused,
  and once a page refuses no other is started.
  A scheduled reusable block that is refused stays `scheduled`, as a page does,
  and is tried again on every run of the scheduler (every minute by default).
  The block's draft version is checked again right before it is published,
  and a save since the measurement refuses the publish with `previewUnavailable`, as for a page.
  The block keeps its state on every refusal.
- **The cost and its bound.** Pages are measured two at a time, with no cap on their number:
  one grant, one request to the weight route and one render per page.
  The rate limits are today's: every request counts in the frontend's per-IP bucket of the system header,
  shared with every other publish of that CMS, and each page in its own per-document bucket;
  a `429` is retried as today, each page within its own bound.
  - *A page's bound* is today's: 4 requests of 30 seconds and 3 waits of 5 seconds,
    about two and a quarter minutes, when the frontend keeps failing (the operator guide on budgets of `micelio-plugin-core`).
  - *The worst-case wait* of a publish that reaches N pages is N / 2, rounded up, times that bound,
    reached only when every page is measured on its last attempt: about 22 and a half minutes for 20 pages.
    A frontend that keeps failing refuses within one bound, since the first page that fails ends the measurement.
    At the frontend's target of 3 seconds for a ten-block page, 20 pages wait about 30 seconds.
  - *A scheduled block* that keeps being refused measures its pages again on every run of the scheduler (every minute by default),
    until it is edited or moved to another state.
- **What an operator sees.** The publish request of the admin waits for the measurement;
  a proxy in front of the admin that cuts the request earlier shows the editor a failed request
  while the publish still ends as it ends, so the entry is looked at before trying again.
  The editor's notice names the page. The server's log names the page that could not be measured
  (its type, `documentId` and locale) and the cause, never a grant.
  A frontend without the weight route that accepts this grant refuses every publish of a reusable block that a measured page shows.
- **Trade-offs.** A reusable block shown on many pages publishes slowly, in proportion to them,
  where section 1 made it cheap. A page and a reusable block it shows that are published at the same moment
  are each measured against the other's published version, so their sum is not measured until the next publish of either,
  a window as wide as one measurement, like the one between the last check of a draft and its publish.
- **Not decided here.** How the refusal is released (its version and its upgrade notes),
  and the builder's publish dialog ("Publish on 7 pages", bogd3v/micelio-plugin-core#202).
  A purge of the cache on publish stays out, as section 1 says.
- **Follow-up tasks,** in this order (CMS first, standard section 6), each depending on bogd3v/micelio#976:
  1. `micelio-plugin-core`: the grant (mint, bind the block's version, claim) and the draft read that answers it.
  2. `micelio`: the weight route accepts the grant, renders the page from the answer
     and keys its report by the block's version.
     It also waits for the renderer of reusable blocks (bogd3v/micelio#896).
  3. `micelio-plugin-core`: the refusal at publish of the reusable block,
     and the admin route that lists its pages (`GET /micelio/reusable-blocks/:documentId/used-on`),
     which bogd3v/micelio-plugin-core#202 uses.
