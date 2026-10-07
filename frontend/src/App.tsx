import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react'
import { api } from './api/client'
import { BiaBanner } from './components/BiaBanner'
import { DisclaimerBar, LegalTerms, TermsGate } from './components/LegalNotice'
import { DEV_LINKEDIN, DEV_NAME } from './lib/credits'
import { ErrorBox, Loading } from './components/Feedback'
import { NumberList } from './components/GameCard'
import { formatDate, formatInt } from './lib/format'
import { GAME_IDS, GameContext, GAMES, totalCombinations, useGame, type GameId } from './lib/games'
import { PlannerPage } from './pages/PlannerPage'

// Abas secundárias (e o recharts) só são baixadas quando abertas.
const StatsPage = lazy(() => import('./pages/StatsPage').then((m) => ({ default: m.StatsPage })))
const BacktestPage = lazy(() => import('./pages/BacktestPage').then((m) => ({ default: m.BacktestPage })))
const CheckPage = lazy(() => import('./pages/CheckPage').then((m) => ({ default: m.CheckPage })))
const SavedPage = lazy(() => import('./pages/SavedPage').then((m) => ({ default: m.SavedPage })))
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage })))

const TABS = {
  planner: { label: 'Sugerir jogo', Page: PlannerPage },
  saved: { label: 'Apostas salvas', Page: SavedPage },
  check: { label: 'Conferir apostas', Page: CheckPage },
  stats: { label: 'Estatísticas', Page: StatsPage },
  backtest: { label: 'Backtest', Page: BacktestPage },
  history: { label: 'Histórico', Page: HistoryPage },
} as const
type Tab = keyof typeof TABS

const GAME_KEY = 'loterias:game'

function initialGame(): GameId {
  try {
    const saved = localStorage.getItem(GAME_KEY)
    return saved && Object.hasOwn(GAMES, saved) ? (saved as GameId) : 'lotofacil'
  } catch {
    return 'lotofacil'
  }
}

export default function App() {
  const [gameId, setGameId] = useState<GameId>(initialGame)
  const [tab, setTab] = useState<Tab>('planner')
  const { Page } = TABS[tab]
  const game = GAMES[gameId]
  const pickGame = (id: GameId) => {
    setGameId(id)
    try {
      localStorage.setItem(GAME_KEY, id)
    } catch {
      // Sem armazenamento: só não lembra o jogo na próxima visita.
    }
  }
  return (
    <GameContext.Provider value={game}>
    <div className="theme" data-game={gameId} style={{ '--cols': game.gridColumns } as CSSProperties}>
      <TermsGate />
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <CloverIcon />
            <div>
              <h1>{game.name} Lab</h1>
              <p className="small">Estatística, grafo e embeddings sobre todo o histórico oficial</p>
            </div>
          </div>
          <SyncBar key={gameId} />
        </div>
        <nav className="game-tabs" role="tablist" aria-label="Jogo">
          {GAME_IDS.map((id) => (
            <button key={id} role="tab" aria-selected={gameId === id} className={gameId === id ? 'active' : ''} onClick={() => pickGame(id)}>
              {GAMES[id].name}
            </button>
          ))}
        </nav>
      </header>
    <div className="app">
      <DisclaimerBar />
      <BiaBanner />
      <nav className="tabs" role="tablist">
        {(Object.keys(TABS) as Tab[]).map((key) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {TABS[key].label}
          </button>
        ))}
      </nav>
      <main>
        <Suspense fallback={<Loading />}>
          {/* key: cada jogo começa com o estado da aba zerado. */}
          <Page key={gameId} />
        </Suspense>
      </main>
      <footer className="muted small">
        Cada combinação de {game.drawn} dezenas tem exatamente a mesma chance (1 em {formatInt(totalCombinations(game))}) de ser
        sorteada; nenhuma análise de resultados passados muda isso. Use este app como ferramenta de estudo e jogue apenas o que pode perder.
        <LegalTerms />
        <p className="credit">
          Desenvolvido por{' '}
          {DEV_LINKEDIN ? (
            <a href={DEV_LINKEDIN} target="_blank" rel="noopener">
              {DEV_NAME} (LinkedIn)
            </a>
          ) : (
            DEV_NAME
          )}{' '}
          · Apoio:{' '}
          <a href="https://souabia.com/?utm_source=loterias-lab&utm_medium=footer" target="_blank" rel="noopener sponsored">
            Bia, secretária de IA no WhatsApp
          </a>
        </p>
      </footer>
    </div>
    </div>
    </GameContext.Provider>
  )
}

function SyncBar() {
  const { id } = useGame()
  const queryClient = useQueryClient()
  const latest = useQuery({ queryKey: [id, 'latest'], queryFn: () => api.latest(id) })
  const status = useQuery({
    queryKey: [id, 'sync'],
    queryFn: () => api.syncStatus(id),
    refetchInterval: (query) => (query.state.data?.state === 'running' ? 1500 : false),
  })
  const start = useMutation({
    mutationFn: () => api.startSync(id),
    onSuccess: (data) => queryClient.setQueryData([id, 'sync'], data),
  })

  // Ao terminar uma sincronização, recarrega tudo que depende dos concursos.
  const state = status.data?.state
  const previousState = useRef(state)
  useEffect(() => {
    if (previousState.current === 'running' && state !== 'running') void queryClient.invalidateQueries({ queryKey: [id] })
    previousState.current = state
  }, [state, queryClient, id])

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
      <circle cx="20" cy="20" r="4" fill="var(--accent)" />
    </svg>
  )
}
