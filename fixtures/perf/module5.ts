import { helper6 } from './module6';

export function helper5(x: number): number {
  if (x <= 0) return 0;
  return x + helper6(x - 1);
}

export function process5(data: string): string {
  const n = helper5(data.length);
  return `[${n}] ${data}`;
}

export class Service5 {
  run(input: string): string {
    return process5(input);
  }
}
