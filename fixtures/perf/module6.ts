import { helper7 } from './module7';

export function helper6(x: number): number {
  if (x <= 0) return 0;
  return x + helper7(x - 1);
}

export function process6(data: string): string {
  const n = helper6(data.length);
  return `[${n}] ${data}`;
}

export class Service6 {
  run(input: string): string {
    return process6(input);
  }
}
