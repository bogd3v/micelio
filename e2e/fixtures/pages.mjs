// Strapi `page` fixtures shared by both mocks; they mirror the CMS seed's showcase page (en `showcase`, es `muestra`)

import { withIds } from './ids.mjs'

function media(id, name, extra = {}) {
  return { id, documentId: `media-${id}`, url: `/uploads/${name}`, alternativeText: name, width: 1200, height: 630, mime: 'image/png', ...extra }
}

function link(label, url) {
  return { id: 1, label, url }
}

// `landing` is the page of a site with no blog (MOCK_NO_ARTICLES=1): its links go to the privacy page instead of the blog
function showcaseSections(es, landing) {
  const t = (en, spanish) => (es ? spanish : en)
  const prefix = es ? '/es' : ''
  const blog = `${prefix}/${landing ? 'privacy' : 'blog'}`
  return [
    {
      id: 1,
      __component: 'section.hero',
      variant: 'split',
      title: t('Grow food where you live', 'Cultiva comida donde vives'),
      text: t('Field Notes is a demo of every section.', 'Notas de campo es una muestra de todas las secciones.'),
      primaryLink: link(t('Read the notes', 'Leer las notas'), blog),
      secondaryLink: link('Micelio', 'https://github.com/bogd3v/micelio'),
      media: media(101, 'hero.png'),
    },
    {
      id: 2,
      __component: 'section.feature-grid',
      variant: 'grid',
      title: t('What you need', 'Lo que necesitas'),
      text: null,
      items: [
        { id: 1, icon: media(102, 'icon-light.svg', { mime: 'image/svg+xml', width: 64, height: 64 }), title: t('Light', 'Luz'), text: t('Four hours of sun.', 'Cuatro horas de sol.') },
        { id: 2, icon: media(103, 'icon-pots.svg', { mime: 'image/svg+xml', width: 64, height: 64 }), title: t('Pots', 'Macetas'), text: null },
        { id: 3, icon: null, title: t('Patience', 'Paciencia'), text: t('A season or two.', 'Una o dos temporadas.') },
      ],
    },
    {
      id: 3,
      __component: 'section.media-showcase',
      variant: 'left',
      title: t('A balcony in spring', 'Un balcón en primavera'),
      text: t('Lettuce, basil and **cherry tomatoes**.', 'Lechuga, albahaca y **tomates cherry**.'),
      media: media(104, 'balcony.png'),
      link: link(t('How to start', 'Cómo empezar'), landing ? blog : `${blog}/${t('starting-a-balcony-garden', 'empezar-una-huerta-en-el-balcon')}`),
    },
    {
      id: 4,
      __component: 'section.stats',
      variant: 'cards',
      title: t('One small garden', 'Una huerta pequeña'),
      items: [
        { id: 1, value: '4 h', label: t('of sun a day', 'de sol al día') },
        { id: 2, value: '12', label: t('pots', 'macetas') },
        { id: 3, value: '3', label: t('months to compost', 'meses para el compost') },
      ],
    },
    {
      id: 5,
      __component: 'section.logo-cloud',
      variant: 'row',
      title: t('Friends of the garden', 'Amigos de la huerta'),
      logos: [
        { id: 1, image: media(105, 'logo-circle.svg', { mime: 'image/svg+xml', width: 120, height: 40 }), name: 'Circle Seeds', url: 'https://circle.example.com' },
        { id: 2, image: media(106, 'logo-square.svg', { mime: 'image/svg+xml', width: 120, height: 40 }), name: 'Square Soil', url: null },
      ],
    },
    {
      id: 6,
      __component: 'section.testimonials',
      variant: 'grid',
      title: t('What neighbors say', 'Lo que dicen los vecinos'),
      items: [
        { id: 1, quote: t('The basil smells all the way to the street.', 'La albahaca se huele hasta la calle.'), author: 'Sam', role: t('Neighbor', 'Vecino'), avatar: media(107, 'sam.png', { width: 96, height: 96 }) },
        { id: 2, quote: t('I started my own pots.', 'Empecé mis macetas.'), author: 'Robin', role: null, avatar: null },
      ],
    },
    {
      id: 7,
      __component: 'section.pricing',
      variant: 'cards',
      title: t('Seed boxes', 'Cajas de semillas'),
      text: null,
      plans: [
        { id: 1, name: t('Starter', 'Inicial'), price: '$5', period: t('per season', 'por temporada'), features: t('3 seed packs\nA planting guide', '3 sobres de semillas\nUna guía de siembra'), recommended: false, link: null },
        { id: 2, name: t('Gardener', 'Huertera'), price: '$12', period: null, features: '8 seed packs', recommended: true, link: link(t('Choose', 'Elegir'), '/') },
      ],
    },
    {
      id: 8,
      __component: 'section.faq',
      variant: 'list',
      title: t('Questions', 'Preguntas'),
      items: [
        { id: 1, question: t('Do I need a garden?', '¿Necesito un jardín?'), answer: t('No: a balcony is enough.', 'No: basta un balcón.') },
        { id: 2, question: t('Is this site real?', '¿Este sitio es real?'), answer: t('It is a demo of [Micelio](https://github.com/bogd3v/micelio).', 'Es una demostración de [Micelio](https://github.com/bogd3v/micelio).') },
      ],
    },
    {
      id: 9,
      __component: 'section.cta',
      variant: 'banner',
      title: t('Start this weekend', 'Empieza este fin de semana'),
      text: t('One pot, one plant.', 'Una maceta, una planta.'),
      primaryLink: link(t('Read the guide', 'Leer la guía'), blog),
      secondaryLink: null,
    },
    {
      id: 10,
      __component: 'section.post-list',
      variant: 'cards',
      title: t('From the garden', 'Desde la huerta'),
      category: { id: 21, documentId: 'cat-software', slug: 'software' },
      tag: null,
      count: 3,
    },
    {
      id: 11,
      __component: 'section.newsletter',
      variant: 'card',
      title: t('Notes by email', 'Notas por correo'),
      text: t('One email per season.', 'Un correo por temporada.'),
      buttonLabel: t('Subscribe', 'Suscribirme'),
    },
    {
      id: 12,
      __component: 'section.rich-text',
      body: t('## About this page\n\nEvery section appears once.', '## Sobre esta página\n\nCada sección aparece una vez.'),
    },
    {
      id: 13,
      __component: 'section.gallery',
      variant: 'grid',
      title: t('Through the year', 'A lo largo del año'),
      images: [media(104, 'balcony.png'), media(108, 'summer.png'), media(109, 'autumn.png')],
    },
    {
      id: 14,
      __component: 'section.scene',
      variant: 'inline',
      model: media(110, 'triangle.glb', { mime: 'model/gltf-binary', width: null, height: null }),
      poster: media(111, 'triangle-poster.png'),
      alt: t('A green triangle', 'Un triángulo verde'),
      title: t('A scene', 'Una escena'),
      text: null,
    },
  ]
}

