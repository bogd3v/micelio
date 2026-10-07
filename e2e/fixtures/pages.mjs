// Strapi `page` fixtures shared by both mocks; they mirror the CMS seed's showcase page (en `showcase`, es `muestra`)

function media(id, name, extra = {}) {
  return { id, documentId: `media-${id}`, url: `/uploads/${name}`, alternativeText: name, width: 1200, height: 630, mime: 'image/png', ...extra }
}

function link(label, url) {
  return { id: 1, label, url }
}

function showcaseSections(es) {
  const t = (en, spanish) => (es ? spanish : en)
  const blog = es ? '/es/blog' : '/blog'
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
      link: link(t('How to start', 'Cómo empezar'), `${blog}/${t('starting-a-balcony-garden', 'empezar-una-huerta-en-el-balcon')}`),
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

function showcase(es) {
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
    sections: showcaseSections(es),
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

/** Mutable: a test may publish a page after a first miss. */
export const pageFixtures = [showcase(false), showcase(true), partial, manyLists]

/** Answers GET /api/pages like Strapi: the slug and locale filters, always fully populated. */
export function findPages(query, getNestedValue) {
  const slug = getNestedValue(query, ['filters', 'slug', '$eq'])
  const locale = query.locale
  if (slug === 'broken-page') {
    return { status: 500, body: { data: null, error: { status: 500, name: 'InternalServerError', message: 'Internal Server Error' } } }
  }
  const data = pageFixtures.filter(page => (!slug || page.slug === slug) && (!locale || page.locale === locale))
  // Without a slug it lists (the static build reads every page); with one, the first match
  const pageSize = slug ? 1 : Number(getNestedValue(query, ['pagination', 'pageSize']) ?? 25)
  const page = Number(getNestedValue(query, ['pagination', 'page']) ?? 1)
  const start = slug ? 0 : (page - 1) * pageSize
  return { status: 200, body: { data: data.slice(start, start + pageSize), meta: { pagination: { page, pageSize, pageCount: slug ? data.length : Math.ceil(data.length / pageSize), total: data.length } } } }
}
