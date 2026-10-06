export type RoleGroup = 'color' | 'shadow' | 'spacing' | 'radius' | 'size' | 'motion'
export const REQUIRED_ROLES: Record<RoleGroup, string[]>
export const OPTIONAL_ROLES: { color: Record<string, string>, shadow: Record<string, string> }
export const ROLE_PURPOSES: Record<string, string>
export const UNSAFE_VALUE: RegExp
export const QUOTED_VALUE: RegExp
export const TYPE_FAMILIES: string[]
export const TYPE_STEPS: string[]
export const COLOR_ROLES: string[]
