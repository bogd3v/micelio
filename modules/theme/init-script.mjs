// Inline script that sets data-theme and data-scheme before first paint (ADR 0005, section 2).
// Built once per build from the theme's modes: no request data may enter it (ADR 0004 hashes it).

export const THEME_STORAGE_KEY = 'micelio-theme'

/**
 * Resolution: a valid micelio-theme, the server's data-mode-default (never data-theme: the server's value is not a choice),
 * the system preference through the scheme, the first mode. Storage is only read.
 */
export function buildInitScript(modes) {
  const list = JSON.stringify(modes.map(mode => [mode.id, mode.scheme]))
  return `(function(){var d=document.documentElement,m=${list},t,g=function(k){return localStorage.getItem(k)},i=function(v){return m.filter(function(x){return x[0]===v})[0]},s=function(v){return m.filter(function(x){return x[1]===v})[0]};try{t=i(g('${THEME_STORAGE_KEY}'));if(!t)t=i(d.getAttribute('data-mode-default'))||s(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')}catch(e){}t=t||m[0];d.setAttribute('data-theme',t[0]);d.setAttribute('data-scheme',t[1])})()`
}
