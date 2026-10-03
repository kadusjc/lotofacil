import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ChanceGuide, spreadGamesChance } from './ChanceGuide'

describe('ChanceGuide', () => {
  it('computes exact 14+ chance for spread games', () => {
    expect(spreadGamesChance(3.5)).toMatchObject({ games: 1 })
    expect(spreadGamesChance(56).atLeast14).toBeCloseTo((16 * 151) / 3_268_760, 12)
  })
  it('lets the user pick a budget from the ladder', async () => {
    const onPick = vi.fn()
    render(<ChanceGuide onPickBudget={onPick} />)
    await userEvent.click(screen.getByText('R$ 476,00'))
    expect(onPick).toHaveBeenCalledWith(476)
  })
})
