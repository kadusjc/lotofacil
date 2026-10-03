import type { BetPlan } from '../api/types'
import { formatBRL, formatInt } from '../lib/format'

interface Outcome {
  emoji: string
  title: string
  probability: number
  money: string
  tone: 'neg' | 'mid' | 'pos'
}

/** Linha do tempo em linguagem simples: "se jogar 100 vezes assim, o que acontece?". */
export function buildOutcomes(plan: BetPlan): Outcome[] {
  const { odds, returns, cost } = plan
  const payout = (hits: number) => returns.tiers.find((t) => t.hits === hits)?.payout ?? 0
  const perCard = returns.probabilityScope === 'per-ticket' ? ' (por cartão premiado)' : ''
  const small = [payout(11), payout(13)]
  return [
    {
      emoji: '😞',
      title: 'Não ganhar nada',
      probability: 1 - odds.atLeast11,
      money: `perde os ${formatBRL(cost)}`,
      tone: 'neg',
    },
    {
      emoji: '🙂',
      title: 'Prêmio pequeno (11, 12 ou 13 pontos)',
      probability: odds.atLeast11 - odds.atLeast14,
      money: `recebe de ${formatBRL(small[0])} a ${formatBRL(small[1])}${perCard}`,
      tone: 'mid',
    },
    {
      emoji: '🤩',
      title: '14 pontos',
      probability: odds.atLeast14 - odds.jackpot,
      money: `recebe cerca de ${formatBRL(payout(14))}${perCard}`,
      tone: 'pos',
    },
    {
      emoji: '🏆',
      title: '15 pontos (prêmio máximo)',
      probability: odds.jackpot,
      money: `recebe cerca de ${formatBRL(payout(15))}`,
      tone: 'pos',
    },
  ]
}

function inWords(p: number): string {
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
