import { helper12 } from './module12';

export function helper11(x: number): number {
  if (x <= 0) return 0;
  return x + helper12(x - 1);
}

export function process11(data: string): string {
  const n = helper11(data.length);
  return `[${n}] ${data}`;
}

export class Service11 {
  run(input: string): string {
    return process11(input);
  }
}
