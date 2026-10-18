import type { H3Event } from 'h3'
import type { Locale } from '~/interfaces'
import { sendWelcomeEmail } from '../../utils/email'
import { findSubscriberByToken, hashToken, newUnsubscribeToken, updateSubscriber } from '../../utils/subscribers'
import { isNewsletterToken, newsletterLanguage } from '~/helpers/newsletter'
import type { ConfirmResponse } from '~/interfaces/newsletter'

async function readToken(event: H3Event): Promise<unknown> {
  try {
    const body = await readLimitedBody(event) as { token?: unknown } | null | undefined
    return body?.token
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode === 413) throw error
    // An unreadable body is the same as a missing token
    return undefined
  }
}

export default defineEventHandler(async (event): Promise<ConfirmResponse> => {
  // The page sends this from a click, so the request comes from the site itself
  assertSameOrigin(event)
  const token = await readToken(event)

  if (!token) {
    logWarn('input.refused', 'Confirmation token missing', { event, cause: 'missingToken' })
    throw problem('invalidToken', { statusMessage: 'Token is required' })
  }

  let subscriber: Awaited<ReturnType<typeof findSubscriberByToken>>
  try {
    subscriber = isNewsletterToken(token) ? await findSubscriberByToken(event, 'confirmationToken', token) : null
  } catch (error: unknown) {
    rethrowUpstreamRateLimit(event, error)
    throw error
  }

  if (!subscriber) {
    logWarn('input.refused', 'Confirmation token refused', { event, cause: 'invalidToken' })
    throw problem('notFound', { statusMessage: 'Invalid confirmation token' })
  }

  const language = newsletterLanguage(subscriber.language)

  if (subscriber.confirmed) {
    return {
      success: true,
      alreadyConfirmed: true,
      message:
        language === 'es'
          ? 'Esta suscripción ya estaba confirmada.'
          : 'This subscription was already confirmed.',
    }
  }

  // The CMS keeps only a hash, so a new token goes in the welcome email
  const unsubscribeToken = newUnsubscribeToken()

  try {
    await updateSubscriber(event, subscriber.documentId, {
      confirmed: true,
      unsubscribeToken: hashToken(unsubscribeToken),
    })
  } catch (error: unknown) {
    rethrowUpstreamRateLimit(event, error)
    logError('cms.newsletter-confirm', 'Confirming the subscription failed', { event, error })
    throw problem('internalError', {
      statusMessage: language === 'es'
        ? 'Error al confirmar la suscripción'
        : 'Error confirming subscription',
    })
  }

  try {
    const { site } = await loadSite(language as Locale)
    await sendWelcomeEmail(subscriber.email, language, unsubscribeToken, site.name)
  } catch (error: unknown) {
    logError('newsletter.welcome-email', 'Sending the welcome email failed', { event, error })
  }

  return {
    success: true,
    alreadyConfirmed: false,
    message:
      language === 'es'
        ? 'Suscripción confirmada. Revisa tu correo para más información.'
        : 'Subscription confirmed. Check your email for more information.',
  }
})
