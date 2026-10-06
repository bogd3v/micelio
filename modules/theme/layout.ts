import type { ThemeContext } from './context'
import { registerVariants } from './layout/variants'

// The variant check itself is part of the contract (contract.ts)
export function setupLayout(ctx: ThemeContext): void {
  registerVariants(ctx)
}
