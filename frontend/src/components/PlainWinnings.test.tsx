import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { BetPlan } from '../api/types'
import { buildOutcomes, PlainWinnings } from './PlainWinnings'

const plan = {
  kind: 'single-bet', betSize: 15, tickets: 1, cost: 3.5, oneIn: 21647, description: '', games: [],
  probAtLeast14: { lower: 0, upper: 0, estimate: 0 },
  odds: { atLeast11: 0.106, atLeast13: 0.0015, atLeast14: 0.0000462, jackpot: 0.000000306 },
  returns: {
    basedOnLastDraws: 50, expectedPrize: 1.6, expectedNet: -1.9, expectedReturnPct: -0.54, maxPayout: 2_000_000, probabilityScope: 'bet',
    tiers: [11, 12, 13, 14, 15].map((hits, i) => ({ hits, probability: 0, payout: [7, 14, 35, 1800, 2_000_000][i] })),
  },
} as BetPlan

describe('PlainWinnings', () => {
  it('outcomes cover 100% of cases', () => {
    const total = buildOutcomes(plan).reduce((a, o) => a + o.probability, 0)
    expect(total).toBeCloseTo(1, 10)
  })
  it('explains in plain words', () => {
    render(<PlainWinnings plan={plan} />)
    expect(screen.getByText('Não ganhar nada')).toBeInTheDocument()
    expect(screen.getByText('89 de cada 100 vezes')).toBeInTheDocument()
    expect(screen.getByText(/recebe de R\$\s7,00 a R\$\s35,00/)).toBeInTheDocument()
    expect(screen.getByText('1 vez a cada 3.267.974 jogadas')).toBeInTheDocument()
  })
})
