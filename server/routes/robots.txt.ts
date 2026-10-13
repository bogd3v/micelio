export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')

  return `User-agent: *
Allow: /

Sitemap: ${config.public.siteUrl}/sitemap.xml`
})
