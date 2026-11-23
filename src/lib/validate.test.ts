import { describe, expect, it } from 'vitest'
import {
  cleanPrintName, customSizeError, detailsErrors, normalisePhone, normaliseTxn, phoneError, printNameError, rollError, sizeOk, txnError,
} from './validate'
import type { FormProduct, FormRound } from './types'

const round: FormRound = {
  campaign_id: 'c', title: 'T', intro: null, item_cap: 6, student_batches: ["PG'26"], courses: ['PGDM'],
  sections: ['A', 'NA'], print_batches: ["PG'26"], name_max: 12, team_only: false,
}
const navy: FormProduct = {
  id: 'p', name: 'Navy', colour: 'Navy Blue', price_inr: 699, sizes: ['XXS', 'M'], description: null, photo_paths: [], allow_custom_size: true,
}

describe('phone', () => {
  it('accepts Indian mobiles with +91, spaces or a leading 0', () => {
    expect(normalisePhone('+91 98765 43210')).toBe('9876543210')
    expect(normalisePhone('09876543210')).toBe('9876543210')
    expect(phoneError('98765-43210')).toBeNull()
  })
  it('refuses short numbers and landline-looking ones', () => {
    expect(phoneError('12345')).toMatch(/10-digit/)
    expect(phoneError('1234567890')).toMatch(/10-digit/)
  })
})

describe('roll number', () => {
  it('is upper-cased and allows - and /', () => {
    expect(rollError('pgp26-500')).toBeNull()
    expect(rollError('PG/26/1')).toBeNull()
    expect(rollError('a b')).toMatch(/only/)
  })
})

describe('details', () => {
  it('needs batch, course and section from the round lists', () => {
    const e = detailsErrors({ name: 'Asha', phone: '9876543210', roll_no: 'X123', batch: "PG'99", course: 'MBA', section: 'Z' }, round)
    expect(Object.keys(e).sort()).toEqual(['batch', 'course', 'section'])
  })
})

describe('name on the back', () => {
  it('keeps only printable characters, in capitals, up to the max', () => {
    expect(cleanPrintName('asha123', 12)).toBe('ASHA')
    expect(cleanPrintName("d'souza  jr.", 12)).toBe("D'SOUZA JR.")
    expect(cleanPrintName('abcdefghijklmnop', 12)).toBe('ABCDEFGHIJKL')
    expect(cleanPrintName(' -asha', 12)).toBe('ASHA')
  })
  it('matches the database rule', () => {
    expect(printNameError('ASHA', 12)).toBeNull()
    expect(printNameError('', 12)).toBeNull()
    expect(printNameError('ABCDEFGHIJKLM', 12)).toMatch(/At most/)
  })
})

describe('sizes', () => {
  it('standard sizes in any case; custom sizes only when the product allows them', () => {
    expect(sizeOk(navy, 'm')).toBe(true)
    expect(sizeOk(navy, 'Chest 38 / Length 28')).toBe(true)
    expect(sizeOk({ ...navy, allow_custom_size: false }, 'Chest 38')).toBe(false)
    expect(customSizeError('M<script>')).not.toBeNull()
  })
})

describe('transaction ID', () => {
  it('strips spaces and needs 6-35 letters or digits', () => {
    expect(normaliseTxn(' 4123 4567 8901 ')).toBe('412345678901')
    expect(txnError('4123 4567 8901')).toBeNull()
    expect(txnError('12-34')).not.toBeNull()
  })
})
