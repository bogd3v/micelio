import type {
  CtaSection, FaqItem, FaqSection, FeatureGridSection, FeatureItem, GallerySection, HeroSection, LogoCloudSection, LogoItem,
  MediaShowcaseSection, NewsletterSection, PageLink, PageMedia, PageSection, PageSectionKind, PostListItem, PostListSection,
  PricingPlan, PricingSection, RichTextSection, SceneSection, StatItem, StatsSection, StrapiBlock, StrapiImageCredit, StrapiPost,
  TestimonialItem, TestimonialsSection,
} from '~/interfaces'
import { Category } from '~/interfaces'
import { renderCalloutHtml } from '~/helpers/callout'
import { renderCodeBlockHtml } from '~/helpers/code'
import { renderMermaidBlockHtml } from '~/helpers/mermaid'

// Static content for /_theme: the page needs no Strapi. Sample prose, not UI text.

/** Shell session of the specimen's code block: a dev server command and its answer. Sample text, not UI text. */
export const SHELL_SAMPLE = '$ npm run dev\n$ curl -sI http://localhost:3000/_theme\nHTTP/1.1 200 OK'

/** TypeScript snippet shown in the specimen's code blocks. */
export const TS_SAMPLE = `export function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')
}`

const MERMAID_SAMPLE = `flowchart LR
  accTitle: Request flow
  Visitor --> Nitro
  Nitro --> Strapi
  Nitro --> Cache[(ISR cache)]`

