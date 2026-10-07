import { formatBRL, formatChance, formatOneIn, formatInt } from '../lib/format'
import { totalCombinations, useGame, winningNearPlus } from '../lib/games'
import { spreadGamesChance } from '../lib/odds'

interface Props {
  onPickBudget?: (budget: number) => void
  betPrice?: number
}

/** Explica, de forma direta, o que muda (e o que não muda) a probabilidade de cada aposta. */
export function ChanceGuide({ onPickBudget, betPrice: price }: Props) {
  const game = useGame()
  const betPrice = price ?? game.defaultBetPrice
  const d = game.drawn
  const near = game.nearHits
  const ladder = game.ladderGames.map((games) => Number((games * betPrice).toFixed(2)))
  const top = ladder[ladder.length - 1]
  const topChance = spreadGamesChance(game, top, betPrice).atLeastNear
  return (
    <section className="panel guide" aria-labelledby="guide-title">
      <h2 id="guide-title">Entenda suas chances de verdade</h2>
      <p className="guide-lead">
        <strong>Todo jogo de {d} dezenas tem a mesma chance:</strong> 1 em {formatInt(totalCombinations(game))} de fazer {d} acertos e 1 em{' '}
        {formatInt(totalCombinations(game) / winningNearPlus(game))} de fazer {near} ou mais. Nenhuma análise, IA ou linguagem de programação muda isso, porque o sorteio não tem memória.
      </p>

      <div className="guide-cards">
        <div className="guide-card ok">
          <span className="guide-icon" aria-hidden>↑</span>
          <h4>Apostar mais</h4>
          <p>Cada jogo a mais cobre mais uma combinação, mas o gasto e a perda média crescem junto.</p>
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
            <th>Jogos de {d}</th>
            <th>Chance de {near}+</th>
            <th>Chance de {d}</th>
            <th aria-label={`Barra de chance de ${near}+`} />
          </tr>
        </thead>
        <tbody>
          {ladder.map((budget) => {
            const c = spreadGamesChance(game, budget, betPrice)
            return (
              <tr key={budget} className={onPickBudget ? 'clickable' : undefined} onClick={() => onPickBudget?.(budget)}>
                <td><strong>{formatBRL(budget)}</strong></td>
                <td>{formatInt(c.games)}</td>
                <td>
                  {formatChance(c.atLeastNear)} <span className="muted small">({formatOneIn(Math.round(1 / c.atLeastNear))})</span>
                </td>
                <td>{formatChance(c.jackpot)}</td>
                <td className="bar-cell">
                  <div className="meter">
                    <div className="meter-fill" style={{ width: `${c.atLeastNear * 100}%` }} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="muted small">
        As barras estão na escala real de 0 a 100%. Mesmo gastando {formatBRL(top)}, a chance de {near}+ fica em {formatChance(topChance)}.
        {onPickBudget && ' Clique numa linha para usar esse valor.'}
      </p>
    </section>
  )
}
