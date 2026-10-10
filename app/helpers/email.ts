interface SmtpSettings {
  host?: string
  port?: number
  user?: string
  pass?: string
}

interface SmtpTransportOptions {
  host: string
  port: number
  secure: boolean
  requireTLS: boolean
  auth?: { user: string, pass: string }
  tls: { rejectUnauthorized: boolean, servername?: string }
  connectionTimeout: number
  greetingTimeout: number
  socketTimeout: number
}

export function smtpTransportOptions(settings: SmtpSettings): SmtpTransportOptions {
  const port = settings.port || 25
  const secure = port === 465
  return {
    host: settings.host || 'localhost',
    port,
    secure,
    requireTLS: !secure,
    ...(settings.user && settings.pass ? { auth: { user: settings.user, pass: settings.pass } } : {}),
    tls: { rejectUnauthorized: true, servername: settings.host },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  }
}

/** The line under the welcome email: why the reader gets it. `name` is already HTML-escaped. */
export function welcomeEmailFooter(locale: 'en' | 'es', name: string): string {
  return locale === 'es'
    ? `Recibes este correo porque te suscribiste a ${name}.`
    : `You receive this email because you subscribed to ${name}.`
}
