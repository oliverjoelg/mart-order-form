import { describe, expect, it } from 'vitest'
import { THEMES, THEME_IDS, isThemeId, resolveTheme } from './theme'

describe('themes', () => {
  it('has the two themes super admins can pick', () => {
    expect(THEME_IDS).toEqual(['tees', 'hoodies'])
    expect(THEMES.tees.label).toBe('Batch T-shirt')
    expect(THEMES.hoodies.label).toBe('Winter Hoodies')
  })
  it('draws a polo for tees and a hoodie with snow for winter', () => {
    expect(THEMES.tees).toMatchObject({ garment: 'polo', snow: false })
    expect(THEMES.hoodies).toMatchObject({ garment: 'hoodie', snow: true })
  })
  it('falls back to the T-shirt look for anything unknown (e.g. before the migration)', () => {
    expect(resolveTheme('hoodies').id).toBe('hoodies')
    expect(resolveTheme(undefined).id).toBe('tees')
    expect(resolveTheme('neon').id).toBe('tees')
    expect(resolveTheme(null).id).toBe('tees')
    expect(isThemeId('tees')).toBe(true)
    expect(isThemeId('toString')).toBe(false)
  })
})
