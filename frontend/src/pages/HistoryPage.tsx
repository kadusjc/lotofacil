import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import { ErrorBox, Loading } from '../components/Feedback'
import { GameCard, NumberList } from '../components/GameCard'
import { formatDate, formatPct } from '../lib/format'

export function HistoryPage() {
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<number | null>(null)
  const draws = useQuery({ queryKey: ['draws', page], queryFn: () => api.draws(page), placeholderData: keepPreviousData })
  const similar = useQuery({
    queryKey: ['similar', selected],
    queryFn: () => api.similar(selected!, 8),
    enabled: selected !== null,
  })
  const totalPages = draws.data ? Math.ceil(draws.data.total / draws.data.pageSize) : 1

  return (
    <section className="split">
      <div className="panel">
        <h3>Concursos</h3>
        <ErrorBox error={draws.error} />
        {draws.isLoading && <Loading />}
        <ul className="draw-list">
          {draws.data?.items.map((d) => (
            <li key={d.concurso}>
              <button className={`draw-row${selected === d.concurso ? ' active' : ''}`} onClick={() => setSelected(d.concurso)}>
                <span>
                  <strong>{d.concurso}</strong> <span className="muted small">{formatDate(d.date)}</span>
                </span>
                <NumberList numbers={d.numbers} />
              </button>
            </li>
          ))}
        </ul>
        <div className="row between">
          <button className="chip" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Mais recentes
          </button>
          <span className="muted small">
            Página {page} de {totalPages}
          </span>
          <button className="chip" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Mais antigos →
          </button>
        </div>
      </div>

      <div className="panel">
        <h3>Concursos parecidos (busca vetorial)</h3>
        {selected === null && <p className="muted">Selecione um concurso para buscar os mais similares pelo embedding no Neo4j.</p>}
        {similar.isLoading && <Loading />}
        <ErrorBox error={similar.error} />
        <div className="stack">
          {similar.data?.map((s) => (
            <div key={s.concurso} className="similar">
              <p>
                <strong>{s.concurso}</strong> · {formatDate(s.date)} · similaridade {formatPct(s.similarity)}
              </p>
              <div className="row wrap">
                <GameCard numbers={s.numbers} compact title="Sorteio" />
                {s.nextNumbers && <GameCard numbers={s.nextNumbers} compact title="Concurso seguinte" />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
