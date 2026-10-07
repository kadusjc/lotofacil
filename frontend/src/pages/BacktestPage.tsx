import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api/client'
import { ErrorBox, Loading } from '../components/Feedback'
import { NumberList } from '../components/GameCard'
import { formatBRL, formatPct } from '../lib/format'
import { useGame } from '../lib/games'

export function BacktestPage() {
  const game = useGame()
  const [betSize, setBetSize] = useState(game.drawn)
  const [testSize, setTestSize] = useState(100)
  const [budget, setBudget] = useState('')
  const run = useMutation({ mutationFn: () => api.backtest(game.id, betSize, testSize, budget ? Number(budget) : undefined) })
  const sizes = Array.from({ length: game.maxBet - game.minBet + 1 }, (_, i) => game.minBet + i)
  const r = run.data

  return (
    <section className="stack">
      <div className="panel">
        <p>
          O backtest simula o passado sem trapaça: para cada concurso, o motor só enxerga os resultados anteriores, sugere um
          jogo e conferimos com o que saiu de verdade. É a forma honesta de saber se a estratégia funciona.
        </p>
        <div className="row wrap">
          <label className="field">
            <span>Dezenas</span>
            <select value={betSize} onChange={(e) => setBetSize(Number(e.target.value))} disabled={!!budget}>
              {sizes.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Concursos testados</span>
            <select value={testSize} onChange={(e) => setTestSize(Number(e.target.value))}>
              {[50, 100, 200, 300].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Ou orçamento por concurso (R$)</span>
            <input type="number" min={game.defaultBetPrice} step="0.5" placeholder={`ex.: ${game.budgetPresets[0]}`} value={budget} onChange={(e) => setBudget(e.target.value)} />
          </label>
          <button className="primary" onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? 'Rodando…' : 'Rodar backtest'}
          </button>
        </div>
      </div>

      <ErrorBox error={run.error} />
      {run.isPending && <Loading label="Simulando concurso a concurso…" />}

      {r && (
        <>
          <div className="panel highlight">
            <p className="eyebrow">
              Testado: {r.plan}
              {r.budget ? ` (${formatBRL(r.budget)} por concurso)` : ''}
            </p>
            <p>{r.verdict}</p>
          </div>
          <div className="kpis">
            <div className="panel kpi">
              <span className="muted small">Média de acertos{r.tickets > 1 ? ' por bilhete' : ''}</span>
              <strong>{r.meanHits.toFixed(2)}</strong>
              <span className="muted small">acaso: {r.expectedRandomMeanHits.toFixed(2)}</span>
            </div>
            <div className="panel kpi">
              <span className="muted small">Concursos premiados ({game.prizeHits[0]}+)</span>
              <strong>{r.atLeastMin}</strong>
              <span className="muted small">de {r.testSize}</span>
            </div>
            <div className="panel kpi">
              <span className="muted small">{game.nearHits} ou mais acertos</span>
              <strong>{r.atLeastNear}</strong>
            </div>
            <div className="panel kpi">
              <span className="muted small">Gasto × prêmios</span>
              <strong>{formatBRL(r.totalPrize - r.totalCost)}</strong>
              <span className="muted small">
                {formatBRL(r.totalCost)} gastos · retorno {formatPct(r.roi)}
              </span>
            </div>
          </div>
          <div className="panel">
            <h3>Distribuição de acertos: estratégia × acaso</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={r.hitDistribution} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="hits" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                <Tooltip formatter={(v) => Number(v).toFixed(1)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
                <Legend />
                <Bar dataKey="observed" name="Estratégia" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expectedRandom" name="Acaso (esperado)" fill="var(--neutral)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="panel">
            <summary>Concurso a concurso</summary>
            <table>
              <thead>
                <tr>
                  <th>Concurso</th>
                  <th>{r.tickets > 1 ? 'Melhor bilhete' : 'Jogo sugerido'}</th>
                  <th>Acertos{r.tickets > 1 ? ' (melhor)' : ''}</th>
                  <th>Prêmio</th>
                </tr>
              </thead>
              <tbody>
                {[...r.rows].reverse().map((row) => (
                  <tr key={row.concurso}>
                    <td>{row.concurso}</td>
                    <td>
                      <NumberList numbers={row.games[row.ticketHits.indexOf(row.hits)] ?? row.game} />
                    </td>
                    <td>{row.hits}</td>
                    <td>{row.prize ? formatBRL(row.prize) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  )
}
