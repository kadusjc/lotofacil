import { Draw, isValidGame, LotteryGame, PrizeTier, sortAsc } from '../common/lottery';

/** Formato (parcial) retornado pela API pública do portal de loterias da Caixa. */
export interface CaixaResponse {
  numero: number;
  dataApuracao: string;
  listaDezenas: string[];
  dezenasSorteadasOrdemSorteio?: string[] | null;
  listaRateioPremio?: Array<{
    descricaoFaixa: string;
    faixa: number;
    numeroDeGanhadores: number;
    valorPremio: number;
  }> | null;
  numeroConcursoAnterior?: number;
  numeroConcursoProximo?: number;
}

export class CaixaParseError extends Error {}

/** dd/mm/yyyy → yyyy-mm-dd */
export function parseBrDate(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value?.trim() ?? '');
  if (!match) throw new CaixaParseError(`Data inválida: ${value}`);
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function parseCaixaResponse(game: LotteryGame, payload: CaixaResponse): Draw {
  if (!payload || typeof payload.numero !== 'number') {
    throw new CaixaParseError('Resposta sem número de concurso');
  }
  const numbers = sortAsc((payload.listaDezenas ?? []).map((d) => Number.parseInt(d, 10)));
  if (!isValidGame(game, numbers)) {
    throw new CaixaParseError(`Concurso ${payload.numero}: dezenas inválidas (${payload.listaDezenas})`);
  }
  const order = (payload.dezenasSorteadasOrdemSorteio ?? []).map((d) => Number.parseInt(d, 10));
  const prizes: PrizeTier[] = (payload.listaRateioPremio ?? [])
    .map((tier) => {
      const match = /(\d+)\s*acertos/i.exec(tier.descricaoFaixa ?? '');
      // Faixa 1 = prêmio máximo (todas as dezenas sorteadas).
      const hits = match ? Number(match[1]) : game.drawn + 1 - tier.faixa;
      return { hits, winners: tier.numeroDeGanhadores ?? 0, prize: tier.valorPremio ?? 0 };
    })
    .filter((t) => game.prizeHits.includes(t.hits));

  return {
    concurso: payload.numero,
    date: parseBrDate(payload.dataApuracao),
    numbers,
    drawOrder: isValidGame(game, order) ? order : numbers,
    prizes,
  };
}
