import { pad2 } from '../lib/format'

interface Props {
  numbers: number[]
  /** Dezenas sorteadas para destacar acertos (opcional). */
  drawn?: number[]
  title?: string
  compact?: boolean
}

/** Volante 5x5 com as dezenas marcadas. */
export function GameCard({ numbers, drawn, title, compact }: Props) {
  const selected = new Set(numbers)
  const hitSet = drawn ? new Set(drawn) : null
  return (
    <figure className={`game-card${compact ? ' compact' : ''}`} aria-label={title ?? 'Jogo'}>
      {title && <figcaption>{title}</figcaption>}
      <div className="grid" role="list">
        {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => {
          const isSelected = selected.has(n)
          const isHit = isSelected && hitSet?.has(n)
          return (
            <span
              key={n}
              role="listitem"
              className={`cell${isSelected ? ' selected' : ''}${isHit ? ' hit' : ''}`}
              aria-selected={isSelected}
            >
              {pad2(n)}
            </span>
          )
        })}
      </div>
    </figure>
  )
}

export function NumberList({ numbers }: { numbers: number[] }) {
  return (
    <div className="number-list">
      {numbers.map((n) => (
        <span key={n} className="ball">
          {pad2(n)}
        </span>
      ))}
    </div>
  )
}
