import type { PlanOdds } from '../api/types'
import { formatChance, formatOneIn } from '../lib/format'
import { useGame } from '../lib/games'

/** Probabilidade real, em escala linear de 0 a 100%, de cada faixa de premiação. */
export function OddsMeter({ odds }: { odds: PlanOdds }) {
  const game = useGame()
  const label = (hits: number) =>
    hits === game.prizeHits[0] ? `Algum prêmio (${hits}+)` : hits === game.drawn ? `${hits} acertos` : `${hits} ou mais`
  return (
    <div className="odds" aria-label="Probabilidade de cada faixa de prêmio">
      {odds.tiers.map(({ hits, probability: p }) => (
        <div className="odds-row" key={hits}>
          <div className="row between small">
            <span>{label(hits)}</span>
            <span>
              <strong>{formatChance(p)}</strong> <span className="muted">· {formatOneIn(Math.round(1 / p))}</span>
            </span>
          </div>
          <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p * 100} aria-label={label(hits)}>
            <div className="meter-fill" style={{ width: `${Math.max(p * 100, 0)}%` }} />
            <span className="meter-tick" style={{ left: '50%' }} />
          </div>
        </div>
      ))}
      <div className="row between muted small meter-scale">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  )
}
