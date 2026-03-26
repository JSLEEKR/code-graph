import { helper28 } from './module28';

export function helper27(x: number): number {
  if (x <= 0) return 0;
  return x + helper28(x - 1);
}

export function process27(data: string): string {
  const n = helper27(data.length);
  return `[${n}] ${data}`;
}

export class Service27 {
  run(input: string): string {
    return process27(input);
  }
}
