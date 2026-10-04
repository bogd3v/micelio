export default defineAppConfig({
  site: {
    name: 'BogDev',
    description: 'Personal blog about AI, Software, Linux and more',
    url: 'https://bogdev.com.co',
    author: {
      name: 'Alejandro Ramírez',
      url: 'https://bogdev.com.co/about',
    },
    favicon: { url: '/bogdev.svg' },
    // In footer order; the X link only feeds twitter:site
    socialLinks: [
      { network: 'linkedin', url: 'https://www.linkedin.com/in/alejandro-ramirez-garcia-046713139' },
      { network: 'github', url: 'https://github.com/ale9420' },
      { network: 'codeberg', url: 'https://codeberg.org/alejo9420' },
      { network: 'mastodon', url: 'https://mastodon.social/@bogdev' },
      { network: 'x', url: 'https://x.com/devbog' },
    ],
    comments: {
      provider: 'strapi',
    },
    support: {
      buyMeACoffee: 'ale9420',
    },
    privacy: {
      contactEmail: 'gx_alejandro@hotmail.com',
      updatedAt: '2026-10-01T12:00:00-05:00',
    },
  },
})
