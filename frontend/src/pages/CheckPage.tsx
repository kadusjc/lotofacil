import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api } from '../api/client'
import type { Signal } from '../api/types'
import { ErrorBox, Loading } from '../components/Feedback'
import { GameCard, NumberList } from '../components/GameCard'
import { formatBRL, formatDate } from '../lib/format'
import { useGame } from '../lib/games'
import { parseBets } from '../lib/odds'

const SIGNAL_LABELS: Record<Signal, string> = {
  long: 'Frequência histórica',
  recent: 'Quentes (recentes)',
  momentum: 'Momentum',
  delay: 'Atrasadas',
  analog: 'Análogos (embeddings)',
}

export function CheckPage() {
  const game = useGame()
  const [text, setText] = useState('')
  const [concurso, setConcurso] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const check = useMutation({
    mutationFn: (bets: number[][]) => api.check(game.id, bets, concurso ? Number(concurso) : undefined),
  })
  const r = check.data

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = parseBets(game, text)
    setErrors(parsed.errors)
    if (parsed.errors.length === 0 && parsed.bets.length > 0) check.mutate(parsed.bets)
  }

  return (
    <section className="stack">
      <form className="panel stack" onSubmit={submit}>
        <h3>Conferir minhas apostas da {game.name}</h3>
        <label className="field">
          <span>Uma aposta por linha ({game.minBet} a {game.maxBet} dezenas, separadas por espaço ou vírgula)</span>
          <textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder(game.drawn, game.totalNumbers)}
          />
        </label>
        <div className="row wrap">
          <label className="field">
            <span>Concurso (vazio = último)</span>
            <input type="number" min={1} value={concurso} onChange={(e) => setConcurso(e.target.value)} />
          </label>
          <button type="submit" className="primary" disabled={check.isPending || !text.trim()}>
            {check.isPending ? 'Conferindo…' : 'Conferir'}
          </button>
        </div>
        {errors.map((err) => (
          <p key={err} className="error" role="alert">
            {err}
          </p>
        ))}
      </form>

      <ErrorBox error={check.error} />
      {check.isPending && <Loading label="Conferindo e avaliando os sinais…" />}

      {r && (
        <>
          <div className="panel highlight">
            <p className="eyebrow">
              Concurso {r.draw.concurso} · {formatDate(r.draw.date)}
            </p>
            <NumberList numbers={r.draw.numbers} />
            <h2>
              {r.totals.prize > 0
                ? `Você ganhou ${formatBRL(r.totals.prize)} 🎉`
                : 'Nenhuma aposta premiada desta vez'}
            </h2>
            <p>
              {r.totals.winningBets} de {r.bets.length} apostas premiadas · gasto {formatBRL(r.totals.cost)} · saldo{' '}
              <strong className={r.totals.net < 0 ? 'neg' : 'pos'}>{formatBRL(r.totals.net)}</strong>
            </p>
          </div>

          <div className="games">
            {r.bets.map((b, i) => (
              <div key={i} className="stack-sm">
                <GameCard numbers={b.numbers} drawn={r.draw.numbers} title={`Aposta ${i + 1}`} compact={r.bets.length > 1} />
                <p className="small">
                  <strong>{b.hits} acertos</strong> · {b.prize > 0 ? formatBRL(b.prize) : 'sem prêmio'}
                </p>
              </div>
            ))}
          </div>

          <div className="panel">
            <h3>Onde errou</h3>
            <div className="small">
              Sorteadas que nenhuma aposta marcou: <NumberList numbers={r.missedDrawn} />
            </div>
            <div className="small">
              Marcadas que não saíram: <NumberList numbers={r.wrongPicks} />
            </div>
            <h4>Desempenho de cada sinal da IA</h4>
            <table>
              <thead>
                <tr>
                  <th>Sinal</th>
                  <th>Acertos das {r.topSize} favoritas neste concurso</th>
                  <th>Média nos últimos {r.calibrationWindow}</th>
                </tr>
              </thead>
              <tbody>
                {r.signals.map((s) => (
                  <tr key={s.signal}>
                    <td>{SIGNAL_LABELS[s.signal]}</td>
                    <td className={s.topHits >= r.randomTopHits ? 'pos' : 'neg'}>
                      {s.topHits} / {r.topSize}
                    </td>
                    <td>{s.meanTopHits.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted small">
              Um sinal sem poder de previsão acerta em média {r.randomTopHits.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} das
              suas {r.topSize} favoritas, e esse número varia bastante de um concurso para outro só por acaso. Por isso os pesos não são ajustados pela conferência: correr atrás dos últimos resultados seria
              perseguir ruído. Use o Backtest para ver se a estratégia supera o acaso.
            </p>
          </div>
        </>
      )}
    </section>
  )
}

/** Exemplo: duas apostas simples (1..d e d dezenas espalhadas). */
function placeholder(d: number, total: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const first = Array.from({ length: d }, (_, i) => pad(i + 1)).join(' ')
  const spread = Array.from({ length: d }, (_, i) => pad(Math.floor((i * total) / d) + 1)).join(' ')
  return `${first}\n${spread}`
}
