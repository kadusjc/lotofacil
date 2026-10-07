import { Injectable } from '@nestjs/common';
import { Draw, LotteryGame, PrizeTier } from '../common/lottery';
import { drawEmbedding } from '../embeddings/embeddings';
import { Neo4jService } from '../neo4j/neo4j.service';

/**
 * Modelo do grafo (rótulos por jogo, ver LotteryGame.graph; Lotofácil usa Draw/Number/Bet):
 *   (:Draw {concurso, date, numbers, drawOrder, prizes, embedding})
 *   (:Draw)-[:DREW {position}]->(:Number {value, embedding})
 *   (:Draw)-[:NEXT]->(:Draw)
 *   (:Number)-[:CO_OCCURS {count, ppmi}]->(:Number)    (a < b)
 */
export interface SimilarDraw {
  concurso: number;
  date: string;
  numbers: number[];
  similarity: number;
  nextNumbers: number[] | null;
}

export interface PairStat {
  a: number;
  b: number;
  count: number;
  ppmi: number;
}

const BATCH_SIZE = 500;

@Injectable()
export class DrawsRepository {
  constructor(private readonly neo4j: Neo4jService) {}

  async upsertMany(game: LotteryGame, draws: Draw[]): Promise<void> {
    const { draw: D, number: N } = game.graph;
    for (let i = 0; i < draws.length; i += BATCH_SIZE) {
      const rows = draws.slice(i, i + BATCH_SIZE).map((d) => ({
        concurso: d.concurso,
        date: d.date,
        numbers: d.numbers,
        drawOrder: d.drawOrder,
        prizes: JSON.stringify(d.prizes),
        embedding: drawEmbedding(game, d.numbers),
      }));
      await this.neo4j.write(
        `UNWIND $rows AS row
         MERGE (d:${D} {concurso: toInteger(row.concurso)})
         SET d.date = row.date,
             d.numbers = [x IN row.numbers | toInteger(x)],
             d.drawOrder = [x IN row.drawOrder | toInteger(x)],
             d.prizes = row.prizes, d.embedding = row.embedding
         WITH d, row
         UNWIND range(0, size(row.drawOrder) - 1) AS pos
         MATCH (n:${N} {value: toInteger(row.drawOrder[pos])})
         MERGE (d)-[r:DREW]->(n)
         SET r.position = pos + 1`,
        { rows },
      );
    }
  }

  /**
   * Liga apenas concursos consecutivos (n → n+1). Ligar "o próximo existente" criaria arestas
   * erradas sobre lacunas (concursos que falharam no download) que nunca seriam removidas.
   */
  async linkSequence(game: LotteryGame): Promise<void> {
    const D = game.graph.draw;
    await this.neo4j.write(
      `MATCH (a:${D})-[r:NEXT]->(b:${D}) WHERE b.concurso <> a.concurso + 1 DELETE r`,
    );
    await this.neo4j.write(
      `MATCH (a:${D}) MATCH (b:${D} {concurso: a.concurso + 1})
       MERGE (a)-[:NEXT]->(b)`,
    );
  }

  async saveNumberGraph(game: LotteryGame, cooc: number[][], ppmi: number[][], embeddings: number[][]): Promise<void> {
    const N = game.graph.number;
    const numbers = embeddings.map((embedding, i) => ({ value: i + 1, embedding, frequency: cooc[i][i] }));
    const pairs: PairStat[] = [];
    for (let i = 0; i < cooc.length; i++) {
      for (let j = i + 1; j < cooc.length; j++) {
        pairs.push({ a: i + 1, b: j + 1, count: cooc[i][j], ppmi: ppmi[i][j] });
      }
    }
    await this.neo4j.write(
      `UNWIND $numbers AS row MATCH (n:${N} {value: toInteger(row.value)})
       SET n.embedding = row.embedding, n.frequency = toInteger(row.frequency)`,
      { numbers },
    );
    await this.neo4j.write(
      `UNWIND $pairs AS p
       MATCH (a:${N} {value: toInteger(p.a)}), (b:${N} {value: toInteger(p.b)})
       MERGE (a)-[r:CO_OCCURS]->(b)
       SET r.count = toInteger(p.count), r.ppmi = p.ppmi`,
      { pairs },
    );
  }

