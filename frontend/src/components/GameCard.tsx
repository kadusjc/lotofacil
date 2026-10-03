import { pad2 } from '../lib/format'

interface Props {
  numbers: number[]
  /** Dezenas sorteadas para destacar acertos (opcional). */
  drawn?: number[]
  title?: string
  compact?: boolean
}

/** Volante 5x5 no estilo de bilhete: papel claro, cabeçalho em faixa e dezenas marcadas a "caneta". */
export function GameCard({ numbers, drawn, title, compact }: Props) {
  const selected = new Set(numbers)
  const hitSet = drawn ? new Set(drawn) : null
  return (
    <figure className={`game-card${compact ? ' compact' : ''}`} aria-label={title ?? 'Jogo'}>
      <figcaption className="ticket-head">
        <span className="ticket-brand">LOTOFÁCIL</span>
        <span className="ticket-meta">{title ?? `${numbers.length} dezenas`}</span>
      </figcaption>
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
      <div className="ticket-foot">
        <span>{numbers.length} marcadas</span>
        {hitSet && <span>{numbers.filter((n) => hitSet.has(n)).length} acertos</span>}
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
