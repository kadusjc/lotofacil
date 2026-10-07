import { LOTOFACIL as G } from '../common/lottery';
import { CaixaParseError, parseBrDate, parseCaixaResponse } from './caixa.parser';

const payload = {
  numero: 3795,
  dataApuracao: '02/10/2026',
  listaDezenas: ['01', '03', '04', '05', '06', '08', '10', '11', '12', '13', '14', '18', '19', '22', '24'],
  dezenasSorteadasOrdemSorteio: ['11', '14', '04', '08', '05', '18', '03', '24', '01', '06', '22', '10', '13', '12', '19'],
  listaRateioPremio: [
    { descricaoFaixa: '15 acertos', faixa: 1, numeroDeGanhadores: 1, valorPremio: 1452755.06 },
    { descricaoFaixa: '11 acertos', faixa: 5, numeroDeGanhadores: 900000, valorPremio: 7 },
  ],
};

describe('caixa parser', () => {
  it('parses a real response', () => {
    const d = parseCaixaResponse(G, payload);
    expect(d.concurso).toBe(3795);
    expect(d.date).toBe('2026-10-02');
    expect(d.numbers[0]).toBe(1);
    expect(d.drawOrder[0]).toBe(11);
    expect(d.prizes).toEqual([
      { hits: 15, winners: 1, prize: 1452755.06 },
      { hits: 11, winners: 900000, prize: 7 },
    ]);
  });
  it('falls back to sorted numbers when order missing', () => {
    expect(parseCaixaResponse(G, { ...payload, dezenasSorteadasOrdemSorteio: null }).drawOrder[0]).toBe(1);
  });
  it('rejects invalid data', () => {
    expect(() => parseCaixaResponse(G, { ...payload, listaDezenas: ['01'] })).toThrow(CaixaParseError);
    expect(() => parseBrDate('2026-10-02')).toThrow(CaixaParseError);
  });
});
