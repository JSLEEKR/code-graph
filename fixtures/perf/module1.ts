import { helper2 } from './module2';

export function helper1(x: number): number {
  if (x <= 0) return 0;
  return x + helper2(x - 1);
}

export function process1(data: string): string {
  const n = helper1(data.length);
  return `[${n}] ${data}`;
}

export class Service1 {
  run(input: string): string {
    return process1(input);
  }
}
