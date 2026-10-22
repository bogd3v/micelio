// Inline script that sets data-theme and data-scheme before first paint (ADR 0005, section 2; ADR 0009, section 6).
// Theme-independent: the modes come from the data-modes attribute that server/plugins/themeMode.ts writes on <html>,
// so one script, and one CSP hash (ADR 0004), serves every theme.

export const THEME_STORAGE_KEY = 'micelio-theme'

/** The attribute of `<html>` that lists the active theme's modes as `id:scheme` pairs separated by commas. */
export const MODES_ATTRIBUTE = 'data-modes'

/**
 * The init script. Resolution: a valid micelio-theme, the server's data-mode-default (never data-theme: the server's value is not a choice),
 * the system preference through the scheme, the first mode. Storage is only read. Without `data-modes` it changes nothing.
 */
export function buildInitScript() {
  return `(function(){var d=document.documentElement,a=d.getAttribute('${MODES_ATTRIBUTE}'),t,g=function(k){return localStorage.getItem(k)};if(!a)return;var m=a.split(',').map(function(x){return x.split(':')}),i=function(v){return m.filter(function(x){return x[0]===v})[0]},s=function(v){return m.filter(function(x){return x[1]===v})[0]};try{t=i(g('${THEME_STORAGE_KEY}'));if(!t)t=i(d.getAttribute('data-mode-default'))||s(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')}catch(e){}t=t||m[0];d.setAttribute('data-theme',t[0]);d.setAttribute('data-scheme',t[1])})()`
}
