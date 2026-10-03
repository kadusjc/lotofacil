import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from './api/client'
import { ErrorBox } from './components/Feedback'
import { NumberList } from './components/GameCard'
import { formatDate } from './lib/format'
import { BacktestPage } from './pages/BacktestPage'
import { HistoryPage } from './pages/HistoryPage'
import { PlannerPage } from './pages/PlannerPage'
import { StatsPage } from './pages/StatsPage'

const TABS = {
  planner: { label: 'Sugerir jogo', Page: PlannerPage },
  stats: { label: 'Estatísticas', Page: StatsPage },
  backtest: { label: 'Backtest', Page: BacktestPage },
  history: { label: 'Histórico', Page: HistoryPage },
} as const
type Tab = keyof typeof TABS

export default function App() {
  const [tab, setTab] = useState<Tab>('planner')
  const { Page } = TABS[tab]
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <CloverIcon />
            <div>
              <h1>Lotofácil Lab</h1>
              <p className="small">Estatística, grafo e embeddings sobre todo o histórico oficial</p>
            </div>
          </div>
          <SyncBar />
        </div>
      </header>
    <div className="app">
      <nav className="tabs" role="tablist">
        {(Object.keys(TABS) as Tab[]).map((key) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {TABS[key].label}
          </button>
        ))}
      </nav>
      <main>
        <Page />
      </main>
      <footer className="muted small">
        Cada combinação de 15 dezenas tem exatamente a mesma chance (1 em 3.268.760) de ser sorteada; nenhuma análise de
        resultados passados muda isso. Use este app como ferramenta de estudo e jogue apenas o que pode perder.
      </footer>
    </div>
    </>
  )
}

function SyncBar() {
  const queryClient = useQueryClient()
  const latest = useQuery({ queryKey: ['latest'], queryFn: api.latest })
  const [polling, setPolling] = useState(false)
  const status = useQuery({ queryKey: ['sync'], queryFn: api.syncStatus, refetchInterval: polling ? 1500 : false })
  const start = useMutation({ mutationFn: api.startSync, onSuccess: () => setPolling(true) })

  const state = status.data?.state
  useEffect(() => {
    if (state === 'running') setPolling(true)
    if (polling && (state === 'done' || state === 'error')) {
      setPolling(false)
      void queryClient.invalidateQueries()
    }
  }, [state, polling, queryClient])

  const running = state === 'running' || start.isPending
  return (
    <div className="sync">
      {latest.data && (
        <div className="latest">
          <span className="muted small">
            Último: {latest.data.concurso} · {formatDate(latest.data.date)}
          </span>
          <NumberList numbers={latest.data.numbers} />
        </div>
      )}
      <button onClick={() => start.mutate()} disabled={running}>
        {running ? `Sincronizando ${status.data?.processed ?? 0}/${status.data?.total ?? '…'}` : 'Atualizar resultados'}
      </button>
      {state === 'done' && status.data?.message && <span className="muted small">{status.data.message}</span>}
      <ErrorBox error={start.error ?? (state === 'error' ? status.data?.message : null)} />
    </div>
  )
}

/** Trevo estilizado (ícone genérico, não é marca). */
function CloverIcon() {
  return (
    <svg className="brand-icon" viewBox="0 0 40 40" aria-hidden>
      <g fill="currentColor">
        <circle cx="14" cy="14" r="8" />
        <circle cx="26" cy="14" r="8" />
        <circle cx="14" cy="26" r="8" />
        <circle cx="26" cy="26" r="8" />
      </g>
      <circle cx="20" cy="20" r="4" fill="#930089" />
    </svg>
  )
}
