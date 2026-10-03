import { formatBRL, formatChance, formatOneIn, formatInt } from '../lib/format'

const TOTAL_COMBINATIONS = 3_268_760
/** Combinações de 15 que fazem 14 ou 15 pontos contra um sorteio: C(15,14)·C(10,1) + 1. */
const WINNING_14_PLUS = 151
const BET_PRICE = 3.5
const LADDER = [3.5, 56, 476, 1000, 3500]

/** Com jogos espalhados (≤ 12 dezenas em comum), as chances de 14+ somam exatamente. */
export function spreadGamesChance(budget: number) {
  const games = Math.floor(budget / BET_PRICE + 1e-9)
  return {
    games,
    atLeast14: Math.min(1, (games * WINNING_14_PLUS) / TOTAL_COMBINATIONS),
    jackpot: Math.min(1, games / TOTAL_COMBINATIONS),
  }
}

/** Explica, de forma direta, o que muda (e o que não muda) a chance de ganhar. */
export function ChanceGuide({ onPickBudget }: { onPickBudget?: (budget: number) => void }) {
  return (
    <section className="panel guide" aria-labelledby="guide-title">
      <h2 id="guide-title">Como aumentar sua chance de ganhar</h2>
      <p className="guide-lead">
        <strong>Todo jogo de 15 dezenas tem a mesma chance:</strong> 1 em {formatInt(TOTAL_COMBINATIONS)} de fazer 15 pontos e 1 em 21.647
        de fazer 14 ou 15. Nenhuma análise, IA ou linguagem de programação muda isso, porque o sorteio não tem memória.
      </p>

      <div className="guide-cards">
        <div className="guide-card ok">
          <span className="guide-icon" aria-hidden>↑</span>
          <h4>Apostar mais</h4>
          <p>Cada jogo a mais é mais uma combinação coberta. É a única coisa que aumenta a chance.</p>
        </div>
        <div className="guide-card ok">
          <span className="guide-icon" aria-hidden>⇄</span>
          <h4>Espalhar os jogos</h4>
          <p>Jogos com pouca dezena em comum cobrem mais do volante. O app já faz isso da forma ótima.</p>
        </div>
        <div className="guide-card ok">
          <span className="guide-icon" aria-hidden>👥</span>
          <h4>Bolão</h4>
          <p>Divide o custo de uma aposta grande. A chance sobe, mas o prêmio também é dividido.</p>
        </div>
        <div className="guide-card no">
          <span className="guide-icon" aria-hidden>×</span>
          <h4>O que não funciona</h4>
          <p>Dezenas quentes, atrasadas, padrões, IA ou "jogo campeão". Nada disso muda a chance.</p>
        </div>
      </div>

      <h4>Quanto mais você gasta, maior a chance (e o retorno médio continua cerca de −54%)</h4>
      <table className="guide-table">
        <thead>
          <tr>
            <th>Gasto</th>
            <th>Jogos de 15</th>
            <th>Chance de 14 ou 15</th>
            <th>Chance de 15</th>
            <th aria-label="Barra de chance de 14 ou 15" />
          </tr>
        </thead>
        <tbody>
          {LADDER.map((budget) => {
            const c = spreadGamesChance(budget)
            return (
              <tr key={budget} className={onPickBudget ? 'clickable' : undefined} onClick={() => onPickBudget?.(budget)}>
                <td><strong>{formatBRL(budget)}</strong></td>
                <td>{formatInt(c.games)}</td>
                <td>
                  {formatChance(c.atLeast14)} <span className="muted small">({formatOneIn(Math.round(1 / c.atLeast14))})</span>
                </td>
                <td>{formatChance(c.jackpot)}</td>
                <td className="bar-cell">
                  <div className="meter">
                    <div className="meter-fill" style={{ width: `${c.atLeast14 * 100}%` }} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="muted small">
        As barras estão na escala real de 0 a 100%. Mesmo gastando R$ 3.500, a chance de 14+ fica abaixo de 5%.
        {onPickBudget && ' Clique numa linha para usar esse valor.'}
      </p>
    </section>
  )
}
