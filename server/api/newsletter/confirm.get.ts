import type { Locale } from '~/interfaces'
import { sendWelcomeEmail } from '../../utils/email'
import { findSubscriber, newUnsubscribeToken, updateSubscriber } from '../../utils/subscribers'
import { isNewsletterToken, newsletterLanguage } from '~/helpers/newsletter'
import type { ConfirmResponse } from '~/interfaces/newsletter'

export default defineEventHandler(async (event): Promise<ConfirmResponse> => {
  const token = getQuery(event).token

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Token is required',
    })
  }

  const subscriber = isNewsletterToken(token) ? await findSubscriber('confirmationToken', token) : null

  if (!subscriber) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Invalid confirmation token',
    })
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

  const unsubscribeToken = subscriber.unsubscribeToken || newUnsubscribeToken()

  try {
    await updateSubscriber(subscriber.documentId, {
      confirmed: true,
      unsubscribeToken,
    })
  } catch (error: unknown) {
    console.error('Newsletter confirmation error:', error)
    throw createError({
      statusCode: 500,
      statusMessage:
        language === 'es'
          ? 'Error al confirmar la suscripción'
          : 'Error confirming subscription',
    })
  }

  try {
    const { site } = await loadSite(language as Locale)
    await sendWelcomeEmail(subscriber.email, language, unsubscribeToken, site.name)
  } catch (error: unknown) {
    console.error('Newsletter welcome email error:', error)
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
