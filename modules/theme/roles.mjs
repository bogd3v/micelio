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
    ...[1, 2, 3, 4, 5].flatMap(n => [`category-${n}`, `category-${n}-soft`]),
    'code-ink', 'code-muted', 'code-keyword', 'code-string', 'code-number', 'code-function',
  ],
  shadow: ['shadow-raised', 'shadow-overlay', 'glow-accent'],
  spacing: ['space-1', 'space-2', 'space-3', 'space-4', 'space-6', 'space-8', 'space-12', 'space-section', 'space-gutter', 'space-inline'],
  radius: ['radius-control', 'radius-card', 'radius-full'],
  size: ['container', 'measure', 'nav-height'],
  motion: ['duration-fast', 'duration-base', 'duration-slow', 'ease-standard', 'ease-emphasized'],
}

/** Optional roles and the value the core uses when a theme omits them. */
export const OPTIONAL_ROLES = {
  color: { 'link-soft': 'color-mix(in srgb, var(--link) 12%, var(--surface))' },
  shadow: { 'glow-link': 'none' },
}

/** What each role is for (ADR 0005, section 1); the theme reference is generated from it (docs/themes/reference/). */
export const ROLE_PURPOSES = {
  'surface': 'Page background.',
  'surface-raised': 'Cards, menus, form fields and the mobile tab bar.',
  'surface-sunken': 'Code blocks and inset areas such as figures and card covers.',
  'line': 'Decorative hairlines: separators and card borders.',
  'line-strong': 'Control borders (inputs, secondary button).',
  'ink': 'Main text and the fill of the primary button.',
  'ink-muted': 'Secondary text: excerpts, metadata, dates, help.',
  'on-ink': 'Text on an `ink` fill.',
  'accent': 'Brand accent: the accent button, active states, brand marks.',
  'accent-soft': 'Tinted background behind accent text.',
  'accent-hover': 'The accent on hover.',
  'on-accent': 'Text and icons on the accent.',
  'link': 'Links in running text.',
  'link-soft': 'Tinted background for links, highlights and active items.',
  'focus': 'Focus ring.',
  'success': 'Success state.',
  'success-soft': 'Background of a success message.',
  'warning': 'Warning state.',
  'warning-soft': 'Background of a warning message.',
  'danger': 'Errors and destructive actions.',
  'danger-soft': 'Background of an error message.',
  'info': 'Informative state.',
  'info-soft': 'Background of an informative message.',
  ...Object.fromEntries([1, 2, 3, 4, 5].flatMap(n => [
    [`category-${n}`, `Color of category ${n}: categories take the roles in order (\`categoryColor()\`).`],
    [`category-${n}-soft`, `Tinted background behind category ${n} text.`],
  ])),
  'code-ink': 'Code text.',
  'code-muted': 'Comments and punctuation in code.',
  'code-keyword': 'Keywords in code.',
  'code-string': 'Strings in code.',
  'code-number': 'Numbers in code.',
  'code-function': 'Function names in code.',
  'shadow-raised': 'Shadow of a `card` on hover.',
  'shadow-overlay': 'Shadow of the slider arrow buttons.',
  'glow-accent': 'Glow of the accent button on hover (`bd-btn-accent`); may be `none`.',
  'glow-link': 'Glow on focused and hovered interactive surfaces.',
  'space-1': 'Step 1 of the space scale.',
  'space-2': 'Step 2 of the space scale.',
  'space-3': 'Step 3 of the space scale.',
  'space-4': 'Step 4 of the space scale.',
  'space-6': 'Step 6 of the space scale.',
  'space-8': 'Step 8 of the space scale.',
  'space-12': 'Step 12 of the space scale.',
  'space-section': 'Padding between page sections.',
  'space-gutter': 'Gap of card grids.',
  'space-inline': 'Side margin of the page, per breakpoint.',
  'radius-control': 'Corners of buttons, fields and chips.',
  'radius-card': 'Corners of article cards (`bd-card`).',
  'radius-full': 'Fully rounded corners: avatars and the account menu button.',
  'container': 'Maximum width of the page content. The core does not read it directly; reference it from other values with `{container}`, for example in `space-inline`.',
  'measure': 'Maximum width of text columns: the about page sections and the `centered` article.',
  'nav-height': 'Height of the header\'s main row in the `bar` layout, from 768px.',
  'duration-fast': 'Entrance of the search palette.',
  'duration-base': 'Hover, focus and color transitions.',
  'duration-slow': 'Slow transitions, such as font stretch.',
  'ease-standard': 'Default easing curve.',
  'ease-emphasized': 'Easing of the slider and the back-to-top button.',
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
