# AGENTS.md

This file contains instructions and guidelines for agentic coding agents working in this repository.

## Project Overview

This is the frontend of Micelio, a blog engine whose CMS lives in `micelio-cms`. BogDev (bogdev.com.co) is the reference site running it. Stack:
- Nuxt 4 + Vue 3 + TypeScript frontend
- Server-side API routes (Nitro)
- Strapi CMS integration for content
- i18n support (English, Spanish)
- Plain CSS with custom properties for roles and theming

## Build/Lint/Test Commands

```bash
# Install dependencies
npm install

# Development
npm run dev          # Start dev server on http://localhost:3000
npm run build        # Production build
npm run preview      # Preview production build locally

# Type checking and linting
npm run typecheck    # Run Nuxt type checking
npm run lint         # Run ESLint (flat config, @nuxt/eslint), the primitives and class checks, and the theme schema and reference drift checks
npm run theme:schema # Regenerate themes/theme.schema.json from modules/theme/contract.ts (run it after changing the contract)
npm run theme:reference # Regenerate docs/themes/reference/ from the contract (run it after changing roles, layout variants, hooks or slots)
npm run theme:new -- <id> # New theme: copies themes/starter/ to themes/<id>/ and renames it ([--name "Name"])
npm run theme:check  # Contract, hooks, contrast matrix and static budgets of the installed themes ([id] and --json; errors exit 1)
npm run test         # Run unit tests with Vitest (test/*.test.ts)
npm run test:coverage     # Same tests with coverage of app/ and themes/; fails under the thresholds in vitest.config.ts
npm run test:integration  # Run API-route integration tests (test/integration/, needs a Nuxt build)
npm run test:landing      # Generate a landing (home page, no articles) against the mock Strapi and run e2e/landing/ (the default theme, then starter)
npm run test:e2e          # Run Playwright e2e tests (e2e/, starts mock Strapi + dev server)
npm run test:theme        # Theme visual regression and axe (e2e/theme/, needs a build with MICELIO_SPECIMEN=1; docs/theme-testing.md)
npm run test:theme:update # Same with --update-snapshots=changed (baselines are committed from the CI artifact, not made locally)
npm run perf              # Performance budgets on a production build (run npm run build first; see docs/performance.md)

# Generate static site
npm run generate     # Generate static output
```

## Plan and Progress

Micelio's roadmap is tracked on GitHub, which is the source of truth for agents:

- The epic **#240** lists every phase and issue, with a dependency graph. Start there to see what is done, in progress and unblocked.
- Each issue has a **Progress** section once work starts: PRs, numbers, findings that changed the plan, and what remains.
- When a PR advances an issue, update that issue's Progress section and tick the epic's box in the same change. Use `Refs #N` while work remains and `Closes #N` in the last PR.
- `docs/performance.md` records budgets and their history; ADRs in `docs/adr/` record decisions.

## Agent Skills

Project skills live in `.claude/skills/`; load the one that matches the task before starting:

| Skill | Use it to |
| --- | --- |
| `server-route` | Add or change a route in `server/api` or `server/routes`, or any call to Strapi |
| `strapi-block` | Render a new or changed Strapi dynamic-zone block |
| `ui-component` | Build or change a component, page or styles |
| `create-theme` | Create, adapt or restyle a theme in `themes/` (roles, modes, hooks, slots) and validate it with `theme:check` |
| `verify-change` | Run the checks and prove a change did not alter behaviour (scripts for computed styles, HTML and CSP) |
| `ship-pr` | Branch, commit, open or rebase a PR, and cut a release |
| `dependency-update` | Triage Dependabot, fix `npm audit` findings, upgrade a major |

## Commits and Pull Requests

- Commit messages, PR titles and PR descriptions in English
- Start every commit and PR title with a conventional prefix: `feat`, `fix`, `docs`, `refactor`, `style`, `test`, `ci`, `perf` or `chore`, with an optional scope (`fix(newsletter): …`). The PR title prefix sets the label that groups it in the release notes; use the `security` scope for security fixes and `chore(deps)` for dependency updates

## Code Style Guidelines

### General Conventions

