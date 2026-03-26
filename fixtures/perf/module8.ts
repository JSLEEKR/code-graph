import { helper9 } from './module9';

export function helper8(x: number): number {
  if (x <= 0) return 0;
  return x + helper9(x - 1);
}

export function process8(data: string): string {
  const n = helper8(data.length);
  return `[${n}] ${data}`;
}

export class Service8 {
  run(input: string): string {
    return process8(input);
  }
}
