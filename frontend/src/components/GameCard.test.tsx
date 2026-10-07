import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GameCard } from './GameCard'
import { GameContext, GAMES } from '../lib/games'

describe('GameCard', () => {
  it('draws the Mega-Sena 60-number grid when that game is selected', () => {
    render(
      <GameContext.Provider value={GAMES.megasena}>
        <GameCard numbers={[1, 60]} />
      </GameContext.Provider>,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(60)
    expect(screen.getByText('MEGA-SENA')).toBeInTheDocument()
  })
  it('marks selected and hit numbers on the 5x5 grid', () => {
    render(<GameCard numbers={[1, 2, 3]} drawn={[2]} title="Jogo" />)
    const cells = screen.getAllByRole('listitem')
    expect(cells).toHaveLength(25)
    expect(cells[0]).toHaveClass('selected')
    expect(cells[1]).toHaveClass('hit')
    expect(cells[3]).not.toHaveClass('selected')
  })
})
