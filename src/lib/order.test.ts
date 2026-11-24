import { describe, expect, it } from 'vitest'
import {
  batchNumeral, draftKey, firstBadLine, fitSize, itemCap, lineErrors, lineToCart, linesTotal, newLine, pickProduct, restoreDraft, type Line,
} from './order'
import type { FormProduct, OrderForm } from './types'

const navy: FormProduct = {
  id: 'navy', name: 'Classic Navy', colour: 'Navy Blue', price_inr: 699, sizes: ['XS', 'S', 'M', 'L', 'XXXL'], description: null, photo_paths: [], allow_custom_size: true,
}
const black: FormProduct = {
  id: 'black', name: 'Premium Black', colour: 'Black', price_inr: 1049, sizes: ['S', 'M', 'L'], description: null, photo_paths: [], allow_custom_size: false,
}
const form: OrderForm = {
  round: {
    campaign_id: 'r1', title: 'Tees', intro: null, item_cap: 6, student_batches: ["PG'25", "PG'26"], courses: ['PGDM'], sections: ['A', 'B'],
    print_batches: ["PG'25", "PG'26"], name_max: 12, team_only: false,
  },
  products: [navy, black],
  qr: null,
  me: null,
  email: 'x@mdi.ac.in',
  team_only_round_open: false,
  is_form_admin: false,
}
const me = { name: 'Asha Verma', phone: '9876543210', roll_no: 'PG26123', batch: "PG'26", course: 'PGDM', section: 'B' }

const line = (over: Partial<Line> = {}): Line => ({
  key: 'k', product_id: 'navy', size: 'M', custom: false, custom_size: '', name: 'ASHA', no_name: false, batch: "PG'26", ...over,
})

describe('batch numeral', () => {
  it('takes the last two digits', () => {
    expect(batchNumeral("PG'26")).toBe('26')
    expect(batchNumeral('PGDM 2027')).toBe('27')
    expect(batchNumeral('Staff')).toBe('')
  })
})

describe('new items', () => {
  it('starts on M, the last print batch, empty name', () => {
    const l = newLine(form)
    expect(l).toMatchObject({ product_id: 'navy', size: 'M', name: '', no_name: false, batch: "PG'26" })
  })
  it("prints the student's own batch when it's on the list", () => {
    expect(newLine({ ...form, me: { batch: "PG'25" } }).batch).toBe("PG'25")
  })
  it('copies colour, size, name and batch from the previous item', () => {
    const l = newLine(form, line({ product_id: 'black', size: 'L', name: 'RAVI', batch: "PG'25" }))
    expect(l).toMatchObject({ product_id: 'black', size: 'L', name: 'RAVI', batch: "PG'25", custom: false })
    expect(l.key).not.toBe('k')
  })
  it('caps items at 6 even if the round allows more', () => {
    expect(itemCap({ ...form.round!, item_cap: 10 })).toBe(6)
    expect(itemCap({ ...form.round!, item_cap: 2 })).toBe(2)
  })
})

