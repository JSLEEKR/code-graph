import { helper27 } from './module27';

export function helper26(x: number): number {
  if (x <= 0) return 0;
  return x + helper27(x - 1);
}

export function process26(data: string): string {
  const n = helper26(data.length);
  return `[${n}] ${data}`;
}

export class Service26 {
  run(input: string): string {
    return process26(input);
  }
}
