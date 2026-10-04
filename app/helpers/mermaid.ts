import { renderCodeBlockHtml } from './code'

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

export type MermaidToken = typeof MERMAID_TOKENS[number]

export type MermaidTokens = Record<MermaidToken, string>

export const MERMAID_CSS = [
  '.flowchart-link, .messageLine0, .messageLine1, .relation, .transition { stroke-width: 1.4px; }',
  '.marker, .arrowheadPath { stroke-width: 1.4px; }',
  'rect { rx: 0; ry: 0; }',
  '.actor, .node rect, .note { filter: none; }',
].join(' ')

const ACC_TITLE = /^\s*accTitle\s*:\s*(.+?)\s*$/m

export function renderMermaidBlockHtml(code: string): string {
  return `<div class="bd-mermaid not-prose">${renderCodeBlockHtml(code, 'mermaid')}</div>\n`
}

export function mermaidTitle(source: string): string | null {
  return source.match(ACC_TITLE)?.[1] ?? null
}

export function mermaidThemeVariables(tokens: MermaidTokens, dark: boolean): Record<string, string | number | boolean> {
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
