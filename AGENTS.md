# AGENTS.md

This file contains instructions and guidelines for agentic coding agents working in this repository.

## Engineering standard

The rules shared by every Micelio repository live in [`docs/engineering-standard.md`](docs/engineering-standard.md). This repository follows standard version 1.5 (`standard: 1.5`, the line `npm run lint:standard` checks; the Micelio bot opens the pull request that syncs a new version). This file adds what is specific to this repository (stack, commands, folders, naming) and may tighten the standard, never relax it. When the two disagree, the standard wins.

## The factory

Work reaches `main` through the gates of [`docs/factory.md`](https://github.com/bogd3v/micelio-engineering/blob/main/docs/factory.md) of `micelio-engineering`; the role prompts are in `.claude/agents/`.

**Docker of the worker and the verifier:** `node:22.23-slim` over a clean copy of the worktree, `$COPY`. The `Dockerfile` image cannot run `npm run check`: `.dockerignore` drops `AGENTS.md` and `docs/`. The maintainer tests the demo stack of `micelio-cms` (`compose.demo.yml`) with this branch's image.

```bash
docker run --rm -v "$COPY":/app -w /app node:22.23-slim sh -c 'npm ci && npm run check'
```

The suites that drive a browser (`test:e2e:*`, `test:theme`) need Playwright's browsers, which `node:22.23-slim` lacks. CI runs them in the image `scripts/ci/playwright-image.sh` resolves, which has Node 24 (the job installs Node 22 over it). For the same Node as `check`, build an image `FROM node:22.23-slim` that runs `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright npx -y playwright@<the version of @playwright/test> install --with-deps chromium firefox webkit`, and in it run `npm ci && npm run build && E2E_BUILD=1 npm run test:e2e:<group>` over the same bind mount (`:z`); say in the pull request which image ran. `npm run perf` runs in that same image after `npm run build` (`npm ci && npm run build && npm run perf -- --check`; `--mode static --theme <id>` for one static budget). Do not delete `.nuxt` after `npm ci`: `postinstall` runs `nuxt prepare` once, and without it the next build fails (rerun `npx nuxt prepare` if you did).

## Pre-1.0

While the version is `0.y.z` Micelio is alpha and not stable (section 7 of the standard, "Before 1.0.0"). A breaking change raises `y` and needs no deprecation period and no ADR: only the `!` in the PR title, a `BREAKING CHANGE:` paragraph and upgrade notes. Add no compatibility layers nobody asked for; never call a release stable.

## Project Overview

The frontend of Micelio, a site engine (a dynamic blog, a static site or a landing from the same content, ADR 0006) whose CMS is `micelio-cms`. BogDev (bogdev.com.co) is the reference site. Stack: Nuxt 4 + Vue 3 + TypeScript, Nitro API routes, Strapi for content, i18n (English, Spanish), plain CSS with custom properties for roles and theming.

## Build/Lint/Test Commands

```bash
# Install dependencies
npm install

# Development
npm run dev          # Start dev server on http://localhost:3000
npm run build        # Production build
npm run preview      # Preview production build locally

# Type checking and linting
npm run check        # The fast part of CI before a PR: typecheck, lint, test:coverage, lint:licenses and lint:standard (standard, section 15)
npm run typecheck    # Nuxt type checking, then `vue-tsc -p test` for test/ and e2e/ (test/tsconfig.json)
npm run lint         # ESLint (@micelio/eslint-config under @nuxt/eslint; its stylistic rules are the formatter), the primitives, class and placement checks, and the OpenAPI, theme schema, reference and theme:check drift checks
npm run openapi      # Regenerate docs/openapi.json from server/openapi/ and the zod schemas after adding or changing a route or a schema (`lint:openapi` fails on drift)
npm run theme:schema # Regenerate themes/theme.schema.json and themes/admission-report.schema.json after changing modules/theme/contract.ts or admission/report.ts
npm run theme:reference # Regenerate docs/themes/reference/ after changing roles, layout variants, hooks, slots or the TSDoc of a `@public` slot API
npm run theme:pack -- <id> # Pack a theme into .micelio/packages/ (needs `version` and `license`)
npm run theme:admit -- <step> # The theme admission steps that .github/workflows/theme-admission.yml runs (docs/themes/publishing-a-theme.md)
npm run theme:add -- <id>[@range]|./x.tgz # Pin a theme in themes.lock.json; `theme:pull [-- --frozen]` installs the locked ones, `theme:outdated` lists newer ones (docs/operate/themes.md)
npm run theme:new -- <id> # New theme: copies themes/starter/ to themes/<id>/ and renames it ([--name "Name"])
npm run theme:check  # Contract, hooks, contrast matrix and static budgets of the installed themes ([id] and --json)
npm run lint:fix     # Run ESLint with --fix
npm run tokens       # Print the role CSS the build generates from a theme.json (default themes/bogota/theme.json)
npm run test         # Run unit tests with Vitest (test/*.test.ts)
npm run test:coverage     # Same tests with coverage of app/ and themes/; fails under the thresholds in vitest.config.ts
npm run test:integration  # Run API-route integration tests (test/integration/, needs a Nuxt build)
npm run test:contract     # Run the server routes against the demo image of micelio-cms with Postgres, which the script starts and removes (needs Docker and a build; docs/architecture/contract-tests.md)
npm run test:static       # Generate a static site against the mock Strapi and run e2e/static/
npm run test:landing      # Generate a landing (home page, no articles) against the mock Strapi and run e2e/landing/ (the default theme, then starter)
npm run test:e2e          # Playwright e2e (e2e/; mock Strapi + dev server, or `.output` with `E2E_BUILD=1` after `npm run build`, as CI does, with `MICELIO_SPECIMEN=1 MICELIO_THEME_DIRS=test/fixtures/themes/alternates`). A spec that reads built CSS or the production CSP fails on the dev server. CI runs test:e2e:main, :site, :playground (per engine: `-- --project=chromium|firefox|webkit`), :scene-ui and :preview (the admin's iframe on a second origin, against the build) as parallel jobs
npm run test:theme        # Theme visual regression and axe (e2e/theme/, needs a build with MICELIO_SPECIMEN=1; docs/theme-testing.md)
npm run test:theme:update # Same with --update-snapshots=changed (baselines are committed from the CI artifact, not made locally)
npm run perf              # Performance budgets on a production build (run npm run build first; see docs/performance.md)

# Generate static site
npm run generate     # Generate static output
```

## Plan and Progress

The roadmap is tracked on GitHub, the source of truth for agents:

- The open epics (#316 and #408) list every phase and issue with a dependency graph (`gh issue list --label épica`).
- Each issue has a **Progress** section once work starts: PRs, numbers, findings that changed the plan, what remains. A PR that advances an issue updates it and ticks the epic's box in the same change; `Refs #N` while work remains, `Closes #N` in the last PR.
- `docs/performance.md` records budgets and their history; ADRs in `docs/adr/` record decisions.

## Agent Skills

Load the project skill in `.claude/skills/` that matches the task before starting:

| Skill | Use it to |
| --- | --- |
| `server-route` | Add or change a route in `server/api` or `server/routes`, or any call to Strapi |
| `strapi-block` | Render a new or changed Strapi dynamic-zone block |
| `ui-component` | Build or change a component, page or styles |
| `create-theme` | Create, adapt or restyle a theme in `themes/` (roles, modes, hooks, slots) and validate it with `theme:check` |
| `verify-change` | Run the checks and prove a change did not alter behaviour (scripts for computed styles, HTML and CSP) |
| `ship-pr` | Gate 5: sign-off commit, push, PR and CI (synced) |
| `blind-review`, `verify-pr` | The reviewer's and the verifier's procedures (synced) |
| `dependency-update` | Triage Dependabot, fix `npm audit` findings, upgrade a major |

## Commits and Pull Requests

Branches, commits, signed-off commits (`git commit -s`), PR titles and descriptions follow section 11 of the standard. Repository-specific: the PR title prefix sets its release-notes label.

## Code Style Guidelines

### General Conventions

- **Language**: section 3 of the standard. Design token names, Strapi slugs and `data-theme="noche" | "dia"` keep their external values (`'privacidad'`, `--mirla`, `--pinchaflor`)
- **Async code**: section 4 of the standard; ESLint enforces it (zod's `.catch()` in `server/schemas/` is exempt). A cached promise (`x ??= load()`) comes from an `async` function that clears the cache on failure and rethrows
- **TypeScript**: explicit types for props, parameters and return values
- **Vue 3**: `<script setup lang="ts">` in all components
- **Script setup order**: Imports → Props/Emits → Composables → State → Computed → Functions → Lifecycle hooks

### File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `PostCard.vue`, `CommentSection.vue` |
| Pages | kebab-case | `blog/index.vue`, `about.vue` |
| Composables | camelCase with `use` prefix | `useStrapi.ts`, `useComments.ts` |
| Interfaces | kebab-case | `post.ts`, `strapi-post.ts` |
| Server routes | kebab-case with HTTP method | `index.get.ts`, `[slug].get.ts` |
| API endpoints | kebab-case with method suffix | `posts/[slug].get.ts`, `comments/index.post.ts` |

### TypeScript Guidelines

- Explicit return types for composables
- Doc comments: every exported declaration of a `.ts` file has a TSDoc comment (standard, section 4). `npm run lint` checks the syntax (`tsdoc/syntax`) and that it exists (`jsdoc/require-jsdoc`, outside `test/`, `e2e/` and `.d.ts`); `.vue` files are not covered
- Use `defineProps<T>()` with generic syntax for component props
- Use `defineEmits<{ event: [paramType] }>()` for emits
- Prefer interfaces over types for object shapes
- Place a type or constant by its reach (standard, section 4): in the file that uses it; next to its function when only that function's callers import it; in the feature folder's `types.ts` or `constants.ts` (`roles.mjs` for plain node scripts) when several files of `modules/theme/`, `app/islands/` or `server/lib/` share it; in `app/interfaces/<domain>.ts` or `app/constants/<domain>.ts` when several features share it or it crosses a boundary. `server/lib/constants.ts` and `types.ts` are never auto-imported. Shared files hold declarations only; a domain file past ~200 lines becomes a folder with an `index.ts`. `npm run lint:placement` enforces this (`EXEMPT` in `scripts/check-placement.mjs`)

### Vue Component Guidelines

```vue
<script setup lang="ts">
// Imports
import type { Post } from '~/interfaces'

// Props
const props = defineProps<{
  post: Post
  index?: number
}>()

// Emits
const emit = defineEmits<{
  action: [value: string]
}>()

// Composables
const { t } = useI18n()
const config = useRuntimeConfig()

// State
const isOpen = ref(false)

// Computed
const formattedDate = computed(() => { ... })

// Functions (the function keyword, not arrows)
function handleClick() {
  emit('action', 'value')
}
</script>

<template>
  <!-- Template content -->
</template>

<style scoped>
/* Scoped styles only */
</style>
```

### CSS/Styling Conventions

- Colors, shadows and glows come from the semantic roles of ADR 0005 (`var(--ink)`, `var(--surface)`, `var(--link)`, `var(--accent)`, `var(--danger)`, `var(--category-3)`…), never from the theme's primitives (`--mirla`, `--chillon`…), which live only in `assets/css/settings/` (`scripts/check-primitives.mjs` fails the lint otherwise). A category's color is `useCategories().colorOf(slug)` (ADR 0016 section 3), backed by `categoryColor` in `app/helpers/categories.ts`, a slot API (contract 2). The core names no category: no `Category` enum and no constant of slugs
- No utility classes in templates: every class is a `myc-*` class in its layer, or one of the core helpers (`font-display`, `font-mono`, `not-prose`). `npm run lint` fails otherwise (`scripts/check-classes.mjs`; ADR 0005, section 3)
- Icons are inline SVG components in `app/components/icons/` (`<IconsHome />`), sized by the parent's CSS
- Cards take their corners from `border-radius: var(--radius-card)`; if they animate, use `var(--duration-*)` and `var(--ease-*)` and transition only the properties that change
- Use `<MycButton>` (`app/components/myc/`) for buttons and button-styled links; the `Myc*` components mirror the design system shown by the specimen page (`/_theme`) and `docs/themes/reference/`
- Use `.input-field` for form inputs
- Use `font-display` class for display fonts (Archivo)
- Use `font-mono` class for monospace fonts

### CSS Architecture

Global styles live in `app/assets/css/`, split by responsibility (ITCSS-style, plain CSS). `main.css` holds only `@layer` declarations and `@import`s: never add rules to it. Lightning CSS is the CSS transformer, with browser targets (chrome 111, edge 111, firefox 114, safari 16.4, ios 16.4).

| Folder | Layer | Contents |
|--------|-------|----------|
| `settings/` | `myc.settings` | `typography.css` (the `.myc-heading-1`… classes, which read the theme's roles). Role values and fonts come from the active theme's stylesheet in the theme store, linked from `render:html` as `/_t/<digest>/theme.css` (`docs/themes/theme-store.md`); the bundle only holds the layer order. `font-fallbacks.css` of `themes/bogota` and `themes/starter` is generated by `scripts/perf/font-fallbacks.py` |
| `base/` | `myc.reset` | `reset.css` (the minimal reset the site relies on), `base.css` (element defaults like `h1–h6`, `button`, `input`) |
| `base/` | `myc.base` | View transitions, shared focus ring |
| `components/` | `myc.components` | One file per reusable `.myc-*` block (`button.css` → `.myc-btn`, `chip.css` → `.myc-chip`…) |
| `layout/` | `myc.layout` | App shell: page gutters, header, mobile tab bar and sheet, footer |
| `pages/<page>/` | `myc.pages` | Blocks used by a single page (`home/`, `blog/`, `article/`, `about/`) |
| `animations/` | `myc.animations` | Every `@keyframes` |
| `utilities/` | `myc.utilities` | Single-purpose helpers (`.myc-sr`, `.myc-reveal`, `.myc-wide`…) |

- Layers decide precedence before specificity: `myc.reset` < `myc.settings` < `myc.base` < `myc.components` < `myc.layout` < `myc.pages` < `myc.utilities`, so a page or layout rule can restyle a component without raising specificity. Within a layer, a component that must beat a context rule (`.myc-prose blockquote`) matches its specificity (`blockquote.myc-quote`) and comes later in `main.css`
- New `.myc-*` block: its own file in the matching folder, with the `@import` and layer in `main.css`, in the same folder group
- Keep a block's `@media`, `@container` and `prefers-reduced-motion` rules in the block's own file
- Keep files under ~500 lines; split by sub-block when they grow

### Themes

A theme (`themes/<id>/`) is a package of roles per mode, CSS for public hooks and optional slots, validated against contract v2 (ADR 0005). Start with `npm run theme:new -- <id>` and the `create-theme` skill; the guide is `docs/themes/creating-a-theme.md`, the reference `docs/themes/reference/`. `NUXT_PUBLIC_THEME=<id>` is the build's theme and, at runtime, the default theme the server loads from the built-in store (default `bogota`; `docs/themes/theme-store.md`). Adding to the contract (an optional role, slot, layout variant or hook) bumps the minor: raise `CONTRACT_VERSION.minor`, add rows to `CONTRACT_ADDITIONS` and a section to `docs/themes/contract-changelog.md`.

### i18n Guidelines

- Store locale files in `i18n/locales/` as JSON
- Use `useI18n()` composable for translations
- Access translations with `t('namespace.key')`
- All user-facing strings must be translated

### API/Server Guidelines

- Server routes go in `server/api/` or `server/routes/`; use `$fetch` for internal calls
- Call Strapi only through `strapiFetch()` / `strapiUrl()` from `server/utils/strapi.ts`; never build the URL or the `Authorization` header by hand
- When a route or a Strapi call changes, update `docs/openapi.json` (`npm run openapi`), `docs/api.md` (caching, behaviour) and `docs/security.md` (token permissions, endpoint protections)
- Validate request bodies with a zod schema in `server/schemas/` and `validBody(event, schema, invalid)` from `server/utils/validation.ts`; `invalid` builds the error so each route keeps its own status and code. Reuse the validators of `app/helpers/` so client and server agree
- Return proper HTTP status codes with `createError()`
- A decision that is expensive to undo (caching, auth, analytics, security headers, deployment) gets an ADR in `docs/adr/`; read the existing ones first
- Use `useRuntimeConfig()` for configuration access

### Error Handling

- Use Nuxt's `createError()` for server-side errors
- Handle async operations with try/catch in server routes
- Return null for "not found" cases rather than throwing

### Accessibility

- Always include `aria-label` on interactive elements without visible text
- Use semantic HTML elements
- Include `<SkipLinks />` component for keyboard navigation
- Ensure color contrast meets WCAG guidelines

### SEO

- Use `useSeoMeta()` on page components for meta tags
- Include Open Graph and Twitter Card meta tags

## Project Structure

```
app/
├── app.config.ts        # App-wide configuration
├── app.vue              # Root component
├── assets/css/          # Global styles (see CSS Architecture)
├── components/          # Vue components (auto-imported)
├── composables/         # Composables (auto-imported)
├── constants/           # Shared constants by domain
├── helpers/             # Pure logic without framework imports, unit-tested
├── interfaces/          # TypeScript interfaces
├── islands/             # Heavy client-side islands and their loader
├── layouts/             # Page layouts
├── schemas/             # Response schemas (zod) tied to the interfaces; server code and tests only (see the server-route skill)
├── theme/               # Theme hooks (hooks.json), default and layout parts
└── pages/               # Routes: index, about, privacy, confirm, account/, drafts/, newsletter/, blog/ (index, [slug])

server/
├── api/                 # API routes: posts, search, comments, newsletter, auth, drafts, fediverse…
├── routes/              # feed.xml, sitemap.xml, robots.txt
├── middleware/          # Umami first-party proxy
├── openapi/             # Route manifest and generator of docs/openapi.json (npm run openapi)
├── plugins/             # Content Security Policy, runtime config check
└── utils/               # strapi.ts (strapiUrl, strapiFetch), auth, rate limit…

i18n/locales/            # Translation files
modules/                 # Nuxt modules: islands, site mode, message precompilation
themes/                  # Installed themes (bogota, starter) and theme.schema.json
test/                    # Vitest unit tests (test/integration/ for API routes)
e2e/                     # Playwright end-to-end suites and the mock Strapi
```

## Key Dependencies

- `@nuxt/image`, `@nuxtjs/i18n`, `@vueuse/nuxt`: images, i18n, VueUse
- `marked` + `sanitize-html` - Markdown rendering of Strapi rich text, on the server only (`app/helpers/markdown.ts`), always sanitized
- `mermaid` - Diagrams, loaded only on articles that have them
- `nodemailer` - Newsletter email over SMTP
