import { helper13 } from './module13';

export function helper12(x: number): number {
  if (x <= 0) return 0;
  return x + helper13(x - 1);
}

export function process12(data: string): string {
  const n = helper12(data.length);
  return `[${n}] ${data}`;
}

export class Service12 {
  run(input: string): string {
    return process12(input);
  }
}
