import { helper17 } from './module17';

export function helper16(x: number): number {
  if (x <= 0) return 0;
  return x + helper17(x - 1);
}

export function process16(data: string): string {
  const n = helper16(data.length);
  return `[${n}] ${data}`;
}

export class Service16 {
  run(input: string): string {
    return process16(input);
  }
}
