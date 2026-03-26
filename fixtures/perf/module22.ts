import { helper23 } from './module23';

export function helper22(x: number): number {
  if (x <= 0) return 0;
  return x + helper23(x - 1);
}

export function process22(data: string): string {
  const n = helper22(data.length);
  return `[${n}] ${data}`;
}

export class Service22 {
  run(input: string): string {
    return process22(input);
  }
}
