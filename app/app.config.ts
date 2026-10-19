// Neutral fallback: the site's own values come from the CMS site settings (docs/api.md, site settings)
export default defineAppConfig({
  site: {
    name: 'Micelio',
    description: '',
    url: '',
    // IANA name; the CMS site setting `timezone` replaces it
    timezone: 'UTC',
    author: {
      name: '',
      url: '',
    },
    // In footer order; the X link only feeds twitter:site
    socialLinks: [],
    comments: {
      provider: 'strapi',
    },
    support: {
      buyMeACoffee: '',
    },
    privacy: {
      contactEmail: '',
      updatedAt: '',
    },
  },
})
