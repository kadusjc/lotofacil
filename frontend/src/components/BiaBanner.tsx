const BIA_URL = 'https://souabia.com/?utm_source=loterias-lab&utm_medium=banner&utm_campaign=apoio'

/** Banner de apoio: a Bia (souabia.com), secretária de IA no WhatsApp, mantém este app gratuito. */
export function BiaBanner() {
  return (
    <a className="bia-banner" href={BIA_URL} target="_blank" rel="noopener sponsored" aria-label="Conheça a Bia, secretária de IA no WhatsApp (abre em nova aba)">
      <img src="/bia-hero.png" alt="" width={56} height={65} />
      <span className="bia-text">
        <span className="bia-eyebrow">Este app é gratuito com o apoio da Bia</span>
        <strong>
          Sua secretária de IA no <span className="bia-hl">WhatsApp</span>, 24h por dia
        </strong>
        <span className="bia-sub">Agenda, confirma e lembra seus clientes sozinha, no Google Calendar. Pronta em 5 minutos.</span>
      </span>
      <span className="bia-cta">Testar 7 dias grátis</span>
    </a>
  )
}
