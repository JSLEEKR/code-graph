import { helper21 } from './module21';

export function helper20(x: number): number {
  if (x <= 0) return 0;
  return x + helper21(x - 1);
}

export function process20(data: string): string {
  const n = helper20(data.length);
  return `[${n}] ${data}`;
}

export class Service20 {
  run(input: string): string {
    return process20(input);
  }
}
