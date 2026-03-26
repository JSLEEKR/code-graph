import { helper1 } from './module1';

export function helper0(x: number): number {
  if (x <= 0) return 0;
  return x + helper1(x - 1);
}

export function process0(data: string): string {
  const n = helper0(data.length);
  return `[${n}] ${data}`;
}

export class Service0 {
  run(input: string): string {
    return process0(input);
  }
}
