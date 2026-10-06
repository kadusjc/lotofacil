import type { BetPlan } from '../api/types'
import { formatBRL, formatInt } from '../lib/format'
import { buildOutcomes } from '../lib/odds'

function inWords(p: number): string {
  if (p <= 0) return 'praticamente nunca'
  if (p >= 0.01) return `${formatInt(p * 100)} de cada 100 vezes`
  return `1 vez a cada ${formatInt(1 / p)} jogadas`
}

export function PlainWinnings({ plan }: { plan: BetPlan }) {
  const outcomes = buildOutcomes(plan)
  const avg = plan.returns.expectedPrize
  return (
    <div className="plain">
      <h3>💰 Quanto você pode ganhar, em palavras simples</h3>
      <p className="plain-pay">
        Você paga <strong>{formatBRL(plan.cost)}</strong>. Veja o que acontece se jogar assim:
      </p>
      <ul className="plain-list">
        {outcomes.map((o) => (
          <li key={o.title} className={`plain-row ${o.tone}`}>
            <span className="plain-emoji" aria-hidden>
              {o.emoji}
            </span>
            <div className="plain-text">
              <strong>{o.title}</strong>
              <span>
                Acontece <b>{inWords(o.probability)}</b>, e você <b>{o.money}</b>.
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className="plain-bottom">
        📉 <strong>Na média:</strong> a cada {formatBRL(plan.cost)} que você aposta, voltam só uns{' '}
        <strong>{formatBRL(avg)}</strong>. Ou seja, no longo prazo você perde cerca de{' '}
        <strong>{formatBRL(plan.cost - avg)}</strong> a cada vez que joga assim.
      </p>
    </div>
  )
}