  async findAll(game: LotteryGame): Promise<Draw[]> {
    const result = await this.neo4j.read<{ d: Record<string, unknown> }>(
      `MATCH (d:${game.graph.draw}) RETURN d {.concurso, .date, .numbers, .drawOrder, .prizes} AS d ORDER BY d.concurso`,
    );
    return result.records.map((r) => this.toDraw(r.get('d')));
  }

  async existingConcursos(game: LotteryGame): Promise<number[]> {
    const result = await this.neo4j.read<{ c: number }>(`MATCH (d:${game.graph.draw}) RETURN d.concurso AS c ORDER BY c`);
    return result.records.map((r) => r.get('c'));
  }

  /** Busca semântica no índice vetorial do Neo4j: concursos mais parecidos e o que veio depois. */
  async findSimilar(game: LotteryGame, concurso: number, k: number): Promise<SimilarDraw[]> {
    const D = game.graph.draw;
    const result = await this.neo4j.read(
      `MATCH (src:${D} {concurso: toInteger($concurso)})
       CALL db.index.vector.queryNodes($index, toInteger($k) + 1, src.embedding) YIELD node, score
       WHERE node <> src
       OPTIONAL MATCH (node)-[:NEXT]->(nxt:${D})
       RETURN node.concurso AS concurso, node.date AS date, node.numbers AS numbers,
              score AS similarity, nxt.numbers AS nextNumbers
       ORDER BY similarity DESC LIMIT toInteger($k)`,
      { concurso, k, index: game.graph.vectorIndex },
    );
    return result.records.map((r) => ({
      concurso: r.get('concurso'),
      date: r.get('date'),
      numbers: r.get('numbers'),
      similarity: r.get('similarity'),
      nextNumbers: r.get('nextNumbers') ?? null,
    }));
  }

  async topPairs(game: LotteryGame, limit: number, orderBy: 'count' | 'ppmi' = 'count'): Promise<PairStat[]> {
    const N = game.graph.number;
    const result = await this.neo4j.read(
      `MATCH (a:${N})-[r:CO_OCCURS]->(b:${N})
       RETURN a.value AS a, b.value AS b, r.count AS count, r.ppmi AS ppmi
       ORDER BY r[$orderBy] DESC LIMIT toInteger($limit)`,
      { limit, orderBy },
    );
    return result.records.map((r) => ({ a: r.get('a'), b: r.get('b'), count: r.get('count'), ppmi: r.get('ppmi') }));
  }

  /** Histórico de conferências: (:Bet {numbers, hits, prize, checkedAt})-[:CHECKED_AGAINST]->(:Draw). */
  async saveChecks(game: LotteryGame, concurso: number, bets: Array<{ numbers: number[]; hits: number; prize: number }>): Promise<void> {
    await this.neo4j.write(
      `MATCH (d:${game.graph.draw} {concurso: toInteger($concurso)})
       UNWIND $bets AS b
       CREATE (:${game.graph.bet} {numbers: [x IN b.numbers | toInteger(x)], hits: toInteger(b.hits), prize: b.prize, checkedAt: datetime()})
              -[:CHECKED_AGAINST]->(d)`,
      { concurso, bets },
    );
  }

  private toDraw(raw: Record<string, unknown>): Draw {
    return {
      concurso: raw.concurso as number,
      date: raw.date as string,
      numbers: raw.numbers as number[],
      drawOrder: raw.drawOrder as number[],
      prizes: JSON.parse((raw.prizes as string) ?? '[]') as PrizeTier[],
    };
  }
}
