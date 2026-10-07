import { parentPort, workerData } from 'node:worker_threads';
import { Draw, GameId } from '../common/lottery';
import { TaskName, TASKS } from './analysis.tasks';

/** Executa uma única tarefa de análise e devolve o resultado (ou o erro) à thread principal. */
const { task, gameId, draws, args } = workerData as { task: TaskName; gameId: GameId; draws: Draw[]; args: never };
try {
  parentPort!.postMessage({ ok: true, result: TASKS[task](gameId, draws, args) });
} catch (error) {
  const e = error as Error;
  parentPort!.postMessage({ ok: false, name: e.name, message: e.message });
}
