# Alternates

A data-only theme on the second variant of every region (`header: centered`, `home: index`, `postList: list`, `article: centered`,
`footer: minimal`), with no slots (#402). `e2e/runtime-theme.spec.ts` serves it from the e2e build made for Bogotá, and
`theme-admission-fixtures.yml` admits it on the shared build, where its JS limits include the variant allowance of
`scripts/perf/budgets.json` (docs/performance.md, "A theme on another theme's image").