function showcase(es, landing = false) {
  return {
    id: es ? 2 : 1,
    documentId: 'page-showcase',
    title: es ? 'Muestra' : 'Showcase',
    slug: es ? 'muestra' : 'showcase',
    locale: es ? 'es' : 'en',
    publishedAt: '2026-10-01T10:00:00.000Z',
    seo: {
      id: 61,
      metaTitle: es ? 'Notas de campo' : 'Field Notes',
      metaDescription: es ? 'Una muestra de todas las secciones que puede usar una página de Micelio.' : 'A demo of every section a Micelio page can use.',
      metaImage: media(112, 'page-og.png'),
      metaSocial: [],
    },
    sections: showcaseSections(es, landing),
    localizations: [{ id: es ? 1 : 2, documentId: 'page-showcase', slug: es ? 'showcase' : 'muestra', locale: es ? 'en' : 'es' }],
  }
}

// An unknown component, an invalid section and a post list that matches no posts
const partial = {
  id: 3,
  documentId: 'page-partial',
  title: 'Partial',
  slug: 'partial',
  locale: 'en',
  seo: null,
  sections: [
    { id: 1, __component: 'section.hero', variant: 'centered', title: 'Kept', text: null, primaryLink: null, secondaryLink: null, media: null },
    { id: 2, __component: 'section.carousel', title: 'Unknown to this frontend' },
    { id: 3, __component: 'section.cta', variant: 'banner', title: null },
    { id: 4, __component: 'section.post-list', variant: 'list', title: null, category: { id: 99, slug: 'nothing-here' }, tag: null, count: 3 },
  ],
  localizations: [],
}

