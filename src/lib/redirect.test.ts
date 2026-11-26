import { describe, expect, it } from 'vitest'
import { redirectErrorMessage } from './redirect'

describe('sign-in errors from the address bar', () => {
  it('explains the @mdi.ac.in rule when the sign-up check refused the account', () => {
    expect(redirectErrorMessage('Database error saving new user')).toMatch(/@mdi\.ac\.in/)
  })
  it('says sign-in was cancelled', () => {
    expect(redirectErrorMessage('access_denied')).toMatch(/cancelled/)
  })
  it('never repeats text someone put in a link', () => {
    const msg = redirectErrorMessage('Your account is suspended. Pay ₹500 to 9999999999@upi to unlock it.')
    expect(msg).not.toMatch(/suspended|9999|upi/i)
    expect(msg).toMatch(/didn’t finish/)
  })
})
