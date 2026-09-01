import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Атомарная запись JSON: temp-файл рядом + rename.
 * При падении процесса посреди записи целевой файл не остаётся обрезанным.
 */
export async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmpPath, payload, 'utf8');
  await rename(tmpPath, filePath);
}

/** Сериализация мутаций одного файла — без гонок read-modify-write. */
export function createMutationQueue() {
  let tail: Promise<unknown> = Promise.resolve();

  return async function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task, task);
    tail = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };
}
