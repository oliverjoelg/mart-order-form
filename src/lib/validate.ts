// Checks as the student types. The same rules are enforced again in submit_order() in the database;
// keep the two in step (mart-orders/supabase/migrations/20261123120100_order_form.sql).
import type { FormProduct, FormRound, StudentDetails } from './types'

export const MAX_ITEMS = 6

/** "+91 98765 43210" -> "9876543210" */
export function normalisePhone(raw: string): string {
  const s = raw.replace(/[\s-]/g, '')
  const m = s.match(/^(?:\+91|91|0)?(\d{10})$/)
  return m ? m[1] : s
}

export function phoneError(raw: string): string | null {
  if (!raw.trim()) return 'Enter your mobile number'
  return /^[6-9]\d{9}$/.test(normalisePhone(raw)) ? null : 'Enter a 10-digit Indian mobile number'
}

export const normaliseRoll = (raw: string) => raw.trim().toUpperCase()

export function rollError(raw: string): string | null {
  if (!raw.trim()) return 'Enter your roll number'
  return /^[A-Z0-9][A-Z0-9/_-]{2,19}$/.test(normaliseRoll(raw)) ? null : 'Letters, digits, - or / only'
}

export function nameError(raw: string): string | null {
  const n = raw.trim()
  if (n.length < 2) return 'Enter your full name'
  return n.length > 80 ? 'That name is too long' : null
}

export function detailsErrors(d: StudentDetails, round: FormRound): Partial<Record<keyof StudentDetails, string>> {
  const e: Partial<Record<keyof StudentDetails, string>> = {}
  const n = nameError(d.name)
  if (n) e.name = n
  const p = phoneError(d.phone)
  if (p) e.phone = p
  const r = rollError(d.roll_no)
  if (r) e.roll_no = r
  if (!round.student_batches.includes(d.batch)) e.batch = 'Pick your batch'
  if (!round.courses.includes(d.course)) e.course = 'Pick your course'
  if (!round.sections.includes(d.section)) e.section = 'Pick your section'
  return e
}

/** What can be printed: letters, spaces, . ' - (in capitals). Returns the cleaned text. */
export function cleanPrintName(raw: string, max: number): string {
  return raw.toUpperCase().replace(/[^A-Z .'-]/g, '').replace(/\s{2,}/g, ' ').replace(/^[^A-Z]+/, '').slice(0, max)
}

export function printNameError(name: string, max: number): string | null {
  const n = name.trim()
  if (!n) return null
  if (n.length > max) return `At most ${max} letters`
  return /^[A-Z][A-Z .'-]*$/.test(n) ? null : "Only letters, spaces, . ' and -"
}

export function customSizeError(size: string): string | null {
  const s = size.trim()
  if (s.length < 2) return 'Describe the size, e.g. Chest 38 / Length 28'
  if (s.length > 40) return 'Keep it under 40 characters'
  return /^[A-Za-z0-9 ./"'-]+$/.test(s) ? null : 'Letters, numbers, spaces and . / " only'
}

export function sizeOk(p: FormProduct, size: string): boolean {
  if (p.sizes.includes(size.toUpperCase())) return true
  return p.allow_custom_size && customSizeError(size) === null
}

/** UPI transaction ID / UTR, as the database accepts it */
export const normaliseTxn = (raw: string) => raw.replace(/\s+/g, '').toUpperCase()
export function txnError(raw: string): string | null {
  const t = normaliseTxn(raw)
  if (!t) return 'Enter the transaction ID (UTR) from your payment app'
  return /^[A-Z0-9]{6,35}$/.test(t) ? null : 'Letters and digits only, as shown in your payment app'
}

export const inr = (n: number) => '₹' + n.toLocaleString('en-IN')
