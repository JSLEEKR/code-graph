import { helper22 } from './module22';

export function helper21(x: number): number {
  if (x <= 0) return 0;
  return x + helper22(x - 1);
}

export function process21(data: string): string {
  const n = helper21(data.length);
  return `[${n}] ${data}`;
}

export class Service21 {
  run(input: string): string {
    return process21(input);
  }
}
