import type { BetPlan } from '../api/types'
import { formatBRL } from './format'

export const TOTAL_COMBINATIONS = 3_268_760
/** Combinações de 15 que fazem 14 ou 15 pontos contra um sorteio: C(15,14)·C(10,1) + 1. */
export const WINNING_14_PLUS = 151
/** Preço da aposta simples usado até a API informar o valor configurado. */
export const DEFAULT_BET_PRICE = 3.5

/** Com jogos espalhados (≤ 12 dezenas em comum), as chances de 14+ somam exatamente. */
export function spreadGamesChance(budget: number, betPrice = DEFAULT_BET_PRICE) {
  const games = Math.floor(budget / betPrice + 1e-9)
  return {
    games,
    atLeast14: Math.min(1, (games * WINNING_14_PLUS) / TOTAL_COMBINATIONS),
    jackpot: Math.min(1, games / TOTAL_COMBINATIONS),
  }
}

export interface Outcome {
  emoji: string
  title: string
  probability: number
  money: string
  tone: 'neg' | 'mid' | 'pos'
}

/** Linha do tempo em linguagem simples: "se jogar 100 vezes assim, o que acontece?". */
export function buildOutcomes(plan: BetPlan): Outcome[] {
  const { odds, returns, cost } = plan
  const payout = (hits: number) => returns.tiers.find((t) => t.hits === hits)?.payout ?? 0
  const perCard = returns.probabilityScope === 'per-ticket' ? ' (por cartão premiado)' : ''
  return [
    {
      emoji: '😞',
      title: 'Não ganhar nada',
      probability: 1 - odds.atLeast11,
      money: `perde os ${formatBRL(cost)}`,
      tone: 'neg',
    },
    {
      emoji: '🙂',
      title: 'Prêmio pequeno (11, 12 ou 13 pontos)',
      probability: odds.atLeast11 - odds.atLeast14,
      money: `recebe de ${formatBRL(payout(11))} a ${formatBRL(payout(13))}${perCard}`,
      tone: 'mid',
    },
    {
      emoji: '🤩',
      title: '14 pontos',
      probability: odds.atLeast14 - odds.jackpot,
      money: `recebe cerca de ${formatBRL(payout(14))}${perCard}`,
      tone: 'pos',
    },
    {
      emoji: '🏆',
      title: '15 pontos (prêmio máximo)',
      probability: odds.jackpot,
      money: `recebe cerca de ${formatBRL(payout(15))}`,
      tone: 'pos',
    },
  ]
}

/** Uma aposta por linha; dezenas separadas por espaço, vírgula, ponto e vírgula ou hífen. */
export function parseBets(text: string): { bets: number[][]; errors: string[] } {
  const bets: number[][] = []
  const errors: string[] = []
  // Numera pela linha real do texto (linhas em branco são ignoradas, mas contam na numeração).
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim()
    if (!line) return
    const nums = line
      .split(/[\s,;-]+/)
      .filter(Boolean)
      .map(Number)
    const valid =
      nums.length >= 15 &&
      nums.length <= 20 &&
      new Set(nums).size === nums.length &&
      nums.every((n) => Number.isInteger(n) && n >= 1 && n <= 25)
    if (valid) bets.push(nums)
    else errors.push(`Linha ${i + 1}: use de 15 a 20 dezenas distintas entre 1 e 25.`)
  })
  return { bets, errors }
}
