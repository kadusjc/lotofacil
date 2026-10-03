import { describe, expect, it } from 'vitest'
import { formatDate, formatOneIn, formatPct, pad2 } from './format'

describe('format', () => {
  it('formats values in pt-BR', () => {
    expect(pad2(5)).toBe('05')
    expect(formatDate('2026-10-02')).toBe('02/10/2026')
    expect(formatOneIn(21648)).toBe('1 em 21.648')
    expect(formatPct(0.6)).toBe('60,0%')
  })
})
