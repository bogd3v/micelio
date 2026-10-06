import type { PostListItem, StrapiBlock, StrapiImageCredit, StrapiPost } from '~/interfaces'
import { Category } from '~/interfaces'
import { renderCalloutHtml } from '~/helpers/callout'
import { renderCodeBlockHtml } from '~/helpers/code'
import { renderMermaidBlockHtml } from '~/helpers/mermaid'

// Static content for /_theme: the page needs no Strapi. Sample prose, not UI text.

export const SHELL_SAMPLE = '$ npm run dev\n$ curl -sI http://localhost:3000/_theme\nHTTP/1.1 200 OK'

export const TS_SAMPLE = `export function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')
}`

export const MERMAID_SAMPLE = `flowchart LR
  accTitle: Request flow
  Visitor --> Nitro
  Nitro --> Strapi
  Nitro --> Cache[(ISR cache)]`

export const SEQUENCE_SAMPLE = `sequenceDiagram
  Browser->>Server: GET /_theme
  Server-->>Browser: 200 OK`

const PROSE_HTML = `
<h2 id="headings">A second-level heading</h2>
<p>Body text with <a href="#headings">a link</a>, <strong>strong text</strong>, <em>emphasis</em>, <code>inline code</code> and a citation<sup><a href="#headings">[1]</a></sup>. The paragraph runs long enough to show the measure and the line height of the theme.</p>
<h3 id="lists">A third-level heading</h3>
<ul><li>An unordered item</li><li>Another item with <code>code</code></li><li>A last item</li></ul>
<ol><li>First step</li><li>Second step</li><li>Third step</li></ol>
<blockquote><p>A plain blockquote, for the text that is not a callout.</p></blockquote>
<hr>
<table><thead><tr><th>Role</th><th>Use</th></tr></thead><tbody><tr><td><code>ink</code></td><td>Main text</td></tr><tr><td><code>accent</code></td><td>Brand accent</td></tr></tbody></table>
<h4 id="deep">A fourth-level heading</h4>
<p>Closing paragraph.</p>`

const CALLOUTS_HTML = [
  renderCalloutHtml('note', 'Note', '<p>A note for context the reader may want.</p>'),
  renderCalloutHtml('warning', 'Warning', '<p>A warning about something that can go wrong.</p>'),
  renderCalloutHtml('danger', 'Danger', '<p>A danger: data loss or a security problem.</p>'),
].join('\n')

const CODE_HTML = [
  renderCodeBlockHtml(SHELL_SAMPLE, 'bash'),
  renderCodeBlockHtml(TS_SAMPLE, 'ts'),
].join('\n')

/** Rich text with every element the prose styles, callouts, code and Mermaid diagrams. */
export const PROSE_BLOCKS: StrapiBlock[] = [
  { id: 1, __component: 'shared.rich-text', body: '', html: PROSE_HTML },
  { id: 2, __component: 'shared.rich-text', body: '', html: CALLOUTS_HTML },
  { id: 3, __component: 'shared.rich-text', body: '', html: CODE_HTML },
  { id: 4, __component: 'shared.rich-text', body: '', html: `${renderMermaidBlockHtml(MERMAID_SAMPLE)}${renderMermaidBlockHtml(SEQUENCE_SAMPLE)}` },
  { id: 5, __component: 'shared.quote', body: 'A pull quote.', html: 'A pull quote, set apart from the prose.', title: 'Someone Wise' },
]

export const CREDIT: StrapiImageCredit = {
  kind: 'photo',
  author: 'Ada Lovelace',
  authorUrl: 'https://example.com/ada',
  source: 'Example Archive',
  sourceUrl: 'https://example.com/archive',
  license: 'cc-by-4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
}

export const AUTHOR = { id: 1, documentId: 'specimen-author', name: 'Specimen Author', avatar: null }

function post(id: number, category: Category, title: string): PostListItem {
  return {
    id,
    documentId: `specimen-post-${id}`,
    title,
    slug: `specimen-${id}`,
    description: 'A short description that shows how an excerpt wraps inside a card.',
    publishedAt: '2026-03-14T10:00:00.000Z',
    readTime: 6,
    category: { slug: category },
    author: AUTHOR,
  }
}

/** One post per category, enough to fill a grid. */
export const POSTS: PostListItem[] = [
  post(1, Category.Privacy, 'Keeping your data at home'),
  post(2, Category.Diy, 'A home lab on a shelf'),
  post(3, Category.Ai, 'Small models, real work'),
  post(4, Category.Software, 'Composables that last'),
  post(5, Category.Linux, 'Hardening a server in an hour'),
]

export const FEATURED_POST: PostListItem = POSTS[0]!

// Own ids and no Mermaid: the Prose group already holds the full set, and ids must stay unique on the page
const ARTICLE_HTML = `
<h2 id="article-intro">An article heading</h2>
<p>A paragraph with <a href="#article-intro">a link</a> and <code>inline code</code>, to see the article region around its body.</p>
<h3 id="article-detail">A smaller heading</h3>
<ul><li>First point</li><li>Second point</li></ul>
${renderCodeBlockHtml(TS_SAMPLE, 'ts')}`

const ARTICLE_BLOCKS: StrapiBlock[] = [{ id: 11, __component: 'shared.rich-text', body: '', html: ARTICLE_HTML }]

/** An article for the article region: draft mode skips comments, related posts and the reading path. */
export const ARTICLE: StrapiPost = {
  ...post(100, Category.Linux, 'A specimen article'),
  content: null,
  tags: [{ name: 'specimen', slug: 'specimen' }, { name: 'theme', slug: 'theme' }],
  coverCredit: CREDIT,
  blocks: ARTICLE_BLOCKS,
  references: [],
  translations: [],
  seo: undefined,
}
