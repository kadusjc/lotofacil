import type {
  BacktestResult,
  CheckResult,
  Draw,
  Paginated,
  PlanResponse,
  ProbabilityRow,
  RecentCheckResult,
  SimilarDraw,
  StatsSummary,
  SuggestionResponse,
  SyncStatus,
} from './types'
import type { GameId } from '../lib/games'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const message = Array.isArray(body?.message) ? body.message.join('; ') : body?.message
    throw new ApiError(res.status, message ?? `Erro ${res.status}`)
  }
  return res.json() as Promise<T>
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) })

/** Todas as rotas são por jogo: /api/{jogo}/... */
export const api = {
  latest: (g: GameId) => request<Draw | null>(`/${g}/draws/latest`),
  draws: (g: GameId, page: number, pageSize = 20) => request<Paginated<Draw>>(`/${g}/draws?page=${page}&pageSize=${pageSize}`),
  similar: (g: GameId, concurso: number, k = 10) => request<SimilarDraw[]>(`/${g}/draws/${concurso}/similar?k=${k}`),
  summary: (g: GameId) => request<StatsSummary>(`/${g}/stats/summary`),
  probabilities: (g: GameId) => request<{ betPrice: number; rows: ProbabilityRow[] }>(`/${g}/probabilities`),
  plan: (g: GameId, budget: number) => post<PlanResponse>(`/${g}/plan`, { budget }),
  suggest: (g: GameId, betSize: number, games: number) => post<SuggestionResponse>(`/${g}/suggestions`, { betSize, games }),
  backtest: (g: GameId, betSize: number, testSize: number, budget?: number) =>
    post<BacktestResult>(`/${g}/backtest`, { betSize, testSize, budget }),
  check: (g: GameId, bets: number[][], concurso?: number) => post<CheckResult>(`/${g}/check`, { bets, concurso }),
  /** Confere contra o último resultado buscado na hora no portal da Caixa. */
  checkOfficial: (g: GameId, bets: number[][]) => post<CheckResult>(`/${g}/check`, { bets, official: true }),
  checkRecent: (g: GameId, bets: number[][], count = 10) => post<RecentCheckResult>(`/${g}/check/recent`, { bets, count }),
  startSync: (g: GameId) => post<SyncStatus>(`/${g}/sync`, {}),
  syncStatus: (g: GameId) => request<SyncStatus>(`/${g}/sync/status`),
}
