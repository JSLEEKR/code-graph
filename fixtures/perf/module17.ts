import { helper18 } from './module18';

export function helper17(x: number): number {
  if (x <= 0) return 0;
  return x + helper18(x - 1);
}

export function process17(data: string): string {
  const n = helper17(data.length);
  return `[${n}] ${data}`;
}

export class Service17 {
  run(input: string): string {
    return process17(input);
  }
}