- **Code in English**: All identifiers are in English: props, emits, variables, functions, composables, types and union/enum values, CSS classes and custom properties, test names and developer-facing messages. This applies even when an issue or `docs/design/` names them in Spanish (e.g. `activa` → `active`, `lectura` → `reading`, `tema` → `theme`). User-facing text goes through i18n. External data contracts keep their values: Strapi slugs (`'privacidad'`), `data-theme="noche" | "dia"` and its stored value, and design token names (`--mirla`, `--pinchaflor`)
- **Comments**: Keep code comments short and concise. When something needs more detail, write it in a Markdown document (`docs/`, an ADR) and reference it from the comment
- **TypeScript**: Always use explicit types for props, function parameters, and return values
- **Vue 3 Composition API**: Use `<script setup lang="ts">` syntax for all components
- **Script setup order**: Imports → Props/Emits → Composables → Reactive state → Computed → Functions → Lifecycle hooks

### File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `PostCard.vue`, `CommentSection.vue` |
| Pages | kebab-case | `blog/index.vue`, `about.vue` |
| Composables | camelCase with `use` prefix | `useStrapi.ts`, `useComments.ts` |
| Interfaces | camelCase | `post.ts`, `strapi-post.ts` |
| Server routes | kebab-case with HTTP method | `index.get.ts`, `[slug].get.ts` |
| API endpoints | kebab-case with method suffix | `posts/[slug].get.ts`, `comments/index.post.ts` |

### TypeScript Guidelines

- Always use explicit return types for composables
- Use `defineProps<T>()` with generic syntax for component props
- Use `defineEmits<{ event: [paramType] }>()` for emits
- Prefer interfaces over types for object shapes
- Export interfaces from `app/interfaces/` directory

### Vue Component Guidelines

```vue
<script setup lang="ts">
// 1. Imports
import type { Post } from '~/interfaces'

// 2. Props (use generic defineProps)
const props = defineProps<{
  post: Post
  index?: number
}>()

// 3. Emits
const emit = defineEmits<{
  action: [value: string]
}>()

// 4. Composables (auto-imported by Nuxt)
const { t } = useI18n()
const config = useRuntimeConfig()

// 5. Reactive state
const isOpen = ref(false)

// 6. Computed
const formattedDate = computed(() => { ... })

// 7. Functions (use function keyword, not arrow for methods)
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

- Colors, shadows and glows come from the semantic roles of ADR 0005 (`var(--ink)`, `var(--ink-muted)`, `var(--surface)`, `var(--link)`, `var(--accent)`, `var(--danger)`, `var(--category-3)`…), never from the theme's primitives (`--mirla`, `--chillon`, `--tingua`…). Primitives live only in `assets/css/settings/`; `npm run lint` fails otherwise (`scripts/check-primitives.mjs`). A category's color is `categoryColor(slug)` from `app/helpers/categories.ts`
- No utility classes in templates: every class is a `bd-*` class in its layer, or one of the core helpers (`card`, `font-display`, `font-mono`, `not-prose`). `npm run lint` fails otherwise (`scripts/check-classes.mjs`; ADR 0005, section 3)
- Icons are inline SVG components in `app/components/icons/` (`<IconsHome />`), sized by the parent's CSS
- Use `.card` class for card components with hover effects
- Use `<BdButton>` (`app/components/bd/`) for buttons and button-styled links; the `Bd*` components mirror the BogDev design system (see `docs/design/DESIGN.md`)
- Use `.input-field` for form inputs
- Use `font-display` class for display fonts (Archivo)
- Use `font-mono` class for monospace fonts

### CSS Architecture

Global styles live in `app/assets/css/`, split by responsibility (ITCSS-style, plain CSS). `main.css` holds only `@layer` declarations and `@import`s: never add rules to it. Lightning CSS is the CSS transformer, with browser targets (chrome 111, edge 111, firefox 114, safari 16.4, ios 16.4).

| Folder | Layer | Contents |
|--------|-------|----------|
| `settings/` | `bd.settings` | `typography.css` (the `.bd-heading-1`… classes, which read the theme's roles). The role values and the fonts come from the active theme (`themes/<id>/`) through `#build/micelio/settings.css`, generated at build; `themes/bogota/font-fallbacks.css` and `themes/starter/font-fallbacks.css` (`--theme starter`) are generated by `scripts/perf/font-fallbacks.py` |
| `base/` | `bd.reset` | `reset.css` (the minimal reset the site relies on), `base.css` (element defaults like `h1–h6`, `button`, `input`) |
| `base/` | `bd.base` | View transitions, shared focus ring |
| `components/` | `bd.components` | One file per reusable `.bd-*` block (`button.css` → `.bd-btn`, `chip.css` → `.bd-chip`…) |
| `layout/` | `bd.layout` | App shell: page gutters, header, mobile tab bar and sheet, footer |
| `pages/<page>/` | `bd.pages` | Blocks used by a single page (`home/`, `blog/`, `article/`, `about/`) |
| `animations/` | `bd.animations` | Every `@keyframes` |
| `utilities/` | `bd.utilities` | Single-purpose helpers (`.bd-sr`, `.bd-reveal`, `.bd-wide`…) |

