import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api } from '../api/client'
import type { BetPlan } from '../api/types'
import { ErrorBox, Loading } from '../components/Feedback'
import { GameCard, NumberList } from '../components/GameCard'
import { formatBRL, formatOneIn } from '../lib/format'

const BUDGET_PRESETS = [3.5, 56, 100, 476, 1000]

export function PlannerPage() {
  const [budget, setBudget] = useState(56)
  const plan = useMutation({ mutationFn: api.plan })
  const probabilities = useQuery({ queryKey: ['probabilities'], queryFn: api.probabilities })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    plan.mutate(budget)
  }

  return (
    <section className="stack">
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
          {BUDGET_PRESETS.map((v) => (
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
