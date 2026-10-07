import type { PlanReturns } from '../api/types'
import { formatBRL, formatChance, formatPct } from '../lib/format'
import { useGame } from '../lib/games'

/** Quanto a sugestão pode retornar em dinheiro: por faixa de acerto e na média (valor esperado). */
export function ReturnsPanel({ returns, cost }: { returns: PlanReturns; cost: number }) {
  const game = useGame()
  const perTicket = returns.probabilityScope === 'per-ticket'
  const fixed = game.fixedPrizeHits
  const shared = game.prizeHits.filter((h) => !fixed.includes(h))
  return (
    <div className="returns">
      <h4 className="odds-title">Quanto pode retornar em dinheiro</h4>
      <div className="kpis">
        <Stat label="Você paga" value={formatBRL(cost)} />
        <Stat label="Prêmio máximo possível" value={formatBRL(returns.maxPayout)} hint={perTicket ? `se um dos cartões fizer ${game.drawn}` : `se fizer ${game.drawn} acertos`} />
        <Stat label="Retorno médio esperado" value={formatBRL(returns.expectedPrize)} hint="média por concurso no longo prazo" />
        <Stat
          label="Resultado médio"
          value={formatBRL(returns.expectedNet)}
          hint={formatPct(returns.expectedReturnPct)}
          tone={returns.expectedNet < 0 ? 'neg' : 'pos'}
        />
      </div>
      <table>
        <thead>
          <tr>
            <th>Acertos</th>
            <th>Chance{perTicket ? ' (por cartão)' : ''}</th>
            <th>Você recebe{perTicket ? ' (por cartão)' : ''}</th>
          </tr>
        </thead>
        <tbody>
          {[...returns.tiers].reverse().map((t) => (
            <tr key={t.hits}>
              <td>{t.hits}</td>
              <td>{formatChance(t.probability)}</td>
              <td>{formatBRL(t.payout)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">
        {fixed.length > 0 && `Prêmios de ${listPt(fixed)} acertos são fixos; `}
        {`${fixed.length > 0 ? 'os' : 'Os prêmios'} de ${listPt(shared)} acertos usam a média real das últimas ${returns.basedOnLastDraws} vezes em que a faixa teve ganhador e
        variam a cada sorteio.`} O resultado médio negativo significa que, repetindo essa aposta muitas vezes, você perde essa fração do valor apostado.
      </p>
    </div>
  )
}

export function ReturnsSummary({ returns }: { returns: PlanReturns }) {
  return (
    <p className="small returns-summary">
      Prêmio máx. <strong>{formatBRL(returns.maxPayout)}</strong> · retorno médio <strong>{formatBRL(returns.expectedPrize)}</strong>{' '}
      <span className={returns.expectedNet < 0 ? 'neg' : 'pos'}>({formatPct(returns.expectedReturnPct)})</span>
    </p>
  )
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'neg' | 'pos' }) {
  return (
    <div className="panel kpi">
      <span className="muted small">{label}</span>
      <strong className={tone}>{value}</strong>
      {hint && <span className={`small ${tone ?? 'muted'}`}>{hint}</span>}
    </div>
  )
}

/** "11", "11 e 12", "11, 12 e 13". */
function listPt(items: number[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}` : String(items[0] ?? '')
}
