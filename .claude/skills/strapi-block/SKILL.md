---
name: strapi-block
description: Render a new Strapi dynamic-zone block (shared.* for articles, about.* for the About page) in the Micelio frontend, or change how an existing block renders. Use when the backend adds or changes a component under src/components in micelio-cms.
---

# Strapi block

A block travels through five places. Missing one gives an empty block, a 400 from Strapi or a CSP violation in production.

1. **Backend first.** The component lives in `~/Git/micelio-cms/src/components/<category>/<name>.json`. Read its attributes there; do not guess field names.
2. **Populate.** Add the component to the dynamic-zone `populate.on` map: `ARTICLE_POPULATE` in `server/lib/constants.ts` for articles, `server/api/about.get.ts` for About. Media and relations need explicit `populate: { file: true, … }`; an unknown key makes Strapi answer 400.
3. **Type.** Add an interface to `app/interfaces/strapi-blocks.ts` with `__component: '<category>.<name>'` and add it to the `StrapiBlock` union.
4. **Renderer.** Create `app/components/strapi/<Name>Block.vue` (follow the **ui-component** skill) and register it in `componentMap` in `BlocksRenderer.vue`. Blocks missing from the map are skipped silently.
5. **Content safety.**
   - Markdown or rich text goes through `renderMarkdown` / `renderInlineMarkdown` (`useMarkdownRenderer.ts`), which sanitizes with `sanitize-html`. Never bind Strapi text to `v-html` without it.
   - Images come from Strapi or `resources.bogdev.com.co`; another host must be added to `img-src` in `contentSecurityPolicy()`.
   - Embeds are limited to YouTube and Vimeo in both the sanitizer and `frame-src`; change both together.

If the block feeds the table of contents, citations or figure numbering, update `app/helpers/toc.ts`, `citations.ts` or `figures.ts` and their tests.

## Tests

- Component test in `test/nuxt/` with a fixture of the block.
- Add the block to an article or About fixture in `e2e/mock-strapi.mjs` (and `test/integration/mock-strapi.ts` if a route test needs it), then run the article or About e2e spec.
- Check a production build for CSP violations (see **verify-change**) when the block loads media or embeds.
