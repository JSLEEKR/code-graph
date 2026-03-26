import { helper16 } from './module16';

export function helper15(x: number): number {
  if (x <= 0) return 0;
  return x + helper16(x - 1);
}

export function process15(data: string): string {
  const n = helper15(data.length);
  return `[${n}] ${data}`;
}

export class Service15 {
  run(input: string): string {
    return process15(input);
  }
}
