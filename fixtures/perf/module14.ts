import { helper15 } from './module15';

export function helper14(x: number): number {
  if (x <= 0) return 0;
  return x + helper15(x - 1);
}

export function process14(data: string): string {
  const n = helper14(data.length);
  return `[${n}] ${data}`;
}

export class Service14 {
  run(input: string): string {
    return process14(input);
  }
}
