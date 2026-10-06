import { formatBRL, formatChance, formatOneIn, formatInt } from '../lib/format'
import { DEFAULT_BET_PRICE, spreadGamesChance, TOTAL_COMBINATIONS, WINNING_14_PLUS } from '../lib/odds'

/** Degraus da tabela em quantidade de jogos de 15 (o valor acompanha o preço configurado). */
const LADDER_GAMES = [1, 16, 136, 300, 1000]

interface Props {
  onPickBudget?: (budget: number) => void
  betPrice?: number
}

/** Explica, de forma direta, o que muda (e o que não muda) a chance de ganhar. */
export function ChanceGuide({ onPickBudget, betPrice = DEFAULT_BET_PRICE }: Props) {
  const ladder = LADDER_GAMES.map((games) => Number((games * betPrice).toFixed(2)))
  const top = ladder[ladder.length - 1]
  const topChance = spreadGamesChance(top, betPrice).atLeast14
  return (
    <section className="panel guide" aria-labelledby="guide-title">
      <h2 id="guide-title">Como aumentar sua chance de ganhar</h2>
      <p className="guide-lead">
        <strong>Todo jogo de 15 dezenas tem a mesma chance:</strong> 1 em {formatInt(TOTAL_COMBINATIONS)} de fazer 15 pontos e 1 em{' '}
        {formatInt(TOTAL_COMBINATIONS / WINNING_14_PLUS)} de fazer 14 ou 15. Nenhuma análise, IA ou linguagem de programação muda isso, porque o sorteio não tem memória.
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

      <h4>Quanto mais você gasta, maior a chance (e o retorno médio continua negativo)</h4>
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
          {ladder.map((budget) => {
            const c = spreadGamesChance(budget, betPrice)
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
        As barras estão na escala real de 0 a 100%. Mesmo gastando {formatBRL(top)}, a chance de 14+ fica em {formatChance(topChance)}.
        {onPickBudget && ' Clique numa linha para usar esse valor.'}
      </p>
    </section>
  )
}
