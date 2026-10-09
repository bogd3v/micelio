// Inline script that sets data-theme and data-scheme before first paint (ADR 0005, section 2).
// Built once per build from the theme's modes: no request data may enter it (ADR 0004 hashes it).

export const THEME_STORAGE_KEY = 'micelio-theme'
/** The pre-rename theme key: read and removed, never written. */
// TODO(#422): remove the bd-theme fallback
export const BD_THEME_STORAGE_KEY = 'bd-theme'
export const PREVIOUS_THEME_STORAGE_KEY = 'devbog-theme'
export const LEGACY_THEME_STORAGE_KEY = 'devbog-color-mode'

/**
 * Resolution: valid micelio-theme, valid bd-theme, valid devbog-theme, devbog-color-mode through its scheme,
 * the server's data-mode-default (never data-theme: the server's value is not a choice),
 * the system preference through the scheme, the first mode. Storage is only read.
 */
export function buildInitScript(modes) {
  const list = JSON.stringify(modes.map(mode => [mode.id, mode.scheme]))
  return `(function(){var d=document.documentElement,m=${list},t,g=function(k){return localStorage.getItem(k)},i=function(v){return m.filter(function(x){return x[0]===v})[0]},s=function(v){return m.filter(function(x){return x[1]===v})[0]};try{t=i(g('${THEME_STORAGE_KEY}'))||i(g('${BD_THEME_STORAGE_KEY}'))||i(g('${PREVIOUS_THEME_STORAGE_KEY}'));if(!t){var c=g('${LEGACY_THEME_STORAGE_KEY}');t=(c==='dark'||c==='light'?s(c):0)||i(d.getAttribute('data-mode-default'))||s(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')}}catch(e){}t=t||m[0];d.setAttribute('data-theme',t[0]);d.setAttribute('data-scheme',t[1])})()`
}
