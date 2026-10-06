import type { BetPlan } from '../api/types'

/** Aposta sugerida guardada no navegador (localStorage); só sai quando o usuário remove ou limpa o navegador. */
export interface SavedBet {
  id: string
  savedAt: string
  description: string
  cost: number
  basedOnConcurso: number
  games: number[][]
}

const KEY = 'lotofacil:saved-bets'

export function loadSavedBets(): SavedBet[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function store(bets: SavedBet[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(bets))
    return true
  } catch {
    return false
  }
}

const gamesKey = (games: number[][]) => games.map((g) => g.join('-')).join('|')

export function isSaved(plan: BetPlan): boolean {
  const key = gamesKey(plan.games.map((g) => g.numbers))
  return loadSavedBets().some((b) => gamesKey(b.games) === key)
}

/** Salva a aposta (ignora duplicatas). Retorna false se o navegador bloquear o armazenamento. */
export function saveBet(plan: BetPlan, basedOnConcurso: number): boolean {
  if (isSaved(plan)) return true
  const bet: SavedBet = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
    description: plan.description,
    cost: plan.cost,
    basedOnConcurso,
    games: plan.games.map((g) => g.numbers),
  }
  return store([bet, ...loadSavedBets()])
}

export function removeBet(id: string): SavedBet[] {
  const rest = loadSavedBets().filter((b) => b.id !== id)
  store(rest)
  return rest
}
