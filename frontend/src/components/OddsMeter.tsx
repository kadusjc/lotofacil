import type { PlanOdds } from '../api/types'
import { formatChance, formatOneIn } from '../lib/format'

const TIERS: Array<{ key: keyof PlanOdds; label: string }> = [
  { key: 'atLeast11', label: 'Algum prêmio (11+)' },
  { key: 'atLeast13', label: '13 ou mais' },
  { key: 'atLeast14', label: '14 ou 15' },
  { key: 'jackpot', label: '15 pontos' },
]

/** Probabilidade real, em escala linear de 0 a 100%, de cada faixa de premiação. */
export function OddsMeter({ odds }: { odds: PlanOdds }) {
  return (
    <div className="odds" aria-label="Probabilidade de ganhar">
      {TIERS.map(({ key, label }) => {
        const p = odds[key]
        return (
          <div className="odds-row" key={key}>
            <div className="row between small">
              <span>{label}</span>
              <span>
                <strong>{formatChance(p)}</strong> <span className="muted">· {formatOneIn(Math.round(1 / p))}</span>
              </span>
            </div>
            <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p * 100} aria-label={label}>
              <div className="meter-fill" style={{ width: `${Math.max(p * 100, 0)}%` }} />
              <span className="meter-tick" style={{ left: '50%' }} />
            </div>
          </div>
        )
      })}
      <div className="row between muted small meter-scale">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  )
}
