import { describe, expect, it } from 'vitest'
import { confirmResponseSchema, subscribeResponseSchema, unsubscribeResponseSchema } from '~/schemas/newsletter'

describe('newsletter response schemas', () => {
  it('accept what the routes send', () => {
    expect(subscribeResponseSchema.parse({ success: true, message: 'Check your email to confirm subscription' })).toEqual({ success: true, message: 'Check your email to confirm subscription' })
    expect(confirmResponseSchema.parse({ success: true, alreadyConfirmed: false, message: 'Subscription confirmed. Check your email for more information.' }).alreadyConfirmed).toBe(false)
    expect(confirmResponseSchema.parse({ success: true, alreadyConfirmed: true, message: 'Esta suscripción ya estaba confirmada.' }).alreadyConfirmed).toBe(true)
    expect(unsubscribeResponseSchema.parse({ success: true })).toEqual({ success: true })
  })

  it('reject a wrong shape', () => {
    expect(subscribeResponseSchema.safeParse({ success: true }).success).toBe(false)
    expect(subscribeResponseSchema.safeParse({ success: 'yes', message: 'x' }).success).toBe(false)
    expect(confirmResponseSchema.safeParse({ success: true, message: 'x' }).success).toBe(false)
    expect(unsubscribeResponseSchema.safeParse({}).success).toBe(false)
    expect(unsubscribeResponseSchema.safeParse({ success: true, extra: 1 }).success).toBe(false)
  })
})
