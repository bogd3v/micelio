declare module '#app' {
  interface PageMeta {
    /** The page also opens for a request with a preview grant, not only for an editor session (`app/middleware/editor.ts`, ADR 0019). */
    previewGrant?: boolean
  }
}

export {}
