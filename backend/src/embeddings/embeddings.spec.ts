import { syntheticDraws } from '../test-utils/fixtures';
import { cooccurrenceMatrix } from '../statistics/statistics';
import { cosineSimilarity, drawEmbedding, DRAW_EMBEDDING_DIMENSIONS, gameCohesion, nearestNeighbors, numberEmbeddings, topEigen } from './embeddings';

describe('embeddings', () => {
  const game = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  it('draw embedding dims and self-similarity', () => {
    const v = drawEmbedding(game);
    expect(v).toHaveLength(DRAW_EMBEDDING_DIMENSIONS);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 10);
  });
  it('similar draws are closer than opposite draws', () => {
    const a = drawEmbedding(game);
    const b = drawEmbedding([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16]);
    const c = drawEmbedding([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]);
    expect(cosineSimilarity(a, b)).toBeGreaterThan(cosineSimilarity(a, c));
  });
  it('nearestNeighbors respects k and exclusion', () => {
    const vecs = [[1, 0], [0.9, 0.1], [0, 1]];
    expect(nearestNeighbors([1, 0], vecs, 1, new Set([0]))[0].index).toBe(1);
  });
  it('topEigen finds dominant eigenpair', () => {
    const { values, vectors } = topEigen([[2, 0], [0, 1]], 2);
    expect(values[0]).toBeCloseTo(2, 6);
    expect(Math.abs(vectors[0][0])).toBeCloseTo(1, 6);
    expect(values[1]).toBeCloseTo(1, 6);
  });
  it('number embeddings and cohesion', () => {
    const draws = syntheticDraws(300);
    const emb = numberEmbeddings(cooccurrenceMatrix(draws), draws.length, 8);
    expect(emb).toHaveLength(25);
    expect(emb[0]).toHaveLength(8);
    const c = gameCohesion(game, emb);
    expect(c).toBeGreaterThanOrEqual(-1);
    expect(c).toBeLessThanOrEqual(1);
  });
});
