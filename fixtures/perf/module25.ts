import { helper26 } from './module26';

export function helper25(x: number): number {
  if (x <= 0) return 0;
  return x + helper26(x - 1);
}

export function process25(data: string): string {
  const n = helper25(data.length);
  return `[${n}] ${data}`;
}

export class Service25 {
  run(input: string): string {
    return process25(input);
  }
}
