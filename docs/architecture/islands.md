# Heavy islands

**Kind:** explanation. For the contributor who adds or changes a heavy island, or the page that
renders one. The decision is [ADR 0006](../adr/0006-site-modes.md), section 6; the catalogue
of blocks that declares each island's weight is [ADR 0018](../adr/0018-blocks-as-a-contract.md).

## The registry

`HEAVY_ISLANDS` in `app/islands/lib/constants.ts` is the one list of the heavy islands. The build,
the loader and the Content Security Policy read it, and `validateHeavyIslands`
(`app/islands/heavy.ts`) checks it. A page that renders an island calls `useHeavyIsland(id)`
(`app/composables/useHeavyIsland.ts`), which declares the island in a JSON script. The loader
(`app/islands/loader.ts`) reads the declaration and imports the island's entry when its trigger
fires. The entry is never in the page's HTML.

| Island | Rendered by | Trigger | Static alternative |
| --- | --- | --- | --- |
| `scene` | `section.scene` | `visible` | The poster, with the scene's alt text |
| `playground` | `shared.playground` | `interaction` | The code and its expected output |
| `mermaid` | a diagram in a `prose` block | `visible` | The diagram's source in a code block |

## The triggers

- **`visible`**: the loader imports the entry when the element is near the viewport, after `load`
  and once the page has hydrated. The visitor does nothing.
- **`interaction`**: the server markup holds a control (the registry's `control`, hidden until the
  loader arms it). The first press imports the entry and presses the control again, now that the
  entry listens. The visitor asks, and nothing of the island's weight is downloaded before.

Under `prefers-reduced-motion: reduce` an island with `motion` stays on its alternative, and under
`Save-Data` a `visible` island does too unless it opts in with `saveData: 'load'`. Nothing
autoplays.

## The load rule

The catalogue declares, for each block that renders an island, its `kind` and `loadKb` (the weight
of what it loads once used) in `contract/blocks.ts` of `micelio-plugin-core`, and
`ON_CLICK_ABOVE_KB` (1024) in `contract/islands.ts`. The catalogue keeps `loadKb` as declared. The
rule that turns it into a trigger is decided here:

> An island whose catalogue block has `island.kind: 'runtime'`, or a `loadKb` above 1024, has
> `trigger: 'interaction'` and renders its alternative with a control that loads it. Any other has
> `trigger: 'visible'`.

A runtime runs only when the visitor asks, and the declared `loadKb` counts the default runtime
only: the playground declares 406.7 kB, but Python's runtime (Pyodide) is about 6 MB. So
`playground` stays `interaction` and `scene` (151.3 kB) stays `visible`.

`mermaid` is the one exception. It is not a catalogue block: a diagram lives inside the `prose`
block, so the catalogue has no `loadKb` for it, and it is `visible`.

`test/islandsHeavy.test.ts` keeps the registry and a copy of the catalogue's declaration in
agreement (the package is not published yet, so the test copies the two blocks and names the
commit of `micelio-plugin-core` it copied). Change a trigger in the registry, or the catalogue's
declaration, and the test fails until both say the same.

## The alternatives, in the admin's preview

The preview's island label switches one block between its dynamic render and its static
alternative with `micelio:renderMode` ([ADR 0019](../adr/0019-visual-editing-protocol.md),
amendment of 2026-11-04). The frame reads the message in `readBlockMessage`
(`app/helpers/previewBlocks.ts`) and asks the page to show the block at the address in the mode.
The page keeps the positions in a set that `SectionRenderer` reads (`staticBlocks`):

- A **scene** in `static` renders a plain element (`data-scene-static`) with the poster, where
  `dynamic` renders `<micelio-scene>`. The island's element leaves the page, and with it its
  canvas and its model, so nothing is left that the alternative would hide. Switching back mounts
  `<micelio-scene>` again and the loader scans the page.
- A block with no island looks the same in both modes.
- The playground and Mermaid sit in an article, and the preview marks the blocks of a page's
  sections only, so they receive no `micelio:renderMode`.

The mode is state of the frame, not of the draft: a reload shows every block as it loads, and the
admin sends the message again. The frame answers nothing.

## Running a Playground block for the admin

The admin's **Run here and fill expected output** asks the frame to run a Playground block with
`micelio:run` and fills the answer, `micelio:runResult`
([ADR 0019](../adr/0019-visual-editing-protocol.md), amendment of 2026-11-06). The frame does it with
the reader's Worker, and nothing else is added to the sandbox:

- The frame reads the message in `readBlockMessage` (`app/helpers/previewBlocks.ts`), by hand until
  the pin moves ([the preview contract](preview-contract.md)): `requestId` and an `address` (`zone`
  `sections` or `blocks`, `index`, `block`, `version`). A message that fails the checks of section 4
  of the ADR (origin, `source`, envelope, shape, a `version` that is not the draft's) is dropped with
  no answer. A `code`, `runtime` or `setup` in the payload is never read.
- `answerRun` (`app/helpers/previewRun.ts`) finds the block in the data of the draft the page
  loaded, by zone, position and catalogue id, never by the markers: the draft route of a page keeps
  its `shared.playground` sections (`parseDraftPage`; `SectionRenderer` does not render them and the
  public page route drops them) and the article draft has them in `blocks`. What runs is the saved
  `code`, with the hidden `setup`, for the saved `runtime`.
- The Worker is the reader's: `usePreviewFrame` imports `app/islands/playground.ts`, the file a
  reader's page imports when Run is pressed, with `import()` on the first run once the page is
  inside a frame, and `runForPreview` uses its pool (`workers()`). The draft route declares none of
  it, the preview adds no entry, chunk or byte to a public page or to the playground's budget, and
  the page's CSP does not change. Runs of one runtime queue behind each other, as for readers, and
  the limits are `RUN_TIMEOUT_MS`, `LOAD_TIMEOUT_MS` and `MAX_OUTPUT_BYTES`.
- The answer goes to `frame.adminOrigin` only: `ok: true` with `output` and `truncated`, or
  `ok: false` with `codeError` (the message of the code, as plain text), `timeout`,
  `runtimeUnavailable` (the runtime failed or did not load, or the Worker could not start) or
  `notRunnable` (no Playground block at the address, or a language with no runtime). Nothing is
  written into the page, saved or sent to the draft.
- A reload ends the Worker and sends no answer. After `runtimeUnavailable` the frame keeps no state:
  the next `micelio:run` imports and loads again.
- The position is the block's place in the draft's zone as the CMS sent it (the one the weight report
  uses, ADR 0019 section 4), not among the sections the page renders. The page draft route sets it
  on each Playground section (`position`) and the article draft route lists it in
  `playgroundPositions`, both before an invalid or unknown block is dropped, so a block dropped
  earlier in the zone does not shift it. No public type, route or schema carries it.
