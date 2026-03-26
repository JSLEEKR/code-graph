import { helper19 } from './module19';

export function helper18(x: number): number {
  if (x <= 0) return 0;
  return x + helper19(x - 1);
}

export function process18(data: string): string {
  const n = helper18(data.length);
  return `[${n}] ${data}`;
}

export class Service18 {
  run(input: string): string {
    return process18(input);
  }
}
