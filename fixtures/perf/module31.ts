import { helper32 } from './module32';

export function helper31(x: number): number {
  if (x <= 0) return 0;
  return x + helper32(x - 1);
}

export function process31(data: string): string {
  const n = helper31(data.length);
  return `[${n}] ${data}`;
}

export class Service31 {
  run(input: string): string {
    return process31(input);
  }
}
