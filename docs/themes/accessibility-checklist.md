# Accessibility checklist for admitting a theme

The axe run of `npm run test:theme` (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa`, nothing excluded) finds only part of the problems. It cannot tell whether a focus order makes sense or whether a screen reader says something useful. This checklist is the manual part of admission, from section 9 of the standard (WCAG 2.2, level AA). Each line is **pass**, **fail** (with an issue) or **not verified** (with the reason).

## When to run it

- A new theme: always.
- A new version of a theme that changes CSS, markup or slots: run it again.
- A version that only changes messages or images: not needed.

## Where the result is recorded

The admission report of the theme (`admission-report.json`, #311) records who ran the checklist, when, the theme version and the result of each line. Until that report exists, record it in the Progress section of the issue that admits the theme. A failing line gets its own issue, linked from the record.

## How to run it

Use the pages that `/_theme` and the test suite use: home, blog, an article, about and the specimen. Repeat the lines for every mode of the theme, at 1280 px and 390 px, with the privacy notice both shown and dismissed.

### 1. Keyboard only

Put the mouse away.

- [ ] Every control can be reached with Tab and operated with Enter, Space or the arrow keys.
- [ ] The order of focus follows the reading order.
- [ ] The focus is visible on every stop (an outline or equivalent of at least 3:1 against its surroundings), including card links and form fields.
- [ ] A focused element is never fully hidden behind the header, the mobile tab bar or the privacy notice (WCAG 2.4.11).
- [ ] The skip link is the first stop and moves the focus to the content.
- [ ] Menus, the search palette and the sheet open and close with the keyboard, trap nothing and return the focus to their trigger.

### 2. Screen reader

Orca on Linux with Firefox (`sudo dnf install orca`, toggle with Super+Alt+S), NVDA on Windows or VoiceOver on macOS.

- [ ] Landmarks: one `main`, a `header`, a `footer`, and every `nav` with its own name.
- [ ] Headings: one `h1` and no skipped levels; the heading list reads as an outline of the page.
- [ ] Every control has a name that says what it does, out of context.
- [ ] After an action (theme switch, subscribe, comment, copy), the result is announced.
- [ ] The language of the page is right, and a change of language is marked.

### 3. Zoom and reflow

- [ ] At 200 % zoom (a 640 px viewport at 1280) nothing is cut off and nothing needs horizontal scrolling.
- [ ] At 320 px wide there is no horizontal scrolling for the page (code blocks and tables may scroll on their own).
- [ ] With text spacing raised (line height 1.5, letter spacing 0.12 em, word spacing 0.16 em) no content is lost.

### 4. Motion and forced colors

- [ ] With `prefers-reduced-motion: reduce`, nothing moves after load or while scrolling (the `<mode>-reduced` projects of `npm run test:theme` check it; see `docs/theme-testing.md`).
- [ ] With forced colors on (Windows high contrast, or `forcedColors: 'active'`), text, borders, icons and the focus indicator are visible and no information depends on a colour alone.

### 5. Target size and alternatives to dragging

- [ ] Every target is at least 24 by 24 CSS px, or has enough space around it so that a 24 px circle centred on it touches no other target (WCAG 2.5.8). Axe checks it on the pages it opens; check by hand the components it does not reach (the slider, the dots, the table of contents).
- [ ] Everything that can be dragged or swiped (the slider) has a single-pointer alternative: buttons, and the arrow keys (WCAG 2.5.7).

## Results

Record each run here as a short entry, newest first, and link the issues of failing lines.

### 2026-10-19, `bogota` and `starter` (core `main` at `4a2029f`)

Run with Playwright against a production build with the specimen page, home, blog, article and about, in every mode at 1280 and 390 px. Run by an agent, supervised by the maintainer.

| Line | `bogota` | `starter` |
| --- | --- | --- |
| Axe, including `wcag22aa` | Pass (24 tests) | Pass (24 tests) |
| 1. Everything reachable, order, skip link | Pass | Pass |
| 1. Focus visible | Fail on blog card links: [#617](https://github.com/bogd3v/micelio/issues/617) | Pass; the search field is to be confirmed in #617 |
| 1. Focus not hidden | Fail at 390 px, tab bar and privacy notice: [#615](https://github.com/bogd3v/micelio/issues/615) | Fail at 390 px, same cause: #615 |
| 2. Landmarks and headings | Pass (one `main` and `h1`, named `nav`, no skipped heading) | Pass |
| 2. Names, announcements, with a real screen reader | Not verified | Not verified |
| 3. 200 % zoom | Pass | Pass |
| 3. 320 px reflow | Fail, 330 px wide: [#616](https://github.com/bogd3v/micelio/issues/616) | Pass |
| 3. Text spacing | Not verified | Not verified |
| 4. Reduced motion | Pass (motion projects) | Pass (motion projects) |
| 4. Forced colors | Pass for the focus indicator; the rest not verified | Same |
| 5. Target size | Pass (axe `target-size`) | Pass (axe `target-size`) |
| 5. Alternative to dragging | Pass: the slider has previous and next buttons (44 px) and arrow keys; its dots are 24 px wide with 8 px between them | Same |

Not verified: a real screen reader (Orca, NVDA, VoiceOver), text spacing, the slider on a rendered page (the mock has no slider, so axe and the probes never opened one), and the privacy notice's keyboard order. The keyboard, focus and reflow results come from a script, not from a person, so a person should repeat lines 1 and 2 before the first third-party theme is admitted.
