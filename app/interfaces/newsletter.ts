/**
 * The language of a newsletter subscriber's emails.
 *
 * @public
 */
export type NewsletterLanguage = 'en' | 'es'

/**
 * A newsletter subscriber as the CMS stores it.
 *
 * @public
 */
export interface Subscriber {
  id: number
  documentId: string
  email: string
  /** Token of the confirmation link; null when there is none. */
  confirmationToken: string | null
  /** Token of the unsubscribe link that every email carries. */
  unsubscribeToken: string | null
  confirmed: boolean
  language: NewsletterLanguage
  createdAt: string
  updatedAt: string
}

/**
 * The body of a newsletter sign-up.
 *
 * @public
 */
export interface SubscribeRequest {
  email: string
  /** The page's locale, when the form sends one. */
  locale?: string
}

/**
 * The answer to a newsletter sign-up: whether it worked, and the message to show.
 *
 * @public
 */
export interface SubscribeResponse {
  success: boolean
  message: string
}

/**
 * The answer to a confirmation link. `alreadyConfirmed` is true when the address was confirmed before.
 *
 * @public
 */
export interface ConfirmResponse {
  success: boolean
  alreadyConfirmed: boolean
  message: string
}

/**
 * The answer to an unsubscribe request.
 *
 * @public
 */
export interface UnsubscribeResponse {
  success: boolean
}