// Six post lists: only the first four are resolved
const manyLists = {
  id: 4,
  documentId: 'page-many-lists',
  title: 'Many lists',
  slug: 'many-lists',
  locale: 'en',
  seo: null,
  sections: Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    __component: 'section.post-list',
    variant: 'cards',
    title: `List ${index + 1}`,
    category: { id: 21, slug: 'software' },
    tag: null,
    count: 2,
  })),
  localizations: [],
}

// A textured scene that opens the page: its poster is the LCP element, and its model carries an image (e2e/scene)
const sceneHero = {
  id: 5,
  documentId: 'page-scene-hero',
  title: 'Scene hero',
  slug: 'scene-hero',
  locale: 'en',
  seo: null,
  sections: [
    {
      id: 1,
      __component: 'section.scene',
      variant: 'background',
      model: media(210, 'textured.glb', { mime: 'model/gltf-binary', width: null, height: null }),
      poster: media(211, 'triangle-poster.png', { width: 1600, height: 900 }),
      alt: 'A green triangle',
      title: 'A hero scene',
      text: 'Drawn behind this text.',
    },
    { id: 2, __component: 'section.rich-text', body: '## After the scene\n\nText below.' },
  ],
  localizations: [],
}

// One section for each value of each option on each block that exposes it, and a plain twin of each block, for the table of
// e2e/theme/block-values.spec.ts: the title of a section is its key, "<block> <option>=<value>", and the twin's "<block> plain"
const items = names => names.map((title, index) => ({ id: index + 1, icon: null, title, text: `Item ${title}` }))
const logos = [1, 2, 3, 4, 5, 6].map(id => ({ id, image: media(105 + id, 'logo-circle.svg', { mime: 'image/svg+xml', width: 120, height: 40 }), name: `Logo ${id}`, url: null }))
const valueBlocks = {
  'hero-split': (title, o) => ({ __component: 'section.hero', variant: 'split', title, text: 'Text of the hero, longer than its title so that the head is as wide as the text.', primaryLink: link('Go', '/'), secondaryLink: null, media: media(301, 'hero.png'), ...o }),
  'hero-centered': (title, o) => ({ __component: 'section.hero', variant: 'centered', title, text: 'Text of the hero, longer than its title so that the head is as wide as the text.', primaryLink: link('Go', '/'), secondaryLink: null, media: media(301, 'hero.png'), ...o }),
  'feature-grid': (title, o) => ({ __component: 'section.feature-grid', variant: 'grid', title, text: null, items: items(['A', 'B', 'C', 'D', 'E', 'F']), ...o }),
  'showcase': (title, o) => ({ __component: 'section.media-showcase', variant: 'stacked', title, text: null, media: media(300, 'balcony.png'), link: null, ...o }),
  'stats': (title, o) => ({ __component: 'section.stats', variant: 'row', title, items: ['A', 'B', 'C', 'D', 'E', 'F'].map((label, index) => ({ id: index + 1, value: String(index + 1), label })), ...o }),
  'logo-cloud': (title, o) => ({ __component: 'section.logo-cloud', variant: 'row', title, logos, ...o }),
  'testimonials': (title, o) => ({ __component: 'section.testimonials', variant: 'grid', title, items: ['A', 'B', 'C'].map((author, index) => ({ id: index + 1, quote: `Quote ${author}`, author, role: null, avatar: null })), ...o }),
  'pricing': (title, o) => ({ __component: 'section.pricing', variant: 'cards', title, text: null, plans: ['A', 'B', 'C', 'D'].map((name, index) => ({ id: index + 1, name, price: '$5', period: null, features: 'One\nTwo', recommended: false, link: null })), ...o }),
  'faq': (title, o) => ({ __component: 'section.faq', variant: 'list', title, items: [{ id: 1, question: 'Why?', answer: 'Because.' }], ...o }),
  'cta-card': (title, o) => ({ __component: 'section.cta', variant: 'card', title, text: 'Text of the call.', primaryLink: link('Go', '/'), secondaryLink: null, ...o }),
  'cta-banner': (title, o) => ({ __component: 'section.cta', variant: 'banner', title, text: 'Text of the call.', primaryLink: link('Go', '/'), secondaryLink: null, ...o }),
  'post-list': (title, o) => ({ __component: 'section.post-list', variant: 'cards', title, category: { id: 21, documentId: 'cat-software', slug: 'software' }, tag: null, count: 2, ...o }),
  'newsletter': (title, o) => ({ __component: 'section.newsletter', variant: 'card', title, text: 'Text of the form.', buttonLabel: 'Subscribe', ...o }),
  'newsletter-inline': (title, o) => ({ __component: 'section.newsletter', variant: 'inline', title, text: 'Text of the form.', buttonLabel: 'Subscribe', ...o }),
  'rich-text': (title, o) => ({ __component: 'section.rich-text', body: `## ${title}\n\nA paragraph of text.`, ...o }),
  'gallery': (title, o) => ({ __component: 'section.gallery', variant: 'grid', title, images: [media(104, 'balcony.png'), media(108, 'summer.png')], ...o }),
  'scene-inline': (title, o) => ({ __component: 'section.scene', variant: 'inline', title, text: null, model: media(210, 'triangle.glb', { mime: 'model/gltf-binary', width: null, height: null }), poster: media(211, 'triangle-poster.png', { width: 1600, height: 900 }), alt: 'A green triangle', ...o }),
  'scene-background': (title, o) => ({ __component: 'section.scene', variant: 'background', title, text: 'Drawn behind this text.', model: media(210, 'triangle.glb', { mime: 'model/gltf-binary', width: null, height: null }), poster: media(211, 'triangle-poster.png', { width: 1600, height: 900 }), alt: 'A green triangle', ...o }),
}
/** The slug of the second page of the table; a case with no page is on `block-options`. */
export const LISTS_PAGE = 'block-options-lists'

