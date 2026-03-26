import { helper5 } from './module5';

export function helper4(x: number): number {
  if (x <= 0) return 0;
  return x + helper5(x - 1);
}

export function process4(data: string): string {
  const n = helper4(data.length);
  return `[${n}] ${data}`;
}

export class Service4 {
  run(input: string): string {
    return process4(input);
  }
}