const SEQUENCE_SAMPLE = `sequenceDiagram
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
  {
    id: 6,
    __component: 'shared.playground',
    runtime: 'sql',
    setup: 'CREATE TABLE articles (name TEXT);\nINSERT INTO articles VALUES (\'mycelia\'), (\'mycelia\'), (\'mycelia\');',
    code: 'SELECT name, COUNT(*) AS posts\nFROM articles\nGROUP BY name;',
    expectedOutput: 'name   | posts\n-------+------\nmycelia |     3',
    caption: 'Counting posts per author.',
  },
]

/** Photo credit of the specimen's article cover, in the shape a Strapi image credit has. */
export const CREDIT: StrapiImageCredit = {
  kind: 'photo',
  author: 'Ada Lovelace',
  authorUrl: 'https://example.com/ada',
  source: 'Example Archive',
  sourceUrl: 'https://example.com/archive',
  license: 'cc-by-4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
}

/** The author of every specimen post and article, and of the author badge samples. */
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

/** The featured post of the home region and of the featured card sample: the first of `POSTS`. */
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

// Page sections (#244): every section x variant, rendered by the real components. Media are generated SVGs served by the specimen itself (modules/theme/specimen/media, /_theme/media/).

function media(name: string, extra: Partial<PageMedia> = {}): PageMedia {
  return { url: `/_theme/media/${name}`, alternativeText: `Specimen ${name}`, width: 1200, height: 630, mime: 'image/svg+xml', ...extra }
}

const icon = (name: string): PageMedia => media(name, { width: 64, height: 64 })
const logo = (name: string): PageMedia => media(name, { width: 120, height: 40 })
const avatar = (name: string): PageMedia => media(name, { width: 96, height: 96 })
const link = (label: string, url: string): PageLink => ({ label, url })

const SECTION_LEAD = 'A short introduction that shows how the text of a section wraps and which measure it takes.'

const FEATURES: FeatureItem[] = [
  { icon: icon('icon-light.svg'), title: 'Light', text: 'Four hours of sun a day.' },
  { icon: icon('icon-pots.svg'), title: 'Pots', text: 'Any container with a hole.' },
  { icon: icon('icon-water.svg'), title: 'Water', text: 'A little, often.' },
  { title: 'Patience', text: 'A season or two.' },
]

const LOGOS: LogoItem[] = [
  { image: logo('logo-circle.svg'), name: 'Circle Seeds', url: 'https://circle.example.com' },
  { image: logo('logo-square.svg'), name: 'Square Soil' },
  { image: logo('logo-triangle.svg'), name: 'Triangle Tools' },
  { image: logo('logo-diamond.svg'), name: 'Diamond Dew' },
]

const TESTIMONIALS: TestimonialItem[] = [
  { quote: 'The basil smells all the way to the street.', author: 'Sam', role: 'Neighbor', avatar: avatar('sam.svg') },
  { quote: 'I started my own pots.', author: 'Robin' },
  { quote: 'Four hours of sun were enough.', author: 'Alex', role: 'Gardener', avatar: avatar('alex.svg') },
]

const PLANS: PricingPlan[] = [
  { name: 'Starter', price: '$5', period: 'per season', features: ['3 seed packs', 'A planting guide'], recommended: false },
  { name: 'Gardener', price: '$12', period: 'per season', features: ['8 seed packs', 'A planting guide', 'Email support'], recommended: true, link: link('Choose', '/') },
  { name: 'Co-op', price: '$30', features: ['20 seed packs', 'A shared plot'], recommended: false, link: link('Choose', '/') },
]

const ANSWERS: FaqItem[] = [
  { question: 'Do I need a garden?', html: '<p>No: a balcony is enough.</p>' },
  { question: 'Is this site real?', html: '<p>It is a demo of <a href="https://github.com/bogd3v/micelio">Micelio</a>.</p>' },
  { question: 'When do I plant?', html: '<p>After the last frost, with <strong>warm soil</strong>.</p>' },
]

const STATS: StatItem[] = [
  { value: '4 h', label: 'of sun a day' },
  { value: '12', label: 'pots' },
  { value: '3', label: 'months to compost' },
]

const hero = (variant: HeroSection['variant']): HeroSection => ({
  __component: 'section.hero',
  variant,
  title: 'Grow food where you live',
  text: SECTION_LEAD,
  primaryLink: link('Read the notes', '/blog'),
  secondaryLink: link('Micelio', 'https://github.com/bogd3v/micelio'),
  media: media('hero.svg', { width: 1600, height: 900 }),
})
const featureGrid = (variant: FeatureGridSection['variant']): FeatureGridSection => ({ __component: 'section.feature-grid', variant, title: 'What you need', text: SECTION_LEAD, items: FEATURES })
const mediaShowcase = (variant: MediaShowcaseSection['variant']): MediaShowcaseSection => ({
  __component: 'section.media-showcase',
  variant,
  title: 'A balcony in spring',
  html: '<p>Lettuce, basil and <strong>cherry tomatoes</strong>, a few steps from the kitchen.</p>',
  media: media('balcony.svg'),
  link: link('How to start', '/blog'),
})
const stats = (variant: StatsSection['variant']): StatsSection => ({ __component: 'section.stats', variant, title: 'One small garden', items: STATS })
const logoCloud = (variant: LogoCloudSection['variant']): LogoCloudSection => ({ __component: 'section.logo-cloud', variant, title: 'Friends of the garden', logos: LOGOS })
const testimonials = (variant: TestimonialsSection['variant']): TestimonialsSection => ({
  __component: 'section.testimonials',
  variant,
  title: 'What neighbors say',
  items: variant === 'single' ? TESTIMONIALS.slice(0, 1) : TESTIMONIALS,
})
const pricing = (variant: PricingSection['variant']): PricingSection => ({ __component: 'section.pricing', variant, title: 'Seed boxes', text: SECTION_LEAD, plans: PLANS })
const faq = (variant: FaqSection['variant']): FaqSection => ({ __component: 'section.faq', variant, title: 'Questions', items: ANSWERS })
const cta = (variant: CtaSection['variant']): CtaSection => ({
  __component: 'section.cta',
  variant,
  title: 'Start this weekend',
  text: 'One pot, one plant.',
  primaryLink: link('Read the guide', '/blog'),
  secondaryLink: link('Micelio', 'https://github.com/bogd3v/micelio'),
})
const postList = (variant: PostListSection['variant']): PostListSection => ({ __component: 'section.post-list', variant, title: 'From the garden', count: 3, posts: POSTS.slice(0, 3) })
const newsletter = (variant: NewsletterSection['variant']): NewsletterSection => ({
  __component: 'section.newsletter',
  variant,
  title: 'Notes by email',
  text: 'One email per season.',
  buttonLabel: 'Subscribe',
})
const gallery = (variant: GallerySection['variant']): GallerySection => ({
  __component: 'section.gallery',
  variant,
  title: 'Through the year',
  images: [
    media('spring.svg'),
    media('summer.svg', { width: 800, height: 1000 }),
    media('autumn.svg', { width: 1000, height: 700 }),
    media('winter.svg', { width: 800, height: 800 }),
    media('seeds.svg', { width: 1200, height: 800 }),
  ],
})
const scene = (variant: SceneSection['variant']): SceneSection => ({
  __component: 'section.scene',
  variant,
  // A one-triangle model ships next to the posters (generated by e2e/fixtures/glb.mjs); the island draws it unless motion is reduced
  model: media('triangle.glb', { mime: 'model/gltf-binary', width: undefined, height: undefined }),
  poster: media('triangle-poster.svg'),
  alt: 'A green triangle',
  title: 'A scene',
  text: SECTION_LEAD,
})
const richText: RichTextSection = {
  __component: 'section.rich-text',
  html: '<h2>About this page</h2><p>Rich text has no variant: it sets <strong>Markdown</strong> prose between the other sections, with <a href="/blog">a link</a>.</p><ul><li>A list item</li><li>Another item</li></ul>',
}

interface SpecimenPageSection {
  /** Section kind, as in `data-section` */
  kind: PageSectionKind
  /** `data-variant`; empty for rich-text */
  variant: string
  section: PageSection
}

function entries<V extends string>(kind: PageSectionKind, variants: V[], build: (variant: V) => PageSection): SpecimenPageSection[] {
  return variants.map(variant => ({ kind, variant, section: build(variant) }))
}

/** Every section and variant of the catalog (test/specimenSections.test.ts checks it against app/theme/hooks.json). */
export const PAGE_SECTIONS: SpecimenPageSection[] = [
  ...entries('hero', ['centered', 'split', 'full-bleed'], hero),
  ...entries('feature-grid', ['grid', 'list', 'bento'], featureGrid),
  ...entries('media-showcase', ['left', 'right', 'stacked'], mediaShowcase),
  ...entries('stats', ['row', 'cards'], stats),
  ...entries('logo-cloud', ['row', 'marquee'], logoCloud),
  ...entries('testimonials', ['single', 'grid'], testimonials),
  ...entries('pricing', ['cards', 'table'], pricing),
  ...entries('faq', ['list', 'two-columns'], faq),
  ...entries('cta', ['banner', 'card'], cta),
  ...entries('post-list', ['cards', 'list'], postList),
  ...entries('newsletter', ['inline', 'card'], newsletter),
  { kind: 'rich-text', variant: '', section: richText },
  ...entries('gallery', ['grid', 'masonry'], gallery),
  ...entries('scene', ['background', 'inline'], scene),
]
