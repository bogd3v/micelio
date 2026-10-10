import { MERMAID_ELEMENT } from '../islands/constants'
import { renderCodeBlockHtml } from './code'

/** The `id` of the element that holds the JSON settings of a diagram, read by `parseMermaidConfig`. */
export const MERMAID_CONFIG_ID = 'micelio-island-mermaid'

/** The names of the theme tokens that the diagrams read from CSS custom properties, without the `--` prefix. */
export const MERMAID_TOKENS = [
  'surface',
  'surface-raised',
  'surface-sunken',
  'line',
  'line-strong',
  'ink',
  'link',
  'warning-soft',
  'danger',
  'danger-soft',
  'font-mono',
] as const

type MermaidToken = typeof MERMAID_TOKENS[number]

/** The value of each token in `MERMAID_TOKENS`, as read from the page. */
export type MermaidTokens = Record<MermaidToken, string>

/** The CSS injected into each diagram: thin strokes, square corners and no shadows. */
export const MERMAID_CSS = [
  '.flowchart-link, .messageLine0, .messageLine1, .relation, .transition { stroke-width: 1.4px; }',
  '.marker, .arrowheadPath { stroke-width: 1.4px; }',
  'rect { rx: 0; ry: 0; }',
  '.actor, .node rect, .note { filter: none; }',
].join(' ')

const ACC_TITLE = /^\s*accTitle\s*:\s*(.+?)\s*$/m

/** Server markup of a diagram: the island (`app/islands/mermaid.ts`) upgrades the element; without it the source code block stays. */
export function renderMermaidBlockHtml(code: string): string {
  return `<${MERMAID_ELEMENT} class="myc-mermaid not-prose">${renderCodeBlockHtml(code, 'mermaid')}</${MERMAID_ELEMENT}>\n`
}

/** Settings the page hands the island: the accessible label and the theme's `mermaid` overrides (role names). */
export interface MermaidConfig {
  label: string
  overrides: Record<string, string>
}

// A Mermaid themeVariables name, and a role name: nothing else reaches getComputedStyle or the configuration
const VARIABLE_NAME = /^[A-Za-z][A-Za-z0-9]*$/
const ROLE_NAME = /^[a-z][a-z0-9-]*$/

/** Parses the JSON of the config element; anything malformed falls back to the defaults. */
export function parseMermaidConfig(json: string | null | undefined, fallbackLabel = ''): MermaidConfig {
  const empty: MermaidConfig = { label: fallbackLabel, overrides: {} }
  if (!json) return empty
  try {
    const data = JSON.parse(json) as Partial<MermaidConfig> | null
    const overrides = data && typeof data.overrides === 'object' && data.overrides ? data.overrides : {}
    return {
      label: typeof data?.label === 'string' && data.label ? data.label : fallbackLabel,
      overrides: Object.fromEntries(Object.entries(overrides).filter(([name, role]) => VARIABLE_NAME.test(name) && typeof role === 'string' && ROLE_NAME.test(role))),
    }
  } catch {
    return empty
  }
}

/** Theme overrides resolved to values: each role is read with `read` (a role without a value is skipped). */
export function resolveMermaidOverrides(overrides: Record<string, string>, read: (role: string) => string): Record<string, string> {
  return Object.fromEntries(Object.entries(overrides).flatMap(([name, role]) => {
    const value = read(role).trim()
    return value ? [[name, value]] : []
  }))
}

/** The accessible title of a Mermaid source, from its `accTitle` line, or null when it has none. */
export function mermaidTitle(source: string): string | null {
  return source.match(ACC_TITLE)?.[1] ?? null
}

/**
 * The Mermaid theme variables for the tokens in the light or the dark scheme, with the overrides applied on top.
 *
 * @param tokens - The value of each token in `MERMAID_TOKENS`.
 * @param dark - Whether the diagram uses the dark scheme.
 * @param overrides - Variables that replace the base ones, by Mermaid variable name. Empty by default.
 */
export function mermaidThemeVariables(tokens: MermaidTokens, dark: boolean, overrides: Record<string, string> = {}): Record<string, string | number | boolean> {
  return {
    ...baseThemeVariables(tokens, dark),
    ...overrides,
  }
}

function baseThemeVariables(tokens: MermaidTokens, dark: boolean): Record<string, string | number | boolean> {
  return {
    darkMode: dark,
    background: tokens['surface-sunken'],
    fontFamily: tokens['font-mono'],
    fontSize: '13px',
    radius: 0,
    useGradient: false,
    dropShadow: 'none',
    primaryColor: tokens['surface-raised'],
    mainBkg: tokens['surface-raised'],
    nodeBkg: tokens['surface-raised'],
    actorBkg: tokens['surface-raised'],
    labelBoxBkgColor: tokens['surface-raised'],
    activationBkgColor: tokens['surface-raised'],
    primaryTextColor: tokens.ink,
    secondaryTextColor: tokens.ink,
    tertiaryTextColor: tokens.ink,
    textColor: tokens.ink,
    titleColor: tokens.ink,
    nodeTextColor: tokens.ink,
    actorTextColor: tokens.ink,
    labelTextColor: tokens.ink,
    loopTextColor: tokens.ink,
    signalColor: tokens.link,
    signalTextColor: tokens.ink,
    primaryBorderColor: tokens['line-strong'],
    nodeBorder: tokens['line-strong'],
    actorBorder: tokens['line-strong'],
    labelBoxBorderColor: tokens['line-strong'],
    activationBorderColor: tokens['line-strong'],
    actorLineColor: tokens.line,
    lineColor: tokens.link,
    arrowheadColor: tokens.link,
    defaultLinkColor: tokens.link,
    secondaryColor: tokens.surface,
    secondaryBorderColor: tokens.line,
    tertiaryColor: tokens.surface,
    tertiaryBorderColor: tokens.line,
    clusterBkg: tokens.surface,
    clusterBorder: tokens.line,
    edgeLabelBackground: tokens['surface-sunken'],
    noteBkgColor: tokens['warning-soft'],
    noteTextColor: tokens.ink,
    noteBorderColor: tokens['line-strong'],
    sequenceNumberColor: tokens['surface-sunken'],
    errorBkgColor: tokens['danger-soft'],
    errorTextColor: tokens.danger,
  }
}
