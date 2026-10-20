import { fork } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { INSTALL_HEAP_MB, INSTALL_LEASE_MS } from './constants'
import { InstallError } from './error'
import type { InstallSubject } from './error'
import type { InstallOptions, InstallResult, InstallRule, InstallSource } from './types'

/** What the worker sends back: the result with the child's peak memory, or the failure in pieces so the parent rebuilds the `InstallError`. */
export type WorkerReply
  = | { ok: true, result: InstallResult, maxRssKb: number }
    | { ok: false, rule: InstallRule, subject: InstallSubject, detail: string }

/** Limits of one isolated install. */
export interface IsolationLimits {
  /**
   * Milliseconds before the process is killed with `SIGKILL`.
   *
   * @defaultValue 60000
   */
  timeoutMs?: number
  /**
   * Heap the process may use, in MiB (`--max-old-space-size`).
   *
   * @defaultValue 256
   */
  heapMb?: number
  /** The worker script; by default the one next to this file (a build that bundles the server provides its own). */
  worker?: string
}

let running: Promise<void> | undefined

/**
 * Runs `installTheme` in a child process with a heap cap and a wall-clock timeout, at most one at a time (ADR 0009, section 2).
 *
 * @remarks
 * Lightning CSS is native, so neither a `worker_thread` memory limit nor `terminate()` can stop it; a process can be killed. The
 * child gets an empty environment and talks over IPC only. A caller that asks while another install runs waits its turn.
 *
 * @throws `InstallError` of the install, or (`compile`) when the process ran out of memory, exited early or hit the timeout.
 */
export async function installIsolated(source: InstallSource, options: InstallOptions, limits: IsolationLimits = {}): Promise<InstallResult & { maxRssKb: number }> {
  while (running) await running
  let release!: () => void
  running = new Promise<void>((resolve) => {
    release = resolve
  })
  try {
    return await runChild(source, options, limits)
  } finally {
    running = undefined
    release()
  }
}

function runChild(source: InstallSource, options: InstallOptions, limits: IsolationLimits): Promise<InstallResult & { maxRssKb: number }> {
  const { timeoutMs = INSTALL_LEASE_MS, heapMb = INSTALL_HEAP_MB } = limits
  // A TypeScript worker (tests, dev) loads through jiti; a built server ships worker.mjs
  const script = limits.worker ?? fileURLToPath(new URL(import.meta.url.endsWith('.ts') ? './worker.ts' : './worker.mjs', import.meta.url))
  const execArgv = [`--max-old-space-size=${heapMb}`, ...(script.endsWith('.ts') ? ['--import', pathToFileURL(join(dirname(createRequire(import.meta.url).resolve('jiti')), 'jiti-register.mjs')).href] : [])]
  const subject = source.kind === 'package' ? { id: source.pin.id, version: source.pin.version, digest: source.pin.digest } : {}
  return new Promise((resolve, reject) => {
    const child = fork(script, [], { execArgv, env: {}, serialization: 'advanced', stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
    let settled = false
    const finish = (settle: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.kill('SIGKILL')
      settle()
    }
    const timer = setTimeout(() => finish(() => reject(new InstallError('compile', subject, `the install ran past ${timeoutMs} ms and was stopped`))), timeoutMs)
    child.once('message', (reply: WorkerReply) => finish(() => {
      if (reply.ok) resolve({ ...reply.result, maxRssKb: reply.maxRssKb })
      else reject(new InstallError(reply.rule, reply.subject, reply.detail))
    }))
    child.once('error', error => finish(() => reject(new InstallError('compile', subject, 'the install process could not start', { cause: error }))))
    child.once('exit', code => finish(() => reject(new InstallError('compile', subject, `the install process stopped before it answered (exit ${String(code)}); it may have run out of memory`))))
    child.send({ source, options })
  })
}
