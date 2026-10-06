import { Semaphore, sleep } from './concurrency';

describe('Semaphore', () => {
  it('never runs more than `limit` tasks at once and runs all of them', async () => {
    const sem = new Semaphore(2);
    let active = 0;
    let peak = 0;
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        sem.run(async () => {
          peak = Math.max(peak, ++active);
          await sleep(5);
          active--;
          return n;
        }),
      ),
    );
    expect(peak).toBe(2);
    expect(results).toEqual([1, 2, 3, 4, 5]);
  });
  it('releases the slot when a task fails', async () => {
    const sem = new Semaphore(1);
    await expect(sem.run(() => Promise.reject(new Error('x')))).rejects.toThrow('x');
    await expect(sem.run(async () => 'ok')).resolves.toBe('ok');
  });
  it('does not let a newcomer jump the queue when a slot is released', async () => {
    const sem = new Semaphore(1);
    let active = 0;
    let peak = 0;
    const task = () =>
      sem.run(async () => {
        peak = Math.max(peak, ++active);
        await sleep(1);
        active--;
      });
    const first = task();
    const queued = task();
    await first; // libera a vaga para `queued`...
    const newcomer = task(); // ...e esta chamada chega antes de `queued` acordar
    await Promise.all([queued, newcomer]);
    expect(peak).toBe(1);
  });
});