describe('switching colour', () => {
  it('keeps the size when it is made', () => {
    expect(pickProduct(line({ size: 'L' }), black)).toEqual({ line: line({ size: 'L', product_id: 'black' }), note: null })
  })
  it('moves to M and says so when the size is not made', () => {
    const r = pickProduct(line({ size: 'XXXL' }), black)
    expect(r.line.size).toBe('M')
    expect(r.note).toMatch(/XXXL isn't made in Black/)
  })
  it('drops a custom size when the product has no custom sizes', () => {
    const r = pickProduct(line({ custom: true, custom_size: 'Chest 44' }), black)
    expect(r.line.custom).toBe(false)
    expect(r.note).toMatch(/listed sizes/)
  })
  it('fitSize falls back to the first size without M', () => {
    expect(fitSize({ ...black, sizes: ['L', 'XL'] }, 'S')).toBe('L')
  })
})

describe('item checks', () => {
  it('a complete item has no errors', () => {
    expect(lineErrors(line(), form)).toEqual({})
  })
  it('asks for a name unless No name is chosen', () => {
    expect(lineErrors(line({ name: ' ' }), form).name).toMatch(/No name/)
    expect(lineErrors(line({ name: '', no_name: true }), form)).toEqual({})
  })
  it('uses the database name rules', () => {
    expect(lineErrors(line({ name: 'ABCDEFGHIJKLM' }), form).name).toMatch(/12/)
  })
  it('checks custom sizes only where allowed', () => {
    expect(lineErrors(line({ custom: true, custom_size: 'Chest 40 / Length 29' }), form)).toEqual({})
    expect(lineErrors(line({ custom: true, custom_size: 'x' }), form).size).toBeTruthy()
    expect(lineErrors(line({ product_id: 'black', custom: true, custom_size: 'Chest 40' }), form).size).toMatch(/list/)
  })
  it('flags products that left the form and batches not on the list', () => {
    expect(lineErrors(line({ product_id: 'gone' }), form).product).toBeTruthy()
    expect(lineErrors(line({ batch: "PG'21" }), form).batch).toBeTruthy()
  })
  it('finds the first item that needs fixing', () => {
    expect(firstBadLine([line(), line({ name: '' }), line({ size: '' })], form)).toBe(1)
    expect(firstBadLine([line()], form)).toBe(-1)
  })
})

describe('cart', () => {
  it('turns items into what submit_order takes', () => {
    expect(lineToCart(line())).toEqual({ key: 'k', product_id: 'navy', size: 'M', print_name: 'ASHA', print_batch: "PG'26" })
    expect(lineToCart(line({ no_name: true, name: 'OLD' })).print_name).toBeNull()
    expect(lineToCart(line({ custom: true, custom_size: ' Chest 44 ' })).size).toBe('Chest 44')
  })
  it('totals the prices from the form', () => {
    expect(linesTotal(form, [line(), line({ product_id: 'black' })])).toBe(1748)
  })
})

describe('draft in this browser', () => {
  it('is per account and round', () => {
    expect(draftKey('u1', 'r1')).toBe('mart-order-draft:u1:r1')
  })
  it('starts on Details for a new student and on Items for a returning one', () => {
    expect(restoreDraft(null, form).step).toBe('details')
    const r = restoreDraft(null, { ...form, me })
    expect(r.step).toBe('items')
    expect(r.lines).toHaveLength(1)
  })
  it('survives junk', () => {
    expect(restoreDraft('{not json', form).lines).toHaveLength(1)
  })
  it('restores a draft and drops items no longer on sale', () => {
    const saved = JSON.stringify({ v: 2, step: 'payment', details: me, lines: [line(), line({ key: 'g', product_id: 'gone' })], cur: 1, txn: '123456789012', shot: 'u/s.jpg' })
    const r = restoreDraft(saved, form)
    expect(r.lines.map((l) => l.key)).toEqual(['k'])
    expect(r).toMatchObject({ step: 'payment', cur: 0, txn: '123456789012', shot: 'u/s.jpg' })
  })
  it('goes back to Items if a restored item needs fixing', () => {
    const saved = JSON.stringify({ v: 2, step: 'review', details: me, lines: [line({ name: '' })], cur: 0, txn: '', shot: null })
    expect(restoreDraft(saved, form).step).toBe('items')
  })
  it('goes back to Details if the saved details are incomplete', () => {
    const saved = JSON.stringify({ v: 2, step: 'payment', details: { ...me, phone: '' }, lines: [line()], cur: 0, txn: '', shot: null })
    expect(restoreDraft(saved, form).step).toBe('details')
  })
  it('reads drafts saved before the redesign', () => {
    const old = JSON.stringify({
      step: 'payment', details: me, txn: 'ABC123', shot: null,
      cart: [
        { key: 'a', product_id: 'navy', size: 'M', print_name: null, print_batch: "PG'26" },
        { key: 'b', product_id: 'navy', size: 'Chest 44', print_name: 'RAVI', print_batch: "PG'25" },
      ],
    })
    const r = restoreDraft(old, form)
    expect(r.lines).toHaveLength(2)
    expect(r.lines[0]).toMatchObject({ no_name: true, name: '', size: 'M', custom: false })
    expect(r.lines[1]).toMatchObject({ custom: true, custom_size: 'Chest 44', name: 'RAVI' })
    expect(r.cur).toBe(1)
    expect(r.step).toBe('payment')
    expect(r.lines.map(lineToCart)[1]).toEqual({ key: 'b', product_id: 'navy', size: 'Chest 44', print_name: 'RAVI', print_batch: "PG'25" })
  })
  it('never restores more items than the round allows', () => {
    const saved = JSON.stringify({ v: 2, step: 'items', details: me, lines: Array.from({ length: 8 }, (_, i) => line({ key: String(i) })), cur: 7, txn: '', shot: null })
    const r = restoreDraft(saved, { ...form, round: { ...form.round!, item_cap: 3 } })
    expect(r.lines).toHaveLength(3)
    expect(r.cur).toBe(2)
  })
})
