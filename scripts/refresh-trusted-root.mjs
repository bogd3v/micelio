// `node scripts/refresh-trusted-root.mjs <@sigstore/tuf version>`: refreshes modules/theme/registry/trusted_root.json from the TUF seeds that
// that exact `@sigstore/tuf` package ships (the Sigstore public-good trusted root). Run it for every Micelio release, review the diff, and
// commit it with the new `@sigstore/tuf` version in THIRD-PARTY.md. The file is data: it is never fetched at run time.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const target = fileURLToPath(new URL('../modules/theme/registry/trusted_root.json', import.meta.url))
const version = process.argv[2]
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  process.stderr.write('Usage: node scripts/refresh-trusted-root.mjs <@sigstore/tuf version, for example 5.0.0>\n')
  process.exit(1)
}
const temp = mkdtempSync(join(tmpdir(), 'micelio-trusted-root-'))

try {
  const tarball = execFileSync('npm', ['pack', `@sigstore/tuf@${version}`, '--silent', '--pack-destination', temp], { encoding: 'utf8' }).trim().split('\n').at(-1) ?? ''
  execFileSync('tar', ['xzf', join(temp, tarball), '-C', temp])
  const seeds = JSON.parse(readFileSync(join(temp, 'package', 'seeds.json'), 'utf8'))
  const root = JSON.parse(Buffer.from(seeds['https://tuf-repo-cdn.sigstore.dev'].targets['trusted_root.json'], 'base64').toString('utf8'))
  if (!Array.isArray(root.certificateAuthorities) || !Array.isArray(root.tlogs)) throw new Error('the seeds do not hold a trusted root')
  writeFileSync(target, `${JSON.stringify(root, null, 2)}\n`)
  process.stdout.write(`Wrote ${tarball.replace('.tgz', '')}'s trusted root to modules/theme/registry/trusted_root.json\n`)
} finally {
  rmSync(temp, { recursive: true, force: true })
}
