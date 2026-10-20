import { pinProblem } from '../registry/pin'
import type { ThemePin } from '../registry/types'
import { InstallError } from './error'
import { installedEntry } from './install'
import { installIsolated } from './isolated'
import type { IsolationLimits } from './isolated'
import { readKeptPackage } from './store'
import type { InstallOptions } from './types'

/** What happened to one pin at boot: it already had an entry for this core, was compiled again, had no kept package, or failed. */
export interface RecompileOutcome {
  pin: ThemePin
  status: 'current' | 'recompiled' | 'missing' | 'failed'
  /** Why it failed, without a file system path. */
  error?: string
}

/**
 * Compiles again, for this core build, the themes a deployment store holds from their kept packages (ADR 0009, section 2).
 *
 * @remarks
 * Run at boot for the active and last good themes, before readiness reports ready, one pin after another. It never reaches a
 * registry: the package and its attestation bundle come from the store, and the bundle is verified again by `verify` when given.
 * It never throws: a pin that cannot be recompiled is reported, and the caller decides what stays active.
 *
 * @param verify - Verifies a kept attestation bundle offline; it throws to refuse.
 */
export async function recompileStored(pins: ThemePin[], options: InstallOptions, limits: IsolationLimits = {}, verify?: (bundle: Uint8Array) => void): Promise<RecompileOutcome[]> {
  const outcomes: RecompileOutcome[] = []
  for (const pin of pins) {
    const outcome = (status: RecompileOutcome['status'], error?: string): void => {
      outcomes.push(error === undefined ? { pin, status } : { pin, status, error })
    }
    if (pinProblem(pin) !== null) {
      outcome('failed', 'invalid pin')
      continue
    }
    try {
      if (await installedEntry(options.storeDir, pin, options.coreBuild, verify) !== null) {
        outcome('current')
        continue
      }
      const kept = await readKeptPackage(options.storeDir, pin.digest)
      if (kept === null) {
        outcome('missing')
        continue
      }
      if (verify) {
        if (kept.attestation === null) throw new InstallError('integrity', pin, 'the kept package has no attestation bundle')
        verify(kept.attestation)
      }
      await installIsolated({ kind: 'package', data: kept.tgz, pin, ...(kept.attestation ? { attestation: kept.attestation } : {}) }, options, limits)
      outcome('recompiled')
    } catch (error) {
      outcome('failed', error instanceof InstallError ? error.message : 'the attestation of the kept package did not verify')
    }
  }
  return outcomes
}
