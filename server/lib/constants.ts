/** Headers an in-process (SSR) call carries so the real visitor survives the hop. Never leave the process. */
export const INTERNAL_IP_HEADER = 'x-micelio-internal-ip'
export const INTERNAL_NONCE_HEADER = 'x-micelio-internal-nonce'

/** The auth calls may send mail inside Strapi (register, password reset), so they wait longer than a read. */
export const AUTH_TIMEOUT_MS = 30_000
