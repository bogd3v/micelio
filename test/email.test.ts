import { describe, expect, it } from 'vitest'
import { smtpTransportOptions, welcomeEmailFooter } from '~/helpers/email'

describe('smtpTransportOptions', () => {
  it('authenticates with the SMTP user and key, using STARTTLS on port 2525', () => {
    expect(smtpTransportOptions({ host: 'smtp-relay.brevo.com', port: 2525, user: 'login@smtp-brevo.com', pass: 'smtp-key' })).toMatchObject({
      host: 'smtp-relay.brevo.com',
      port: 2525,
      secure: false,
      requireTLS: true,
      auth: { user: 'login@smtp-brevo.com', pass: 'smtp-key' },
      tls: { rejectUnauthorized: true, servername: 'smtp-relay.brevo.com' },
    })
  })

  it('uses implicit TLS on port 465', () => {
    expect(smtpTransportOptions({ host: 'smtp.example.com', port: 465, user: 'u', pass: 'p' })).toMatchObject({ secure: true, requireTLS: false })
  })

  it('skips authentication when the credentials are incomplete', () => {
    expect(smtpTransportOptions({ host: 'mail.example.com', port: 587, user: 'u' })).not.toHaveProperty('auth')
    expect(smtpTransportOptions({})).toMatchObject({ host: 'localhost', port: 25 })
  })
})

describe('welcomeEmailFooter', () => {
  it('says why the reader gets the email, without naming topics', () => {
    expect(welcomeEmailFooter('en', 'Micelio')).toBe('You receive this email because you subscribed to Micelio.')
    expect(welcomeEmailFooter('es', 'Micelio')).toBe('Recibes este correo porque te suscribiste a Micelio.')
  })
})