- Layers decide precedence before specificity: `bd.reset` < `bd.settings` < `bd.base` < `bd.components` < `bd.layout` < `bd.pages` < `bd.utilities`. A page or layout rule can restyle a component without raising specificity. Within a layer, a component that must beat a context rule (`.bd-prose blockquote`) matches its specificity (`blockquote.bd-quote`) and comes later in `main.css`
- New `.bd-*` block: create its own file in the matching folder and add the `@import` with its layer to `main.css`, in the same folder group
- Keep a block's `@media`, `@container` and `prefers-reduced-motion` rules in the block's own file
- Keep files under ~500 lines; split by sub-block when they grow

### Themes

A theme (`themes/<id>/`) is a package of roles per mode, CSS for public hooks and optional slots, validated against contract v1 (ADR 0005). Start with `npm run theme:new -- <id>` (copies `themes/starter/`) and the `create-theme` skill; the guide is `docs/themes/creating-a-theme.md` and the generated reference `docs/themes/reference/`. `NUXT_PUBLIC_THEME=<id>` selects the theme at build or dev time (default `bogota`).

### i18n Guidelines

- Store locale files in `i18n/locales/` as JSON
- Use `useI18n()` composable for translations
- Access translations with `t('namespace.key')`
- All user-facing strings must be translated

### API/Server Guidelines

- Server routes go in `server/api/` or `server/routes/`
- Use `$fetch` for internal API calls
- Call Strapi only through `strapiFetch()` / `strapiUrl()` from `server/utils/strapi.ts`; never build the URL or the `Authorization` header by hand
- When a route or a Strapi call changes, update `docs/api.md` (input, output, errors) and `docs/security.md` (token permissions and endpoint protections)
- Validate request bodies with a zod schema in `server/schemas/` and `validBody(event, schema, invalid)` from `server/utils/validation.ts`; `invalid` builds the error so each route keeps its own status and code. Reuse the shared validators from `app/helpers/` inside the schema so the client forms and the server agree
- Return proper HTTP status codes with `createError()`
- A decision that is expensive to undo (caching, auth, analytics, security headers, deployment) gets an ADR in `docs/adr/`; read the existing ones before changing what they cover
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
├── interfaces/          # TypeScript interfaces
├── layouts/             # Page layouts
└── pages/               # Route pages
    ├── index.vue        # Home (/)
    ├── about.vue        # About (/about)
    ├── privacy.vue      # Privacy and cookies (/privacy)
    ├── confirm.vue      # Newsletter confirmation (/confirm)
    ├── account/         # Sign up, sign in, password reset, profile
    ├── drafts/          # Draft list and preview (editors)
    ├── newsletter/      # Unsubscribe page
    └── blog/
        ├── index.vue    # Blog list (/blog)
        └── [slug].vue   # Blog post (/blog/:slug)

server/
├── api/                 # API routes: posts, search, comments, newsletter, auth, drafts, fediverse…
├── routes/              # feed.xml, sitemap.xml, robots.txt
├── middleware/          # Umami first-party proxy
├── plugins/             # Content Security Policy, runtime config check
└── utils/               # strapi.ts (strapiUrl, strapiFetch), auth, rate limit…

i18n/locales/            # Translation files
```

## Key Dependencies

- `@nuxt/image` - Image optimization
- `@nuxtjs/i18n` - Internationalization
- `@vueuse/nuxt` - VueUse composables
- `marked` + `sanitize-html` - Markdown rendering of Strapi rich text, on the server only (`app/helpers/markdown.ts`), always sanitized
- `mermaid` - Diagrams, loaded only on articles that have them
- `nodemailer` - Newsletter emails over SMTP
