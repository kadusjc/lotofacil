import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GameCard } from './GameCard'

describe('GameCard', () => {
  it('marks selected and hit numbers on the 5x5 grid', () => {
    render(<GameCard numbers={[1, 2, 3]} drawn={[2]} title="Jogo" />)
    const cells = screen.getAllByRole('listitem')
    expect(cells).toHaveLength(25)
    expect(cells[0]).toHaveClass('selected')
    expect(cells[1]).toHaveClass('hit')
    expect(cells[3]).not.toHaveClass('selected')
  })
})
