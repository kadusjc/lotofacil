import type { BetPlan } from '../api/types'
import { formatBRL } from './format'
import { totalCombinations, winningNearPlus, type GameInfo } from './games'

/** Com jogos espalhados (sem pares capazes de atingir a faixa juntos), as chances da faixa quase máxima somam exatamente. */
export function spreadGamesChance(game: GameInfo, budget: number, betPrice = game.defaultBetPrice) {
  const games = Math.floor(budget / betPrice + 1e-9)
  const total = totalCombinations(game)
  return {
    games,
    atLeastNear: Math.min(1, (games * winningNearPlus(game)) / total),
    jackpot: Math.min(1, games / total),
  }
}

export interface Outcome {
  emoji: string
  title: string
  probability: number
  money: string
  tone: 'neg' | 'mid' | 'pos'
}

/** P(pelo menos um cartão com >= hits); 0 acima do máximo. */
function atLeast(plan: BetPlan, hits: number): number {
  return plan.odds.tiers.find((t) => t.hits === hits)?.probability ?? 0
}

/** Linha do tempo em linguagem simples: "se jogar 100 vezes assim, o que acontece?" (melhor cartão por faixa). */
export function buildOutcomes(game: GameInfo, plan: BetPlan): Outcome[] {
  const { returns, cost } = plan
  const payout = (hits: number) => returns.tiers.find((t) => t.hits === hits)?.payout ?? 0
  const perCard = returns.probabilityScope === 'per-ticket' ? ' (por cartão premiado)' : ''
  const [min] = game.prizeHits
  const small = game.prizeHits.filter((h) => h < game.nearHits)
  const outcomes: Outcome[] = [
    { emoji: '😞', title: 'Não ganhar nada', probability: 1 - atLeast(plan, min), money: `perde os ${formatBRL(cost)}`, tone: 'neg' },
  ]
  if (small.length) {
    const top = small[small.length - 1]
    outcomes.push({
      emoji: '🙂',
      title: `Prêmio pequeno (${small.length > 1 ? `${small.slice(0, -1).join(', ')} ou ${top}` : top} acertos)`,
      probability: atLeast(plan, min) - atLeast(plan, game.nearHits),
      money: small.length > 1 ? `recebe de ${formatBRL(payout(min))} a ${formatBRL(payout(top))}${perCard}` : `recebe cerca de ${formatBRL(payout(min))}${perCard}`,
      tone: 'mid',
    })
  }
  for (let h = game.nearHits; h < game.drawn; h++) {
    outcomes.push({
      emoji: '🤩',
      title: `${h} acertos`,
      probability: atLeast(plan, h) - atLeast(plan, h + 1),
      money: `recebe cerca de ${formatBRL(payout(h))}${perCard}`,
      tone: 'pos',
    })
  }
  outcomes.push({
    emoji: '🏆',
    title: `${game.drawn} acertos (prêmio máximo)`,
    probability: atLeast(plan, game.drawn),
    money: `recebe cerca de ${formatBRL(payout(game.drawn))}`,
    tone: 'pos',
  })
  return outcomes
}

/** Uma aposta por linha; dezenas separadas por espaço, vírgula, ponto e vírgula ou hífen. */
export function parseBets(game: GameInfo, text: string): { bets: number[][]; errors: string[] } {
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
      nums.length >= game.minBet &&
      nums.length <= game.maxBet &&
      new Set(nums).size === nums.length &&
      nums.every((n) => Number.isInteger(n) && n >= 1 && n <= game.totalNumbers)
    if (valid) bets.push(nums)
    else errors.push(`Linha ${i + 1}: use de ${game.minBet} a ${game.maxBet} dezenas distintas entre 1 e ${game.totalNumbers}.`)
  })
  return { bets, errors }
}
