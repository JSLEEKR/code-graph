import { helper4 } from './module4';

export function helper3(x: number): number {
  if (x <= 0) return 0;
  return x + helper4(x - 1);
}

export function process3(data: string): string {
  const n = helper3(data.length);
  return `[${n}] ${data}`;
}

export class Service3 {
  run(input: string): string {
    return process3(input);
  }
}
