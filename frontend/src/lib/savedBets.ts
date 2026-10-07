import type { BetPlan } from '../api/types'
import type { GameInfo } from './games'

/** Aposta sugerida guardada no navegador (localStorage); só sai quando o usuário remove ou limpa o navegador. */
export interface SavedBet {
  id: string
  savedAt: string
  description: string
  cost: number
  basedOnConcurso: number
  games: number[][]
}

/** Uma lista por jogo, em localStorage[game.storageKey]. */
export function loadSavedBets(game: GameInfo): SavedBet[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(game.storageKey) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function store(game: GameInfo, bets: SavedBet[]): boolean {
  try {
    localStorage.setItem(game.storageKey, JSON.stringify(bets))
    return true
  } catch {
    return false
  }
}

const gamesKey = (games: number[][]) => games.map((g) => g.join('-')).join('|')

export function isSaved(game: GameInfo, plan: BetPlan): boolean {
  const key = gamesKey(plan.games.map((g) => g.numbers))
  return loadSavedBets(game).some((b) => gamesKey(b.games) === key)
}

/** Salva a aposta (ignora duplicatas). Retorna false se o navegador bloquear o armazenamento. */
export function saveBet(game: GameInfo, plan: BetPlan, basedOnConcurso: number): boolean {
  if (isSaved(game, plan)) return true
  const bet: SavedBet = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
    description: plan.description,
    cost: plan.cost,
    basedOnConcurso,
    games: plan.games.map((g) => g.numbers),
  }
  return store(game, [bet, ...loadSavedBets(game)])
}

export function removeBet(game: GameInfo, id: string): SavedBet[] {
  const rest = loadSavedBets(game).filter((b) => b.id !== id)
  store(game, rest)
  return rest
}
