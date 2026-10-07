import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { spreadGamesChance } from '../lib/odds'
import { GAMES } from '../lib/games'
import { ChanceGuide } from './ChanceGuide'

describe('ChanceGuide', () => {
  it('computes exact 14+ chance for spread games', () => {
    expect(spreadGamesChance(GAMES.lotofacil, 3.5)).toMatchObject({ games: 1 })
    expect(spreadGamesChance(GAMES.lotofacil, 56).atLeastNear).toBeCloseTo((16 * 151) / 3_268_760, 12)
    // Mega-Sena: quina+ = 6·54 + 1 = 325 combinações vencedoras.
    expect(spreadGamesChance(GAMES.megasena, 42, 6).atLeastNear).toBeCloseTo((7 * 325) / 50_063_860, 15)
  })
  it('lets the user pick a budget from the ladder', async () => {
    const onPick = vi.fn()
    render(<ChanceGuide onPickBudget={onPick} />)
    await userEvent.click(screen.getByText('R$ 476,00'))
    expect(onPick).toHaveBeenCalledWith(476)
  })
})
