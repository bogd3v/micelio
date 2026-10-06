// Contract v1 roles (ADR 0005, section 1), as plain ESM so the contract, the token builder and scripts/check-primitives.mjs share one list.

const states = ['success', 'warning', 'danger', 'info']

/** Roles every theme declares, by the `theme.json` group they live in. */
export const REQUIRED_ROLES = {
  color: [
    'surface', 'surface-raised', 'surface-sunken',
    'line', 'line-strong',
    'ink', 'ink-muted', 'on-ink',
    'accent', 'accent-soft', 'accent-hover', 'on-accent', 'link', 'focus',
    ...states.flatMap(state => [state, `${state}-soft`]),
    ...[1, 2, 3, 4, 5, 6].flatMap(n => [`category-${n}`, `category-${n}-soft`]),
    'code-ink', 'code-muted', 'code-keyword', 'code-string', 'code-number', 'code-function',
  ],
  shadow: ['shadow-raised', 'shadow-overlay', 'glow-accent'],
  spacing: ['space-1', 'space-2', 'space-3', 'space-4', 'space-6', 'space-8', 'space-12', 'space-16', 'space-24', 'space-section', 'space-gutter', 'space-inline'],
  radius: ['radius-control', 'radius-card', 'radius-full'],
  size: ['container', 'measure', 'nav-height'],
  motion: ['duration-fast', 'duration-base', 'duration-slow', 'ease-standard', 'ease-emphasized'],
}

/** Optional roles and the value the core uses when a theme omits them. */
export const OPTIONAL_ROLES = {
  color: { 'link-soft': 'color-mix(in srgb, var(--link) 12%, var(--surface))' },
  shadow: { 'glow-link': 'none' },
}

/** A role value cannot open a rule, a comment, a tag, a URL or an escape, nor carry !important (the `{name}` references are removed before the check; the generated CSS is checked again in validate.ts). */
export const UNSAFE_VALUE = /[;{}<>@`\\!]|\/\*|\b(url|image-set|-webkit-image-set|src|image|cross-fade|expression)\(/i

/** Quotes are for font stacks only; every other role value is a plain CSS value. */
export const QUOTED_VALUE = /["']/

export const TYPE_FAMILIES = ['display', 'sans', 'mono']

/** The scale; each step is `text-<step>` and `tracking-<step>`. */
export const TYPE_STEPS = ['display-xl', 'display-l', 'heading-1', 'heading-2', 'heading-3', 'body-l', 'body', 'body-s', 'eyebrow', 'meta', 'code']

/** Color and shadow names that are roles; any other name in those groups is a theme primitive (check-primitives). */
export const COLOR_ROLES = [...REQUIRED_ROLES.color, ...Object.keys(OPTIONAL_ROLES.color), ...REQUIRED_ROLES.shadow, ...Object.keys(OPTIONAL_ROLES.shadow)]
