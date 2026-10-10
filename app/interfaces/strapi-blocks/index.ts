import type { StrapiMedia, StrapiSlider } from './media'
import type {
  StrapiContact,
  StrapiOpenSource,
  StrapiPrinciples,
  StrapiProfile,
  StrapiProjects,
  StrapiStatement,
  StrapiTopics,
} from './sections'
import type { StrapiPlayground, StrapiQuote, StrapiRichText } from './text'

export * from './media'
export * from './sections'
export * from './text'

/** Any block of a Strapi dynamic zone, discriminated by `__component`. */
export type StrapiBlock
  = | StrapiRichText
    | StrapiQuote
    | StrapiMedia
    | StrapiPlayground
    | StrapiSlider
    | StrapiProfile
    | StrapiStatement
    | StrapiTopics
    | StrapiProjects
    | StrapiPrinciples
    | StrapiOpenSource
    | StrapiContact
