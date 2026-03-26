import { helper25 } from './module25';

export function helper24(x: number): number {
  if (x <= 0) return 0;
  return x + helper25(x - 1);
}

export function process24(data: string): string {
  const n = helper24(data.length);
  return `[${n}] ${data}`;
}

export class Service24 {
  run(input: string): string {
    return process24(input);
  }
}
