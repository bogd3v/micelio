export interface StrapiMediaFile {
  url: string
  alternativeText?: string
  caption?: string
  width?: number
  height?: number
}

export type StrapiImageCreditKind = 'photo' | 'illustration' | 'diagram' | 'screenshot'

export type StrapiImageLicense
  = | 'own-work'
    | 'cc0'
    | 'public-domain'
    | 'cc-by-4.0'
    | 'cc-by-sa-4.0'
    | 'cc-by-nc-4.0'
    | 'unsplash'
    | 'permission'
    | 'other'

export interface StrapiImageCredit {
  id?: number
  kind: StrapiImageCreditKind
  author?: string | null
  authorUrl?: string | null
  source?: string | null
  sourceUrl?: string | null
  license: StrapiImageLicense
  licenseUrl?: string | null
  modifications?: string | null
}

export interface StrapiMedia {
  id: number
  __component: 'shared.media'
  file: StrapiMediaFile
  caption?: string | null
  credit?: StrapiImageCredit | null
}

export interface StrapiSlide {
  id?: number
  file: StrapiMediaFile
  caption?: string | null
  credit?: StrapiImageCredit | null
}

export interface StrapiSlider {
  id: number
  __component: 'shared.slider'
  items?: StrapiSlide[] | null
  files?: StrapiMediaFile[] | null
}
