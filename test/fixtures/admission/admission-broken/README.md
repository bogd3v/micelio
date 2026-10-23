# Admission broken

A data-only theme that theme admission must refuse (`.github/workflows/theme-admission-fixtures.yml`): `ink-muted` fails contrast in
`theme:check` and axe on the pages, and `theme.css` puts the page CSS over the performance budget. The theme that must pass is
`test/fixtures/themes/data-only`.
