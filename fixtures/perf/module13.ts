import { helper14 } from './module14';

export function helper13(x: number): number {
  if (x <= 0) return 0;
  return x + helper14(x - 1);
}

export function process13(data: string): string {
  const n = helper13(data.length);
  return `[${n}] ${data}`;
}

export class Service13 {
  run(input: string): string {
    return process13(input);
  }
}
