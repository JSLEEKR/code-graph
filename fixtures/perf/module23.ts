import { helper24 } from './module24';

export function helper23(x: number): number {
  if (x <= 0) return 0;
  return x + helper24(x - 1);
}

export function process23(data: string): string {
  const n = helper23(data.length);
  return `[${n}] ${data}`;
}

export class Service23 {
  run(input: string): string {
    return process23(input);
  }
}
