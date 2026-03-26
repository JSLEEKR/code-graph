import { helper8 } from './module8';

export function helper7(x: number): number {
  if (x <= 0) return 0;
  return x + helper8(x - 1);
}

export function process7(data: string): string {
  const n = helper7(data.length);
  return `[${n}] ${data}`;
}

export class Service7 {
  run(input: string): string {
    return process7(input);
  }
}
