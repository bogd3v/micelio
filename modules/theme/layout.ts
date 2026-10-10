import type { ThemeContext } from './types'
import { registerAlternates, registerVariants } from './layout/variants'
import { specimenEnabled } from './specimen/setup'

// The variant check itself is part of the contract (contract.ts)
/**
 * Registers the layout variant of each region the active theme uses, and the other variants on the specimen.
 *
 * @remarks
 * Runs in the module setup, at build time. The variants are added to the context: their components through
 * `registerVariants`, and their CSS for the region templates. The alternates come only when `specimenEnabled` is true, so
 * no other build bundles them.
 */
export function setupLayout(ctx: ThemeContext): void {
  registerVariants(ctx)
  // /_theme shows the variants the theme does not use; no other build bundles them
  if (specimenEnabled(ctx)) registerAlternates(ctx)
}
