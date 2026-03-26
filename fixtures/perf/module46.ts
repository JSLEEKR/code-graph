import { helper47 } from './module47';

export function helper46(x: number): number {
  if (x <= 0) return 0;
  return x + helper47(x - 1);
}

export function process46(data: string): string {
  const n = helper46(data.length);
  return `[${n}] ${data}`;
}

export class Service46 {
  run(input: string): string {
    return process46(input);
  }
}
