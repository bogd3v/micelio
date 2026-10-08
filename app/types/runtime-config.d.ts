// Not in nuxt.config.ts: a dynamic or static build would serialize the key for nothing
declare module 'nuxt/schema' {
  interface PublicRuntimeConfig {
    /** Set by modules/static-routes.ts in landing builds only; absent means the blog is on (`isBlogEnabled`) */
    blogEnabled?: boolean
  }
}

export {}
