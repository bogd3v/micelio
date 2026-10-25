const [first, second, ...rest] = process.argv.slice(2)
const paths = rest.length ? rest : ['/', '/es', '/blog', '/about', '/privacy', '/account/sign-in', '/feed.xml', '/sitemap.xml', '/api/posts', '/api/tags', '/api/categories']

if (!first || !second) {
  console.log('usage: compare-html.mjs <baseUrlA> <baseUrlB> [paths...]')
  process.exit(1)
}

function normalize(text) {
  return text
    .replace(/\/_nuxt\/[\w.-]+/g, '/_nuxt/X')
    // The theme store digest depends on the core build (ADR 0009), so two builds never share it
    .replace(/\/_t\/[0-9a-f]{64}\//g, '/_t/D/')
    .replace(/'sha256-[^']+'/g, '\'sha256-X\'')
    .replace(/"?buildId"?:"[^"]+"/g, 'buildId')
    .replace(/\d{13}/g, 'TIMESTAMP')
    .replace(/data-v-[0-9a-f]{8}/g, 'data-v-X')
    .replace(/<lastBuildDate>[^<]+<\/lastBuildDate>/g, '')
    .replace(/(<script[^>]*data-nuxt-data[^>]*>)[\s\S]*?<\/script>/g, '$1PAYLOAD</script>')
}

let identical = 0
for (const path of paths) {
  const [a, b] = await Promise.all([first, second].map(async base => normalize(await (await fetch(base + path)).text())))
  if (a === b) {
    identical++
    console.log(`same  ${path}`)
    continue
  }
  const index = [...a].findIndex((char, position) => char !== b[position])
  const at = index === -1 ? Math.min(a.length, b.length) : index
  console.log(`DIFF  ${path}\n  A: ${a.slice(Math.max(0, at - 80), at + 80)}\n  B: ${b.slice(Math.max(0, at - 80), at + 80)}`)
}
console.log(`${identical}/${paths.length} identical`)
