import { helper10 } from './module10';

export function helper9(x: number): number {
  if (x <= 0) return 0;
  return x + helper10(x - 1);
}

export function process9(data: string): string {
  const n = helper9(data.length);
  return `[${n}] ${data}`;
}

export class Service9 {
  run(input: string): string {
    return process9(input);
  }
}