/** The cases of the table: the block, and the options it takes (none is the plain twin). Every value of every option of every block appears once. */
export const blockValueCases = [
  ['hero-split', {}], ['hero-split', { layout: 'stacked' }], ['hero-split', { layout: 'split' }], ['hero-split', { tone: 'raised' }], ['hero-split', { tone: 'accent' }],
  ['hero-split', { height: 's' }], ['hero-split', { height: 'l' }], ['hero-split', { height: 'full' }], ['hero-split', { align: 'center' }],
  ['hero-centered', {}], ['hero-centered', { layout: 'stacked' }], ['hero-centered', { layout: 'split' }],
  ['feature-grid', {}], ['feature-grid', { columns: '2' }], ['feature-grid', { columns: '4' }], ['feature-grid', { density: 'compact' }], ['feature-grid', { align: 'center' }], ['feature-grid', { tone: 'raised' }], ['feature-grid', { tone: 'accent' }],
  ['showcase', {}], ['showcase', { ratio: '4:3' }], ['showcase', { ratio: '1:1' }], ['showcase', { ratio: 'auto' }], ['showcase', { align: 'center' }], ['showcase', { tone: 'raised' }], ['showcase', { tone: 'accent' }],
  ['stats', {}], ['stats', { columns: '2' }], ['stats', { columns: '4' }], ['stats', { align: 'center' }], ['stats', { tone: 'raised' }], ['stats', { tone: 'accent' }],
  ['logo-cloud', {}], ['logo-cloud', { columns: '2' }], ['logo-cloud', { columns: '4' }], ['logo-cloud', { columns: '6' }], ['logo-cloud', { density: 'compact' }], ['logo-cloud', { align: 'center' }], ['logo-cloud', { tone: 'raised' }], ['logo-cloud', { tone: 'accent' }],
  ['testimonials', {}], ['testimonials', { layout: 'stacked' }], ['testimonials', { layout: 'split' }], ['testimonials', { density: 'compact' }], ['testimonials', { align: 'center' }], ['testimonials', { tone: 'raised' }], ['testimonials', { tone: 'accent' }],
  ['pricing', {}], ['pricing', { columns: '2' }], ['pricing', { columns: '4' }], ['pricing', { align: 'center' }], ['pricing', { tone: 'raised' }], ['pricing', { tone: 'accent' }],
  ['faq', {}], ['faq', { density: 'compact' }], ['faq', { align: 'center' }], ['faq', { tone: 'raised' }], ['faq', { tone: 'accent' }],
  ['cta-card', {}], ['cta-card', { layout: 'stacked' }], ['cta-card', { layout: 'split' }], ['cta-card', { align: 'center' }], ['cta-card', { tone: 'raised' }], ['cta-card', { tone: 'accent' }],
  ['cta-banner', {}], ['cta-banner', { align: 'center' }], ['cta-banner', { tone: 'raised' }], ['cta-banner', { tone: 'accent' }],
  ['post-list', {}], ['post-list', { density: 'compact' }],
  ['newsletter-inline', {}], ['newsletter-inline', { align: 'center' }], ['newsletter-inline', { tone: 'raised' }], ['newsletter-inline', { tone: 'accent' }],
  ['newsletter', {}], ['newsletter', { align: 'center' }], ['newsletter', { tone: 'raised' }], ['newsletter', { tone: 'accent' }],
  ['rich-text', {}], ['rich-text', { width: 'wide' }], ['rich-text', { width: 'full' }], ['rich-text', { align: 'center' }], ['rich-text', { tone: 'raised' }], ['rich-text', { tone: 'accent' }],
  ['gallery', {}], ['gallery', { width: 'wide' }], ['gallery', { width: 'full' }], ['gallery', { density: 'compact' }], ['gallery', { align: 'center' }], ['gallery', { tone: 'raised' }], ['gallery', { tone: 'accent' }],
  ['scene-inline', {}], ['scene-inline', { height: 's' }], ['scene-inline', { height: 'l' }], ['scene-inline', { height: 'full' }], ['scene-inline', { align: 'center' }], ['scene-inline', { tone: 'raised' }], ['scene-inline', { tone: 'accent' }],
  ['scene-background', {}], ['scene-background', { height: 's' }], ['scene-background', { height: 'l' }], ['scene-background', { height: 'full' }],
  // A page resolves the posts of its first four post lists only (MAX_POST_LISTS of server/utils/pageSections.ts): the rest of the post list's values have a page of their own, with their own plain twin
  ['post-list', {}, false, LISTS_PAGE], ['post-list', { align: 'center' }, false, LISTS_PAGE], ['post-list', { tone: 'raised' }, false, LISTS_PAGE], ['post-list', { tone: 'accent' }, false, LISTS_PAGE],
  // The default value of each option, stored as Strapi stores it: it must look like the plain twin
  ['hero-split', { layout: 'centered', tone: 'default', height: 'm' }, true], ['feature-grid', { columns: '3', density: 'comfortable' }, true], ['showcase', { ratio: '16:9' }, true],
  ['stats', { columns: '3', align: 'start', tone: 'default' }, true], ['logo-cloud', { columns: '3', density: 'comfortable' }, true], ['testimonials', { layout: 'centered', density: 'comfortable' }, true],
  ['pricing', { columns: '3' }, true], ['faq', { density: 'comfortable' }, true], ['cta-card', { layout: 'centered', align: 'start', tone: 'default' }, true],
  ['post-list', { density: 'comfortable' }, true], ['newsletter', { align: 'start', tone: 'default' }, true], ['rich-text', { width: 'prose' }, true], ['gallery', { width: 'prose', density: 'comfortable' }, true],
  ['scene-inline', { height: 'm' }, true], ['scene-background', { height: 'm' }, true],
]

