import { useState } from 'react'

/** Aviso curto, sempre visível no topo de todas as abas. */
export function DisclaimerBar() {
  return (
    <p className="disclaimer" role="note">
      <strong>⚠️ Não há garantia de ganho.</strong> Este app só sugere apostas com base em estatística e probabilidade. Os sorteios
      são aleatórios, então nenhum método aumenta a chance de um jogo ser sorteado. Ferramenta educativa, para maiores de 18 anos.
    </p>
  )
}

/** Versão dos termos: ao mudar o texto, aumente para pedir um novo aceite. */
const TERMS_VERSION = '2026-10-07'
const TERMS_KEY = 'loterias:terms-accepted'

function TermsList() {
  return (
  <ul>
    <li>
      <strong>Sem garantia de resultado.</strong> As sugestões são cálculos estatísticos e probabilísticos sobre resultados
      passados. Elas não preveem sorteios, não garantem prêmio e não reduzem o risco de perda. Toda aposta tem valor esperado
      negativo.
    </li>
    <li>
      <strong>Caráter educativo e informativo.</strong> Isto não é recomendação de investimento, consultoria financeira nem
      incentivo a apostar. A decisão de jogar, quanto e como é exclusivamente sua, assim como as consequências dela.
    </li>
    <li>
      <strong>Não oficial.</strong> Este app não tem vínculo com a Caixa Econômica Federal nem com as Loterias CAIXA, não
      vende apostas e não recebe valores de jogos. Lotofácil, Mega-Sena, Quina e Dia de Sorte são marcas da Caixa, citadas só
      para identificar os jogos. Aposte somente nos canais oficiais.
    </li>
    <li>
      <strong>Confira sempre no site oficial.</strong> Resultados, prêmios e preços são coletados automaticamente e podem
      estar atrasados, incompletos ou errados. A conferência oficial de bilhetes é a da Caixa (loterias.caixa.gov.br).
    </li>
    <li>
      <strong>Proibido para menores de 18 anos.</strong> Apostar é permitido apenas a maiores de idade.
    </li>
    <li>
      <strong>Jogue com responsabilidade.</strong> Aposte só o que pode perder, nunca para recuperar perdas ou pagar dívidas.
      Se apostar estiver trazendo prejuízo ou sofrimento, procure ajuda: Jogadores Anônimos (jogadoresanonimos.com.br) ou o
      CVV, pelo telefone 188.
    </li>
    <li>
      <strong>Privacidade.</strong> O app não pede cadastro. As apostas salvas ficam só neste navegador (armazenamento local)
      e não são enviadas a ninguém.
    </li>
    <li>
      <strong>Uso por sua conta e risco.</strong> O app é oferecido gratuitamente, “como está”, sem garantias. O desenvolvedor
      não se responsabiliza por perdas, decisões de aposta ou falhas de dados.
    </li>
  </ul>
  )
}

/** Termos completos, no rodapé. Texto informativo; não substitui orientação jurídica. */
export function LegalTerms() {
  return (
    <details className="legal">
      <summary>Aviso legal e termos de uso</summary>
      <TermsList />
    </details>
  )
}

function hasAccepted(): boolean {
  try {
    return JSON.parse(localStorage.getItem(TERMS_KEY) ?? 'null')?.version === TERMS_VERSION
  } catch {
    return false
  }
}

/**
 * Aceite obrigatório na primeira visita (sem login, vale por navegador): o app só fica utilizável
 * depois que a pessoa declara ter 18+ e aceita os termos. Sem armazenamento local, pede a cada visita.
 */
export function TermsGate() {
  const [accepted, setAccepted] = useState(hasAccepted)
  const [adult, setAdult] = useState(false)
  const [agree, setAgree] = useState(false)
  if (accepted) return null

  const accept = () => {
    try {
      localStorage.setItem(TERMS_KEY, JSON.stringify({ version: TERMS_VERSION, acceptedAt: new Date().toISOString() }))
    } catch {
      // Sem armazenamento: o aceite vale só para esta visita.
    }
    setAccepted(true)
  }

  return (
    <div className="terms-overlay">
      <div className="terms-modal" role="dialog" aria-modal="true" aria-labelledby="terms-title">
        <h2 id="terms-title">Termos de uso</h2>
        <p>
          Antes de continuar, leia com atenção. <strong>Este app não garante vitória</strong>: ele sugere apostas com base em
          estatística e probabilidade, mas os sorteios são aleatórios.
        </p>
        <div className="terms-body">
          <TermsList />
        </div>
        <label className="terms-check">
          <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
          Declaro que tenho 18 anos ou mais.
        </label>
        <label className="terms-check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          Li e aceito os termos de uso e entendo que não há garantia de ganho.
        </label>
        <button type="button" className="primary" disabled={!adult || !agree} onClick={accept}>
          Aceitar e continuar
        </button>
        <p className="muted small">Se não concordar, basta fechar esta página.</p>
      </div>
    </div>
  )
}
