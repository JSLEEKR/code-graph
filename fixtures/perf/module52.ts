import { helper53 } from './module53';

export function helper52(x: number): number {
  if (x <= 0) return 0;
  return x + helper53(x - 1);
}

export function process52(data: string): string {
  const n = helper52(data.length);
  return `[${n}] ${data}`;
}

export class Service52 {
  run(input: string): string {
    return process52(input);
  }
}
