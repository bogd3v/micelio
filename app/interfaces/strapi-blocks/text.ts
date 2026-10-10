export interface StrapiRichText {
  id: number
  __component: 'shared.rich-text'
  body: string
  html?: string
}

export interface StrapiQuote {
  id: number
  __component: 'shared.quote'
  body: string
  html?: string
  title?: string
}

export type StrapiPlaygroundRuntime = 'python' | 'sql' | 'javascript'

export interface StrapiPlayground {
  id: number
  __component: 'shared.playground'
  runtime: StrapiPlaygroundRuntime | string
  code: string
  expectedOutput?: string | null
  /** Hidden code that runs before `code`; never rendered */
  setup?: string | null
  caption?: string | null
}
