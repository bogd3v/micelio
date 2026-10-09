import type { ThemeContext } from './types'
import { registerAlternates, registerVariants } from './layout/variants'
import { specimenEnabled } from './specimen/setup'

// The variant check itself is part of the contract (contract.ts)
export function setupLayout(ctx: ThemeContext): void {
  registerVariants(ctx)
  // /_theme shows the variants the theme does not use; no other build bundles them
  if (specimenEnabled(ctx)) registerAlternates(ctx)
}
