// What to show when Google sign-in comes back with an error in the address bar.
// Never shows the text from the address bar itself: anyone can send a link to the real site with
// their own "error" in it (e.g. "your account is suspended, pay here"), so only known messages appear.
export function redirectErrorMessage(desc: string): string {
  if (/database error|mdi\.ac\.in|only @mdi/i.test(desc)) return 'Use your @mdi.ac.in Google account. Other accounts can’t order.'
  if (/access[_ ]denied|cancel/i.test(desc)) return 'Sign-in was cancelled. Try again when you’re ready.'
  return 'Sign-in didn’t finish. Try again with your @mdi.ac.in Google account.'
}
