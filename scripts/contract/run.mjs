#!/usr/bin/env node
// Runs the contract suite (e2e/contract/) against a real CMS: the demo image of micelio-cms with Postgres, started here and removed
// afterwards. Needs Docker and `npm run build` first. Extra arguments go to Playwright.
//
//   npm run test:contract
//   CONTRACT_CMS_IMAGE=ghcr.io/bogd3v/micelio-cms:edge npm run test:contract
//   CONTRACT_CMS_URL=http://127.0.0.1:1337 CONTRACT_STRAPI_TOKEN=... npm run test:contract   (a CMS that is already running)
//
// Environment: CONTRACT_CMS_IMAGE (default ghcr.io/bogd3v/micelio-cms:latest, pinned by digest and printed), CONTRACT_POSTGRES_IMAGE
// (default postgres:18-alpine), CONTRACT_CMS_PORT (default 1347), CONTRACT_APP_PORT (default 3270), CONTRACT_KEEP=1 (leave the CMS
// running to inspect it; the run prints its URL, token and how to remove it).
import { execFileSync, spawn } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { cmsEnvironment, digestFrom, pinnedImage, secret } from './lib.mjs'

const CMS_IMAGE = process.env.CONTRACT_CMS_IMAGE ?? 'ghcr.io/bogd3v/micelio-cms:latest'
const POSTGRES_IMAGE = process.env.CONTRACT_POSTGRES_IMAGE ?? 'postgres:18-alpine'
const CMS_PORT = process.env.CONTRACT_CMS_PORT ?? '1347'
const APP_PORT = process.env.CONTRACT_APP_PORT ?? '3270'
const READY_TIMEOUT_MS = 240_000
const suffix = String(process.pid)
const names = { network: `micelio-contract-${suffix}`, database: `micelio-contract-db-${suffix}`, cms: `micelio-contract-cms-${suffix}` }

function docker(args, options = {}) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options })
}

/** The image by digest, so the run says which CMS it used; a local image has none and is used as it is */
function resolveCmsImage(ref) {
  if (ref.includes('@sha256:')) return ref
  try {
    const digest = digestFrom(docker(['buildx', 'imagetools', 'inspect', ref]))
    if (digest) return pinnedImage(ref, digest)
  } catch (error) {
    console.warn(`contract: ${ref} has no registry digest (${error.message.split('\n')[0]}); using it as it is`)
  }
  return ref
}

async function waitFor(description, check) {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await check()) return
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  throw new Error(`${description} was not ready after ${READY_TIMEOUT_MS / 1000} s`)
}

/** Runs a Docker command and says whether it succeeded: what it reports back is the answer, not an error to handle */
function succeeds(args) {
  try {
    docker(args)
    return true
  } catch {
    return false
  }
}

function teardown() {
  // A container or network that is already gone is what teardown wants
  for (const name of [names.cms, names.database]) succeeds(['rm', '-f', name])
  succeeds(['network', 'rm', names.network])
}

async function startCms() {
  const image = resolveCmsImage(CMS_IMAGE)
  console.log(`contract: CMS image ${image}`)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Contract suite ran against the CMS image \`${image}\`\n`)
  const databasePassword = secret()
  const frontendToken = secret(48)
  const cmsUrl = `http://127.0.0.1:${CMS_PORT}`
  docker(['network', 'create', names.network])
  docker(['run', '-d', '--name', names.database, '--network', names.network, '-e', 'POSTGRES_DB=strapi', '-e', 'POSTGRES_USER=strapi', '-e', `POSTGRES_PASSWORD=${databasePassword}`, POSTGRES_IMAGE])
  await waitFor('Postgres', () => succeeds(['exec', names.database, 'pg_isready', '-U', 'strapi', '-d', 'strapi']))
  const environment = cmsEnvironment({ databaseHost: names.database, databasePassword, frontendToken, cmsUrl, frontendUrl: `http://127.0.0.1:${APP_PORT}` })
  const flags = Object.entries(environment).flatMap(([key, value]) => ['-e', `${key}=${value}`])
  docker(['run', '-d', '--name', names.cms, '--network', names.network, '-p', `127.0.0.1:${CMS_PORT}:1337`, ...flags, image])
  await waitFor('the CMS', async () => {
    if (docker(['inspect', '-f', '{{.State.Running}}', names.cms]).trim() !== 'true') throw new Error(`the CMS container stopped:\n${docker(['logs', '--tail', '30', names.cms])}`)
    try {
      return (await fetch(`${cmsUrl}/_health`)).status === 204
    } catch {
      // Nothing listens until Strapi has booted
      return false
    }
  })
  return { url: cmsUrl, token: frontendToken }
}

function playwright(env) {
  return new Promise((resolve) => {
    const child = spawn('npx', ['playwright', 'test', '-c', 'playwright.contract.config.ts', ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, ...env } })
    child.on('exit', code => resolve(code ?? 1))
  })
}

async function main() {
  const external = process.env.CONTRACT_CMS_URL && process.env.CONTRACT_STRAPI_TOKEN
  let exitCode = 1
  let cmsInfo
  try {
    const cms = external ? { url: process.env.CONTRACT_CMS_URL, token: process.env.CONTRACT_STRAPI_TOKEN } : await startCms()
    cmsInfo = cms
    exitCode = await playwright({ CONTRACT_CMS_URL: cms.url, CONTRACT_STRAPI_TOKEN: cms.token, CONTRACT_APP_PORT: APP_PORT, CONTRACT_RECORD_FILE: process.env.CONTRACT_RECORD_FILE ?? 'test-results-contract/strapi-requests.jsonl' })
  } catch (error) {
    console.error(`contract: ${error.message}`)
  } finally {
    if (exitCode !== 0 && !external) {
      try {
        console.error(docker(['logs', '--tail', '40', names.cms]))
      } catch {
        // The CMS container was never created
      }
    }
    if (!external && process.env.CONTRACT_KEEP) {
      console.log(`contract: CMS left running at ${cmsInfo?.url} with token ${cmsInfo?.token}; remove it with: docker rm -f ${names.cms} ${names.database} && docker network rm ${names.network}`)
    } else if (!external) {
      teardown()
    }
  }
  process.exit(exitCode)
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    teardown()
    process.exit(130)
  })
}
await main()
