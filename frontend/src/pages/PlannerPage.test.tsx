import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PlannerPage } from './PlannerPage'

const game = { numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], score: 1, cohesion: 0, repeatsFromLast: 9, profile: { sum: 120, odds: 8, primes: 6, frame: 9, fibonacci: 6, maxRun: 15 } }
const plan = { kind: 'multiple-games', betSize: 15, tickets: 1, cost: 3.5, probAtLeastNear: { lower: 1, upper: 1, estimate: 1 }, oneIn: 21648, description: '1 aposta de 15 dezenas', games: [game], odds: { tiers: [{ hits: 11, probability: 0.1062 }, { hits: 12, probability: 0.0175 }, { hits: 13, probability: 0.0016 }, { hits: 14, probability: 0.0000462 }, { hits: 15, probability: 0.000000306 }] }, returns: { basedOnLastDraws: 50, expectedPrize: 1.4, expectedNet: -2.1, expectedReturnPct: -0.6, maxPayout: 1500000, probabilityScope: 'bet', tiers: [{ hits: 15, probability: 0.000000306, payout: 1500000 }] } }

function mockFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    const body = url.includes('/plan')
      ? { budget: 3.5, betPrice: 3.5, basedOnConcurso: 3795, rationale: 'Motivo', recommended: plan, plans: [plan] }
      : { betPrice: 3.5, rows: [] }
    return new Response(JSON.stringify(body), { status: 200 })
  })
}

describe('PlannerPage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('requests a plan for the chosen budget and shows the recommendation', async () => {
    const fetchSpy = mockFetch()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <PlannerPage />
      </QueryClientProvider>,
    )
    const input = screen.getByLabelText('Orçamento em reais')
    await userEvent.clear(input)
    await userEvent.type(input, '3.5')
    await userEvent.click(screen.getByRole('button', { name: 'Sugerir jogo' }))

    expect(await screen.findByRole('heading', { name: '1 aposta de 15 dezenas' })).toBeInTheDocument()
    expect(screen.getAllByText(/1 em 21\.648/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('10,6%').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('meter', { name: '14 ou mais' })[0]).toHaveAttribute('aria-valuenow', String(0.0000462 * 100))
    expect(screen.getAllByText('-60,0%').length).toBeGreaterThan(0)
    const planCall = fetchSpy.mock.calls.find(([u]) => String(u).includes('/plan'))!
    expect(JSON.parse(String(planCall[1]!.body))).toEqual({ budget: 3.5 })
  })
})
