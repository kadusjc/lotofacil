import { Injectable } from '@nestjs/common';
import { Draw, PrizeTier } from '../common/lottery';
import { drawEmbedding } from '../embeddings/embeddings';
import { DRAW_VECTOR_INDEX, Neo4jService } from '../neo4j/neo4j.service';
import { StrategyWeights } from '../strategy/strategy.engine';

/**
 * Modelo do grafo:
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

  async upsertMany(draws: Draw[]): Promise<void> {
    for (let i = 0; i < draws.length; i += BATCH_SIZE) {
      const rows = draws.slice(i, i + BATCH_SIZE).map((d) => ({
        concurso: d.concurso,
        date: d.date,
        numbers: d.numbers,
        drawOrder: d.drawOrder,
        prizes: JSON.stringify(d.prizes),
        embedding: drawEmbedding(d.numbers),
      }));
      await this.neo4j.write(
        `UNWIND $rows AS row
         MERGE (d:Draw {concurso: toInteger(row.concurso)})
         SET d.date = row.date,
             d.numbers = [x IN row.numbers | toInteger(x)],
             d.drawOrder = [x IN row.drawOrder | toInteger(x)],
             d.prizes = row.prizes, d.embedding = row.embedding
         WITH d, row
         UNWIND range(0, size(row.drawOrder) - 1) AS pos
         MATCH (n:Number {value: toInteger(row.drawOrder[pos])})
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
  async linkSequence(): Promise<void> {
    await this.neo4j.write(
      `MATCH (a:Draw)-[r:NEXT]->(b:Draw) WHERE b.concurso <> a.concurso + 1 DELETE r`,
    );
    await this.neo4j.write(
      `MATCH (a:Draw) MATCH (b:Draw {concurso: a.concurso + 1})
       MERGE (a)-[:NEXT]->(b)`,
    );
  }

  async saveNumberGraph(cooc: number[][], ppmi: number[][], embeddings: number[][]): Promise<void> {
    const numbers = embeddings.map((embedding, i) => ({ value: i + 1, embedding, frequency: cooc[i][i] }));
    const pairs: PairStat[] = [];
    for (let i = 0; i < cooc.length; i++) {
      for (let j = i + 1; j < cooc.length; j++) {
        pairs.push({ a: i + 1, b: j + 1, count: cooc[i][j], ppmi: ppmi[i][j] });
      }
    }
    await this.neo4j.write(
      `UNWIND $numbers AS row MATCH (n:Number {value: toInteger(row.value)})
       SET n.embedding = row.embedding, n.frequency = toInteger(row.frequency)`,
      { numbers },
    );
    await this.neo4j.write(
      `UNWIND $pairs AS p
       MATCH (a:Number {value: toInteger(p.a)}), (b:Number {value: toInteger(p.b)})
       MERGE (a)-[r:CO_OCCURS]->(b)
       SET r.count = toInteger(p.count), r.ppmi = p.ppmi`,
      { pairs },
    );
  }

  async findAll(): Promise<Draw[]> {
    const result = await this.neo4j.read<{ d: Record<string, unknown> }>(
      `MATCH (d:Draw) RETURN d {.concurso, .date, .numbers, .drawOrder, .prizes} AS d ORDER BY d.concurso`,
    );
    return result.records.map((r) => this.toDraw(r.get('d')));
  }

  async existingConcursos(): Promise<number[]> {
    const result = await this.neo4j.read<{ c: number }>('MATCH (d:Draw) RETURN d.concurso AS c ORDER BY c');
    return result.records.map((r) => r.get('c'));
  }

  /** Busca semântica no índice vetorial do Neo4j: concursos mais parecidos e o que veio depois. */
  async findSimilar(concurso: number, k: number): Promise<SimilarDraw[]> {
    const result = await this.neo4j.read(
      `MATCH (src:Draw {concurso: toInteger($concurso)})
       CALL db.index.vector.queryNodes($index, toInteger($k) + 1, src.embedding) YIELD node, score
       WHERE node <> src
       OPTIONAL MATCH (node)-[:NEXT]->(nxt:Draw)
       RETURN node.concurso AS concurso, node.date AS date, node.numbers AS numbers,
              score AS similarity, nxt.numbers AS nextNumbers
       ORDER BY similarity DESC LIMIT toInteger($k)`,
      { concurso, k, index: DRAW_VECTOR_INDEX },
    );
    return result.records.map((r) => ({
      concurso: r.get('concurso'),
      date: r.get('date'),
      numbers: r.get('numbers'),
      similarity: r.get('similarity'),
      nextNumbers: r.get('nextNumbers') ?? null,
    }));
  }

  async topPairs(limit: number, orderBy: 'count' | 'ppmi' = 'count'): Promise<PairStat[]> {
    const result = await this.neo4j.read(
      `MATCH (a:Number)-[r:CO_OCCURS]->(b:Number)
       RETURN a.value AS a, b.value AS b, r.count AS count, r.ppmi AS ppmi
       ORDER BY r[$orderBy] DESC LIMIT toInteger($limit)`,
      { limit, orderBy },
    );
    return result.records.map((r) => ({ a: r.get('a'), b: r.get('b'), count: r.get('count'), ppmi: r.get('ppmi') }));
  }

  /** Pesos calibrados do ensemble: (:Model {name:'strategy', weights, basedOnConcurso, updatedAt}). */
  async loadModelWeights(): Promise<Partial<StrategyWeights> | null> {
    const result = await this.neo4j.read<{ w: string | null }>(`MATCH (m:Model {name: 'strategy'}) RETURN m.weights AS w`);
    const raw = result.records[0]?.get('w');
    return raw ? (JSON.parse(raw) as Partial<StrategyWeights>) : null;
  }

  async saveModelWeights(weights: Partial<StrategyWeights>, basedOnConcurso: number): Promise<void> {
    await this.neo4j.write(
      `MERGE (m:Model {name: 'strategy'})
       SET m.weights = $weights, m.basedOnConcurso = toInteger($basedOnConcurso), m.updatedAt = datetime()`,
      { weights: JSON.stringify(weights), basedOnConcurso },
    );
  }

  /** Histórico de conferências: (:Bet {numbers, hits, prize, checkedAt})-[:CHECKED_AGAINST]->(:Draw). */
  async saveChecks(concurso: number, bets: Array<{ numbers: number[]; hits: number; prize: number }>): Promise<void> {
    await this.neo4j.write(
      `MATCH (d:Draw {concurso: toInteger($concurso)})
       UNWIND $bets AS b
       CREATE (:Bet {numbers: [x IN b.numbers | toInteger(x)], hits: toInteger(b.hits), prize: b.prize, checkedAt: datetime()})
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
