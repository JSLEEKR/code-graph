import { helper33 } from './module33';

export function helper32(x: number): number {
  if (x <= 0) return 0;
  return x + helper33(x - 1);
}

export function process32(data: string): string {
  const n = helper32(data.length);
  return `[${n}] ${data}`;
}

export class Service32 {
  run(input: string): string {
    return process32(input);
  }
}
