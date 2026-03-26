import { helper37 } from './module37';

export function helper36(x: number): number {
  if (x <= 0) return 0;
  return x + helper37(x - 1);
}

export function process36(data: string): string {
  const n = helper36(data.length);
  return `[${n}] ${data}`;
}

export class Service36 {
  run(input: string): string {
    return process36(input);
  }
}
