import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api } from '../api/client'
import type { BetPlan, CheckResult } from '../api/types'
import { ChanceGuide } from '../components/ChanceGuide'
import { ErrorBox, Loading } from '../components/Feedback'
import { GameCard, NumberList } from '../components/GameCard'
import { OddsMeter } from '../components/OddsMeter'
import { PlainWinnings } from '../components/PlainWinnings'
import { ReturnsPanel, ReturnsSummary } from '../components/ReturnsPanel'
import { formatBRL, formatDate, formatOneIn } from '../lib/format'
import { DEFAULT_BET_PRICE } from '../lib/odds'

const BUDGET_PRESETS = [56, 100, 476, 1000]

export function PlannerPage() {
  const [budget, setBudget] = useState(56)
  const plan = useMutation({ mutationFn: api.plan })
  const probabilities = useQuery({ queryKey: ['probabilities'], queryFn: api.probabilities })
  const queryClient = useQueryClient()
  const verify = useMutation({
    mutationFn: (plan: BetPlan) => api.checkOfficial(plan.games.map((g) => g.numbers)),
    // A conferência pode ter importado um concurso novo.
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['latest'] }),
  })

  const requestPlan = (value: number) => {
    verify.reset()
    plan.mutate(value)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    requestPlan(budget)
  }

  const pickBudget = (value: number) => {
    setBudget(value)
    requestPlan(value)
  }

  return (
    <section className="stack">
      <ChanceGuide onPickBudget={pickBudget} betPrice={probabilities.data?.betPrice} />
      <form className="panel row wrap" onSubmit={submit}>
        <label className="field">
          <span>Quanto quer gastar?</span>
          <input
            type="number"
            min={1}
            step="0.5"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            aria-label="Orçamento em reais"
          />
        </label>
        <div className="row wrap">
          {[probabilities.data?.betPrice ?? DEFAULT_BET_PRICE, ...BUDGET_PRESETS].map((v) => (
            <button type="button" key={v} className="chip" onClick={() => setBudget(v)}>
              {formatBRL(v)}
            </button>
          ))}
        </div>
        <button type="submit" className="primary" disabled={plan.isPending || budget <= 0}>
          {plan.isPending ? 'Analisando…' : 'Sugerir jogo'}
        </button>
      </form>

      <ErrorBox error={plan.error} />
      {plan.isPending && <Loading label="Rodando o ensemble estatístico e os embeddings…" />}

      {plan.data && (
        <>
          {plan.data.recommended ? (
            <div className="panel highlight">
              <p className="eyebrow">Recomendação para {formatBRL(plan.data.budget)} · baseado no concurso {plan.data.basedOnConcurso}</p>
              <h2>{plan.data.recommended.description}</h2>
              <p>
                Custo <strong>{formatBRL(plan.data.recommended.cost)}</strong> · chance de pelo menos um 14+:{' '}
                <strong>{formatOneIn(plan.data.recommended.oneIn)}</strong>
              </p>
              <p className="muted">{plan.data.rationale}</p>
              <p className="best-note">
                ✔ Esta é a forma de <strong>maior chance possível</strong> para {formatBRL(plan.data.budget)}. Para aumentar
                a chance, só aumentando o valor apostado.
              </p>
              <PlainWinnings plan={plan.data.recommended} />
              <div className="row wrap">
                <button
                  type="button"
                  className="primary"
                  disabled={verify.isPending}
                  onClick={() => plan.data?.recommended && verify.mutate(plan.data.recommended)}
                >
                  {verify.isPending ? 'Consultando a Caixa…' : 'Conferir última sugestão'}
                </button>
                <span className="muted small">Compara esta sugestão com o resultado mais recente do site oficial da Caixa.</span>
              </div>
              <ErrorBox error={verify.error} />
              {verify.data && <SuggestionCheck result={verify.data} />}
              <details className="more">
                <summary>Ver detalhes técnicos (probabilidades e valores por faixa)</summary>
                <h4 className="odds-title">Probabilidade real de ganhar com esta opção (0 a 100%)</h4>
                <OddsMeter odds={plan.data.recommended.odds} />
                <ReturnsPanel returns={plan.data.recommended.returns} cost={plan.data.recommended.cost} />
              </details>
            </div>
          ) : (
            <p className="error">{plan.data.rationale}</p>
          )}

          <h3>Todas as opções para esse valor</h3>
          <div className="plans">
            {plan.data.plans.map((p) => (
              <PlanOption key={`${p.kind}-${p.betSize}`} plan={p} recommended={p === plan.data.recommended || isSame(p, plan.data.recommended)} />
            ))}
          </div>
        </>
      )}

      {probabilities.data && (
        <details className="panel">
          <summary>Tabela de probabilidades exatas por quantidade de dezenas</summary>
          <table>
            <thead>
              <tr>
                <th>Dezenas</th>
                <th>Custo</th>
                <th>Chance de 14+</th>
                <th>Chance de 15</th>
              </tr>
            </thead>
            <tbody>
              {probabilities.data.rows.map((r) => (
                <tr key={r.betSize}>
                  <td>{r.betSize}</td>
                  <td>{formatBRL(r.cost)}</td>
                  <td>{formatOneIn(r.atLeast14OneIn)}</td>
                  <td>{formatOneIn(r.jackpotOneIn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  )
}

/** Resultado hipotético: quanto a sugestão teria acertado e ganho no último concurso oficial. */
function SuggestionCheck({ result: r }: { result: CheckResult }) {
  const best = Math.max(...r.bets.map((b) => b.hits))
  return (
    <div className="panel stack-sm" aria-label="Conferência da sugestão">
      <p className="eyebrow">
        Resultado oficial · concurso {r.draw.concurso} · {formatDate(r.draw.date)}
      </p>
      <NumberList numbers={r.draw.numbers} />
      <h3>
        {r.totals.prize > 0
          ? `Se tivesse apostado, você teria ganho ${formatBRL(r.totals.prize)} 🎉`
          : 'Se tivesse apostado, esta sugestão não teria sido premiada'}
      </h3>
      <p>
        Melhor jogo: <strong>{best} acertos</strong> · {r.totals.winningBets} de {r.bets.length} jogos premiados · custo{' '}
        {formatBRL(r.totals.cost)} · saldo <strong className={r.totals.net < 0 ? 'neg' : 'pos'}>{formatBRL(r.totals.net)}</strong>
      </p>
      <div className="games">
        {r.bets.map((b, i) => (
          <div key={b.numbers.join('-')} className="stack-sm">
            <GameCard
              numbers={b.numbers}
              drawn={r.draw.numbers}
              title={r.bets.length > 1 ? `Jogo ${i + 1}` : undefined}
              compact={r.bets.length > 1}
            />
            <p className="small">
              <strong>{b.hits} acertos</strong> · {b.prize > 0 ? formatBRL(b.prize) : 'sem prêmio'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function isSame(a: BetPlan, b: BetPlan | null) {
  return !!b && a.kind === b.kind && a.betSize === b.betSize && a.tickets === b.tickets
}

function PlanOption({ plan, recommended }: { plan: BetPlan; recommended: boolean }) {
  const [expanded, setExpanded] = useState(plan.games.length <= 3)
  const visible = expanded ? plan.games : plan.games.slice(0, 3)
  return (
    <article className={`panel plan${recommended ? ' recommended' : ''}`}>
      <header className="row between">
        <div>
          <h4>
            {plan.kind === 'single-bet' ? `${plan.betSize} dezenas` : `${plan.tickets} jogos de 15`}
            {recommended && <span className="badge">recomendado</span>}
          </h4>
          <p className="muted">
            {formatBRL(plan.cost)} · 14+: {formatOneIn(plan.oneIn)}
          </p>
        </div>
      </header>
      <OddsMeter odds={plan.odds} />
      <ReturnsSummary returns={plan.returns} />
      <div className="games">
        {visible.map((g, i) => (
          <div key={g.numbers.join('-')} className="stack-sm">
            <GameCard numbers={g.numbers} title={plan.games.length > 1 ? `Jogo ${i + 1}` : undefined} compact={plan.games.length > 1} />
            <NumberList numbers={g.numbers} />
            <p className="muted small">
              Soma {g.profile.sum} · {g.profile.odds} ímpares · {g.profile.primes} primos · {g.repeatsFromLast} repetidas do último
            </p>
          </div>
        ))}
      </div>
      {plan.games.length > 3 && (
        <button type="button" className="link" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Mostrar menos' : `Ver todos os ${plan.games.length} jogos`}
        </button>
      )}
    </article>
  )
}
