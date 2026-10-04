import nodemailer from 'nodemailer'
import { smtpTransportOptions } from '~/helpers/email'
import { blogUrl, confirmUrl as buildConfirmUrl, unsubscribeHeaders, unsubscribeUrl } from '~/helpers/newsletter'
import type { NewsletterLanguage } from '~/interfaces/newsletter'
import { escapeHtml } from '~/helpers/code'

export function createTransporter() {
  const config = useRuntimeConfig()

  return nodemailer.createTransport(smtpTransportOptions({
    host: config.smtpHost,
    port: config.smtpPort,
    user: config.smtpUser,
    pass: config.smtpPass,
  }))
}

export async function sendEmail(options: {
  to: string
  subject: string
  html: string
  headers?: Record<string, string>
}): Promise<void> {
  const config = useRuntimeConfig()
  const transporter = createTransporter()

  await transporter.sendMail({
    from: config.newsletterFrom,
    to: options.to,
    subject: options.subject,
    html: options.html,
    headers: options.headers,
  })
}

export async function sendConfirmationEmail(
  email: string,
  token: string,
  locale: NewsletterLanguage,
  siteName: string,
): Promise<void> {
  const confirmUrl = buildConfirmUrl(useRuntimeConfig().public.siteUrl, locale, token)

  const subject
    = locale === 'es'
      ? `Confirma tu suscripción a ${siteName}`
      : `Confirm your ${siteName} subscription`

  const html
    = locale === 'es'
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">¡Gracias por suscribirte!</h1>
          <p style="color: #666; font-size: 16px;">Por favor haz clic en el botón de abajo para confirmar tu suscripción:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-size: 16px;">Confirmar Suscripción</a>
          </div>
          <p style="color: #666; font-size: 14px;">O copia y pega este enlace en tu navegador:</p>
          <p style="color: #007bff; font-size: 14px; word-break: break-all;">${confirmUrl}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">Si no solicitaste esta suscripción, puedes ignorar este correo.</p>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">Thanks for subscribing!</h1>
          <p style="color: #666; font-size: 16px;">Please click the button below to confirm your subscription:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-size: 16px;">Confirm Subscription</a>
          </div>
          <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="color: #007bff; font-size: 14px; word-break: break-all;">${confirmUrl}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">If you didn't request this subscription, you can ignore this email.</p>
        </div>
      `

  await sendEmail({ to: email, subject, html })
}

export async function sendWelcomeEmail(
  email: string,
  locale: NewsletterLanguage,
  unsubscribeToken: string,
  siteName: string,
): Promise<void> {
  const name = escapeHtml(siteName)
  const siteUrl = useRuntimeConfig().public.siteUrl
  const articlesUrl = blogUrl(siteUrl, locale)
  const leaveUrl = unsubscribeUrl(siteUrl, locale, unsubscribeToken)

  const subject
    = locale === 'es'
      ? `¡Bienvenido a ${siteName}!`
      : `Welcome to ${siteName}!`

  const html
    = locale === 'es'
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">¡Suscripción confirmada!</h1>
          <p style="color: #666; font-size: 16px;">Gracias por confirmar tu suscripción a ${name}. Ahora recibirás los últimos artículos directamente en tu bandeja de entrada.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${articlesUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-size: 16px;">Ver Artículos</a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">${name} - Tu fuente de información sobre IA, desarrollo de software y Linux.</p>
          <p style="color: #999; font-size: 12px;">¿Ya no quieres recibir estos correos? <a href="${leaveUrl}" style="color: #999;">Darte de baja</a>.</p>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333;">Subscription confirmed!</h1>
          <p style="color: #666; font-size: 16px;">Thanks for confirming your subscription to ${name}. You'll now receive the latest articles directly in your inbox.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${articlesUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-size: 16px;">View Articles</a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">${name} - Your source for AI, software development, and Linux content.</p>
          <p style="color: #999; font-size: 12px;">Don't want these emails anymore? <a href="${leaveUrl}" style="color: #999;">Unsubscribe</a>.</p>
        </div>
      `

  await sendEmail({ to: email, subject, html, headers: unsubscribeHeaders(siteUrl, unsubscribeToken) })
}
