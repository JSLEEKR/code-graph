import { helper11 } from './module11';

export function helper10(x: number): number {
  if (x <= 0) return 0;
  return x + helper11(x - 1);
}

export function process10(data: string): string {
  const n = helper10(data.length);
  return `[${n}] ${data}`;
}

export class Service10 {
  run(input: string): string {
    return process10(input);
  }
}
