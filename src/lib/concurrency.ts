export class CallBudget {
  private count = 0;
  private readonly maxCalls: number;

  constructor(maxCalls = 32) {
    this.maxCalls = maxCalls;
  }

  public track(): void {
    if (this.count >= this.maxCalls) {
      throw new Error(`Call budget exceeded: maximum ${this.maxCalls} Qloo calls allowed per run.`);
    }
    this.count++;
  }

  public getCalls(): number {
    return this.count;
  }
}

export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency = 6
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }).map(async () => {
    while (currentIndex < tasks.length) {
      const index = currentIndex++;
      results[index] = await tasks[index]();
    }
  });

  await Promise.all(workers);
  return results;
}

