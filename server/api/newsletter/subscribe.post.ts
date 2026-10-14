import type { Locale } from '~/interfaces'
import { randomUUID } from 'crypto'
import { sendConfirmationEmail } from '../../utils/email'
import { createSubscriber, deleteSubscriber, findSubscriber, newUnsubscribeToken } from '../../utils/subscribers'
import { subscribeSchema } from '../../schemas/newsletter'
import type { NewsletterLanguage, SubscribeResponse } from '~/interfaces/newsletter'

function successResponse(language: NewsletterLanguage): SubscribeResponse {
  return {
    success: true,
    message:
      language === 'es'
        ? 'Revisa tu correo para confirmar la suscripción'
        : 'Check your email to confirm subscription',
  }
}

export default defineEventHandler(async (event): Promise<SubscribeResponse> => {
  assertSameOrigin(event)
  const { email, locale: language } = await validBody(event, subscribeSchema, error => createError({
    statusCode: 400,
    statusMessage: error.issues[0]?.message ?? 'Invalid email format',
  }))
  assertRateLimit(event, 'newsletterPerIp', clientIp(event))
  assertRateLimit(event, 'newsletterPerEmail', email)

  try {
    const existing = await findSubscriber(event, 'email', email)
    if (existing?.confirmed) return successResponse(language)
    if (existing) await deleteSubscriber(event, existing.documentId)

    const confirmationToken = randomUUID()
    const documentId = await createSubscriber(event, {
      email,
      confirmationToken,
      unsubscribeToken: newUnsubscribeToken(),
      confirmed: false,
      language,
    })

    try {
      const { site } = await loadSite(language as Locale)
      await sendConfirmationEmail(email, confirmationToken, language, site.name)
    } catch (error: unknown) {
      // All or nothing: nobody holds the token, so the pending record goes too
      try {
        await deleteSubscriber(event, documentId)
      } catch {
        // The send error below is the one the caller needs; a pending record is replaced on the next request
        console.error('Newsletter subscription rollback failed')
      }
      throw error
    }

    return successResponse(language)
  } catch (error: unknown) {
    rethrowUpstreamRateLimit(event, error)
    console.error('Newsletter subscription error:', upstreamLogMessage(error))
    throw createError({
      statusCode: 500,
      statusMessage:
        language === 'es'
          ? 'Error al procesar la suscripción'
          : 'Error processing subscription',
    })
  }
})
