import { describe, expect, it } from 'vitest'
import { parseBets } from './odds'

describe('parseBets', () => {
  it('parses one bet per line with mixed separators', () => {
    const r = parseBets('1 2 3 4 5 6 7 8 9 10 11 12 13 14 15\n\n01,02;03-04 05 06 07 08 09 10 11 12 13 14 15 16')
    expect(r.errors).toEqual([])
    expect(r.bets).toHaveLength(2)
    expect(r.bets[1]).toHaveLength(16)
  })
  it('rejects invalid lines', () => {
    expect(parseBets('1 2 3').errors).toHaveLength(1)
    expect(parseBets('\n\n1 2 3').errors[0]).toMatch(/^Linha 3:/)
    expect(parseBets('1 1 2 3 4 5 6 7 8 9 10 11 12 13 14').errors).toHaveLength(1)
    expect(parseBets('1 2 3 4 5 6 7 8 9 10 11 12 13 14 26').errors).toHaveLength(1)
  })
})
