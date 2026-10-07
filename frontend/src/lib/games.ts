import { createContext, useContext } from 'react'

/** Regras de cada jogo (espelho de backend/src/common/lottery.ts). */
export type GameId = 'lotofacil' | 'megasena' | 'quina' | 'diadesorte'

export interface GameInfo {
  id: GameId
  name: string
  totalNumbers: number
  drawn: number
  minBet: number
  maxBet: number
  prizeHits: number[]
  fixedPrizeHits: number[]
  nearHits: number
  gridColumns: number
  defaultBetPrice: number
  /** Orçamentos sugeridos (R$) e degraus da tabela de chances (em jogos simples). */
  budgetPresets: number[]
  ladderGames: number[]
  /** Chave do localStorage das apostas salvas (a da Lotofácil é a original). */
  storageKey: string
  /** Aviso específico do jogo, mostrado no Planejador. */
  note?: string
}

export const GAMES: Record<GameId, GameInfo> = {
  lotofacil: {
    id: 'lotofacil',
    name: 'Lotofácil',
    totalNumbers: 25,
    drawn: 15,
    minBet: 15,
    maxBet: 20,
    prizeHits: [11, 12, 13, 14, 15],
    fixedPrizeHits: [11, 12, 13],
    nearHits: 14,
    gridColumns: 5,
    defaultBetPrice: 3.5,
    budgetPresets: [56, 100, 476, 1000],
    ladderGames: [1, 16, 136, 300, 1000],
    storageKey: 'lotofacil:saved-bets',
  },
  megasena: {
    id: 'megasena',
    name: 'Mega-Sena',
    totalNumbers: 60,
    drawn: 6,
    minBet: 6,
    maxBet: 20,
    prizeHits: [4, 5, 6],
    fixedPrizeHits: [],
    nearHits: 5,
    gridColumns: 10,
    defaultBetPrice: 6,
    budgetPresets: [42, 60, 168, 300],
    ladderGames: [1, 7, 28, 100, 1000],
    storageKey: 'megasena:saved-bets',
  },
  quina: {
    id: 'quina',
    name: 'Quina',
    totalNumbers: 80,
    drawn: 5,
    minBet: 5,
    maxBet: 15,
    prizeHits: [2, 3, 4, 5],
    fixedPrizeHits: [],
    nearHits: 4,
    gridColumns: 10,
    defaultBetPrice: 3,
    budgetPresets: [18, 30, 63, 150],
    ladderGames: [1, 6, 21, 100, 1000],
    storageKey: 'quina:saved-bets',
  },
  diadesorte: {
    id: 'diadesorte',
    name: 'Dia de Sorte',
    totalNumbers: 31,
    drawn: 7,
    minBet: 7,
    maxBet: 15,
    prizeHits: [4, 5, 6, 7],
    fixedPrizeHits: [4, 5],
    nearHits: 6,
    gridColumns: 7,
    defaultBetPrice: 2.5,
    budgetPresets: [20, 50, 90, 200],
    ladderGames: [1, 8, 36, 100, 1000],
    storageKey: 'diadesorte:saved-bets',
    note: 'Escolha também um Mês da Sorte no volante: qualquer mês tem a mesma chance (1 em 12) e ele não entra nas contas do app.',
  },
}

export const GAME_IDS = Object.keys(GAMES) as GameId[]

export const GameContext = createContext<GameInfo>(GAMES.lotofacil)

export function useGame(): GameInfo {
  return useContext(GameContext)
}

export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  k = Math.min(k, n - k)
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return Math.round(r)
}

export const totalCombinations = (g: GameInfo) => binomial(g.totalNumbers, g.drawn)

/** Jogos simples que fazem >= nearHits contra um sorteio fixo: Σ C(d,k)·C(N−d, d−k). */
export function winningNearPlus(g: GameInfo): number {
  let n = 0
  for (let k = g.nearHits; k <= g.drawn; k++) n += binomial(g.drawn, k) * binomial(g.totalNumbers - g.drawn, g.drawn - k)
  return n
}
