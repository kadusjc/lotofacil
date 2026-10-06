import type {
  BacktestResult,
  CheckResult,
  Draw,
  Paginated,
  PlanResponse,
  ProbabilityRow,
  SimilarDraw,
  StatsSummary,
  SuggestionResponse,
  SyncStatus,
} from './types'

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

export const api = {
  latest: () => request<Draw | null>('/draws/latest'),
  draws: (page: number, pageSize = 20) => request<Paginated<Draw>>(`/draws?page=${page}&pageSize=${pageSize}`),
  similar: (concurso: number, k = 10) => request<SimilarDraw[]>(`/draws/${concurso}/similar?k=${k}`),
  summary: () => request<StatsSummary>('/stats/summary'),
  probabilities: () => request<{ betPrice: number; rows: ProbabilityRow[] }>('/probabilities'),
  plan: (budget: number) => post<PlanResponse>('/plan', { budget }),
  suggest: (betSize: number, games: number) => post<SuggestionResponse>('/suggestions', { betSize, games }),
  backtest: (betSize: number, testSize: number, budget?: number) =>
    post<BacktestResult>('/backtest', { betSize, testSize, budget }),
  check: (bets: number[][], concurso?: number) => post<CheckResult>('/check', { bets, concurso }),
  startSync: () => post<SyncStatus>('/sync', {}),
  syncStatus: () => request<SyncStatus>('/sync/status'),
}
