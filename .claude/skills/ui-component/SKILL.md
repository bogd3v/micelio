---
name: ui-component
description: Build or change a Vue component or page of the Micelio frontend following its design system (Bd* components, design tokens, layered CSS), i18n, accessibility and SEO conventions. Use for any new component, page, visual change or CSS refactor.
---

# UI component

Read `AGENTS.md` (code style, CSS architecture) and `docs/design/DESIGN.md` (BogDev design system) before writing markup.

## Design system

- Reuse `app/components/bd/` (`BdButton`, `BdCategoryTag`, `BdCallout`, `BdCodeBlock`…) before writing a new element; buttons and button-like links are always `<BdButton>`.
- Colors, spacing and type come from the tokens (`var(--…)`) declared in the active theme's `theme.json` (`themes/bogota/theme.json`); the build generates the CSS from it, so no generated file is checked in. `npm run tokens` prints it.
- Themes are `data-theme="noche" | "dia"` on `<html>`; check both.

## CSS

- A reusable block is a `.bd-*` file in `app/assets/css/components/`; page-only styles go in `pages/<page>/`; register each new file in `main.css` with its layer, next to its folder group.
- Keep a block's `@media`, `@container` and `prefers-reduced-motion` rules in its own file, and files under ~500 lines.
- When splitting or moving CSS, prove nothing changed: compare computed styles before and after (`verify-change`, `compare-styles.mjs`).

## Vue

- `<script setup lang="ts">`, typed `defineProps`/`defineEmits`, order Imports → Props/Emits → Composables → State → Computed → Functions → Lifecycle.
- **A getter passed to `useSeoMeta`/`useHead`/`useAccountPage` must not read state declared later.** unhead 3 evaluates it at once on the client: the setup throws, hydration fails and the page never mounts (this broke `/account/sign-up`). Declare the state first.
- `useHead` types are strict: give link `rel` a literal (`'alternate' as const`) and script attributes a `type` alias, not an `interface`.
- No user data in SSR output of cached (ISR) pages: load per-user data only when the session cookie exists.

## Text, a11y, SEO

- Every user-facing string in both `i18n/locales/en.json` and `es.json`; identifiers stay in English even when the design names them in Spanish.
- Native elements for interaction, `aria-label` when there is no visible text, labels on every input, visible focus, focus moved to the result after async actions, motion off under `prefers-reduced-motion`.
- Pages set `useSeoMeta()`; private pages are `noindex` and `private, no-store` in `routeRules`.

## Tests

- Component test in `test/nuxt/` with `mountSuspended` (mock endpoints with `registerEndpoint`), including error and empty states.
- e2e in `e2e/` for flows, keyboard use and both locales when the page is user-facing.
- Coverage of `app/` must stay over the thresholds in `vitest.config.ts`.
