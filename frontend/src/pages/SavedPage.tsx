import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type { CheckResult, RecentCheckResult } from '../api/types'
import { ErrorBox, Loading } from '../components/Feedback'
import { GameCard, NumberList } from '../components/GameCard'
import { formatBRL, formatDate } from '../lib/format'
import { loadSavedBets, removeBet, type SavedBet } from '../lib/savedBets'

export function SavedPage() {
  const [bets, setBets] = useState(loadSavedBets)

  if (bets.length === 0) {
    return (
      <section className="panel">
        <h3>Nenhuma aposta salva</h3>
        <p className="muted">Na aba “Sugerir jogo”, use “💾 Salvar aposta” em uma opção para guardá-la neste navegador.</p>
      </section>
    )
  }

  return (
    <section className="stack">
      <p className="muted small">
        Apostas guardadas neste navegador. Elas só somem se você remover ou limpar os dados do navegador.
      </p>
      {bets.map((b) => (
        <SavedBetCard key={b.id} bet={b} onRemove={() => setBets(removeBet(b.id))} />
      ))}
    </section>
  )
}

function SavedBetCard({ bet, onRemove }: { bet: SavedBet; onRemove: () => void }) {
  const queryClient = useQueryClient()
  const onSuccess = () => void queryClient.invalidateQueries({ queryKey: ['latest'] })
  const latest = useMutation({ mutationFn: () => api.checkOfficial(bet.games), onSuccess })
  const [count, setCount] = useState(10)
  const recent = useMutation({ mutationFn: (n: number) => api.checkRecent(bet.games, n), onSuccess })
  const [view, setView] = useState<'latest' | 'recent' | null>(null)
  const busy = latest.isPending || recent.isPending

  const remove = () => {
    if (window.confirm('Remover esta aposta salva?')) onRemove()
  }

  return (
    <article className="panel stack-sm">
      <header className="row between wrap">
        <div>
          <h4>{bet.description}</h4>
          <p className="muted small">
            Salva em {formatDate(bet.savedAt.slice(0, 10))} · baseada no concurso {bet.basedOnConcurso} · {formatBRL(bet.cost)}
          </p>
        </div>
        <button type="button" className="link" onClick={remove}>
          Remover
        </button>
      </header>
      <div className="games">
        {bet.games.map((g, i) => (
          <div key={g.join('-')} className="stack-sm">
            <GameCard numbers={g} title={bet.games.length > 1 ? `Jogo ${i + 1}` : undefined} compact={bet.games.length > 1} />
          </div>
        ))}
      </div>
      <div className="verify stack-sm">
        <div className="row wrap">
          <button type="button" className="primary" disabled={busy} onClick={() => (setView('latest'), latest.mutate())}>
            🎯 Conferir com o último resultado
          </button>
          <label className="row">
            <span className="small">Últimos</span>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Quantidade de concursos">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="primary" disabled={busy} onClick={() => (setView('recent'), recent.mutate(count))}>
            📅 Conferir nos últimos {count === 1 ? 'resultado' : `${count} resultados`}
          </button>
        </div>
        {busy && <Loading label="Consultando a Caixa…" />}
        {view === 'latest' && <ErrorBox error={latest.error} />}
        {view === 'recent' && <ErrorBox error={recent.error} />}
        {view === 'latest' && latest.data && <LatestResult result={latest.data} />}
        {view === 'recent' && recent.data && <RecentResult result={recent.data} />}
      </div>
    </article>
  )
}

function LatestResult({ result: r }: { result: CheckResult }) {
  return (
    <div className="panel stack-sm">
      <p className="eyebrow">
        Concurso {r.draw.concurso} · {formatDate(r.draw.date)}
      </p>
      <NumberList numbers={r.draw.numbers} />
      <h3>{r.totals.prize > 0 ? `Você teria ganho ${formatBRL(r.totals.prize)} 🎉` : 'Sem prêmio neste concurso'}</h3>
      <div className="games">
        {r.bets.map((b, i) => (
          <div key={i} className="stack-sm">
            <GameCard numbers={b.numbers} drawn={r.draw.numbers} title={r.bets.length > 1 ? `Jogo ${i + 1}` : undefined} compact={r.bets.length > 1} />
            <p className="small">
              <strong>{b.hits} acertos</strong> · {b.prize > 0 ? formatBRL(b.prize) : 'sem prêmio'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecentResult({ result: r }: { result: RecentCheckResult }) {
  return (
    <div className="panel stack-sm">
      <h3>
        Em {r.rows.length} concursos: {r.totals.prize > 0 ? `teria ganho ${formatBRL(r.totals.prize)}` : 'nenhum prêmio'}
      </h3>
      <p>
        {r.totals.winningDraws} concursos premiados · gasto {formatBRL(r.totals.cost)} · saldo{' '}
        <strong className={r.totals.net < 0 ? 'neg' : 'pos'}>{formatBRL(r.totals.net)}</strong>
      </p>
      <table>
        <thead>
          <tr>
            <th>Concurso</th>
            <th>Data</th>
            <th>Acertos por jogo</th>
            <th>Prêmio</th>
          </tr>
        </thead>
        <tbody>
          {r.rows.map((row) => (
            <tr key={row.draw.concurso}>
              <td>{row.draw.concurso}</td>
              <td>{formatDate(row.draw.date)}</td>
              <td>{row.bets.map((b) => b.hits).join(' · ')}</td>
              <td className={row.prize > 0 ? 'pos' : ''}>{row.prize > 0 ? formatBRL(row.prize) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
