import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { api } from '../api/client'
import type { Signal } from '../api/types'
import { ErrorBox, Loading } from '../components/Feedback'
import { GameCard, NumberList } from '../components/GameCard'
import { formatBRL, formatDate } from '../lib/format'
import { parseBets } from '../lib/odds'

const SIGNAL_LABELS: Record<Signal, string> = {
  long: 'Frequência histórica',
  recent: 'Quentes (últimos 25)',
  momentum: 'Momentum',
  delay: 'Atrasadas',
  analog: 'Análogos (embeddings)',
}

export function CheckPage() {
  const [text, setText] = useState('')
  const [concurso, setConcurso] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const check = useMutation({
    mutationFn: (bets: number[][]) => api.check(bets, concurso ? Number(concurso) : undefined),
  })
  const r = check.data

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = parseBets(text)
    setErrors(parsed.errors)
    if (parsed.errors.length === 0 && parsed.bets.length > 0) check.mutate(parsed.bets)
  }

  return (
    <section className="stack">
      <form className="panel stack" onSubmit={submit}>
        <h3>Conferir minhas apostas</h3>
        <label className="field">
          <span>Uma aposta por linha (15 a 20 dezenas, separadas por espaço ou vírgula)</span>
          <textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'01 02 03 04 05 06 07 08 09 10 11 12 13 14 15\n02 04 05 07 09 10 12 13 15 17 18 20 22 23 25'}
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
      {check.isPending && <Loading label="Conferindo e recalibrando os sinais…" />}

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
                  <th>Acertos das 15 favoritas neste concurso</th>
                  <th>Média nos últimos {r.calibrationWindow}</th>
                  <th>Peso antes → depois</th>
                </tr>
              </thead>
              <tbody>
                {r.signals.map((s) => (
                  <tr key={s.signal}>
                    <td>{SIGNAL_LABELS[s.signal]}</td>
                    <td className={s.top15Hits >= 9 ? 'pos' : 'neg'}>{s.top15Hits} / 15</td>
                    <td>{s.meanTop15Hits.toFixed(2)}</td>
                    <td>
                      {s.previousWeight.toFixed(3)} → <strong>{s.newWeight.toFixed(3)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted small">
              Um sinal sem poder de previsão acerta em média 9 das suas 15 favoritas. Os pesos foram recalibrados com esses
              resultados e já valem para as próximas sugestões. Isso ajusta a IA ao que funcionou recentemente, mas não muda a
              chance real do sorteio. Use o Backtest para ver se a estratégia supera o acaso.
            </p>
          </div>
        </>
      )}
    </section>
  )
}