/** The key of a case, the section's title: "<block> <option>=<value>", "<block> plain" for the twin and "<block> saved" for the default values stored (as long as "plain"). */
export function blockValueKey(block, options, saved = false) {
  if (saved) return `${block} saved`
  const pairs = Object.entries(options).map(([name, value]) => `${name}=${value}`)
  return `${block} ${pairs.length ? pairs.join(' ') : 'plain'}`
}

const valueSections = (slug = 'block-options') => blockValueCases
  .map(([block, options, saved = false, page = 'block-options'], index) => ({ block, options, saved, page, index }))
  .filter(entry => entry.page === slug)
  .map(({ block, options, saved, index }) => ({ id: 100 + index, ...valueBlocks[block](blockValueKey(block, options, saved), options) }))

// The presentation options of the blocks (#731): a centered hero laid out as a split, grids of two and four columns, a compact one, a centered stats row on the accent
// tone, a card on the raised tone and a square showcase (e2e/theme/block-options.spec.ts); then one section for every value of every option (block-values.spec.ts)
const blockOptions = {
  id: 6,
  documentId: 'page-block-options',
  title: 'Block options',
  slug: 'block-options',
  locale: 'en',
  seo: null,
  sections: [
    {
      id: 7,
      __component: 'section.hero',
      variant: 'centered',
      title: 'Split hero',
      text: 'The layout option wins over the variant.',
      primaryLink: null,
      secondaryLink: null,
      media: media(301, 'hero.png'),
      layout: 'split',
    },
    {
      id: 1,
      __component: 'section.feature-grid',
      variant: 'grid',
      title: 'Two columns',
      text: null,
      columns: '2',
      items: ['One', 'Two', 'Three', 'Four'].map((title, index) => ({ id: index + 1, icon: null, title, text: `Item ${title}` })),
    },
    {
      id: 2,
      __component: 'section.feature-grid',
      variant: 'grid',
      title: 'Four columns, compact',
      text: null,
      columns: '4',
      density: 'compact',
      items: ['Five', 'Six', 'Seven', 'Eight'].map((title, index) => ({ id: index + 1, icon: null, title, text: `Item ${title}` })),
    },
    { id: 3, __component: 'section.feature-grid', variant: 'grid', title: 'No options', text: null, items: ['Nine', 'Ten'].map((title, index) => ({ id: index + 1, icon: null, title, text: null })) },
    {
      id: 4,
      __component: 'section.stats',
      variant: 'row',
      title: 'Accent and centered',
      align: 'center',
      tone: 'accent',
      columns: '3',
      items: [{ id: 1, value: '4 h', label: 'of sun' }, { id: 2, value: '12', label: 'pots' }, { id: 3, value: '3', label: 'seasons' }],
    },
    { id: 5, __component: 'section.cta', variant: 'card', title: 'Raised card', text: null, primaryLink: null, secondaryLink: null, tone: 'raised', layout: 'stacked' },
    {
      id: 6,
      __component: 'section.media-showcase',
      variant: 'stacked',
      title: 'Square media',
      text: null,
      media: media(300, 'balcony.png', { width: 1200, height: 630 }),
      link: null,
      ratio: '1:1',
    },
    // A stored default must look like the block with no option (the plugin fills the default in on a new entry): each stored block has a twin with none
    { id: 8, __component: 'section.hero', variant: 'split', title: 'Stored hero', text: 'Same text.', primaryLink: null, secondaryLink: null, media: null, layout: 'centered', height: 'm' },
    { id: 9, __component: 'section.hero', variant: 'split', title: 'Plain hero', text: 'Same text.', primaryLink: null, secondaryLink: null, media: null },
    { id: 10, __component: 'section.hero', variant: 'split', title: 'Tall hero', text: 'Same text.', primaryLink: null, secondaryLink: null, media: null, height: 'l' },
    { id: 11, __component: 'section.gallery', variant: 'grid', title: 'Stored gallery', images: [media(104, 'balcony.png'), media(108, 'summer.png')], width: 'prose', density: 'comfortable' },
    { id: 12, __component: 'section.gallery', variant: 'grid', title: 'Plain gallery', images: [media(104, 'balcony.png'), media(108, 'summer.png')] },
    { id: 13, __component: 'section.gallery', variant: 'grid', title: 'Full gallery', images: [media(104, 'balcony.png'), media(108, 'summer.png')], width: 'full' },
    { id: 14, __component: 'section.feature-grid', variant: 'grid', title: 'Stored grid', text: null, columns: '3', items: ['A', 'B'].map((title, index) => ({ id: index + 1, icon: null, title, text: `Item ${title}` })) },
    { id: 15, __component: 'section.feature-grid', variant: 'grid', title: 'Plain grid', text: null, items: ['A', 'B'].map((title, index) => ({ id: index + 1, icon: null, title, text: `Item ${title}` })) },
    { id: 16, __component: 'section.media-showcase', variant: 'stacked', title: 'Stored showcase', text: null, media: media(300, 'balcony.png', { width: 1200, height: 630 }), link: null, ratio: '16:9' },
    { id: 17, __component: 'section.media-showcase', variant: 'stacked', title: 'Plain showcase', text: null, media: media(300, 'balcony.png', { width: 1200, height: 630 }), link: null },
    {
      id: 18,
      __component: 'section.logo-cloud',
      variant: 'row',
      title: 'Six logos',
      columns: '6',
      logos: [1, 2, 3, 4, 5, 6].map(id => ({ id, image: media(105 + id, 'logo-circle.svg', { mime: 'image/svg+xml', width: 120, height: 40 }), name: `Logo ${id}`, url: null })),
    },
    ...valueSections(),
  ],
  localizations: [],
}

