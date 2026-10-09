import type { HeavyIsland } from '../types'

// Constants of the loader and of the pages that declare an island for it, and the registry they read. They live apart from `../constants.ts` on purpose:
// the loader runs at start, and a module it shares with an island entry becomes a chunk the loader loads (`sharedWithLoader`, modules/lib/islands-graph.ts).
// No island entry imports this file. The registry stays out of `../constants.ts` too: in that file it pushed the home JS to 146.7 KB against a budget of 146.6 (docs/performance.md).

/** A page that renders a heavy island declares it in a JSON script with this id prefix; `app/islands/loader.ts` reads them. */
export const HEAVY_SCRIPT_PREFIX = 'micelio-island-'
/** Dispatched on `document` when a client-side navigation renders a heavy island. */
export const HEAVY_SCAN_EVENT = 'micelio:heavy-scan'

/** The heavy islands of the site: the single registry that the build, the loader and the Content Security Policy read. */
export const HEAVY_ISLANDS: readonly HeavyIsland[] = [
  {
    id: 'mermaid',
    entry: 'mermaid',
    trigger: 'visible',
    fallback: 'The diagram\'s source in the code block that RichTextBlock renders',
    features: [],
    // A diagram is the article's content, not decoration (ADR 0006, amendment of #247 PR 3)
    saveData: 'load',
    budget: 'mermaid',
  },
  {
    id: 'playground',
    entry: 'playground',
    trigger: 'interaction',
    fallback: 'the highlighted code and its expected output',
    features: ['wasm', 'worker'],
    control: '[data-playground-run]',
    // The page may start a Worker of its own origin. Only the Worker compiles WebAssembly, under its own policy, workerPolicy() (ADR 0004)
    csp: { workerSrc: ['\'self\''] },
    budget: 'playground',
  },
  {
    id: 'scene',
    entry: 'scene',
    trigger: 'visible',
    fallback: 'the poster, with the scene\'s alt text',
    features: ['webgl2'],
    // Decoration: Save-Data keeps the poster
    saveData: 'skip',
    motion: true,
    budget: 'scene',
  },
]
