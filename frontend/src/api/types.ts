export interface PrizeTier {
  hits: number
  winners: number
  prize: number
}

export interface Draw {
  concurso: number
  date: string
  numbers: number[]
  drawOrder: number[]
  prizes: PrizeTier[]
}

export interface GameProfile {
  sum: number
  odds: number
  primes: number
  frame: number
  fibonacci: number
  maxRun: number
}

export interface SuggestedGame {
  numbers: number[]
  score: number
  cohesion: number
  profile: GameProfile
  repeatsFromLast: number
}

export interface NumberScore {
  number: number
  score: number
  components: Record<'long' | 'recent' | 'momentum' | 'delay' | 'analog', number>
}

export interface BetPlan {
  kind: 'single-bet' | 'multiple-games'
  betSize: number
  tickets: number
  cost: number
  probAtLeast14: { lower: number; upper: number; estimate: number }
  oneIn: number
  description: string
  games: SuggestedGame[]
  odds: PlanOdds
  returns: PlanReturns
}

export interface PlanReturns {
  basedOnLastDraws: number
  expectedPrize: number
  expectedNet: number
  expectedReturnPct: number
  maxPayout: number
  probabilityScope: 'bet' | 'per-ticket'
  tiers: Array<{ hits: number; probability: number; payout: number }>
}

/** Chances de 0 a 1 de pelo menos um cartão atingir cada faixa. */
export interface PlanOdds {
  atLeast11: number
  atLeast13: number
  atLeast14: number
  jackpot: number
}

export interface PlanResponse {
  budget: number
  betPrice: number
  basedOnConcurso: number
  rationale: string
  recommended: BetPlan | null
  plans: BetPlan[]
}

export interface SuggestionResponse {
  basedOnConcurso: number
  betSize: number
  games: SuggestedGame[]
  numberScores: NumberScore[]
  analogConcursos: Array<{ concurso: number; similarity: number }>
}

export interface NumberStat {
  number: number
  frequency: number
  frequencyPct: number
  recentFrequency: number
  delay: number
  averageGap: number
  maxDelay: number
}

export interface DistributionPoint {
  value: number
  count: number
  pct: number
}

export interface ProfileStat {
  p10: number
  p50: number
  p90: number
  mean: number
  distribution: DistributionPoint[]
}

export interface StatsSummary {
  totalDraws: number
  first: { concurso: number; date: string }
  last: Draw
  numbers: NumberStat[]
  profiles: Record<'sum' | 'odds' | 'primes' | 'frame' | 'repeats', ProfileStat>
  uniformity: { chiSquare: number; degreesOfFreedom: number; pValue: number; isUniform: boolean }
}

export interface ProbabilityRow {
  betSize: number
  combinations: number
  cost: number
  atLeast14: number
  atLeast14OneIn: number
  jackpotOneIn: number
}

export interface BacktestResult {
  betSize: number
  tickets: number
  budget: number | null
  plan: string
  testSize: number
  meanHits: number
  expectedRandomMeanHits: number
  meanHitsCi95: [number, number]
  hitDistribution: Array<{ hits: number; observed: number; expectedRandom: number }>
  atLeast11: number
  atLeast14: number
  totalCost: number
  totalPrize: number
  roi: number
  verdict: string
  rows: Array<{ concurso: number; game: number[]; games: number[][]; drawn: number[]; hits: number; ticketHits: number[]; prize: number }>
}

export interface SimilarDraw {
  concurso: number
  date: string
  numbers: number[]
  similarity: number
  nextNumbers: number[] | null
}

export interface SyncStatus {
  state: 'idle' | 'running' | 'done' | 'error'
  total: number
  processed: number
  imported: number
  failed: number[]
  latestConcurso: number | null
  message: string | null
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export type Signal = 'long' | 'recent' | 'momentum' | 'delay' | 'analog'

export interface BetCheck {
  numbers: number[]
  betSize: number
  cost: number
  hits: number
  hitNumbers: number[]
  prize: number
}

export interface CheckResult {
  draw: Draw
  bets: BetCheck[]
  totals: { cost: number; prize: number; net: number; winningBets: number }
  missedDrawn: number[]
  wrongPicks: number[]
  signals: Array<{ signal: Signal; top15Hits: number; meanTop15Hits: number; betAdvantage: number; previousWeight: number; newWeight: number }>
  calibrationWindow: number
}