// The post lists of the table, past the four a page resolves
const blockOptionsLists = { id: 7, documentId: 'page-block-options-lists', title: 'Block options, post lists', slug: LISTS_PAGE, locale: 'en', seo: null, sections: valueSections(LISTS_PAGE), localizations: [] }

// The ids the CMS gives every block and repeatable item (./ids.mjs): the zone of a page is named by its locale and slug
const withBlockIds = page => ({ ...page, sections: withIds(page.sections, page.slug) })

/** Mutable: a test may publish a page after a first miss. */
export const pageFixtures = [showcase(false), showcase(true), partial, manyLists, sceneHero, blockOptions, blockOptionsLists].map(withBlockIds)

// What replaces the showcase pages when there are no articles
const landingShowcases = [showcase(false, true), showcase(true, true)].map(withBlockIds)

/** Answers GET /api/pages like Strapi: the slug and locale filters, always fully populated. */
export function findPages(query, getNestedValue) {
  const slug = getNestedValue(query, ['filters', 'slug', '$eq'])
  const locale = query.locale
  if (slug === 'broken-page') {
    return { status: 500, body: { data: null, error: { status: 500, name: 'InternalServerError', message: 'Internal Server Error' } } }
  }
  const pool = process.env.MOCK_NO_ARTICLES === '1' ? pageFixtures.map(page => landingShowcases.find(landing => landing.id === page.id) ?? page) : pageFixtures
  const data = pool.filter(page => (!slug || page.slug === slug) && (!locale || page.locale === locale))
  // Without a slug it lists (the static build reads every page); with one, the first match
  const pageSize = slug ? 1 : Number(getNestedValue(query, ['pagination', 'pageSize']) ?? 25)
  const page = Number(getNestedValue(query, ['pagination', 'page']) ?? 1)
  const start = slug ? 0 : (page - 1) * pageSize
  return { status: 200, body: { data: data.slice(start, start + pageSize), meta: { pagination: { page, pageSize, pageCount: slug ? data.length : Math.ceil(data.length / pageSize), total: data.length } } } }
}
