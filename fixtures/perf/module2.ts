import { helper3 } from './module3';

export function helper2(x: number): number {
  if (x <= 0) return 0;
  return x + helper3(x - 1);
}

export function process2(data: string): string {
  const n = helper2(data.length);
  return `[${n}] ${data}`;
}

export class Service2 {
  run(input: string): string {
    return process2(input);
  }
}
