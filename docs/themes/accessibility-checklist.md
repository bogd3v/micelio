# Accessibility checklist for admitting a theme

The axe run of `npm run test:theme` (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` and `wcag22aa`, nothing excluded) finds only part of the problems. It cannot tell whether a focus order makes sense or whether a screen reader says something useful. This checklist is the manual part of admission, from section 9 of the standard (WCAG 2.2, level AA). Each line is **pass**, **fail** (with an issue) or **not verified** (with the reason).

## When to run it

- A new theme: always.
- A new version of a theme that changes CSS, markup or slots: run it again.
- A version that only changes messages or images: not needed.

## Where the result is recorded

Each run is recorded as a JSON file in the theme's repository, `<accessibility-root>/<theme id>.json` (`accessibility/` by default, an input of the admission workflow), outside the theme folder because the package must not include it. Theme admission reads it and copies it into the `accessibility` field of the admission report (`admission-report.json`, [publishing-a-theme.md](publishing-a-theme.md#5-the-report)), validated against `AccessibilityRecordSchema` in `modules/theme/admission/report.ts`:

```json
{
  "version": "1.2.0",
  "core": "v0.6.0",
  "date": "2026-10-20",
  "by": "Ana, maintainer of the theme",
  "method": "Orca 46 with Firefox, Chromium at 200 % zoom, Windows contrast themes",
  "lines": {
    "keyboard.operable": { "result": "pass" },
    "keyboard.focus-visible": { "result": "fail", "issue": "https://github.com/example/theme/issues/12", "note": "Card links at 390 px" },
    "zoom.text-spacing": { "result": "not-verified", "note": "No text spacing bookmarklet yet" }
  }
}
```

- `lines` has every id of this checklist (the code before each line below), each `pass`, `fail` with the `issue` that tracks it, or `not-verified` with a `note` that says why. A record that misses a line, fails one without an issue or is not valid JSON is an error of the report.
- `version` is the theme version that was checked. Admission only warns about a record of another version, a missing record and a failed line, because it also runs for themes that have no record yet. Publishing (`docs/themes/publishing-a-theme.md`, section 8) refuses a missing record, a record of another version and a failed line; lines not verified do not block and are published with the report.
- `by` names whoever ran the checklist, as they want to be named. Record nothing else about them.

A failing line gets its own issue, linked from the record. Until a theme's repository runs admission, record the run in the Progress section of the issue that admits it, as the results below were. The core's own themes have no record yet, so `deploy.yml` reports a `missing` warning for each; a record for them comes when a person repeats lines 1 and 2, as the last results say.

## How to run it

Use the pages that `/_theme` and the test suite use: home, blog, an article, about and the specimen. Repeat the lines for every mode of the theme, at 1280 px and 390 px, with the privacy notice both shown and dismissed.

### 1. Keyboard only

Put the mouse away.

- [ ] `keyboard.operable` Every control can be reached with Tab and operated with Enter, Space or the arrow keys.
- [ ] `keyboard.order` The order of focus follows the reading order.
- [ ] `keyboard.focus-visible` The focus is visible on every stop (an outline or equivalent of at least 3:1 against its surroundings), including card links and form fields.
- [ ] `keyboard.focus-not-hidden` A focused element is never fully hidden behind the header, the mobile tab bar or the privacy notice (WCAG 2.4.11).
- [ ] `keyboard.skip-link` The skip link is the first stop and moves the focus to the content.
- [ ] `keyboard.overlays` Menus, the search palette and the sheet open and close with the keyboard, trap nothing and return the focus to their trigger.

### 2. Screen reader

Orca on Linux with Firefox (`sudo dnf install orca`, toggle with Super+Alt+S), NVDA on Windows or VoiceOver on macOS.

- [ ] `screen-reader.landmarks` Landmarks: one `main`, a `header`, a `footer`, and every `nav` with its own name.
- [ ] `screen-reader.headings` Headings: one `h1` and no skipped levels; the heading list reads as an outline of the page.
- [ ] `screen-reader.names` Every control has a name that says what it does, out of context.
- [ ] `screen-reader.announcements` After an action (theme switch, subscribe, comment, copy), the result is announced.
- [ ] `screen-reader.language` The language of the page is right, and a change of language is marked.

### 3. Zoom and reflow

- [ ] `zoom.200` At 200 % zoom (a 640 px viewport at 1280) nothing is cut off and nothing needs horizontal scrolling.
- [ ] `zoom.reflow-320` At 320 px wide there is no horizontal scrolling for the page (code blocks and tables may scroll on their own).
- [ ] `zoom.text-spacing` With text spacing raised (line height 1.5, letter spacing 0.12 em, word spacing 0.16 em) no content is lost.

### 4. Motion and forced colors

- [ ] `motion.reduced` With `prefers-reduced-motion: reduce`, nothing moves after load or while scrolling (the `<mode>-reduced` projects of `npm run test:theme` check it; see `docs/theme-testing.md`).
- [ ] `motion.forced-colors` With forced colors on (Windows high contrast, or `forcedColors: 'active'`), text, borders, icons and the focus indicator are visible and no information depends on a colour alone.

### 5. Target size and alternatives to dragging

- [ ] `pointer.target-size` Every target is at least 24 by 24 CSS px, or has enough space around it so that a 24 px circle centred on it touches no other target (WCAG 2.5.8). Axe checks it on the pages it opens; check by hand the components it does not reach (the slider, the dots, the table of contents).
- [ ] `pointer.dragging` Everything that can be dragged or swiped (the slider) has a single-pointer alternative: buttons, and the arrow keys (WCAG 2.5.7).

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
