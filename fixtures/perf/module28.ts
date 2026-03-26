import { helper29 } from './module29';

export function helper28(x: number): number {
  if (x <= 0) return 0;
  return x + helper29(x - 1);
}

export function process28(data: string): string {
  const n = helper28(data.length);
  return `[${n}] ${data}`;
}

export class Service28 {
  run(input: string): string {
    return process28(input);
  }
}
